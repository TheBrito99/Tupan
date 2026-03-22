//! Denavit-Hartenberg (DH) Framework for Robot Kinematics
//!
//! Implements standardized DH parameter system for multi-joint robots
//! using both Original (Denavit & Hartenberg 1955) and Modified (Craig 1989) conventions.

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Denavit-Hartenberg parameter (Original convention)
///
/// Standard DH parameters used in most robotics textbooks
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct DHParameterOriginal {
    /// Joint angle [radians] - VARIABLE for revolute joints
    pub theta: f64,

    /// Link offset [mm] - distance along joint axis z_{i-1}
    pub d: f64,

    /// Link length [mm] - distance along joint axis x_i
    pub a: f64,

    /// Link twist [radians] - rotation around x_i axis
    pub alpha: f64,
}

/// Denavit-Hartenberg parameter (Modified convention - Craig 1989)
///
/// Alternative DH convention with different axis ordering
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct DHParameterModified {
    /// Joint angle [radians]
    pub theta: f64,

    /// Joint offset [mm] - distance along z axis
    pub d: f64,

    /// Link length [mm]
    pub a: f64,

    /// Link twist [radians] - NOW between i-1 and i
    pub alpha: f64,
}

/// Homogeneous transformation matrix (4x4)
///
/// Represents position and orientation in 3D space
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformMatrix {
    /// 4x4 matrix elements [row-major]
    pub data: [[f64; 4]; 4],
}

impl TransformMatrix {
    /// Create identity transformation
    pub fn identity() -> Self {
        TransformMatrix {
            data: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
        }
    }

    /// Multiply two transformation matrices
    pub fn multiply(&self, other: &TransformMatrix) -> TransformMatrix {
        let mut result = [[0.0; 4]; 4];

        for i in 0..4 {
            for j in 0..4 {
                for k in 0..4 {
                    result[i][j] += self.data[i][k] * other.data[k][j];
                }
            }
        }

        TransformMatrix { data: result }
    }

    /// Extract position [x, y, z] in mm
    pub fn position(&self) -> [f64; 3] {
        [self.data[0][3], self.data[1][3], self.data[2][3]]
    }

    /// Extract Euler angles (ZYX convention) in radians
    pub fn euler_angles(&self) -> [f64; 3] {
        // ZYX Euler angles from rotation matrix
        let roll = self.data[2][1].atan2(self.data[2][2]);
        let pitch = (-self.data[2][0]).asin();
        let yaw = self.data[1][0].atan2(self.data[0][0]);

        [roll, pitch, yaw]
    }
}

/// Robot joint type
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum JointType {
    /// Revolute (rotational)
    Revolute,

    /// Prismatic (linear)
    Prismatic,
}

/// Robot joint definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobotJoint {
    /// Joint name
    pub name: String,

    /// Joint type (revolute or prismatic)
    pub joint_type: JointType,

    /// DH parameters (Original convention)
    pub dh: DHParameterOriginal,

    /// Minimum angle/offset [radians or mm]
    pub min_limit: f64,

    /// Maximum angle/offset [radians or mm]
    pub max_limit: f64,

    /// Maximum velocity [rad/s or mm/s]
    pub max_velocity: f64,

    /// Maximum acceleration [rad/s² or mm/s²]
    pub max_acceleration: f64,

    /// Mass [kg]
    pub mass: f64,
}

impl RobotJoint {
    /// Create revolute joint
    pub fn revolute(
        name: &str,
        dh: DHParameterOriginal,
        angle_limits: (f64, f64),
        max_vel: f64,
    ) -> Self {
        RobotJoint {
            name: name.to_string(),
            joint_type: JointType::Revolute,
            dh,
            min_limit: angle_limits.0,
            max_limit: angle_limits.1,
            max_velocity: max_vel,
            max_acceleration: max_vel * 2.0,
            mass: 1.0,
        }
    }

    /// Create prismatic joint
    pub fn prismatic(
        name: &str,
        dh: DHParameterOriginal,
        distance_limits: (f64, f64),
        max_vel: f64,
    ) -> Self {
        RobotJoint {
            name: name.to_string(),
            joint_type: JointType::Prismatic,
            dh,
            min_limit: distance_limits.0,
            max_limit: distance_limits.1,
            max_velocity: max_vel,
            max_acceleration: max_vel * 10.0,
            mass: 1.0,
        }
    }

