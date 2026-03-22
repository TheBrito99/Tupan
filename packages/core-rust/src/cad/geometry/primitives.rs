/**
 * Geometric Primitives
 * Phase 18 Task 1: BREP Kernel
 *
 * Core 3D mathematical primitives: points, vectors, matrices, bounding boxes
 */

use serde::{Deserialize, Serialize};
use std::f64;

// ============================================================================
// VECTOR3D AND POINT3D
// ============================================================================

/// 3D Point in space
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    /// Create a new point
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Point3D { x, y, z }
    }

    /// Origin point (0, 0, 0)
    pub fn origin() -> Self {
        Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }

    /// Distance to another point
    pub fn distance_to(&self, other: &Point3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    /// Linear interpolation between points
    pub fn lerp(&self, other: &Point3D, t: f64) -> Point3D {
        Point3D {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
            z: self.z + (other.z - self.z) * t,
        }
    }

    /// Translate point by vector
    pub fn translate(&self, v: &Vector3D) -> Point3D {
        Point3D {
            x: self.x + v.dx,
            y: self.y + v.dy,
            z: self.z + v.dz,
        }
    }

    /// Vector from this point to another
    pub fn vector_to(&self, other: &Point3D) -> Vector3D {
        Vector3D {
            dx: other.x - self.x,
            dy: other.y - self.y,
            dz: other.z - self.z,
        }
    }
}

/// 3D Vector
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Vector3D {
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
}

impl Vector3D {
    /// Create a new vector
    pub fn new(dx: f64, dy: f64, dz: f64) -> Self {
        Vector3D { dx, dy, dz }
    }

    /// Zero vector
    pub fn zero() -> Self {
        Vector3D {
            dx: 0.0,
            dy: 0.0,
            dz: 0.0,
        }
    }

    /// X-axis unit vector
    pub fn x_axis() -> Self {
        Vector3D {
            dx: 1.0,
            dy: 0.0,
            dz: 0.0,
        }
    }

    /// Y-axis unit vector
    pub fn y_axis() -> Self {
        Vector3D {
            dx: 0.0,
            dy: 1.0,
            dz: 0.0,
        }
    }

    /// Z-axis unit vector
    pub fn z_axis() -> Self {
        Vector3D {
            dx: 0.0,
            dy: 0.0,
            dz: 1.0,
        }
    }

    /// Vector magnitude (length)
    pub fn magnitude(&self) -> f64 {
        (self.dx * self.dx + self.dy * self.dy + self.dz * self.dz).sqrt()
    }

    /// Normalize vector to unit length
    pub fn normalize(&self) -> Vector3D {
        let mag = self.magnitude();
        if mag < f64::EPSILON {
            Vector3D::zero()
        } else {
            Vector3D {
                dx: self.dx / mag,
                dy: self.dy / mag,
                dz: self.dz / mag,
            }
        }
    }

    /// Try to normalize vector, returning None if magnitude is near-zero
    pub fn try_normalize(&self) -> Option<Vector3D> {
        let mag = self.magnitude();
        if mag < f64::EPSILON {
            None
        } else {
            Some(Vector3D {
                dx: self.dx / mag,
                dy: self.dy / mag,
                dz: self.dz / mag,
            })
        }
    }

    /// Dot product
    pub fn dot(&self, other: &Vector3D) -> f64 {
        self.dx * other.dx + self.dy * other.dy + self.dz * other.dz
    }

    /// Cross product
    pub fn cross(&self, other: &Vector3D) -> Vector3D {
        Vector3D {
            dx: self.dy * other.dz - self.dz * other.dy,
            dy: self.dz * other.dx - self.dx * other.dz,
            dz: self.dx * other.dy - self.dy * other.dx,
        }
    }

    /// Scalar multiplication
    pub fn scale(&self, scalar: f64) -> Vector3D {
        Vector3D {
            dx: self.dx * scalar,
            dy: self.dy * scalar,
            dz: self.dz * scalar,
        }
    }

    /// Vector addition
    pub fn add(&self, other: &Vector3D) -> Vector3D {
        Vector3D {
            dx: self.dx + other.dx,
            dy: self.dy + other.dy,
            dz: self.dz + other.dz,
        }
    }

