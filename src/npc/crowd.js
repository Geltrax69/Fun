// Feature 8: NPC crowd — 36 varied characters wandering the sidewalk waypoint
// graph, with distance LOD (full < 40 m, reduced mixer updates 40-80 m,
// hidden > 80 m) per the performance spec.
import * as THREE from 'three';
import { makeCharacter, playAnim, getMixer, randomNpcConfig } from './npc.js';
import { resolveCollisions, applyGround } from '../city/colliders.js';

const GRAVITY = -13;
const ARRIVE_DIST = 1.2;

function pickNext(graph, from, prev) {
  const links = graph.nodes[from].links.filter((l) => l !== prev);
  const pool = links.length ? links : graph.nodes[from].links;
  return pool[(Math.random() * pool.length) | 0];
}

export async function createCrowd(scene, graph, count = 36) {
  const npcs = [];
  const configs = Array.from({ length: count }, () => randomNpcConfig());
  // Load all characters in parallel; templates are cached after the first.
  const groups = await Promise.all(configs.map((c) => makeCharacter(c)));
  for (let i = 0; i < count; i++) {
    const group = groups[i];
    const node = (Math.random() * graph.nodes.length) | 0;
    group.position.set(graph.nodes[node].x, 0, graph.nodes[node].z);
    scene.add(group);
    const npc = {
      group,
      pos: group.position,
      vy: 0,
      grounded: true,
      speed: 2, // NPC walk speed (prompt spec)
      node,
      next: pickNext(graph, node, -1),
    };
    playAnim(group, 'Walk_Loop').catch(() => {});
    npcs.push(npc);
  }

  let frame = 0;

  function updateNpc(npc, dt) {
    const target = graph.nodes[npc.next];
    const dx = target.x - npc.pos.x;
    const dz = target.z - npc.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < ARRIVE_DIST) {
      const links = target.links.filter((l) => l !== npc.node);
      npc.node = npc.next;
      npc.next = links.length
        ? links[(Math.random() * links.length) | 0]
        : target.links[0];
      return;
    }
    npc.pos.x += (dx / d) * npc.speed * dt;
    npc.pos.z += (dz / d) * npc.speed * dt;
    npc.group.rotation.y = Math.atan2(dx, dz);
    resolveCollisions(npc.pos);
    applyGround(npc, dt, GRAVITY);
  }

  function update(dt, camera) {
    frame++;
    const slowFrame = frame % 3 === 0;
    for (const npc of npcs) {
      const dist = camera.position.distanceTo(npc.pos);
      if (dist > 80) {
        npc.group.visible = false;
        continue; // invisible: skip movement and animation entirely
      }
      npc.group.visible = true;
      updateNpc(npc, dt);
      // LOD: full mixer updates near, reduced updates at 40-80 m.
      if (dist < 40 || slowFrame) {
        getMixer(npc.group).update(dist < 40 ? dt : dt * 3);
      }
    }
  }

  return { npcs, update };
}
