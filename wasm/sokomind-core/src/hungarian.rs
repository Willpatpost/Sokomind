/// Hungarian algorithm for minimum-cost assignment.
///
/// Standard O(n^3) implementation using potentials (Kuhn-Munkres).
/// Operates on a row-major cost matrix of i32 values.

const BLOCKED: i32 = 1_000_000_000;

/// Compute the minimum-cost assignment for a cost matrix.
///
/// `cost_matrix` — row-major flat array, cost_matrix[row * cols + col]
/// `rows` — number of rows (workers)
/// `cols` — number of columns (jobs)
///
/// Returns the minimum total assignment cost.
/// If the matrix is not square, it is padded internally.
/// If no feasible assignment exists, returns BLOCKED.
pub fn hungarian_assignment(cost_matrix: &[i32], rows: usize, cols: usize) -> i32 {
    if rows == 0 || cols == 0 {
        return 0;
    }

    // Work with square matrix (pad with zeros if needed)
    let size = rows.max(cols);

    // Build padded cost matrix
    let mut cost = vec![0i32; size * size];
    for r in 0..size {
        for c in 0..size {
            if r < rows && c < cols {
                let v = cost_matrix[r * cols + c];
                cost[r * size + c] = if v == i32::MAX { BLOCKED } else { v };
            }
            // Padded entries stay 0
        }
    }

    // Hungarian algorithm with potentials
    let mut u = vec![0i32; size + 1]; // row potentials
    let mut v = vec![0i32; size + 1]; // column potentials
    let mut matching = vec![0usize; size + 1]; // matching[col] = row (1-based), 0 = unmatched
    let mut predecessor = vec![0usize; size + 1];

    for row in 1..=size {
        matching[0] = row;
        let mut min_reduced = vec![BLOCKED; size + 1];
        let mut used = vec![false; size + 1];
        let mut col = 0usize;

        loop {
            used[col] = true;
            let matched_row = matching[col];
            let mut delta = BLOCKED;
            let mut next_col = 0usize;

            for candidate in 1..=size {
                if used[candidate] {
                    continue;
                }
                let c = cost[(matched_row - 1) * size + (candidate - 1)];
                let reduced = c - u[matched_row] - v[candidate];
                if reduced < min_reduced[candidate] {
                    min_reduced[candidate] = reduced;
                    predecessor[candidate] = col;
                }
                if min_reduced[candidate] < delta {
                    delta = min_reduced[candidate];
                    next_col = candidate;
                }
            }

            if delta >= BLOCKED {
                return BLOCKED;
            }

            for candidate in 0..=size {
                if used[candidate] {
                    u[matching[candidate]] += delta;
                    v[candidate] -= delta;
                } else {
                    min_reduced[candidate] -= delta;
                }
            }

            col = next_col;
            if matching[col] == 0 {
                break;
            }
        }

        // Augment along predecessor chain
        loop {
            let prev = predecessor[col];
            matching[col] = matching[prev];
            col = prev;
            if col == 0 {
                break;
            }
        }
    }

    // Compute total cost from the actual cost matrix (only real rows and cols)
    let mut total = 0i32;
    for col in 1..=size {
        let row = matching[col];
        if row > 0 && row <= rows && col <= cols {
            let c = cost_matrix[(row - 1) * cols + (col - 1)];
            if c == i32::MAX || c >= BLOCKED {
                return BLOCKED;
            }
            total = total.saturating_add(c);
        }
    }

    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_assignment() {
        // 3x3 identity-like cost: diagonal is 0, off-diagonal is 10
        let costs = vec![
            0, 10, 10,
            10, 0, 10,
            10, 10, 0,
        ];
        assert_eq!(hungarian_assignment(&costs, 3, 3), 0);
    }

    #[test]
    fn test_simple_assignment() {
        // 3x3 cost matrix
        let costs = vec![
            1, 2, 3,
            4, 5, 6,
            7, 8, 9,
        ];
        // Optimal: row0->col2(3), row1->col1(5), row2->col0(7) = 15? No.
        // Actually optimal: row0->col0(1), row1->col1(5), row2->col2(9) = 15
        // Or: row0->col2(3), row1->col1(5), row2->col0(7) = 15
        // Both give 15
        assert_eq!(hungarian_assignment(&costs, 3, 3), 15);
    }

    #[test]
    fn test_1x1() {
        assert_eq!(hungarian_assignment(&[42], 1, 1), 42);
    }

    #[test]
    fn test_empty() {
        assert_eq!(hungarian_assignment(&[], 0, 0), 0);
    }

    #[test]
    fn test_rectangular() {
        // 2x3 cost matrix (more cols than rows)
        let costs = vec![
            5, 1, 3,
            2, 4, 6,
        ];
        // Optimal: row0->col1(1), row1->col0(2) = 3
        assert_eq!(hungarian_assignment(&costs, 2, 3), 3);
    }
}
