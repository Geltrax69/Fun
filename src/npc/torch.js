// Feature 11c: torch bearers — at nightfall a few NPCs stop where they are,
// play Idle_Torch_Loop, and hold a procedural torch (emissive flame). One
// flickering PointLight follows the nearest bearer. At dawn they rejoin
// the crowd.
import * as THREE from 'three';
import { setAnim, rejoinGraph } from './behavior.js';

const BEARERS = 6;

const handleGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.55, 6);
const handleMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
const flameGeo = new THREE.SphereGeometry(0.075, 10, 8);
const flameMat = new THREE.MeshStandardMaterial({
  color: 0xff7722, emissive: 0xff8822, emissiveIntensity: 3,
});

function makeTorch() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(handleGeo, handleMat);
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = 0.34;
  g.add(handle, flame);
  g.userData.flame = flame;
  return g;
}

export function createTorchManager(scene, dayNight) {
  const bearers = new Set();
  let wasNight = false;
  const torchLight = new THREE.PointLight(0xff9a3e, 0, 16, 2);
  scene.add(torchLight);

  function handOf(npc) {
    return npc.group.getObjectByName('hand_r');
  }

  function assign(npc) {
    const hand = handOf(npc);
    if (!hand) return;
    const torch = makeTorch();
    // Torch up out of the fist.
    torch.position.set(0, 0.1, 0.02);
    hand.add(torch);
    npc.torchProp = torch;
    npc.torchBearer = true;
    bearers.add(npc);
    // Drop whatever they were doing and stand with the torch.
    if (npc.bench) {
      npc.bench.taken = null;
      npc.bench = null;
    }
    if (npc.chatPartner) {
      const o = npc.chatPartner;
      npc.chatPartner = null;
      if (o.chatPartner === npc) o.chatPartner = null;
    }
    npc.behavior = 'torch';
    npc.hold = true;
    npc.moveTarget = null;
    setAnim(npc, 'Idle_Torch_Loop');
  }

  function release(npc, graph, rejoin = true) {
    if (npc.torchProp) {
      npc.torchProp.removeFromParent();
      npc.torchProp = null;
    }
    npc.torchBearer = false;
    bearers.delete(npc);
    if (rejoin && graph) rejoinGraph(npc, graph);
  }

  function update(npcs, graph, playerPos, t) {
    const night = dayNight.isNight();
    if (night && !wasNight) {
      // Nightfall: recruit wandering NPCs as torch bearers.
      const candidates = npcs.filter((n) => n.behavior === 'wander' && !n.torchBearer);
      for (let i = 0; i < BEARERS && candidates.length; i++) {
        const idx = (Math.random() * candidates.length) | 0;
        assign(candidates.splice(idx, 1)[0]);
      }
    } else if (!night && wasNight) {
      for (const npc of [...bearers]) release(npc, graph);
    }
    wasNight = night;

    // Self-heal: a bearer pulled into something else (E interaction)
    // drops the torch without rejoining (the new behavior owns them).
    for (const npc of [...bearers]) {
      if (npc.behavior !== 'torch') release(npc, graph, false);
    }

    // Flickering light on the nearest bearer.
    let best = null;
    let bestD = 30 * 30;
    for (const npc of bearers) {
      const d2 = (npc.pos.x - playerPos.x) ** 2 + (npc.pos.z - playerPos.z) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        best = npc;
      }
    }
    if (best && best.torchProp) {
      const p = new THREE.Vector3();
      best.torchProp.userData.flame.getWorldPosition(p);
      torchLight.position.copy(p);
      torchLight.intensity = 18 + Math.sin(t * 13) * 4 + Math.sin(t * 31) * 3;
    } else {
      torchLight.intensity = 0;
    }
  }

  return { update, release, get count() { return bearers.size; } };
}
