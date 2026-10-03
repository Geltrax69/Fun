// Feature 4: character factory — assembles a rigged character from the staged
// Modular Fantasy Outfits + the extracted heads + hairstyles, all sharing the
// same 65-bone skeleton, animated from the shared UAL1_Standard clip library.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadModel, loadGltf } from '../assets.js';

const CHARS = '/assets/chars';

// ---------------------------------------------------------------------------
// Shared templates: each source model loads exactly once.
// ---------------------------------------------------------------------------

/** Outfit templates, keyed "sex:outfit". Cloned per character. */
const outfitCache = new Map();
/** Part templates (head/hair), keyed by URL -> SkinnedMesh list. */
const partCache = new Map();

async function outfitTemplate(sex, outfit) {
  const key = `${sex}:${outfit}`;
  if (!outfitCache.has(key)) {
    const file = `${sex === 'male' ? 'Male' : 'Female'}_${outfit === 'ranger' ? 'Ranger' : 'Peasant'}`;
    outfitCache.set(key, loadModel(`${CHARS}/outfits/Outfits/${file}.gltf`));
  }
  return outfitCache.get(key);
}

async function partMeshes(url) {
  if (!partCache.has(url)) {
    partCache.set(
      url,
      loadModel(url).then((root) => {
        const meshes = [];
        root.traverse((o) => {
          if (o.isSkinnedMesh) meshes.push(o);
        });
        return meshes;
      }),
    );
  }
  return partCache.get(url);
}

// ---------------------------------------------------------------------------
// Animation clips: loaded once, shared by every character.
// ---------------------------------------------------------------------------

let clipsPromise = null;
export function loadClips() {
  if (!clipsPromise) {
    clipsPromise = loadGltf(`${CHARS}/animations/UAL1_Standard.glb`).then(
      (gltf) => gltf.animations,
    );
  }
  return clipsPromise;
}

/** One AnimationMixer per character, stored on the character root. */
export function getMixer(char) {
  if (!char.userData.mixer) char.userData.mixer = new THREE.AnimationMixer(char);
  return char.userData.mixer;
}

/**
 * Crossfade the character to a named clip (e.g. 'Idle_Loop', 'Walk_Loop').
 * Clips come from the shared UAL1_Standard library.
 */
export async function playAnim(char, name, { loop = true, fade = 0.3 } = {}) {
  const clips = await loadClips();
  const clip = clips.find((c) => c.name === name);
  if (!clip) throw new Error(`animation clip not found: ${name}`);
  const mixer = getMixer(char);
  const prev = char.userData.action;
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.clampWhenFinished = !loop;
  action.fadeIn(fade);
  action.play();
  if (prev && prev !== action) prev.fadeOut(fade);
  char.userData.action = action;
  return action;
}

// ---------------------------------------------------------------------------
// Palette swap: outfit materials referencing the default basecolor texture get
// a cloned material with the alternate palette texture (template untouched).
// ---------------------------------------------------------------------------

const texLoader = new THREE.TextureLoader();
const paletteTexCache = new Map();

function paletteTexture(kind, palette) {
  // kind: 'peasant' | 'ranger'; palette 0 = default, 1 = alternate.
  const file =
    kind === 'peasant'
      ? palette === 1 ? 'T_Peasant_2_BaseColor.png' : 'T_Peasant_BaseColor.png'
      : palette === 1 ? 'T_Ranger_3_BaseColor.png' : 'T_Ranger_BaseColor.png';
  const url = `${CHARS}/outfits/Outfits/${file}`;
  if (!paletteTexCache.has(url)) {
    paletteTexCache.set(
      url,
      texLoader.loadAsync(url).then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
      }),
    );
  }
  return paletteTexCache.get(url);
}

