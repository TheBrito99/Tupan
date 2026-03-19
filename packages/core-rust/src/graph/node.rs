//! Node abstraction for graph components

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use super::port::{Port, PortId};

/// Unique identifier for a node
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct NodeId(Uuid);

impl NodeId {
    /// Create a new unique node ID
    pub fn new() -> Self {
        NodeId(Uuid::new_v4())
    }
}

impl Default for NodeId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for NodeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl NodeId {
    /// Create a node ID from a UUID string
    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(NodeId(Uuid::parse_str(s)?))
    }
}

/// Core trait that all nodes must implement
pub trait Node: Serialize + for<'de> Deserialize<'de> + Send + Sync {
    /// Get the unique ID of this node
    fn id(&self) -> NodeId;

    /// Get the type/category of this node (e.g., "resistor", "capacitor")
    fn node_type(&self) -> &str;

    /// Get all input ports
    fn inputs(&self) -> &[Port];

    /// Get all output ports
    fn outputs(&self) -> &[Port];

    /// Get a mutable reference to input ports
    fn inputs_mut(&mut self) -> &mut [Port];

    /// Get a mutable reference to output ports
    fn outputs_mut(&mut self) -> &mut [Port];

    /// Compute outputs based on inputs
    /// Default implementation just returns zeros
    fn compute(&mut self, _context: &ComputeContext) -> Result<(), String> {
        Ok(())
    }

    /// Get internal state (if any)
    fn state(&self) -> Option<Vec<f64>> {
        None
    }

    /// Set internal state
    fn set_state(&mut self, _state: Vec<f64>) -> Result<(), String> {
        Ok(())
    }

    /// Reset node to initial state
    fn reset(&mut self) -> Result<(), String> {
        Ok(())
    }
}

/// Data structure for nodes that don't need custom implementations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeData {
    /// Unique identifier
    pub id: NodeId,
    /// Node type/category
    pub node_type: String,
    /// Input ports
    pub inputs: Vec<Port>,
    /// Output ports
    pub outputs: Vec<Port>,
    /// Node parameters (e.g., resistance value)
    pub parameters: serde_json::Value,
    /// Internal state variables
    pub state: Vec<f64>,
}

impl NodeData {
    /// Create a new node
    pub fn new(id: NodeId, node_type: String) -> Self {
        NodeData {
            id,
            node_type,
            inputs: Vec::new(),
            outputs: Vec::new(),
            parameters: serde_json::Value::Object(Default::default()),
            state: Vec::new(),
        }
    }

    /// Add an input port
    pub fn add_input(&mut self, port: Port) {
        self.inputs.push(port);
    }

    /// Add an output port
    pub fn add_output(&mut self, port: Port) {
        self.outputs.push(port);
    }

    /// Set a parameter value
    pub fn set_parameter(&mut self, name: &str, value: serde_json::Value) {
        if let Some(obj) = self.parameters.as_object_mut() {
            obj.insert(name.to_string(), value);
        }
    }

    /// Get a parameter value
    pub fn get_parameter(&self, name: &str) -> Option<&serde_json::Value> {
        self.parameters.get(name)
    }
}

impl Node for NodeData {
    fn id(&self) -> NodeId {
        self.id
    }

    fn node_type(&self) -> &str {
        &self.node_type
    }

    fn inputs(&self) -> &[Port] {
        &self.inputs
    }

    fn outputs(&self) -> &[Port] {
        &self.outputs
    }

    fn inputs_mut(&mut self) -> &mut [Port] {
        &mut self.inputs
    }

    fn outputs_mut(&mut self) -> &mut [Port] {
        &mut self.outputs
    }

    fn state(&self) -> Option<Vec<f64>> {
        if self.state.is_empty() {
            None
        } else {
            Some(self.state.clone())
        }
    }

    fn set_state(&mut self, state: Vec<f64>) -> Result<(), String> {
        self.state = state;
        Ok(())
    }

    fn reset(&mut self) -> Result<(), String> {
        self.state.clear();
        self.state = vec![0.0; self.state.capacity()];
        Ok(())
    }
}

/// Context information for compute operations
#[derive(Debug, Clone)]
pub struct ComputeContext {
    /// Current simulation time
    pub time: f64,
    /// Time step
    pub dt: f64,
}

impl ComputeContext {
    pub fn new(time: f64, dt: f64) -> Self {
        ComputeContext { time, dt }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::port::PortType;

    #[test]
    fn test_node_data_creation() {
        let mut node = NodeData::new(NodeId::new(), "resistor".to_string());
        assert_eq!(node.node_type(), "resistor");
        assert!(node.inputs.is_empty());
    }

    #[test]
    fn test_node_data_ports() {
        let mut node = NodeData::new(NodeId::new(), "resistor".to_string());
        node.add_input(Port::input("in".to_string(), PortType::Electrical));
        node.add_output(Port::output("out".to_string(), PortType::Electrical));

        assert_eq!(node.inputs.len(), 1);
        assert_eq!(node.outputs.len(), 1);
    }

    #[test]
    fn test_node_parameters() {
        let mut node = NodeData::new(NodeId::new(), "resistor".to_string());
        node.set_parameter("resistance", serde_json::json!(1000.0));

        assert_eq!(
            node.get_parameter("resistance"),
            Some(&serde_json::json!(1000.0))
        );
    }
}
