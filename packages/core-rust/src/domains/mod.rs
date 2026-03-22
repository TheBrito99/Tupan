//! Physical Domain Trait and Abstractions
//!
//! Defines the unified interface for all physical domains (electrical, thermal, mechanical, etc.)
//! enabling conversion to bond graphs for unified multi-domain simulation.
//!
//! # Key Concept: Effort-Flow Duality
//!
//! All physical domains can be expressed using two fundamental variables:
//! - **Effort (e)**: Potential/driving variable (voltage, temperature, force, pressure)
//! - **Flow (f)**: Rate/through variable (current, heat flow, velocity, volume flow)
//!
//! Power transmitted = e × f
//!
//! # Domain Mappings
//!
//! | Domain | Effort | Flow | Time Constant |
//! |--------|--------|------|---------------|
//! | Electrical | Voltage [V] | Current [A] | L/R time constant |
//! | Thermal | Temperature [K] | Heat flow [W] | RC thermal time constant |
//! | Mechanical | Force [N] | Velocity [m/s] | m/b damping ratio |
//! | Hydraulic | Pressure [Pa] | Flow rate [m³/s] | System stiffness |
//! | Pneumatic | Pressure [Pa] | Flow rate [m³/s] | Chamber volume |
//! | Magnetic | Flux [Wb] | Voltage [V] | L/R electrical |
//!
//! # Implementation Pattern
//!
//! To create a new domain simulator:
//!
//! 1. Define domain components (enum of all element types)
//! 2. Implement `PhysicalDomain` trait
//! 3. Provide `to_bond_graph()` conversion
//! 4. Use unified solver with resulting bond graph

use crate::bond_graph::{BondGraph, CausalityAssigner};
use crate::error::Result;

/// Effort and flow variable pair for a domain
#[derive(Debug, Clone, Copy)]
pub struct EffortFlowPair {
    /// Effort variable (voltage, temperature, force, pressure, flux)
    pub effort: f64,
    /// Flow variable (current, heat flow, velocity, volume flow, voltage)
    pub flow: f64,
}

impl EffortFlowPair {
    /// Create new effort-flow pair
    pub fn new(effort: f64, flow: f64) -> Self {
        EffortFlowPair { effort, flow }
    }

    /// Calculate power transmitted: P = e × f
    pub fn power(&self) -> f64 {
        self.effort * self.flow
    }

    /// Check if variables are physically valid (e.g., no NaN or Inf)
    pub fn is_valid(&self) -> bool {
        self.effort.is_finite() && self.flow.is_finite()
    }
}

/// Universal trait for all physical domain simulators
///
/// Enables any domain (electrical, thermal, mechanical, etc.) to be represented
/// as a bond graph, allowing unified solver and multi-domain coupling.
pub trait PhysicalDomain: Send + Sync {
    /// Domain name (e.g., "Electrical", "Thermal", "Mechanical")
    fn domain_name(&self) -> &str;

    /// Name of effort variable in this domain (e.g., "Voltage", "Temperature", "Force")
    fn effort_variable(&self) -> &str;

    /// Name of flow variable in this domain (e.g., "Current", "Heat Flow", "Velocity")
    fn flow_variable(&self) -> &str;

    /// Unit of effort variable (e.g., "V", "K", "N")
    fn effort_unit(&self) -> &str;

    /// Unit of flow variable (e.g., "A", "W", "m/s")
    fn flow_unit(&self) -> &str;

    /// Convert this domain to a bond graph for unified simulation
    ///
    /// This is the key method enabling multi-domain coupling.
    /// Returns a bond graph with all components and connections mapped to universal
    /// bond graph elements (Se, Sf, C, I, R, TF, GY, 0-junction, 1-junction).
    ///
    /// # Returns
    /// - `Ok(BondGraph)` with complete causality assigned
    /// - `Err` if conversion is invalid (missing components, structural issues)
    fn to_bond_graph(&self) -> Result<BondGraph>;

    /// Validate domain-specific structural constraints
    ///
    /// Called after bond graph creation to check domain-specific rules:
    /// - Electrical: No floating nodes, at least one ground reference
    /// - Thermal: All nodes connected (no isolated elements)
    /// - Mechanical: No disconnected masses
    /// - Hydraulic: No single pump without load
    ///
    /// # Returns
    /// - `Ok(())` if domain is structurally valid
    /// - `Err` if constraints violated
    fn validate_structure(&self) -> Result<()> {
        Ok(())  // Default: no additional constraints
    }

