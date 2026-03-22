//! 6-Axis Machine Coordinates
//!
//! Represents a position and orientation in 6-axis machine space (X, Y, Z, A, B, C).
//! Enables modeling of 3-axis (XYZ only), 4-axis (XYZ+A), and 5/6-axis (XYZ+rotaries) machines.

use serde::{Deserialize, Serialize};
use std::fmt;

/// 6-Axis machine coordinates: Linear (X, Y, Z) + Rotary (A, B, C)
///
/// # Coordinate System
/// - **X**: Horizontal, typically machine front-back
/// - **Y**: Horizontal, typically machine left-right
/// - **Z**: Vertical, typically spindle axis (negative = down)
/// - **A**: Rotation around X axis (table tilt) [degrees]
/// - **B**: Rotation around Y axis (table rotate) [degrees]
/// - **C**: Rotation around Z axis (spindle rotate) [degrees]
///
/// # Examples
/// ```
/// let point = Point6D::linear(10.0, 20.0, 5.0);
/// assert_eq!(point.x, 10.0);
/// assert_eq!(point.a, 0.0); // No rotation
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point6D {
    /// X coordinate (mm) - horizontal
    pub x: f64,
    /// Y coordinate (mm) - horizontal
    pub y: f64,
    /// Z coordinate (mm) - vertical (negative = down)
    pub z: f64,
    /// A axis (degrees) - rotation around X
    pub a: f64,
    /// B axis (degrees) - rotation around Y
    pub b: f64,
    /// C axis (degrees) - rotation around Z (spindle)
    pub c: f64,
}

impl Point6D {
    /// Create a 3-axis point (no rotary axes)
    pub fn linear(x: f64, y: f64, z: f64) -> Self {
        Point6D { x, y, z, a: 0.0, b: 0.0, c: 0.0 }
    }

    /// Create a 4-axis point (XYZ + A rotary for table tilt)
    pub fn with_a_axis(x: f64, y: f64, z: f64, a: f64) -> Self {
        Point6D { x, y, z, a, b: 0.0, c: 0.0 }
    }

    /// Create a 5-axis point (XYZ + A+C for indexed 5-axis)
    pub fn with_ac_axes(x: f64, y: f64, z: f64, a: f64, c: f64) -> Self {
        Point6D { x, y, z, a, b: 0.0, c }
    }

    /// Create a 5-axis point (XYZ + B+C for indexed 5-axis)
    pub fn with_bc_axes(x: f64, y: f64, z: f64, b: f64, c: f64) -> Self {
        Point6D { x, y, z, a: 0.0, b, c }
    }

    /// Create a full 6-axis point
    pub fn full(x: f64, y: f64, z: f64, a: f64, b: f64, c: f64) -> Self {
        Point6D { x, y, z, a, b, c }
    }

    /// Get the linear position (X, Y, Z)
    pub fn linear_position(&self) -> (f64, f64, f64) {
        (self.x, self.y, self.z)
    }

    /// Get the rotary angles (A, B, C)
    pub fn rotary_angles(&self) -> (f64, f64, f64) {
        (self.a, self.b, self.c)
    }

    /// Normalize rotary angles to -180 to +180 degrees
    pub fn normalize_angles(&mut self) {
        self.a = normalize_angle(self.a);
        self.b = normalize_angle(self.b);
        self.c = normalize_angle(self.c);
    }

    /// Check if point has any rotary motion (for 4+ axis detection)
    pub fn has_rotary_motion(&self) -> bool {
        self.a.abs() > 1e-6 || self.b.abs() > 1e-6 || self.c.abs() > 1e-6
    }

    /// Euclidean distance between two points (linear only)
    pub fn distance_linear(&self, other: &Point6D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    /// Angular distance between two rotations (in degrees)
    pub fn distance_angular(&self, other: &Point6D) -> f64 {
        let da = smallest_angle_difference(self.a, other.a);
        let db = smallest_angle_difference(self.b, other.b);
        let dc = smallest_angle_difference(self.c, other.c);
        (da * da + db * db + dc * dc).sqrt()
    }

    /// Combined distance (linear + angular weighted)
    pub fn distance(&self, other: &Point6D, linear_weight: f64, angular_weight: f64) -> f64 {
        let d_lin = self.distance_linear(other);
        let d_ang = self.distance_angular(other);
        (d_lin * d_lin * linear_weight * linear_weight +
         d_ang * d_ang * angular_weight * angular_weight).sqrt()
    }
}

impl fmt::Display for Point6D {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({:.2}, {:.2}, {:.2}, {:.2}°, {:.2}°, {:.2}°)",
               self.x, self.y, self.z, self.a, self.b, self.c)
    }
}

