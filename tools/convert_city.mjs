#!/usr/bin/env node
/**
 * Convert the 28 Low Poly Bricks city .dae models to .glb.
 *
 * NOTE: MASTER_PROMPT.md specifies a Blender headless script for this, but
 * Blender 4.x removed the Collada importer entirely, so this uses Three.js'
 * own ColladaLoader + GLTFExporter instead (same result: Y-up, meters,
 * origin at bottom-center, material slots preserved, no textures embedded —
 * palette PNGs are assigned at runtime).
 *
 * Usage: node tools/convert_city.mjs
 * Reads:  tools/_work/models/*.dae   (unzipped from Low_Poly_Bricks_city/Models.zip)
 * Writes: public/assets/city/*.glb
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

globalThis.DOMParser = DOMParser;

// Minimal FileReader polyfill — GLTFExporter uses it for buffer/image reads.
globalThis.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  _done(promise) {
    promise.then(
      (result) => {
        this.result = result;
        const evt = { target: this };
        if (this.onload) this.onload(evt);
        if (this.onloadend) this.onloadend(evt);
      },
      (err) => {
        if (this.onerror) this.onerror(err);
      },
    );
  }
  readAsArrayBuffer(blob) {
    this._done(blob.arrayBuffer().then((b) => b));
  }
  readAsDataURL(blob) {
    this._done(
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        return `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
      }),
    );
  }
};

const THREE = await import('three');
const { ColladaLoader } = await import('three/addons/loaders/ColladaLoader.js');
const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'tools', '_work', 'models');
const DST = join(REPO, 'public', 'assets', 'city');
mkdirSync(DST, { recursive: true });

const loader = new ColladaLoader();
const exporter = new GLTFExporter();

function exportGlb(scene) {
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(Buffer.from(result)),
      (err) => reject(err),
      { binary: true },
    );
  });
}

async function convert(fname) {
  const name = basename(fname, '.dae');
  const text = readFileSync(join(SRC, fname), 'utf8');
  const collada = loader.parse(text, SRC + '/');
  const root = collada.scene;

  // Bake the loader's Z-up -> Y-up root rotation into the children.
  root.updateMatrixWorld(true);
  const inner = new THREE.Group();
  while (root.children.length) inner.attach(root.children[0]);
  inner.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  if (size.length() === 0) {
    console.warn(`WARN ${name}: empty geometry, skipping`);
    return null;
  }
  // Origin -> bottom-center.
  inner.position.set(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2,
  );

  const glb = await exportGlb(inner);
  const out = join(DST, name + '.glb');
  writeFileSync(out, glb);

  let meshes = 0, tris = 0;
  inner.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  console.log(
    `OK ${name}: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m, ` +
    `${meshes} mesh(es), ${Math.round(tris).toLocaleString('en-US')} tris, ` +
    `${(glb.length / 1024).toFixed(0)} KB`,
  );
  return name;
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.dae')).sort();
console.log(`Converting ${files.length} models from ${SRC}`);
const done = [];
for (const f of files) {
  const r = await convert(f);
  if (r) done.push(r);
}
console.log(`Done: ${done.length}/${files.length} models -> ${DST}`);
if (done.length !== files.length) process.exit(1);
