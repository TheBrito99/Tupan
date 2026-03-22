//! Robot Configuration and Kinematics
//! Phase 25 Task 2 - Advanced Kinematics

use std::f64::consts::PI;

#[derive(Debug, Clone, Copy)]
pub struct DHParameter {
    pub theta: f64,
    pub d: f64,
    pub a: f64,
    pub alpha: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum JointType {
    Revolute,
    Prismatic,
}

#[derive(Debug, Clone)]
pub struct RobotJoint {
    pub dh_params: DHParameter,
    pub joint_type: JointType,
    pub min_angle: f64,
    pub max_angle: f64,
    pub max_velocity: f64,
    pub max_torque: f64,
    pub mass: f64,
}

#[derive(Clone)]
pub struct RobotArm {
    pub name: String,
    pub joints: Vec<RobotJoint>,
    pub base_position: (f64, f64, f64),
    pub num_dof: usize,
}

impl RobotJoint {
    pub fn new_revolute(theta: f64, d: f64, a: f64, alpha: f64, min_angle: f64, max_angle: f64) -> Self {
        RobotJoint {
            dh_params: DHParameter { theta, d, a, alpha },
            joint_type: JointType::Revolute,
            min_angle,
            max_angle,
            max_velocity: 1.0,
            max_torque: 100.0,
            mass: 1.0,
        }
    }

    pub fn new_prismatic(theta: f64, d: f64, a: f64, alpha: f64, min_d: f64, max_d: f64) -> Self {
        RobotJoint {
            dh_params: DHParameter { theta, d, a, alpha },
            joint_type: JointType::Prismatic,
            min_angle: min_d,
            max_angle: max_d,
            max_velocity: 0.5,
            max_torque: 50.0,
            mass: 0.5,
        }
    }

    pub fn is_within_limits(&self, value: f64) -> bool {
        value >= self.min_angle && value <= self.max_angle
    }

    pub fn clamp_value(&self, value: f64) -> f64 {
        value.max(self.min_angle).min(self.max_angle)
    }
}

impl RobotArm {
    pub fn new(name: &str, base_x: f64, base_y: f64, base_z: f64) -> Self {
        RobotArm {
            name: name.to_string(),
            joints: vec![],
            base_position: (base_x, base_y, base_z),
            num_dof: 0,
        }
    }

    pub fn add_joint(&mut self, joint: RobotJoint) {
        self.joints.push(joint);
        self.num_dof += 1;
    }

