/**
 * Solve canonical puzzles that have only generic boxes and print the
 * row changes needed to label one pair A/a.
 *
 * Usage:
 *   node --experimental-strip-types scripts/label-canonical.ts
 */

import type { PuzzleDefinition, Direction } from "../src/core/model.ts";
import { createSession, stepSnapshot } from "../src/core/game-session.ts";
import type { SolverRequest } from "../src/solver/contracts.ts";
import { search } from "../src/solver/implementations/sokomind-engine/engine.generated.js";
import { toLegacyState } from "../src/solver/implementations/sokomind-solver.ts";

const originalPostMessage = globalThis.postMessage;
globalThis.postMessage = (() => {}) as typeof globalThis.postMessage;

const LEGACY_TO_CORE: Readonly<Record<string, Direction>> = {
  Up: "up", Down: "down", Left: "left", Right: "right",
};

const PUZZLES_NEEDING_LABELS: PuzzleDefinition[] = [
  {
    id: "beginner-three",
    title: "Three in a Row",
    difficulty: "beginner",
    boxes: 3,
    rows: ["OOOOOOOO", "O R    O", "O XXXO O", "O SSSO O", "O      O", "OOOOOOOO"],
  },
  {
    id: "beginner-detour",
    title: "The Detour",
    difficulty: "beginner",
    boxes: 2,
    rows: ["OOOOOOOO", "OR     O", "OOOO X O", "OS   X O", "OS     O", "OOOOOOOO"],
  },
  {
    id: "box-5x5-a",
    title: "Tiny Teaser",
    difficulty: "beginner",
    boxes: 2,
    rows: ["OOOOO", "OSX O", "O XRO", "O  SO", "OOOOO"],
  },
  {
    id: "inter-rooms",
    title: "Two Rooms",
    difficulty: "intermediate",
    boxes: 4,
    rows: ["OOOOOOOOOOO", "O    O    O", "O RX   XS O", "O XO O OX O", "OSSO   OS O", "OOOOOOOOOOO"],
  },
  {
    id: "corridor-2",
    title: "The Pipe",
    difficulty: "intermediate",
    boxes: 3,
    rows: ["OOOOOOOOOOO", "O S O     O", "O   O X   O", "O     R   O", "O   O X   O", "O S O     O", "OOOOO X   O", "OOOOOO  S O", "OOOOOOOOOOO"],
  },
  {
    id: "workshop-1",
    title: "Tool Shed",
    difficulty: "intermediate",
    boxes: 3,
    rows: ["OOOOOOO", "O   R O", "O OXO O", "O X   O", "OSX   O", "OS    O", "OS    O", "OOOOOOO"],
  },
  {
    id: "classic-1",
    title: "Original Spirit",
    difficulty: "intermediate",
    boxes: 3,
    rows: ["OOOOOOO", "O     O", "O OXO O", "O  X  O", "OO X OO", "O  R  O", "O SSS O", "OOOOOOO"],
  },
  {
    id: "theme-kitchen",
    title: "Kitchen Cleanup",
    difficulty: "intermediate",
    boxes: 3,
    rows: ["OOOOOOOOO", "O R     O", "O  OOO  O", "O X O X O", "O  O    O", "O  O  X O", "O SSS   O", "OOOOOOOOO"],
  },
  {
    id: "adv-gallery",
    title: "The Gallery",
    difficulty: "advanced",
    boxes: 4,
    rows: ["OOOOOOOOOO", "O R      O", "O OOOOOO O", "O O    O O", "O X SS X O", "O O    O O", "O OXOOXO O", "O        O", "O   SS   O", "OOOOOOOOOO"],
  },
  {
    id: "box-7x7",
    title: "Lucky Seven",
    difficulty: "advanced",
    boxes: 4,
    rows: ["OOOOOOO", "OS   SO", "O  X  O", "O XRXOO", "O  X  O", "OS   SO", "OOOOOOO"],
  },
  {
    id: "sym-diamond",
    title: "Diamond",
    difficulty: "advanced",
    boxes: 3,
    rows: ["OOOOOOOOOOO", "OOOOO OOOOO", "OOOO   OOOO", "OOO  S  OOO", "OO  XRX  OO", "O    X    O", "OO   S   OO", "OOO  S  OOO", "OOOO   OOOO", "OOOOO OOOOO", "OOOOOOOOOOO"],
  },
  {
    id: "open-field",
    title: "Wide Open",
    difficulty: "advanced",
    boxes: 10,
    rows: ["OOOOOOOOOOOOOOOOOOOO", "OSX                O", "OS  X              O", "OS                 O", "OS                 O", "OS                 O", "OS                 O", "OS                 O", "OS                 O", "OS                 O", "OX        R        O", "O   X              O", "OX                 O", "O   X              O", "OX                 O", "O   X              O", "OX                 O", "O   X              O", "OS                 O", "OOOOOOOOOOOOOOOOOOOO"],
  },
  {
    id: "expert-maze",
    title: "The Maze",
    difficulty: "expert",
    boxes: 5,
    rows: ["OOOOOOOOOOOO", "O R  O     O", "OOO  O OOO O", "O X  O O S O", "O OO   O   O", "O O  OOOO  O", "O   XO  X  O", "OOOO OS    O", "O  X    OO O", "O SSS X    O", "OOOOOOOOOOOO"],
  },
  {
    id: "expert-tetris",
    title: "Block Party",
    difficulty: "expert",
    boxes: 6,
    rows: ["OOOOOOOOO", "O   R   O", "O  X X  O", "OOX   XOO", "OO     OO", "OO X X OO", "OOSSSSSOO", "OO  S  OO", "OOOOOOOOO"],
  },
];

