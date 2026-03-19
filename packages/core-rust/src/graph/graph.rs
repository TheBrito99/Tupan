//! Core graph implementation

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::node::{Node, NodeId, NodeData};
use super::edge::{Edge, EdgeData, EdgeId};
use super::port::PortId;
use crate::error::{Result, TupanError};

/// Main graph data structure that manages nodes and edges
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Graph {
    /// All nodes in the graph, indexed by ID
    nodes: HashMap<NodeId, NodeData>,
    /// All edges in the graph, indexed by ID
    edges: HashMap<EdgeId, EdgeData>,
    /// Adjacency information: node -> connected edges
    adjacency: HashMap<NodeId, Vec<EdgeId>>,
}

impl Graph {
    /// Create a new empty graph
    pub fn new() -> Self {
        Graph {
            nodes: HashMap::new(),
            edges: HashMap::new(),
            adjacency: HashMap::new(),
        }
    }

    /// Add a node to the graph
    pub fn add_node(&mut self, node: NodeData) -> NodeId {
        let id = node.id;
        self.nodes.insert(id, node);
        self.adjacency.insert(id, Vec::new());
        id
    }

    /// Get a node by ID
    pub fn get_node(&self, id: NodeId) -> Option<&NodeData> {
        self.nodes.get(&id)
    }

    /// Get a mutable reference to a node
    pub fn get_node_mut(&mut self, id: NodeId) -> Option<&mut NodeData> {
        self.nodes.get_mut(&id)
    }

    /// Remove a node and all its connected edges
    pub fn remove_node(&mut self, id: NodeId) -> Result<()> {
        if !self.nodes.contains_key(&id) {
            return Err(TupanError::NodeNotFound(id.to_string()));
        }

        // Remove all edges connected to this node
        if let Some(edge_ids) = self.adjacency.remove(&id) {
            for edge_id in edge_ids {
                self.edges.remove(&edge_id);
            }
        }

        // Remove from all adjacency lists
        for edges in self.adjacency.values_mut() {
            edges.retain(|&eid| {
                if let Some(edge) = self.edges.get(&eid) {
                    edge.source.0 != id && edge.target.0 != id
                } else {
                    false
                }
            });
        }

        self.nodes.remove(&id);
        Ok(())
    }

    /// Add an edge to the graph
    pub fn add_edge(&mut self, edge: EdgeData) -> Result<EdgeId> {
        let source_id = edge.source.0;
        let target_id = edge.target.0;
        let edge_id = edge.id;

        // Verify both nodes exist
        if !self.nodes.contains_key(&source_id) {
            return Err(TupanError::NodeNotFound(source_id.to_string()));
        }
        if !self.nodes.contains_key(&target_id) {
            return Err(TupanError::NodeNotFound(target_id.to_string()));
        }

        self.edges.insert(edge_id, edge);

        // Update adjacency
        self.adjacency.entry(source_id).or_insert_with(Vec::new).push(edge_id);
        self.adjacency.entry(target_id).or_insert_with(Vec::new).push(edge_id);

        Ok(edge_id)
    }

    /// Get an edge by ID
    pub fn get_edge(&self, id: EdgeId) -> Option<&EdgeData> {
        self.edges.get(&id)
    }

    /// Get a mutable reference to an edge
    pub fn get_edge_mut(&mut self, id: EdgeId) -> Option<&mut EdgeData> {
        self.edges.get_mut(&id)
    }

    /// Remove an edge
    pub fn remove_edge(&mut self, id: EdgeId) -> Result<()> {
        if !self.edges.contains_key(&id) {
            return Err(TupanError::EdgeNotFound(id.to_string()));
        }

        let edge = self.edges.remove(&id).unwrap();

        // Update adjacency
        let source_id = edge.source.0;
        let target_id = edge.target.0;

        if let Some(edges) = self.adjacency.get_mut(&source_id) {
            edges.retain(|&eid| eid != id);
        }
        if let Some(edges) = self.adjacency.get_mut(&target_id) {
            edges.retain(|&eid| eid != id);
        }

        Ok(())
    }

    /// Get all nodes
    pub fn nodes(&self) -> impl Iterator<Item = &NodeData> {
        self.nodes.values()
    }

    /// Get all edges
    pub fn edges(&self) -> impl Iterator<Item = &EdgeData> {
        self.edges.values()
    }

