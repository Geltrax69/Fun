// Feature 11a: day/night cycle — drives the sun/moon light, sky and fog
// colors, and hemisphere intensity from a time-of-day clock.
import * as THREE from 'three';

// hour -> look. sunI is the directional intensity; at night the same light
// acts as the moon (bluish, low).
const KEYS = [
  { h: 0.0, sky: 0x070b16, sun: 0x8fa5d6, sunI: 0.22, hemiI: 0.14 },
  { h: 4.5, sky: 0x0a0f1e, sun: 0x8fa5d6, sunI: 0.18, hemiI: 0.12 },
  { h: 6.0, sky: 0x3a4a6a, sun: 0xffb27a, sunI: 0.60, hemiI: 0.30 },
  { h: 7.5, sky: 0x9fc3e8, sun: 0xffd9a8, sunI: 1.70, hemiI: 0.60 },
  { h: 12.0, sky: 0x87b8e0, sun: 0xfff1d6, sunI: 2.60, hemiI: 0.85 },
  { h: 16.5, sky: 0x87b8e0, sun: 0xffe8c0, sunI: 2.20, hemiI: 0.75 },
  { h: 18.0, sky: 0xd98a4e, sun: 0xff9a50, sunI: 1.00, hemiI: 0.45 },
  { h: 19.5, sky: 0x2a3352, sun: 0x8fa5d6, sunI: 0.28, hemiI: 0.20 },
  { h: 21.0, sky: 0x070b16, sun: 0x8fa5d6, sunI: 0.22, hemiI: 0.14 },
  { h: 24.0, sky: 0x070b16, sun: 0x8fa5d6, sunI: 0.22, hemiI: 0.14 },
];

const _sky = new THREE.Color();
const _sun = new THREE.Color();

function sample(h) {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (h >= KEYS[i].h && h <= KEYS[i + 1].h) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  return {
    sky: _sky.setHex(a.sky).lerp(new THREE.Color(b.sky), t).clone(),
    sun: _sun.setHex(a.sun).lerp(new THREE.Color(b.sun), t).clone(),
    sunI: a.sunI + (b.sunI - a.sunI) * t,
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
  };
}

export function createDayNight(scene, sun, hemi, skyColor) {
  const state = {
    time: 10.5, // start mid-morning
    dayLength: 600, // seconds per full 24 h
  };

  function apply() {
    const s = sample(state.time);
    skyColor.copy(s.sky);
    scene.fog.color.copy(s.sky);
    sun.color.copy(s.sun);
    sun.intensity = s.sunI;
    hemi.intensity = s.hemiI;
    if (state.time > 6 && state.time < 18) {
      // Sun arcs east -> overhead -> west.
      const a = ((state.time - 6) / 12) * Math.PI;
      sun.position.set(Math.cos(a) * 220, Math.sin(a) * 190 + 25, 70);
    } else {
      // Moon holds a fixed high position so nights keep soft shadows.
      sun.position.set(110, 160, -90);
    }
  }

  function update(dt) {
    state.time = (state.time + (dt * 24) / state.dayLength) % 24;
    apply();
  }

  function isNight() {
    return state.time < 5.75 || state.time > 18.25;
  }

  function setTime(h) {
    state.time = ((h % 24) + 24) % 24;
    apply();
  }

  apply();
  return { update, isNight, setTime, state };
}
