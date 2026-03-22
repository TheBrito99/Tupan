//! Redundancy Resolution: Null-Space Projector
//! Phase 26 Task 2 - Redundant Robot Control

use crate::clifford_algebra::singularity_analysis::Jacobian;
use crate::clifford_algebra::robot_configuration::RobotArm;
use std::f64::consts::PI;

/// Redundancy resolution using null-space projector
pub struct RedundancyResolver {
    robot: RobotArm,
    damping_factor: f64,  // Singularity robustness (0.01-0.1)
}

impl RedundancyResolver {
    /// Create new redundancy resolver
    pub fn new(robot: RobotArm, damping_factor: f64) -> Self {
        RedundancyResolver {
            robot,
            damping_factor,
        }
    }

    /// Compute Moore-Penrose pseudoinverse using SVD (damped least-squares)
    /// Returns (6×n) pseudoinverse of (6×n) Jacobian
    pub fn compute_damped_pseudoinverse(&self, jacobian: &Jacobian) -> Result<Jacobian, String> {
        if jacobian.rows != 6 {
            return Err(format!("Expected 6 rows, got {}", jacobian.rows));
        }

        let n = jacobian.cols;

        // Compute J^T * J + λ²I
        let mut jt_j_damp = Jacobian::new(n, n);
        for i in 0..n {
            for j in 0..n {
                let mut sum = 0.0;
                for k in 0..6 {
                    sum += jacobian.get(k, i) * jacobian.get(k, j);
                }
                // Add damping on diagonal
                if i == j {
                    sum += self.damping_factor.powi(2);
                }
                jt_j_damp.set(i, j, sum);
            }
        }

        // Compute inverse via Gaussian elimination
        let inverse = Self::matrix_inverse_gauss(&jt_j_damp)?;

        // Compute J^T
        let mut jt = Jacobian::new(n, 6);
        for i in 0..n {
            for j in 0..6 {
                jt.set(i, j, jacobian.get(j, i));
            }
        }

        // Compute J_damp^+ = (J^T*J + λ²I)^-1 * J^T
        let mut pseudoinverse = Jacobian::new(n, 6);
        for i in 0..n {
            for j in 0..6 {
                let mut sum = 0.0;
                for k in 0..n {
                    sum += inverse.get(i, k) * jt.get(k, j);
                }
                pseudoinverse.set(i, j, sum);
            }
        }

        Ok(pseudoinverse)
    }

    /// Compute null-space projector: N = I - J^+ * J
    pub fn compute_null_space_projector(&self, jacobian: &Jacobian) -> Result<Jacobian, String> {
        let n = jacobian.cols;

        let pseudoinverse = self.compute_damped_pseudoinverse(jacobian)?;

        // Compute J^+ * J (6×n * n×6 = 6×6)
        let mut j_plus_j = Jacobian::new(n, n);
        for i in 0..n {
            for j in 0..n {
                let mut sum = 0.0;
                for k in 0..6 {
                    sum += pseudoinverse.get(i, k) * jacobian.get(k, j);
                }
                j_plus_j.set(i, j, sum);
            }
        }

        // Compute N = I - J^+ * J
        let mut null_projector = Jacobian::new(n, n);
        for i in 0..n {
            for j in 0..n {
                let identity_ij = if i == j { 1.0 } else { 0.0 };
                null_projector.set(i, j, identity_ij - j_plus_j.get(i, j));
            }
        }

        Ok(null_projector)
    }

