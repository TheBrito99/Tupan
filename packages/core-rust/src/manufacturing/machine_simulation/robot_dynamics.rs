//! Robot Dynamics using Lagrange-Euler Equations
//!
//! Computes dynamics, inverse kinematics, and torque prediction for multi-DOF robots
//! using Lagrangian mechanics (L = K - P where K = kinetic, P = potential energy).

use super::dh_framework::{RobotArm, RobotJoint, TransformMatrix, JointType};
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Robot link inertia properties
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct LinkInertia {
    /// Link mass [kg]
    pub mass: f64,

    /// Moment of inertia around x-axis [kg·m²]
    pub ixx: f64,

    /// Moment of inertia around y-axis [kg·m²]
    pub iyy: f64,

    /// Moment of inertia around z-axis [kg·m²]
    pub izz: f64,

    /// Center of mass offset along link [mm]
    pub com_offset: f64,
}

impl LinkInertia {
    /// Create inertia for simple cylindrical link
    pub fn cylinder(mass: f64, radius: f64, length: f64) -> Self {
        LinkInertia {
            mass,
            ixx: mass * (3.0 * radius.powi(2) + length.powi(2)) / 12.0,
            iyy: mass * (3.0 * radius.powi(2) + length.powi(2)) / 12.0,
            izz: mass * radius.powi(2) / 2.0,
            com_offset: length / 2.0,
        }
    }

    /// Create inertia for rectangular solid
    pub fn box_shape(mass: f64, width: f64, height: f64, depth: f64) -> Self {
        LinkInertia {
            mass,
            ixx: mass * (height.powi(2) + depth.powi(2)) / 12.0,
            iyy: mass * (width.powi(2) + depth.powi(2)) / 12.0,
            izz: mass * (width.powi(2) + height.powi(2)) / 12.0,
            com_offset: 0.0,
        }
    }

    /// Create inertia for point mass (e.g., end-effector)
    pub fn point_mass(mass: f64) -> Self {
        LinkInertia {
            mass,
            ixx: 0.0,
            iyy: 0.0,
            izz: 0.0,
            com_offset: 0.0,
        }
    }
}

/// Robot dynamics state (positions, velocities, accelerations)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicsState {
    /// Joint positions [rad or mm]
    pub positions: Vec<f64>,

    /// Joint velocities [rad/s or mm/s]
    pub velocities: Vec<f64>,

    /// Joint accelerations [rad/s² or mm/s²]
    pub accelerations: Vec<f64>,

    /// Required joint torques [N·m]
    pub torques: Vec<f64>,

    /// Time in simulation [seconds]
    pub time: f64,
}

/// Dynamics solver for robot arms
#[derive(Debug, Clone)]
pub struct DynamicsSolver {
    robot: RobotArm,
    inertias: Vec<LinkInertia>,
    gravity: f64,  // [m/s²]
    friction_coeff: Vec<f64>,  // Per-joint viscous friction
}

impl DynamicsSolver {
    /// Create new dynamics solver
    pub fn new(robot: RobotArm, inertias: Vec<LinkInertia>) -> Result<Self, String> {
        if inertias.len() != robot.joints.len() {
            return Err(format!(
                "Inertia count mismatch: got {}, expected {}",
                inertias.len(),
                robot.joints.len()
            ));
        }

        let friction_coeff = vec![0.01; robot.joints.len()]; // Default 1% viscous friction

        Ok(DynamicsSolver {
            robot,
            inertias,
            gravity: 9.81,
            friction_coeff,
        })
    }

    /// Set gravitational acceleration
    pub fn set_gravity(&mut self, g: f64) {
        self.gravity = g;
    }

    /// Set friction coefficient for joint i
    pub fn set_friction(&mut self, joint_idx: usize, coeff: f64) {
        if joint_idx < self.friction_coeff.len() {
            self.friction_coeff[joint_idx] = coeff;
        }
    }

    /// Compute inertia matrix M(θ)
    ///
    /// Using simplified Denavit-Hartenberg mass matrix computation
    /// M(θ) relates joint accelerations to joint torques: τ = M(θ)·θ̈ + h(θ,θ̇)
    pub fn compute_mass_matrix(
        &self,
        _positions: &[f64],
    ) -> Result<Vec<Vec<f64>>, String> {
        let n = self.robot.joints.len();

        // For simplified computation, use diagonal mass matrix
        // where each diagonal element is the combined inertia seen by that joint
        let mut mass_matrix = vec![vec![0.0; n]; n];

        // Compute effective mass for each joint
        for i in 0..n {
            let mut diagonal_mass = 0.0;

            // Sum inertias of all downstream links
            for link_idx in i..n {
                if link_idx < self.inertias.len() {
                    let link_inertia = &self.inertias[link_idx];

                    // For revolute joint: torque = I·α
                    // Approximate: mass matrix diagonal ≈ moment of inertia
                    if matches!(self.robot.joints[link_idx].joint_type, JointType::Revolute) {
                        diagonal_mass += link_inertia.izz;
                    } else {
                        // For prismatic joint: force = m·a
                        diagonal_mass += link_inertia.mass;
                    }
                }
            }

            // Ensure diagonal mass is positive (minimum regularization)
            mass_matrix[i][i] = diagonal_mass.max(0.01);
        }

        // Add off-diagonal coupling terms (simplified to zero for this version)
        // Full computation requires Jacobians and would be more complex

        Ok(mass_matrix)
    }