async function applyPalette(char, kind, palette) {
  if (palette === 0) return;
  const tex = await paletteTexture(kind, palette);
  const base = kind === 'peasant' ? 'T_Peasant_BaseColor.png' : 'T_Ranger_BaseColor.png';
  char.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      const src = (m.map && m.map.image && m.map.image.src) || '';
      if (src.endsWith(base)) {
        const nm = m.clone();
        nm.map = tex;
        nm.needsUpdate = true;
        if (Array.isArray(o.material)) o.material[i] = nm;
        else o.material = nm;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Character assembly.
// ---------------------------------------------------------------------------

const HAIR_STYLES = [
  'Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_SimpleParted',
];

/**
 * Bind a template part mesh onto the character's skeleton. Bone order is
 * identical across the outfit/head/hair skeletons (verified at staging), so
 * the part's skin indices are used directly with the character skeleton.
 */
function bindPart(mesh, skeleton, parent) {
  const m = mesh.clone();
  m.skeleton = skeleton;
  parent.add(m);
  return m;
}

/**
 * Assemble a rigged character.
 *   sex:     'male' | 'female'
 *   outfit:  'peasant' | 'ranger'   (rangers wear hoods — no hair, to avoid clipping)
 *   palette: 0 | 1                   (alternate basecolor texture)
 *   hair:    style name | null (none) | undefined (auto: none for ranger, random for peasant)
 *   beard:   true | false            (male only)
 * Returns the character Group with userData { mixer, action, config }.
 */
export async function makeCharacter({
  sex = 'male',
  outfit = 'peasant',
  palette = 0,
  hair = undefined,
  beard = false,
} = {}) {
  const kind = outfit === 'ranger' ? 'ranger' : 'peasant';

  // Resolve the hair choice before loading (rangers wear hoods — no hair).
  let style = hair;
  if (style === undefined) {
    style = kind === 'ranger' ? null : HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)];
  }
  const brows = sex === 'male' ? 'Eyebrows_Regular' : 'Eyebrows_Female';
  const wantBeard = beard && sex === 'male';

  // Load the outfit template and all body parts concurrently — sequential
  // awaits here cost ~18 s of texture parsing on a loaded machine.
  const [template, headMeshes, hairMeshes, browMeshes, beardMeshes] = await Promise.all([
    outfitTemplate(sex, kind),
    partMeshes(`${CHARS}/heads/Head_${sex === 'male' ? 'Male' : 'Female'}.glb`),
    style ? partMeshes(`${CHARS}/hair/${style}.gltf`) : Promise.resolve([]),
    partMeshes(`${CHARS}/hair/${brows}.gltf`),
    wantBeard ? partMeshes(`${CHARS}/hair/Hair_Beard.gltf`) : Promise.resolve([]),
  ]);

  // 1. Outfit body — clone() re-targets the skeleton to the cloned bones.
  const char = cloneSkinned(template);

  // The character's own skeleton (from the cloned outfit).
  let skeleton = null;
  char.traverse((o) => {
    if (o.isSkinnedMesh && !skeleton) skeleton = o.skeleton;
  });
  if (!skeleton) throw new Error(`no skeleton found for ${sex}/${kind}`);

  // 2. Head, hair, eyebrows, beard — bound to the character skeleton.
  for (const hm of headMeshes) bindPart(hm, skeleton, char);
  for (const hm of hairMeshes) bindPart(hm, skeleton, char);
  for (const hm of browMeshes) bindPart(hm, skeleton, char);
  for (const hm of beardMeshes) bindPart(hm, skeleton, char);

  // 3. Outfit palette variant.
  await applyPalette(char, kind, palette);

  // 4. Shadows on everything the character brings in.
  char.traverse((o) => {
    if (o.isSkinnedMesh || o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false; // skinned bounds shift with the pose; never cull wrongly
    }
  });

  char.userData.config = { sex, outfit: kind, palette, hair: style, beard };
  return char;
}

/** Advance every character's mixer — call once per frame with the frame dt. */
export function updateCharacters(chars, dt) {
  for (const c of chars) {
    const mixer = c.userData.mixer;
    if (mixer) mixer.update(dt);
  }
}
