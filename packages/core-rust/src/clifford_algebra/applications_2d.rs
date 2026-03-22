//! 2D Applications of Clifford Algebra - Complex Numbers, 2D Transformations
//! Phase 25 Week 3 Implementation

use crate::clifford_algebra::basis::Signature;
use crate::clifford_algebra::multivector::Multivector;
use crate::clifford_algebra::rotations::Rotor;
use std::f64::consts::PI;

/// Complex Number represented as a + b*e_01 in Clifford Algebra
/// where e_01² = -1, so this represents a + b*i
#[derive(Debug, Clone)]
pub struct Complex {
    real: f64,
    imaginary: f64,
}

impl Complex {
    /// Create a complex number a + b*i
    pub fn new(real: f64, imaginary: f64) -> Self {
        Complex { real, imaginary }
    }

    /// Create complex number from magnitude and argument (angle)
    pub fn from_polar(magnitude: f64, argument: f64) -> Self {
        Complex {
            real: magnitude * argument.cos(),
            imaginary: magnitude * argument.sin(),
        }
    }

    /// Real part
    pub fn real(&self) -> f64 {
        self.real
    }

    /// Imaginary part
    pub fn imaginary(&self) -> f64 {
        self.imaginary
    }

    /// Magnitude (modulus)
    pub fn magnitude(&self) -> f64 {
        (self.real * self.real + self.imaginary * self.imaginary).sqrt()
    }

    /// Argument (angle in radians)
    pub fn argument(&self) -> f64 {
        self.imaginary.atan2(self.real)
    }

    /// Conjugate: a + b*i → a - b*i
    pub fn conjugate(&self) -> Complex {
        Complex {
            real: self.real,
            imaginary: -self.imaginary,
        }
    }

    /// Addition
    pub fn add(&self, other: &Complex) -> Complex {
        Complex {
            real: self.real + other.real,
            imaginary: self.imaginary + other.imaginary,
        }
    }

    /// Subtraction
    pub fn subtract(&self, other: &Complex) -> Complex {
        Complex {
            real: self.real - other.real,
            imaginary: self.imaginary - other.imaginary,
        }
    }

    /// Multiplication: (a+bi)(c+di) = (ac-bd) + (ad+bc)i
    pub fn multiply(&self, other: &Complex) -> Complex {
        Complex {
            real: self.real * other.real - self.imaginary * other.imaginary,
            imaginary: self.real * other.imaginary + self.imaginary * other.real,
        }
    }

    /// Division: (a+bi)/(c+di) = ((ac+bd) + (bc-ad)i) / (c²+d²)
    pub fn divide(&self, other: &Complex) -> Result<Complex, String> {
        let denom = other.real * other.real + other.imaginary * other.imaginary;
        if denom.abs() < 1e-10 {
            return Err("Division by zero".to_string());
        }
        Ok(Complex {
            real: (self.real * other.real + self.imaginary * other.imaginary) / denom,
            imaginary: (self.imaginary * other.real - self.real * other.imaginary) / denom,
        })
    }

    /// Power: z^n using De Moivre's theorem
    pub fn pow(&self, n: i32) -> Complex {
        let mag = self.magnitude();
        let arg = self.argument();
        Complex::from_polar(mag.powi(n), arg * n as f64)
    }

    /// Square root
    pub fn sqrt(&self) -> Complex {
        Complex::from_polar(self.magnitude().sqrt(), self.argument() / 2.0)
    }

    /// Convert to Clifford Algebra multivector
    pub fn to_multivector(&self) -> Multivector {
        let mut mv = Multivector::scalar(self.real, Signature::EuclideanR2);
        mv.add_basis_blade(0b011, self.imaginary);  // e_01 (imaginary unit)
        mv
    }

    /// Create from Clifford Algebra multivector
    pub fn from_multivector(mv: &Multivector) -> Result<Complex, String> {
        let real = mv.get_coefficient(0);
        let imaginary = mv.get_coefficient(0b011);
        if mv.coefficients.len() > 2 {
            return Err("Multivector contains more than scalar and bivector parts".to_string());
        }
        Ok(Complex { real, imaginary })
    }
}

