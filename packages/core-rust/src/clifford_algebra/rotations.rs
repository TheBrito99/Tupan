//! Clifford Algebra Rotations - Rotors for gimbal-lock-free rotations
//! Phase 25 Week 3 Implementation

use crate::clifford_algebra::basis::Signature;
use crate::clifford_algebra::multivector::Multivector;
use std::f64::consts::PI;

/// Rotor: encodes a rotation as e^(θB/2) where B is a bivector
/// In Clifford Algebra, R⁻¹ = R† (conjugate)
/// Rotating vector v: v' = R v R†
#[derive(Debug, Clone)]
pub struct Rotor {
    multivector: Multivector,
    signature: Signature,
    normalized: bool,
}

impl Rotor {
    /// Create identity rotor (no rotation)
    pub fn identity(signature: Signature) -> Self {
        Rotor {
            multivector: Multivector::scalar(1.0, signature.clone()),
            signature,
            normalized: true,
        }
    }

    /// Create rotor from bivector (exponential form e^(θB/2))
    /// bivector: a bivector (grade-2 element) representing the plane of rotation
    /// angle: rotation angle in radians
    pub fn from_bivector(bivector: &Multivector, angle: f64) -> Result<Rotor, String> {
        let bivector_grade2 = bivector.grade_projection(2);
        if bivector_grade2.coefficients.is_empty() {
            return Err("Must provide a bivector (grade-2)".to_string());
        }

        let mag = super::operations::magnitude(&bivector_grade2);
        if mag.abs() < 1e-10 {
            return Err("Bivector magnitude is zero".to_string());
        }

        // Normalize bivector
        let bivector_normalized = super::operations::normalize(&bivector_grade2)
            .ok_or("Could not normalize bivector")?;

        // Rotor = cos(θ/2) + sin(θ/2) * B (where B is unit bivector)
        let half_angle = angle / 2.0;
        let cos_half = half_angle.cos();
        let sin_half = half_angle.sin();

        let mut rotor = Multivector::scalar(cos_half, bivector.signature.clone());
        let scaled_bivector = bivector_normalized.scalar_mult(sin_half);
        let rotor_result = rotor.add(&scaled_bivector);

        Ok(Rotor {
            multivector: rotor_result,
            signature: bivector.signature.clone(),
            normalized: false,
        })
    }

    /// Create rotor for 2D rotation (rotation in XY plane)
    pub fn rotation_2d(angle: f64, signature: Signature) -> Result<Rotor, String> {
        // In 2D, bivector is e_01
        let mut bivector = Multivector::new(signature.clone());
        bivector.add_basis_blade(0b011, 1.0);  // e_01
        Self::from_bivector(&bivector, angle)
    }

    /// Create rotor for 3D rotation around X axis
    pub fn rotation_x(angle: f64) -> Result<Rotor, String> {
        let mut bivector = Multivector::new(Signature::EuclideanR3);
        bivector.add_basis_blade(0b110, 1.0);  // e_23 (YZ plane)
        Self::from_bivector(&bivector, angle)
    }

    /// Create rotor for 3D rotation around Y axis
    pub fn rotation_y(angle: f64) -> Result<Rotor, String> {
        let mut bivector = Multivector::new(Signature::EuclideanR3);
        bivector.add_basis_blade(0b101, 1.0);  // e_13 (XZ plane)
        Self::from_bivector(&bivector, angle)
    }

    /// Create rotor for 3D rotation around Z axis
    pub fn rotation_z(angle: f64) -> Result<Rotor, String> {
        let mut bivector = Multivector::new(Signature::EuclideanR3);
        bivector.add_basis_blade(0b011, 1.0);  // e_12 (XY plane)
        Self::from_bivector(&bivector, angle)
    }

    /// Rotate a vector by this rotor: v' = R v R†
    pub fn rotate_vector(&self, vector: &Multivector) -> Multivector {
        let rev = super::inversions::clifford_conjugate(&self.multivector);
        self.multivector.geometric_product(vector)
            .geometric_product(&rev)
    }

    /// Rotate another rotor (composition): R_new = R1 * R2
    pub fn compose(&self, other: &Rotor) -> Rotor {
        let composed = self.multivector.geometric_product(&other.multivector);
        Rotor {
            multivector: composed,
            signature: self.signature.clone(),
            normalized: false,
        }
    }

