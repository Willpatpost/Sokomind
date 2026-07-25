// Compact transposition table using ArrayBuffer for minimal GC pressure.
// Each entry: [hashHi, hashLo, depth, cost] as 4 × uint32 = 16 bytes.
// Uses open addressing with linear probing. Power-of-two sizing.

(function (root, factory) {
  const ns = factory();
  if (typeof globalThis !== "undefined") globalThis.SokomindCompactTable = ns;
  if (typeof module === "object" && module.exports) module.exports = ns;
})(this, function () {
  "use strict";

  class CompactTranspositionTable {
    constructor(capacity = 1 << 17) {
      const exp = Math.max(10, Math.ceil(Math.log2(capacity)));
      this._capacity = 1 << exp;
      this._mask = this._capacity - 1;
      this._buffer = new ArrayBuffer(this._capacity * 16);
      this._view = new Uint32Array(this._buffer);
      this._entries = 0;
      this._evictions = 0;
      this._probes = 0;
      this._hits = 0;
      this._maxProbe = 0;
    }
    get size() { return this._entries; }
    get capacity() { return this._capacity; }
    get evictions() { return this._evictions; }

    _slot(hashHi, hashLo) {
      return ((hashHi ^ (hashLo >>> 16) ^ (hashLo << 16)) >>> 0) & this._mask;
    }

    get(hashHi, hashLo) {
      let slot = this._slot(hashHi, hashLo);
      const v = this._view;
      for (let probe = 0; probe <= this._maxProbe; probe++) {
        const base = slot << 2;
        if (v[base] === 0 && v[base + 1] === 0) return undefined;
        if (v[base] === hashHi && v[base + 1] === hashLo) {
          this._hits++;
          return v[base + 3];
        }
        slot = (slot + 1) & this._mask;
        this._probes++;
      }
      return undefined;
    }

    set(hashHi, hashLo, depth, cost) {
      let slot = this._slot(hashHi, hashLo);
      const v = this._view;
      let worstSlot = -1, worstDepth = -1;

      for (let probe = 0; probe < 16; probe++) {
        const base = slot << 2;
        if (v[base] === 0 && v[base + 1] === 0) {
          v[base] = hashHi;
          v[base + 1] = hashLo;
          v[base + 2] = depth;
          v[base + 3] = cost;
          this._entries++;
          if (probe > this._maxProbe) this._maxProbe = probe;
          return;
        }
        if (v[base] === hashHi && v[base + 1] === hashLo) {
          if (cost <= v[base + 3]) {
            v[base + 2] = depth;
            v[base + 3] = cost;
          }
          return;
        }
        if (v[base + 2] > worstDepth) {
          worstDepth = v[base + 2];
          worstSlot = base;
        }
        slot = (slot + 1) & this._mask;
      }
      if (worstSlot >= 0 && depth < worstDepth) {
        v[worstSlot] = hashHi;
        v[worstSlot + 1] = hashLo;
        v[worstSlot + 2] = depth;
        v[worstSlot + 3] = cost;
        this._evictions++;
      }
    }

    has(hashHi, hashLo) {
      return this.get(hashHi, hashLo) !== undefined;
    }

    clear() {
      this._view.fill(0);
      this._entries = 0;
      this._maxProbe = 0;
    }

    stats() {
      return {
        entries: this._entries,
        capacity: this._capacity,
        loadFactor: this._entries / this._capacity,
        evictions: this._evictions,
        hits: this._hits,
        probes: this._probes,
        maxProbe: this._maxProbe,
        memoryBytes: this._buffer.byteLength,
      };
    }
  }

  return {CompactTranspositionTable};
});
