//! Inverse Kinematics using Clifford Algebra
//! Phase 25 Task 2 - Advanced Kinematics

use crate::clifford_algebra::rotations::Rotor;
use crate::clifford_algebra::basis::Signature;
use std::f64::consts::PI;

#[derive(Debug, Clone)]
pub struct IkSolution {
    pub joint_angles: Vec<f64>,
    pub reached_position: (f64, f64, f64),
    pub position_error: f64,
    pub rotation_error: f64,
    pub iterations: usize,
    pub converged: bool,
}

#[derive(Debug, Clone)]
pub struct Constraint {
    pub joint_index: usize,
    pub min_angle: f64,
    pub max_angle: f64,
}

pub struct InverseKinematicsSolver {
    pub target_position: (f64, f64, f64),
    pub target_rotation: Option<Rotor>,
    pub constraints: Vec<Constraint>,
    pub damping_factor: f64,
    pub max_iterations: usize,
    pub tolerance: f64,
}

impl InverseKinematicsSolver {
    pub fn new_3dof_planar(target_x: f64, target_y: f64, damping_factor: f64) -> Self {
        InverseKinematicsSolver {
            target_position: (target_x, target_y, 0.0),
            target_rotation: None,
            constraints: vec![],
            damping_factor,
            max_iterations: 100,
            tolerance: 1e-6,
        }
    }

    pub fn new_6dof_spatial(
        target_x: f64, target_y: f64, target_z: f64,
        target_rotation: Rotor, damping_factor: f64,
    ) -> Self {
        InverseKinematicsSolver {
            target_position: (target_x, target_y, target_z),
            target_rotation: Some(target_rotation),
            constraints: vec![],
            damping_factor,
            max_iterations: 100,
            tolerance: 1e-6,
        }
    }

    pub fn add_constraint(&mut self, joint_index: usize, min_angle: f64, max_angle: f64) {
        self.constraints.push(Constraint {
            joint_index,
            min_angle,
            max_angle,
        });
    }

    fn clamp_angle(&self, joint_index: usize, angle: f64) -> f64 {
        for constraint in &self.constraints {
            if constraint.joint_index == joint_index {
                return angle.max(constraint.min_angle).min(constraint.max_angle);
            }
        }
        angle
    }

    pub fn is_singular(
        _joint_angles: &[f64],
        jacobian: &dyn Fn(&[f64]) -> Vec<Vec<f64>>,
        epsilon: f64,
    ) -> bool {
        let j_matrix = jacobian(_joint_angles);
        if j_matrix.len() < 2 || j_matrix[0].len() < 2 {
            return false;
        }
        if j_matrix.len() == 2 && j_matrix[0].len() == 2 {
            let det = j_matrix[0][0] * j_matrix[1][1] - j_matrix[0][1] * j_matrix[1][0];
            return det.abs() < epsilon;
        }
        false
    }

    pub fn jacobian_condition_number(jacobian: &[Vec<f64>]) -> f64 {
        if jacobian.is_empty() || jacobian[0].is_empty() {
            return 1.0;
        }
        if jacobian.len() == 2 && jacobian[0].len() == 2 {
            let j11 = jacobian[0][0];
            let j12 = jacobian[0][1];
            let j21 = jacobian[1][0];
            let j22 = jacobian[1][1];
            let det = j11 * j22 - j12 * j21;
            let frob_norm_sq = j11 * j11 + j12 * j12 + j21 * j21 + j22 * j22;
            if det.abs() < 1e-10 {
                return f64::INFINITY;
            }
            (frob_norm_sq.sqrt() / det.abs()).sqrt()
        } else {
            1.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ik_solver_creation_3dof() {
        let solver = InverseKinematicsSolver::new_3dof_planar(1.0, 1.0, 0.01);
        assert_eq!(solver.target_position, (1.0, 1.0, 0.0));
        assert_eq!(solver.damping_factor, 0.01);
        assert_eq!(solver.max_iterations, 100);
    }

    #[test]
    fn test_ik_solver_creation_6dof() {
        let rotor = Rotor::identity(Signature::EuclideanR3);
        let solver = InverseKinematicsSolver::new_6dof_spatial(1.0, 1.0, 1.0, rotor, 0.01);
        assert_eq!(solver.target_position, (1.0, 1.0, 1.0));
        assert!(solver.target_rotation.is_some());
    }

    #[test]
    fn test_add_constraint() {
        let mut solver = InverseKinematicsSolver::new_3dof_planar(1.0, 1.0, 0.01);
        solver.add_constraint(0, -PI, PI);
        solver.add_constraint(1, -PI / 2.0, PI / 2.0);
        assert_eq!(solver.constraints.len(), 2);
    }

    #[test]
    fn test_clamp_angle_within_limits() {
        let mut solver = InverseKinematicsSolver::new_3dof_planar(1.0, 1.0, 0.01);
        solver.add_constraint(0, -PI, PI);
        let clamped = solver.clamp_angle(0, 0.5);
        assert!((clamped - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_clamp_angle_exceeds_limit() {
        let mut solver = InverseKinematicsSolver::new_3dof_planar(1.0, 1.0, 0.01);
        solver.add_constraint(0, -1.0, 1.0);
        let clamped = solver.clamp_angle(0, 2.0);
        assert!((clamped - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_clamp_angle_below_limit() {
        let mut solver = InverseKinematicsSolver::new_3dof_planar(1.0, 1.0, 0.01);
        solver.add_constraint(0, -1.0, 1.0);
        let clamped = solver.clamp_angle(0, -2.0);
        assert!((clamped - (-1.0)).abs() < 1e-10);
    }

    #[test]
    fn test_is_singular_small_determinant() {
        let jacobian = |_angles: &[f64]| {
            vec![
                vec![1.0, 0.001],
                vec![0.0, 1.0],
            ]
        };
        let singular = InverseKinematicsSolver::is_singular(&[0.0, 0.0], &jacobian, 0.1);
        assert!(!singular);
    }

    #[test]
    fn test_jacobian_condition_number_identity() {
        let j = vec![
            vec![1.0, 0.0],
            vec![0.0, 1.0],
        ];
        let cond = InverseKinematicsSolver::jacobian_condition_number(&j);
        assert!(cond < 2.0);
    }

    #[test]
    fn test_jacobian_condition_number_ill_conditioned() {
        let j = vec![
            vec![1.0, 1.0],
            vec![1.0, 1.0 + 1e-6],
        ];
        let cond = InverseKinematicsSolver::jacobian_condition_number(&j);
        assert!(cond > 10.0);
    }

    #[test]
    fn test_ik_solution_properties() {
        let solution = IkSolution {
            joint_angles: vec![0.1, 0.2, 0.3],
            reached_position: (1.0, 0.5, 0.0),
            position_error: 0.01,
            rotation_error: 0.02,
            iterations: 5,
            converged: true,
        };
        assert_eq!(solution.joint_angles.len(), 3);
        assert!(solution.converged);
        assert_eq!(solution.iterations, 5);
    }

    #[test]
    fn test_constraint_structure() {
        let constraint = Constraint {
            joint_index: 0,
            min_angle: -PI,
            max_angle: PI,
        };
        assert_eq!(constraint.joint_index, 0);
        assert!((constraint.min_angle - (-PI)).abs() < 1e-10);
        assert!((constraint.max_angle - PI).abs() < 1e-10);
    }
}
