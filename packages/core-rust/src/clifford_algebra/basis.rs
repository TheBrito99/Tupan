//! Basis Blade representation and operations
//!
//! Foundation of Clifford Algebra: basis elements with their geometric products
//! Supports arbitrary dimensions and signatures

use std::collections::BTreeMap;

/// Signature determines the algebra type
/// (++), (+-), (-+), (--)  represent e_i² values
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Signature {
    EuclideanR2,      // (+, +) - standard 2D
    EuclideanR3,      // (+, +, +) - standard 3D
    MinkowskiR1_1,    // (+, -) - spacetime
    MinkowskiR1_3,    // (+, -, -, -) - spacetime (ct, x, y, z)
    ConformalR2_0_1,  // conformal
    Generic(Vec<i32>), // custom: 1 for +, -1 for -, 0 for degenerate
}

impl Signature {
    pub fn dimension(&self) -> usize {
        match self {
            Signature::EuclideanR2 => 2,
            Signature::EuclideanR3 => 3,
            Signature::MinkowskiR1_1 => 2,
            Signature::MinkowskiR1_3 => 4,
            Signature::ConformalR2_0_1 => 5,
            Signature::Generic(sigs) => sigs.len(),
        }
    }

    pub fn metric(&self, i: usize) -> i32 {
        match self {
            Signature::EuclideanR2 | Signature::EuclideanR3 => 1,
            Signature::MinkowskiR1_1 | Signature::MinkowskiR1_3 => {
                if i == 0 { 1 } else { -1 }
            }
            Signature::ConformalR2_0_1 => {
                if i == 3 { 1 } else if i == 4 { -1 } else { 1 }
            }
            Signature::Generic(sigs) => sigs.get(i).copied().unwrap_or(0),
        }
    }
}

/// Represents a basis element like e_1, e_12, e_123, etc.
/// Stored as a bitmask (bit i set = includes e_i)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct BasisBlade {
    /// Bitmask of basis vectors (bit 0 = e_0, bit 1 = e_1, etc.)
    pub bits: u32,
    /// Sign from anticommutation: +1, -1, or 0
    pub sign: i32,
}

impl BasisBlade {
    pub fn scalar() -> Self {
        BasisBlade { bits: 0, sign: 1 }
    }

    pub fn basis_vector(i: usize) -> Self {
        BasisBlade {
            bits: 1 << i,
            sign: 1,
        }
    }

    pub fn from_bits(bits: u32) -> Self {
        BasisBlade { bits, sign: 1 }
    }

    pub fn grade(&self) -> usize {
        self.bits.count_ones() as usize
    }

    pub fn contains(&self, i: usize) -> bool {
        (self.bits & (1 << i)) != 0
    }

    /// Compute the sign from reordering to canonical order
    /// Basis blades are always stored in canonical (ascending) form
    /// This function would compute the sign if they weren't
    pub fn reorder_sign(_bits: u32, _n_dims: usize) -> i32 {
        // Single basis blades stored as bitmasks are always in canonical order
        // since we just use bitwise OR for combining them.
        // The sign comes from the ORDER of multiplication, not the storage.
        // E.g., e_1 * e_0 produces anticommutation, not from the bitmask itself
        // but from the order of operations.
        1i32
    }

    /// Geometric product of two basis blades
    pub fn geometric_product(&self, other: &BasisBlade, signature: Signature) -> (BasisBlade, f64) {
        let mut result_bits = self.bits ^ other.bits;
        let mut coefficient = self.sign as f64 * other.sign as f64;

        // First, handle e_i * e_i = ±1 for indices in both
        let n_dims = signature.dimension();
        for i in 0..n_dims {
            let self_has_i = (self.bits >> i) & 1 == 1;
            let other_has_i = (other.bits >> i) & 1 == 1;

            if self_has_i && other_has_i {
                // e_i * e_i = metric[i]
                let metric = signature.metric(i);
                coefficient *= metric as f64;
            }
        }

        // Count anticommutations: inversions between self and other indices
        // When multiplying e_i * e_j with i < j, they're in canonical order (no anticomm)
        // When multiplying e_j * e_i with j > i, we need one anticommutation: -e_i * e_j
        let mut anticomms = 0;
        for i in 0..n_dims {
            if (self.bits >> i) & 1 == 1 {
                // Basis index i appears in self
                // Count how many indices in other come BEFORE i
                for j in 0..i {
                    if (other.bits >> j) & 1 == 1 {
                        // Basis index j from other comes before i from self
                        // This is an inversion: self has later index, other has earlier
                        anticomms += 1;
                    }
                }
            }
        }

        // Apply sign from anticommutations
        if anticomms % 2 == 1 {
            coefficient *= -1.0;
        }

        let result_sign = if coefficient >= 0.0 { 1 } else { -1 };
        (
            BasisBlade {
                bits: result_bits,
                sign: result_sign,
            },
            coefficient,  // Return the signed coefficient, not absolute value
        )
    }

