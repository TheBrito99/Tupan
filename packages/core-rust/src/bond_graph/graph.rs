//! Bond Graph Structure
//!
//! Manages all bond graph elements and bonds, tracking topology
//! and causality assignment status.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use super::bond::{Bond, BondId, Causality};
use super::element::{BondGraphElement, ElementId};
use crate::error::{Result, TupanError};

/// Bond graph model containing all elements and bonds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BondGraph {
    /// All elements indexed by ID
    pub elements: HashMap<ElementId, BondGraphElement>,

    /// All bonds indexed by ID
    pub bonds: HashMap<BondId, Bond>,

    /// Adjacency list: for each element, list of bonds connected to it
    pub adjacency: HashMap<ElementId, Vec<BondId>>,

    /// Whether causality has been assigned
    pub causality_assigned: bool,

    /// State variable map: (ElementId, state_index) for storage elements
    /// Used to map C and I element charges/momenta to state vector indices
    pub state_map: Vec<(ElementId, StateVariableType)>,

    /// Name of the bond graph (for visualization/documentation)
    pub name: Option<String>,
}

/// Type of state variable for storage elements
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StateVariableType {
    /// Generalized displacement (q) for C elements: dq/dt = f
    Displacement,

    /// Generalized momentum (p) for I elements: dp/dt = e
    Momentum,
}

impl BondGraph {
    /// Create a new empty bond graph
    pub fn new() -> Self {
        BondGraph {
            elements: HashMap::new(),
            bonds: HashMap::new(),
            adjacency: HashMap::new(),
            causality_assigned: false,
            state_map: Vec::new(),
            name: None,
        }
    }

    /// Create with a name
    pub fn with_name(name: String) -> Self {
        BondGraph {
            name: Some(name),
            ..Default::default()
        }
    }

    /// Add an element to the bond graph
    pub fn add_element(&mut self, element: BondGraphElement) -> ElementId {
        let id = element.id();
        self.elements.insert(id, element);

        // Initialize adjacency list for this element
        if !self.adjacency.contains_key(&id) {
            self.adjacency.insert(id, Vec::new());
        }

        id
    }

    /// Get an element by ID
    pub fn get_element(&self, id: ElementId) -> Option<&BondGraphElement> {
        self.elements.get(&id)
    }

    /// Get a mutable reference to an element
    pub fn get_element_mut(&mut self, id: ElementId) -> Option<&mut BondGraphElement> {
        self.elements.get_mut(&id)
    }

    /// Remove an element and all connected bonds
    pub fn remove_element(&mut self, id: ElementId) -> Result<()> {
        if !self.elements.contains_key(&id) {
            return Err(TupanError::Unknown("Element not found".to_string()));
        }

        // Get all bonds connected to this element
        let bonds_to_remove: Vec<BondId> = self
            .adjacency
            .get(&id)
            .map(|bonds| bonds.clone())
            .unwrap_or_default();

        // Remove all connected bonds
        for bond_id in bonds_to_remove {
            if let Some(bond) = self.bonds.remove(&bond_id) {
                // Also remove from adjacency of the other element
                if let Some(other_bonds) = self.adjacency.get_mut(&bond.to) {
                    other_bonds.retain(|b| *b != bond_id);
                }
            }
        }

        // Remove the element itself
        self.elements.remove(&id);
        self.adjacency.remove(&id);

        Ok(())
    }

    /// Add a bond connecting two elements
    pub fn add_bond(&mut self, bond: Bond) -> Result<BondId> {
        // Verify both elements exist
        if !self.elements.contains_key(&bond.from) {
            return Err(TupanError::Unknown("Source element not found".to_string()));
        }
        if !self.elements.contains_key(&bond.to) {
            return Err(TupanError::Unknown("Target element not found".to_string()));
        }

        let bond_id = bond.id;

        // Add to bonds map
        self.bonds.insert(bond_id, bond.clone());

        // Add to adjacency lists
        self.adjacency
            .entry(bond.from)
            .or_insert_with(Vec::new)
            .push(bond_id);
        self.adjacency
            .entry(bond.to)
            .or_insert_with(Vec::new)
            .push(bond_id);

        Ok(bond_id)
    }

    /// Get a bond by ID
    pub fn get_bond(&self, id: BondId) -> Option<&Bond> {
        self.bonds.get(&id)
    }

    /// Get a mutable reference to a bond
    pub fn get_bond_mut(&mut self, id: BondId) -> Option<&mut Bond> {
        self.bonds.get_mut(&id)
    }

    /// Remove a bond
    pub fn remove_bond(&mut self, id: BondId) -> Result<()> {
        if let Some(bond) = self.bonds.remove(&id) {
            // Remove from adjacency lists
            if let Some(from_bonds) = self.adjacency.get_mut(&bond.from) {
                from_bonds.retain(|b| *b != id);
            }
            if let Some(to_bonds) = self.adjacency.get_mut(&bond.to) {
                to_bonds.retain(|b| *b != id);
            }
            Ok(())
        } else {
            Err(TupanError::Unknown("Bond not found".to_string()))
        }
    }

    /// Get all bonds connected to an element
    pub fn get_bonds_for_element(&self, element_id: ElementId) -> Vec<&Bond> {
        self.adjacency
            .get(&element_id)
            .iter()
            .flat_map(|bonds| bonds.iter().map(|bid| &self.bonds[bid]))
            .collect()
    }

