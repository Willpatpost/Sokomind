import { useCallback, useEffect, useMemo } from "react";
import {
  getMetadataCollectionsForDifficulty,
  type PuzzleMetadata,
} from "@/src/catalog/puzzle-metadata";
import { useStoredProgress } from "@/src/shared/use-stored-progress";
import { loadOptimalCache } from "@/src/shared/optimal-cache";
import { useRouter } from "@/src/router";
import type { Route } from "@/src/router";
import { DIFFICULTY_LABELS } from "./selector-constants";
import { DifficultyGrid } from "./DifficultyGrid";
import { CollectionGrid } from "./CollectionGrid";
import { PuzzleListView } from "./PuzzleListView";

type SelectorRoute = Extract<
  Route,
  { page: "puzzles" | "puzzles-difficulty" | "puzzles-collection" }
>;

interface PuzzleSelectorPageProps {
  readonly route: SelectorRoute;
}

export function PuzzleSelectorPage({ route }: PuzzleSelectorPageProps) {
  const { navigate } = useRouter();
  const progress = useStoredProgress();
  const completedIds = useMemo(
    () => new Set(Object.keys(progress.completed)),
    [progress],
  );
  const optimalCache = useMemo(() => loadOptimalCache(), []);

  useEffect(() => {
    if (route.page === "puzzles") {
      document.title = "Puzzles · Sokomind";
    } else if (route.page === "puzzles-difficulty") {
      document.title = `${DIFFICULTY_LABELS[route.difficulty]} Puzzles · Sokomind`;
    } else {
      document.title = `${route.collection} · Sokomind`;
    }
  }, [route]);

  const findNextUnsolved = useCallback(
    (puzzles: readonly PuzzleMetadata[]) => {
      return puzzles.find((p) => !completedIds.has(p.id))?.id;
    },
    [completedIds],
  );

  if (route.page === "puzzles") {
    return (
      <DifficultyGrid
        completedIds={completedIds}
        findNextUnsolved={findNextUnsolved}
        navigate={navigate}
      />
    );
  }

  if (route.page === "puzzles-difficulty") {
    const collections = getMetadataCollectionsForDifficulty(route.difficulty);
    if (collections.length === 1) {
      return (
        <PuzzleListView
          difficulty={route.difficulty}
          collection={collections[0].name}
          completedIds={completedIds}
          directDifficultyView
          optimalCache={optimalCache}
          progress={progress}
          navigate={navigate}
          pageNumber={route.pageNumber}
        />
      );
    }
    return (
      <CollectionGrid
        difficulty={route.difficulty}
        collections={collections}
        completedIds={completedIds}
        findNextUnsolved={findNextUnsolved}
        navigate={navigate}
      />
    );
  }

  return (
    <PuzzleListView
      difficulty={route.difficulty}
      collection={route.collection}
      completedIds={completedIds}
      optimalCache={optimalCache}
      progress={progress}
      navigate={navigate}
      pageNumber={route.pageNumber}
    />
  );
}
