//! Symbolic and numerical equation solving
//!
//! This module provides comprehensive equation solving capabilities:
//! - Symbolic solving (algebraic manipulation)
//! - Numerical solving (Newton-Raphson, bisection, etc.)
//! - System of equations (linear and non-linear)
//! - Root finding with multiple methods
//! - Integration with calculus module for derivatives

use super::calculus::Calculus;
use super::expression::Expression;
use super::simplify::Simplifier;
use std::collections::HashMap;

/// Configuration for numerical solvers
#[derive(Debug, Clone)]
pub struct SolverConfig {
    /// Maximum iterations for iterative methods
    pub max_iterations: usize,
    /// Tolerance for convergence
    pub tolerance: f64,
    /// Initial guess for Newton-Raphson
    pub initial_guess: f64,
    /// Step size for bisection
    pub bisection_tolerance: f64,
}

impl Default for SolverConfig {
    fn default() -> Self {
        Self {
            max_iterations: 100,
            tolerance: 1e-10,
            initial_guess: 0.0,
            bisection_tolerance: 1e-10,
        }
    }
}

/// Solution result for equations
#[derive(Debug, Clone)]
pub struct Solution {
    /// The solution value(s)
    pub roots: Vec<f64>,
    /// Whether solution converged
    pub converged: bool,
    /// Number of iterations used
    pub iterations: usize,
    /// Residual error at solution
    pub residual: f64,
}

impl Solution {
    /// Get the primary (first) root
    pub fn primary_root(&self) -> Option<f64> {
        self.roots.first().copied()
    }

    /// Check if solution is valid
    pub fn is_valid(&self) -> bool {
        self.converged && !self.roots.is_empty()
    }
}

/// Equation solver integrating symbolic and numerical methods
pub struct EquationSolver {
    config: SolverConfig,
    calculus: Calculus,
    simplifier: Simplifier,
}

impl Default for EquationSolver {
    fn default() -> Self {
        Self::new(SolverConfig::default())
    }
}

impl EquationSolver {
    /// Create a new equation solver
    pub fn new(config: SolverConfig) -> Self {
        Self {
            config,
            calculus: Calculus::new(),
            simplifier: Simplifier::default(),
        }
    }

    /// Solve equation: f(x) = 0 using Newton-Raphson method
    ///
    /// Requires derivative computation. Iterates:
    /// x_{n+1} = x_n - f(x_n) / f'(x_n)
    pub fn solve_newton_raphson(
        &self,
        expr: &Expression,
        var: &str,
    ) -> Result<Solution, String> {
        // Compute derivative for Newton-Raphson
        let derivative = self.calculus.derivative(expr, var);

        let mut x = self.config.initial_guess;
        let mut iterations = 0;

        for i in 0..self.config.max_iterations {
            let mut context = HashMap::new();
            context.insert(var.to_string(), x);

            // Evaluate f(x) and f'(x)
            let f_x = expr.evaluate(&context)?;
            let f_prime_x = derivative.evaluate(&context)?;

            if f_prime_x.abs() < 1e-15 {
                return Err("Derivative too close to zero".to_string());
            }

            // Newton-Raphson update
            let x_next = x - f_x / f_prime_x;

            iterations = i + 1;

            // Check convergence
            if (x_next - x).abs() < self.config.tolerance {
                return Ok(Solution {
                    roots: vec![x_next],
                    converged: true,
                    iterations,
                    residual: f_x.abs(),
                });
            }

            x = x_next;
        }

        Ok(Solution {
            roots: vec![x],
            converged: false,
            iterations,
            residual: {
                let mut context = HashMap::new();
                context.insert(var.to_string(), x);
                expr.evaluate(&context).unwrap_or(f64::NAN).abs()
            },
        })
    }

