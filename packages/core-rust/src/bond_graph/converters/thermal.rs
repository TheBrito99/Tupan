//! Thermal Circuit to Bond Graph Converter
//!
//! Converts thermal networks to bond graphs using effort-flow mapping:
//! - **Effort**: Temperature [K]
//! - **Flow**: Heat flow [W]
//! - **Power**: P = T × Q̇ (temperature × heat flow rate)
//!
//! # Element Mapping
//!
//! | Component | Bond Graph | Parameter | Notes |
//! |-----------|------------|-----------|-------|
//! | Thermal Resistance | R (effort out) | R_th [K/W] | Dissipates heat |
//! | Thermal Mass | C (effort in) | C_th [J/K] | Stores heat: Q = C×T |
//! | Heat Source | Se (effort out) | T [K] | Drives temperature |
//! | Heat Flow Source | Sf (flow out) | Q̇ [W] | Drives heat flow |
//! | Thermal Node | 0-junction | - | Isothermal point |
//!
//! # Conversion Process
//!
//! 1. Create 0-junctions for each temperature node
//! 2. Add thermal components as bond graph elements
//! 3. Connect via junctions
//! 4. Assign causality using SCAP algorithm
//!
//! # Physical Interpretation
//!
//! A 0-junction represents an isothermal node (all connected points have same temperature).
//! Components in parallel (connected to same two nodes) are naturally handled through
//! the 0-junction junction topology.

use crate::bond_graph::{BondGraph, BondGraphElement, Bond, CausalityAssigner};
use crate::domains::PhysicalDomain;
use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Thermal component types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThermalComponentType {
    /// Thermal resistance (conduction, convection, radiation)
    Resistance,
    /// Thermal capacitance (mass × specific heat)
    Capacitance,
    /// Temperature source (fixed temperature boundary condition)
    TemperatureSource,
    /// Heat flow source (fixed heat input/output)
    HeatFlowSource,
}

impl std::fmt::Display for ThermalComponentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Resistance => write!(f, "Resistance"),
            Self::Capacitance => write!(f, "Capacitance"),
            Self::TemperatureSource => write!(f, "TemperatureSource"),
            Self::HeatFlowSource => write!(f, "HeatFlowSource"),
        }
    }
}

/// Thermal component description
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalComponent {
    pub component_type: ThermalComponentType,
    /// Node index for hot side
    pub hot_node: usize,
    /// Node index for cold side (typically ground/ambient at 0K reference)
    pub cold_node: usize,
    /// Component value (R_th in K/W, C_th in J/K, T in K, Q̇ in W)
    pub value: f64,
    pub label: Option<String>,
}

/// Thermal network (collection of components and nodes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalNetwork {
    pub name: String,
    pub components: Vec<ThermalComponent>,
    pub num_nodes: usize,
    /// Reference node (ground) - typically ambient environment
    pub ambient_node: usize,
}

impl ThermalNetwork {
    /// Create new thermal network
    pub fn new(name: &str, num_nodes: usize) -> Self {
        ThermalNetwork {
            name: name.to_string(),
            components: Vec::new(),
            num_nodes,
            ambient_node: 0,  // Node 0 is ambient by convention
        }
    }

    /// Add thermal resistance between two nodes
    /// R_th = ΔT / Q̇ where ΔT is temperature difference, Q̇ is heat flow
    pub fn add_resistance(&mut self, hot: usize, cold: usize, r_thermal: f64) -> Result<()> {
        self.validate_nodes(hot, cold)?;
        self.components.push(ThermalComponent {
            component_type: ThermalComponentType::Resistance,
            hot_node: hot,
            cold_node: cold,
            value: r_thermal,
            label: None,
        });
        Ok(())
    }

    /// Add thermal capacitance (thermal mass) between node and ambient
    /// C_th = m × c_p where m is mass, c_p is specific heat capacity
    pub fn add_capacitance(&mut self, node: usize, c_thermal: f64) -> Result<()> {
        if node >= self.num_nodes {
            return Err(crate::error::TupanError::InvalidState(
                format!("Node index out of range (0-{})", self.num_nodes - 1),
            ));
        }
        self.components.push(ThermalComponent {
            component_type: ThermalComponentType::Capacitance,
            hot_node: node,
            cold_node: self.ambient_node,
            value: c_thermal,
            label: None,
        });
        Ok(())
    }