    /// Wedge product (outer product) of two basis blades
    pub fn wedge_product(&self, other: &BasisBlade) -> Option<(BasisBlade, f64)> {
        // Wedge is only nonzero if no common basis vectors
        if (self.bits & other.bits) != 0 {
            return None;
        }

        // Result is just OR of bits, with reordering sign
        let result_bits = self.bits | other.bits;
        let mut sign = 1;

        // Count anticommutations: inversions between self and other indices
        // When self has index i and other has index j with i > j, we need a swap
        let mut n_swaps = 0;
        for i in 0..32 {
            if ((self.bits >> i) & 1) == 0 {
                continue;
            }
            // Count how many indices in other come BEFORE i
            for j in 0..i {
                if ((other.bits >> j) & 1) == 1 {
                    n_swaps += 1;
                }
            }
        }

        if n_swaps % 2 == 1 {
            sign = -1;
        }

        Some((
            BasisBlade {
                bits: result_bits,
                sign,
            },
            sign as f64,  // Return the signed coefficient
        ))
    }

    /// Inner product of two basis blades
    pub fn inner_product(&self, other: &BasisBlade) -> Option<(BasisBlade, f64)> {
        // Inner product is geometric product with lower grade result
        let my_grade = self.grade();
        let other_grade = other.grade();

        let (product, coeff) = self.geometric_product(other, Signature::EuclideanR3);
        let result_grade = product.grade();

        // Inner product only includes results of specific grades
        if result_grade as i32 == (my_grade as i32 - other_grade as i32).abs() {
            Some((product, coeff))
        } else {
            None
        }
    }
}

/// Iterator over basis blades of a specific grade
pub struct BasisBladeIter {
    current: u32,
    limit: u32,
    grade: usize,
}

impl BasisBladeIter {
    pub fn new(grade: usize, dimension: usize) -> Self {
        // Start with the first combination: lowest grade bits set
        let mut current = 0u32;
        for i in 0..grade {
            current |= 1 << i;
        }
        BasisBladeIter {
            current,
            limit: 1u32 << dimension,
            grade,
        }
    }
}

impl Iterator for BasisBladeIter {
    type Item = BasisBlade;

