//! Pneumatic Systems Simulator
//!
//! Pneumatic systems use pressure/flow dynamics with compressible gas effects.
//!
//! Pneumatic ↔ Electrical Analogy:
//! ├─ Pressure (P) [Pa] ↔ Voltage (V) [V]
//! ├─ Flow Rate (Q) [m³/s] ↔ Current (I) [A]
//! ├─ Pneumatic Resistance (R_p) [Pa·s/m³] ↔ Electrical Resistance (R) [Ω]
//! └─ Tank Volume (V) [m³] ↔ Capacitance (C) [F]
//!
//! This enables reusing MNA solver for pneumatic analysis!
//! Same equation: G × X = Y
//! - G = 1/R_p (pneumatic conductance)
//! - X = pressure vector (P in Pa)
//! - Y = flow source vector (Q in m³/s)

pub mod components;
pub mod solver;

pub use components::PneumaticComponent;
pub use solver::PneumaticAnalyzer;

use serde::{Deserialize, Serialize};

/// Gas properties for pneumatic systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasProperties {
    /// Density at 20°C, 101325 Pa [kg/m³]
    pub density: f64,
    /// Dynamic viscosity [Pa·s]
    pub viscosity: f64,
    /// Specific heat at constant pressure [J/(kg·K)]
    pub cp: f64,
    /// Specific heat at constant volume [J/(kg·K)]
    pub cv: f64,
    /// Heat capacity ratio (gamma = cp/cv) [dimensionless]
    pub gamma: f64,
    /// Thermal conductivity [W/(m·K)]
    pub thermal_conductivity: f64,
}

/// Standard gas presets
impl GasProperties {
    /// Air at 20°C (most common)
    pub fn air() -> Self {
        GasProperties {
            density: 1.204,          // kg/m³
            viscosity: 1.81e-5,      // Pa·s
            cp: 1005.0,              // J/(kg·K)
            cv: 718.0,               // J/(kg·K)
            gamma: 1.4,              // dimensionless
            thermal_conductivity: 0.0262,  // W/(m·K)
        }
    }

    /// Nitrogen (inert, used in accumulators)
    pub fn nitrogen() -> Self {
        GasProperties {
            density: 1.165,          // kg/m³
            viscosity: 1.76e-5,
            cp: 1040.0,
            cv: 742.0,
            gamma: 1.4,
            thermal_conductivity: 0.0242,
        }
    }

    /// Compressed air with slight modifications
    pub fn compressed_air() -> Self {
        GasProperties {
            density: 1.204,
            viscosity: 1.81e-5,
            cp: 1005.0,
            cv: 718.0,
            gamma: 1.4,
            thermal_conductivity: 0.0262,
        }
    }

    /// Carbon dioxide (special applications)
    pub fn co2() -> Self {
        GasProperties {
            density: 1.977,          // kg/m³
            viscosity: 1.37e-5,
            cp: 846.0,
            cv: 657.0,
            gamma: 1.29,
            thermal_conductivity: 0.0146,
        }
    }
}

/// Pneumatic system analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PneumaticAnalysisResult {
    /// Node pressures [Pa]
    pub node_pressures: Vec<f64>,
    /// Flow rates between nodes [m³/s]
    pub flow_rates: Vec<f64>,
    /// Simulation time [s]
    pub simulation_time: f64,
}

/// Transient pneumatic analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PneumaticTransientResult {
    /// Time vector [s]
    pub time_vector: Vec<f64>,
    /// Pressure at each node over time [Pa]
    pub node_pressures: Vec<Vec<f64>>,
    /// Flow rates over time [m³/s]
    pub flow_rates: Vec<Vec<f64>>,
    /// Number of simulation steps
    pub step_count: usize,
}

/// Pneumatic system validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PneumaticValidation {
    /// System is valid for analysis
    pub is_valid: bool,
    /// Validation issues (if any)
    pub issues: Vec<String>,
    /// Number of nodes with pressure sources
    pub nodes_with_sources: usize,
    /// Number of floating nodes (unconnected)
    pub floating_nodes: usize,
    /// Total pump/flow sources
    pub total_flow_sources: usize,
}

/// Pneumatic system statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PneumaticStats {
    /// Total nodes in system
    pub total_nodes: usize,
    /// Nodes with pressure sources
    pub nodes_with_sources: usize,
    /// Floating nodes
    pub floating_nodes: usize,
    /// Number of valves
    pub total_valves: usize,
    /// Number of tanks/accumulators
    pub total_tanks: usize,
    /// Number of compressors
    pub total_compressors: usize,
    /// Number of cylinders/motors
    pub total_actuators: usize,
    /// Maximum system pressure [Pa]
    pub max_pressure: f64,
}

/// Pneumatic domain module
pub struct PneumaticDomain {
    name: String,
    gas: GasProperties,
    tank_pressure: f64,  // [Pa] - usually atmospheric (~101325 Pa)
}

impl PneumaticDomain {
    /// Create new pneumatic domain
    pub fn new(name: &str, gas: GasProperties) -> Self {
        PneumaticDomain {
            name: name.to_string(),
            gas,
            tank_pressure: 101325.0,  // 1 atm
        }
    }

    /// Set tank (reference) pressure
    pub fn set_tank_pressure(&mut self, pressure: f64) {
        self.tank_pressure = pressure;
    }

    /// Get gas properties
    pub fn get_gas(&self) -> &GasProperties {
        &self.gas
    }

    /// Get tank pressure
    pub fn get_tank_pressure(&self) -> f64 {
        self.tank_pressure
    }

    /// Perform steady-state analysis
    /// Note: Use PneumaticAnalyzer directly for analysis with specific components
    pub fn new_analyzer(&self) -> PneumaticAnalyzer {
        let mut analyzer = PneumaticAnalyzer::new();
        analyzer.set_tank_pressure(self.tank_pressure);
        analyzer
    }

    /// Get system statistics
    pub fn get_statistics(&self) -> PneumaticStats {
        PneumaticStats {
            total_nodes: 0,
            nodes_with_sources: 0,
            floating_nodes: 0,
            total_valves: 0,
            total_tanks: 0,
            total_compressors: 0,
            total_actuators: 0,
            max_pressure: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gas_properties() {
        let air = GasProperties::air();
        assert_eq!(air.gamma, 1.4);
        assert!(air.density > 0.0);

        let nitrogen = GasProperties::nitrogen();
        assert_eq!(nitrogen.gamma, 1.4);

        let co2 = GasProperties::co2();
        assert_eq!(co2.gamma, 1.29);
    }

    #[test]
    fn test_pneumatic_domain_creation() {
        let gas = GasProperties::air();
        let domain = PneumaticDomain::new("Test System", gas);
        assert_eq!(domain.name, "Test System");
        assert_eq!(domain.tank_pressure, 101325.0);
    }

    #[test]
    fn test_tank_pressure_setting() {
        let gas = GasProperties::air();
        let mut domain = PneumaticDomain::new("Test", gas);
        domain.set_tank_pressure(200000.0);
        assert_eq!(domain.tank_pressure, 200000.0);
    }
}
