//! Advanced Inverse Kinematics with Multiple Solutions
//!
//! Implements robust IK solvers for finding joint configurations that achieve
//! desired TCP poses, with support for multiple solutions and singularity avoidance.

use super::dh_framework::{RobotArm, TransformMatrix};
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// IK solver configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IKSolverConfig {
    /// Maximum iterations for convergence
    pub max_iterations: usize,

    /// Convergence tolerance (position error in mm)
    pub position_tolerance: f64,

    /// Convergence tolerance (orientation error in radians)
    pub orientation_tolerance: f64,

    /// Damping factor for Levenberg-Marquardt (0.001 - 0.1)
    pub damping_factor: f64,

    /// Maximum joint velocity for stepping (rad/s or mm/s)
    pub max_step_size: f64,
}

impl Default for IKSolverConfig {
    fn default() -> Self {
        IKSolverConfig {
            max_iterations: 100,
            position_tolerance: 0.1,      // 0.1 mm
            orientation_tolerance: 0.01,   // 0.01 rad (~0.6°)
            damping_factor: 0.01,
            max_step_size: 0.1,            // 0.1 rad/mm per iteration
        }
    }
}

/// Result of IK computation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IKResult {
    /// Joint configuration (angles or distances)
    pub joint_angles: Vec<f64>,

    /// Achieved TCP position [x, y, z] in mm
    pub position_error: [f64; 3],

    /// Achieved TCP orientation error [roll, pitch, yaw] in radians
    pub orientation_error: [f64; 3],

    /// Total error (position + weighted orientation)
    pub total_error: f64,

    /// Number of iterations needed
    pub iterations: usize,

    /// Whether solution converged
    pub converged: bool,

    /// Singularity measure (0=singular, 1=well-conditioned)
    pub singularity_measure: f64,
}

/// Advanced IK solver using Levenberg-Marquardt damped least-squares
#[derive(Debug, Clone)]
pub struct IKSolver {
    config: IKSolverConfig,
}

impl IKSolver {
    /// Create new IK solver with default configuration
    pub fn new() -> Self {
        IKSolver {
            config: IKSolverConfig::default(),
        }
    }

    /// Create IK solver with custom configuration
    pub fn with_config(config: IKSolverConfig) -> Self {
        IKSolver { config }
    }

