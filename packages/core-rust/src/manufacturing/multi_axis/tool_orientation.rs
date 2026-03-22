//! Tool Orientation for Multi-Axis Machining
//!
//! Represents the orientation of the cutting tool in 3D space.
//! Used for 4-axis and 5-axis machining where the tool can tilt or rotate.

use serde::{Deserialize, Serialize};
use nalgebra::{Matrix3, Vector3};
use std::fmt;

/// Tool orientation represented as a direction vector and tilt angles
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ToolOrientation {
    /// Tool axis direction (unit vector, negative Z = down)
    pub direction: (f64, f64, f64),

    /// Lead angle: tilt from vertical in tool feed direction (degrees)
    /// 0° = vertical (Z-down), positive = tilted toward feed
    pub lead_angle: f64,

    /// Tilt angle: side tilt perpendicular to feed direction (degrees)
    /// 0° = no side tilt
    pub tilt_angle: f64,
}

impl ToolOrientation {
    /// Vertical tool orientation (Z-down, no tilt)
    pub fn vertical() -> Self {
        ToolOrientation {
            direction: (0.0, 0.0, -1.0),
            lead_angle: 0.0,
            tilt_angle: 0.0,
        }
    }

    /// Create orientation with lead and tilt angles
    ///
    /// # Arguments
    /// * `lead_angle` - Tilt in feed direction (degrees)
    /// * `tilt_angle` - Side tilt (degrees)
    pub fn tilted(lead_angle: f64, tilt_angle: f64) -> Self {
        let direction = compute_tool_direction(lead_angle, tilt_angle);
        ToolOrientation {
            direction,
            lead_angle,
            tilt_angle,
        }
    }

    /// Create orientation from a direction vector
    pub fn from_direction(x: f64, y: f64, z: f64) -> Self {
        let norm = (x * x + y * y + z * z).sqrt();
        let direction = (x / norm, y / norm, z / norm);

        // Compute angles from direction vector
        let (lead, tilt) = compute_angles_from_direction(direction);

        ToolOrientation {
            direction,
            lead_angle: lead,
            tilt_angle: tilt,
        }
    }

    /// Get the tool axis as a unit vector
    pub fn axis(&self) -> Vector3<f64> {
        Vector3::new(self.direction.0, self.direction.1, self.direction.2)
    }

    /// Normalize the direction vector to unit length
    pub fn normalize(&mut self) {
        let (x, y, z) = self.direction;
        let norm = (x * x + y * y + z * z).sqrt();
        self.direction = (x / norm, y / norm, z / norm);
    }

    /// Get the rotation matrix representing this orientation
    pub fn rotation_matrix(&self) -> Matrix3<f64> {
        let lead_rad = self.lead_angle.to_radians();
        let tilt_rad = self.tilt_angle.to_radians();

        // Apply lead rotation (around Y axis)
        let lead_rot = Matrix3::new(
            lead_rad.cos(), 0.0, lead_rad.sin(),
            0.0, 1.0, 0.0,
            -lead_rad.sin(), 0.0, lead_rad.cos()
        );

        // Apply tilt rotation (around X axis)
        let tilt_rot = Matrix3::new(
            1.0, 0.0, 0.0,
            0.0, tilt_rad.cos(), -tilt_rad.sin(),
            0.0, tilt_rad.sin(), tilt_rad.cos()
        );

        // Combined rotation (lead first, then tilt)
        tilt_rot * lead_rot
    }

    /// Check if orientation is purely vertical (within tolerance)
    pub fn is_vertical(&self, tolerance: f64) -> bool {
        self.lead_angle.abs() < tolerance && self.tilt_angle.abs() < tolerance
    }

    /// Get the angle between this orientation and another
    pub fn angle_between(&self, other: &ToolOrientation) -> f64 {
        let dir1 = self.axis();
        let dir2 = other.axis();
        let cos_angle = dir1.dot(&dir2).max(-1.0).min(1.0);
        cos_angle.acos().to_degrees()
    }
}

