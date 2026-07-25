// Stable Web Worker entry point. Search implementation lives in the solver
// engine modules (state, memo, metrics, topology, board, heuristic, deadlock,
// analysis, push-generation) and solver-search.js.
const engineRevision = globalThis.location?.search || "";
importScripts(
  `state.js${engineRevision}`,
  `memo.js${engineRevision}`,
  `depth-map.js${engineRevision}`,
  `compact-table.js${engineRevision}`,
  `packed-path.js${engineRevision}`,
  `metrics.js${engineRevision}`,
  `topology.js${engineRevision}`,
  `board.js${engineRevision}`,
  `heuristic.js${engineRevision}`,
  `deadlock.js${engineRevision}`,
  `analysis.js${engineRevision}`,
  `solution-improvement.js${engineRevision}`,
  `subproblem-cache.js${engineRevision}`,
  `goal-ordering.js${engineRevision}`,
  `chokepoint.js${engineRevision}`,
  `retrograde.js${engineRevision}`,
  `pattern-db.js${engineRevision}`,
  `push-generation.js${engineRevision}`,
  `pi-corral.js${engineRevision}`,
  `mobile.js${engineRevision}`,
  `difficulty.js${engineRevision}`,
  `solver-search.js${engineRevision}`,
);

if (typeof navigator !== "undefined" && navigator.deviceMemory) {
  setMemoScale(navigator.deviceMemory);
}

onmessage = ({data}) => {
  try {
    if (data.mode === "bidir-forward" || data.mode === "bidir-reverse") {
      bidirectionalSide(data);
    } else {
      postMessage({type: "done", ...search(data)});
    }
  } catch (error) {
    postMessage({
      type: "done",
      path: null,
      status: "failed",
      terminationReason: "worker-exception",
      error: error instanceof Error ? error.message : String(error),
      visited: 0,
    });
  }
};
