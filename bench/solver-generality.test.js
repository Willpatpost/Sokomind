"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const PRODUCTION_SOLVER_FILES = [
  "src/solver-worker.js",
  "src/state.js",
  "src/memo.js",
  "src/depth-map.js",
  "src/compact-table.js",
  "src/packed-path.js",
  "src/metrics.js",
  "src/topology.js",
  "src/board.js",
  "src/heuristic.js",
  "src/deadlock.js",
  "src/analysis.js",
  "src/solution-improvement.js",
  "src/subproblem-cache.js",
  "src/goal-ordering.js",
  "src/chokepoint.js",
  "src/retrograde.js",
  "src/pattern-db.js",
  "src/push-generation.js",
  "src/pi-corral.js",
  "src/mobile.js",
  "src/difficulty.js",
  "src/solver-engine.js",
  "src/solver-search.js",
  "searches/Sokomind.py",
];
const BUILTIN_LEVEL_NAMES = ["ultra-tiny", "tiny", "medium", "large", "huge"];

test("production solvers do not consume saved routes or branch on built-in levels", () => {
  for (const relativePath of PRODUCTION_SOLVER_FILES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.doesNotMatch(source, /optimalForHuge|HUGE_SOLUTION|known solution/i, relativePath);
    for (const level of BUILTIN_LEVEL_NAMES) {
      const levelBranch = new RegExp(
        `(?:===?|!==?)\\s*["']${level}["']|["']${level}["']\\s*(?:===?|!==?)`,
        "i",
      );
      assert.doesNotMatch(source, levelBranch, `${relativePath} must not special-case ${level}`);
    }
  }
});