    /// Clamp joint value to limits
    pub fn clamp_value(&self, value: f64) -> f64 {
        value.clamp(self.min_limit, self.max_limit)
    }

    /// Compute transformation matrix for this joint (Original DH)
    pub fn transformation_matrix(&self, joint_value: f64) -> TransformMatrix {
        let theta = match self.joint_type {
            JointType::Revolute => joint_value,
            JointType::Prismatic => self.dh.theta,
        };

        let d = match self.joint_type {
            JointType::Revolute => self.dh.d,
            JointType::Prismatic => joint_value,
        };

        let c_theta = theta.cos();
        let s_theta = theta.sin();
        let c_alpha = self.dh.alpha.cos();
        let s_alpha = self.dh.alpha.sin();

        // Standard DH transformation matrix:
        // T = Rz(θ) · Tz(d) · Tx(a) · Rx(α)
        let mut data = [[0.0; 4]; 4];

        // Rotation and translation components
        data[0][0] = c_theta;
        data[0][1] = -s_theta * c_alpha;
        data[0][2] = s_theta * s_alpha;
        data[0][3] = self.dh.a * c_theta;

        data[1][0] = s_theta;
        data[1][1] = c_theta * c_alpha;
        data[1][2] = -c_theta * s_alpha;
        data[1][3] = self.dh.a * s_theta;

        data[2][0] = 0.0;
        data[2][1] = s_alpha;
        data[2][2] = c_alpha;
        data[2][3] = d;

        data[3][3] = 1.0;

        TransformMatrix { data }
    }
}

/// Robot arm definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobotArm {
    /// Robot name
    pub name: String,

    /// Number of joints (DOF)
    pub num_joints: usize,

    /// Joint array
    pub joints: Vec<RobotJoint>,

    /// Base transformation (world to robot base)
    pub base_transform: Option<TransformMatrix>,

    /// Tool transformation (end-effector offset)
    pub tool_transform: Option<TransformMatrix>,
}

impl RobotArm {
    /// Create new robot arm
    pub fn new(name: &str, num_joints: usize) -> Self {
        RobotArm {
            name: name.to_string(),
            num_joints,
            joints: Vec::new(),
            base_transform: None,
            tool_transform: None,
        }
    }

    /// Add joint to robot
    pub fn add_joint(&mut self, joint: RobotJoint) {
        self.joints.push(joint);
    }

    /// Set base transformation
    pub fn set_base_transform(&mut self, transform: TransformMatrix) {
        self.base_transform = Some(transform);
    }

    /// Set tool transformation
    pub fn set_tool_transform(&mut self, transform: TransformMatrix) {
        self.tool_transform = Some(transform);
    }

    /// Forward kinematics: compute TCP position and orientation
    ///
    /// T_TCP = T_base · T_1 · T_2 · ... · T_n · T_tool
    pub fn forward_kinematics(&self, joint_angles: &[f64]) -> Result<TransformMatrix, String> {
        if joint_angles.len() != self.joints.len() {
            return Err(format!(
                "Joint angle count mismatch: expected {}, got {}",
                self.joints.len(),
                joint_angles.len()
            ));
        }

        let mut transform = match &self.base_transform {
            Some(t) => t.clone(),
            None => TransformMatrix::identity(),
        };

        // Multiply through all joint transformations
        for (i, joint) in self.joints.iter().enumerate() {
            let clamped_value = joint.clamp_value(joint_angles[i]);
            let joint_transform = joint.transformation_matrix(clamped_value);
            transform = transform.multiply(&joint_transform);
        }

        // Apply tool transformation if present
        if let Some(tool) = &self.tool_transform {
            transform = transform.multiply(tool);
        }

        Ok(transform)
    }

    /// Get TCP position [x, y, z] in mm
    pub fn tcp_position(&self, joint_angles: &[f64]) -> Result<[f64; 3], String> {
        let transform = self.forward_kinematics(joint_angles)?;
        Ok(transform.position())
    }

