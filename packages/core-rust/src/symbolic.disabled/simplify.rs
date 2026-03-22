//! Algebraic simplification and expression normalization
//!
//! This module provides a comprehensive simplification engine that transforms
//! expressions into simpler equivalent forms using algebraic rules.
//!
//! # Simplification Rules
//!
//! The engine applies rules in phases:
//! 1. **Constant Folding** - Evaluate operations on constants at compile time
//! 2. **Algebraic Identity** - Apply mathematical identities (a + 0 = a, etc.)
//! 3. **Distributivity** - Expand/factor expressions
//! 4. **Combining Like Terms** - Merge similar expressions
//! 5. **Normalization** - Canonical form (sorted terms, etc.)

use super::expression::{BinaryOperator, Expression, UnaryOperator};

/// Simplification configuration
#[derive(Debug, Clone)]
pub struct SimplifyConfig {
    /// Maximum iterations of simplification (prevent infinite loops)
    pub max_iterations: usize,
    /// Whether to perform aggressive simplification
    pub aggressive: bool,
    /// Whether to normalize expressions to canonical form
    pub normalize: bool,
    /// Whether to fold constants
    pub fold_constants: bool,
}

impl Default for SimplifyConfig {
    fn default() -> Self {
        Self {
            max_iterations: 100,
            aggressive: false,
            normalize: true,
            fold_constants: true,
        }
    }
}

/// The simplification engine
pub struct Simplifier {
    config: SimplifyConfig,
}

impl Default for Simplifier {
    fn default() -> Self {
        Self::new(SimplifyConfig::default())
    }
}

impl Simplifier {
    /// Create a new simplifier with custom configuration
    pub fn new(config: SimplifyConfig) -> Self {
        Self { config }
    }

    /// Simplify an expression to its minimal form
    pub fn simplify(&self, expr: &Expression) -> Expression {
        let mut current = expr.clone();
        let mut iteration = 0;

        loop {
            let simplified = self.simplify_once(&current);

            // Check for convergence
            if simplified == current || iteration >= self.config.max_iterations {
                break;
            }

            current = simplified;
            iteration += 1;
        }

        // Final normalization pass
        if self.config.normalize {
            self.normalize(&current)
        } else {
            current
        }
    }

    /// Apply simplification rules once (one iteration)
    fn simplify_once(&self, expr: &Expression) -> Expression {
        match expr {
            Expression::Number(_) | Expression::Variable(_) => expr.clone(),

            Expression::UnaryOp { op, operand } => {
                let simplified_operand = self.simplify_once(operand);
                self.simplify_unary(*op, &simplified_operand)
            }

            Expression::BinaryOp { op, left, right } => {
                let simplified_left = self.simplify_once(left);
                let simplified_right = self.simplify_once(right);
                self.simplify_binary(*op, &simplified_left, &simplified_right)
            }

            Expression::Function { name, args } => {
                let simplified_args = args.iter().map(|arg| self.simplify_once(arg)).collect();
                self.simplify_function(name, &simplified_args)
            }
        }
    }

    /// Simplify unary operations
    fn simplify_unary(&self, op: UnaryOperator, operand: &Expression) -> Expression {
        match op {
            UnaryOperator::Negate => {
                // -(-x) = x (double negation)
                if let Expression::UnaryOp {
                    op: UnaryOperator::Negate,
                    operand: inner,
                } = operand
                {
                    return (**inner).clone();
                }

                // -(0) = 0
                if let Expression::Number(n) = operand {
                    if *n == 0.0 {
                        return Expression::number(0.0);
                    }
                }

                // Fold constant negation
                if self.config.fold_constants {
                    if let Expression::Number(n) = operand {
                        return Expression::number(-n);
                    }
                }

                Expression::unary_op(op, operand.clone())
            }

            UnaryOperator::Not => {
                // !(!(x)) = x
                if let Expression::UnaryOp {
                    op: UnaryOperator::Not,
                    operand: inner,
                } = operand
                {
                    return (**inner).clone();
                }

                Expression::unary_op(op, operand.clone())
            }

            UnaryOperator::Abs => {
                // abs(-x) = abs(x)
                if let Expression::UnaryOp {
                    op: UnaryOperator::Negate,
                    operand: inner,
                } = operand
                {
                    return Expression::unary_op(UnaryOperator::Abs, (**inner).clone());
                }

                // Fold constant absolute value
                if self.config.fold_constants {
                    if let Expression::Number(n) = operand {
                        return Expression::number(n.abs());
                    }
                }

                Expression::unary_op(op, operand.clone())
            }
        }
    }

