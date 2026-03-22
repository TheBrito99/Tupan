//! Electrical Circuit to Bond Graph Converter
//!
//! Converts electrical circuits to bond graphs using effort-flow mapping:
//! - **Effort**: Voltage [V]
//! - **Flow**: Current [A]
//! - **Power**: P = V × I
//!
//! # Element Mapping
//!
//! | Component | Bond Graph | Parameter | Notes |
//! |-----------|------------|-----------|-------|
//! | Resistor | R (effort out) | R [Ω] | Dissipates energy |
//! | Capacitor | C (effort in) | C [F] | Stores charge: Q = C×V |
//! | Inductor | I (flow in) | L [H] | Stores flux: Φ = L×I |
//! | V-Source | Se (effort out) | V [V] | Drives voltage |
//! | I-Source | Sf (flow out) | I [A] | Drives current |
//! | Ideal Wire | 1-junction | - | Common current (series) |
//! | Node | 0-junction | - | Common voltage (parallel) |
//!
//! # Conversion Process
//!
//! 1. Create voltage nodes → 0-junctions
//! 2. Add components as bond graph elements
//! 3. Connect via 1-junctions (series) or directly (parallel via 0-junction)
//! 4. Assign causality using SCAP algorithm

use crate::bond_graph::{BondGraph, BondGraphElement, Bond, CausalityAssigner};
use crate::domains::PhysicalDomain;
use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Electrical circuit component types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ElectricalComponentType {
    Resistor,
    Capacitor,
    Inductor,
    VoltageSource,
    CurrentSource,
    Wire,
}

impl std::fmt::Display for ElectricalComponentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Resistor => write!(f, "Resistor"),
            Self::Capacitor => write!(f, "Capacitor"),
            Self::Inductor => write!(f, "Inductor"),
            Self::VoltageSource => write!(f, "VoltageSource"),
            Self::CurrentSource => write!(f, "CurrentSource"),
            Self::Wire => write!(f, "Wire"),
        }
    }
}

/// Electrical component description
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElectricalComponent {
    pub component_type: ElectricalComponentType,
    pub positive_node: usize,
    pub negative_node: usize,
    /// Component value (R in Ω, C in F, L in H, V in V, I in A)
    pub value: f64,
    pub label: Option<String>,
}

/// Electrical circuit (collection of components and nodes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElectricalCircuit {
    pub name: String,
    pub components: Vec<ElectricalComponent>,
    pub num_nodes: usize,
    pub ground_node: usize,  // Node 0 is ground by convention
}

impl ElectricalCircuit {
    /// Create new electrical circuit
    pub fn new(name: &str, num_nodes: usize) -> Self {
        ElectricalCircuit {
            name: name.to_string(),
            components: Vec::new(),
            num_nodes,
            ground_node: 0,
        }
    }

    /// Add resistor between two nodes
    pub fn add_resistor(&mut self, positive: usize, negative: usize, resistance: f64) -> Result<()> {
        self.validate_nodes(positive, negative)?;
        self.components.push(ElectricalComponent {
            component_type: ElectricalComponentType::Resistor,
            positive_node: positive,
            negative_node: negative,
            value: resistance,
            label: None,
        });
        Ok(())
    }

    /// Add capacitor between two nodes
    pub fn add_capacitor(&mut self, positive: usize, negative: usize, capacitance: f64) -> Result<()> {
        self.validate_nodes(positive, negative)?;
        self.components.push(ElectricalComponent {
            component_type: ElectricalComponentType::Capacitor,
            positive_node: positive,
            negative_node: negative,
            value: capacitance,
            label: None,
        });
        Ok(())
    }

    /// Add inductor between two nodes
    pub fn add_inductor(&mut self, positive: usize, negative: usize, inductance: f64) -> Result<()> {
        self.validate_nodes(positive, negative)?;
        self.components.push(ElectricalComponent {
            component_type: ElectricalComponentType::Inductor,
            positive_node: positive,
            negative_node: negative,
            value: inductance,
            label: None,
        });
        Ok(())
    }

    /// Add voltage source between two nodes
    pub fn add_voltage_source(&mut self, positive: usize, negative: usize, voltage: f64) -> Result<()> {
        self.validate_nodes(positive, negative)?;
        self.components.push(ElectricalComponent {
            component_type: ElectricalComponentType::VoltageSource,
            positive_node: positive,
            negative_node: negative,
            value: voltage,
            label: None,
        });
        Ok(())
    }