    /// Domain-specific metadata as key-value pairs
    ///
    /// Useful for documentation, visualization hints, material properties, etc.
    /// Examples:
    /// - "temperature_ambient": "300" (Kelvin)
    /// - "thermal_conductivity": "400" (W/m·K for copper)
    /// - "fluid_type": "ISO VG 32" (hydraulic fluid)
    fn metadata(&self) -> Vec<(String, String)> {
        Vec::new()
    }

    /// Get current simulation time (for time-varying sources)
    fn current_time(&self) -> f64 {
        0.0
    }

    /// Set simulation time (needed for time-varying components)
    fn set_time(&mut self, _time: f64) {
        // Default: no time-varying components
    }
}

/// Builder pattern for creating domain simulators
///
/// Useful for configuring complex domains with many parameters
pub struct DomainBuilder {
    /// Domain name
    pub name: String,
    /// Metadata key-value pairs
    pub metadata: Vec<(String, String)>,
    /// Current simulation time
    pub time: f64,
}

impl DomainBuilder {
    /// Create new builder with domain name
    pub fn new(name: &str) -> Self {
        DomainBuilder {
            name: name.to_string(),
            metadata: Vec::new(),
            time: 0.0,
        }
    }

    /// Add metadata entry
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.push((key, value));
        self
    }

    /// Set initial simulation time
    pub fn with_time(mut self, time: f64) -> Self {
        self.time = time;
        self
    }
}

/// Multi-domain system combining multiple physical domains
///
/// Enables coupled multi-domain simulation (e.g., electro-thermal effects,
/// mechanical-electrical motor control).
pub struct MultiDomainSystem {
    /// Name of the system
    pub name: String,
    /// Coupled bond graphs from all domains (merged into single graph)
    pub combined_graph: BondGraph,
    /// Which domain each element came from (for tracking)
    pub element_domains: Vec<(String, String)>,  // (ElementId, DomainName)
    /// Coupling elements (transformers, gyrators between domains)
    pub couplings: Vec<CouplingElement>,
}

/// Describes coupling between two physical domains
#[derive(Debug, Clone)]
pub struct CouplingElement {
    /// Source domain name
    pub from_domain: String,
    /// Target domain name
    pub to_domain: String,
    /// Type of coupling (e.g., "Transformer", "Gyrator", "Modulated_TF")
    pub coupling_type: String,
    /// Coupling parameter (ratio for TF/GY, or function name)
    pub parameter: String,
}

impl MultiDomainSystem {
    /// Create new multi-domain system
    pub fn new(name: &str) -> Self {
        MultiDomainSystem {
            name: name.to_string(),
            combined_graph: BondGraph::new(),
            element_domains: Vec::new(),
            couplings: Vec::new(),
        }
    }

    /// Add a domain to this system
    pub fn add_domain(&mut self, domain: &dyn PhysicalDomain) -> Result<()> {
        let domain_bg = domain.to_bond_graph()?;

        // Merge bond graph into combined graph
        for element in domain_bg.get_elements() {
            self.combined_graph.add_element(element.clone());
            self.element_domains.push((
                domain.domain_name().to_string(),
                element.element_type().to_string(),
            ));
        }

        for bond in domain_bg.get_bonds() {
            self.combined_graph.add_bond(bond.clone()).ok();
        }

        Ok(())
    }

    /// Add coupling between two domains
    pub fn add_coupling(&mut self, coupling: CouplingElement) {
        self.couplings.push(coupling);
    }

    /// Validate complete system (all domains + couplings)
    pub fn validate(&self) -> Result<()> {
        // Ensure causality is assigned
        self.combined_graph.validate_causality()?;

        // Check no isolated elements
        if self.combined_graph.num_bonds() == 0 && self.combined_graph.num_elements() > 1 {
            return Err(crate::error::TupanError::InvalidState(
                "Multi-domain system has isolated elements".to_string(),
            ));
        }

        Ok(())
    }

    /// Assign causality to the entire combined system
    pub fn assign_causality(&mut self) -> Result<()> {
        CausalityAssigner::assign_causality(&mut self.combined_graph)
            .map_err(|e| crate::error::TupanError::InvalidState(format!("Causality error: {:?}", e)))
    }

    /// Get bond graph for simulation
    pub fn get_bond_graph(&self) -> &BondGraph {
        &self.combined_graph
    }
}

/// Domain conversion helpers
pub mod converters {
    //! Helper utilities for common domain conversions

    use super::*;

