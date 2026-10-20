# Sketchboard

A hand-drawn style whiteboard: draw boxes, connect them with arrows, change outline and fill colors, and save your work.

Built by **S. Harish Krishnan**, AI Engineer.

## Use it

Open `index.html` (or `Sketchboard.html`) in a browser. It is a single self-contained file and works offline.

- Drawings save automatically in your browser.
- **Save** (Ctrl+S) writes a `.excalidraw` file; **Open** (Ctrl+O) loads one. Files are compatible with Excalidraw.
- Press `?` in the app for all keyboard shortcuts.

## Edit and rebuild

The source is `src/index.html`. After editing it, rebuild the single-file app:

```bash
python3 build.py
```

## Credits

Hand-drawn rendering by [rough.js](https://roughjs.com) (MIT). Virgil font by Excalidraw (SIL OFL 1.1). Inspired by [Excalidraw](https://excalidraw.com) (MIT); Sketchboard is an independent project.
