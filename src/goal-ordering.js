// Goal ordering and dependency analysis for Sokoban solvers.
// Computes optimal order to fill goals to avoid creating deadlocks.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

(function attachGoalOrdering(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindGoalOrdering = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  /**
   * For each goal G, find which other goals must NOT be filled yet when filling G.
   * If filling goal B would block push-access to goal A, then A depends on B
   * (A must be filled before B, i.e. B→A in dependency order means "fill A first").
   *
   * Uses topology room data when available, falls back to direct push-distance analysis.
   *
   * Returns a Map of goal position -> Set of goals that must be filled AFTER it.
   * Edge semantics: if dependencies.get(A).has(B), then A must be filled before B.
   */
  function computeGoalDependencies(board, topology) {
    const dependencies = new Map();
    const allGoals = [...board.goals.keys()];

    for (const goal of allGoals) {
      dependencies.set(goal, new Set());
    }

    // Use topology room analysis if available
    const rooms = topology?.rooms || board.topology?.rooms || [];
    for (const room of rooms) {
      // Room dependencies are [blocker, target] pairs meaning:
      // if blocker is filled, target becomes unreachable.
      // So target must be filled BEFORE blocker.
      // In our graph: target → blocker (fill target before blocker)
      for (const [blocker, target] of room.dependencies) {
        // target must be filled before blocker
        // So target depends on nothing from blocker, but blocker depends on target
        if (dependencies.has(target)) {
          dependencies.get(target).add(blocker);
        }
      }

      // Depth-based ordering: deeper goals should be filled first
      // If goal A is deeper than goal B in a room, A should be filled first
      if (room.depths && room.goals.length > 1) {
        const goalDepths = room.goals
          .map(goal => ({goal, depth: room.depths.get(goal) || 0}))
          .sort((a, b) => b.depth - a.depth);

        for (let i = 0; i < goalDepths.length; i++) {
          for (let j = i + 1; j < goalDepths.length; j++) {
            const deeper = goalDepths[i];
            const shallower = goalDepths[j];
            if (deeper.depth > shallower.depth) {
              // Deeper goal must be filled first, so deeper → shallower
              // (shallower comes after deeper)
              if (dependencies.has(deeper.goal)) {
                dependencies.get(deeper.goal).add(shallower.goal);
              }
            }
          }
        }
      }
    }

    // For goals not in rooms, check if filling one blocks push access to another
    // using push distance tables
    if (board.pushDistances) {
      for (const goalA of allGoals) {
        for (const goalB of allGoals) {
          if (goalA === goalB) continue;
          // Check if goalA is on a shortest push path to goalB
          const distToB = board.pushDistances.get(goalB);
          if (!distToB) continue;
          const distA = distToB.get(goalA);
          if (distA === undefined) continue;

          // Check neighbors of goalA to see if it's on a critical path
          const [ay, ax] = goalA.split(",").map(Number);
          let onPath = false;
          for (const [dy, dx] of Object.values(DIRS)) {
            const neighbor = pkey(ay + dy, ax + dx);
            const neighborDist = distToB.get(neighbor);
            if (neighborDist !== undefined && neighborDist === distA + 1) {
              onPath = true;
              break;
            }
          }
          // If goalA lies on a push path to goalB, filling A might block B
          // So B should be filled before A → B depends on nothing from A,
          // but A depends on B being done first
          // In our dependency map: B → A (B must be filled before A)
          if (onPath && distA > 0) {
            if (dependencies.has(goalB)) {
              dependencies.get(goalB).add(goalA);
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Topological sort of the dependency graph using Kahn's algorithm.
   * Returns array of goals in the order they should be filled (first = fill first).
   *
   * dependencies: Map of goal -> Set of goals that come AFTER it.
   * If there are cycles, returns goals in best-effort order.
   */
  function topologicalGoalOrder(dependencies) {
    // Build in-degree map
    const inDegree = new Map();
    const allNodes = new Set();

    for (const [node, successors] of dependencies) {
      allNodes.add(node);
      if (!inDegree.has(node)) inDegree.set(node, 0);
      for (const successor of successors) {
        allNodes.add(successor);
        inDegree.set(successor, (inDegree.get(successor) || 0) + 1);
      }
    }

    // Initialize queue with nodes having zero in-degree
    const queue = [];
    for (const node of allNodes) {
      if ((inDegree.get(node) || 0) === 0) {
        queue.push(node);
      }
    }

    // Sort the queue for deterministic output
    queue.sort();

    const ordered = [];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      ordered.push(current);

      const successors = dependencies.get(current);
      if (!successors) continue;

      const ready = [];
      for (const successor of successors) {
        const newDegree = inDegree.get(successor) - 1;
        inDegree.set(successor, newDegree);
        if (newDegree === 0) ready.push(successor);
      }
      // Sort newly ready nodes for deterministic ordering
      ready.sort();
      queue.push(...ready);
    }

    // Handle cycles: add remaining nodes that weren't visited
    if (ordered.length < allNodes.size) {
      const remaining = [...allNodes]
        .filter(node => !ordered.includes(node))
        .sort();
      ordered.push(...remaining);
    }

    return ordered;
  }

  /**
   * Score a state based on how well it follows the goal order.
   * States that fill goals in correct order get bonus (lower score).
   * Returns a numeric score (lower is better).
   *
   * state: object with .boxes array of [y, x, label]
   * board: parsed board with .goals Map
   * goalOrder: array from topologicalGoalOrder
   */
  function goalOrderScore(state, board, goalOrder) {
    if (!goalOrder || !goalOrder.length) return 0;

    const filledGoals = new Set();
    for (const [y, x, label] of state.boxes) {
      const position = pkey(y, x);
      if (board.goals.get(position) === label) {
        filledGoals.add(position);
      }
    }

    if (filledGoals.size === 0) return 0;

    let penalty = 0;
    const orderIndex = new Map(goalOrder.map((goal, index) => [goal, index]));

    // Check each filled goal - if a later-ordered goal is filled but
    // an earlier-ordered goal is not, that's a penalty
    for (const filled of filledGoals) {
      const filledIdx = orderIndex.get(filled);
      if (filledIdx === undefined) continue;

      for (const goal of goalOrder) {
        const goalIdx = orderIndex.get(goal);
        if (goalIdx === undefined) continue;

        // If this goal should have been filled before the filled one,
        // but it isn't filled yet, penalize
        if (goalIdx < filledIdx && !filledGoals.has(goal)) {
          penalty += 1 + (filledIdx - goalIdx);
        }
      }
    }

    return penalty;
  }

  return { computeGoalDependencies, topologicalGoalOrder, goalOrderScore };
});
