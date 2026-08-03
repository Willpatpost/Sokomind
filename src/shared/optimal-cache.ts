import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  readStoredValue,
  writeStoredValue,
  type StorageMutationResult,
} from "./storage.ts";
import { trackPersistenceResult } from "./persistence-health.ts";
import { idbGet, idbSet } from "./idb-storage.ts";

export interface OptimalRecord {
  readonly moves: number;
  readonly pushes: number;
}

export interface OptimalCache {
  readonly version: 2;
  readonly records: Readonly<Record<string, OptimalRecord>>;
}

const EMPTY_CACHE: OptimalCache = Object.freeze({
  version: 2,
  records: Object.freeze({}),
});

const IDB_KEY = STORAGE_KEYS.optimal;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCount(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function normalizeRecord(
  value: unknown,
  legacy: boolean,
): OptimalRecord | undefined {
  if (!isRecord(value)) return undefined;
  const expectedKeys = legacy
    ? new Set(["moves", "pushes", "objective"])
    : new Set(["moves", "pushes"]);
  const keys = Object.keys(value);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => !expectedKeys.has(key))
  ) {
    return undefined;
  }
  if (legacy && value.objective !== "moves") return undefined;
  if (!isValidCount(value.moves) || !isValidCount(value.pushes)) {
    return undefined;
  }
  if (value.pushes > value.moves) return undefined;
  return Object.freeze({ moves: value.moves, pushes: value.pushes });
}

/**
 * Converts persisted data to the move-only schema. Legacy push and combined
 * records are discarded because they do not prove a minimum move count.
 */
export function normalizeOptimalCache(value: unknown): OptimalCache {
  if (!isRecord(value) || !isRecord(value.records)) return EMPTY_CACHE;
  if (value.version !== 1 && value.version !== 2) return EMPTY_CACHE;

  const legacy = value.version === 1;
  const records: Record<string, OptimalRecord> = {};
  for (const [puzzleId, candidate] of Object.entries(value.records)) {
    if (!puzzleId) continue;
    const record = normalizeRecord(candidate, legacy);
    if (record) records[puzzleId] = record;
  }
  return Object.freeze({
    version: 2,
    records: Object.freeze(records),
  });
}

/**
 * Synchronously loads the optimal cache from localStorage (fast, for first
 * paint). Call `hydrateOptimalCacheFromIDB` afterward to upgrade with any
 * richer data stored in IndexedDB.
 */
export function loadOptimalCache(): OptimalCache {
  const raw = readStoredValue(STORAGE_KEYS.optimal, [
    LEGACY_STORAGE_KEYS.optimal,
  ]);
  if (!raw) return EMPTY_CACHE;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const cache = normalizeOptimalCache(parsed);
    if (isRecord(parsed) && parsed.version === 1) saveOptimalCache(cache);
    return cache;
  } catch {
    // Corrupt data; start fresh.
  }
  return EMPTY_CACHE;
}

/**
 * Asynchronously loads the optimal cache from IndexedDB. Returns the IDB
 * copy if it contains more records than `current`, otherwise returns
 * `current` unchanged. This lets callers merge IDB data after the
 * synchronous localStorage load.
 */
export async function hydrateOptimalCacheFromIDB(
  current: OptimalCache,
): Promise<OptimalCache> {
  try {
    const stored = await idbGet<OptimalCache>(IDB_KEY);
    if (!stored) return current;
    const normalized = normalizeOptimalCache(stored);
    const idbCount = Object.keys(normalized.records).length;
    const currentCount = Object.keys(current.records).length;
    if (idbCount > currentCount) return normalized;
    return current;
  } catch {
    return current;
  }
}

/**
 * Persists the cache to localStorage (synchronous, tracked by
 * persistence-health) and to IndexedDB in the background for quota
 * resilience. If localStorage fails due to quota, IDB still succeeds.
 */
export function saveOptimalCache(cache: OptimalCache): StorageMutationResult {
  const result = trackPersistenceResult(
    writeStoredValue(STORAGE_KEYS.optimal, JSON.stringify(cache)),
  );

  // Background-persist to IndexedDB; fire-and-forget.
  idbSet(IDB_KEY, cache).catch(() => {});

  return result;
}

export function setOptimalRecord(
  cache: OptimalCache,
  puzzleId: string,
  record: OptimalRecord,
): OptimalCache {
  return {
    version: 2,
    records: { ...cache.records, [puzzleId]: record },
  };
}

export function isOptimal(
  cache: OptimalCache,
  puzzleId: string,
  playerMoves: number,
): boolean {
  const record = cache.records[puzzleId];
  if (!record) return false;
  return playerMoves <= record.moves;
}

export function getOptimalRecord(
  cache: OptimalCache,
  puzzleId: string,
): OptimalRecord | undefined {
  return cache.records[puzzleId];
}
