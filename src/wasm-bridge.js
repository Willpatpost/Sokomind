(function attachWASMBridge(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindWASM = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  let wasmModule = null;
  let boardHandle = null;

  /**
   * Load and initialize the WASM module.
   *
   * For web: pass the URL to the .wasm file.
   * For Node.js: pass the path to the .wasm file or let it auto-detect.
   *
   * Returns true if successful, false if WASM is unavailable.
   */
  async function initWASM(wasmSource) {
    try {
      if (typeof wasmSource === "string" && typeof require === "function") {
        // Node.js path: load .wasm file directly
        const fs = require("node:fs");
        const path = require("node:path");
        const wasmPath = path.resolve(wasmSource);
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmImports = {};
        const {instance} = await WebAssembly.instantiate(wasmBuffer, wasmImports);
        wasmModule = instance.exports;
        return true;
      }
      if (wasmSource && typeof wasmSource === "object" && wasmSource.init_board) {
        // Pre-initialized WASM exports object
        wasmModule = wasmSource;
        return true;
      }
      if (typeof wasmSource === "string") {
        // Browser: fetch and instantiate
        const response = await fetch(wasmSource);
        const wasmBuffer = await response.arrayBuffer();
        const {instance} = await WebAssembly.instantiate(wasmBuffer, {});
        wasmModule = instance.exports;
        return true;
      }
      return false;
    } catch (error) {
      console.warn("WASM initialization failed:", error.message);
      wasmModule = null;
      return false;
    }
  }

  /**
   * Initialize a board from the dense board data structure.
   *
   * dense — the board.dense object from board.js parse()
   * goals — Map of position key to label
   * staticDeadCells — Set or array of position keys that are static dead
   *
   * Returns the board handle (number) or null if WASM not loaded.
   */
  function initBoard(dense, goals, staticDeadCells) {
    if (!wasmModule) return null;

    const n = dense.keys.length;
    // Flat buffer: [cell_count, width, neighbors..., goal_labels..., static_dead..., cell_y..., cell_x...]
    const bufferSize = 2 + n * 4 + n + n + n + n;
    const data = new Int32Array(bufferSize);

    data[0] = n;
    data[1] = dense.x ? Math.max(...Array.from(dense.x)) + 1 : 0;

    // Neighbors
    let offset = 2;
    for (let i = 0; i < n * 4; i++) {
      data[offset + i] = dense.neighbors[i];
    }
    offset += n * 4;

    // Goal labels (encode as integers: 0 = no goal, 1+ for labeled goals)
    const labelMap = new Map();
    let labelCounter = 1;
    if (goals) {
      for (const [position, label] of goals) {
        const id = dense.idByKey.get(position);
        if (id !== undefined) {
          if (!labelMap.has(label)) labelMap.set(label, labelCounter++);
          data[offset + id] = labelMap.get(label);
        }
      }
    }
    offset += n;

    // Static dead cells
    if (staticDeadCells) {
      for (const position of staticDeadCells) {
        const id = dense.idByKey.get(position);
        if (id !== undefined) data[offset + id] = 1;
      }
    }
    offset += n;

    // Cell Y coordinates
    for (let i = 0; i < n; i++) {
      data[offset + i] = dense.y[i];
    }
    offset += n;

    // Cell X coordinates
    for (let i = 0; i < n; i++) {
      data[offset + i] = dense.x[i];
    }

    boardHandle = wasmModule.init_board(data);
    return boardHandle;
  }

  /**
   * Compute reachable cells from robot position, avoiding boxes.
   *
   * robotCell — dense cell ID of robot
   * boxCells — array of dense cell IDs of boxes (numbers)
   *
   * Returns Uint8Array of reachable bits, or null if WASM not loaded.
   */
  function computeReachable(robotCell, boxCells) {
    if (!wasmModule || boardHandle === null) return null;
    const boxes = new Uint32Array(boxCells);
    return wasmModule.compute_reachable(boardHandle, robotCell, boxes);
  }

  /**
   * Generate push candidates.
   *
   * boxCells — array of dense cell IDs of boxes
   * reachableBits — Uint8Array from computeReachable
   *
   * Returns array of {boxIndex, direction, destination, support} objects,
   * or null if WASM not loaded.
   */
  function generatePushes(boxCells, reachableBits) {
    if (!wasmModule || boardHandle === null) return null;
    const boxes = new Uint32Array(boxCells);
    const flat = wasmModule.generate_push_candidates(boardHandle, boxes, reachableBits);
    const result = [];
    for (let i = 0; i < flat.length; i += 4) {
      result.push({
        boxIndex: flat[i],
        direction: flat[i + 1],
        destination: flat[i + 2],
        support: flat[i + 3],
      });
    }
    return result;
  }

  /**
   * Check if a position is a deadlock (corner or 2x2).
   *
   * boxCells — array of dense cell IDs of boxes (after move)
   * movedCell — the cell ID where a box was just moved
   *
   * Returns boolean, or null if WASM not loaded.
   */
  function checkDeadlock(boxCells, movedCell) {
    if (!wasmModule || boardHandle === null) return null;
    const boxes = new Uint32Array(boxCells);
    return wasmModule.check_deadlocks(boardHandle, boxes, movedCell);
  }

  /**
   * Minimum-cost assignment via Hungarian algorithm.
   *
   * costs — flat Int32Array or array of i32 values (row-major)
   * rows — number of rows
   * cols — number of columns
   *
   * Returns minimum cost (number), or null if WASM not loaded.
   */
  function hungarianAssignment(costs, rows, cols) {
    if (!wasmModule) return null;
    const costArray = costs instanceof Int32Array ? costs : new Int32Array(costs);
    return wasmModule.min_cost_assignment(costArray, rows, cols);
  }

  /**
   * Reset stored board state. Call when switching puzzles.
   */
  function resetBoard() {
    if (!wasmModule) return;
    boardHandle = null;
    if (wasmModule.reset) wasmModule.reset();
  }

  return {
    initWASM,
    initBoard,
    computeReachable,
    generatePushes,
    checkDeadlock,
    hungarianAssignment,
    resetBoard,
    get isLoaded() { return wasmModule !== null; },
    get boardHandle() { return boardHandle; },
  };
});
