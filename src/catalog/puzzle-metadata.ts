import metadata from "./puzzle-metadata.json" with { type: "json" };
import { type Difficulty } from "../core/model.ts";
export {
  type PuzzleDifficulty,
  type CollectionInfo,
  DIFFICULTY_ORDER,
  SOKOMIND_ORIGINALS,
} from "./catalog-types.ts";
import {
  type PuzzleDifficulty,
  type CollectionInfo,
  SOKOMIND_ORIGINALS,
} from "./catalog-types.ts";

type MetadataTuple = readonly [
  id: string,
  title: string,
  difficulty: Difficulty,
  boxes: number,
  width: number,
  height: number,
  collection: string,
  shard: string,
];

export interface PuzzleMetadata {
  readonly id: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly boxes: number;
  readonly width: number;
  readonly height: number;
  readonly collection: string;
  readonly shard: string;
}

const rawTuples = metadata.puzzles as unknown as readonly unknown[];

function isValidMetadataTuple(t: unknown): t is MetadataTuple {
  return (
    Array.isArray(t) &&
    t.length === 8 &&
    typeof t[0] === "string" &&
    typeof t[1] === "string" &&
    typeof t[2] === "string" &&
    typeof t[3] === "number" &&
    typeof t[4] === "number" &&
    typeof t[5] === "number" &&
    typeof t[6] === "string" &&
    typeof t[7] === "string"
  );
}

const tuples: readonly MetadataTuple[] = rawTuples.filter(isValidMetadataTuple);

export const PUZZLE_METADATA: readonly PuzzleMetadata[] = Object.freeze(
  tuples.map(([
    id,
    title,
    difficulty,
    boxes,
    width,
    height,
    collection,
    shard,
  ]) => Object.freeze({
    id,
    title,
    difficulty,
    boxes,
    width,
    height,
    collection,
    shard,
  })),
);

const metadataById = new Map(
  PUZZLE_METADATA.map((puzzle) => [puzzle.id, puzzle] as const),
);
const metadataIndexById = new Map(
  PUZZLE_METADATA.map((puzzle, index) => [puzzle.id, index] as const),
);

export function getPuzzleMetadataById(id: string): PuzzleMetadata | undefined {
  return metadataById.get(id);
}

export function getPuzzleMetadataIndexById(id: string): number {
  return metadataIndexById.get(id) ?? -1;
}

export function getPuzzleMetadataByDifficulty(
  difficulty: PuzzleDifficulty,
): readonly PuzzleMetadata[] {
  return PUZZLE_METADATA.filter((puzzle) => puzzle.difficulty === difficulty);
}

export function getMetadataCollectionsForDifficulty(
  difficulty: PuzzleDifficulty,
): readonly CollectionInfo[] {
  const counts = new Map<string, number>();
  for (const puzzle of getPuzzleMetadataByDifficulty(difficulty)) {
    counts.set(puzzle.collection, (counts.get(puzzle.collection) ?? 0) + 1);
  }
  const result: CollectionInfo[] = [];
  if (counts.has(SOKOMIND_ORIGINALS)) {
    result.push({
      name: SOKOMIND_ORIGINALS,
      count: counts.get(SOKOMIND_ORIGINALS) ?? 0,
    });
    counts.delete(SOKOMIND_ORIGINALS);
  }
  for (const [name, count] of [...counts].sort((left, right) =>
    left[0].localeCompare(right[0]))) {
    result.push({ name, count });
  }
  return result;
}

export function getMetadataBoxCounts(
  difficulty: PuzzleDifficulty,
  collection: string,
): readonly number[] {
  return [...new Set(
    getPuzzleMetadataByDifficulty(difficulty)
      .filter((puzzle) => puzzle.collection === collection)
      .map((puzzle) => puzzle.boxes),
  )].sort((left, right) => left - right);
}
