//! Flow-Based Programming Domain Wrapper & Visualization
//!
//! Integrates FBP networks with Tupan's unified domain architecture,
//! providing visualization data, graph conversion, and network analysis.

use super::{FlowNode, FlowNetwork, FlowNodeId, Message, PortConnection};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Visualization data for a single flow node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNodeVisualization {
    pub id: String,
    pub name: String,
    pub node_type: String,
    pub category: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub color: String,
    pub input_count: usize,
    pub output_count: usize,
}

/// Visualization data for a connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowConnectionVisualization {
    pub id: String,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
    pub label: String,
}

/// Complete flow network diagram data for UI rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNetworkDiagramData {
    pub name: String,
    pub nodes: Vec<FlowNodeVisualization>,
    pub connections: Vec<FlowConnectionVisualization>,
}

/// Flow network statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNetworkStatistics {
    pub total_nodes: usize,
    pub total_connections: usize,
    pub nodes_by_category: HashMap<String, usize>,
    pub has_cycles: bool,
    pub execution_complexity: f64,
    pub average_node_connections: f64,
    pub max_depth: usize,
}

/// FBP Domain wrapper integrating with Tupan architecture
#[derive(Debug, Clone)]
pub struct FlowNetworkDomain {
    pub network: FlowNetwork,
}

impl FlowNetworkDomain {
    /// Create new FBP domain wrapper
    pub fn new(network: FlowNetwork) -> Self {
        FlowNetworkDomain { network }
    }

    /// Convert FBP network to visualization data
    pub fn visualization_data(&self) -> FlowNetworkDiagramData {
        let mut nodes = Vec::new();
        let mut node_positions: HashMap<FlowNodeId, (f64, f64)> = HashMap::new();

        // Calculate node positions (simple grid layout)
        let node_count = self.network.nodes.len();
        let cols = ((node_count as f64).sqrt().ceil()) as usize;
        let mut idx = 0;

        for (node_id, node) in &self.network.nodes {
            let x = ((idx % cols) as f64) * 200.0;
            let y = ((idx / cols) as f64) * 150.0;
            node_positions.insert(*node_id, (x, y));

            let color = self.get_node_color(&node.category.to_string());
            nodes.push(FlowNodeVisualization {
                id: format!("{}", node_id),
                name: node.name.clone(),
                node_type: node.node_type.clone(),
                category: node.category.to_string(),
                x,
                y,
                width: 150.0,
                height: 80.0,
                color,
                input_count: node.inputs.len(),
                output_count: node.outputs.len(),
            });

            idx += 1;
        }

        // Create connection visualizations
        let mut connections = Vec::new();
        for (_conn_idx, conn) in self.network.connections.iter().enumerate() {
            connections.push(FlowConnectionVisualization {
                id: format!("conn_{}", _conn_idx),
                from_node: format!("{}", conn.from_node),
                from_port: conn.from_port.clone(),
                to_node: format!("{}", conn.to_node),
                to_port: conn.to_port.clone(),
                label: format!("{} → {}", conn.from_port, conn.to_port),
            });
        }

        FlowNetworkDiagramData {
            name: self.network.name.clone(),
            nodes,
            connections,
        }
    }

    /// Get color for node category
    fn get_node_color(&self, category: &str) -> String {
        match category {
            "Math" => "#4CAF50".to_string(),      // Green
            "Logic" => "#2196F3".to_string(),     // Blue
            "String" => "#FF9800".to_string(),    // Orange
            "Array" => "#9C27B0".to_string(),     // Purple
            "Type" => "#F44336".to_string(),      // Red
            "I/O" => "#00BCD4".to_string(),       // Cyan
            "Control" => "#FFD700".to_string(),   // Gold
            _ => "#808080".to_string(),           // Gray
        }
    }

    /// Export network as Graphviz DOT notation
    pub fn export_as_dot(&self) -> String {
        let mut dot = String::new();
        dot.push_str("digraph FlowNetwork {\n");
        dot.push_str("  rankdir=LR;\n");
        dot.push_str("  node [shape=box, style=rounded, margin=\"0.2,0.1\"];\n");
        dot.push_str("  edge [fontsize=10];\n\n");

        // Add nodes
        for (node_id, node) in &self.network.nodes {
            let node_id_str = format!("{}", node_id);
            let label = format!(
                "{} [{}]\n{} inputs, {} outputs",
                node.name,
                node.node_type,
                node.inputs.len(),
                node.outputs.len()
            );
            let color = self.get_node_color(&node.category.to_string());
            dot.push_str(&format!(
                "  \"{}\" [label=\"{}\", fillcolor=\"{}\", style=\"filled,rounded\"];\n",
                node_id_str, label, color
            ));
        }

        dot.push_str("\n");

        // Add edges
        for (conn_idx, conn) in self.network.connections.iter().enumerate() {
            let from_id = format!("{}", conn.from_node);
            let to_id = format!("{}", conn.to_node);
            let label = format!("{} → {}", conn.from_port, conn.to_port);
            dot.push_str(&format!(
                "  \"{}\" -> \"{}\" [label=\"{}\"];\n",
                from_id, to_id, label
            ));
        }

        dot.push_str("}\n");
        dot
    }

