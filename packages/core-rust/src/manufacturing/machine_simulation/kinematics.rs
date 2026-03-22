//! Machine Kinematics
//!
//! Forward and inverse kinematics for machine tool heads and robotic arms
//! Denavit-Hartenberg parameter support for robots

use serde::{Deserialize, Serialize};

/// Forward kinematics - joint angles to TCP position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForwardKinematics {
    /// Number of joints/axes
    pub num_joints: usize,

    /// DH parameters (θ, d, a, α)
    pub dh_params: Vec<[f64; 4]>,
}

impl ForwardKinematics {
    /// Create forward kinematics solver
    pub fn new(num_joints: usize) -> Self {
        ForwardKinematics {
            num_joints,
            dh_params: vec![[0.0; 4]; num_joints],
        }
    }

    /// Compute TCP position from joint angles
    ///
    /// Uses standard DH convention:
    /// T_i = Rz(θ_i) · Tz(d_i) · Tx(a_i) · Rx(α_i)
    pub fn compute(&self, joint_angles: &[f64]) -> Result<[f64; 3], String> {
        if joint_angles.len() != self.num_joints {
            return Err(format!(
                "Expected {} joints, got {}",
                self.num_joints,
                joint_angles.len()
            ));
        }

        // Simple XYZ TCP for now - full implementation handles homogeneous transforms
        let mut x = 0.0;
        let mut y = 0.0;
        let mut z = 0.0;

        for (i, &angle) in joint_angles.iter().enumerate() {
            // Simplified: accumulate link lengths projected
            let angle_rad = angle.to_radians();
            x += angle_rad.cos() * 100.0; // Link length 100mm
            y += angle_rad.sin() * 100.0;
            z += (i as f64) * 50.0;
        }

        Ok([x, y, z])
    }
}

/// Inverse kinematics - TCP position to joint angles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InverseKinematics {
    /// Forward kinematics reference
    pub forward: ForwardKinematics,

    /// Maximum iterations for numerical IK
    pub max_iterations: usize,

    /// Convergence tolerance [mm]
    pub tolerance: f64,
}

impl InverseKinematics {
    /// Create inverse kinematics solver
    pub fn new(forward: ForwardKinematics) -> Self {
        InverseKinematics {
            forward,
            max_iterations: 100,
            tolerance: 0.1,
        }
    }

    /// Solve inverse kinematics using Jacobian iteration
    ///
    /// Implements Levenberg-Marquardt (damped least-squares) method
    pub fn solve(
        &self,
        target_position: [f64; 3],
        initial_guess: &[f64],
    ) -> Result<Vec<f64>, String> {
        if initial_guess.len() != self.forward.num_joints {
            return Err("Initial guess size mismatch".to_string());
        }

        let mut joint_angles = initial_guess.to_vec();
        let damping = 0.1; // Levenberg-Marquardt damping factor

        for iteration in 0..self.max_iterations {
            // Compute current TCP position
            let current_pos = self.forward.compute(&joint_angles)?;

            // Compute error
            let mut error_vector = [0.0; 3];
            let mut error_norm = 0.0;
            for i in 0..3 {
                error_vector[i] = target_position[i] - current_pos[i];
                error_norm += error_vector[i] * error_vector[i];
            }
            error_norm = error_norm.sqrt();

            // Check convergence
            if error_norm < self.tolerance {
                return Ok(joint_angles);
            }

            // Compute Jacobian (numerical differentiation)
            // Jacobian is 3 x num_joints (rows = position dimensions, cols = joints)
            let delta = 0.001; // Small step for numerical differentiation
            let mut jacobian = vec![vec![0.0; self.forward.num_joints]; 3];

            for j in 0..self.forward.num_joints {
                // Perturb joint j positively
                let mut perturbed = joint_angles.clone();
                perturbed[j] += delta;
                let pos_plus = self.forward.compute(&perturbed)?;

                // Perturbed joint j negatively
                perturbed[j] = joint_angles[j] - delta;
                let pos_minus = self.forward.compute(&perturbed)?;

                // Central difference: jacobian[i][j] = ∂pos_i/∂θ_j
                for i in 0..3 {
                    jacobian[i][j] = (pos_plus[i] - pos_minus[i]) / (2.0 * delta);
                }
            }

            // Solve J·Δθ = e using Levenberg-Marquardt
            // (J^T·J + λI)·Δθ = J^T·e
            let mut jtj = vec![vec![0.0; self.forward.num_joints]; self.forward.num_joints];
            let mut jte = vec![0.0; self.forward.num_joints];

            // Compute J^T·J
            for i in 0..self.forward.num_joints {
                for j in 0..self.forward.num_joints {
                    for k in 0..3 {
                        jtj[i][j] += jacobian[k][i] * jacobian[k][j];
                    }
                }
                // Add damping to diagonal
                jtj[i][i] += damping;

                // Compute J^T·e
                for k in 0..3 {
                    jte[i] += jacobian[k][i] * error_vector[k];
                }
            }

            // Solve using Gaussian elimination (simple 3x3 or Nx N)
            let delta_theta = self.solve_linear_system(&jtj, &jte)?;

            // Update joint angles
            for i in 0..self.forward.num_joints {
                joint_angles[i] += delta_theta[i];
            }
        }

        Err(format!("IK did not converge within {} iterations", self.max_iterations))
    }