    /// Vector subtraction
    pub fn subtract(&self, other: &Vector3D) -> Vector3D {
        Vector3D {
            dx: self.dx - other.dx,
            dy: self.dy - other.dy,
            dz: self.dz - other.dz,
        }
    }

    /// Negate vector
    pub fn negate(&self) -> Vector3D {
        Vector3D {
            dx: -self.dx,
            dy: -self.dy,
            dz: -self.dz,
        }
    }
}

// ============================================================================
// BOUNDING BOX
// ============================================================================

/// Axis-aligned bounding box
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min: Point3D,
    pub max: Point3D,
}

impl BoundingBox {
    /// Create a bounding box
    pub fn new(min: Point3D, max: Point3D) -> Self {
        // Ensure min and max are correct
        let min = Point3D::new(
            min.x.min(max.x),
            min.y.min(max.y),
            min.z.min(max.z),
        );
        let max = Point3D::new(
            min.x.max(max.x),
            min.y.max(max.y),
            min.z.max(max.z),
        );
        BoundingBox { min, max }
    }

    /// Create from single point
    pub fn from_point(p: Point3D) -> Self {
        BoundingBox { min: p, max: p }
    }

    /// Empty bounding box
    pub fn empty() -> Self {
        BoundingBox {
            min: Point3D::new(f64::INFINITY, f64::INFINITY, f64::INFINITY),
            max: Point3D::new(f64::NEG_INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY),
        }
    }

    /// Width (X extent)
    pub fn width(&self) -> f64 {
        (self.max.x - self.min.x).abs()
    }

    /// Height (Y extent)
    pub fn height(&self) -> f64 {
        (self.max.y - self.min.y).abs()
    }

    /// Depth (Z extent)
    pub fn depth(&self) -> f64 {
        (self.max.z - self.min.z).abs()
    }

    /// Volume
    pub fn volume(&self) -> f64 {
        self.width() * self.height() * self.depth()
    }

    /// Expand to include a point
    pub fn expand(&mut self, point: &Point3D) {
        if point.x < self.min.x {
            self.min.x = point.x;
        }
        if point.y < self.min.y {
            self.min.y = point.y;
        }
        if point.z < self.min.z {
            self.min.z = point.z;
        }
        if point.x > self.max.x {
            self.max.x = point.x;
        }
        if point.y > self.max.y {
            self.max.y = point.y;
        }
        if point.z > self.max.z {
            self.max.z = point.z;
        }
    }

    /// Check if point is inside bounding box
    pub fn contains(&self, point: &Point3D) -> bool {
        point.x >= self.min.x
            && point.x <= self.max.x
            && point.y >= self.min.y
            && point.y <= self.max.y
            && point.z >= self.min.z
            && point.z <= self.max.z
    }

    /// Check if two bounding boxes intersect
    pub fn intersects(&self, other: &BoundingBox) -> bool {
        !(self.max.x < other.min.x
            || self.min.x > other.max.x
            || self.max.y < other.min.y
            || self.min.y > other.max.y
            || self.max.z < other.min.z
            || self.min.z > other.max.z)
    }

    /// Expand bounding box to include another bounding box
    pub fn expand_box(&mut self, other: &BoundingBox) {
        self.expand(&other.min);
        self.expand(&other.max);
    }

    /// Center of bounding box
    pub fn center(&self) -> Point3D {
        Point3D::new(
            (self.min.x + self.max.x) / 2.0,
            (self.min.y + self.max.y) / 2.0,
            (self.min.z + self.max.z) / 2.0,
        )
    }
}

// ============================================================================
// 3X3 MATRIX (for rotations and transformations)
// ============================================================================

/// 3x3 Matrix for rotations and transformations
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Matrix3x3 {
    pub m: [[f64; 3]; 3],
}

impl Matrix3x3 {
    /// Create identity matrix
    pub fn identity() -> Self {
        Matrix3x3 {
            m: [
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
            ],
        }
    }

    /// Create rotation matrix around Z axis
    pub fn rotation_z(angle_rad: f64) -> Self {
        let cos_a = angle_rad.cos();
        let sin_a = angle_rad.sin();
        Matrix3x3 {
            m: [
                [cos_a, -sin_a, 0.0],
                [sin_a, cos_a, 0.0],
                [0.0, 0.0, 1.0],
            ],
        }
    }

