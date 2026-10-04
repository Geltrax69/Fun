// Feature 5: the city plus a playable third-person ranger.
// WASD/arrows move, Shift runs, Space jumps; click the canvas for mouse look,
// scroll to zoom. The orbit camera from feature 1 is retired.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createStats } from './stats.js';
import { buildCity } from './city/build.js';
import { createPlayer, updatePlayer } from './player/player.js';
import { updateCharacters } from './npc/npc.js';
import { buildWaypointGraph } from './npc/graph.js';
import { createCrowd } from './npc/crowd.js';
import { createInteraction } from './npc/interact.js';

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x87b8e0);
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 150, 700);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
camera.position.set(30, 6, 52);

// Speech bubbles (feature 10) render through a CSS2D overlay.
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
Object.assign(labelRenderer.domElement.style, {
  position: 'fixed', top: '0', left: '0', pointerEvents: 'none', zIndex: 5,
});
document.body.appendChild(labelRenderer.domElement);

// Sun: shadow camera covers the whole 300 m town (follows the player later).
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.position.set(140, 190, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 600;
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd7f2, 0x6f7f5a, 0.85));

let player = null;
let crowd = null;
buildCity(scene)
  .then(async ({ layout, colliders }) => {
    const graph = buildWaypointGraph();
    const benches = layout.props
      .filter((p) => p.type === 'Bench')
      .map((p) => ({ x: p.x, z: p.z, rotY: p.rotY, taken: null }));
    [player, crowd] = await Promise.all([
      createPlayer(scene, camera, canvas),
      createCrowd(scene, graph, benches, 36),
    ]);
    // Test hooks: lets verification drive input and read state.
    window.__player = player;
    window.__crowd = crowd;
    window.__graph = graph;
    window.__colliders = colliders;
    window.__scene = scene;
    // Feature 10: E interacts with the nearest NPC.
    const interaction = createInteraction();
    interaction.hooks.graph = graph;
    crowd.setHooks(interaction.hooks);
    window.__interaction = interaction;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !e.repeat) interaction.tryInteract(player, crowd);
    });
    document.getElementById('stats').textContent = 'ready';
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('startup failed:', err);
    document.getElementById('stats').textContent = `STARTUP FAILED\n${err.message}`;
  });

// Stats overlay: FPS (EMA), frame ms, draw calls, triangles — see src/stats.js.
const stats = createStats();
let lastT = performance.now();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  window.__simT = (window.__simT || 0) + dt; // test hook: sim seconds elapsed
  if (player) {
    updatePlayer(player, dt);
    updateCharacters([player.group], dt);
  }
  if (crowd) crowd.update(dt, camera, player);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  stats.update(dt, renderer);
});
