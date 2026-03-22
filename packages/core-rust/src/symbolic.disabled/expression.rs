//! Symbolic expression representation and evaluation
//!
//! This module provides the core data structures for symbolic computation:
//! - Expression trees (variables, numbers, operators, functions)
//! - Variable binding and substitution
//! - Expression evaluation with context
//! - Pretty printing and serialization

use std::collections::HashMap;
use std::fmt;

/// A symbolic mathematical expression
#[derive(Debug, Clone, PartialEq)]
pub enum Expression {
    /// Numeric literal (e.g., 42, 3.14)
    Number(f64),
    /// Variable reference (e.g., x, y, theta)
    Variable(String),
    /// Binary operation (e.g., x + y, a * b)
    BinaryOp {
        op: BinaryOperator,
        left: Box<Expression>,
        right: Box<Expression>,
    },
    /// Unary operation (e.g., -x, !a)
    UnaryOp {
        op: UnaryOperator,
        operand: Box<Expression>,
    },
    /// Function call (e.g., sin(x), sqrt(y))
    Function {
        name: String,
        args: Vec<Expression>,
    },
}

/// Binary mathematical operators
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BinaryOperator {
    /// Addition
    Add,
    /// Subtraction
    Subtract,
    /// Multiplication
    Multiply,
    /// Division
    Divide,
    /// Exponentiation/Power
    Power,
    /// Modulo/Remainder
    Modulo,
    /// Logical AND
    And,
    /// Logical OR
    Or,
    /// Equality
    Equal,
    /// Inequality
    NotEqual,
    /// Less than
    LessThan,
    /// Less than or equal
    LessEqual,
    /// Greater than
    GreaterThan,
    /// Greater than or equal
    GreaterEqual,
}

impl fmt::Display for BinaryOperator {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Add => write!(f, "+"),
            Self::Subtract => write!(f, "-"),
            Self::Multiply => write!(f, "*"),
            Self::Divide => write!(f, "/"),
            Self::Power => write!(f, "^"),
            Self::Modulo => write!(f, "%"),
            Self::And => write!(f, "&&"),
            Self::Or => write!(f, "||"),
            Self::Equal => write!(f, "=="),
            Self::NotEqual => write!(f, "!="),
            Self::LessThan => write!(f, "<"),
            Self::LessEqual => write!(f, "<="),
            Self::GreaterThan => write!(f, ">"),
            Self::GreaterEqual => write!(f, ">="),
        }
    }
}

/// Unary mathematical operators
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UnaryOperator {
    /// Negation
    Negate,
    /// Logical NOT
    Not,
    /// Absolute value (unary)
    Abs,
}

impl fmt::Display for UnaryOperator {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Negate => write!(f, "-"),
            Self::Not => write!(f, "!"),
            Self::Abs => write!(f, "abs"),
        }
    }
}

impl Expression {
    /// Create a numeric literal
    pub fn number(value: f64) -> Self {
        Self::Number(value)
    }

    /// Create a variable reference
    pub fn variable(name: impl Into<String>) -> Self {
        Self::Variable(name.into())
    }

    /// Create a binary operation
    pub fn binary_op(op: BinaryOperator, left: Expression, right: Expression) -> Self {
        Self::BinaryOp {
            op,
            left: Box::new(left),
            right: Box::new(right),
        }
    }

    /// Create a unary operation
    pub fn unary_op(op: UnaryOperator, operand: Expression) -> Self {
        Self::UnaryOp {
            op,
            operand: Box::new(operand),
        }
    }

    /// Create a function call
    pub fn function(name: impl Into<String>, args: Vec<Expression>) -> Self {
        Self::Function {
            name: name.into(),
            args,
        }
    }

    /// Add two expressions
    pub fn add(self, other: Expression) -> Self {
        Self::binary_op(BinaryOperator::Add, self, other)
    }

    /// Subtract two expressions
    pub fn subtract(self, other: Expression) -> Self {
        Self::binary_op(BinaryOperator::Subtract, self, other)
    }

    /// Multiply two expressions
    pub fn multiply(self, other: Expression) -> Self {
        Self::binary_op(BinaryOperator::Multiply, self, other)
    }

    /// Divide two expressions
    pub fn divide(self, other: Expression) -> Self {
        Self::binary_op(BinaryOperator::Divide, self, other)
    }

    /// Raise to a power
    pub fn power(self, exponent: Expression) -> Self {
        Self::binary_op(BinaryOperator::Power, self, exponent)
    }

