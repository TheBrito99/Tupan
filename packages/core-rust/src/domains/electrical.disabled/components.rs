//! Electrical circuit components
//!
//! Defines the basic components used in electrical circuits:
//! resistors, capacitors, inductors, and sources.

use crate::graph::{Node, NodeId, Port, PortDirection, PortType};
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Enumeration of electrical component types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ElectricalComponent {
    /// Resistor (Ohm's law: V = I * R)
    Resistor {
        id: NodeId,
        resistance: f64,  // Ohms
    },

    /// Capacitor (Q = C * V, I = C * dV/dt)
    Capacitor {
        id: NodeId,
        capacitance: f64,  // Farads
        voltage: f64,      // Stored voltage
        current: f64,      // Current through capacitor
    },

    /// Inductor (V = L * dI/dt)
    Inductor {
        id: NodeId,
        inductance: f64,  // Henries
        current: f64,     // Stored current
        voltage: f64,     // Voltage across inductor
    },

    /// Voltage source (DC or AC)
    VoltageSource {
        id: NodeId,
        voltage: f64,     // Volts
        frequency: f64,   // Hz (0 for DC)
        phase: f64,       // Radians
    },

    /// Current source (DC or AC)
    CurrentSource {
        id: NodeId,
        current: f64,     // Amps
        frequency: f64,   // Hz (0 for DC)
        phase: f64,       // Radians
    },

    /// Ground reference (0V)
    Ground {
        id: NodeId,
    },

    /// Diode (non-linear)
    Diode {
        id: NodeId,
        saturation_current: f64,  // Is (Amps)
        thermal_voltage: f64,      // Vt = kT/q
        current: f64,
    },

    /// Operational amplifier (simplified ideal model)
    OpAmp {
        id: NodeId,
        gain: f64,
        output_voltage: f64,
    },
}

impl ElectricalComponent {
    /// Get component type name
    pub fn component_type(&self) -> &str {
        match self {
            Self::Resistor { .. } => "resistor",
            Self::Capacitor { .. } => "capacitor",
            Self::Inductor { .. } => "inductor",
            Self::VoltageSource { .. } => "voltage_source",
            Self::CurrentSource { .. } => "current_source",
            Self::Ground { .. } => "ground",
            Self::Diode { .. } => "diode",
            Self::OpAmp { .. } => "opamp",
        }
    }

    /// Get component resistance (for linear analysis)
    pub fn resistance(&self) -> Option<f64> {
        match self {
            Self::Resistor { resistance, .. } => Some(*resistance),
            _ => None,
        }
    }

    /// Get component capacitance
    pub fn capacitance(&self) -> Option<f64> {
        match self {
            Self::Capacitor { capacitance, .. } => Some(*capacitance),
            _ => None,
        }
    }

    /// Get component inductance
    pub fn inductance(&self) -> Option<f64> {
        match self {
            Self::Inductor { inductance, .. } => Some(*inductance),
            _ => None,
        }
    }

    /// Calculate voltage drop across component given current
    pub fn voltage_drop(&self, current: f64) -> f64 {
        match self {
            Self::Resistor { resistance, .. } => current * resistance,
            Self::Ground { .. } => 0.0,
            _ => 0.0,
        }
    }

    /// Get current output for time-varying sources
    pub fn get_source_current(&self, time: f64) -> f64 {
        match self {
            Self::CurrentSource { current, frequency, phase, .. } => {
                if *frequency == 0.0 {
                    *current  // DC
                } else {
                    current * (2.0 * PI * frequency * time + phase).sin()
                }
            }
            _ => 0.0,
        }
    }

    /// Get voltage output for time-varying sources
    pub fn get_source_voltage(&self, time: f64) -> f64 {
        match self {
            Self::VoltageSource { voltage, frequency, phase, .. } => {
                if *frequency == 0.0 {
                    *voltage  // DC
                } else {
                    voltage * (2.0 * PI * frequency * time + phase).sin()
                }
            }
            _ => 0.0,
        }
    }

    /// Update component state based on computed values
    pub fn update_state(&mut self, voltage: f64, current: f64, dt: f64) {
        match self {
            Self::Capacitor { voltage: v, current: i, .. } => {
                *v = voltage;
                *i = current;
            }
            Self::Inductor { current: cur, voltage: v, .. } => {
                *cur = current;
                *v = voltage;
            }
            Self::Diode { current: c, .. } => {
                *c = current;
            }
            _ => {}
        }
    }
}

impl Node for ElectricalComponent {
    fn id(&self) -> NodeId {
        match self {
            Self::Resistor { id, .. } => *id,
            Self::Capacitor { id, .. } => *id,
            Self::Inductor { id, .. } => *id,
            Self::VoltageSource { id, .. } => *id,
            Self::CurrentSource { id, .. } => *id,
            Self::Ground { id, .. } => *id,
            Self::Diode { id, .. } => *id,
            Self::OpAmp { id, .. } => *id,
        }
    }

    fn node_type(&self) -> &str {
        self.component_type()
    }

    fn inputs(&self) -> &[Port] {
        // Electrical components have implicit two ports (+ and -)
        &[]
    }

    fn outputs(&self) -> &[Port] {
        &[]
    }

    fn inputs_mut(&mut self) -> &mut [Port] {
        &mut []
    }

    fn outputs_mut(&mut self) -> &mut [Port] {
        &mut []
    }

    fn compute(&mut self, _context: &crate::graph::node::ComputeContext) -> Result<(), String> {
        // Component-specific computation handled by MNA solver
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resistor_creation() {
        let r = ElectricalComponent::Resistor {
            id: NodeId::new(),
            resistance: 1000.0,
        };
        assert_eq!(r.component_type(), "resistor");
        assert_eq!(r.resistance(), Some(1000.0));
    }

    #[test]
    fn test_resistor_voltage_drop() {
        let r = ElectricalComponent::Resistor {
            id: NodeId::new(),
            resistance: 1000.0,
        };
        let v = r.voltage_drop(0.001);  // 1 mA
        assert!((v - 1.0).abs() < 0.0001);  // V = 1V
    }

    #[test]
    fn test_capacitor_creation() {
        let c = ElectricalComponent::Capacitor {
            id: NodeId::new(),
            capacitance: 10e-6,
            voltage: 0.0,
            current: 0.0,
        };
        assert_eq!(c.component_type(), "capacitor");
        assert_eq!(c.capacitance(), Some(10e-6));
    }

    #[test]
    fn test_voltage_source_dc() {
        let vs = ElectricalComponent::VoltageSource {
            id: NodeId::new(),
            voltage: 5.0,
            frequency: 0.0,
            phase: 0.0,
        };
        let v = vs.get_source_voltage(0.0);
        assert_eq!(v, 5.0);
    }

    #[test]
    fn test_voltage_source_ac() {
        let vs = ElectricalComponent::VoltageSource {
            id: NodeId::new(),
            voltage: 5.0,
            frequency: 1.0,  // 1 Hz
            phase: 0.0,
        };
        let v_at_0 = vs.get_source_voltage(0.0);
        assert!((v_at_0 - 0.0).abs() < 0.0001);  // sin(0) = 0

        let v_at_quarter = vs.get_source_voltage(0.25);  // Quarter period
        assert!((v_at_quarter - 5.0).abs() < 0.0001);  // sin(π/2) = 1
    }

    #[test]
    fn test_ground_voltage() {
        let g = ElectricalComponent::Ground {
            id: NodeId::new(),
        };
        assert_eq!(g.voltage_drop(1.0), 0.0);
    }
}
