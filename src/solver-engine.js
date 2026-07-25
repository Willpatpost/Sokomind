// Sokomind Solver Engine — modular barrel.
//
// The engine has been split into focused modules. Each module registers its
// functions as bare globals (for backward-compatible vm.runInNewContext usage)
// and also exports a namespace object on globalThis.
//
// Module load order (dependency-safe):
//   state.js  →  globalThis.SokomindState
//   memo.js  →  globalThis.SokomindMemo
//   metrics.js  →  globalThis.SokomindMetrics
//   topology.js  →  globalThis.SokomindTopology
//   board.js  →  globalThis.SokomindBoard
//   heuristic.js  →  globalThis.SokomindHeuristic
//   deadlock.js  →  globalThis.SokomindDeadlock
//   analysis.js  →  globalThis.SokomindAnalysis
//   push-generation.js  →  globalThis.SokomindPushGeneration
//
// In the browser worker, solver-worker.js loads these via importScripts().
// In Node.js tests, source files are concatenated and run in a vm context.
//
// This barrel is kept so that file-existence checks (e.g. solver-generality)
// continue to pass. It re-exports the full public surface.
//
// When loaded via require() in Node.js, it concatenates all modules and
// evaluates them in a shared vm context to preserve cross-module bare globals.

if (typeof module === "object" && module.exports) {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const dir = __dirname || path.dirname("");
  const moduleFiles = [
    "state.js", "memo.js", "depth-map.js", "compact-table.js", "packed-path.js",
    "metrics.js", "topology.js", "board.js",
    "heuristic.js", "deadlock.js", "analysis.js",
    "solution-improvement.js", "subproblem-cache.js",
    "goal-ordering.js", "chokepoint.js", "retrograde.js", "pattern-db.js",
    "push-generation.js",
    "pi-corral.js",
    "mobile.js", "difficulty.js",
  ];
  const source = moduleFiles
    .map(file => fs.readFileSync(path.join(dir, file), "utf8"))
    .join("\n");
  const context = {console};
  vm.runInNewContext(source, context, {filename: "solver-engine.js"});
  module.exports = {
    ...context.SokomindState,
    ...context.SokomindMemo,
    ...context.SokomindDepthMap,
    ...context.SokomindCompactTable,
    ...context.SokomindPackedPath,
    ...context.SokomindMetrics,
    ...context.SokomindTopology,
    ...context.SokomindBoard,
    ...context.SokomindHeuristic,
    ...context.SokomindDeadlock,
    ...context.SokomindAnalysis,
    ...context.SokomindSolutionImprovement,
    ...context.SokomindSubproblemCache,
    ...context.SokomindPushGeneration,
    ...context.SokomindPICorral,
    ...context.SokomindGoalOrdering,
    ...context.SokomindChokepoint,
    ...context.SokomindRetrograde,
    ...context.SokomindPatternDB,
    ...context.SokomindMobile,
    ...context.SokomindDifficulty,
  };
}
