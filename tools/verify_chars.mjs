// Feature 4 close-up verification: head placement, neck seam, beard, hood
// clipping, and proof that Idle_Loop is actually advancing.
// Usage: node verify_chars.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/devtools/webtest/package.json');
const { chromium } = require('playwright');

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const errors = [];
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

// x positions with 2.2 m spacing: i=2 ranger, i=4 bearded peasant, i=0 bearded peasant
const shots = [
  { name: 'ranger_hood', i: 2, x: -3.3 },
  { name: 'peasant_beard', i: 4, x: 1.1 },
];

for (const s of shots) {
  const px = s.x + 0.4, py = 1.75, pz = 2.4;
  await page.goto(
    `http://127.0.0.1:5173/chars.html?pos=${px},${py},${pz}&target=${s.x},1.45,0`,
    { waitUntil: 'networkidle' },
  );
  await page.waitForFunction(() => window.__chars && window.__chars.length === 8, null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  // Prove the animation advances: sample the Head bone quaternion twice.
  const q = await page.evaluate((i) => {
    const char = window.__chars[i];
    let head = null;
    char.traverse((o) => { if (o.isBone && o.name === 'Head') head = o; });
    const q0 = head.quaternion.clone();
    return new Promise((res) => setTimeout(() => {
      res({ before: q0.toArray(), after: head.quaternion.toArray() });
    }, 600));
  }, s.i);
  const moved = q.before.some((v, k) => Math.abs(v - q.after[k]) > 1e-4);
  console.log(`${s.name}: head bone animating = ${moved}`);

  await page.screenshot({ path: `/tmp/fun_char_${s.name}.png` });
  console.log(`${s.name}: screenshot saved`);
}

console.log(`--- console: ${errors.length} error(s) ---`);
for (const e of errors.slice(0, 10)) console.log('ERROR:', e);
await browser.close();
process.exit(errors.length ? 1 : 0);
