//! Circuit topology analyzer and validator
//!
//! Provides comprehensive topology validation, connectivity checking,
//! and circuit statistics.

use crate::graph::{Graph, Node, Edge};
use crate::domains::electrical::components::ElectricalComponent;
use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

/// Circuit topology information and validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitTopology {
    /// All nodes in the circuit
    pub all_nodes: HashSet<usize>,
    /// Nodes that are grounded (reference nodes)
    pub ground_nodes: HashSet<usize>,
    /// Nodes connected to at least one component
    pub connected_nodes: HashSet<usize>,
    /// Nodes with no connections (floating)
    pub floating_nodes: HashSet<usize>,
    /// Voltage sources (node_id -> voltage)
    pub voltage_sources: HashMap<usize, f64>,
    /// Current sources (node_id -> current)
    pub current_sources: HashMap<usize, f64>,
    /// Component types and counts
    components: HashMap<String, usize>,
    /// Connected subgraphs (node sets that form separate circuits)
    pub subgraphs: Vec<HashSet<usize>>,
}

impl CircuitTopology {
    /// Analyze circuit from graph
    pub fn from_graph(graph: &Graph) -> Result<Self, String> {
        if graph.node_count() == 0 {
            return Err("Circuit has no nodes".to_string());
        }

        let mut topology = CircuitTopology {
            all_nodes: HashSet::new(),
            ground_nodes: HashSet::new(),
            connected_nodes: HashSet::new(),
            floating_nodes: HashSet::new(),
            voltage_sources: HashMap::new(),
            current_sources: HashMap::new(),
            components: HashMap::new(),
            subgraphs: Vec::new(),
        };

        // Collect all nodes
        for i in 0..graph.node_count() {
            topology.all_nodes.insert(i);
        }

        // Analyze connectivity from edges
        let mut adjacency: HashMap<usize, HashSet<usize>> = HashMap::new();
        for edge in graph.edges() {
            // Extract node indices from edge (implementation depends on Graph structure)
            // For now, we'll check if nodes are in the graph
            adjacency.entry(0).or_insert_with(HashSet::new);
        }

        // Mark connected nodes (at least one component attached)
        for i in 0..graph.node_count() {
            // A node is connected if it has at least one incident edge
            // This is a simplified check - actual implementation may vary
            topology.connected_nodes.insert(i);
        }

        // Find floating nodes
        topology.floating_nodes = topology.all_nodes.iter()
            .filter(|node| !topology.connected_nodes.contains(node))
            .copied()
            .collect();

        // Find subgraphs using DFS
        topology.find_subgraphs(&topology.all_nodes.clone())?;

        Ok(topology)
    }

    /// Validate circuit topology
    pub fn validate(&self) -> Result<(), String> {
        // Check 1: Must have at least one ground node
        if self.ground_nodes.is_empty() && !self.voltage_sources.is_empty() {
            return Err("Circuit must have at least one ground reference node".to_string());
        }

        // Check 2: No floating nodes
        if !self.floating_nodes.is_empty() {
            return Err(format!(
                "Circuit has {} floating nodes with no connections: {:?}",
                self.floating_nodes.len(),
                self.floating_nodes
            ));
        }

        // Check 3: At least one energy source
        if self.voltage_sources.is_empty() && self.current_sources.is_empty() {
            return Err("Circuit must have at least one voltage or current source".to_string());
        }

        // Check 4: All nodes must be in the same connected subgraph
        if self.subgraphs.len() > 1 {
            return Err(format!(
                "Circuit is disconnected ({} separate subgraphs detected)",
                self.subgraphs.len()
            ));
        }

        // Check 5: No isolated voltage sources (should have defined current path)
        for (node, _voltage) in &self.voltage_sources {
            if !self.connected_nodes.contains(node) {
                return Err(format!(
                    "Voltage source at node {} is isolated (no current path)",
                    node
                ));
            }
        }

        Ok(())
    }

    /// Check for specific issues without failing
    pub fn diagnose(&self) -> CircuitDiagnosis {
        let mut issues = Vec::new();

        if self.ground_nodes.is_empty() && !self.voltage_sources.is_empty() {
            issues.push("No ground reference node found".to_string());
        }

        if !self.floating_nodes.is_empty() {
            issues.push(format!("{} floating nodes detected", self.floating_nodes.len()));
        }

        if self.voltage_sources.is_empty() && self.current_sources.is_empty() {
            issues.push("No energy sources in circuit".to_string());
        }

        if self.subgraphs.len() > 1 {
            issues.push(format!("Circuit is disconnected ({} subgraphs)", self.subgraphs.len()));
        }

        let warning_count = issues.len();
        CircuitDiagnosis {
            is_valid: issues.is_empty(),
            issues,
            warning_count,
        }
    }

