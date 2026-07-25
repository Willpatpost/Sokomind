/// Board data structure for dense Sokoban representation.
///
/// Floor cells are indexed 0..cell_count. Walls are implicit (neighbor == -1).
/// The `neighbors` array is laid out as [cell * 4 + dir] where dir is:
///   0 = Up, 1 = Down, 2 = Left, 3 = Right
/// matching the JS DIRECTION_ENTRIES order.

pub const NUM_DIRS: usize = 4;

/// The opposite direction index: Up<->Down, Left<->Right.
pub const OPPOSITE_DIR: [usize; 4] = [1, 0, 3, 2];

/// Direction deltas: [dy, dx] for Up, Down, Left, Right.
#[allow(dead_code)]
pub const DIR_DELTA: [[i32; 2]; 4] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

#[allow(dead_code)]
pub struct Board {
    pub cell_count: usize,
    pub width: usize,
    pub neighbors: Vec<i32>,     // cell_count * 4
    pub is_goal: Vec<bool>,
    pub goal_label: Vec<u8>,     // 0 = no goal, label ID otherwise (1-based)
    pub static_dead: Vec<bool>,
    pub cell_y: Vec<i16>,        // y coordinate of each cell
    pub cell_x: Vec<i16>,        // x coordinate of each cell
}

impl Board {
    /// Parse a flat i32 buffer into a Board.
    ///
    /// Layout: [cell_count, width,
    ///          neighbors (cell_count * 4)...,
    ///          goal_labels (cell_count)...,
    ///          static_dead (cell_count)...,
    ///          cell_y (cell_count)...,
    ///          cell_x (cell_count)...]
    pub fn from_flat(data: &[i32]) -> Board {
        let cell_count = data[0] as usize;
        let width = data[1] as usize;

        let header = 2;
        let neighbors_start = header;
        let neighbors_end = neighbors_start + cell_count * NUM_DIRS;
        let goals_start = neighbors_end;
        let goals_end = goals_start + cell_count;
        let dead_start = goals_end;
        let dead_end = dead_start + cell_count;
        let y_start = dead_end;
        let y_end = y_start + cell_count;
        let x_start = y_end;

        let neighbors: Vec<i32> = data[neighbors_start..neighbors_end].to_vec();

        let mut is_goal = vec![false; cell_count];
        let mut goal_label = vec![0u8; cell_count];
        for i in 0..cell_count {
            let label = data[goals_start + i];
            if label > 0 {
                is_goal[i] = true;
                goal_label[i] = label as u8;
            }
        }

        let mut static_dead = vec![false; cell_count];
        for i in 0..cell_count {
            static_dead[i] = data[dead_start + i] != 0;
        }

        let mut cell_y = vec![0i16; cell_count];
        let mut cell_x = vec![0i16; cell_count];
        for i in 0..cell_count {
            cell_y[i] = data[y_start + i] as i16;
            cell_x[i] = data[x_start + i] as i16;
        }

        Board {
            cell_count,
            width,
            neighbors,
            is_goal,
            goal_label,
            static_dead,
            cell_y,
            cell_x,
        }
    }

    /// Get the neighbor of `cell` in direction `dir`, or -1 if wall.
    #[inline(always)]
    pub fn neighbor(&self, cell: usize, dir: usize) -> i32 {
        self.neighbors[cell * NUM_DIRS + dir]
    }
}
