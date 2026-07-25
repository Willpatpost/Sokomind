const assert = require("node:assert/strict");
const test = require("node:test");

const {
  geometricHash,
  SubproblemCache,
  PersistentSubproblemCache,
} = require("../../src/subproblem-cache.js");

// --- geometricHash tests ---

test("geometricHash returns a consistent 8-char hex string", () => {
  const cells = ["0,0", "0,1", "1,0", "1,1"];
  const hash = geometricHash(cells);
  assert.equal(typeof hash, "string");
  assert.equal(hash.length, 8);
  assert.match(hash, /^[0-9a-f]{8}$/);
  // Same input should always produce same hash
  assert.equal(geometricHash(cells), hash);
});

test("geometricHash is rotation invariant (90 degree rotation)", () => {
  // 2x3 block:
  //  ##
  //  ##
  //  ##
  const original = ["0,0", "0,1", "1,0", "1,1", "2,0", "2,1"];
  // Rotated 90 degrees clockwise becomes a 3x2 block:
  //  ###
  //  ###
  const rotated = ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2"];
  assert.equal(geometricHash(original), geometricHash(rotated));
});

test("geometricHash is reflection invariant (horizontal mirror)", () => {
  // L-shape:
  //  #
  //  ##
  const original = ["0,0", "1,0", "1,1"];
  // Mirrored horizontally:
  //   #
  //  ##
  const mirrored = ["0,1", "1,0", "1,1"];
  assert.equal(geometricHash(original), geometricHash(mirrored));
});

test("geometricHash is reflection invariant (vertical mirror)", () => {
  // L-shape:
  //  #
  //  ##
  const original = ["0,0", "1,0", "1,1"];
  // Mirrored vertically:
  //  ##
  //  #
  const mirrored = ["0,0", "0,1", "1,0"];
  assert.equal(geometricHash(original), geometricHash(mirrored));
});

test("geometricHash is translation invariant", () => {
  const original = ["0,0", "0,1", "1,0"];
  const translated = ["5,10", "5,11", "6,10"];
  assert.equal(geometricHash(original), geometricHash(translated));
});

test("geometricHash handles empty cell set", () => {
  const hash = geometricHash([]);
  assert.equal(typeof hash, "string");
  assert.equal(hash, "00000000");
});

test("geometricHash handles single cell", () => {
  const hash1 = geometricHash(["0,0"]);
  const hash2 = geometricHash(["5,3"]);
  // All single cells should hash the same (all are just one point after normalization)
  assert.equal(hash1, hash2);
});

test("geometricHash handles numeric pair arrays", () => {
  const fromStrings = geometricHash(["0,0", "0,1", "1,0"]);
  const fromArrays = geometricHash([[0, 0], [0, 1], [1, 0]]);
  assert.equal(fromStrings, fromArrays);
});

test("geometricHash distinguishes different shapes", () => {
  // Straight line: ###
  const line = ["0,0", "0,1", "0,2"];
  // L-shape:
  //  #
  //  ##
  const lShape = ["0,0", "1,0", "1,1"];
  assert.notEqual(geometricHash(line), geometricHash(lShape));
});

test("geometricHash is invariant under all 8 dihedral transforms", () => {
  // T-shape:
  //  ###
  //   #
  const base = ["0,0", "0,1", "0,2", "1,1"];

  // All 8 transforms of the T-shape
  const transforms = [
    ["0,0", "0,1", "0,2", "1,1"],       // identity
    ["0,0", "0,1", "0,2", "-1,1"],       // vertical mirror (flip along horizontal axis)
    ["0,0", "1,0", "2,0", "1,1"],        // rotate 90
    ["0,0", "1,0", "2,0", "1,-1"],       // rotate 90 + mirror
    ["0,-2", "0,-1", "0,0", "1,-1"],     // rotate 180
    ["0,-2", "0,-1", "0,0", "-1,-1"],    // rotate 180 + mirror
    ["0,0", "-1,0", "-2,0", "-1,1"],     // rotate 270
    ["0,0", "-1,0", "-2,0", "-1,-1"],    // rotate 270 + mirror
  ];

  const baseHash = geometricHash(base);
  for (const t of transforms) {
    assert.equal(geometricHash(t), baseHash,
      `Transform ${JSON.stringify(t)} should match base hash`);
  }
});

// --- SubproblemCache tests ---

test("SubproblemCache get/set round-trip", () => {
  const cache = new SubproblemCache(100);
  const cells = ["0,0", "0,1", "1,0"];
  const goalConfig = ["0,1"];
  const pdbData = { distances: new Map([["0,0", 1]]) };

  assert.equal(cache.get(cells, goalConfig), null);
  cache.set(cells, goalConfig, pdbData);
  assert.deepEqual(cache.get(cells, goalConfig), pdbData);
});

test("SubproblemCache has() checks existence", () => {
  const cache = new SubproblemCache(100);
  const cells = ["0,0", "1,0"];
  const goalConfig = ["1,0"];

  assert.equal(cache.has(cells, goalConfig), false);
  cache.set(cells, goalConfig, { value: 42 });
  assert.equal(cache.has(cells, goalConfig), true);
});

