const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// Load the WASM module built with wasm-pack --target nodejs
// The nodejs build is at pkg-node/, the web build at pkg/.
const WASM_NODE_DIR = path.join(__dirname, "..", "..", "wasm", "sokomind-core", "pkg-node");
const WASM_WEB_DIR = path.join(__dirname, "..", "..", "wasm", "sokomind-core", "pkg");

// Helper to load WASM module (prefer --target nodejs build for testing)
async function loadWasm() {
  // Try nodejs build first
  const nodeGlue = path.join(WASM_NODE_DIR, "sokomind_core.js");
  if (fs.existsSync(nodeGlue)) {
    return require(nodeGlue);
  }

  // Fallback: try web build's raw .wasm
  const wasmPath = path.join(WASM_WEB_DIR, "sokomind_core_bg.wasm");
  if (fs.existsSync(wasmPath)) {
    const wasmBuffer = fs.readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {});
    return instance.exports;
  }

  throw new Error(
    "WASM module not found. Run:\n" +
    "  cd wasm/sokomind-core && wasm-pack build --target nodejs --release --out-dir pkg-node"
  );
}

/**
 * Build a flat board buffer for the ultra-tiny puzzle:
 *
 *   OOOOO
 *   O R O    (row 1: robot at col 2)
 *   O A O    (row 2: box A at col 2)
 *   O a O    (row 3: goal 'a' at col 2)
 *   OOOOO
 *
 * Floor cells (not walls):
 *   (1,1) (1,2) (1,3)
 *   (2,1) (2,2) (2,3)
 *   (3,1) (3,2) (3,3)
 *
 * Dense IDs (in row-major order):
 *   0=(1,1) 1=(1,2) 2=(1,3)
 *   3=(2,1) 4=(2,2) 5=(2,3)
 *   6=(3,1) 7=(3,2) 8=(3,3)
 *
 * Neighbors (Up=0, Down=1, Left=2, Right=3):
 *   Cell 0 (1,1): Up=-1, Down=3, Left=-1, Right=1
 *   Cell 1 (1,2): Up=-1, Down=4, Left=0, Right=2
 *   Cell 2 (1,3): Up=-1, Down=5, Left=1, Right=-1
 *   Cell 3 (2,1): Up=0, Down=6, Left=-1, Right=4
 *   Cell 4 (2,2): Up=1, Down=7, Left=3, Right=5
 *   Cell 5 (2,3): Up=2, Down=8, Left=4, Right=-1
 *   Cell 6 (3,1): Up=3, Down=-1, Left=-1, Right=7
 *   Cell 7 (3,2): Up=4, Down=-1, Left=6, Right=8
 *   Cell 8 (3,3): Up=5, Down=-1, Left=7, Right=-1
 */
