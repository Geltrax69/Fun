// Feature 6 verification: capsule-vs-AABB wall blocking + sliding, prop
// circle blocking, ground height / falling, and jump regression — all via
// deterministic in-page stepping of updatePlayer (no wall-time dependence).
// Usage: node tools/verify_collisions.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/devtools/webtest/package.json');
const { chromium } = require('playwright');

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const errors = [];
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__player, null, { timeout: 180000 });

const checks = [];
const check = (name, ok, extra = '') =>
  checks.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);

const results = await page.evaluate(async () => {
  const out = {};
  const mod = await import('/src/player/player.js');
  const col = await import('/src/city/colliders.js');
  const p = window.__player;
  const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) mod.updatePlayer(p, dt); };
  const reset = (x, z) => {
    p.pos.set(x, 0, z); p.vy = 0; p.grounded = true; p.yaw = Math.PI;
    p.test.setKeys({});
  };

  out.buildingCount = window.__colliders.buildings.length;
  out.propCount = window.__colliders.props.length;

  // 1. Walk straight into a house: must stop at the wall (radius 0.35).
  const b = window.__colliders.buildings[0];
  const cx = (b.min.x + b.max.x) / 2;
  reset(cx, b.max.z + 3);
  p.camYaw = 0; // W walks -z, into the box
  p.test.setKeys({ KeyW: true });
  step(240); // 4 sim-seconds ≈ 10 m
  p.test.setKeys({});
  out.wallStopZ = p.pos.z;
  out.wallExpect = b.max.z + 0.35;
  // never penetrated any building
  out.penetrated = window.__colliders.buildings.some((bb) =>
    p.pos.x > bb.min.x - 0.34 && p.pos.x < bb.max.x + 0.34 &&
    p.pos.z > bb.min.z - 0.34 && p.pos.z < bb.max.z + 0.34 &&
    p.pos.y < bb.max.y && p.pos.y + 1.7 > bb.min.y);

  // 2. Walk into the wall at an angle: slides along it.
  reset(cx - 2, b.max.z + 3);
  p.camYaw = 0.6; // angled approach
  p.test.setKeys({ KeyW: true });
  const sx0 = p.pos.x;
  step(240);
  p.test.setKeys({});
  out.slideDx = Math.abs(p.pos.x - sx0);
  out.slideZ = p.pos.z; // should still be at/near the wall

  // 3. Lamppost blocks (circle collider).
  const lamp = window.__colliders.props.find((pr) => Math.abs(pr.r - 0.18) < 0.01);
  reset(lamp.x, lamp.z + 2);
  p.camYaw = 0;
  p.test.setKeys({ KeyW: true });
  step(180);
  p.test.setKeys({});
  out.lampDist = Math.hypot(p.pos.x - lamp.x, p.pos.z - lamp.z);

  // 4. Ground height samples.
  out.gStreet = col.groundHeightAt(30, 44);
  out.gCanal = col.groundHeightAt(0, 20);
  out.gSea = col.groundHeightAt(0, 200);

  // 5. Walking off the canal-mouth drop falls to the bed (synthetic: place
  //    at the bed with y=0 and let gravity take over).
  reset(0, 20);
  p.pos.y = 0; // above the -1.6 bed
  p.grounded = true;
  step(120);
  out.fellToBed = p.pos.y;

  // 6. Jump regression (peak + land).
  reset(30, 44);
  p.test.jump();
  let peak = 0;
  for (let i = 0; i < 120; i++) { mod.updatePlayer(p, 1 / 60); peak = Math.max(peak, p.pos.y); }
  out.jumpPeak = peak;
  out.landed = p.pos.y === 0 && p.grounded;

  return out;
});

check('collider counts sane',
  results.buildingCount > 150 && results.propCount > 400,
  `${results.buildingCount} boxes, ${results.propCount} circles`);
check('wall blocks player',
  Math.abs(results.wallStopZ - results.wallExpect) < 0.15,
  `stopped at z=${results.wallStopZ.toFixed(2)}, wall+r=${results.wallExpect.toFixed(2)}`);
check('no building penetration', !results.penetrated);
check('slides along wall',
  results.slideDx > 1.0 && results.slideZ <= results.wallExpect + 0.4,
  `dx=${results.slideDx.toFixed(2)}, z=${results.slideZ.toFixed(2)} vs wall ${results.wallExpect.toFixed(2)}`);
check('lamppost blocks',
  Math.abs(results.lampDist - (0.18 + 0.35)) < 0.15,
  `dist=${results.lampDist.toFixed(2)}`);
check('ground heights',
  results.gStreet === 0 && results.gCanal === -1.6 && results.gSea === -1.6,
  `street=${results.gStreet}, canal=${results.gCanal}, sea=${results.gSea}`);
check('falls to canal bed', Math.abs(results.fellToBed - -1.6) < 0.05, `y=${results.fellToBed.toFixed(2)}`);
check('jump still works', Math.abs(results.jumpPeak - 0.89) < 0.12 && results.landed,
  `peak=${results.jumpPeak.toFixed(2)}`);

console.log(checks.join('\n'));
console.log(`--- console: ${errors.length} error(s) ---`);
for (const e of errors.slice(0, 10)) console.log('ERROR:', e.slice(0, 200));
await browser.close();
process.exit(errors.length || checks.some((c) => c.startsWith('FAIL')) ? 1 : 0);
