//! Force/Torque Control: Impedance and Hybrid Control
//! Phase 26 Task 3 - Force Control for Robot Manipulation

use crate::clifford_algebra::spatialization::Point3D;
use std::f64::consts::PI;

/// Impedance control parameters (stiffness, damping, inertia)
#[derive(Debug, Clone)]
pub struct ImpedanceParameters {
    pub stiffness: f64,        // K: Spring stiffness (N/m)
    pub damping: f64,          // B: Damping coefficient (N·s/m)
    pub inertia: f64,          // M: Virtual mass (kg)
}

impl ImpedanceParameters {
    /// Create new impedance parameters
    pub fn new(stiffness: f64, damping: f64, inertia: f64) -> Self {
        ImpedanceParameters {
            stiffness,
            damping,
            inertia,
        }
    }

    /// Soft contact (low stiffness, high damping)
    pub fn soft_contact() -> Self {
        ImpedanceParameters {
            stiffness: 100.0,   // Low stiffness for soft contact
            damping: 50.0,      // High damping for stability
            inertia: 1.0,
        }
    }

    /// Stiff positioning (high stiffness, low damping)
    pub fn stiff_positioning() -> Self {
        ImpedanceParameters {
            stiffness: 1000.0,  // High stiffness for precise positioning
            damping: 100.0,
            inertia: 2.0,
        }
    }

    /// Compliant assembly (medium stiffness, medium damping)
    pub fn compliant_assembly() -> Self {
        ImpedanceParameters {
            stiffness: 500.0,
            damping: 150.0,
            inertia: 1.5,
        }
    }
}

/// Impedance controller for robot end-effector
pub struct ImpedanceController {
    parameters: ImpedanceParameters,
    desired_position: Point3D,
    desired_velocity: (f64, f64, f64),
    current_position: Point3D,
    current_velocity: (f64, f64, f64),
    measured_force: (f64, f64, f64),
}

impl ImpedanceController {
    /// Create new impedance controller
    pub fn new(parameters: ImpedanceParameters, desired_position: Point3D) -> Self {
        ImpedanceController {
            parameters,
            desired_position,
            desired_velocity: (0.0, 0.0, 0.0),
            current_position: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            current_velocity: (0.0, 0.0, 0.0),
            measured_force: (0.0, 0.0, 0.0),
        }
    }

    /// Update current state
    pub fn update_state(
        &mut self,
        position: Point3D,
        velocity: (f64, f64, f64),
        force: (f64, f64, f64),
    ) {
        self.current_position = position;
        self.current_velocity = velocity;
        self.measured_force = force;
    }

    /// Compute desired force using impedance law: F = K*(xd-x) + B*(vd-v) - Fe
    pub fn compute_desired_force(&self) -> (f64, f64, f64) {
        // Position error
        let error_x = self.desired_position.x - self.current_position.x;
        let error_y = self.desired_position.y - self.current_position.y;
        let error_z = self.desired_position.z - self.current_position.z;

        // Velocity error
        let vel_error_x = self.desired_velocity.0 - self.current_velocity.0;
        let vel_error_y = self.desired_velocity.1 - self.current_velocity.1;
        let vel_error_z = self.desired_velocity.2 - self.current_velocity.2;

        // Impedance law: F_desired = K*x_error + B*v_error - F_measured
        let fx = self.parameters.stiffness * error_x
            + self.parameters.damping * vel_error_x
            - self.measured_force.0;
        let fy = self.parameters.stiffness * error_y
            + self.parameters.damping * vel_error_y
            - self.measured_force.1;
        let fz = self.parameters.stiffness * error_z
            + self.parameters.damping * vel_error_z
            - self.measured_force.2;

        (fx, fy, fz)
    }

    /// Compute desired acceleration using impedance dynamics
    pub fn compute_desired_acceleration(&self) -> (f64, f64, f64) {
        let (fx, fy, fz) = self.compute_desired_force();

        // a = F / M (virtual acceleration)
        (
            fx / self.parameters.inertia,
            fy / self.parameters.inertia,
            fz / self.parameters.inertia,
        )
    }

    /// Set desired position
    pub fn set_desired_position(&mut self, position: Point3D) {
        self.desired_position = position;
    }

    /// Set desired velocity
    pub fn set_desired_velocity(&mut self, velocity: (f64, f64, f64)) {
        self.desired_velocity = velocity;
    }

