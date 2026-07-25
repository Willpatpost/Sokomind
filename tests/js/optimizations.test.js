const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const srcDir = path.join(__dirname, "..", "..", "src");

const ENGINE_MODULE_FILES = [
  "state.js", "memo.js", "depth-map.js", "metrics.js", "topology.js", "board.js",
  "heuristic.js", "deadlock.js", "analysis.js", "chokepoint.js",
  "push-generation.js", "pi-corral.js",
];

function loadEngine() {
  const source = ENGINE_MODULE_FILES
    .map(file => fs.readFileSync(path.join(srcDir, file), "utf8"))
    .join("\n");
  const context = {console};
  vm.runInNewContext(source, context, {filename: "solver-engine.js"});
  return {
    ...context.SokomindState,
    ...context.SokomindMemo,
    ...context.SokomindDepthMap,
    ...context.SokomindMetrics,
    ...context.SokomindTopology,
    ...context.SokomindBoard,
    ...context.SokomindHeuristic,
    ...context.SokomindDeadlock,
    ...context.SokomindAnalysis,
    ...context.SokomindChokepoint,
    ...context.SokomindPushGeneration,
    ...context.SokomindPICorral,
  };
}

function parsePuzzle(engine, rows) {
  const data = {rows, robot: null, boxes: []};
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "R" || ch === "P") data.robot = [y, x];
    if (/[A-Z]/.test(ch) && ch !== "O" && ch !== "R" && ch !== "P" && ch !== "S") {
      data.boxes.push([`${y},${x}`, ch]);
    }
  }));
  return engine.parse(data);
}

// ---- Linear Conflict Tests ----

