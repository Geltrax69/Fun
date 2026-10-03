// Feature 5: third-person player — a ranger with WASD/arrows + Shift run +
// Space jump, a pointer-lock mouse camera with scroll zoom, and a wall-aware
// camera that pulls in instead of clipping through buildings.
import * as THREE from 'three';
import { makeCharacter, playAnim } from '../npc/npc.js';
import { raySegmentHit, resolveCollisions, applyGround } from '../city/colliders.js';

const WALK_SPEED = 2.5;
const RUN_SPEED = 7.0;
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
  if (player.grounded) {
    player.vy = JUMP_VY;
    player.grounded = false;
  }
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
    yaw: Math.PI, // character facing; the model faces +z at rotation 0
    camYaw: 0, // camera south of the player, looking north
    camPitch: 0.34,
    camDist: 4.6,
    keys: {},
    anim: null,
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

/** Advance the player simulation by dt seconds. */
export function updatePlayer(player, dt) {
  const k = player.keys;
  const ix = ((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0);
  const iz = ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0);
  const running = !!(k.ShiftLeft || k.ShiftRight);
  const moving = ix !== 0 || iz !== 0;

  if (moving) {
    const len = Math.hypot(ix, iz);
    const nx = ix / len;
    const nz = iz / len;
    // Camera-relative wish direction on the ground plane.
    const fx = -Math.sin(player.camYaw);
    const fz = -Math.cos(player.camYaw);
    const rx = Math.cos(player.camYaw);
    const rz = -Math.sin(player.camYaw);
    const wx = rx * nx + fx * nz;
    const wz = rz * nx + fz * nz;
    const speed = running ? RUN_SPEED : WALK_SPEED;
    player.pos.x += wx * speed * dt;
    player.pos.z += wz * speed * dt;
    player.yaw = dampAngle(player.yaw, Math.atan2(wx, wz), 12, dt);
    player.group.rotation.y = player.yaw;
  }

  // Feature 6: collide (capsule vs buildings/props), then ground + gravity.
  resolveCollisions(player.pos);
  applyGround(player, dt, GRAVITY);

  // Locomotion animation (simple switch here; feature 7 builds the full
  // crossfaded state machine on top of playAnim).
  const wantAnim = !player.grounded
    ? 'Jump_Loop'
    : moving
      ? running ? 'Jog_Fwd_Loop' : 'Walk_Loop'
      : 'Idle_Loop';
  if (player.anim !== wantAnim) {
    player.anim = wantAnim;
    playAnim(player.group, wantAnim).catch(() => {});
  }

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
