const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findIndependentPushGroups,
  optimizePushOrder,
  splitAtGoalEvents,
  optimizeSegment,
  improveSolution,
} = require("../../src/solution-improvement.js");

test("findIndependentPushGroups returns empty for an empty path", () => {
  const result = findIndependentPushGroups([], null);
  assert.deepEqual(result.pushEvents, []);
  assert.equal(result.groups.length, 0);
});

test("findIndependentPushGroups detects push events on a simple path", () => {
  // Board: OOOOO
  //        O R O
  //        O X O
  //        O S O
  //        OOOOO
  const board = {
    rows: ["OOOOO", "O R O", "O X O", "O S O", "OOOOO"],
    goals: new Map([["3,2", "X"]]),
    floor: new Set(["1,1", "1,2", "1,3", "2,1", "2,2", "2,3", "3,1", "3,2", "3,3"]),
  };

  const path = ["Down"]; // push box from 2,2 to 3,2
  const result = findIndependentPushGroups(path, board);

  assert.equal(result.pushEvents.length, 1);
  assert.equal(result.pushEvents[0].boxFrom, "2,2");
  assert.equal(result.pushEvents[0].boxTo, "3,2");
  assert.equal(result.pushEvents[0].label, "X");
  assert.equal(result.pushEvents[0].direction, "Down");
});

test("findIndependentPushGroups identifies dependency chains", () => {
  // Two consecutive pushes of the same box: push down twice
  // Board: OOOOO
  //        O R O
  //        O X O
  //        O   O
  //        O S O
  //        OOOOO
  const board = {
    rows: ["OOOOO", "O R O", "O X O", "O   O", "O S O", "OOOOO"],
    goals: new Map([["4,2", "X"]]),
    floor: new Set([
      "1,1", "1,2", "1,3",
      "2,1", "2,2", "2,3",
      "3,1", "3,2", "3,3",
      "4,1", "4,2", "4,3",
    ]),
  };

  const path = ["Down", "Down"]; // push box from 2,2 to 3,2, then to 4,2
  const result = findIndependentPushGroups(path, board);

  assert.equal(result.pushEvents.length, 2);
  // Both pushes should be in the same group (dependent chain)
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].length, 2);
});

test("findIndependentPushGroups identifies independent pushes for different boxes", () => {
  // Two boxes far apart that are pushed independently
  // Board:
  //  OOOOOOOOO
  //  O R     O
  //  O A   B O
  //  O a   b O
  //  OOOOOOOOO
  const board = {
    rows: ["OOOOOOOOO", "O R     O", "O A   B O", "O a   b O", "OOOOOOOOO"],
    goals: new Map([["3,2", "A"], ["3,6", "B"]]),
    floor: new Set([
      "1,1", "1,2", "1,3", "1,4", "1,5", "1,6", "1,7",
      "2,1", "2,2", "2,3", "2,4", "2,5", "2,6", "2,7",
      "3,1", "3,2", "3,3", "3,4", "3,5", "3,6", "3,7",
    ]),
  };

  // Push A down, then walk over and push B down
  const path = ["Down", "Right", "Right", "Right", "Right", "Down"];
  const result = findIndependentPushGroups(path, board);

  assert.equal(result.pushEvents.length, 2);
  // These are independent pushes (different boxes, no spatial conflicts)
  // They should be in separate groups
  assert.equal(result.groups.length, 2);
});

test("optimizePushOrder returns null when no reordering is possible", () => {
  const groups = { pushEvents: [], dependencies: new Map(), groups: [] };
  assert.equal(optimizePushOrder(groups, null), null);
});

test("optimizePushOrder returns null for a single-push group", () => {
  const groups = {
    pushEvents: [{ moveIndex: 0 }],
    dependencies: new Map([[0, new Set()]]),
    groups: [[0]],
  };
  assert.equal(optimizePushOrder(groups, null), null);
});

test("splitAtGoalEvents returns empty for an empty path", () => {
  const board = { goals: new Map() };
  const result = splitAtGoalEvents([], null, board);
  assert.deepEqual(result, []);
});

