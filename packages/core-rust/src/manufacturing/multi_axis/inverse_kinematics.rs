//! Inverse Kinematics Solver for Multi-Axis Machines
//!
//! Solves for rotary axis positions (A, B, C) given tool position and orientation.
//! Accounts for different machine kinematics (4-axis horizontal, 4-axis vertical, 5-axis AC, 5-axis BC).

use serde::{Deserialize, Serialize};
use crate::manufacturing::multi_axis::point6d::Point6D;
use crate::manufacturing::multi_axis::tool_orientation::ToolOrientation;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MachineType {
    /// 3-Axis XYZ only
    ThreeAxis,
    /// 4-Axis: XYZ + A (rotary table around X axis)
    FourAxisHorizontal,
    /// 4-Axis: XYZ + B (rotary table around Y axis)
    FourAxisVertical,
    /// 5-Axis: XYZ + A + C (table tilt + spindle rotate)
    FiveAxisAC,
    /// 5-Axis: XYZ + B + C (table rotate + spindle tilt)
    FiveAxisBC,
}

#[derive(Debug, Clone)]
pub struct InverseKinematics {
    machine_type: MachineType,
    a_limit_min: f64,
    a_limit_max: f64,
    b_limit_min: f64,
    b_limit_max: f64,
    c_limit_min: f64,
    c_limit_max: f64,
}

#[derive(Debug, Clone)]
pub struct IKError {
    pub message: String,
}

impl std::fmt::Display for IKError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "IK Error: {}", self.message)
    }
}

impl std::error::Error for IKError {}

impl InverseKinematics {
    /// Create a new IK solver for the specified machine type
    pub fn new(machine_type: MachineType) -> Self {
        InverseKinematics {
            machine_type,
            // Standard machine limits (degrees)
            a_limit_min: -30.0,
            a_limit_max: 120.0,
            b_limit_min: -180.0,
            b_limit_max: 180.0,
            c_limit_min: -180.0,
            c_limit_max: 180.0,
        }
    }

    /// Set custom axis limits
    pub fn with_limits(
        mut self,
        a_min: f64, a_max: f64,
        b_min: f64, b_max: f64,
        c_min: f64, c_max: f64,
    ) -> Self {
        self.a_limit_min = a_min;
        self.a_limit_max = a_max;
        self.b_limit_min = b_min;
        self.b_limit_max = b_max;
        self.c_limit_min = c_min;
        self.c_limit_max = c_max;
        self
    }

    /// Solve for rotary axis positions given TCP position and tool orientation
    pub fn solve(
        &self,
        tcp: &Point6D,
        orientation: &ToolOrientation,
    ) -> Result<Point6D, IKError> {
        match self.machine_type {
            MachineType::ThreeAxis => {
                // No rotary axes - just return linear position
                Ok(*tcp)
            }
            MachineType::FourAxisHorizontal => {
                // XYZ + A (table tilt around X)
                self.solve_4axis_horizontal(tcp, orientation)
            }
            MachineType::FourAxisVertical => {
                // XYZ + B (table rotate around Y)
                self.solve_4axis_vertical(tcp, orientation)
            }
            MachineType::FiveAxisAC => {
                // XYZ + A + C (table tilt + spindle rotate)
                self.solve_5axis_ac(tcp, orientation)
            }
            MachineType::FiveAxisBC => {
                // XYZ + B + C (table rotate + spindle tilt)
                self.solve_5axis_bc(tcp, orientation)
            }
        }
    }

    /// Solve for 4-axis horizontal (XYZ + A)
    /// A axis rotates the table around X
    fn solve_4axis_horizontal(
        &self,
        tcp: &Point6D,
        orientation: &ToolOrientation,
    ) -> Result<Point6D, IKError> {
        // For indexed 4-axis: the A angle is typically discrete (0°, 90°, 180°, 270°)
        // For continuous 4-axis: solve for A from tool orientation

        // The A axis angle determines how the tool is tilted around X
        let a_angle = self.compute_a_from_orientation(orientation)?;

        let mut result = *tcp;
        result.a = a_angle;

        self.validate_limits(&result)?;
        Ok(result)
    }

    /// Solve for 4-axis vertical (XYZ + B)
    /// B axis rotates the table around Y
    fn solve_4axis_vertical(
        &self,
        tcp: &Point6D,
        orientation: &ToolOrientation,
    ) -> Result<Point6D, IKError> {
        // B axis angle from tool orientation
        let b_angle = self.compute_b_from_orientation(orientation)?;

        let mut result = *tcp;
        result.b = b_angle;

        self.validate_limits(&result)?;
        Ok(result)
    }

    /// Solve for 5-axis AC (XYZ + A + C)
    /// A axis: table tilt around X
    /// C axis: spindle rotate around Z
    fn solve_5axis_ac(
        &self,
        tcp: &Point6D,
        orientation: &ToolOrientation,
    ) -> Result<Point6D, IKError> {
        let a_angle = self.compute_a_from_orientation(orientation)?;
        let c_angle = self.compute_c_from_orientation(orientation)?;

        let mut result = *tcp;
        result.a = a_angle;
        result.c = c_angle;

        self.validate_limits(&result)?;
        Ok(result)
    }

