//! Core graph abstraction for unified simulator architecture
//!
//! This module provides the foundational abstractions for all simulators in Tupan.
//! Key concepts:
//!
//! - **Node**: Represents a component or block (resistor, block, function, etc.)
//! - **Port**: Input/output connections on nodes (voltage, signal, etc.)
//! - **Edge**: Connections between ports that represent signal/energy flow
//! - **Graph**: Container that holds nodes and edges, manages simulation
//!
//! All simulators (electrical, thermal, mechanical, block diagrams, etc.) use
//! this same abstraction, just with different node and port implementations.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;
use crate::error::{Result, TupanError};

pub mod node;
pub mod edge;
pub mod graph;
pub mod port;

// Re-export main types
pub use node::{Node, NodeId, NodeData};
pub use edge::{Edge, EdgeId};
pub use port::{Port, PortId, PortDirection, PortType};
pub use graph::Graph;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_id_creation() {
        let id1 = NodeId::new();
        let id2 = NodeId::new();
        assert_ne!(id1, id2);
    }
}
