// Feature 3: the city. Ground/streets/houses/canal/harbour built from the
// seeded layout; orbit camera + stats overlay kept from feature 1.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStats } from './stats.js';
import { buildCity } from './city/build.js';

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
camera.position.set(150, 110, 215);

// ?pos=x,y,z&target=x,y,z overrides for close-up inspection screenshots.
const qp = new URLSearchParams(location.search);
if (qp.has('pos')) {
  const [px, py, pz] = qp.get('pos').split(',').map(Number);
  camera.position.set(px, py, pz);
}

const controls = new OrbitControls(camera, renderer.domElement);
if (qp.has('target')) {
  const [tx, ty, tz] = qp.get('target').split(',').map(Number);
  controls.target.set(tx, ty, tz);
} else {
  controls.target.set(0, 0, 10);
}
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

// Sun: shadow camera covers the whole 300 m town (follows the player in feature 5).
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

buildCity(scene).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('city build failed:', err);
  document.getElementById('stats').textContent = `CITY BUILD FAILED\n${err.message}`;
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
  controls.update();
  renderer.render(scene, camera);
  stats.update(dt, renderer);
});
