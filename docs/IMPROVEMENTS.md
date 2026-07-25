# Sokomind Planned Improvements

This document consolidates all planned improvements from the forward development
roadmap and the solver optimization report into a single actionable reference.
Items are grouped by sprint/phase, with status tracking. Each item includes its
acceptance gate so completion criteria are unambiguous.

Completed items are retained for historical context and to prevent duplicated work.

---

## Sprint 0 — Cleaning, Organizing, and Refactoring

**Status: COMPLETE** (build 2026-07-23.33)

### 0.1 Repository hygiene
- [x] Move desktop guide and roadmap out of repo root, link from README
- [x] Standardize Python package as lowercase `searches/`
- [x] Update imports, commands, static checks, coverage, CI, and docs
- [x] Document repository layout; keep conventional entry points at root
- [x] Consolidate ignored artifacts; remove generated local artifacts
- [x] Preserve GitHub Pages layout, Python entry points, cross-runtime fixtures

**Gate:** No tracked code references former paths. Clean test run creates only
ignored artifacts. All gates pass after case-sensitive rename.

---

## Sprint 1 — Faster Structural First Solutions

**Status: COMPLETE** (builds 2026-07-23.36 through 2026-07-24.42)

### 1.1 Apply structural rejection during macro expansion
**Status: COMPLETE** (build 2026-07-23.36)

Build an incremental macro context (assignment, doorway phase, staging, packing
dependencies, exporter egress, box mobility, unsolved-goal access). Evaluate
after every intermediate push; stop a macro on discovery-lane contradiction.
Keep proven deadlocks separate from discovery-only rejections.

**Gate:** Base and transformed Huge solve with replay-valid paths. Exact search
matches independent oracle. Macro intermediates and dense-layout derivations
fall without increasing retained states or peak memory.

### 1.2 Make macro effort adaptive
**Status: COMPLETE** (retuned build 2026-07-24.42)

Estimate local ambiguity from legal push directions, competing targets, blocker
routes, doorway conflicts, and structural score dispersion. Small lookahead for
forced/low-ambiguity; full budget for doorway crossings, staging, packing order.
Widen only after cheaper pass fails; contract after decisive progress.

**Gate:** Adaptive policy solves every case the fixed 96-state policy solves.
Easy macros do less work; ambiguous macros retain required alternatives. Huge
improves in wall time or intermediate work without regressing deterministic
counters.

### 1.3 Give the structural worker resource priority
**Status: COMPLETE** (corrected build 2026-07-24.42)

Short head start or exclusive slot for structural discovery on puzzles with
strong doorway/packing plans. Scale workers from hardware concurrency, memory,
progress, and yield. Start proof by fixed deadline; cancel redundant guided
lanes during structural progress.

**Gate:** Lower time-to-first-solution and worker memory on complex puzzles.
Structural work cannot starve exact proof. Stop, reset, worker failure, and
watchdog recovery remain bounded.

---

## Sprint 2 — Anytime Solution Quality and Proof Acceleration

**Status: COMPLETE** (builds 2026-07-24.41 through 2026-07-24.47)

### 2.1 Continue structural search after the first solution
**Status: COMPLETE** (build 2026-07-24.41)

Publish first solution immediately with moves/pushes/total. Wait for user
decision before changing board. Continue from latest incumbent path; keep
equal-push alternatives eligible; admit additional pushes when they reduce
moves. Explore alternative assignments, doorway waves, packing orders. Rank
incumbents by player moves. Persist incumbent and planner state.

**Gate:** First-solution latency unchanged or better. Multi-plan puzzles receive
monotonically improving incumbents. Large moves toward 148-move optimum.

### 2.2 Rewrite completed solutions with exact local windows
**Status: COMPLETE** (builds 2026-07-24.43, 2026-07-24.46)

Partition solution at structural milestones. Re-solve bounded windows with exact
push search. Optimize player moves. Erase cycles; replace walking with shortest
legal walking. Separate move-cost A* lane for high-overhead windows with up to 4
temporary pushes. Push-permutation optimizer reschedules independent per-box push
chains. Expand window sizes across refinement rounds. Reject replacements that
don't replay.

**Gate:** Rewriting never worsens moves or changes semantics. Detour fixtures
reduce to verified local optima. Huge improves beyond raw structural solution.

### 2.3 Feed every incumbent into exact search
**Status: COMPLETE** (build 2026-07-24.41)

