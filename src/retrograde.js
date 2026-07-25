// Retrograde analysis for Sokoban solvers.
// Backward search from the goal state to build a lookup table.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

(function attachRetrograde(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindRetrograde = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  /**
   * Build a retrograde analysis table by backward search from the goal state.
   *
   * 1. Start from solved state (all boxes on goals)
   * 2. Generate reverse pushes (pull operations) to depth maxDepth
   * 3. Store resulting states in a lookup table
   * 4. During forward search, if current state is in table -> solved!
   *
   * board: parsed board object
   * initialBoxes: array of [y, x, label] for the initial puzzle state
   * maxDepth: maximum reverse-push depth to explore (default 8)
   * maxStates: maximum states to store in the table (default 50000)
   *
   * Returns { table, lookup, size, maxDepthReached }
   */
  function buildRetrogradeTable(board, initialBoxes, maxDepth, maxStates) {
    if (maxDepth === undefined) maxDepth = 8;
    if (maxStates === undefined) maxStates = 50000;

    const table = new Map(); // signature -> {depth, moves}

    // Build solved state: all boxes on their matching goals
    const solved = buildSolvedBoxes(board, initialBoxes);
    if (!solved.length) {
      return {
        table,
        lookup: function lookup(signature) { return table.get(signature); },
        size: 0,
        maxDepthReached: 0,
      };
    }

    // Generate all possible robot positions for the solved state
    const solvedOccupied = new Set(solved.map(function(b) { return pkey(b[0], b[1]); }));
    const startStates = [];

    for (const position of board.floor) {
      if (solvedOccupied.has(position)) continue;
      var coords = position.split(",").map(Number);
      startStates.push({
        robot: coords,
        boxes: solved,
        depth: 0,
      });
    }

    if (!startStates.length) {
      return {
        table,
        lookup: function lookup(signature) { return table.get(signature); },
        size: 0,
        maxDepthReached: 0,
      };
    }

    // BFS from goal states, generating reverse-push (pull) states
    // Use canonical signatures to deduplicate
    var actualMaxDepth = 0;
    var queue = [];

    // Seed with unique robot-region states at depth 0
    var seenSignatures = new Set();
    for (var si = 0; si < startStates.length; si++) {
      var ss = startStates[si];
      var sig = computeCanonicalSignature(ss.robot, ss.boxes, board);
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);
      table.set(sig, {depth: 0, moves: 0});
      queue.push(ss);
      if (table.size >= maxStates) break;
    }

    var head = 0;
    while (head < queue.length && table.size < maxStates) {
      var current = queue[head++];
      if (current.depth >= maxDepth) continue;

      var nextDepth = current.depth + 1;
      var occupied = new Set(current.boxes.map(function(b) { return pkey(b[0], b[1]); }));

      // For each box, try each reverse push direction
      for (var bi = 0; bi < current.boxes.length; bi++) {
        var box = current.boxes[bi];
        var by = box[0], bx = box[1], label = box[2];
        var boxPos = pkey(by, bx);

        for (var di = 0; di < DIRECTION_ENTRIES.length; di++) {
          var dirEntry = DIRECTION_ENTRIES[di];
          var dy = dirEntry[1][0], dx = dirEntry[1][1];

          // For a pull: the robot must be at (by+dy, bx+dx) and must be able
          // to move to (by+2*dy, bx+2*dx) after pulling.
          // The box moves from (by, bx) to (by-dy, bx-dx).
          // The previous box position is (by-dy, bx-dx).
          var prevBoxPos = pkey(by - dy, bx - dx);
          var robotBefore = pkey(by + dy, bx + dx);

          // Previous box position must be floor and not occupied
          if (!board.floor.has(prevBoxPos) || occupied.has(prevBoxPos)) continue;
          // Robot position must be floor and not occupied (and not the box being moved)
          if (!board.floor.has(robotBefore) || occupied.has(robotBefore)) continue;

          // Check robot can reach the pull position
          // In retrograde, we check that the robot-before position is reachable
          // from the current robot, ignoring the box at its current position
          // but considering the box at its new position
          var canReach = isReachableWithoutBox(
            current.robot, robotBefore.split(",").map(Number),
            board, occupied, boxPos,
          );
          if (!canReach) continue;

          // Create new state
          var newBoxes = current.boxes.slice();
          newBoxes[bi] = [by - dy, bx - dx, label];

          var newSig = computeCanonicalSignature(
            [by, bx], // robot ends where box was
            newBoxes,
            board,
          );

          if (seenSignatures.has(newSig)) continue;
          seenSignatures.add(newSig);

          table.set(newSig, {depth: nextDepth, moves: nextDepth});
          actualMaxDepth = Math.max(actualMaxDepth, nextDepth);

          queue.push({
            robot: [by, bx],
            boxes: newBoxes,
            depth: nextDepth,
          });

          if (table.size >= maxStates) break;
        }
        if (table.size >= maxStates) break;
      }
    }

    return {
      table: table,
      lookup: function lookup(signature) { return table.get(signature); },
      size: table.size,
      maxDepthReached: actualMaxDepth,
    };
  }

  /**
   * Build solved boxes from initial boxes and board goals.
   */
  function buildSolvedBoxes(board, initialBoxes) {
    // Use solvedBoxes global if available
    if (typeof solvedBoxes === "function") {
      return solvedBoxes(board, initialBoxes);
    }

    // Manual fallback
    var byLabel = new Map();
    for (var i = 0; i < initialBoxes.length; i++) {
      var label = initialBoxes[i][2];
      byLabel.set(label, (byLabel.get(label) || 0) + 1);
    }

    var boxes = [];
    for (var entry of byLabel) {
      var lbl = entry[0], count = entry[1];
      var goals = [];
      for (var goalEntry of board.goals) {
        if (goalEntry[1] === lbl) {
          goals.push(goalEntry[0]);
        }
      }
      goals = goals.slice(0, count);
      for (var gi = 0; gi < goals.length; gi++) {
        var coords = goals[gi].split(",").map(Number);
        boxes.push([coords[0], coords[1], lbl]);
      }
    }
    return boxes.sort(function(a, b) {
      return a.join(",").localeCompare(b.join(","));
    });
  }

  /**
   * Check if a robot position is reachable from another position,
   * treating occupiedSet as blocked except for excludePos.
   */
  function isReachableWithoutBox(from, to, board, occupiedSet, excludePos) {
    var fromKey = pkey(from[0], from[1]);
    var toKey = pkey(to[0], to[1]);
    if (fromKey === toKey) return true;

    var visited = new Set([fromKey]);
    var queue = [from];
    var head = 0;

    while (head < queue.length) {
      var current = queue[head++];
      for (var di = 0; di < DIRECTION_ENTRIES.length; di++) {
        var dy = DIRECTION_ENTRIES[di][1][0];
        var dx = DIRECTION_ENTRIES[di][1][1];
        var ny = current[0] + dy, nx = current[1] + dx;
        var nk = pkey(ny, nx);
        if (nk === toKey) return true;
        if (visited.has(nk) || !board.floor.has(nk)) continue;
        if (occupiedSet.has(nk) && nk !== excludePos) continue;
        visited.add(nk);
        queue.push([ny, nx]);
      }
    }
    return false;
  }

  /**
   * Compute a canonical state signature for deduplication.
   * Uses the minimum reachable floor cell as the robot region representative
   * and sorts box tokens.
   */
  function computeCanonicalSignature(robot, boxes, board) {
    // Find robot's reachable region representative
    var occupied = new Set(boxes.map(function(b) { return pkey(b[0], b[1]); }));
    var robotKey = pkey(robot[0], robot[1]);
    var visited = new Set([robotKey]);
    var queue = [robotKey];
    var minPosition = robotKey;
    var head = 0;

    while (head < queue.length) {
      var current = queue[head++];
      var coords = current.split(",").map(Number);
      for (var di = 0; di < DIRECTION_ENTRIES.length; di++) {
        var dy = DIRECTION_ENTRIES[di][1][0];
        var dx = DIRECTION_ENTRIES[di][1][1];
        var next = pkey(coords[0] + dy, coords[1] + dx);
        if (visited.has(next) || !board.floor.has(next) || occupied.has(next)) continue;
        visited.add(next);
        queue.push(next);
        if (next < minPosition) minPosition = next;
      }
    }

    // Sort box positions for canonical form
    var boxTokens = boxes.map(function(b) {
      return b[2] + ":" + b[0] + "," + b[1];
    }).sort();

    return minPosition + "|" + boxTokens.join(";");
  }

  return { buildRetrogradeTable };
});