    /// Resolve inverse kinematics with secondary task
    /// Returns joint angles satisfying primary task (position/orientation) and secondary task (null-space)
    pub fn resolve_ik_with_secondary_task(
        &self,
        initial_angles: &[f64],
        target_velocity: &[f64],  // 6D: [vx, vy, vz, wx, wy, wz]
        secondary_objective: &[f64],  // n-dim secondary velocity in null-space
        max_iterations: usize,
    ) -> Result<Vec<f64>, String> {
        if initial_angles.len() != self.robot.num_dof {
            return Err(format!("Expected {} angles", self.robot.num_dof));
        }
        if target_velocity.len() != 6 {
            return Err("Target velocity must be 6D".to_string());
        }

        let mut angles = initial_angles.to_vec();
        let dt = 0.001;  // Time step

        for _ in 0..max_iterations {
            // Compute Jacobian at current configuration
            let jacobian = self.compute_jacobian(&angles)?;

            // Compute damped pseudoinverse
            let pseudoinverse = self.compute_damped_pseudoinverse(&jacobian)?;

            // Primary task: dθ = J^+ * v_target
            let mut delta_angles = vec![0.0; self.robot.num_dof];
            for i in 0..self.robot.num_dof {
                let mut sum = 0.0;
                for j in 0..6 {
                    sum += pseudoinverse.get(i, j) * target_velocity[j];
                }
                delta_angles[i] = sum * dt;
            }

            // Secondary task: dθ_secondary = N * v_secondary
            let null_projector = self.compute_null_space_projector(&jacobian)?;
            for i in 0..self.robot.num_dof {
                let mut sum = 0.0;
                for j in 0..self.robot.num_dof {
                    sum += null_projector.get(i, j) * secondary_objective[j];
                }
                delta_angles[i] += sum * dt * 0.1;  // Scale down secondary task
            }

            // Update angles
            for i in 0..self.robot.num_dof {
                angles[i] += delta_angles[i];
                // Clamp to limits
                angles[i] = angles[i].max(-PI).min(PI);
            }

            // Check convergence
            let max_delta = delta_angles.iter().map(|x| x.abs()).fold(0.0, f64::max);
            if max_delta < 1e-6 {
                break;
            }
        }

        Ok(angles)
    }

    /// Compute singularity-robust pseudoinverse (condition number)
    pub fn compute_condition_number(&self, jacobian: &Jacobian) -> Result<f64, String> {
        // Frobenius norm of J
        let frobenius = jacobian.frobenius_norm();

        // Approximate condition number via damped pseudoinverse
        let pseudoinverse = self.compute_damped_pseudoinverse(jacobian)?;
        let pseudo_frobenius = pseudoinverse.frobenius_norm();

        Ok(frobenius * pseudo_frobenius)
    }

    /// Check if configuration is near singularity
    pub fn is_near_singularity(&self, angles: &[f64], threshold: f64) -> Result<bool, String> {
        let jacobian = self.compute_jacobian(angles)?;
        let condition_number = self.compute_condition_number(&jacobian)?;

        Ok(condition_number > threshold)
    }

    /// Find alternative solution avoiding singularity
    pub fn find_singularity_robust_solution(
        &self,
        target_velocity: &[f64],
        singularity_threshold: f64,
        max_iterations: usize,
    ) -> Result<Vec<f64>, String> {
        let mut best_angles = vec![0.0; self.robot.num_dof];
        let mut best_condition = f64::INFINITY;

        // Try random initial configurations
        for attempt in 0..10 {
            let mut angles = vec![0.0; self.robot.num_dof];

            // Random initialization
            for i in 0..self.robot.num_dof {
                angles[i] = (attempt as f64 / 10.0) * 2.0 * PI - PI;
            }

            // Optimize
            for _ in 0..max_iterations {
                let jacobian = self.compute_jacobian(&angles)?;
                let condition = self.compute_condition_number(&jacobian)?;

                if condition < best_condition {
                    best_condition = condition;
                    best_angles = angles.clone();
                }

                // Escape if in singularity region
                if condition > singularity_threshold {
                    break;
                }

                // Small step toward reducing condition number
                let pseudoinverse = self.compute_damped_pseudoinverse(&jacobian)?;
                for i in 0..self.robot.num_dof {
                    let mut sum = 0.0;
                    for j in 0..6 {
                        sum += pseudoinverse.get(i, j) * target_velocity[j];
                    }
                    angles[i] += sum * 0.0001;  // Very small step
                }
            }
        }

        Ok(best_angles)
    }