    /// Add temperature source (boundary condition)
    pub fn add_temperature_source(&mut self, hot: usize, cold: usize, temperature: f64) -> Result<()> {
        self.validate_nodes(hot, cold)?;
        self.components.push(ThermalComponent {
            component_type: ThermalComponentType::TemperatureSource,
            hot_node: hot,
            cold_node: cold,
            value: temperature,
            label: None,
        });
        Ok(())
    }

    /// Add heat flow source (e.g., power dissipation)
    pub fn add_heat_flow_source(&mut self, hot: usize, cold: usize, heat_flow: f64) -> Result<()> {
        self.validate_nodes(hot, cold)?;
        self.components.push(ThermalComponent {
            component_type: ThermalComponentType::HeatFlowSource,
            hot_node: hot,
            cold_node: cold,
            value: heat_flow,
            label: None,
        });
        Ok(())
    }

    /// Validate node indices
    fn validate_nodes(&self, hot: usize, cold: usize) -> Result<()> {
        if hot >= self.num_nodes || cold >= self.num_nodes {
            return Err(crate::error::TupanError::InvalidState(
                format!("Node indices out of range (0-{})", self.num_nodes - 1),
            ));
        }
        if hot == cold {
            return Err(crate::error::TupanError::InvalidState(
                "Component endpoints must be different nodes".to_string(),
            ));
        }
        Ok(())
    }

    /// Check for floating nodes (isolated temperature nodes)
    pub fn has_floating_nodes(&self) -> bool {
        let mut connected = vec![false; self.num_nodes];
        connected[self.ambient_node] = true;  // Ambient is always connected

        for comp in &self.components {
            connected[comp.hot_node] = true;
            connected[comp.cold_node] = true;
        }

        connected.iter().any(|&c| !c)
    }
}

/// Thermal network to bond graph converter
pub struct ThermalConverter {
    network: ThermalNetwork,
}

impl ThermalConverter {
    /// Create converter for a thermal network
    pub fn new(network: ThermalNetwork) -> Self {
        ThermalConverter { network }
    }

    /// Convert thermal network to bond graph
    pub fn convert(&self) -> Result<BondGraph> {
        // Validate structure
        if self.network.has_floating_nodes() {
            return Err(crate::error::TupanError::InvalidState(
                "Thermal network has floating nodes".to_string(),
            ));
        }

        let mut bg = BondGraph::with_name(format!("Thermal: {}", self.network.name));

        // Create 0-junctions for each temperature node (including ambient)
        let mut node_to_junction = HashMap::new();
        for node_idx in 0..self.network.num_nodes {
            let junction_id = crate::bond_graph::element::ElementId::new();
            bg.add_element(BondGraphElement::Junction0(
                junction_id,
                crate::bond_graph::element::Junction0 {
                    name: Some(format!("ThermalNode{}", node_idx)),
                },
            ));
            node_to_junction.insert(node_idx, junction_id);
        }

        // Convert each component
        for (idx, comp) in self.network.components.iter().enumerate() {
            self.convert_component(&mut bg, comp, idx, &node_to_junction)?;
        }

        // Assign causality
        CausalityAssigner::assign_causality(&mut bg)
            .map_err(|e| crate::error::TupanError::InvalidState(format!("Causality error: {:?}", e)))?;

        Ok(bg)
    }

