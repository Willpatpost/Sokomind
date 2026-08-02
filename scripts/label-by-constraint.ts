/**
 * For puzzles too hard to solve generically, try labeling each possible
 * box-goal pair and solving the LABELED version. The added constraint
 * can reduce the search space enough to find a solution.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { PuzzleDefinition, Direction } from "../src/core/model.ts";
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

function findPositions(rows: readonly string[], ch: string): [number, number][] {
  const result: [number, number][] = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === ch) result.push([r, c]);
    }
  }
  return result;
}

function tryLabelAndSolve(
  puzzle: PuzzleDefinition,
  boxR: number,
  boxC: number,
  goalR: number,
  goalC: number,
  maxVisited: number,
): { path: readonly unknown[] } | null {
  const rows = [...puzzle.rows];
  rows[boxR] = replaceChar(rows[boxR], boxC, "A");
  rows[goalR] = replaceChar(rows[goalR], goalC, "a");
  const labeled: PuzzleDefinition = { ...puzzle, rows };

  const session = createSession(labeled);
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
    maxVisited,
    maxGenerated: maxVisited * 6,
    transpositionLimit: 80_000,
    beamWidth: 512,
    seed: 0,
    sequenceMacros: true,
    checkpointLimit: 16,
    progressInterval: 300_000,
    progressIntervalMs: 300_000,
  });

  if (!Array.isArray(result.path)) return null;

  const sol = solutionFromLegacyPath(request, result.path);
  if (!sol) return null;

  return { path: result.path };
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

  const boxes = findPositions(puzzle.rows, "X");
  const goals = findPositions(puzzle.rows, "S");
  process.stderr.write(`[${puzzle.id}] ${boxes.length} boxes, ${goals.length} goals — trying constrained solve\n`);

  let solved = false;

  // Sort pairs by Manhattan distance (closest first — most likely natural assignment)
  const pairs: { bi: number; gi: number; dist: number }[] = [];
  for (let bi = 0; bi < boxes.length; bi++) {
    for (let gi = 0; gi < goals.length; gi++) {
      const dist = Math.abs(boxes[bi][0] - goals[gi][0]) + Math.abs(boxes[bi][1] - goals[gi][1]);
      pairs.push({ bi, gi, dist });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  // Try first 15 pairs with 200K states each
  const tryCount = Math.min(15, pairs.length);
  for (let p = 0; p < tryCount; p++) {
    const { bi, gi, dist } = pairs[p];
    const [br, bc] = boxes[bi];
    const [gr, gc] = goals[gi];
    process.stderr.write(`  Pair ${p + 1}/${tryCount}: box(${br},${bc})→goal(${gr},${gc}) dist=${dist}... `);

    const result = tryLabelAndSolve(puzzle, br, bc, gr, gc, 200_000);
    if (result) {
      const rows = [...puzzle.rows];
      rows[br] = replaceChar(rows[br], bc, "A");
      rows[gr] = replaceChar(rows[gr], gc, "a");
      puzzles[i] = { ...puzzle, rows };
      labeled++;
      solved = true;
      process.stderr.write(`SOLVED (${result.path.length} moves)\n`);
      process.stderr.write(`[OK] ${puzzle.id}\n`);
      break;
    } else {
      process.stderr.write(`no solution\n`);
    }
  }

  if (!solved) {
    // Try 5 more with 500K states
    process.stderr.write(`  Escalating to 500K states...\n`);
    for (let p = 0; p < Math.min(5, pairs.length); p++) {
      const { bi, gi, dist } = pairs[p];
      const [br, bc] = boxes[bi];
      const [gr, gc] = goals[gi];
      process.stderr.write(`  Pair ${p + 1}/5 (500K): box(${br},${bc})→goal(${gr},${gc}) dist=${dist}... `);

      const result = tryLabelAndSolve(puzzle, br, bc, gr, gc, 500_000);
      if (result) {
        const rows = [...puzzle.rows];
        rows[br] = replaceChar(rows[br], bc, "A");
        rows[gr] = replaceChar(rows[gr], gc, "a");
        puzzles[i] = { ...puzzle, rows };
        labeled++;
        solved = true;
        process.stderr.write(`SOLVED (${result.path.length} moves)\n`);
        process.stderr.write(`[OK] ${puzzle.id}\n`);
        break;
      } else {
        process.stderr.write(`no solution\n`);
      }
    }
  }

  if (!solved) {
    failed++;
    process.stderr.write(`[FAIL] ${puzzle.id}\n`);
  }
}

if (labeled > 0) {
  writeFileSync(jsonPath, JSON.stringify(puzzles, null, 2) + "\n");
  process.stderr.write(`\nWrote ${jsonPath}\n`);
}

process.stderr.write(`\nConstrained solve: ${labeled} labeled, ${failed} still failed\n`);

if (originalPostMessage === undefined) {
  Reflect.deleteProperty(globalThis, "postMessage");
} else {
  globalThis.postMessage = originalPostMessage;
}
