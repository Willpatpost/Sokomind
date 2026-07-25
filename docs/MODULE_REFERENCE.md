# Sokomind Module Reference

## Browser Source Modules (`src/`)

### Loading Order

Scripts are loaded sequentially by `bootstrap.js` in this order:

1. `levels.js` — Level catalog and embedded puzzles
2. `game-state.js` — Core game rules (parse, move, push, goal)
3. `path-validation.js` — Move path replay validation
4. `keyboard-policy.js` — Keyboard shortcut filtering
5. `search-log.js` — Structured search telemetry formatting
6. `director-policy.js` — Portfolio scheduling and capacity policies
7. `solver-director.js` — Worker lifecycle and portfolio orchestration
8. `accessibility.js` — Screen reader announcements
9. `puzzle-io.js` — Puzzle import/export
10. `app.js` — Main UI controller

### Web Worker Loading

The solver worker (`solver-worker.js`) runs in a separate thread and
`importScripts` the engine modules:

- `state.js`, `memo.js`, `metrics.js`, `topology.js`, `board.js`
- `heuristic.js`, `deadlock.js`, `analysis.js`, `push-generation.js`
- `solver-engine.js` (barrel re-export)
- `solver-search.js` (search algorithms)
- Plus specialized modules: `chokepoint.js`, `compact-table.js`,
  `depth-map.js`, `difficulty.js`, `goal-ordering.js`, `packed-path.js`,
  `pattern-db.js`, `pi-corral.js`, `retrograde.js`, `solution-improvement.js`,
  `subproblem-cache.js`, `wasm-bridge.js`

---

## Module Details

### `game-state.js` — Core Game Rules

**Exports** (via `SokomindGameState` global):

| Function | Signature | Purpose |
|---|---|---|
| `parseRows` | `(rows: string[]) → State` | Parse level strings into game state |
| `moveState` | `(state, direction) → State\|null` | Apply a move; returns null if blocked |
| `isPushMove` | `(state, direction) → boolean` | Check if move would push a box |
| `isGoal` | `(state) → boolean` | Check if all boxes are on matching goals |
| `cloneState` | `(state) → State` | Deep-clone a game state |
| `positionKey` | `(y, x) → string` | Create `"y,x"` position key |
| `serializeState` | `(state) → object` | Serialize for worker messaging |
| `DIRS` | `{Up, Down, Left, Right}` | Direction deltas `[dy, dx]` |

**State structure:**
```
{
  board: { rows, walls: Set, goals: Map<pos→label>, floor: Set },
  robot: [y, x],
  boxes: Map<pos→label>
}
```

**Win condition:** Every `(position, label)` in `boxes` must match `goals.get(position) === label`.
Generic boxes (`X`) match goals stored as `X` (displayed as `S`).

### `levels.js` — Level Catalog

**Exports** (via `SokomindLevels` global):

- `LEVELS` — In browser: embedded `EMBEDDED_LEVELS` object; in Node: loaded from `shared/sokomind-conformance.json`
- `EMBEDDED_LEVELS` — Always the hardcoded 5-level set
- `OPTIMAL_MOVES` — Known optimal move counts: `{ultra-tiny: 1, tiny: 20, medium: 34, large: 148}`
- `stateFromRows(rows)` — Extract robot + boxes from rows

### `app.js` — Main UI Controller

Orchestrates the browser application:
- Level loading and selection panel with miniature thumbnails
- DOM-based board rendering using CSS grid
- Player movement via keyboard (arrows/WASD) and touch buttons
- Undo/redo, reset, timer, move/push counting
- Solution animation playback at 105ms per move
- Search log rendering with incremental batched updates
- Completion dialog, solution decision dialog
- Push bound persistence in localStorage
- Solver launch delegation to `solver-director.js`

### `solver-director.js` — Worker Portfolio Orchestration

The largest orchestration module (~2,195 lines). Manages:

**Simple solver mode** (`startSolver`):
- Launches a portfolio of Web Workers for selected algorithm
- Supports: DFS, BFS, Greedy, A*, Push A*, Push Greedy, Push Beam, Weighted Push A*, Fast Portfolio

**Ultimate Bidirectional mode** (`startBidirectionalSolver`):
- Pre-analyzes puzzle via dedicated analysis worker
- Launches multi-worker campaign with:
  - Forward push search worker
  - Multiple reverse branch shard workers
  - Beam restart workers (balanced/detour/milestone profiles)
  - Box-run macro workers (for complex/extreme puzzles)
  - Structural plan-macro beam
  - Label-aware FESS (Feature-Space Search)
  - Discrepancy-limited DFS
  - Landmark bridge A* workers
  - Anytime guided checkpoint discovery
  - Persistent exact IDA* shards
  - Solution window rewrite workers

**Key features:**
- Bidirectional meeting point detection and path reconstruction
- Checkpoint handoff between phases (evacuation → packing → exact)
- Anytime incumbent tracking with improvement rounds
- Exact proof persistence via localStorage
- Worker watchdog (120s timeout → recovery)
- Bridge campaign circuit breakers
- Dynamic worker capacity based on `navigator.hardwareConcurrency`

### `solver-search.js` — Search Algorithms

The core search implementations (~3,859 lines):
- Push-level BFS, A*, Greedy, Beam search
- IDA* with iterative deepening
- Bidirectional forward/reverse push search
- Solution window rewriting with exact local search
- Push permutation optimization
- Feature-space (FESS) search
- Bridge A* between forward checkpoints and reverse landmarks
- State canonicalization (robot reachability normalization)
- Resumable exact checkpoints with shard partitioning

### `analysis.js` — Puzzle Analysis