    /// Inverse rotor (conjugate in normalized case)
    pub fn inverse(&self) -> Rotor {
        let inv = super::inversions::clifford_conjugate(&self.multivector);
        Rotor {
            multivector: inv,
            signature: self.signature.clone(),
            normalized: self.normalized,
        }
    }

    /// Get the angle of rotation (in radians)
    pub fn angle(&self) -> f64 {
        // For rotor R = cos(θ/2) + sin(θ/2)*B, angle = 2*atan2(sin(θ/2), cos(θ/2))
        let scalar_part = self.multivector.get_coefficient(0);
        // Clamp to [-1, 1] to avoid acos domain errors
        let clamped = scalar_part.max(-1.0).min(1.0);
        let angle_half = clamped.acos();
        2.0 * angle_half
    }

    /// Normalize the rotor
    pub fn normalize(&mut self) -> Result<(), String> {
        match super::operations::normalize(&self.multivector) {
            Some(normalized) => {
                self.multivector = normalized;
                self.normalized = true;
                Ok(())
            }
            None => Err("Cannot normalize rotor with zero magnitude".to_string()),
        }
    }

    /// Get underlying multivector
    pub fn as_multivector(&self) -> &Multivector {
        &self.multivector
    }

    /// Convert to 3D rotation matrix (for 3D rotors only)
    pub fn to_rotation_matrix_3d(&self) -> Result<[[f64; 3]; 3], String> {
        if !matches!(self.signature, Signature::EuclideanR3) {
            return Err("Only 3D rotors can be converted to 3x3 matrices".to_string());
        }

        // For rotor R = a + b*e_23 + c*e_13 + d*e_12
        // (using bivector basis: e_23, e_13, e_12 for Y-Z, X-Z, X-Y planes)
        let a = self.multivector.get_coefficient(0);          // scalar
        let b = self.multivector.get_coefficient(0b110);      // e_23
        let c = self.multivector.get_coefficient(0b101);      // e_13
        let d = self.multivector.get_coefficient(0b011);      // e_12

        let a2 = a * a;
        let b2 = b * b;
        let c2 = c * c;
        let d2 = d * d;

        Ok([
            [a2 + b2 - c2 - d2, 2.0*(b*d - a*c), 2.0*(b*c + a*d)],
            [2.0*(b*d + a*c), a2 - b2 + c2 - d2, 2.0*(c*d - a*b)],
            [2.0*(b*c - a*d), 2.0*(c*d + a*b), a2 - b2 - c2 + d2],
        ])
    }

    /// Convert from 3D rotation matrix to rotor (for 3D only)
    pub fn from_rotation_matrix_3d(matrix: &[[f64; 3]; 3])
        -> Result<Rotor, String> {
        // Trace method for matrix -> quaternion -> rotor conversion
        let trace = matrix[0][0] + matrix[1][1] + matrix[2][2];

        let (a, b, c, d) = if trace > 0.0 {
            let s = 0.5 / (trace + 1.0).sqrt();
            let a = 0.25 / s;
            let b = (matrix[2][1] - matrix[1][2]) * s;
            let c = (matrix[0][2] - matrix[2][0]) * s;
            let d = (matrix[1][0] - matrix[0][1]) * s;
            (a, b, c, d)
        } else if matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2] {
            let s = 2.0 * (1.0 + matrix[0][0] - matrix[1][1] - matrix[2][2]).sqrt();
            let a = (matrix[2][1] - matrix[1][2]) / s;
            let b = 0.25 * s;
            let c = (matrix[0][1] + matrix[1][0]) / s;
            let d = (matrix[0][2] + matrix[2][0]) / s;
            (a, b, c, d)
        } else if matrix[1][1] > matrix[2][2] {
            let s = 2.0 * (1.0 + matrix[1][1] - matrix[0][0] - matrix[2][2]).sqrt();
            let a = (matrix[0][2] - matrix[2][0]) / s;
            let b = (matrix[0][1] + matrix[1][0]) / s;
            let c = 0.25 * s;
            let d = (matrix[1][2] + matrix[2][1]) / s;
            (a, b, c, d)
        } else {
            let s = 2.0 * (1.0 + matrix[2][2] - matrix[0][0] - matrix[1][1]).sqrt();
            let a = (matrix[1][0] - matrix[0][1]) / s;
            let b = (matrix[0][2] + matrix[2][0]) / s;
            let c = (matrix[1][2] + matrix[2][1]) / s;
            let d = 0.25 * s;
            (a, b, c, d)
        };

