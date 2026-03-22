//! Symbolic calculus operations
//!
//! This module provides symbolic computation of:
//! - Derivatives using differentiation rules
//! - Partial derivatives (multi-variable)
//! - Basic symbolic integration
//! - Limit evaluation
//! - Chain rule, product rule, quotient rule automatic application

use super::expression::{BinaryOperator, Expression, UnaryOperator};
use super::simplify::Simplifier;
use std::collections::HashMap;

/// Calculus operations on symbolic expressions
pub struct Calculus {
    simplifier: Simplifier,
}

impl Default for Calculus {
    fn default() -> Self {
        Self::new()
    }
}

impl Calculus {
    /// Create a new calculus engine
    pub fn new() -> Self {
        Self {
            simplifier: Simplifier::default(),
        }
    }

    /// Compute the derivative of an expression with respect to a variable
    ///
    /// Uses standard differentiation rules:
    /// - Power rule: d/dx(x^n) = n*x^(n-1)
    /// - Product rule: d/dx(u*v) = u'*v + u*v'
    /// - Quotient rule: d/dx(u/v) = (u'*v - u*v') / v^2
    /// - Chain rule: d/dx(f(g(x))) = f'(g(x)) * g'(x)
    /// - Sum rule: d/dx(u + v) = u' + v'
    ///
    /// # Arguments
    /// * `expr` - Expression to differentiate
    /// * `var` - Variable to differentiate with respect to
    ///
    /// # Returns
    /// * Derivative expression (simplified)
    pub fn derivative(&self, expr: &Expression, var: &str) -> Expression {
        let deriv = self.derivative_unsimplified(expr, var);
        self.simplifier.simplify(&deriv)
    }

    /// Compute second derivative
    pub fn second_derivative(&self, expr: &Expression, var: &str) -> Expression {
        let first = self.derivative(expr, var);
        self.derivative(&first, var)
    }

    /// Compute partial derivative (multi-variable)
    pub fn partial_derivative(&self, expr: &Expression, var: &str, order: usize) -> Expression {
        let mut result = expr.clone();
        for _ in 0..order {
            result = self.derivative(&result, var);
        }
        result
    }

