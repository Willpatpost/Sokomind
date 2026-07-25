// Solution improvement via local optimization strategies.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

(function attachSolutionImprovement(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindSolutionImprovement = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  // 1. Push Permutation Optimizer
  // Identifies independent pushes that can be reordered to reduce total moves.
  // Two pushes are independent if they move different boxes and the player
  // can reroute between them.

  function findIndependentPushGroups(path, board) {
    // Walk the solution path, tracking push events.
    // A push occurs when the player moves into a cell occupied by a box
    // and that box advances one cell in the same direction.
    const pushEvents = [];
    const boxes = new Map(); // pkey -> label
    const goals = board ? board.goals : new Map();
    const floor = board ? board.floor : new Set();

    // Initialize boxes from board data if available
    if (board && board.rows) {
      board.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === "X" || (/[A-Z]/.test(ch) && !"ORS".includes(ch))) {
          boxes.set(`${y},${x}`, ch);
        }
      }));
    }

    let playerY = 0, playerX = 0;
    if (board && board.rows) {
      board.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === "R") { playerY = y; playerX = x; }
      }));
    }

    const directionDeltas = {Up: [-1, 0], Down: [1, 0], Left: [0, -1], Right: [0, 1]};

    for (let i = 0; i < path.length; i++) {
      const move = path[i];
      const delta = directionDeltas[move];
      if (!delta) continue;

      const [dy, dx] = delta;
      const nextY = playerY + dy;
      const nextX = playerX + dx;
      const nextKey = `${nextY},${nextX}`;

      if (boxes.has(nextKey)) {
        const destY = nextY + dy;
        const destX = nextX + dx;
        const destKey = `${destY},${destX}`;
        const label = boxes.get(nextKey);

        pushEvents.push({
          moveIndex: i,
          direction: move,
          boxFrom: nextKey,
          boxTo: destKey,
          label,
          playerFrom: `${playerY},${playerX}`,
        });

        boxes.delete(nextKey);
        boxes.set(destKey, label);
      }

      playerY += dy;
      playerX += dx;
    }

    // Build dependency graph: push A depends on push B if
    // B must happen before A (B moves a box that A's path needs clear,
    // or B places a box that A pushes).
    const dependencies = new Map();
    for (let i = 0; i < pushEvents.length; i++) {
      dependencies.set(i, new Set());
    }

    for (let i = 1; i < pushEvents.length; i++) {
      for (let j = 0; j < i; j++) {
        // Push i depends on push j if:
        // (a) push j moves the same box that push i pushes (chain dependency)
        if (pushEvents[j].boxTo === pushEvents[i].boxFrom &&
            pushEvents[j].label === pushEvents[i].label) {
          dependencies.get(i).add(j);
        }
        // (b) push j moves a box out of a cell that push i needs clear
        //     (the destination cell for push i's box)
        if (pushEvents[j].boxFrom === pushEvents[i].boxTo) {
          dependencies.get(i).add(j);
        }
        // (c) push j places a box at the position push i pushes from
        //     (push i's box wouldn't be there without j completing)
        if (pushEvents[j].boxTo === pushEvents[i].boxFrom &&
            pushEvents[j].label === pushEvents[i].label) {
          dependencies.get(i).add(j);
        }
      }
    }

    // Find independent groups: pushes in the same group have no dependency
    // path between each other.
    const groups = [];
    const assigned = new Set();

    for (let i = 0; i < pushEvents.length; i++) {
      if (assigned.has(i)) continue;
      const group = [i];
      assigned.add(i);

      // Collect all transitively connected pushes
      const visited = new Set([i]);
      const queue = [i];
      while (queue.length > 0) {
        const current = queue.shift();
        // Forward dependencies
        for (const dep of dependencies.get(current) || []) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
            if (!assigned.has(dep)) {
              assigned.add(dep);
              group.push(dep);
            }
          }
        }
        // Reverse dependencies (who depends on current?)
        for (let j = 0; j < pushEvents.length; j++) {
          if (!visited.has(j) && dependencies.get(j)?.has(current)) {
            visited.add(j);
            queue.push(j);
            if (!assigned.has(j)) {
              assigned.add(j);
              group.push(j);
            }
          }
        }
      }

      group.sort((a, b) => a - b);
      groups.push(group);
    }

    return { pushEvents, dependencies, groups };
  }

  function optimizePushOrder(pushGroups, board) {
    // For each independent group, try all permutations (if small, <= 6)
    // or use heuristic ordering (if large) to minimize total player movement.
    if (!pushGroups || !pushGroups.pushEvents || pushGroups.pushEvents.length === 0) {
      return null;
    }

    const { pushEvents, dependencies, groups } = pushGroups;

    // For now, only attempt reordering within groups of size <= 6
    // to keep it tractable. Returns null if no improvement is possible.
    let improved = false;

    for (const group of groups) {
      if (group.length <= 1 || group.length > 6) continue;

      // Check if any reordering is actually possible given dependencies
      const hasFlexibility = group.some(i =>
        group.some(j => i !== j &&
          !dependencies.get(i)?.has(j) &&
          !dependencies.get(j)?.has(i)));

      if (!hasFlexibility) continue;
      improved = true;
    }

    // If no reordering flexibility, return null (no improvement)
    if (!improved) return null;

    // Return the original path since actual reordering requires full
    // path reconstruction with player movement, which depends on
    // the specific board geometry.
    return null;
  }

  // 2. Segment Optimizer
  // Split solution at goal-filling events, re-solve each segment.

  function splitAtGoalEvents(path, initialState, board) {
    // Walk through the solution, find points where a box reaches its goal.
    // Split into segments between consecutive goal events.
    const segments = [];
    if (!path || path.length === 0) return segments;
    if (!board || !board.goals) return segments;

    const goals = board.goals;
    const directionDeltas = {Up: [-1, 0], Down: [1, 0], Left: [0, -1], Right: [0, 1]};

    // Track current box positions
    const boxes = new Map(); // pkey -> label
    let playerY, playerX;

    if (initialState) {
      if (initialState.robot) {
        playerY = initialState.robot[0];
        playerX = initialState.robot[1];
      }
      if (initialState.boxes) {
        for (const box of initialState.boxes) {
          if (Array.isArray(box) && box.length >= 3) {
            boxes.set(`${box[0]},${box[1]}`, box[2]);
          }
        }
      }
    }

    const goalEvents = []; // indices where a box lands on its goal
    let segmentStartIndex = 0;
    const segmentStartState = {
      robot: [playerY, playerX],
      boxes: new Map(boxes),
    };

    for (let i = 0; i < path.length; i++) {
      const move = path[i];
      const delta = directionDeltas[move];
      if (!delta) continue;

      const [dy, dx] = delta;
      const nextY = playerY + dy;
      const nextX = playerX + dx;
      const nextKey = `${nextY},${nextX}`;

      if (boxes.has(nextKey)) {
        const destY = nextY + dy;
        const destX = nextX + dx;
        const destKey = `${destY},${destX}`;
        const label = boxes.get(nextKey);

        boxes.delete(nextKey);
        boxes.set(destKey, label);

        // Check if box landed on its matching goal
        if (goals.get(destKey) === label) {
          goalEvents.push({
            moveIndex: i,
            boxKey: destKey,
            label,
          });

          // Create a segment from the last split point to here
          segments.push({
            startIndex: segmentStartIndex,
            endIndex: i + 1,
            path: path.slice(segmentStartIndex, i + 1),
            goalEvent: { boxKey: destKey, label },
          });

          segmentStartIndex = i + 1;
        }
      }

      playerY += dy;
      playerX += dx;
    }

    // Add final segment if there are remaining moves after the last goal event
    if (segmentStartIndex < path.length) {
      segments.push({
        startIndex: segmentStartIndex,
        endIndex: path.length,
        path: path.slice(segmentStartIndex),
        goalEvent: null,
      });
    }

    return segments;
  }

  function optimizeSegment(segment, board, maxStates) {
    // Re-solve a segment using bounded search with the known move count
    // as an upper bound. If a shorter segment is found, return it.
    // Otherwise return the original.
    maxStates = maxStates || 10000;

    if (!segment || !segment.path || segment.path.length <= 1) {
      return segment;
    }

    // Without access to the full search infrastructure in this scope,
    // return the original segment. The actual optimization is done
    // by the solutionWindowRewriteSearch in solver-search.js.
    return segment;
  }

  // 3. Multi-pass Improvement Loop

  function improveSolution(path, initialState, board, options) {
    options = options || {};
    const maxRounds = options.maxRounds || 3;
    const maxStatesPerSegment = options.maxStatesPerSegment || 10000;
    const timeLimit = options.timeLimitMs || 5000;

    if (!path || path.length === 0) {
      return {
        path: path || [],
        originalMoves: 0,
        improvedMoves: 0,
        improvements: [],
        reduction: 0,
      };
    }

    let current = path.slice();
    let currentMoves = path.length;
    const improvements = [];
    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    for (let round = 0; round < maxRounds; round++) {
      const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime;
      if (elapsed > timeLimit) break;

      // Round 1: Attempt push permutation optimization
      if (round === 0 && board) {
        const groups = findIndependentPushGroups(current, board);
        const reordered = optimizePushOrder(groups, board);
        if (reordered && reordered.length < currentMoves) {
          improvements.push({
            round,
            type: "permutation",
            from: currentMoves,
            to: reordered.length,
          });
          current = reordered;
          currentMoves = reordered.length;
        }
      }

      // Round 2+: Segment optimization
      if (board) {
        const segments = splitAtGoalEvents(current, initialState, board);
        for (const segment of segments) {
          const improved = optimizeSegment(segment, board, maxStatesPerSegment);
          if (improved.path && improved.path.length < segment.path.length) {
            // Splice improved segment into current solution
            const before = current.slice(0, segment.startIndex);
            const after = current.slice(segment.endIndex);
            current = [...before, ...improved.path, ...after];
            const newMoves = current.length;
            if (newMoves < currentMoves) {
              improvements.push({
                round,
                type: "segment",
                from: currentMoves,
                to: newMoves,
              });
              currentMoves = newMoves;
            }
          }
        }
      }
    }

    return {
      path: current,
      originalMoves: path.length,
      improvedMoves: currentMoves,
      improvements,
      reduction: path.length - currentMoves,
    };
  }

  return {
    findIndependentPushGroups,
    optimizePushOrder,
    splitAtGoalEvents,
    optimizeSegment,
    improveSolution,
  };
});
