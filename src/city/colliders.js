// Feature 5/6: collision volumes for the city, recorded at build time.
// Buildings are merged for rendering, so their world-space AABBs are captured
// here while each instance is still placed individually.
import * as THREE from 'three';

export const colliders = {
  /** World-space AABBs of solid structures (houses, church, lighthouse). */
  buildings: [],
};

export function addBuildingBox(box) {
  colliders.buildings.push(box.clone());
}

function axisSlab(o, d, mn, mx, tmin, tmax) {
  if (Math.abs(d) < 1e-9) {
    // Parallel: hit only if the origin is inside the slab.
    return o >= mn && o <= mx ? [tmin, tmax] : null;
  }
  let t1 = (mn - o) / d;
  let t2 = (mx - o) / d;
  if (t1 > t2) {
    const t = t1;
    t1 = t2;
    t2 = t;
  }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  return tmin > tmax ? null : [tmin, tmax];
}

/**
 * Ray segment (origin + dir, dir scaled to the segment length) vs every
 * building AABB. Returns the smallest t in [0, 1] where the segment enters a
 * box, or Infinity when nothing is hit. Used for camera wall pull-in.
 */
export function raySegmentHit(ox, oy, oz, dx, dy, dz) {
  let best = Infinity;
  for (const b of colliders.buildings) {
    let r = [0, 1];
    r = axisSlab(ox, dx, b.min.x, b.max.x, r[0], r[1]);
    if (!r) continue;
    r = axisSlab(oy, dy, b.min.y, b.max.y, r[0], r[1]);
    if (!r) continue;
    r = axisSlab(oz, dz, b.min.z, b.max.z, r[0], r[1]);
    if (!r) continue;
    if (r[0] < best) best = r[0];
  }
  return best;
}
