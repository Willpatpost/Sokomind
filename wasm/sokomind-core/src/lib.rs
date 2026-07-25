//! sokomind-core: WebAssembly module for Sokoban solver hot loops.
//!
//! Implements reachability BFS, push generation, deadlock detection,
//! and Hungarian assignment as an optional accelerator for the JS solver.

mod board;
mod reachability;
mod push_gen;
mod deadlock;
mod hungarian;

use wasm_bindgen::prelude::*;
use std::cell::RefCell;

use board::Board;

/// Thread-local storage for boards and scratch buffers.
struct SolverState {
    boards: Vec<Board>,
    /// Scratch buffers for reachability (avoid per-call allocation).
    visited_buf: Vec<bool>,
    queue_buf: Vec<u32>,
    box_occ_buf: Vec<bool>,
}

impl SolverState {
    fn new() -> Self {
        SolverState {
            boards: Vec::new(),
            visited_buf: Vec::new(),
            queue_buf: Vec::new(),
            box_occ_buf: Vec::new(),
        }
    }

    fn ensure_scratch(&mut self, n: usize) {
        if self.visited_buf.len() < n {
            self.visited_buf.resize(n, false);
            self.queue_buf.resize(n as usize, 0u32);
            self.box_occ_buf.resize(n, false);
        }
    }
}

thread_local! {
    static STATE: RefCell<SolverState> = RefCell::new(SolverState::new());
}

/// Initialize a board from a flat i32 buffer.
///
/// Layout: [cell_count, width, neighbors..., goal_labels..., static_dead..., cell_y..., cell_x...]
///
/// Returns a board handle (ID) for subsequent calls.
#[wasm_bindgen]
pub fn init_board(data: &[i32]) -> usize {
    STATE.with(|state| {
        let mut s = state.borrow_mut();
        let board = Board::from_flat(data);
        let id = s.boards.len();
        s.ensure_scratch(board.cell_count);
        s.boards.push(board);
        id
    })
}

/// Compute reachable cells via BFS from `robot` cell, avoiding boxes.
///
/// `boxes` — flat array of box cell IDs (u32)
///
/// Returns a Vec<u8> where 1 = reachable, 0 = not reachable.
#[wasm_bindgen]
pub fn compute_reachable(board_id: usize, robot: usize, boxes: &[u32]) -> Vec<u8> {
    STATE.with(|state| {
        let mut s = state.borrow_mut();
        let n = s.boards[board_id].cell_count;
        s.ensure_scratch(n);

        // Build box occupancy into visited_buf temporarily (reused below)
        // We need to avoid simultaneous mutable and immutable borrows of
        // different fields, so we build box_occ inline in visited_buf first,
        // then swap.
        //
        // Actually, the simplest fix: take the buffers out, use them, put them back.
        let mut visited = std::mem::take(&mut s.visited_buf);
        let mut queue = std::mem::take(&mut s.queue_buf);
        let mut box_occ = std::mem::take(&mut s.box_occ_buf);

        // Clear and populate box occupancy
        for v in box_occ[..n].iter_mut() {
            *v = false;
        }
        for &b in boxes {
            box_occ[b as usize] = true;
        }

        // Run BFS
        reachability::reachable_cells_with_scratch(
            robot,
            &box_occ,
            &s.boards[board_id],
            &mut visited,
            &mut queue,
        );

        // Convert to u8
        let result: Vec<u8> = visited[..n].iter().map(|&v| v as u8).collect();

        // Put buffers back
        s.visited_buf = visited;
        s.queue_buf = queue;
        s.box_occ_buf = box_occ;

        result
    })
}

/// Generate push candidates.
///
/// `boxes` — flat array of box cell IDs (u32)
/// `reachable` — reachability bitset from compute_reachable (u8 array)
///
/// Returns a flat u32 array: [box_idx, dir, dest, support, box_idx, dir, dest, support, ...]
#[wasm_bindgen]
pub fn generate_push_candidates(board_id: usize, boxes: &[u32], reachable: &[u8]) -> Vec<u32> {
    STATE.with(|state| {
        let s = state.borrow();
        let board = &s.boards[board_id];

        let box_cells: Vec<usize> = boxes.iter().map(|&b| b as usize).collect();
        let reach_bool: Vec<bool> = reachable.iter().map(|&v| v != 0).collect();

        let candidates = push_gen::generate_pushes(&box_cells, &reach_bool, board);

        let mut result = Vec::with_capacity(candidates.len() * 4);
        for c in &candidates {
            result.push(c.box_index as u32);
            result.push(c.direction as u32);
            result.push(c.destination as u32);
            result.push(c.support as u32);
        }
        result
    })
}

/// Check deadlocks for a position after moving a box.
///
/// `boxes` — flat array of box cell IDs (u32), after the move
/// `moved` — the cell ID where the box was moved to
///
/// Returns true if position is dead (corner or 2x2 deadlock).
#[wasm_bindgen]
pub fn check_deadlocks(board_id: usize, boxes: &[u32], moved: u32) -> bool {
    STATE.with(|state| {
        let s = state.borrow();
        let board = &s.boards[board_id];
        let moved_cell = moved as usize;

        // Corner deadlock check (using label 0 for generic)
        if deadlock::is_corner_dead(moved_cell, 0, board) {
            return true;
        }

        // 2x2 deadlock check
        let box_cells: Vec<usize> = boxes.iter().map(|&b| b as usize).collect();
        if deadlock::is_2x2_dead(&box_cells, moved_cell, board) {
            return true;
        }

        false
    })
}

/// Hungarian assignment: compute minimum cost for a cost matrix.
///
/// `costs` — flat i32 array in row-major order
/// `rows`, `cols` — matrix dimensions
///
/// Returns minimum cost. Returns 1000000000 if no feasible assignment.
#[wasm_bindgen]
pub fn min_cost_assignment(costs: &[i32], rows: usize, cols: usize) -> i32 {
    hungarian::hungarian_assignment(costs, rows, cols)
}

/// Reset all stored boards and scratch buffers.
#[wasm_bindgen]
pub fn reset() {
    STATE.with(|state| {
        let mut s = state.borrow_mut();
        s.boards.clear();
        s.visited_buf.clear();
        s.queue_buf.clear();
        s.box_occ_buf.clear();
    });
}
