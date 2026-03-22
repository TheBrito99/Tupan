//! Flow-Based Programming (FBP) Domain
//!
//! Enables visual data flow programming similar to Node-RED.
//! Nodes represent processing units, ports are inputs/outputs, and connections carry data.
//!
//! Key Concepts:
//! - Nodes: Processing units with input/output ports
//! - Ports: Typed data channels (input or output)
//! - Connections: Links between ports that route messages
//! - Messages: Data flowing through the network
//! - DataTypes: Type system for port validation

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

pub mod types;
pub mod executor;
pub mod nodes;
pub mod domain;
pub mod extended_nodes;

pub use types::{DataType, Message, MessagePayload, MessageId, NodeCategory, ConnectionType};
pub use domain::{FlowNetworkDomain, FlowNetworkDiagramData, FlowNetworkStatistics, FlowNodeVisualization, FlowConnectionVisualization};
pub use extended_nodes::ExtendedNodes;

/// Unique identifier for a flow node
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct FlowNodeId(Uuid);

impl FlowNodeId {
    pub fn new() -> Self {
        FlowNodeId(Uuid::new_v4())
    }

    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(FlowNodeId(Uuid::parse_str(s)?))
    }
}

impl Default for FlowNodeId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for FlowNodeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0.to_string()[..8].to_uppercase())
    }
}

/// Unique identifier for a flow port
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct FlowPortId(Uuid);

impl FlowPortId {
    pub fn new() -> Self {
        FlowPortId(Uuid::new_v4())
    }
}

impl Default for FlowPortId {
    fn default() -> Self {
        Self::new()
    }
}

/// Port direction (input or output)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PortDirection {
    Input,
    Output,
}

/// A port on a flow node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowPort {
    /// Unique port identifier
    pub id: FlowPortId,
    /// Display name
    pub name: String,
    /// Input or output
    pub direction: PortDirection,
    /// Expected data type
    pub data_type: DataType,
    /// Whether this port is required
    pub required: bool,
    /// Default value if not connected
    pub default_value: Option<String>,
}

impl FlowPort {
    /// Create a new port
    pub fn new(name: &str, direction: PortDirection, data_type: DataType) -> Self {
        FlowPort {
            id: FlowPortId::new(),
            name: name.to_string(),
            direction,
            data_type,
            required: false,
            default_value: None,
        }
    }

    /// Mark port as required
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }

    /// Set default value
    pub fn with_default(mut self, default: String) -> Self {
        self.default_value = Some(default);
        self
    }

    /// Create input port
    pub fn input(name: &str, data_type: DataType) -> Self {
        Self::new(name, PortDirection::Input, data_type)
    }

    /// Create output port
    pub fn output(name: &str, data_type: DataType) -> Self {
        Self::new(name, PortDirection::Output, data_type)
    }
}

/// A node in the flow network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    /// Unique node identifier
    pub id: FlowNodeId,
    /// Display name (can be custom instance name)
    pub name: String,
    /// Node type (function name or category)
    pub node_type: String,
    /// Category of node
    pub category: NodeCategory,
    /// Input ports
    pub inputs: HashMap<String, FlowPort>,
    /// Output ports
    pub outputs: HashMap<String, FlowPort>,
    /// Configuration parameters
    pub config: HashMap<String, String>,
    /// Description of what this node does
    pub description: String,
}

impl FlowNode {
    /// Create a new node
    pub fn new(id: FlowNodeId, name: &str, node_type: &str, category: NodeCategory) -> Self {
        FlowNode {
            id,
            name: name.to_string(),
            node_type: node_type.to_string(),
            category,
            inputs: HashMap::new(),
            outputs: HashMap::new(),
            config: HashMap::new(),
            description: String::new(),
        }
    }

    /// Add input port
    pub fn add_input(mut self, port: FlowPort) -> Self {
        self.inputs.insert(port.name.clone(), port);
        self
    }

    /// Add output port
    pub fn add_output(mut self, port: FlowPort) -> Self {
        self.outputs.insert(port.name.clone(), port);
        self
    }

