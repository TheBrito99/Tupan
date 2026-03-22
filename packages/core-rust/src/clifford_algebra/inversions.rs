//! Clifford Algebra Inversions - Dual, Conjugate, and other involutions
//! Phase 25 Week 2 Implementation

use crate::clifford_algebra::basis::{BasisBlade, Signature};
use crate::clifford_algebra::multivector::Multivector;

/// Compute the dual (Hodge complement) of a multivector
/// In n-dimensional space, dual maps k-grade to (n-k)-grade
pub fn dual(mv: &Multivector) -> Multivector {
    let n = mv.signature.dimension();
    let pseudoscalar_bits = (1u32 << n) - 1;

    let mut result = Multivector::new(mv.signature.clone());

    for (&bits, &coeff) in &mv.coefficients {
        let complement_bits = bits ^ pseudoscalar_bits;
        let blade = BasisBlade::from_bits(bits);
        let grade_a = blade.grade();
        let grade_complement = n - grade_a;
        let sign_factor = if (grade_a * grade_complement) % 2 == 0 { 1.0 } else { -1.0 };

        let current = result.get_coefficient(complement_bits);
        result.add_basis_blade(complement_bits, current + coeff * sign_factor);
    }

    result.coefficients.retain(|_, &mut v| v.abs() > 1e-10);
    result
}

/// Compute the conjugate (grade involution) of a multivector
/// Grade k contributes sign (-1)^k
pub fn conjugate(mv: &Multivector) -> Multivector {
    let mut result = Multivector::new(mv.signature.clone());

    for (&bits, &coeff) in &mv.coefficients {
        let grade = BasisBlade::from_bits(bits).grade();
        let sign = if grade % 2 == 0 { 1.0 } else { -1.0 };
        result.add_basis_blade(bits, coeff * sign);
    }

    result
}

/// Compute the involute (grade involution) of a multivector
/// Grade k contributes sign (-1)^(k(k+1)/2)
pub fn involute(mv: &Multivector) -> Multivector {
    let mut result = Multivector::new(mv.signature.clone());

    for (&bits, &coeff) in &mv.coefficients {
        let grade = BasisBlade::from_bits(bits).grade() as i32;
        let sign_exp = (grade * (grade + 1) / 2).abs() as usize % 2;
        let sign = if sign_exp == 0 { 1.0 } else { -1.0 };
        result.add_basis_blade(bits, coeff * sign);
    }

    result
}

/// Compute the Clifford conjugate (full conjugate)
pub fn clifford_conjugate(mv: &Multivector) -> Multivector {
    let rev = super::operations::reverse(mv);
    conjugate(&rev)
}

