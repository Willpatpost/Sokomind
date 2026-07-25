const assert = require("node:assert/strict");
const test = require("node:test");

const PuzzleIO = require("../../src/puzzle-io.js");

// ── Export / Import round-trip ──────────────────────────────────

test("export and import round-trip preserves puzzle rows", () => {
  const puzzle = { rows: ["OOOOO", "O R O", "O A O", "O a O", "OOOOO"] };
  const exported = PuzzleIO.exportPuzzle(puzzle);
  const imported = PuzzleIO.importPuzzle(exported);
  assert.deepEqual(imported.rows, puzzle.rows);
  assert.equal(imported.format, "sokomind");
  assert.equal(imported.error, undefined);
});

test("export includes optional metadata when provided", () => {
  const puzzle = { rows: ["OOO", "ORO", "OOO"] };
  const exported = PuzzleIO.exportPuzzle(puzzle, {
    title: "Test Puzzle",
    author: "Tester",
    difficulty: "easy",
  });
  assert.equal(exported.title, "Test Puzzle");
  assert.equal(exported.author, "Tester");
  assert.equal(exported.difficulty, "easy");
  assert.equal(exported.format, "sokomind");
  assert.equal(exported.version, PuzzleIO.FORMAT_VERSION);
});

test("export does not include undefined metadata fields", () => {
  const puzzle = { rows: ["OOO", "ORO", "OOO"] };
  const exported = PuzzleIO.exportPuzzle(puzzle);
  assert.equal("title" in exported, false);
  assert.equal("author" in exported, false);
  assert.equal("difficulty" in exported, false);
});

test("export creates a copy of rows", () => {
  const rows = ["OOO", "ORO", "OOO"];
  const puzzle = { rows };
  const exported = PuzzleIO.exportPuzzle(puzzle);
  rows[0] = "XXX";
  assert.equal(exported.rows[0], "OOO");
});

// ── Plain-text import ───────────────────────────────────────────

test("import from plain text creates row array", () => {
  const text = "OOOOO\nO R O\nO A O\nO a O\nOOOOO";
  const result = PuzzleIO.importPuzzle(text);
  assert.equal(result.error, undefined);
  assert.equal(result.format, "plain-text");
  assert.equal(result.rows.length, 5);
  assert.equal(result.rows[0], "OOOOO");
});

test("import from plain text trims trailing whitespace on each line", () => {
  const text = "OOO   \nORO  \nOOO";
  const result = PuzzleIO.importPuzzle(text);
  assert.equal(result.rows[0], "OOO");
  assert.equal(result.rows[1], "ORO");
});

test("import from single-line text returns error", () => {
  const result = PuzzleIO.importPuzzle("OOOOO");
  assert.ok(result.error);
  assert.match(result.error, /at least 2 rows/);
});

// ── Structured import errors ────────────────────────────────────

test("import rejects unknown format", () => {
  const result = PuzzleIO.importPuzzle({ format: "xsb", rows: ["OOO"] });
  assert.ok(result.error);
  assert.match(result.error, /Unknown format/);
});

test("import rejects unsupported version", () => {
  const result = PuzzleIO.importPuzzle({ format: "sokomind", version: 999, rows: ["OOO", "ORO"] });
  assert.ok(result.error);
  assert.match(result.error, /Unsupported version/);
});

test("import rejects missing rows", () => {
  const result = PuzzleIO.importPuzzle({ format: "sokomind", version: 1 });
  assert.ok(result.error);
  assert.match(result.error, /missing or empty rows/);
});

test("import rejects too-short rows array", () => {
  const result = PuzzleIO.importPuzzle({ format: "sokomind", version: 1, rows: ["OOO"] });
  assert.ok(result.error);
  assert.match(result.error, /missing or empty rows/);
});

test("import rejects non-string non-object input", () => {
  assert.ok(PuzzleIO.importPuzzle(42).error);
  assert.ok(PuzzleIO.importPuzzle(null).error);
  assert.ok(PuzzleIO.importPuzzle(undefined).error);
  assert.ok(PuzzleIO.importPuzzle(true).error);
});

// ── Validation ──────────────────────────────────────────────────

test("validatePuzzle accepts a valid puzzle", () => {
  const result = PuzzleIO.validatePuzzle(["OOOOO", "O R O", "O A O", "O a O", "OOOOO"]);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.stats.robotCount, 1);
  assert.deepEqual(result.stats.boxCounts, { A: 1 });
  assert.deepEqual(result.stats.goalCounts, { A: 1 });
});

test("validatePuzzle detects missing robot", () => {
  const result = PuzzleIO.validatePuzzle(["OOOOO", "O   O", "O A O", "O a O", "OOOOO"]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("No robot")));
});

test("validatePuzzle detects multiple robots", () => {
  const result = PuzzleIO.validatePuzzle(["OOOOO", "O R O", "O R O", "O   O", "OOOOO"]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("Multiple robots")));
});

test("validatePuzzle detects box/goal mismatch", () => {
  const result = PuzzleIO.validatePuzzle(["OOOOO", "O R O", "O A O", "O   O", "OOOOO"]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("Label A")));
});

test("validatePuzzle warns about no boxes", () => {
  const result = PuzzleIO.validatePuzzle(["OOO", "ORO", "OOO"]);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some(w => w.includes("No boxes")));
});

test("validatePuzzle handles generic X boxes and S goals", () => {
  const result = PuzzleIO.validatePuzzle(["OOOOO", "O R O", "O X O", "O S O", "OOOOO"]);
  assert.equal(result.valid, true);
  assert.equal(result.stats.boxCounts.X, 1);
  assert.equal(result.stats.goalCounts.X, 1);
});

// ── Utility functions ───────────────────────────────────────────

test("puzzleToText joins rows with newlines", () => {
  const rows = ["OOO", "ORO", "OOO"];
  assert.equal(PuzzleIO.puzzleToText(rows), "OOO\nORO\nOOO");
});

// ── Hash stability ──────────────────────────────────────────────

test("boardContentHash is deterministic", () => {
  const rows = ["OOOOO", "O R O", "O A O", "O a O", "OOOOO"];
  const hash1 = PuzzleIO.boardContentHash(rows);
  const hash2 = PuzzleIO.boardContentHash(rows);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 8);
});

test("boardContentHash differs for different boards", () => {
  const hash1 = PuzzleIO.boardContentHash(["OOO", "ORO", "OOO"]);
  const hash2 = PuzzleIO.boardContentHash(["OOOOO", "O R O", "OOOOO"]);
  assert.notEqual(hash1, hash2);
});

test("boardContentHash returns 8-character hex string", () => {
  const hash = PuzzleIO.boardContentHash(["OOO", "ORO", "OOO"]);
  assert.match(hash, /^[0-9a-f]{8}$/);
});

// ── Module surface ──────────────────────────────────────────────

test("module exports all expected functions and constants", () => {
  assert.equal(typeof PuzzleIO.FORMAT_VERSION, "number");
  assert.equal(typeof PuzzleIO.exportPuzzle, "function");
  assert.equal(typeof PuzzleIO.importPuzzle, "function");
  assert.equal(typeof PuzzleIO.validatePuzzle, "function");
  assert.equal(typeof PuzzleIO.puzzleToText, "function");
  assert.equal(typeof PuzzleIO.boardContentHash, "function");
});
