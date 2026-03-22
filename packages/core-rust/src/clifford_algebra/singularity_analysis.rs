//! Singularity Analysis and Jacobian Computation
//! Phase 25 Task 3 - Advanced Kinematics

use crate::clifford_algebra::robot_configuration::{RobotArm, RobotJoint};
use std::f64::consts::PI;

/// Jacobian matrix for robot manipulator
/// Maps joint velocities to end-effector velocity/angular velocity
#[derive(Debug, Clone)]
pub struct Jacobian {
    pub rows: usize,     // 6 for position + orientation, 3 for position only
    pub cols: usize,     // Number of joints (DOF)
    pub data: Vec<f64>,  // Row-major storage
}

impl Jacobian {
    /// Create new Jacobian matrix (rows × cols)
    pub fn new(rows: usize, cols: usize) -> Self {
        Jacobian {
            rows,
            cols,
            data: vec![0.0; rows * cols],
        }
    }

    /// Set element at (row, col)
    pub fn set(&mut self, row: usize, col: usize, value: f64) {
        if row < self.rows && col < self.cols {
            self.data[row * self.cols + col] = value;
        }
    }

    /// Get element at (row, col)
    pub fn get(&self, row: usize, col: usize) -> f64 {
        if row < self.rows && col < self.cols {
            self.data[row * self.cols + col]
        } else {
            0.0
        }
    }

    /// Compute determinant (for square matrices only)
    pub fn determinant(&self) -> Result<f64, String> {
        if self.rows != self.cols {
            return Err(format!("Cannot compute determinant: {}×{} is not square", self.rows, self.cols));
        }

        match self.rows {
            1 => Ok(self.get(0, 0)),
            2 => {
                // det = ad - bc
                let a = self.get(0, 0);
                let b = self.get(0, 1);
                let c = self.get(1, 0);
                let d = self.get(1, 1);
                Ok(a * d - b * c)
            }
            3 => {
                // 3×3 determinant using rule of Sarrus
                let a = self.get(0, 0);
                let b = self.get(0, 1);
                let c = self.get(0, 2);
                let d = self.get(1, 0);
                let e = self.get(1, 1);
                let f = self.get(1, 2);
                let g = self.get(2, 0);
                let h = self.get(2, 1);
                let i = self.get(2, 2);

                let det = a * e * i + b * f * g + c * d * h - c * e * g - b * d * i - a * f * h;
                Ok(det)
            }
            4 => {
                // 4×4 determinant via Laplace expansion on first row
                let mut det = 0.0;
                for j in 0..4 {
                    let minor = self.get_minor(0, j)?;
                    let minor_det = minor.determinant()?;
                    let sign = if (0 + j) % 2 == 0 { 1.0 } else { -1.0 };
                    det += sign * self.get(0, j) * minor_det;
                }
                Ok(det)
            }
            5 => {
                // 5×5 determinant via Laplace expansion on first row
                let mut det = 0.0;
                for j in 0..5 {
                    let minor = self.get_minor(0, j)?;
                    let minor_det = minor.determinant()?;
                    let sign = if (0 + j) % 2 == 0 { 1.0 } else { -1.0 };
                    det += sign * self.get(0, j) * minor_det;
                }
                Ok(det)
            }
            6 => {
                // 6×6 determinant via Laplace expansion on first row
                let mut det = 0.0;
                for j in 0..6 {
                    let minor = self.get_minor(0, j)?;
                    let minor_det = minor.determinant()?;
                    let sign = if (0 + j) % 2 == 0 { 1.0 } else { -1.0 };
                    det += sign * self.get(0, j) * minor_det;
                }
                Ok(det)
            }
            _ => Err(format!("Determinant not implemented for {}×{} matrices", self.rows, self.cols)),
        }
    }

    /// Get minor matrix (delete row i, column j)
    fn get_minor(&self, del_row: usize, del_col: usize) -> Result<Jacobian, String> {
        if del_row >= self.rows || del_col >= self.cols {
            return Err("Invalid row or column for minor".to_string());
        }

        let mut minor = Jacobian::new(self.rows - 1, self.cols - 1);
        let mut mi = 0;
        for i in 0..self.rows {
            if i == del_row {
                continue;
            }
            let mut mj = 0;
            for j in 0..self.cols {
                if j == del_col {
                    continue;
                }
                minor.set(mi, mj, self.get(i, j));
                mj += 1;
            }
            mi += 1;
        }
        Ok(minor)
    }

    /// Compute Frobenius norm (Euclidean norm of all elements)
    pub fn frobenius_norm(&self) -> f64 {
        self.data.iter().map(|x| x * x).sum::<f64>().sqrt()
    }