    /// Create rotation matrix around arbitrary axis
    pub fn rotation_axis(axis: &Vector3D, angle_rad: f64) -> Self {
        let axis = axis.normalize();
        let cos_a = angle_rad.cos();
        let sin_a = angle_rad.sin();
        let one_minus_cos = 1.0 - cos_a;

        Matrix3x3 {
            m: [
                [
                    cos_a + axis.dx * axis.dx * one_minus_cos,
                    axis.dx * axis.dy * one_minus_cos - axis.dz * sin_a,
                    axis.dx * axis.dz * one_minus_cos + axis.dy * sin_a,
                ],
                [
                    axis.dy * axis.dx * one_minus_cos + axis.dz * sin_a,
                    cos_a + axis.dy * axis.dy * one_minus_cos,
                    axis.dy * axis.dz * one_minus_cos - axis.dx * sin_a,
                ],
                [
                    axis.dz * axis.dx * one_minus_cos - axis.dy * sin_a,
                    axis.dz * axis.dy * one_minus_cos + axis.dx * sin_a,
                    cos_a + axis.dz * axis.dz * one_minus_cos,
                ],
            ],
        }
    }

    /// Multiply matrix by vector
    pub fn multiply_vector(&self, v: &Vector3D) -> Vector3D {
        Vector3D {
            dx: self.m[0][0] * v.dx + self.m[0][1] * v.dy + self.m[0][2] * v.dz,
            dy: self.m[1][0] * v.dx + self.m[1][1] * v.dy + self.m[1][2] * v.dz,
            dz: self.m[2][0] * v.dx + self.m[2][1] * v.dy + self.m[2][2] * v.dz,
        }
    }

    /// Multiply two matrices
    pub fn multiply(&self, other: &Matrix3x3) -> Self {
        let mut result = Matrix3x3::identity();
        for i in 0..3 {
            for j in 0..3 {
                result.m[i][j] = 0.0;
                for k in 0..3 {
                    result.m[i][j] += self.m[i][k] * other.m[k][j];
                }
            }
        }
        result
    }

    /// Transpose matrix
    pub fn transpose(&self) -> Self {
        Matrix3x3 {
            m: [
                [self.m[0][0], self.m[1][0], self.m[2][0]],
                [self.m[0][1], self.m[1][1], self.m[2][1]],
                [self.m[0][2], self.m[1][2], self.m[2][2]],
            ],
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(3.0, 4.0, 0.0);
        assert!((p1.distance_to(&p2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_vector_magnitude() {
        let v = Vector3D::new(3.0, 4.0, 0.0);
        assert!((v.magnitude() - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_vector_normalize() {
        let v = Vector3D::new(3.0, 4.0, 0.0);
        let n = v.normalize();
        assert!((n.magnitude() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_vector_cross_product() {
        let v1 = Vector3D::x_axis();
        let v2 = Vector3D::y_axis();
        let v3 = v1.cross(&v2);
        let expected = Vector3D::z_axis();
        assert!((v3.dx - expected.dx).abs() < 1e-10);
        assert!((v3.dy - expected.dy).abs() < 1e-10);
        assert!((v3.dz - expected.dz).abs() < 1e-10);
    }

    #[test]
    fn test_bounding_box_contains() {
        let bb = BoundingBox::new(
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(10.0, 10.0, 10.0),
        );
        assert!(bb.contains(&Point3D::new(5.0, 5.0, 5.0)));
        assert!(!bb.contains(&Point3D::new(11.0, 5.0, 5.0)));
    }

    #[test]
    fn test_bounding_box_intersects() {
        let bb1 = BoundingBox::new(
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(10.0, 10.0, 10.0),
        );
        let bb2 = BoundingBox::new(
            Point3D::new(5.0, 5.0, 5.0),
            Point3D::new(15.0, 15.0, 15.0),
        );
        assert!(bb1.intersects(&bb2));
    }

    #[test]
    fn test_matrix_rotation() {
        let m = Matrix3x3::rotation_z(std::f64::consts::PI / 2.0);
        let v = Vector3D::x_axis();
        let rotated = m.multiply_vector(&v);
        // Rotating X-axis by 90° should give Y-axis
        assert!((rotated.dx).abs() < 1e-10);
        assert!((rotated.dy - 1.0).abs() < 1e-10);
        assert!((rotated.dz).abs() < 1e-10);
    }
}