    /// Get number of nodes
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    /// Get number of edges
    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }

    /// Find cycles in the graph (if any)
    pub fn find_cycles(&self) -> Vec<Vec<NodeId>> {
        let mut cycles = Vec::new();
        let mut visited = std::collections::HashSet::new();
        let mut rec_stack = std::collections::HashSet::new();

        for &node_id in self.nodes.keys() {
            if !visited.contains(&node_id) {
                self._dfs_cycle(&node_id, &mut visited, &mut rec_stack, &mut Vec::new(), &mut cycles);
            }
        }

        cycles
    }

    fn _dfs_cycle(
        &self,
        node_id: &NodeId,
        visited: &mut std::collections::HashSet<NodeId>,
        rec_stack: &mut std::collections::HashSet<NodeId>,
        path: &mut Vec<NodeId>,
        cycles: &mut Vec<Vec<NodeId>>,
    ) {
        visited.insert(*node_id);
        rec_stack.insert(*node_id);
        path.push(*node_id);

        if let Some(edge_ids) = self.adjacency.get(node_id) {
            for &edge_id in edge_ids {
                if let Some(edge) = self.edges.get(&edge_id) {
                    let next_id = if edge.source.0 == *node_id {
                        edge.target.0
                    } else {
                        edge.source.0
                    };

                    if !visited.contains(&next_id) {
                        self._dfs_cycle(&next_id, visited, rec_stack, path, cycles);
                    } else if rec_stack.contains(&next_id) {
                        // Found a cycle
                        if let Some(pos) = path.iter().position(|&n| n == next_id) {
                            cycles.push(path[pos..].to_vec());
                        }
                    }
                }
            }
        }

        path.pop();
        rec_stack.remove(node_id);
    }

    /// Perform topological sort (returns error if cycle exists)
    pub fn topological_sort(&self) -> Result<Vec<NodeId>> {
        if !self.find_cycles().is_empty() {
            return Err(TupanError::CycleDetected);
        }

        let mut sorted = Vec::new();
        let mut visited = std::collections::HashSet::new();

        for &node_id in self.nodes.keys() {
            if !visited.contains(&node_id) {
                self._topo_dfs(&node_id, &mut visited, &mut sorted);
            }
        }

        sorted.reverse();
        Ok(sorted)
    }

    fn _topo_dfs(
        &self,
        node_id: &NodeId,
        visited: &mut std::collections::HashSet<NodeId>,
        sorted: &mut Vec<NodeId>,
    ) {
        visited.insert(*node_id);

        if let Some(edge_ids) = self.adjacency.get(node_id) {
            for &edge_id in edge_ids {
                if let Some(edge) = self.edges.get(&edge_id) {
                    let next_id = if edge.source.0 == *node_id {
                        edge.target.0
                    } else {
                        edge.source.0
                    };

                    if !visited.contains(&next_id) {
                        self._topo_dfs(&next_id, visited, sorted);
                    }
                }
            }
        }

        sorted.push(*node_id);
    }
}

impl Default for Graph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::port::{Port, PortType};

    #[test]
    fn test_graph_creation() {
        let graph = Graph::new();
        assert_eq!(graph.node_count(), 0);
        assert_eq!(graph.edge_count(), 0);
    }

    #[test]
    fn test_add_node() {
        let mut graph = Graph::new();
        let mut node = NodeData::new(NodeId::new(), "test".to_string());
        node.add_input(Port::input("in".to_string(), PortType::Signal));

        let node_id = graph.add_node(node);
        assert_eq!(graph.node_count(), 1);
        assert!(graph.get_node(node_id).is_some());
    }

    #[test]
    fn test_add_edge() {
        let mut graph = Graph::new();
        let node1 = NodeData::new(NodeId::new(), "node1".to_string());
        let node2 = NodeData::new(NodeId::new(), "node2".to_string());

        let id1 = graph.add_node(node1);
        let id2 = graph.add_node(node2);

        let edge = EdgeData::new((id1, PortId::new()), (id2, PortId::new()));
        let result = graph.add_edge(edge);

        assert!(result.is_ok());
        assert_eq!(graph.edge_count(), 1);
    }

    #[test]
    fn test_remove_node() {
        let mut graph = Graph::new();
        let mut node = NodeData::new(NodeId::new(), "test".to_string());
        node.add_input(Port::input("in".to_string(), PortType::Signal));

        let node_id = graph.add_node(node);
        graph.remove_node(node_id).unwrap();

        assert_eq!(graph.node_count(), 0);
    }
}