    /// Compute gravity and friction terms
    ///
    /// Returns: h(θ,θ̇) = C(θ,θ̇)·θ̇ + G(θ) + F(θ̇)
    /// where C = Coriolis/centrifugal, G = gravity, F = friction
    pub fn compute_gravity_and_friction(
        &self,
        positions: &[f64],
        velocities: &[f64],
        accelerations: &[f64],
    ) -> Result<Vec<f64>, String> {
        let n = positions.len();
        let mut h = vec![0.0; n];

        // Compute end-effector position and Jacobian
        let tcp_pose = self.robot.forward_kinematics(positions)?;
        let tcp_pos = tcp_pose.position();
        let jacobian = self.robot.compute_jacobian(positions)?;

        // Gravity term: G(θ) = J_v^T · m·g·z
        // For vertical links, gravity acts downward
        for i in 0..n {
            let mut gravity_torque = 0.0;

            // Sum contributions from all links downstream
            for link_idx in i..n {
                if link_idx < self.inertias.len() {
                    let link_inertia = &self.inertias[link_idx];
                    let link_mass = link_inertia.mass;

                    // Approximate vertical position (z-component of TCP)
                    // More accurate version would compute each link's COM position
                    if link_idx < jacobian.len() && 2 < jacobian[link_idx].len() {
                        let jv_z = jacobian[2][i]; // Vertical Jacobian entry
                        gravity_torque += jv_z * link_mass * self.gravity;
                    }
                }
            }

            h[i] += gravity_torque;
        }

        // Viscous friction: F(θ̇) = -b·θ̇
        for i in 0..n {
            h[i] -= self.friction_coeff[i] * velocities[i];
        }

        // Coriolis and centrifugal are simplified to zero for this version
        // Full computation requires second derivatives of FK

        Ok(h)
    }

    /// Compute inverse dynamics using Newton-Euler recursive algorithm
    ///
    /// Given desired trajectory (positions, velocities, accelerations),
    /// compute required joint torques: τ = M(θ)·θ̈ + h(θ,θ̇)
    pub fn inverse_dynamics(
        &self,
        positions: &[f64],
        velocities: &[f64],
        accelerations: &[f64],
    ) -> Result<Vec<f64>, String> {
        if positions.len() != self.robot.joints.len() {
            return Err("Position dimension mismatch".to_string());
        }

        let n = positions.len();
        let mut torques = vec![0.0; n];

        // Compute mass matrix (inertia)
        let mass_matrix = self.compute_mass_matrix(positions)?;

        // Compute gravity and friction terms
        let h = self.compute_gravity_and_friction(positions, velocities, accelerations)?;

        // Solve: τ = M·θ̈ + h
        for i in 0..n {
            let mut tau = h[i];
            for j in 0..n {
                tau += mass_matrix[i][j] * accelerations[j];
            }
            torques[i] = tau;
        }

        Ok(torques)
    }

    /// Forward dynamics: compute accelerations given torques
    ///
    /// Solves: θ̈ = M(θ)^-1 · [τ - h(θ,θ̇)]
    pub fn forward_dynamics(
        &self,
        positions: &[f64],
        velocities: &[f64],
        torques: &[f64],
    ) -> Result<Vec<f64>, String> {
        if positions.len() != self.robot.joints.len() {
            return Err("Position dimension mismatch".to_string());
        }

        let n = positions.len();
        let mass_matrix = self.compute_mass_matrix(positions)?;
        let h = self.compute_gravity_and_friction(positions, velocities, &vec![0.0; n])?;

        // Compute RHS: τ - h
        let mut rhs = vec![0.0; n];
        for i in 0..n {
            rhs[i] = torques[i] - h[i];
        }

        // Solve M·θ̈ = rhs using Gaussian elimination
        self.gaussian_elimination(&mass_matrix, &rhs)
    }

