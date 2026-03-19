//! WASM bindings for browser integration
//!
//! This module provides JavaScript-friendly bindings for the Tupan core
//! computations. All types are serialized to/from JSON for the WASM boundary.

use wasm_bindgen::prelude::*;
use serde_json::{json, Value};
use crate::graph::{Graph, NodeData, EdgeData, NodeId, PortId};

/// Result type for WASM operations
pub type WasmResult<T> = Result<T, JsValue>;

/// WASM-friendly Graph wrapper
#[wasm_bindgen]
pub struct WasmGraph {
    inner: Graph,
}

#[wasm_bindgen]
impl WasmGraph {
    /// Create a new empty graph
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmGraph {
            inner: Graph::new(),
        }
    }

    /// Add a node from JSON representation
    ///
    /// # Arguments
    /// * `node_json` - JSON string representing the node
    ///
    /// # Returns
    /// Node ID as JSON string, or error
    #[wasm_bindgen]
    pub fn add_node(&mut self, node_json: &str) -> Result<String, JsValue> {
        let node_data: NodeData = serde_json::from_str(node_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse node: {}", e)))?;

        let node_id = self.inner.add_node(node_data);
        Ok(serde_json::to_string(&node_id.to_string())
            .map_err(|e| JsValue::from_str(&e.to_string()))?)
    }

    /// Get a node by ID
    ///
    /// # Arguments
    /// * `node_id` - Node ID as UUID string
    ///
    /// # Returns
    /// Node data as JSON string, or error if not found
    #[wasm_bindgen]
    pub fn get_node(&self, node_id: &str) -> Result<String, JsValue> {
        let id = NodeId::from_string(node_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid node ID: {}", e)))?;
        let node = self.inner.get_node(id)
            .ok_or_else(|| JsValue::from_str(&format!("Node not found: {}", node_id)))?;

        serde_json::to_string(node)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Remove a node by ID
    #[wasm_bindgen]
    pub fn remove_node(&mut self, node_id: &str) -> Result<(), JsValue> {
        let id = NodeId::from_string(node_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid node ID: {}", e)))?;
        self.inner.remove_node(id)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Add an edge from JSON representation
    #[wasm_bindgen]
    pub fn add_edge(&mut self, edge_json: &str) -> Result<String, JsValue> {
        let edge_data: EdgeData = serde_json::from_str(edge_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse edge: {}", e)))?;

        let edge_id = self.inner.add_edge(edge_data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(serde_json::to_string(&edge_id.to_string())
            .map_err(|e| JsValue::from_str(&e.to_string()))?)
    }

    /// Get all nodes as JSON array
    #[wasm_bindgen]
    pub fn get_nodes(&self) -> Result<String, JsValue> {
        let nodes: Vec<_> = self.inner.nodes().collect();
        serde_json::to_string(&nodes)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get all edges as JSON array
    #[wasm_bindgen]
    pub fn get_edges(&self) -> Result<String, JsValue> {
        let edges: Vec<_> = self.inner.edges().collect();
        serde_json::to_string(&edges)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get number of nodes
    #[wasm_bindgen]
    pub fn node_count(&self) -> usize {
        self.inner.node_count()
    }

    /// Get number of edges
    #[wasm_bindgen]
    pub fn edge_count(&self) -> usize {
        self.inner.edge_count()
    }

    /// Serialize the entire graph to JSON
    #[wasm_bindgen]
    pub fn to_json(&self) -> Result<String, JsValue> {
        let nodes: Vec<_> = self.inner.nodes().collect();
        let edges: Vec<_> = self.inner.edges().collect();

        let graph_json = json!({
            "nodes": nodes,
            "edges": edges,
        });

        serde_json::to_string(&graph_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Deserialize graph from JSON
    #[wasm_bindgen]
    pub fn from_json(json: &str) -> Result<WasmGraph, JsValue> {
        let graph_data: Value = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse graph JSON: {}", e)))?;

        let mut graph = Graph::new();

        // Add nodes
        if let Some(nodes) = graph_data["nodes"].as_array() {
            for node_val in nodes {
                let node: NodeData = serde_json::from_value(node_val.clone())
                    .map_err(|e| JsValue::from_str(&format!("Failed to deserialize node: {}", e)))?;
                graph.add_node(node);
            }
        }

        // Add edges
        if let Some(edges) = graph_data["edges"].as_array() {
            for edge_val in edges {
                let edge: EdgeData = serde_json::from_value(edge_val.clone())
                    .map_err(|e| JsValue::from_str(&format!("Failed to deserialize edge: {}", e)))?;
                let _ = graph.add_edge(edge);
            }
        }

        Ok(WasmGraph { inner: graph })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_graph_creation() {
        let graph = WasmGraph::new();
        assert_eq!(graph.node_count(), 0);
        assert_eq!(graph.edge_count(), 0);
    }

    #[test]
    fn test_wasm_graph_serialization() {
        let graph = WasmGraph::new();
        let json = graph.to_json().unwrap();
        assert!(json.contains("nodes"));
        assert!(json.contains("edges"));
    }
}
