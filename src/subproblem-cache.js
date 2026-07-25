// Subproblem caching: geometric hashing and pattern database reuse across puzzles.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

(function attachSubproblemCache(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindSubproblemCache = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  // Geometric hash for room shapes (invariant under rotation/reflection).
  // Converts a cell set to a canonical form by trying all 8 dihedral transforms,
  // normalizing, and picking the lexicographically smallest representation.
  function geometricHash(cells) {
    const points = [...cells].map(cell => {
      if (typeof cell === "string") {
        return cell.split(",").map(Number);
      }
      return cell;
    });

    if (points.length === 0) return "00000000";

    const transforms = [
      ([y, x]) => [y, x],
      ([y, x]) => [y, -x],
      ([y, x]) => [-y, x],
      ([y, x]) => [-y, -x],
      ([y, x]) => [x, y],
      ([y, x]) => [x, -y],
      ([y, x]) => [-x, y],
      ([y, x]) => [-x, -y],
    ];

    let best = null;
    for (const transform of transforms) {
      const transformed = points.map(transform);
      const minY = Math.min(...transformed.map(([y]) => y));
      const minX = Math.min(...transformed.map(([, x]) => x));
      const normalized = transformed
        .map(([y, x]) => [y - minY, x - minX])
        .sort(([ay, ax], [by, bx]) => ay - by || ax - bx);
      const key = normalized.map(([y, x]) => `${y},${x}`).join(";");
      if (best === null || key < best) best = key;
    }

    // FNV-1a hash of the canonical string
    let hash = 2166136261;
    for (let i = 0; i < best.length; i++) {
      hash ^= best.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  // In-memory LRU cache (session-lived).
  class SubproblemCache {
    constructor(maxEntries) {
      this.maxEntries = maxEntries || 1000;
      this.cache = new Map(); // compositeKey -> { goalConfig, pdbData, hitCount, createdAt }
    }

    _makeKey(cells, goalConfig) {
      const geoHash = geometricHash(cells);
      const goalKey = [...goalConfig].sort().join(";");
      return `${geoHash}|${goalKey}`;
    }

    get(cells, goalConfig) {
      const key = this._makeKey(cells, goalConfig);
      const entry = this.cache.get(key);
      if (entry) {
        entry.hitCount++;
        // LRU promotion: delete and re-insert at end
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.pdbData;
      }
      return null;
    }

    set(cells, goalConfig, pdbData) {
      const key = this._makeKey(cells, goalConfig);
      // Remove existing entry first (for LRU ordering)
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }
      if (this.cache.size >= this.maxEntries) {
        // Evict oldest (first entry in Map iteration order)
        const oldest = this.cache.keys().next().value;
        this.cache.delete(oldest);
      }
      this.cache.set(key, {
        goalConfig,
        pdbData,
        hitCount: 0,
        createdAt: Date.now(),
      });
    }

    has(cells, goalConfig) {
      return this.cache.has(this._makeKey(cells, goalConfig));
    }

    stats() {
      let totalHits = 0;
      for (const entry of this.cache.values()) {
        totalHits += entry.hitCount;
      }
      return {
        entries: this.cache.size,
        maxEntries: this.maxEntries,
        totalHits,
      };
    }

    clear() {
      this.cache.clear();
    }
  }

  // IndexedDB-backed persistent cache (for browser environments).
  class PersistentSubproblemCache extends SubproblemCache {
    constructor(dbName, maxEntries) {
      super(maxEntries || 5000);
      this.dbName = dbName || "sokomind-pdb-cache";
      this.dbReady = false;
      this.db = null;
    }

    async open() {
      if (typeof indexedDB === "undefined") return false;
      return new Promise((resolve) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains("pdbs")) {
            db.createObjectStore("pdbs", { keyPath: "key" });
          }
        };
        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.dbReady = true;
          resolve(true);
        };
        request.onerror = () => resolve(false);
      });
    }

    async persistGet(cells, goalConfig) {
      const memResult = this.get(cells, goalConfig);
      if (memResult) return memResult;
      if (!this.dbReady) return null;

      const key = this._makeKey(cells, goalConfig);
      return new Promise((resolve) => {
        const tx = this.db.transaction("pdbs", "readonly");
        const store = tx.objectStore("pdbs");
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result) {
            this.set(cells, goalConfig, request.result.pdbData);
            resolve(request.result.pdbData);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    }

    async persistSet(cells, goalConfig, pdbData) {
      this.set(cells, goalConfig, pdbData);
      if (!this.dbReady) return;

      const key = this._makeKey(cells, goalConfig);
      const tx = this.db.transaction("pdbs", "readwrite");
      const store = tx.objectStore("pdbs");
      store.put({
        key,
        goalConfig: [...goalConfig],
        pdbData,
        savedAt: Date.now(),
      });
    }
  }

  return {
    geometricHash,
    SubproblemCache,
    PersistentSubproblemCache,
  };
});
