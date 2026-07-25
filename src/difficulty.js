(function attachDifficulty(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindDifficulty = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function classifyPuzzle(board, dense, topology) {
    const features = extractFeatures(board, dense, topology);
    const profile = determineProfile(features);
    return { features, profile, strategy: recommendStrategy(profile) };
  }

  function extractFeatures(board, dense, topology) {
    // Count boxes from the board's goals map — each goal corresponds to a box
    // In the solver engine, board.goals is a Map<position, label>
    const goalPositions = board?.goals;
    const boxCount = goalPositions ? goalPositions.size : 0;

    // Floor cells from dense board keys
    const floorCellCount = dense?.keys?.length || 0;

    // Box to floor ratio
    const boxToFloorRatio = floorCellCount > 0 ? boxCount / floorCellCount : 0;

    // Room and corridor/tunnel counts from topology
    const roomCount = topology?.rooms?.length || 0;
    const tunnelSet = topology?.tunnels;
    const tunnelCount = tunnelSet ? (typeof tunnelSet.size === "number" ? tunnelSet.size : 0) : 0;

    // Corridor count: a tunnel "segment" is a maximal contiguous run of tunnel cells.
    // We approximate by counting connected components of tunnel cells.
    let corridorCount = 0;
    if (tunnelSet && tunnelSet.size > 0) {
      const remaining = new Set(tunnelSet);
      while (remaining.size > 0) {
        corridorCount++;
        const start = remaining.values().next().value;
        remaining.delete(start);
        const queue = [start];
        for (let head = 0; head < queue.length; head++) {
          const [y, x] = queue[head].split(",").map(Number);
          const neighbors = [
            `${y - 1},${x}`, `${y + 1},${x}`,
            `${y},${x - 1}`, `${y},${x + 1}`,
          ];
          for (const next of neighbors) {
            if (remaining.has(next)) {
              remaining.delete(next);
              queue.push(next);
            }
          }
        }
      }
    }

    // Dead end count: floor cells with only 1 floor neighbor
    let deadEndCount = 0;
    const floor = board?.floor;
    if (floor) {
      for (const position of floor) {
        const [y, x] = position.split(",").map(Number);
        let neighborCount = 0;
        const neighbors = [
          `${y - 1},${x}`, `${y + 1},${x}`,
          `${y},${x - 1}`, `${y},${x + 1}`,
        ];
        for (const next of neighbors) {
          if (floor.has(next)) neighborCount++;
        }
        if (neighborCount === 1) deadEndCount++;
      }
    }

    // Articulation points
    const articulationPoints = topology?.articulations;
    const articulationPointCount = articulationPoints
      ? (typeof articulationPoints.size === "number" ? articulationPoints.size : 0)
      : 0;

    // Distinct box labels
    const labelSet = goalPositions ? new Set(goalPositions.values()) : new Set();
    const labelCount = labelSet.size;

    // Congestion score: boxes / narrowest passage width.
    // Narrowest passage width approximation: minimum number of floor neighbors
    // across all articulation points (gate width = 1 for single-cell gates).
    let narrowestPassage = floorCellCount; // default: wide open
    if (articulationPoints && articulationPoints.size > 0 && floor) {
      for (const position of articulationPoints) {
        const [y, x] = position.split(",").map(Number);
        let neighborCount = 0;
        const neighbors = [
          `${y - 1},${x}`, `${y + 1},${x}`,
          `${y},${x - 1}`, `${y},${x + 1}`,
        ];
        for (const next of neighbors) {
          if (floor.has(next)) neighborCount++;
        }
        narrowestPassage = Math.min(narrowestPassage, neighborCount);
      }
    }
    const congestionScore = narrowestPassage > 0 ? boxCount / narrowestPassage : 0;

    // Goal cluster tightness: average Manhattan distance between all pairs of goals
    let goalClusterTightness = 0;
    if (goalPositions && goalPositions.size > 1) {
      const goalCoords = [...goalPositions.keys()].map(p => p.split(",").map(Number));
      let totalDistance = 0, pairCount = 0;
      for (let i = 0; i < goalCoords.length; i++) {
        for (let j = i + 1; j < goalCoords.length; j++) {
          totalDistance += Math.abs(goalCoords[i][0] - goalCoords[j][0]) +
                          Math.abs(goalCoords[i][1] - goalCoords[j][1]);
          pairCount++;
        }
      }
      goalClusterTightness = pairCount > 0 ? totalDistance / pairCount : 0;
    }

    // Initial dead risk: count of goals that are on dead-end positions
    // (cells with only 1 neighbor). These become dangerous because once a box
    // is pushed there it may be stuck.
    let initialDeadRisk = 0;
    if (goalPositions && floor) {
      for (const position of goalPositions.keys()) {
        const [y, x] = position.split(",").map(Number);
        let neighborCount = 0;
        const neighbors = [
          `${y - 1},${x}`, `${y + 1},${x}`,
          `${y},${x - 1}`, `${y},${x + 1}`,
        ];
        for (const next of neighbors) {
          if (floor.has(next)) neighborCount++;
        }
        // A goal in a dead-end (1 neighbor) or corner-adjacent (2 neighbors, both
        // along the same axis pair blocked by walls) is risky.
        if (neighborCount <= 1) initialDeadRisk++;
      }
    }

    return {
      boxCount,
      floorCellCount,
      boxToFloorRatio,
      roomCount,
      corridorCount,
      tunnelCount,
      deadEndCount,
      articulationPointCount,
      labelCount,
      congestionScore,
      goalClusterTightness,
      initialDeadRisk,
    };
  }

  function determineProfile(features) {
    if (features.boxCount < 4) return "trivial";
    if (features.boxCount > 20 || features.floorCellCount > 200) return "mega";
    if (features.tunnelCount > features.roomCount * 2) return "corridor";
    if (features.roomCount > 3 && features.articulationPointCount > 2) return "room-based";
    if (features.boxToFloorRatio < 0.05) return "open-field";
    if (features.boxToFloorRatio > 0.25) return "dense";
    return "medium";
  }

  function recommendStrategy(profile) {
    const strategies = {
      trivial: { primary: "astar", beamWidth: 0, workers: 1 },
      corridor: { primary: "ida-star", beamWidth: 64, workers: 2, enableTunnelMacros: true },
      "room-based": { primary: "plan-macro-beam", beamWidth: 256, workers: 4, enableGateOrder: true },
      "open-field": { primary: "fess", beamWidth: 512, workers: 4, enableDiversity: true },
      dense: { primary: "beam", beamWidth: 128, workers: 4, heavyDeadlock: true },
      mega: { primary: "decomposition-first", beamWidth: 256, workers: 6 },
      medium: { primary: "portfolio", beamWidth: 256, workers: 3 },
    };
    return strategies[profile] || strategies.medium;
  }

  return { classifyPuzzle, extractFeatures, determineProfile, recommendStrategy };
});
