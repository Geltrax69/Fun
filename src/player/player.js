// Feature 5: third-person player — a ranger with WASD/arrows + Shift run +
// Space jump, a pointer-lock mouse camera with scroll zoom, and a wall-aware
// camera that pulls in instead of clipping through buildings.
import * as THREE from 'three';
import { makeCharacter, playAnim, locomotionClip } from '../npc/npc.js';
import { raySegmentHit, resolveCollisions, applyGround, groundHeightAt } from '../city/colliders.js';
import { waterSurfaceAt, WATER_Y } from './swim.js';

const WALK_SPEED = 2.5;
const SPRINT_SPEED = 9.5;
const SWIM_SPEED = 3.2;
const JUMP_VY = 4.8;
const GRAVITY = -13;
const HEAD_H = 1.62; // camera look-at / ray origin height above the feet
const MOUSE_SENS = 0.0026;

/** Shortest-arc exponential damping between two Y rotations. */
function dampAngle(a, b, lambda, dt) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

export function rotateCamera(player, dx, dy) {
  player.camYaw -= dx * MOUSE_SENS;
  player.camPitch = THREE.MathUtils.clamp(
    player.camPitch + dy * MOUSE_SENS * 0.85, -0.3, 1.25);
}

function tryJump(player) {
  if (player.swimming && !player.mantling) {
    // Space while swimming: climb out if there's shore nearby.
    tryMantle(player, player.wishX || 0, player.wishZ || 0, WATER_Y);
    return;
  }
  if (player.grounded) {
    player.vy = JUMP_VY;
    player.grounded = false;
    player.jumpPhase = 'start';
    setAnim(player, 'Jump_Start', false);
  }
}

/**
 * Find a climb-out target: land in the push direction (up and over a wall),
 * else land behind (e.g. back onto the quay). Starts the mantle lerp.
 * Returns true when a mantle started.
 */
function tryMantle(player, wx, wz, waterY) {
  if (player.mantling) return false;
  const len = Math.hypot(wx, wz);
  const dx = len > 0.01 ? wx / len : Math.sin(player.yaw);
  const dz = len > 0.01 ? wz / len : Math.cos(player.yaw);
  for (const s of [1, -1]) {
    const tx = player.pos.x + dx * 5.0 * s;
    const tz = player.pos.z + dz * 5.0 * s;
    if (waterSurfaceAt(tx, tz) !== null) continue; // still water — skip
    const tg = groundHeightAt(tx, tz);
    if (tg > waterY + 0.3) {
      player.mantling = {
        t: 0, dur: 0.7,
        fx: player.pos.x, fz: player.pos.z,
        tx, tz, ty: tg,
      };
      player.swimming = false;
      player.stuckT = 0;
      return true;
    }
  }
  return false;
}

function updateMantle(player, dt) {
  const m = player.mantling;
  m.t += dt;
  const t = Math.min(m.t / m.dur, 1);
  player.pos.x = m.fx + (m.tx - m.fx) * t;
  player.pos.z = m.fz + (m.tz - m.fz) * t;
  // Arc up and over whatever was blocking (embankment, quay wall, bank).
  player.pos.y = WATER_Y + (m.ty - WATER_Y) * t + Math.sin(t * Math.PI) * 1.8;
  player.yaw = dampAngle(player.yaw, Math.atan2(m.tx - m.fx, m.tz - m.fz), 10, dt);
  player.group.rotation.y = player.yaw;
  if (t >= 1) {
    player.pos.y = m.ty;
    player.mantling = null;
    player.grounded = true;
    player.vy = 0;
  }
  setAnim(player, 'Swim_Fwd_Loop');
}

