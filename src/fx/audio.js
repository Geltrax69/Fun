// Feature 11e: procedural audio — footstep grains timed to distance walked,
// splash grains while swimming, and a soft wind/water ambient bed.
// No audio assets; everything is synthesized with the Web Audio API.
// The context starts on the first user gesture (autoplay policy); M mutes.
import { waterSurfaceAt } from '../player/swim.js';

function noiseBuffer(ctx, seconds = 1) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function createAudio() {
  let ctx = null;
  let noise = null;
  let muted = false;
  let lastX = 0;
  let lastZ = 0;
  let stepAcc = 0;
  let windGain = null;
  let waterGain = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      noise = noiseBuffer(ctx);
      startAmbient();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function startAmbient() {
    // Wind: looped noise through a lowpass, slow LFO on the gain.
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    wind.connect(lp).connect(windGain).connect(ctx.destination);
    wind.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(windGain.gain);
    lfo.start();

    // Water: looped noise through a bandpass; gain follows water proximity.
    const water = ctx.createBufferSource();
    water.buffer = noise;
    water.loop = true;
    water.playbackRate.value = 0.7;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    waterGain = ctx.createGain();
    waterGain.gain.value = 0;
    water.connect(bp).connect(waterGain).connect(ctx.destination);
    water.start();
  }

  /** Short filtered noise grain (footstep / splash). */
  function grain({ freq = 600, q = 1.2, dur = 0.09, vol = 0.16, rate = 1 }) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = rate * (0.9 + Math.random() * 0.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq * (0.9 + Math.random() * 0.2);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t, Math.random() * 0.8, dur + 0.05);
    src.stop(t + dur + 0.1);
  }

  const step = (sprint) => grain({ freq: sprint ? 500 : 620, dur: 0.08, vol: 0.13 });
  const splash = () => grain({ freq: 1100, q: 0.7, dur: 0.22, vol: 0.2, rate: 0.6 });

  function update(dt, player) {
    if (!ctx || muted) return;
    const moved = Math.hypot(player.pos.x - lastX, player.pos.z - lastZ);
    lastX = player.pos.x;
    lastZ = player.pos.z;
    if (player.swimming) {
      stepAcc += moved;
      if (stepAcc > 1.6 && moved > 0.001) {
        stepAcc = 0;
        splash();
      }
    } else if (player.grounded && !player.mantling) {
      stepAcc += moved;
      const stride = player.speed > 5 ? 2.6 : 1.9;
      if (stepAcc > stride && moved > 0.001) {
        stepAcc = 0;
        step(player.speed > 5);
      }
    } else {
      stepAcc = 0;
    }
    // Water ambient swells near the canal/sea.
    if (waterGain) {
      const near = waterSurfaceAt(player.pos.x, player.pos.z) !== null ||
        waterSurfaceAt(player.pos.x + 8, player.pos.z) !== null ||
        waterSurfaceAt(player.pos.x - 8, player.pos.z) !== null ||
        waterSurfaceAt(player.pos.x, player.pos.z + 8) !== null ||
        waterSurfaceAt(player.pos.x, player.pos.z - 8) !== null;
      const target = near ? 0.06 : 0.015;
      waterGain.gain.value += (target - waterGain.gain.value) * Math.min(1, dt * 2);
    }
  }

  function toggleMute() {
    muted = !muted;
    if (ctx) {
      if (muted) ctx.suspend();
      else ctx.resume();
    }
    return muted;
  }

  window.addEventListener('keydown', ensure);
  window.addEventListener('pointerdown', ensure);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) {
      const m = toggleMute();
      const el = document.getElementById('hint');
      if (el) el.dataset.muted = m ? '1' : '';
    }
  });

  return { update, ensure, toggleMute, get muted() { return muted; } };
}