    fn derivative_unsimplified(&self, expr: &Expression, var: &str) -> Expression {
        match expr {
            Expression::Number(_) => Expression::number(0.0),

            Expression::Variable(name) => {
                if name == var {
                    Expression::number(1.0)
                } else {
                    Expression::number(0.0)
                }
            }

            Expression::UnaryOp { op, operand } => {
                match op {
                    UnaryOperator::Negate => {
                        Expression::unary_op(UnaryOperator::Negate, self.derivative_unsimplified(operand, var))
                    }
                    UnaryOperator::Not | UnaryOperator::Abs => {
                        // Not differentiable in symbolic form, return 0
                        Expression::number(0.0)
                    }
                }
            }

            Expression::BinaryOp { op, left, right } => {
                match op {
                    // Sum rule: d/dx(u + v) = u' + v'
                    BinaryOperator::Add => {
                        let left_deriv = self.derivative_unsimplified(left, var);
                        let right_deriv = self.derivative_unsimplified(right, var);
                        left_deriv.add(right_deriv)
                    }

                    // Difference rule: d/dx(u - v) = u' - v'
                    BinaryOperator::Subtract => {
                        let left_deriv = self.derivative_unsimplified(left, var);
                        let right_deriv = self.derivative_unsimplified(right, var);
                        left_deriv.subtract(right_deriv)
                    }

                    // Product rule: d/dx(u*v) = u'*v + u*v'
                    BinaryOperator::Multiply => {
                        let left_deriv = self.derivative_unsimplified(left, var);
                        let right_deriv = self.derivative_unsimplified(right, var);

                        let first_term = left_deriv.multiply(right.as_ref().clone());
                        let second_term = left.as_ref().clone().multiply(right_deriv);

                        first_term.add(second_term)
                    }

                    // Quotient rule: d/dx(u/v) = (u'*v - u*v') / v^2
                    BinaryOperator::Divide => {
                        let left_deriv = self.derivative_unsimplified(left, var);
                        let right_deriv = self.derivative_unsimplified(right, var);

                        let numerator = left_deriv
                            .multiply(right.as_ref().clone())
                            .subtract(left.as_ref().clone().multiply(right_deriv));

                        let denominator = right.as_ref().clone().power(Expression::number(2.0));

                        numerator.divide(denominator)
                    }

                    // Power rule: d/dx(x^n) = n*x^(n-1)
                    // General power rule (chain rule): d/dx(u^n) = n*u^(n-1) * u'
                    BinaryOperator::Power => {
                        // Check if right side is constant
                        if !self.contains_variable(right, var) {
                            // u^n case: d/dx(u^n) = n*u^(n-1)*u'
                            let left_deriv = self.derivative_unsimplified(left, var);
                            let exponent_minus_one = right.as_ref().clone().subtract(Expression::number(1.0));
                            let power_part = left.as_ref().clone().power(exponent_minus_one);

                            right.as_ref()
                                .clone()
                                .multiply(power_part)
                                .multiply(left_deriv)
                        } else {
                            // x^x or more complex: use a^b = e^(b*ln(a))
                            // d/dx(a^b) = a^b * (b'*ln(a) + b*a'/a)
                            let a = left.as_ref().clone();
                            let b = right.as_ref().clone();
                            let a_deriv = self.derivative_unsimplified(&a, var);
                            let b_deriv = self.derivative_unsimplified(&b, var);

                            let ln_a = Expression::function("ln", vec![a.clone()]);
                            let a_over_deriv = a_deriv.divide(a);

                            let term1 = b_deriv.multiply(ln_a);
                            let term2 = b.multiply(a_over_deriv);

                            let power_expr = a.power(b);
                            power_expr.multiply(term1.add(term2))
                        }
                    }

                    // Modulo rule (not typically differentiated)
                    BinaryOperator::Modulo => Expression::number(0.0),

                    // Logical operators (not differentiable)
                    BinaryOperator::And
                    | BinaryOperator::Or
                    | BinaryOperator::Equal
                    | BinaryOperator::NotEqual
                    | BinaryOperator::LessThan
                    | BinaryOperator::LessEqual
                    | BinaryOperator::GreaterThan
                    | BinaryOperator::GreaterEqual => Expression::number(0.0),
                }
            }

            Expression::Function { name, args } => {
                if args.is_empty() {
                    return Expression::number(0.0);
                }

                // Chain rule for functions
                let arg = &args[0];
                let arg_deriv = self.derivative_unsimplified(arg, var);

                match name.as_str() {
                    "sin" => {
                        Expression::function("cos", vec![arg.clone()]).multiply(arg_deriv)
                    }
                    "cos" => {
                        Expression::unary_op(UnaryOperator::Negate, Expression::function("sin", vec![arg.clone()]))
                            .multiply(arg_deriv)
                    }
                    "tan" => {
                        let sec_squared = Expression::function("cos", vec![arg.clone()])
                            .power(Expression::number(2.0));
                        Expression::number(1.0).divide(sec_squared).multiply(arg_deriv)
                    }
                    "asin" => {
                        let sqrt_term = Expression::function("sqrt", vec![
                            Expression::number(1.0)
                                .subtract(arg.clone().power(Expression::number(2.0))),
                        ]);
                        Expression::number(1.0).divide(sqrt_term).multiply(arg_deriv)
                    }
                    "acos" => {
                        let sqrt_term = Expression::function("sqrt", vec![
                            Expression::number(1.0)
                                .subtract(arg.clone().power(Expression::number(2.0))),
                        ]);
                        Expression::number(-1.0)
                            .divide(sqrt_term)
                            .multiply(arg_deriv)
                    }
                    "atan" => {
                        let denom = Expression::number(1.0)
                            .add(arg.clone().power(Expression::number(2.0)));
                        Expression::number(1.0).divide(denom).multiply(arg_deriv)
                    }
                    "exp" => {
                        Expression::function("exp", vec![arg.clone()]).multiply(arg_deriv)
                    }
                    "ln" | "log" => {
                        Expression::number(1.0).divide(arg.clone()).multiply(arg_deriv)
                    }
                    "sqrt" => {
                        let denominator = Expression::function("sqrt", vec![arg.clone()])
                            .multiply(Expression::number(2.0));
                        Expression::number(1.0).divide(denominator).multiply(arg_deriv)
                    }
                    "abs" => {
                        // abs(x) has derivative sign(x) * x', but sign is not continuous at 0
                        Expression::number(0.0)
                    }
                    "floor" | "ceil" | "round" => {
                        Expression::number(0.0)
                    }
                    _ => Expression::number(0.0),
                }
            }
        }
    }

