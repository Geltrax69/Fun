// Feature 5 verification: deterministic in-page stepping of updatePlayer
// (2 sim-seconds per check, no wall-time dependence), camera wall pull-in,
// animation switching, and a screenshot of the ranger in the city.
// Usage: node tools/verify_player.mjs
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
  const p = window.__player;
  const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) mod.updatePlayer(p, dt); };

  // 1. Walk 2 sim-seconds north (W, away from the south-placed camera).
  p.pos.set(30, 0, 44); p.yaw = Math.PI; p.camYaw = 0; p.vy = 0; p.grounded = true;
  p.test.setKeys({ KeyW: true });
  const z0 = p.pos.z;
  step(120);
  out.walkDist = z0 - p.pos.z; // expect 2.5 * 2 = 5.0

  // 2. Run 2 sim-seconds.
  p.pos.set(30, 0, 44);
  p.test.setKeys({ KeyW: true, ShiftLeft: true });
  const z2 = p.pos.z;
  step(120);
  out.runDist = z2 - p.pos.z; // expect 7.0 * 2 = 14.0
  out.runAnim = p.anim;
  p.test.setKeys({});

  // 3. Strafe right (D) moves +x relative to the camera.
  p.pos.set(30, 0, 44); p.camYaw = 0;
  p.test.setKeys({ KeyD: true });
  const x0 = p.pos.x;
  step(60);
  out.strafeDx = p.pos.x - x0; // expect 2.5 * 1 = 2.5
  p.test.setKeys({});

  // 4. Jump: peak height and landing.
  p.pos.set(30, 0, 44); p.vy = 0; p.grounded = true;
  p.test.jump();
  let peak = 0;
  for (let i = 0; i < 30; i++) { mod.updatePlayer(p, 1 / 60); peak = Math.max(peak, p.pos.y); }
  out.jumpAnim = p.anim; // sampled mid-flight
  for (let i = 0; i < 90; i++) { mod.updatePlayer(p, 1 / 60); peak = Math.max(peak, p.pos.y); }
  out.jumpPeak = peak; // expect v^2/2g = 4.8^2/26 ≈ 0.89
  out.landed = p.pos.y === 0 && p.grounded;

  // 5. Camera wall pull-in.
  const b = window.__colliders.buildings[0];
  const cx = (b.min.x + b.max.x) / 2;
  p.pos.set(cx, 0, b.min.z - 1.5);
  p.camYaw = 0; p.camPitch = 0.3; p.camDist = 6;
  step(1);
  const c = p.camera.position;
  out.camDist = Math.hypot(c.x - p.pos.x, c.y - p.pos.y - 1.62, c.z - p.pos.z);

  // 6. Facing: after walking north, the model faces the movement direction.
  p.pos.set(30, 0, 44); p.yaw = 0; p.camYaw = 0;
  p.test.setKeys({ KeyW: true });
  step(60);
  p.test.setKeys({});
  out.faceYaw = p.group.rotation.y; // expect ≈ π (facing -z/north)

  return out;
});

check('walk speed', Math.abs(results.walkDist - 5.0) < 0.3, `${results.walkDist.toFixed(2)} m / 2 s`);
check('run speed', Math.abs(results.runDist - 14.0) < 0.5, `${results.runDist.toFixed(2)} m / 2 s`);
check('strafe right', Math.abs(results.strafeDx - 2.5) < 0.3, `${results.strafeDx.toFixed(2)} m / 1 s`);
check('jump peak', Math.abs(results.jumpPeak - 0.89) < 0.1, `${results.jumpPeak.toFixed(2)} m`);
check('jump lands', results.landed);
check('jump animation', results.jumpAnim === 'Jump_Loop', results.jumpAnim);
check('run animation', results.runAnim === 'Jog_Fwd_Loop', results.runAnim);
check('camera pulls in at wall', results.camDist < 5.0, `${results.camDist.toFixed(1)} m vs want 6`);
check('model faces movement', Math.abs(results.faceYaw - Math.PI) < 0.3, `${results.faceYaw.toFixed(2)} rad`);

// Screenshot of the ranger from behind, church ahead.
await page.evaluate(() => {
  const p = window.__player;
  p.test.setKeys({});
  p.pos.set(30, 0, 44);
  p.yaw = Math.PI; p.camYaw = 0; p.camPitch = 0.3; p.camDist = 4.6;
});
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/fun_player.png' });

console.log(checks.join('\n'));
console.log(`--- console: ${errors.length} error(s) ---`);
for (const e of errors.slice(0, 10)) console.log('ERROR:', e.slice(0, 200));
await browser.close();
process.exit(errors.length || checks.some((c) => c.startsWith('FAIL')) ? 1 : 0);
