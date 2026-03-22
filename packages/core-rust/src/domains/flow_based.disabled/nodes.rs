//! Standard node library for flow-based programming
//!
//! Provides 20+ built-in nodes for common operations.

use crate::domains::flow_based::{DataType, FlowNode, FlowNodeId, FlowPort, NodeCategory};

/// Factory functions for creating standard nodes
pub struct StandardNodes;

impl StandardNodes {
    // ===== MATH NODES =====

    /// Add two numbers
    pub fn add() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Add", "add", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Adds two numbers together")
    }

    /// Subtract two numbers
    pub fn subtract() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Subtract", "subtract", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Subtracts b from a")
    }

    /// Multiply two numbers
    pub fn multiply() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Multiply", "multiply", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Multiplies two numbers")
    }

    /// Divide two numbers
    pub fn divide() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Divide", "divide", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .add_output(FlowPort::output("error", DataType::String))
            .with_description("Divides a by b (checks for division by zero)")
    }

    /// Modulo operation
    pub fn modulo() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Modulo", "modulo", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Returns remainder of a divided by b")
    }

    /// Square root
    pub fn sqrt() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Square Root", "sqrt", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates square root of a number")
    }

    /// Absolute value
    pub fn abs() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Absolute", "abs", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Returns absolute value")
    }

    /// Round to nearest integer
    pub fn round() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Round", "round", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Rounds to nearest integer")
    }

    /// Floor (round down)
    pub fn floor() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Floor", "floor", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Rounds down to nearest integer")
    }

    /// Ceiling (round up)
    pub fn ceiling() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Ceiling", "ceiling", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Rounds up to nearest integer")
    }

    // ===== LOGIC NODES =====

    /// Logical AND
    pub fn and() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "AND", "and", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Boolean).required())
            .add_input(FlowPort::input("b", DataType::Boolean).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Logical AND operation")
    }

    /// Logical OR
    pub fn or() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "OR", "or", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Boolean).required())
            .add_input(FlowPort::input("b", DataType::Boolean).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Logical OR operation")
    }

    /// Logical NOT
    pub fn not() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "NOT", "not", NodeCategory::Logic)
            .add_input(FlowPort::input("value", DataType::Boolean).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Logical NOT (inverts boolean)")
    }

    /// Equality comparison
    pub fn equals() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Equal", "equals", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Any).required())
            .add_input(FlowPort::input("b", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Tests if two values are equal")
    }

    /// Less than comparison
    pub fn less_than() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Less Than", "less_than", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Tests if a < b")
    }

    /// Greater than comparison
    pub fn greater_than() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Greater Than", "greater_than", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Tests if a > b")
    }

    // ===== STRING NODES =====

    /// Concatenate strings
    pub fn concat() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Concat", "concat", NodeCategory::String)
            .add_input(FlowPort::input("a", DataType::String).required())
            .add_input(FlowPort::input("b", DataType::String).required())
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Concatenates two strings")
    }

    /// String length
    pub fn string_length() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "String Length", "strlen", NodeCategory::String)
            .add_input(FlowPort::input("text", DataType::String).required())
            .add_output(FlowPort::output("length", DataType::Number))
            .with_description("Returns the length of a string")
    }

    /// Convert to uppercase
    pub fn uppercase() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Uppercase", "uppercase", NodeCategory::String)
            .add_input(FlowPort::input("text", DataType::String).required())
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Converts string to uppercase")
    }

    /// Convert to lowercase
    pub fn lowercase() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Lowercase", "lowercase", NodeCategory::String)
            .add_input(FlowPort::input("text", DataType::String).required())
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Converts string to lowercase")
    }

    // ===== ARRAY NODES =====

    /// Get array length
    pub fn array_length() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Array Length", "array_length", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("length", DataType::Number))
            .with_description("Returns the length of an array")
    }

    /// Reverse array
    pub fn array_reverse() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Array Reverse", "array_reverse", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Reverses an array")
    }

    // ===== TYPE NODES =====

    /// Convert to number
    pub fn to_number() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "To Number", "to_number", NodeCategory::Type)
            .add_input(FlowPort::input("value", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Converts value to number")
    }

    /// Convert to string
    pub fn to_string() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "To String", "to_string", NodeCategory::Type)
            .add_input(FlowPort::input("value", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Converts value to string")
    }

    /// Convert to boolean
    pub fn to_boolean() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "To Boolean", "to_boolean", NodeCategory::Type)
            .add_input(FlowPort::input("value", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Converts value to boolean")
    }

    // ===== I/O NODES =====

    /// Log output
    pub fn log() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Log", "log", NodeCategory::IO)
            .add_input(FlowPort::input("message", DataType::Any).required())
            .add_output(FlowPort::output("done", DataType::Boolean))
            .with_description("Logs a message to console")
    }

    /// Inject value at runtime
    pub fn inject() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Inject", "inject", NodeCategory::IO)
            .add_output(FlowPort::output("payload", DataType::Any))
            .set_config("payload", "null")
            .with_description("Injects a value into the flow")
    }

    // ===== CONTROL NODES =====

    /// Identity/pass-through node
    pub fn pass() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Pass", "pass", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any).required())
            .add_output(FlowPort::output("output", DataType::Any))
            .with_description("Passes input directly to output")
    }

    /// Drop values (black hole)
    pub fn drop() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Drop", "drop", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any).required())
            .with_description("Drops/discards all input messages")
    }

    // ===== CONDITIONAL BRANCHING NODES =====

    /// If-else conditional node
    pub fn if_else() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "If-Else", "if_else", NodeCategory::Control)
            .add_input(FlowPort::input("condition", DataType::Boolean).required())
            .add_input(FlowPort::input("true_value", DataType::Any).required())
            .add_input(FlowPort::input("false_value", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Any))
            .with_description("Routes to true_value or false_value based on condition")
    }

    /// Switch conditional node with multiple branches
    pub fn switch() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Switch", "switch", NodeCategory::Control)
            .add_input(FlowPort::input("selector", DataType::Any).required())
            .add_input(FlowPort::input("default", DataType::Any))
            .add_output(FlowPort::output("result", DataType::Any))
            .with_description("Routes to different outputs based on selector value")
    }

    // ===== LOOP NODES =====

    /// Repeat node for looping
    pub fn repeat() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Repeat", "repeat", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any).required())
            .add_input(FlowPort::input("count", DataType::Number).required())
            .add_output(FlowPort::output("output", DataType::Any))
            .add_output(FlowPort::output("index", DataType::Number))
            .with_description("Repeats execution count times, emitting for each iteration")
    }

    /// While loop node
    pub fn while_loop() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "While", "while_loop", NodeCategory::Control)
            .add_input(FlowPort::input("condition", DataType::Boolean).required())
            .add_input(FlowPort::input("input", DataType::Any))
            .add_output(FlowPort::output("output", DataType::Any))
            .add_output(FlowPort::output("iterations", DataType::Number))
            .with_description("Executes while condition is true")
    }

    // ===== UTILITY NODES =====

    /// Delay node
    pub fn delay() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Delay", "delay", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any).required())
            .add_input(FlowPort::input("ms", DataType::Number).required())
            .add_output(FlowPort::output("output", DataType::Any))
            .with_description("Delays output by specified milliseconds")
    }

    /// Merge node combining multiple inputs
    pub fn merge() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Merge", "merge", NodeCategory::Control)
            .add_input(FlowPort::input("input1", DataType::Any))
            .add_input(FlowPort::input("input2", DataType::Any))
            .add_input(FlowPort::input("input3", DataType::Any))
            .add_output(FlowPort::output("output", DataType::Array))
            .with_description("Merges multiple inputs into an array")
    }

    /// Split node distributing single input
    pub fn split() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Split", "split", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any).required())
            .add_input(FlowPort::input("count", DataType::Number).required())
            .add_output(FlowPort::output("output", DataType::Any))
            .with_description("Splits single input into multiple outputs")
    }

    // ===== ADVANCED MATH NODES =====

    /// Power/exponentiation node
    pub fn power() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Power", "power", NodeCategory::Math)
            .add_input(FlowPort::input("base", DataType::Number).required())
            .add_input(FlowPort::input("exponent", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Raises base to the power of exponent")
    }

    /// Min node
    pub fn min() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Min", "min", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Returns minimum of two numbers")
    }

    /// Max node
    pub fn max() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Max", "max", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Returns maximum of two numbers")
    }

    /// Clamp node (constrain to range)
    pub fn clamp() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Clamp", "clamp", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_input(FlowPort::input("min", DataType::Number).required())
            .add_input(FlowPort::input("max", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Clamps value to range [min, max]")
    }

    /// Range generator node
    pub fn range() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Range", "range", NodeCategory::Array)
            .add_input(FlowPort::input("start", DataType::Number).required())
            .add_input(FlowPort::input("end", DataType::Number).required())
            .add_input(FlowPort::input("step", DataType::Number).with_default("1".to_string()))
            .add_output(FlowPort::output("array", DataType::Array))
            .with_description("Generates array of numbers from start to end")
    }

    // ===== ADVANCED ARRAY NODES =====

    /// Array map (transform)
    pub fn array_map() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Array Map", "array_map", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array).required())
            .add_input(FlowPort::input("transform", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Array))
            .with_description("Transforms each element of array using provided function")
    }

    /// Array filter
    pub fn array_filter() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Array Filter", "array_filter", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array).required())
            .add_input(FlowPort::input("predicate", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Array))
            .with_description("Filters array elements based on predicate function")
    }

    /// Array reduce
    pub fn array_reduce() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Array Reduce", "array_reduce", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array).required())
            .add_input(FlowPort::input("accumulator", DataType::Any).required())
            .add_input(FlowPort::input("reducer", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Any))
            .with_description("Reduces array to single value using reducer function")
    }

    /// Array join
    pub fn array_join() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Array Join", "array_join", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array).required())
            .add_input(FlowPort::input("separator", DataType::String).with_default(",".to_string()))
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Joins array elements into string with separator")
    }

    // ===== ADVANCED STRING NODES =====

    /// String split
    pub fn string_split() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "String Split", "string_split", NodeCategory::String)
            .add_input(FlowPort::input("string", DataType::String).required())
            .add_input(FlowPort::input("delimiter", DataType::String).required())
            .add_output(FlowPort::output("result", DataType::Array))
            .with_description("Splits string by delimiter into array")
    }

    /// String replace
    pub fn string_replace() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "String Replace", "string_replace", NodeCategory::String)
            .add_input(FlowPort::input("string", DataType::String).required())
            .add_input(FlowPort::input("find", DataType::String).required())
            .add_input(FlowPort::input("replace_with", DataType::String).required())
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Replaces occurrences in string")
    }

    /// String trim
    pub fn string_trim() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "String Trim", "string_trim", NodeCategory::String)
            .add_input(FlowPort::input("string", DataType::String).required())
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Trims whitespace from string")
    }

    /// String index (get character at index)
    pub fn string_index() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "String Index", "string_index", NodeCategory::String)
            .add_input(FlowPort::input("string", DataType::String).required())
            .add_input(FlowPort::input("index", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::String))
            .with_description("Gets character at specified index")
    }

    // ===== COMPARISON NODES =====

    /// Less than or equal
    pub fn less_than_or_equal() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Less Than or Equal", "lte", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Returns true if a <= b")
    }

    /// Greater than or equal
    pub fn greater_than_or_equal() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Greater Than or Equal", "gte", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Number).required())
            .add_input(FlowPort::input("b", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Returns true if a >= b")
    }

    /// Not equal
    pub fn not_equal() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Not Equal", "neq", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Any).required())
            .add_input(FlowPort::input("b", DataType::Any).required())
            .add_output(FlowPort::output("result", DataType::Boolean))
            .with_description("Returns true if a != b")
    }

    /// Get all available standard nodes
    pub fn all_nodes() -> Vec<FlowNode> {
        vec![
            // Math (13 nodes)
            Self::add(),
            Self::subtract(),
            Self::multiply(),
            Self::divide(),
            Self::modulo(),
            Self::sqrt(),
            Self::abs(),
            Self::round(),
            Self::floor(),
            Self::ceiling(),
            Self::power(),
            Self::min(),
            Self::max(),
            Self::clamp(),

            // Logic (9 nodes)
            Self::and(),
            Self::or(),
            Self::not(),
            Self::equals(),
            Self::less_than(),
            Self::greater_than(),
            Self::less_than_or_equal(),
            Self::greater_than_or_equal(),
            Self::not_equal(),

            // String (8 nodes)
            Self::concat(),
            Self::string_length(),
            Self::uppercase(),
            Self::lowercase(),
            Self::string_split(),
            Self::string_replace(),
            Self::string_trim(),
            Self::string_index(),

            // Array (7 nodes)
            Self::array_length(),
            Self::array_reverse(),
            Self::range(),
            Self::array_map(),
            Self::array_filter(),
            Self::array_reduce(),
            Self::array_join(),

            // Type (3 nodes)
            Self::to_number(),
            Self::to_string(),
            Self::to_boolean(),

            // I/O (2 nodes)
            Self::log(),
            Self::inject(),

            // Control (9 nodes)
            Self::pass(),
            Self::drop(),
            Self::if_else(),
            Self::switch(),
            Self::repeat(),
            Self::while_loop(),
            Self::delay(),
            Self::merge(),
            Self::split(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_node() {
        let node = StandardNodes::add();
        assert_eq!(node.node_type, "add");
        assert_eq!(node.inputs.len(), 2);
        assert_eq!(node.outputs.len(), 1);
    }

    #[test]
    fn test_math_nodes() {
        let nodes = vec![
            StandardNodes::add(),
            StandardNodes::subtract(),
            StandardNodes::multiply(),
            StandardNodes::divide(),
        ];
        assert_eq!(nodes.len(), 4);
        for node in nodes {
            assert_eq!(node.category, NodeCategory::Math);
        }
    }

    #[test]
    fn test_logic_nodes() {
        let nodes = vec![
            StandardNodes::and(),
            StandardNodes::or(),
            StandardNodes::not(),
        ];
        for node in nodes {
            assert_eq!(node.category, NodeCategory::Logic);
        }
    }

    #[test]
    fn test_all_nodes() {
        let nodes = StandardNodes::all_nodes();
        assert!(nodes.len() >= 28);
    }

    #[test]
    fn test_node_uniqueness() {
        let nodes = StandardNodes::all_nodes();
        let mut ids = std::collections::HashSet::new();
        for node in &nodes {
            assert!(ids.insert(node.id), "Duplicate node ID found");
        }
    }

    #[test]
    fn test_string_nodes() {
        let node = StandardNodes::concat();
        assert_eq!(node.category, NodeCategory::String);
        assert_eq!(node.inputs.len(), 2);
    }

    #[test]
    fn test_type_conversion_nodes() {
        let nodes = vec![
            StandardNodes::to_number(),
            StandardNodes::to_string(),
            StandardNodes::to_boolean(),
        ];
        for node in nodes {
            assert_eq!(node.category, NodeCategory::Type);
            assert_eq!(node.inputs.len(), 1);
            assert_eq!(node.outputs.len(), 1);
        }
    }
}