    /// Apply modulo
    pub fn modulo(self, divisor: Expression) -> Self {
        Self::binary_op(BinaryOperator::Modulo, self, divisor)
    }

    /// Negate the expression
    pub fn negate(self) -> Self {
        Self::unary_op(UnaryOperator::Negate, self)
    }

    /// Get all variables used in this expression
    pub fn variables(&self) -> Vec<String> {
        let mut vars = Vec::new();
        self.collect_variables(&mut vars);
        vars.sort();
        vars.dedup();
        vars
    }

    fn collect_variables(&self, vars: &mut Vec<String>) {
        match self {
            Self::Number(_) => {}
            Self::Variable(name) => {
                vars.push(name.clone());
            }
            Self::BinaryOp { left, right, .. } => {
                left.collect_variables(vars);
                right.collect_variables(vars);
            }
            Self::UnaryOp { operand, .. } => {
                operand.collect_variables(vars);
            }
            Self::Function { args, .. } => {
                for arg in args {
                    arg.collect_variables(vars);
                }
            }
        }
    }

    /// Evaluate the expression with given variable context
    ///
    /// # Arguments
    /// * `context` - HashMap of variable names to values
    ///
    /// # Returns
    /// * `Result<f64, String>` - Computed value or error message
    pub fn evaluate(&self, context: &HashMap<String, f64>) -> Result<f64, String> {
        match self {
            Self::Number(value) => Ok(*value),
            Self::Variable(name) => context
                .get(name)
                .copied()
                .ok_or_else(|| format!("Undefined variable: {}", name)),
            Self::BinaryOp { op, left, right } => {
                let left_val = left.evaluate(context)?;
                let right_val = right.evaluate(context)?;
                Self::eval_binary_op(*op, left_val, right_val)
            }
            Self::UnaryOp { op, operand } => {
                let val = operand.evaluate(context)?;
                Self::eval_unary_op(*op, val)
            }
            Self::Function { name, args } => {
                Self::eval_function(name, args, context)
            }
        }
    }

    fn eval_binary_op(op: BinaryOperator, left: f64, right: f64) -> Result<f64, String> {
        Ok(match op {
            BinaryOperator::Add => left + right,
            BinaryOperator::Subtract => left - right,
            BinaryOperator::Multiply => left * right,
            BinaryOperator::Divide => {
                if right == 0.0 {
                    return Err("Division by zero".to_string());
                }
                left / right
            }
            BinaryOperator::Power => left.powf(right),
            BinaryOperator::Modulo => left % right,
            BinaryOperator::And => ((left != 0.0) && (right != 0.0)) as i32 as f64,
            BinaryOperator::Or => ((left != 0.0) || (right != 0.0)) as i32 as f64,
            BinaryOperator::Equal => (left == right) as i32 as f64,
            BinaryOperator::NotEqual => (left != right) as i32 as f64,
            BinaryOperator::LessThan => (left < right) as i32 as f64,
            BinaryOperator::LessEqual => (left <= right) as i32 as f64,
            BinaryOperator::GreaterThan => (left > right) as i32 as f64,
            BinaryOperator::GreaterEqual => (left >= right) as i32 as f64,
        })
    }

    fn eval_unary_op(op: UnaryOperator, value: f64) -> Result<f64, String> {
        Ok(match op {
            UnaryOperator::Negate => -value,
            UnaryOperator::Not => (value == 0.0) as i32 as f64,
            UnaryOperator::Abs => value.abs(),
        })
    }

