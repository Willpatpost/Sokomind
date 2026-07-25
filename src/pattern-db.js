// Enhanced pattern database with compressed storage and additive PDB support.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

(function attachPatternDB(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindPatternDB = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const ENHANCED_PATTERN_FLOOR_LIMIT = 24;
  const ENHANCED_PATTERN_BOX_LIMIT = 5;
  const ENHANCED_PAIR_CONFLICT_MAX_STATES = 8000;

  /**
   * Compressed pattern database using open-addressing hash table.
   * Stores (hi, lo) -> cost mappings in typed arrays for memory efficiency.
   */
  class CompressedPDB {
    constructor(capacity) {
      if (capacity === undefined) capacity = 65536;
      this.capacity = capacity;
      this.keys = new Uint32Array(capacity * 2);   // hash high, hash low
      this.values = new Uint8Array(capacity);       // cost (0-255)
      this.occupied = new Uint8Array(capacity);
      this.size = 0;
    }

    _hash(hi, lo) {
      return ((hi * 2654435761) ^ lo) >>> 0;
    }

    set(hi, lo, cost) {
      if (this.size >= this.capacity * 0.75) return false; // load factor limit
      var index = this._hash(hi, lo) % this.capacity;
      for (var probe = 0; probe < this.capacity; probe++) {
        var slot = (index + probe) % this.capacity;
        if (!this.occupied[slot]) {
          this.keys[slot * 2] = hi;
          this.keys[slot * 2 + 1] = lo;
          this.values[slot] = Math.min(255, cost);
          this.occupied[slot] = 1;
          this.size++;
          return true;
        }
        if (this.keys[slot * 2] === hi && this.keys[slot * 2 + 1] === lo) {
          this.values[slot] = Math.min(this.values[slot], Math.min(255, cost));
          return true;
        }
      }
      return false;
    }

    get(hi, lo) {
      var index = this._hash(hi, lo) % this.capacity;
      for (var probe = 0; probe < this.capacity; probe++) {
        var slot = (index + probe) % this.capacity;
        if (!this.occupied[slot]) return -1;
        if (this.keys[slot * 2] === hi && this.keys[slot * 2 + 1] === lo) {
          return this.values[slot];
        }
      }
      return -1;
    }
  }

  /**
   * Build a pattern database for a set of goals using BFS from goal configuration.
   *
   * board: parsed board object
   * goalPositions: array of goal position strings to build PDB for
   * maxStates: maximum states to explore (default 50000)
   *
   * Returns a CompressedPDB storing minimum push costs.
   */
  function buildAdditivePatternDB(board, goalPositions, maxStates) {
    if (maxStates === undefined) maxStates = 50000;

    // Determine eligible goals
    var goals = goalPositions || [...board.goals.keys()];
    if (goals.length > ENHANCED_PATTERN_BOX_LIMIT ||
        board.floor.size > ENHANCED_PATTERN_FLOOR_LIMIT) {
      return new CompressedPDB(16); // empty small PDB
    }

    var pdb = new CompressedPDB(Math.min(maxStates * 4, 262144));

    // Build target configuration
    var targetBoxes = [];
    for (var i = 0; i < goals.length; i++) {
      var goal = goals[i];
      var label = board.goals.get(goal);
      if (!label) continue;
      targetBoxes.push({position: goal, label: label});
    }

    if (!targetBoxes.length) return pdb;

    // Compute hash for a box configuration
    function configHash(boxes) {
      var hi = 0, lo = 0;
      for (var j = 0; j < boxes.length; j++) {
        var pos = boxes[j].position;
        var id = board.dense?.idByKey?.get(pos);
        if (id === undefined) id = hashString(pos);
        hi = (hi * 31 + id) >>> 0;
        lo = (lo * 37 + hashString(boxes[j].label)) >>> 0;
      }
      return {hi: hi, lo: lo};
    }

    function hashString(s) {
      var h = 0;
      for (var k = 0; k < s.length; k++) {
        h = ((h << 5) - h + s.charCodeAt(k)) >>> 0;
      }
      return h;
    }

    // Sort boxes for canonical form
    function sortBoxes(boxes) {
      return boxes.slice().sort(function(a, b) {
        return (a.label + ":" + a.position).localeCompare(b.label + ":" + b.position);
      });
    }

    // BFS from goal configuration
    var startSorted = sortBoxes(targetBoxes);
    var startHash = configHash(startSorted);
    pdb.set(startHash.hi, startHash.lo, 0);

    var signatureSet = new Set();
    var startSig = startSorted.map(function(b) { return b.label + ":" + b.position; }).join(";");
    signatureSet.add(startSig);

    var queue = [{boxes: startSorted, cost: 0}];
    var head = 0;

    while (head < queue.length && signatureSet.size < maxStates) {
      var current = queue[head++];
      var currentCost = current.cost;
      var occupiedSet = new Set(current.boxes.map(function(b) { return b.position; }));

      for (var bi = 0; bi < current.boxes.length; bi++) {
        var box = current.boxes[bi];
        var coords = box.position.split(",").map(Number);
        var by = coords[0], bx = coords[1];

        for (var di = 0; di < DIRECTION_ENTRIES.length; di++) {
          var dy = DIRECTION_ENTRIES[di][1][0];
          var dx = DIRECTION_ENTRIES[di][1][1];

          // Reverse push: box moves from (by,bx) to (by-dy,bx-dx)
          // Support at (by-2dy, bx-2dx) and (by-dy,bx-dx) must be floor
          var prevPos = pkey(by - dy, bx - dx);
          var supportPos = pkey(by - 2 * dy, bx - 2 * dx);

          if (!board.floor.has(prevPos) || !board.floor.has(supportPos)) continue;
          if (occupiedSet.has(prevPos) || occupiedSet.has(supportPos)) continue;

          var newBoxes = current.boxes.slice();
          newBoxes[bi] = {position: prevPos, label: box.label};
          var sorted = sortBoxes(newBoxes);
          var sig = sorted.map(function(b) { return b.label + ":" + b.position; }).join(";");

          if (signatureSet.has(sig)) continue;
          signatureSet.add(sig);

          var newCost = currentCost + 1;
          var hash = configHash(sorted);
          pdb.set(hash.hi, hash.lo, newCost);

          queue.push({boxes: sorted, cost: newCost});
          if (signatureSet.size >= maxStates) break;
        }
        if (signatureSet.size >= maxStates) break;
      }
    }

    return pdb;
  }

  /**
   * Query multiple pattern databases and return max value (admissible).
   *
   * boxes: array of [y, x, label] current box positions
   * board: parsed board object
   * pdbs: array of {pdb, goalPositions} objects
   *
   * Returns the maximum cost across all PDBs (admissible lower bound).
   */
  function queryAdditivePatternDB(boxes, board, pdbs) {
    if (!pdbs || !pdbs.length) return 0;

    var maxCost = 0;

    for (var pi = 0; pi < pdbs.length; pi++) {
      var entry = pdbs[pi];
      var pdb = entry.pdb;
      var goalPos = entry.goalPositions;

      if (!pdb || !pdb.size) continue;

      // Find relevant boxes (ones matching the goals in this PDB)
      var relevantGoalLabels = new Map();
      for (var gi = 0; gi < goalPos.length; gi++) {
        var label = board.goals.get(goalPos[gi]);
        if (label) {
          relevantGoalLabels.set(goalPos[gi], label);
        }
      }

      // Match current boxes to PDB goals by label
      var matched = [];
      var usedBoxes = new Set();

      for (var goalEntry of relevantGoalLabels) {
        var gPos = goalEntry[0], gLabel = goalEntry[1];
        // Find closest unmatched box with same label
        var bestIdx = -1, bestDist = Infinity;

        for (var bi = 0; bi < boxes.length; bi++) {
          if (usedBoxes.has(bi)) continue;
          if (boxes[bi][2] !== gLabel) continue;
          var dist = Math.abs(boxes[bi][0] - parseInt(gPos)) +
            Math.abs(boxes[bi][1] - parseInt(gPos.split(",")[1]));
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = bi;
          }
        }
        if (bestIdx >= 0) {
          usedBoxes.add(bestIdx);
          matched.push({
            position: pkey(boxes[bestIdx][0], boxes[bestIdx][1]),
            label: gLabel,
          });
        }
      }

      if (matched.length !== goalPos.length) continue;

      // Sort and hash
      matched.sort(function(a, b) {
        return (a.label + ":" + a.position).localeCompare(b.label + ":" + b.position);
      });

      var hi = 0, lo = 0;
      for (var mi = 0; mi < matched.length; mi++) {
        var pos = matched[mi].position;
        var id = board.dense?.idByKey?.get(pos);
        if (id === undefined) {
          var h = 0;
          for (var k = 0; k < pos.length; k++) {
            h = ((h << 5) - h + pos.charCodeAt(k)) >>> 0;
          }
          id = h;
        }
        hi = (hi * 31 + id) >>> 0;
        var lh = 0;
        var lbl = matched[mi].label;
        for (var k2 = 0; k2 < lbl.length; k2++) {
          lh = ((lh << 5) - lh + lbl.charCodeAt(k2)) >>> 0;
        }
        lo = (lo * 37 + lh) >>> 0;
      }

      var cost = pdb.get(hi, lo);
      if (cost >= 0) {
        maxCost = Math.max(maxCost, cost);
      }
    }

    return maxCost;
  }

  return {
    ENHANCED_PATTERN_FLOOR_LIMIT: ENHANCED_PATTERN_FLOOR_LIMIT,
    ENHANCED_PATTERN_BOX_LIMIT: ENHANCED_PATTERN_BOX_LIMIT,
    ENHANCED_PAIR_CONFLICT_MAX_STATES: ENHANCED_PAIR_CONFLICT_MAX_STATES,
    CompressedPDB: CompressedPDB,
    buildAdditivePatternDB: buildAdditivePatternDB,
    queryAdditivePatternDB: queryAdditivePatternDB,
  };
});
