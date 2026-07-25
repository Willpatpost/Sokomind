// Packed path representation: 2 bits per direction in Uint32Array.
// Up=0, Down=1, Left=2, Right=3. 16 steps per 32-bit word.
// A 500-move solution fits in 32 bytes instead of ~4KB as string array.

(function (root, factory) {
  const ns = factory();
  if (typeof globalThis !== "undefined") globalThis.SokomindPackedPath = ns;
  if (typeof module === "object" && module.exports) module.exports = ns;
})(this, function () {
  "use strict";

  const DIR_NAMES = ["Up", "Down", "Left", "Right"];
  const DIR_INDEX = {Up: 0, Down: 1, Left: 2, Right: 3, U: 0, D: 1, L: 2, R: 3};

  function packPath(moves) {
    const length = moves.length;
    const words = Math.ceil(length / 16) || 1;
    const data = new Uint32Array(words);
    for (let i = 0; i < length; i++) {
      const code = DIR_INDEX[moves[i]];
      if (code === undefined) continue;
      const word = i >>> 4;
      const bit = (i & 15) << 1;
      data[word] |= code << bit;
    }
    return {data, length};
  }

  function unpackPath(packed) {
    const {data, length} = packed;
    const moves = new Array(length);
    for (let i = 0; i < length; i++) {
      const word = i >>> 4;
      const bit = (i & 15) << 1;
      moves[i] = DIR_NAMES[(data[word] >>> bit) & 3];
    }
    return moves;
  }

  function appendStep(packed, direction) {
    const code = DIR_INDEX[direction];
    if (code === undefined) return packed;
    const newLength = packed.length + 1;
    const neededWords = Math.ceil(newLength / 16);
    let data = packed.data;
    if (neededWords > data.length) {
      const expanded = new Uint32Array(neededWords);
      expanded.set(data);
      data = expanded;
    }
    const i = packed.length;
    const word = i >>> 4;
    const bit = (i & 15) << 1;
    data[word] |= code << bit;
    return {data, length: newLength};
  }

  function packedMemoryBytes(packed) {
    return packed.data.byteLength;
  }

  function packedStep(packed, index) {
    if (index < 0 || index >= packed.length) return undefined;
    const word = index >>> 4;
    const bit = (index & 15) << 1;
    return DIR_NAMES[(packed.data[word] >>> bit) & 3];
  }

  return {
    packPath,
    unpackPath,
    appendStep,
    packedMemoryBytes,
    packedStep,
    DIR_NAMES,
    DIR_INDEX,
  };
});
