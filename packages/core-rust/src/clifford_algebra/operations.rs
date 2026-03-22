//! Clifford Algebra Operations - Standalone functions for common operations
//! Phase 25 Week 2 Implementation

use crate::clifford_algebra::basis::{BasisBlade, Signature};
use crate::clifford_algebra::multivector::Multivector;

/// Compute the reverse (reversion) of a multivector
pub fn reverse(mv: &Multivector) -> Multivector {
    let mut result = Multivector::new(mv.signature.clone());

    for (&bits, &coeff) in &mv.coefficients {
        let grade = BasisBlade::from_bits(bits).grade() as i32;
        // Sign from reversion: (-1)^(k(k-1)/2)
        let sign_exp = (grade * (grade - 1) / 2).abs() as usize % 2;
        let sign = if sign_exp == 0 { 1.0 } else { -1.0 };
        result.add_basis_blade(bits, coeff * sign);
    }

    result
}

/// Compute the magnitude (norm) of a multivector
pub fn magnitude(mv: &Multivector) -> f64 {
    mv.norm_squared().sqrt()
}

/// Normalize a multivector to unit magnitude
pub fn normalize(mv: &Multivector) -> Option<Multivector> {
    let mag = magnitude(mv);
    if mag.abs() < 1e-10 {
        return None;
    }

    let mut result = Multivector::new(mv.signature.clone());
    for (&bits, &coeff) in &mv.coefficients {
        result.add_basis_blade(bits, coeff / mag);
    }

    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reverse_scalar() {
        let mv = Multivector::scalar(5.0, Signature::EuclideanR3);
        let rev = reverse(&mv);
        assert_eq!(rev.get_coefficient(0), 5.0);
    }

    #[test]
    fn test_reverse_vector() {
        let mv = Multivector::basis_vector(0, Signature::EuclideanR3);
        let rev = reverse(&mv);
        assert_eq!(rev.get_coefficient(1), 1.0);
    }

    #[test]
    fn test_reverse_bivector() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0b011, 1.0);
        let rev = reverse(&mv);
        assert_eq!(rev.get_coefficient(0b011), -1.0);
    }

    #[test]
    fn test_magnitude_scalar() {
        let mv = Multivector::scalar(3.0, Signature::EuclideanR3);
        assert_eq!(magnitude(&mv), 3.0);
    }

    #[test]
    fn test_magnitude_vectors() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(1, 3.0);
        mv.add_basis_blade(2, 4.0);
        assert_eq!(magnitude(&mv), 5.0);
    }

    #[test]
    fn test_normalize() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(1, 3.0);
        mv.add_basis_blade(2, 4.0);
        let norm = normalize(&mv).unwrap();
        let mag = magnitude(&norm);
        assert!((mag - 1.0).abs() < 1e-10);
    }
}