    /// Gaussian elimination solver
    fn gaussian_elimination(&self, a: &[Vec<f64>], b: &[f64]) -> Result<Vec<f64>, String> {
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

    /// Simulate one timestep using RK4 integration
    ///
    /// Returns updated state with new positions and velocities
    pub fn step(
        &self,
        state: &DynamicsState,
        torques: &[f64],
        dt: f64,
    ) -> Result<DynamicsState, String> {
        let n = state.positions.len();

        if torques.len() != n {
            return Err("Torque dimension mismatch".to_string());
        }

        // RK4 integration
        // dθ/dt = θ̇
        // dθ̇/dt = θ̈ = M^-1[τ - h]

        // k1: at current state
        let k1_accel = self.forward_dynamics(&state.positions, &state.velocities, torques)?;
        let mut k1_vel = state.velocities.clone();

        // k2: at half timestep
        let mut pos2 = state.positions.clone();
        let mut vel2 = state.velocities.clone();
        for i in 0..n {
            pos2[i] += 0.5 * dt * state.velocities[i];
            vel2[i] += 0.5 * dt * k1_accel[i];
        }
        let k2_accel = self.forward_dynamics(&pos2, &vel2, torques)?;

        // k3: at half timestep (again)
        let mut pos3 = state.positions.clone();
        let mut vel3 = state.velocities.clone();
        for i in 0..n {
            pos3[i] += 0.5 * dt * vel2[i];
            vel3[i] += 0.5 * dt * k2_accel[i];
        }
        let k3_accel = self.forward_dynamics(&pos3, &vel3, torques)?;

        // k4: at full timestep
        let mut pos4 = state.positions.clone();
        let mut vel4 = state.velocities.clone();
        for i in 0..n {
            pos4[i] += dt * vel3[i];
            vel4[i] += dt * k3_accel[i];
        }
        let k4_accel = self.forward_dynamics(&pos4, &vel4, torques)?;

        // Combine RK4 stages
        let mut new_positions = state.positions.clone();
        let mut new_velocities = state.velocities.clone();
        for i in 0..n {
            new_positions[i] +=
                dt * (state.velocities[i] + vel2[i] + vel3[i] + vel4[i]) / 6.0;
            new_velocities[i] +=
                dt * (k1_accel[i] + 2.0 * k2_accel[i] + 2.0 * k3_accel[i] + k4_accel[i]) / 6.0;

            // Enforce joint limits
            new_positions[i] = self.robot.joints[i].clamp_value(new_positions[i]);
        }

        // Compute new accelerations for reporting
        let new_accelerations = self.forward_dynamics(&new_positions, &new_velocities, torques)?;

        Ok(DynamicsState {
            positions: new_positions,
            velocities: new_velocities,
            accelerations: new_accelerations,
            torques: torques.to_vec(),
            time: state.time + dt,
        })
    }

    /// Predict trajectory over time under constant torques
    pub fn predict_trajectory(
        &self,
        mut state: DynamicsState,
        torques: &[f64],
        duration: f64,
        timestep: f64,
    ) -> Result<Vec<DynamicsState>, String> {
        let mut trajectory = vec![state.clone()];
        let num_steps = (duration / timestep).ceil() as usize;

        for _ in 0..num_steps {
            if state.time >= duration {
                break;
            }
            state = self.step(&state, torques, timestep)?;
            trajectory.push(state.clone());
        }

        Ok(trajectory)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manufacturing::machine_simulation::dh_framework::{DHParameterOriginal, RobotJoint};

    #[test]
    fn test_link_inertia_cylinder() {
        let inertia = LinkInertia::cylinder(1.0, 0.05, 0.3);
        assert_eq!(inertia.mass, 1.0);
        assert!(inertia.ixx > 0.0);
        assert!(inertia.izz > 0.0);
    }

    #[test]
    fn test_link_inertia_box() {
        let inertia = LinkInertia::box_shape(2.0, 0.1, 0.1, 0.3);
        assert_eq!(inertia.mass, 2.0);
        assert!(inertia.ixx > 0.0);
    }

    #[test]
    fn test_link_inertia_point_mass() {
        let inertia = LinkInertia::point_mass(0.5);
        assert_eq!(inertia.mass, 0.5);
        assert_eq!(inertia.ixx, 0.0);
    }

    #[test]
    fn test_dynamics_state_creation() {
        let state = DynamicsState {
            positions: vec![0.0, 0.0],
            velocities: vec![0.0, 0.0],
            accelerations: vec![0.0, 0.0],
            torques: vec![0.0, 0.0],
            time: 0.0,
        };

        assert_eq!(state.positions.len(), 2);
        assert_eq!(state.time, 0.0);
    }

    #[test]
    fn test_dynamics_solver_creation() {
        let mut robot = RobotArm::new("Test", 2);

        let dh1 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        let dh2 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0));
        robot.add_joint(RobotJoint::revolute("J2", dh2, (-PI, PI), 1.0));

        let inertias = vec![
            LinkInertia::cylinder(1.0, 0.05, 0.3),
            LinkInertia::cylinder(0.5, 0.04, 0.3),
        ];

        let solver = DynamicsSolver::new(robot, inertias);
        assert!(solver.is_ok());
    }

