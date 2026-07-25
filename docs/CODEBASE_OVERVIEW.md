# Sokomind Codebase Overview

## What is Sokomind?

Sokomind is a Sokoban variant where players push boxes onto matching goals.
It supports two kinds of boxes:

- **Generic boxes** (`X`) match generic goals (`S`)
- **Lettered boxes** (`A`, `B`, `C`, ...) match lowercase goals (`a`, `b`, `c`, ...)

The game runs as a static browser application deployed via GitHub Pages, and also
has a Python desktop application. It includes a sophisticated portfolio solver
called **Ultimate Search** that uses push-level search, dead-square pruning,
bidirectional search, robot reachability canonicalization, exact goal assignment,
and push-distance heuristics.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (classic scripts, no framework/bundler) |
| Styling | Single CSS file (`styles.css`) |
| Solver (browser) | Web Workers, multi-worker portfolio orchestration |
| Solver (Python) | DFS, BFS, Greedy, A* in `searches/` |
| WASM accelerator | Rust → `wasm-bindgen` for hot loops (reachability, push gen, deadlock, Hungarian) |
| Testing (JS) | Node.js built-in test runner (`node --test`) |
| Testing (Python) | `unittest` + `coverage` + `ruff` + `mypy` |
| Browser testing | Playwright (Chromium + WebKit) |
| Benchmarks | Deterministic performance gates, solution verification |
| CI/CD | GitHub Actions → GitHub Pages (deploy from `src/`) |
| Package manager | npm (devDependencies: Playwright only) |

## Runtimes

- **Node.js**: 20, 22, or 24 (tested in CI matrix)
- **Python**: 3.10, 3.12, 3.14 (tested in CI matrix)

## Repository Layout

```
Sokomind/
├── src/                    # Browser application (deployed to GitHub Pages)
│   ├── index.html          # Single-page app shell
│   ├── bootstrap.js        # Async script loader with build manifest
│   ├── build.json          # Build version manifest
│   ├── styles.css          # All styling (~1,079 lines)
│   ├── app.js              # UI state, rendering, controls, timing, animation
│   ├── game-state.js       # Core rules: parse, move, push, goal check
│   ├── levels.js           # Built-in level catalog + optimal move counts
│   ├── solver-director.js  # Worker portfolio orchestration (~2,195 lines)
│   ├── solver-search.js    # Search algorithms, reconstruction (~3,859 lines)
│   ├── solver-worker.js    # Web Worker protocol entry point
│   ├── solver-engine.js    # Barrel re-export for backward compat
│   ├── analysis.js         # Puzzle analysis, local search (~2,072 lines)
│   ├── heuristic.js        # Assignment-based heuristic (~885 lines)
│   ├── board.js            # Board parsing, prepared boards (~624 lines)
│   ├── push-generation.js  # Successor generation (~633 lines)
│   ├── state.js            # State identities, serialization
│   ├── topology.js         # Floor graph, rooms, articulations
│   ├── deadlock.js         # Deadlock pruning rules
│   ├── memo.js             # Caching infrastructure
│   ├── metrics.js          # Performance measurement
│   ├── director-policy.js  # Portfolio capacity and scheduling policies
│   ├── keyboard-policy.js  # Keyboard shortcut handling
│   ├── path-validation.js  # Move path validation
│   ├── search-log.js       # Structured telemetry formatting
│   ├── accessibility.js    # Screen reader support
│   ├── puzzle-io.js        # Puzzle import/export
│   ├── puzzles.js          # Extended puzzle definitions (~1,293 lines)
│   ├── mobile.js           # Mobile interaction support
│   ├── solution-improvement.js  # Post-solve solution rewriting
│   ├── wasm-bridge.js      # WASM module integration bridge
│   ├── depth-map.js        # Depth analysis
│   ├── chokepoint.js       # Chokepoint detection
│   ├── compact-table.js    # Compact data structures
│   ├── pattern-db.js       # Pattern database for heuristics
│   ├── pi-corral.js        # PI-corral pruning
│   ├── retrograde.js       # Retrograde analysis
│   ├── goal-ordering.js    # Goal ordering strategies
│   ├── difficulty.js       # Difficulty estimation
│   ├── subproblem-cache.js # Subproblem caching
│   ├── packed-path.js      # Compact path encoding
│   └── *.txt               # Diagnostic solution files
├── searches/               # Python solver and desktop app
│   ├── Sokomind.py         # Main Python solver + GUI
│   ├── bfs.py, dfs.py, astar.py, greedy.py  # Search algorithms
│   └── gui.py              # Desktop GUI (tkinter)
├── shared/                 # Cross-runtime fixtures
│   └── sokomind-conformance.json  # Canonical levels + valid/invalid rule cases
├── wasm/sokomind-core/     # Rust WASM accelerator
│   └── src/lib.rs          # Reachability, push gen, deadlock, Hungarian
├── tests/                  # Test suites
│   ├── js/                 # ~20+ Node.js test files
│   ├── browser/            # Playwright browser tests
│   └── test_sokomind.py    # Python unit tests
├── bench/                  # Performance benchmarks and gates
│   ├── performance-gate.js # Deterministic performance thresholds
│   ├── verify-solution.js  # Solution replay verification
│   └── *.test.js           # Benchmark test suites
├── docs/                   # Documentation
│   ├── README.md           # Web app docs
│   ├── DESKTOP.md          # Desktop setup guide
│   ├── ARCHITECTURE.md     # Solver architecture rules
│   └── ROADMAP.md          # Forward development roadmap
├── scripts/                # Build and quality checks
│   ├── check-build.js      # Build integrity check
│   └── quality-check.js    # Code quality linting
├── data/images/            # Documentation media
└── .github/workflows/      # CI/CD pipelines
    ├── pages.yml           # Main CI: test, lint, deploy
    └── performance.yml     # Performance regression gate
```