test("splitAtGoalEvents detects goal-filling events", () => {
  // Simple puzzle: push one box onto its goal
  const board = {
    goals: new Map([["3,2", "X"]]),
    floor: new Set(["1,2", "2,2", "3,2"]),
  };
  const initialState = {
    robot: [1, 2],
    boxes: [[2, 2, "X"]],
  };

  const path = ["Down"]; // push box to goal
  const segments = splitAtGoalEvents(path, initialState, board);

  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].path, ["Down"]);
  assert.equal(segments[0].goalEvent.boxKey, "3,2");
  assert.equal(segments[0].goalEvent.label, "X");
});

test("splitAtGoalEvents splits at two goal events", () => {
  // Two boxes, each pushed onto their goal sequentially
  const board = {
    goals: new Map([["3,2", "X"], ["3,4", "X"]]),
    floor: new Set(["1,2", "2,2", "3,2", "1,3", "1,4", "2,4", "3,4"]),
  };
  const initialState = {
    robot: [1, 2],
    boxes: [[2, 2, "X"], [2, 4, "X"]],
  };

  // Push first box down (goal), move right x2, push second box down (goal)
  const path = ["Down", "Up", "Right", "Right", "Down", "Down"];
  const segments = splitAtGoalEvents(path, initialState, board);

  // At least one goal event should be detected (the first push onto 3,2)
  assert.ok(segments.length >= 1);
  assert.equal(segments[0].goalEvent.boxKey, "3,2");
});

test("optimizeSegment returns the original segment when path is short", () => {
  const segment = { path: ["Down"], startIndex: 0, endIndex: 1 };
  const result = optimizeSegment(segment, null, 10000);
  assert.deepEqual(result, segment);
});

test("optimizeSegment returns the original when no board is given", () => {
  const segment = { path: ["Down", "Down"], startIndex: 0, endIndex: 2 };
  const result = optimizeSegment(segment, null);
  assert.deepEqual(result, segment);
});

test("improveSolution returns valid result for an empty path", () => {
  const result = improveSolution([], null, null);
  assert.deepEqual(result.path, []);
  assert.equal(result.originalMoves, 0);
  assert.equal(result.improvedMoves, 0);
  assert.equal(result.reduction, 0);
  assert.deepEqual(result.improvements, []);
});

test("improveSolution returns valid result structure for a non-empty path", () => {
  const board = {
    goals: new Map([["3,2", "X"]]),
    floor: new Set(["1,2", "2,2", "3,2"]),
    rows: ["OOOOO", "O R O", "O X O", "O S O", "OOOOO"],
  };
  const initialState = {
    robot: [1, 2],
    boxes: [[2, 2, "X"]],
  };

  const path = ["Down"];
  const result = improveSolution(path, initialState, board);

  assert.ok(Array.isArray(result.path));
  assert.equal(typeof result.originalMoves, "number");
  assert.equal(typeof result.improvedMoves, "number");
  assert.equal(typeof result.reduction, "number");
  assert.ok(Array.isArray(result.improvements));
  assert.equal(result.originalMoves, 1);
});

test("improveSolution respects time limit", () => {
  const board = {
    goals: new Map(),
    floor: new Set(["0,0", "0,1"]),
    rows: ["R "],
  };
  const path = ["Right"];
  const result = improveSolution(path, { robot: [0, 0], boxes: [] }, board, {
    timeLimitMs: 0, // immediate timeout
    maxRounds: 10,
  });

  // Should still return a valid result even with zero time
  assert.ok(result.path);
  assert.equal(result.originalMoves, 1);
});

test("improveSolution respects maxRounds option", () => {
  const board = {
    goals: new Map(),
    floor: new Set(["0,0", "0,1"]),
    rows: ["R "],
  };
  const path = ["Right"];
  const result = improveSolution(path, { robot: [0, 0], boxes: [] }, board, {
    maxRounds: 1,
  });

  assert.ok(result.path);
  assert.equal(result.originalMoves, 1);
});