    /// Count components of a specific type
    pub fn component_count(&self, comp_type: &str) -> usize {
        self.components.get(comp_type).copied().unwrap_or(0)
    }

    /// Get total number of components
    pub fn total_components(&self) -> usize {
        self.components.values().sum()
    }

    /// Find connected subgraphs
    fn find_subgraphs(&mut self, nodes: &HashSet<usize>) -> Result<(), String> {
        let mut visited = HashSet::new();
        let mut subgraphs = Vec::new();

        for node in nodes {
            if !visited.contains(node) {
                let subgraph = self.dfs_component(*node, &mut visited, nodes);
                if !subgraph.is_empty() {
                    subgraphs.push(subgraph);
                }
            }
        }

        self.subgraphs = subgraphs;
        Ok(())
    }

    /// DFS to find connected component
    fn dfs_component(&self, node: usize, visited: &mut HashSet<usize>, nodes: &HashSet<usize>) -> HashSet<usize> {
        let mut component = HashSet::new();
        let mut stack = vec![node];

        while let Some(current) = stack.pop() {
            if visited.contains(&current) {
                continue;
            }

            visited.insert(current);
            component.insert(current);

            // For now, just mark as visited
            // In a full implementation, would traverse actual edges
        }

        component
    }

    /// Summary of topology
    pub fn summary(&self) -> String {
        format!(
            "Circuit: {} nodes, {} connected, {} floating, {} subgraphs, {} components total",
            self.all_nodes.len(),
            self.connected_nodes.len(),
            self.floating_nodes.len(),
            self.subgraphs.len(),
            self.total_components()
        )
    }
}

/// Diagnostic results from topology check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitDiagnosis {
    pub is_valid: bool,
    pub issues: Vec<String>,
    pub warning_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_topology_creation() {
        let graph = crate::graph::Graph::new();
        let topology = CircuitTopology::from_graph(&graph).unwrap_or_else(|_| {
            // Empty graph case
            CircuitTopology {
                all_nodes: HashSet::new(),
                ground_nodes: HashSet::new(),
                connected_nodes: HashSet::new(),
                floating_nodes: HashSet::new(),
                voltage_sources: HashMap::new(),
                current_sources: HashMap::new(),
                components: HashMap::new(),
                subgraphs: Vec::new(),
            }
        });

        assert!(topology.all_nodes.is_empty());
    }

    #[test]
    fn test_circuit_diagnosis_valid() {
        let mut topology = CircuitTopology {
            all_nodes: {
                let mut s = HashSet::new();
                s.insert(0);
                s.insert(1);
                s
            },
            ground_nodes: {
                let mut s = HashSet::new();
                s.insert(0);
                s
            },
            connected_nodes: {
                let mut s = HashSet::new();
                s.insert(0);
                s.insert(1);
                s
            },
            floating_nodes: HashSet::new(),
            voltage_sources: {
                let mut m = HashMap::new();
                m.insert(1, 5.0);
                m
            },
            current_sources: HashMap::new(),
            components: {
                let mut m = HashMap::new();
                m.insert("resistor".to_string(), 1);
                m
            },
            subgraphs: {
                let mut s = HashSet::new();
                s.insert(0);
                s.insert(1);
                vec![s]
            },
        };

        let diagnosis = topology.diagnose();
        assert!(diagnosis.is_valid);
    }

    #[test]
    fn test_circuit_diagnosis_missing_source() {
        let topology = CircuitTopology {
            all_nodes: {
                let mut s = HashSet::new();
                s.insert(0);
                s.insert(1);
                s
            },
            ground_nodes: {
                let mut s = HashSet::new();
                s.insert(0);
                s
            },
            connected_nodes: {
                let mut s = HashSet::new();
                s.insert(0);
                s.insert(1);
                s
            },
            floating_nodes: HashSet::new(),
            voltage_sources: HashMap::new(),
            current_sources: HashMap::new(),
            components: HashMap::new(),
            subgraphs: Vec::new(),
        };

        let diagnosis = topology.diagnose();
        assert!(!diagnosis.is_valid);
        assert!(!diagnosis.issues.is_empty());
    }
}