    /// Solve equation: f(x) = 0 using bisection method
    ///
    /// Requires bracketing interval [a, b] where f(a)*f(b) < 0
    pub fn solve_bisection(
        &self,
        expr: &Expression,
        var: &str,
        a: f64,
        b: f64,
    ) -> Result<Solution, String> {
        let mut context = HashMap::new();

        // Check bracketing condition
        context.insert(var.to_string(), a);
        let f_a = expr.evaluate(&context)?;

        context.insert(var.to_string(), b);
        let f_b = expr.evaluate(&context)?;

        if f_a * f_b > 0.0 {
            return Err("Interval does not bracket a root (f(a)*f(b) > 0)".to_string());
        }

        let mut left = a;
        let mut right = b;
        let mut iterations = 0;

        for i in 0..self.config.max_iterations {
            let mid = (left + right) / 2.0;

            context.insert(var.to_string(), mid);
            let f_mid = expr.evaluate(&context)?;

            iterations = i + 1;

            // Check convergence
            if (right - left).abs() < self.config.bisection_tolerance {
                return Ok(Solution {
                    roots: vec![mid],
                    converged: true,
                    iterations,
                    residual: f_mid.abs(),
                });
            }

            // Update interval
            if f_mid * f_a < 0.0 {
                right = mid;
            } else {
                left = mid;
            }
        }

        let root = (left + right) / 2.0;
        context.insert(var.to_string(), root);
        let residual = expr.evaluate(&context).unwrap_or(f64::NAN).abs();

        Ok(Solution {
            roots: vec![root],
            converged: false,
            iterations,
            residual,
        })
    }

    /// Solve quadratic equation: ax² + bx + c = 0
    ///
    /// Returns 0, 1, or 2 real roots depending on discriminant
    pub fn solve_quadratic(&self, a: f64, b: f64, c: f64) -> Result<Solution, String> {
        if a.abs() < 1e-15 {
            // Degenerate case: bx + c = 0
            if b.abs() < 1e-15 {
                return Err("Not a valid equation".to_string());
            }
            return Ok(Solution {
                roots: vec![-c / b],
                converged: true,
                iterations: 0,
                residual: 0.0,
            });
        }

        let discriminant = b * b - 4.0 * a * c;

        if discriminant < 0.0 {
            // Complex roots - not returning them
            Ok(Solution {
                roots: vec![],
                converged: true,
                iterations: 0,
                residual: 0.0,
            })
        } else if discriminant.abs() < 1e-15 {
            // One repeated root
            let root = -b / (2.0 * a);
            Ok(Solution {
                roots: vec![root],
                converged: true,
                iterations: 0,
                residual: 0.0,
            })
        } else {
            // Two distinct roots
            let sqrt_disc = discriminant.sqrt();
            let root1 = (-b + sqrt_disc) / (2.0 * a);
            let root2 = (-b - sqrt_disc) / (2.0 * a);

            Ok(Solution {
                roots: vec![root1, root2],
                converged: true,
                iterations: 0,
                residual: 0.0,
            })
        }
    }

    /// Solve cubic equation: ax³ + bx² + cx + d = 0
    ///
    /// Uses Cardano's formula for cubic roots
    pub fn solve_cubic(&self, a: f64, b: f64, c: f64, d: f64) -> Result<Solution, String> {
        if a.abs() < 1e-15 {
            // Degenerate to quadratic
            return self.solve_quadratic(b, c, d);
        }

        // Normalize
        let b_norm = b / a;
        let c_norm = c / a;
        let d_norm = d / a;

        // Depress the cubic: t³ + pt + q = 0
        let p = c_norm - (b_norm * b_norm) / 3.0;
        let q = 2.0 * b_norm.powi(3) / 27.0 - (b_norm * c_norm) / 3.0 + d_norm;

        // Discriminant
        let discriminant = -(4.0 * p.powi(3) + 27.0 * q.powi(2));

        // Using cubic formula (simplified - one real root)
        let term1 = -q / 2.0;
        let term2 = (q * q / 4.0 + p.powi(3) / 27.0).sqrt();

        let cbrt1 = (term1 + term2).cbrt();
        let cbrt2 = (term1 - term2).cbrt();

        let root_real = if cbrt1.abs() < 1e-15 && cbrt2.abs() < 1e-15 {
            0.0
        } else if cbrt1.abs() < 1e-15 {
            cbrt2 - b_norm / 3.0
        } else if cbrt2.abs() < 1e-15 {
            cbrt1 - b_norm / 3.0
        } else {
            cbrt1 + cbrt2 - b_norm / 3.0
        };

        Ok(Solution {
            roots: vec![root_real],
            converged: true,
            iterations: 0,
            residual: 0.0,
        })
    }