    /// Add current source between two nodes
    pub fn add_current_source(&mut self, positive: usize, negative: usize, current: f64) -> Result<()> {
        self.validate_nodes(positive, negative)?;
        self.components.push(ElectricalComponent {
            component_type: ElectricalComponentType::CurrentSource,
            positive_node: positive,
            negative_node: negative,
            value: current,
            label: None,
        });
        Ok(())
    }

    /// Validate node indices
    fn validate_nodes(&self, positive: usize, negative: usize) -> Result<()> {
        if positive >= self.num_nodes || negative >= self.num_nodes {
            return Err(crate::error::TupanError::InvalidState(
                format!("Node indices out of range (0-{})", self.num_nodes - 1),
            ));
        }
        if positive == negative {
            return Err(crate::error::TupanError::InvalidState(
                "Component endpoints must be different nodes".to_string(),
            ));
        }
        Ok(())
    }

    /// Check for floating nodes (isolated nodes)
    pub fn has_floating_nodes(&self) -> bool {
        let mut connected = vec![false; self.num_nodes];
        connected[self.ground_node] = true;  // Ground is always connected

        for comp in &self.components {
            connected[comp.positive_node] = true;
            connected[comp.negative_node] = true;
        }

        connected.iter().any(|&c| !c)
    }
}

/// Electrical circuit to bond graph converter
pub struct ElectricalConverter {
    circuit: ElectricalCircuit,
}

impl ElectricalConverter {
    /// Create converter for an electrical circuit
    pub fn new(circuit: ElectricalCircuit) -> Self {
        ElectricalConverter { circuit }
    }

    /// Convert electrical circuit to bond graph
    ///
    /// Algorithm:
    /// 1. Create 0-junctions for each node (represent voltage nodes)
    /// 2. Add components between junctions
    /// 3. Assign causality using SCAP
    pub fn convert(&self) -> Result<BondGraph> {
        // Validate structure
        if self.circuit.has_floating_nodes() {
            return Err(crate::error::TupanError::InvalidState(
                "Circuit has floating nodes".to_string(),
            ));
        }

        let mut bg = BondGraph::with_name(format!("Electrical: {}", self.circuit.name));

        // Create 0-junctions for each voltage node (including ground as reference)
        let mut node_to_junction = HashMap::new();
        for node_idx in 0..self.circuit.num_nodes {
            let junction_id = crate::bond_graph::element::ElementId::new();
            bg.add_element(BondGraphElement::Junction0(
                junction_id,
                crate::bond_graph::element::Junction0 { name: Some(format!("Node{}", node_idx)) },
            ));
            node_to_junction.insert(node_idx, junction_id);
        }

        // Convert each component
        for (idx, comp) in self.circuit.components.iter().enumerate() {
            self.convert_component(&mut bg, comp, idx, &node_to_junction)?;
        }

        // Assign causality
        CausalityAssigner::assign_causality(&mut bg)
            .map_err(|e| crate::error::TupanError::InvalidState(format!("Causality error: {:?}", e)))?;

        Ok(bg)
    }

