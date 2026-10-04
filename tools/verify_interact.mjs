// Feature 10 verification: E interaction — nearest NPC stops, faces the
// player, plays the interaction, shows a speech bubble, then resumes.
// Usage: node tools/verify_interact.mjs
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
await page.waitForFunction(() => window.__interaction, null, { timeout: 240000 });

const checks = [];
const check = (name, ok, extra = '') =>
  checks.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);

const results = await page.evaluate(() => {
  const out = {};
  const player = window.__player;
  const crowd = window.__crowd;
  const interaction = window.__interaction;
  const V3 = Object.getPrototypeOf(player.pos).constructor;
  const cam = { position: new V3(0, 5, 44) };
  const step = (n) => { for (let i = 0; i < n; i++) crowd.update(1 / 60, cam, player); };

  // 1. E with no NPC near -> false.
  player.pos.set(-120, 0, -130); // quiet street corner
  out.farResult = interaction.tryInteract(player, crowd);

  // 2. Place player next to a wanderer, press E.
  const npc = crowd.npcs.find((n) => n.behavior === 'wander');
  npc.pos.set(30, 0, 40);
  npc.node = 0;
  player.pos.set(30, 0, 42); // 2 m away
  player.test.setKeys({});
  out.nearResult = interaction.tryInteract(player, crowd);
  out.behavior = npc.behavior;
  out.hold = npc.hold;
  // facing: npc should face the player (player is +z of npc -> yaw ~0)
  step(5);
  out.faceYaw = npc.group.rotation.y;

  // 3. Speech bubble attached with text.
  let bubbleText = null;
  npc.group.traverse((o) => {
    if (o.element && o.element.classList && o.element.classList.contains('bubble')) {
      bubbleText = o.element.textContent;
    }
  });
  out.bubbleText = bubbleText;
  out.animStart = npc.anim;

  // 4. After the interaction duration, the NPC moves on to normal behavior
  // (wander, or an ambient greet since the player is still close).
  step(360); // 6 sim-seconds > 5 s interaction
  out.resumed = !['interact', 'interactStand'].includes(npc.behavior);
  out.afterBehavior = npc.behavior;
  let bubbleLeft = false;
  npc.group.traverse((o) => {
    if (o.element && o.element.classList && o.element.classList.contains('bubble')) bubbleLeft = true;
  });
  out.bubbleGone = !bubbleLeft;

  // 5. Sitting NPC stands up to talk.
  const sitter = crowd.npcs.find((n) => n.behavior === 'sit');
  if (sitter) {
    // Keep the fake camera near the sitter so LOD doesn't skip its updates.
    cam.position.set(sitter.pos.x, 5, sitter.pos.z);
    player.pos.set(sitter.pos.x + 1.5, 0, sitter.pos.z);
    out.sitResult = interaction.tryInteract(player, crowd);
    out.sitBehavior = sitter.behavior; // interactStand
    step(120); // stand up + begin talk
    out.sitTalking = sitter.behavior === 'interact';
  } else {
    out.sitResult = 'no-sitter';
  }
  return out;
});

check('E with no NPC near does nothing', results.farResult === false);
check('E near NPC starts interaction', results.nearResult === true);
check('NPC stops', results.behavior === 'interact' && results.hold === true, results.behavior);
check('NPC faces player', Math.abs(results.faceYaw) < 0.4, `${results.faceYaw.toFixed(2)} rad`);
check('speech bubble shows', typeof results.bubbleText === 'string' && results.bubbleText.length > 5,
  results.bubbleText);
check('interaction animation', results.animStart === 'Interact', results.animStart);
check('NPC resumes after', results.resumed === true, results.afterBehavior);
check('bubble removed after', results.bubbleGone === true);
if (results.sitResult === 'no-sitter') {
  check('sitting NPC stands to talk', true, 'no sitter found (skipped)');
} else {
  check('sitting NPC stands to talk', results.sitResult === true && results.sitTalking === true,
    `${results.sitBehavior} -> interact=${results.sitTalking}`);
}

console.log(checks.join('\n'));
console.log(`--- console: ${errors.length} error(s) ---`);
for (const e of errors.slice(0, 10)) console.log('ERROR:', e.slice(0, 200));

// Screenshot with a bubble visible (best effort — must not fail the run).
try {
  await page.evaluate(() => {
    const player = window.__player;
    const crowd = window.__crowd;
    const npc = crowd.npcs.find((n) => n.behavior === 'wander');
    npc.pos.set(30, 0, 40);
    player.pos.set(30, 0, 42.5);
    player.test.setKeys({});
    window.__interaction.tryInteract(player, crowd);
    player.yaw = 0; player.camYaw = Math.PI; player.camPitch = 0.15; player.camDist = 4;
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/fun_interact.png', timeout: 20000 });
} catch (e) {
  console.log('screenshot skipped:', String(e).split('\n')[0]);
}

await browser.close();
process.exit(errors.length || checks.some((c) => c.startsWith('FAIL')) ? 1 : 0);
