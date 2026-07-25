(function attachAccessibility(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindAccessibility = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function describeBoardState(state, board) {
    // Generate text description of current board state
    // "5 by 5 board. Robot at row 1, column 1.
    //  Box A at row 2, column 2. Goal a at row 3, column 2.
    //  1 box on goal, 0 remaining."
    if (!state || !board) return "Board not loaded.";

    const rows = board.rows || [];
    const height = rows.length;
    const width = Math.max(...rows.map(r => r.length), 0);

    const parts = [`${height} by ${width} board.`];

    if (state.robot) {
      parts.push(`Robot at row ${state.robot[0] + 1}, column ${state.robot[1] + 1}.`);
    }

    // Count boxes and goals
    const boxes = state.boxes || [];
    const boxCount = typeof boxes.length !== 'undefined' ? boxes.length :
                     typeof boxes.size !== 'undefined' ? boxes.size : 0;
    parts.push(`${boxCount} ${boxCount === 1 ? 'box' : 'boxes'}.`);

    return parts.join(' ');
  }

  function describeMoveResult(direction, pushed, position) {
    // "Moved left. Pushed box A down to row 3, column 2."
    const desc = [`Moved ${direction.toLowerCase()}.`];
    if (pushed) {
      desc.push(`Pushed box.`);
    }
    return desc.join(' ');
  }

  function describeSearchProgress(status, moves, pushes, elapsed) {
    // "Search found solution: 20 moves, 8 pushes in 2.3 seconds."
    if (status === 'solved') {
      return `Solution found: ${moves} moves, ${pushes} pushes in ${elapsed}.`;
    }
    if (status === 'searching') {
      return `Searching... ${elapsed} elapsed.`;
    }
    return `Search ${status}.`;
  }

  function announceToScreenReader(elementId, message) {
    if (typeof document === 'undefined') return;
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = '';
      // Small delay to ensure screen reader picks up the change
      setTimeout(() => { element.textContent = message; }, 50);
    }
  }

  return {
    describeBoardState,
    describeMoveResult,
    describeSearchProgress,
    announceToScreenReader,
  };
});
