//! Hydraulic Systems Simulator
//!
//! Hydraulic systems use pressure/flow dynamics to model fluid power transmission.
//!
//! Hydraulic ↔ Electrical Analogy:
//! ├─ Pressure (P) [Pa] ↔ Voltage (V) [V]
//! ├─ Flow Rate (Q) [m³/s] ↔ Current (I) [A]
//! ├─ Hydraulic Resistance (R_h) [Pa·s/m³] ↔ Electrical Resistance (R) [Ω]
//! └─ Accumulator Area (A) [m²] ↔ Capacitance (C) [F]
//!
//! This enables reusing MNA solver for hydraulic analysis!
//! Same equation: G × X = Y
//! - G = 1/R_h (hydraulic conductance)
//! - X = pressure vector (P in Pa)
//! - Y = flow source vector (Q in m³/s)

pub mod components;
pub mod solver;

pub use components::HydraulicComponent;
pub use solver::HydraulicAnalyzer;

use serde::{Deserialize, Serialize};

/// Fluid properties for hydraulic systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FluidProperties {
    /// Density [kg/m³]
    pub density: f64,
    /// Dynamic viscosity [Pa·s]
    pub viscosity: f64,
    /// Bulk modulus [Pa] - resistance to compression
    pub bulk_modulus: f64,
    /// Thermal conductivity [W/(m·K)]
    pub thermal_conductivity: f64,
    /// Specific heat capacity [J/(kg·K)]
    pub specific_heat: f64,
    /// Viscosity index - temperature dependence
    pub viscosity_index: f64,
}

/// Standard fluid presets
impl FluidProperties {
    /// ISO VG 46 Hydraulic Oil (common industrial)
    pub fn iso_vg46() -> Self {
        FluidProperties {
            density: 860.0,                 // kg/m³
            viscosity: 46e-6,               // Pa·s at 40°C
            bulk_modulus: 1.7e9,            // Pa
            thermal_conductivity: 0.14,     // W/(m·K)
            specific_heat: 1920.0,          // J/(kg·K)
            viscosity_index: 95.0,          // typical VI
        }
    }

    /// ISO VG 32 Hydraulic Oil (thinner, faster response)
    pub fn iso_vg32() -> Self {
        FluidProperties {
            density: 865.0,
            viscosity: 32e-6,
            bulk_modulus: 1.6e9,
            thermal_conductivity: 0.14,
            specific_heat: 1950.0,
            viscosity_index: 100.0,
        }
    }

    /// ISO VG 68 Hydraulic Oil (heavier, better for wear protection)
    pub fn iso_vg68() -> Self {
        FluidProperties {
            density: 845.0,
            viscosity: 68e-6,
            bulk_modulus: 1.8e9,
            thermal_conductivity: 0.14,
            specific_heat: 1880.0,
            viscosity_index: 95.0,
        }
    }

    /// Water (for water-based systems)
    pub fn water() -> Self {
        FluidProperties {
            density: 1000.0,
            viscosity: 1e-3,                // Pa·s at 20°C
            bulk_modulus: 2.2e9,
            thermal_conductivity: 0.6,
            specific_heat: 4186.0,
            viscosity_index: 0.0,           // water has low VI
        }
    }

    /// Water-in-oil emulsion (fire-resistant)
    pub fn water_in_oil() -> Self {
        FluidProperties {
            density: 920.0,
            viscosity: 40e-6,
            bulk_modulus: 1.5e9,            // slightly lower bulk modulus
            thermal_conductivity: 0.15,
            specific_heat: 2100.0,          // higher due to water content
            viscosity_index: 110.0,         // better VI
        }
    }

    /// Synthetic oil (extended drain, wider temperature range)
    pub fn synthetic() -> Self {
        FluidProperties {
            density: 850.0,
            viscosity: 46e-6,
            bulk_modulus: 1.9e9,            // higher bulk modulus
            thermal_conductivity: 0.13,
            specific_heat: 1900.0,
            viscosity_index: 160.0,         // much higher VI
        }
    }
}

