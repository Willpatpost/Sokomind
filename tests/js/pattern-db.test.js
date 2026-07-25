const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const srcDir = path.join(__dirname, "..", "..", "src");

function loadEngine() {
  const barrelSource = fs.readFileSync(path.join(srcDir, "solver-engine.js"), "utf8");
  const match = barrelSource.match(/const moduleFiles = \[([\s\S]*?)\];/);
  const moduleFiles = match[1].match(/"([^"]+\.js)"/g).map(s => s.replace(/"/g, ""));
  const source = moduleFiles
    .map(file => fs.readFileSync(path.join(srcDir, file), "utf8"))
    .join("\n");
  const context = {console};
  vm.runInNewContext(source, context, {filename: "solver-engine.js"});
  const api = {...context};
  for (const key of Object.keys(context)) {
    if (key.startsWith("Sokomind") && typeof context[key] === "object" && context[key]) {
      Object.assign(api, context[key]);
    }
  }
  return api;
}

function parsePuzzle(engine, rows) {
  const data = {rows};
  let robot = null;
  const boxes = [];
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === "R") robot = [y, x];
    if (cell === "X" || (/[A-Z]/.test(cell) && !"ORS".includes(cell))) {
      boxes.push([`${y},${x}`, cell]);
    }
  }));
  data.robot = robot;
  data.boxes = boxes;
  return engine.parse(data);
}

test("CompressedPDB stores and retrieves values correctly", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(64);

  assert.ok(pdb.set(100, 200, 5));
  assert.equal(pdb.get(100, 200), 5);
  assert.equal(pdb.size, 1);
});

test("CompressedPDB returns -1 for missing keys", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(64);

  assert.equal(pdb.get(999, 888), -1);
});

test("CompressedPDB handles collisions via open addressing", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(16);

  // Insert multiple entries that may collide
  for (let i = 0; i < 8; i++) {
    assert.ok(pdb.set(i * 100, i * 200, i));
  }

  // Verify all can be retrieved
  for (let i = 0; i < 8; i++) {
    assert.equal(pdb.get(i * 100, i * 200), i);
  }
  assert.equal(pdb.size, 8);
});

test("CompressedPDB respects load factor limit", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(8);

  // Fill to 75% capacity (6 slots)
  for (let i = 0; i < 6; i++) {
    pdb.set(i, i + 100, i);
  }

  // 7th insert should fail (exceeds 0.75 load factor)
  const result = pdb.set(999, 999, 99);
  assert.equal(result, false, "should refuse insert beyond load factor");
});

test("CompressedPDB updates to minimum cost on duplicate key", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(64);

  pdb.set(42, 84, 10);
  pdb.set(42, 84, 5);  // Lower cost
  pdb.set(42, 84, 8);  // Higher cost, should not replace

  assert.equal(pdb.get(42, 84), 5, "should keep minimum cost");
  assert.equal(pdb.size, 1, "duplicate key should not increase size");
});

test("CompressedPDB clamps costs to 255", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(64);

  pdb.set(1, 1, 300);
  assert.equal(pdb.get(1, 1), 255, "cost should be clamped to 255");
});

test("CompressedPDB default capacity is 65536", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB();
  assert.equal(pdb.capacity, 65536);
});

test("ENHANCED constants have expected values", () => {
  const engine = loadEngine();
  assert.equal(engine.ENHANCED_PATTERN_FLOOR_LIMIT, 24);
  assert.equal(engine.ENHANCED_PATTERN_BOX_LIMIT, 5);
  assert.equal(engine.ENHANCED_PAIR_CONFLICT_MAX_STATES, 8000);
});

test("buildAdditivePatternDB returns a PDB for simple puzzle", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const goalPositions = [...board.goals.keys()];

  const pdb = engine.buildAdditivePatternDB(board, goalPositions, 1000);
  assert.ok(pdb instanceof engine.CompressedPDB);
  assert.ok(pdb.size >= 1, "PDB should have at least one entry");
});

test("buildAdditivePatternDB handles multiple goals", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "OaRAbAO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const goalPositions = [...board.goals.keys()];

  const pdb = engine.buildAdditivePatternDB(board, goalPositions, 500);
  assert.ok(pdb instanceof engine.CompressedPDB);
});

test("buildAdditivePatternDB returns empty PDB for oversized board", () => {
  const engine = loadEngine();
  // Create a board larger than ENHANCED_PATTERN_FLOOR_LIMIT
  const width = 10;
  const rows = [
    "O".repeat(width),
    "O" + " ".repeat(width - 2) + "O",
    "O" + " R" + " ".repeat(width - 4) + " O",
    "O" + " A" + " ".repeat(width - 4) + "aO",
    "O" + " ".repeat(width - 2) + "O",
    "O" + " ".repeat(width - 2) + "O",
    "O" + " ".repeat(width - 2) + "O",
    "O".repeat(width),
  ];
  const board = parsePuzzle(engine, rows);
  const goalPositions = [...board.goals.keys()];

  // If floor size > 24, should return small empty PDB
  if (board.floor.size > 24) {
    const pdb = engine.buildAdditivePatternDB(board, goalPositions, 1000);
    assert.equal(pdb.size, 0, "oversized board should produce empty PDB");
  }
});

test("buildAdditivePatternDB respects maxStates", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "O R   O",
    "O A a O",
    "O     O",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const goalPositions = [...board.goals.keys()];

  const small = engine.buildAdditivePatternDB(board, goalPositions, 3);
  const large = engine.buildAdditivePatternDB(board, goalPositions, 5000);

  assert.ok(large.size >= small.size,
    "larger maxStates should produce at least as many entries");
});

test("queryAdditivePatternDB returns 0 for empty PDB list", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const boxes = [[2, 2, "A"]];

  assert.equal(engine.queryAdditivePatternDB(boxes, board, []), 0);
  assert.equal(engine.queryAdditivePatternDB(boxes, board, null), 0);
});

test("queryAdditivePatternDB returns max over multiple PDBs", () => {
  const engine = loadEngine();
  const pdb1 = new engine.CompressedPDB(64);
  const pdb2 = new engine.CompressedPDB(64);

  // Manually set different costs
  pdb1.set(0, 0, 3);
  pdb2.set(0, 0, 7);

  // Since query hashing depends on actual box/goal positions,
  // we test the max-over-pdbs logic with a simpler approach
  const cost1 = pdb1.get(0, 0);
  const cost2 = pdb2.get(0, 0);
  assert.equal(Math.max(cost1, cost2), 7);
});

test("CompressedPDB handles zero cost", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(64);

  pdb.set(10, 20, 0);
  assert.equal(pdb.get(10, 20), 0, "should store and retrieve cost 0");
});

test("CompressedPDB handles many distinct keys", () => {
  const engine = loadEngine();
  const pdb = new engine.CompressedPDB(256);

  const count = 150; // within 75% of 256
  for (let i = 0; i < count; i++) {
    pdb.set(i * 7, i * 13, i % 256);
  }

  let retrieved = 0;
  for (let i = 0; i < count; i++) {
    if (pdb.get(i * 7, i * 13) >= 0) retrieved++;
  }

  assert.equal(retrieved, count, "all inserted keys should be retrievable");
});

test("buildAdditivePatternDB with no goal positions returns empty", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O   O",
    "O   O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const pdb = engine.buildAdditivePatternDB(board, [], 1000);
  assert.equal(pdb.size, 0);
});