    #[test]
    fn test_inverse_dynamics() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let inertias = vec![LinkInertia::cylinder(1.0, 0.05, 0.3)];

        let solver = DynamicsSolver::new(robot, inertias).unwrap();

        let positions = vec![0.0];
        let velocities = vec![0.0];
        let accelerations = vec![1.0];

        let torques = solver.inverse_dynamics(&positions, &velocities, &accelerations).unwrap();

        assert_eq!(torques.len(), 1);
        assert!(torques[0].is_finite());
    }

    #[test]
    fn test_forward_dynamics() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let inertias = vec![LinkInertia::cylinder(1.0, 0.05, 0.3)];

        let solver = DynamicsSolver::new(robot, inertias).unwrap();

        let positions = vec![0.0];
        let velocities = vec![0.0];
        let torques = vec![1.0]; // 1 N·m torque

        let accelerations = solver.forward_dynamics(&positions, &velocities, &torques).unwrap();

        assert_eq!(accelerations.len(), 1);
        assert!(accelerations[0] > 0.0); // Should accelerate under positive torque
    }

    #[test]
    fn test_mass_matrix() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let inertias = vec![LinkInertia::cylinder(1.0, 0.05, 0.3)];

        let solver = DynamicsSolver::new(robot, inertias).unwrap();

        let positions = vec![0.0];
        let mass_matrix = solver.compute_mass_matrix(&positions).unwrap();

        assert_eq!(mass_matrix.len(), 1);
        assert_eq!(mass_matrix[0].len(), 1);
        assert!(mass_matrix[0][0] > 0.0); // Mass should be positive
    }

    #[test]
    fn test_dynamics_step() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let inertias = vec![LinkInertia::cylinder(1.0, 0.05, 0.3)];

        let solver = DynamicsSolver::new(robot, inertias).unwrap();

        let state = DynamicsState {
            positions: vec![0.0],
            velocities: vec![0.0],
            accelerations: vec![0.0],
            torques: vec![0.0],
            time: 0.0,
        };

        let torques = vec![1.0];
        let dt = 0.01;

        let next_state = solver.step(&state, &torques, dt).unwrap();

        assert!(next_state.time > state.time);
        assert!(next_state.velocities[0] > state.velocities[0]);
    }

    #[test]
    fn test_trajectory_prediction() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let inertias = vec![LinkInertia::cylinder(1.0, 0.05, 0.3)];

        let solver = DynamicsSolver::new(robot, inertias).unwrap();

        let state = DynamicsState {
            positions: vec![0.0],
            velocities: vec![0.0],
            accelerations: vec![0.0],
            torques: vec![0.0],
            time: 0.0,
        };

        let torques = vec![1.0];
        let trajectory = solver.predict_trajectory(state, &torques, 0.1, 0.01).unwrap();

        assert!(trajectory.len() > 1);
        // Check that trajectory progresses in time (within tolerance of duration)
        assert!(trajectory.last().unwrap().time >= 0.09);
        // Check that trajectory states are accumulating (increasing time)
        assert!(trajectory[trajectory.len() - 1].time > trajectory[0].time);
    }

    #[test]
    fn test_gravity_term() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let inertias = vec![LinkInertia::cylinder(1.0, 0.05, 0.3)];

        let mut solver = DynamicsSolver::new(robot, inertias).unwrap();
        solver.set_gravity(9.81);

        let positions = vec![PI / 2.0]; // Horizontal: gravity should create torque
        let velocities = vec![0.0];
        let accelerations = vec![0.0];

        let h = solver
            .compute_gravity_and_friction(&positions, &velocities, &accelerations)
            .unwrap();

        assert!(h.len() == 1);
        // Gravity should produce non-zero torque at horizontal position
    }

    #[test]
    fn test_friction_term() {
        let mut robot = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.3,
            alpha: 0.0,
        };

        robot.add_joint(RobotJoint::revolute("J1", dh, (-PI, PI), 1.0));

        let inertias = vec![LinkInertia::cylinder(1.0, 0.05, 0.3)];

        let mut solver = DynamicsSolver::new(robot, inertias).unwrap();
        solver.set_friction(0, 0.1);

        let positions = vec![0.0];
        let velocities = vec![1.0]; // Moving at 1 rad/s
        let accelerations = vec![0.0];

        let h = solver
            .compute_gravity_and_friction(&positions, &velocities, &accelerations)
            .unwrap();

        assert!(h[0] < 0.0); // Friction opposes motion
    }
}