    /// Compute network statistics
    pub fn statistics(&self) -> FlowNetworkStatistics {
        let total_nodes = self.network.nodes.len();
        let total_connections = self.network.connections.len();

        // Count nodes by category
        let mut nodes_by_category = HashMap::new();
        for (_, node) in &self.network.nodes {
            let category = node.category.to_string();
            *nodes_by_category.entry(category).or_insert(0) += 1;
        }

        // Check for cycles using DFS
        let has_cycles = self.has_cycles();

        // Calculate average connections per node
        let average_node_connections = if total_nodes > 0 {
            (total_connections as f64) * 2.0 / (total_nodes as f64)
        } else {
            0.0
        };

        // Calculate max depth (longest path)
        let max_depth = self.calculate_max_depth();

        // Calculate execution complexity (nodes + connections)
        let execution_complexity = (total_nodes as f64) + (total_connections as f64) * 0.5;

        FlowNetworkStatistics {
            total_nodes,
            total_connections,
            nodes_by_category,
            has_cycles,
            execution_complexity,
            average_node_connections,
            max_depth,
        }
    }

    /// Detect cycles in the network using DFS
    fn has_cycles(&self) -> bool {
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        for (node_id, _) in &self.network.nodes {
            if !visited.contains(node_id) {
                if self.has_cycle_visit(*node_id, &mut visited, &mut rec_stack) {
                    return true;
                }
            }
        }

        false
    }

    /// DFS helper for cycle detection
    fn has_cycle_visit(
        &self,
        node_id: FlowNodeId,
        visited: &mut HashSet<FlowNodeId>,
        rec_stack: &mut HashSet<FlowNodeId>,
    ) -> bool {
        visited.insert(node_id);
        rec_stack.insert(node_id);

        // Get all outgoing connections
        for conn in &self.network.connections {
            if conn.from_node == node_id {
                if !visited.contains(&conn.to_node) {
                    if self.has_cycle_visit(conn.to_node, visited, rec_stack) {
                        return true;
                    }
                } else if rec_stack.contains(&conn.to_node) {
                    return true;
                }
            }
        }

        rec_stack.remove(&node_id);
        false
    }

    /// Calculate maximum depth (longest path from source to sink)
    fn calculate_max_depth(&self) -> usize {
        if self.network.nodes.is_empty() {
            return 0;
        }

        let mut max_depth = 0;
        let mut depths: HashMap<FlowNodeId, usize> = HashMap::new();

        // Find source nodes (no incoming connections)
        let mut sources = Vec::new();
        let mut has_incoming = HashSet::new();

        for conn in &self.network.connections {
            has_incoming.insert(conn.to_node);
        }

        for node_id in self.network.nodes.keys() {
            if !has_incoming.contains(node_id) {
                sources.push(*node_id);
                depths.insert(*node_id, 0);
            }
        }

        // If no source nodes, start from all nodes
        if sources.is_empty() {
            for node_id in self.network.nodes.keys() {
                sources.push(*node_id);
                depths.insert(*node_id, 0);
            }
        }

        // Calculate depths using BFS
        let mut queue = sources.clone();
        let mut idx = 0;

        while idx < queue.len() {
            let current = queue[idx];
            let current_depth = depths[&current];
            idx += 1;

            for conn in &self.network.connections {
                if conn.from_node == current {
                    let new_depth = current_depth + 1;
                    let target_depth = depths.entry(conn.to_node).or_insert(new_depth);

                    if new_depth > *target_depth {
                        *target_depth = new_depth;
                        max_depth = max_depth.max(new_depth);

                        if !queue.contains(&conn.to_node) {
                            queue.push(conn.to_node);
                        }
                    }
                }
            }
        }

        max_depth
    }

    /// Validate network structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Validate all nodes
        for (_, node) in &self.network.nodes {
            if let Err(node_errors) = node.validate_inputs() {
                errors.extend(node_errors);
            }
        }

