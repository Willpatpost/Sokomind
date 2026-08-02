/**
 * Retry labeling for puzzles that failed the first pass, using higher solver limits.
 *
 * Usage:
 *   node --experimental-strip-types scripts/label-retry-hard.ts
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

const originalPostMessage = globalThis.postMessage;
globalThis.postMessage = (() => {}) as typeof globalThis.postMessage;

const LEGACY_TO_CORE: Readonly<Record<string, Direction>> = {
  Up: "up", Down: "down", Left: "left", Right: "right",
};

const HARD_IDS = new Set(["microban-139", "microban-153", "caleb-022"]);

function hasLabeledBoxes(rows: readonly string[]): boolean {
  for (const row of rows) {
    if (/[A-NP-QT-WYZ]/.test(row)) return true;
  }
  return false;
}

function replaceChar(s: string, i: number, ch: string): string {
  return s.substring(0, i) + ch + s.substring(i + 1);
}

interface Pair {
  boxRow: number; boxCol: number; goalRow: number; goalCol: number;
}

function solveForMapping(puzzle: PuzzleDefinition): { pair: Pair; path: readonly unknown[] } | null {
  const session = createSession(puzzle);
  const request: SolverRequest = {
    board: session.board,
    snapshot: session.snapshot,
    objective: { kind: "moves" },
  };

  const state = toLegacyState(request);

  const result = search({
    algorithm: "ultimate",
    state,
    maxDepth: 600,
    maxVisited: 500_000,
    maxGenerated: 3_000_000,
    transpositionLimit: 80_000,
    beamWidth: 512,
    seed: 0,
    sequenceMacros: true,
    checkpointLimit: 16,
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
let failed = 0;

for (let i = 0; i < puzzles.length; i++) {
  const puzzle = puzzles[i];
  if (!HARD_IDS.has(puzzle.id)) continue;
  if (hasLabeledBoxes(puzzle.rows)) {
    process.stderr.write(`[SKIP] ${puzzle.id} already labeled\n`);
    continue;
  }

  process.stderr.write(`[RETRY] ${puzzle.id} with higher limits...\n`);
  const sol = solveForMapping(puzzle);
  if (!sol) {
    failed++;
    process.stderr.write(`[FAIL] ${puzzle.id} (still unsolvable)\n`);
    continue;
  }

  const mod = relabel(puzzle, sol.pair);
  if (!verify(mod, sol.path)) {
    failed++;
    process.stderr.write(`[VERIFY-FAIL] ${puzzle.id}\n`);
    continue;
  }

  puzzles[i] = mod;
  labeled++;
  process.stderr.write(`[OK] ${puzzle.id} labeled (${sol.path.length} moves)\n`);
}

if (labeled > 0) {
  writeFileSync(jsonPath, JSON.stringify(puzzles, null, 2) + "\n");
  process.stderr.write(`\nWrote ${jsonPath}\n`);
}

process.stderr.write(`\nRetry results: ${labeled} labeled, ${failed} still failed\n`);

if (originalPostMessage === undefined) {
  Reflect.deleteProperty(globalThis, "postMessage");
} else {
  globalThis.postMessage = originalPostMessage;
}