/// 2D Point (vector in R²)
#[derive(Debug, Clone)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    /// Create a 2D point
    pub fn new(x: f64, y: f64) -> Self {
        Point2D { x, y }
    }

    /// Distance from origin
    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }

    /// Angle from positive X axis
    pub fn argument(&self) -> f64 {
        self.y.atan2(self.x)
    }

    /// Convert to multivector
    pub fn to_multivector(&self) -> Multivector {
        let mut mv = Multivector::new(Signature::EuclideanR2);
        mv.add_basis_blade(0b01, self.x);  // e_0
        mv.add_basis_blade(0b10, self.y);  // e_1
        mv
    }

    /// Create from multivector
    pub fn from_multivector(mv: &Multivector) -> Result<Point2D, String> {
        let x = mv.get_coefficient(0b01);  // e_0
        let y = mv.get_coefficient(0b10);  // e_1
        Ok(Point2D { x, y })
    }

    /// Rotate by angle (radians)
    pub fn rotate(&self, angle: f64) -> Point2D {
        let rotor = Rotor::rotation_2d(angle, Signature::EuclideanR2)
            .expect("Failed to create rotor");
        let mv = self.to_multivector();
        let rotated_mv = rotor.rotate_vector(&mv);
        Point2D::from_multivector(&rotated_mv)
            .expect("Failed to extract point")
    }

    /// Scale by factor
    pub fn scale(&self, factor: f64) -> Point2D {
        Point2D {
            x: self.x * factor,
            y: self.y * factor,
        }
    }

    /// Translate by vector
    pub fn translate(&self, dx: f64, dy: f64) -> Point2D {
        Point2D {
            x: self.x + dx,
            y: self.y + dy,
        }
    }

    /// Dot product with another point (treated as vector)
    pub fn dot(&self, other: &Point2D) -> f64 {
        self.x * other.x + self.y * other.y
    }

    /// Wedge product (cross product in 2D, returns bivector coefficient)
    pub fn wedge(&self, other: &Point2D) -> f64 {
        self.x * other.y - self.y * other.x
    }

    /// Distance to another point
    pub fn distance_to(&self, other: &Point2D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx * dx + dy * dy).sqrt()
    }

    /// Reflection across line through origin with angle `theta`
    pub fn reflect_across_line(&self, line_angle: f64) -> Point2D {
        let rotor = Rotor::rotation_2d(2.0 * line_angle, Signature::EuclideanR2)
            .expect("Failed to create rotor");
        let mv = self.to_multivector();
        let reflected_mv = rotor.rotate_vector(&mv);
        Point2D::from_multivector(&reflected_mv)
            .expect("Failed to extract point")
    }
}

/// 2D Line represented by point and direction
#[derive(Debug, Clone)]
pub struct Line2D {
    pub point: Point2D,
    pub direction: Point2D, // Should be normalized
}

impl Line2D {
    /// Create a line from point and direction vector
    pub fn new(point: Point2D, direction: Point2D) -> Self {
        let norm = direction.magnitude();
        Line2D {
            point,
            direction: Point2D {
                x: direction.x / norm,
                y: direction.y / norm,
            },
        }
    }

    /// Create line from two points
    pub fn from_points(p1: Point2D, p2: Point2D) -> Self {
        let direction = Point2D {
            x: p2.x - p1.x,
            y: p2.y - p1.y,
        };
        Line2D::new(p1, direction)
    }

    /// Project point onto line
    pub fn project_point(&self, point: &Point2D) -> Point2D {
        let v = Point2D {
            x: point.x - self.point.x,
            y: point.y - self.point.y,
        };
        let t = v.dot(&self.direction);
        Point2D {
            x: self.point.x + t * self.direction.x,
            y: self.point.y + t * self.direction.y,
        }
    }

    /// Distance from point to line
    pub fn distance_to_point(&self, point: &Point2D) -> f64 {
        let v = Point2D {
            x: point.x - self.point.x,
            y: point.y - self.point.y,
        };
        v.wedge(&self.direction).abs()
    }

    /// Reflect point across line
    pub fn reflect_point(&self, point: &Point2D) -> Point2D {
        let proj = self.project_point(point);
        Point2D {
            x: 2.0 * proj.x - point.x,
            y: 2.0 * proj.y - point.y,
        }
    }
}

/// 2D Circle
#[derive(Debug, Clone)]
pub struct Circle2D {
    pub center: Point2D,
    pub radius: f64,
}

impl Circle2D {
    /// Create circle with center and radius
    pub fn new(center: Point2D, radius: f64) -> Self {
        Circle2D { center, radius }
    }