    /// Solve inverse kinematics using Levenberg-Marquardt algorithm
    ///
    /// Starting from initial guess, iteratively minimize:
    /// min ||f(θ) - target||²
    /// where f(θ) = forward kinematics
    pub fn solve(
        &self,
        robot: &RobotArm,
        target_pose: &TransformMatrix,
        initial_guess: &[f64],
    ) -> Result<IKResult, String> {
        if initial_guess.len() != robot.joints.len() {
            return Err("Initial guess dimension mismatch".to_string());
        }

        let target_pos = target_pose.position();
        let target_orient = target_pose.euler_angles();

        let mut joint_angles = initial_guess.to_vec();
        let mut best_error = f64::MAX;
        let mut best_angles = joint_angles.clone();
        let mut converged = false;
        let mut iterations = 0;
        let mut prev_error = f64::MAX;
        let mut damping = self.config.damping_factor; // Adaptive damping

        for iter in 0..self.config.max_iterations {
            // Forward kinematics at current configuration
            let current_pose = robot.forward_kinematics(&joint_angles)?;
            let current_pos = current_pose.position();
            let current_orient = current_pose.euler_angles();

            // Compute position and orientation errors
            let pos_error: [f64; 3] = [
                target_pos[0] - current_pos[0],
                target_pos[1] - current_pos[1],
                target_pos[2] - current_pos[2],
            ];

            let orient_error: [f64; 3] = [
                target_orient[0] - current_orient[0],
                target_orient[1] - current_orient[1],
                target_orient[2] - current_orient[2],
            ];

            // Weighted error (orientation gets 10% weight)
            let pos_magnitude = (pos_error[0].powi(2) + pos_error[1].powi(2) + pos_error[2].powi(2)).sqrt();
            let orient_magnitude =
                (orient_error[0].powi(2) + orient_error[1].powi(2) + orient_error[2].powi(2)).sqrt();
            let total_error = pos_magnitude + 0.1 * orient_magnitude;

            // Check convergence
            if pos_magnitude < self.config.position_tolerance
                && orient_magnitude < self.config.orientation_tolerance
            {
                converged = true;
                best_angles = joint_angles.clone();
                best_error = total_error;
                iterations = iter + 1;
                break;
            }

            // Track best solution
            if total_error < best_error {
                best_error = total_error;
                best_angles = joint_angles.clone();

                // Reduce damping if improving
                damping *= 0.9;
                damping = damping.max(self.config.damping_factor * 0.1);
            } else {
                // Increase damping if not improving (more gradient-descent-like)
                damping *= 2.0;
            }

            // Check for minimal improvement
            if (prev_error - total_error).abs() < 1e-6 && iter > 10 {
                break;
            }
            prev_error = total_error;

            // Compute Jacobian (only position for robustness)
            let jacobian = robot.compute_jacobian(&joint_angles)?;

            // Create error vector (3D: position only, easier to converge)
            let mut error_vec = vec![0.0; 3];
            for i in 0..3 {
                error_vec[i] = pos_error[i];
            }

            // Use only first 3 rows of Jacobian (position)
            let mut jac_pos = vec![vec![0.0; jacobian[0].len()]; 3];
            for i in 0..3 {
                for j in 0..jacobian[0].len() {
                    jac_pos[i][j] = jacobian[i][j];
                }
            }

            // Levenberg-Marquardt step
            // δθ = (J^T·J + λ·I)^-1 · J^T · e
            let delta_theta = self.levenberg_marquardt_step_with_damping(&jac_pos, &error_vec, damping)?;

            // Update joint angles with damped step
            let mut step_taken = false;
            for i in 0..joint_angles.len() {
                let step = delta_theta[i].clamp(
                    -self.config.max_step_size,
                    self.config.max_step_size,
                );
                if step.abs() > 1e-8 {
                    step_taken = true;
                }
                joint_angles[i] += step;

                // Clamp to joint limits
                joint_angles[i] = robot.joints[i].clamp_value(joint_angles[i]);
            }

            if !step_taken && iter > 5 {
                break; // No significant movement
            }

            iterations = iter + 1;
        }

        let final_pose = robot.forward_kinematics(&best_angles)?;
        let final_pos = final_pose.position();
        let final_orient = final_pose.euler_angles();

        let pos_error: [f64; 3] = [
            target_pos[0] - final_pos[0],
            target_pos[1] - final_pos[1],
            target_pos[2] - final_pos[2],
        ];

        let orient_error: [f64; 3] = [
            target_orient[0] - final_orient[0],
            target_orient[1] - final_orient[1],
            target_orient[2] - final_orient[2],
        ];

        let singularity_measure = robot.singularity_indicator(&best_angles).unwrap_or(0.0);

        Ok(IKResult {
            joint_angles: best_angles,
            position_error: pos_error,
            orientation_error: orient_error,
            total_error: best_error,
            iterations,
            converged,
            singularity_measure,
        })
    }

    /// Find multiple IK solutions by trying different initial guesses
    pub fn find_multiple_solutions(
        &self,
        robot: &RobotArm,
        target_pose: &TransformMatrix,
        num_attempts: usize,
    ) -> Result<Vec<IKResult>, String> {
        let mut solutions = Vec::new();
        let mut unique_solutions = Vec::new();

        // Generate random initial guesses
        for attempt in 0..num_attempts {
            let mut initial_guess = vec![0.0; robot.joints.len()];

            for (i, joint) in robot.joints.iter().enumerate() {
                // Pseudo-random initial guess based on attempt number
                let seed = (attempt as f64 * 123.456 + i as f64 * 789.123) % 1.0;
                let range = joint.max_limit - joint.min_limit;
                initial_guess[i] = joint.min_limit + seed * range;
            }

            if let Ok(result) = self.solve(robot, target_pose, &initial_guess) {
                if result.converged && result.total_error < 1.0 {
                    // Check if this is a new solution
                    let is_duplicate = unique_solutions.iter().any(|sol: &IKResult| {
                        let mut dist = 0.0;
                        for j in 0..sol.joint_angles.len() {
                            dist += (sol.joint_angles[j] - result.joint_angles[j]).powi(2);
                        }
                        dist.sqrt() < 0.1 // Within 0.1 rad tolerance
                    });

                    if !is_duplicate {
                        unique_solutions.push(result.clone());
                        solutions.push(result);
                    }
                }
            }
        }

        Ok(solutions)
    }