    pub fn create_3dof_planar() -> Self {
        let mut arm = RobotArm::new("3-DOF Planar", 0.0, 0.0, 0.0);
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.0, 0.3, 0.0, -PI, PI));
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.0, 0.25, 0.0, -PI, PI));
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.0, 0.15, 0.0, -PI, PI));
        arm
    }

    pub fn create_6dof_spatial() -> Self {
        let mut arm = RobotArm::new("6-DOF Spatial", 0.0, 0.0, 0.0);
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.0, 0.0, 0.0, -PI, PI));
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.0, 0.26, PI / 2.0, -PI / 2.0, PI / 2.0));
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.0, 0.26, 0.0, -PI, PI));
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.22, 0.0, PI / 2.0, -PI, PI));
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.0, 0.0, -PI / 2.0, -PI / 2.0, PI / 2.0));
        arm.add_joint(RobotJoint::new_revolute(0.0, 0.08, 0.0, 0.0, -PI, PI));
        arm
    }

    pub fn is_valid_configuration(&self, angles: &[f64]) -> bool {
        if angles.len() != self.num_dof { return false; }
        angles.iter().zip(self.joints.iter()).all(|(&angle, joint)| joint.is_within_limits(angle))
    }

    pub fn clamp_configuration(&self, angles: &[f64]) -> Vec<f64> {
        angles.iter().zip(self.joints.iter()).map(|(&angle, joint)| joint.clamp_value(angle)).collect()
    }

    pub fn total_mass(&self) -> f64 {
        self.joints.iter().map(|j| j.mass).sum()
    }

    pub fn compute_reach(&self) -> f64 {
        self.joints.iter().map(|j| j.dh_params.a).sum::<f64>()
    }

    pub fn forward_kinematics_2d(&self, angles: &[f64]) -> Result<(f64, f64), String> {
        if angles.len() != self.num_dof { return Err("Wrong number of angles".to_string()); }
        let mut x = 0.0;
        let mut y = 0.0;
        let mut angle_sum = 0.0;
        for (i, &joint_angle) in angles.iter().enumerate() {
            if i < self.joints.len() {
                let link_length = self.joints[i].dh_params.a;
                angle_sum += joint_angle;
                x += link_length * angle_sum.cos();
                y += link_length * angle_sum.sin();
            }
        }
        Ok((self.base_position.0 + x, self.base_position.1 + y))
    }

    pub fn forward_kinematics_3d(&self, angles: &[f64]) -> Result<(f64, f64, f64), String> {
        if angles.len() != self.num_dof { return Err("Wrong number of angles".to_string()); }
        let (x, y) = self.forward_kinematics_2d(angles)?;
        Ok((x, y, self.base_position.2))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dh_parameter_creation() {
        let dh = DHParameter { theta: 0.5, d: 0.1, a: 0.3, alpha: 0.0 };
        assert!((dh.theta - 0.5).abs() < 1e-10);
        assert!((dh.a - 0.3).abs() < 1e-10);
    }

    #[test]
    fn test_revolute_joint_creation() {
        let joint = RobotJoint::new_revolute(0.0, 0.0, 0.3, 0.0, -PI, PI);
        assert_eq!(joint.joint_type, JointType::Revolute);
        assert!((joint.dh_params.a - 0.3).abs() < 1e-10);
    }

    #[test]
    fn test_prismatic_joint_creation() {
        let joint = RobotJoint::new_prismatic(0.0, 0.0, 0.0, 0.0, 0.0, 1.0);
        assert_eq!(joint.joint_type, JointType::Prismatic);
        assert_eq!(joint.min_angle, 0.0);
        assert_eq!(joint.max_angle, 1.0);
    }

    #[test]
    fn test_joint_limits_within() {
        let joint = RobotJoint::new_revolute(0.0, 0.0, 0.3, 0.0, -PI, PI);
        assert!(joint.is_within_limits(0.0));
        assert!(joint.is_within_limits(PI / 2.0));
        assert!(joint.is_within_limits(-PI / 2.0));
    }

    #[test]
    fn test_joint_limits_exceeded() {
        let joint = RobotJoint::new_revolute(0.0, 0.0, 0.3, 0.0, -1.0, 1.0);
        assert!(!joint.is_within_limits(2.0));
        assert!(!joint.is_within_limits(-2.0));
    }

    #[test]
    fn test_joint_clamp() {
        let joint = RobotJoint::new_revolute(0.0, 0.0, 0.3, 0.0, -1.0, 1.0);
        assert!((joint.clamp_value(2.0) - 1.0).abs() < 1e-10);
        assert!((joint.clamp_value(-2.0) - (-1.0)).abs() < 1e-10);
        assert!((joint.clamp_value(0.5) - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_robot_arm_creation_3dof() {
        let arm = RobotArm::create_3dof_planar();
        assert_eq!(arm.num_dof, 3);
        assert_eq!(arm.joints.len(), 3);
    }

    #[test]
    fn test_robot_arm_creation_6dof() {
        let arm = RobotArm::create_6dof_spatial();
        assert_eq!(arm.num_dof, 6);
        assert_eq!(arm.joints.len(), 6);
    }

    #[test]
    fn test_arm_total_mass() {
        let arm = RobotArm::create_3dof_planar();
        let total_mass = arm.total_mass();
        assert!(total_mass > 0.0);
        assert!((total_mass - 3.0).abs() < 1e-10); // 3 joints with mass 1.0 each
    }

    #[test]
    fn test_arm_compute_reach() {
        let arm = RobotArm::create_3dof_planar();
        let reach = arm.compute_reach();
        assert!((reach - (0.3 + 0.25 + 0.15)).abs() < 1e-10);
    }

    #[test]
    fn test_valid_configuration() {
        let arm = RobotArm::create_3dof_planar();
        let config = vec![0.0, PI / 4.0, -PI / 4.0];
        assert!(arm.is_valid_configuration(&config));
    }

    #[test]
    fn test_invalid_configuration_wrong_length() {
        let arm = RobotArm::create_3dof_planar();
        let config = vec![0.0, PI / 4.0];
        assert!(!arm.is_valid_configuration(&config));
    }

    #[test]
    fn test_invalid_configuration_out_of_limits() {
        let arm = RobotArm::create_3dof_planar();
        let config = vec![0.0, PI / 4.0, 2.0 * PI]; // Exceeds PI limit
        assert!(!arm.is_valid_configuration(&config));
    }

    #[test]
    fn test_clamp_configuration() {
        let arm = RobotArm::create_3dof_planar();
        let config = vec![0.0, 2.0 * PI, -2.0 * PI];
        let clamped = arm.clamp_configuration(&config);
        assert_eq!(clamped.len(), 3);
        assert!(clamped[0] >= -PI && clamped[0] <= PI);
        assert!(clamped[1] >= -PI && clamped[1] <= PI);
        assert!(clamped[2] >= -PI && clamped[2] <= PI);
    }

    #[test]
    fn test_forward_kinematics_2d_zero_angles() {
        let arm = RobotArm::create_3dof_planar();
        let angles = vec![0.0, 0.0, 0.0];
        let (x, y) = arm.forward_kinematics_2d(&angles).unwrap();
        assert!((x - (0.3 + 0.25 + 0.15)).abs() < 1e-6);
        assert!(y.abs() < 1e-6);
    }

    #[test]
    fn test_forward_kinematics_2d_right_angle() {
        let arm = RobotArm::create_3dof_planar();
        let angles = vec![PI / 2.0, 0.0, 0.0];
        let (x, y) = arm.forward_kinematics_2d(&angles).unwrap();
        // First joint rotates arm 90° upward
        assert!(x.abs() < 1e-6); // x ≈ 0
        assert!(y > 0.0); // y should be positive
    }

    #[test]
    fn test_forward_kinematics_3d() {
        let arm = RobotArm::create_3dof_planar();
        let angles = vec![0.0, 0.0, 0.0];
        let (x, y, z) = arm.forward_kinematics_3d(&angles).unwrap();
        assert!((x - (0.3 + 0.25 + 0.15)).abs() < 1e-6);
        assert!(y.abs() < 1e-6);
        assert!(z.abs() < 1e-6); // Base is at (0, 0, 0)
    }

    #[test]
    fn test_forward_kinematics_wrong_length() {
        let arm = RobotArm::create_3dof_planar();
        let angles = vec![0.0, 0.0];
        let result = arm.forward_kinematics_2d(&angles);
        assert!(result.is_err());
    }
}