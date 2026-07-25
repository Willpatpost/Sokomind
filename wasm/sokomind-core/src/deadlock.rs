/// Deadlock detection: corner deadlock and 2x2 deadlock.
///
/// These are fast structural checks that detect obviously unsolvable
/// positions without expensive search.

use crate::board::Board;

/// Adjacent direction pairs for corner check.
/// A corner occurs when walls exist on two adjacent sides.
/// The pairs are: (Up, Left), (Up, Right), (Down, Left), (Down, Right)
const CORNER_PAIRS: [(usize, usize); 4] = [(0, 2), (0, 3), (1, 2), (1, 3)];

/// Check if a cell is a corner dead square.
///
/// A cell is corner-dead if:
/// 1. It has walls on two adjacent sides (forming a corner), AND
/// 2. It is not a goal with the matching label.
///
/// `label` is the goal label of the box that moved here (1-based, 0 = generic).
pub fn is_corner_dead(cell: usize, label: u8, board: &Board) -> bool {
    // If cell is a matching goal, it's never corner-dead
    if board.is_goal[cell] && board.goal_label[cell] == label {
        return false;
    }

    for &(dir_a, dir_b) in &CORNER_PAIRS {
        let na = board.neighbor(cell, dir_a);
        let nb = board.neighbor(cell, dir_b);
        if na < 0 && nb < 0 {
            return true;
        }
    }

    false
}

/// Offsets for the four 2x2 squares containing cell (y, x):
/// top-left origins at (y-1, x-1), (y-1, x), (y, x-1), (y, x)
/// Each 2x2 square has 4 cells: (oy, ox), (oy+1, ox), (oy, ox+1), (oy+1, ox+1)
///
/// In terms of directions from the origin cell:
/// We check 4 squares. For each we need to find 3 companion cells.
///
/// For cell C at position, the four 2x2 squares containing it use
/// relative positions. We express them as direction pairs from C:
/// Square 0 (C is bottom-right): [Up, Left, Up+Left]
/// Square 1 (C is bottom-left): [Up, Right, Up+Right]
/// Square 2 (C is top-right): [Down, Left, Down+Left]
/// Square 3 (C is top-left): [Down, Right, Down+Right]
///
/// To get the diagonal, we go via one direction then the other.

/// Check if placing/moving a box to `moved_cell` creates a 2x2 deadlock.
///
/// A 2x2 deadlock occurs when a 2x2 area is entirely occupied by
/// walls and boxes, and at least one box is not on its correct goal.
///
/// `boxes` — sorted cell IDs of all boxes (after the move)
/// `moved_cell` — the cell where a box was just moved to
pub fn is_2x2_dead(
    boxes: &[usize],
    moved_cell: usize,
    board: &Board,
) -> bool {
    let mut box_set = vec![false; board.cell_count];
    for &b in boxes {
        box_set[b] = true;
    }

    // Check all four 2x2 squares that contain moved_cell.
    // For each square, we need 3 companion cells:
    // vertical neighbor, horizontal neighbor, and the diagonal.

    // Pairs: (vertical_dir, horizontal_dir)
    let square_dirs: [(usize, usize); 4] = [(0, 2), (0, 3), (1, 2), (1, 3)];

    for &(vdir, hdir) in &square_dirs {
        let v_neighbor = board.neighbor(moved_cell, vdir);
        let h_neighbor = board.neighbor(moved_cell, hdir);

        // We need all three neighbors to exist as either wall or valid cell
        if v_neighbor == -1 && h_neighbor == -1 {
            // Both are walls. Need the diagonal too.
            // But the diagonal can't be determined from walls.
            // Actually, if two neighbors are walls, we already detected this
            // as a corner deadlock. The 2x2 check is for box clusters.
            // A wall counts as "occupied" for 2x2 purposes, but we can't
            // check the diagonal cell if both paths to it are walls.
            // Skip this configuration.
            continue;
        }

        // Get the diagonal cell via the vertical neighbor
        let diag = if v_neighbor >= 0 {
            board.neighbor(v_neighbor as usize, hdir)
        } else if h_neighbor >= 0 {
            board.neighbor(h_neighbor as usize, vdir)
        } else {
            -1
        };

        // Check if all 4 cells are "occupied" (wall or box)
        let v_occupied = v_neighbor < 0 || box_set[v_neighbor as usize];
        let h_occupied = h_neighbor < 0 || box_set[h_neighbor as usize];
        let d_occupied = diag < 0 || box_set[diag as usize];

        if !v_occupied || !h_occupied || !d_occupied {
            continue;
        }

        // All 4 cells are occupied. Check if any box is on the wrong goal.
        let cells = [
            Some(moved_cell),
            if v_neighbor >= 0 { Some(v_neighbor as usize) } else { None },
            if h_neighbor >= 0 { Some(h_neighbor as usize) } else { None },
            if diag >= 0 { Some(diag as usize) } else { None },
        ];

        let has_wrong_box = cells.iter().any(|cell_opt| {
            if let Some(cell) = cell_opt {
                if box_set[*cell] {
                    // This cell has a box. Is it on the correct goal?
                    !board.is_goal[*cell]
                    // Note: for labeled goals, we'd need to check the label matches.
                    // For simplicity, if it's any goal we consider it potentially OK.
                    // The full solver handles labeled matching.
                } else {
                    false // It's a wall, not a box
                }
            } else {
                false // Wall
            }
        });

        if has_wrong_box {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::{Board, NUM_DIRS};

    fn make_line_board(n: usize) -> Board {
        let mut neighbors = vec![-1i32; n * NUM_DIRS];
        for i in 0..n {
            if i > 0 { neighbors[i * 4 + 2] = (i - 1) as i32; }
            if i + 1 < n { neighbors[i * 4 + 3] = (i + 1) as i32; }
        }
        Board {
            cell_count: n,
            width: n,
            neighbors,
            is_goal: vec![false; n],
            goal_label: vec![0; n],
            static_dead: vec![false; n],
            cell_y: vec![0; n],
            cell_x: (0..n).map(|i| i as i16).collect(),
        }
    }

    #[test]
    fn test_corner_dead_line_ends() {
        let board = make_line_board(5);
        // Cell 0 has walls on Up, Down, Left (only Right is open)
        // But corner check: Up(-1) and Left(-1) -> corner dead
        assert!(is_corner_dead(0, 0, &board));
        // Cell 4 has walls on Up, Down, Right
        assert!(is_corner_dead(4, 0, &board));
        // Cell 2 has walls on Up and Down but not adjacent pair with Left/Right
        // Actually Up=-1, Down=-1 are not an adjacent pair in our definition
        assert!(!is_corner_dead(2, 0, &board));
    }

    #[test]
    fn test_corner_dead_on_goal() {
        let mut board = make_line_board(5);
        board.is_goal[0] = true;
        board.goal_label[0] = 1;
        // Cell 0 is a corner but has matching goal
        assert!(!is_corner_dead(0, 1, &board));
        // Wrong label still dead
        assert!(is_corner_dead(0, 2, &board));
    }
}
