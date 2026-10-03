// Feature 3: city construction — turns layout data into three.js objects.
//
// Performance: houses are merged per (colorscheme, diffuse/window) into a
// handful of static meshes; every repeated prop is one InstancedMesh;
// each .glb loads exactly once via the shared assets.js cache.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel } from '../assets.js';
import { generateLayout, SCHEME_COUNT } from './layout.js';
import { addBuildingBox, colliders } from './colliders.js';

const CITY_URL = '/assets/city';
const TEX_URL = '/assets/city/textures';

const texLoader = new THREE.TextureLoader();

function palTex(file, repeat) {
  const t = texLoader.load(`${TEX_URL}/${file.split(' ').join('%20')}`);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 4;
  }
  return t;
}

const schemeFile = (i) => `Houses Colorscheme${i === 0 ? '' : ` ${i + 1}`}.png`;

// Palette textures for nature/ship models (their .dae files were untextured).
const PALETTES = {
  Birchtree: 'TreesColorscheme.png',
  Foliage: 'FoliageColor.png',
  Foliage2: 'FoliageColor2.png',
  Foliage3: 'FoliageColor3.png',
  Ship: 'Ship Colorscheme.png',
};

function flatPlane(w, d, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

/**
 * Normalize geometries so mergeGeometries() accepts them: drop every
 * attribute except position/normal/uv, and make index-ness uniform
 * (the converted .glb files mix indexed and non-indexed meshes).
 */
function mergeable(geos) {
  const norm = [];
  for (const g of geos) {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    for (const name of Object.keys(n.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv')
        n.deleteAttribute(name);
    }
    norm.push(n);
  }
  const merged = mergeGeometries(norm, false);
  norm.forEach((g) => g.dispose());
  return merged;
}

/** Clone a model, place it, optionally palette-texture its materials. */
async function placeModel(scene, name, x, y, z, rotY = 0, palette = null, shadow = true) {
  const root = await loadModel(`${CITY_URL}/${name}.glb`);
  const inst = root.clone(true);
  inst.position.set(x, y, z);
  inst.rotation.y = rotY;
  const map = palette ? palTex(palette) : null;
  inst.traverse((o) => {
    if (o.isMesh) {
      if (map) {
        o.material = o.material.clone();
        o.material.map = map;
        o.material.needsUpdate = true;
      }
      o.castShadow = shadow;
      o.receiveShadow = true;
    }
  });
  scene.add(inst);
  return inst;
}

// ---- ground ----
function buildGround(scene) {
  const grass = new THREE.MeshStandardMaterial({
    map: palTex('GroundGrassColor.png', [170, 250]),
    roughness: 1,
  });
  // Two planes flanking the canal (x in [-5,5] is water); both stop at the
  // harbour waterline z=150.
  scene.add(flatPlane(345, 500, -177.5, 0, -100, grass));
  scene.add(flatPlane(345, 500, 177.5, 0, -100, grass));
}

// ---- streets + church plaza ----
function buildStreets(scene, layout) {
  const geos = [];
  const strip = (w, d, x, z) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0.02, z);
    geos.push(g);
  };
  for (const sx of layout.streetsV) strip(10, 300, sx, 0);
  for (const sz of layout.streetsH) {
    strip(143, 10, -78.5, sz); // x in [-150,-7]
    strip(143, 10, 78.5, sz); // x in [7,150]
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) throw new Error('street merge failed');
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 1 }),
  );
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Church plaza.
  scene.add(flatPlane(36, 36, layout.church.x, 0.02, 30,
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 })));
}

