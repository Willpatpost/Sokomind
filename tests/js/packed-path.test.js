const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const srcDir = path.join(__dirname, "..", "..", "src");
const source = fs.readFileSync(path.join(srcDir, "packed-path.js"), "utf8");
const context = {console};
vm.runInNewContext(source, context, {filename: "packed-path.js"});
const {packPath, unpackPath, appendStep, packedMemoryBytes, packedStep} =
  context.SokomindPackedPath;

function assertPathEqual(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) assert.equal(actual[i], expected[i]);
}

test("packPath and unpackPath round-trip short path", () => {
  const moves = ["Up", "Down", "Left", "Right"];
  const packed = packPath(moves);
  assertPathEqual(unpackPath(packed), moves);
});

test("packPath and unpackPath round-trip empty path", () => {
  const packed = packPath([]);
  assert.equal(unpackPath(packed).length, 0);
  assert.equal(packed.length, 0);
});

test("packPath and unpackPath round-trip long path", () => {
  const moves = [];
  const dirs = ["Up", "Down", "Left", "Right"];
  for (let i = 0; i < 500; i++) moves.push(dirs[i % 4]);
  const packed = packPath(moves);
  assertPathEqual(unpackPath(packed), moves);
  assert.ok(packedMemoryBytes(packed) <= 128);
});

test("packPath stores 16 steps per word", () => {
  const moves = Array(16).fill("Up");
  const packed = packPath(moves);
  assert.equal(packed.data.length, 1);
  assert.equal(packed.length, 16);
});

test("packPath uses 2 words for 17-32 steps", () => {
  const moves = Array(17).fill("Down");
  const packed = packPath(moves);
  assert.equal(packed.data.length, 2);
});

test("appendStep extends a packed path", () => {
  const packed = packPath(["Up", "Down"]);
  const extended = appendStep(packed, "Left");
  assert.equal(extended.length, 3);
  assertPathEqual(unpackPath(extended), ["Up", "Down", "Left"]);
});

test("appendStep expands buffer when needed", () => {
  let packed = packPath([]);
  for (let i = 0; i < 20; i++) packed = appendStep(packed, "Right");
  assert.equal(packed.length, 20);
  assertPathEqual(unpackPath(packed), Array(20).fill("Right"));
});

test("packedStep returns individual directions", () => {
  const packed = packPath(["Up", "Down", "Left", "Right"]);
  assert.equal(packedStep(packed, 0), "Up");
  assert.equal(packedStep(packed, 1), "Down");
  assert.equal(packedStep(packed, 2), "Left");
  assert.equal(packedStep(packed, 3), "Right");
});

test("packedStep returns undefined for out-of-bounds", () => {
  const packed = packPath(["Up"]);
  assert.equal(packedStep(packed, -1), undefined);
  assert.equal(packedStep(packed, 1), undefined);
});

test("packedMemoryBytes returns correct size", () => {
  const packed = packPath(Array(100).fill("Up"));
  assert.equal(packedMemoryBytes(packed), Math.ceil(100 / 16) * 4);
});

test("packPath handles mixed direction sequence", () => {
  const moves = ["Up", "Up", "Right", "Down", "Down", "Left", "Left", "Up"];
  const packed = packPath(moves);
  assertPathEqual(unpackPath(packed), moves);
});

test("500-move path uses less than 128 bytes", () => {
  const moves = Array(500).fill("Left");
  const packed = packPath(moves);
  assert.ok(packedMemoryBytes(packed) <= 128);
});
