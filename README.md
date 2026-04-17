# Dungeon Sweep

Dungeon Sweep is a lightweight static browser game that combines Minesweeper-style deduction
with dungeon exploration. It is built with plain HTML, CSS, and vanilla JavaScript, with no
build step or dependencies.

## Play Locally

1. Open `index.html` in any modern browser.
2. Click any room to begin the run.

If you want to test it through a local server instead of opening the file directly:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

This project is ready to publish as-is on Netlify or GitHub Pages.

- Publish the repository root.
- Use `index.html` as the site entry point.
- No build command, package installation, or routing configuration is required.
- CSS and JavaScript assets use relative paths, so the site also works when served from a GitHub Pages repo subpath.

## Features

- Pixel-styled dungeon presentation built entirely with CSS
- Minesweeper-style trap counting and cascading safe-room reveals
- HP-based mistake system instead of instant failure
- Treasure rooms that add coins to the run
- Scout action that inspects one hidden room for 2 coins
- Flag controls via button mode or right-click