// ---- houses: merged per (colorscheme, diffuse/window) ----
async function buildHouses(scene, layout) {
  const buckets = Array.from({ length: SCHEME_COUNT },
    () => [[], []]); // [scheme][0=diffuse, 1=window] -> geometries

  const placements = [
    ...layout.houses,
    { model: 'Church', scheme: 2, x: layout.church.x, z: layout.church.z, rotY: layout.church.rotY },
  ];
  const byModel = new Map();
  for (const h of placements) {
    if (!byModel.has(h.model)) byModel.set(h.model, []);
    byModel.get(h.model).push(h);
  }

  for (const [model, list] of byModel) {
    const root = await loadModel(`${CITY_URL}/${model}.glb`);
    for (const h of list) {
      const inst = root.clone(true);
      inst.position.set(h.x, 0, h.z);
      inst.rotation.y = h.rotY;
      inst.updateMatrixWorld(true);
      // Record the world-space bounds before the geometry is merged away.
      addBuildingBox(new THREE.Box3().setFromObject(inst));
      inst.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const isWin = /window/i.test(o.material && o.material.name || '');
        buckets[h.scheme][isWin ? 1 : 0].push(g);
      });
    }
  }

  const mats = [];
  for (let s = 0; s < SCHEME_COUNT; s++) {
    mats.push({
      diffuse: new THREE.MeshStandardMaterial({
        map: palTex(schemeFile(s)), roughness: 0.92,
      }),
      window: new THREE.MeshStandardMaterial({
        color: 0x232d38, roughness: 0.35, metalness: 0.4,
      }),
    });
  }

  for (let s = 0; s < SCHEME_COUNT; s++) {
    for (let w = 0; w < 2; w++) {
      const geos = buckets[s][w];
      if (!geos.length) continue;
      const merged = mergeable(geos);
      if (!merged) {
        console.error(`house merge failed for scheme ${s} window=${w}, skipping`);
        continue;
      }
      const mesh = new THREE.Mesh(merged, w ? mats[s].window : mats[s].diffuse);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

// ---- props: one InstancedMesh per (type, mesh) ----
async function buildProps(scene, layout) {
  const byType = new Map();
  const all = [
    ...layout.props,
    ...layout.shoreRocks.map((r) => ({ type: 'ShoreRock', ...r })),
  ];
  for (const p of all) {
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type).push(p);
  }

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();

  for (const [type, list] of byType) {
    const root = await loadModel(`${CITY_URL}/${type}.glb`);
    root.updateMatrixWorld(true);
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const pal = PALETTES[type] ? palTex(PALETTES[type]) : null;
    for (const mesh of meshes) {
      const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      let mat = mesh.material;
      if (pal) {
        mat = mat.clone();
        mat.map = pal;
        mat.needsUpdate = true;
      }
      const im = new THREE.InstancedMesh(g, mat, list.length);
      list.forEach((p, i) => {
        E.set(0, p.rotY, 0);
        Q.setFromEuler(E);
        V.set(p.x, 0, p.z);
        S.set(p.s || 1, p.s || 1, p.s || 1);
        M.compose(V, Q, S);
        im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = im.receiveShadow = true;
      scene.add(im);
    }
  }
}

// ---- canal: water + sunk quay walls + bridges ----
async function buildCanal(scene, layout) {
  const { canal, bridges } = layout;
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2b6f9e, transparent: true, opacity: 0.88,
    roughness: 0.25, metalness: 0.1,
  });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x1a2e3a, roughness: 1 });
  const cz = (canal.z0 + canal.z1) / 2 - 100; // extend north past the town
  const clen = canal.z1 - canal.z0 + 200;
  scene.add(flatPlane(canal.halfWidth * 2, clen, canal.x, -1.1, cz, waterMat));
  scene.add(flatPlane(canal.halfWidth * 2, clen, canal.x, -1.6, cz, bedMat));

  // Quay walls: RiverWall segments sunk so ~2.6 m shows above grade.
  const root = await loadModel(`${CITY_URL}/RiverWall.glb`);
  root.updateMatrixWorld(true);
  const wallGeos = [];
  root.traverse((o) => {
    if (o.isMesh) wallGeos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  const wallGeo = mergeable(wallGeos);
  if (!wallGeo) throw new Error('canal wall merge failed');
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 1 });
  const segs = [];
  for (let z = -150 + 5.46; z < 150; z += 10.92) {
    segs.push([-7.15, z, 0]);
    segs.push([7.15, z, 0]);
  }
  const im = new THREE.InstancedMesh(wallGeo, wallMat, segs.length);
  const M = new THREE.Matrix4();
  segs.forEach(([x, z], i) => {
    M.makeTranslation(x, -4.4, z);
    im.setMatrixAt(i, M);
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = im.receiveShadow = true;
  scene.add(im);

  for (const bz of bridges)
    await placeModel(scene, 'RiverBridge', 0, -1.2, bz, 0);
}

// ---- harbour: quay, sea, lighthouse, ship ----
async function buildHarbour(scene, layout) {
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2b6f9e, transparent: true, opacity: 0.88,
    roughness: 0.25, metalness: 0.1,
  });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x1a2e3a, roughness: 1 });
  scene.add(flatPlane(700, 200, 0, -1.1, 250, waterMat));
  scene.add(flatPlane(700, 200, 0, -1.6, 250, bedMat));

  // Quay along z=150, gap at the canal mouth.
  const root = await loadModel(`${CITY_URL}/RiverWall.glb`);
  root.updateMatrixWorld(true);
  const wallGeos = [];
  root.traverse((o) => {
    if (o.isMesh) wallGeos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  const wallGeo = mergeable(wallGeos);
  if (!wallGeo) throw new Error('quay wall merge failed');
  wallGeo.rotateY(Math.PI / 2); // long axis along x
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 1 });
  const segs = [];
  for (let x = -150 + 5.46; x < 150; x += 10.92) {
    if (Math.abs(x) < 9) continue; // canal mouth stays open
    segs.push(x);
  }
  const im = new THREE.InstancedMesh(wallGeo, wallMat, segs.length);
  const M = new THREE.Matrix4();
  segs.forEach((x, i) => {
    M.makeTranslation(x, -4.4, 152.15);
    im.setMatrixAt(i, M);
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = im.receiveShadow = true;
  scene.add(im);

  const L = layout.lighthouse;
  const lh = await placeModel(scene, 'Lighthouse', L.x, 0.3, L.z, L.rotY);
  addBuildingBox(new THREE.Box3().setFromObject(lh));
  const S = layout.ship;
  await placeModel(scene, 'Ship', S.x, -0.9, S.z, S.rotY, PALETTES.Ship);
}

export async function buildCity(scene, seed) {
  const layout = generateLayout(seed);
  const t0 = performance.now();
  // Warm the model cache: fetch + parse every .glb in parallel up front so
  // no later stage ever waits on a sequential network round-trip.
  const need = new Set([
    ...layout.houses.map((h) => h.model),
    'Church',
    ...layout.props.map((p) => p.type),
    'ShoreRock', 'RiverWall', 'RiverBridge', 'Lighthouse', 'Ship',
  ]);
  await Promise.all([...need].map((m) => loadModel(`${CITY_URL}/${m}.glb`)));
  // eslint-disable-next-line no-console
  console.log(`[city] models preloaded: ${(performance.now() - t0).toFixed(0)} ms`);
  const stage = async (name, fn) => {
    const a = performance.now();
    await fn();
    // eslint-disable-next-line no-console
    console.log(`[city] ${name}: ${(performance.now() - a).toFixed(0)} ms`);
  };
  await stage('ground', async () => buildGround(scene));
  await stage('streets', async () => buildStreets(scene, layout));
  await stage('houses', async () => buildHouses(scene, layout));
  await stage('props', async () => buildProps(scene, layout));
  await stage('canal', async () => buildCanal(scene, layout));
  await stage('harbour', async () => buildHarbour(scene, layout));
  // eslint-disable-next-line no-console
  console.log(`city built: ${layout.houses.length} houses, ${layout.props.length} props in ${(performance.now() - t0).toFixed(0)} ms`);
  return { layout, colliders };
}