    /// Set description
    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = desc.to_string();
        self
    }

    /// Set configuration parameter
    pub fn set_config(mut self, key: &str, value: &str) -> Self {
        self.config.insert(key.to_string(), value.to_string());
        self
    }

    /// Get input port
    pub fn get_input(&self, name: &str) -> Option<&FlowPort> {
        self.inputs.get(name)
    }

    /// Get output port
    pub fn get_output(&self, name: &str) -> Option<&FlowPort> {
        self.outputs.get(name)
    }

    /// Validate that all required inputs are present
    pub fn validate_inputs(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();
        for (_, port) in &self.inputs {
            if port.required && port.default_value.is_none() {
                errors.push(format!("Required input '{}' has no value", port.name));
            }
        }
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

/// Connection between two ports
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortConnection {
    /// Source node
    pub from_node: FlowNodeId,
    /// Source port name
    pub from_port: String,
    /// Target node
    pub to_node: FlowNodeId,
    /// Target port name
    pub to_port: String,
}

impl PortConnection {
    /// Create new connection
    pub fn new(
        from_node: FlowNodeId,
        from_port: &str,
        to_node: FlowNodeId,
        to_port: &str,
    ) -> Self {
        PortConnection {
            from_node,
            from_port: from_port.to_string(),
            to_node,
            to_port: to_port.to_string(),
        }
    }
}

/// Complete flow network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNetwork {
    /// Name of the network
    pub name: String,
    /// All nodes indexed by ID
    pub nodes: HashMap<FlowNodeId, FlowNode>,
    /// All connections
    pub connections: Vec<PortConnection>,
    /// Flow-level variables
    pub variables: HashMap<String, String>,
    /// Optional start node
    pub start_node: Option<FlowNodeId>,
    /// Optional stop nodes
    pub stop_nodes: Vec<FlowNodeId>,
}

impl FlowNetwork {
    /// Create new flow network
    pub fn new(name: &str) -> Self {
        FlowNetwork {
            name: name.to_string(),
            nodes: HashMap::new(),
            connections: Vec::new(),
            variables: HashMap::new(),
            start_node: None,
            stop_nodes: Vec::new(),
        }
    }

    /// Add node to network
    pub fn add_node(&mut self, node: FlowNode) -> Result<FlowNodeId, String> {
        if self.nodes.contains_key(&node.id) {
            return Err(format!("Node {} already exists", node.id));
        }
        let id = node.id;
        self.nodes.insert(id, node);
        Ok(id)
    }

    /// Add connection between ports
    pub fn connect(
        &mut self,
        from_node: FlowNodeId,
        from_port: &str,
        to_node: FlowNodeId,
        to_port: &str,
    ) -> Result<(), String> {
        // Validate nodes exist
        if !self.nodes.contains_key(&from_node) {
            return Err(format!("Source node {} not found", from_node));
        }
        if !self.nodes.contains_key(&to_node) {
            return Err(format!("Target node {} not found", to_node));
        }

        // Validate ports exist and types match
        let source_node = &self.nodes[&from_node];
        let target_node = &self.nodes[&to_node];

        let source_port = source_node
            .get_output(from_port)
            .ok_or_else(|| format!("Output port '{}' not found on node {}", from_port, from_node))?;

        let target_port = target_node
            .get_input(to_port)
            .ok_or_else(|| format!("Input port '{}' not found on node {}", to_port, to_node))?;

        // Check type compatibility
        if !types::types_compatible(&source_port.data_type, &target_port.data_type) {
            return Err(format!(
                "Type mismatch: {:?} cannot connect to {:?}",
                source_port.data_type, target_port.data_type
            ));
        }

        self.connections.push(PortConnection::new(from_node, from_port, to_node, to_port));
        Ok(())
    }

    /// Get all connections from a node
    pub fn connections_from(&self, node_id: FlowNodeId) -> Vec<&PortConnection> {
        self.connections
            .iter()
            .filter(|c| c.from_node == node_id)
            .collect()
    }

    /// Get all connections to a node
    pub fn connections_to(&self, node_id: FlowNodeId) -> Vec<&PortConnection> {
        self.connections
            .iter()
            .filter(|c| c.to_node == node_id)
            .collect()
    }

    /// Validate network structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Validate all nodes
        for (_, node) in &self.nodes {
            if let Err(node_errors) = node.validate_inputs() {
                errors.extend(node_errors);
            }
        }

        // Validate all connections
        for conn in &self.connections {
            if !self.nodes.contains_key(&conn.from_node) {
                errors.push(format!("Connection from non-existent node {}", conn.from_node));
            }
            if !self.nodes.contains_key(&conn.to_node) {
                errors.push(format!("Connection to non-existent node {}", conn.to_node));
            }
        }