    /// Check if force is within acceptable range
    pub fn is_force_within_limits(&self, force_limit: f64) -> bool {
        let (fx, fy, fz) = self.measured_force;
        let force_magnitude = (fx * fx + fy * fy + fz * fz).sqrt();
        force_magnitude < force_limit
    }

    /// Compute compliance (inverse of stiffness)
    pub fn compute_compliance(&self) -> f64 {
        1.0 / self.parameters.stiffness.max(1.0)
    }
}

/// Hybrid force/position controller
pub struct HybridForcePositionController {
    force_components: (bool, bool, bool),  // Which axes are force-controlled
    impedance: ImpedanceController,
    force_targets: (f64, f64, f64),        // Target forces
    position_targets: Point3D,              // Target positions
}

impl HybridForcePositionController {
    /// Create new hybrid controller
    /// force_components: (x_force, y_force, z_force) - true means force control, false means position control
    pub fn new(
        force_components: (bool, bool, bool),
        impedance: ImpedanceController,
    ) -> Self {
        HybridForcePositionController {
            force_components,
            impedance,
            force_targets: (0.0, 0.0, 0.0),
            position_targets: Point3D { x: 0.0, y: 0.0, z: 0.0 },
        }
    }

    /// Set target forces for force-controlled axes
    pub fn set_force_targets(&mut self, forces: (f64, f64, f64)) {
        self.force_targets = forces;
    }

    /// Set target positions for position-controlled axes
    pub fn set_position_targets(&mut self, position: Point3D) {
        self.position_targets = position;
    }

    /// Compute hybrid command
    pub fn compute_command(
        &mut self,
        current_position: Point3D,
        current_velocity: (f64, f64, f64),
        measured_force: (f64, f64, f64),
    ) -> (f64, f64, f64) {
        self.impedance.update_state(current_position, current_velocity, measured_force);

        let mut command = self.impedance.compute_desired_force();

        // Override force-controlled axes with force targets
        if self.force_components.0 {
            command.0 = self.force_targets.0 - measured_force.0;
        } else {
            // Position control on this axis
            self.impedance.set_desired_position(self.position_targets);
            command.0 = self.impedance.compute_desired_force().0;
        }

        if self.force_components.1 {
            command.1 = self.force_targets.1 - measured_force.1;
        } else {
            self.impedance.set_desired_position(self.position_targets);
            command.1 = self.impedance.compute_desired_force().1;
        }

        if self.force_components.2 {
            command.2 = self.force_targets.2 - measured_force.2;
        } else {
            self.impedance.set_desired_position(self.position_targets);
            command.2 = self.impedance.compute_desired_force().2;
        }

        command
    }

    /// Check if assembly is successful (force targets achieved)
    pub fn is_assembly_complete(&self, measured_force: (f64, f64, f64), force_tolerance: f64) -> bool {
        let error_x = (measured_force.0 - self.force_targets.0).abs();
        let error_y = (measured_force.1 - self.force_targets.1).abs();
        let error_z = (measured_force.2 - self.force_targets.2).abs();

        error_x < force_tolerance && error_y < force_tolerance && error_z < force_tolerance
    }
}

/// Jacobian transpose controller: τ = J^T * F
pub struct JacobianTransposeController;

impl JacobianTransposeController {
    /// Convert end-effector force to joint torques using Jacobian transpose
    pub fn compute_torques(jacobian_transpose: &[(f64, f64, f64); 3], force: (f64, f64, f64)) -> Vec<f64> {
        let mut torques = vec![0.0; 3];

        for i in 0..3 {
            torques[i] = jacobian_transpose[i].0 * force.0
                + jacobian_transpose[i].1 * force.1
                + jacobian_transpose[i].2 * force.2;
        }

        torques
    }

    /// Compute joint torques for 6-DOF robot from Jacobian and wrench
    pub fn compute_torques_6dof(
        jacobian_transpose: &[(f64, f64, f64, f64, f64, f64); 6],
        force: (f64, f64, f64),
        torque: (f64, f64, f64),
    ) -> Vec<f64> {
        let mut torques = vec![0.0; 6];

        for i in 0..6 {
            torques[i] = jacobian_transpose[i].0 * force.0
                + jacobian_transpose[i].1 * force.1
                + jacobian_transpose[i].2 * force.2
                + jacobian_transpose[i].3 * torque.0
                + jacobian_transpose[i].4 * torque.1
                + jacobian_transpose[i].5 * torque.2;
        }

        torques
    }
}

