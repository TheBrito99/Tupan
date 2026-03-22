//! 3D Applications of Clifford Algebra - Quaternions, 3D Transformations, Geometric Primitives
//! Phase 25 Week 4 Implementation

use crate::clifford_algebra::basis::Signature;
use crate::clifford_algebra::multivector::Multivector;
use crate::clifford_algebra::rotations::Rotor;
use std::f64::consts::PI;

/// Quaternion represented as a + b*e_01 + c*e_02 + d*e_12 in Clifford Algebra
/// where {e_01, e_02, e_12} form the quaternion basis {i, j, k}
#[derive(Debug, Clone)]
pub struct Quaternion {
    w: f64,  // scalar part
    x: f64,  // i component (e_01)
    y: f64,  // j component (e_02)
    z: f64,  // k component (e_12)
}

impl Quaternion {
    /// Create a quaternion w + x*i + y*j + z*k
    pub fn new(w: f64, x: f64, y: f64, z: f64) -> Self {
        Quaternion { w, x, y, z }
    }

    /// Identity quaternion
    pub fn identity() -> Self {
        Quaternion { w: 1.0, x: 0.0, y: 0.0, z: 0.0 }
    }

    /// Create from rotor (for rotations)
    pub fn from_rotor(rotor: &Rotor) -> Result<Quaternion, String> {
        let mv = rotor.as_multivector();
        Ok(Quaternion {
            w: mv.get_coefficient(0),
            x: mv.get_coefficient(0b011),      // e_01
            y: mv.get_coefficient(0b101),      // e_02
            z: mv.get_coefficient(0b110),      // e_12
        })
    }

