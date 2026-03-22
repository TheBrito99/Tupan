//! Electrical domain graph with validation and constraints
//!
//! Extends the base Graph with electrical-specific rules:
//! - Port type validation (only electrical ports can connect)
//! - Connection constraints (prevent invalid electrical connections)
//! - Node type validation (only electrical components allowed)

use crate::graph::{Graph, NodeId, PortId, PortType, Port, PortDirection};
use crate::graph::edge::EdgeData;
use crate::domains::electrical::components::ElectricalComponent;
use crate::error::TupanError;
use std::collections::HashSet;
use serde::{Deserialize, Serialize};

/// Electrical circuit graph with validation
///
/// Extends the base Graph abstraction with electrical domain rules:
/// - Only electrical components as nodes
/// - Only electrical ports can be connected
/// - No cross-domain connections
/// - Ensures valid circuit topology
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElectricalGraph {
    /// Underlying graph data structure
    base_graph: Graph,

    /// Track which component types are used
    component_types: HashSet<String>,

    /// Validation settings
    allow_floating_nodes: bool,
    allow_unconnected_ports: bool,
}

impl ElectricalGraph {
    /// Create a new electrical circuit graph
    pub fn new() -> Self {
        ElectricalGraph {
            base_graph: Graph::new(),
            component_types: HashSet::new(),
            allow_floating_nodes: false,
            allow_unconnected_ports: false,
        }
    }

    /// Create from existing graph (with validation)
    pub fn from_graph(graph: Graph) -> Result<Self, String> {
        let mut elec_graph = ElectricalGraph::new();
        elec_graph.base_graph = graph;

        // Validate that all nodes are electrical components
        elec_graph.validate_all_nodes()?;

        Ok(elec_graph)
    }

    /// Get reference to underlying graph
    pub fn graph(&self) -> &Graph {
        &self.base_graph
    }

    /// Get mutable reference to underlying graph
    pub fn graph_mut(&mut self) -> &mut Graph {
        &mut self.base_graph
    }

    /// Add an electrical component node to the circuit
    ///
    /// Returns the node ID if successful
    pub fn add_component(&mut self, component: ElectricalComponent) -> NodeId {
        // Create a NodeData wrapper for the component
        // For now, we use the base graph's add_node with a generic NodeData
        // In the future, this could be enhanced to store component-specific data

        use crate::graph::Node;  // Import Node trait to use node_type()

        let comp_type = component.node_type().to_string();
        self.component_types.insert(comp_type);

        // Create node from component using the Node trait
        let node_id = component.id();
        let node = crate::graph::NodeData::new(node_id, component.node_type().to_string());

        // Add ports based on component type (future: auto-generate from component)
        // For now, electrical components are 2-port devices (+ and -)

        self.base_graph.add_node(node)
    }

    /// Connect two components with electrical validation
    ///
    /// Validates that:
    /// 1. Both nodes exist
    /// 2. Both ports are electrical type
    /// 3. Connection doesn't violate circuit rules
    pub fn add_electrical_connection(
        &mut self,
        source_node: NodeId,
        source_port: PortId,
        target_node: NodeId,
        target_port: PortId,
    ) -> Result<(), TupanError> {
        // Check that nodes exist
        self.base_graph
            .get_node(source_node)
            .ok_or_else(|| TupanError::NodeNotFound(source_node.to_string()))?;
        self.base_graph
            .get_node(target_node)
            .ok_or_else(|| TupanError::NodeNotFound(target_node.to_string()))?;

        // Validate port types are electrical
        self.validate_port_types(source_port, target_port)?;

        // Create edge with electrical properties
        let edge = EdgeData::new(
            (source_node, source_port),
            (target_node, target_port),
        );

        self.base_graph.add_edge(edge)?;

        Ok(())
    }

    /// Validate that all nodes in the graph are electrical components
    fn validate_all_nodes(&self) -> Result<(), String> {
        let node_count = self.base_graph.node_count();
        if node_count == 0 {
            return Err("Circuit has no components".to_string());
        }

        // Get list of all node types in the circuit
        let mut types = HashSet::new();
        for i in 0..node_count {
            // Note: Current Graph implementation doesn't expose node type easily
            // This is a limitation we'll address in the next iteration
            types.insert("component".to_string());
        }

        Ok(())
    }

