//! Bond Graph Elements
//!
//! Defines the fundamental bond graph elements: sources, storage, dissipation,
//! transformers, gyrators, and junctions.
//!
//! All physical domains (electrical, thermal, mechanical, hydraulic, pneumatic)
//! map to these universal energy-based elements:
//! - Effort/Flow duality (voltage/current, temperature/heat, force/velocity, etc.)
//! - C: Capacitive storage (C, C_th, 1/k)
//! - I: Inertial storage (L, m)
//! - R: Resistive dissipation (R, R_th, b)
//! - Se/Sf: Energy sources
//! - TF/GY: Energy transformers
//! - 0-junctions: Common effort (Kirchhoff voltage law)
//! - 1-junctions: Common flow (Kirchhoff current law)

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a bond graph element
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ElementId(Uuid);

impl ElementId {
    /// Create a new unique element ID
    pub fn new() -> Self {
        ElementId(Uuid::new_v4())
    }

    /// Create from a string (for testing/serialization)
    pub fn from_string(s: &str) -> Self {
        ElementId(Uuid::parse_str(s).unwrap_or_else(|_| Uuid::new_v4()))
    }

    /// Get string representation
    pub fn as_str(&self) -> String {
        self.0.to_string()
    }
}

impl Default for ElementId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for ElementId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Effort sources (voltage, temperature, force, pressure)
///
/// Sources dictate causality: they always output their respective variable.
/// - Se outputs effort
/// - Sf outputs flow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffortSource {
    /// Constant effort value (e.g., 5V, 300K, 10N)
    pub effort: f64,

    /// Optional time-varying expression (not yet implemented)
    pub expression: Option<String>,
}

/// Flow sources (current, heat flow, velocity, volume flow rate)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowSource {
    /// Constant flow value (e.g., 1A, 100W, 5m/s)
    pub flow: f64,

    /// Optional time-varying expression (not yet implemented)
    pub expression: Option<String>,
}

/// Capacitive energy storage
///
/// Stores energy in a potential field (electric, thermal, elastic, etc.)
/// - Voltage across capacitor: V = q/C
/// - Heat stored in mass: E = m·c·T (C_thermal = m·c)
/// - Spring potential: E = (1/2)·k·x² (C = 1/k)
///
/// Integral causality (preferred): dq/dt = i (charge accumulation)
/// Derivative causality (avoid): e = L(di/dt) (not physical for C)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacitiveStorage {
    /// Capacitance value (F, J/K, m/N)
    pub capacitance: f64,

    /// Initial charge/displacement/energy (q₀)
    pub initial_displacement: f64,

    /// Variable name for documentation
    pub variable_name: Option<String>,
}

/// Inertial energy storage
///
/// Stores energy in kinetic motion (momentum field)
/// - Inductor: V = L(di/dt), momentum p = L·i
/// - Mass: F = m(dv/dt), momentum p = m·v
/// - Rotational: τ = I(dω/dt), momentum p = I·ω
///
/// Integral causality (preferred): dp/dt = f (momentum accumulation)
/// Derivative causality (avoid): f = m(dv/dt)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InertialStorage {
    /// Inertance value (H, kg, kg·m²)
    pub inertance: f64,

    /// Initial momentum (p₀ = m·v₀)
    pub initial_momentum: f64,

    /// Variable name for documentation
    pub variable_name: Option<String>,
}

/// Resistive dissipation
///
/// Dissipates energy proportional to flow
/// - Electrical resistor: V = I·R
/// - Thermal resistor: ΔT = Q̇·R_th
/// - Mechanical damper: F = b·v (viscous damping)
/// - Fluid resistance: ΔP = Q·R (laminar pipe flow)
///
/// Can accept either causality:
/// - Effort in: effort_out = effort_in (for constant resistance)
/// - Flow in: flow_out = flow_in (trivial, no computation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resistor {
    /// Resistance value (Ω, K/W, N·s/m, Pa·s/m³)
    pub resistance: f64,

    /// Variable name for documentation
    pub variable_name: Option<String>,
}

/// Transformer (ideal, non-dissipative power transformation)
///
/// Transforms effort and flow with constant ratio:
/// - e₂ = n·e₁
/// - f₂ = f₁/n (power conserving: e₁·f₁ = e₂·f₂)
///
/// Examples:
/// - Electrical transformer: e = V, f = I, n = turns ratio
/// - Lever: e = Force, f = velocity, n = length ratio
/// - Gear: e = torque, f = angular velocity, n = tooth ratio
/// - Thermal converter: NOT typically modeled as TF (use GY instead)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transformer {
    /// Transformation ratio (dimensionless)
    pub ratio: f64,

    /// Variable name for documentation
    pub variable_name: Option<String>,
}

/// Gyrator (effort↔flow transformer)
///
/// Transforms effort to flow and vice versa:
/// - e₂ = r·f₁
/// - f₂ = e₁/r (power conserving: e₁·f₁ = e₂·f₂)
///
/// Examples:
/// - Motor/Generator: electrical↔mechanical
/// - Pump: mechanical↔hydraulic
/// - Loudspeaker: electrical↔acoustical
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gyrator {
    /// Gyration ratio (has units, e.g., V·s/m for motor)
    pub ratio: f64,

    /// Variable name for documentation
    pub variable_name: Option<String>,
}

