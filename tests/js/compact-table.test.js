const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const srcDir = path.join(__dirname, "..", "..", "src");
const source = fs.readFileSync(path.join(srcDir, "compact-table.js"), "utf8");
const context = {console};
vm.runInNewContext(source, context, {filename: "compact-table.js"});
const {CompactTranspositionTable} = context.SokomindCompactTable;

test("CompactTranspositionTable basic get/set", () => {
  const table = new CompactTranspositionTable(1024);
  table.set(0x12345678, 0xABCDEF01, 5, 10);
  assert.equal(table.get(0x12345678, 0xABCDEF01), 10);
  assert.equal(table.size, 1);
});

test("CompactTranspositionTable returns undefined for missing keys", () => {
  const table = new CompactTranspositionTable(1024);
  assert.equal(table.get(0x11111111, 0x22222222), undefined);
});

test("CompactTranspositionTable updates to lower cost on duplicate", () => {
  const table = new CompactTranspositionTable(1024);
  table.set(0xAAAAAAAA, 0xBBBBBBBB, 3, 100);
  table.set(0xAAAAAAAA, 0xBBBBBBBB, 2, 50);
  assert.equal(table.get(0xAAAAAAAA, 0xBBBBBBBB), 50);
});

test("CompactTranspositionTable keeps higher cost on duplicate", () => {
  const table = new CompactTranspositionTable(1024);
  table.set(0xAAAAAAAA, 0xBBBBBBBB, 3, 50);
  table.set(0xAAAAAAAA, 0xBBBBBBBB, 2, 100);
  assert.equal(table.get(0xAAAAAAAA, 0xBBBBBBBB), 50);
});

test("CompactTranspositionTable handles many entries", () => {
  const table = new CompactTranspositionTable(4096);
  for (let i = 1; i < 2000; i++) {
    table.set(i, i * 17, i % 20, i);
  }
  assert.ok(table.size > 0);
  assert.ok(table.size <= 4096);
  const found = table.get(42, 42 * 17);
  assert.ok(found !== undefined || table.evictions > 0);
});

test("CompactTranspositionTable has() checks existence", () => {
  const table = new CompactTranspositionTable(1024);
  assert.equal(table.has(1, 2), false);
  table.set(1, 2, 0, 5);
  assert.equal(table.has(1, 2), true);
});

test("CompactTranspositionTable clear resets entries", () => {
  const table = new CompactTranspositionTable(1024);
  table.set(1, 2, 0, 5);
  table.set(3, 4, 0, 10);
  assert.equal(table.size, 2);
  table.clear();
  assert.equal(table.size, 0);
  assert.equal(table.get(1, 2), undefined);
});

test("CompactTranspositionTable stats reports useful metrics", () => {
  const table = new CompactTranspositionTable(1024);
  table.set(1, 2, 0, 5);
  table.set(1, 2, 0, 5);
  const s = table.stats();
  assert.equal(s.capacity, 1024);
  assert.equal(s.entries, 1);
  assert.equal(s.memoryBytes, 1024 * 16);
  assert.ok(s.loadFactor >= 0 && s.loadFactor <= 1);
});

test("CompactTranspositionTable capacity is power of two", () => {
  const table = new CompactTranspositionTable(1000);
  assert.equal(table.capacity, 1024);
});

test("CompactTranspositionTable minimum capacity", () => {
  const table = new CompactTranspositionTable(4);
  assert.equal(table.capacity, 1024);
});

test("CompactTranspositionTable evicts high-depth entries when probing exhausted", () => {
  const table = new CompactTranspositionTable(1024);
  for (let i = 1; i < 800; i++) {
    table.set(i, 0, i, i * 10);
  }
  assert.ok(table.size > 0);
});