    /// Convert electrical resistance to thermal resistance
    /// Assumes steady-state heat transfer via ohmic heating
    ///
    /// # Formula
    /// R_thermal = R_electrical × dV/dT
    /// where dV/dT is thermal coefficient of the component
    pub fn electrical_to_thermal_resistance(
        r_electrical: f64,
        voltage_nominal: f64,
        thermal_coefficient: f64,
    ) -> f64 {
        // Power dissipation: P = V²/R
        // Thermal effect: Q = P × coefficient
        // Result: R_th = (dT/dQ) = coefficient / (V²/R) × (1/voltage)
        let power = voltage_nominal * voltage_nominal / r_electrical;
        thermal_coefficient / power
    }

    /// Convert mechanical damping to electrical resistance equivalent
    ///
    /// Useful for modeling mechanical systems with electrical feedback
    /// # Formula
    /// R_eq = b / (K × K_e)
    /// where b is damping coefficient, K is motor constant, K_e is back-EMF constant
    pub fn mechanical_to_electrical_resistance(damping: f64, motor_constant: f64) -> f64 {
        damping / (motor_constant * motor_constant)
    }

    /// Convert hydraulic system parameters to electrical equivalents
    ///
    /// Enables analog simulation of hydraulic systems using electrical circuits
    /// # Formula
    /// C_eq = (Bulk Modulus) / (System Volume)
    /// R_eq = Viscosity × Length / (Pipe Area)
    pub fn hydraulic_to_electrical_params(
        bulk_modulus: f64,
        volume: f64,
        viscosity: f64,
        pipe_length: f64,
        pipe_area: f64,
    ) -> (f64, f64) {
        let capacitance_eq = volume / bulk_modulus;
        let resistance_eq = viscosity * pipe_length / pipe_area;
        (capacitance_eq, resistance_eq)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_effort_flow_pair() {
        let pair = EffortFlowPair::new(5.0, 2.0);
        assert_eq!(pair.effort, 5.0);
        assert_eq!(pair.flow, 2.0);
        assert_eq!(pair.power(), 10.0);
        assert!(pair.is_valid());
    }

    #[test]
    fn test_invalid_effort_flow() {
        let pair = EffortFlowPair::new(f64::NAN, 2.0);
        assert!(!pair.is_valid());

        let pair = EffortFlowPair::new(5.0, f64::INFINITY);
        assert!(!pair.is_valid());
    }

    #[test]
    fn test_domain_builder() {
        let builder = DomainBuilder::new("Thermal")
            .with_metadata("ambient_temp".to_string(), "300".to_string())
            .with_time(0.5);

        assert_eq!(builder.name, "Thermal");
        assert_eq!(builder.time, 0.5);
        assert_eq!(builder.metadata.len(), 1);
    }

    #[test]
    fn test_multi_domain_system() {
        let mut system = MultiDomainSystem::new("Electro-Thermal");
        assert_eq!(system.name, "Electro-Thermal");
        assert_eq!(system.num_domains(), 0);

        let coupling = CouplingElement {
            from_domain: "Electrical".to_string(),
            to_domain: "Thermal".to_string(),
            coupling_type: "Ohmic_Heating".to_string(),
            parameter: "R".to_string(),
        };
        system.add_coupling(coupling);
        assert_eq!(system.couplings.len(), 1);
    }

    #[test]
    fn test_thermal_resistance_conversion() {
        let r_thermal = converters::electrical_to_thermal_resistance(
            1000.0,  // 1kΩ resistor
            5.0,     // 5V nominal
            0.1,     // thermal coefficient
        );
        assert!(r_thermal > 0.0);
    }

    #[test]
    fn test_mechanical_to_electrical_conversion() {
        let r_eq = converters::mechanical_to_electrical_resistance(
            0.1,   // damping coefficient
            0.05,  // motor constant
        );
        assert_eq!(r_eq, 0.1 / (0.05 * 0.05));
    }

    #[test]
    fn test_hydraulic_conversion() {
        let (c_eq, r_eq) = converters::hydraulic_to_electrical_params(
            2.0e9,   // bulk modulus
            0.001,   // volume
            0.001,   // viscosity
            1.0,     // pipe length
            0.0001,  // pipe area
        );
        assert!(c_eq > 0.0);
        assert!(r_eq > 0.0);
    }
}

impl MultiDomainSystem {
    /// Get number of domains in system
    pub fn num_domains(&self) -> usize {
        self.element_domains.iter().map(|(_, d)| d).collect::<std::collections::HashSet<_>>().len()
    }
}
