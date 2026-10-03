// Feature 5: the city plus a playable third-person ranger.
// WASD/arrows move, Shift runs, Space jumps; click the canvas for mouse look,
// scroll to zoom. The orbit camera from feature 1 is retired.
import * as THREE from 'three';
import { createStats } from './stats.js';
import { buildCity } from './city/build.js';
import { createPlayer, updatePlayer } from './player/player.js';
import { updateCharacters } from './npc/npc.js';

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
buildCity(scene)
  .then(async ({ colliders }) => {
    player = await createPlayer(scene, camera, canvas);
    // Test hooks: lets verification drive input and read state.
    window.__player = player;
    window.__colliders = colliders;
    window.__scene = scene;
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
  renderer.render(scene, camera);
  stats.update(dt, renderer);
});
