// Chokepoint and congestion mapping for Sokoban solvers.
// Identifies narrow passages where box traffic jams are likely.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

function identifyChokepoints(board, dense) {
  const useDense = dense || board.dense;
  const traffic = new Map();
  const capacity = new Map();

  for (const position of board.floor) {
    traffic.set(position, 0);
  }

  for (const position of board.floor) {
    const neighbors = floorNeighbors(position, board.floor);
    if (neighbors.length <= 2) {
      capacity.set(position, 1);
    } else {
      capacity.set(position, Math.min(neighbors.length - 1, 3));
    }
  }

  for (const [goalPosition] of board.goals) {
    const goalDistances = board.pushDistances?.get(goalPosition);
    if (!goalDistances) continue;

    const visited = new Set([goalPosition]);
    const queue = [goalPosition];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      const currentDist = goalDistances.get(current);
      if (currentDist === undefined) continue;

      const [cy, cx] = current.split(",").map(Number);
      for (const [dy, dx] of Object.values(DIRS)) {
        const neighbor = pkey(cy + dy, cx + dx);
        if (visited.has(neighbor)) continue;
        const neighborDist = goalDistances.get(neighbor);
        if (neighborDist === undefined) continue;
        if (neighborDist === currentDist + 1) {
          visited.add(neighbor);
          queue.push(neighbor);
          traffic.set(current, (traffic.get(current) || 0) + 1);
        }
      }
    }
  }

  const articulations = board.topology?.articulations;
  if (articulations) {
    for (const ap of articulations) {
      traffic.set(ap, (traffic.get(ap) || 0) + 2);
    }
  }

  const tunnels = board.topology?.tunnels;
  if (tunnels) {
    for (const tp of tunnels) {
      traffic.set(tp, (traffic.get(tp) || 0) + 1);
    }
  }

  const chokepoints = [];
  const maxTraffic = Math.max(1, ...[...traffic.values()]);

  for (const [position, count] of traffic) {
    if (count <= 0) continue;
    const cap = capacity.get(position) || 1;
    const severity = count / (cap * maxTraffic);

    if (count >= 2 || cap === 1) {
      chokepoints.push({
        position,
        traffic: count,
        capacity: cap,
        severity,
      });
    }
  }

  chokepoints.sort((a, b) => b.severity - a.severity || b.traffic - a.traffic);

  return { traffic, capacity, chokepoints };
}

function congestionPenalty(boxes, chokepointData) {
  if (!chokepointData || !chokepointData.chokepoints.length) return 0;

  const boxPositions = new Set(boxes.map(([y, x]) => pkey(y, x)));
  let penalty = 0;

  for (const cp of chokepointData.chokepoints) {
    const [cpy, cpx] = cp.position.split(",").map(Number);

    let nearbyBoxes = 0;
    if (boxPositions.has(cp.position)) nearbyBoxes++;

    for (const [dy, dx] of Object.values(DIRS)) {
      const neighbor = pkey(cpy + dy, cpx + dx);
      if (boxPositions.has(neighbor)) nearbyBoxes++;
    }

    for (const [dy, dx] of Object.values(DIRS)) {
      const far = pkey(cpy + 2 * dy, cpx + 2 * dx);
      if (boxPositions.has(far)) nearbyBoxes += 0.5;
    }

    if (nearbyBoxes > cp.capacity) {
      const excess = nearbyBoxes - cp.capacity;
      penalty += excess * cp.severity * 2;
    }
  }

  return penalty;
}

// --- Module registration ---
const SokomindChokepoint = {
  identifyChokepoints,
  congestionPenalty,
};
if (typeof globalThis !== "undefined") globalThis.SokomindChokepoint = SokomindChokepoint;
if (typeof module === "object" && module.exports) module.exports = SokomindChokepoint;