    /// Magnitude (norm)
    pub fn magnitude(&self) -> f64 {
        (self.w * self.w + self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    /// Normalize to unit quaternion
    pub fn normalize(&self) -> Quaternion {
        let mag = self.magnitude();
        if mag.abs() < 1e-10 {
            Quaternion::identity()
        } else {
            Quaternion {
                w: self.w / mag,
                x: self.x / mag,
                y: self.y / mag,
                z: self.z / mag,
            }
        }
    }

    /// Conjugate: w - x*i - y*j - z*k
    pub fn conjugate(&self) -> Quaternion {
        Quaternion {
            w: self.w,
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }

    /// Multiply two quaternions
    pub fn multiply(&self, other: &Quaternion) -> Quaternion {
        Quaternion {
            w: self.w*other.w - self.x*other.x - self.y*other.y - self.z*other.z,
            x: self.w*other.x + self.x*other.w + self.y*other.z - self.z*other.y,
            y: self.w*other.y - self.x*other.z + self.y*other.w + self.z*other.x,
            z: self.w*other.z + self.x*other.y - self.y*other.x + self.z*other.w,
        }
    }

    /// Convert to multivector
    pub fn to_multivector(&self) -> Multivector {
        let mut mv = Multivector::scalar(self.w, Signature::EuclideanR3);
        mv.add_basis_blade(0b011, self.x);  // e_01
        mv.add_basis_blade(0b101, self.y);  // e_02
        mv.add_basis_blade(0b110, self.z);  // e_12
        mv
    }
}

/// 3D Point (vector)
#[derive(Debug, Clone)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    /// Create a 3D point
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Point3D { x, y, z }
    }

    /// Distance from origin
    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    /// Dot product
    pub fn dot(&self, other: &Point3D) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    /// Cross product (returns 3D vector)
    pub fn cross(&self, other: &Point3D) -> Point3D {
        Point3D {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }

    /// Distance to another point
    pub fn distance_to(&self, other: &Point3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    /// Rotate using rotor
    pub fn rotate(&self, rotor: &Rotor) -> Point3D {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0b001, self.x);  // e_0
        mv.add_basis_blade(0b010, self.y);  // e_1
        mv.add_basis_blade(0b100, self.z);  // e_2

        let rotated_mv = rotor.rotate_vector(&mv);

        Point3D {
            x: rotated_mv.get_coefficient(0b001),
            y: rotated_mv.get_coefficient(0b010),
            z: rotated_mv.get_coefficient(0b100),
        }
    }

    /// Reflect across plane defined by normal vector
    pub fn reflect_across_plane(&self, normal: &Point3D) -> Point3D {
        let n_normalized = Point3D {
            x: normal.x / normal.magnitude(),
            y: normal.y / normal.magnitude(),
            z: normal.z / normal.magnitude(),
        };

        let dot_product = self.dot(&n_normalized);
        Point3D {
            x: self.x - 2.0 * dot_product * n_normalized.x,
            y: self.y - 2.0 * dot_product * n_normalized.y,
            z: self.z - 2.0 * dot_product * n_normalized.z,
        }
    }

    /// Normalize to unit vector
    pub fn normalize(&self) -> Point3D {
        let mag = self.magnitude();
        if mag.abs() < 1e-10 {
            Point3D::new(0.0, 0.0, 0.0)
        } else {
            Point3D {
                x: self.x / mag,
                y: self.y / mag,
                z: self.z / mag,
            }
        }
    }
}

/// 3D Plane defined by normal vector and distance from origin
#[derive(Debug, Clone)]
pub struct Plane3D {
    pub normal: Point3D,
    pub d: f64,  // distance from origin
}

impl Plane3D {
    /// Create plane from normal and point on plane
    pub fn from_point_and_normal(point: &Point3D, normal: &Point3D) -> Self {
        let n_normalized = normal.normalize();
        let d = -(n_normalized.dot(point));
        Plane3D {
            normal: n_normalized,
            d,
        }
    }

    /// Create plane from three points
    pub fn from_three_points(p1: &Point3D, p2: &Point3D, p3: &Point3D) -> Self {
        let v1 = Point3D::new(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        let v2 = Point3D::new(p3.x - p1.x, p3.y - p1.y, p3.z - p1.z);
        let normal = v1.cross(&v2);
        Plane3D::from_point_and_normal(p1, &normal)
    }

    /// Distance from point to plane
    pub fn distance_to_point(&self, point: &Point3D) -> f64 {
        (self.normal.dot(point) + self.d).abs()
    }

    /// Project point onto plane
    pub fn project_point(&self, point: &Point3D) -> Point3D {
        let t = self.normal.dot(point) + self.d;
        Point3D {
            x: point.x - t * self.normal.x,
            y: point.y - t * self.normal.y,
            z: point.z - t * self.normal.z,
        }
    }

    /// Reflect point across plane
    pub fn reflect_point(&self, point: &Point3D) -> Point3D {
        let t = 2.0 * (self.normal.dot(point) + self.d);
        Point3D {
            x: point.x - t * self.normal.x,
            y: point.y - t * self.normal.y,
            z: point.z - t * self.normal.z,
        }
    }
}

/// 3D Sphere
#[derive(Debug, Clone)]
pub struct Sphere3D {
    pub center: Point3D,
    pub radius: f64,
}

impl Sphere3D {
    /// Create sphere
    pub fn new(center: Point3D, radius: f64) -> Self {
        Sphere3D { center, radius }
    }

    /// Check if point is inside, on, or outside sphere
    pub fn point_relation(&self, point: &Point3D) -> PointSphereRelation {
        let dist = self.center.distance_to(point);
        if (dist - self.radius).abs() < 1e-10 {
            PointSphereRelation::OnSphere
        } else if dist < self.radius {
            PointSphereRelation::Inside
        } else {
            PointSphereRelation::Outside
        }
    }

    /// Volume
    pub fn volume(&self) -> f64 {
        (4.0 / 3.0) * PI * self.radius * self.radius * self.radius
    }

    /// Surface area
    pub fn surface_area(&self) -> f64 {
        4.0 * PI * self.radius * self.radius
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PointSphereRelation {
    Inside,
    OnSphere,
    Outside,
}

/// 3D Line
#[derive(Debug, Clone)]
pub struct Line3D {
    pub point: Point3D,
    pub direction: Point3D,
}

impl Line3D {
    /// Create line from point and direction
    pub fn new(point: Point3D, direction: Point3D) -> Self {
        let dir_norm = direction.normalize();
        Line3D {
            point,
            direction: dir_norm,
        }
    }

    /// Create line from two points
    pub fn from_points(p1: Point3D, p2: Point3D) -> Self {
        let direction = Point3D {
            x: p2.x - p1.x,
            y: p2.y - p1.y,
            z: p2.z - p1.z,
        };
        Line3D::new(p1, direction)
    }

    /// Closest point on line to given point
    pub fn closest_point_to(&self, point: &Point3D) -> Point3D {
        let v = Point3D {
            x: point.x - self.point.x,
            y: point.y - self.point.y,
            z: point.z - self.point.z,
        };
        let t = v.dot(&self.direction);
        Point3D {
            x: self.point.x + t * self.direction.x,
            y: self.point.y + t * self.direction.y,
            z: self.point.z + t * self.direction.z,
        }
    }

    /// Distance from line to point
    pub fn distance_to_point(&self, point: &Point3D) -> f64 {
        let closest = self.closest_point_to(point);
        closest.distance_to(point)
    }
}

/// 3D Affine Transformation
#[derive(Debug, Clone)]
pub struct Affine3D {
    // 4x4 matrix representation
    m: [[f64; 4]; 4],
}

impl Affine3D {
    /// Identity transformation
    pub fn identity() -> Self {
        Affine3D {
            m: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
        }
    }

    /// Translation
    pub fn translation(tx: f64, ty: f64, tz: f64) -> Self {
        Affine3D {
            m: [
                [1.0, 0.0, 0.0, tx],
                [0.0, 1.0, 0.0, ty],
                [0.0, 0.0, 1.0, tz],
                [0.0, 0.0, 0.0, 1.0],
            ],
        }
    }

    /// Scaling
    pub fn scaling(sx: f64, sy: f64, sz: f64) -> Self {
        Affine3D {
            m: [
                [sx, 0.0, 0.0, 0.0],
                [0.0, sy, 0.0, 0.0],
                [0.0, 0.0, sz, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
        }
    }

    /// Apply to point
    pub fn transform_point(&self, point: &Point3D) -> Point3D {
        Point3D {
            x: self.m[0][0]*point.x + self.m[0][1]*point.y + self.m[0][2]*point.z + self.m[0][3],
            y: self.m[1][0]*point.x + self.m[1][1]*point.y + self.m[1][2]*point.z + self.m[1][3],
            z: self.m[2][0]*point.x + self.m[2][1]*point.y + self.m[2][2]*point.z + self.m[2][3],
        }
    }

    /// Compose transformations
    pub fn compose(&self, other: &Affine3D) -> Affine3D {
        let mut result = Affine3D::identity();
        for i in 0..4 {
            for j in 0..4 {
                result.m[i][j] = 0.0;
                for k in 0..4 {
                    result.m[i][j] += self.m[i][k] * other.m[k][j];
                }
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quaternion_identity() {
        let q = Quaternion::identity();
        assert_eq!(q.w, 1.0);
        assert_eq!(q.x, 0.0);
        assert_eq!(q.y, 0.0);
        assert_eq!(q.z, 0.0);
    }

    #[test]
    fn test_quaternion_magnitude() {
        let q = Quaternion::new(1.0, 1.0, 1.0, 1.0);
        assert_eq!(q.magnitude(), 2.0);
    }

    #[test]
    fn test_quaternion_normalize() {
        let q = Quaternion::new(1.0, 1.0, 1.0, 1.0);
        let n = q.normalize();
        assert!((n.magnitude() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_quaternion_conjugate() {
        let q = Quaternion::new(1.0, 2.0, 3.0, 4.0);
        let conj = q.conjugate();
        assert_eq!(conj.w, 1.0);
        assert_eq!(conj.x, -2.0);
        assert_eq!(conj.y, -3.0);
        assert_eq!(conj.z, -4.0);
    }

    #[test]
    fn test_quaternion_multiply() {
        let q1 = Quaternion::new(1.0, 0.0, 0.0, 0.0);
        let q2 = Quaternion::new(2.0, 0.0, 0.0, 0.0);
        let prod = q1.multiply(&q2);
        assert_eq!(prod.w, 2.0);
        assert_eq!(prod.x, 0.0);
    }

    #[test]
    fn test_point3d_magnitude() {
        let p = Point3D::new(1.0, 2.0, 2.0);
        assert_eq!(p.magnitude(), 3.0);
    }

    #[test]
    fn test_point3d_dot_product() {
        let p1 = Point3D::new(1.0, 2.0, 3.0);
        let p2 = Point3D::new(4.0, 5.0, 6.0);
        assert_eq!(p1.dot(&p2), 32.0);
    }

    #[test]
    fn test_point3d_cross_product() {
        let p1 = Point3D::new(1.0, 0.0, 0.0);
        let p2 = Point3D::new(0.0, 1.0, 0.0);
        let cross = p1.cross(&p2);
        assert_eq!(cross.x, 0.0);
        assert_eq!(cross.y, 0.0);
        assert_eq!(cross.z, 1.0);
    }

    #[test]
    fn test_point3d_distance() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(3.0, 4.0, 0.0);
        assert_eq!(p1.distance_to(&p2), 5.0);
    }

    #[test]
    fn test_point3d_normalize() {
        let p = Point3D::new(3.0, 4.0, 0.0);
        let n = p.normalize();
        assert!((n.magnitude() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_plane3d_from_points() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(1.0, 0.0, 0.0);
        let p3 = Point3D::new(0.0, 1.0, 0.0);
        let plane = Plane3D::from_three_points(&p1, &p2, &p3);
        assert!(plane.normal.magnitude() > 0.0);
    }

    #[test]
    fn test_plane3d_distance_to_point() {
        let plane = Plane3D::from_point_and_normal(
            &Point3D::new(0.0, 0.0, 0.0),
            &Point3D::new(0.0, 0.0, 1.0),
        );
        let point = Point3D::new(0.0, 0.0, 5.0);
        assert_eq!(plane.distance_to_point(&point), 5.0);
    }

    #[test]
    fn test_plane3d_project_point() {
        let plane = Plane3D::from_point_and_normal(
            &Point3D::new(0.0, 0.0, 0.0),
            &Point3D::new(0.0, 0.0, 1.0),
        );
        let point = Point3D::new(3.0, 4.0, 5.0);
        let proj = plane.project_point(&point);
        assert_eq!(proj.z, 0.0);
    }

    #[test]
    fn test_sphere3d_volume() {
        let sphere = Sphere3D::new(Point3D::new(0.0, 0.0, 0.0), 1.0);
        let vol = sphere.volume();
        assert!((vol - (4.0 * PI / 3.0)).abs() < 1e-10);
    }

    #[test]
    fn test_sphere3d_surface_area() {
        let sphere = Sphere3D::new(Point3D::new(0.0, 0.0, 0.0), 1.0);
        let area = sphere.surface_area();
        assert!((area - (4.0 * PI)).abs() < 1e-10);
    }

    #[test]
    fn test_sphere3d_point_relation() {
        let sphere = Sphere3D::new(Point3D::new(0.0, 0.0, 0.0), 1.0);

        let inside = Point3D::new(0.5, 0.0, 0.0);
        assert_eq!(sphere.point_relation(&inside), PointSphereRelation::Inside);

        let on_sphere = Point3D::new(1.0, 0.0, 0.0);
        assert_eq!(sphere.point_relation(&on_sphere), PointSphereRelation::OnSphere);

        let outside = Point3D::new(2.0, 0.0, 0.0);
        assert_eq!(sphere.point_relation(&outside), PointSphereRelation::Outside);
    }

    #[test]
    fn test_line3d_from_points() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(1.0, 1.0, 1.0);
        let line = Line3D::from_points(p1, p2);
        assert!(line.direction.magnitude() > 0.0);
    }

    #[test]
    fn test_line3d_closest_point() {
        let line = Line3D::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(1.0, 0.0, 0.0));
        let point = Point3D::new(5.0, 3.0, 0.0);
        let closest = line.closest_point_to(&point);
        assert_eq!(closest.x, 5.0);
        assert_eq!(closest.y, 0.0);
    }

    #[test]
    fn test_line3d_distance_to_point() {
        let line = Line3D::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(1.0, 0.0, 0.0));
        let point = Point3D::new(0.0, 5.0, 0.0);
        let dist = line.distance_to_point(&point);
        assert_eq!(dist, 5.0);
    }

    #[test]
    fn test_affine3d_identity() {
        let affine = Affine3D::identity();
        let point = Point3D::new(3.0, 4.0, 5.0);
        let transformed = affine.transform_point(&point);
        assert_eq!(transformed.x, 3.0);
        assert_eq!(transformed.y, 4.0);
        assert_eq!(transformed.z, 5.0);
    }

    #[test]
    fn test_affine3d_translation() {
        let affine = Affine3D::translation(1.0, 2.0, 3.0);
        let point = Point3D::new(1.0, 1.0, 1.0);
        let transformed = affine.transform_point(&point);
        assert_eq!(transformed.x, 2.0);
        assert_eq!(transformed.y, 3.0);
        assert_eq!(transformed.z, 4.0);
    }

    #[test]
    fn test_affine3d_scaling() {
        let affine = Affine3D::scaling(2.0, 3.0, 4.0);
        let point = Point3D::new(1.0, 1.0, 1.0);
        let transformed = affine.transform_point(&point);
        assert_eq!(transformed.x, 2.0);
        assert_eq!(transformed.y, 3.0);
        assert_eq!(transformed.z, 4.0);
    }

    #[test]
    fn test_affine3d_composition() {
        let trans = Affine3D::translation(1.0, 0.0, 0.0);
        let scale = Affine3D::scaling(2.0, 1.0, 1.0);
        let composed = trans.compose(&scale);

        let point = Point3D::new(1.0, 1.0, 1.0);
        let result = composed.transform_point(&point);
        assert_eq!(result.x, 3.0);
    }

    #[test]
    fn test_point3d_reflect_across_plane() {
        let point = Point3D::new(1.0, 0.0, 0.0);
        let normal = Point3D::new(1.0, 0.0, 0.0);
        let reflected = point.reflect_across_plane(&normal);
        // Reflecting (1,0,0) across plane with normal (1,0,0) gives (-1,0,0)
        assert!((reflected.x - (-1.0)).abs() < 1e-10);
        assert!(reflected.y.abs() < 1e-10);
        assert!(reflected.z.abs() < 1e-10);
    }

    #[test]
    fn test_quaternion_to_multivector() {
        let q = Quaternion::new(1.0, 2.0, 3.0, 4.0);
        let mv = q.to_multivector();
        assert_eq!(mv.get_coefficient(0), 1.0);
        assert_eq!(mv.get_coefficient(0b011), 2.0);
    }

    #[test]
    fn test_plane3d_reflect_point() {
        let plane = Plane3D::from_point_and_normal(
            &Point3D::new(0.0, 0.0, 0.0),
            &Point3D::new(0.0, 0.0, 1.0),
        );
        let point = Point3D::new(1.0, 2.0, 5.0);
        let reflected = plane.reflect_point(&point);
        assert_eq!(reflected.x, 1.0);
        assert_eq!(reflected.y, 2.0);
        // Reflecting (1,2,5) across XY plane (z=0) gives (1,2,-5)
        assert!((reflected.z - (-5.0)).abs() < 1e-10);
    }

    #[test]
    fn test_point3d_zero_magnitude() {
        let p = Point3D::new(0.0, 0.0, 0.0);
        let n = p.normalize();
        assert_eq!(n.x, 0.0);
        assert_eq!(n.y, 0.0);
        assert_eq!(n.z, 0.0);
    }

    #[test]
    fn test_line3d_parallel_direction() {
        let l1 = Line3D::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(1.0, 1.0, 1.0));
        let l2 = Line3D::new(Point3D::new(2.0, 0.0, 0.0), Point3D::new(1.0, 1.0, 1.0));
        let d = l1.direction.distance_to(&l2.direction);
        assert!(d < 1e-10);
    }

    #[test]
    fn test_quaternion_identity_multiplication() {
        let q = Quaternion::new(2.0, 3.0, 4.0, 5.0);
        let identity = Quaternion::identity();
        let prod = identity.multiply(&q);
        assert_eq!(prod.w, q.w);
        assert_eq!(prod.x, q.x);
        assert_eq!(prod.y, q.y);
        assert_eq!(prod.z, q.z);
    }
}