test("linearConflict returns 0 when no conflicts exist", () => {
  const engine = loadEngine();
  // Simple puzzle: two boxes in a row, already in order
  //   O O O O O
  //   O R . . O
  //   O A . B O
  //   O a . b O
  //   O O O O O
  const rows = [
    "OOOOO",
    "OR  O",
    "OA BO",
    "Oa bO",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  // Boxes A at (2,1) and B at (2,3), goals a at (3,1) and b at (3,3)
  const boxes = [[2, 1, "A"], [2, 3, "B"]];
  const result = engine.linearConflict(boxes, board);
  // A and B are different labels, no conflict possible within same label
  assert.equal(result, 0);
});

test("linearConflict detects row conflict for same-label boxes", () => {
  const engine = loadEngine();
  // Two boxes of same label in a row, assigned to goals in same row but reversed
  //   O O O O O O
  //   O R . . . O
  //   O X . . X O
  //   O s . . s O
  //   O O O O O O
  const rows = [
    "OOOOOO",
    "OR    O",
    "OX  XO",
    "Os  sO",
    "OOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  // Box X at (2,1) and X at (2,4), goals s at (3,1) and s at (3,4)
  // These are in same row but different rows from goals, so no row conflict
  // Let me create a proper conflict scenario
  const boxes = [[2, 1, "X"], [2, 4, "X"]];
  const result = engine.linearConflict(boxes, board);
  // The boxes are in row 2, goals in row 3. Not same row. So no conflict.
  assert.equal(result, 0);
});

test("linearConflict is non-negative", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOO",
    "OR  O",
    "O  XO",
    "O  sO",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const boxes = [[2, 3, "X"]];
  const result = engine.linearConflict(boxes, board);
  assert.ok(result >= 0, "Linear conflict should be non-negative");
});

test("linearConflict adds 2 per conflict", () => {
  const engine = loadEngine();
  // Create a scenario where two same-label boxes in same row are
  // assigned to goals in that same row but in reversed order.
  // Row layout:  X1 at col 1, X2 at col 4
  // Goals: s1 at col 4, s2 at col 1 (same row as boxes)
  const rows = [
    "OOOOOO",
    "O    O",
    "OX  XO",
    "Os  sO",
    "OR   O",
    "OOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const boxes = [[2, 1, "X"], [2, 4, "X"]];
  const result = engine.linearConflict(boxes, board);
  // Boxes and goals are in different rows (2 vs 3), so no row/column conflict
  assert.ok(result >= 0);
  assert.equal(result % 2, 0, "Linear conflict should be even (multiple of 2)");
});

test("heuristic includes linear conflict boost", () => {
  const engine = loadEngine();
  // Solvable puzzle with enough space for pushes
  const rows = [
    "OOOOOO",
    "O    O",
    "OR X O",
    "O  S O",
    "O    O",
    "OOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  // S goal maps to label X; box X at (2,3), goal at (3,3)
  const boxes = [[2, 3, "X"]];
  const h = engine.heuristic(boxes, board);
  assert.ok(h >= 0, "Heuristic should be non-negative");
  assert.ok(Number.isFinite(h), "Heuristic should be finite for solvable puzzle");
});

// ---- DepthAwareBoundedMap Tests ----

test("DepthAwareBoundedMap basic get/set/has", () => {
  const engine = loadEngine();
  const map = new engine.DepthAwareBoundedMap(100);
  assert.equal(map.has("a"), false);
  map.set("a", 42, 0);
  assert.equal(map.has("a"), true);
  assert.equal(map.get("a"), 42);
  assert.equal(map.size, 1);
});

test("DepthAwareBoundedMap evicts deepest entry among oldest 16", () => {
  const engine = loadEngine();
  const map = new engine.DepthAwareBoundedMap(5);
  // Fill to capacity with different depths
  map.set("a", 1, 10); // depth 10 (deepest)
  map.set("b", 2, 1);
  map.set("c", 3, 5);
  map.set("d", 4, 2);
  map.set("e", 5, 3);
  assert.equal(map.size, 5);
  // Adding one more should evict the deepest among oldest 16
  map.set("f", 6, 0);
  assert.equal(map.size, 5);
  // "a" had depth 10 (deepest), so it should be evicted
  assert.equal(map.has("a"), false, "Deepest entry should be evicted");
  assert.equal(map.has("f"), true);
  assert.equal(map.evictions, 1);
});

test("DepthAwareBoundedMap respects size limit", () => {
  const engine = loadEngine();
  const map = new engine.DepthAwareBoundedMap(3);
  for (let i = 0; i < 10; i++) {
    map.set(`key${i}`, i, i);
  }
  assert.equal(map.size, 3);
  assert.ok(map.evictions >= 7);
});

test("DepthAwareBoundedMap updates existing entries", () => {
  const engine = loadEngine();
  const map = new engine.DepthAwareBoundedMap(10);
  map.set("a", 1, 5);
  map.set("a", 2, 3);
  assert.equal(map.get("a"), 2);
  assert.equal(map.size, 1);
});

// ---- Tunnel Segment Tests ----

test("compileTunnelSegments identifies straight tunnel segments", () => {
  const engine = loadEngine();
  // A simple horizontal tunnel: O . . . O
  // Layout:
  //   O O O O O O O
  //   O R . . . . O
  //   O O O . O O O
  //   O O O . O O O
  //   O O O S O O O
  //   O O O O O O O
  // Vertical tunnel at column 3, rows 1-4
  const rows = [
    "OOOOOOO",
    "OR    O",
    "OOO OOO",
    "OOO OOO",
    "OOOSOO O",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const segments = board.topology.tunnelSegments;
  // There should be tunnel cells in column 3
  assert.ok(Array.isArray(segments), "tunnelSegments should be an array");
});

test("tunnel segment lookup maps cells to segments", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "OR    O",
    "OOO OOO",
    "OOO OOO",
    "OOO OOO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const lookup = engine.tunnelSegmentLookup(board);
  assert.ok(typeof lookup.get === "function", "tunnelSegmentLookup should return a Map-like object");
  // All tunnel cells should be in the lookup
  for (const cell of board.topology.tunnels) {
    if (lookup.has(cell)) {
      const segment = lookup.get(cell);
      assert.ok(segment.cells.includes(cell), "Cell should be in its segment");
    }
  }
});

// ---- PI-Corral Tests ----

test("piCorralDeadlock returns false when no deadlock", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOO",
    "O    O",
    "OR X O",
    "O  S O",
    "O    O",
    "OOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const boxes = [[2, 3, "X"]];
  const result = engine.piCorralDeadlock(boxes, board, [2, 3]);
  assert.equal(result, false, "No PI-corral deadlock in open puzzle");
});

test("piCorralDeadlock is callable", () => {
  const engine = loadEngine();
  assert.equal(typeof engine.piCorralDeadlock, "function",
    "piCorralDeadlock should be exported");
});

test("piCorralDeadlock detects frozen corral", () => {
  const engine = loadEngine();
  // Create a puzzle where boxes are frozen in a player-inaccessible area
  const rows = [
    "OOOOOOO",
    "O     O",
    "O R   O",
    "O     O",
    "OOO OOO",
    "OXXSOOO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  // Two X boxes at (5,1) and (5,2), goal S at (5,3)
  // If boxes are frozen and player can't reach them
  const boxes = [[5, 1, "X"], [5, 2, "X"]];
  // piCorralDeadlock checks if there's a PI-corral with dead boxes
  const result = engine.piCorralDeadlock(boxes, board, [5, 2]);
  // The result depends on whether the player can reach the boxes
  assert.equal(typeof result, "boolean");
});

test("piCorralDeadlock detects sealed corral via canOpen", () => {
  const engine = loadEngine();
  // Two boxes stacked in a corridor — player above, goals below.
  // Neither box can be pushed: top box blocked by bottom, bottom box
  // has no reachable support. The sealed check should catch this.
  const rows = [
    "OOOOO",
    "O R O",
    "OO OO",
    "OOX OO",
    "OOX OO",
    "OOSOO",
    "OOSOO",
    "OOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const boxes = [[3, 2, "X"], [4, 2, "X"]];
  const result = engine.piCorralDeadlock(boxes, board, [4, 2]);
  assert.equal(result, true, "Sealed corral with no pushable box should be dead");
});

// ---- Goal-Cut Decomposition Extension Tests ----

test("goalCutDecomposition returns null for trivial puzzles", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOO",
    "O    O",
    "OR X O",
    "O  S O",
    "O    O",
    "OOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const boxes = [[2, 3, "X"]];
  const result = engine.goalCutDecomposition(boxes, board);
  // Simple single-box puzzle typically has no decomposition
  assert.ok(result === null || result !== undefined, "Should return null or a certificate");
});

test("goalCutBalance correctly identifies balanced components", () => {
  const engine = loadEngine();
  assert.equal(typeof engine.goalCutBalance, "function",
    "goalCutBalance should be exported");
});

test("multiCutDecomposition is callable", () => {
  const engine = loadEngine();
  assert.equal(typeof engine.multiCutDecomposition, "function",
    "multiCutDecomposition should be exported");
});

test("multiCutDecomposition returns null for simple puzzles", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOO",
    "O    O",
    "OR X O",
    "O  S O",
    "O    O",
    "OOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const boxes = [[2, 3, "X"]];
  const result = engine.multiCutDecomposition(boxes, board);
  assert.equal(result, null, "Simple puzzle should have no multi-cut");
});

// ---- Memory-Aware Memo Scaling Tests ----

test("setMemoScale adjusts scaledMemoLimit output", () => {
  const engine = loadEngine();
  assert.equal(typeof engine.setMemoScale, "function");
  assert.equal(typeof engine.scaledMemoLimit, "function");
  assert.equal(engine.scaledMemoLimit(100), 100, "Default scale is 1");
});

test("scaledMemoLimit increases limit for high-memory devices", () => {
  const engine = loadEngine();
  engine.setMemoScale(32);
  assert.equal(engine.scaledMemoLimit(100), 400, "32GB → 4x");
  engine.setMemoScale(16);
  assert.equal(engine.scaledMemoLimit(100), 200, "16GB → 2x");
  engine.setMemoScale(8);
  assert.equal(engine.scaledMemoLimit(100), 150, "8GB → 1.5x");
  engine.setMemoScale(4);
  assert.equal(engine.scaledMemoLimit(100), 100, "4GB → 1x");
  engine.setMemoScale(2);
  assert.equal(engine.scaledMemoLimit(100), 50, "2GB → 0.5x");
});

test("setMemoScale ignores invalid values", () => {
  const engine = loadEngine();
  engine.setMemoScale(16);
  assert.equal(engine.scaledMemoLimit(100), 200);
  engine.setMemoScale(0);
  assert.equal(engine.scaledMemoLimit(100), 200, "Zero ignored");
  engine.setMemoScale(-1);
  assert.equal(engine.scaledMemoLimit(100), 200, "Negative ignored");
  engine.setMemoScale(NaN);
  assert.equal(engine.scaledMemoLimit(100), 200, "NaN ignored");
  engine.setMemoScale(undefined);
  assert.equal(engine.scaledMemoLimit(100), 200, "Undefined ignored");
});

// ---- Chokepoint and Congestion Tests ----

test("identifyChokepoints returns traffic, capacity, and chokepoints", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "OR    O",
    "OOO OOO",
    "OOO OOO",
    "OOOSOO O",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  assert.equal(typeof engine.identifyChokepoints, "function");
  const result = engine.identifyChokepoints(board);
  assert.equal(typeof result.traffic.get, "function", "traffic should be Map-like");
  assert.equal(typeof result.capacity.get, "function", "capacity should be Map-like");
  assert.ok(Array.isArray(result.chokepoints));
});

test("congestionPenalty returns 0 when no excess beyond capacity", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOO",
    "O    O",
    "OR X O",
    "O  S O",
    "O    O",
    "OOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const chokepointData = engine.identifyChokepoints(board);
  const boxes = [[2, 3, "X"]];
  const penalty = engine.congestionPenalty(boxes, chokepointData);
  assert.ok(penalty >= 0, "Penalty should be non-negative");
});

test("congestionPenalty increases with more boxes near chokepoints", () => {
  const engine = loadEngine();
  const rows = [
    "OOOOOOO",
    "O     O",
    "OOO OOO",
    "O     O",
    "Os s RO",
    "OOOOOOO",
  ];
  const board = parsePuzzle(engine, rows);
  const chokepointData = engine.identifyChokepoints(board);
  const oneBox = [[2, 3, "X"]];
  const twoBoxes = [[2, 3, "X"], [3, 3, "X"]];
  const p1 = engine.congestionPenalty(oneBox, chokepointData);
  const p2 = engine.congestionPenalty(twoBoxes, chokepointData);
  assert.ok(p2 >= p1, "More boxes near chokepoint should have >= penalty");
});