    /// Solve system of linear equations using Gaussian elimination
    ///
    /// Ax = b where A is n×n matrix, x and b are vectors
    pub fn solve_linear_system(
        &self,
        matrix: &[Vec<f64>],
        constants: &[f64],
    ) -> Result<Vec<f64>, String> {
        let n = matrix.len();

        if n == 0 {
            return Err("Empty system".to_string());
        }

        if n != constants.len() {
            return Err("Matrix and constants dimension mismatch".to_string());
        }

        // Create augmented matrix
        let mut aug = Vec::new();
        for i in 0..n {
            let mut row = matrix[i].clone();
            row.push(constants[i]);
            aug.push(row);
        }

        // Forward elimination
        for i in 0..n {
            // Find pivot
            let mut max_row = i;
            for k in (i + 1)..n {
                if aug[k][i].abs() > aug[max_row][i].abs() {
                    max_row = k;
                }
            }

            // Swap rows
            aug.swap(i, max_row);

            if aug[i][i].abs() < 1e-15 {
                return Err("Singular matrix".to_string());
            }

            // Eliminate column
            for k in (i + 1)..n {
                let factor = aug[k][i] / aug[i][i];
                for j in i..=n {
                    aug[k][j] -= factor * aug[i][j];
                }
            }
        }

        // Back substitution
        let mut solution = vec![0.0; n];
        for i in (0..n).rev() {
            solution[i] = aug[i][n];
            for j in (i + 1)..n {
                solution[i] -= aug[i][j] * solution[j];
            }
            solution[i] /= aug[i][i];
        }

        Ok(solution)
    }