/// Contact state detector
pub struct ContactDetector {
    force_threshold: f64,
    contact_timeout: usize,
    contact_frames: usize,
}

impl ContactDetector {
    /// Create new contact detector
    pub fn new(force_threshold: f64, contact_timeout: usize) -> Self {
        ContactDetector {
            force_threshold,
            contact_timeout,
            contact_frames: 0,
        }
    }

    /// Detect contact based on force measurement
    pub fn detect_contact(&mut self, force: (f64, f64, f64)) -> bool {
        let magnitude = (force.0 * force.0 + force.1 * force.1 + force.2 * force.2).sqrt();

        if magnitude > self.force_threshold {
            self.contact_frames += 1;
            self.contact_frames >= 5  // Require 5 consecutive frames for robust detection
        } else {
            self.contact_frames = self.contact_frames.saturating_sub(1);
            false
        }
    }

    /// Check if contact is lost
    pub fn is_contact_lost(&self) -> bool {
        self.contact_frames == 0
    }

    /// Reset contact detector
    pub fn reset(&mut self) {
        self.contact_frames = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_impedance_parameters_soft_contact() {
        let params = ImpedanceParameters::soft_contact();
        assert_eq!(params.stiffness, 100.0);
        assert_eq!(params.damping, 50.0);
    }

    #[test]
    fn test_impedance_parameters_stiff_positioning() {
        let params = ImpedanceParameters::stiff_positioning();
        assert_eq!(params.stiffness, 1000.0);
        assert_eq!(params.damping, 100.0);
    }

    #[test]
    fn test_impedance_controller_creation() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let controller = ImpedanceController::new(params, pos);
        assert!((controller.parameters.stiffness - 500.0).abs() < 1e-10);
    }