    /// Convert individual thermal component to bond graph
    fn convert_component(
        &self,
        bg: &mut BondGraph,
        comp: &ThermalComponent,
        idx: usize,
        node_to_junction: &HashMap<usize, crate::bond_graph::element::ElementId>,
    ) -> Result<()> {
        use crate::bond_graph::element::{ElementId, Resistor, CapacitiveStorage, EffortSource, FlowSource};

        let hot_junction = node_to_junction.get(&comp.hot_node).copied();
        let cold_junction = node_to_junction.get(&comp.cold_node).copied();

        match comp.component_type {
            ThermalComponentType::Resistance => {
                let r_id = ElementId::new();
                bg.add_element(BondGraphElement::R(
                    r_id,
                    Resistor {
                        resistance: comp.value,
                        variable_name: comp.label.clone().or_else(|| Some(format!("R_th{}", idx))),
                    },
                ));

                // Connect resistance between junctions
                if let (Some(hot), Some(cold)) = (hot_junction, cold_junction) {
                    bg.add_bond(Bond::new(hot, r_id))?;
                    bg.add_bond(Bond::new(r_id, cold))?;
                }
            }
            ThermalComponentType::Capacitance => {
                let c_id = ElementId::new();
                bg.add_element(BondGraphElement::C(
                    c_id,
                    CapacitiveStorage {
                        capacitance: comp.value,
                        initial_displacement: 0.0,
                        variable_name: comp.label.clone().or_else(|| Some(format!("C_th{}", idx))),
                    },
                ));

                // Connect capacitance between junctions
                if let (Some(hot), Some(cold)) = (hot_junction, cold_junction) {
                    bg.add_bond(Bond::new(hot, c_id))?;
                    bg.add_bond(Bond::new(c_id, cold))?;
                }
            }
            ThermalComponentType::TemperatureSource => {
                let se_id = ElementId::new();
                bg.add_element(BondGraphElement::Se(
                    se_id,
                    EffortSource {
                        effort: comp.value,
                        expression: comp.label.clone(),
                    },
                ));

                // Connect temperature source between junctions
                if let (Some(hot), Some(cold)) = (hot_junction, cold_junction) {
                    bg.add_bond(Bond::new(se_id, hot))?;
                    bg.add_bond(Bond::new(cold, se_id))?;
                }
            }
            ThermalComponentType::HeatFlowSource => {
                let sf_id = ElementId::new();
                bg.add_element(BondGraphElement::Sf(
                    sf_id,
                    FlowSource {
                        flow: comp.value,
                        expression: comp.label.clone(),
                    },
                ));

                // Connect heat flow source between junctions
                if let (Some(hot), Some(cold)) = (hot_junction, cold_junction) {
                    bg.add_bond(Bond::new(sf_id, hot))?;
                    bg.add_bond(Bond::new(cold, sf_id))?;
                }
            }
        }

        Ok(())
    }
}

/// Implement PhysicalDomain for thermal networks
impl PhysicalDomain for ThermalNetwork {
    fn domain_name(&self) -> &str {
        "Thermal"
    }

    fn effort_variable(&self) -> &str {
        "Temperature"
    }

    fn flow_variable(&self) -> &str {
        "Heat Flow"
    }

    fn effort_unit(&self) -> &str {
        "K"
    }

    fn flow_unit(&self) -> &str {
        "W"
    }

    fn to_bond_graph(&self) -> Result<BondGraph> {
        ThermalConverter::new(self.clone()).convert()
    }

    fn validate_structure(&self) -> Result<()> {
        if self.components.is_empty() {
            return Err(crate::error::TupanError::InvalidState(
                "Thermal network must have at least one component".to_string(),
            ));
        }

        if self.has_floating_nodes() {
            return Err(crate::error::TupanError::InvalidState(
                "Thermal network has floating nodes (except ambient)".to_string(),
            ));
        }

        Ok(())
    }

