// Shared asset loading: one GLTFLoader, one cache — every .glb loads exactly once.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

/** Load a .glb/.gltf, cached by URL. Returns the THREE.Group (scene root). */
export function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      loader.loadAsync(url).then((gltf) => gltf.scene),
    );
  }
  return cache.get(url);
}

/** Preload a list of model URLs in parallel. */
export function preloadModels(urls) {
  return Promise.all(urls.map(loadModel));
}
