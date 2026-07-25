const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyPuzzle,
  extractFeatures,
  determineProfile,
  recommendStrategy,
} = require("../../src/difficulty.js");

// Helper to create a minimal board-like object for testing
function makeBoard(goalMap, floorSet) {
  return {
    goals: goalMap || new Map(),
    floor: floorSet || new Set(),
  };
}

// Helper to create a minimal dense-like object
function makeDense(keys) {
  return { keys: keys || [] };
}

// Helper to create a minimal topology-like object
function makeTopology(opts = {}) {
  return {
    rooms: opts.rooms || [],
    tunnels: opts.tunnels || new Set(),
    articulations: opts.articulations || new Set(),
    goalAccess: opts.goalAccess || [],
  };
}

test("extractFeatures returns correct box count from goals map", () => {
  const goals = new Map([["1,1", "X"], ["2,2", "X"], ["3,3", "X"]]);
  const floor = new Set(["1,1", "2,2", "3,3", "1,2", "2,1", "3,2", "2,3"]);
  const features = extractFeatures(makeBoard(goals, floor), makeDense([...floor]), makeTopology());
  assert.equal(features.boxCount, 3);
  assert.equal(features.floorCellCount, 7);
  assert.ok(features.boxToFloorRatio > 0);
});

test("extractFeatures handles null/undefined inputs gracefully", () => {
  const features = extractFeatures({}, null, null);
  assert.equal(features.boxCount, 0);
  assert.equal(features.floorCellCount, 0);
  assert.equal(features.boxToFloorRatio, 0);
  assert.equal(features.roomCount, 0);
  assert.equal(features.tunnelCount, 0);
  assert.equal(features.corridorCount, 0);
  assert.equal(features.deadEndCount, 0);
  assert.equal(features.articulationPointCount, 0);
  assert.equal(features.labelCount, 0);
});

test("extractFeatures counts dead ends correctly", () => {
  // A simple corridor: 0,0 - 0,1 - 0,2
  // 0,0 and 0,2 are dead ends (1 neighbor each)
  const floor = new Set(["0,0", "0,1", "0,2"]);
  const features = extractFeatures(makeBoard(new Map(), floor), makeDense([...floor]), makeTopology());
  assert.equal(features.deadEndCount, 2);
});

test("extractFeatures counts tunnel segments as corridors", () => {
  // Two separate tunnel segments
  const tunnels = new Set(["1,1", "1,2", "1,3", "5,5", "5,6"]);
  const floor = new Set(["1,1", "1,2", "1,3", "5,5", "5,6", "0,0"]);
  const features = extractFeatures(
    makeBoard(new Map(), floor),
    makeDense([...floor]),
    makeTopology({ tunnels }),
  );
  assert.equal(features.tunnelCount, 5);
  assert.equal(features.corridorCount, 2);
});

test("extractFeatures counts distinct labels", () => {
  const goals = new Map([["1,1", "A"], ["2,2", "B"], ["3,3", "A"], ["4,4", "C"]]);
  const floor = new Set(["1,1", "2,2", "3,3", "4,4"]);
  const features = extractFeatures(makeBoard(goals, floor), makeDense([...floor]), makeTopology());
  assert.equal(features.labelCount, 3);
});

test("extractFeatures computes goal cluster tightness", () => {
  // Two goals at (0,0) and (0,4): Manhattan distance = 4
  const goals = new Map([["0,0", "X"], ["0,4", "X"]]);
  const floor = new Set(["0,0", "0,1", "0,2", "0,3", "0,4"]);
  const features = extractFeatures(makeBoard(goals, floor), makeDense([...floor]), makeTopology());
  assert.equal(features.goalClusterTightness, 4);
});

test("determineProfile classifies trivial puzzles with fewer than 4 boxes", () => {
  assert.equal(determineProfile({ boxCount: 2, floorCellCount: 20, tunnelCount: 0, roomCount: 0, articulationPointCount: 0, boxToFloorRatio: 0.1 }), "trivial");
  assert.equal(determineProfile({ boxCount: 3, floorCellCount: 20, tunnelCount: 0, roomCount: 0, articulationPointCount: 0, boxToFloorRatio: 0.15 }), "trivial");
});

test("determineProfile classifies mega puzzles", () => {
  assert.equal(determineProfile({ boxCount: 25, floorCellCount: 300, tunnelCount: 5, roomCount: 2, articulationPointCount: 1, boxToFloorRatio: 0.08 }), "mega");
  assert.equal(determineProfile({ boxCount: 10, floorCellCount: 250, tunnelCount: 5, roomCount: 2, articulationPointCount: 1, boxToFloorRatio: 0.04 }), "mega");
});