Pre-search puzzle analysis (~2,072 lines):
- Difficulty classification (trivial/simple/moderate/complex/extreme)
- Room detection via gate/articulation analysis
- Doorway flow analysis and typed import/export scheduling
- Reverse start region identification
- Search scale estimation
- Worker allocation recommendations
- Prepared board construction with distance tables

### `heuristic.js` — Assignment Heuristic

Admissible heuristic computation (~885 lines):
- Hungarian algorithm for optimal box-to-goal assignment
- Push-distance computation
- Incremental assignment updates
- Goal table precomputation
- Interaction cost tables (room/chokepoint pair costs)
- Support dependency analysis

### `board.js` — Board Representation

Board parsing and prepared board construction (~624 lines):
- Dense graph compilation for fast traversal
- Player distance tables (seeded BFS from strategic positions)
- Goal tables for assignment heuristic acceleration
- Occupancy word representation for bitwise operations

### `deadlock.js` — Deadlock Pruning

Dead-square and deadlock detection (~269 lines):
- Static dead square identification
- Frozen box detection
- Corral-based pruning
- PI-corral analysis integration
- Hard pruning rule registry (`SokomindHardPruningRules`)

### `push-generation.js` — Successor Generation

Legal push enumeration (~633 lines):
- Single-box push generation with robot reachability
- Macro push sequences (multi-push same-box runs)
- Structural macro expansion with intermediate rejection
- Sequence macro compilation and result sharing
- Forced macro detection

### `topology.js` — Floor Graph Analysis

Topological analysis (~304 lines):
- Room detection via articulation points (gates)
- Floor connectivity graph
- Tunnel cell identification
- Gate dependency chains
- Room cell/box/goal counting

### `state.js` — State Identity

State canonicalization (~226 lines):
- Robot-reachability-based canonical position
- Box configuration identity (sorted position+label)
- Shard assignment for partitioned exact search
- Transposition key generation

### `director-policy.js` — Portfolio Policies

Worker scheduling decisions (~201 lines):
- `portfolioWorkerCapacity(hardware, memory)` — Max concurrent workers
- `directWorkerCapacity(max, sideWorkers, evacuation)` — Direct lane slots
- `exactTranspositionLimit(memory, shards)` — Per-shard transposition table size
- `tightenedWorkerBound(incumbent, prefix)` — Tightened bound from best known
- `acceptsIncumbent(candidate, best)` — Whether a solution improves the incumbent
- `selectAnytimeCheckpoints(candidates, limit)` — Checkpoint selection for guided discovery
- Bridge campaign tracker with circuit breakers
- Required work tracker for portfolio completion detection

### `solution-improvement.js` — Post-Solve Optimization

Solution quality improvement (~382 lines):
- Exact window rewriting between structural milestones
- Move-cost A* with bounded temporary pushes
- Push chain permutation optimization
- Cycle erasure and shortest-walk replacement
- Replay validation of rewritten paths

---

## Python Modules (`searches/`)

### `Sokomind.py` — Main Python Solver

Contains the Python parser, game state, and search algorithms.
Loads levels from `shared/sokomind-conformance.json`.

### Algorithm modules

- `bfs.py` — Breadth-first search
- `dfs.py` — Depth-first search
- `astar.py` — A* search
- `greedy.py` — Greedy best-first search
- `gui.py` — Desktop GUI (tkinter)

---

## WASM Accelerator (`wasm/sokomind-core/`)

Written in Rust, compiled to WebAssembly via `wasm-bindgen`.

### Modules

- `board.rs` — Board representation with dense cell arrays
- `reachability.rs` — Robot reachability BFS
- `push_gen.rs` — Push generation
- `deadlock.rs` — Dead square detection
- `hungarian.rs` — Hungarian algorithm for assignment heuristic

### Build

```bash
cd wasm/sokomind-core
wasm-pack build --target web    # browser pkg/
wasm-pack build --target nodejs  # Node pkg-node/
```

Optimized with `opt-level = 3` and LTO.

---

## Shared Fixtures (`shared/`)

### `sokomind-conformance.json`

The canonical cross-runtime fixture containing:

```json
{
  "schemaVersion": ...,
  "levels": { "ultra-tiny": [...], "tiny": [...], ... },
  "validCases": [...],
  "invalidCases": [...]
}
```

Used by both Python (loaded at import) and browser (loaded via `levels.js` in Node tests;
embedded copy used in browser). CI tests verify conformance between runtimes.

---

## Test Suites

### JavaScript (`tests/js/`)

~20+ test files using Node's built-in test runner. Coverage targets: 90% lines,
75% branches, 90% functions for core modules.

Key test files:
- `exact-kernel-differential.test.js` — Compares exact solver against independent oracle
- `pruning-differential.test.js` — Validates hard pruning rules with independent evidence
- `conformance.test.js` — Cross-runtime level and rule conformance
- `director-policy.test.js` — Portfolio scheduling logic
- `solution-improvement.test.js` — Solution rewrite correctness

### Playwright (`tests/browser/`)

Real-browser tests in Chromium and WebKit:
- Full play/search workflow
- Worker lifecycle (start, stop, error, watchdog)
- Solution decision dialog
- Level navigation

### Python (`tests/test_sokomind.py`)

Python solver correctness tests.

### Benchmarks (`bench/`)

- `performance-gate.js` — Deterministic state/time thresholds
- `verify-solution.js` — Replay-validate saved solution files
- `solver-generality.test.js` — Solver works on generated puzzles
- `generated-cases.test.js` — Generated puzzle families
- `huge-performance-gate.test.js` — Huge-specific performance thresholds