    /// Check if expression contains a variable
    fn contains_variable(&self, expr: &Expression, var: &str) -> bool {
        match expr {
            Expression::Number(_) => false,
            Expression::Variable(name) => name == var,
            Expression::UnaryOp { operand, .. } => self.contains_variable(operand, var),
            Expression::BinaryOp { left, right, .. } => {
                self.contains_variable(left, var) || self.contains_variable(right, var)
            }
            Expression::Function { args, .. } => args.iter().any(|arg| self.contains_variable(arg, var)),
        }
    }

    /// Compute indefinite integral (basic symbolic integration)
    ///
    /// Supports:
    /// - Power rule: ∫x^n dx = x^(n+1)/(n+1)
    /// - Trigonometric: ∫sin(x) dx, ∫cos(x) dx, etc.
    /// - Exponential: ∫e^x dx = e^x
    /// - Logarithmic: ∫1/x dx = ln(|x|)
    ///
    /// # Arguments
    /// * `expr` - Expression to integrate
    /// * `var` - Variable of integration
    ///
    /// # Returns
    /// * Antiderivative expression (without constant of integration)
    pub fn indefinite_integral(&self, expr: &Expression, var: &str) -> Result<Expression, String> {
        // Simple integration rules
        // This is a basic implementation - full symbolic integration is complex
        match expr {
            Expression::Number(n) => {
                // ∫c dx = c*x
                Ok(Expression::number(*n).multiply(Expression::variable(var)))
            }

            Expression::Variable(name) => {
                if name == var {
                    // ∫x dx = x^2/2
                    let x_squared = Expression::variable(var).power(Expression::number(2.0));
                    Ok(x_squared.divide(Expression::number(2.0)))
                } else {
                    // ∫y dx = y*x (y is constant w.r.t. x)
                    Ok(Expression::variable(name).multiply(Expression::variable(var)))
                }
            }

            Expression::BinaryOp { op: BinaryOperator::Add, left, right } => {
                // ∫(u + v) dx = ∫u dx + ∫v dx
                let left_integral = self.indefinite_integral(left, var)?;
                let right_integral = self.indefinite_integral(right, var)?;
                Ok(left_integral.add(right_integral))
            }

            Expression::BinaryOp { op: BinaryOperator::Subtract, left, right } => {
                // ∫(u - v) dx = ∫u dx - ∫v dx
                let left_integral = self.indefinite_integral(left, var)?;
                let right_integral = self.indefinite_integral(right, var)?;
                Ok(left_integral.subtract(right_integral))
            }

            Expression::BinaryOp {
                op: BinaryOperator::Multiply,
                left,
                right,
            } => {
                // Check if one side is constant
                if !self.contains_variable(left, var) {
                    // ∫c*u dx = c*∫u dx
                    let u_integral = self.indefinite_integral(right, var)?;
                    Ok(left.as_ref().clone().multiply(u_integral))
                } else if !self.contains_variable(right, var) {
                    // ∫u*c dx = ∫u dx * c
                    let u_integral = self.indefinite_integral(left, var)?;
                    Ok(u_integral.multiply(right.as_ref().clone()))
                } else {
                    // General multiplication case - would require integration by parts
                    Err("Integration by parts not implemented".to_string())
                }
            }

            Expression::BinaryOp {
                op: BinaryOperator::Power,
                left,
                right,
            } => {
                // ∫x^n dx = x^(n+1)/(n+1) for n ≠ -1
                if !self.contains_variable(right, var) {
                    if let Expression::Number(n) = right.as_ref() {
                        if *n == -1.0 {
                            // ∫x^(-1) dx = ln(|x|)
                            return Ok(Expression::function("ln", vec![Expression::variable(var)]));
                        }
                        let new_power = n + 1.0;
                        let x_to_new_power = Expression::variable(var).power(Expression::number(new_power));
                        return Ok(x_to_new_power.divide(Expression::number(new_power)));
                    }
                }
                Err("Complex power integral not implemented".to_string())
            }

            Expression::Function { name, args } => {
                if args.len() != 1 {
                    return Err("Only single-argument functions supported".to_string());
                }

                let arg = &args[0];
                if !self.contains_variable(arg, var) {
                    return Err("Constant function integration needs implementation".to_string());
                }

                // Check if argument is simple variable
                if arg == &Expression::variable(var) {
                    match name.as_str() {
                        "sin" => {
                            // ∫sin(x) dx = -cos(x)
                            Ok(Expression::unary_op(
                                UnaryOperator::Negate,
                                Expression::function("cos", vec![Expression::variable(var)]),
                            ))
                        }
                        "cos" => {
                            // ∫cos(x) dx = sin(x)
                            Ok(Expression::function("sin", vec![Expression::variable(var)]))
                        }
                        "tan" => {
                            // ∫tan(x) dx = -ln(|cos(x)|)
                            let cos_x = Expression::function("cos", vec![Expression::variable(var)]);
                            let ln_cos = Expression::function("ln", vec![cos_x]);
                            Ok(Expression::unary_op(UnaryOperator::Negate, ln_cos))
                        }
                        "exp" => {
                            // ∫e^x dx = e^x
                            Ok(Expression::function("exp", vec![Expression::variable(var)]))
                        }
                        "sqrt" => {
                            // ∫√x dx = (2/3)x^(3/2)
                            let x_3_2 = Expression::variable(var).power(Expression::number(1.5));
                            Ok(x_3_2.multiply(Expression::number(2.0 / 3.0)))
                        }
                        _ => Err(format!("Integration of {} not supported", name)),
                    }
                } else {
                    Err("Substitution rule not implemented".to_string())
                }
            }

            _ => Err("Cannot integrate this expression".to_string()),
        }
    }