/// Hydraulic system analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraulicAnalysisResult {
    /// Node pressures [Pa]
    pub node_pressures: Vec<f64>,
    /// Flow rates between nodes [m³/s]
    pub flow_rates: Vec<f64>,
    /// Simulation time [s]
    pub simulation_time: f64,
}

/// Transient hydraulic analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraulicTransientResult {
    /// Time vector [s]
    pub time_vector: Vec<f64>,
    /// Pressure at each node over time [Pa]
    pub node_pressures: Vec<Vec<f64>>,
    /// Flow rates over time [m³/s]
    pub flow_rates: Vec<Vec<f64>>,
    /// Number of simulation steps
    pub step_count: usize,
}

/// Hydraulic system validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraulicValidation {
    /// System is valid for analysis
    pub is_valid: bool,
    /// Validation issues (if any)
    pub issues: Vec<String>,
    /// Number of nodes with pressure sources
    pub nodes_with_sources: usize,
    /// Number of floating nodes
    pub floating_nodes: usize,
    /// Total pump/flow sources
    pub total_flow_sources: usize,
}

/// Hydraulic system statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraulicStats {
    /// Total nodes in system
    pub total_nodes: usize,
    /// Nodes with pressure sources
    pub nodes_with_sources: usize,
    /// Floating nodes (tank-connected)
    pub floating_nodes: usize,
    /// Number of valves
    pub total_valves: usize,
    /// Number of accumulators
    pub total_accumulators: usize,
    /// Number of pumps
    pub total_pumps: usize,
    /// Number of cylinders
    pub total_cylinders: usize,
    /// Maximum system pressure [Pa]
    pub max_pressure: f64,
}

/// Hydraulic domain module
pub struct HydraulicDomain {
    name: String,
    fluid: FluidProperties,
    tank_pressure: f64,  // [Pa] - usually atmospheric (~101325 Pa)
}

impl HydraulicDomain {
    /// Create new hydraulic domain
    pub fn new(name: &str, fluid: FluidProperties) -> Self {
        HydraulicDomain {
            name: name.to_string(),
            fluid,
            tank_pressure: 101325.0,  // 1 atm
        }
    }

    /// Set tank pressure (reference pressure)
    pub fn set_tank_pressure(&mut self, pressure: f64) {
        self.tank_pressure = pressure;
    }

    /// Get fluid properties
    pub fn get_fluid(&self) -> &FluidProperties {
        &self.fluid
    }

    /// Get tank pressure
    pub fn get_tank_pressure(&self) -> f64 {
        self.tank_pressure
    }

    /// Perform steady-state analysis
    /// Note: Use HydraulicAnalyzer directly for analysis with specific components
    pub fn new_analyzer(&self) -> HydraulicAnalyzer {
        let mut analyzer = HydraulicAnalyzer::new();
        analyzer.set_tank_pressure(self.tank_pressure);
        analyzer
    }

    /// Get system statistics
    pub fn get_statistics(&self) -> HydraulicStats {
        HydraulicStats {
            total_nodes: 0,
            nodes_with_sources: 0,
            floating_nodes: 0,
            total_valves: 0,
            total_accumulators: 0,
            total_pumps: 0,
            total_cylinders: 0,
            max_pressure: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fluid_properties() {
        let iso46 = FluidProperties::iso_vg46();
        assert_eq!(iso46.density, 860.0);
        assert!(iso46.bulk_modulus > 0.0);

        let iso68 = FluidProperties::iso_vg68();
        assert!(iso68.viscosity > iso46.viscosity);

        let synthetic = FluidProperties::synthetic();
        assert!(synthetic.viscosity_index > iso46.viscosity_index);
    }

    #[test]
    fn test_hydraulic_domain_creation() {
        let fluid = FluidProperties::iso_vg46();
        let domain = HydraulicDomain::new("Test System", fluid);
        assert_eq!(domain.name, "Test System");
        assert_eq!(domain.tank_pressure, 101325.0);
    }

    #[test]
    fn test_tank_pressure_setting() {
        let fluid = FluidProperties::iso_vg46();
        let mut domain = HydraulicDomain::new("Test", fluid);
        domain.set_tank_pressure(200000.0);
        assert_eq!(domain.tank_pressure, 200000.0);
    }
}
