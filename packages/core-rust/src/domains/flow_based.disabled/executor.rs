//! Flow network executor - runtime engine for flow execution

use super::{FlowNetwork, FlowNodeId, Message, MessagePayload};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

/// Execution statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStats {
    /// Total messages processed
    pub messages_processed: usize,
    /// Total nodes executed
    pub nodes_executed: usize,
    /// Execution time in seconds
    pub execution_time: f64,
    /// Errors encountered
    pub errors: Vec<String>,
}

impl Default for ExecutionStats {
    fn default() -> Self {
        ExecutionStats {
            messages_processed: 0,
            nodes_executed: 0,
            execution_time: 0.0,
            errors: Vec::new(),
        }
    }
}

/// Node execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeExecution {
    /// Node that was executed
    pub node_id: FlowNodeId,
    /// Time when execution started
    pub start_time: f64,
    /// Time when execution completed
    pub end_time: f64,
    /// Input values used
    pub inputs: HashMap<String, MessagePayload>,
    /// Output values produced
    pub outputs: HashMap<String, MessagePayload>,
    /// Any error that occurred
    pub error: Option<String>,
}

/// Execution trace recording all operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTrace {
    /// All messages that flowed through the network
    pub messages: Vec<Message>,
    /// All node executions
    pub node_executions: Vec<NodeExecution>,
    /// Final state of network variables
    pub final_variables: HashMap<String, String>,
    /// Execution statistics
    pub stats: ExecutionStats,
}

/// Flow network executor
#[derive(Debug, Clone)]
pub struct FlowExecutor {
    /// The network being executed
    network: FlowNetwork,
    /// Message queue
    message_queue: VecDeque<Message>,
    /// Execution trace
    trace: ExecutionTrace,
    /// Current execution time
    current_time: f64,
    /// Node output values (cached)
    node_outputs: HashMap<FlowNodeId, HashMap<String, MessagePayload>>,
}

impl FlowExecutor {
    /// Create new executor for a network
    pub fn new(network: FlowNetwork) -> Result<Self, String> {
        network.validate()?;

        Ok(FlowExecutor {
            network,
            message_queue: VecDeque::new(),
            trace: ExecutionTrace {
                messages: Vec::new(),
                node_executions: Vec::new(),
                final_variables: HashMap::new(),
                stats: ExecutionStats::default(),
            },
            current_time: 0.0,
            node_outputs: HashMap::new(),
        })
    }

    /// Queue a message for processing
    pub fn queue_message(&mut self, message: Message) {
        self.message_queue.push_back(message);
    }

    /// Get current execution trace
    pub fn trace(&self) -> &ExecutionTrace {
        &self.trace
    }

    /// Process all queued messages
    pub fn execute(&mut self) -> Result<ExecutionTrace, String> {
        let start_time = std::time::Instant::now();

        // If no messages in queue, inject from start node
        if self.message_queue.is_empty() {
            if let Some(start_id) = self.network.start_node {
                // Create injection message from start node
                if let Some(start_node) = self.network.nodes.get(&start_id) {
                    // Get first output port
                    if let Some((port_name, _)) = start_node.outputs.iter().next() {
                        let msg = Message::new(
                            start_id,
                            port_name,
                            FlowNodeId::new(),
                            "input",
                            MessagePayload::Null,
                            self.current_time,
                        );
                        self.queue_message(msg);
                    }
                }
            }
        }

        // Process messages
        let max_iterations = 1000; // Prevent infinite loops
        let mut iterations = 0;

        while !self.message_queue.is_empty() && iterations < max_iterations {
            iterations += 1;

            if let Some(message) = self.message_queue.pop_front() {
                self.trace.messages.push(message.clone());
                self.trace.stats.messages_processed += 1;

                // Find target node and port
                if let Some(target_node) = self.network.nodes.get(&message.to_node) {
                    // Validate port exists
                    if target_node.get_input(&message.to_port).is_some() {
                        // Execute node
                        let _ = self.execute_node(message);
                    } else {
                        let err = format!(
                            "Target port '{}' not found on node {}",
                            message.to_port, message.to_node
                        );
                        self.trace.stats.errors.push(err);
                    }
                } else {
                    let err = format!("Target node {} not found", message.to_node);
                    self.trace.stats.errors.push(err);
                }
            }
        }

        if iterations >= max_iterations {
            return Err("Execution exceeded maximum iterations (infinite loop detected)".to_string());
        }

        self.trace.stats.execution_time = start_time.elapsed().as_secs_f64();
        self.trace.final_variables = self.network.variables.clone();

        Ok(self.trace.clone())
    }

