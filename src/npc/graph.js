// Feature 8: sidewalk waypoint graph — nodes along both sidewalks of every
// street (linked consecutively), plus proximity links at intersections so NPCs
// can turn corners. Horizontal streets don't cross the canal (no walkable
// bridge), so the graph splits into west/east components there.
import { TOWN } from '../city/layout.js';

const STEP = 20; // node spacing along a sidewalk (m)
const EXT = 140; // streets run -140..140
const OFF = 7; // sidewalk offset from the street centerline
const LINK_DIST = 11; // proximity link distance at intersections

export function buildWaypointGraph() {
  const nodes = []; // { x, z, links: [index] }
  const indexByKey = new Map();
  const key = (x, z) => `${x},${z}`;

  function addNode(x, z) {
    const k = key(x, z);
    if (indexByKey.has(k)) return indexByKey.get(k);
    const i = nodes.length;
    nodes.push({ x, z, links: [] });
    indexByKey.set(k, i);
    return i;
  }
  function link(a, b) {
    if (a === b) return;
    if (!nodes[a].links.includes(b)) nodes[a].links.push(b);
    if (!nodes[b].links.includes(a)) nodes[b].links.push(a);
  }

  // Vertical streets (the canal replaced x=0, so these never cross water).
  for (const sx of TOWN.streetsV) {
    for (const side of [-OFF, OFF]) {
      let prev = -1;
      for (let z = -EXT; z <= EXT; z += STEP) {
        const i = addNode(sx + side, z);
        if (prev >= 0) link(prev, i);
        prev = i;
      }
    }
  }

  // Horizontal streets — skip the canal gap (|x| < 9 has no sidewalk).
  for (const sz of TOWN.streetsH) {
    for (const side of [-OFF, OFF]) {
      let prev = -1;
      for (let x = -EXT; x <= EXT; x += STEP) {
        if (Math.abs(x) < 9) {
          prev = -1; // break the chain across the canal
          continue;
        }
        const i = addNode(x, sz + side);
        if (prev >= 0) link(prev, i);
        prev = i;
      }
    }
  }

  // Proximity links at intersections (nodes from crossing sidewalks come
  // within ~10 m there; consecutive nodes on one sidewalk are 20 m apart).
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      const dx = nodes[a].x - nodes[b].x;
      const dz = nodes[a].z - nodes[b].z;
      if (dx * dx + dz * dz < LINK_DIST * LINK_DIST) link(a, b);
    }
  }

  return { nodes };
}
