/**
 * Renders every wireframe in screens.cjs to docs/wireframes/<name>.png.
 * Usage: node docs/wireframes/source/render-wireframes.cjs [screen-name ...]
 * Needs Playwright with Chromium installed.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { SCREENS } = require("./screens.cjs");

const OUTPUT_DIR = path.join(__dirname, "..");
const STYLESHEET = fs.readFileSync(path.join(__dirname, "wireframe.css"), "utf8");
const VIEWPORT = { width: 1200, height: 760 };
const DEVICE_SCALE_FACTOR = 2;

function buildPage(screenHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLESHEET}</style></head>
    <body>${screenHtml}</body></html>`;
}

async function renderScreen(page, name) {
  const html = buildPage(SCREENS[name]());
  await page.setContent(html);

  const outputPath = path.join(OUTPUT_DIR, `${name}.png`);
  await page.locator(".screen").screenshot({ path: outputPath });
  console.log(`Rendered ${name}.png`);
}

async function renderWireframes() {
  const requestedNames = process.argv.slice(2);
  const names = requestedNames.length > 0 ? requestedNames : Object.keys(SCREENS);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR });

  for (const name of names) {
    await renderScreen(page, name);
  }

  await browser.close();
}

renderWireframes();
