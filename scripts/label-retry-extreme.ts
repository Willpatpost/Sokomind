/**
 * Last-resort retry for the hardest puzzles that failed all previous passes.
 * Uses plan-macro-beam algorithm with very high state limits, then falls back
 * to ultimate with maximum limits, and finally tries both algorithms with
 * different seeds.
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

const HARD_IDS = new Set(["microban-153", "caleb-022"]);

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

function replayAndMap(puzzle: PuzzleDefinition, path: readonly unknown[]): Pair | null {
  const session = createSession(puzzle);
  const request: SolverRequest = {
    board: session.board,
    snapshot: session.snapshot,
    objective: { kind: "moves" },
  };

  let snapshot = request.snapshot;
  for (const v of path) {
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
      boxRow: init.position.row,
      boxCol: init.position.column,
      goalRow: goal.position.row,
      goalCol: goal.position.column,
    };
  }
  return null;
}

interface SolveAttempt {
  name: string;
  config: Record<string, unknown>;
}

function getAttempts(puzzle: PuzzleDefinition): SolveAttempt[] {
  const session = createSession(puzzle);
  const request: SolverRequest = {
    board: session.board,
    snapshot: session.snapshot,
    objective: { kind: "moves" },
  };
  const state = toLegacyState(request);

  return [
    {
      name: "plan-macro-beam",
      config: {
        algorithm: "plan-macro-beam",
        state,
        maxDepth: 600,
        maxVisited: 10_000,
        transpositionLimit: 80_000,
        sequenceMacroExplored: 64,
        sequenceMacroResults: 6,
        targetedMacroExplored: 96,
        progressIntervalMs: 30_000,
      },
    },
    {
      name: "ultimate-1M",
      config: {
        algorithm: "ultimate",
        state,
        maxDepth: 800,
        maxVisited: 1_000_000,
        maxGenerated: 6_000_000,
        transpositionLimit: 120_000,
        beamWidth: 1024,
        seed: 0,
        sequenceMacros: true,
        checkpointLimit: 24,
        progressInterval: 300_000,
        progressIntervalMs: 30_000,
      },
    },
    {
      name: "ultimate-seed42",
      config: {
        algorithm: "ultimate",
        state,
        maxDepth: 800,
        maxVisited: 1_000_000,
        maxGenerated: 6_000_000,
        transpositionLimit: 120_000,
        beamWidth: 1024,
        seed: 42,
        sequenceMacros: true,
        checkpointLimit: 24,
        progressInterval: 300_000,
        progressIntervalMs: 30_000,
      },
    },
    {
      name: "ultimate-seed7",
      config: {
        algorithm: "ultimate",
        state,
        maxDepth: 800,
        maxVisited: 1_000_000,
        maxGenerated: 6_000_000,
        transpositionLimit: 120_000,
        beamWidth: 512,
        seed: 7,
        sequenceMacros: true,
        checkpointLimit: 24,
        progressInterval: 300_000,
        progressIntervalMs: 30_000,
      },
    },
  ];
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

  const attempts = getAttempts(puzzle);
  let solved = false;

  for (const attempt of attempts) {
    process.stderr.write(`[${puzzle.id}] Trying ${attempt.name}...\n`);
    const t0 = performance.now();
    const result = search(attempt.config);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

    if (!Array.isArray(result.path)) {
      process.stderr.write(`  ${attempt.name}: no solution (${elapsed}s, visited=${result.visited})\n`);
      continue;
    }

    process.stderr.write(`  ${attempt.name}: found ${result.path.length} moves (${elapsed}s)\n`);

    const pair = replayAndMap(puzzle, result.path);
    if (!pair) {
      process.stderr.write(`  ${attempt.name}: replay/mapping failed\n`);
      continue;
    }

    const mod = relabel(puzzle, pair);
    if (!verify(mod, result.path)) {
      process.stderr.write(`  ${attempt.name}: verify failed\n`);
      continue;
    }

    puzzles[i] = mod;
    labeled++;
    solved = true;
    process.stderr.write(`[OK] ${puzzle.id} labeled via ${attempt.name}\n`);
    break;
  }

  if (!solved) {
    failed++;
    process.stderr.write(`[FAIL] ${puzzle.id} (all attempts exhausted)\n`);
  }
}

if (labeled > 0) {
  writeFileSync(jsonPath, JSON.stringify(puzzles, null, 2) + "\n");
  process.stderr.write(`\nWrote ${jsonPath}\n`);
}

process.stderr.write(`\nExtreme retry: ${labeled} labeled, ${failed} still failed\n`);

if (originalPostMessage === undefined) {
  Reflect.deleteProperty(globalThis, "postMessage");
} else {
  globalThis.postMessage = originalPostMessage;
}
