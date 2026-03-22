//! Bond Graph Bonds
//!
//! Bonds connect bond graph elements and carry power in the form of
//! effort (e) and flow (f) variables. Causality on bonds determines
//! the computational structure of the model.
//!
//! Power transmitted = e × f
//!
//! Causality must be assigned systematically using the SCAP algorithm
//! to ensure a valid, solvable model.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::element::ElementId;

/// Unique identifier for a bond
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BondId(Uuid);

impl BondId {
    /// Create a new unique bond ID
    pub fn new() -> Self {
        BondId(Uuid::new_v4())
    }

    /// Create from string (for testing/serialization)
    pub fn from_string(s: &str) -> Self {
        BondId(Uuid::parse_str(s).unwrap_or_else(|_| Uuid::new_v4()))
    }

    /// Get string representation
    pub fn as_str(&self) -> String {
        self.0.to_string()
    }
}

impl Default for BondId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for BondId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Causality assignment on a bond
///
/// Causality determines which element computes which variable:
/// - EffortOut: The "from" element computes effort, "to" element computes flow
/// - FlowOut: The "from" element computes flow, "to" element computes effort
///
/// Causality must be assigned systematically to create a valid model.
/// The SCAP algorithm ensures this.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Causality {
    /// Causality not yet assigned
    Unassigned,

    /// From element outputs effort, to element inputs effort (outputs flow)
    /// Indicates: e_to = f(e_from, ...), f_from = f(...)
    EffortOut,

    /// From element outputs flow, to element inputs flow (outputs effort)
    /// Indicates: f_to = f(f_from, ...), e_from = f(...)
    FlowOut,
}

impl Causality {
    /// Check if causality is assigned
    pub fn is_assigned(&self) -> bool {
        !matches!(self, Causality::Unassigned)
    }

    /// Check if causality is effort out
    pub fn is_effort_out(&self) -> bool {
        matches!(self, Causality::EffortOut)
    }

    /// Check if causality is flow out
    pub fn is_flow_out(&self) -> bool {
        matches!(self, Causality::FlowOut)
    }

    /// Reverse causality (for bidirectional bonds)
    pub fn reverse(&self) -> Causality {
        match self {
            Causality::Unassigned => Causality::Unassigned,
            Causality::EffortOut => Causality::FlowOut,
            Causality::FlowOut => Causality::EffortOut,
        }
    }
}

impl std::fmt::Display for Causality {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Causality::Unassigned => write!(f, "Unassigned"),
            Causality::EffortOut => write!(f, "EffortOut"),
            Causality::FlowOut => write!(f, "FlowOut"),
        }
    }
}

/// A bond connecting two elements
///
/// Bonds are directed and carry two variables: effort (e) and flow (f).
/// The causality on the bond determines computation order.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bond {
    /// Unique identifier for this bond
    pub id: BondId,

    /// Source element
    pub from: ElementId,

    /// Target element
    pub to: ElementId,

    /// Current causality assignment
    pub causality: Causality,

    /// Current effort value (e.g., voltage, temperature, force)
    pub effort: f64,

    /// Current flow value (e.g., current, heat flow, velocity)
    pub flow: f64,

    /// Power transmitted (e × f)
    /// Positive: power flows from "from" to "to"
    /// Negative: power flows from "to" to "from"
    pub power: f64,

    /// Optional label for visualization/documentation
    pub label: Option<String>,
}

impl Bond {
    /// Create a new unassigned bond
    pub fn new(from: ElementId, to: ElementId) -> Self {
        Bond {
            id: BondId::new(),
            from,
            to,
            causality: Causality::Unassigned,
            effort: 0.0,
            flow: 0.0,
            power: 0.0,
            label: None,
        }
    }

    /// Update effort and flow values and recompute power
    pub fn set_variables(&mut self, effort: f64, flow: f64) {
        self.effort = effort;
        self.flow = flow;
        self.power = effort * flow;
    }

    /// Get power transmitted through this bond
    pub fn compute_power(&mut self) {
        self.power = self.effort * self.flow;
    }

    /// Set causality and return self for chaining
    pub fn with_causality(mut self, causality: Causality) -> Self {
        self.causality = causality;
        self
    }

    /// Set label and return self for chaining
    pub fn with_label(mut self, label: String) -> Self {
        self.label = Some(label);
        self
    }

    /// Check if causality is assigned
    pub fn is_causality_assigned(&self) -> bool {
        self.causality.is_assigned()
    }

    /// Get causality from the perspective of a specific element
    ///
    /// If you're at the "from" element:
    /// - EffortOut means you output effort (input flow)
    /// - FlowOut means you output flow (input effort)
    ///
    /// If you're at the "to" element:
    /// - EffortOut means you input effort (output flow)
    /// - FlowOut means you input flow (output effort)
    pub fn causality_at(&self, element: ElementId) -> Option<Causality> {
        match self.causality {
            Causality::Unassigned => None,
            causality if element == self.from => Some(causality),
            causality if element == self.to => Some(causality.reverse()),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bond_creation() {
        let id1 = ElementId::new();
        let id2 = ElementId::new();
        let bond = Bond::new(id1, id2);

        assert_eq!(bond.from, id1);
        assert_eq!(bond.to, id2);
        assert_eq!(bond.causality, Causality::Unassigned);
        assert_eq!(bond.power, 0.0);
    }

    #[test]
    fn test_causality_reversal() {
        assert_eq!(Causality::EffortOut.reverse(), Causality::FlowOut);
        assert_eq!(Causality::FlowOut.reverse(), Causality::EffortOut);
        assert_eq!(Causality::Unassigned.reverse(), Causality::Unassigned);
    }

    #[test]
    fn test_power_calculation() {
        let mut bond = Bond::new(ElementId::new(), ElementId::new());
        bond.set_variables(5.0, 2.0); // e=5V, f=2A → P=10W

        assert_eq!(bond.effort, 5.0);
        assert_eq!(bond.flow, 2.0);
        assert_eq!(bond.power, 10.0);
    }

    #[test]
    fn test_causality_at_element() {
        let id1 = ElementId::new();
        let id2 = ElementId::new();
        let bond = Bond::new(id1, id2).with_causality(Causality::EffortOut);

        // From id1's perspective: EffortOut
        assert_eq!(bond.causality_at(id1), Some(Causality::EffortOut));

        // From id2's perspective: FlowOut (reversed)
        assert_eq!(bond.causality_at(id2), Some(Causality::FlowOut));
    }

    #[test]
    fn test_builder_pattern() {
        let id1 = ElementId::new();
        let id2 = ElementId::new();
        let bond = Bond::new(id1, id2)
            .with_causality(Causality::EffortOut)
            .with_label("V1".to_string());

        assert_eq!(bond.causality, Causality::EffortOut);
        assert_eq!(bond.label, Some("V1".to_string()));
    }
}
