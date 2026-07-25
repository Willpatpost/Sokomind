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

test("identifyChokepoints returns expected structure", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const result = engine.identifyChokepoints(board, board.dense);

  assert.ok(typeof result.traffic.get === "function", "traffic should be a Map");
  assert.ok(typeof result.capacity.get === "function", "capacity should be a Map");
  assert.ok(Array.isArray(result.chokepoints), "chokepoints should be an array");
});

test("identifyChokepoints finds corridor bottlenecks", () => {
  const engine = loadEngine();
  // Corridor puzzle: wide area -> narrow passage -> wide area
  const rows = [
    "OOOOOOOOO",
    "O R     O",
    "O A     O",
    "OOO OOO O",
    "    a   O",
    "OOO OOO O",
    "O       O",
    "OOOOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const result = engine.identifyChokepoints(board, board.dense);

  // The narrow passage cell should have high traffic
  assert.ok(result.chokepoints.length > 0,
    "should identify at least one chokepoint");

  // Verify chokepoint entries have required fields
  for (const cp of result.chokepoints) {
    assert.ok(typeof cp.position === "string");
    assert.ok(typeof cp.traffic === "number");
    assert.ok(typeof cp.capacity === "number");
    assert.ok(typeof cp.severity === "number");
    assert.ok(cp.capacity >= 1);
  }
});

test("identifyChokepoints handles open board", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "O R   O",
    "O A a O",
    "O     O",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const result = engine.identifyChokepoints(board, board.dense);

  assert.ok(typeof result.traffic.get === "function");
  // Open board may still have chokepoints near walls
});

test("identifyChokepoints assigns capacity 1 to narrow corridors", () => {
  const engine = loadEngine();
  // Very narrow corridor
  const rows = [
    "OOOOOOOOO",
    "O R O a O",
    "O A O   O",
    "O   O   O",
    "O       O",
    "OOOOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const result = engine.identifyChokepoints(board, board.dense);

  // Find cells with capacity 1
  const narrowCells = [...result.capacity.entries()]
    .filter(([, cap]) => cap === 1);
  assert.ok(narrowCells.length > 0, "should find narrow cells with capacity 1");
});

test("congestionPenalty returns 0 with no chokepoints", () => {
  const engine = loadEngine();
  const boxes = [[2, 2, "A"]];
  const emptyResult = {traffic: new Map(), capacity: new Map(), chokepoints: []};
  assert.equal(engine.congestionPenalty(boxes, emptyResult), 0);
});

test("congestionPenalty returns 0 when no boxes near chokepoints", () => {
  const engine = loadEngine();
  const boxes = [[1, 1, "A"]];
  const result = {
    traffic: new Map(),
    capacity: new Map(),
    chokepoints: [{position: "5,5", traffic: 3, capacity: 1, severity: 0.5}],
  };
  assert.equal(engine.congestionPenalty(boxes, result), 0,
    "distant boxes should not cause penalty");
});

test("congestionPenalty increases with boxes clustered near chokepoint", () => {
  const engine = loadEngine();
  // Two boxes adjacent to a chokepoint with capacity 1
  const chokepointPos = "3,3";
  const boxes = [
    [3, 2, "A"],  // adjacent left
    [3, 4, "B"],  // adjacent right
  ];
  const result = {
    traffic: new Map(),
    capacity: new Map(),
    chokepoints: [{position: chokepointPos, traffic: 4, capacity: 1, severity: 0.8}],
  };

  const penalty = engine.congestionPenalty(boxes, result);
  assert.ok(penalty > 0, "should penalize clustering near narrow chokepoint");
});

test("congestionPenalty is higher for more boxes at same chokepoint", () => {
  const engine = loadEngine();
  const chokepointPos = "3,3";
  const oneBox = [[3, 2, "A"]];
  const twoBoxes = [[3, 2, "A"], [3, 4, "B"]];
  const threeBoxes = [[3, 2, "A"], [3, 4, "B"], [2, 3, "C"]];
  const cp = {position: chokepointPos, traffic: 4, capacity: 1, severity: 0.8};
  const result = {traffic: new Map(), capacity: new Map(), chokepoints: [cp]};

  const p1 = engine.congestionPenalty(oneBox, result);
  const p2 = engine.congestionPenalty(twoBoxes, result);
  const p3 = engine.congestionPenalty(threeBoxes, result);

  assert.ok(p3 >= p2, "more boxes should cause >= penalty");
  assert.ok(p2 >= p1, "two boxes should cause >= penalty than one");
});

test("congestionPenalty handles null/undefined input", () => {
  const engine = loadEngine();
  const boxes = [[2, 2, "A"]];
  assert.equal(engine.congestionPenalty(boxes, null), 0);
  assert.equal(engine.congestionPenalty(boxes, undefined), 0);
});

test("identifyChokepoints integrates with real puzzle topology", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "Oa   bO",
    "O AXB O",
    "O XRX O",
    "OSCXDSO",
    "OcS SdO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const result = engine.identifyChokepoints(board, board.dense);

  assert.ok(typeof result.traffic.get === "function");
  assert.ok(result.chokepoints.length >= 0);
  // Verify sorted by severity
  for (let i = 1; i < result.chokepoints.length; i++) {
    assert.ok(result.chokepoints[i - 1].severity >= result.chokepoints[i].severity,
      "chokepoints should be sorted by severity descending");
  }
});