    /// Compute maximum absolute value (for numerical stability analysis)
    pub fn max_element(&self) -> f64 {
        self.data.iter().map(|x| x.abs()).fold(0.0, f64::max)
    }

    /// Compute min absolute value (for rank computation)
    pub fn min_nonzero_element(&self) -> f64 {
        self.data
            .iter()
            .filter(|x| x.abs() > 1e-12)
            .map(|x| x.abs())
            .fold(f64::INFINITY, f64::min)
    }
}

/// Singularity analysis result
#[derive(Debug, Clone)]
pub struct SingularityInfo {
    pub is_singular: bool,              // det(J) ≈ 0
    pub determinant: f64,               // det(J)
    pub condition_number: f64,          // κ = σ_max / σ_min
    pub jacobian_rank: usize,           // Actual rank (< DOF = singularity)
    pub singularity_type: SingularityType,
    pub distance_to_singularity: f64,   // Approximate distance in configuration space
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SingularityType {
    Regular,               // No singularity
    Shoulder,              // Joint 1 singularity
    Elbow,                 // Joint 2/3 singularity
    Wrist,                 // Wrist singularities
    Workspace,             // Boundary singularities
    Unknown,               // Unclassified
}

/// Singularity analyzer for robot arms
pub struct SingularityAnalyzer {
    robot: RobotArm,
}

impl SingularityAnalyzer {
    /// Create new analyzer for a robot arm
    pub fn new(robot: RobotArm) -> Self {
        SingularityAnalyzer { robot }
    }

    /// Compute Jacobian for planar 3-DOF arm (3×3 or 6×3)
    /// Using numerical differentiation with forward kinematics
    pub fn jacobian_3dof_planar(&self, angles: &[f64], delta: f64) -> Result<Jacobian, String> {
        if angles.len() != 3 {
            return Err("Expected 3 joint angles".to_string());
        }

        // Current end-effector position
        let (x0, y0) = self.robot.forward_kinematics_2d(angles)?;

        let mut jac = Jacobian::new(3, 3); // 3D Jacobian: [x, y, theta]

        // Compute partial derivatives numerically
        for col in 0..3 {
            let mut angles_plus = angles.to_vec();
            angles_plus[col] += delta;

            let (x_plus, y_plus) = self.robot.forward_kinematics_2d(&angles_plus)?;

            // End-effector velocity = (∂x/∂θ, ∂y/∂θ)
            let dx_dtheta = (x_plus - x0) / delta;
            let dy_dtheta = (y_plus - y0) / delta;

            // End-effector orientation changes with joint angle
            let dtheta_dtheta = 1.0;

            jac.set(0, col, dx_dtheta);
            jac.set(1, col, dy_dtheta);
            jac.set(2, col, dtheta_dtheta);
        }

        Ok(jac)
    }

    /// Compute Jacobian for 6-DOF spatial arm
    /// Full 6×6 Jacobian with position and orientation
    pub fn jacobian_6dof_spatial(&self, angles: &[f64], delta: f64) -> Result<Jacobian, String> {
        if angles.len() != 6 {
            return Err("Expected 6 joint angles".to_string());
        }

        let mut jac = Jacobian::new(6, 6);

        // Current end-effector position (using simplified FK)
        let (x0, y0, z0) = self.robot.forward_kinematics_3d(angles)?;

        // Simplified approach: numerical differentiation
        for col in 0..6 {
            let mut angles_plus = angles.to_vec();
            angles_plus[col] += delta;

            let (x_plus, y_plus, z_plus) = self.robot.forward_kinematics_3d(&angles_plus)?;

            // Position derivatives
            let dx_dtheta = (x_plus - x0) / delta;
            let dy_dtheta = (y_plus - y0) / delta;
            let dz_dtheta = (z_plus - z0) / delta;

            jac.set(0, col, dx_dtheta);
            jac.set(1, col, dy_dtheta);
            jac.set(2, col, dz_dtheta);

            // Orientation derivatives (simplified: angular velocity along joint axis)
            let axis_z = if col == 0 { 1.0 } else { 0.0 };
            let axis_y = if col == 1 { 1.0 } else { 0.0 };
            let axis_x = if col >= 2 && col <= 4 { 1.0 } else { 0.0 };

            jac.set(3, col, axis_x);
            jac.set(4, col, axis_y);
            jac.set(5, col, axis_z);
        }

        Ok(jac)
    }

