# Examples

- `standard.js` — normal **16:9** presentation at 1280×720.
- `ultrawide.js` — panoramic **48:9** presentation at 3840×720, equivalent to three contiguous 16:9 panels.

Build both from the repository root:

```bash
npm run build:examples
```

Or build one directly:

```bash
npx beautiful-decks build examples/standard.js dist/standard.html
npx beautiful-decks build examples/ultrawide.js dist/ultrawide.html
```

Use standard mode when a request says “widescreen 16:9.” Use ultrawide only when the request explicitly says panoramic, theatre, multi-screen, 48:9, or three-panel.
