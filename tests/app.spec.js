// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');

/** Fail the test on any uncaught page error. */
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err; });
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const scene = (page) => page.evaluate(() => JSON.parse(JSON.stringify(elements)));

async function drawBox(page, x1, y1, x2, y2) {
  await page.keyboard.press('r');
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 6 });
  await page.mouse.up();
}
async function drawArrow(page, x1, y1, x2, y2) {
  await page.keyboard.press('a');
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 8 });
  await page.mouse.up();
}
async function twoConnectedBoxes(page) {
  await drawBox(page, 400, 250, 600, 370);
  await drawBox(page, 750, 450, 950, 570);
  await drawArrow(page, 500, 310, 850, 510);
}

test('loads with welcome screen and author credit', async ({ page }) => {
  await expect(page).toHaveTitle('Sketchboard');
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('.byline')).toContainText('S. Harish Krishnan');
  await expect(page.locator('.byline')).toContainText('AI Engineer');
});

test('creates multiple boxes and connects them with a bound arrow', async ({ page }) => {
  await twoConnectedBoxes(page);
  const els = await scene(page);
  const boxes = els.filter((e) => e.type === 'rectangle');
  const arrow = els.find((e) => e.type === 'arrow');
  expect(boxes).toHaveLength(2);
  expect(arrow.startBinding.elementId).toBe(boxes[0].id);
  expect(arrow.endBinding.elementId).toBe(boxes[1].id);
  await expect(page.locator('#welcome')).toBeHidden();
});

test('arrow stays attached when a box moves', async ({ page }) => {
  await twoConnectedBoxes(page);
  await page.keyboard.press('v');
  const before = (await scene(page)).find((e) => e.type === 'arrow');
  await page.mouse.move(850, 520);
  await page.mouse.down();
  await page.mouse.move(850, 200, { steps: 8 });
  await page.mouse.up();
  const els = await scene(page);
  const arrow = els.find((e) => e.type === 'arrow');
  const box = els.filter((e) => e.type === 'rectangle')[1];
  const endX = arrow.x + arrow.points[1][0];
  const endY = arrow.y + arrow.points[1][1];
  expect(endY).not.toBeCloseTo(before.y + before.points[1][1], 0);
  // the end point follows the box: just outside its outline, within the binding gap
  const near = (v, lo, hi) => v >= lo - 10 && v <= hi + 10;
  expect(near(endX, box.x, box.x + box.width) && near(endY, box.y, box.y + box.height)).toBe(true);
  const inside = endX > box.x + 1 && endX < box.x + box.width - 1 && endY > box.y + 1 && endY < box.y + box.height - 1;
  expect(inside).toBe(false);
  expect(arrow.endBinding.elementId).toBe(box.id);
});

test('edits outline and fill colors of the selected box', async ({ page }) => {
  await drawBox(page, 300, 300, 500, 420);
  await page.getByRole('button', { name: '#e03131' }).click();
  await page.getByRole('button', { name: '#a5d8ff' }).click();
  const [box] = await scene(page);
  expect(box.strokeColor).toBe('#e03131');
  expect(box.backgroundColor).toBe('#a5d8ff');
});

test('adds a text label inside a box', async ({ page }) => {
  await drawBox(page, 300, 300, 500, 420);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Payments API');
  await page.keyboard.press('Escape');
  const [box] = await scene(page);
  expect(box.text).toBe('Payments API');
});

test('undo and redo', async ({ page }) => {
  await drawBox(page, 300, 300, 500, 420);
  await drawBox(page, 600, 300, 800, 420);
  expect(await scene(page)).toHaveLength(2);
  await page.keyboard.press('Control+z');
  expect(await scene(page)).toHaveLength(1);
  await page.keyboard.press('Control+Shift+z');
  expect(await scene(page)).toHaveLength(2);
});

test('autosaves to the browser and restores after reload', async ({ page }) => {
  await twoConnectedBoxes(page);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'saved');
  await page.reload();
  const els = await scene(page);
  expect(els.map((e) => e.type).sort()).toEqual(['arrow', 'rectangle', 'rectangle']);
});

test('saves an Excalidraw-compatible file and opens it again', async ({ page }, testInfo) => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await twoConnectedBoxes(page);
  await page.keyboard.press('v');
  await page.mouse.click(500, 310);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Client');
  await page.keyboard.press('Escape');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.excalidraw$/);
  const file = testInfo.outputPath('drawing.excalidraw');
  await download.saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(data.type).toBe('excalidraw');
  expect(data.version).toBe(2);
  const label = data.elements.find((e) => e.type === 'text');
  expect(label.text).toBe('Client');
  expect(label.containerId).toBeTruthy();

  await page.evaluate(() => { elements = []; commit(); });
  await page.setInputFiles('#file-input', file);
  await expect.poll(async () => (await scene(page)).length).toBe(3);
  const restored = await scene(page);
  expect(restored.find((e) => e.text === 'Client')).toBeTruthy();
});

test('is installable: manifest and offline service worker', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Sketchboard');
  expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toContain('127.0.0.1:4173');
});
