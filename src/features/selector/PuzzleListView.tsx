import type { PuzzleDifficulty } from "@/src/catalog/puzzle-metadata";
import type { ProgressData } from "@/src/shared/progress";
import { isOptimal, type OptimalCache } from "@/src/shared/optimal-cache";
import { ExperienceControls } from "@/src/features/experience";
import {
  Link,
  puzzlesHash,
  puzzleDifficultyHash,
  playHash,
} from "@/src/router";
import type { RouterValue } from "@/src/router";
import { DIFFICULTY_LABELS } from "./selector-constants";
import { usePuzzleListState } from "./use-puzzle-list-state";
import { PuzzleFilters } from "./PuzzleFilters";
import { Pagination } from "./Pagination";
import styles from "./PuzzleSelectorPage.module.css";

export interface PuzzleListViewProps {
  readonly difficulty: PuzzleDifficulty;
  readonly collection: string;
  readonly completedIds: ReadonlySet<string>;
  readonly optimalCache: OptimalCache;
  readonly progress: ProgressData;
  readonly navigate: RouterValue["navigate"];
  readonly pageNumber?: number;
  readonly directDifficultyView?: boolean;
}

export function PuzzleListView({
  difficulty,
  collection,
  completedIds,
  optimalCache,
  progress,
  navigate,
  pageNumber,
  directDifficultyView = false,
}: PuzzleListViewProps) {
  const state = usePuzzleListState({
    difficulty,
    collection,
    completedIds,
    navigate,
    pageNumber,
    directDifficultyView,
  });

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <Link
              href={
                directDifficultyView
                  ? puzzlesHash()
                  : puzzleDifficultyHash(difficulty)
              }
              className={styles.backButton}
              aria-label={
                directDifficultyView
                  ? "Back to difficulties"
                  : "Back to collections"
              }
            >
              <span aria-hidden="true">&larr;</span>
            </Link>
            <h1 className={styles.pageTitle}>{state.viewLabel}</h1>
          </div>
          <ExperienceControls />
        </div>

        <nav className={styles.breadcrumb}>
          <Link href={puzzlesHash()}>Puzzles</Link>
          <span>&rsaquo;</span>
          {directDifficultyView ? (
            <span className={styles.breadcrumbCurrent}>
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          ) : (
            <>
              <Link href={puzzleDifficultyHash(difficulty)}>
                {DIFFICULTY_LABELS[difficulty]}
              </Link>
              <span>&rsaquo;</span>
              <span className={styles.breadcrumbCurrent}>{collection}</span>
            </>
          )}
        </nav>

        {state.nextUnsolved && (
          <button
            type="button"
            className={styles.nextButton}
            onClick={() => navigate(playHash(state.nextUnsolved!))}
          >
            Play next unsolved in {state.viewLabel}
          </button>
        )}

        <PuzzleFilters
          boxCounts={state.boxCounts}
          boxFilter={state.boxFilter}
          completionFilter={state.completionFilter}
          query={state.query}
          onBoxFilterChange={state.handleBoxFilterChange}
          onCompletionFilterChange={state.handleCompletionFilterChange}
          onSearchChange={state.handleSearchChange}
        />

        {state.filteredPuzzles.length > 0 ? (
          <>
            <p
              className={styles.resultSummary}
              ref={state.pageStatusRef}
              role="status"
              tabIndex={-1}
            >
              Showing {state.firstResult}&ndash;{state.lastResult} of{" "}
              {state.filteredPuzzles.length}
              {" puzzles"}
            </p>
            <div className={styles.puzzleList}>
              {state.visiblePuzzles.map((puzzle) => {
                const complete = completedIds.has(puzzle.id);
                const record = progress.completed[puzzle.id];
                const optimal = record
                  ? isOptimal(optimalCache, puzzle.id, record.moves)
                  : false;
                const num = (state.indexMap.get(puzzle.id) ?? 0) + 1;
                return (
                  <button
                    key={puzzle.id}
                    type="button"
                    className={styles.puzzleItem}
                    data-testid="puzzle-row"
                    onClick={() => navigate(playHash(puzzle.id))}
                  >
                    <span className={styles.puzzleNumber}>
                      {String(num).padStart(2, "0")}
                    </span>
                    <span className={styles.puzzleCopy}>
                      <strong>{puzzle.title}</strong>
                      <small>
                        {puzzle.width} &times; {puzzle.height}
                        {" · "}
                        {puzzle.boxes} {puzzle.boxes === 1 ? "box" : "boxes"}
                      </small>
                    </span>
                    {complete && (
                      <span
                        className={styles.puzzleComplete}
                        style={
                          optimal ? { color: "var(--amber-400)" } : undefined
                        }
                      >
                        {optimal ? "★" : "✓"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <Pagination
              ariaLabel={`${state.viewLabel} puzzle pages`}
              currentPage={state.currentPage}
              pageCount={state.pageCount}
              pageHash={state.pageHash}
            />
          </>
        ) : (
          <div className={styles.empty}>
            <strong>No puzzles match</strong>
            <span>Try adjusting your filters.</span>
          </div>
        )}
      </div>
    </main>
  );
}
