import { DIFFICULTIES, type PuzzleDefinition } from "../core/model.ts";
import { getPuzzleMetadataById } from "./puzzle-metadata.ts";

export type ShardUrlMap = Readonly<Record<string, string>>;

export interface PuzzleLoaderConfig {
  readonly shardUrls: ShardUrlMap;
  readonly isProd: boolean;
}

const viteDefaults: PuzzleLoaderConfig = {
  shardUrls: import.meta.glob<string>("./puzzle-shards/*.json", {
    eager: true,
    import: "default",
    query: "?url",
  }),
  isProd: import.meta.env.PROD,
};

let activeConfig: PuzzleLoaderConfig = viteDefaults;

export function configurePuzzleLoader(config: PuzzleLoaderConfig): void {
  activeConfig = config;
  shardCache.clear();
  shardRequests.clear();
}

export function resetPuzzleLoader(): void {
  activeConfig = viteDefaults;
  shardCache.clear();
  shardRequests.clear();
}

const shardCache = new Map<string, ReadonlyMap<string, PuzzleDefinition>>();
const shardRequests = new Map<string, Promise<ReadonlyMap<string, PuzzleDefinition>>>();

function shardKey(shard: string): string {
  return `./puzzle-shards/${shard}.json`;
}

async function warmRuntimeCache(url: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !activeConfig.isProd) return;
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
        once: true,
      });
    });
  }
  await fetch(url);
}

export async function loadPuzzleById(
  puzzleId: string,
): Promise<PuzzleDefinition | undefined> {
  const metadata = getPuzzleMetadataById(puzzleId);
  if (!metadata) return undefined;

  const key = shardKey(metadata.shard);
  let puzzleMap = shardCache.get(key);
  if (!puzzleMap) {
    const url = activeConfig.shardUrls[key];
    if (!url) throw new Error(`Missing puzzle board shard: ${metadata.shard}`);
    let request = shardRequests.get(key);
    if (!request) {
      request = (async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Puzzle board shard request failed: ${response.status}`);
        }
        const parsed: unknown = await response.json();
        if (!Array.isArray(parsed)) {
          throw new Error(`Puzzle board shard is invalid: ${metadata.shard}`);
        }
        const map = new Map<string, PuzzleDefinition>();
        for (const entry of parsed) {
          if (
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).id === "string" &&
            Array.isArray((entry as Record<string, unknown>).rows) &&
            typeof (entry as Record<string, unknown>).difficulty === "string" &&
            DIFFICULTIES.includes((entry as Record<string, unknown>).difficulty as typeof DIFFICULTIES[number])
          ) {
            const puzzle = entry as PuzzleDefinition;
            map.set(puzzle.id, Object.freeze(puzzle));
          }
        }
        return map as ReadonlyMap<string, PuzzleDefinition>;
      })();
      shardRequests.set(key, request);
    }
    try {
      puzzleMap = await request;
    } catch (error) {
      shardRequests.delete(key);
      throw error;
    }
    shardCache.set(key, puzzleMap);
    void warmRuntimeCache(url).catch(() => {});
  }

  return puzzleMap.get(puzzleId);
}
