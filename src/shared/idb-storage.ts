/**
 * Minimal IndexedDB key-value wrapper for large data that exceeds
 * localStorage's ~5 MB quota. Zero external dependencies.
 *
 * Every operation degrades to a silent no-op when IndexedDB is unavailable
 * (private browsing, old browsers, or security restrictions).
 */

const DB_NAME = "sokomind";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDB().then((db) => {
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => resolve(undefined);
        tx.oncomplete = () => db.close();
        tx.onerror = () => { db.close(); resolve(undefined); };
      } catch {
        db.close();
        resolve(undefined);
      }
    });
  });
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return withStore<T>("readonly", (store) => store.get(key) as IDBRequest<T>);
}

export function idbSet(key: string, value: unknown): Promise<void> {
  return withStore<IDBValidKey>("readwrite", (store) =>
    store.put(value, key),
  ).then(() => undefined);
}

export function idbRemove(key: string): Promise<void> {
  return withStore<undefined>("readwrite", (store) =>
    store.delete(key) as IDBRequest<undefined>,
  ).then(() => undefined);
}

export function idbClear(): Promise<void> {
  return withStore<undefined>("readwrite", (store) =>
    store.clear() as IDBRequest<undefined>,
  ).then(() => undefined);
}
