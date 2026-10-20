// Generates icons, the social preview image and README screenshots from the real app.
// Run: npm run assets   (serves the folder itself; needs Google Chrome or Playwright's Chromium)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('..', import.meta.url).pathname;
const server = spawn('python3', ['-m', 'http.server', '4174', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const base = 'http://127.0.0.1:4174';
mkdirSync(`${root}docs`, { recursive: true });

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
try {
  await delay(800);
  const svg = readFileSync(`${root}icons/icon.svg`, 'utf8');

  // App icons
  for (const [size, file, pad] of [
    [192, 'icon-192.png', 0], [512, 'icon-512.png', 0], [180, 'apple-touch-icon.png', 0], [512, 'icon-maskable-512.png', 0.12],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = pad ? svg.replace('rx="112"', 'rx="0"') : svg;
    await page.setContent(`<style>html,body{margin:0;background:${pad ? '#6965db' : 'transparent'}}svg{display:block;width:${size * (1 - pad * 2)}px;height:${size * (1 - pad * 2)}px;margin:${size * pad}px}</style>${inner}`);
    await page.screenshot({ path: `${root}icons/${file}`, omitBackground: !pad });
    await page.close();
  }

  // A demo diagram rendered by the real app
  async function demoBoard(theme) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`${base}/index.html`);
    await page.evaluate((t) => {
      localStorage.clear();
      app.theme = t;
      applyTheme();
      const box = (x, y, w, h, bg, stroke, text, type = 'rectangle') => {
        const el = createElement(type, x, y);
        Object.assign(el, { width: w, height: h, backgroundColor: bg, strokeColor: stroke, text, fontSize: 20 });
        fitLabel(el);
        elements.push(el);
        return el;
      };
      const link = (a, b) => {
        const el = createElement('arrow', 0, 0);
        el.startBinding = { elementId: a.id };
        el.endBinding = { elementId: b.id };
        setArrowEnds(el, center(a), center(b));
        elements.push(el);
      };
      const users = box(80, 330, 180, 110, '#ffec99', '#f08c00', 'Customers', 'ellipse');
      const web = box(380, 330, 200, 110, '#a5d8ff', '#1971c2', 'Web app');
      const api = box(700, 330, 200, 110, '#d0bfff', '#6741d9', 'API gateway');
      const auth = box(1020, 160, 200, 100, '#b2f2bb', '#2f9e44', 'Auth service');
      const pay = box(1020, 500, 200, 100, '#ffc9c9', '#e03131', 'Payments');
      const db = box(1300, 320, 220, 150, '#e9ecef', '#343a40', 'Database', 'diamond');
      link(users, web); link(web, api); link(api, auth); link(api, pay); link(auth, db); link(pay, db);
      const note = createElement('text', 380, 560);
      Object.assign(note, { text: 'Drag any box — arrows follow', fontSize: 20, strokeColor: '#868e96' });
      measureFreeText(note);
      elements.push(note);
      refreshBoundArrows();
      selected = new Set([api.id]);
      onSelectionChange();
      zoomToFit();
      commit();
      render();
    }, theme);
    await page.waitForTimeout(400);
    return page;
  }

  const light = await demoBoard('light');
  await light.screenshot({ path: `${root}docs/screenshot.png` });
  await light.close();
  const dark = await demoBoard('dark');
  await dark.screenshot({ path: `${root}docs/screenshot-dark.png` });
  await dark.close();

  // Social preview card (1200x630)
  const shot = readFileSync(`${root}docs/screenshot.png`).toString('base64');
  const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await card.goto(`${base}/index.html`);
  await card.setContent(`
    <style>
      @font-face { font-family: Virgil; src: url(${base}/vendor/Virgil-Regular.woff2); }
      body { margin: 0; width: 1200px; height: 630px; background: #f3f0ff; font-family: system-ui, sans-serif; overflow: hidden; position: relative; }
      .copy { position: absolute; left: 64px; top: 70px; width: 440px; }
      h1 { font-family: Virgil, cursive; color: #6965db; font-size: 76px; margin: 0 0 18px; font-weight: 400; }
      p { font-size: 28px; line-height: 1.35; color: #1b1b1f; margin: 0 0 26px; }
      .tags { display: flex; flex-wrap: wrap; gap: 10px; }
      .tags span { background: #fff; border-radius: 999px; padding: 8px 16px; font-size: 19px; color: #3d3d45; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
      .by { position: absolute; left: 64px; bottom: 54px; font-size: 20px; color: #5c5c66; }
      .by b { color: #1b1b1f; }
      img { position: absolute; left: 560px; top: 70px; width: 820px; border-radius: 18px; box-shadow: 0 24px 60px rgba(40,36,120,.22); }
    </style>
    <div class="copy">
      <h1>Sketchboard</h1>
      <p>A free, private, hand-drawn whiteboard for diagrams and ideas.</p>
      <div class="tags"><span>No sign-up</span><span>Works offline</span><span>Excalidraw files</span></div>
    </div>
    <div class="by">Built by <b>S. Harish Krishnan</b> · AI Engineer</div>
    <img src="data:image/png;base64,${shot}">`);
  await card.evaluate(() => document.fonts.ready);
  await card.waitForTimeout(300);
  await card.screenshot({ path: `${root}og-image.png` });
  await card.close();
  console.log('assets written: icons/*.png, docs/screenshot*.png, og-image.png');
} finally {
  await browser.close();
  server.kill();
}
