// Memo limits, bounded caching utilities, and tuning constants.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

const HEURISTIC_MEMO_LIMIT = 100000;
const DEADLOCK_MEMO_LIMIT = 50000;
const PUSH_TRANSITION_MEMO_LIMIT = 10000;
const REACHABILITY_MEMO_LIMIT = 512;
const PATTERN_DEADLOCK_MEMO_LIMIT = 50000;
const PATTERN_EXACT_STATE_LIMIT = 512;
const PATTERN_FLOOR_LIMIT = 24;
const PATTERN_BOX_LIMIT = 5;
const ROOM_PATTERN_MAX_STATES = 12000;
const ROOM_PATTERN_SELECTION_LIMIT = 512;
const PAIR_CONFLICT_MAX_STATES = 4000;
const CAPACITY_PATTERN_MAX_STATES = 20000;
const CAPACITY_PATTERN_MAX_FLOOR = 32;
const CAPACITY_PATTERN_MAX_BOXES = 3;
const PAIR_CONFLICT_DISTANCE_LIMIT = 18;
const INCREMENTAL_ASSIGNMENT_CROSSOVER = 3;
function incrementalAssignmentCrossover() {
  return INCREMENTAL_ASSIGNMENT_CROSSOVER;
}
const COMMITMENT_MEMO_LIMIT = 10000;
const SUPPORT_DEPENDENCY_MEMO_LIMIT = 5000;
const LOCAL_ROOM_MEMO_LIMIT = 5000;
const LOCAL_CORRAL_MEMO_LIMIT = 5000;
const LOCAL_EXACT_STATE_LIMIT = 250000;
const LOCAL_ROOM_CELL_LIMIT = 16;
const LOCAL_DOMAIN_CELL_LIMIT = 24;
const LOCAL_BOX_LIMIT = 5;
function localReasoningLimits() {
  return {
    patternMaxStates: PATTERN_EXACT_STATE_LIMIT,
    patternMaxFloor: PATTERN_FLOOR_LIMIT,
    patternMaxBoxes: PATTERN_BOX_LIMIT,
    localExactMaxStates: LOCAL_EXACT_STATE_LIMIT,
    roomMaxCells: LOCAL_ROOM_CELL_LIMIT,
    domainMaxCells: LOCAL_DOMAIN_CELL_LIMIT,
    localMaxBoxes: LOCAL_BOX_LIMIT,
  };
}
const DOORWAY_FLOW_MEMO_LIMIT = 5000;
const GOAL_ACCESS_MEMO_LIMIT = 5000;
const GOAL_COMMITMENT = Object.freeze({
  TEMPORARY: "temporary",
  CONDITIONAL: "conditional",
  PROVEN: "proven",
});

let MEMO_SCALE = 1;
function setMemoScale(deviceMemory) {
  if (!Number.isFinite(deviceMemory) || deviceMemory <= 0) return;
  MEMO_SCALE = deviceMemory >= 32 ? 4
             : deviceMemory >= 16 ? 2
             : deviceMemory >= 8  ? 1.5
             : deviceMemory >= 4  ? 1
             : 0.5;
}
function scaledMemoLimit(base) {
  return Math.round(base * MEMO_SCALE);
}

function memoLookup(memo, key) {
  const value = memo.get(key);
  if (value !== undefined) {
    memo.delete(key);
    memo.set(key, value);
  }
  return value;
}

function memoizeBounded(memo, key, value, limit = HEURISTIC_MEMO_LIMIT) {
  const effectiveLimit = scaledMemoLimit(limit);
  if (memo.size >= effectiveLimit) memo.delete(memo.keys().next().value);
  memo.set(key, value);
  return value;
}

class BoundedDepthMap {
  constructor(limit) {
    this.limit = limit;
    this.values = new Map();
    this.evictions = 0;
  }
  get(key) {
    const value = this.values.get(key);
    if (value !== undefined) {
      this.values.delete(key);
      this.values.set(key, value);
    }
    return value;
  }
  has(key) { return this.values.has(key); }
  set(key, value) {
    if (this.values.has(key)) this.values.delete(key);
    while (this.values.size >= this.limit) {
      this._evictDeepest();
    }
    this.values.set(key, value);
  }
  _evictDeepest() {
    const scan = Math.min(8, this.values.size);
    let worstKey = null, worstCost = -1;
    const iter = this.values.entries();
    for (let i = 0; i < scan; i++) {
      const {value: [key, cost]} = iter.next();
      if (typeof cost === "number" && cost > worstCost) {
        worstCost = cost;
        worstKey = key;
      }
    }
    if (worstKey === null) worstKey = this.values.keys().next().value;
    this.values.delete(worstKey);
    this.evictions++;
  }
  get size() { return this.values.size; }
}

// --- Module registration ---
const SokomindMemo = {
  memoLookup,
  setMemoScale,
  scaledMemoLimit,
  HEURISTIC_MEMO_LIMIT,
  DEADLOCK_MEMO_LIMIT,
  PUSH_TRANSITION_MEMO_LIMIT,
  REACHABILITY_MEMO_LIMIT,
  PATTERN_DEADLOCK_MEMO_LIMIT,
  PATTERN_EXACT_STATE_LIMIT,
  PATTERN_FLOOR_LIMIT,
  PATTERN_BOX_LIMIT,
  ROOM_PATTERN_MAX_STATES,
  ROOM_PATTERN_SELECTION_LIMIT,
  PAIR_CONFLICT_MAX_STATES,
  CAPACITY_PATTERN_MAX_STATES,
  CAPACITY_PATTERN_MAX_FLOOR,
  CAPACITY_PATTERN_MAX_BOXES,
  PAIR_CONFLICT_DISTANCE_LIMIT,
  INCREMENTAL_ASSIGNMENT_CROSSOVER,
  incrementalAssignmentCrossover,
  COMMITMENT_MEMO_LIMIT,
  SUPPORT_DEPENDENCY_MEMO_LIMIT,
  LOCAL_ROOM_MEMO_LIMIT,
  LOCAL_CORRAL_MEMO_LIMIT,
  LOCAL_EXACT_STATE_LIMIT,
  LOCAL_ROOM_CELL_LIMIT,
  LOCAL_DOMAIN_CELL_LIMIT,
  LOCAL_BOX_LIMIT,
  localReasoningLimits,
  DOORWAY_FLOW_MEMO_LIMIT,
  GOAL_ACCESS_MEMO_LIMIT,
  GOAL_COMMITMENT,
  memoizeBounded,
  BoundedDepthMap,
};
if (typeof globalThis !== "undefined") globalThis.SokomindMemo = SokomindMemo;
if (typeof module === "object" && module.exports) module.exports = SokomindMemo;