    /// Evaluate limit of expression as variable approaches a value
    ///
    /// Uses numerical approach: evaluate at points approaching the limit
    ///
    /// # Arguments
    /// * `expr` - Expression to evaluate
    /// * `var` - Variable for limit
    /// * `value` - Value variable approaches
    /// * `tolerance` - Convergence tolerance
    ///
    /// # Returns
    /// * Approximate limit value
    pub fn limit(
        &self,
        expr: &Expression,
        var: &str,
        value: f64,
        tolerance: f64,
    ) -> Result<f64, String> {
        let mut context = HashMap::new();

        // Approach from both sides
        let left_limit = self.approach_limit(expr, var, value, -tolerance, &mut context)?;
        let right_limit = self.approach_limit(expr, var, value, tolerance, &mut context)?;

        // Check if limits agree
        if (left_limit - right_limit).abs() < 0.001 {
            Ok((left_limit + right_limit) / 2.0)
        } else {
            Err("Left and right limits differ".to_string())
        }
    }

    fn approach_limit(
        &self,
        expr: &Expression,
        var: &str,
        value: f64,
        direction: f64,
        context: &mut HashMap<String, f64>,
    ) -> Result<f64, String> {
        // Evaluate at progressively closer points
        let mut prev_value = f64::NAN;

        for i in 1..=10 {
            let epsilon = 10f64.powi(-(i as i32));
            context.insert(var.to_string(), value + direction * epsilon);

            let current_value = expr.evaluate(context).map_err(|e| format!("Evaluation error: {}", e))?;

            if !current_value.is_nan() && !current_value.is_infinite() {
                if !prev_value.is_nan() && (current_value - prev_value).abs() < 1e-10 {
                    return Ok(current_value);
                }
                prev_value = current_value;
            }
        }

        Ok(prev_value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derivative_constant() {
        let calc = Calculus::new();
        let expr = Expression::number(5.0);
        let deriv = calc.derivative(&expr, "x");
        assert_eq!(deriv, Expression::number(0.0));
    }

    #[test]
    fn test_derivative_variable() {
        let calc = Calculus::new();
        let expr = Expression::variable("x");
        let deriv = calc.derivative(&expr, "x");
        assert_eq!(deriv, Expression::number(1.0));
    }

    #[test]
    fn test_derivative_different_variable() {
        let calc = Calculus::new();
        let expr = Expression::variable("y");
        let deriv = calc.derivative(&expr, "x");
        assert_eq!(deriv, Expression::number(0.0));
    }

    #[test]
    fn test_derivative_sum() {
        let calc = Calculus::new();
        let expr = Expression::variable("x").add(Expression::variable("y"));
        let deriv = calc.derivative(&expr, "x");
        // d/dx(x + y) = 1 + 0 = 1
        let result = deriv.evaluate(&HashMap::new());
        assert!(result.is_ok());
    }

    #[test]
    fn test_derivative_product() {
        let calc = Calculus::new();
        // d/dx(x * x) = x + x = 2x
        let expr = Expression::variable("x").multiply(Expression::variable("x"));
        let deriv = calc.derivative(&expr, "x");

        let mut context = HashMap::new();
        context.insert("x".to_string(), 3.0);
        let result = deriv.evaluate(&context).unwrap();
        // Should be approximately 6.0 (2*3)
        assert!((result - 6.0).abs() < 0.1);
    }

    #[test]
    fn test_derivative_power() {
        let calc = Calculus::new();
        // d/dx(x^3) = 3*x^2
        let expr = Expression::variable("x").power(Expression::number(3.0));
        let deriv = calc.derivative(&expr, "x");

        let mut context = HashMap::new();
        context.insert("x".to_string(), 2.0);
        let result = deriv.evaluate(&context).unwrap();
        // Should be 3*2^2 = 12
        assert!((result - 12.0).abs() < 0.5);
    }

    #[test]
    fn test_derivative_negation() {
        let calc = Calculus::new();
        // d/dx(-x) = -1
        let expr = Expression::variable("x").negate();
        let deriv = calc.derivative(&expr, "x");
        assert_eq!(deriv, Expression::number(-1.0));
    }

    #[test]
    fn test_second_derivative() {
        let calc = Calculus::new();
        // d²/dx²(x^3) = d/dx(3x^2) = 6x
        let expr = Expression::variable("x").power(Expression::number(3.0));
        let second_deriv = calc.second_derivative(&expr, "x");

        let mut context = HashMap::new();
        context.insert("x".to_string(), 2.0);
        let result = second_deriv.evaluate(&context).unwrap();
        // Should be 6*2 = 12
        assert!((result - 12.0).abs() < 1.0);
    }

    #[test]
    fn test_integral_constant() {
        let calc = Calculus::new();
        let expr = Expression::number(5.0);
        let integral = calc.indefinite_integral(&expr, "x").unwrap();
        // ∫5 dx = 5x
        let mut context = HashMap::new();
        context.insert("x".to_string(), 2.0);
        let result = integral.evaluate(&context).unwrap();
        assert!((result - 10.0).abs() < 0.1);
    }

    #[test]
    fn test_integral_variable() {
        let calc = Calculus::new();
        let expr = Expression::variable("x");
        let integral = calc.indefinite_integral(&expr, "x").unwrap();
        // ∫x dx = x^2/2
        let mut context = HashMap::new();
        context.insert("x".to_string(), 4.0);
        let result = integral.evaluate(&context).unwrap();
        assert!((result - 8.0).abs() < 0.1);
    }

    #[test]
    fn test_integral_sum() {
        let calc = Calculus::new();
        let expr = Expression::variable("x")
            .add(Expression::number(1.0));
        let integral = calc.indefinite_integral(&expr, "x").unwrap();
        // ∫(x + 1) dx = x^2/2 + x
        let mut context = HashMap::new();
        context.insert("x".to_string(), 2.0);
        let result = integral.evaluate(&context).unwrap();
        // 2^2/2 + 2 = 2 + 2 = 4
        assert!((result - 4.0).abs() < 0.5);
    }

    #[test]
    fn test_integral_sin() {
        let calc = Calculus::new();
        let expr = Expression::function("sin", vec![Expression::variable("x")]);
        let integral = calc.indefinite_integral(&expr, "x").unwrap();
        // ∫sin(x) dx = -cos(x)
        let mut context = HashMap::new();
        context.insert("x".to_string(), 0.0);
        let result = integral.evaluate(&context).unwrap();
        // -cos(0) = -1
        assert!((result - (-1.0)).abs() < 0.1);
    }

    #[test]
    fn test_integral_exp() {
        let calc = Calculus::new();
        let expr = Expression::function("exp", vec![Expression::variable("x")]);
        let integral = calc.indefinite_integral(&expr, "x").unwrap();
        // ∫e^x dx = e^x
        let mut context = HashMap::new();
        context.insert("x".to_string(), 0.0);
        let result = integral.evaluate(&context).unwrap();
        // e^0 = 1
        assert!((result - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_contains_variable() {
        let calc = Calculus::new();
        let expr = Expression::variable("x").add(Expression::number(5.0));
        assert!(calc.contains_variable(&expr, "x"));
        assert!(!calc.contains_variable(&expr, "y"));
    }

    #[test]
    fn test_derivative_sin() {
        let calc = Calculus::new();
        // d/dx(sin(x)) = cos(x)
        let expr = Expression::function("sin", vec![Expression::variable("x")]);
        let deriv = calc.derivative(&expr, "x");

        let mut context = HashMap::new();
        context.insert("x".to_string(), 0.0);
        let result = deriv.evaluate(&context).unwrap();
        // cos(0) = 1
        assert!((result - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_derivative_exp() {
        let calc = Calculus::new();
        // d/dx(e^x) = e^x
        let expr = Expression::function("exp", vec![Expression::variable("x")]);
        let deriv = calc.derivative(&expr, "x");

        let mut context = HashMap::new();
        context.insert("x".to_string(), 0.0);
        let result = deriv.evaluate(&context).unwrap();
        // e^0 = 1
        assert!((result - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_limit_simple() {
        let calc = Calculus::new();
        // lim x→2 of (x + 1) = 3
        let expr = Expression::variable("x").add(Expression::number(1.0));
        let result = calc.limit(&expr, "x", 2.0, 0.1).unwrap();
        assert!((result - 3.0).abs() < 0.01);
    }

    #[test]
    fn test_partial_derivative_order() {
        let calc = Calculus::new();
        // d²/dx²(x^3)
        let expr = Expression::variable("x").power(Expression::number(3.0));
        let result = calc.partial_derivative(&expr, "x", 2);

        let mut context = HashMap::new();
        context.insert("x".to_string(), 1.0);
        let value = result.evaluate(&context).unwrap();
        // d²/dx²(x^3) = 6x, so at x=1: 6
        assert!((value - 6.0).abs() < 1.0);
    }
}