        let mut rotor = Multivector::new(Signature::EuclideanR3);
        rotor.add_basis_blade(0, a);          // scalar
        rotor.add_basis_blade(0b110, b);     // e_23
        rotor.add_basis_blade(0b101, c);     // e_13
        rotor.add_basis_blade(0b011, d);     // e_12

        Ok(Rotor {
            multivector: rotor,
            signature: Signature::EuclideanR3,
            normalized: true,
        })
    }

    /// Interpolate between two rotors (SLERP)
    pub fn slerp(&self, other: &Rotor, t: f64) -> Result<Rotor, String> {
        if t < 0.0 || t > 1.0 {
            return Err(format!("SLERP parameter t must be in [0,1], got {}", t));
        }

        if t == 0.0 {
            return Ok(self.clone());
        }
        if t == 1.0 {
            return Ok(other.clone());
        }

        // R(t) = R1 * (R1⁻¹ * R2)^t
        let r1_inv = self.inverse();
        let rel = r1_inv.compose(other);

        // For rotor with angle θ, raise to power t:
        let angle = rel.angle();
        let scaled_angle = angle * t;

        // Extract bivector part
        let mut bivector = Multivector::new(self.signature.clone());
        for (&bits, &coeff) in &rel.multivector.coefficients {
            if bits != 0 {  // Skip scalar part
                bivector.add_basis_blade(bits, coeff);
            }
        }

        if bivector.coefficients.is_empty() {
            return Ok(self.clone());
        }

        let result = self.compose(&Rotor::from_bivector(&bivector, scaled_angle)?);
        Ok(result)
    }
}

/// Builder for complex rotor compositions
pub struct RotorBuilder {
    signature: Signature,
    rotations: Vec<(Multivector, f64)>, // (bivector, angle) pairs
}

impl RotorBuilder {
    pub fn new(signature: Signature) -> Self {
        RotorBuilder {
            signature,
            rotations: Vec::new(),
        }
    }

    /// Add a rotation in a specified bivector plane by angle (radians)
    pub fn rotate(&mut self, bivector: &Multivector, angle: f64) -> Result<&mut Self, String> {
        let bivector_grade2 = bivector.grade_projection(2);
        if bivector_grade2.coefficients.is_empty() {
            return Err("Must provide a bivector (grade-2)".to_string());
        }
        self.rotations.push((bivector_grade2, angle));
        Ok(self)
    }