    /// Solve for 5-axis BC (XYZ + B + C)
    /// B axis: table rotate around Y
    /// C axis: spindle tilt around Z
    fn solve_5axis_bc(
        &self,
        tcp: &Point6D,
        orientation: &ToolOrientation,
    ) -> Result<Point6D, IKError> {
        let b_angle = self.compute_b_from_orientation(orientation)?;
        let c_angle = self.compute_c_from_orientation(orientation)?;

        let mut result = *tcp;
        result.b = b_angle;
        result.c = c_angle;

        self.validate_limits(&result)?;
        Ok(result)
    }

    /// Compute A axis angle from tool orientation
    /// A axis rotates around X
    fn compute_a_from_orientation(&self, orientation: &ToolOrientation) -> Result<f64, IKError> {
        // Use lead angle as A angle (simplified)
        Ok(orientation.lead_angle)
    }

    /// Compute B axis angle from tool orientation
    /// B axis rotates around Y
    fn compute_b_from_orientation(&self, orientation: &ToolOrientation) -> Result<f64, IKError> {
        // Use tilt angle as B angle (simplified)
        Ok(orientation.tilt_angle)
    }

    /// Compute C axis angle from tool orientation
    /// C axis rotates around Z
    fn compute_c_from_orientation(&self, orientation: &ToolOrientation) -> Result<f64, IKError> {
        // Tool direction to angle around Z
        let dir = orientation.axis();
        let angle = dir.y.atan2(dir.x).to_degrees();
        Ok(angle)
    }

    /// Validate that all axes are within limits
    fn validate_limits(&self, point: &Point6D) -> Result<(), IKError> {
        if point.a < self.a_limit_min || point.a > self.a_limit_max {
            return Err(IKError {
                message: format!(
                    "A axis out of limits: {:.2}° (range: {:.2}° to {:.2}°)",
                    point.a, self.a_limit_min, self.a_limit_max
                ),
            });
        }

        if point.b < self.b_limit_min || point.b > self.b_limit_max {
            return Err(IKError {
                message: format!(
                    "B axis out of limits: {:.2}° (range: {:.2}° to {:.2}°)",
                    point.b, self.b_limit_min, self.b_limit_max
                ),
            });
        }

        if point.c < self.c_limit_min || point.c > self.c_limit_max {
            return Err(IKError {
                message: format!(
                    "C axis out of limits: {:.2}° (range: {:.2}° to {:.2}°)",
                    point.c, self.c_limit_min, self.c_limit_max
                ),
            });
        }

        Ok(())
    }

    /// Check if a position is reachable
    pub fn is_reachable(&self, point: &Point6D) -> bool {
        self.validate_limits(point).is_ok()
    }

    /// Get machine type
    pub fn machine_type(&self) -> MachineType {
        self.machine_type
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_3axis_no_rotation() {
        let ik = InverseKinematics::new(MachineType::ThreeAxis);
        let tcp = Point6D::linear(10.0, 20.0, 5.0);
        let orientation = ToolOrientation::vertical();

        let result = ik.solve(&tcp, &orientation).unwrap();
        assert_eq!(result.x, 10.0);
        assert_eq!(result.a, 0.0);
    }

    #[test]
    fn test_4axis_horizontal_simple() {
        let ik = InverseKinematics::new(MachineType::FourAxisHorizontal);
        let tcp = Point6D::linear(10.0, 20.0, 5.0);
        let orientation = ToolOrientation::tilted(15.0, 0.0);

        let result = ik.solve(&tcp, &orientation).unwrap();
        assert_eq!(result.a, 15.0);
    }

    #[test]
    fn test_5axis_ac() {
        let ik = InverseKinematics::new(MachineType::FiveAxisAC);
        let tcp = Point6D::linear(50.0, 0.0, 10.0);
        let orientation = ToolOrientation::tilted(30.0, 15.0);

        let result = ik.solve(&tcp, &orientation).unwrap();
        assert_eq!(result.a, 30.0);
    }

    #[test]
    fn test_axis_limits_validation() {
        let ik = InverseKinematics::new(MachineType::FourAxisHorizontal)
            .with_limits(-30.0, 120.0, -180.0, 180.0, -180.0, 180.0);

        // Point within limits
        let tcp1 = Point6D::with_a_axis(10.0, 20.0, 5.0, 45.0);
        assert!(ik.is_reachable(&tcp1));

        // Point outside limits
        let tcp2 = Point6D::with_a_axis(10.0, 20.0, 5.0, 150.0);
        assert!(!ik.is_reachable(&tcp2));
    }

    #[test]
    fn test_limit_error() {
        let ik = InverseKinematics::new(MachineType::FourAxisHorizontal)
            .with_limits(-30.0, 120.0, -180.0, 180.0, -180.0, 180.0);

        let tcp = Point6D::linear(10.0, 20.0, 5.0);
        let orientation = ToolOrientation::tilted(150.0, 0.0); // Beyond limit

        let result = ik.solve(&tcp, &orientation);
        assert!(result.is_err());
    }

    #[test]
    fn test_machine_type_retrieval() {
        let ik = InverseKinematics::new(MachineType::FiveAxisAC);
        assert_eq!(ik.machine_type(), MachineType::FiveAxisAC);
    }
}