impl Default for Point6D {
    fn default() -> Self {
        Point6D {
            x: 0.0, y: 0.0, z: 0.0,
            a: 0.0, b: 0.0, c: 0.0,
        }
    }
}

/// Normalize angle to -180 to +180 degrees
fn normalize_angle(angle: f64) -> f64 {
    let mut a = angle % 360.0;
    if a > 180.0 {
        a -= 360.0;
    } else if a < -180.0 {
        a += 360.0;
    }
    a
}

/// Compute smallest angle difference between two angles
fn smallest_angle_difference(a1: f64, a2: f64) -> f64 {
    let mut diff = (a2 - a1) % 360.0;
    if diff > 180.0 {
        diff -= 360.0;
    } else if diff < -180.0 {
        diff += 360.0;
    }
    diff.abs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linear_point_creation() {
        let p = Point6D::linear(10.0, 20.0, 5.0);
        assert_eq!(p.x, 10.0);
        assert_eq!(p.y, 20.0);
        assert_eq!(p.z, 5.0);
        assert_eq!(p.a, 0.0);
        assert_eq!(p.b, 0.0);
        assert_eq!(p.c, 0.0);
    }

    #[test]
    fn test_4axis_point_creation() {
        let p = Point6D::with_a_axis(10.0, 20.0, 5.0, 45.0);
        assert_eq!(p.a, 45.0);
        assert_eq!(p.b, 0.0);
        assert_eq!(p.c, 0.0);
    }

    #[test]
    fn test_5axis_ac_point_creation() {
        let p = Point6D::with_ac_axes(10.0, 20.0, 5.0, 45.0, 90.0);
        assert_eq!(p.a, 45.0);
        assert_eq!(p.b, 0.0);
        assert_eq!(p.c, 90.0);
    }

    #[test]
    fn test_full_point_creation() {
        let p = Point6D::full(10.0, 20.0, 5.0, 45.0, 30.0, 90.0);
        assert_eq!(p.a, 45.0);
        assert_eq!(p.b, 30.0);
        assert_eq!(p.c, 90.0);
    }

    #[test]
    fn test_has_rotary_motion() {
        let p1 = Point6D::linear(10.0, 20.0, 5.0);
        assert!(!p1.has_rotary_motion());

        let p2 = Point6D::with_a_axis(10.0, 20.0, 5.0, 0.0001);
        assert!(p2.has_rotary_motion());
    }

    #[test]
    fn test_normalize_angles() {
        let mut p = Point6D::full(0.0, 0.0, 0.0, 450.0, -270.0, 180.0);
        p.normalize_angles();
        assert!((p.a - 90.0).abs() < 1e-6);
        assert!((p.b - 90.0).abs() < 1e-6);
        // 180 stays as 180 after normalization (both 180 and -180 are equivalent)
        assert!((p.c.abs() - 180.0).abs() < 1e-6);
    }

    #[test]
    fn test_distance_linear() {
        let p1 = Point6D::linear(0.0, 0.0, 0.0);
        let p2 = Point6D::linear(3.0, 4.0, 0.0);
        assert_eq!(p1.distance_linear(&p2), 5.0);
    }

    #[test]
    fn test_distance_angular() {
        let p1 = Point6D::with_a_axis(0.0, 0.0, 0.0, 0.0);
        let p2 = Point6D::with_a_axis(0.0, 0.0, 0.0, 90.0);
        assert!((p1.distance_angular(&p2) - 90.0).abs() < 1e-6);
    }

    #[test]
    fn test_serialization() {
        let p = Point6D::full(10.0, 20.0, 5.0, 45.0, 30.0, 90.0);
        let json = serde_json::to_string(&p).unwrap();
        let p2: Point6D = serde_json::from_str(&json).unwrap();
        assert_eq!(p, p2);
    }

    #[test]
    fn test_display() {
        let p = Point6D::linear(10.0, 20.0, 5.0);
        let s = format!("{}", p);
        assert!(s.contains("10.00"));
        assert!(s.contains("20.00"));
        assert!(s.contains("5.00"));
    }
}
