// Feature 8 verification: waypoint graph sanity, 36 NPCs, graph movement,
// LOD visibility, variety, draw calls, 0 console errors.
// Usage: node tools/verify_crowd.mjs
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
await page.waitForFunction(() => window.__crowd, null, { timeout: 240000 });

const checks = [];
const check = (name, ok, extra = '') =>
  checks.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);

const results = await page.evaluate(() => {
  const out = {};
  const g = window.__graph;
  out.nodeCount = g.nodes.length;
  out.minLinks = Math.min(...g.nodes.map((n) => n.links.length));
  out.canalNodes = g.nodes.filter((n) => Math.abs(n.x) < 9).length;
  // connected components (BFS)
  const seen = new Set();
  let components = 0;
  for (let i = 0; i < g.nodes.length; i++) {
    if (seen.has(i)) continue;
    components++;
    const q = [i];
    seen.add(i);
    while (q.length) {
      for (const l of g.nodes[q.pop()].links) {
        if (!seen.has(l)) { seen.add(l); q.push(l); }
      }
    }
  }
  out.components = components;

  const crowd = window.__crowd;
  out.npcCount = crowd.npcs.length;
  // variety from stored configs
  const cfgs = crowd.npcs.map((n) => n.group.userData.config);
  out.sexCount = new Set(cfgs.map((c) => c.sex)).size;
  out.outfitCount = new Set(cfgs.map((c) => c.outfit)).size;

  // movement: step npc 0 for 2 sim-seconds
  const npc0 = crowd.npcs[0];
  const x0 = npc0.pos.x, z0 = npc0.pos.z;
  const fakeCam = { position: npc0.pos.clone() }; // keep LOD near
  for (let i = 0; i < 120; i++) crowd.update(1 / 60, fakeCam);
  out.moved = Math.hypot(npc0.pos.x - x0, npc0.pos.z - z0);

  // LOD: camera far away -> all hidden; camera on npc0 -> npc0 visible
  const farCam = { position: new (Object.getPrototypeOf(npc0.pos).constructor)(0, 60, 400) };
  crowd.update(1 / 60, farCam);
  out.hiddenFar = crowd.npcs.filter((n) => !n.group.visible).length;
  crowd.update(1 / 60, fakeCam);
  out.nearVisible = npc0.group.visible;
  return out;
});

check('graph nodes', results.nodeCount > 200, `${results.nodeCount} nodes`);
check('no isolated nodes', results.minLinks > 0, `min links=${results.minLinks}`);
check('no canal nodes', results.canalNodes === 0);
check('graph components (E/W split at canal)', results.components === 2, `${results.components}`);
check('36 NPCs', results.npcCount === 36);
check('NPC variety', results.sexCount === 2 && results.outfitCount === 2);
check('NPCs walk the graph', results.moved > 3.0, `${results.moved.toFixed(1)} m in 2 s`);
check('LOD hides far NPCs', results.hiddenFar === 36, `${results.hiddenFar}/36 hidden`);
check('LOD shows near NPC', results.nearVisible === true);

// Street-level screenshot + draw calls with the crowd active.
await page.evaluate(() => {
  const p = window.__player;
  p.test.setKeys({});
  p.pos.set(30, 0, 44);
  p.yaw = Math.PI; p.camYaw = 0; p.camPitch = 0.3; p.camDist = 4.6;
});
await page.waitForTimeout(6000);
const calls = await page.evaluate(() => window.__rendererInfo || null);
await page.screenshot({ path: '/tmp/fun_crowd.png' });

console.log(checks.join('\n'));
console.log(`--- console: ${errors.length} error(s) ---`);
for (const e of errors.slice(0, 10)) console.log('ERROR:', e.slice(0, 200));
await browser.close();
process.exit(errors.length || checks.some((c) => c.startsWith('FAIL')) ? 1 : 0);