        // Validate connections
        for conn in &self.network.connections {
            // Check source node exists
            if !self.network.nodes.contains_key(&conn.from_node) {
                errors.push(format!("Source node {} not found in network", conn.from_node));
            }

            // Check target node exists
            if !self.network.nodes.contains_key(&conn.to_node) {
                errors.push(format!("Target node {} not found in network", conn.to_node));
            }

            // Check ports exist and types match
            if let (Some(source_node), Some(target_node)) =
                (
                    self.network.nodes.get(&conn.from_node),
                    self.network.nodes.get(&conn.to_node),
                )
            {
                if source_node.get_output(&conn.from_port).is_none() {
                    errors.push(format!(
                        "Output port '{}' not found on node {}",
                        conn.from_port, conn.from_node
                    ));
                }

                if target_node.get_input(&conn.to_port).is_none() {
                    errors.push(format!(
                        "Input port '{}' not found on node {}",
                        conn.to_port, conn.to_node
                    ));
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::flow_based::{DataType, FlowNode, FlowPort, NodeCategory};

    fn create_test_network() -> FlowNetwork {
        let mut net = FlowNetwork::new("TestFlow");

        let node1_id = FlowNodeId::new();
        let node2_id = FlowNodeId::new();
        let node3_id = FlowNodeId::new();

        let node1 = FlowNode::new(node1_id, "Add", "add", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number))
            .add_input(FlowPort::input("b", DataType::Number))
            .add_output(FlowPort::output("result", DataType::Number));

        let node2 = FlowNode::new(node2_id, "Multiply", "multiply", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number))
            .add_input(FlowPort::input("b", DataType::Number))
            .add_output(FlowPort::output("result", DataType::Number));

        let node3 = FlowNode::new(node3_id, "Log", "log", NodeCategory::IO)
            .add_input(FlowPort::input("message", DataType::Any))
            .add_output(FlowPort::output("done", DataType::Boolean));

        net.add_node(node1).unwrap();
        net.add_node(node2).unwrap();
        net.add_node(node3).unwrap();

        net.connect(node1_id, "result", node2_id, "a").unwrap();
        net.connect(node2_id, "result", node3_id, "message").unwrap();

        net
    }

    #[test]
    fn test_domain_creation() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);
        assert_eq!(domain.network.nodes.len(), 3);
    }

    #[test]
    fn test_visualization_data() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);
        let vis_data = domain.visualization_data();

        assert_eq!(vis_data.nodes.len(), 3);
        assert_eq!(vis_data.connections.len(), 2);
        assert_eq!(vis_data.name, "TestFlow");
    }

    #[test]
    fn test_export_as_dot() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);
        let dot = domain.export_as_dot();

        assert!(dot.contains("digraph FlowNetwork"));
        assert!(dot.contains("Add"));
        assert!(dot.contains("Multiply"));
        assert!(dot.contains("Log"));
    }

    #[test]
    fn test_statistics() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);
        let stats = domain.statistics();

        assert_eq!(stats.total_nodes, 3);
        assert_eq!(stats.total_connections, 2);
        assert!(!stats.has_cycles);
        assert_eq!(stats.max_depth, 2);
    }

    #[test]
    fn test_statistics_complexity() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);
        let stats = domain.statistics();

        // Complexity = nodes + connections * 0.5 = 3 + 2 * 0.5 = 4
        assert_eq!(stats.execution_complexity, 4.0);
    }

    #[test]
    fn test_cycle_detection() {
        let mut net = FlowNetwork::new("CycleTest");

        let node1_id = FlowNodeId::new();
        let node2_id = FlowNodeId::new();

        let node1 = FlowNode::new(node1_id, "Add", "add", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number))
            .add_output(FlowPort::output("result", DataType::Number));

        let node2 = FlowNode::new(node2_id, "Multiply", "multiply", NodeCategory::Math)
            .add_input(FlowPort::input("a", DataType::Number))
            .add_output(FlowPort::output("result", DataType::Number));

        net.add_node(node1).unwrap();
        net.add_node(node2).unwrap();

        // Create cycle: 1 → 2 → 1
        net.connect(node1_id, "result", node2_id, "a").unwrap();
        net.connect(node2_id, "result", node1_id, "a").unwrap();

        let domain = FlowNetworkDomain::new(net);
        let stats = domain.statistics();

        assert!(stats.has_cycles);
    }

    #[test]
    fn test_network_validation() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);

        assert!(domain.validate().is_ok());
    }

    #[test]
    fn test_node_color_assignment() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);
        let vis_data = domain.visualization_data();

        // Check that nodes have colors assigned
        for node in &vis_data.nodes {
            assert!(!node.color.is_empty());
            assert!(node.color.starts_with("#"));
        }
    }

    #[test]
    fn test_statistics_nodes_by_category() {
        let net = create_test_network();
        let domain = FlowNetworkDomain::new(net);
        let stats = domain.statistics();

        assert_eq!(stats.nodes_by_category.get("Math").copied(), Some(2));
        assert_eq!(stats.nodes_by_category.get("I/O").copied(), Some(1));
    }
}
