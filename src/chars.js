// Feature 4: character viewer — 8 varied NPCs playing Idle_Loop, for checking
// head placement, neck seams and hood clipping.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { makeCharacter, playAnim, updateCharacters } from './npc/npc.js';
import { createStats } from './stats.js';

// Fixed seed so the lineup is the same on every load.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
scene.fog = new THREE.Fog(0x1a2230, 40, 140);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
// ?pos=x,y,z&target=x,y,z overrides for close-up inspection screenshots.
const qp = new URLSearchParams(location.search);
if (qp.has('pos')) {
  const [px, py, pz] = qp.get('pos').split(',').map(Number);
  camera.position.set(px, py, pz);
} else {
  camera.position.set(0, 2.3, 13);
}

const controls = new OrbitControls(camera, renderer.domElement);
if (qp.has('target')) {
  const [tx, ty, tz] = qp.get('target').split(',').map(Number);
  controls.target.set(tx, ty, tz);
} else {
  controls.target.set(0, 1.1, 0);
}
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(10, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
sun.shadow.camera.near = 2; sun.shadow.camera.far = 50;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd7f2, 0x3a4450, 0.9));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x2c3542, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function addLabel(text, pos) {
  const div = document.createElement('div');
  div.className = 'label';
  div.textContent = text;
  const obj = new CSS2DObject(div);
  obj.position.copy(pos);
  scene.add(obj);
}

const chars = [];

async function build() {
  const rand = mulberry32(20261004);
  const sexes = ['male', 'female'];
  const outfits = ['peasant', 'ranger'];
  const hairs = ['Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_SimpleParted', null];

  const configs = [];
  for (let i = 0; i < 8; i++) {
    const sex = sexes[i % 2];
    const outfit = outfits[Math.floor(i / 2) % 2];
    configs.push({
      sex,
      outfit,
      palette: i % 3 === 2 ? 1 : 0, // every third NPC wears the alternate palette
      hair: outfit === 'ranger' ? null : hairs[Math.floor(rand() * hairs.length)],
      beard: sex === 'male' && i % 4 === 0,
    });
  }

  const lineup = await Promise.all(configs.map((c) => makeCharacter(c)));
  for (let i = 0; i < lineup.length; i++) {
    const char = lineup[i];
    const x = (i - 3.5) * 2.2;
    char.position.set(x, 0, 0);
    char.rotation.y = (rand() - 0.5) * 0.6;
    scene.add(char);
    chars.push(char);
    await playAnim(char, 'Idle_Loop');
    const cfg = char.userData.config;
    addLabel(
      `${cfg.sex} ${cfg.outfit}${cfg.palette ? ' · alt palette' : ''}${cfg.hair ? ` · ${cfg.hair.replace('Hair_', '')}` : ''}${cfg.beard ? ' · beard' : ''}`,
      new THREE.Vector3(x, 2.15, 0),
    );
  }
  document.getElementById('stats').textContent = 'ready';
  window.__chars = chars; // test hook: lets verification sample bones/mixers
}

const stats = createStats();
let lastT = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  updateCharacters(chars, dt);
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

build().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('character viewer failed:', err);
  document.getElementById('stats').textContent = `FAILED\n${err.message}`;
});
