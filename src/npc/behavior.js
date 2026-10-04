// Feature 9: NPC behavior — wander, sit on benches, chat in pairs, dance at
// the plaza, greet the player, and look toward the player when near.
// Look-at-player is an overlay applied after the mixer update (see crowd.js).
import { playAnim } from './npc.js';

const rand = (a, b) => a + Math.random() * (b - a);
const SIT_ENTER_T = 1.1; // Sitting_Enter is 1.3 s; crossfade slightly early
const SIT_EXIT_T = 0.9; // Sitting_Exit is 1.03 s
const GREET_T = 2.0; // Interact is 2.0 s
const MAX_SITTERS = 8;
const MAX_DANCERS = 3;

function setAnim(npc, name, loop = true) {
  if (npc.anim === name) return;
  npc.anim = name;
  playAnim(npc.group, name, { loop }).catch(() => {});
}
export { setAnim };

export function initBehavior(npc) {
  npc.behavior = 'wander';
  npc.behaviorT = rand(8, 20);
  npc.hold = false; // when true, the NPC doesn't move this frame
  npc.moveTarget = null; // overrides the graph target { x, z }
  npc.faceYaw = null; // overrides facing (radians)
  npc.chatPartner = null;
  npc.bench = null;
  npc.greetCooldown = 0;
  npc.anim = 'Walk_Loop';
}