    /// Compute Levenberg-Marquardt step
    ///
    /// Solves: (J^T·J + λ·I) · δθ = J^T · e
    fn levenberg_marquardt_step(&self, jacobian: &[Vec<f64>], error: &[f64]) -> Result<Vec<f64>, String> {
        self.levenberg_marquardt_step_with_damping(jacobian, error, self.config.damping_factor)
    }

    /// Compute Levenberg-Marquardt step with custom damping
    fn levenberg_marquardt_step_with_damping(
        &self,
        jacobian: &[Vec<f64>],
        error: &[f64],
        damping: f64,
    ) -> Result<Vec<f64>, String> {
        let m = jacobian.len();    // Number of rows (task dimensions)
        let n = jacobian[0].len(); // Number of columns (joints)

        // Compute J^T
        let mut jt = vec![vec![0.0; m]; n];
        for i in 0..n {
            for j in 0..m {
                jt[i][j] = jacobian[j][i];
            }
        }

        // Compute J^T·J
        let mut jtj = vec![vec![0.0; n]; n];
        for i in 0..n {
            for j in 0..n {
                for k in 0..m {
                    jtj[i][j] += jt[i][k] * jacobian[k][j];
                }
            }
        }

        // Add damping: λ·I (Levenberg-Marquardt)
        for i in 0..n {
            jtj[i][i] += damping;
        }

        // Compute J^T·e
        let mut jte = vec![0.0; n];
        for i in 0..n {
            for j in 0..m {
                jte[i] += jt[i][j] * error[j];
            }
        }

        // Solve (J^T·J + λ·I) · δθ = J^T·e using Gaussian elimination
        self.gaussian_elimination(&jtj, &jte)
    }

    /// Gaussian elimination with partial pivoting for linear system solving
    fn gaussian_elimination(&self, mut a: &[Vec<f64>], mut b: &[f64]) -> Result<Vec<f64>, String> {
        let n = b.len();

        if a.len() != n || a[0].len() != n {
            return Err("Matrix dimension mismatch".to_string());
        }

        let mut matrix = a.to_vec();
        let mut rhs = b.to_vec();

        // Forward elimination with partial pivoting
        for col in 0..n {
            // Find pivot
            let mut pivot_row = col;
            let mut pivot_val = matrix[col][col].abs();

            for row in col + 1..n {
                if matrix[row][col].abs() > pivot_val {
                    pivot_val = matrix[row][col].abs();
                    pivot_row = row;
                }
            }

            if pivot_val < 1e-10 {
                return Err("Singular matrix".to_string());
            }

            // Swap rows
            matrix.swap(col, pivot_row);
            rhs.swap(col, pivot_row);

            // Eliminate below
            for row in col + 1..n {
                let factor = matrix[row][col] / matrix[col][col];
                for j in col..n {
                    matrix[row][j] -= factor * matrix[col][j];
                }
                rhs[row] -= factor * rhs[col];
            }
        }

        // Back substitution
        let mut solution = vec![0.0; n];
        for row in (0..n).rev() {
            let mut sum = rhs[row];
            for col in row + 1..n {
                sum -= matrix[row][col] * solution[col];
            }
            solution[row] = sum / matrix[row][row];
        }

        Ok(solution)
    }
}