test("determineProfile classifies corridor puzzles", () => {
  // tunnelCount > roomCount * 2
  assert.equal(determineProfile({ boxCount: 5, floorCellCount: 50, tunnelCount: 10, roomCount: 2, articulationPointCount: 1, boxToFloorRatio: 0.1 }), "corridor");
});

test("determineProfile classifies room-based puzzles", () => {
  // roomCount > 3 && articulationPointCount > 2, but not corridor
  assert.equal(determineProfile({ boxCount: 8, floorCellCount: 80, tunnelCount: 2, roomCount: 5, articulationPointCount: 4, boxToFloorRatio: 0.1 }), "room-based");
});

test("determineProfile classifies open-field puzzles", () => {
  // boxToFloorRatio < 0.05
  assert.equal(determineProfile({ boxCount: 4, floorCellCount: 100, tunnelCount: 0, roomCount: 1, articulationPointCount: 0, boxToFloorRatio: 0.04 }), "open-field");
});

test("determineProfile classifies dense puzzles", () => {
  // boxToFloorRatio > 0.25
  assert.equal(determineProfile({ boxCount: 8, floorCellCount: 30, tunnelCount: 1, roomCount: 1, articulationPointCount: 1, boxToFloorRatio: 0.27 }), "dense");
});

test("determineProfile classifies medium puzzles", () => {
  assert.equal(determineProfile({ boxCount: 6, floorCellCount: 50, tunnelCount: 1, roomCount: 1, articulationPointCount: 1, boxToFloorRatio: 0.12 }), "medium");
});

test("recommendStrategy returns correct strategies for each profile", () => {
  const trivial = recommendStrategy("trivial");
  assert.equal(trivial.primary, "astar");
  assert.equal(trivial.workers, 1);

  const corridor = recommendStrategy("corridor");
  assert.equal(corridor.primary, "ida-star");
  assert.equal(corridor.enableTunnelMacros, true);

  const roomBased = recommendStrategy("room-based");
  assert.equal(roomBased.primary, "plan-macro-beam");
  assert.equal(roomBased.enableGateOrder, true);

  const openField = recommendStrategy("open-field");
  assert.equal(openField.primary, "fess");
  assert.equal(openField.enableDiversity, true);

  const dense = recommendStrategy("dense");
  assert.equal(dense.primary, "beam");
  assert.equal(dense.heavyDeadlock, true);

  const mega = recommendStrategy("mega");
  assert.equal(mega.primary, "decomposition-first");
  assert.equal(mega.workers, 6);

  const medium = recommendStrategy("medium");
  assert.equal(medium.primary, "portfolio");
});

test("recommendStrategy falls back to medium for unknown profiles", () => {
  const unknown = recommendStrategy("nonexistent");
  assert.equal(unknown.primary, "portfolio");
  assert.equal(unknown.workers, 3);
});

test("classifyPuzzle returns features, profile, and strategy as a single object", () => {
  const goals = new Map([["1,1", "X"], ["2,2", "X"]]);
  const floor = new Set(["0,0", "0,1", "1,0", "1,1", "2,1", "2,2"]);
  const result = classifyPuzzle(
    makeBoard(goals, floor),
    makeDense([...floor]),
    makeTopology(),
  );
  assert.ok(result.features);
  assert.equal(typeof result.profile, "string");
  assert.ok(result.strategy);
  assert.equal(typeof result.strategy.primary, "string");
  assert.equal(result.profile, "trivial"); // 2 boxes < 4
});

test("classifyPuzzle end-to-end: corridor-dominant layout", () => {
  // 6 boxes, 60 floor cells, many tunnel cells, few rooms
  const goals = new Map([
    ["1,1", "X"], ["1,2", "X"], ["1,3", "X"],
    ["1,4", "X"], ["1,5", "X"], ["1,6", "X"],
  ]);
  // Build a long corridor floor
  const floor = new Set();
  for (let x = 0; x < 20; x++) {
    floor.add(`1,${x}`);
    floor.add(`2,${x}`);
    floor.add(`3,${x}`);
  }
  // Tunnel cells: long corridor
  const tunnels = new Set();
  for (let x = 0; x < 20; x++) tunnels.add(`2,${x}`);
  const result = classifyPuzzle(
    makeBoard(goals, floor),
    makeDense([...floor]),
    makeTopology({ tunnels, rooms: [{}] }),
  );
  assert.equal(result.profile, "corridor");
  assert.equal(result.strategy.primary, "ida-star");
});