        // Validate start node if specified
        if let Some(start_id) = self.start_node {
            if !self.nodes.contains_key(&start_id) {
                errors.push(format!("Start node {} does not exist", start_id));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Set flow variable
    pub fn set_variable(&mut self, name: &str, value: &str) {
        self.variables.insert(name.to_string(), value.to_string());
    }

    /// Get flow variable
    pub fn get_variable(&self, name: &str) -> Option<&str> {
        self.variables.get(name).map(|s| s.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flow_node_id() {
        let id1 = FlowNodeId::new();
        let id2 = FlowNodeId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_flow_port_creation() {
        let port = FlowPort::input("value", DataType::Number);
        assert_eq!(port.name, "value");
        assert_eq!(port.direction, PortDirection::Input);
    }

    #[test]
    fn test_flow_node_creation() {
        let node = FlowNode::new(FlowNodeId::new(), "Add", "add", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number))
            .add_input(FlowPort::input("b", DataType::Number))
            .add_output(FlowPort::output("result", DataType::Number));

        assert_eq!(node.inputs.len(), 2);
        assert_eq!(node.outputs.len(), 1);
    }

    #[test]
    fn test_flow_network_creation() {
        let net = FlowNetwork::new("TestFlow");
        assert_eq!(net.name, "TestFlow");
        assert_eq!(net.nodes.len(), 0);
    }

    #[test]
    fn test_add_node_to_network() {
        let mut net = FlowNetwork::new("TestFlow");
        let node = FlowNode::new(FlowNodeId::new(), "Add", "add", NodeCategory::Math);
        let node_id = node.id;

        net.add_node(node).unwrap();
        assert!(net.nodes.contains_key(&node_id));
    }

    #[test]
    fn test_duplicate_node_error() {
        let mut net = FlowNetwork::new("TestFlow");
        let node_id = FlowNodeId::new();
        let node = FlowNode::new(node_id, "Add", "add", NodeCategory::Math);

        net.add_node(node).unwrap();
        let duplicate = FlowNode::new(node_id, "Add2", "add", NodeCategory::Math);
        assert!(net.add_node(duplicate).is_err());
    }

    #[test]
    fn test_port_connection() {
        let mut net = FlowNetwork::new("TestFlow");
        let node1_id = FlowNodeId::new();
        let node2_id = FlowNodeId::new();

        let node1 = FlowNode::new(node1_id, "Add", "add", NodeCategory::Math)
            .add_output(FlowPort::output("result", DataType::Number));

        let node2 = FlowNode::new(node2_id, "Multiply", "mul", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number));

        net.add_node(node1).unwrap();
        net.add_node(node2).unwrap();

        assert!(net.connect(node1_id, "result", node2_id, "value").is_ok());
        assert_eq!(net.connections.len(), 1);
    }

    #[test]
    fn test_invalid_connection_nonexistent_node() {
        let mut net = FlowNetwork::new("TestFlow");
        let node1_id = FlowNodeId::new();
        let node2_id = FlowNodeId::new();

        let node1 = FlowNode::new(node1_id, "Add", "add", NodeCategory::Math)
            .add_output(FlowPort::output("result", DataType::Number));

        net.add_node(node1).unwrap();

        // Try to connect to non-existent node
        assert!(net.connect(node1_id, "result", node2_id, "value").is_err());
    }

    #[test]
    fn test_network_validation() {
        let mut net = FlowNetwork::new("TestFlow");
        let node = FlowNode::new(FlowNodeId::new(), "Add", "add", NodeCategory::Math);
        net.add_node(node).unwrap();

        assert!(net.validate().is_ok());
    }

    #[test]
    fn test_flow_variables() {
        let mut net = FlowNetwork::new("TestFlow");
        net.set_variable("count", "10");

        assert_eq!(net.get_variable("count"), Some("10"));
        assert_eq!(net.get_variable("unknown"), None);
    }

    #[test]
    fn test_connections_from_node() {
        let mut net = FlowNetwork::new("TestFlow");
        let n1 = FlowNodeId::new();
        let n2 = FlowNodeId::new();
        let n3 = FlowNodeId::new();

        let node1 = FlowNode::new(n1, "N1", "test", NodeCategory::Math)
            .add_output(FlowPort::output("out", DataType::Number));
        let node2 = FlowNode::new(n2, "N2", "test", NodeCategory::Math)
            .add_input(FlowPort::input("in", DataType::Number));
        let node3 = FlowNode::new(n3, "N3", "test", NodeCategory::Math)
            .add_input(FlowPort::input("in", DataType::Number));

        net.add_node(node1).unwrap();
        net.add_node(node2).unwrap();
        net.add_node(node3).unwrap();

        net.connect(n1, "out", n2, "in").unwrap();
        net.connect(n1, "out", n3, "in").unwrap();

        let from_n1 = net.connections_from(n1);
        assert_eq!(from_n1.len(), 2);
    }
}