Use exact push search as additional discovery without equating push optimality to
move optimality. Propagate bound reductions safely to shards and checkpoints.
Separate "best known," lower bound, and proven optimum in UI/logs. Prioritize
contours by bound-closing value. Continue exact proof after discovery retires.

**Gate:** Differential tests prove live tightening cannot remove optimal solutions
or create false claims. Exact search visits fewer states on incumbent-sensitive
families. Completed proof reports independently verified optimum.

---

## Sprint 3 — Compact and Nonredundant Search

**Status: PARTIAL**

### 3.1 Compact macro-state and path storage
**Status: PARTIAL** (FESS compact in build 2026-07-24.45; ordinary macros get
shared parent segments in build 2026-07-24.47)

- [ ] Store box layouts as packed immutable tokens with one-delta moves
- [x] FESS: chunked typed arrays for box cell IDs, numeric cell heaps,
      two-bit path storage, materialization only during expansion
- [x] FESS: transposition table points to one arena record; stale heap entries
      marked and periodically rebuilt
- [x] Ordinary macros: shared parent segments with endpoint-only materialization
- [ ] Replace object parent chains with arena indices and shared encoded segments
      in all remaining macro searches
- [ ] Retain full robot paths only for surviving candidates; reconstruct on demand
- [ ] Give caches explicit phase lifetimes and independent caps
- [ ] Report live vs cumulative allocations, arena occupancy, cache occupancy,
      compaction cost

**Gate:** Identities, replay paths, and deterministic outcomes unchanged. Huge
below 256 MB ceiling with reviewed reduction from ~218 MB. Compaction does not
increase first-solution time or hide retained memory.

### 3.2 Finish adaptive feature-space queues
**Status: PARTIAL** (build 2026-07-24.45 adds persistent FESS cells, cyclic
traversal, accumulated advisor weights)

- [x] Persistent FESS cells with cyclic fair traversal
- [x] Accumulated advisor weights
- [ ] Keep FESS control policy domain-independent while respecting typed labels
- [ ] Preserve all legal single-push successors; same-box macros accelerate only
- [ ] Track yield of room-flow, doorway, access, packing, mobility, assignment
      cells across depths and restarts
- [ ] Adapt cell boundaries and quotas from prior-window evidence
- [ ] Preserve productive elites; retire duplicates and stagnant cells
- [ ] Add generated feature-conflict families
- [ ] Port stable subset to Python or document why browser-only

**Gate:** Crossed typed-goal and required-detour fixtures solve without label
leakage or beam truncation, identically under reflection/rotation. Feature-
conflict families retain detours with fewer states. No regression on small
exact outcomes or Huge reliability.

### 3.3 Add proof-backed partial-order reduction
**Status: PLANNED**

Define push independence using affected boxes, support squares, robot access,
doorway phases, commitments, and macro side effects. Canonicalize only
interleavings whose actions commute and whose intermediate states preserve the
same legal continuation set. Disable when certificate is incomplete.
Exhaustively compare reduced/unreduced on small multi-box boards.

**Gate:** Solvability and optimal push counts match independent oracle. Reviewed
independent-action families show deterministic state reduction.

### 3.4 Complete symmetry reduction
**Status: PARTIAL** (structural discovery canonicalizes board orientation; state
symmetries and interchangeable boxes not fully reduced)

- [x] Board orientation canonicalization for structural discovery
- [ ] Detect automorphisms preserving walls, goals, labels, and movement rules
- [ ] Canonicalize symmetric box layouts without merging distinct typed boxes
- [ ] Combine symmetry keys with transposition and partial-order keys
- [ ] Retain rotation/reflection path and checkpoint restoration
- [ ] Validate mirrored, rotated, relabeled, and asymmetric counterexamples

**Gate:** Symmetric searches retain exact outcomes with fewer unique states.
Asymmetric/typed puzzles never merged under invalid symmetry.

---

## Sprint 4 — Exact Runtime Resilience and Observability

**Status: PARTIAL**

### 4.1 Improve exact transposition retention
**Status: PARTIAL** (capacity bounded; eviction is insertion-ordered; checkpoint
retention value not measured)