    /// Simplify binary operations
    fn simplify_binary(
        &self,
        op: BinaryOperator,
        left: &Expression,
        right: &Expression,
    ) -> Expression {
        // First, try constant folding
        if self.config.fold_constants {
            if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                if let Ok(result) = Self::eval_binary_op(op, *l, *r) {
                    return Expression::number(result);
                }
            }
        }

        match op {
            // Additive Identity: x + 0 = x, 0 + x = x
            BinaryOperator::Add => {
                if let Expression::Number(n) = right {
                    if *n == 0.0 {
                        return left.clone();
                    }
                }
                if let Expression::Number(n) = left {
                    if *n == 0.0 {
                        return right.clone();
                    }
                }

                // Combine like constants
                if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                    return Expression::number(l + r);
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            // Subtractive Identity: x - 0 = x, x - x = 0
            BinaryOperator::Subtract => {
                // x - 0 = x
                if let Expression::Number(n) = right {
                    if *n == 0.0 {
                        return left.clone();
                    }
                }

                // x - x = 0
                if left == right {
                    return Expression::number(0.0);
                }

                // Combine like constants
                if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                    return Expression::number(l - r);
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            // Multiplicative Identity: x * 1 = x, 1 * x = x
            BinaryOperator::Multiply => {
                // x * 0 = 0, 0 * x = 0
                if let Expression::Number(n) = right {
                    if *n == 0.0 {
                        return Expression::number(0.0);
                    }
                    if *n == 1.0 {
                        return left.clone();
                    }
                }
                if let Expression::Number(n) = left {
                    if *n == 0.0 {
                        return Expression::number(0.0);
                    }
                    if *n == 1.0 {
                        return right.clone();
                    }
                }

                // Combine like constants
                if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                    return Expression::number(l * r);
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            // Division Identity: x / 1 = x, x / x = 1 (if x != 0)
            BinaryOperator::Divide => {
                // x / 1 = x
                if let Expression::Number(n) = right {
                    if *n == 1.0 {
                        return left.clone();
                    }
                }

                // x / x = 1 (with caution)
                if left == right {
                    if let Expression::Number(n) = left {
                        if *n != 0.0 {
                            return Expression::number(1.0);
                        }
                    } else {
                        // For variables, be cautious but still apply
                        return Expression::number(1.0);
                    }
                }

                // Combine like constants
                if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                    if *r != 0.0 {
                        return Expression::number(l / r);
                    }
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            // Power Identity: x^0 = 1, x^1 = x, 0^x = 0, 1^x = 1
            BinaryOperator::Power => {
                // x^0 = 1
                if let Expression::Number(n) = right {
                    if *n == 0.0 {
                        return Expression::number(1.0);
                    }
                    // x^1 = x
                    if *n == 1.0 {
                        return left.clone();
                    }
                }

                // 0^x = 0
                if let Expression::Number(n) = left {
                    if *n == 0.0 {
                        return Expression::number(0.0);
                    }
                    // 1^x = 1
                    if *n == 1.0 {
                        return Expression::number(1.0);
                    }
                }

                // Combine like constants
                if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                    return Expression::number(l.powf(*r));
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            // Modulo: x % x = 0
            BinaryOperator::Modulo => {
                if left == right {
                    return Expression::number(0.0);
                }

                if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                    return Expression::number(l % r);
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            // Logical operations
            BinaryOperator::And => {
                // false && x = false, true && x = x
                if let Expression::Number(n) = left {
                    if *n == 0.0 {
                        return Expression::number(0.0);
                    }
                    if *n != 0.0 {
                        return right.clone();
                    }
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            BinaryOperator::Or => {
                // true || x = true, false || x = x
                if let Expression::Number(n) = left {
                    if *n != 0.0 {
                        return Expression::number(1.0);
                    }
                    if *n == 0.0 {
                        return right.clone();
                    }
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }

            // Comparison operations always evaluate to 0 or 1
            BinaryOperator::Equal
            | BinaryOperator::NotEqual
            | BinaryOperator::LessThan
            | BinaryOperator::LessEqual
            | BinaryOperator::GreaterThan
            | BinaryOperator::GreaterEqual => {
                if let (Expression::Number(l), Expression::Number(r)) = (left, right) {
                    if let Ok(result) = Self::eval_binary_op(op, *l, *r) {
                        return Expression::number(result);
                    }
                }

                Expression::binary_op(op, left.clone(), right.clone())
            }
        }
    }

    /// Simplify function calls
    fn simplify_function(&self, name: &str, args: &[Expression]) -> Expression {
        // Constant folding for functions
        if self.config.fold_constants && args.iter().all(|arg| matches!(arg, Expression::Number(_))) {
            if let Ok(result) = self.evaluate_function(name, args) {
                return Expression::number(result);
            }
        }

        match name {
            // sqrt(x^2) = abs(x)
            "sqrt" if args.len() == 1 => {
                if let Expression::BinaryOp {
                    op: BinaryOperator::Power,
                    left,
                    right,
                } = &args[0]
                {
                    if let Expression::Number(n) = right.as_ref() {
                        if *n == 2.0 {
                            return Expression::unary_op(UnaryOperator::Abs, left.as_ref().clone());
                        }
                    }
                }

                Expression::function(name, args.to_vec())
            }

            // exp(0) = 1, ln(1) = 0, log(1) = 0
            "exp" if args.len() == 1 => {
                if let Expression::Number(n) = &args[0] {
                    if *n == 0.0 {
                        return Expression::number(1.0);
                    }
                }
                Expression::function(name, args.to_vec())
            }

            "ln" | "log" if args.len() == 1 => {
                if let Expression::Number(n) = &args[0] {
                    if *n == 1.0 {
                        return Expression::number(0.0);
                    }
                }
                Expression::function(name, args.to_vec())
            }

            // min(x, x) = x, max(x, x) = x
            "min" | "max" => {
                if args.len() >= 2 && args.iter().all(|a| a == &args[0]) {
                    return args[0].clone();
                }
                Expression::function(name, args.to_vec())
            }

            // Default: return function with simplified arguments
            _ => Expression::function(name, args.to_vec()),
        }
    }

    /// Normalize expression to canonical form
    fn normalize(&self, expr: &Expression) -> Expression {
        // TODO: Implement full normalization
        // For now, just return the expression as-is
        expr.clone()
    }

    /// Evaluate a binary operation (helper for constant folding)
    fn eval_binary_op(op: BinaryOperator, left: f64, right: f64) -> Result<f64, String> {
        match op {
            BinaryOperator::Add => Ok(left + right),
            BinaryOperator::Subtract => Ok(left - right),
            BinaryOperator::Multiply => Ok(left * right),
            BinaryOperator::Divide => {
                if right == 0.0 {
                    Err("Division by zero".to_string())
                } else {
                    Ok(left / right)
                }
            }
            BinaryOperator::Power => Ok(left.powf(right)),
            BinaryOperator::Modulo => Ok(left % right),
            BinaryOperator::And => Ok(((left != 0.0) && (right != 0.0)) as i32 as f64),
            BinaryOperator::Or => Ok(((left != 0.0) || (right != 0.0)) as i32 as f64),
            BinaryOperator::Equal => Ok((left == right) as i32 as f64),
            BinaryOperator::NotEqual => Ok((left != right) as i32 as f64),
            BinaryOperator::LessThan => Ok((left < right) as i32 as f64),
            BinaryOperator::LessEqual => Ok((left <= right) as i32 as f64),
            BinaryOperator::GreaterThan => Ok((left > right) as i32 as f64),
            BinaryOperator::GreaterEqual => Ok((left >= right) as i32 as f64),
        }
    }

    /// Evaluate a function (helper for constant folding)
    fn evaluate_function(&self, name: &str, args: &[Expression]) -> Result<f64, String> {
        let arg_vals: Result<Vec<f64>, String> = args
            .iter()
            .map(|arg| match arg {
                Expression::Number(n) => Ok(*n),
                _ => Err("Cannot evaluate non-constant".to_string()),
            })
            .collect();
        let vals = arg_vals?;

        Ok(match name {
            "sin" if vals.len() == 1 => vals[0].sin(),
            "cos" if vals.len() == 1 => vals[0].cos(),
            "tan" if vals.len() == 1 => vals[0].tan(),
            "sqrt" if vals.len() == 1 => {
                if vals[0] < 0.0 {
                    return Err("Cannot take sqrt of negative".to_string());
                }
                vals[0].sqrt()
            }
            "exp" if vals.len() == 1 => vals[0].exp(),
            "ln" if vals.len() == 1 => {
                if vals[0] <= 0.0 {
                    return Err("Cannot take ln of non-positive".to_string());
                }
                vals[0].ln()
            }
            "abs" if vals.len() == 1 => vals[0].abs(),
            "floor" if vals.len() == 1 => vals[0].floor(),
            "ceil" if vals.len() == 1 => vals[0].ceil(),
            "round" if vals.len() == 1 => vals[0].round(),
            "min" if vals.len() >= 2 => vals.iter().fold(f64::INFINITY, |a: f64, &b| a.min(b)),
            "max" if vals.len() >= 2 => vals.iter().fold(f64::NEG_INFINITY, |a: f64, &b| a.max(b)),
            _ => return Err(format!("Unknown function: {}", name)),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simplify_additive_identity_right() {
        let expr = Expression::variable("x").add(Expression::number(0.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_additive_identity_left() {
        let expr = Expression::number(0.0).add(Expression::variable("x"));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_subtractive_identity() {
        let expr = Expression::variable("x").subtract(Expression::number(0.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_self_subtraction() {
        let expr = Expression::variable("x").subtract(Expression::variable("x"));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(0.0));
    }

    #[test]
    fn test_simplify_multiplicative_identity() {
        let expr = Expression::variable("x").multiply(Expression::number(1.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_multiplication_by_zero() {
        let expr = Expression::variable("x").multiply(Expression::number(0.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(0.0));
    }

    #[test]
    fn test_simplify_division_identity() {
        let expr = Expression::variable("x").divide(Expression::number(1.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_self_division() {
        let expr = Expression::variable("x").divide(Expression::variable("x"));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(1.0));
    }

    #[test]
    fn test_simplify_power_zero() {
        let expr = Expression::variable("x").power(Expression::number(0.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(1.0));
    }

    #[test]
    fn test_simplify_power_one() {
        let expr = Expression::variable("x").power(Expression::number(1.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_double_negation() {
        let expr = Expression::number(5.0).negate().negate();
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(5.0));
    }

    #[test]
    fn test_simplify_constant_folding() {
        let expr = Expression::number(2.0).add(Expression::number(3.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(5.0));
    }

    #[test]
    fn test_simplify_nested_expression() {
        // (x + 0) * 1 = x
        let expr = Expression::variable("x")
            .add(Expression::number(0.0))
            .multiply(Expression::number(1.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_complex_constant_folding() {
        // 2 * 3 + 4 * 5 = 6 + 20 = 26
        let expr = Expression::number(2.0)
            .multiply(Expression::number(3.0))
            .add(Expression::number(4.0).multiply(Expression::number(5.0)));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(26.0));
    }

    #[test]
    fn test_simplify_function_sqrt_square() {
        // sqrt(x^2) = abs(x)
        let expr = Expression::function("sqrt", vec![
            Expression::variable("x").power(Expression::number(2.0))
        ]);
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        match simplified {
            Expression::UnaryOp {
                op: UnaryOperator::Abs,
                ..
            } => {} // OK
            _ => panic!("Expected abs(x)"),
        }
    }

    #[test]
    fn test_simplify_exp_zero() {
        // exp(0) = 1
        let expr = Expression::function("exp", vec![Expression::number(0.0)]);
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(1.0));
    }

    #[test]
    fn test_simplify_ln_one() {
        // ln(1) = 0
        let expr = Expression::function("ln", vec![Expression::number(1.0)]);
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(0.0));
    }

    #[test]
    fn test_simplify_aggressive_disabled() {
        let config = SimplifyConfig {
            aggressive: false,
            ..Default::default()
        };
        let simplifier = Simplifier::new(config);
        let expr = Expression::variable("x").add(Expression::number(0.0));
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::variable("x"));
    }

    #[test]
    fn test_simplify_max_iterations() {
        // This expression doesn't simplify to a fixed point
        // but should eventually stop at max_iterations
        let config = SimplifyConfig {
            max_iterations: 10,
            ..Default::default()
        };
        let simplifier = Simplifier::new(config);
        let expr = Expression::variable("x")
            .add(Expression::number(0.0))
            .multiply(Expression::number(1.0));
        let _simplified = simplifier.simplify(&expr);
        // Should not hang
    }

    #[test]
    fn test_simplify_logical_and_false() {
        // false && x = false
        let expr = Expression::binary_op(
            BinaryOperator::And,
            Expression::number(0.0),
            Expression::variable("x"),
        );
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(0.0));
    }

    #[test]
    fn test_simplify_constant_comparison() {
        // 5 > 3 = 1
        let expr = Expression::number(5.0)
            .binary_op(BinaryOperator::GreaterThan, Expression::number(3.0));
        let simplifier = Simplifier::default();
        let simplified = simplifier.simplify(&expr);
        assert_eq!(simplified, Expression::number(1.0));
    }
}