function updateSwim(player, dt, waterY, wx, wz, moving) {
  player.swimT = (player.swimT || 0) + dt;
  player.pos.y = waterY + Math.sin(player.swimT * 2.2) * 0.06;

  const oldX = player.pos.x;
  const oldZ = player.pos.z;
  let blocked = false;
  const intended = moving ? SWIM_SPEED * dt : 0;
  if (moving) {
    const nx = oldX + wx * SWIM_SPEED * dt;
    const nz = oldZ + wz * SWIM_SPEED * dt;
    // Don't swim under banks or out of the water region.
    const g = groundHeightAt(nx, nz);
    if (waterSurfaceAt(nx, nz) === null || g > waterY + 0.3) {
      blocked = true;
    } else {
      player.pos.x = nx;
      player.pos.z = nz;
    }
    player.yaw = dampAngle(player.yaw, Math.atan2(wx, wz), 10, dt);
    player.group.rotation.y = player.yaw;
  }
  resolveCollisions(player.pos);
  const actual = Math.hypot(player.pos.x - oldX, player.pos.z - oldZ);
  if (moving && intended > 0.0001 && actual < intended * 0.3) blocked = true;

  player.stuckT = blocked ? (player.stuckT || 0) + dt : 0;
  if (player.stuckT > 0.35 && moving) tryMantle(player, wx, wz, waterY);

  setAnim(player, moving ? 'Swim_Fwd_Loop' : 'Swim_Idle_Loop');
}

/** Play a clip on the player if it isn't already playing. */
function setAnim(player, name, loop = true) {
  if (player.anim === name) return;
  player.anim = name;
  playAnim(player.group, name, { loop }).catch(() => {});
}

export async function createPlayer(scene, camera, canvas) {
  const group = await makeCharacter({
    sex: 'male', outfit: 'ranger', palette: 0, hair: null,
  });
  // Spawn on the church plaza facing the church (north); the camera starts
  // behind the player to the south so W walks toward the church.
  group.position.set(30, 0, 44);
  scene.add(group);

  const player = {
    group,
    camera,
    pos: group.position,
    vy: 0,
    grounded: true,
    speed: 0, // scalar ground speed (ramps with acceleration)
    yaw: Math.PI, // character facing; the model faces +z at rotation 0
    camYaw: 0, // camera south of the player, looking north
    camPitch: 0.34,
    camDist: 4.6,
    keys: {},
    anim: null,
    jumpPhase: null, // null | 'start' | 'air' | 'land'
    landTimer: 0,
    swimming: false, // feature 11d: in water
    mantling: null, // feature 11d: climb-out lerp {t,dur,fx,fz,tx,tz,ty}
    stuckT: 0, // time spent pushing against a shore/wall while swimming
    swimT: 0,
    wishX: 0,
    wishZ: 0,
  };
  group.rotation.y = player.yaw;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      tryJump(player);
      e.preventDefault();
    } else {
      player.keys[e.code] = true;
    }
    // Don't scroll the page on arrows/space while playing.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    player.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    player.keys = {};
  });

  // Pointer-lock mouse look (click the canvas to capture).
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* headless / unsupported — rotateCamera stays callable directly */
      }
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) rotateCamera(player, e.movementX, e.movementY);
  });
  canvas.addEventListener('wheel', (e) => {
    player.camDist = THREE.MathUtils.clamp(
      player.camDist + Math.sign(e.deltaY) * 0.6, 2.2, 8);
  }, { passive: true });

  // Test hooks: drive input and the camera without a real mouse/keyboard.
  player.test = {
    rotate: (dx, dy) => rotateCamera(player, dx, dy),
    setKeys: (keys) => { player.keys = { ...keys }; },
    jump: () => tryJump(player),
  };
  return player;
}

/**
 * Feature 7: player animation state machine.
 * Airborne: Jump_Start (takeoff) -> Jump_Loop (air) -> Jump_Land (landing).
 * Grounded: idle/walk/jog/sprint via the shared hysteresis bands — every
 * transition crossfades through playAnim.
 */
function updatePlayerAnimation(player, dt, wasGrounded) {
  if (player.swimming || player.mantling) return; // swim sets its own clips
  if (!player.grounded) {
    if (player.jumpPhase === 'start' && player.vy < 1.5) {
      // Takeoff done (still rising fast) -> air loop.
      player.jumpPhase = 'air';
      setAnim(player, 'Jump_Loop');
    } else if (player.jumpPhase === null) {
      // Walked off a ledge — straight to the air loop.
      player.jumpPhase = 'air';
      setAnim(player, 'Jump_Loop');
    }
    return;
  }
  // Grounded.
  if (!wasGrounded && player.jumpPhase !== null) {
    // Just landed.
    player.jumpPhase = 'land';
    player.landTimer = 0.45;
    setAnim(player, 'Jump_Land', false);
    return;
  }
  if (player.jumpPhase === 'land') {
    player.landTimer -= dt;
    if (player.landTimer > 0) return; // brief landing beat, then locomotion
    player.jumpPhase = null;
  }
  setAnim(player, locomotionClip(player.speed, player.anim));
}