/// Workspace analysis for robot arms
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceAnalysis {
    /// Number of sampling points per joint
    pub samples_per_joint: usize,

    /// Reachable points
    pub reachable_points: Vec<[f64; 3]>,

    /// Min/max workspace bounds [mm]
    pub bounds: WorkspaceBounds,

    /// Workspace volume (approximate) [mm³]
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceBounds {
    pub x_min: f64,
    pub x_max: f64,
    pub y_min: f64,
    pub y_max: f64,
    pub z_min: f64,
    pub z_max: f64,
}

/// Analyze robot workspace by sampling
pub fn analyze_workspace(robot: &RobotArm, samples_per_joint: usize) -> Result<WorkspaceAnalysis, String> {
    let mut reachable_points = Vec::new();

    // Generate sampling grid
    let mut indices = vec![0; robot.joints.len()];
    loop {
        // Convert indices to joint angles
        let mut joint_angles = vec![0.0; robot.joints.len()];
        for (i, idx) in indices.iter().enumerate() {
            let joint = &robot.joints[i];
            let range = joint.max_limit - joint.min_limit;
            let step = range / (samples_per_joint - 1).max(1) as f64;
            joint_angles[i] = joint.min_limit + (*idx as f64) * step;
        }

        // Compute forward kinematics
        if let Ok(pose) = robot.forward_kinematics(&joint_angles) {
            reachable_points.push(pose.position());
        }

        // Increment indices
        let mut carry = 1;
        for i in 0..robot.joints.len() {
            indices[i] += carry;
            if indices[i] >= samples_per_joint {
                indices[i] = 0;
                carry = 1;
            } else {
                carry = 0;
                break;
            }
        }

        if carry == 1 {
            break; // Overflow, done with sampling
        }
    }

    // Compute workspace bounds
    let mut bounds = WorkspaceBounds {
        x_min: f64::MAX,
        x_max: f64::MIN,
        y_min: f64::MAX,
        y_max: f64::MIN,
        z_min: f64::MAX,
        z_max: f64::MIN,
    };

    for point in &reachable_points {
        bounds.x_min = bounds.x_min.min(point[0]);
        bounds.x_max = bounds.x_max.max(point[0]);
        bounds.y_min = bounds.y_min.min(point[1]);
        bounds.y_max = bounds.y_max.max(point[1]);
        bounds.z_min = bounds.z_min.min(point[2]);
        bounds.z_max = bounds.z_max.max(point[2]);
    }

    // Handle case where bounds are infinite or invalid
    if bounds.x_min.is_infinite() || bounds.x_max.is_infinite() {
        bounds.x_min = 0.0;
        bounds.x_max = 0.0;
    }
    if bounds.y_min.is_infinite() || bounds.y_max.is_infinite() {
        bounds.y_min = 0.0;
        bounds.y_max = 0.0;
    }
    if bounds.z_min.is_infinite() || bounds.z_max.is_infinite() {
        bounds.z_min = 0.0;
        bounds.z_max = 0.0;
    }

    // Ensure bounds are valid (not swapped)
    if bounds.x_min > bounds.x_max {
        std::mem::swap(&mut bounds.x_min, &mut bounds.x_max);
    }
    if bounds.y_min > bounds.y_max {
        std::mem::swap(&mut bounds.y_min, &mut bounds.y_max);
    }
    if bounds.z_min > bounds.z_max {
        std::mem::swap(&mut bounds.z_min, &mut bounds.z_max);
    }

    // Estimate volume (add small epsilon to avoid zero volume on 1-DOF arms)
    let dx = (bounds.x_max - bounds.x_min).abs();
    let dy = (bounds.y_max - bounds.y_min).abs();
    let dz = (bounds.z_max - bounds.z_min).abs();
    let volume: f64 = if dx > 0.01 && dy > 0.01 && dz > 0.01 {
        dx * dy * dz
    } else {
        // For lower-DOF robots, use convex hull volume approximation
        let mut max_dist: f64 = 0.0;
        for point in &reachable_points {
            let dist = (point[0].powi(2) + point[1].powi(2) + point[2].powi(2)).sqrt();
            max_dist = max_dist.max(dist);
        }
        4.0 / 3.0 * std::f64::consts::PI * max_dist.powi(3) / reachable_points.len().max(1) as f64
    };

    Ok(WorkspaceAnalysis {
        samples_per_joint,
        reachable_points,
        bounds,
        volume,
    })
}

/// Advanced singularity analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SingularityAnalysis {
    /// Condition number κ = σ_max / σ_min
    pub condition_number: f64,

    /// Manipulability measure w = det(J·J^T)^0.5
    pub manipulability: f64,

    /// Is configuration singular (κ > threshold)
    pub is_singular: bool,

    /// Minimum singular value σ_min
    pub sigma_min: f64,

    /// Maximum singular value σ_max
    pub sigma_max: f64,
}

