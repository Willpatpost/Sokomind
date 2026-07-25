"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROWS = ["OOOOO", "O R O", "O A O", "O a O", "OOOOO"];
const ALGORITHMS = [
  "bfs",
  "dfs",
  "greedy",
  "astar",
  "push-astar",
  "weighted-push-astar",
  "push-greedy",
  "fess",
  "push-beam",
  "push-beam-restarts",
  "bounded-push-dfs",
  "push-ida-star",
  "ultimate",
  "portfolio",
  "fast",
];
const MEMORY_KEYS = [
  "deltaBytes",
  "gcControlled",
  "peakBytes",
  "samples",
  "source",
  "supported",
  "usedBytes",
];

function stateFromRows(rows) {
  let robot = null;
  const boxes = [];
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === "R") robot = [y, x];
    if (cell === "X" || (/[A-Z]/.test(cell) && !"ORS".includes(cell))) {
      boxes.push([`${y},${x}`, cell]);
    }
  }));
  return {rows, robot, boxes};
}

const srcDir = path.join(__dirname, "..", "..", "src");

const ENGINE_MODULE_FILES = [
  "state.js", "memo.js", "depth-map.js", "compact-table.js", "packed-path.js",
  "metrics.js", "topology.js", "board.js",
  "heuristic.js", "deadlock.js", "analysis.js",
  "solution-improvement.js", "subproblem-cache.js",
  "goal-ordering.js", "chokepoint.js", "retrograde.js", "pattern-db.js",
  "push-generation.js",
  "pi-corral.js",
  "mobile.js", "difficulty.js",
  "solver-search.js",
];

function loadSearch(memoryUsage = null) {
  const source = ENGINE_MODULE_FILES
    .map(file => fs.readFileSync(path.join(srcDir, file), "utf8"))
    .join("\n");
  const context = {postMessage() {}, console};
  if (memoryUsage) context.__sokomindMemoryUsage = memoryUsage;
  vm.runInNewContext(source, context, {filename: "solver-performance.js"});
  return context.search;
}

test("every public algorithm returns the same versioned performance schema", () => {
  const search = loadSearch();
  let expectedKeys = null;
  for (const algorithm of ALGORITHMS) {
    const result = search({
      algorithm,
      state: stateFromRows(ROWS),
      maxVisited: 10000,
      maxDepth: 30,
      beamWidth: 20,
      upperBound: Infinity,
    });
    assert.ok(result.performance, `${algorithm} omitted performance`);
    for (const counter of [
      "visited",
      "generated",
      "retained",
      "peakFrontier",
      "transpositionEvictions",
    ]) {
      assert.equal(typeof result[counter], "number", `${algorithm} omitted ${counter}`);
    }
    const keys = Object.keys(result.performance).sort();
    if (expectedKeys === null) expectedKeys = keys;
    else assert.deepEqual(keys, expectedKeys, `${algorithm} changed performance schema`);
    assert.equal(result.performance.schemaVersion, 3);
    assert.deepEqual(Object.keys(result.performance.memory).sort(), MEMORY_KEYS);
    assert.deepEqual(JSON.parse(JSON.stringify(result.performance.memory)), {
      supported: false,
      source: null,
      usedBytes: null,
      peakBytes: null,
      deltaBytes: null,
      samples: 0,
      gcControlled: false,
    });
  }
});

test("supported memory uses the same shape and identifies its runtime source", () => {
  let bytes = 8_000_000;
  const search = loadSearch(() => (bytes += 1024));
  const result = search({algorithm: "push-astar", state: stateFromRows(ROWS)});
  assert.equal(result.performance.memory.supported, true);
  assert.equal(result.performance.memory.source, "injected-runtime");
  assert.ok(result.performance.memory.usedBytes >= 8_000_000);
  assert.ok(result.performance.memory.peakBytes >= result.performance.memory.usedBytes);
  assert.ok(result.performance.memory.samples >= 2);
  assert.equal(result.performance.memory.gcControlled, false);
});
