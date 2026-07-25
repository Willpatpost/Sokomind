# How to Build the Best Sokoban Solver Ever

## The Ultimate Bidirectional Solver: A Complete Optimization Roadmap

**Goal**: Solve any Sokoban puzzle within 30 seconds, produce reasonably optimal solutions, run efficiently on phones/tablets/desktops in the browser.

**Current state**: The solver is already strong. It has Hungarian heuristics with incremental repair, multi-layer deadlock detection, a portfolio of search algorithms orchestrated by a director, Web Worker parallelism, a dense typed-array board representation, topology analysis with gated rooms, and bidirectional search with bridge campaigns. What follows are the changes that would take it from strong to dominant.

This report is organized by expected impact, with estimated difficulty. Each section includes precise file/line references to the current codebase.

---

## Table of Contents

1. [Tier 1: Highest-Impact, Fastest Wins](#tier-1)
2. [Tier 2: Algorithmic Depth Improvements](#tier-2)
3. [Tier 3: Pre-Search Intelligence ("Read the Puzzle")](#tier-3)
4. [Tier 4: Memory and Representation Overhaul](#tier-4)
5. [Tier 5: Mobile and Resource-Constrained Optimization](#tier-5)
6. [Tier 6: Stretch Goals for Competitive Dominance](#tier-6)
7. [Implementation Priority Matrix](#priority-matrix)

---

<a name="tier-1"></a>
## Tier 1: Highest-Impact, Fastest Wins

These changes offer the greatest performance improvement per line of code changed. They address the hottest bottlenecks measured in the inner loop.

### 1.1 Eliminate String-Key GC Pressure (Critical)

**The problem**: `pkey(y, x)` at `solver-engine.js:5` creates a new string `"${y},${x}"` on every call. This function is called millions of times per search: in `pushNeighbors()`, in `reachablePaths()`, in `boxSignature()`, in heuristic computation, in deadlock checks. Each call allocates a short-lived string that the garbage collector must later sweep. On mobile devices, GC pauses of 10-50ms can stall the search dozens of times per second.

**The fix**: Replace all string coordinate keys with integer cell IDs from the dense board. The dense board (`compileDenseBoard()` at `solver-engine.js:940`) already assigns integer IDs to every floor cell and stores neighbor relationships in `Int32Array`. The problem is that the dense board is used inconsistently: many functions still call `pkey()` to look up cells by string key when they could use the integer ID directly. A systematic audit should convert every hot-path function to pass and receive integer cell IDs instead of `"y,x"` strings.

Specific targets:
- `reachablePaths()` and `reachablePathsById()` should work exclusively with dense IDs
- `pushNeighbors()` at `solver-engine.js:4183` already uses `dense.neighbors` but still calls `pkey()` for `boxPosition` and `dest`
- `heuristic()` should accept and return dense-ID-based data structures
- `staticDead()` should take a cell ID, not (y, x) coordinates
- `boxSignature()` should use sorted token arrays, not `pkey()` string concatenation

**Impact**: 15-30% overall speed improvement from reduced GC pressure alone. Larger on mobile where GC is slower.

**Difficulty**: Medium. Requires threading integer IDs through many functions, but the dense board infrastructure already exists.

### 1.2 Zobrist Hashing for State Identity (Critical)

**The problem**: State identity is computed by `packedIdentityFromTokens()` at `solver-engine.js:10-20` using BigInt arithmetic: sorting tokens, then shifting and OR-ing them into a single BigInt. `boxSignature()` at `solver-engine.js:6-8` produces sorted string signatures. Both are expensive: BigInt arithmetic is ~10x slower than 32-bit integer math, and string sorting/joining allocates GC-pressured intermediates.

**The fix**: Implement Zobrist hashing. Pre-compute a random 64-bit value for each (cell_id, label) pair during board compilation. A state's hash is the XOR of the Zobrist values for each box placement. When a box moves, the hash is updated incrementally in O(1) by XOR-ing out the old position and XOR-ing in the new position.

```
newHash = oldHash ^ zobrist[oldCell][label] ^ zobrist[newCell][label]
```

This gives O(1) incremental state hashing vs the current O(n log n) sort + O(n) BigInt packing.

For collision safety, use a pair of 32-bit hashes (effectively 64-bit). The probability of collision among 10^6 states is ~10^-7, which is acceptable for a best-effort solver.

**Where to implement**:
- Add `zobristTable` to the `compileDenseBoard()` output at `solver-engine.js:940`
- Modify `pushIdentity()` at `solver-engine.js:160-177` to use Zobrist XOR
- Replace `boxSignature()` usage in transposition tables throughout `solver-search.js`
- In `BoundedDepthMap` at `solver-engine.js:454`, keys become 64-bit integers instead of BigInts or strings

**Impact**: 20-40% improvement in states-per-second. Eliminates the dominant per-state overhead.

**Difficulty**: Medium. Requires careful collision testing but the implementation is straightforward.

### 1.3 Raise Memo Limits and Fix Eviction Policy (High)

**The problem**: At `solver-engine.js:184-204`, the constants are conservative:
```
HEURISTIC_MEMO_LIMIT = 20000
DEADLOCK_MEMO_LIMIT = 10000
PATTERN_DEADLOCK_MEMO_LIMIT = 10000
PUSH_TRANSITION_MEMO_LIMIT = 2000
```

On hard puzzles, these limits cause heavy eviction: the solver recomputes heuristics and deadlock checks for states it has already evaluated. Moreover, `memoizeBounded()` at `solver-engine.js:448` evicts the oldest entry (FIFO), not the least-recently-used. This means high-value entries near the search frontier get evicted while low-value entries from abandoned branches survive.

**The fix**:
1. **Raise limits**: `HEURISTIC_MEMO_LIMIT` to 100,000 (costs ~8MB at 80 bytes/entry). `DEADLOCK_MEMO_LIMIT` to 50,000. `PUSH_TRANSITION_MEMO_LIMIT` to 10,000. These are still comfortable on 4GB mobile devices.
2. **LRU eviction**: Replace `memoizeBounded()` FIFO deletion with true LRU. JavaScript's `Map` iteration order is insertion order, so `Map.delete(key)` followed by `Map.set(key, value)` on every access promotes the key to newest. This makes `memoizeBounded()` a true LRU cache with zero additional data structures:

```javascript
function memoizeBounded(memo, key, value, limit) {
  if (memo.size >= limit) memo.delete(memo.keys().next().value);
  memo.set(key, value);
  return value;
}
// On lookup (add to heuristic(), deadlock check, etc.):
function memoLookup(memo, key) {
  const value = memo.get(key);
  if (value !== undefined) {
    memo.delete(key);
    memo.set(key, value);
  }
  return value;
}
```

3. **Memory-aware budgeting**: Use `navigator.deviceMemory` (already read in `director-policy.js:150`) to scale memo limits. On 8GB+ devices, double them. On 2GB devices, halve them.

**Impact**: 10-25% fewer heuristic recomputations on hard puzzles.

**Difficulty**: Low. The LRU fix is 5 lines. Raising limits is a constant change.

### 1.4 Parallelize Puzzle Analysis (High)

**The problem**: At `solver-director.js:176-218`, `startBidirectionalSolver()` launches a single analysis worker that must complete before any search workers start. The analysis includes topology computation, pattern database building, goal table compilation, and push distance calculation. On complex puzzles, this takes 500-2000ms of wall time where no search is happening.

**The fix**: Split analysis into independent tasks and run them in parallel:
- **Task A (fast)**: Dense board compilation, static dead squares, basic topology (tunnels, articulation points). ~50ms.
- **Task B (medium)**: Pattern database compilation (room patterns, pair conflicts, capacity patterns). ~200-500ms.
- **Task C (medium)**: Single-box push graph and goal push tables. ~100-300ms.
- **Task D (slow)**: Room evacuation precomputation. ~200-1000ms.

Start search workers as soon as Task A completes with a minimal prepared board. Ship the pattern database and push tables to running workers via `postMessage()` once Tasks B and C finish. This turns the current serial "analyze then search" into "analyze while searching."

Additionally, the `structuralHeadStartMs()` at `director-policy.js:157-161` adds 600-900ms of deliberate delay for the structural plan. This delay is wasted if the structural plan could be computed concurrently.

**Impact**: 500-1500ms faster time-to-first-search on complex puzzles. This is huge for the 30-second target.

**Difficulty**: Medium-High. Requires refactoring the prepared board to be progressively enriched.

---

<a name="tier-2"></a>
## Tier 2: Algorithmic Depth Improvements

These improve the quality and reach of the search itself: better pruning, better heuristics, smarter search strategies.

### 2.1 Linear Conflict Heuristic Enhancement (High)

**The problem**: The current `heuristic()` uses the Hungarian algorithm for minimum-cost box-to-goal assignment (`minimumAssignment()` at `solver-engine.js:981`). This is an excellent lower bound but misses a common situation: when two boxes are in the same row/column, both heading for goals in that row/column, but they are in each other's way. The assignment cost counts their individual distances but not the extra moves needed to get one out of the other's path.

**The fix**: Implement linear conflict detection. After computing the Hungarian assignment, scan each row and column for pairs of boxes where:
1. Both boxes are assigned to goals in this row/column
2. The boxes are between their respective goals
3. Moving box A to its goal requires passing through box B's current position and vice versa

Each such conflict adds at least +2 to the lower bound (the conflicting box must be moved out and back). This is a well-known admissible enhancement to Manhattan-distance-based heuristics.

For Sokomind's push-distance heuristic (which is already better than Manhattan), linear conflict still applies: scan each row/column for box pairs whose assigned goals are in opposite relative order along that axis. Each conflict adds +2 pushes.

**Impact**: 5-15% fewer states explored on puzzles with corridor arrangements. The tighter bound prunes more aggressively in A* and IDA*.

**Difficulty**: Medium. ~100 lines of code, needs careful admissibility testing.

### 2.2 Tunnel Macro Moves (High)

**The problem**: The solver detects tunnels at `solver-engine.js:593-598` (cells with exactly 2 collinear floor neighbors), but doesn't compile them into macro moves. When a box enters a one-way tunnel, every intermediate push is forced: the box must continue to the end. Exploring each intermediate state wastes time since there is no branching.

**The fix**: During board compilation, identify all maximal tunnel segments: sequences of cells where each has exactly 2 collinear neighbors and no goals except possibly at the endpoints. For these tunnels:
1. **Macro pushes**: When `pushNeighbors()` generates a push into a tunnel, replace it with a single macro push to the tunnel exit. The path cost is the full tunnel length, but only one state is generated.
2. **One-way detection**: If the tunnel has a dead-end (wall at one end), any box pushed in is committed: it must reach the goal at the other end or the puzzle is dead. Prune immediately if the box's label doesn't match a goal at the exit.
3. **Tunnel with goals**: If a goal sits at a tunnel midpoint, generate two successors: one where the box stops at the goal, and one where it continues through.

The existing tunnel detection in `analyzeTopology()` provides the raw data. The missing piece is converting detected tunnels into compiled macro push descriptors that `pushNeighbors()` can use.

**Impact**: 20-50% fewer states on puzzles with corridors (which is most Sokoban puzzles). The savings compound because corridor pushes are common in the early/mid game.

**Difficulty**: Medium. Requires changes to `pushNeighbors()` and the prepared board, but the concept is well-understood.

### 2.3 Full PI-Corral Pruning (High)

**The problem**: The solver has partial corral deadlock detection via `createsSealedCorralDeadlock()` at `solver-engine.js:4173`. A sealed corral is a connected region of cells that the player cannot reach, where all boxes inside are frozen. But the full PI-corral (Player-Inaccessible Corral) pruning from the literature is more powerful.

**The fix**: Implement full PI-corral pruning as described by Junghanns & Schaeffer:
1. After each push, compute the player's reachable region (already done as `reachablePaths()`).
2. Identify all connected components of floor cells NOT reachable by the player (PI-corrals).
3. For each PI-corral, check if the boxes inside can all reach their goals without the player entering the corral. If not, the state is dead.
4. **Key optimization**: A PI-corral is dead if any box inside is on a dead square, or if the boxes inside form a frozen component. These checks are cheap because the corral is typically small.

The difference from sealed corrals is that PI-corral pruning catches more cases: corrals where boxes aren't individually dead but collectively can't be solved because the player can never re-enter to help.

**Impact**: 5-15% more states pruned on puzzles with rooms and corridors. Some puzzles that are currently unsolvable within budget become solvable.

**Difficulty**: Medium. The reachability infrastructure exists; the additional component analysis and per-corral deadlock checking is ~200 lines.

### 2.4 Adaptive Portfolio Strategy (Medium-High)

**The problem**: The portfolio in `solver-director.js:150-174` uses a fixed set of search algorithms and beam profiles. The allocation doesn't adapt to runtime performance: if beam search is making progress (improving heuristic estimates) while A* is stuck, the director doesn't reallocate workers.

**The fix**: Implement a bandit-style adaptive portfolio:
1. **Performance tracking**: Each worker reports states/second, best heuristic found, and whether it found any solutions. Track an exponential moving average.
2. **Reallocation triggers**: Every 5 seconds, evaluate each strategy's "productivity":
   - If a strategy found a solution, mark it as valuable and allocate more workers to beam-restarts with tightened bounds.
   - If a strategy's best heuristic hasn't improved in 10 seconds, mark it as stalled.
   - If all strategies are stalled, switch to a diversification phase: restart beam searches with different seeds and parameters.
3. **Parameter tuning**: Use the puzzle analysis (`searchScale`, topology data) to set initial beam widths and weights. Currently `launch()` at `solver-director.js:1150` uses fixed profiles; these should be data-driven:
   - Small puzzles (< 10 boxes, < 50 floor cells): favor exact methods (A*, IDA*)
   - Medium puzzles (10-20 boxes): balanced portfolio
   - Large puzzles (> 20 boxes): favor beam search and FESS
   - Puzzles with many rooms: favor plan-macro-beam
   - Open puzzles with few walls: favor FESS with high diversity

**Impact**: 15-30% faster median solve time by not wasting workers on unproductive strategies.

**Difficulty**: Medium-High. Requires refactoring the director's worker management loop.

### 2.5 Depth-Preferred Transposition Eviction (Medium)

**The problem**: `BoundedDepthMap` at `solver-engine.js:454-469` evicts the oldest entry when full, regardless of depth. In IDA*, shallow states are revisited much more often than deep states. Evicting a shallow state means recomputing its heuristic every time the search backtracks through that region.

**The fix**: Implement depth-bucketed eviction. Maintain a small priority queue or a depth histogram. When evicting, prefer evicting the deepest entries (which are least likely to be revisited). For beam search, prefer evicting entries from old beam layers that the search has moved past.

A simpler approximation: in `BoundedDepthMap.set()`, when the map is full, scan the last N entries (e.g., 16) and evict the one with the highest depth/cost value. This is O(1) amortized with small constant.

**Impact**: 5-10% fewer recomputations in IDA* and deep A* searches.

**Difficulty**: Low-Medium. Requires adding a cost/depth field to map entries and modifying eviction logic.

### 2.6 Goal-Cut Decomposition Extensions (Medium)

**The problem**: `goalCutDecomposition()` at `solver-engine.js:3577` splits the puzzle at articulation points where each resulting component has balanced box/goal counts per label. This is powerful but conservative: it only fires when the cut point is static-dead for all labels and the partition is perfectly balanced.

**The fix**: Extend decomposition to handle:
1. **Near-balanced cuts**: If a component has one extra box that can trivially reach the other side (e.g., there's a clear path through the cut point), still decompose and solve the balanced portion first.
2. **Multi-cut decomposition**: Chain multiple cuts to decompose into 3+ subproblems. Solve the smallest subproblems first (they're cheapest) and use their solutions to constrain the remaining subproblems.
3. **Dynamic decomposition**: After solving a subproblem, check if the remaining state decomposes further. This creates a cascade of simplifications.
4. **Gate-based decomposition**: Use the topology's gated rooms (already computed) as decomposition hints. If a room's boxes can all be solved independently of boxes outside the room, solve the room first.

**Impact**: Dramatic on large, structured puzzles (the kind that are currently hardest to solve). Turns one 50-box problem into several 5-10 box problems.

**Difficulty**: Medium-High. Multi-cut and dynamic decomposition require careful ordering and correctness guarantees.

---

<a name="tier-3"></a>
## Tier 3: Pre-Search Intelligence ("Read the Puzzle")

This is the user's specific request: the solver should deeply understand the puzzle before committing to a search strategy. Currently, `analyzePuzzleForSearch()` computes topology, push distances, and pattern databases. Here's how to make it much smarter.

### 3.1 Difficulty Classification (High)

**The problem**: The solver treats all puzzles roughly the same. A 5-box puzzle in a tight room gets the same portfolio allocation as a 30-box maze. The `searchScale` metric provides some differentiation, but it's a single scalar that doesn't capture puzzle character.

**The fix**: Build a multi-feature difficulty classifier that produces a puzzle profile:

**Features to extract** (all computable in <100ms):
- Box count, floor cell count, box-to-floor ratio
- Number of rooms, corridors, tunnels, dead-ends
- Number of articulation points (gates between rooms)
- Average/max box-to-nearest-goal push distance
- Number of distinct labels (colored boxes)
- Hungarian lower bound
- Connectivity: number of player-reachable regions after removing boxes
- Congestion score: ratio of boxes to passage width at narrowest chokepoint
- Goal cluster tightness: average distance between goals
- Initial deadlock risk: number of boxes already on dead squares or in 2x2 traps

**Puzzle profiles** (choose search strategy based on profile):
- **Trivial** (< 4 boxes, low congestion): Direct A* with tight bound
- **Corridor** (many tunnels, few rooms): Enable tunnel macros, use IDA* with deep bound
- **Room-based** (many rooms, few corridors): Plan-macro-beam, gate-ordered solving
- **Open field** (high floor-to-box ratio, few walls): FESS with diversity, beam search
- **Dense** (high box-to-floor ratio, high congestion): Heavy deadlock detection, beam with wide diversity
- **Mega** (> 20 boxes or > 200 floor cells): Decomposition-first, then per-component solving

This classifier replaces the fixed `portfolioSlotAllocation()` with data-driven allocation.

**Impact**: Major. The right strategy for the puzzle means the solver doesn't waste 20 seconds on an approach that can't work.

**Difficulty**: Medium. Feature extraction uses existing infrastructure. The mapping from features to strategy is initially hand-tuned, later optimizable via benchmarking.

### 3.2 Goal Ordering and Dependency Analysis (High)

**The problem**: The solver explores pushes without a global plan for which boxes to solve first. In many puzzles, solving boxes in the wrong order creates deadlocks. The human approach is to identify which boxes must be solved first (typically the ones deepest in rooms) and work backwards.

**The fix**: During pre-search, compute a goal solving order:

1. **Dependency graph**: For each goal G, identify which other goals must NOT have their box placed yet when solving G (because placing them would block access). Build this as a partial order over goals.
2. **Topological ordering**: Compute a topological sort of the dependency graph. This gives the order in which goals should be filled.
3. **Integration with beam search**: Use the goal order as a secondary scoring component. States that have filled goals in the correct order get a score bonus; states that have filled goals out of order get a penalty.
4. **Integration with FESS**: FESS feature cells can be scheduled according to the goal order, prioritizing movement of boxes toward their first-priority goals.

The existing `supportDependency()` and `localRoom()` analyses partially capture this, but they don't produce a global solving order.

**Impact**: 10-30% faster on room-based puzzles. Prevents the solver from exploring dead-end orderings.

**Difficulty**: Medium-High. Dependency extraction requires reasoning about which box placements block which corridors.

### 3.3 Chokepoint and Congestion Mapping (Medium)

**The problem**: The solver doesn't identify narrow passages where box traffic jams are inevitable. On puzzles where multiple boxes must pass through a 1-cell-wide corridor, the solver wastes time exploring states that will inevitably deadlock because too many boxes are crowded near the bottleneck.

**The fix**: During pre-search, identify chokepoints:
1. Compute min-cut between each box's starting position and its assigned goal
2. Cells that appear in many min-cuts are chokepoints
3. For each chokepoint, compute its "capacity": how many boxes can pass through it simultaneously (typically 1 for single-cell corridors)
4. Add a congestion penalty to the heuristic: if N boxes need to pass through a capacity-1 chokepoint, add a penalty proportional to the number of boxes currently clustered near it

**Impact**: 5-15% on corridor-heavy puzzles.

**Difficulty**: Medium. Min-cut computation on the push graph is O(V*E) per box but the graph is small.

### 3.4 Retrograde Analysis for Critical Configurations (Medium)

**The problem**: Forward search doesn't know which near-goal configurations are reachable from the goal state backwards. It may spend time pushing boxes close to their goals but in positions from which the final placement is impossible.

**The fix**: During pre-search, perform backward search from the goal state:
1. Start from the solved state (all boxes on goals)
2. Generate all reverse pushes (pull operations) to depth D (e.g., D=8)
3. Store the resulting states in a lookup table
4. During forward search, when the heuristic drops below D, check if the current state exists in the backward table. If yes, the puzzle is solved (join the paths). If no states near the current one are in the table, increase the heuristic estimate.

This is the "reverse search" component of the bidirectional solver, but done more systematically as a pre-search table. The current `runBidirectionalSolver()` at `solver-director.js:219` does forward/reverse interleaving at runtime; doing a bounded retrograde analysis upfront is cheaper and provides a permanent lookup table for all forward workers.

**Impact**: High on medium puzzles (10-15 boxes). The backward table is small but invaluable when the forward search reaches the neighborhood of the solution.

**Difficulty**: Medium. Reverse push generation already exists in `bridgeAStarSearch()`.

### 3.5 Pattern Database Enhancement (Medium)

**The problem**: The current pattern databases at `solver-engine.js:188-196` are limited:
```
PATTERN_FLOOR_LIMIT = 18    // max floor cells per pattern region
PATTERN_BOX_LIMIT = 4       // max boxes per pattern
```

These limits mean large rooms don't get pattern databases. Also, the pair conflict database (`PAIR_CONFLICT_MAX_STATES = 4000`) is too small for rooms with 5+ goals.

**The fix**:
1. **Raise limits**: `PATTERN_FLOOR_LIMIT` to 24, `PATTERN_BOX_LIMIT` to 5. Memory cost is acceptable: 5 boxes in 24 cells = C(24,5) * 5! = 5.06M entries, storable as a hash map with ~200MB if naively stored but much less with typed-array encoding.
2. **Additive pattern databases**: Split large rooms into overlapping subregions, compute pattern databases for each, and take the max over all subregion PDBs. This is admissible and captures inter-box conflicts better than a single global heuristic.
3. **Compressed PDBs**: Store PDB entries as (hash → cost) in a `Uint8Array` with open addressing. Most costs fit in a byte (0-255 pushes). This is 10x more memory-efficient than a `Map`.

**Impact**: 5-20% on puzzles with large rooms.

**Difficulty**: Medium. PDB computation is CPU-intensive but happens during pre-search.

---

<a name="tier-4"></a>
## Tier 4: Memory and Representation Overhaul

### 4.1 Dense State Representation Throughout (High)

**The problem**: The solver has two state representations: (1) the original `{robot: [y,x], boxes: [[y,x,label], ...]}` array-of-arrays format used by most code, and (2) the dense typed-array format from `compileDenseBoard()`. Many functions convert between the two, wasting time and memory.

**The fix**: Standardize on a single dense representation:
- A state is a `Uint16Array` where `state[0]` is the player cell ID, `state[1..n]` are sorted box cell IDs, and labels are stored in a parallel `Uint8Array`.
- All search functions operate directly on this representation.
- Push generation writes new states by copying the array and modifying one entry.
- Sorting is maintained incrementally: when a box moves, binary-search for its old position, splice it out, binary-search for its new position, splice it in.

Benefits:
- Zero GC pressure from state creation (typed arrays are not GC-tracked the same way)
- Cache-friendly iteration (contiguous memory)
- Trivial hashing (XOR over a typed array)
- `postMessage()` transfers typed arrays with zero-copy via `Transferable`

**Impact**: 15-25% overall speedup from cache friendliness and reduced GC.

**Difficulty**: High. Requires rewriting core state manipulation functions.

### 4.2 Compact Transposition Table (Medium-High)

**The problem**: Transposition tables use JavaScript `Map` with BigInt or string keys. Each entry costs ~100-200 bytes including Map overhead, key allocation, and value boxing. At 500K entries, this is 50-100MB.

**The fix**: Implement a custom hash table using `ArrayBuffer`:
- Allocate a `Uint32Array` of size 2^N (power-of-two for modular hashing)
- Each slot stores [hash_high32, hash_low32, depth, cost] as 4 uint32 values (16 bytes)
- Use open addressing with linear probing
- On collision, keep the entry with the lower cost (for A*) or higher depth (for IDA*)
- No GC pressure: the entire table is a single allocation

At 16 bytes/entry, a 1M-entry table costs 16MB. This is 5-10x more entries than the current approach in the same memory.

**Impact**: 5-10x more transposition entries in the same memory budget, meaning fewer recomputations.

**Difficulty**: Medium. Hash table implementation is well-understood; the tricky part is handling Zobrist hash collisions correctly.

### 4.3 Packed Path Representation (Medium)

**The problem**: Solution paths are stored as arrays of direction strings (`["Up", "Left", "Down", ...]`). Each step is a 2-8 byte string plus array overhead. For solutions of 500+ moves, this is significant memory.

**The fix**: Pack paths as 2-bit-per-step in `Uint32Array`. Each direction is 2 bits (Up=0, Down=1, Left=2, Right=3). A 32-bit word holds 16 steps. A 500-move solution fits in 32 bytes.

The FESS search already does this (see `solver-search.js:489-848` arena allocator with 2-bit packed paths). Extend the pattern to all search algorithms.

**Impact**: Low memory savings, moderate speed improvement from cache density during path reconstruction.

**Difficulty**: Low. FESS already has the implementation; generalize it.

---

<a name="tier-5"></a>
## Tier 5: Mobile and Resource-Constrained Optimization

### 5.1 Adaptive Worker Count and Memory Budget (High)

**The problem**: `portfolioWorkerCapacity()` at `director-policy.js:150-155` caps at 4 workers regardless of hardware. Modern phones have 4-8 cores; modern desktops have 8-16+. The cap leaves performance on the table.

```javascript
function portfolioWorkerCapacity(hardwareConcurrency = 2, deviceMemory = 4) {
  const hardware = Math.max(2, Math.floor(hardwareConcurrency) || 2);
  const memory = ...deviceMemory...;
  return Math.max(2, Math.min(4, hardware, memoryCapacity));
}
```

**The fix**:
1. Raise the cap to `Math.min(hardwareConcurrency - 1, memoryCapacity)`. Reserve 1 core for the main thread/UI. On a phone with 4 cores, use 3 workers. On a desktop with 16 cores, use up to 8 (diminishing returns beyond 8 for most puzzles due to transposition table contention).
2. Scale memory budgets proportionally. `exactTranspositionLimit()` at `director-policy.js:136-141` should scale more aggressively with available memory:

```javascript
function exactTranspositionLimit(deviceMemory = 4, shardCount = 1) {
  const memory = ...;
  const shards = ...;
  const totalBudget = memory >= 16 ? 2000000
                    : memory >= 8  ? 1200000
                    : memory >= 4  ? 640000
                    : memory >= 2  ? 320000
                    : 160000;
  return Math.max(80000, Math.min(800000, Math.floor(totalBudget / shards)));
}
```

3. On low-memory devices (< 2GB), disable pattern databases and reduce beam width to stay within budget. The solver should degrade gracefully, not crash.

**Impact**: 30-60% faster on high-end devices. Prevents crashes on low-end devices.

**Difficulty**: Low. Constant tuning with a few conditionals.

### 5.2 Progressive Enhancement for Mobile (Medium)

**The problem**: Mobile browsers are more likely to background the tab, throttle Web Workers, and impose memory pressure. The solver doesn't handle these gracefully.

**The fix**:
1. **Visibility API integration**: When the page is backgrounded (`visibilitychange` event), pause non-essential workers. When foregrounded, resume. This prevents the browser from killing workers due to background CPU usage.
2. **Memory pressure monitoring**: Use `performance.measureUserAgentSpecificMemory()` (Chrome) or fall back to `performance.memory` (deprecated but available) to track memory usage. If approaching 80% of `deviceMemory`, trigger aggressive eviction in transposition tables.
3. **Checkpoint-on-throttle**: When a worker detects it's being throttled (its `performance.now()` delta is much larger than wall-clock time), save a checkpoint and yield. Resume when un-throttled.
4. **Touch-friendly interruption**: Add a "pause/resume" button (not just "stop") so mobile users can pause the search, play a move manually, and resume from the new state.

**Impact**: Prevents mobile-specific failures. Makes the solver feel responsive on mobile.

**Difficulty**: Medium. Browser API integration and edge case handling.

### 5.3 UI Rendering Optimization (Medium)

**The problem**: `renderSearchLog()` in `app.js:89-94` re-renders the entire search log DOM on every log append. During active search, this can fire 10-50 times per second, causing UI jank on mobile.

**The fix**:
1. **Batch rendering**: Accumulate log entries in a buffer. Render at most once per `requestAnimationFrame()` (16ms). This cuts rendering from 50/s to 60/s max, but each render is incremental.
2. **Incremental DOM**: Only append new log entries to the DOM; don't re-render the entire log.
3. **Virtual scrolling**: If the log exceeds 100 entries, only render the visible portion. Keep the rest in a data array.
4. **Solution validation off-thread**: Solution validation at `app.js:313-324` runs on the main thread. Move it to a worker to prevent UI freezes.

**Impact**: Smoother UI, especially on mobile. Doesn't affect solver speed but prevents the perception of lag.

**Difficulty**: Low-Medium.

---

<a name="tier-6"></a>
## Tier 6: Stretch Goals for Competitive Dominance

These are higher-effort changes that could make the solver genuinely best-in-class, surpassing dedicated desktop solvers like Sokolution, YASS, and Festival.

### 6.1 WebAssembly Inner Loop (High Impact, High Effort)

**The problem**: JavaScript's JIT compiler does an excellent job, but for the innermost loops (push generation, reachability BFS, heuristic computation), WASM offers 2-5x faster execution because it avoids type-check overhead, has fixed-width integers, and uses contiguous memory.

**The fix**: Port the hot inner loop to WASM (Rust or C compiled via Emscripten/wasm-pack):
- `pushNeighbors()` + `reachablePaths()` + `heuristic()` as a single WASM module
- State is a struct in WASM linear memory; JS passes a pointer
- The transposition table is also in WASM linear memory (a giant `ArrayBuffer`)
- Search control (frontier management, worker communication) stays in JavaScript

**What to port**:
1. Dense board data (neighbors, goals, dead squares) → WASM linear memory
2. Reachability BFS → WASM function, returns bitset of reachable cells
3. Push generation → WASM function, writes candidate pushes to a pre-allocated output buffer
4. Hungarian assignment → WASM function (cache the assignment, repair incrementally)
5. Deadlock checks (static dead, 2x2, freeze) → WASM functions

**What to keep in JS**:
- Frontier (priority queue / beam array) management
- Worker coordination (postMessage)
- Board parsing and serialization
- Pattern database construction

**Impact**: 2-5x states/second improvement. This alone could push the 30-second solve target to 6-15 seconds.

**Difficulty**: High. Requires Rust/C expertise, cross-compilation toolchain, and careful JS↔WASM interface design. But the payoff is enormous.

### 6.2 Learned Heuristic via TensorFlow.js (Medium Impact, High Effort)

**The problem**: The Hungarian heuristic is admissible but not perfectly informed. A neural network trained via self-supervised learning (the DeepCubeA approach) could provide much tighter cost-to-go estimates. Tighter estimates mean A* and IDA* explore dramatically fewer states.

**The approach**:
1. **Offline training**: Generate millions of (state, optimal_cost) pairs from solved puzzles of various sizes using backward search from the goal state. Train a CNN or graph neural network to predict cost-to-go.
2. **Architecture**: Input is a multi-channel 2D grid (walls, floor, boxes, goals, player). Output is a scalar cost estimate. Small enough to run in TF.js: ~500K parameters, ~1ms per inference.
3. **Deployment**: Ship the model as a .json + .bin file (~2MB). Load it into a Web Worker with TF.js. Use it as an alternative heuristic when the puzzle matches the training distribution.
4. **Hybrid approach**: Use `max(hungarian, neural)` as the heuristic. This preserves admissibility (if the neural net underestimates, the Hungarian catches it) and gains tighter bounds (if the neural net gives a higher, correct estimate, A* prunes more).

**Known challenges**:
- Training data generation requires a strong solver (bootstrap problem)
- Generalization to puzzle sizes unseen during training
- TF.js inference latency (~1ms) may be too slow for the inner loop (apply it every 100 states instead of every state)
- Model size must be small enough for mobile

**Impact**: If the model is well-trained, 50-90% fewer states explored. But this is the hardest item to get right.

**Difficulty**: Very High. Requires ML pipeline, training infrastructure, and careful engineering.

### 6.3 Solution Improvement via Local Search (Medium Impact, Medium Effort)

**The problem**: The solver finds a solution but it may be far from optimal. The current `solutionWindowRewriteSearch()` in `solver-search.js:3638` does local optimization, but it's limited to window-based rewriting.

**The fix**: After finding any solution, run a multi-pass improvement phase:
1. **Push permutation**: Identify independent pushes that can be reordered to reduce total moves. Two pushes are independent if they move different boxes and the player's path between them can be rerouted.
2. **Segment optimization**: Split the solution into segments (delimited by goal-filling events). Re-solve each segment optimally using bounded A* with the known push count as bound. If a shorter segment is found, splice it in.
3. **Global reoptimization**: With the improved solution as an upper bound, restart A* or IDA* with a tightened `upperBound`. The better the initial solution, the more aggressively the optimal search can prune.
4. **Anytime improvement loop**: Keep improving until the time budget expires. Report each improvement to the UI so the user sees progress.

The director's current `improveSolution()` mechanism supports this pattern but doesn't implement segment optimization.

**Impact**: 10-40% shorter solutions. Users see the solution count decreasing over time, which builds confidence.

**Difficulty**: Medium. Segment extraction and re-solving are clean operations given the existing search infrastructure.

### 6.4 Subproblem Caching Across Puzzles (Low Impact, Medium Effort)

**The problem**: Each puzzle is solved from scratch. If the user is playing a level set where many puzzles share structural patterns (common in Sokoban level packs), previously computed pattern databases and partial solutions could be reused.

**The fix**: Cache pattern database results in IndexedDB, keyed by room geometry. When a new puzzle has rooms with the same shape (up to rotation/reflection), reuse the cached PDB. This saves 200-1000ms of PDB computation time.

**Impact**: Only matters for level-set play, but there it saves significant time.

**Difficulty**: Medium. Requires geometric hashing for room shapes and IndexedDB integration.

---

<a name="priority-matrix"></a>
## Implementation Priority Matrix

| Priority | Item | Expected Impact | Difficulty | Dependencies |
|----------|------|----------------|------------|--------------|
| **P0** | 1.1 Eliminate pkey() string GC | 15-30% speed | Medium | None |
| **P0** | 1.2 Zobrist hashing | 20-40% speed | Medium | 1.1 (better with dense IDs) |
| **P0** | 1.3 Raise memo limits + LRU | 10-25% speed | Low | None |
| **P0** | 1.4 Parallel analysis | 0.5-1.5s faster start | Medium-High | None |
| **P1** | 2.2 Tunnel macros | 20-50% fewer states | Medium | 1.1 |
| **P1** | 2.1 Linear conflict | 5-15% fewer states | Medium | None |
| **P1** | 3.1 Difficulty classifier | Major strategy improvement | Medium | None |
| **P1** | 5.1 Adaptive workers | 30-60% on high-end | Low | None |
| **P2** | 2.3 Full PI-corral | 5-15% more pruning | Medium | None |
| **P2** | 2.4 Adaptive portfolio | 15-30% median time | Medium-High | 3.1 |
| **P2** | 3.2 Goal ordering | 10-30% on room puzzles | Medium-High | 3.1 |
| **P2** | 4.1 Dense state throughout | 15-25% speed | High | 1.1, 1.2 |
| **P2** | 3.4 Retrograde analysis | High on medium puzzles | Medium | None |
| **P3** | 2.6 Goal-cut extensions | High on large puzzles | Medium-High | None |
| **P3** | 3.3 Chokepoint mapping | 5-15% on corridors | Medium | None |
| **P3** | 3.5 Pattern DB enhancement | 5-20% on large rooms | Medium | None |
| **P3** | 2.5 Depth-preferred eviction | 5-10% in IDA* | Low-Medium | None |
| **P3** | 4.2 Compact transposition table | 5-10x more entries | Medium | 1.2 |
| **P3** | 5.2 Mobile progressive enhancement | Reliability | Medium | None |
| **P3** | 5.3 UI rendering optimization | UX on mobile | Low-Medium | None |
| **P4** | 6.1 WASM inner loop | 2-5x inner loop speed | High | 4.1 |
| **P4** | 6.3 Solution improvement | 10-40% shorter solutions | Medium | None |
| **P4** | 6.2 Learned heuristic (TF.js) | 50-90% fewer states | Very High | Offline training |
| **P4** | 6.4 Subproblem caching | Save PDB time | Medium | None |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 weeks)
1. **1.3** Raise memo limits and add LRU eviction (half a day)
2. **5.1** Remove the 4-worker cap, scale with hardware (half a day)
3. **1.1** Eliminate `pkey()` calls on hot paths (3-5 days)
4. **1.2** Implement Zobrist hashing (2-3 days)

**Expected outcome**: 40-70% faster states/second. Most puzzles that currently take 60s now take 20-30s.

### Phase 2: Search Intelligence (2-3 weeks)
5. **3.1** Difficulty classifier and strategy selector (3-4 days)
6. **2.2** Tunnel macro moves (3-4 days)
7. **2.1** Linear conflict heuristic (2-3 days)
8. **1.4** Parallel puzzle analysis (3-4 days)
9. **2.3** Full PI-corral pruning (2-3 days)

**Expected outcome**: The solver "reads" the puzzle and chooses the right approach. Hard corridor puzzles that were unsolvable now solve in 10-20s. Time-to-first-search drops by 1s.

### Phase 3: Deep Optimization (3-4 weeks)
10. **2.4** Adaptive portfolio strategy (4-5 days)
11. **3.2** Goal ordering and dependency analysis (3-4 days)
12. **4.1** Dense state representation throughout (5-7 days)
13. **3.4** Retrograde analysis table (2-3 days)
14. **4.2** Compact transposition table (3-4 days)

**Expected outcome**: The solver handles most Sokoban test suites within the 30-second target. Solution quality improves by 15-30%.

### Phase 4: Competitive Dominance (4-8 weeks)
15. **6.1** WASM inner loop (2-3 weeks)
16. **6.3** Solution improvement phase (1 week)
17. **2.6** Extended goal-cut decomposition (1 week)
18. **6.2** Learned heuristic (ongoing research)

**Expected outcome**: The solver is competitive with the best desktop solvers, running entirely in the browser. On modern hardware, most puzzles solve in under 10 seconds.

---

## Key Principles

1. **Measure before optimizing**: Every change should be benchmarked against the existing test suite (Microban, Sasquatch, etc.) before and after. Track states/second, time-to-first-solution, and solution quality.

2. **Never sacrifice correctness for speed**: All heuristic improvements must remain admissible (or be clearly marked as inadmissible for beam/greedy). All deadlock detectors must be sound (no false positives in hard pruning).

3. **Degrade gracefully**: A phone with 2GB RAM and 4 cores should still solve most puzzles, just slower. Never crash on low-end hardware; reduce memo sizes, beam widths, and worker counts dynamically.

4. **Anytime behavior**: Always return the best solution found so far when the time budget expires. A suboptimal solution in 5 seconds is better than no solution in 30 seconds.

5. **The puzzle is the teacher**: Every puzzle the solver fails on is data. Log the failure mode (timeout, memory, no solution found) and the puzzle's feature profile. Use this data to tune the difficulty classifier and portfolio allocation.

---

## Comparison with State-of-the-Art Solvers

| Feature | Sokomind (current) | Sokolution | YASS | Festival | **Sokomind (after this roadmap)** |
|---------|-------------------|------------|------|----------|-----------------------------------|
| Platform | Browser (JS) | Desktop (C++) | Desktop (C++) | Desktop (C++) | **Browser (JS + WASM)** |
| Heuristic | Hungarian | Hungarian + PDB | PI-corral + PDB | Hungarian + linear conflict | **Hungarian + linear conflict + Zobrist + PDB + learned** |
| Deadlock | 6 layers | Full PI-corral | Full PI-corral | Frozen + corral | **Full PI-corral + pattern + sealed corral** |
| Search | Portfolio (beam, A*, IDA*, FESS) | IDA* + enhanced | IDA* | IDA* + decomposition | **Adaptive portfolio + tunnel macros + retrograde** |
| Decomposition | Goal-cut (basic) | Room decomposition | None | Full decomposition | **Multi-cut + gate-based + dynamic** |
| Workers | 2-4 | 1 (single thread) | 1 | 1 | **2-8 (adaptive)** |
| Mobile | Yes (slow) | No | No | No | **Yes (fast, graceful degradation)** |
| Pre-analysis | Topology + PDB | Basic | Minimal | Full | **Difficulty classification + goal ordering + congestion + retrograde** |

The key competitive advantage after this roadmap: **Sokomind will be the only solver that runs in the browser, adapts to hardware, and uses multi-threaded portfolio search with state-of-the-art pruning.** Desktop solvers are faster per-core but limited to single-threaded IDA*. Sokomind's parallelism and adaptive strategy can match or exceed their wall-clock performance.

---

*This report synthesizes analysis of every source file in the Sokomind codebase, comparison with published techniques from Sokolution, YASS, Festival, Rolling Stone, JSoko, and Takaken, and the academic literature on Sokoban solving (Junghanns & Schaeffer, Botea et al., Agostinelli et al./DeepCubeA). All line references are to the current codebase as of this audit.*