    fn eval_function(name: &str, args: &[Expression], context: &HashMap<String, f64>) -> Result<f64, String> {
        let arg_vals: Result<Vec<f64>, String> = args.iter().map(|arg| arg.evaluate(context)).collect();
        let vals = arg_vals?;

        Ok(match name {
            "sin" if vals.len() == 1 => vals[0].sin(),
            "cos" if vals.len() == 1 => vals[0].cos(),
            "tan" if vals.len() == 1 => vals[0].tan(),
            "asin" if vals.len() == 1 => vals[0].asin(),
            "acos" if vals.len() == 1 => vals[0].acos(),
            "atan" if vals.len() == 1 => vals[0].atan(),
            "sinh" if vals.len() == 1 => vals[0].sinh(),
            "cosh" if vals.len() == 1 => vals[0].cosh(),
            "tanh" if vals.len() == 1 => vals[0].tanh(),
            "exp" if vals.len() == 1 => vals[0].exp(),
            "ln" | "log" if vals.len() == 1 => {
                if vals[0] <= 0.0 {
                    return Err(format!("Cannot take logarithm of non-positive number: {}", vals[0]));
                }
                vals[0].ln()
            }
            "log10" if vals.len() == 1 => {
                if vals[0] <= 0.0 {
                    return Err(format!("Cannot take logarithm of non-positive number: {}", vals[0]));
                }
                vals[0].log10()
            }
            "log" if vals.len() == 2 => {
                if vals[0] <= 0.0 || vals[1] <= 0.0 {
                    return Err("Base and argument must be positive".to_string());
                }
                vals[0].log(vals[1])
            }
            "sqrt" if vals.len() == 1 => {
                if vals[0] < 0.0 {
                    return Err("Cannot take square root of negative number".to_string());
                }
                vals[0].sqrt()
            }
            "pow" | "power" if vals.len() == 2 => vals[0].powf(vals[1]),
            "abs" if vals.len() == 1 => vals[0].abs(),
            "floor" if vals.len() == 1 => vals[0].floor(),
            "ceil" if vals.len() == 1 => vals[0].ceil(),
            "round" if vals.len() == 1 => vals[0].round(),
            "min" if vals.len() >= 2 => vals.iter().fold(f64::INFINITY, |a, &b| a.min(b)),
            "max" if vals.len() >= 2 => vals.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b)),
            "sum" if vals.len() >= 1 => vals.iter().sum(),
            "avg" | "mean" if vals.len() >= 1 => vals.iter().sum::<f64>() / vals.len() as f64,
            _ => return Err(format!("Unknown function: {}", name)),
        })
    }

    /// Substitute all occurrences of a variable with an expression
    pub fn substitute(&self, var: &str, expr: &Expression) -> Expression {
        match self {
            Self::Number(n) => Self::Number(*n),
            Self::Variable(name) => {
                if name == var {
                    expr.clone()
                } else {
                    Self::Variable(name.clone())
                }
            }
            Self::BinaryOp { op, left, right } => {
                Self::BinaryOp {
                    op: *op,
                    left: Box::new(left.substitute(var, expr)),
                    right: Box::new(right.substitute(var, expr)),
                }
            }
            Self::UnaryOp { op, operand } => {
                Self::UnaryOp {
                    op: *op,
                    operand: Box::new(operand.substitute(var, expr)),
                }
            }
            Self::Function { name, args } => {
                Self::Function {
                    name: name.clone(),
                    args: args.iter().map(|arg| arg.substitute(var, expr)).collect(),
                }
            }
        }
    }

    /// Count the number of operations in this expression (tree depth)
    pub fn complexity(&self) -> usize {
        match self {
            Self::Number(_) => 0,
            Self::Variable(_) => 0,
            Self::BinaryOp { left, right, .. } => 1 + left.complexity() + right.complexity(),
            Self::UnaryOp { operand, .. } => 1 + operand.complexity(),
            Self::Function { args, .. } => 1 + args.iter().map(|a| a.complexity()).sum::<usize>(),
        }
    }
}