test("SubproblemCache evicts oldest entry when full", () => {
  const cache = new SubproblemCache(2);
  const cells1 = ["0,0"];
  const cells2 = ["0,0", "0,1"];
  const cells3 = ["0,0", "0,1", "1,0"];
  const goalConfig = ["0,0"];

  cache.set(cells1, goalConfig, "data1");
  cache.set(cells2, goalConfig, "data2");
  assert.equal(cache.get(cells1, goalConfig), "data1");
  assert.equal(cache.get(cells2, goalConfig), "data2");

  // Adding a third should evict the oldest (cells1, since cells2 was
  // promoted by the get() call above)
  cache.set(cells3, goalConfig, "data3");
  assert.equal(cache.get(cells1, goalConfig), null);
  assert.equal(cache.get(cells2, goalConfig), "data2");
  assert.equal(cache.get(cells3, goalConfig), "data3");
});

test("SubproblemCache LRU promotion on get", () => {
  const cache = new SubproblemCache(2);
  // Use geometrically distinct shapes to ensure different keys
  const cells1 = ["0,0"];                                 // single point
  const cells2 = ["0,0", "0,1", "0,2"];                   // 3-cell line
  const cells3 = ["0,0", "0,1", "1,0", "1,1"];            // 2x2 square
  const goalConfig = ["0,0"];

  cache.set(cells1, goalConfig, "data1");
  cache.set(cells2, goalConfig, "data2");

  // Access cells1 to promote it
  cache.get(cells1, goalConfig);

  // Now cells2 is the oldest, so adding cells3 should evict cells2
  cache.set(cells3, goalConfig, "data3");

  assert.equal(cache.get(cells1, goalConfig), "data1"); // still present (was promoted)
  assert.equal(cache.get(cells2, goalConfig), null);     // evicted
  assert.equal(cache.get(cells3, goalConfig), "data3");
});

test("SubproblemCache stats reports entries and hits", () => {
  const cache = new SubproblemCache(100);
  const cells = ["0,0", "0,1"];
  const goalConfig = ["0,1"];

  let stats = cache.stats();
  assert.equal(stats.entries, 0);
  assert.equal(stats.totalHits, 0);
  assert.equal(stats.maxEntries, 100);

  cache.set(cells, goalConfig, "data");
  stats = cache.stats();
  assert.equal(stats.entries, 1);
  assert.equal(stats.totalHits, 0);

  cache.get(cells, goalConfig);
  cache.get(cells, goalConfig);
  stats = cache.stats();
  assert.equal(stats.entries, 1);
  assert.equal(stats.totalHits, 2);
});

test("SubproblemCache clear removes all entries", () => {
  const cache = new SubproblemCache(100);
  cache.set(["0,0"], ["0,0"], "d1");
  cache.set(["1,0"], ["1,0"], "d2");
  assert.equal(cache.stats().entries, 2);

  cache.clear();
  assert.equal(cache.stats().entries, 0);
  assert.equal(cache.get(["0,0"], ["0,0"]), null);
});

test("SubproblemCache uses geometric hash so rotated rooms share entries", () => {
  const cache = new SubproblemCache(100);
  const original = ["0,0", "0,1", "1,0", "1,1", "2,0", "2,1"];
  const rotated = ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2"];
  const goalConfig = ["0,0"];

  cache.set(original, goalConfig, "shared-data");
  // The rotated version should share the same geometric hash
  assert.equal(cache.get(rotated, goalConfig), "shared-data");
});

test("SubproblemCache distinguishes different goal configs for same geometry", () => {
  const cache = new SubproblemCache(100);
  const cells = ["0,0", "0,1", "1,0"];

  cache.set(cells, ["0,0"], "config-a");
  cache.set(cells, ["0,1"], "config-b");

  assert.equal(cache.get(cells, ["0,0"]), "config-a");
  assert.equal(cache.get(cells, ["0,1"]), "config-b");
});

// --- PersistentSubproblemCache tests ---

test("PersistentSubproblemCache inherits from SubproblemCache", () => {
  const cache = new PersistentSubproblemCache("test-db", 500);
  assert.ok(cache instanceof SubproblemCache);
  assert.equal(cache.maxEntries, 500);
  assert.equal(cache.dbName, "test-db");
  assert.equal(cache.dbReady, false);
});

test("PersistentSubproblemCache in-memory operations work without IndexedDB", () => {
  const cache = new PersistentSubproblemCache();
  const cells = ["0,0", "1,0"];
  const goalConfig = ["1,0"];

  cache.set(cells, goalConfig, "test-data");
  assert.equal(cache.get(cells, goalConfig), "test-data");
});

test("PersistentSubproblemCache open returns false without IndexedDB", async () => {
  const cache = new PersistentSubproblemCache();
  const result = await cache.open();
  assert.equal(result, false);
  assert.equal(cache.dbReady, false);
});

test("PersistentSubproblemCache persistGet falls back to memory", async () => {
  const cache = new PersistentSubproblemCache();
  const cells = ["0,0"];
  const goalConfig = ["0,0"];

  cache.set(cells, goalConfig, "mem-data");
  const result = await cache.persistGet(cells, goalConfig);
  assert.equal(result, "mem-data");
});

test("PersistentSubproblemCache persistGet returns null for missing entries", async () => {
  const cache = new PersistentSubproblemCache();
  const result = await cache.persistGet(["0,0"], ["0,0"]);
  assert.equal(result, null);
});
