//! Edge abstraction for connections between nodes

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use super::node::NodeId;
use super::port::PortId;

/// Unique identifier for an edge
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct EdgeId(Uuid);

impl EdgeId {
    /// Create a new unique edge ID
    pub fn new() -> Self {
        EdgeId(Uuid::new_v4())
    }
}

impl Default for EdgeId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for EdgeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Core trait for edges connecting nodes
pub trait Edge: Serialize + for<'de> Deserialize<'de> + Send + Sync {
    /// Get the unique ID of this edge
    fn id(&self) -> EdgeId;

    /// Get source node and port
    fn source(&self) -> (NodeId, PortId);

    /// Get target node and port
    fn target(&self) -> (NodeId, PortId);

    /// Get edge properties
    fn properties(&self) -> &EdgeProperties;

    /// Get mutable edge properties
    fn properties_mut(&mut self) -> &mut EdgeProperties;
}

/// Data structure for edges
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeData {
    /// Unique identifier
    pub id: EdgeId,
    /// Source node and port
    pub source: (NodeId, PortId),
    /// Target node and port
    pub target: (NodeId, PortId),
    /// Edge properties
    pub properties: EdgeProperties,
}

impl EdgeData {
    /// Create a new edge
    pub fn new(source: (NodeId, PortId), target: (NodeId, PortId)) -> Self {
        EdgeData {
            id: EdgeId::new(),
            source,
            target,
            properties: EdgeProperties::default(),
        }
    }
}

impl Edge for EdgeData {
    fn id(&self) -> EdgeId {
        self.id
    }

    fn source(&self) -> (NodeId, PortId) {
        self.source
    }

    fn target(&self) -> (NodeId, PortId) {
        self.target
    }

    fn properties(&self) -> &EdgeProperties {
        &self.properties
    }

    fn properties_mut(&mut self) -> &mut EdgeProperties {
        &mut self.properties
    }
}

/// Properties associated with an edge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeProperties {
    /// Optional edge label/name
    pub label: Option<String>,
    /// Optional gain or weight
    pub gain: Option<f64>,
    /// Optional delay
    pub delay: Option<f64>,
    /// Custom metadata
    pub metadata: serde_json::Value,
}

impl EdgeProperties {
    pub fn new() -> Self {
        EdgeProperties {
            label: None,
            gain: None,
            delay: None,
            metadata: serde_json::Value::Object(Default::default()),
        }
    }

    pub fn with_label(mut self, label: String) -> Self {
        self.label = Some(label);
        self
    }

    pub fn with_gain(mut self, gain: f64) -> Self {
        self.gain = Some(gain);
        self
    }

    pub fn with_delay(mut self, delay: f64) -> Self {
        self.delay = Some(delay);
        self
    }
}

impl Default for EdgeProperties {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_edge_creation() {
        let source = (NodeId::new(), PortId::new());
        let target = (NodeId::new(), PortId::new());
        let edge = EdgeData::new(source, target);

        assert_eq!(edge.source(), source);
        assert_eq!(edge.target(), target);
    }

    #[test]
    fn test_edge_properties() {
        let props = EdgeProperties::new()
            .with_label("test".to_string())
            .with_gain(2.0);

        assert_eq!(props.label, Some("test".to_string()));
        assert_eq!(props.gain, Some(2.0));
    }
}