impl fmt::Display for Expression {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Number(n) => {
                // Display integers without decimal point
                if n.fract() == 0.0 {
                    write!(f, "{}", *n as i64)
                } else {
                    write!(f, "{}", n)
                }
            }
            Self::Variable(name) => write!(f, "{}", name),
            Self::BinaryOp { op, left, right } => {
                write!(f, "({} {} {})", left, op, right)
            }
            Self::UnaryOp { op, operand } => {
                match op {
                    UnaryOperator::Negate => write!(f, "-({})", operand),
                    UnaryOperator::Not => write!(f, "!({})", operand),
                    UnaryOperator::Abs => write!(f, "abs({})", operand),
                }
            }
            Self::Function { name, args } => {
                write!(f, "{}(", name)?;
                for (i, arg) in args.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}", arg)?;
                }
                write!(f, ")")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_number_expression() {
        let expr = Expression::number(42.0);
        assert_eq!(expr, Expression::Number(42.0));
    }

    #[test]
    fn test_variable_expression() {
        let expr = Expression::variable("x");
        assert_eq!(expr, Expression::Variable("x".to_string()));
    }

    #[test]
    fn test_binary_operation() {
        let expr = Expression::number(2.0).add(Expression::number(3.0));
        match expr {
            Expression::BinaryOp { op, .. } => assert_eq!(op, BinaryOperator::Add),
            _ => panic!("Expected BinaryOp"),
        }
    }

    #[test]
    fn test_unary_operation() {
        let expr = Expression::number(5.0).negate();
        match expr {
            Expression::UnaryOp { op, .. } => assert_eq!(op, UnaryOperator::Negate),
            _ => panic!("Expected UnaryOp"),
        }
    }

    #[test]
    fn test_evaluate_number() {
        let expr = Expression::number(42.0);
        let context = HashMap::new();
        assert_eq!(expr.evaluate(&context).unwrap(), 42.0);
    }

    #[test]
    fn test_evaluate_variable() {
        let expr = Expression::variable("x");
        let mut context = HashMap::new();
        context.insert("x".to_string(), 10.0);
        assert_eq!(expr.evaluate(&context).unwrap(), 10.0);
    }

    #[test]
    fn test_evaluate_addition() {
        let expr = Expression::number(2.0).add(Expression::number(3.0));
        let context = HashMap::new();
        assert_eq!(expr.evaluate(&context).unwrap(), 5.0);
    }

    #[test]
    fn test_evaluate_complex_expression() {
        // (2 + 3) * (4 - 1) = 15
        let expr = Expression::number(2.0)
            .add(Expression::number(3.0))
            .multiply(Expression::number(4.0).subtract(Expression::number(1.0)));
        let context = HashMap::new();
        assert_eq!(expr.evaluate(&context).unwrap(), 15.0);
    }

    #[test]
    fn test_evaluate_division_by_zero() {
        let expr = Expression::number(1.0).divide(Expression::number(0.0));
        let context = HashMap::new();
        assert!(expr.evaluate(&context).is_err());
    }

    #[test]
    fn test_evaluate_function_sin() {
        let expr = Expression::function("sin", vec![Expression::number(0.0)]);
        let context = HashMap::new();
        let result = expr.evaluate(&context).unwrap();
        assert!((result - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_evaluate_function_sqrt() {
        let expr = Expression::function("sqrt", vec![Expression::number(9.0)]);
        let context = HashMap::new();
        assert_eq!(expr.evaluate(&context).unwrap(), 3.0);
    }

    #[test]
    fn test_evaluate_function_max() {
        let expr = Expression::function("max", vec![
            Expression::number(5.0),
            Expression::number(3.0),
            Expression::number(8.0),
        ]);
        let context = HashMap::new();
        assert_eq!(expr.evaluate(&context).unwrap(), 8.0);
    }

    #[test]
    fn test_variables_collection() {
        let expr = Expression::variable("x")
            .add(Expression::variable("y"))
            .multiply(Expression::variable("x"));
        let vars = expr.variables();
        assert_eq!(vars.len(), 2);
        assert!(vars.contains(&"x".to_string()));
        assert!(vars.contains(&"y".to_string()));
    }

    #[test]
    fn test_substitute() {
        // Substitute x=5 in (x + 3)
        let expr = Expression::variable("x").add(Expression::number(3.0));
        let substituted = expr.substitute("x", &Expression::number(5.0));
        let context = HashMap::new();
        assert_eq!(substituted.evaluate(&context).unwrap(), 8.0);
    }

    #[test]
    fn test_substitute_in_complex_expression() {
        // Substitute x=2 in (x + y) * x
        let expr = Expression::variable("x")
            .add(Expression::variable("y"))
            .multiply(Expression::variable("x"));
        let substituted = expr.substitute("x", &Expression::number(2.0));
        let mut context = HashMap::new();
        context.insert("y".to_string(), 3.0);
        // (2 + 3) * 2 = 10
        assert_eq!(substituted.evaluate(&context).unwrap(), 10.0);
    }

    #[test]
    fn test_complexity() {
        let simple = Expression::number(5.0);
        assert_eq!(simple.complexity(), 0);

        let binary = Expression::number(2.0).add(Expression::number(3.0));
        assert_eq!(binary.complexity(), 1);

        let nested = Expression::number(2.0)
            .add(Expression::number(3.0))
            .multiply(Expression::number(4.0));
        assert_eq!(nested.complexity(), 2);
    }

    #[test]
    fn test_display() {
        let expr = Expression::variable("x").add(Expression::number(5.0));
        let s = expr.to_string();
        assert!(s.contains("x"));
        assert!(s.contains("5"));
        assert!(s.contains("+"));
    }

    #[test]
    fn test_chain_operations() {
        let expr = Expression::variable("x")
            .add(Expression::variable("y"))
            .multiply(Expression::variable("z"))
            .subtract(Expression::number(10.0));
        let mut context = HashMap::new();
        context.insert("x".to_string(), 2.0);
        context.insert("y".to_string(), 3.0);
        context.insert("z".to_string(), 4.0);
        // ((2 + 3) * 4) - 10 = 20 - 10 = 10
        assert_eq!(expr.evaluate(&context).unwrap(), 10.0);
    }
}