    #[test]
    fn test_compute_desired_force_zero_error() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let mut controller = ImpedanceController::new(params, pos);
        controller.update_state(pos, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0));

        let force = controller.compute_desired_force();
        assert!((force.0).abs() < 1e-10);
        assert!((force.1).abs() < 1e-10);
        assert!((force.2).abs() < 1e-10);
    }

    #[test]
    fn test_compute_desired_force_with_error() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let desired_pos = Point3D { x: 0.1, y: 0.0, z: 0.0 };
        let mut controller = ImpedanceController::new(params, desired_pos);

        let current_pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        controller.update_state(current_pos, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0));

        let force = controller.compute_desired_force();
        assert!(force.0 > 0.0);  // Should have positive force in x
    }

    #[test]
    fn test_compute_desired_acceleration() {
        let params = ImpedanceParameters::new(500.0, 100.0, 2.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let mut controller = ImpedanceController::new(params, pos);
        controller.update_state(pos, (0.0, 0.0, 0.0), (2.0, 0.0, 0.0));

        let accel = controller.compute_desired_acceleration();
        assert!(accel.0.abs() < 1000.0);  // Should be reasonable
    }

    #[test]
    fn test_is_force_within_limits_true() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let mut controller = ImpedanceController::new(params, pos);
        controller.update_state(pos, (0.0, 0.0, 0.0), (5.0, 0.0, 0.0));

        assert!(controller.is_force_within_limits(10.0));
    }

    #[test]
    fn test_is_force_within_limits_false() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let mut controller = ImpedanceController::new(params, pos);
        controller.update_state(pos, (0.0, 0.0, 0.0), (15.0, 0.0, 0.0));

        assert!(!controller.is_force_within_limits(10.0));
    }

    #[test]
    fn test_compute_compliance() {
        let params = ImpedanceParameters::new(1000.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let controller = ImpedanceController::new(params, pos);

        let compliance = controller.compute_compliance();
        assert!((compliance - 0.001).abs() < 1e-10);
    }

    #[test]
    fn test_hybrid_controller_creation() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let impedance = ImpedanceController::new(params, pos);
        let hybrid = HybridForcePositionController::new((true, false, false), impedance);

        assert_eq!(hybrid.force_components.0, true);
        assert_eq!(hybrid.force_components.1, false);
        assert_eq!(hybrid.force_components.2, false);
    }

    #[test]
    fn test_hybrid_set_force_targets() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let impedance = ImpedanceController::new(params, pos);
        let mut hybrid = HybridForcePositionController::new((true, false, false), impedance);

        hybrid.set_force_targets((10.0, 0.0, 0.0));
        assert_eq!(hybrid.force_targets.0, 10.0);
    }

    #[test]
    fn test_hybrid_compute_command() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let impedance = ImpedanceController::new(params, pos);
        let mut hybrid = HybridForcePositionController::new((true, false, false), impedance);

        hybrid.set_force_targets((10.0, 0.0, 0.0));
        let command = hybrid.compute_command(pos, (0.0, 0.0, 0.0), (5.0, 0.0, 0.0));

        assert!(command.0.abs() < 100.0);  // Should be reasonable
    }

    #[test]
    fn test_jacobian_transpose_3dof() {
        let jacobian_transpose = [
            (1.0, 0.0, 0.0),
            (0.0, 1.0, 0.0),
            (0.0, 0.0, 1.0),
        ];
        let force = (10.0, 20.0, 30.0);

        let torques = JacobianTransposeController::compute_torques(&jacobian_transpose, force);

        assert_eq!(torques.len(), 3);
        assert!((torques[0] - 10.0).abs() < 1e-10);
        assert!((torques[1] - 20.0).abs() < 1e-10);
        assert!((torques[2] - 30.0).abs() < 1e-10);
    }

    #[test]
    fn test_jacobian_transpose_6dof() {
        let jacobian_transpose = [
            (1.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 1.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 1.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 0.0, 1.0, 0.0, 0.0),
            (0.0, 0.0, 0.0, 0.0, 1.0, 0.0),
            (0.0, 0.0, 0.0, 0.0, 0.0, 1.0),
        ];
        let force = (10.0, 20.0, 30.0);
        let torque = (1.0, 2.0, 3.0);

        let torques = JacobianTransposeController::compute_torques_6dof(&jacobian_transpose, force, torque);

        assert_eq!(torques.len(), 6);
        assert!((torques[3] - 1.0).abs() < 1e-10);
        assert!((torques[4] - 2.0).abs() < 1e-10);
        assert!((torques[5] - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_contact_detector_creation() {
        let detector = ContactDetector::new(1.0, 100);
        assert!((detector.force_threshold - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_contact_detector_no_contact() {
        let mut detector = ContactDetector::new(10.0, 100);
        assert!(!detector.detect_contact((1.0, 0.0, 0.0)));
    }

    #[test]
    fn test_contact_detector_with_contact() {
        let mut detector = ContactDetector::new(10.0, 100);
        // Need multiple frames for robust detection
        for _ in 0..5 {
            detector.detect_contact((15.0, 0.0, 0.0));
        }
        assert!(detector.detect_contact((15.0, 0.0, 0.0)));
    }

    #[test]
    fn test_contact_detector_reset() {
        let mut detector = ContactDetector::new(10.0, 100);
        detector.detect_contact((15.0, 0.0, 0.0));
        detector.reset();
        assert!(detector.is_contact_lost());
    }

    #[test]
    fn test_hybrid_assembly_complete() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let impedance = ImpedanceController::new(params, pos);
        let mut hybrid = HybridForcePositionController::new((true, false, false), impedance);

        hybrid.set_force_targets((10.0, 0.0, 0.0));
        let measured_force = (10.1, 0.0, 0.0);

        assert!(hybrid.is_assembly_complete(measured_force, 0.2));
    }

    #[test]
    fn test_hybrid_assembly_not_complete() {
        let params = ImpedanceParameters::new(500.0, 100.0, 1.0);
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let impedance = ImpedanceController::new(params, pos);
        let mut hybrid = HybridForcePositionController::new((true, false, false), impedance);

        hybrid.set_force_targets((10.0, 0.0, 0.0));
        let measured_force = (5.0, 0.0, 0.0);

        assert!(!hybrid.is_assembly_complete(measured_force, 0.2));
    }

    #[test]
    fn test_impedance_compliance_assembly() {
        let params = ImpedanceParameters::compliant_assembly();
        let pos = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let controller = ImpedanceController::new(params, pos);

        let compliance = controller.compute_compliance();
        assert!(compliance > 0.0);
        assert!(compliance < 0.01);
    }
}
