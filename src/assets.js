// Shared asset loading: one GLTFLoader, one cache — every .glb loads exactly once.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const gltfCache = new Map();
const sceneCache = new Map();

/** Load a .glb/.gltf, cached by URL. Returns the full THREE.GLTF (scene + animations). */
export function loadGltf(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, loader.loadAsync(url));
  }
  return gltfCache.get(url);
}

/** Load a .glb/.gltf, cached by URL. Returns the THREE.Group (scene root). */
export function loadModel(url) {
  if (!sceneCache.has(url)) {
    sceneCache.set(
      url,
      loadGltf(url).then((gltf) => gltf.scene),
    );
  }
  return sceneCache.get(url);
}

/** Preload a list of model URLs in parallel. */
export function preloadModels(urls) {
  return Promise.all(urls.map(loadModel));
}