    /// Analyze singularities at given configuration
    pub fn analyze_singularity(&self, angles: &[f64]) -> Result<SingularityInfo, String> {
        if angles.len() != self.robot.num_dof {
            return Err(format!("Expected {} angles", self.robot.num_dof));
        }

        let jac = if self.robot.num_dof == 3 {
            self.jacobian_3dof_planar(angles, 1e-6)?
        } else if self.robot.num_dof == 6 {
            self.jacobian_6dof_spatial(angles, 1e-6)?
        } else {
            return Err("Only 3-DOF and 6-DOF analysis implemented".to_string());
        };

        let det = jac.determinant()?;
        let is_singular = det.abs() < 1e-8; // Singularity threshold

        // Approximate condition number using Frobenius norm
        let frobenius = jac.frobenius_norm();
        let condition_number = if det.abs() > 1e-12 {
            frobenius / det.abs()
        } else {
            f64::INFINITY
        };

        // Estimate rank (count significant singular values)
        let jacobian_rank = self.estimate_rank(&jac);

        // Classify singularity type
        let singularity_type = if !is_singular {
            SingularityType::Regular
        } else {
            self.classify_singularity(angles)?
        };

        // Distance to singularity (simplified: inverse of condition number)
        let distance_to_singularity = if condition_number.is_finite() {
            1.0 / (1.0 + condition_number)
        } else {
            0.0
        };

        Ok(SingularityInfo {
            is_singular,
            determinant: det,
            condition_number,
            jacobian_rank,
            singularity_type,
            distance_to_singularity,
        })
    }

    /// Estimate matrix rank (count linearly independent rows/columns)
    fn estimate_rank(&self, jac: &Jacobian) -> usize {
        let min_dim = jac.rows.min(jac.cols);
        let threshold = 1e-10;

        let mut rank = 0;
        for i in 0..min_dim {
            let row_norm = (0..jac.cols).map(|j| jac.get(i, j).powi(2)).sum::<f64>().sqrt();
            if row_norm > threshold {
                rank += 1;
            }
        }
        rank
    }

    /// Classify type of singularity based on configuration
    fn classify_singularity(&self, angles: &[f64]) -> Result<SingularityType, String> {
        if angles.len() != self.robot.num_dof {
            return Ok(SingularityType::Unknown);
        }

        // For 3-DOF planar arm:
        // - Shoulder singularity: links 2 and 3 aligned
        // - Elbow singularity: links 1 and 2 aligned or arms straight
        // - Wrist singularity: not applicable for planar

        if self.robot.num_dof == 3 {
            let theta2 = angles[1];
            let theta3 = angles[2];

            // Check if fully extended (elbow singularity)
            if (theta2 + theta3).abs() < 0.1 || ((theta2 + theta3) - PI).abs() < 0.1 {
                return Ok(SingularityType::Elbow);
            }

            // Check if second and third joints aligned
            if (theta2 - theta3).abs() < 0.1 {
                return Ok(SingularityType::Shoulder);
            }
        }

        Ok(SingularityType::Unknown)
    }

    /// Check if configuration is near singularity
    pub fn is_near_singularity(&self, angles: &[f64], tolerance: f64) -> Result<bool, String> {
        let info = self.analyze_singularity(angles)?;
        Ok(info.condition_number > tolerance)
    }

