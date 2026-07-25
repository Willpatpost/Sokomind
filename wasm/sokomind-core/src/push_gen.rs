/// Push candidate generation for the Sokoban solver.
///
/// For each box, for each direction:
///   support = neighbor in opposite direction (where player stands)
///   destination = neighbor in push direction (where box lands)
///   if support is reachable AND destination is empty floor AND not static dead
///   -> emit push candidate

use crate::board::{Board, NUM_DIRS, OPPOSITE_DIR};

/// A candidate push move.
#[derive(Debug, Clone)]
pub struct PushCandidate {
    pub box_index: usize,
    pub direction: usize,
    pub destination: usize, // cell ID where box lands
    pub support: usize,     // cell ID where player stands to push
}

/// Generate all valid push candidates given the current box positions
/// and reachable cells.
///
/// `boxes` — sorted cell IDs of all boxes
/// `reachable` — boolean array from reachability BFS
/// `board` — the board structure
///
/// Returns a Vec of PushCandidates. Does not check dynamic deadlocks
/// (those are checked by the caller in the full solver).
pub fn generate_pushes(
    boxes: &[usize],
    reachable: &[bool],
    board: &Board,
) -> Vec<PushCandidate> {
    let mut box_occupancy = vec![false; board.cell_count];
    for &b in boxes {
        box_occupancy[b] = true;
    }

    let mut result = Vec::new();

    for (box_index, &box_cell) in boxes.iter().enumerate() {
        for dir in 0..NUM_DIRS {
            let opposite = OPPOSITE_DIR[dir];

            // Support: the cell opposite the push direction (player stands here)
            let support_i = board.neighbor(box_cell, opposite);
            if support_i < 0 {
                continue;
            }
            let support = support_i as usize;
            if !reachable[support] {
                continue;
            }

            // Destination: the cell in the push direction (box lands here)
            let dest_i = board.neighbor(box_cell, dir);
            if dest_i < 0 {
                continue;
            }
            let dest = dest_i as usize;

            // Destination must be empty floor (no box)
            if box_occupancy[dest] {
                continue;
            }

            // Skip static dead squares
            if board.static_dead[dest] {
                continue;
            }

            result.push(PushCandidate {
                box_index,
                direction: dir,
                destination: dest,
                support,
            });
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::Board;
    use crate::reachability::reachable_cells;

    #[test]
    fn test_simple_push() {
        // Linear board: 0 - 1 - 2 - 3 - 4 (only right/left neighbors)
        let cell_count = 5;
        let mut neighbors = vec![-1i32; cell_count * 4];
        for i in 0..5usize {
            // Left neighbor (dir 2)
            if i > 0 {
                neighbors[i * 4 + 2] = (i - 1) as i32;
            }
            // Right neighbor (dir 3)
            if i < 4 {
                neighbors[i * 4 + 3] = (i + 1) as i32;
            }
        }

        let board = Board {
            cell_count,
            width: 5,
            neighbors,
            is_goal: vec![false; cell_count],
            goal_label: vec![0; cell_count],
            static_dead: vec![false; cell_count],
            cell_y: vec![0; cell_count],
            cell_x: vec![0, 1, 2, 3, 4],
        };

        // Robot at 0, box at 2
        let boxes = vec![2usize];
        let mut box_occ = vec![false; cell_count];
        box_occ[2] = true;
        let reach = reachable_cells(0, &box_occ, &board);
        // Reachable: 0, 1 (blocked by box at 2)
        assert!(reach[0] && reach[1] && !reach[2]);

        let pushes = generate_pushes(&boxes, &reach, &board);
        // Player at 1 can push box at 2 rightward to 3
        assert_eq!(pushes.len(), 1);
        assert_eq!(pushes[0].support, 1);
        assert_eq!(pushes[0].destination, 3);
        assert_eq!(pushes[0].direction, 3); // Right
    }
}
