// Depth-aware bounded map with depth-preferred eviction.
// Part of the Sokomind solver engine. Functions are bare globals for
// cross-module compatibility. The namespace object is registered for new usage.

class DepthAwareBoundedMap {
  constructor(limit) {
    this.limit = limit;
    this.values = new Map();
    this.depths = new Map();
    this.evictions = 0;
  }
  get(key) {
    const value = this.values.get(key);
    if (value !== undefined) {
      const depth = this.depths.get(key);
      this.values.delete(key);
      this.depths.delete(key);
      this.values.set(key, value);
      if (depth !== undefined) this.depths.set(key, depth);
    }
    return value;
  }
  has(key) { return this.values.has(key); }
  set(key, value, depth = 0) {
    if (this.values.has(key)) {
      this.values.delete(key);
      this.depths.delete(key);
    }
    this.values.set(key, value);
    this.depths.set(key, depth);
    if (this.values.size > this.limit) {
      // Scan first 16 entries (oldest), evict deepest
      const iterator = this.values.keys();
      const candidates = [];
      for (let i = 0; i < 16 && i < this.values.size; i++) {
        const result = iterator.next();
        if (result.done) break;
        candidates.push(result.value);
      }
      let worstKey = candidates[0];
      let worstDepth = this.depths.get(candidates[0]) || 0;
      for (let i = 1; i < candidates.length; i++) {
        const d = this.depths.get(candidates[i]) || 0;
        if (d > worstDepth) {
          worstKey = candidates[i];
          worstDepth = d;
        }
      }
      this.values.delete(worstKey);
      this.depths.delete(worstKey);
      this.evictions++;
    }
  }
  get size() { return this.values.size; }
}

// --- Module registration ---
const SokomindDepthMap = {
  DepthAwareBoundedMap,
};
if (typeof globalThis !== "undefined") globalThis.SokomindDepthMap = SokomindDepthMap;
if (typeof module === "object" && module.exports) module.exports = SokomindDepthMap;
