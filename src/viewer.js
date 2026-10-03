// Feature 2: city asset viewer — renders all 28 converted .glb models on a
// grid, each next to a 2 m red reference pole (door height) for scale checks.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { loadModel } from './assets.js';
import { createStats } from './stats.js';

const MODELS = [
  'House-1-1', 'House-1-2', 'House-1-3', 'House-1-4', 'House-1-5',
  'House-2-1', 'House-2-2', 'Church', 'Lighthouse',
  'Lamppost', 'Bench', 'Chair', 'Table', 'Parasol', 'Fence', 'FenceEnd',
  'Birchtree', 'Foliage', 'Foliage2', 'Foliage3', 'ShoreRock',
  'RiverWall', 'RiverWallCorner', 'RiverWallOpen', 'RiverWallStairs',
  'RiverLand', 'RiverBridge', 'Ship',
];
const CELL = 16; // grid spacing (m) — fits the ship, the largest model
const COLS = 7;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
Object.assign(labelRenderer.domElement.style, {
  position: 'fixed', top: '0', left: '0', pointerEvents: 'none', zIndex: 5,
});
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2230);
scene.fog = new THREE.Fog(0x1a2230, 120, 420);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1200);
// ?pos=x,y,z&target=x,y,z overrides for close-up inspection screenshots.
const qp = new URLSearchParams(location.search);
if (qp.has('pos')) {
  const [px, py, pz] = qp.get('pos').split(',').map(Number);
  camera.position.set(px, py, pz);
} else {
  camera.position.set(60, 55, 90);
}

const controls = new OrbitControls(camera, renderer.domElement);
if (qp.has('target')) {
  const [tx, ty, tz] = qp.get('target').split(',').map(Number);
  controls.target.set(tx, ty, tz);
} else {
  controls.target.set(40, 0, 16);
}
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(80, 110, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd7f2, 0x3a4450, 0.9));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x2c3542, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(40, -0.01, 16);
ground.receiveShadow = true;
scene.add(ground);

// 2 m reference pole (door height) — one per cell.
const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2, 8);
const poleMat = new THREE.MeshStandardMaterial({ color: 0xd23b3b, roughness: 0.6 });

function addLabel(text, pos) {
  const div = document.createElement('div');
  div.className = 'label';
  div.textContent = text;
  const obj = new CSS2DObject(div);
  obj.position.copy(pos);
  scene.add(obj);
}

async function build() {
  // Load all models in parallel, then place them.
  const roots = await Promise.all(
    MODELS.map((name) =>
      loadModel(`/assets/city/${name}.glb`)
        .then((root) => ({ name, root }))
        .catch((err) => {
          console.error(`failed to load ${name}:`, err);
          return { name, root: null };
        }),
    ),
  );
  for (let i = 0; i < roots.length; i++) {
    const { name, root } = roots[i];
    const cx = (i % COLS) * CELL;
    const cz = Math.floor(i / COLS) * CELL;
    if (root) {
      const inst = root.clone(true);
      inst.position.set(cx, 0, cz);
      inst.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      scene.add(inst);
      const bbox = new THREE.Box3().setFromObject(inst);
      const h = bbox.max.y - bbox.min.y;
      addLabel(`${name} (${h.toFixed(1)} m)`, new THREE.Vector3(cx, bbox.max.y + 1.2, cz));
    } else {
      addLabel(`${name} — MISSING`, new THREE.Vector3(cx, 2, cz));
    }
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(cx + CELL / 2 - 2, 1, cz);
    pole.castShadow = true;
    scene.add(pole);
  }
  document.getElementById('stats').textContent = 'ready';
}

const stats = createStats();
let lastT = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  stats.update(dt, renderer);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

build();