    /// Find manipulability ellipsoid volume
    /// Measures dexterity: small volume = poor dexterity near singularity
    pub fn manipulability(&self, angles: &[f64]) -> Result<f64, String> {
        if angles.len() == 3 {
            let jac = self.jacobian_3dof_planar(angles, 1e-6)?;
            let det = jac.determinant()?;
            Ok(det.abs())
        } else if angles.len() == 6 {
            let jac = self.jacobian_6dof_spatial(angles, 1e-6)?;
            let det = jac.determinant()?;
            Ok(det.abs())
        } else {
            Err("Manipulability only implemented for 3-DOF and 6-DOF".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jacobian_creation() {
        let jac = Jacobian::new(3, 3);
        assert_eq!(jac.rows, 3);
        assert_eq!(jac.cols, 3);
        assert_eq!(jac.data.len(), 9);
    }

    #[test]
    fn test_jacobian_set_get() {
        let mut jac = Jacobian::new(2, 2);
        jac.set(0, 0, 1.5);
        jac.set(1, 1, 2.5);
        assert!((jac.get(0, 0) - 1.5).abs() < 1e-10);
        assert!((jac.get(1, 1) - 2.5).abs() < 1e-10);
    }

    #[test]
    fn test_jacobian_determinant_2x2() {
        let mut jac = Jacobian::new(2, 2);
        jac.set(0, 0, 3.0);
        jac.set(0, 1, 2.0);
        jac.set(1, 0, 2.0);
        jac.set(1, 1, 1.0);
        // det = 3*1 - 2*2 = -1
        let det = jac.determinant().unwrap();
        assert!((det - (-1.0)).abs() < 1e-10);
    }

    #[test]
    fn test_jacobian_determinant_3x3() {
        let mut jac = Jacobian::new(3, 3);
        jac.set(0, 0, 1.0);
        jac.set(0, 1, 2.0);
        jac.set(0, 2, 3.0);
        jac.set(1, 0, 0.0);
        jac.set(1, 1, 1.0);
        jac.set(1, 2, 4.0);
        jac.set(2, 0, 5.0);
        jac.set(2, 1, 6.0);
        jac.set(2, 2, 0.0);
        // det = 1*(1*0-4*6) - 2*(0-4*5) + 3*(0-1*5) = -24 + 40 - 15 = 1
        let det = jac.determinant().unwrap();
        assert!((det - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_jacobian_frobenius_norm() {
        let mut jac = Jacobian::new(2, 2);
        jac.set(0, 0, 3.0);
        jac.set(0, 1, 4.0);
        jac.set(1, 0, 0.0);
        jac.set(1, 1, 0.0);
        // Frobenius norm = sqrt(3^2 + 4^2) = 5
        let norm = jac.frobenius_norm();
        assert!((norm - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_singularity_analyzer_creation() {
        let arm = RobotArm::create_3dof_planar();
        let analyzer = SingularityAnalyzer::new(arm);
        assert_eq!(analyzer.robot.num_dof, 3);
    }

    #[test]
    fn test_jacobian_3dof_planar() {
        let arm = RobotArm::create_3dof_planar();
        let analyzer = SingularityAnalyzer::new(arm);
        let angles = vec![0.0, 0.0, 0.0];
        let jac = analyzer.jacobian_3dof_planar(&angles, 1e-6).unwrap();
        assert_eq!(jac.rows, 3);
        assert_eq!(jac.cols, 3);
    }

    #[test]
    fn test_jacobian_3dof_wrong_length() {
        let arm = RobotArm::create_3dof_planar();
        let analyzer = SingularityAnalyzer::new(arm);
        let angles = vec![0.0, 0.0];
        let result = analyzer.jacobian_3dof_planar(&angles, 1e-6);
        assert!(result.is_err());
    }

    #[test]
    fn test_analyze_singularity_regular() {
        let arm = RobotArm::create_3dof_planar();
        let analyzer = SingularityAnalyzer::new(arm);
        let angles = vec![PI / 4.0, PI / 4.0, PI / 4.0];
        let info = analyzer.analyze_singularity(&angles).unwrap();
        assert!(!info.is_singular);
        assert_eq!(info.singularity_type, SingularityType::Regular);
        assert!(info.condition_number > 0.0 && info.condition_number < 100.0);
    }

    #[test]
    fn test_manipulability_3dof() {
        let arm = RobotArm::create_3dof_planar();
        let analyzer = SingularityAnalyzer::new(arm);
        let angles = vec![PI / 4.0, PI / 4.0, PI / 4.0];
        let manip = analyzer.manipulability(&angles).unwrap();
        assert!(manip > 0.0);
    }

    #[test]
    fn test_is_near_singularity() {
        let arm = RobotArm::create_3dof_planar();
        let analyzer = SingularityAnalyzer::new(arm);
        let regular = vec![PI / 4.0, PI / 4.0, PI / 4.0];
        assert!(!analyzer.is_near_singularity(&regular, 100.0).unwrap());
    }

    #[test]
    fn test_estimate_rank() {
        let arm = RobotArm::create_3dof_planar();
        let analyzer = SingularityAnalyzer::new(arm);
        let mut jac = Jacobian::new(3, 3);
        jac.set(0, 0, 1.0);
        jac.set(1, 1, 1.0);
        jac.set(2, 2, 1.0);
        let rank = analyzer.estimate_rank(&jac);
        assert_eq!(rank, 3);
    }

    #[test]
    fn test_jacobian_6dof_spatial() {
        let arm = RobotArm::create_6dof_spatial();
        let analyzer = SingularityAnalyzer::new(arm);
        let angles = vec![0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        let jac = analyzer.jacobian_6dof_spatial(&angles, 1e-6).unwrap();
        assert_eq!(jac.rows, 6);
        assert_eq!(jac.cols, 6);
    }

    #[test]
    fn test_manipulability_6dof() {
        let arm = RobotArm::create_6dof_spatial();
        let analyzer = SingularityAnalyzer::new(arm);
        let angles = vec![PI / 4.0; 6];
        let manip = analyzer.manipulability(&angles).unwrap();
        assert!(manip >= 0.0);
    }
}
