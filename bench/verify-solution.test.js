"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {LEVELS} = require("../src/levels.js");
const {parseSolutionText, verifySolution} = require("./verify-solution.js");

test("solution verification is level-agnostic", () => {
  const solution = "Example route:\n\n1. Down (push)\n";
  assert.deepEqual(verifySolution(LEVELS["ultra-tiny"], solution), {moves: 1, pushes: 1});
});

test("solution parser rejects gaps and verifier rejects incomplete paths", () => {
  assert.throws(() => parseSolutionText("1. Down\n3. Up\n"), /Expected move 2/);
  assert.throws(() => verifySolution(LEVELS["ultra-tiny"], "1. Right\n"), /does not solve/);
});