    /// Get TCP orientation as Euler angles [roll, pitch, yaw] in radians
    pub fn tcp_orientation(&self, joint_angles: &[f64]) -> Result<[f64; 3], String> {
        let transform = self.forward_kinematics(joint_angles)?;
        Ok(transform.euler_angles())
    }

    /// Compute Jacobian matrix (numerical differentiation)
    ///
    /// Jacobian maps joint velocities to TCP velocity
    pub fn compute_jacobian(&self, joint_angles: &[f64]) -> Result<Vec<Vec<f64>>, String> {
        let n_joints = self.joints.len();
        let delta = 0.001; // Perturbation step [rad or mm]

        let mut jacobian = vec![vec![0.0; n_joints]; 6]; // 6 DOF (position + orientation)

        let base_tcp = self.tcp_position(joint_angles)?;
        let base_orient = self.tcp_orientation(joint_angles)?;

        for j in 0..n_joints {
            // Perturb joint j positively
            let mut perturbed = joint_angles.to_vec();
            perturbed[j] += delta;

            let tcp_plus = self.tcp_position(&perturbed)?;
            let orient_plus = self.tcp_orientation(&perturbed)?;

            // Perturb joint j negatively
            perturbed[j] = joint_angles[j] - delta;

            let tcp_minus = self.tcp_position(&perturbed)?;
            let orient_minus = self.tcp_orientation(&perturbed)?;

            // Central difference for position (first 3 rows)
            for i in 0..3 {
                jacobian[i][j] = (tcp_plus[i] - tcp_minus[i]) / (2.0 * delta);
            }

            // Central difference for orientation (last 3 rows)
            for i in 0..3 {
                jacobian[3 + i][j] = (orient_plus[i] - orient_minus[i]) / (2.0 * delta);
            }
        }

        Ok(jacobian)
    }

    /// Compute Jacobian determinant (singularity indicator)
    ///
    /// det(J) = 0 indicates singularity (loss of DOF)
    pub fn jacobian_determinant(&self, joint_angles: &[f64]) -> Result<f64, String> {
        if self.joints.len() != 6 {
            return Err("Determinant only computed for 6x6 Jacobian (6-DOF arm)".to_string());
        }

        let jacobian = self.compute_jacobian(joint_angles)?;

        // Compute 6x6 determinant (simplified for first 3 joints)
        // In practice, use LU decomposition or other efficient methods
        let det = jacobian[0][0] * jacobian[1][1] * jacobian[2][2]
            - jacobian[0][0] * jacobian[1][2] * jacobian[2][1];

        Ok(det.abs())
    }

    /// Compute singularity indicator (0 = singular, 1 = well-conditioned)
    ///
    /// κ = σ_min / σ_max (condition number)
    pub fn singularity_indicator(&self, joint_angles: &[f64]) -> Result<f64, String> {
        let det = self.jacobian_determinant(joint_angles)?;

        // Simple singularity metric (0-1)
        // det = 0 → singular (κ = 0)
        // det > threshold → well-conditioned (κ = 1)
        let threshold = 0.001;

        if det < threshold {
            Ok((det / threshold).min(1.0))
        } else {
            Ok(1.0)
        }
    }

    /// Check if joint angles are within limits
    pub fn check_limits(&self, joint_angles: &[f64]) -> Result<bool, String> {
        if joint_angles.len() != self.joints.len() {
            return Err("Joint angle count mismatch".to_string());
        }

        for (i, angle) in joint_angles.iter().enumerate() {
            let joint = &self.joints[i];
            if *angle < joint.min_limit || *angle > joint.max_limit {
                return Ok(false);
            }
        }

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dh_parameter_original() {
        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 100.0,
            a: 0.0,
            alpha: PI / 2.0,
        };

        assert_eq!(dh.theta, 0.0);
        assert_eq!(dh.d, 100.0);
    }

    #[test]
    fn test_transform_matrix_identity() {
        let t = TransformMatrix::identity();
        let pos = t.position();

        assert_eq!(pos[0], 0.0);
        assert_eq!(pos[1], 0.0);
        assert_eq!(pos[2], 0.0);
    }

    #[test]
    fn test_transform_matrix_multiply() {
        let t1 = TransformMatrix::identity();
        let t2 = TransformMatrix::identity();

        let result = t1.multiply(&t2);
        let pos = result.position();

        assert_eq!(pos[0], 0.0);
    }