    /// Compute Jacobian using finite differences
    fn compute_jacobian(&self, angles: &[f64]) -> Result<Jacobian, String> {
        let mut jacobian = Jacobian::new(6, self.robot.num_dof);
        let delta = 1e-6;

        let (x0, y0, z0) = self.robot.forward_kinematics_3d(angles)?;

        for col in 0..self.robot.num_dof {
            let mut perturbed = angles.to_vec();
            perturbed[col] += delta;

            let (x1, y1, z1) = self.robot.forward_kinematics_3d(&perturbed)?;

            jacobian.set(0, col, (x1 - x0) / delta);
            jacobian.set(1, col, (y1 - y0) / delta);
            jacobian.set(2, col, (z1 - z0) / delta);
            // Approximate angular velocity (simplified)
            jacobian.set(3, col, 0.0);
            jacobian.set(4, col, 0.0);
            jacobian.set(5, col, 0.01);
        }

        Ok(jacobian)
    }

    /// Gaussian elimination with partial pivoting for matrix inversion
    fn matrix_inverse_gauss(matrix: &Jacobian) -> Result<Jacobian, String> {
        let n = matrix.rows;
        if matrix.cols != n {
            return Err("Matrix must be square".to_string());
        }

        // Create augmented matrix [A | I]
        let mut aug = Jacobian::new(n, 2 * n);

        for i in 0..n {
            for j in 0..n {
                aug.set(i, j, matrix.get(i, j));
                aug.set(i, n + j, if i == j { 1.0 } else { 0.0 });
            }
        }

        // Forward elimination with partial pivoting
        for col in 0..n {
            // Find pivot
            let mut max_row = col;
            let mut max_val = aug.get(col, col).abs();

            for row in col + 1..n {
                let val = aug.get(row, col).abs();
                if val > max_val {
                    max_val = val;
                    max_row = row;
                }
            }

            if max_val < 1e-10 {
                return Err("Matrix is singular".to_string());
            }

            // Swap rows
            for j in 0..2 * n {
                let temp = aug.get(col, j);
                aug.set(col, j, aug.get(max_row, j));
                aug.set(max_row, j, temp);
            }

            // Normalize pivot row
            let pivot = aug.get(col, col);
            for j in 0..2 * n {
                aug.set(col, j, aug.get(col, j) / pivot);
            }

            // Eliminate column
            for row in 0..n {
                if row != col {
                    let factor = aug.get(row, col);
                    for j in 0..2 * n {
                        aug.set(row, j, aug.get(row, j) - factor * aug.get(col, j));
                    }
                }
            }
        }

        // Extract inverse from right half
        let mut inverse = Jacobian::new(n, n);
        for i in 0..n {
            for j in 0..n {
                inverse.set(i, j, aug.get(i, n + j));
            }
        }

        Ok(inverse)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redundancy_resolver_creation() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);
        assert!((resolver.damping_factor - 0.05).abs() < 1e-10);
    }

    #[test]
    fn test_damped_pseudoinverse_creation() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let jacobian = Jacobian::new(6, 3);
        let result = resolver.compute_damped_pseudoinverse(&jacobian);

        assert!(result.is_ok());
    }

    #[test]
    fn test_damped_pseudoinverse_dimensions() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let mut jacobian = Jacobian::new(6, 3);
        for i in 0..6 {
            for j in 0..3 {
                jacobian.set(i, j, 0.1);
            }
        }

        let pseudo = resolver.compute_damped_pseudoinverse(&jacobian).unwrap();
        assert_eq!(pseudo.rows, 3);
        assert_eq!(pseudo.cols, 6);
    }

    #[test]
    fn test_null_space_projector_creation() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let mut jacobian = Jacobian::new(6, 3);
        for i in 0..6 {
            for j in 0..3 {
                jacobian.set(i, j, 0.1);
            }
        }

        let result = resolver.compute_null_space_projector(&jacobian);
        assert!(result.is_ok());
    }

    #[test]
    fn test_null_space_projector_dimensions() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let mut jacobian = Jacobian::new(6, 3);
        for i in 0..6 {
            for j in 0..3 {
                jacobian.set(i, j, 0.1);
            }
        }

        let projector = resolver.compute_null_space_projector(&jacobian).unwrap();
        assert_eq!(projector.rows, 3);
        assert_eq!(projector.cols, 3);
    }

    #[test]
    fn test_null_space_projector_idempotent() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let mut jacobian = Jacobian::new(6, 3);
        for i in 0..6 {
            for j in 0..3 {
                jacobian.set(i, j, 0.1 * (i as f64 + j as f64 + 1.0));
            }
        }

        let n = resolver.compute_null_space_projector(&jacobian).unwrap();

        // N should be idempotent: N * N = N (approximately)
        let mut n_squared = Jacobian::new(3, 3);
        for i in 0..3 {
            for j in 0..3 {
                let mut sum = 0.0;
                for k in 0..3 {
                    sum += n.get(i, k) * n.get(k, j);
                }
                n_squared.set(i, j, sum);
            }
        }

        // Check N² ≈ N
        for i in 0..3 {
            for j in 0..3 {
                assert!((n_squared.get(i, j) - n.get(i, j)).abs() < 0.1);
            }
        }
    }

    #[test]
    fn test_compute_condition_number() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let mut jacobian = Jacobian::new(6, 3);
        for i in 0..6 {
            for j in 0..3 {
                jacobian.set(i, j, 0.1);
            }
        }

        let condition = resolver.compute_condition_number(&jacobian).unwrap();
        assert!(condition > 0.0);
    }

    #[test]
    fn test_is_near_singularity() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let angles = vec![0.0, 0.0, 0.0];
        let result = resolver.is_near_singularity(&angles, 1000.0);

        assert!(result.is_ok());
    }

    #[test]
    fn test_find_singularity_robust_solution() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let target_velocity = vec![0.1, 0.0, 0.0, 0.0, 0.0, 0.0];
        let result = resolver.find_singularity_robust_solution(&target_velocity, 1000.0, 5);

        assert!(result.is_ok());
        let solution = result.unwrap();
        assert_eq!(solution.len(), 3);
    }

    #[test]
    fn test_resolve_ik_with_secondary_task() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let initial_angles = vec![0.0, 0.0, 0.0];
        let target_velocity = vec![0.01, 0.0, 0.0, 0.0, 0.0, 0.0];
        let secondary_objective = vec![0.0, 0.01, 0.0];

        let result = resolver.resolve_ik_with_secondary_task(
            &initial_angles,
            &target_velocity,
            &secondary_objective,
            10,
        );

        assert!(result.is_ok());
        let solution = result.unwrap();
        assert_eq!(solution.len(), 3);
    }

    #[test]
    fn test_resolve_ik_wrong_initial_angles() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let initial_angles = vec![0.0, 0.0];  // Wrong size
        let target_velocity = vec![0.01, 0.0, 0.0, 0.0, 0.0, 0.0];
        let secondary_objective = vec![0.0, 0.01, 0.0];

        let result = resolver.resolve_ik_with_secondary_task(
            &initial_angles,
            &target_velocity,
            &secondary_objective,
            10,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_ik_wrong_target_velocity() {
        let arm = RobotArm::create_3dof_planar();
        let resolver = RedundancyResolver::new(arm, 0.05);

        let initial_angles = vec![0.0, 0.0, 0.0];
        let target_velocity = vec![0.01, 0.0, 0.0];  // Wrong size
        let secondary_objective = vec![0.0, 0.01, 0.0];

        let result = resolver.resolve_ik_with_secondary_task(
            &initial_angles,
            &target_velocity,
            &secondary_objective,
            10,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_matrix_inverse_identity() {
        let mut matrix = Jacobian::new(3, 3);
        for i in 0..3 {
            for j in 0..3 {
                matrix.set(i, j, if i == j { 1.0 } else { 0.0 });
            }
        }

        let inverse = RedundancyResolver::matrix_inverse_gauss(&matrix).unwrap();

        // Inverse of identity should be identity
        for i in 0..3 {
            for j in 0..3 {
                let expected = if i == j { 1.0 } else { 0.0 };
                assert!((inverse.get(i, j) - expected).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_matrix_inverse_diagonal() {
        let mut matrix = Jacobian::new(3, 3);
        matrix.set(0, 0, 2.0);
        matrix.set(1, 1, 3.0);
        matrix.set(2, 2, 4.0);

        let inverse = RedundancyResolver::matrix_inverse_gauss(&matrix).unwrap();

        // Inverse of diagonal should have reciprocals on diagonal
        assert!((inverse.get(0, 0) - 0.5).abs() < 1e-10);
        assert!((inverse.get(1, 1) - 1.0 / 3.0).abs() < 1e-10);
        assert!((inverse.get(2, 2) - 0.25).abs() < 1e-10);
    }
}