- [x] Bounded transposition table capacity
- [ ] Separate live occupancy, cumulative entries, checkpoint tail, eviction counts
- [ ] Compare contour-aware, depth-aware, and recency eviction policies
- [ ] Preserve entries that prevent repeated work after checkpoint resume
- [ ] Adapt capacity from supported memory pressure signals; retain fixed fallback
- [ ] Test shard unions and resumed proofs with tiny forced-eviction capacities

**Gate:** Exact outcomes and shard coverage unchanged. Reviewed long contours
repeat less work without increasing memory cap.

### 4.2 Add cooperative proof slices and complete lifecycle accounting
**Status: PARTIAL** (resumable slices and watchdogs exist; expensive expansions
and cancellation summaries incomplete)

- [x] Resumable proof slices
- [x] Worker watchdog with bounded recovery
- [ ] Bound work between cooperative yields even with expensive local reasoning
- [ ] Split worker-ready, checkpoint-load, first-expansion, first-progress,
      shutdown timings
- [ ] Emit a release record for every terminal worker state (solved, failed,
      cutoff, cancelled, replaced, watchdog)
- [ ] Include terminal visited/generated counts (not previous progress sample)
- [ ] Exercise stop and recovery paths in real Chromium and WebKit campaigns

**Gate:** No productive worker falsely declared silent. Every started worker has
exactly one terminal lifecycle record. Recovery bounded; cannot loop indefinitely.

### 4.3 Produce one compact terminal campaign summary
**Status: PARTIAL** (detailed events exist; user-stopped runs require manual
reconstruction)

- [ ] Version the exported search-log schema; normalize all identifiers as strings
- [ ] Summarize incumbent, best checkpoint, exact contour/gap, per-strategy
      states/time, lifecycle totals, and supported memory
- [ ] Emit same summary for solved, proven-unsolvable, cutoff, cancelled, failed
- [ ] Keep summary bounded regardless of campaign duration
- [ ] Add fixture-based compatibility tests for old and new log readers

**Gate:** One terminal record determines what the campaign achieved, what
remains, and why it ended.

---

## Sprint 5 — Runtime Consolidation and Intentional Parity

**Status: PARTIAL**

### 5.1 Finish browser runtime modularization
**Status: PARTIAL**

- [ ] Split topology, assignment/heuristic, deadlock proof, structural planning,
      and local exact analysis behind explicit interfaces
- [ ] Centralize shared rule primitives; remove test-loader duplication
- [ ] Keep classic-script/Web Worker deployment for GitHub Pages (no bundler)
- [ ] Add dependency-boundary tests preventing UI, director, and proof logic merge

**Gate:** Module ownership documented; cyclic dependencies absent. Build, worker
loading, browser tests, deployment unchanged.

### 5.2 Consolidate public search modes
**Status: PLANNED**

- [ ] Present small product contract: Recommended, Quick/anytime, Exact/proof
- [ ] Keep useful internal algorithms for director, benchmarks, advanced devs
- [ ] Remove duplicate Fast/Portfolio/Ultimate aliases after migration period
- [ ] Use ablations before removing any contributing strategy
- [ ] Simplify dispatch, tests, docs, and telemetry names together

**Gate:** Every public mode has distinct behavior and accurate guarantees. No
removed alias referenced by UI, CLI, tests, or docs.

### 5.3 Bring Python to intentional parity
**Status: PARTIAL**

- [ ] Define browser/Python capability table
- [ ] Port stable structural planner, solution validation, compact state,
      anytime incumbent, selected exact improvements
- [ ] Share conformance and benchmark fixtures
- [ ] Remove redundant Python heuristics and aliases
- [ ] Document intentionally browser-only features

**Gate:** Shared capabilities produce compatible statuses and replay-valid
solutions. Intentional differences explicit, tested, documented.

---

## Sprint 6 — Accessible, Polished, Release-Ready Product

**Status: PLANNED**

### 6.1 Complete screen-reader and reduced-motion support
- [ ] Accessible board description (robot, boxes, goals, move count, completion,
      solver state)
- [ ] Scope live announcements so progress doesn't flood assistive technology
- [ ] Preserve keyboard focus during search, playback, undo, reset, dialogs
- [ ] Honor reduced-motion preferences
- [ ] Test semantic state and focus in browser integration tests

**Gate:** Full play/search workflow usable without visual board inspection or
animation.

### 6.2 Complete desktop and mobile interaction review
- [ ] Refine hierarchy, controls, board sizing, logs, touch input, long-status
- [ ] Validate breakpoints, orientation changes, zoom, focus visibility,
      minimum touch targets
