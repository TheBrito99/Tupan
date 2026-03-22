//! Thermal Circuit Simulator
//!
//! Thermal circuits use heat transfer physics to model temperature distribution
//! and heat flow in mechanical systems.
//!
//! Thermal Circuit Analogy:
//! ├─ Temperature (T) ↔ Voltage (V)
//! ├─ Heat Flow (q) ↔ Current (I)
//! ├─ Thermal Resistance (R_th) ↔ Electrical Resistance (R)
//! ├─ Thermal Capacitance (C_th) ↔ Electrical Capacitance (C)
//! └─ Heat Source (Q̇) ↔ Voltage Source (V)
//!
//! This enables reusing MNA solver for thermal analysis!

pub mod components;
pub mod solver;

pub use components::ThermalComponent;
pub use solver::ThermalAnalyzer;

use crate::graph::Graph;
use serde::{Deserialize, Serialize};

/// Physical properties of thermal materials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialProperties {
    /// Thermal conductivity [W/(m·K)]
    pub conductivity: f64,
    /// Specific heat capacity [J/(kg·K)]
    pub specific_heat: f64,
    /// Density [kg/m³]
    pub density: f64,
}

/// Standard material presets
impl MaterialProperties {
    /// Aluminum (common heat sink material)
    pub fn aluminum() -> Self {
        MaterialProperties {
            conductivity: 160.0,  // W/(m·K)
            specific_heat: 900.0,  // J/(kg·K)
            density: 2700.0,  // kg/m³
        }
    }

    /// Copper (excellent thermal conductor)
    pub fn copper() -> Self {
        MaterialProperties {
            conductivity: 400.0,
            specific_heat: 385.0,
            density: 8960.0,
        }
    }

    /// Silicon (typical semiconductor material)
    pub fn silicon() -> Self {
        MaterialProperties {
            conductivity: 150.0,
            specific_heat: 700.0,
            density: 2330.0,
        }
    }

    /// Glass (thermal insulator)
    pub fn glass() -> Self {
        MaterialProperties {
            conductivity: 1.0,
            specific_heat: 840.0,
            density: 2500.0,
        }
    }

    /// Air (natural convection medium)
    pub fn air() -> Self {
        MaterialProperties {
            conductivity: 0.026,  // At 20°C
            specific_heat: 1006.0,
            density: 1.2,  // kg/m³ at sea level
        }
    }

    /// Water (cooling medium)
    pub fn water() -> Self {
        MaterialProperties {
            conductivity: 0.6,
            specific_heat: 4186.0,
            density: 1000.0,
        }
    }
}

/// Thermal circuit analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalAnalysisResult {
    /// Node temperatures [°C]
    pub node_temperatures: Vec<f64>,
    /// Heat flows between nodes [W]
    pub heat_flows: Vec<f64>,
    /// Simulation time [s]
    pub simulation_time: f64,
}

/// Transient thermal analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalTransientResult {
    /// Time vector [s]
    pub time_vector: Vec<f64>,
    /// Temperature at each node over time [°C]
    pub node_temperatures: Vec<Vec<f64>>,
    /// Number of simulation steps
    pub step_count: usize,
}

/// Thermal circuit validator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalValidation {
    /// Circuit is valid for analysis
    pub is_valid: bool,
    /// Validation issues (if any)
    pub issues: Vec<String>,
    /// Number of nodes with defined temperatures
    pub nodes_with_temps: usize,
    /// Number of nodes without temperatures
    pub floating_nodes: usize,
    /// Total heat sources
    pub total_heat_sources: usize,
}

/// Thermal circuit statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalStats {
    /// Total nodes in circuit
    pub total_nodes: usize,
    /// Nodes with defined temperatures
    pub nodes_with_temps: usize,
    /// Floating nodes (no temperature source)
    pub floating_nodes: usize,
    /// Number of thermal resistances
    pub total_resistances: usize,
    /// Number of thermal capacitances
    pub total_capacitances: usize,
    /// Number of heat sources
    pub total_heat_sources: usize,
    /// Convection surfaces
    pub convection_surfaces: usize,
    /// Radiation surfaces
    pub radiation_surfaces: usize,
}

/// Thermal domain module - implements PhysicalDomain trait
pub struct ThermalDomain {
    name: String,
    graph: Option<Graph>,
    ambient_temperature: f64,  // [°C]
    solver: Option<ThermalAnalyzer>,
}

