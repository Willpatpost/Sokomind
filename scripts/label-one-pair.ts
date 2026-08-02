/**
 * Batch-labels every generic-only puzzle with one A/a labeled-box pair.
 *
 * For each puzzle that has zero labeled boxes:
 *   1. Solve it with the legacy engine to find ANY valid solution
 *   2. Replay the solution through the core to learn which box ends on which goal
 *   3. Pick the first generic box→goal pair and relabel X→A, S→a
 *   4. Verify the relabeled puzzle is still solved by the same path
 *   5. Write the modified imported-puzzles.json back
 *
 * Single-box puzzles skip the solve step (only one possible assignment).
 *
 * Usage:
 *   node --experimental-strip-types scripts/label-one-pair.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  PuzzleDefinition,
  Direction,
} from "../src/core/model.ts";
import { createSession, stepSnapshot } from "../src/core/game-session.ts";
import type { SolverRequest } from "../src/solver/contracts.ts";
import { search } from "../src/solver/implementations/sokomind-engine/engine.generated.js";
import {
  toLegacyState,
  solutionFromLegacyPath,
} from "../src/solver/implementations/sokomind-solver.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

const originalPostMessage = globalThis.postMessage;
globalThis.postMessage = (() => {}) as typeof globalThis.postMessage;

const LEGACY_TO_CORE: Readonly<Record<string, Direction>> = {
  Up: "up",
  Down: "down",
  Left: "left",
  Right: "right",
};

function hasLabeledBoxes(rows: readonly string[]): boolean {
  for (const row of rows) {
    if (/[A-NP-QT-WYZ]/.test(row)) return true;
  }
  return false;
}

function countGenericBoxes(rows: readonly string[]): number {
  let n = 0;
  for (const row of rows) for (const ch of row) if (ch === "X") n++;
  return n;
}

interface Pair {
  boxRow: number;
  boxCol: number;
  goalRow: number;
  goalCol: number;
}

function firstGenericPair(rows: readonly string[]): Pair | null {
  let br = -1, bc = -1, gr = -1, gc = -1;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === "X" && br < 0) { br = r; bc = c; }
      if (rows[r][c] === "S" && gr < 0) { gr = r; gc = c; }
    }
  }
  return br >= 0 && gr >= 0 ? { boxRow: br, boxCol: bc, goalRow: gr, goalCol: gc } : null;
}

function solveForMapping(puzzle: PuzzleDefinition): { pair: Pair; path: readonly unknown[] } | null {
  const session = createSession(puzzle);
  const request: SolverRequest = {
    board: session.board,
    snapshot: session.snapshot,
    objective: { kind: "moves" },
  };

  const state = toLegacyState(request);
  const nBoxes = request.snapshot.boxes.length;
  const nFloor = request.board.floor.length;
  const moderate = nBoxes >= 5 || nFloor >= 45;

  const result = search({
    algorithm: "ultimate",
    state,
    maxDepth: moderate ? 360 : 180,
    maxVisited: moderate ? 180_000 : 80_000,
    maxGenerated: moderate ? 1_200_000 : 300_000,
    transpositionLimit: moderate ? 36_000 : 30_000,
    beamWidth: 256,
    seed: 0,
    sequenceMacros: moderate,
    checkpointLimit: 8,
    progressInterval: 300_000,
    progressIntervalMs: 300_000,
  });

  if (!Array.isArray(result.path)) return null;

  let snapshot = request.snapshot;
  for (const v of result.path) {
    const d = LEGACY_TO_CORE[v as string];
    if (!d) return null;
    const t = stepSnapshot(request.board, snapshot, d);
    if (!t.moved) return null;
    snapshot = t.snapshot;
    if (snapshot.solved) break;
  }
  if (!snapshot.solved) return null;

  const initials = session.board.initialBoxes;
  const goals = session.board.goals;

  for (let i = 0; i < initials.length; i++) {
    const init = initials[i];
    if (init.label !== "X") continue;
    const fin = snapshot.boxes.find((b) => b.id === init.id);
    if (!fin) continue;
    const goal = goals.find(
      (g) =>
        g.position.row === fin.position.row &&
        g.position.column === fin.position.column &&
        g.label === "X",
    );
    if (!goal) continue;
    return {
      pair: {
        boxRow: init.position.row,
        boxCol: init.position.column,
        goalRow: goal.position.row,
        goalCol: goal.position.column,
      },
      path: result.path,
    };
  }
  return null;
}

function replaceChar(s: string, i: number, ch: string): string {
  return s.substring(0, i) + ch + s.substring(i + 1);
}

function relabel(puzzle: PuzzleDefinition, p: Pair): PuzzleDefinition {
  const rows = [...puzzle.rows];
  rows[p.boxRow] = replaceChar(rows[p.boxRow], p.boxCol, "A");
  rows[p.goalRow] = replaceChar(rows[p.goalRow], p.goalCol, "a");
  return { ...puzzle, rows };
}

function verify(puzzle: PuzzleDefinition, path: readonly unknown[]): boolean {
  try {
    const s = createSession(puzzle);
    const req: SolverRequest = {
      board: s.board,
      snapshot: s.snapshot,
      objective: { kind: "moves" },
    };
    return solutionFromLegacyPath(req, path) !== null;
  } catch {
    return false;
  }
}

const jsonPath = join(__dirname, "../src/catalog/imported-puzzles.json");
const puzzles: PuzzleDefinition[] = JSON.parse(readFileSync(jsonPath, "utf8"));

let labeled = 0;
let already = 0;
let failed = 0;
let verifyFail = 0;
let singleBoxCount = 0;
const failures: string[] = [];
const t0 = performance.now();

for (let i = 0; i < puzzles.length; i++) {
  const puzzle = puzzles[i];

  if (hasLabeledBoxes(puzzle.rows)) {
    already++;
    continue;
  }

  const nGeneric = countGenericBoxes(puzzle.rows);
  if (nGeneric === 0) continue;

  if (nGeneric === 1) {
    const pair = firstGenericPair(puzzle.rows);
    if (!pair) continue;
    puzzles[i] = relabel(puzzle, pair);
    labeled++;
    singleBoxCount++;
  } else {
    const sol = solveForMapping(puzzle);
    if (!sol) {
      failed++;
      failures.push(puzzle.id);
      process.stderr.write(`[FAIL] ${puzzle.id}\n`);
    } else {
      const mod = relabel(puzzle, sol.pair);
      if (!verify(mod, sol.path)) {
        verifyFail++;
        failures.push(`${puzzle.id} (verify)`);
        process.stderr.write(`[VERIFY-FAIL] ${puzzle.id}\n`);
      } else {
        puzzles[i] = mod;
        labeled++;
      }
    }
  }

  if ((i + 1) % 100 === 0 || i === puzzles.length - 1) {
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    const rate = (labeled / (parseFloat(elapsed) || 1)).toFixed(1);
    process.stderr.write(
      `[${i + 1}/${puzzles.length}] labeled=${labeled} failed=${failed} ` +
        `elapsed=${elapsed}s rate=${rate}/s\n`,
    );
  }
}

if (!dryRun) {
  writeFileSync(jsonPath, JSON.stringify(puzzles, null, 2) + "\n");
  process.stderr.write(`\nWrote ${jsonPath}\n`);
} else {
  process.stderr.write(`\n[DRY RUN] Would write ${jsonPath}\n`);
}

const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
process.stderr.write(`\nDone in ${elapsed}s\n`);
process.stderr.write(`  Total puzzles: ${puzzles.length}\n`);
process.stderr.write(`  Already labeled: ${already}\n`);
process.stderr.write(`  Newly labeled: ${labeled} (${singleBoxCount} single-box)\n`);
process.stderr.write(`  Failed to solve: ${failed}\n`);
process.stderr.write(`  Verify failed: ${verifyFail}\n`);
if (failures.length > 0) {
  process.stderr.write(`  Failures: ${failures.join(", ")}\n`);
}

if (originalPostMessage === undefined) {
  Reflect.deleteProperty(globalThis, "postMessage");
} else {
  globalThis.postMessage = originalPostMessage;
}