- [ ] Ensure long searches and playback don't destabilize layout
- [ ] Add automated breakpoint coverage; document visual review

**Gate:** No clipped controls, inaccessible actions, or board overflow
regressions on supported layouts.

### 6.3 Complete release and repository hygiene
- [ ] Add or finalize LICENSE, CONTRIBUTING, support matrix, release notes,
      browser/Python capability docs
- [ ] Verify setup/testing/benchmarking/deployment from clean checkout
- [ ] Define changelog and compatibility policy for puzzles, logs, checkpoints,
      CLI modes
- [ ] Ensure all required checks run before deployment with least-privilege

**Gate:** New contributor can build, test, benchmark, deploy using only
documented steps.

---

## Sprint 7 — User-Authored Puzzles

**Status: PLANNED**

### 7.1 Define canonical puzzle import, export, and sharing
**Status: PARTIAL** (plain-text parsing and shared symbol fixtures exist)

- [x] Plain-text parsing and shared symbol fixtures
- [ ] Specify versioned interchange format (rows, typed labels, title/author,
      future-safe metadata)
- [ ] Guarantee lossless plain-text import/export and stable board-content hashes
- [ ] Use one validation fixture set across all runtimes
- [ ] Add copy, download, upload flows (no hosted backend)
- [ ] Reject unsupported versions and malformed metadata with actionable errors

**Gate:** Round trips lossless across browser and Python, including ragged
boards and typed labels.

### 7.2 Add an accessible browser puzzle editor
**Status: PLANNED**

- [ ] Create, resize, paint/erase, typed boxes/goals, robot placement,
      undo/redo, clear, test-play
- [ ] Reuse canonical parser, game state, renderer, movement rules
- [ ] Mouse, touch, and keyboard editing with accessible tool state
- [ ] Preserve drafts locally; warn before destructive changes
- [ ] Isolate editing state from solver workers and saved proofs

**Gate:** Authored puzzles round-trip through canonical format and play with
same semantics as built-in puzzles.

### 7.3 Add creator validation and solver-assisted publishing
**Status: PLANNED**

- [ ] Report robot count, box/goal mismatch, invalid symbols, disconnected floor,
      unreachable elements, obvious dead starts immediately
- [ ] Test-play, request solution, attach replay-validated solution certificate
- [ ] Distinguish proven-unsolvable, cutoff, cancelled, failed (never call
      budget cutoff "impossible")
- [ ] Difficulty and quality estimates only with evidence and uncertainty
- [ ] Add generated malformed and valid-puzzle authoring fixtures

**Gate:** Published puzzles pass canonical validation with replay-valid
certificate when claimed solvable.

---

## Solver Optimization Tiers

These are solver-specific performance improvements from the optimization report.
Many overlap with or extend sprint items above.

### Tier 1 — Highest-Impact, Fastest Wins

#### T1.1 Eliminate string-key GC pressure
**Status: PARTIALLY ADDRESSED** (dense board exists; `positionKey()` still used
on some hot paths)

Replace all string coordinate keys with integer cell IDs from the dense board.
Targets: `reachablePaths()`, `pushNeighbors()`, `heuristic()`, `staticDead()`,
`boxSignature()`.

**Impact:** 15-30% overall speed improvement from reduced GC pressure.
**Difficulty:** Medium.

#### T1.2 Zobrist hashing for state identity
**Status: PARTIALLY ADDRESSED** (packed BigInt identities exist; Zobrist
incremental XOR not implemented)

Pre-compute random 64-bit value for each (cell_id, label) pair. State hash is
XOR of Zobrist values for each box placement. O(1) incremental update on push.

**Impact:** 20-40% improvement in states/second.
**Difficulty:** Medium.

#### T1.3 Raise memo limits and fix eviction policy
**Status: COMPLETE** (build 2026-07-25)

Limits raised to 100K/50K/10K. LRU eviction via `memoLookup` (delete+re-set
on read) + `memoizeBounded` (evicts oldest/LRU from front). Memory-aware
scaling via `setMemoScale(deviceMemory)`: 32GB→4x, 16GB→2x, 8GB→1.5x,
4GB→1x, 2GB→0.5x. Worker initialization calls `setMemoScale` when
`navigator.deviceMemory` is available.