## Source Code Size

Total browser source: ~17,500 lines across ~30 JS files + 1 CSS file.

Largest files by line count:
- `solver-search.js`: 3,859 lines (search algorithms)
- `solver-director.js`: 2,195 lines (worker orchestration)
- `analysis.js`: 2,072 lines (puzzle analysis)
- `puzzles.js`: 1,293 lines (puzzle definitions)
- `styles.css`: 1,079 lines
- `heuristic.js`: 885 lines (assignment heuristic)

## Level Format

Levels are represented as arrays of strings (rows). Each character is a cell:

| Character | Meaning |
|---|---|
| `O` | Wall |
| `R` | Robot (player) |
| `X` | Generic box |
| `S` | Generic goal (matches `X`) |
| `A`-`Z` (except `O`, `R`, `S`) | Lettered box |
| `a`-`z` | Lettered goal (matches uppercase counterpart) |
| ` ` (space) | Empty floor |

### Built-in Levels

| Name | Size | Boxes | Optimal Moves |
|---|---|---|---|
| ultra-tiny | 5x5 | 1 (A) | 1 |
| tiny | 6x6 | 2 (X, A) | 20 |
| medium | 7x7 | 6 (A, X, B, X, C, D) | 34 |
| large | 10x10 | 5 (A, X, X, B, X) | 148 |
| huge | 15x15 | 12 (mixed) | unknown |

## Build and Deployment

The browser app requires **no build step**. GitHub Pages deploys the `src/`
directory directly. Script loading is handled by `bootstrap.js`, which:

1. Fetches `build.json` to get the current build revision
2. Appends `?build=<revision>` cache-busters to all script/CSS URLs
3. Loads scripts sequentially in dependency order

## CI Pipeline (`.github/workflows/pages.yml`)

Six parallel jobs must pass before deploy:

1. **node-compat**: Unit tests on Node 20, 22, 24
2. **python-compat**: Python tests on 3.10, 3.12, 3.14
3. **quality**: Build check, quality check, coverage (90% lines/functions),
   ruff format/lint, mypy, Python coverage
4. **performance**: Deterministic performance gate benchmarks
5. **browser-test**: Playwright in Chromium and WebKit (parallel, fail-fast disabled)
6. **deploy**: GitHub Pages upload (main branch only, after all jobs pass)

## Running Tests

```bash
# JavaScript unit tests
npm run test:unit

# JavaScript with coverage
npm run test:coverage

# Build and quality checks
npm run check:build
npm run check:quality

# Performance benchmarks
npm run test:performance

# Browser tests (requires Playwright)
npm ci && npx playwright install chromium webkit
npm run test:browser

# Python tests
python -m unittest discover -v
```

## Architecture Principles

From `docs/ARCHITECTURE.md`:

1. **Puzzle independence**: Solver code must never contain saved solutions,
   level-specific coordinates, level-name branches, or heuristics tuned to
   recognize a particular built-in puzzle.

2. **No bundler**: Browser files remain classic scripts for dependency-free
   GitHub Pages deployment. The HTML load order supplies modules before
   director and UI.

3. **Hard pruning evidence**: Hard pruning rules require independent differential
   evidence — not just a saved solution that proves one route is retained.

4. **Cross-runtime conformance**: `shared/sokomind-conformance.json` is the
   single source of truth for levels and parsing rules.

## Current Development Status

Per `docs/ROADMAP.md`, the project is on **Build 2026-07-24.47** with:
- Sprints 0-2: Complete (repo hygiene, fast structural solutions, anytime quality)
- Sprint 3: Partial (compact storage, FESS queues)
- Sprints 4-7: Planned (resilience, consolidation, polish, puzzle editor)