/** Advance the player simulation by dt seconds. */
export function updatePlayer(player, dt) {
  const k = player.keys;
  const ix = ((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0);
  const iz = ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0);
  const sprinting = !!(k.ShiftLeft || k.ShiftRight);
  const moving = ix !== 0 || iz !== 0;

  // Camera-relative wish direction on the ground plane.
  let wx = 0;
  let wz = 0;
  if (moving) {
    const len = Math.hypot(ix, iz);
    const nx = ix / len;
    const nz = iz / len;
    const fx = -Math.sin(player.camYaw);
    const fz = -Math.cos(player.camYaw);
    const rx = Math.cos(player.camYaw);
    const rz = -Math.sin(player.camYaw);
    wx = rx * nx + fx * nz;
    wz = rz * nx + fz * nz;
    player.wishX = wx;
    player.wishZ = wz;
  }

  // Feature 11d: entering water starts swimming (the bed is below surface).
  const waterY = waterSurfaceAt(player.pos.x, player.pos.z);
  if (!player.swimming && !player.mantling && waterY !== null &&
      player.pos.y < waterY + 0.35 && player.vy <= 0.5) {
    player.swimming = true;
    player.swimT = 0;
    player.stuckT = 0;
    player.vy = 0;
    player.grounded = false;
    player.jumpPhase = null;
  }
  // Left the water region entirely (shouldn't happen via banks, but be safe).
  if (player.swimming && waterY === null) {
    player.swimming = false;
    player.grounded = true;
  }

  // wasGrounded is the pre-update grounded state (captured before applyGround
  // runs) so the animation machine can detect the airborne->landed transition.
  const wasGrounded = player.grounded;
  if (player.mantling) {
    updateMantle(player, dt);
    resolveCollisions(player.pos);
  } else if (player.swimming) {    updateSwim(player, dt, waterY, wx, wz, moving);
  } else {
    // Acceleration toward the target speed — the ramp crosses the jog band,
    // so walk->sprint naturally crossfades through Jog_Fwd_Loop.
    const target = moving ? (sprinting ? SPRINT_SPEED : WALK_SPEED) : 0;
    const lambda = target > player.speed ? 6 : 10;
    player.speed = THREE.MathUtils.damp(player.speed, target, lambda, dt);

    if (moving && player.speed > 0.05) {
      player.pos.x += wx * player.speed * dt;
      player.pos.z += wz * player.speed * dt;
      player.yaw = dampAngle(player.yaw, Math.atan2(wx, wz), 12, dt);
      player.group.rotation.y = player.yaw;
    }

    // Feature 6: collide (capsule vs buildings/props), then ground + gravity.
    resolveCollisions(player.pos);
    applyGround(player, dt, GRAVITY);
  }

  updatePlayerAnimation(player, dt, wasGrounded);

  // Third-person camera with wall pull-in.
  const headY = player.pos.y + HEAD_H;
  const cp = Math.cos(player.camPitch);
  const sp = Math.sin(player.camPitch);
  const dx = Math.sin(player.camYaw) * cp;
  const dy = sp;
  const dz = Math.cos(player.camYaw) * cp;
  const want = player.camDist;
  const t = raySegmentHit(
    player.pos.x, headY, player.pos.z, dx * want, dy * want, dz * want);
  const d = t === Infinity ? want : Math.max(0.9, t * want - 0.35);
  const cam = player.camera;
  cam.position.set(
    player.pos.x + dx * d,
    headY + dy * d,
    player.pos.z + dz * d,
  );
  cam.lookAt(player.pos.x, headY, player.pos.z);
}