- [x] Raise `HEURISTIC_MEMO_LIMIT` to 100K, `DEADLOCK_MEMO_LIMIT` to 50K,
      `PUSH_TRANSITION_MEMO_LIMIT` to 10K
- [x] Implement true LRU eviction in all `memoizeBounded()` caches
- [x] Memory-aware budgeting using `navigator.deviceMemory`

**Impact:** 10-25% fewer heuristic recomputations on hard puzzles.
**Difficulty:** Low.

#### T1.4 Parallelize puzzle analysis
**Status: PARTIALLY ADDRESSED** (analysis happens in a dedicated worker; search
doesn't start until analysis completes)

Split analysis into independent parallel tasks. Start search workers as soon as
basic topology completes; ship pattern DBs and push tables via `postMessage()`
once ready.

**Impact:** 500-1500ms faster time-to-first-search on complex puzzles.
**Difficulty:** Medium-High.

### Tier 2 — Algorithmic Depth Improvements

#### T2.1 Linear conflict heuristic enhancement
**Status: COMPLETE** (build 2026-07-25)

After Hungarian assignment, scan each row/column for box pairs whose assigned
goals are in opposite relative order. Each conflict adds +2 pushes to lower
bound. Optimized to reuse cached assignment data from `linearConflictFromGrouped`,
eliminating redundant Hungarian recomputation.

**Impact:** 5-15% fewer states on corridor arrangements.
**Difficulty:** Medium (~100 lines).

#### T2.2 Tunnel macro moves
**Status: COMPLETE** (build 2026-07-25)

Identify maximal tunnel segments. Replace push into tunnel with single macro
push to exit. `collapseTunnelPushes` uses single-box push generation to
extend forced pushes through tunnels. Validation: -0.27% visited, -0.42%
generated on performance gate.

**Impact:** 20-50% fewer states on corridor-heavy puzzles.
**Difficulty:** Medium.

#### T2.3 Full PI-corral pruning
**Status: COMPLETE** (build 2026-07-25)

After each push, identify player-inaccessible connected components. Three
deadlock checks per corral: (1) any box on static dead square, (2) sealed
corral — no box has a pushable direction (reachable support + free
destination), (3) all boxes frozen in both axes. Epoch-based typed-array
reuse eliminates per-call allocation overhead. Sealed check mirrors
`createsSealedCorralDeadlock` from the analysis module.

**Impact:** 5-15% more states pruned on room/corridor puzzles.
**Difficulty:** Medium (~200 lines).

#### T2.4 Adaptive portfolio strategy
**Status: PARTIALLY ADDRESSED** (director tracks worker progress; bandit-style
reallocation not implemented)

Bandit-style adaptive portfolio: track per-strategy productivity, reallocate
workers, tune parameters from puzzle analysis. Size-dependent algorithm
selection (small → exact; large → beam/FESS; many rooms → plan-macro).

**Impact:** 15-30% faster median solve time.
**Difficulty:** Medium-High.

#### T2.5 Depth-preferred transposition eviction
**Status: COMPLETE** (build 2026-07-25)

`BoundedDepthMap._evictDeepest` scans the first 8 entries and evicts the
one with highest stored cost. Eviction runs before insertion to prevent
evicting the just-added entry. Falls back to LRU when no numeric cost is
stored.

**Impact:** 5-10% fewer recomputations in IDA* and deep A*.
**Difficulty:** Low-Medium.

#### T2.6 Goal-cut decomposition extensions
**Status: PARTIALLY ADDRESSED** (basic goal-cut exists; near-balanced, multi-cut,
dynamic, and gate-based decomposition not implemented)

- [ ] Near-balanced cuts with trivial cross-side box paths
- [ ] Multi-cut into 3+ subproblems, solve smallest first
- [ ] Dynamic decomposition after solving subproblems
- [ ] Gate-based decomposition using gated room topology

**Impact:** Dramatic on large structured puzzles (turns 50-box into several
5-10 box problems).
**Difficulty:** Medium-High.

### Tier 3 — Pre-Search Intelligence

#### T3.1 Difficulty classification
**Status: COMPLETE** (difficulty classification implemented in analysis.js)

Multi-feature puzzle classifier producing profiles (trivial, corridor,
room-based, open field, dense, mega). Data-driven portfolio allocation.

#### T3.2 Goal ordering and dependency analysis
**Status: PARTIALLY ADDRESSED** (support dependency and local room analyses
exist; global solving order not produced)

Compute dependency graph over goals. Topological sort for fill order. Integrate
with beam search scoring and FESS feature scheduling.

**Impact:** 10-30% faster on room-based puzzles.
**Difficulty:** Medium-High.

#### T3.3 Chokepoint and congestion mapping
**Status: COMPLETE** (build 2026-07-25)

`identifyChokepoints(board)` computes traffic counts (reverse push-distance
BFS), per-cell capacity (corridor width), and severity-ranked chokepoint
list. `congestionPenalty(boxes, chokepointData)` adds a penalty when boxes
cluster beyond a chokepoint's capacity. Wired into beam search scoring as
`congestionWeight * congestion` (default 0.3). Beam restarts, portfolio,
and plan-macro-beam inherit via payload passthrough. Not used in admissible
searches (A*/IDA*).

**Impact:** 5-15% on corridor-heavy puzzles.
**Difficulty:** Medium.

#### T3.4 Retrograde analysis for critical configurations
**Status: PARTIALLY ADDRESSED** (reverse search exists in bidirectional solver;
pre-search retrograde table not compiled)

Bounded backward search from solved state, depth D. Store resulting states as
lookup table. Forward search checks against backward table when heuristic
drops below D.

**Impact:** High on medium puzzles (10-15 boxes).
**Difficulty:** Medium.

#### T3.5 Pattern database enhancement
**Status: PARTIALLY ADDRESSED** (limits raised; additive PDBs and compression
not implemented)

- [x] Raise `PATTERN_FLOOR_LIMIT` to 24, `PATTERN_BOX_LIMIT` to 5
- [ ] Additive pattern databases: split large rooms into overlapping subregions
- [ ] Compressed PDBs: `Uint8Array` with open addressing

**Impact:** 5-20% on puzzles with large rooms.
**Difficulty:** Medium.

### Tier 4 — Memory and Representation Overhaul

#### T4.1 Dense state representation throughout
**Status: PARTIALLY ADDRESSED** (dense board exists; many functions still use
array-of-arrays format)

Standardize on `Uint16Array` states. All search functions operate directly.
Incremental sorted maintenance on push. Zero-copy `postMessage()` transfers.

**Impact:** 15-25% overall speedup from cache friendliness and reduced GC.
**Difficulty:** High.

#### T4.2 Compact transposition table
**Status: PARTIALLY ADDRESSED** (some compact structures exist; full
`ArrayBuffer`-based custom hash table not implemented)

Custom hash table in `ArrayBuffer`. `Uint32Array` slots with [hash_high,
hash_low, depth, cost]. Open addressing with linear probing. 16 bytes/entry
vs ~100-200 bytes/entry current.

**Impact:** 5-10x more transposition entries in same memory.
**Difficulty:** Medium.

#### T4.3 Packed path representation
**Status: PARTIALLY ADDRESSED** (FESS uses 2-bit packed paths; other algorithms
use string arrays)

Pack all paths as 2-bit-per-step in `Uint32Array`. Generalize FESS implementation
to all search algorithms.

**Impact:** Low memory savings, moderate speed from cache density.
**Difficulty:** Low.

### Tier 5 — Mobile and Resource-Constrained Optimization

#### T5.1 Adaptive worker count and memory budget
**Status: PARTIALLY ADDRESSED** (worker capacity scaling improved; full
memory-pressure degradation not implemented)

- [x] Raise worker cap: memory tiers 2/4/8/12/16 with memory>=32 giving 4M
      transposition budget
- [x] Scale memory budgets more aggressively with available memory
- [ ] Graceful degradation on low-memory devices (reduce beam width, disable PDBs)

**Impact:** 30-60% faster on high-end devices. Prevents crashes on low-end.
**Difficulty:** Low.

#### T5.2 Progressive enhancement for mobile
**Status: PLANNED**

- [ ] Visibility API: pause workers when backgrounded
- [ ] Memory pressure monitoring via `performance.measureUserAgentSpecificMemory()`
- [ ] Checkpoint-on-throttle: detect throttling, save checkpoint, yield
- [ ] Pause/resume button (not just stop)

**Impact:** Prevents mobile-specific failures.
**Difficulty:** Medium.

#### T5.3 UI rendering optimization
**Status: PARTIALLY ADDRESSED** (incremental batched search log rendering exists
in build; some optimization items remain)

- [x] Batch rendering via `requestAnimationFrame()`
- [x] Incremental DOM append for new log entries
- [x] Virtual scrolling (200-line window in DOM)
- [ ] Solution validation off main thread

**Impact:** Smoother UI on mobile.
**Difficulty:** Low-Medium.

### Tier 6 — Stretch Goals for Competitive Dominance

#### T6.1 WebAssembly inner loop
**Status: PARTIALLY ADDRESSED** (Rust WASM accelerator exists with reachability,
push gen, deadlock, Hungarian; not all hot loops ported)

Port remaining hot inner loops to WASM. Transposition table in WASM linear
memory. Keep frontier management and worker communication in JS.

**Impact:** 2-5x states/second improvement.
**Difficulty:** High.

#### T6.2 Learned heuristic via TensorFlow.js
**Status: SKIPPED** (would require weeks of training data generation)

Train CNN/GNN to predict cost-to-go from board state. Use `max(hungarian, neural)`
for admissible hybrid. Deploy as .json + .bin (~2MB).

**Impact:** 50-90% fewer states explored if well-trained.
**Difficulty:** Very High.

#### T6.3 Solution improvement via local search
**Status: PARTIALLY ADDRESSED** (window rewriting and push permutation exist;
segment optimization and global reoptimization not implemented)

- [x] Push permutation optimization
- [x] Exact window rewriting
- [ ] Segment optimization: split at goal-filling events, re-solve each optimally
- [ ] Global reoptimization: restart A*/IDA* with tightened bound from improved
      solution
- [ ] Anytime improvement loop with UI progress

**Impact:** 10-40% shorter solutions.
**Difficulty:** Medium.

#### T6.4 Subproblem caching across puzzles
**Status: PLANNED**

Cache pattern database results in IndexedDB keyed by room geometry. Reuse cached
PDB when new puzzle has rooms of same shape (up to rotation/reflection).

**Impact:** Save 200-1000ms PDB computation for level-set play.
**Difficulty:** Medium.

---

## Summary Status

| Area | Total Items | Complete | Partial | Planned |
|---|---|---|---|---|
| Sprint 0 | 1 | 1 | 0 | 0 |
| Sprint 1 | 3 | 3 | 0 | 0 |
| Sprint 2 | 3 | 3 | 0 | 0 |
| Sprint 3 | 4 | 0 | 3 | 1 |
| Sprint 4 | 3 | 0 | 2 | 1 |
| Sprint 5 | 3 | 0 | 2 | 1 |
| Sprint 6 | 3 | 0 | 0 | 3 |
| Sprint 7 | 3 | 0 | 1 | 2 |
| Tier 1 | 4 | 1 | 3 | 0 |
| Tier 2 | 6 | 3 | 2 | 1 |
| Tier 3 | 5 | 2 | 2 | 1 |
| Tier 4 | 3 | 0 | 3 | 0 |
| Tier 5 | 3 | 0 | 2 | 1 |
| Tier 6 | 4 | 0 | 2 | 1 |
| **Total** | **48** | **13** | **22** | **13** |

---

## Implementation Priority (Recommended Order)

### Phase 1: Quick Wins
1. T1.3 — Raise memo limits + LRU eviction
2. T5.1 — Adaptive worker count (remove 4-worker cap)
3. T1.1 — Eliminate remaining `positionKey()` string GC on hot paths
4. T1.2 — Zobrist hashing for O(1) incremental state identity

### Phase 2: Search Intelligence
5. T2.2 — Full tunnel macro moves
6. T2.1 — Linear conflict heuristic enhancement
7. T1.4 — Parallel puzzle analysis (start search before analysis completes)
8. T2.3 — Full PI-corral pruning

### Phase 3: Deep Optimization
9. 3.1 — Finish compact macro-state storage
10. 3.2 — Finish adaptive FESS queues
11. T4.1 — Dense state representation throughout
12. T4.2 — Compact `ArrayBuffer` transposition table
13. T2.6 — Extended goal-cut decomposition

### Phase 4: Product Polish
14. Sprint 5 — Runtime consolidation and Python parity
15. Sprint 6 — Accessibility, mobile review, release hygiene
16. Sprint 7 — User-authored puzzles

### Phase 5: Competitive Edge
17. T6.1 — Complete WASM inner loop
18. T6.3 — Full solution improvement pipeline
19. 3.3 — Partial-order reduction
20. 3.4 — Complete symmetry reduction