/// Test if two multivectors are dual-orthogonal
pub fn is_dual_orthogonal(a: &Multivector, b: &Multivector) -> bool {
    let b_dual = dual(b);
    let wedge = a.wedge_product(&b_dual);
    wedge.coefficients.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dual_scalar() {
        let mv = Multivector::scalar(1.0, Signature::EuclideanR3);
        let d = dual(&mv);
        let grade_3 = d.grade_projection(3);
        assert!(!grade_3.coefficients.is_empty());
    }

    #[test]
    fn test_dual_vector() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let d = dual(&e0);
        let grade_2 = d.grade_projection(2);
        assert!(!grade_2.coefficients.is_empty());
    }

    #[test]
    fn test_dual_involution() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let dd = dual(&dual(&e0));
        assert!((dd.get_coefficient(1) - e0.get_coefficient(1)).abs() < 1e-10);
    }

    #[test]
    fn test_conjugate_scalar() {
        let mv = Multivector::scalar(5.0, Signature::EuclideanR3);
        let c = conjugate(&mv);
        assert_eq!(c.get_coefficient(0), 5.0);
    }

    #[test]
    fn test_conjugate_vector() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let c = conjugate(&e0);
        assert_eq!(c.get_coefficient(1), -1.0);
    }

    #[test]
    fn test_conjugate_bivector() {
        let mut biv = Multivector::new(Signature::EuclideanR3);
        biv.add_basis_blade(0b011, 1.0);
        let c = conjugate(&biv);
        // Grade 2: (-1)^2 = +1, so coefficient unchanged
        assert_eq!(c.get_coefficient(0b011), 1.0);
    }

    #[test]
    fn test_involute_scalar() {
        let mv = Multivector::scalar(5.0, Signature::EuclideanR3);
        let i = involute(&mv);
        assert_eq!(i.get_coefficient(0), 5.0);
    }

    #[test]
    fn test_involute_vector() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let i = involute(&e0);
        assert_eq!(i.get_coefficient(1), -1.0);
    }

    #[test]
    fn test_involute_bivector() {
        let mut biv = Multivector::new(Signature::EuclideanR3);
        biv.add_basis_blade(0b011, 1.0);
        let i = involute(&biv);
        assert_eq!(i.get_coefficient(0b011), -1.0);
    }

    #[test]
    fn test_clifford_conjugate() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let cc = clifford_conjugate(&e0);
        assert_eq!(cc.get_coefficient(1), -1.0);
    }

    #[test]
    fn test_is_dual_orthogonal_orthogonal() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let e1 = Multivector::basis_vector(1, Signature::EuclideanR3);
        assert!(is_dual_orthogonal(&e0, &e1));
    }

    #[test]
    fn test_dual_orthogonal_same() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        assert!(!is_dual_orthogonal(&e0, &e0));
    }

    #[test]
    fn test_conjugate_sign_double_application() {
        // Conjugate is an involution: applying twice should restore original (up to sign)
        let a = Multivector::basis_vector(0, Signature::EuclideanR3);
        let b = Multivector::basis_vector(1, Signature::EuclideanR3);

        let ab = a.geometric_product(&b);
        // ab = e_01 (grade 2, coeff = 1.0)
        // conj(ab) = (-1)^2 * e_01 = e_01
        let ab_conj = conjugate(&ab);
        // conj(conj(ab)) = (-1)^2 * e_01 = e_01 (should equal ab)
        let ab_conj_conj = conjugate(&ab_conj);

        for bits in 0u32..32 {
            let orig = ab.get_coefficient(bits);
            let twice = ab_conj_conj.get_coefficient(bits);
            // Grade involution is an involution: conj(conj(x)) = x
            assert!((orig - twice).abs() < 1e-10);
        }
    }

    #[test]
    fn test_multiple_conjugates_cycle() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let c1 = conjugate(&e0);
        let c2 = conjugate(&c1);
        assert_eq!(c2.get_coefficient(1), e0.get_coefficient(1));
    }

    #[test]
    fn test_dual_consistency() {
        let e0 = Multivector::basis_vector(0, Signature::EuclideanR3);
        let d = dual(&e0);
        assert!(!d.coefficients.is_empty());
    }

    #[test]
    fn test_involute_alternate_signs() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0, 1.0);      // grade 0
        mv.add_basis_blade(1, 1.0);      // grade 1
        mv.add_basis_blade(0b011, 1.0);  // grade 2

        let inv = involute(&mv);
        // Grade 0: (-1)^0 = 1
        assert_eq!(inv.get_coefficient(0), 1.0);
        // Grade 1: (-1)^1 = -1
        assert_eq!(inv.get_coefficient(1), -1.0);
        // Grade 2: (-1)^3 = -1
        assert_eq!(inv.get_coefficient(0b011), -1.0);
    }

    #[test]
    fn test_dual_pseudoscalar() {
        let mut ps = Multivector::new(Signature::EuclideanR3);
        ps.add_basis_blade(0b111, 1.0);

        let d = dual(&ps);
        let scalar_coeff = d.get_coefficient(0);
        assert!(scalar_coeff.abs() > 1e-10);
    }

    #[test]
    fn test_conjugate_properties_mixed_grade() {
        let mut mv = Multivector::new(Signature::EuclideanR3);
        mv.add_basis_blade(0, 2.0);      // scalar
        mv.add_basis_blade(1, 3.0);      // vector

        let c = conjugate(&mv);
        assert_eq!(c.get_coefficient(0), 2.0);   // scalar unchanged
        assert_eq!(c.get_coefficient(1), -3.0);  // vector flipped
    }
}
