const assert = require("node:assert/strict");
const test = require("node:test");

const Accessibility = require("../../src/accessibility.js");

test("describeBoardState returns fallback when state or board is missing", () => {
  assert.equal(Accessibility.describeBoardState(null, null), "Board not loaded.");
  assert.equal(Accessibility.describeBoardState(undefined, undefined), "Board not loaded.");
  assert.equal(Accessibility.describeBoardState({}, null), "Board not loaded.");
  assert.equal(Accessibility.describeBoardState(null, {}), "Board not loaded.");
});

test("describeBoardState describes a simple board", () => {
  const board = { rows: ["OOOOO", "O R O", "O A O", "O a O", "OOOOO"] };
  const state = { robot: [1, 2], boxes: [["2,2", "A"]] };
  const description = Accessibility.describeBoardState(state, board);
  assert.match(description, /5 by 5 board/);
  assert.match(description, /Robot at row 2, column 3/);
  assert.match(description, /1 box/);
});

test("describeBoardState handles multiple boxes", () => {
  const board = { rows: ["OOOOOOO", "O R   O", "O A B O", "O a b O", "OOOOOOO"] };
  const state = { robot: [1, 2], boxes: [["2,2", "A"], ["2,4", "B"]] };
  const description = Accessibility.describeBoardState(state, board);
  assert.match(description, /2 boxes/);
});

test("describeBoardState handles empty boxes array", () => {
  const board = { rows: ["OOO", "ORO", "OOO"] };
  const state = { robot: [1, 1], boxes: [] };
  const description = Accessibility.describeBoardState(state, board);
  assert.match(description, /0 boxes/);
});

test("describeMoveResult reports a simple move", () => {
  const result = Accessibility.describeMoveResult("Up", false);
  assert.equal(result, "Moved up.");
});

test("describeMoveResult reports a push", () => {
  const result = Accessibility.describeMoveResult("Left", true);
  assert.equal(result, "Moved left. Pushed box.");
});

test("describeMoveResult normalizes direction case", () => {
  const result = Accessibility.describeMoveResult("RIGHT", false);
  assert.equal(result, "Moved right.");
});

test("describeSearchProgress reports a solved status", () => {
  const result = Accessibility.describeSearchProgress("solved", 20, 8, "2.3s");
  assert.equal(result, "Solution found: 20 moves, 8 pushes in 2.3s.");
});

test("describeSearchProgress reports a searching status", () => {
  const result = Accessibility.describeSearchProgress("searching", 0, 0, "1.5s");
  assert.equal(result, "Searching... 1.5s elapsed.");
});

test("describeSearchProgress reports other statuses", () => {
  assert.equal(Accessibility.describeSearchProgress("failed", 0, 0, "5s"), "Search failed.");
  assert.equal(Accessibility.describeSearchProgress("timeout", 0, 0, "30s"), "Search timeout.");
});

test("announceToScreenReader does not throw in non-browser environment", () => {
  // In Node.js there is no document, so this should be a no-op
  assert.doesNotThrow(() => {
    Accessibility.announceToScreenReader("board-announce", "test message");
  });
});

test("module exports all expected functions", () => {
  assert.equal(typeof Accessibility.describeBoardState, "function");
  assert.equal(typeof Accessibility.describeMoveResult, "function");
  assert.equal(typeof Accessibility.describeSearchProgress, "function");
  assert.equal(typeof Accessibility.announceToScreenReader, "function");
});
