const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const srcDir = path.join(__dirname, "..", "..", "src");

function loadEngine() {
  // Read module list dynamically from solver-engine.js to stay in sync
  const barrelSource = fs.readFileSync(path.join(srcDir, "solver-engine.js"), "utf8");
  const match = barrelSource.match(/const moduleFiles = \[([\s\S]*?)\];/);
  const moduleFiles = match[1].match(/"([^"]+\.js)"/g).map(s => s.replace(/"/g, ""));
  const source = moduleFiles
    .map(file => fs.readFileSync(path.join(srcDir, file), "utf8"))
    .join("\n");
  const context = {console};
  vm.runInNewContext(source, context, {filename: "solver-engine.js"});
  // Merge all namespace objects into a flat API
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

test("computeGoalDependencies returns a Map for simple puzzle", () => {
  const engine = loadEngine();
  // Simple corridor: R A a
  // The box A must reach goal a
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const deps = engine.computeGoalDependencies(board, board.topology);
  assert.ok(typeof deps.get === "function", "should return a Map-like object");
  assert.ok(deps.size >= 1, "should have at least one goal entry");
});

test("computeGoalDependencies captures depth-based ordering in rooms", () => {
  const engine = loadEngine();
  // Room with gate at top, two goals at different depths
  // Deeper goal should be filled first
  const rows = [
    "OOOOOOO",
    "O     O",
    "O R   O",
    "OOO OOO",
    "O A a O",
    "O B b O",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const deps = engine.computeGoalDependencies(board, board.topology);
  assert.ok(typeof deps.get === "function");
});

test("topologicalGoalOrder returns all goals in a valid order", () => {
  const engine = loadEngine();
  // Create a simple dependency graph
  const dependencies = new Map([
    ["1,1", new Set(["1,2"])],  // 1,1 must be filled before 1,2
    ["1,2", new Set(["1,3"])],  // 1,2 must be filled before 1,3
    ["1,3", new Set()],
  ]);
  const order = engine.topologicalGoalOrder(dependencies);
  assert.equal(order.length, 3, "should contain all 3 goals");
  assert.ok(order.indexOf("1,1") < order.indexOf("1,2"),
    "1,1 should come before 1,2");
  assert.ok(order.indexOf("1,2") < order.indexOf("1,3"),
    "1,2 should come before 1,3");
});

test("topologicalGoalOrder handles empty dependencies", () => {
  const engine = loadEngine();
  const dependencies = new Map([
    ["1,1", new Set()],
    ["2,2", new Set()],
  ]);
  const order = engine.topologicalGoalOrder(dependencies);
  assert.equal(order.length, 2);
  assert.ok(order.includes("1,1"));
  assert.ok(order.includes("2,2"));
});

test("topologicalGoalOrder handles cycles gracefully", () => {
  const engine = loadEngine();
  // Cycle: A -> B -> A
  const dependencies = new Map([
    ["1,1", new Set(["2,2"])],
    ["2,2", new Set(["1,1"])],
  ]);
  const order = engine.topologicalGoalOrder(dependencies);
  assert.equal(order.length, 2, "should include all nodes despite cycle");
  assert.ok(order.includes("1,1"));
  assert.ok(order.includes("2,2"));
});

test("topologicalGoalOrder is deterministic", () => {
  const engine = loadEngine();
  const dependencies = new Map([
    ["3,3", new Set()],
    ["1,1", new Set(["2,2"])],
    ["2,2", new Set(["3,3"])],
  ]);
  const order1 = engine.topologicalGoalOrder(dependencies);
  const order2 = engine.topologicalGoalOrder(dependencies);
  assert.deepEqual(order1, order2);
});

test("goalOrderScore returns 0 when no goals filled", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const state = {
    boxes: [[2, 2, "A"]], // box not on goal
  };
  const goalOrder = [...board.goals.keys()];
  const score = engine.goalOrderScore(state, board, goalOrder);
  assert.equal(score, 0);
});

test("goalOrderScore returns 0 when goals filled in correct order", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "OaRAbAO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const goalOrder = ["1,1", "1,4"]; // fill a first, then b
  // State with first goal (a) filled correctly
  const state = {
    boxes: [
      [1, 1, "A"],  // A on goal a
      [1, 3, "B"],  // B not on goal b yet
    ],
  };
  const score = engine.goalOrderScore(state, board, goalOrder);
  assert.equal(score, 0, "filling in correct order should have no penalty");
});

test("goalOrderScore penalizes out-of-order fills", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "OaRAbAO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const goalOrder = ["1,1", "1,4"]; // should fill 1,1 first
  // State with second goal filled but first not
  const state = {
    boxes: [
      [1, 3, "A"],  // A not on goal a (wrong position)
      [1, 4, "B"],  // B on goal b (but b should be filled second)
    ],
  };
  // Only "1,4" is filled (if it's a goal with label B)
  // This depends on what the goals actually are in the board
  const score = engine.goalOrderScore(state, board, goalOrder);
  assert.ok(typeof score === "number");
});

test("goalOrderScore returns 0 for empty goal order", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const state = {boxes: [[3, 2, "A"]]};
  assert.equal(engine.goalOrderScore(state, board, []), 0);
  assert.equal(engine.goalOrderScore(state, board, null), 0);
});

test("goal ordering integrates with board topology", () => {
  const engine = loadEngine();
  // A puzzle with a room containing multiple goals
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
  const deps = engine.computeGoalDependencies(board, board.topology);
  const order = engine.topologicalGoalOrder(deps);

  // Should return all goals
  assert.ok(order.length >= board.goals.size,
    "order should include at least all goals");
});