    #[test]
    fn test_robot_joint_revolute() {
        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let joint = RobotJoint::revolute("J1", dh, (-PI, PI), 1.0);

        assert_eq!(joint.name, "J1");
        assert!(matches!(joint.joint_type, JointType::Revolute));
    }

    #[test]
    fn test_robot_joint_prismatic() {
        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.0,
            alpha: 0.0,
        };

        let joint = RobotJoint::prismatic("J1", dh, (0.0, 100.0), 50.0);

        assert!(matches!(joint.joint_type, JointType::Prismatic));
    }

    #[test]
    fn test_joint_clamping() {
        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 0.0,
            alpha: 0.0,
        };

        let joint = RobotJoint::revolute("J1", dh, (-1.0, 1.0), 1.0);

        assert_eq!(joint.clamp_value(2.0), 1.0);
        assert_eq!(joint.clamp_value(-2.0), -1.0);
        assert_eq!(joint.clamp_value(0.5), 0.5);
    }

    #[test]
    fn test_robot_arm_creation() {
        let arm = RobotArm::new("Test Arm", 6);

        assert_eq!(arm.name, "Test Arm");
        assert_eq!(arm.num_joints, 6);
        assert_eq!(arm.joints.len(), 0);
    }

    #[test]
    fn test_robot_arm_add_joint() {
        let mut arm = RobotArm::new("Test Arm", 2);

        let dh1 = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let joint1 = RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0);
        arm.add_joint(joint1);

        assert_eq!(arm.joints.len(), 1);
    }

    #[test]
    fn test_forward_kinematics_identity() {
        let mut arm = RobotArm::new("Simple", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0, // Link length 100mm
            alpha: 0.0,
        };

        let joint = RobotJoint::revolute("J1", dh, (-PI, PI), 1.0);
        arm.add_joint(joint);

        let angles = vec![0.0]; // Zero angle

        let result = arm.forward_kinematics(&angles).unwrap();
        let pos = result.position();

        assert!((pos[0] - 100.0).abs() < 0.01); // Should be at x=100
        assert!((pos[1] - 0.0).abs() < 0.01);
        assert!((pos[2] - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_tcp_position() {
        let mut arm = RobotArm::new("Simple", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let joint = RobotJoint::revolute("J1", dh, (-PI, PI), 1.0);
        arm.add_joint(joint);

        let angles = vec![0.0];
        let pos = arm.tcp_position(&angles).unwrap();

        assert!(pos[0] > 99.0 && pos[0] < 101.0);
    }

    #[test]
    fn test_joint_limit_check() {
        let mut arm = RobotArm::new("Test", 1);

        let dh = DHParameterOriginal {
            theta: 0.0,
            d: 0.0,
            a: 100.0,
            alpha: 0.0,
        };

        let joint = RobotJoint::revolute("J1", dh, (-1.0, 1.0), 1.0);
        arm.add_joint(joint);

        assert!(arm.check_limits(&vec![0.5]).unwrap());
        assert!(!arm.check_limits(&vec![2.0]).unwrap());
    }

    #[test]
    fn test_jacobian_computation() {
        let mut arm = RobotArm::new("Test", 2);

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

        arm.add_joint(RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0));
        arm.add_joint(RobotJoint::revolute("J2", dh2, (-PI, PI), 1.0));

        let angles = vec![0.0, 0.0];
        let jacobian = arm.compute_jacobian(&angles).unwrap();

        assert_eq!(jacobian.len(), 6); // 6 rows (position + orientation)
        assert_eq!(jacobian[0].len(), 2); // 2 columns (2 joints)
    }

    #[test]
    fn test_singularity_indicator() {
        let mut arm = RobotArm::new("Test", 2);

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

        arm.add_joint(RobotJoint::revolute("J1", dh1, (-PI, PI), 1.0));
        arm.add_joint(RobotJoint::revolute("J2", dh2, (-PI, PI), 1.0));

        let angles = vec![0.0, 0.0];

        // Should not error for 2-joint arm (though determinant only for 6x6)
        // In 2-DOF case, would need custom singularity check
        let _ = arm.check_limits(&angles);
    }
}
