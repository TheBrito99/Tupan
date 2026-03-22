//! Bond Graph Validation and Error Types

use serde::{Deserialize, Serialize};
use std::fmt;

use super::bond::BondId;
use super::element::ElementId;

/// Errors that can occur during bond graph operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CausalityError {
    /// Multiple sources providing effort on a 0-junction
    MultipleEffortSources {
        junction_id: ElementId,
        sources: Vec<ElementId>,
    },

    /// Multiple sources providing flow on a 1-junction
    MultipleFlowSources {
        junction_id: ElementId,
        sources: Vec<ElementId>,
    },

    /// Required causality assignment conflicts with element requirements
    CausalityConflict {
        element_id: ElementId,
        attempted_causality: String,
        reason: String,
    },

    /// Algebraic loop detected (unsolvable model)
    AlgebraicLoop {
        elements: Vec<ElementId>,
        description: String,
    },

    /// Storage element (C or I) forced into derivative causality
    DerivativeCausality {
        element_id: ElementId,
        element_type: String,
    },

    /// No valid causality assignment exists
    NoValidCausality {
        unassigned_bonds: Vec<BondId>,
    },

    /// Invalid model structure
    InvalidStructure(String),
}

impl fmt::Display for CausalityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CausalityError::MultipleEffortSources { junction_id, sources } => {
                write!(f, "Multiple effort sources on 0-junction {}: {:?}", junction_id, sources)
            }
            CausalityError::MultipleFlowSources { junction_id, sources } => {
                write!(f, "Multiple flow sources on 1-junction {}: {:?}", junction_id, sources)
            }
            CausalityError::CausalityConflict { element_id, attempted_causality, reason } => {
                write!(f, "Causality conflict at {}: {} - {}", element_id, attempted_causality, reason)
            }
            CausalityError::AlgebraicLoop { elements, description } => {
                write!(f, "Algebraic loop detected: {} (elements: {:?})", description, elements)
            }
            CausalityError::DerivativeCausality { element_id, element_type } => {
                write!(f, "Derivative causality forced on {} element {}", element_type, element_id)
            }
            CausalityError::NoValidCausality { unassigned_bonds } => {
                write!(f, "No valid causality assignment exists ({} unassigned bonds)", unassigned_bonds.len())
            }
            CausalityError::InvalidStructure(reason) => {
                write!(f, "Invalid bond graph structure: {}", reason)
            }
        }
    }
}

impl std::error::Error for CausalityError {}

/// Result type for causality operations
pub type ValidationResult<T> = Result<T, CausalityError>;

/// Statistics about causality assignment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CausalityStats {
    /// Number of bonds with assigned causality
    pub assigned_bonds: usize,

    /// Number of bonds still unassigned
    pub unassigned_bonds: usize,

    /// Number of elements with integral causality (preferred)
    pub integral_causality_elements: usize,

    /// Number of elements with derivative causality (should be avoided)
    pub derivative_causality_elements: usize,

    /// Number of causality conflicts detected
    pub conflicts: usize,

    /// True if model is acausal (solvable)
    pub is_acausal: bool,
}

impl CausalityStats {
    /// Create new statistics
    pub fn new() -> Self {
        CausalityStats {
            assigned_bonds: 0,
            unassigned_bonds: 0,
            integral_causality_elements: 0,
            derivative_causality_elements: 0,
            conflicts: 0,
            is_acausal: false,
        }
    }

    /// Check if all bonds are assigned
    pub fn is_complete(&self) -> bool {
        self.unassigned_bonds == 0
    }

    /// Percentage of bonds assigned
    pub fn assignment_percentage(&self) -> f32 {
        let total = self.assigned_bonds + self.unassigned_bonds;
        if total == 0 {
            0.0
        } else {
            (self.assigned_bonds as f32 / total as f32) * 100.0
        }
    }
}

impl Default for CausalityStats {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_causality_stats() {
        let mut stats = CausalityStats::new();
        stats.assigned_bonds = 8;
        stats.unassigned_bonds = 2;

        assert!(!stats.is_complete());
        assert_eq!(stats.assignment_percentage(), 80.0);
    }

    #[test]
    fn test_error_display() {
        let error = CausalityError::InvalidStructure("No sources".to_string());
        let msg = format!("{}", error);
        assert!(msg.contains("Invalid bond graph structure"));
    }
}