/** Nearest free bench within maxDist, or null. */
function freeBench(ctx, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const b of ctx.benches) {
    if (b.taken) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function nearestNode(graph, x, z) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Return a wandering NPC to the graph after an off-graph behavior. */
export function rejoinGraph(npc, graph) {
  npc.node = nearestNode(graph, npc.pos.x, npc.pos.z);
  const links = graph.nodes[npc.node].links;
  npc.next = links[(Math.random() * links.length) | 0];
  npc.moveTarget = null;
  npc.faceYaw = null;
  npc.hold = false;
  npc.behavior = 'wander';
  npc.behaviorT = rand(8, 20);
  setAnim(npc, 'Walk_Loop');
}

function startSitting(npc, bench) {
  bench.taken = npc;
  npc.bench = bench;
  npc.behavior = 'sit';
  npc.hold = true;
  npc.moveTarget = null;
  npc.faceYaw = bench.rotY;
  npc.group.rotation.y = bench.rotY;
  npc.behaviorT = rand(30, 90);
  setAnim(npc, 'Sitting_Enter', false);
  npc.sitT = SIT_ENTER_T; // then -> Sitting_Idle_Loop
}

function stopSitting(npc, graph) {
  if (npc.bench) npc.bench.taken = null;
  npc.bench = null;
  setAnim(npc, 'Sitting_Exit', false);
  npc.behavior = 'gettingUp';
  npc.behaviorT = SIT_EXIT_T;
  npc.hold = true;
}

export function updateBehavior(npc, dt, ctx) {
  const { graph, benches, player, npcs } = ctx;
  npc.greetCooldown = Math.max(0, npc.greetCooldown - dt);
  npc.interactCooldown = Math.max(0, (npc.interactCooldown || 0) - dt);

  switch (npc.behavior) {
    case 'wander': {
      npc.behaviorT -= dt;
      // Greet the player when they come close (with cooldown).
      const pd = Math.hypot(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
      if (pd < 7 && npc.greetCooldown <= 0 && Math.random() < 0.3) {
        npc.behavior = 'greet';
        npc.behaviorT = GREET_T;
        npc.hold = true;
        npc.faceYaw = Math.atan2(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
        npc.greetCooldown = 25;
        setAnim(npc, 'Interact', false);
        break;
      }
      if (npc.behaviorT > 0) break;
      // Roll a new ambient behavior.
      const sitters = npcs.filter((n) => n.behavior === 'sit').length;
      const dancers = npcs.filter((n) => n.behavior === 'dance').length;
      const r = Math.random();
      if (r < 0.3 && sitters < MAX_SITTERS) {
        const bench = freeBench(ctx, npc.pos.x, npc.pos.z, 30);
        if (bench) {
          npc.behavior = 'toBench';
          npc.bench = bench;
          bench.taken = npc; // reserve while walking over
          npc.moveTarget = { x: bench.x, z: bench.z };
          break;
        }
      }
      if (r < 0.42 && dancers < MAX_DANCERS) {
        npc.behavior = 'toDance';
        npc.moveTarget = { x: 30 + rand(-8, 8), z: 30 + rand(-8, 8) };
        break;
      }
      npc.behaviorT = rand(8, 20);
      break;
    }

    case 'toBench': {
      const b = npc.bench;
      if (!b || b.taken !== npc) {
        // Bench was taken (shouldn't happen — reserved) — back to wander.
        rejoinGraph(npc, graph);
        break;
      }
      const d = Math.hypot(b.x - npc.pos.x, b.z - npc.pos.z);
      if (d < 0.8) startSitting(npc, b);
      break;
    }

    case 'sit': {
      if (npc.sitT > 0) {
        npc.sitT -= dt;
        if (npc.sitT <= 0) setAnim(npc, 'Sitting_Idle_Loop');
      }
      npc.behaviorT -= dt;
      if (npc.behaviorT <= 0) stopSitting(npc, graph);
      break;
    }

    case 'gettingUp': {
      npc.behaviorT -= dt;
      if (npc.behaviorT <= 0) rejoinGraph(npc, graph);
      break;
    }

    case 'toDance': {
      const d = Math.hypot(npc.moveTarget.x - npc.pos.x, npc.moveTarget.z - npc.pos.z);
      if (d < 1.0) {
        npc.behavior = 'dance';
        npc.behaviorT = rand(20, 40);
        npc.hold = true;
        npc.moveTarget = null;
        npc.faceYaw = rand(0, Math.PI * 2);
        setAnim(npc, 'Dance_Loop');
      }
      break;
    }

    case 'dance': {
      npc.behaviorT -= dt;
      if (npc.behaviorT <= 0) rejoinGraph(npc, graph);
      break;
    }

    case 'chat': {
      const other = npc.chatPartner;
      if (!other || other.behavior !== 'chat') {
        // Partner left — resume wandering.
        npc.chatPartner = null;
        rejoinGraph(npc, graph);
        break;
      }
      npc.faceYaw = Math.atan2(other.pos.x - npc.pos.x, other.pos.z - npc.pos.z);
      npc.behaviorT -= dt;
      if (npc.behaviorT <= 0) {
        npc.chatPartner = null;
        if (other.chatPartner === npc) {
          other.chatPartner = null;
          rejoinGraph(other, graph);
        }
        rejoinGraph(npc, graph);
      }
      break;
    }

    case 'greet': {
      npc.faceYaw = Math.atan2(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
      npc.behaviorT -= dt;
      if (npc.behaviorT <= 0) rejoinGraph(npc, graph);
      break;
    }

    case 'interactStand': {
      // Stood up from a bench to talk — then the interaction begins.
      npc.faceYaw = Math.atan2(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
      npc.behaviorT -= dt;
      if (npc.behaviorT <= 0 && ctx.beginTalk) ctx.beginTalk(npc);
      break;
    }

    case 'interact': {
      npc.faceYaw = Math.atan2(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
      if (npc.interactT > 0) {
        npc.interactT -= dt;
        if (npc.interactT <= 0) setAnim(npc, 'Idle_Talking_Loop');
      }
      npc.behaviorT -= dt;
      if (npc.behaviorT <= 0 && ctx.endInteract) ctx.endInteract(npc);
      break;
    }

    case 'torch': {
      // Night watch: stand holding the torch. The torch manager owns
      // assignment/release; nothing to do per-frame here.
      break;
    }

    default:
      break;
  }
}

/**
 * Pair up nearby wandering NPCs for a chat. Called on a slow tick (every
 * ~0.5 s), not every frame — O(n^2) over the crowd.
 */
export function tryStartChats(npcs) {
  for (let i = 0; i < npcs.length; i++) {
    const a = npcs[i];
    if (a.behavior !== 'wander' || a.greetCooldown > 0) continue;
    for (let j = i + 1; j < npcs.length; j++) {
      const b = npcs[j];
      if (b.behavior !== 'wander' || b.greetCooldown > 0) continue;
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (d < 2.5 && Math.random() < 0.4) {
        for (const [x, y] of [[a, b], [b, a]]) {
          x.behavior = 'chat';
          x.chatPartner = y;
          x.hold = true;
          x.moveTarget = null;
          x.behaviorT = rand(12, 25);
          setAnim(x, 'Idle_Talking_Loop');
        }
        break;
      }
    }
  }
}
