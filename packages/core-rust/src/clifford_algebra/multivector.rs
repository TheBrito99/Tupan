//! Multivector - sparse representation of Clifford algebra elements
//! Phase 25 Week 1-2 Implementation

use std::collections::HashMap;
use crate::clifford_algebra::basis::{BasisBlade, Signature};

/// Multivector: sparse sum of basis blades with coefficients
#[derive(Debug, Clone)]
pub struct Multivector {
    pub coefficients: HashMap<u32, f64>,
    pub signature: Signature,
}

impl Multivector {
    pub fn new(signature: Signature) -> Self {
        Multivector {
            coefficients: HashMap::new(),
            signature,
        }
    }

    pub fn scalar(value: f64, signature: Signature) -> Self {
        let mut mv = Multivector::new(signature);
        if value != 0.0 {
            mv.coefficients.insert(0, value);
        }
        mv
    }

    pub fn basis_vector(i: usize, signature: Signature) -> Self {
        let mut mv = Multivector::new(signature);
        mv.coefficients.insert(1 << i, 1.0);
        mv
    }

    pub fn add_basis_blade(&mut self, blade_bits: u32, coefficient: f64) {
        if coefficient == 0.0 {
            self.coefficients.remove(&blade_bits);
        } else {
            self.coefficients.insert(blade_bits, coefficient);
        }
    }

    pub fn get_coefficient(&self, blade_bits: u32) -> f64 {
        self.coefficients.get(&blade_bits).copied().unwrap_or(0.0)
    }

    pub fn norm_squared(&self) -> f64 {
        self.coefficients.values().map(|c| c * c).sum()
    }

    pub fn grade_projection(&self, grade: usize) -> Multivector {
        let mut result = Multivector::new(self.signature.clone());
        for (&blade_bits, &coeff) in &self.coefficients {
            let blade = BasisBlade::from_bits(blade_bits);
            if blade.grade() == grade {
                result.coefficients.insert(blade_bits, coeff);
            }
        }
        result
    }

    /// Geometric product of two multivectors
    pub fn geometric_product(&self, other: &Multivector) -> Multivector {
        assert_eq!(self.signature, other.signature, "Signatures must match");

        let mut result = Multivector::new(self.signature.clone());

        for (&self_bits, &self_coeff) in &self.coefficients {
            for (&other_bits, &other_coeff) in &other.coefficients {
                let self_blade = BasisBlade::from_bits(self_bits);
                let other_blade = BasisBlade::from_bits(other_bits);

                let (result_blade, prod_coeff) = self_blade.geometric_product(&other_blade, self.signature.clone());

                let total_coeff = self_coeff * other_coeff * prod_coeff;
                let current = result.get_coefficient(result_blade.bits);
                result.add_basis_blade(result_blade.bits, current + total_coeff);
            }
        }

        // Remove zero coefficients
        result.coefficients.retain(|_, &mut v| v != 0.0);
        result
    }

    /// Wedge product (outer product) of two multivectors
    pub fn wedge_product(&self, other: &Multivector) -> Multivector {
        assert_eq!(self.signature, other.signature, "Signatures must match");

        let mut result = Multivector::new(self.signature.clone());

        for (&self_bits, &self_coeff) in &self.coefficients {
            for (&other_bits, &other_coeff) in &other.coefficients {
                // Wedge only nonzero if no common basis vectors
                if (self_bits & other_bits) != 0 {
                    continue;
                }

                let self_blade = BasisBlade::from_bits(self_bits);
                let other_blade = BasisBlade::from_bits(other_bits);

                if let Some((result_blade, wedge_coeff)) = self_blade.wedge_product(&other_blade) {
                    let total_coeff = self_coeff * other_coeff * wedge_coeff;
                    let current = result.get_coefficient(result_blade.bits);
                    result.add_basis_blade(result_blade.bits, current + total_coeff);
                }
            }
        }

        // Remove zero coefficients
        result.coefficients.retain(|_, &mut v| v != 0.0);
        result
    }

    /// Inner product of two multivectors
    /// Only includes terms where grade differs by exactly 1
    pub fn inner_product(&self, other: &Multivector) -> Multivector {
        assert_eq!(self.signature, other.signature, "Signatures must match");

        let mut result = Multivector::new(self.signature.clone());

        for (&self_bits, &self_coeff) in &self.coefficients {
            for (&other_bits, &other_coeff) in &other.coefficients {
                let self_blade = BasisBlade::from_bits(self_bits);
                let other_blade = BasisBlade::from_bits(other_bits);

                let my_grade = self_blade.grade();
                let other_grade = other_blade.grade();

                let (product, prod_coeff) = self_blade.geometric_product(&other_blade, self.signature.clone());
                let result_grade = product.grade();

                // Inner product: only include if grade difference is exactly 1
                if result_grade as i32 == (my_grade as i32 - other_grade as i32).abs() {
                    let total_coeff = self_coeff * other_coeff * prod_coeff;
                    let current = result.get_coefficient(product.bits);
                    result.add_basis_blade(product.bits, current + total_coeff);
                }
            }
        }

        // Remove zero coefficients
        result.coefficients.retain(|_, &mut v| v != 0.0);
        result
    }