for (const puzzle of PUZZLES_NEEDING_LABELS) {
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
    maxDepth: moderate ? 460 : 180,
    maxVisited: moderate ? 250_000 : 80_000,
    maxGenerated: moderate ? 1_500_000 : 300_000,
    transpositionLimit: moderate ? 48_000 : 30_000,
    beamWidth: 256,
    seed: 0,
    sequenceMacros: moderate,
    checkpointLimit: 8,
    progressInterval: 300_000,
    progressIntervalMs: 300_000,
  });

  if (!Array.isArray(result.path)) {
    console.log(`FAILED: ${puzzle.id} (no solution found)`);
    continue;
  }

  let snapshot = request.snapshot;
  for (const v of result.path) {
    const d = LEGACY_TO_CORE[v as string];
    if (!d) break;
    const t = stepSnapshot(request.board, snapshot, d);
    if (!t.moved) break;
    snapshot = t.snapshot;
    if (snapshot.solved) break;
  }

  if (!snapshot.solved) {
    console.log(`FAILED: ${puzzle.id} (replay did not solve)`);
    continue;
  }

  const initials = session.board.initialBoxes;
  const goals = session.board.goals;
  let found = false;

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

    const newRows = [...puzzle.rows];
    const bRow = init.position.row;
    const bCol = init.position.column;
    const gRow = goal.position.row;
    const gCol = goal.position.column;

    newRows[bRow] = newRows[bRow].substring(0, bCol) + "A" + newRows[bRow].substring(bCol + 1);
    newRows[gRow] = newRows[gRow].substring(0, gCol) + "a" + newRows[gRow].substring(gCol + 1);

    console.log(`\n=== ${puzzle.id} ===`);
    console.log(`  Box (${bRow},${bCol}) X→A, Goal (${gRow},${gCol}) S→a`);
    console.log(`  Old rows: ${JSON.stringify(puzzle.rows)}`);
    console.log(`  New rows: ${JSON.stringify(newRows)}`);
    console.log(`  Solution: ${result.path.length} moves`);
    found = true;
    break;
  }

  if (!found) {
    console.log(`FAILED: ${puzzle.id} (no generic pair found in mapping)`);
  }
}

if (originalPostMessage === undefined) {
  Reflect.deleteProperty(globalThis, "postMessage");
} else {
  globalThis.postMessage = originalPostMessage;
}
