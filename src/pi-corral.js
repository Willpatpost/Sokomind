// PI-Corral (Player-Inaccessible Corral) deadlock detection.
// After each push, identifies connected components of floor cells
// NOT reachable by the player and checks for deadlock conditions
// within those corrals.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

function piCorralDeadlock(boxes, board, movedBox) {
  const movedKey = pkey(movedBox[0], movedBox[1]);
  const occupied = new Map(boxes.map(([y, x, label]) => [pkey(y, x), label]));
  const {dense} = board;
  const dirCount = DIRECTION_ENTRIES.length;
  const cellCount = dense.keys.length;

  const movedId = dense.idByKey.get(movedKey);
  if (movedId === undefined) return false;

  let playerStart = -1;
  for (let direction = 0; direction < dirCount; direction++) {
    const neighbor = dense.neighbors[movedId * dirCount + direction];
    if (neighbor >= 0 && !occupied.has(dense.keys[neighbor])) {
      playerStart = neighbor;
      break;
    }
  }
  if (playerStart < 0) return false;

  // Reuse typed arrays across calls via board-attached storage
  board.piCorralEpoch = (board.piCorralEpoch || 0) + 1;
  if (board.piCorralEpoch === 0xffffffff) board.piCorralEpoch = 1;
  const epoch = board.piCorralEpoch;
  if (!board.piCorralReachable || board.piCorralReachable.length < cellCount) {
    board.piCorralReachable = new Uint32Array(cellCount);
    board.piCorralVisited = new Uint32Array(cellCount);
    board.piCorralQueue = new Int32Array(cellCount);
  }
  const reachable = board.piCorralReachable;
  const bfsQueue = board.piCorralQueue;

  reachable[playerStart] = epoch;
  bfsQueue[0] = playerStart;
  let head = 0, tail = 1;
  while (head < tail) {
    const current = bfsQueue[head++];
    for (let direction = 0; direction < dirCount; direction++) {
      const next = dense.neighbors[current * dirCount + direction];
      if (next < 0 || reachable[next] === epoch ||
          occupied.has(dense.keys[next])) continue;
      reachable[next] = epoch;
      bfsQueue[tail++] = next;
    }
  }

  const visited = board.piCorralVisited;
  for (let cellId = 0; cellId < cellCount; cellId++) {
    if (reachable[cellId] === epoch || visited[cellId] === epoch) continue;
    const componentCells = [];
    const componentQueue = [cellId];
    visited[cellId] = epoch;
    let cHead = 0;
    while (cHead < componentQueue.length) {
      const current = componentQueue[cHead++];
      componentCells.push(current);
      for (let direction = 0; direction < dirCount; direction++) {
        const next = dense.neighbors[current * dirCount + direction];
        if (next < 0 || reachable[next] === epoch ||
            visited[next] === epoch) continue;
        visited[next] = epoch;
        componentQueue.push(next);
      }
    }

    const corralBoxes = [];
    let hasUnsolved = false;
    for (const cId of componentCells) {
      const key = dense.keys[cId];
      const boxLabel = occupied.get(key);
      if (boxLabel !== undefined) {
        corralBoxes.push({cellId: cId, key, label: boxLabel});
        if (board.goals.get(key) !== boxLabel) hasUnsolved = true;
      }
    }

    if (corralBoxes.length === 0 || !hasUnsolved) continue;

    for (const box of corralBoxes) {
      const [y, x] = box.key.split(",").map(Number);
      if (staticDead(y, x, board, box.label)) {
        board.metrics.piCorralStaticDeadPrunes =
          (board.metrics.piCorralStaticDeadPrunes || 0) + 1;
        return true;
      }
    }

    // Sealed check: if no box in the corral can be pushed (player can't
    // reach a support cell with a free destination), the corral is sealed
    // and any unsolved box is dead. Mirrors createsSealedCorralDeadlock.
    let canOpen = false;
    for (const box of corralBoxes) {
      for (let direction = 0; direction < dirCount; direction++) {
        const support = dense.neighbors[
          box.cellId * dirCount + OPPOSITE_DIRECTION_INDEX[direction]
        ];
        const dest = dense.neighbors[box.cellId * dirCount + direction];
        if (support >= 0 && reachable[support] === epoch &&
            dest >= 0 && !occupied.has(dense.keys[dest])) {
          canOpen = true;
          break;
        }
      }
      if (canOpen) break;
    }
    if (!canOpen) {
      board.metrics.piCorralSealedPrunes =
        (board.metrics.piCorralSealedPrunes || 0) + 1;
      return true;
    }

    if (corralBoxes.length >= 2) {
      let allFrozen = true;
      for (const box of corralBoxes) {
        const leftId = dense.neighbors[box.cellId * dirCount + 2];
        const rightId = dense.neighbors[box.cellId * dirCount + 3];
        const upId = dense.neighbors[box.cellId * dirCount + 0];
        const downId = dense.neighbors[box.cellId * dirCount + 1];
        const hBlocked = (leftId < 0 || occupied.has(dense.keys[leftId])) &&
                          (rightId < 0 || occupied.has(dense.keys[rightId]));
        const vBlocked = (upId < 0 || occupied.has(dense.keys[upId])) &&
                          (downId < 0 || occupied.has(dense.keys[downId]));
        if (!hBlocked || !vBlocked) {
          allFrozen = false;
          break;
        }
      }
      if (allFrozen && hasUnsolved) {
        board.metrics.piCorralFrozenPrunes =
          (board.metrics.piCorralFrozenPrunes || 0) + 1;
        return true;
      }
    }
  }

  return false;
}

// --- Module registration ---
const SokomindPICorral = {
  piCorralDeadlock,
};
if (typeof globalThis !== "undefined") globalThis.SokomindPICorral = SokomindPICorral;
if (typeof module === "object" && module.exports) module.exports = SokomindPICorral;
