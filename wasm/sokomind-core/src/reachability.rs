/// BFS reachability flood fill from robot position.
///
/// Avoids boxes and walls (neighbor == -1). Returns a boolean bitset
/// of reachable cells. Called millions of times in the solver hot loop.

use crate::board::{Board, NUM_DIRS};

/// Compute reachable cells via BFS from `robot_cell`, avoiding cells
/// marked in `box_occupancy`.
///
/// Uses pre-allocated scratch buffers (`visited`, `queue`) to avoid
/// per-call allocation. The caller must pass buffers of at least
/// `board.cell_count` length.
pub fn reachable_cells_with_scratch(
    robot_cell: usize,
    box_occupancy: &[bool],
    board: &Board,
    visited: &mut [bool],
    queue: &mut [u32],
) -> usize {
    let n = board.cell_count;

    // Clear visited
    for v in visited[..n].iter_mut() {
        *v = false;
    }

    // BFS
    visited[robot_cell] = true;
    queue[0] = robot_cell as u32;
    let mut head: usize = 0;
    let mut tail: usize = 1;

    while head < tail {
        let current = queue[head] as usize;
        head += 1;

        for dir in 0..NUM_DIRS {
            let next = board.neighbor(current, dir);
            if next < 0 {
                continue;
            }
            let next_u = next as usize;
            if visited[next_u] || box_occupancy[next_u] {
                continue;
            }
            visited[next_u] = true;
            queue[tail] = next_u as u32;
            tail += 1;
        }
    }

    tail // number of reachable cells
}

/// Simple allocation-based interface for standalone use.
#[allow(dead_code)]
pub fn reachable_cells(
    robot_cell: usize,
    box_occupancy: &[bool],
    board: &Board,
) -> Vec<bool> {
    let n = board.cell_count;
    let mut visited = vec![false; n];
    let mut queue = vec![0u32; n];
    reachable_cells_with_scratch(robot_cell, box_occupancy, board, &mut visited, &mut queue);
    visited
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::Board;

    fn make_test_board() -> Board {
        // 3x3 open grid, no walls between cells
        // Cells: 0..9
        //   0 1 2
        //   3 4 5
        //   6 7 8
        let cell_count = 9;
        let width = 3;
        let mut neighbors = vec![-1i32; cell_count * NUM_DIRS];
        // dir 0=Up, 1=Down, 2=Left, 3=Right
        for y in 0..3i32 {
            for x in 0..3i32 {
                let id = (y * 3 + x) as usize;
                let deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                for (dir, [dy, dx]) in deltas.iter().enumerate() {
                    let ny = y + dy;
                    let nx = x + dx;
                    if ny >= 0 && ny < 3 && nx >= 0 && nx < 3 {
                        neighbors[id * 4 + dir] = ny * 3 + nx;
                    }
                }
            }
        }
        Board {
            cell_count,
            width,
            neighbors,
            is_goal: vec![false; cell_count],
            goal_label: vec![0; cell_count],
            static_dead: vec![false; cell_count],
            cell_y: vec![0, 0, 0, 1, 1, 1, 2, 2, 2],
            cell_x: vec![0, 1, 2, 0, 1, 2, 0, 1, 2],
        }
    }

    #[test]
    fn test_full_reachability() {
        let board = make_test_board();
        let box_occ = vec![false; 9];
        let visited = reachable_cells(4, &box_occ, &board);
        assert!(visited.iter().all(|&v| v));
    }

    #[test]
    fn test_box_blocks() {
        let board = make_test_board();
        let mut box_occ = vec![false; 9];
        box_occ[1] = true; // block cell 1
        box_occ[3] = true; // block cell 3
        // From cell 0, can only reach cell 0 (blocked by 1 and 3)
        let visited = reachable_cells(0, &box_occ, &board);
        assert!(visited[0]);
        assert!(!visited[1]);
        assert!(!visited[3]);
        assert!(!visited[4]); // can't reach through blocked cells
    }
}