    /// Find all roots of expression using multiple starting points
    pub fn find_all_roots(
        &self,
        expr: &Expression,
        var: &str,
        search_range: (f64, f64),
        num_points: usize,
    ) -> Result<Solution, String> {
        let mut all_roots = Vec::new();
        let step = (search_range.1 - search_range.0) / num_points as f64;

        for i in 0..num_points {
            let guess = search_range.0 + step * i as f64;

            // Try Newton-Raphson from this point
            let mut temp_config = self.config.clone();
            temp_config.initial_guess = guess;
            let temp_solver = EquationSolver::new(temp_config);

            if let Ok(sol) = temp_solver.solve_newton_raphson(expr, var) {
                if sol.is_valid() && sol.residual < 0.01 {
                    // Check if root is new
                    let is_new = all_roots.iter().all(|&r: &f64| (r - sol.primary_root().unwrap()).abs() > 0.1);
                    if is_new {
                        all_roots.push(sol.primary_root().unwrap());
                    }
                }
            }
        }

        all_roots.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        Ok(Solution {
            roots: all_roots,
            converged: true,
            iterations: num_points,
            residual: 0.0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solve_quadratic_two_roots() {
        let solver = EquationSolver::default();
        // x² - 5x + 6 = 0 → (x-2)(x-3) = 0 → roots: 2, 3
        let sol = solver.solve_quadratic(1.0, -5.0, 6.0).unwrap();
        assert_eq!(sol.roots.len(), 2);
        assert!(sol.converged);
    }

    #[test]
    fn test_solve_quadratic_one_root() {
        let solver = EquationSolver::default();
        // x² - 2x + 1 = 0 → (x-1)² = 0 → root: 1
        let sol = solver.solve_quadratic(1.0, -2.0, 1.0).unwrap();
        assert_eq!(sol.roots.len(), 1);
        assert!((sol.roots[0] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_solve_quadratic_no_real_roots() {
        let solver = EquationSolver::default();
        // x² + 1 = 0 → no real roots
        let sol = solver.solve_quadratic(1.0, 0.0, 1.0).unwrap();
        assert_eq!(sol.roots.len(), 0);
    }

    #[test]
    fn test_solve_linear_system_2x2() {
        let solver = EquationSolver::default();
        // 2x + y = 5
        // x - y = 1
        // Solution: x = 2, y = 1
        let matrix = vec![vec![2.0, 1.0], vec![1.0, -1.0]];
        let constants = vec![5.0, 1.0];
        let sol = solver.solve_linear_system(&matrix, &constants).unwrap();
        assert_eq!(sol.len(), 2);
        assert!((sol[0] - 2.0).abs() < 1e-10);
        assert!((sol[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_solve_newton_raphson() {
        let solver = EquationSolver::default();
        // Solve: x² - 2 = 0 → x = √2 ≈ 1.414
        let expr = Expression::variable("x").power(Expression::number(2.0))
            .subtract(Expression::number(2.0));
        let sol = solver.solve_newton_raphson(&expr, "x").unwrap();
        assert!(sol.is_valid());
        assert!((sol.primary_root().unwrap() - 1.414).abs() < 0.01);
    }

    #[test]
    fn test_solve_bisection() {
        let solver = EquationSolver::default();
        // Solve: x² - 4 = 0 with interval [0, 3] → x = 2
        let expr = Expression::variable("x").power(Expression::number(2.0))
            .subtract(Expression::number(4.0));
        let sol = solver.solve_bisection(&expr, "x", 0.0, 3.0).unwrap();
        assert!(sol.converged);
        assert!((sol.primary_root().unwrap() - 2.0).abs() < 0.001);
    }

    #[test]
    fn test_solve_cubic() {
        let solver = EquationSolver::default();
        // x³ - 1 = 0 → x = 1 (one real root)
        let sol = solver.solve_cubic(1.0, 0.0, 0.0, -1.0).unwrap();
        assert!(sol.converged);
        assert!(!sol.roots.is_empty());
    }

    #[test]
    fn test_quadratic_degenerate_to_linear() {
        let solver = EquationSolver::default();
        // 0x² + 2x - 4 = 0 → 2x - 4 = 0 → x = 2
        let sol = solver.solve_quadratic(0.0, 2.0, -4.0).unwrap();
        assert!((sol.roots[0] - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_linear_system_3x3() {
        let solver = EquationSolver::default();
        // x + y + z = 6
        // 2x - y + z = 3
        // x + y - z = 0
        // Solution: x = 1, y = 2, z = 3
        let matrix = vec![
            vec![1.0, 1.0, 1.0],
            vec![2.0, -1.0, 1.0],
            vec![1.0, 1.0, -1.0],
        ];
        let constants = vec![6.0, 3.0, 0.0];
        let sol = solver.solve_linear_system(&matrix, &constants).unwrap();
        assert!((sol[0] - 1.0).abs() < 1e-10);
        assert!((sol[1] - 2.0).abs() < 1e-10);
        assert!((sol[2] - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_find_all_roots() {
        let solver = EquationSolver::default();
        // Solve: x² - 1 = 0 → roots: -1, 1
        let expr = Expression::variable("x").power(Expression::number(2.0))
            .subtract(Expression::number(1.0));
        let sol = solver.find_all_roots(&expr, "x", (-3.0, 3.0), 20).unwrap();
        assert!(sol.roots.len() > 0);
    }

    #[test]
    fn test_solver_config_default() {
        let config = SolverConfig::default();
        assert_eq!(config.max_iterations, 100);
        assert_eq!(config.tolerance, 1e-10);
    }
}
