// Feature 6: collisions — building AABBs (recorded at build time), solid
// street-prop circle colliders, capsule-vs-AABB / circle-vs-circle resolution,
// and analytic ground height (canal bed, sea bed, streets).
import * as THREE from 'three';
import { TOWN } from './layout.js';

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.7;
const STEP_UP = 0.55; // max step-up while grounded (curbs, ledges)
const STEP_DOWN = 0.45; // larger drops start a fall

export const colliders = {
  /** World-space AABBs of solid structures (houses, church, lighthouse, walls, ship). */
  buildings: [],
  /** Solid street props as { x, z, r } circles (rotation-independent). */
  props: [],
};

export function addBuildingBox(box) {
  colliders.buildings.push(box.clone());
}

export function addPropCollider(x, z, r) {
  colliders.props.push({ x, z, r });
}

/**
 * Analytic ground height. The town is flat (y=0) except the canal cutting
 * (bed at -1.6, flanked by tall walls) which meets the sea at the south.
 * (Swimming arrives in feature 11; for now the player wades on the bed.)
 */
// Bridge deck: RiverBridge sunk so its deck ends meet the street (y≈0) and
// the arch crown is 0.3 m higher (raycast-measured). Walkable |z-bz| < 2.2.
export const BRIDGE_Y = -3.61;
export function bridgeDeckAt(x, z) {
  if (Math.abs(x) > 6.5) return null;
  for (const bz of TOWN.bridges)
    if (Math.abs(z - bz) < 2.2) return 0.3 * Math.max(0, 1 - (x / 6.5) ** 2);
  return null;
}

export function groundHeightAt(x, z) {
  const deck = bridgeDeckAt(x, z);
  if (deck !== null) return deck;
  if (Math.abs(x) < 5 && z > -150 && z < 150) return -1.6; // canal bed (walled section)
  if (Math.abs(x) < 5 && z >= -350 && z <= -150) return -1.6; // north reach bed
  if (z > 150) return -1.6; // sea bed past the quay
  return 0;
}

/** Invisible guard boxes — removed in feature 11: swimming + mantle (climb-out)
 *  make every water region escapable, so the guards are no longer needed. */
export function addWaterGuards() {}

// RiverWall top sits 8.62 m above its origin. Walls used to stand 4.2 m
// above the street, burying the bridges; now the top is flush with grade so
// the canal and sea are open embankments you can walk to (and bridges cross).
export const WALL_Y = -8.67;
const WALL_TOP = WALL_Y + 8.62; // ≈ -0.05: below the player's feet on the street
const RAIL_TOP = WALL_TOP + 1.0; // railed segments block like a fence

/** Canal wall AABBs (called from buildCanal with the exact segment list). */
export function addCanalWallBoxes(segments, railed) {
  for (const [x, z] of segments) {
    addBuildingBox(new THREE.Box3(
      new THREE.Vector3(x - 2.14, WALL_Y, z - 5.46),
      new THREE.Vector3(x + 2.14, railed ? RAIL_TOP : WALL_TOP, z + 5.46),
    ));
  }
}

/** Quay wall AABBs (called from buildHarbour; wall rotated 90°). */
export function addQuayWallBoxes(xs, z, railed) {
  for (const x of xs) {
    addBuildingBox(new THREE.Box3(
      new THREE.Vector3(x - 5.46, WALL_Y, z - 2.14),
      new THREE.Vector3(x + 5.46, railed ? RAIL_TOP : WALL_TOP, z + 2.14),
    ));
  }
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Push a capsule (feet at pos, radius PLAYER_RADIUS, height PLAYER_HEIGHT)
 * out of every building AABB and prop circle. Mutates pos. Cheap enough to
 * run per frame: ~110 boxes + ~600 circles of a few flops each.
 */
export function resolveCollisions(pos) {
  const R = PLAYER_RADIUS;
  const top = pos.y + PLAYER_HEIGHT;

  for (const b of colliders.buildings) {
    if (top < b.min.y || pos.y > b.max.y) continue;
    // Broadphase: skip boxes far away in XZ.
    if (pos.x < b.min.x - R - 1 || pos.x > b.max.x + R + 1) continue;
    if (pos.z < b.min.z - R - 1 || pos.z > b.max.z + R + 1) continue;
    const cx = clamp(pos.x, b.min.x, b.max.x);
    const cz = clamp(pos.z, b.min.z, b.max.z);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * R;
      pos.z = cz + (dz / d) * R;
    } else {
      // Center inside the box: push along the smallest-penetration axis.
      const px0 = pos.x - b.min.x;
      const px1 = b.max.x - pos.x;
      const pz0 = pos.z - b.min.z;
      const pz1 = b.max.z - pos.z;
      const m = Math.min(px0, px1, pz0, pz1);
      if (m === px0) pos.x = b.min.x - R;
      else if (m === px1) pos.x = b.max.x + R;
      else if (m === pz0) pos.z = b.min.z - R;
      else pos.z = b.max.z + R;
    }
  }

  for (const pr of colliders.props) {
    const dx = pos.x - pr.x;
    const dz = pos.z - pr.z;
    const rr = R + pr.r;
    // Broadphase.
    if (dx > rr + 1 || dx < -rr - 1 || dz > rr + 1 || dz < -rr - 1) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    pos.x = pr.x + (dx / d) * rr;
    pos.z = pr.z + (dz / d) * rr;
  }
}

/**
 * Vertical motion: stick to the ground while grounded (step up small curbs,
 * fall off larger drops), gravity + landing while airborne.
 * Call after horizontal movement and resolveCollisions.
 */
export function applyGround(player, dt, gravity) {
  const ground = groundHeightAt(player.pos.x, player.pos.z);
  if (player.grounded) {
    if (ground > player.pos.y) {
      if (ground - player.pos.y <= STEP_UP) player.pos.y = ground;
      // else: a wall — horizontal colliders should have stopped us already
    } else if (player.pos.y - ground > STEP_DOWN) {
      player.grounded = false; // walked off a ledge
      player.vy = 0;
    } else {
      player.pos.y = ground;
    }
  }
  if (!player.grounded) {
    player.vy += gravity * dt;
    player.pos.y += player.vy * dt;
    if (player.pos.y <= ground) {
      player.pos.y = ground;
      player.vy = 0;
      player.grounded = true;
    }
  }
}

// Re-exported for the camera pull-in's slab test (unchanged from feature 5).
export function raySegmentHit(ox, oy, oz, dx, dy, dz) {
  let best = Infinity;
  for (const b of colliders.buildings) {
    let tmin = 0;
    let tmax = 1;
    let ok = true;
    const axes = [
      [ox, dx, b.min.x, b.max.x],
      [oy, dy, b.min.y, b.max.y],
      [oz, dz, b.min.z, b.max.z],
    ];
    for (const [o, d, mn, mx] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < mn || o > mx) { ok = false; break; }
      } else {
        let t1 = (mn - o) / d;
        let t2 = (mx - o) / d;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok && tmin < best) best = tmin;
  }
  return best;
}
