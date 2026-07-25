const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const GameState = require("../../src/game-state.js");
const SearchLog = require("../../src/search-log.js");

const srcDir = path.join(__dirname, "..", "..", "src");

test("game-state module preserves typed Sokoban movement and serialization", () => {
  const state = GameState.parseRows([
    "OOOOO",
    "O R O",
    "O A O",
    "O a O",
    "OOOOO",
  ]);
  assert.equal(GameState.isPushMove(state, "Down"), true);
  const solved = GameState.moveState(state, "Down");
  assert.equal(GameState.isGoal(solved), true);
  assert.deepEqual(GameState.serializeState(solved), {
    rows: state.board.rows,
    robot: [2, 2],
    boxes: [["3,2", "A"]],
  });
  assert.equal(GameState.moveState(solved, "Unknown"), null);
});

test("search-log module keeps human and structured telemetry stable", () => {
  const entries = [{text: "first", event: {sequence: 1}},
    {text: "second", event: {sequence: 2}}];
  assert.equal(SearchLog.text(entries), "first\nsecond");
  assert.equal(SearchLog.jsonLines(entries), '{"sequence":1}\n{"sequence":2}');
  assert.deepEqual(SearchLog.structuredStats({states: "1,250", rate: "50/s", time: "2.5s"}), {
    states: 1250,
    rate: 50,
    time: 2.5,
  });
  assert.equal(SearchLog.formatTime(125), "02:05");
  assert.equal(SearchLog.shortStateId("checkpoint"), SearchLog.shortStateId("checkpoint"));
});

test("worker entry delegates to the cache-matched search engine", () => {
  const entry = fs.readFileSync(path.join(srcDir, "solver-worker.js"), "utf8");
  const search = fs.readFileSync(path.join(srcDir, "solver-search.js"), "utf8");
  assert.match(entry, /globalThis\.location\?\.search/);
  assert.match(entry, /state\.js\$\{engineRevision\}/);
  assert.match(entry, /solver-search\.js\$\{engineRevision\}/);
  assert.match(entry, /bidirectionalSide\(data\)/);
  assert.match(entry, /search\(data\)/);
  for (const moduleFile of [
    "state.js", "memo.js", "metrics.js", "topology.js", "board.js",
    "heuristic.js", "deadlock.js", "analysis.js", "push-generation.js",
  ]) {
    assert.match(entry, new RegExp(moduleFile.replace(".", "\\.")));
  }
  assert.match(search, /function beamSearch/);
  assert.match(search, /function pushIterativeDeepeningAStar/);
});

test("UI and solver director have separate source boundaries", () => {
  const app = fs.readFileSync(path.join(srcDir, "app.js"), "utf8");
  const director = fs.readFileSync(path.join(srcDir, "solver-director.js"), "utf8");
  assert.doesNotMatch(app, /function runBidirectionalSolver/);
  assert.doesNotMatch(app, /function startSolver/);
  assert.match(director, /function runBidirectionalSolver/);
  assert.match(director, /function startSolver/);
});