function buildUltraTinyBoard() {
  const cellCount = 9;
  const width = 5;
  const neighbors = new Int32Array([
    // Cell 0 (1,1)
    -1, 3, -1, 1,
    // Cell 1 (1,2)
    -1, 4,  0, 2,
    // Cell 2 (1,3)
    -1, 5,  1, -1,
    // Cell 3 (2,1)
     0, 6, -1, 4,
    // Cell 4 (2,2)
     1, 7,  3, 5,
    // Cell 5 (2,3)
     2, 8,  4, -1,
    // Cell 6 (3,1)
     3, -1, -1, 7,
    // Cell 7 (3,2) — goal 'a'
     4, -1,  6, 8,
    // Cell 8 (3,3)
     5, -1,  7, -1,
  ]);

  // Goal labels: only cell 7 has a goal (label=1 for 'a'/A)
  const goalLabels = new Int32Array(cellCount);
  goalLabels[7] = 1;

  // Static dead: corner cells are static dead (0, 2, 6, 8)
  // These are cells where a box can never reach a goal.
  const staticDead = new Int32Array(cellCount);
  staticDead[0] = 1; // corner (1,1)
  staticDead[2] = 1; // corner (1,3)
  staticDead[6] = 1; // corner (3,1)
  staticDead[8] = 1; // corner (3,3)

  // Cell coordinates
  const cellY = new Int32Array([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  const cellX = new Int32Array([1, 2, 3, 1, 2, 3, 1, 2, 3]);

  // Build flat buffer
  // Layout: [cell_count, width, neighbors..., goal_labels..., static_dead..., cell_y..., cell_x...]
  const bufferSize = 2 + cellCount * 4 + cellCount + cellCount + cellCount + cellCount;
  const data = new Int32Array(bufferSize);
  let offset = 0;
  data[offset++] = cellCount;
  data[offset++] = width;
  for (let i = 0; i < cellCount * 4; i++) data[offset++] = neighbors[i];
  for (let i = 0; i < cellCount; i++) data[offset++] = goalLabels[i];
  for (let i = 0; i < cellCount; i++) data[offset++] = staticDead[i];
  for (let i = 0; i < cellCount; i++) data[offset++] = cellY[i];
  for (let i = 0; i < cellCount; i++) data[offset++] = cellX[i];

  return {data, cellCount, robotCell: 1, boxCell: 4, goalCell: 7};
}

describe("WASM core module", async () => {
  let wasm;
  let boardId;
  let board;

  // Try to load WASM before tests
  try {
    wasm = await loadWasm();
  } catch (error) {
    console.warn(`Skipping WASM tests: ${error.message}`);
    return;
  }

  board = buildUltraTinyBoard();

  it("init_board creates a valid board handle", () => {
    boardId = wasm.init_board(board.data);
    assert.equal(typeof boardId, "number");
    assert.ok(boardId >= 0);
  });

  it("compute_reachable returns correct reachability from robot position", () => {
    // Robot at cell 1 (1,2), box at cell 4 (2,2)
    const boxes = new Uint32Array([board.boxCell]);
    const reachable = wasm.compute_reachable(boardId, board.robotCell, boxes);

    assert.equal(reachable.length, board.cellCount);

    // Robot at cell 1 can reach all cells EXCEPT cell 4 (the box itself),
    // because the 3x3 grid allows going around the box:
    //   1->0->3->6->7->8->5->2  (or similar routes)
    // Only cell 4 (the box) is unreachable.
    assert.equal(reachable[0], 1, "cell 0 should be reachable");
    assert.equal(reachable[1], 1, "cell 1 (robot) should be reachable");
    assert.equal(reachable[2], 1, "cell 2 should be reachable");
    assert.equal(reachable[3], 1, "cell 3 should be reachable");
    assert.equal(reachable[4], 0, "cell 4 (box) should not be reachable");
    assert.equal(reachable[5], 1, "cell 5 should be reachable");
    assert.equal(reachable[6], 1, "cell 6 reachable via 0->3->6");
    assert.equal(reachable[7], 1, "cell 7 reachable via 6->7 or 8->7");
    assert.equal(reachable[8], 1, "cell 8 reachable via 5->8 or 7->8");
  });

  it("compute_reachable with no boxes reaches all cells", () => {
    const boxes = new Uint32Array([]);
    const reachable = wasm.compute_reachable(boardId, 4, boxes);
    // From center cell 4, all 9 cells are reachable
    for (let i = 0; i < board.cellCount; i++) {
      assert.equal(reachable[i], 1, `cell ${i} should be reachable`);
    }
  });

  it("generate_push_candidates finds valid pushes", () => {
    const boxes = new Uint32Array([board.boxCell]); // box at cell 4
    const reachable = wasm.compute_reachable(boardId, board.robotCell, boxes);
    const pushes = wasm.generate_push_candidates(boardId, boxes, reachable);

    // pushes is flat: [box_idx, dir, dest, support, ...]
    assert.equal(pushes.length % 4, 0, "push array should be multiple of 4");

    const candidates = [];
    for (let i = 0; i < pushes.length; i += 4) {
      candidates.push({
        boxIndex: pushes[i],
        direction: pushes[i + 1],
        destination: pushes[i + 2],
        support: pushes[i + 3],
      });
    }

    // Box at cell 4 (2,2).
    // Robot reachable: 0, 1, 2, 3, 5
    // Possible pushes:
    //   Push Down (dir 1): support=Up(cell 1, reachable), dest=Down(cell 7, goal) -> valid
    //   Push Left (dir 2): support=Right(cell 5, reachable), dest=Left(cell 3, not static dead) -> valid
    //   Push Right (dir 3): support=Left(cell 3, reachable), dest=Right(cell 5, not static dead) -> valid
    //   Push Up (dir 0): support=Down(cell 7, NOT reachable), dest=Up(cell 1) -> INVALID (support unreachable)
    //
    // Note: static dead cells (0, 2, 6, 8) are corners.
    // Cell 3 and 5 are not static dead. Cell 7 is a goal, not static dead.
    assert.ok(candidates.length >= 2, `expected at least 2 push candidates, got ${candidates.length}`);

    // Check that push-down-to-goal is among them
    const downPush = candidates.find(c => c.direction === 1 && c.destination === 7);
    assert.ok(downPush, "should find push down to goal (cell 7)");
    assert.equal(downPush.support, 1, "support for down push should be cell 1");
  });

  it("check_deadlocks detects corner deadlock", () => {
    // Box at corner cell 0 (1,1) — should be dead
    const boxes = new Uint32Array([0]);
    const dead = wasm.check_deadlocks(boardId, boxes, 0);
    assert.equal(dead, true, "box in corner should be dead");
  });

  it("check_deadlocks allows box on goal", () => {
    // Box at cell 7 (goal cell) — should NOT be dead
    const boxes = new Uint32Array([7]);
    const dead = wasm.check_deadlocks(boardId, boxes, 7);
    assert.equal(dead, false, "box on goal should not be dead");
  });

  it("check_deadlocks detects non-corner non-dead", () => {
    // Box at cell 4 (center) — should not be dead
    const boxes = new Uint32Array([4]);
    const dead = wasm.check_deadlocks(boardId, boxes, 4);
    assert.equal(dead, false, "box in center should not be dead");
  });

  it("min_cost_assignment solves identity matrix", () => {
    const costs = new Int32Array([
      0, 10, 10,
      10, 0, 10,
      10, 10, 0,
    ]);
    const result = wasm.min_cost_assignment(costs, 3, 3);
    assert.equal(result, 0, "identity assignment should cost 0");
  });

  it("min_cost_assignment solves simple matrix", () => {
    const costs = new Int32Array([
      1, 2, 3,
      4, 5, 6,
      7, 8, 9,
    ]);
    const result = wasm.min_cost_assignment(costs, 3, 3);
    assert.equal(result, 15, "simple matrix optimal should be 15");
  });

  it("min_cost_assignment handles 1x1", () => {
    const costs = new Int32Array([42]);
    const result = wasm.min_cost_assignment(costs, 1, 1);
    assert.equal(result, 42);
  });

  it("min_cost_assignment handles rectangular matrix", () => {
    const costs = new Int32Array([
      5, 1, 3,
      2, 4, 6,
    ]);
    const result = wasm.min_cost_assignment(costs, 2, 3);
    assert.equal(result, 3, "2x3 matrix optimal: row0->col1(1) + row1->col0(2) = 3");
  });

  it("reset clears state", () => {
    wasm.reset();
    // Re-init should work after reset
    boardId = wasm.init_board(board.data);
    assert.equal(typeof boardId, "number");
  });
});