    /// Convert individual component to bond graph
    fn convert_component(
        &self,
        bg: &mut BondGraph,
        comp: &ElectricalComponent,
        idx: usize,
        node_to_junction: &HashMap<usize, crate::bond_graph::element::ElementId>,
    ) -> Result<()> {
        use crate::bond_graph::element::{ElementId, Resistor, CapacitiveStorage, InertialStorage, EffortSource, FlowSource};

        let pos_junction = node_to_junction.get(&comp.positive_node).copied();
        let neg_junction = node_to_junction.get(&comp.negative_node).copied();

        match comp.component_type {
            ElectricalComponentType::Resistor => {
                let r_id = ElementId::new();
                bg.add_element(BondGraphElement::R(
                    r_id,
                    Resistor {
                        resistance: comp.value,
                        variable_name: comp.label.clone().or_else(|| Some(format!("R{}", idx))),
                    },
                ));

                // Connect resistor between junctions
                if let (Some(pos), Some(neg)) = (pos_junction, neg_junction) {
                    bg.add_bond(Bond::new(pos, r_id))?;
                    bg.add_bond(Bond::new(r_id, neg))?;
                }
            }
            ElectricalComponentType::Capacitor => {
                let c_id = ElementId::new();
                bg.add_element(BondGraphElement::C(
                    c_id,
                    CapacitiveStorage {
                        capacitance: comp.value,
                        initial_displacement: 0.0,
                        variable_name: comp.label.clone().or_else(|| Some(format!("C{}", idx))),
                    },
                ));

                // Connect capacitor between junctions
                if let (Some(pos), Some(neg)) = (pos_junction, neg_junction) {
                    bg.add_bond(Bond::new(pos, c_id))?;
                    bg.add_bond(Bond::new(c_id, neg))?;
                }
            }
            ElectricalComponentType::Inductor => {
                let l_id = ElementId::new();
                bg.add_element(BondGraphElement::I(
                    l_id,
                    InertialStorage {
                        inertance: comp.value,
                        initial_momentum: 0.0,
                        variable_name: comp.label.clone().or_else(|| Some(format!("L{}", idx))),
                    },
                ));

                // Connect inductor between junctions
                if let (Some(pos), Some(neg)) = (pos_junction, neg_junction) {
                    bg.add_bond(Bond::new(pos, l_id))?;
                    bg.add_bond(Bond::new(l_id, neg))?;
                }
            }
            ElectricalComponentType::VoltageSource => {
                let se_id = ElementId::new();
                bg.add_element(BondGraphElement::Se(
                    se_id,
                    EffortSource {
                        effort: comp.value,
                        expression: comp.label.clone(),
                    },
                ));

                // Connect voltage source between junctions
                if let (Some(pos), Some(neg)) = (pos_junction, neg_junction) {
                    bg.add_bond(Bond::new(se_id, pos))?;
                    bg.add_bond(Bond::new(neg, se_id))?;
                }
            }
            ElectricalComponentType::CurrentSource => {
                let sf_id = ElementId::new();
                bg.add_element(BondGraphElement::Sf(
                    sf_id,
                    FlowSource {
                        flow: comp.value,
                        expression: comp.label.clone(),
                    },
                ));

                // Connect current source between junctions
                if let (Some(pos), Some(neg)) = (pos_junction, neg_junction) {
                    bg.add_bond(Bond::new(sf_id, pos))?;
                    bg.add_bond(Bond::new(neg, sf_id))?;
                }
            }
            ElectricalComponentType::Wire => {
                // Wire connects two nodes directly (via 1-junction for series)
                if let (Some(pos), Some(neg)) = (pos_junction, neg_junction) {
                    let wire_id = ElementId::new();
                    bg.add_element(BondGraphElement::Junction1(
                        wire_id,
                        crate::bond_graph::element::Junction1 { name: Some(format!("Wire{}", idx)) },
                    ));
                    bg.add_bond(Bond::new(pos, wire_id))?;
                    bg.add_bond(Bond::new(wire_id, neg))?;
                }
            }
        }

        Ok(())
    }
}

/// Implement PhysicalDomain for electrical circuits
impl PhysicalDomain for ElectricalCircuit {
    fn domain_name(&self) -> &str {
        "Electrical"
    }

    fn effort_variable(&self) -> &str {
        "Voltage"
    }

    fn flow_variable(&self) -> &str {
        "Current"
    }

    fn effort_unit(&self) -> &str {
        "V"
    }

    fn flow_unit(&self) -> &str {
        "A"
    }

    fn to_bond_graph(&self) -> Result<BondGraph> {
        ElectricalConverter::new(self.clone()).convert()
    }

    fn validate_structure(&self) -> Result<()> {
        if self.components.is_empty() {
            return Err(crate::error::TupanError::InvalidState(
                "Circuit must have at least one component".to_string(),
            ));
        }

        if self.has_floating_nodes() {
            return Err(crate::error::TupanError::InvalidState(
                "Circuit has floating nodes (except ground)".to_string(),
            ));
        }

        Ok(())
    }