/// Junction 0: Common Effort node
///
/// Kirchhoff voltage law for electrical, isothermal for thermal, etc.
/// - All bonds connected to a 0-junction have the same effort
/// - Sum of flows equals zero: Σf = 0
/// - Exactly ONE bond provides effort (EffortOut), others receive it (FlowOut)
/// - Multiple bonds can provide flow (FlowOut from other elements)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Junction0 {
    /// Display name for visualization
    pub name: Option<String>,
}

/// Junction 1: Common Flow node
///
/// Kirchhoff current law for electrical, common flow for thermal, etc.
/// - All bonds connected to a 1-junction have the same flow
/// - Sum of efforts equals zero: Σe = 0
/// - Exactly ONE bond provides flow (FlowOut), others receive it (EffortOut)
/// - Multiple bonds can provide effort (EffortOut from other elements)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Junction1 {
    /// Display name for visualization
    pub name: Option<String>,
}

/// All bond graph element types
///
/// This enum represents the complete set of bond graph elements.
/// The design ensures that all physical domains can be represented
/// using this universal language.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BondGraphElement {
    /// Effort source: generates voltage, temperature, force, pressure
    Se(ElementId, EffortSource),

    /// Flow source: generates current, heat, velocity, volume flow
    Sf(ElementId, FlowSource),

    /// Capacitive storage: capacitor, thermal mass, spring, accumulator
    C(ElementId, CapacitiveStorage),

    /// Inertial storage: inductor, mass, rotational inertia
    I(ElementId, InertialStorage),

    /// Resistor: electrical R, thermal R_th, mechanical damper
    R(ElementId, Resistor),

    /// Transformer: ideal voltage/current transformer, lever, gear
    TF(ElementId, Transformer),

    /// Gyrator: motor/generator, pump, loudspeaker
    GY(ElementId, Gyrator),

    /// Junction 0: common effort (equipotential, isothermal, etc.)
    Junction0(ElementId, Junction0),

    /// Junction 1: common flow (series connection, common current, etc.)
    Junction1(ElementId, Junction1),
}

impl BondGraphElement {
    /// Get the element ID
    pub fn id(&self) -> ElementId {
        match self {
            BondGraphElement::Se(id, _)
            | BondGraphElement::Sf(id, _)
            | BondGraphElement::C(id, _)
            | BondGraphElement::I(id, _)
            | BondGraphElement::R(id, _)
            | BondGraphElement::TF(id, _)
            | BondGraphElement::GY(id, _)
            | BondGraphElement::Junction0(id, _)
            | BondGraphElement::Junction1(id, _) => *id,
        }
    }

    /// Get element type name
    pub fn element_type(&self) -> &str {
        match self {
            BondGraphElement::Se(_, _) => "Se",
            BondGraphElement::Sf(_, _) => "Sf",
            BondGraphElement::C(_, _) => "C",
            BondGraphElement::I(_, _) => "I",
            BondGraphElement::R(_, _) => "R",
            BondGraphElement::TF(_, _) => "TF",
            BondGraphElement::GY(_, _) => "GY",
            BondGraphElement::Junction0(_, _) => "0",
            BondGraphElement::Junction1(_, _) => "1",
        }
    }

    /// Check if element is a source (Se or Sf)
    pub fn is_source(&self) -> bool {
        matches!(self, BondGraphElement::Se(_, _) | BondGraphElement::Sf(_, _))
    }

    /// Check if element is storage (C or I)
    pub fn is_storage(&self) -> bool {
        matches!(self, BondGraphElement::C(_, _) | BondGraphElement::I(_, _))
    }

    /// Check if element is a junction (0 or 1)
    pub fn is_junction(&self) -> bool {
        matches!(self, BondGraphElement::Junction0(_, _) | BondGraphElement::Junction1(_, _))
    }

    /// Check if element is resistive
    pub fn is_resistor(&self) -> bool {
        matches!(self, BondGraphElement::R(_, _))
    }

    /// Check if element is a transformer
    pub fn is_transformer(&self) -> bool {
        matches!(self, BondGraphElement::TF(_, _))
    }

    /// Check if element is a gyrator
    pub fn is_gyrator(&self) -> bool {
        matches!(self, BondGraphElement::GY(_, _))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_element_id_creation() {
        let id1 = ElementId::new();
        let id2 = ElementId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_element_type_identification() {
        let effort_source = BondGraphElement::Se(
            ElementId::new(),
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        );

        assert!(effort_source.is_source());
        assert!(!effort_source.is_storage());
        assert!(!effort_source.is_junction());
        assert_eq!(effort_source.element_type(), "Se");
    }

    #[test]
    fn test_capacitor_creation() {
        let capacitor = BondGraphElement::C(
            ElementId::new(),
            CapacitiveStorage {
                capacitance: 1e-6,
                initial_displacement: 0.0,
                variable_name: Some("C1".to_string()),
            },
        );

        assert!(capacitor.is_storage());
        assert!(!capacitor.is_source());
        assert_eq!(capacitor.element_type(), "C");
    }

    #[test]
    fn test_junction_recognition() {
        let junc0 = BondGraphElement::Junction0(
            ElementId::new(),
            Junction0 {
                name: Some("Node1".to_string()),
            },
        );

        assert!(junc0.is_junction());
        assert!(!junc0.is_storage());
        assert!(!junc0.is_source());
        assert_eq!(junc0.element_type(), "0");
    }
}
