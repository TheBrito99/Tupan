//! Port definitions for graph nodes

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a port
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct PortId(Uuid);

impl PortId {
    /// Create a new unique port ID
    pub fn new() -> Self {
        PortId(Uuid::new_v4())
    }
}

impl Default for PortId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for PortId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Direction of a port (input or output)
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum PortDirection {
    /// Input port (receives data/energy from other nodes)
    Input,
    /// Output port (sends data/energy to other nodes)
    Output,
}

/// Type of data/energy flowing through a port
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum PortType {
    /// Electrical signal (voltage or current)
    Electrical,
    /// Thermal signal (temperature or heat flow)
    Thermal,
    /// Mechanical signal (force, torque, position, velocity)
    Mechanical,
    /// Hydraulic signal (pressure, flow rate)
    Hydraulic,
    /// Pneumatic signal (pressure, flow rate)
    Pneumatic,
    /// Generic data signal
    Signal,
    /// Custom port type
    Custom(String),
}

/// A port on a node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    /// Unique identifier for this port
    pub id: PortId,
    /// Human-readable name
    pub name: String,
    /// Direction (input or output)
    pub direction: PortDirection,
    /// Type of signal flowing through this port
    pub port_type: PortType,
    /// Current value(s) flowing through this port
    pub value: Vec<f64>,
    /// Unit of measurement (optional)
    pub unit: Option<String>,
}

impl Port {
    /// Create a new port
    pub fn new(
        name: String,
        direction: PortDirection,
        port_type: PortType,
    ) -> Self {
        Port {
            id: PortId::new(),
            name,
            direction,
            port_type,
            value: vec![0.0],
            unit: None,
        }
    }

    /// Create a new input port
    pub fn input(name: String, port_type: PortType) -> Self {
        Self::new(name, PortDirection::Input, port_type)
    }

    /// Create a new output port
    pub fn output(name: String, port_type: PortType) -> Self {
        Self::new(name, PortDirection::Output, port_type)
    }

    /// Set the value(s) in this port
    pub fn set_value(&mut self, value: Vec<f64>) {
        self.value = value;
    }

    /// Get the value in this port
    pub fn get_value(&self) -> &[f64] {
        &self.value
    }

    /// Set unit of measurement
    pub fn with_unit(mut self, unit: String) -> Self {
        self.unit = Some(unit);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_creation() {
        let port = Port::input("V".to_string(), PortType::Electrical);
        assert_eq!(port.name, "V");
        assert_eq!(port.direction, PortDirection::Input);
        assert_eq!(port.value, vec![0.0]);
    }

    #[test]
    fn test_port_with_unit() {
        let port = Port::output("Current".to_string(), PortType::Electrical)
            .with_unit("A".to_string());
        assert_eq!(port.unit, Some("A".to_string()));
    }
}
