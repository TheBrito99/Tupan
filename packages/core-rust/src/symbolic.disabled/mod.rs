//! Symbolic Mathematics Engine & Computer Algebra System (CAS)
//!
//! This module provides a complete symbolic computation system for:
//! - Expression representation and manipulation (expression.rs)
//! - Algebraic simplification and normalization (simplify.rs)
//! - Calculus operations (derivatives, integrals, limits) [Phase 8 Task 3]
//! - Equation solving [Phase 8 Task 4]
//! - Pattern matching and recognition [Phase 8 Task 4]
//!
//! # Architecture
//!
//! The symbolic engine uses expression trees where each node represents:
//! - Numeric literals
//! - Variables and symbols
//! - Binary operations (+, -, *, /, ^, etc.)
//! - Unary operations (negation, absolute value, etc.)
//! - Function calls (sin, cos, exp, sqrt, etc.)
//!
//! # Example: Expression Creation, Evaluation, and Simplification
//!
//! ```ignore
//! use tupan::symbolic::{Expression, Simplifier};
//! use std::collections::HashMap;
//!
//! // Create expression: (x + 0) * 1
//! let expr = Expression::variable("x")
//!     .add(Expression::number(0.0))
//!     .multiply(Expression::number(1.0));
//!
//! // Simplify: removes identity operations
//! let simplifier = Simplifier::default();
//! let simplified = simplifier.simplify(&expr);
//! assert_eq!(simplified, Expression::variable("x"));
//!
//! // Evaluate with context: x=5
//! let mut context = HashMap::new();
//! context.insert("x".to_string(), 5.0);
//! let result = simplified.evaluate(&context).unwrap();
//! assert_eq!(result, 5.0);
//!
//! // Constant folding: 2 * 3 + 4 * 5 = 26
//! let expr2 = Expression::number(2.0)
//!     .multiply(Expression::number(3.0))
//!     .add(Expression::number(4.0).multiply(Expression::number(5.0)));
//! let simplified2 = simplifier.simplify(&expr2);
//! assert_eq!(simplified2, Expression::number(26.0));
//! ```

pub mod expression;
pub mod simplify;
pub mod calculus;
pub mod solver;

// Re-export main types for easier access
pub use expression::{Expression, BinaryOperator, UnaryOperator};
pub use simplify::{Simplifier, SimplifyConfig};
pub use calculus::Calculus;
pub use solver::{EquationSolver, SolverConfig, Solution};

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_symbolic_module_exports() {
        let _expr = Expression::number(5.0);
        let _op = BinaryOperator::Add;
        let _unary_op = UnaryOperator::Negate;
    }

    #[test]
    fn test_integration_with_evaluation() {
        // Test that all parts work together
        let expr = Expression::variable("a")
            .multiply(Expression::variable("b"))
            .add(Expression::number(10.0));

        let mut context = HashMap::new();
        context.insert("a".to_string(), 3.0);
        context.insert("b".to_string(), 4.0);

        let result = expr.evaluate(&context).unwrap();
        assert_eq!(result, 22.0); // 3*4 + 10 = 22
    }
}