    fn metadata(&self) -> Vec<(String, String)> {
        vec![
            ("num_nodes".to_string(), self.num_nodes.to_string()),
            ("num_components".to_string(), self.components.len().to_string()),
            ("ambient_node".to_string(), self.ambient_node.to_string()),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_network() {
        let network = ThermalNetwork::new("Simple Heat Transfer", 2);
        assert_eq!(network.name, "Simple Heat Transfer");
        assert_eq!(network.num_nodes, 2);
        assert_eq!(network.ambient_node, 0);
    }

    #[test]
    fn test_add_resistance() {
        let mut network = ThermalNetwork::new("Test", 3);
        let result = network.add_resistance(1, 0, 0.1);
        assert!(result.is_ok());
        assert_eq!(network.components.len(), 1);
    }

    #[test]
    fn test_add_capacitance() {
        let mut network = ThermalNetwork::new("Test", 3);
        let result = network.add_capacitance(1, 100.0);
        assert!(result.is_ok());
        assert_eq!(network.components.len(), 1);
    }

    #[test]
    fn test_add_temperature_source() {
        let mut network = ThermalNetwork::new("Test", 3);
        let result = network.add_temperature_source(1, 0, 300.0);
        assert!(result.is_ok());
        assert_eq!(network.components.len(), 1);
    }

    #[test]
    fn test_add_heat_flow_source() {
        let mut network = ThermalNetwork::new("Test", 3);
        let result = network.add_heat_flow_source(1, 0, 10.0);
        assert!(result.is_ok());
        assert_eq!(network.components.len(), 1);
    }

    #[test]
    fn test_invalid_nodes() {
        let mut network = ThermalNetwork::new("Test", 2);
        let result = network.add_resistance(5, 0, 0.1);
        assert!(result.is_err());
    }

    #[test]
    fn test_same_node_error() {
        let mut network = ThermalNetwork::new("Test", 3);
        let result = network.add_resistance(1, 1, 0.1);
        assert!(result.is_err());
    }

    #[test]
    fn test_rc_thermal_network() -> Result<()> {
        let mut network = ThermalNetwork::new("RC Thermal", 3);
        // Heat source at node 2
        network.add_heat_flow_source(2, 0, 10.0)?;
        // Thermal resistance between node 2 and node 1
        network.add_resistance(2, 1, 0.1)?;
        // Thermal capacitance at node 1
        network.add_capacitance(1, 100.0)?;

        // Convert to bond graph
        let bg = network.to_bond_graph()?;

        // Should have elements and bonds
        assert!(bg.num_elements() > 0);
        assert!(bg.num_bonds() > 0);
        assert!(bg.causality_assigned);

        Ok(())
    }

    #[test]
    fn test_simple_resistance_network() -> Result<()> {
        let mut network = ThermalNetwork::new("Simple Resistance", 2);
        network.add_temperature_source(1, 0, 350.0)?;
        network.add_resistance(1, 0, 0.1)?;

        let bg = network.to_bond_graph()?;
        assert!(bg.num_elements() > 0);
        assert!(bg.causality_assigned);

        Ok(())
    }

    #[test]
    fn test_multilayer_network() -> Result<()> {
        let mut network = ThermalNetwork::new("Multilayer", 4);
        // Heat input at node 3
        network.add_heat_flow_source(3, 0, 20.0)?;
        // Layers of thermal resistance
        network.add_resistance(3, 2, 0.05)?;
        network.add_resistance(2, 1, 0.05)?;
        // Final capacitance
        network.add_capacitance(1, 50.0)?;

        let bg = network.to_bond_graph()?;
        assert!(bg.num_elements() > 0);
        assert!(bg.causality_assigned);

        Ok(())
    }

    #[test]
    fn test_floating_node_detection() {
        let mut network = ThermalNetwork::new("Floating Node", 4);
        // Add component only between nodes 1-2, leaving nodes 3 floating
        let _ = network.add_resistance(1, 2, 0.1);

        assert!(network.has_floating_nodes());
    }

    #[test]
    fn test_validate_structure() {
        let empty_network = ThermalNetwork::new("Empty", 2);
        let result = empty_network.validate_structure();
        assert!(result.is_err());  // No components
    }

    #[test]
    fn test_physical_domain_trait() {
        let mut network = ThermalNetwork::new("Test", 2);
        let _ = network.add_temperature_source(1, 0, 300.0);
        let _ = network.add_resistance(1, 0, 0.1);

        assert_eq!(network.domain_name(), "Thermal");
        assert_eq!(network.effort_variable(), "Temperature");
        assert_eq!(network.flow_variable(), "Heat Flow");
        assert_eq!(network.effort_unit(), "K");
        assert_eq!(network.flow_unit(), "W");

        let metadata = network.metadata();
        assert!(!metadata.is_empty());
    }

    #[test]
    fn test_multisource_thermal_network() -> Result<()> {
        let mut network = ThermalNetwork::new("Multi-node", 4);
        // Single heat source at node 3
        network.add_heat_flow_source(3, 0, 15.0)?;
        // Multiple thermal resistances in series
        network.add_resistance(3, 2, 0.05)?;
        network.add_resistance(2, 1, 0.05)?;
        // Temperature boundary condition at node 1
        network.add_temperature_source(1, 0, 310.0)?;

        let bg = network.to_bond_graph()?;
        assert!(bg.causality_assigned);

        Ok(())
    }

    #[test]
    fn test_radiator_network() -> Result<()> {
        // Model: Heat source → Thermal resistance (convection) → Ambient
        let mut network = ThermalNetwork::new("Radiator", 2);
        network.add_heat_flow_source(1, 0, 50.0)?;  // 50W heat dissipation
        network.add_resistance(1, 0, 0.01)?;  // 0.01 K/W convection resistance

        let bg = network.to_bond_graph()?;
        assert!(bg.num_elements() > 0);
        assert!(bg.causality_assigned);

        Ok(())
    }
}