    /// Scalar product: extracts grade-0 part of geometric product
    pub fn scalar_product(&self, other: &Multivector) -> f64 {
        let product = self.geometric_product(other);
        product.get_coefficient(0)  // Extract scalar part
    }

    /// Left contraction: grade(A ⌋ B) = grade(B) - grade(A)
    pub fn left_contraction(&self, other: &Multivector) -> Multivector {
        assert_eq!(self.signature, other.signature, "Signatures must match");

        let mut result = Multivector::new(self.signature.clone());

        for (&self_bits, &self_coeff) in &self.coefficients {
            for (&other_bits, &other_coeff) in &other.coefficients {
                let self_blade = BasisBlade::from_bits(self_bits);
                let other_blade = BasisBlade::from_bits(other_bits);

                let my_grade = self_blade.grade();
                let other_grade = other_blade.grade();

                let (product, prod_coeff) = self_blade.geometric_product(&other_blade, self.signature.clone());
                let result_grade = product.grade();

                // Left contraction: only if result grade = other_grade - my_grade
                if other_grade >= my_grade && result_grade == other_grade - my_grade {
                    let total_coeff = self_coeff * other_coeff * prod_coeff;
                    let current = result.get_coefficient(product.bits);
                    result.add_basis_blade(product.bits, current + total_coeff);
                }
            }
        }

        // Remove zero coefficients
        result.coefficients.retain(|_, &mut v| v != 0.0);
        result
    }

    /// Scalar multiplication: multiply all coefficients by scalar
    pub fn scalar_mult(&self, scalar: f64) -> Multivector {
        let mut result = Multivector::new(self.signature.clone());
        for (&blade_bits, &coeff) in &self.coefficients {
            result.add_basis_blade(blade_bits, coeff * scalar);
        }
        result
    }