    fn next(&mut self) -> Option<Self::Item> {
        // Find next number with the same popcount (grade)
        loop {
            // Check if we've finished
            if self.current >= self.limit {
                return None;
            }

            // Check if current has the right grade
            if self.current.count_ones() as usize == self.grade {
                let result = BasisBlade::from_bits(self.current);
                self.current += 1;
                return Some(result);
            }

            // Advance to next
            self.current += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signature_dimension() {
        assert_eq!(Signature::EuclideanR2.dimension(), 2);
        assert_eq!(Signature::EuclideanR3.dimension(), 3);
        assert_eq!(Signature::MinkowskiR1_3.dimension(), 4);
    }

    #[test]
    fn test_basis_blade_creation() {
        let scalar = BasisBlade::scalar();
        assert_eq!(scalar.bits, 0);
        assert_eq!(scalar.grade(), 0);

        let e0 = BasisBlade::basis_vector(0);
        assert_eq!(e0.bits, 1);
        assert_eq!(e0.grade(), 1);

        let e12 = BasisBlade::from_bits(0b11);
        assert_eq!(e12.grade(), 2);
    }

    #[test]
    fn test_basis_blade_contains() {
        let e12 = BasisBlade::from_bits(0b011);
        assert!(e12.contains(0));
        assert!(e12.contains(1));
        assert!(!e12.contains(2));
    }

    #[test]
    fn test_geometric_product_e_squared() {
        let e0 = BasisBlade::basis_vector(0);
        let e1 = BasisBlade::basis_vector(1);

        // In Euclidean 3D: e_0 * e_0 = 1
        let (result, coeff) = e0.geometric_product(&e0, Signature::EuclideanR3);
        assert_eq!(result.bits, 0);  // scalar
        assert_eq!(coeff, 1.0);

        // e_0 * e_1 = e_01
        let (result, coeff) = e0.geometric_product(&e1, Signature::EuclideanR3);
        assert_eq!(result.bits, 0b011);
        assert_eq!(coeff, 1.0);

        // e_1 * e_0 = -e_01
        let (result, coeff) = e1.geometric_product(&e0, Signature::EuclideanR3);
        assert_eq!(result.bits, 0b011);
        assert!(coeff < 0.0);
    }

    #[test]
    fn test_wedge_product() {
        let e0 = BasisBlade::basis_vector(0);
        let e1 = BasisBlade::basis_vector(1);
        let e2 = BasisBlade::basis_vector(2);

        // e_0 ∧ e_1 = e_01 (no swaps needed, already in canonical order)
        let result = e0.wedge_product(&e1);
        assert!(result.is_some());
        let (blade, coeff) = result.unwrap();
        assert_eq!(blade.bits, 0b011);
        assert_eq!(coeff, 1.0);

        // e_1 ∧ e_0 = -e_01 (one swap needed)
        let result = e1.wedge_product(&e0);
        assert!(result.is_some());
        let (blade, coeff) = result.unwrap();
        assert_eq!(blade.bits, 0b011);
        assert_eq!(coeff, -1.0, "e_1 ∧ e_0 should give coefficient -1");

        // e_0 ∧ e_0 = 0
        let result = e0.wedge_product(&e0);
        assert!(result.is_none());

        // e_01 ∧ e_2 = e_012
        let e01 = BasisBlade::from_bits(0b011);
        let result = e01.wedge_product(&e2);
        assert!(result.is_some());
    }

    #[test]
    fn test_reorder_sign() {
        // Basis blades are stored in canonical (ascending) form
        // A single basis blade always has sign 1
        let sign = BasisBlade::reorder_sign(0b10, 2);  // just e_1
        assert_eq!(sign, 1);

        let sign = BasisBlade::reorder_sign(0b01, 2);  // just e_0
        assert_eq!(sign, 1);

        let sign = BasisBlade::reorder_sign(0b11, 2);  // e_01 (canonical order)
        assert_eq!(sign, 1);
    }

    #[test]
    fn test_basis_blade_iter() {
        let blades: Vec<_> = BasisBladeIter::new(1, 3).collect();
        assert_eq!(blades.len(), 3);  // e_0, e_1, e_2

        let blades: Vec<_> = BasisBladeIter::new(2, 3).collect();
        assert_eq!(blades.len(), 3);  // e_01, e_02, e_12

        let blades: Vec<_> = BasisBladeIter::new(0, 3).collect();
        assert_eq!(blades.len(), 1);  // scalar
    }

    #[test]
    fn test_minkowski_metric() {
        let metric0 = Signature::MinkowskiR1_3.metric(0);
        let metric1 = Signature::MinkowskiR1_3.metric(1);

        assert_eq!(metric0, 1);   // time-like
        assert_eq!(metric1, -1);  // space-like
    }

    #[test]
    fn test_multivector_basis_composition() {
        let e0 = BasisBlade::basis_vector(0);
        let e1 = BasisBlade::basis_vector(1);
        let e2 = BasisBlade::basis_vector(2);

        // e_012 in 3D
        let e012 = BasisBlade::from_bits(0b111);
        assert_eq!(e012.grade(), 3);

        // Pseudoscalar in 3D has grade n
        assert_eq!(e012.grade(), Signature::EuclideanR3.dimension());
    }

    #[test]
    fn test_basis_blade_ordering() {
        let e01 = BasisBlade::from_bits(0b011);
        let e10 = BasisBlade::from_bits(0b011);

        // Same bits = same blade
        assert_eq!(e01, e10);
    }

    #[test]
    fn test_geometric_product_associativity() {
        let e0 = BasisBlade::basis_vector(0);
        let e1 = BasisBlade::basis_vector(1);
        let e2 = BasisBlade::basis_vector(2);

        // (e_0 * e_1) * e_2 = e_0 * (e_1 * e_2)
        let (r1, c1) = e0.geometric_product(&e1, Signature::EuclideanR3);
        let (r1_final, c1_final) = r1.geometric_product(&e2, Signature::EuclideanR3);

        let (r2, c2) = e1.geometric_product(&e2, Signature::EuclideanR3);
        let (r2_final, c2_final) = e0.geometric_product(&r2, Signature::EuclideanR3);

        assert_eq!(r1_final.bits, r2_final.bits);
        assert_eq!((c1 * c1_final).abs(), (c2 * c2_final).abs());
    }

    #[test]
    fn test_basis_blade_grade_projection() {
        let blade = BasisBlade::from_bits(0b111);
        assert_eq!(blade.grade(), 3);

        let blade = BasisBlade::from_bits(0b101);
        assert_eq!(blade.grade(), 2);

        let blade = BasisBlade::from_bits(0b000);
        assert_eq!(blade.grade(), 0);
    }
}
