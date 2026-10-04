// Feature 8: NPC crowd — 36 varied characters wandering the sidewalk waypoint
// graph, with distance LOD (full < 40 m, reduced mixer updates 40-80 m,
// hidden > 80 m) per the performance spec.
// Feature 9: behavior (wander/sit/chat/dance/greet) + look-at-player overlay.
import * as THREE from 'three';
import { makeCharacter, playAnim, getMixer, randomNpcConfig } from './npc.js';
import { resolveCollisions, applyGround } from '../city/colliders.js';
import { initBehavior, updateBehavior, tryStartChats } from './behavior.js';

const GRAVITY = -13;
const ARRIVE_DIST = 1.2;

function pickNext(graph, from, prev) {
  const links = graph.nodes[from].links.filter((l) => l !== prev);
  const pool = links.length ? links : graph.nodes[from].links;
  return pool[(Math.random() * pool.length) | 0];
}

export async function createCrowd(scene, graph, benches, count = 36) {
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
      anim: 'Walk_Loop',
    };
    initBehavior(npc);
    // A few NPCs start out seated on benches around the town.
    if (i < 6 && benches.length) {
      const bench = benches[(i * 2) % benches.length];
      if (!bench.taken) {
        bench.taken = npc;
        npc.bench = bench;
        npc.behavior = 'sit';
        npc.hold = true;
        npc.behaviorT = 30 + Math.random() * 60;
        npc.sitT = 0;
        npc.pos.set(bench.x, 0, bench.z);
        npc.faceYaw = bench.rotY;
        group.rotation.y = bench.rotY;
        playAnim(group, 'Sitting_Idle_Loop').catch(() => {});
        npc.anim = 'Sitting_Idle_Loop';
      } else {
        playAnim(group, 'Walk_Loop').catch(() => {});
      }
    } else {
      playAnim(group, 'Walk_Loop').catch(() => {});
    }
    npcs.push(npc);
  }

  let frame = 0;
  let chatTick = 0;

  const ctx = { graph, benches, player: null, npcs };

  function updateNpc(npc, dt) {
    updateBehavior(npc, dt, ctx);

    if (npc.faceYaw !== null && npc.faceYaw !== undefined) {
      npc.group.rotation.y = npc.faceYaw;
    }

    if (!npc.hold) {
      const target = npc.moveTarget || graph.nodes[npc.next];
      const dx = target.x - npc.pos.x;
      const dz = target.z - npc.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < ARRIVE_DIST && !npc.moveTarget) {
        const links = target.links.filter((l) => l !== npc.node);
        npc.node = npc.next;
        npc.next = links.length
          ? links[(Math.random() * links.length) | 0]
          : target.links[0];
      } else if (d >= 0.05) {
        npc.pos.x += (dx / d) * npc.speed * dt;
        npc.pos.z += (dz / d) * npc.speed * dt;
        if (npc.faceYaw === null || npc.faceYaw === undefined) {
          npc.group.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
    resolveCollisions(npc.pos);
    applyGround(npc, dt, GRAVITY);
  }

  /** Head-bone look-at-player overlay, applied after the mixer update. */
  const _v = new THREE.Vector3();
  function lookAtPlayer(npc, player) {
    const dx = player.pos.x - npc.pos.x;
    const dz = player.pos.z - npc.pos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 16 || distSq < 0.04) return; // 4 m range, not when overlapping
    let head = npc.headBone;
    if (!head) {
      npc.group.traverse((o) => {
        if (o.isBone && o.name === 'Head') npc.headBone = o;
      });
      head = npc.headBone;
      if (!head) return;
    }
    // World yaw to the player, minus the body's yaw -> head-local yaw.
    const worldYaw = Math.atan2(dx, dz);
    let local = worldYaw - npc.group.rotation.y;
    while (local > Math.PI) local -= Math.PI * 2;
    while (local < -Math.PI) local += Math.PI * 2;
    head.rotation.y += THREE.MathUtils.clamp(local, -0.6, 0.6) * 0.8;
  }

  function update(dt, camera, player) {
    frame++;
    ctx.player = player;
    Object.assign(ctx, crowdHooks);
    const slowFrame = frame % 3 === 0;
    chatTick -= dt;
    if (chatTick <= 0) {
      chatTick = 0.5;
      tryStartChats(npcs);
    }
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
      if (dist < 40) lookAtPlayer(npc, player);
    }
  }

  // Interaction hooks (feature 10), assigned by main.js via setHooks.
  let crowdHooks = {};
  function setHooks(hooks) {
    crowdHooks = hooks || {};
  }

  return { npcs, update, setHooks };
}