    /// Addition of two multivectors
    pub fn add(&self, other: &Multivector) -> Multivector {
        assert_eq!(self.signature, other.signature, "Signatures must match");
        let mut result = Multivector::new(self.signature.clone());
        for (&blade_bits, &coeff) in &self.coefficients {
            result.add_basis_blade(blade_bits, coeff);
        }
        for (&blade_bits, &coeff) in &other.coefficients {
            let current = result.get_coefficient(blade_bits);
            result.add_basis_blade(blade_bits, current + coeff);
        }
        result.coefficients.retain(|_, &mut v| v != 0.0);
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multivector_creation() {
        let mv = Multivector::new(Signature::EuclideanR3);
        assert!(mv.coefficients.is_empty());
    }

    #[test]
    fn test_scalar_multivector() {
        let mv = Multivector::scalar(5.0, Signature::EuclideanR3);
        assert_eq!(mv.get_coefficient(0), 5.0);
    }

    #[test]
    fn test_basis_vector_multivector() {
        let mv = Multivector::basis_vector(0, Signature::EuclideanR3);
        assert_eq!(mv.get_coefficient(1), 1.0);
    }

    #[test]
    fn test_add_basis_blade() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0b011, 3.0);
        assert_eq!(mv.get_coefficient(0b011), 3.0);
    }

    #[test]
    fn test_norm_squared() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0, 3.0);
        mv.add_basis_blade(1, 4.0);
        assert_eq!(mv.norm_squared(), 25.0);  // 3^2 + 4^2
    }

    #[test]
    fn test_grade_projection() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0, 1.0);      // grade 0
        mv.add_basis_blade(1, 2.0);      // grade 1
        mv.add_basis_blade(0b011, 3.0);  // grade 2

        let g0 = mv.grade_projection(0);
        assert_eq!(g0.get_coefficient(0), 1.0);
        assert_eq!(g0.get_coefficient(1), 0.0);

        let g1 = mv.grade_projection(1);
        assert_eq!(g1.get_coefficient(1), 2.0);
    }

    #[test]
    fn test_geometric_product_scalars() {
        let s1 = Multivector::scalar(3.0, Signature::EuclideanR3);
        let s2 = Multivector::scalar(4.0, Signature::EuclideanR3);

        let product = s1.geometric_product(&s2);
        assert_eq!(product.get_coefficient(0), 12.0);  // 3 * 4 = 12
    }

    #[test]
    fn test_geometric_product_basis_vectors() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);

        // e_0 * e_0 = 1
        let prod = e0.geometric_product(&e0);
        assert_eq!(prod.get_coefficient(0), 1.0);

        // e_0 * e_1 = e_01
        let prod = e0.geometric_product(&e1);
        assert_eq!(prod.get_coefficient(0b011), 1.0);

        // e_1 * e_0 = -e_01
        let prod = e1.geometric_product(&e0);
        assert_eq!(prod.get_coefficient(0b011), -1.0);
    }

    #[test]
    fn test_geometric_product_associativity() {
        let s = Multivector::scalar(2.0, Signature::EuclideanR3);
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);

        let left = s.geometric_product(&e0).geometric_product(&e1);
        let right = s.geometric_product(&e0.geometric_product(&e1));

        // Compare all coefficients
        for bits in 0u32..32 {
            assert!((left.get_coefficient(bits) - right.get_coefficient(bits)).abs() < 1e-10);
        }
    }

    #[test]
    fn test_wedge_product_orthogonal() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);

        // e_0 ∧ e_1 = e_01
        let prod = e0.wedge_product(&e1);
        assert_eq!(prod.get_coefficient(0b011), 1.0);
        assert_eq!(prod.coefficients.len(), 1);  // Only one term
    }

    #[test]
    fn test_wedge_product_same_vector_zero() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);

        // e_0 ∧ e_0 = 0
        let prod = e0.wedge_product(&e0);
        assert!(prod.coefficients.is_empty());
    }

    #[test]
    fn test_wedge_product_anticommutes() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);

        // e_0 ∧ e_1 = -e_1 ∧ e_0
        let prod1 = e0.wedge_product(&e1);
        let prod2 = e1.wedge_product(&e0);

        let coeff1 = prod1.get_coefficient(0b011);
        let coeff2 = prod2.get_coefficient(0b011);

        // Both should exist
        assert!((coeff1 - 1.0).abs() < 1e-10, "e_0 ∧ e_1 should be +e_01, got {}", coeff1);
        assert!((coeff2 + 1.0).abs() < 1e-10, "e_1 ∧ e_0 should be -e_01, got {}", coeff2);
        assert_eq!(coeff1, -coeff2);
    }

    #[test]
    fn test_inner_product_vectors() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);

        // e_0 ⌊ e_1: different indices, inner product = 0
        let prod = e0.inner_product(&e1);
        // Inner product requires grade difference of 1
        // e_0 (grade 1) ⌊ e_1 (grade 1) = no result (grades must differ by 1)
        assert!(prod.coefficients.is_empty());
    }

    #[test]
    fn test_scalar_product() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);

        // e_0 · e_0 = 1 (scalar part of e_0 * e_0 = 1)
        let prod = e0.scalar_product(&e0);
        assert_eq!(prod, 1.0);

        // e_0 · e_1 = 0 (scalar part of e_0 * e_1 = e_01 has no scalar part)
        let prod = e0.scalar_product(&e1);
        assert_eq!(prod, 0.0);
    }

    #[test]
    fn test_left_contraction() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);
        let mut e01 = Multivector::new(Signature::EuclideanR3);
        e01.add_basis_blade(0b011, 1.0);

        // e_0 ⌊ e_01 should give e_1
        let prod = e0.left_contraction(&e01);
        // grade(e_1) = grade(e_01) - grade(e_0) = 2 - 1 = 1 ✓
        assert!(!prod.coefficients.is_empty());
    }

    #[test]
    fn test_multivector_combined() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0, 2.0);      // 2 (scalar)
        mv.add_basis_blade(1, 3.0);      // 3 e_0 (basis_vector(0) = 1 << 0 = 0b001)

        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);

        // (2 + 3 e_0) * e_0 = 2 * e_0 + 3 * e_0 * e_0 = 2 e_0 + 3 * 1 = 3 + 2 e_0
        let prod = mv.geometric_product(&e0);
        assert_eq!(prod.get_coefficient(0), 3.0);      // scalar part
        assert_eq!(prod.get_coefficient(1), 2.0);      // e_0 part
    }

    #[test]
    fn test_complex_number_simulation() {
        // Simulate complex numbers using Clifford algebra
        // i² = -1 can be represented as e_01² = -1
        let mut i = Multivector::new(Signature::EuclideanR3);
        i.add_basis_blade(0b011, 1.0);  // i = e_01

        let prod = i.geometric_product(&i);
        assert_eq!(prod.get_coefficient(0), -1.0);  // i² = -1 ✓
    }

    #[test]
    fn test_quaternion_like_structure() {
        // Quaternion can be represented as 1 + i*e_01 + j*e_02 + k*e_12
        let mut quat = Multivector::new(Signature::EuclideanR3);
        quat.add_basis_blade(0, 1.0);        // 1
        quat.add_basis_blade(0b011, 1.0);   // i = e_01
        quat.add_basis_blade(0b101, 1.0);   // j = e_02
        quat.add_basis_blade(0b110, 1.0);   // k = e_12

        // Test that quaternion norm computation works
        let norm_sq = quat.norm_squared();
        assert_eq!(norm_sq, 4.0);  // 1² + 1² + 1² + 1² = 4
    }
}