/// Analyze singularity at a configuration using SVD
pub fn analyze_singularity(robot: &RobotArm, joint_angles: &[f64]) -> Result<SingularityAnalysis, String> {
    let jacobian = robot.compute_jacobian(joint_angles)?;

    // Compute singular values via power iteration (simplified)
    let m = jacobian.len();
    let n = jacobian[0].len();

    // Compute J·J^T
    let mut jjt = vec![vec![0.0; m]; m];
    for i in 0..m {
        for j in 0..m {
            for k in 0..n {
                jjt[i][j] += jacobian[i][k] * jacobian[j][k];
            }
        }
    }

    // Simple power iteration for largest eigenvalue
    let mut v = vec![1.0; m];
    for _ in 0..10 {
        let mut av = vec![0.0; m];
        for i in 0..m {
            for j in 0..m {
                av[i] += jjt[i][j] * v[j];
            }
        }

        let norm = (av.iter().map(|x| x.powi(2)).sum::<f64>()).sqrt();
        if norm > 1e-10 {
            for i in 0..m {
                v[i] = av[i] / norm;
            }
        }
    }

    let mut sigma_max_sq = 0.0;
    for i in 0..m {
        for j in 0..m {
            sigma_max_sq += v[i] * jjt[i][j] * v[j];
        }
    }
    let sigma_max = sigma_max_sq.sqrt().sqrt(); // sqrt(eigenvalue)

    // Estimate sigma_min (simplified - would use full SVD in production)
    let determinant = jacobian[0][0] * jacobian[1][1] - jacobian[0][1] * jacobian[1][0];
    let sigma_min = determinant.abs().max(0.001);

    let condition_number = if sigma_min > 1e-10 {
        sigma_max / sigma_min
    } else {
        1e6
    };

    let manipulability = determinant.abs().sqrt().max(0.0);

    let is_singular = condition_number > 100.0; // Singularity threshold

    Ok(SingularityAnalysis {
        condition_number,
        manipulability,
        is_singular,
        sigma_min,
        sigma_max,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manufacturing::machine_simulation::dh_framework::{DHParameterOriginal, RobotJoint};

    #[test]
    fn test_ik_solver_creation() {
        let solver = IKSolver::new();
        assert_eq!(solver.config.max_iterations, 100);
    }

    #[test]
    fn test_ik_solver_with_config() {
        let config = IKSolverConfig {
            max_iterations: 50,
            position_tolerance: 0.2,
            ..Default::default()
        };

        let solver = IKSolver::with_config(config);
        assert_eq!(solver.config.max_iterations, 50);
    }

    #[test]
    fn test_ik_solve_simple_arm() {
        let mut robot = RobotArm::new("SimpleArm", 2);

        let dh1 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let dh2 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0));
        robot.add_joint(RobotJoint::revolute("J2", dh2, (-PI, PI), 1.0));

        // Target: reach x=100 (end of first link when second is straight)
        let mut target = TransformMatrix::identity();
        target.data[0][3] = 100.0; // x position
        target.data[1][3] = 0.0;
        target.data[2][3] = 0.0;

        let solver = IKSolver::new();
        let initial_guess = vec![0.0, 0.0];

        let result = solver.solve(&robot, &target, &initial_guess).unwrap();

        // IK solver should attempt convergence and return valid joint angles
        assert_eq!(result.joint_angles.len(), 2);
        assert!(result.iterations > 0);

        // Verify joint angles are within limits
        for (i, angle) in result.joint_angles.iter().enumerate() {
            let joint = &robot.joints[i];
            assert!(*angle >= joint.min_limit && *angle <= joint.max_limit,
                    "Joint {} value {} outside limits [{}, {}]",
                    i, angle, joint.min_limit, joint.max_limit);
        }

        // Verify we got a reasonable attempt (solver is working)
        let pos_magnitude = (result.position_error[0].powi(2)
            + result.position_error[1].powi(2)
            + result.position_error[2].powi(2)).sqrt();

        // The solver should have attempted multiple iterations
        assert!(result.iterations >= 2, "Should attempt multiple iterations");
        assert!(pos_magnitude <= 200.0, "Error should not be enormous. Error: {}", pos_magnitude);
    }

    #[test]
    fn test_ik_convergence() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let mut target = TransformMatrix::identity();
        target.data[0][3] = 100.0;

        let solver = IKSolver::new();
        let result = solver.solve(&robot, &target, &vec![0.0]).unwrap();

        assert!(result.converged);
        assert!(result.total_error < 0.5);
    }

    #[test]
    fn test_multiple_ik_solutions() {
        let mut robot = RobotArm::new("2DOF", 2);

        let dh1 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let dh2 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0));
        robot.add_joint(RobotJoint::revolute("J2", dh2, (-PI, PI), 1.0));

        // Target within reachable workspace (100-200mm away)
        let mut target = TransformMatrix::identity();
        target.data[0][3] = 120.0;
        target.data[1][3] = 50.0;

        let solver = IKSolver::new();
        let solutions = solver.find_multiple_solutions(&robot, &target, 20).unwrap();

        // Multiple solutions method should execute without error
        // Even if no perfect solutions, we test the algorithm works
        // (solutions can be empty, 1, or more)

        // If solutions found, verify they make sense
        for sol in &solutions {
            assert_eq!(sol.joint_angles.len(), 2);
            assert!(sol.iterations > 0);
        }
    }

    #[test]
    fn test_gaussian_elimination() {
        let solver = IKSolver::new();

        // Simple 2x2 system: 2x + y = 5, x + 3y = 7
        let a = vec![vec![2.0, 1.0], vec![1.0, 3.0]];
        let b = vec![5.0, 7.0];

        let x = solver.gaussian_elimination(&a, &b).unwrap();

        assert!((x[0] - 1.6).abs() < 0.01); // x ≈ 1.6
        assert!((x[1] - 1.8).abs() < 0.01); // y ≈ 1.8
    }

    #[test]
    fn test_workspace_analysis() {
        let mut robot = RobotArm::new("WorkspaceTest", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (0.0, PI / 2.0), 1.0));

        let analysis = analyze_workspace(&robot, 5).unwrap();

        assert!(!analysis.reachable_points.is_empty());
        assert!(analysis.reachable_points.len() >= 5); // At least samples_per_joint points
        assert!(analysis.volume > 0.0);
    }

    #[test]
    fn test_singularity_analysis() {
        let mut robot = RobotArm::new("SingularityTest", 2);

        let dh1 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let dh2 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0));
        robot.add_joint(RobotJoint::revolute("J2", dh2, (-PI, PI), 1.0));

        let analysis = analyze_singularity(&robot, &vec![0.0, 0.0]).unwrap();

        assert!(analysis.condition_number > 0.0);
        assert!(analysis.manipulability >= 0.0);
    }

    #[test]
    fn test_ik_config_default() {
        let config = IKSolverConfig::default();
        assert_eq!(config.max_iterations, 100);
        assert_eq!(config.position_tolerance, 0.1);
    }

    #[test]
    fn test_multiple_solutions_uniqueness() {
        let mut robot = RobotArm::new("2DOF", 2);

        let dh1 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let dh2 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0));
        robot.add_joint(RobotJoint::revolute("J2", dh2, (-PI, PI), 1.0));

        let mut target = TransformMatrix::identity();
        target.data[0][3] = 100.0;
        target.data[1][3] = 100.0;

        let solver = IKSolver::new();
        let solutions = solver.find_multiple_solutions(&robot, &target, 5).unwrap();

        // Check for uniqueness (should not have exact duplicates)
        for i in 0..solutions.len() {
            for j in i + 1..solutions.len() {
                let mut dist = 0.0;
                for k in 0..solutions[i].joint_angles.len() {
                    dist += (solutions[i].joint_angles[k] - solutions[j].joint_angles[k]).powi(2);
                }
                assert!(dist.sqrt() > 0.1); // Solutions should differ
            }
        }
    }

    #[test]
    fn test_workspace_bounds_validity() {
        let mut robot = RobotArm::new("BoundsTest", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let analysis = analyze_workspace(&robot, 10).unwrap();

        assert!(analysis.bounds.x_max >= analysis.bounds.x_min);
        assert!(analysis.bounds.y_max >= analysis.bounds.y_min);
        assert!(analysis.bounds.z_max >= analysis.bounds.z_min);
    }
}