    fn metadata(&self) -> Vec<(String, String)> {
        vec![
            ("num_nodes".to_string(), self.num_nodes.to_string()),
            ("num_components".to_string(), self.components.len().to_string()),
            ("ground_node".to_string(), self.ground_node.to_string()),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_circuit() {
        let circuit = ElectricalCircuit::new("RC Filter", 2);
        assert_eq!(circuit.name, "RC Filter");
        assert_eq!(circuit.num_nodes, 2);
        assert_eq!(circuit.ground_node, 0);
    }

    #[test]
    fn test_add_resistor() {
        let mut circuit = ElectricalCircuit::new("Test", 3);
        let result = circuit.add_resistor(1, 0, 1000.0);
        assert!(result.is_ok());
        assert_eq!(circuit.components.len(), 1);
    }

    #[test]
    fn test_add_capacitor() {
        let mut circuit = ElectricalCircuit::new("Test", 3);
        let result = circuit.add_capacitor(1, 0, 1e-6);
        assert!(result.is_ok());
        assert_eq!(circuit.components.len(), 1);
    }

    #[test]
    fn test_add_inductor() {
        let mut circuit = ElectricalCircuit::new("Test", 3);
        let result = circuit.add_inductor(1, 0, 0.001);
        assert!(result.is_ok());
        assert_eq!(circuit.components.len(), 1);
    }

    #[test]
    fn test_invalid_nodes() {
        let mut circuit = ElectricalCircuit::new("Test", 2);
        // Node index 5 is out of range
        let result = circuit.add_resistor(5, 0, 1000.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_same_node_error() {
        let mut circuit = ElectricalCircuit::new("Test", 3);
        // Can't connect component to same node on both sides
        let result = circuit.add_resistor(1, 1, 1000.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_rc_circuit() -> Result<()> {
        let mut circuit = ElectricalCircuit::new("RC", 3);
        // Voltage source between node 2 and ground
        circuit.add_voltage_source(2, 0, 5.0)?;
        // Resistor between node 2 and node 1
        circuit.add_resistor(2, 1, 1000.0)?;
        // Capacitor between node 1 and ground
        circuit.add_capacitor(1, 0, 1e-6)?;

        // Convert to bond graph
        let bg = circuit.to_bond_graph()?;

        // Should have elements and bonds
        assert!(bg.num_elements() > 0);
        assert!(bg.num_bonds() > 0);
        assert!(bg.causality_assigned);

        Ok(())
    }

    #[test]
    fn test_simple_resistor_circuit() -> Result<()> {
        let mut circuit = ElectricalCircuit::new("Simple Resistor", 2);
        circuit.add_voltage_source(1, 0, 5.0)?;
        circuit.add_resistor(1, 0, 1000.0)?;

        let bg = circuit.to_bond_graph()?;
        assert!(bg.num_elements() > 0);
        assert!(bg.causality_assigned);

        Ok(())
    }

    #[test]
    fn test_rl_circuit() -> Result<()> {
        let mut circuit = ElectricalCircuit::new("RL", 2);
        circuit.add_voltage_source(1, 0, 5.0)?;
        circuit.add_resistor(1, 0, 100.0)?;
        circuit.add_inductor(1, 0, 0.01)?;

        let bg = circuit.to_bond_graph()?;
        assert!(bg.num_elements() > 0);
        assert!(bg.causality_assigned);

        Ok(())
    }

    #[test]
    fn test_floating_node_detection() {
        let mut circuit = ElectricalCircuit::new("Floating Node", 4);
        // Add component only between nodes 1-2, leaving nodes 3 floating
        let _ = circuit.add_resistor(1, 2, 100.0);

        assert!(circuit.has_floating_nodes());
    }

    #[test]
    fn test_validate_structure() {
        let empty_circuit = ElectricalCircuit::new("Empty", 2);
        let result = empty_circuit.validate_structure();
        assert!(result.is_err());  // No components
    }

    #[test]
    fn test_physical_domain_trait() {
        let mut circuit = ElectricalCircuit::new("Test", 2);
        let _ = circuit.add_voltage_source(1, 0, 5.0);
        let _ = circuit.add_resistor(1, 0, 1000.0);

        assert_eq!(circuit.domain_name(), "Electrical");
        assert_eq!(circuit.effort_variable(), "Voltage");
        assert_eq!(circuit.flow_variable(), "Current");
        assert_eq!(circuit.effort_unit(), "V");
        assert_eq!(circuit.flow_unit(), "A");

        let metadata = circuit.metadata();
        assert!(!metadata.is_empty());
    }

    #[test]
    fn test_multisource_circuit() -> Result<()> {
        let mut circuit = ElectricalCircuit::new("Dual Source", 3);
        circuit.add_voltage_source(1, 0, 5.0)?;
        circuit.add_voltage_source(2, 0, 3.0)?;
        circuit.add_resistor(1, 2, 100.0)?;

        let bg = circuit.to_bond_graph()?;
        assert!(bg.causality_assigned);

        Ok(())
    }
}
