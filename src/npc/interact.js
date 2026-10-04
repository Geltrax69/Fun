// Feature 10: player interaction — press E near an NPC: they stop, face the
// player, play the interaction (a seated NPC stands up first), and show a
// speech bubble for a few seconds before resuming their behavior.
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { setAnim, rejoinGraph } from './behavior.js';

const INTERACT_RANGE = 3;
const INTERACT_TIME = 5;
const TALK_DELAY = 2.0; // Interact (2 s) then Idle_Talking_Loop
const SIT_EXIT_T = 0.9;

const LINES = [
  'Lovely day in town, isn\u2019t it?',
  'The canal looks beautiful this time of day.',
  'Have you seen the lighthouse yet?',
  'Mind the lampposts. I never do.',
  'They say the church bell rings at noon.',
  'Fresh bread at the plaza, or so I\u2019m told.',
  'I\u2019ve walked these streets for years.',
  'The park is lovely this time of year.',
  'Don\u2019t go swimming in the canal!',
  'Nice boots, traveler.',
];

export function createInteraction() {
  const bubbles = new Map(); // npc -> CSS2DObject

  function showBubble(npc) {
    hideBubble(npc);
    const div = document.createElement('div');
    div.className = 'bubble';
    div.textContent = LINES[(Math.random() * LINES.length) | 0];
    const obj = new CSS2DObject(div);
    obj.position.set(0, 2.3, 0);
    npc.group.add(obj);
    bubbles.set(npc, obj);
  }

  function hideBubble(npc) {
    const obj = bubbles.get(npc);
    if (obj) {
      npc.group.remove(obj);
      bubbles.delete(npc);
    }
  }

  function beginTalk(npc) {
    npc.behavior = 'interact';
    npc.hold = true;
    npc.moveTarget = null;
    npc.behaviorT = INTERACT_TIME;
    npc.interactT = TALK_DELAY;
    setAnim(npc, 'Interact', false);
  }

  function endInteract(npc, graph) {
    hideBubble(npc);
    rejoinGraph(npc, graph);
  }

  function startInteraction(npc, player) {
    // Release whatever the NPC was doing.
    if (npc.bench) {
      npc.bench.taken = null;
      npc.bench = null;
    }
    if (npc.chatPartner) {
      const o = npc.chatPartner;
      npc.chatPartner = null;
      if (o.chatPartner === npc) o.chatPartner = null;
    }
    npc.interactCooldown = 12;
    showBubble(npc);
    if (npc.behavior === 'sit' || npc.behavior === 'gettingUp') {
      // Stand up first, then talk (behavior.js calls beginTalk after).
      npc.behavior = 'interactStand';
      npc.behaviorT = SIT_EXIT_T;
      npc.hold = true;
      setAnim(npc, 'Sitting_Exit', false);
    } else {
      beginTalk(npc);
    }
  }

  function tryInteract(player, crowd) {
    let best = null;
    let bestD = INTERACT_RANGE;
    for (const npc of crowd.npcs) {
      if ((npc.interactCooldown || 0) > 0) continue;
      if (npc.behavior === 'interact' || npc.behavior === 'interactStand') continue;
      const d = Math.hypot(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    if (!best) return false;
    startInteraction(best, player);
    return true;
  }

  // Hooks for behavior.js's interact states.
  const hooks = {
    beginTalk,
    endInteract: (npc) => endInteract(npc, hooks.graph),
    graph: null,
  };

  return { tryInteract, hideBubble, hooks };
}
