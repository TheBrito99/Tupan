//! Electrical circuit domain
//!
//! Implements electrical components and Modified Nodal Analysis (MNA) solver
//! for AC and DC circuit simulation.
//!
//! Provides high-level circuit analysis with topology validation,
//! connectivity checking, and comprehensive simulation capabilities.

pub mod components;
pub mod solver;
pub mod analyzer;
pub mod graph;

pub use components::ElectricalComponent;
pub use solver::{ModifiedNodalAnalysis, CircuitAnalyzer};
pub use analyzer::CircuitTopology;
pub use graph::ElectricalGraph;

use crate::graph::{Node, NodeId, NodeData, Graph};
use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

/// Electrical domain analyzer with circuit management and validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElectricalDomain {
    /// Circuit name
    pub name: String,
    /// Operating frequency (0 for DC)
    pub frequency: f64,
    /// Temperature for temperature-dependent components
    pub temperature: f64,
    /// Stored circuit topology for validation
    #[serde(skip)]
    pub circuit_analyzer: Option<CircuitAnalyzer>,
}

impl ElectricalDomain {
    /// Create new electrical domain
    pub fn new(name: String) -> Self {
        ElectricalDomain {
            name,
            frequency: 0.0,  // DC
            temperature: 27.0,  // 27°C
            circuit_analyzer: None,
        }
    }

    /// Set operating frequency (Hz)
    pub fn set_frequency(&mut self, freq: f64) {
        if freq < 0.0 {
            panic!("Frequency cannot be negative");
        }
        self.frequency = freq;
    }

    /// Set operating temperature (Celsius)
    pub fn set_temperature(&mut self, temp: f64) {
        self.temperature = temp;
    }

    /// Load circuit from graph and validate topology
    pub fn load_circuit(&mut self, graph: &Graph) -> Result<CircuitTopology, String> {
        // Validate circuit before loading
        let topology = CircuitTopology::from_graph(graph)?;

        // Check for issues
        topology.validate()?;

        // Create analyzer
        let num_nodes = graph.node_count();
        self.circuit_analyzer = Some(CircuitAnalyzer::new(num_nodes, 0.001));

        if let Some(analyzer) = &mut self.circuit_analyzer {
            analyzer.load_circuit(graph)?;
        }

        Ok(topology)
    }

    /// Validate circuit topology without loading
    pub fn validate_topology(&self, graph: &Graph) -> Result<CircuitTopology, String> {
        let topology = CircuitTopology::from_graph(graph)?;
        topology.validate()?;
        Ok(topology)
    }

    /// Run DC operating point analysis
    pub fn analyze_dc(&mut self) -> Result<DcAnalysisResult, String> {
        let analyzer = self.circuit_analyzer.as_mut()
            .ok_or("Circuit not loaded. Call load_circuit first.".to_string())?;

        analyzer.step()?;

        let num_nodes = analyzer.solver.num_nodes;
        let mut node_voltages = Vec::new();

        for i in 0..num_nodes {
            node_voltages.push(analyzer.solver.get_node_voltage(i));
        }

        Ok(DcAnalysisResult {
            node_voltages,
            simulation_time: 0.0,
        })
    }

    /// Run transient analysis
    pub fn analyze_transient(&mut self, duration: f64, time_step: f64) -> Result<TransientAnalysisResult, String> {
        if let Some(analyzer) = &mut self.circuit_analyzer {
            analyzer.time_step = time_step;
            analyzer.solver.set_time_step(time_step);

            let (time_vec, voltages) = analyzer.run_transient(duration)?;

            Ok(TransientAnalysisResult {
                time_vec,
                node_voltages: voltages,
            })
        } else {
            Err("Circuit not loaded. Call load_circuit first.".to_string())
        }
    }

    /// Get circuit statistics
    pub fn get_circuit_stats(&self, topology: &CircuitTopology) -> CircuitStats {
        CircuitStats {
            total_nodes: topology.all_nodes.len(),
            floating_nodes: topology.floating_nodes.len(),
            connected_nodes: topology.connected_nodes.len(),
            total_resistors: topology.component_count("resistor"),
            total_capacitors: topology.component_count("capacitor"),
            total_inductors: topology.component_count("inductor"),
            total_sources: topology.component_count("voltage_source")
                + topology.component_count("current_source"),
        }
    }

    /// Get domain name
    pub fn domain_name(&self) -> &str {
        "electrical"
    }
}

impl super::PhysicalDomain for ElectricalDomain {
    fn to_bond_graph(&self) -> Graph {
        // Will implement bond graph conversion later
        Graph::new()
    }

    fn governing_equations(&self) -> String {
        "Modified Nodal Analysis (MNA) equations".to_string()
    }

    fn domain_name(&self) -> &str {
        "electrical"
    }
}

/// Results from DC operating point analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DcAnalysisResult {
    pub node_voltages: Vec<f64>,
    pub simulation_time: f64,
}

/// Results from transient analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransientAnalysisResult {
    pub time_vec: Vec<f64>,
    pub node_voltages: Vec<Vec<f64>>,
}

/// Circuit statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitStats {
    pub total_nodes: usize,
    pub floating_nodes: usize,
    pub connected_nodes: usize,
    pub total_resistors: usize,
    pub total_capacitors: usize,
    pub total_inductors: usize,
    pub total_sources: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_electrical_domain_creation() {
        let domain = ElectricalDomain::new("Test Circuit".to_string());
        assert_eq!(domain.name, "Test Circuit");
        assert_eq!(domain.frequency, 0.0);  // DC
        assert_eq!(domain.temperature, 27.0);
    }

    #[test]
    fn test_domain_name() {
        let domain = ElectricalDomain::new("Test".to_string());
        assert_eq!(domain.domain_name(), "electrical");
    }
}