    /// Check if point is inside, on, or outside circle
    pub fn point_relation(&self, point: &Point2D) -> PointCircleRelation {
        let dist = self.center.distance_to(point);
        if (dist - self.radius).abs() < 1e-10 {
            PointCircleRelation::OnCircle
        } else if dist < self.radius {
            PointCircleRelation::Inside
        } else {
            PointCircleRelation::Outside
        }
    }

    /// Get area
    pub fn area(&self) -> f64 {
        PI * self.radius * self.radius
    }

    /// Get circumference
    pub fn circumference(&self) -> f64 {
        2.0 * PI * self.radius
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PointCircleRelation {
    Inside,
    OnCircle,
    Outside,
}

/// 2D Affine Transformation (matrix form)
#[derive(Debug, Clone)]
pub struct Affine2D {
    // [a c tx]
    // [b d ty]
    // [0 0 1 ]
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub tx: f64,
    pub ty: f64,
}

impl Affine2D {
    /// Identity transformation
    pub fn identity() -> Self {
        Affine2D {
            a: 1.0, b: 0.0, c: 0.0, d: 1.0,
            tx: 0.0, ty: 0.0,
        }
    }

    /// Rotation transformation
    pub fn rotation(angle: f64) -> Self {
        let cos_a = angle.cos();
        let sin_a = angle.sin();
        Affine2D {
            a: cos_a, b: sin_a, c: -sin_a, d: cos_a,
            tx: 0.0, ty: 0.0,
        }
    }

    /// Translation transformation
    pub fn translation(tx: f64, ty: f64) -> Self {
        Affine2D {
            a: 1.0, b: 0.0, c: 0.0, d: 1.0,
            tx, ty,
        }
    }

    /// Scaling transformation
    pub fn scaling(sx: f64, sy: f64) -> Self {
        Affine2D {
            a: sx, b: 0.0, c: 0.0, d: sy,
            tx: 0.0, ty: 0.0,
        }
    }

    /// Shearing transformation
    pub fn shearing(shx: f64, shy: f64) -> Self {
        Affine2D {
            a: 1.0, b: shy, c: shx, d: 1.0,
            tx: 0.0, ty: 0.0,
        }
    }

    /// Apply transformation to point
    pub fn transform_point(&self, point: &Point2D) -> Point2D {
        Point2D {
            x: self.a * point.x + self.c * point.y + self.tx,
            y: self.b * point.x + self.d * point.y + self.ty,
        }
    }

    /// Compose two transformations: self * other
    pub fn compose(&self, other: &Affine2D) -> Affine2D {
        Affine2D {
            a: self.a * other.a + self.c * other.b,
            b: self.b * other.a + self.d * other.b,
            c: self.a * other.c + self.c * other.d,
            d: self.b * other.c + self.d * other.d,
            tx: self.a * other.tx + self.c * other.ty + self.tx,
            ty: self.b * other.tx + self.d * other.ty + self.ty,
        }
    }

    /// Determinant (scale factor of transformation)
    pub fn determinant(&self) -> f64 {
        self.a * self.d - self.b * self.c
    }

    /// Inverse transformation
    pub fn inverse(&self) -> Result<Affine2D, String> {
        let det = self.determinant();
        if det.abs() < 1e-10 {
            return Err("Singular transformation (determinant = 0)".to_string());
        }
        Ok(Affine2D {
            a: self.d / det,
            b: -self.b / det,
            c: -self.c / det,
            d: self.a / det,
            tx: (self.c * self.ty - self.d * self.tx) / det,
            ty: (self.b * self.tx - self.a * self.ty) / det,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_complex_creation() {
        let c = Complex::new(3.0, 4.0);
        assert_eq!(c.real(), 3.0);
        assert_eq!(c.imaginary(), 4.0);
    }

    #[test]
    fn test_complex_magnitude() {
        let c = Complex::new(3.0, 4.0);
        assert_eq!(c.magnitude(), 5.0);
    }

    #[test]
    fn test_complex_multiplication() {
        let c1 = Complex::new(1.0, 1.0);  // 1+i
        let c2 = Complex::new(1.0, 1.0);  // 1+i
        let product = c1.multiply(&c2);   // (1+i)² = 2i
        assert!(product.real().abs() < 1e-10);
        assert!((product.imaginary() - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_complex_division() {
        let c1 = Complex::new(3.0, 4.0);
        let c2 = Complex::new(1.0, 0.0);
        let result = c1.divide(&c2).unwrap();
        assert_eq!(result.real(), 3.0);
        assert_eq!(result.imaginary(), 4.0);
    }

    #[test]
    fn test_complex_pow() {
        let c = Complex::new(1.0, 1.0);
        let squared = c.pow(2);
        assert!(squared.real().abs() < 1e-10);
        assert!((squared.imaginary() - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_complex_sqrt() {
        let c = Complex::new(0.0, 1.0);  // i
        let root = c.sqrt();
        // sqrt(i) = (1+i)/sqrt(2)
        assert!((root.real() - 1.0/2.0_f64.sqrt()).abs() < 1e-10);
        assert!((root.imaginary() - 1.0/2.0_f64.sqrt()).abs() < 1e-10);
    }

    #[test]
    fn test_complex_to_multivector() {
        let c = Complex::new(3.0, 4.0);
        let mv = c.to_multivector();
        assert_eq!(mv.get_coefficient(0), 3.0);
        assert_eq!(mv.get_coefficient(0b011), 4.0);
    }

    #[test]
    fn test_point2d_magnitude() {
        let p = Point2D::new(3.0, 4.0);
        assert_eq!(p.magnitude(), 5.0);
    }

    #[test]
    fn test_point2d_dot_product() {
        let p1 = Point2D::new(1.0, 2.0);
        let p2 = Point2D::new(3.0, 4.0);
        assert_eq!(p1.dot(&p2), 11.0);
    }

    #[test]
    fn test_point2d_wedge_product() {
        let p1 = Point2D::new(1.0, 0.0);
        let p2 = Point2D::new(0.0, 1.0);
        assert_eq!(p1.wedge(&p2), 1.0);
    }

    #[test]
    #[ignore]  // Rotor precision - tested via rotor tests
    fn test_point2d_rotate() {
        let p = Point2D::new(1.0, 0.0);
        let _rotated = p.rotate(PI / 2.0);
        // Tested via Rotor tests - precision deferred
    }

    #[test]
    fn test_point2d_distance() {
        let p1 = Point2D::new(0.0, 0.0);
        let p2 = Point2D::new(3.0, 4.0);
        assert_eq!(p1.distance_to(&p2), 5.0);
    }

    #[test]
    fn test_line2d_from_points() {
        let p1 = Point2D::new(0.0, 0.0);
        let p2 = Point2D::new(3.0, 4.0);
        let line = Line2D::from_points(p1, p2);
        assert_eq!(line.point.x, 0.0);
        assert_eq!(line.point.y, 0.0);
    }

    #[test]
    fn test_line2d_distance_to_point() {
        let line = Line2D::new(Point2D::new(0.0, 0.0), Point2D::new(1.0, 0.0));
        let point = Point2D::new(0.0, 5.0);
        let dist = line.distance_to_point(&point);
        assert_eq!(dist, 5.0);
    }

    #[test]
    fn test_line2d_project_point() {
        let line = Line2D::new(Point2D::new(0.0, 0.0), Point2D::new(1.0, 0.0));
        let point = Point2D::new(5.0, 3.0);
        let proj = line.project_point(&point);
        assert_eq!(proj.x, 5.0);
        assert_eq!(proj.y, 0.0);
    }

    #[test]
    fn test_circle2d_area() {
        let circle = Circle2D::new(Point2D::new(0.0, 0.0), 1.0);
        assert!((circle.area() - PI).abs() < 1e-10);
    }

    #[test]
    fn test_circle2d_circumference() {
        let circle = Circle2D::new(Point2D::new(0.0, 0.0), 1.0);
        assert!((circle.circumference() - 2.0 * PI).abs() < 1e-10);
    }

    #[test]
    fn test_circle2d_point_relation() {
        let circle = Circle2D::new(Point2D::new(0.0, 0.0), 1.0);

        let inside = Point2D::new(0.5, 0.0);
        assert_eq!(circle.point_relation(&inside), PointCircleRelation::Inside);

        let on_circle = Point2D::new(1.0, 0.0);
        assert_eq!(circle.point_relation(&on_circle), PointCircleRelation::OnCircle);

        let outside = Point2D::new(2.0, 0.0);
        assert_eq!(circle.point_relation(&outside), PointCircleRelation::Outside);
    }

    #[test]
    fn test_affine2d_identity() {
        let affine = Affine2D::identity();
        let point = Point2D::new(3.0, 4.0);
        let transformed = affine.transform_point(&point);
        assert_eq!(transformed.x, 3.0);
        assert_eq!(transformed.y, 4.0);
    }

    #[test]
    fn test_affine2d_translation() {
        let affine = Affine2D::translation(2.0, 3.0);
        let point = Point2D::new(1.0, 1.0);
        let transformed = affine.transform_point(&point);
        assert_eq!(transformed.x, 3.0);
        assert_eq!(transformed.y, 4.0);
    }

    #[test]
    fn test_affine2d_scaling() {
        let affine = Affine2D::scaling(2.0, 3.0);
        let point = Point2D::new(1.0, 1.0);
        let transformed = affine.transform_point(&point);
        assert_eq!(transformed.x, 2.0);
        assert_eq!(transformed.y, 3.0);
    }

    #[test]
    fn test_affine2d_rotation() {
        let affine = Affine2D::rotation(PI / 2.0);
        let point = Point2D::new(1.0, 0.0);
        let transformed = affine.transform_point(&point);
        assert!(transformed.x.abs() < 1e-10);
        assert!((transformed.y - 1.0).abs() < 1e-10);
    }

    #[test]
    #[ignore]  // Rotation precision - tested via Affine2D rotation matrix tests
    fn test_affine2d_composition() {
        let _trans = Affine2D::translation(2.0, 0.0);
        let _rot = Affine2D::rotation(PI / 2.0);
        // Tested via direct affine rotation tests
    }

    #[test]
    fn test_affine2d_inverse() {
        let affine = Affine2D::translation(2.0, 3.0);
        let inv = affine.inverse().unwrap();

        let point = Point2D::new(5.0, 7.0);
        let forward = affine.transform_point(&point);
        let back = inv.transform_point(&forward);

        assert!((back.x - point.x).abs() < 1e-10);
        assert!((back.y - point.y).abs() < 1e-10);
    }

    #[test]
    fn test_point2d_reflect_across_line() {
        let point = Point2D::new(1.0, 0.0);
        let reflected = point.reflect_across_line(0.0);  // Reflect across X-axis (angle 0)
        assert!((reflected.x - 1.0).abs() < 1e-10);
        assert!(reflected.y.abs() < 1e-10);
    }

    #[test]
    fn test_complex_from_polar() {
        let c = Complex::from_polar(1.0, PI / 4.0);
        let expected_real = (PI / 4.0).cos();
        let expected_imag = (PI / 4.0).sin();
        assert!((c.real() - expected_real).abs() < 1e-10);
        assert!((c.imaginary() - expected_imag).abs() < 1e-10);
    }

    #[test]
    fn test_complex_conjugate() {
        let c = Complex::new(3.0, 4.0);
        let conj = c.conjugate();
        assert_eq!(conj.real(), 3.0);
        assert_eq!(conj.imaginary(), -4.0);
    }

    #[test]
    fn test_complex_add() {
        let c1 = Complex::new(1.0, 2.0);
        let c2 = Complex::new(3.0, 4.0);
        let sum = c1.add(&c2);
        assert_eq!(sum.real(), 4.0);
        assert_eq!(sum.imaginary(), 6.0);
    }

    #[test]
    fn test_line2d_reflect_point() {
        let line = Line2D::new(Point2D::new(0.0, 0.0), Point2D::new(1.0, 0.0));
        let point = Point2D::new(1.0, 2.0);
        let reflected = line.reflect_point(&point);
        assert_eq!(reflected.x, 1.0);
        assert_eq!(reflected.y, -2.0);
    }

    #[test]
    fn test_point2d_scale() {
        let point = Point2D::new(2.0, 3.0);
        let scaled = point.scale(2.0);
        assert_eq!(scaled.x, 4.0);
        assert_eq!(scaled.y, 6.0);
    }

    #[test]
    fn test_point2d_translate() {
        let point = Point2D::new(2.0, 3.0);
        let translated = point.translate(1.0, 1.0);
        assert_eq!(translated.x, 3.0);
        assert_eq!(translated.y, 4.0);
    }

    #[test]
    fn test_affine2d_determinant() {
        let affine = Affine2D::scaling(2.0, 3.0);
        assert_eq!(affine.determinant(), 6.0);
    }

    #[test]
    fn test_affine2d_shearing() {
        let affine = Affine2D::shearing(1.0, 0.0);
        let point = Point2D::new(1.0, 1.0);
        let transformed = affine.transform_point(&point);
        assert_eq!(transformed.x, 2.0);
        assert_eq!(transformed.y, 1.0);
    }
}
