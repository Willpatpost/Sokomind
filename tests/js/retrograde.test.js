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

test("buildRetrogradeTable returns expected structure", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[2, 2, "A"]];

  const result = engine.buildRetrogradeTable(board, initialBoxes, 4, 1000);

  assert.ok(typeof result.table.get === "function", "table should be a Map");
  assert.ok(typeof result.lookup === "function", "lookup should be a function");
  assert.ok(typeof result.size === "number", "size should be a number");
  assert.ok(typeof result.maxDepthReached === "number");
});

test("buildRetrogradeTable populates table from goal state", () => {
  const engine = loadEngine();
  // Simple puzzle: one box, one goal
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[2, 2, "A"]];

  const result = engine.buildRetrogradeTable(board, initialBoxes, 4, 1000);

  // The table should have at least one entry (the goal state itself)
  assert.ok(result.size >= 1, "table should have at least the goal state");
  assert.ok(result.maxDepthReached >= 0);
});

test("buildRetrogradeTable respects maxDepth limit", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "O R   O",
    "O A   O",
    "O   a O",
    "O     O",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[2, 2, "A"]];

  const shallow = engine.buildRetrogradeTable(board, initialBoxes, 1, 50000);
  const deep = engine.buildRetrogradeTable(board, initialBoxes, 6, 50000);

  assert.ok(deep.size >= shallow.size,
    "deeper search should find at least as many states");
  assert.ok(shallow.maxDepthReached <= 1,
    "shallow search should not exceed depth 1");
});

test("buildRetrogradeTable respects maxStates limit", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "O R   O",
    "O A   O",
    "O   a O",
    "O     O",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[2, 2, "A"]];

  const limited = engine.buildRetrogradeTable(board, initialBoxes, 10, 5);

  assert.ok(limited.size <= 5, "should not exceed maxStates limit");
});

test("buildRetrogradeTable lookup returns undefined for unknown state", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[2, 2, "A"]];

  const result = engine.buildRetrogradeTable(board, initialBoxes, 2, 1000);

  // Look up a nonsensical signature
  assert.equal(result.lookup("nonexistent-state"), undefined);
});

test("buildRetrogradeTable handles puzzle with no goals gracefully", () => {
  const engine = loadEngine();
  // Create a board manually without goals
  const rows = [
    "OOOOO",
    "O R O",
    "O   O",
    "O   O",
    "OOOOO",
  ];
  // Parse without goals - this puzzle has no boxes/goals
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [];

  const result = engine.buildRetrogradeTable(board, initialBoxes, 4, 1000);
  assert.equal(result.size, 0, "empty puzzle should produce empty table");
});

test("buildRetrogradeTable with default parameters", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[2, 2, "A"]];

  // Call without optional parameters
  const result = engine.buildRetrogradeTable(board, initialBoxes);
  assert.ok(typeof result.table.get === "function");
  assert.ok(result.size >= 1);
});

test("buildRetrogradeTable goal state entry has depth 0", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[2, 2, "A"]];

  const result = engine.buildRetrogradeTable(board, initialBoxes, 4, 1000);

  // Find a depth-0 entry
  let hasDepthZero = false;
  for (const [, entry] of result.table) {
    if (entry.depth === 0) {
      hasDepthZero = true;
      break;
    }
  }
  assert.ok(hasDepthZero, "table should contain at least one depth-0 entry (goal state)");
});

test("buildRetrogradeTable works with labeled boxes", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "OaRAbAO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const initialBoxes = [[1, 3, "A"], [1, 4, "B"]];

  const result = engine.buildRetrogradeTable(board, initialBoxes, 3, 500);
  assert.ok(typeof result.table.get === "function");
  assert.ok(typeof result.size === "number");
});