impl ThermalDomain {
    /// Create new thermal domain
    pub fn new(name: &str) -> Self {
        ThermalDomain {
            name: name.to_string(),
            graph: None,
            ambient_temperature: 25.0,  // Room temperature
            solver: None,
        }
    }

    /// Set ambient temperature for convection calculations
    pub fn set_ambient_temperature(&mut self, temp: f64) {
        self.ambient_temperature = temp;
    }

    /// Load circuit from graph
    pub fn load_circuit(&mut self, graph: Graph) -> Result<(), String> {
        if graph.node_count() == 0 {
            return Err("Circuit has no nodes".to_string());
        }

        self.graph = Some(graph);
        self.solver = Some(ThermalAnalyzer::new(self.graph.as_ref().unwrap().node_count(), 0.001));

        Ok(())
    }

    /// Validate thermal circuit
    pub fn validate_circuit(&self) -> ThermalValidation {
        let mut issues = Vec::new();
        let mut nodes_with_temps = 0;
        let mut heat_sources = 0;

        if self.graph.is_none() {
            issues.push("No circuit loaded".to_string());
            return ThermalValidation {
                is_valid: false,
                issues,
                nodes_with_temps: 0,
                floating_nodes: 0,
                total_heat_sources: 0,
            };
        }

        let graph = self.graph.as_ref().unwrap();

        // Count component types (would be done with proper component analysis)
        // For now, basic validation
        let total_nodes = graph.node_count();

        // Need at least one temperature source
        if heat_sources == 0 {
            issues.push("No heat source defined".to_string());
        }

        // Check for isolated nodes
        let floating = total_nodes - nodes_with_temps;
        if floating > 0 && heat_sources == 0 {
            issues.push(format!("Floating nodes detected: {} nodes without temperature source", floating));
        }

        ThermalValidation {
            is_valid: issues.is_empty(),
            issues,
            nodes_with_temps,
            floating_nodes: floating,
            total_heat_sources: heat_sources,
        }
    }

    /// Perform DC (steady-state) thermal analysis
    pub fn analyze_dc(&self) -> Result<ThermalAnalysisResult, String> {
        let solver = self.solver.as_ref()
            .ok_or("Solver not initialized")?;

        // Run steady-state analysis
        let node_temperatures = solver.solve_steady_state()?;

        Ok(ThermalAnalysisResult {
            node_temperatures,
            heat_flows: Vec::new(),  // Would calculate from solved temperatures
            simulation_time: 0.0,
        })
    }

    /// Perform transient (time-domain) thermal analysis
    pub fn analyze_transient(
        &self,
        duration: f64,
        time_step: f64,
    ) -> Result<ThermalTransientResult, String> {
        let solver = self.solver.as_ref()
            .ok_or("Solver not initialized")?;

        let (time_vector, temps) = solver.solve_transient(duration, time_step)?;

        Ok(ThermalTransientResult {
            time_vector,
            node_temperatures: temps,
            step_count: (duration / time_step) as usize,
        })
    }

    /// Get circuit statistics
    pub fn get_statistics(&self) -> ThermalStats {
        let graph = self.graph.as_ref().unwrap();

        ThermalStats {
            total_nodes: graph.node_count(),
            nodes_with_temps: 0,  // Would count temperature-defined nodes
            floating_nodes: 0,    // Would calculate floating nodes
            total_resistances: 0, // Would count thermal resistances
            total_capacitances: 0, // Would count thermal capacitances
            total_heat_sources: 0, // Would count heat sources
            convection_surfaces: 0, // Would count convection
            radiation_surfaces: 0,  // Would count radiation
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_material_properties() {
        let copper = MaterialProperties::copper();
        assert_eq!(copper.conductivity, 400.0);
        assert_eq!(copper.density, 8960.0);

        let aluminum = MaterialProperties::aluminum();
        assert!(aluminum.conductivity < copper.conductivity);

        let insulator = MaterialProperties::glass();
        assert!(insulator.conductivity < aluminum.conductivity);
    }

    #[test]
    fn test_thermal_domain_creation() {
        let domain = ThermalDomain::new("Test Circuit");
        assert_eq!(domain.name, "Test Circuit");
        assert_eq!(domain.ambient_temperature, 25.0);
    }

    #[test]
    fn test_ambient_temperature_setting() {
        let mut domain = ThermalDomain::new("Test");
        domain.set_ambient_temperature(50.0);
        assert_eq!(domain.ambient_temperature, 50.0);
    }
}
