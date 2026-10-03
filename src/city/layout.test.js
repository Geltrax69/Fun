// Layout logic tests — `node --test src/city/layout.test.js`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLayout, mulberry32, TOWN, HOUSE_MODELS, SCHEME_COUNT } from './layout.js';

test('mulberry32 is deterministic', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('same seed -> identical layout', () => {
  const a = generateLayout(7);
  const b = generateLayout(7);
  assert.deepEqual(a, b);
});

test('different seeds -> different layouts', () => {
  const a = generateLayout(7);
  const b = generateLayout(8);
  assert.notDeepEqual(a.houses, b.houses);
});

test('block census: 16 blocks, 1 church, 4 parks, 11 housing', () => {
  const { blocks } = generateLayout(1);
  assert.equal(blocks.length, 16);
  assert.equal(blocks.filter((b) => b.kind === 'church').length, 1);
  assert.equal(blocks.filter((b) => b.kind === 'park').length, 4);
  assert.equal(blocks.filter((b) => b.kind === 'housing').length, 11);
});

test('houses are inside the town and inside a housing block', () => {
  const { houses, blocks } = generateLayout(3);
  assert.ok(houses.length > 50, `expected >50 houses, got ${houses.length}`);
  const housing = blocks.filter((b) => b.kind === 'housing');
  for (const h of houses) {
    assert.ok(Math.abs(h.x) <= TOWN.extent && Math.abs(h.z) <= TOWN.extent,
      `house out of town at ${h.x},${h.z}`);
    assert.ok(HOUSE_MODELS.includes(h.model), `unknown model ${h.model}`);
    assert.ok(h.scheme >= 0 && h.scheme < SCHEME_COUNT, `bad scheme ${h.scheme}`);
    const inside = housing.some((b) =>
      Math.abs(h.x - b.cx) <= TOWN.blockHalf && Math.abs(h.z - b.cz) <= TOWN.blockHalf);
    assert.ok(inside, `house at ${h.x.toFixed(1)},${h.z.toFixed(1)} outside any housing block`);
    assert.ok(Math.abs(h.x - TOWN.canal.x) > TOWN.canal.halfWidth + 5,
      `house too close to canal at ${h.x.toFixed(1)},${h.z.toFixed(1)}`);
  }
});

test('no prop sits in the canal', () => {
  const { props } = generateLayout(5);
  assert.ok(props.length > 200, `expected >200 props, got ${props.length}`);
  for (const p of props) {
    const inCanalX = Math.abs(p.x - TOWN.canal.x) < TOWN.canal.halfWidth + 1;
    const inCanalZ = p.z > TOWN.canal.z0 && p.z < TOWN.canal.z1;
    assert.ok(!(inCanalX && inCanalZ), `${p.type} in canal at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  }
});

test('bridges sit on horizontal streets crossing the canal', () => {
  const { bridges, streetsH } = generateLayout(9);
  for (const bz of bridges)
    assert.ok(streetsH.includes(bz), `bridge at z=${bz} not on a street`);
});

test('church / lighthouse / ship are placed sanely', () => {
  const l = generateLayout(11);
  assert.equal(l.church.model, 'Church');
  assert.ok(l.lighthouse.z > TOWN.extent, 'lighthouse should be past the south edge (harbour)');
  assert.ok(l.ship.z > l.lighthouse.z, 'ship should be out in the water');
  assert.ok(l.shoreRocks.length >= 5);
});