impl fmt::Display for ToolOrientation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Lead: {:.2}°, Tilt: {:.2}°", self.lead_angle, self.tilt_angle)
    }
}

impl Default for ToolOrientation {
    fn default() -> Self {
        ToolOrientation::vertical()
    }
}

/// Compute tool direction vector from lead and tilt angles
fn compute_tool_direction(lead_angle: f64, tilt_angle: f64) -> (f64, f64, f64) {
    let lead_rad = lead_angle.to_radians();
    let tilt_rad = tilt_angle.to_radians();

    // Start with downward vertical
    let x = 0.0;
    let y = 0.0;
    let z = -1.0;

    // Apply lead rotation (around Y axis)
    let x_lead = x * lead_rad.cos() + z * lead_rad.sin();
    let z_lead = -x * lead_rad.sin() + z * lead_rad.cos();

    // Apply tilt rotation (around X axis)
    let y_tilt = y * tilt_rad.cos() - z_lead * tilt_rad.sin();
    let z_tilt = y * tilt_rad.sin() + z_lead * tilt_rad.cos();

    (x_lead, y_tilt, z_tilt)
}

/// Compute lead and tilt angles from a direction vector
fn compute_angles_from_direction(direction: (f64, f64, f64)) -> (f64, f64) {
    let (x, y, z) = direction;

    // Special case for purely vertical (0, 0, -1)
    if x.abs() < 1e-10 && y.abs() < 1e-10 && z.abs() > 0.99 {
        return (0.0, 0.0);
    }

    // Lead angle: angle in XZ plane from vertical
    let lead = (-z).atan2(x).to_degrees();

    // Tilt angle: angle in YZ plane from vertical
    let tilt = y.atan2(-z).to_degrees();

    (lead, tilt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vertical_orientation() {
        let o = ToolOrientation::vertical();
        assert_eq!(o.direction, (0.0, 0.0, -1.0));
        assert_eq!(o.lead_angle, 0.0);
        assert_eq!(o.tilt_angle, 0.0);
        assert!(o.is_vertical(1e-6));
    }

    #[test]
    fn test_tilted_orientation() {
        let o = ToolOrientation::tilted(15.0, 0.0);
        assert!(!o.is_vertical(1.0));
        assert_eq!(o.lead_angle, 15.0);
        assert_eq!(o.tilt_angle, 0.0);
    }

    #[test]
    fn test_from_direction() {
        let o = ToolOrientation::from_direction(0.0, 0.0, -1.0);
        assert!(o.is_vertical(1e-6));
    }

    #[test]
    fn test_rotation_matrix() {
        let o = ToolOrientation::vertical();
        let rot = o.rotation_matrix();

        // Apply to Z-down vector
        let v = Vector3::new(0.0, 0.0, -1.0);
        let v_rot = rot * v;

        // Should still be Z-down
        assert!((v_rot.x.abs()) < 1e-6);
        assert!((v_rot.y.abs()) < 1e-6);
        assert!((v_rot.z + 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_angle_between() {
        let o1 = ToolOrientation::vertical();
        let o2 = ToolOrientation::tilted(90.0, 0.0);

        let angle = o1.angle_between(&o2);
        assert!((angle - 90.0).abs() < 1.0); // Approximate 90 degrees
    }

    #[test]
    fn test_normalization() {
        let mut o = ToolOrientation::from_direction(2.0, 0.0, -2.0);
        o.normalize();

        let (x, y, z) = o.direction;
        let norm = (x * x + y * y + z * z).sqrt();
        assert!((norm - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_serialization() {
        let o = ToolOrientation::tilted(45.0, 30.0);
        let json = serde_json::to_string(&o).unwrap();
        let o2: ToolOrientation = serde_json::from_str(&json).unwrap();

        assert_eq!(o, o2);
    }

    #[test]
    fn test_display() {
        let o = ToolOrientation::tilted(45.0, 30.0);
        let s = format!("{}", o);
        assert!(s.contains("45"));
        assert!(s.contains("30"));
    }
}
