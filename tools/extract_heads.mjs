#!/usr/bin/env node
/**
 * Extract heads from the UniversalBase superhero bodies — in-browser edition.
 *
 * Why in-browser: Blender 4.x removed the Collada importer and this VM lost
 * its Blender install on reboot; three.js in headless Chromium handles the
 * glTF import, vertex filtering, texture downscale and .glb export natively.
 *
 * Usage: node tools/extract_heads.mjs   (needs the vite dev server running)
 * Reads:  public/assets/chars/heads-src/Superhero_{Male,Female}_FullBody.gltf (temp staging)
 *         via public/extract.html (temp workbench page)
 * Writes: public/assets/chars/heads/Head_{Male,Female}.glb
 * Then deletes the temp staging + workbench page.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('/home/hatch/workspace/devtools/webtest/package.json');
const { chromium } = require('playwright');

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR:', String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE:', m.text().slice(0, 200));
  else if (m.text().startsWith('[')) console.log(m.text());
});

await page.goto('http://127.0.0.1:5173/extract.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__extract, null, { timeout: 30000 });

const outDir = join(REPO, 'public', 'assets', 'chars', 'heads');
mkdirSync(outDir, { recursive: true });

for (const sex of ['Male', 'Female']) {
  const r = await page.evaluate((s) => window.__extract(s), sex);
  const out = join(outDir, `Head_${sex}.glb`);
  writeFileSync(out, Buffer.from(r.base64, 'base64'));
  console.log(`wrote ${out} — ${(r.bytes / 1024).toFixed(0)} KB, ${r.verts} verts`);
  if (r.verts === 0) throw new Error(`no head verts kept for ${sex}`);
}

await browser.close();

// Clean up the temp staging + workbench page (never committed).
rmSync(join(REPO, 'public', 'assets', 'chars', 'heads-src'), { recursive: true, force: true });
rmSync(join(REPO, 'public', 'extract.html'), { force: true });
console.log('temp extraction files removed');
