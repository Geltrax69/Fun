// Feature 1: renderer skeleton — ground plane, sky/fog, sun + shadows, stats overlay.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStats } from './stats.js';

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
scene.fog = new THREE.Fog(SKY, 80, 340);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(28, 20, 34);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

// Sun: single directional light, shadow camera follows the origin for now
// (feature 5 will make it follow the player).
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.position.set(70, 95, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 260;
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd7f2, 0x6f7f5a, 0.85));

// Ground: big plane with a subtle procedural checker so motion/scale reads well.
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7da05c';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#769858';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 0) g.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 900),
  new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Placeholder props — prove shadows + scale work (a door-height 2 m box, a sphere).
const box = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.9 }),
);
box.position.set(-4, 1, 0);
box.castShadow = box.receiveShadow = true;
scene.add(box);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(1.2, 32, 24),
  new THREE.MeshStandardMaterial({ color: 0x4a7fc9, roughness: 0.6 }),
);
ball.position.set(4, 1.2, 2);
ball.castShadow = ball.receiveShadow = true;
scene.add(ball);

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
