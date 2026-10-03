// Feature 3: seeded city layout — pure data, no three.js.
// A ~300x300 m town: street grid, 16 blocks (housing / park / church),
// a north-south canal (replacing the x=0 street) with bridges, and a
// harbour along the south edge. Testable with `node --test`.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TOWN = {
  extent: 150, // town spans -150..150 in x and z
  streetWidth: 10,
  streetsV: [-120, -60, 60, 120], // canal replaces the x=0 street
  streetsH: [-120, -60, 0, 60, 120],
  canal: { x: 0, halfWidth: 5, z0: -150, z1: 150 },
  bridges: [-60, 0, 60], // z positions where horizontal streets cross the canal
  blockHalf: 25, // blocks are 50x50 m
  blockCenters: [-90, -30, 30, 90],
};

export const HOUSE_MODELS = [
  'House-1-1', 'House-1-2', 'House-1-3', 'House-1-4',
  'House-1-5', 'House-2-1', 'House-2-2',
];

export const SCHEME_COUNT = 6;

export function generateLayout(seed = 20261004) {
  const rand = mulberry32(seed);
  const rf = (a, b) => a + rand() * (b - a);
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // ---- blocks ----
  const blocks = [];
  for (const bx of TOWN.blockCenters)
    for (const bz of TOWN.blockCenters)
      blocks.push({ cx: bx, cz: bz, kind: 'housing' });
  const at = (x, z) => blocks.find((b) => b.cx === x && b.cz === z);
  at(30, 30).kind = 'church';
  for (const [px, pz] of [[-90, -90], [90, -90], [-90, 90], [90, 90]])
    at(px, pz).kind = 'park';

  // ---- houses: along each housing block's edges, facing the street ----
  // rotY assumes the model's front faces +z; verified visually in build.
  const houses = [];
  for (const b of blocks) {
    if (b.kind !== 'housing') continue;
    const H = TOWN.blockHalf;
    const sides = [
      { along: 'x', fixed: b.cz - H + 7, rotY: Math.PI }, // north edge, faces -z
      { along: 'x', fixed: b.cz + H - 7, rotY: 0 }, // south edge, faces +z
      { along: 'z', fixed: b.cx - H + 7, rotY: -Math.PI / 2 }, // west edge, faces -x
      { along: 'z', fixed: b.cx + H - 7, rotY: Math.PI / 2 }, // east edge, faces +x
    ];
    for (const s of sides) {
      const n = 2 + (rand() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const base = (s.along === 'x' ? b.cx : b.cz) - H + 8 + t * 34;
        const alongPos = base + rf(-2, 2);
        houses.push({
          model: pick(HOUSE_MODELS),
          scheme: ri(0, SCHEME_COUNT - 1),
          x: s.along === 'x' ? alongPos : s.fixed + rf(-1, 1),
          z: s.along === 'x' ? s.fixed + rf(-1, 1) : alongPos,
          rotY: s.rotY + rf(-0.06, 0.06),
        });
      }
    }
  }

  // ---- props ----
  const props = [];
  const addProp = (type, x, z, rotY = 0, s = 1) =>
    props.push({ type, x, z, rotY, s });

  // Lampposts along streets (skip the canal gap; bridges get their own).
  for (const sx of TOWN.streetsV)
    for (let z = -140; z <= 140; z += 28)
      addProp('Lamppost', sx + 7, z + rf(-2, 2), rf(0, Math.PI * 2));
  for (const sz of TOWN.streetsH)
    for (let x = -140; x <= 140; x += 28) {
      if (Math.abs(x) < 9) continue;
      addProp('Lamppost', x + rf(-2, 2), sz + 7, rf(0, Math.PI * 2));
    }
  for (const bz of TOWN.bridges) {
    addProp('Lamppost', -8, bz + 4.5, 0);
    addProp('Lamppost', 8, bz - 4.5, 0);
  }

  // Parks: trees, foliage, benches, perimeter fences.
  for (const b of blocks) {
    if (b.kind !== 'park') continue;
    for (let i = 0; i < 9; i++)
      addProp('Birchtree', b.cx + rf(-18, 18), b.cz + rf(-18, 18),
        rf(0, Math.PI * 2), rf(0.8, 1.3));
    for (let i = 0; i < 16; i++)
      addProp(pick(['Foliage', 'Foliage2', 'Foliage3']),
        b.cx + rf(-20, 20), b.cz + rf(-20, 20), rf(0, Math.PI * 2), rf(0.8, 1.6));
    for (let i = 0; i < 3; i++)
      addProp('Bench', b.cx + rf(-14, 14), b.cz + rf(-14, 14), rf(0, Math.PI * 2));
    for (let k = 0; k < 21; k++) {
      const t = -23.8 + k * 2.38;
      addProp('Fence', b.cx + t, b.cz - TOWN.blockHalf, 0);
      addProp('Fence', b.cx + t, b.cz + TOWN.blockHalf, 0);
      addProp('Fence', b.cx - TOWN.blockHalf, b.cz + t, Math.PI / 2);
      addProp('Fence', b.cx + TOWN.blockHalf, b.cz + t, Math.PI / 2);
    }
  }

  // Church plaza: benches + a cafe set.
  const ch = { x: 30, z: 30 };
  for (let i = 0; i < 4; i++) addProp('Bench', ch.x - 12 + i * 8, ch.z + 13, Math.PI);
  addProp('Table', ch.x + 10, ch.z - 9, 0.4);
  addProp('Chair', ch.x + 8.2, ch.z - 9, -1.3);
  addProp('Chair', ch.x + 11.8, ch.z - 9, 1.3);
  addProp('Parasol', ch.x + 10, ch.z - 9, 0);

  // Harbour dressing.
  const shoreRocks = [];
  for (let i = 0; i < 7; i++)
    shoreRocks.push({
      x: -130 + i * 44 + rf(-8, 8),
      z: 162 + rf(-3, 3),
      rotY: rf(0, Math.PI * 2),
      s: rf(0.8, 1.6),
    });

  return {
    seed,
    blocks,
    houses,
    props,
    streetsV: TOWN.streetsV,
    streetsH: TOWN.streetsH,
    canal: TOWN.canal,
    bridges: TOWN.bridges,
    church: { model: 'Church', x: ch.x, z: ch.z - 5, rotY: Math.PI },
    lighthouse: { model: 'Lighthouse', x: 110, z: 170, rotY: 0 },
    ship: { model: 'Ship', x: 20, z: 205, rotY: 0.5 },
    shoreRocks,
  };
}
