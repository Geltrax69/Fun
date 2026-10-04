// Feature 11b: lamppost lights — instanced emissive bulbs (one draw call)
// plus a small pool of real PointLights parked at the lampposts nearest
// the player. Everything ramps smoothly with the day/night cycle.
import * as THREE from 'three';

const BULB_Y = 5.15;
const POOL_SIZE = 4;
const LIGHT_DIST = 20;

export function createLamps(scene, positions, dayNight) {
  const bulbGeo = new THREE.SphereGeometry(0.18, 12, 8);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    emissive: 0xffb45e,
    emissiveIntensity: 0,
  });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, positions.length);
  const M = new THREE.Matrix4();
  positions.forEach((p, i) => {
    M.makeTranslation(p.x, BULB_Y, p.z);
    bulbs.setMatrixAt(i, M);
  });
  bulbs.instanceMatrix.needsUpdate = true;
  scene.add(bulbs);

  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const L = new THREE.PointLight(0xffb45e, 0, LIGHT_DIST, 2);
    L.position.set(0, BULB_Y, 0);
    scene.add(L);
    pool.push(L);
  }

  let level = 0; // 0 = day, 1 = full night
  const sorted = [];

  function update(dt, playerPos) {
    const target = dayNight.isNight() ? 1 : 0;
    level += Math.sign(target - level) * Math.min(Math.abs(target - level), dt * 1.5);
    bulbMat.emissiveIntensity = level * 2.2;

    // Park the pooled lights at the nearest lampposts.
    sorted.length = 0;
    for (const p of positions) {
      const d2 = (p.x - playerPos.x) ** 2 + (p.z - playerPos.z) ** 2;
      if (d2 < 35 * 35) sorted.push([d2, p]);
    }
    sorted.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < pool.length; i++) {
      const L = pool[i];
      if (i < sorted.length && level > 0.01) {
        const p = sorted[i][1];
        L.position.set(p.x, BULB_Y, p.z);
        L.intensity = level * 45;
      } else {
        L.intensity = 0;
      }
    }
  }

  return { update, get level() { return level; } };
}