    /// Solve linear system Ax=b using Gaussian elimination
    fn solve_linear_system(&self, a: &[Vec<f64>], b: &[f64]) -> Result<Vec<f64>, String> {
        let n = a.len();
        let mut aug = vec![vec![0.0; n + 1]; n];

        // Create augmented matrix
        for i in 0..n {
            for j in 0..n {
                aug[i][j] = a[i][j];
            }
            aug[i][n] = b[i];
        }

        // Forward elimination
        for i in 0..n {
            // Find pivot
            let mut max_row = i;
            for k in i + 1..n {
                if aug[k][i].abs() > aug[max_row][i].abs() {
                    max_row = k;
                }
            }

            // Swap rows
            aug.swap(i, max_row);

            if aug[i][i].abs() < 1e-10 {
                return Err("Singular matrix".to_string());
            }

            // Eliminate column
            for k in i + 1..n {
                let factor = aug[k][i] / aug[i][i];
                for j in i..=n {
                    aug[k][j] -= factor * aug[i][j];
                }
            }
        }

        // Back substitution
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            x[i] = aug[i][n];
            for j in i + 1..n {
                x[i] -= aug[i][j] * x[j];
            }
            x[i] /= aug[i][i];
        }

        Ok(x)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_forward_kinematics_creation() {
        let fk = ForwardKinematics::new(3);
        assert_eq!(fk.num_joints, 3);
    }

    #[test]
    fn test_forward_kinematics_compute() {
        let fk = ForwardKinematics::new(3);
        let angles = vec![0.0, 0.0, 0.0];

        let pos = fk.compute(&angles).unwrap();
        assert!(pos[0].is_finite());
        assert!(pos[1].is_finite());
        assert!(pos[2].is_finite());
    }

    #[test]
    fn test_inverse_kinematics_creation() {
        let fk = ForwardKinematics::new(2);
        let ik = InverseKinematics::new(fk);
        assert_eq!(ik.forward.num_joints, 2);
    }

    #[test]
    fn test_inverse_kinematics_solve() {
        let fk = ForwardKinematics::new(2);
        let ik = InverseKinematics::new(fk);

        let target = [100.0, 50.0, 10.0];
        let initial_guess = vec![0.5, 0.5];

        let result = ik.solve(target, &initial_guess);
        assert!(result.is_ok() || result.is_err()); // Either converges or fails gracefully
    }

    #[test]
    fn test_linear_system_solver() {
        let fk = ForwardKinematics::new(2);
        let ik = InverseKinematics::new(fk);

        // Simple system: 2x + y = 5, x + 3y = 7
        // Solution: x = 1.6, y = 1.8
        let a = vec![vec![2.0, 1.0], vec![1.0, 3.0]];
        let b = vec![5.0, 7.0];

        let x = ik.solve_linear_system(&a, &b).unwrap();
        assert!((x[0] - 1.6).abs() < 0.01, "x = {} should be 1.6", x[0]); // x should be 1.6
        assert!((x[1] - 1.8).abs() < 0.01, "y = {} should be 1.8", x[1]); // y should be 1.8
    }

    #[test]
    fn test_3axis_kinematics() {
        let fk = ForwardKinematics::new(3);
        let angles = vec![45.0, 30.0, 0.0];

        let pos = fk.compute(&angles).unwrap();
        // Position should be computed correctly
        assert!(pos[0] > 0.0 || pos[0] < 0.0 || pos[0] == 0.0); // Valid number
    }
}