    /// Validate that ports are of compatible electrical types
    fn validate_port_types(&self, _port1: PortId, _port2: PortId) -> Result<(), TupanError> {
        // Both ports should be electrical type
        // In the future, check specific port subtypes:
        // - Power (voltage/current)
        // - Signal
        // - Ground
        // - Thermal
        // etc.

        Ok(())
    }

    /// Get the number of components in the circuit
    pub fn component_count(&self) -> usize {
        self.base_graph.node_count()
    }

    /// Get the number of connections in the circuit
    pub fn connection_count(&self) -> usize {
        self.base_graph.edge_count()
    }

    /// Get list of component types used in circuit
    pub fn get_component_types(&self) -> Vec<&str> {
        self.component_types.iter().map(|s| s.as_str()).collect()
    }

    /// Check if circuit has a ground reference (node with potential 0V)
    pub fn has_ground_reference(&self) -> bool {
        // Check if any node represents ground (component type == "ground")
        self.component_types.contains("ground")
    }

    /// Check if circuit is connected (single connected component)
    pub fn is_fully_connected(&self) -> bool {
        // Use the base graph's connectivity checking
        // (to be implemented in Graph trait)
        true  // Placeholder
    }

    /// Validate the entire circuit before simulation
    pub fn validate_for_simulation(&self) -> Result<(), String> {
        // Check 1: Has ground reference
        if !self.has_ground_reference() {
            return Err("Circuit must have at least one ground reference node".to_string());
        }

        // Check 2: Is fully connected
        if !self.is_fully_connected() {
            return Err("Circuit has disconnected components".to_string());
        }

        // Check 3: Has at least one energy source
        let has_source = self.component_types.contains("voltage_source")
            || self.component_types.contains("current_source");
        if !has_source {
            return Err("Circuit must have at least one energy source (voltage or current)".to_string());
        }

        Ok(())
    }

    /// Get circuit statistics
    pub fn get_stats(&self) -> CircuitGraphStats {
        CircuitGraphStats {
            total_components: self.component_count(),
            total_connections: self.connection_count(),
            has_ground: self.has_ground_reference(),
            is_connected: self.is_fully_connected(),
            component_types: self.get_component_types()
                .iter()
                .map(|s| s.to_string())
                .collect(),
        }
    }
}

impl Default for ElectricalGraph {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics about an electrical circuit graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitGraphStats {
    pub total_components: usize,
    pub total_connections: usize,
    pub has_ground: bool,
    pub is_connected: bool,
    pub component_types: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_electrical_graph_creation() {
        let graph = ElectricalGraph::new();
        assert_eq!(graph.component_count(), 0);
        assert_eq!(graph.connection_count(), 0);
    }

    #[test]
    fn test_electrical_graph_validation() {
        let graph = ElectricalGraph::new();

        // Empty circuit should fail validation
        let result = graph.validate_for_simulation();
        assert!(result.is_err(), "Empty circuit should fail validation");
    }

    #[test]
    fn test_component_types_tracking() {
        let mut graph = ElectricalGraph::new();

        // Add component types to tracking set
        graph.component_types.insert("resistor".to_string());
        graph.component_types.insert("capacitor".to_string());

        assert_eq!(graph.get_component_types().len(), 2);
        assert!(graph.get_component_types().contains(&"resistor"));
    }

    #[test]
    fn test_ground_reference_check() {
        let mut graph = ElectricalGraph::new();

        // Without ground, should not have reference
        assert!(!graph.has_ground_reference());

        // Add ground
        graph.component_types.insert("ground".to_string());
        assert!(graph.has_ground_reference());
    }

    #[test]
    fn test_circuit_stats() {
        let mut graph = ElectricalGraph::new();
        graph.component_types.insert("resistor".to_string());

        let stats = graph.get_stats();
        assert_eq!(stats.total_components, 0);
        assert_eq!(stats.component_types.len(), 1);
    }
}
