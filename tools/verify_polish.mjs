// Feature 11 verification: day/night, lamppost lights, torch NPCs,
// swimming + climb-out, audio, minimap.
// Usage: node tools/verify_polish.mjs
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
await page.waitForFunction(() => window.__dayNight && window.__crowd, null, { timeout: 240000 });

const checks = [];
const check = (name, ok, extra = '') =>
  checks.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);

const results = await page.evaluate(async () => {
  const out = {};
  const { loadClips } = await import('/src/npc/npc.js');
  const clips = await loadClips();
  const names = new Set(clips.map((c) => c.name));
  out.clipSwimIdle = names.has('Swim_Idle_Loop');
  out.clipSwimFwd = names.has('Swim_Fwd_Loop');
  out.clipTorch = names.has('Idle_Torch_Loop');

  const dn = window.__dayNight;
  const player = window.__player;
  const crowd = window.__crowd;
  const scene = window.__scene;
  const THREE = window.__THREE;

  // Day/night: noon vs midnight.
  dn.setTime(12);
  out.noonNight = dn.isNight();
  const noonI = scene.children.find((o) => o.isDirectionalLight).intensity;
  dn.setTime(0);
  out.midNight = dn.isNight();
  const midI = scene.children.find((o) => o.isDirectionalLight).intensity;
  out.noonI = noonI.toFixed(2);
  out.midI = midI.toFixed(2);
  out.dimAtNight = midI < noonI * 0.4;

  // Lamps ramp up at night.
  const lamps = window.__lamps;
  player.pos.set(30, 0, 44);
  for (let i = 0; i < 120; i++) lamps.update(1 / 60, player.pos);
  out.lampLevel = lamps.level.toFixed(2);
  out.lampsOn = lamps.level > 0.9;
  dn.setTime(12);
  for (let i = 0; i < 120; i++) lamps.update(1 / 60, player.pos);
  out.lampsOff = lamps.level < 0.1;

  // Torches: nightfall recruits bearers, dawn releases them.
  const torches = window.__torches;
  dn.setTime(0);
  torches.update(crowd.npcs, window.__graph, player.pos, 0);
  const bearers = crowd.npcs.filter((n) => n.torchBearer);
  out.bearerCount = bearers.length;
  out.bearerAnim = bearers.length ? bearers[0].anim : null;
  out.bearerProp = bearers.length ? !!bearers[0].torchProp : false;
  dn.setTime(12);
  torches.update(crowd.npcs, window.__graph, player.pos, 0);
  out.released = crowd.npcs.filter((n) => n.torchBearer).length;

  // Swimming: drop into the sea, swim north into the quay, mantle out.
  const updatePlayer = (await import('/src/player/player.js')).updatePlayer;
  player.pos.set(20, 0, 160);
  player.test.setKeys({});
  dn.setTime(10);
  for (let i = 0; i < 120; i++) updatePlayer(player, 1 / 60); // fall + enter water
  out.swimming = player.swimming === true;
  out.swimY = player.pos.y.toFixed(2);
  // Swim north for a bit, then capture the swim animation mid-swim.
  player.camYaw = 0;
  player.test.setKeys({ KeyW: true }); // swim north into the quay wall
  for (let i = 0; i < 100; i++) updatePlayer(player, 1 / 60);
  out.swimAnim = player.anim;
  out.stillSwimming = player.swimming === true;
  for (let i = 0; i < 300; i++) updatePlayer(player, 1 / 60);
  out.mantledOut = player.swimming === false && player.mantling === null;
  out.afterY = player.pos.y.toFixed(2);
  out.afterZ = player.pos.z.toFixed(1);
  player.test.setKeys({});

  // Audio module runs without errors.
  const audio = window.__audio;
  out.audioOk = !!audio && typeof audio.update === 'function';
  audio.update(1 / 60, player);

  // Minimap canvas present.
  out.minimap = !!document.querySelector('canvas[style*="border-radius: 10px"]');

  // Draw-call sanity (lamps +1, torch light, minimap is DOM).
  out.calls = null; // filled below
  return out;
});

check('swim clips exist', results.clipSwimIdle && results.clipSwimFwd);
check('torch clip exists', results.clipTorch);
check('noon is day', results.noonNight === false, `sun=${results.noonI}`);
check('midnight is night', results.midNight === true, `sun=${results.midI}`);
check('sun dims at night', results.dimAtNight === true);
check('lamps turn on at night', results.lampsOn === true, `level=${results.lampLevel}`);
check('lamps turn off by day', results.lampsOff === true);
check('torch bearers recruited', results.bearerCount >= 4, `${results.bearerCount} bearers`);
check('bearers play torch idle', results.bearerAnim === 'Idle_Torch_Loop', results.bearerAnim);
check('bearers hold torch props', results.bearerProp === true);
check('bearers released at dawn', results.released === 0);
check('player swims in water', results.swimming === true, `y=${results.swimY}`);
check('swim animation', results.stillSwimming === true && results.swimAnim === 'Swim_Fwd_Loop', results.swimAnim);
check('mantle climbs out', results.mantledOut === true, `y=${results.afterY} z=${results.afterZ}`);
check('audio module runs', results.audioOk === true);
check('minimap present', results.minimap === true);

// Night screenshot: lampposts lit + torch bearers.
await page.evaluate(() => {
  window.__dayNight.setTime(0);
  const p = window.__player;
  p.pos.set(30, 0, 44);
  p.yaw = Math.PI; p.camYaw = 0; p.camPitch = 0.3; p.camDist = 6;
  p.test.setKeys({});
});
await page.waitForTimeout(9000);
try {
  await page.screenshot({ path: '/tmp/fun_night.png', timeout: 60000 });
  checks.push('PASS night screenshot taken');
} catch (e) {
  checks.push(`FAIL night screenshot (${String(e).split('\n')[0].slice(0, 60)})`);
}

// Swim screenshot.
await page.evaluate(async () => {
  window.__dayNight.setTime(10);
  const p = window.__player;
  const { updatePlayer } = await import('/src/player/player.js');
  p.pos.set(20, 0, 160);
  p.test.setKeys({});
  for (let i = 0; i < 120; i++) updatePlayer(p, 1 / 60);
  p.camYaw = Math.PI; p.camPitch = 0.35; p.camDist = 7;
  p.test.setKeys({ KeyW: true });
  window.__swimShot = setInterval(() => updatePlayer(p, 1 / 60), 16);
});
await page.waitForTimeout(4000);
await page.evaluate(() => clearInterval(window.__swimShot));
try {
  await page.screenshot({ path: '/tmp/fun_swim.png', timeout: 60000 });
  checks.push('PASS swim screenshot taken');
} catch (e) {
  checks.push(`FAIL swim screenshot (${String(e).split('\n')[0].slice(0, 60)})`);
}

console.log(checks.join('\n'));
console.log(`--- console: ${errors.length} error(s) ---`);
for (const e of errors.slice(0, 10)) console.log('ERROR:', e.slice(0, 200));
await browser.close();
process.exit(errors.length || checks.some((c) => c.startsWith('FAIL')) ? 1 : 0);