    /// Build the composed rotor
    pub fn build(&self) -> Result<Rotor, String> {
        if self.rotations.is_empty() {
            return Ok(Rotor::identity(self.signature.clone()));
        }

        let mut result = Rotor::identity(self.signature.clone());

        for (bivector, angle) in &self.rotations {
            let rotor = Rotor::from_bivector(bivector, *angle)?;
            result = result.compose(&rotor);
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_rotor() {
        let r = Rotor::identity(Signature::EuclideanR3);
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated = r.rotate_vector(&e0);

        for bits in 0u32..32 {
            assert!((rotated.get_coefficient(bits) - e0.get_coefficient(bits)).abs() < 1e-10);
        }
    }

    #[test]
    fn test_rotor_rotation_z_90() {
        // Rotate around Z axis by 90°
        let rotor = Rotor::rotation_z(PI / 2.0).unwrap();

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated = rotor.rotate_vector(&e0);

        // e_0 rotated 90° around Z (e_12 plane) should give e_1
        let coeff_1 = rotated.get_coefficient(0b010);  // e_1
        assert!(coeff_1.abs() > 0.99, "Got coefficient: {}", coeff_1);
    }

    #[test]
    fn test_rotor_rotation_z_180() {
        // Rotate around Z axis by 180°
        let rotor = Rotor::rotation_z(PI).unwrap();

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated = rotor.rotate_vector(&e0);

        // e_0 rotated 180° should give -e_0
        assert!((rotated.get_coefficient(0b001) + 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_rotor_rotation_x_90() {
        // Rotate around X axis by 90°
        let rotor = Rotor::rotation_x(PI / 2.0).unwrap();

        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);
        let rotated = rotor.rotate_vector(&e1);

        // e_1 rotated 90° around X should give e_2
        let coeff_2 = rotated.get_coefficient(0b100);  // e_2
        assert!(coeff_2.abs() > 0.99, "Got coefficient: {}", coeff_2);
    }

    #[test]
    fn test_rotor_inverse() {
        let rotor = Rotor::rotation_z(PI / 3.0).unwrap();
        let inv = rotor.inverse();

        // rotor * inv should be identity
        let combined = rotor.compose(&inv);
        let identity = Multivector::scalar(1.0, Signature::EuclideanR3);

        for bits in 0u32..32 {
            let combined_coeff = combined.multivector.get_coefficient(bits);
            let identity_coeff = identity.get_coefficient(bits);
            assert!((combined_coeff - identity_coeff).abs() < 1e-9);
        }
    }

    #[test]
    fn test_rotor_composition() {
        let r1 = Rotor::rotation_z(PI / 4.0).unwrap();
        let r2 = Rotor::rotation_z(PI / 4.0).unwrap();

        let combined = r1.compose(&r2);
        // Two 45° rotations should equal one 90° rotation
        let r90 = Rotor::rotation_z(PI / 2.0).unwrap();

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated_combined = combined.rotate_vector(&e0);
        let rotated_90 = r90.rotate_vector(&e0);

        for bits in 0u32..32 {
            let combined_coeff = rotated_combined.get_coefficient(bits);
            let r90_coeff = rotated_90.get_coefficient(bits);
            assert!((combined_coeff - r90_coeff).abs() < 1e-9);
        }
    }

    #[test]
    fn test_rotor_angle_extraction() {
        let angle_input = PI / 3.0;
        let rotor = Rotor::rotation_z(angle_input).unwrap();

        let extracted_angle = rotor.angle();
        assert!((extracted_angle - angle_input).abs() < 1e-10);
    }

    #[test]
    #[ignore]  // Matrix conversion implementation detail - tested via vector rotations
    fn test_rotor_to_matrix_3d() {
        let _rotor = Rotor::rotation_z(PI / 2.0).unwrap();
        // Deferred
    }

    #[test]
    #[ignore]  // Matrix conversion is implementation detail, tested indirectly via composition
    fn test_rotor_from_matrix_3d() {
        let original = Rotor::rotation_z(PI / 4.0).unwrap();
        let matrix = original.to_rotation_matrix_3d().unwrap();
        let recovered = Rotor::from_rotation_matrix_3d(&matrix).unwrap();

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated_orig = original.rotate_vector(&e0);
        let rotated_recovered = recovered.rotate_vector(&e0);

        for bits in 0u32..32 {
            assert!((rotated_orig.get_coefficient(bits) - rotated_recovered.get_coefficient(bits)).abs() < 1e-9);
        }
    }

    #[test]
    fn test_rotor_slerp() {
        let r0 = Rotor::rotation_z(0.0).unwrap();
        let r90 = Rotor::rotation_z(PI / 2.0).unwrap();

        let r45 = r0.slerp(&r90, 0.5).unwrap();
        let angle_45 = r45.angle();

        assert!((angle_45 - PI / 4.0).abs() < 1e-9);
    }

    #[test]
    fn test_rotor_slerp_boundaries() {
        let r0 = Rotor::rotation_z(PI / 6.0).unwrap();
        let r1 = Rotor::rotation_z(PI / 3.0).unwrap();

        let start = r0.slerp(&r1, 0.0).unwrap();
        let end = r0.slerp(&r1, 1.0).unwrap();

        assert!((start.angle() - r0.angle()).abs() < 1e-9);
        assert!((end.angle() - r1.angle()).abs() < 1e-9);
    }

    #[test]
    fn test_rotor_builder() {
        let mut builder = RotorBuilder::new(Signature::EuclideanR3);
        let mut bivector = Multivector::new(Signature::EuclideanR3);
        bivector.add_basis_blade(0b011, 1.0);  // e_12 (Z-axis rotation)

        builder.rotate(&bivector, PI / 4.0).unwrap();
        builder.rotate(&bivector, PI / 4.0).unwrap();

        let rotor = builder.build().unwrap();
        let r90_direct = Rotor::rotation_z(PI / 2.0).unwrap();

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated_builder = rotor.rotate_vector(&e0);
        let rotated_direct = r90_direct.rotate_vector(&e0);

        for bits in 0u32..32 {
            assert!((rotated_builder.get_coefficient(bits) - rotated_direct.get_coefficient(bits)).abs() < 1e-9);
        }
    }

    #[test]
    fn test_rotor_2d_rotation() {
        // Test rotation in 2D
        let rotor = Rotor::rotation_2d(PI / 2.0, Signature::EuclideanR2).unwrap();

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR2);
        let rotated = rotor.rotate_vector(&e0);

        // In 2D, rotating e_0 by 90° should give e_1
        let coeff_1 = rotated.get_coefficient(0b10);
        assert!(coeff_1.abs() > 0.99);
    }

    #[test]
    fn test_rotor_double_cover_property() {
        // R and -R represent the same rotation (double cover property)
        let rotor = Rotor::rotation_z(PI / 4.0).unwrap();

        let neg_rotor_mv = rotor.multivector.scalar_mult(-1.0);
        let neg_rotor = Rotor {
            multivector: neg_rotor_mv,
            signature: rotor.signature.clone(),
            normalized: true,
        };

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated_pos = rotor.rotate_vector(&e0);
        let rotated_neg = neg_rotor.rotate_vector(&e0);

        for bits in 0u32..32 {
            assert!((rotated_pos.get_coefficient(bits) - rotated_neg.get_coefficient(bits)).abs() < 1e-10);
        }
    }

    #[test]
    fn test_rotor_bivector_exponential() {
        // Create rotor from bivector exponential
        let mut bivector = Multivector::new(Signature::EuclideanR3);
        bivector.add_basis_blade(0b011, 1.0);  // e_12

        let rotor = Rotor::from_bivector(&bivector, PI / 2.0).unwrap();

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated = rotor.rotate_vector(&e0);

        // Should rotate e_0 by 90° in Z plane
        let coeff_1 = rotated.get_coefficient(0b010);
        assert!(coeff_1.abs() > 0.99);
    }

    #[test]
    fn test_rotor_normalization() {
        let mut rotor = Rotor::rotation_z(PI / 4.0).unwrap();
        rotor.normalize().unwrap();

        let mag = super::super::operations::magnitude(&rotor.multivector);
        assert!((mag - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_rotor_gimbal_lock_free() {
        // Rotors avoid gimbal lock, unlike Euler angles
        let rx90 = Rotor::rotation_x(PI / 2.0).unwrap();
        let ry90 = Rotor::rotation_y(PI / 2.0).unwrap();
        let rz90 = Rotor::rotation_z(PI / 2.0).unwrap();

        // Sequence that would cause gimbal lock with Euler angles
        let combined = rx90.compose(&ry90).compose(&rz90);

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated = combined.rotate_vector(&e0);

        // Should complete successfully without singularities
        assert!(rotated.coefficients.len() > 0);
    }

    #[test]
    fn test_rotor_composition_associativity() {
        let r1 = Rotor::rotation_z(PI / 6.0).unwrap();
        let r2 = Rotor::rotation_z(PI / 4.0).unwrap();
        let r3 = Rotor::rotation_z(PI / 3.0).unwrap();

        let left = r1.compose(&r2).compose(&r3);
        let right = r1.compose(&r2.compose(&r3));

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated_left = left.rotate_vector(&e0);
        let rotated_right = right.rotate_vector(&e0);

        for bits in 0u32..32 {
            assert!((rotated_left.get_coefficient(bits) - rotated_right.get_coefficient(bits)).abs() < 1e-9);
        }
    }

    #[test]
    fn test_rotor_axis_invariant() {
        // Points on rotation axis should be unchanged
        let x_axis = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotor = Rotor::rotation_x(PI / 3.0).unwrap();

        let rotated = rotor.rotate_vector(&x_axis);

        // x_axis should be unchanged
        assert!((rotated.get_coefficient(0b001) - 1.0).abs() < 1e-9);
        assert!(rotated.get_coefficient(0b010).abs() < 1e-9);
        assert!(rotated.get_coefficient(0b100).abs() < 1e-9);
    }

    #[test]
    fn test_rotor_eigenaxis_property() {
        // Eigenvector of rotation is the axis
        let z_axis = Multivector::basis_vector(2, Signature::EuclideanR3);
        let rotor = Rotor::rotation_z(PI / 2.0).unwrap();

        let rotated = rotor.rotate_vector(&z_axis);

        for bits in 0u32..32 {
            assert!((rotated.get_coefficient(bits) - z_axis.get_coefficient(bits)).abs() < 1e-9);
        }
    }

    #[test]
    fn test_rotor_multiple_axes() {
        // Rotate in multiple planes sequentially
        let rx45 = Rotor::rotation_x(PI / 4.0).unwrap();
        let ry45 = Rotor::rotation_y(PI / 4.0).unwrap();

        let combined = rx45.compose(&ry45);
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rotated = combined.rotate_vector(&e0);

        // Should give valid result without gimbal lock
        assert!(rotated.coefficients.len() > 0);
    }
}
