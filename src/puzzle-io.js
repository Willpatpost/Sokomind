(function attachPuzzleIO(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindPuzzleIO = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const FORMAT_VERSION = 1;

  function exportPuzzle(puzzle, options = {}) {
    const output = {
      format: 'sokomind',
      version: FORMAT_VERSION,
      rows: [...puzzle.rows],
    };
    if (options.title) output.title = options.title;
    if (options.author) output.author = options.author;
    if (options.difficulty) output.difficulty = options.difficulty;
    return output;
  }

  function importPuzzle(data) {
    if (typeof data === 'string') {
      // Plain text import: each line is a row
      const lines = data.trim().split('\n');
      if (lines.length < 2) return { error: 'Puzzle must have at least 2 rows' };
      return { rows: lines.map(line => line.trimEnd()), format: 'plain-text' };
    }

    if (data && typeof data === 'object') {
      if (data.format !== 'sokomind') {
        return { error: `Unknown format: ${data.format}` };
      }
      if (data.version > FORMAT_VERSION) {
        return { error: `Unsupported version: ${data.version}` };
      }
      if (!Array.isArray(data.rows) || data.rows.length < 2) {
        return { error: 'Invalid puzzle: missing or empty rows' };
      }
      return {
        rows: data.rows,
        title: data.title,
        author: data.author,
        difficulty: data.difficulty,
        format: 'sokomind',
      };
    }

    return { error: 'Invalid input: expected string or object' };
  }

  function validatePuzzle(rows) {
    const errors = [];
    const warnings = [];

    let robotCount = 0;
    const boxCounts = new Map();
    const goalCounts = new Map();

    rows.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === 'R') robotCount++;
        else if (cell === 'X') boxCounts.set('X', (boxCounts.get('X') || 0) + 1);
        else if (cell === 'S') goalCounts.set('X', (goalCounts.get('X') || 0) + 1);
        else if (/[A-Z]/.test(cell) && !'ORS'.includes(cell)) {
          boxCounts.set(cell, (boxCounts.get(cell) || 0) + 1);
        }
        else if (/[a-z]/.test(cell) && !'ors'.includes(cell)) {
          const label = cell.toUpperCase();
          goalCounts.set(label, (goalCounts.get(label) || 0) + 1);
        }
      });
    });

    if (robotCount === 0) errors.push('No robot (R) found');
    if (robotCount > 1) errors.push(`Multiple robots found (${robotCount})`);

    const allLabels = new Set([...boxCounts.keys(), ...goalCounts.keys()]);
    for (const label of allLabels) {
      const boxes = boxCounts.get(label) || 0;
      const goals = goalCounts.get(label) || 0;
      if (boxes !== goals) {
        errors.push(`Label ${label}: ${boxes} boxes but ${goals} goals`);
      }
    }

    if (boxCounts.size === 0) warnings.push('No boxes found');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: { robotCount, boxCounts: Object.fromEntries(boxCounts), goalCounts: Object.fromEntries(goalCounts) },
    };
  }

  function puzzleToText(rows) {
    return rows.join('\n');
  }

  function boardContentHash(rows) {
    const source = rows.join('\n');
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  return {
    FORMAT_VERSION,
    exportPuzzle,
    importPuzzle,
    validatePuzzle,
    puzzleToText,
    boardContentHash,
  };
});