    /// Get all elements
    pub fn get_elements(&self) -> Vec<&BondGraphElement> {
        self.elements.values().collect()
    }

    /// Get all bonds
    pub fn get_bonds(&self) -> Vec<&Bond> {
        self.bonds.values().collect()
    }

    /// Get number of elements
    pub fn num_elements(&self) -> usize {
        self.elements.len()
    }

    /// Get number of bonds
    pub fn num_bonds(&self) -> usize {
        self.bonds.len()
    }

    /// Check if causality is assigned
    pub fn is_causality_assigned(&self) -> bool {
        self.causality_assigned
    }

    /// Set causality assigned status
    pub fn set_causality_assigned(&mut self, assigned: bool) {
        self.causality_assigned = assigned;
    }

    /// Update state map for storage elements
    ///
    /// Should be called after successful causality assignment
    /// to prepare the state vector mapping for numerical integration
    pub fn build_state_map(&mut self) -> Result<()> {
        self.state_map.clear();

        for (element_id, element) in &self.elements {
            match element {
                BondGraphElement::C(_, _) => {
                    self.state_map.push((*element_id, StateVariableType::Displacement));
                }
                BondGraphElement::I(_, _) => {
                    self.state_map.push((*element_id, StateVariableType::Momentum));
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Validate that all bonds have assigned causality
    pub fn validate_causality(&self) -> Result<()> {
        for bond in self.bonds.values() {
            if !bond.causality.is_assigned() {
                return Err(TupanError::InvalidState(
                    format!("Bond {} has unassigned causality", bond.id),
                ));
            }
        }
        Ok(())
    }

    /// Get incoming bonds to an element (from perspective of from→to)
    pub fn get_incoming_bonds(&self, element_id: ElementId) -> Vec<&Bond> {
        self.bonds
            .values()
            .filter(|bond| bond.to == element_id)
            .collect()
    }

    /// Get outgoing bonds from an element (from perspective of from→to)
    pub fn get_outgoing_bonds(&self, element_id: ElementId) -> Vec<&Bond> {
        self.bonds
            .values()
            .filter(|bond| bond.from == element_id)
            .collect()
    }

    /// Get power balance for an element (sum of powers on all connected bonds)
    pub fn get_element_power_balance(&self, element_id: ElementId) -> f64 {
        self.bonds
            .values()
            .filter(|bond| bond.from == element_id || bond.to == element_id)
            .map(|bond| {
                if bond.from == element_id {
                    bond.power // Outgoing power
                } else {
                    -bond.power // Incoming power
                }
            })
            .sum()
    }

    /// Summary statistics about the bond graph
    pub fn summary(&self) -> String {
        let num_se = self.elements
            .values()
            .filter(|e| matches!(e, BondGraphElement::Se(_, _)))
            .count();

        let num_sf = self.elements
            .values()
            .filter(|e| matches!(e, BondGraphElement::Sf(_, _)))
            .count();

        let num_c = self.elements
            .values()
            .filter(|e| matches!(e, BondGraphElement::C(_, _)))
            .count();

        let num_i = self.elements
            .values()
            .filter(|e| matches!(e, BondGraphElement::I(_, _)))
            .count();

        let num_r = self.elements
            .values()
            .filter(|e| matches!(e, BondGraphElement::R(_, _)))
            .count();

        let num_j0 = self.elements
            .values()
            .filter(|e| matches!(e, BondGraphElement::Junction0(_, _)))
            .count();

        let num_j1 = self.elements
            .values()
            .filter(|e| matches!(e, BondGraphElement::Junction1(_, _)))
            .count();

        format!(
            "BondGraph: {} elements (Se:{}, Sf:{}, C:{}, I:{}, R:{}, J0:{}, J1:{}), {} bonds, causality_assigned:{}",
            self.num_elements(),
            num_se,
            num_sf,
            num_c,
            num_i,
            num_r,
            num_j0,
            num_j1,
            self.num_bonds(),
            self.causality_assigned
        )
    }
}

impl Default for BondGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::element::*;

    #[test]
    fn test_bond_graph_creation() {
        let bg = BondGraph::new();
        assert_eq!(bg.num_elements(), 0);
        assert_eq!(bg.num_bonds(), 0);
        assert!(!bg.is_causality_assigned());
    }

    #[test]
    fn test_add_element() {
        let mut bg = BondGraph::new();
        let se = BondGraphElement::Se(
            ElementId::new(),
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        );
        let id = bg.add_element(se.clone());

        assert_eq!(bg.num_elements(), 1);
        assert!(bg.get_element(id).is_some());
    }

    #[test]
    fn test_add_bond() {
        let mut bg = BondGraph::new();
        let id1 = bg.add_element(BondGraphElement::Se(
            ElementId::new(),
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));
        let id2 = bg.add_element(BondGraphElement::R(
            ElementId::new(),
            Resistor {
                resistance: 1000.0,
                variable_name: None,
            },
        ));

        let bond = Bond::new(id1, id2);
        let bond_id = bg.add_bond(bond).unwrap();

        assert_eq!(bg.num_bonds(), 1);
        assert!(bg.get_bond(bond_id).is_some());
    }

    #[test]
    fn test_element_removal() {
        let mut bg = BondGraph::new();
        let id = bg.add_element(BondGraphElement::Se(
            ElementId::new(),
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));

        assert_eq!(bg.num_elements(), 1);
        bg.remove_element(id).unwrap();
        assert_eq!(bg.num_elements(), 0);
    }
}