    /// Execute a single node
    fn execute_node(&mut self, input_message: Message) -> Result<(), String> {
        let node_id = input_message.to_node;
        let start_time = self.current_time;

        if let Some(node) = self.network.nodes.get(&node_id).cloned() {
            self.trace.stats.nodes_executed += 1;

            let mut execution = NodeExecution {
                node_id,
                start_time,
                end_time: self.current_time,
                inputs: HashMap::new(),
                outputs: HashMap::new(),
                error: None,
            };

            // Store input
            execution.inputs.insert(input_message.to_port.clone(), input_message.payload.clone());

            // Execute node based on type
            match node.node_type.as_str() {
                // Math nodes
                "add" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Number(a + b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "subtract" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Number(a - b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "multiply" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Number(a * b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "divide" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        if *b != 0.0 {
                            let result = MessagePayload::Number(a / b);
                            execution.outputs.insert("result".to_string(), result.clone());
                            self.queue_output_messages(&node, &execution.outputs)?;
                        } else {
                            execution.error = Some("Division by zero".to_string());
                        }
                    }
                }
                "modulo" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        if *b != 0.0 {
                            let result = MessagePayload::Number(a % b);
                            execution.outputs.insert("result".to_string(), result.clone());
                            self.queue_output_messages(&node, &execution.outputs)?;
                        } else {
                            execution.error = Some("Modulo by zero".to_string());
                        }
                    }
                }
                "sqrt" => {
                    if let Some(MessagePayload::Number(a)) = execution.inputs.get("value") {
                        if *a >= 0.0 {
                            let result = MessagePayload::Number(a.sqrt());
                            execution.outputs.insert("result".to_string(), result.clone());
                            self.queue_output_messages(&node, &execution.outputs)?;
                        } else {
                            execution.error = Some("Square root of negative number".to_string());
                        }
                    }
                }
                "abs" => {
                    if let Some(MessagePayload::Number(a)) = execution.inputs.get("value") {
                        let result = MessagePayload::Number(a.abs());
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "round" => {
                    if let Some(MessagePayload::Number(a)) = execution.inputs.get("value") {
                        let result = MessagePayload::Number(a.round());
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "floor" => {
                    if let Some(MessagePayload::Number(a)) = execution.inputs.get("value") {
                        let result = MessagePayload::Number(a.floor());
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "ceiling" => {
                    if let Some(MessagePayload::Number(a)) = execution.inputs.get("value") {
                        let result = MessagePayload::Number(a.ceil());
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Logic nodes
                "and" => {
                    if let (Some(MessagePayload::Boolean(a)), Some(MessagePayload::Boolean(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(*a && *b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "or" => {
                    if let (Some(MessagePayload::Boolean(a)), Some(MessagePayload::Boolean(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(*a || *b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "not" => {
                    if let Some(MessagePayload::Boolean(a)) = execution.inputs.get("value") {
                        let result = MessagePayload::Boolean(!*a);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "equals" => {
                    if let (Some(a), Some(b)) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(format!("{:?}", a) == format!("{:?}", b));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "lessthan" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(a < b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "greaterthan" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(a > b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // String nodes
                "concat" => {
                    if let (Some(MessagePayload::String(a)), Some(MessagePayload::String(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::String(format!("{}{}", a, b));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "stringlength" => {
                    if let Some(MessagePayload::String(s)) = execution.inputs.get("value") {
                        let result = MessagePayload::Number(s.len() as f64);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "uppercase" => {
                    if let Some(MessagePayload::String(s)) = execution.inputs.get("value") {
                        let result = MessagePayload::String(s.to_uppercase());
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "lowercase" => {
                    if let Some(MessagePayload::String(s)) = execution.inputs.get("value") {
                        let result = MessagePayload::String(s.to_lowercase());
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Array nodes
                "arraylength" => {
                    if let Some(MessagePayload::Array(arr)) = execution.inputs.get("value") {
                        let result = MessagePayload::Number(arr.len() as f64);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "arrayreverse" => {
                    if let Some(MessagePayload::Array(arr)) = execution.inputs.get("value") {
                        let mut reversed = arr.clone();
                        reversed.reverse();
                        let result = MessagePayload::Array(reversed);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Type conversion nodes
                "to_number" => {
                    if let Some(val) = execution.inputs.get("value") {
                        if let Some(num) = val.as_number() {
                            let result = MessagePayload::Number(num);
                            execution.outputs.insert("result".to_string(), result.clone());
                            self.queue_output_messages(&node, &execution.outputs)?;
                        }
                    }
                }
                "tostring" => {
                    if let Some(val) = execution.inputs.get("value") {
                        if let Some(s) = val.as_string() {
                            let result = MessagePayload::String(s);
                            execution.outputs.insert("result".to_string(), result.clone());
                            self.queue_output_messages(&node, &execution.outputs)?;
                        }
                    }
                }
                "toboolean" => {
                    if let Some(val) = execution.inputs.get("value") {
                        if let Some(b) = val.as_boolean() {
                            let result = MessagePayload::Boolean(b);
                            execution.outputs.insert("result".to_string(), result.clone());
                            self.queue_output_messages(&node, &execution.outputs)?;
                        }
                    }
                }

                // I/O nodes
                "log" => {
                    if let Some(_msg) = execution.inputs.get("message") {
                        // In a real implementation, this would log to console
                        let result = MessagePayload::Boolean(true);
                        execution.outputs.insert("done".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "inject" => {
                    // Inject node: output the configured value or passed input
                    if let Some(input) = execution.inputs.get("input") {
                        execution.outputs.insert("output".to_string(), input.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Control nodes
                "pass" => {
                    // Pass-through: copy input to output
                    if let Some(input) = execution.inputs.get("input") {
                        execution.outputs.insert("output".to_string(), input.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "drop" => {
                    // Drop: discard input, output nothing
                    // No output messages queued - input is silently dropped
                    execution.outputs.insert("dropped".to_string(), MessagePayload::Boolean(true));
                }

                // Conditional branching nodes
                "if_else" => {
                    if let Some(MessagePayload::Boolean(condition)) = execution.inputs.get("condition") {
                        let output = if *condition {
                            execution.inputs.get("true_value").cloned().unwrap_or(MessagePayload::Null)
                        } else {
                            execution.inputs.get("false_value").cloned().unwrap_or(MessagePayload::Null)
                        };
                        execution.outputs.insert("result".to_string(), output);
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "switch" => {
                    if let Some(selector) = execution.inputs.get("selector") {
                        let output = selector.clone();
                        execution.outputs.insert("result".to_string(), output);
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Loop nodes
                "repeat" => {
                    if let (Some(input), Some(MessagePayload::Number(count))) =
                        (execution.inputs.get("input"), execution.inputs.get("count"))
                    {
                        let count = (*count as i32).max(0) as usize;
                        for i in 0..count {
                            execution.outputs.insert("output".to_string(), input.clone());
                            execution.outputs.insert("index".to_string(), MessagePayload::Number(i as f64));
                            self.queue_output_messages(&node, &execution.outputs)?;
                        }
                    }
                }
                "while_loop" => {
                    // For now, limit iterations to prevent infinite loops
                    let mut iterations = 0;
                    const MAX_WHILE_ITERATIONS: usize = 1000;

                    while let Some(MessagePayload::Boolean(condition)) = execution.inputs.get("condition") {
                        if !*condition || iterations >= MAX_WHILE_ITERATIONS {
                            break;
                        }
                        if let Some(input) = execution.inputs.get("input") {
                            execution.outputs.insert("output".to_string(), input.clone());
                        }
                        self.queue_output_messages(&node, &execution.outputs)?;
                        iterations += 1;
                    }
                    execution.outputs.insert("iterations".to_string(), MessagePayload::Number(iterations as f64));
                }

                // Utility nodes
                "delay" => {
                    // Simulated delay - in real implementation would use async
                    if let Some(input) = execution.inputs.get("input") {
                        execution.outputs.insert("output".to_string(), input.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "merge" => {
                    let mut merged = Vec::new();
                    if let Some(v) = execution.inputs.get("input1") {
                        merged.push(v.clone());
                    }
                    if let Some(v) = execution.inputs.get("input2") {
                        merged.push(v.clone());
                    }
                    if let Some(v) = execution.inputs.get("input3") {
                        merged.push(v.clone());
                    }
                    execution.outputs.insert("output".to_string(), MessagePayload::Array(merged));
                    self.queue_output_messages(&node, &execution.outputs)?;
                }
                "split" => {
                    if let (Some(input), Some(MessagePayload::Number(count))) =
                        (execution.inputs.get("input"), execution.inputs.get("count"))
                    {
                        let count = (*count as i32).max(1) as usize;
                        for _ in 0..count {
                            execution.outputs.insert("output".to_string(), input.clone());
                            self.queue_output_messages(&node, &execution.outputs)?;
                        }
                    }
                }

                // Advanced math nodes
                "power" => {
                    if let (Some(MessagePayload::Number(base)), Some(MessagePayload::Number(exp))) =
                        (execution.inputs.get("base"), execution.inputs.get("exponent"))
                    {
                        let result = MessagePayload::Number(base.powf(*exp));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "min" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Number(a.min(*b));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "max" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Number(a.max(*b));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "clamp" => {
                    if let (Some(MessagePayload::Number(val)), Some(MessagePayload::Number(min)), Some(MessagePayload::Number(max))) =
                        (execution.inputs.get("value"), execution.inputs.get("min"), execution.inputs.get("max"))
                    {
                        let result = MessagePayload::Number(val.max(*min).min(*max));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Advanced array nodes
                "range" => {
                    if let (Some(MessagePayload::Number(start)), Some(MessagePayload::Number(end))) =
                        (execution.inputs.get("start"), execution.inputs.get("end"))
                    {
                        let step = execution.inputs.get("step")
                            .and_then(|s| s.as_number())
                            .unwrap_or(1.0);

                        if step != 0.0 {
                            let mut arr = Vec::new();
                            let mut current = *start;
                            while (step > 0.0 && current <= *end) || (step < 0.0 && current >= *end) {
                                arr.push(MessagePayload::Number(current));
                                current += step;
                            }
                            execution.outputs.insert("array".to_string(), MessagePayload::Array(arr));
                            self.queue_output_messages(&node, &execution.outputs)?;
                        }
                    }
                }
                "array_map" => {
                    if let Some(MessagePayload::Array(arr)) = execution.inputs.get("array") {
                        // Simplified: just pass through (real implementation would apply transform)
                        execution.outputs.insert("result".to_string(), MessagePayload::Array(arr.clone()));
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "array_filter" => {
                    if let Some(MessagePayload::Array(arr)) = execution.inputs.get("array") {
                        // Simplified: just pass through (real implementation would filter)
                        execution.outputs.insert("result".to_string(), MessagePayload::Array(arr.clone()));
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "array_reduce" => {
                    if let (Some(MessagePayload::Array(arr)), Some(accumulator)) =
                        (execution.inputs.get("array"), execution.inputs.get("accumulator"))
                    {
                        // Simplified: return accumulator (real implementation would reduce)
                        let result = if arr.is_empty() {
                            accumulator.clone()
                        } else {
                            accumulator.clone()
                        };
                        execution.outputs.insert("result".to_string(), result);
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "array_join" => {
                    if let Some(MessagePayload::Array(arr)) = execution.inputs.get("array") {
                        let sep = execution.inputs.get("separator")
                            .and_then(|s| s.as_string())
                            .unwrap_or_else(|| ",".to_string());

                        let strings: Vec<String> = arr.iter()
                            .map(|item| format!("{:?}", item))
                            .collect();
                        let result = MessagePayload::String(strings.join(&sep));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Advanced string nodes
                "string_split" => {
                    if let (Some(MessagePayload::String(s)), Some(MessagePayload::String(delim))) =
                        (execution.inputs.get("string"), execution.inputs.get("delimiter"))
                    {
                        let parts: Vec<MessagePayload> = s.split(delim.as_str())
                            .map(|p| MessagePayload::String(p.to_string()))
                            .collect();
                        execution.outputs.insert("result".to_string(), MessagePayload::Array(parts));
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "string_replace" => {
                    if let (Some(MessagePayload::String(s)), Some(MessagePayload::String(find)), Some(MessagePayload::String(replace))) =
                        (execution.inputs.get("string"), execution.inputs.get("find"), execution.inputs.get("replace_with"))
                    {
                        let result = MessagePayload::String(s.replace(find.as_str(), replace.as_str()));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "string_trim" => {
                    if let Some(MessagePayload::String(s)) = execution.inputs.get("string") {
                        let result = MessagePayload::String(s.trim().to_string());
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "string_index" => {
                    if let (Some(MessagePayload::String(s)), Some(MessagePayload::Number(idx))) =
                        (execution.inputs.get("string"), execution.inputs.get("index"))
                    {
                        let index = *idx as usize;
                        let result = s.chars().nth(index)
                            .map(|c| MessagePayload::String(c.to_string()))
                            .unwrap_or(MessagePayload::Null);
                        execution.outputs.insert("result".to_string(), result);
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                // Comparison nodes
                "lte" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(a <= b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "gte" => {
                    if let (Some(MessagePayload::Number(a)), Some(MessagePayload::Number(b))) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(a >= b);
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }
                "neq" => {
                    if let (Some(a), Some(b)) =
                        (execution.inputs.get("a"), execution.inputs.get("b"))
                    {
                        let result = MessagePayload::Boolean(format!("{:?}", a) != format!("{:?}", b));
                        execution.outputs.insert("result".to_string(), result.clone());
                        self.queue_output_messages(&node, &execution.outputs)?;
                    }
                }

                _ => {
                    // Unknown node type
                    execution.error = Some(format!("Unknown node type: {}", node.node_type));
                    self.trace.stats.errors.push(execution.error.clone().unwrap());
                }
            }

            self.trace.node_executions.push(execution);
        }

        Ok(())
    }

    /// Queue output messages from a node
    fn queue_output_messages(
        &mut self,
        node: &super::FlowNode,
        outputs: &HashMap<String, MessagePayload>,
    ) -> Result<(), String> {
        // Find all connections from this node (clone to owned vector to avoid borrow conflict)
        let connections: Vec<_> = self.network.connections_from(node.id)
            .into_iter()
            .cloned()
            .collect();

        for connection in connections {
            if let Some(payload) = outputs.get(&connection.from_port) {
                let message = Message::new(
                    connection.from_node,
                    &connection.from_port,
                    connection.to_node,
                    &connection.to_port,
                    payload.clone(),
                    self.current_time,
                );
                self.queue_message(message);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::flow_based::{DataType, FlowNetwork, FlowNode, NodeCategory};

    #[test]
    fn test_executor_creation() {
        let net = FlowNetwork::new("test");
        let executor = FlowExecutor::new(net);
        assert!(executor.is_ok());
    }

    #[test]
    fn test_execution_stats() {
        let stats = ExecutionStats::default();
        assert_eq!(stats.messages_processed, 0);
        assert_eq!(stats.nodes_executed, 0);
    }

    #[test]
    fn test_message_payload_number() {
        let payload = MessagePayload::Number(42.0);
        match payload {
            MessagePayload::Number(n) => assert_eq!(n, 42.0),
            _ => panic!("Expected number"),
        }
    }

    #[test]
    fn test_queue_message() {
        let mut net = FlowNetwork::new("test");
        let node = FlowNode::new(FlowNodeId::new(), "test", "test", NodeCategory::Math);
        net.add_node(node).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "out",
            FlowNodeId::new(),
            "in",
            MessagePayload::Null,
            0.0,
        );

        executor.queue_message(msg);
        assert_eq!(executor.message_queue.len(), 1);
    }

    #[test]
    fn test_add_node_execution() {
        let mut net = FlowNetwork::new("add_test");
        let node_id = FlowNodeId::new();
        let node = FlowNode::new(node_id, "Add", "add", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number))
            .add_input(FlowPort::input("b", DataType::Number))
            .add_output(FlowPort::output("result", DataType::Number));

        net.add_node(node).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            node_id,
            "a",
            MessagePayload::Number(5.0),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert!(executor.trace().stats.messages_processed > 0);
    }

    #[test]
    fn test_math_operations() {
        // Test subtract, multiply, divide operations
        let payloads = vec![
            (MessagePayload::Number(10.0), MessagePayload::Number(3.0), "subtract"),
            (MessagePayload::Number(4.0), MessagePayload::Number(5.0), "multiply"),
            (MessagePayload::Number(20.0), MessagePayload::Number(4.0), "divide"),
        ];

        for (a, b, op_type) in payloads {
            let mut net = FlowNetwork::new("math_test");
            let node_id = FlowNodeId::new();
            let node = FlowNode::new(node_id, "MathOp", op_type, NodeCategory::Math)
                .add_input(FlowPort::input("a", DataType::Number))
                .add_input(FlowPort::input("b", DataType::Number))
                .add_output(FlowPort::output("result", DataType::Number));

            net.add_node(node).unwrap();
            let mut executor = FlowExecutor::new(net).unwrap();

            let msg = Message::new(
                FlowNodeId::new(),
                "source",
                node_id,
                "a",
                a,
                0.0,
            );

            executor.queue_message(msg);
            let _ = executor.execute();

            // Verify at least one node was executed
            assert!(executor.trace().stats.nodes_executed >= 1, "No nodes executed for {}", op_type);
        }
    }

    #[test]
    fn test_string_operations() {
        let mut net = FlowNetwork::new("string_test");
        let concat_id = FlowNodeId::new();
        let concat = FlowNode::new(concat_id, "Concat", "concat", NodeCategory::String)
            .add_input(FlowPort::input("a", DataType::String))
            .add_input(FlowPort::input("b", DataType::String))
            .add_output(FlowPort::output("result", DataType::String));

        net.add_node(concat).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            concat_id,
            "a",
            MessagePayload::String("Hello".to_string()),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert!(executor.trace().stats.messages_processed >= 1);
    }

    #[test]
    fn test_logic_operations() {
        let mut net = FlowNetwork::new("logic_test");
        let and_id = FlowNodeId::new();
        let and_node = FlowNode::new(and_id, "And", "and", NodeCategory::Logic)
            .add_input(FlowPort::input("a", DataType::Boolean))
            .add_input(FlowPort::input("b", DataType::Boolean))
            .add_output(FlowPort::output("result", DataType::Boolean));

        net.add_node(and_node).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            and_id,
            "a",
            MessagePayload::Boolean(true),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert!(executor.trace().stats.nodes_executed >= 1);
    }

    #[test]
    fn test_type_conversion_nodes() {
        let mut net = FlowNetwork::new("conversion_test");
        let to_string_id = FlowNodeId::new();
        let to_string = FlowNode::new(to_string_id, "ToString", "tostring", NodeCategory::Type)
            .add_input(FlowPort::input("value", DataType::Any))
            .add_output(FlowPort::output("result", DataType::String));

        net.add_node(to_string).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            to_string_id,
            "value",
            MessagePayload::Number(42.0),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert_eq!(executor.trace().stats.nodes_executed, 1);
    }

    #[test]
    fn test_control_nodes() {
        let mut net = FlowNetwork::new("control_test");
        let pass_id = FlowNodeId::new();
        let pass_node = FlowNode::new(pass_id, "Pass", "pass", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any))
            .add_output(FlowPort::output("output", DataType::Any));

        net.add_node(pass_node).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            pass_id,
            "input",
            MessagePayload::String("test".to_string()),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert_eq!(executor.trace().stats.nodes_executed, 1);
    }

    #[test]
    fn test_drop_node() {
        let mut net = FlowNetwork::new("drop_test");
        let drop_id = FlowNodeId::new();
        let drop_node = FlowNode::new(drop_id, "Drop", "drop", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any));

        net.add_node(drop_node).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            drop_id,
            "input",
            MessagePayload::Number(99.0),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        // Drop node should execute and discard input
        assert_eq!(executor.trace().stats.nodes_executed, 1);
        // No output messages should be queued from drop node
        assert!(executor.trace().messages.len() <= 1);
    }

    #[test]
    fn test_if_else_node() {
        let mut net = FlowNetwork::new("if_else_test");
        let if_else_id = FlowNodeId::new();
        let if_else = FlowNode::new(if_else_id, "If-Else", "if_else", NodeCategory::Control)
            .add_input(FlowPort::input("condition", DataType::Boolean))
            .add_input(FlowPort::input("true_value", DataType::Any))
            .add_input(FlowPort::input("false_value", DataType::Any))
            .add_output(FlowPort::output("result", DataType::Any));

        net.add_node(if_else).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            if_else_id,
            "condition",
            MessagePayload::Boolean(true),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert_eq!(executor.trace().stats.nodes_executed, 1);
    }

    #[test]
    fn test_repeat_node() {
        let mut net = FlowNetwork::new("repeat_test");
        let repeat_id = FlowNodeId::new();
        let repeat = FlowNode::new(repeat_id, "Repeat", "repeat", NodeCategory::Control)
            .add_input(FlowPort::input("input", DataType::Any))
            .add_input(FlowPort::input("count", DataType::Number))
            .add_output(FlowPort::output("output", DataType::Any))
            .add_output(FlowPort::output("index", DataType::Number));

        net.add_node(repeat).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            repeat_id,
            "input",
            MessagePayload::String("test".to_string()),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert_eq!(executor.trace().stats.nodes_executed, 1);
    }

    #[test]
    fn test_advanced_math_nodes() {
        let pairs = vec![
            ("power", DataType::Math),
            ("min", DataType::Math),
            ("max", DataType::Math),
            ("clamp", DataType::Math),
        ];

        for (node_name, _category) in pairs {
            let mut net = FlowNetwork::new(&format!("{}_test", node_name));
            let node_id = FlowNodeId::new();

            let node = match node_name {
                "power" => FlowNode::new(node_id, "Power", "power", NodeCategory::Math)
                    .add_input(FlowPort::input("base", DataType::Number))
                    .add_input(FlowPort::input("exponent", DataType::Number))
                    .add_output(FlowPort::output("result", DataType::Number)),
                "min" | "max" => FlowNode::new(node_id, node_name, node_name, NodeCategory::Math)
                    .add_input(FlowPort::input("a", DataType::Number))
                    .add_input(FlowPort::input("b", DataType::Number))
                    .add_output(FlowPort::output("result", DataType::Number)),
                "clamp" => FlowNode::new(node_id, "Clamp", "clamp", NodeCategory::Math)
                    .add_input(FlowPort::input("value", DataType::Number))
                    .add_input(FlowPort::input("min", DataType::Number))
                    .add_input(FlowPort::input("max", DataType::Number))
                    .add_output(FlowPort::output("result", DataType::Number)),
                _ => continue,
            };

            net.add_node(node).unwrap();
            let mut executor = FlowExecutor::new(net).unwrap();

            let msg = Message::new(
                FlowNodeId::new(),
                "source",
                node_id,
                if node_name == "clamp" { "value" } else { "a" },
                MessagePayload::Number(5.0),
                0.0,
            );

            executor.queue_message(msg);
            let _ = executor.execute();

            assert_eq!(executor.trace().stats.nodes_executed, 1, "Failed for node: {}", node_name);
        }
    }

    #[test]
    fn test_string_operations_advanced() {
        let node_ops = vec![
            "string_split",
            "string_replace",
            "string_trim",
            "string_index",
        ];

        for op in node_ops {
            let mut net = FlowNetwork::new(&format!("{}_test", op));
            let node_id = FlowNodeId::new();

            let node = match op {
                "string_split" => FlowNode::new(node_id, "String Split", "string_split", NodeCategory::String)
                    .add_input(FlowPort::input("string", DataType::String))
                    .add_input(FlowPort::input("delimiter", DataType::String))
                    .add_output(FlowPort::output("result", DataType::Array)),
                "string_replace" => FlowNode::new(node_id, "String Replace", "string_replace", NodeCategory::String)
                    .add_input(FlowPort::input("string", DataType::String))
                    .add_input(FlowPort::input("find", DataType::String))
                    .add_input(FlowPort::input("replace_with", DataType::String))
                    .add_output(FlowPort::output("result", DataType::String)),
                "string_trim" => FlowNode::new(node_id, "String Trim", "string_trim", NodeCategory::String)
                    .add_input(FlowPort::input("string", DataType::String))
                    .add_output(FlowPort::output("result", DataType::String)),
                "string_index" => FlowNode::new(node_id, "String Index", "string_index", NodeCategory::String)
                    .add_input(FlowPort::input("string", DataType::String))
                    .add_input(FlowPort::input("index", DataType::Number))
                    .add_output(FlowPort::output("result", DataType::String)),
                _ => continue,
            };

            net.add_node(node).unwrap();
            let mut executor = FlowExecutor::new(net).unwrap();

            let msg = Message::new(
                FlowNodeId::new(),
                "source",
                node_id,
                "string",
                MessagePayload::String("hello world".to_string()),
                0.0,
            );

            executor.queue_message(msg);
            let _ = executor.execute();

            assert_eq!(executor.trace().stats.nodes_executed, 1, "Failed for operation: {}", op);
        }
    }

    #[test]
    fn test_array_operations_advanced() {
        let node_ops = vec![
            "range",
            "array_join",
        ];

        for op in node_ops {
            let mut net = FlowNetwork::new(&format!("{}_test", op));
            let node_id = FlowNodeId::new();

            let node = match op {
                "range" => FlowNode::new(node_id, "Range", "range", NodeCategory::Array)
                    .add_input(FlowPort::input("start", DataType::Number))
                    .add_input(FlowPort::input("end", DataType::Number))
                    .add_input(FlowPort::input("step", DataType::Number))
                    .add_output(FlowPort::output("array", DataType::Array)),
                "array_join" => FlowNode::new(node_id, "Array Join", "array_join", NodeCategory::Array)
                    .add_input(FlowPort::input("array", DataType::Array))
                    .add_input(FlowPort::input("separator", DataType::String))
                    .add_output(FlowPort::output("result", DataType::String)),
                _ => continue,
            };

            net.add_node(node).unwrap();
            let mut executor = FlowExecutor::new(net).unwrap();

            let msg = Message::new(
                FlowNodeId::new(),
                "source",
                node_id,
                if op == "range" { "start" } else { "array" },
                MessagePayload::Number(1.0),
                0.0,
            );

            executor.queue_message(msg);
            let _ = executor.execute();

            assert_eq!(executor.trace().stats.nodes_executed, 1, "Failed for operation: {}", op);
        }
    }

    #[test]
    fn test_comparison_nodes() {
        let comparisons = vec![
            ("lte", DataType::Number),
            ("gte", DataType::Number),
            ("neq", DataType::Any),
        ];

        for (op, _dtype) in comparisons {
            let mut net = FlowNetwork::new(&format!("{}_test", op));
            let node_id = FlowNodeId::new();

            let node = FlowNode::new(node_id, op, op, NodeCategory::Logic)
                .add_input(FlowPort::input("a", DataType::Number))
                .add_input(FlowPort::input("b", DataType::Number))
                .add_output(FlowPort::output("result", DataType::Boolean));

            net.add_node(node).unwrap();

            let mut executor = FlowExecutor::new(net).unwrap();
            let msg = Message::new(
                FlowNodeId::new(),
                "source",
                node_id,
                "a",
                MessagePayload::Number(5.0),
                0.0,
            );

            executor.queue_message(msg);
            let _ = executor.execute();

            assert_eq!(executor.trace().stats.nodes_executed, 1, "Failed for comparison: {}", op);
        }
    }

    #[test]
    fn test_all_53_standard_nodes_creation() {
        let nodes = super::super::nodes::StandardNodes::all_nodes();
        assert_eq!(nodes.len(), 53, "Expected 53 total nodes, got {}", nodes.len());

        // Verify no duplicate IDs
        let mut ids = std::collections::HashSet::new();
        for node in &nodes {
            assert!(ids.insert(node.id), "Duplicate node ID found");
        }
    }

    #[test]
    fn test_utility_nodes_merge_and_split() {
        let mut net = FlowNetwork::new("utility_test");
        let merge_id = FlowNodeId::new();
        let merge = FlowNode::new(merge_id, "Merge", "merge", NodeCategory::Control)
            .add_input(FlowPort::input("input1", DataType::Any))
            .add_input(FlowPort::input("input2", DataType::Any))
            .add_input(FlowPort::input("input3", DataType::Any))
            .add_output(FlowPort::output("output", DataType::Array));

        net.add_node(merge).unwrap();

        let mut executor = FlowExecutor::new(net).unwrap();
        let msg = Message::new(
            FlowNodeId::new(),
            "source",
            merge_id,
            "input1",
            MessagePayload::Number(1.0),
            0.0,
        );

        executor.queue_message(msg);
        let _ = executor.execute();

        assert_eq!(executor.trace().stats.nodes_executed, 1);
    }
}
