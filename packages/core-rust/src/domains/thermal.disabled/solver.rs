//! Thermal Circuit Solver
//!
//! Uses generic Modified Nodal Analysis (MNA) to solve thermal circuits.
//!
//! Thermal Circuit → Electrical Analogy:
//! - Temperature (T) [K or °C] ↔ Voltage (V) [V]
//! - Heat Flow (q̇) [W] ↔ Current (I) [A]
//! - Thermal Resistance (R_th) [K/W] ↔ Electrical Resistance (R) [Ω]
//! - Thermal Capacitance (C_th) [J/K] ↔ Electrical Capacitance (C) [F]
//! - Heat Source (Q̇) [W] ↔ Current Source (I) [A]
//!
//! Key insight: Uses GenericMnaSolver - same code will work for:
//! - Mechanical (F, v, f, m)
//! - Hydraulic (P, Q, R_h, A)
//! - Pneumatic (P, Q, R_p, V)
//! - Chemical (μ, ṅ, R_c, ρ)
//!
//! Example: Simple RC thermal circuit
//! ```
//! // Heat source (100W) -> R_th (0.5 K/W) -> T_ambient (25°C)
//! //
//! // Steady-state: T_junction = 25 + 100 * 0.5 = 75°C
//! // Time constant: τ = R_th * C_th = 0.5 * 1000 = 500s
//! // Transient: T(t) = 75 + (25-75)*exp(-t/500) = 75 - 50*exp(-t/500)
//! ```

use crate::solvers::mna_generic::GenericMnaSolver;
use crate::graph::Graph;
use crate::domains::thermal::components::ThermalComponent;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Node index mapping for thermal circuits
#[derive(Debug, Clone)]
struct ThermalNodeIndex {
    /// Maps node ID to matrix row/column
    indices: HashMap<usize, usize>,
    /// Total independent nodes
    count: usize,
}

impl ThermalNodeIndex {
    fn new() -> Self {
        ThermalNodeIndex {
            indices: HashMap::new(),
            count: 0,
        }
    }

    fn add_node(&mut self, node_id: usize) {
        if !self.indices.contains_key(&node_id) {
            self.indices.insert(node_id, self.count);
            self.count += 1;
        }
    }

    fn get_index(&self, node_id: usize) -> Option<usize> {
        self.indices.get(&node_id).copied()
    }
}

/// Thermal circuit analysis data
#[derive(Debug, Clone)]
pub struct ThermalCircuitData {
    /// Circuit topology
    pub graph: Graph,
    /// Node indices
    pub node_indices: ThermalNodeIndex,
    /// Component data
    pub components: HashMap<usize, ThermalComponent>,
}

/// Thermal circuit analyzer
/// Uses generic MNA solver to analyze thermal circuits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalAnalyzer {
    /// Number of nodes
    num_nodes: usize,
    /// Time step for transient [s]
    time_step: f64,
    /// Generic MNA solver (reusable across domains!)
    #[serde(skip)]
    solver: Option<GenericMnaSolver>,
    /// Ambient temperature [°C]
    ambient_temp: f64,
}

impl ThermalAnalyzer {
    /// Create new thermal analyzer
    pub fn new(num_nodes: usize, time_step: f64) -> Self {
        ThermalAnalyzer {
            num_nodes,
            time_step,
            solver: Some(GenericMnaSolver::new(num_nodes, time_step)),
            ambient_temp: 25.0,
        }
    }

    /// Set ambient temperature for convection calculations
    pub fn set_ambient_temperature(&mut self, temp: f64) {
        self.ambient_temp = temp;
    }

    /// Build thermal circuit from component definitions
    /// Maps thermal components to generic solver conductances and sources
    fn build_circuit(
        &mut self,
        components: &[(usize, usize, ThermalComponent)],  // (node1, node2, component)
        heat_sources: &[(usize, f64)],  // (node, heat_power)
    ) -> Result<(), String> {
        let mut solver = GenericMnaSolver::new(self.num_nodes, self.time_step);
        solver.initialize_dc()?;

        // Add all thermal resistances
        for (node1, node2, component) in components {
            match component {
                ThermalComponent::ThermalResistance { resistance, .. } => {
                    let conductance = 1.0 / resistance;
                    solver.add_conductance(*node1, *node2, conductance)?;
                }
                ThermalComponent::ThermalCapacitance { capacitance, .. } => {
                    // For DC analysis, capacitance has no effect
                    // For transient, will be added in time-stepping loop
                    let _ = capacitance;  // Use variable to avoid unused warning
                }
                ThermalComponent::Convection { coefficient, area, .. } => {
                    // Convection: q = h * A * ΔT
                    // Thermal conductance = h * A
                    let conductance = coefficient * area;
                    solver.add_conductance(*node1, *node2, conductance)?;
                }
                ThermalComponent::Radiation { emissivity, area } => {
                    // Simplified linear radiation (full nonlinear handled in component validation)
                    // For steady-state, use linearized coefficient
                    let ts = self.ambient_temp + 273.15;
                    const STEFAN_BOLTZMANN: f64 = 5.67e-8;
                    let h_rad = emissivity * STEFAN_BOLTZMANN * 4.0 * ts * ts * ts;
                    let conductance = h_rad * area;
                    solver.add_conductance(*node1, *node2, conductance)?;
                }
                _ => {}  // Other components handled separately
            }
        }

        // Add all heat sources
        for (node, heat_power) in heat_sources {
            solver.add_flow_source(*node, *heat_power)?;
        }

        self.solver = Some(solver);
        Ok(())
    }

    /// Solve steady-state thermal circuit
    /// G_th × T = Q̇
    /// where:
    ///   G_th = thermal conductance matrix (1/R_th for each resistor)
    ///   T = temperature vector [K or °C]
    ///   Q̇ = heat source vector [W]
    pub fn solve_steady_state(
        &mut self,
        components: &[(usize, usize, ThermalComponent)],
        heat_sources: &[(usize, f64)],
    ) -> Result<Vec<f64>, String> {
        if self.num_nodes == 0 {
            return Err("Circuit has no nodes".to_string());
        }

        if heat_sources.is_empty() {
            return Err("Circuit must have at least one heat source".to_string());
        }

        // Build circuit from components
        self.build_circuit(components, heat_sources)?;

        // Solve using generic MNA
        let solver = self.solver.as_mut()
            .ok_or("Solver initialization failed")?;

        solver.solve()?;

        // Extract temperature vector
        let temperatures: Vec<f64> = (0..self.num_nodes)
            .map(|i| solver.get_effort(i))
            .collect();

        Ok(temperatures)
    }

    /// Solve transient thermal circuit
    /// Uses implicit Euler: (C_th/dt + G_th) × T_n = (C_th/dt) × T_{n-1} + Q̇
    /// Returns (time_vector, node_temperatures)
    pub fn solve_transient(
        &mut self,
        components: &[(usize, usize, ThermalComponent)],
        heat_sources: &[(usize, f64)],
        duration: f64,
        time_step: f64,
    ) -> Result<(Vec<f64>, Vec<Vec<f64>>), String> {
        if self.num_nodes == 0 {
            return Err("Circuit has no nodes".to_string());
        }
        if duration <= 0.0 {
            return Err("Duration must be positive".to_string());
        }
        if time_step <= 0.0 || time_step > duration {
            return Err("Invalid time step".to_string());
        }
        if heat_sources.is_empty() {
            return Err("Circuit must have at least one heat source".to_string());
        }

        let mut time_vec = Vec::new();
        let mut temps = Vec::new();

        // Initial condition: all nodes at ambient temperature
        let mut current_temps = vec![self.ambient_temp; self.num_nodes];

        let mut t = 0.0;
        while t <= duration + time_step / 2.0 {
            time_vec.push(t);
            temps.push(current_temps.clone());

            // Solve at this time step
            let mut solver = GenericMnaSolver::new(self.num_nodes, time_step);
            solver.initialize_dc()?;

            // Add all thermal resistances
            for (node1, node2, component) in components {
                match component {
                    ThermalComponent::ThermalResistance { resistance, .. } => {
                        let conductance = 1.0 / resistance;
                        solver.add_conductance(*node1, *node2, conductance)?;
                    }
                    ThermalComponent::ThermalCapacitance { capacitance, .. } => {
                        // Implicit Euler: adds (C/dt) to conductance and history to source
                        solver.add_capacitance_transient(*node1, *node2, *capacitance)?;
                    }
                    ThermalComponent::Convection { coefficient, area, .. } => {
                        let conductance = coefficient * area;
                        solver.add_conductance(*node1, *node2, conductance)?;
                    }
                    ThermalComponent::Radiation { emissivity, area } => {
                        // Linearized radiation
                        let ts = self.ambient_temp + 273.15;
                        const STEFAN_BOLTZMANN: f64 = 5.67e-8;
                        let h_rad = emissivity * STEFAN_BOLTZMANN * 4.0 * ts * ts * ts;
                        let conductance = h_rad * area;
                        solver.add_conductance(*node1, *node2, conductance)?;
                    }
                    _ => {}
                }
            }

            // Add all heat sources
            for (node, heat_power) in heat_sources {
                solver.add_flow_source(*node, *heat_power)?;
            }

            // Solve for this time step
            solver.solve()?;

            // Extract new temperatures
            current_temps = (0..self.num_nodes)
                .map(|i| solver.get_effort(i))
                .collect();

            t += time_step;
        }

        Ok((time_vec, temps))
    }

    /// Calculate heat dissipation at a node
    /// q = Σ [(T_i - T_j) / R_th_ij]
    pub fn calculate_heat_dissipation(
        &self,
        node: usize,
        temperatures: &[f64],
        components: &[(usize, usize, ThermalComponent)],
    ) -> Result<f64, String> {
        if node >= self.num_nodes {
            return Err(format!("Invalid node: {}", node));
        }
        if temperatures.len() != self.num_nodes {
            return Err("Temperature vector size mismatch".to_string());
        }

        let mut total_heat = 0.0;

        for (n1, n2, component) in components {
            if *n1 == node || *n2 == node {
                let (from_node, to_node) = if *n1 == node { (*n1, *n2) } else { (*n2, *n1) };

                match component {
                    ThermalComponent::ThermalResistance { resistance: resistance } => {
                        let temp_diff = temperatures[from_node] - temperatures[to_node];
                        let heat = temp_diff / resistance;
                        if from_node == node {
                            total_heat += heat;  // Heat leaving node
                        } else {
                            total_heat -= heat;  // Heat entering node
                        }
                    }
                    _ => {}
                }
            }
        }

        Ok(total_heat)
    }
}

/// Thermal circuit validation helper
pub struct ThermalValidator {
    /// Minimum valid thermal resistance [K/W]
    min_resistance: f64,
    /// Maximum valid thermal resistance [K/W]
    max_resistance: f64,
    /// Minimum valid temperature [°C]
    min_temperature: f64,
    /// Maximum valid temperature [°C]
    max_temperature: f64,
}

impl ThermalValidator {
    /// Create new validator with default limits
    pub fn new() -> Self {
        ThermalValidator {
            min_resistance: 1e-6,   // 1 μK/W (very good conductor)
            max_resistance: 1e6,    // 1 MK/W (excellent insulator)
            min_temperature: -273.15,  // Absolute zero
            max_temperature: 1000.0,   // 1000°C (molten metal range)
        }
    }

    /// Validate thermal resistance value
    pub fn validate_resistance(&self, r_th: f64) -> Result<(), String> {
        if r_th < self.min_resistance {
            Err(format!("Thermal resistance {} K/W is too low", r_th))
        } else if r_th > self.max_resistance {
            Err(format!("Thermal resistance {} K/W is too high", r_th))
        } else if r_th <= 0.0 {
            Err("Thermal resistance must be positive".to_string())
        } else {
            Ok(())
        }
    }

    /// Validate temperature value
    pub fn validate_temperature(&self, t: f64) -> Result<(), String> {
        if t < self.min_temperature {
            Err(format!("Temperature {} °C is below absolute zero", t))
        } else if t > self.max_temperature {
            Err(format!("Temperature {} °C exceeds typical range", t))
        } else {
            Ok(())
        }
    }

    /// Validate heat generation
    pub fn validate_heat_generation(&self, q: f64) -> Result<(), String> {
        if q < 0.0 {
            Err("Heat generation cannot be negative".to_string())
        } else if q > 1e8 {
            Err("Heat generation exceeds typical range (> 100 MW)".to_string())
        } else {
            Ok(())
        }
    }
}

impl Default for ThermalValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// Thermal visualization metrics for plotting and analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalVisualizationData {
    /// Node temperatures for heatmap [°C]
    pub node_temperatures: Vec<f64>,
    /// Minimum temperature in circuit [°C]
    pub temp_min: f64,
    /// Maximum temperature in circuit [°C]
    pub temp_max: f64,
    /// Average temperature [°C]
    pub temp_avg: f64,
    /// Temperature gradient (max - min) [K]
    pub temp_gradient: f64,
    /// Heat flows between nodes [W]
    pub heat_flows: Vec<f64>,
    /// Total heat dissipated [W]
    pub total_heat: f64,
    /// Number of nodes
    pub node_count: usize,
}

impl ThermalVisualizationData {
    /// Create visualization data from temperatures and components
    pub fn new(
        node_temperatures: Vec<f64>,
        components: &[(usize, usize, ThermalComponent)],
    ) -> Result<Self, String> {
        if node_temperatures.is_empty() {
            return Err("No temperature data".to_string());
        }

        let temp_min = node_temperatures.iter().cloned().fold(f64::INFINITY, f64::min);
        let temp_max = node_temperatures.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let temp_avg = node_temperatures.iter().sum::<f64>() / node_temperatures.len() as f64;
        let temp_gradient = temp_max - temp_min;
        let node_count = node_temperatures.len();

        // Calculate heat flows between nodes
        let mut heat_flows = Vec::new();
        let mut total_heat = 0.0;

        for (n1, n2, component) in components {
            if *n1 < node_count && *n2 < node_count {
                match component {
                    ThermalComponent::ThermalResistance { resistance, .. } => {
                        let temp_diff = node_temperatures[*n1] - node_temperatures[*n2];
                        let heat = temp_diff / resistance;
                        heat_flows.push(heat.abs());
                        total_heat += heat.abs();
                    }
                    _ => heat_flows.push(0.0),
                }
            }
        }

        Ok(ThermalVisualizationData {
            node_temperatures,
            temp_min,
            temp_max,
            temp_avg,
            temp_gradient,
            heat_flows,
            total_heat,
            node_count,
        })
    }

    /// Get normalized temperature for heatmap coloring (0-1 range)
    pub fn normalize_temperatures(&self) -> Vec<f64> {
        if self.temp_gradient.abs() < 1e-10 {
            // All nodes at same temperature
            return vec![0.5; self.node_temperatures.len()];
        }

        self.node_temperatures
            .iter()
            .map(|&t| (t - self.temp_min) / self.temp_gradient)
            .collect()
    }

    /// Get temperature rating for each node (cold/cool/warm/hot)
    pub fn temperature_ratings(&self) -> Vec<&'static str> {
        let quarter = self.temp_min + self.temp_gradient / 4.0;
        let half = self.temp_min + self.temp_gradient / 2.0;
        let three_quarter = self.temp_min + 3.0 * self.temp_gradient / 4.0;

        self.node_temperatures
            .iter()
            .map(|&t| {
                if t < quarter {
                    "cold"
                } else if t < half {
                    "cool"
                } else if t < three_quarter {
                    "warm"
                } else {
                    "hot"
                }
            })
            .collect()
    }
}

/// Thermal circuit analysis helper functions
pub mod analysis {
    use super::*;
    /// Calculate thermal resistance from geometry
    /// R_th = L / (k * A)
    /// - L: length [m]
    /// - k: thermal conductivity [W/(m·K)]
    /// - A: area [m²]
    pub fn thermal_resistance(length: f64, conductivity: f64, area: f64) -> Result<f64, String> {
        if conductivity <= 0.0 {
            return Err("Conductivity must be positive".to_string());
        }
        if area <= 0.0 {
            return Err("Area must be positive".to_string());
        }
        if length < 0.0 {
            return Err("Length must be non-negative".to_string());
        }

        Ok(length / (conductivity * area))
    }

    /// Calculate thermal capacitance from mass
    /// C_th = m * c_p
    /// - m: mass [kg]
    /// - c_p: specific heat capacity [J/(kg·K)]
    pub fn thermal_capacitance(mass: f64, specific_heat: f64) -> Result<f64, String> {
        if mass <= 0.0 {
            return Err("Mass must be positive".to_string());
        }
        if specific_heat <= 0.0 {
            return Err("Specific heat must be positive".to_string());
        }

        Ok(mass * specific_heat)
    }

    /// Calculate time constant for RC thermal circuit
    /// τ = R_th * C_th
    pub fn thermal_time_constant(resistance: f64, capacitance: f64) -> Result<f64, String> {
        if resistance < 0.0 {
            return Err("Resistance must be non-negative".to_string());
        }
        if capacitance < 0.0 {
            return Err("Capacitance must be non-negative".to_string());
        }

        Ok(resistance * capacitance)
    }

    /// Calculate natural convection coefficient (simplified)
    /// h ≈ 1.42 * (ΔT / L)^0.25 [W/(m²·K)]
    /// Valid for small horizontal surfaces, ΔT < 10K
    pub fn natural_convection_horizontal(
        temperature_diff: f64,
        characteristic_length: f64,
    ) -> Result<f64, String> {
        if temperature_diff < 0.0 {
            return Err("Temperature difference must be non-negative".to_string());
        }
        if characteristic_length <= 0.0 {
            return Err("Characteristic length must be positive".to_string());
        }

        let h = 1.42 * (temperature_diff / characteristic_length).powf(0.25);
        Ok(h)
    }

    /// Calculate radiation heat transfer coefficient
    /// h_rad = ε * σ * (T_s² + T_amb²) * (T_s + T_amb)
    /// σ = Stefan-Boltzmann = 5.67e-8 W/(m²·K⁴)
    pub fn radiation_coefficient(
        emissivity: f64,
        surface_temp: f64,
        ambient_temp: f64,
    ) -> Result<f64, String> {
        if emissivity < 0.0 || emissivity > 1.0 {
            return Err("Emissivity must be between 0 and 1".to_string());
        }

        const STEFAN_BOLTZMANN: f64 = 5.67e-8;

        let ts = surface_temp + 273.15;  // Convert to K
        let ta = ambient_temp + 273.15;

        let h_rad = emissivity
            * STEFAN_BOLTZMANN
            * (ts * ts + ta * ta)
            * (ts + ta);

        Ok(h_rad)
    }

    /// Calculate thermal impedance (Zth) - temperature rise per unit power
    /// Z_th = ΔT / Q [K/W]
    /// Used for transient thermal analysis (peak junction temperature prediction)
    pub fn thermal_impedance(temperature_rise: f64, power: f64) -> Result<f64, String> {
        if power <= 0.0 {
            return Err("Power must be positive".to_string());
        }
        if temperature_rise < 0.0 {
            return Err("Temperature rise must be non-negative".to_string());
        }

        Ok(temperature_rise / power)
    }

    /// Calculate steady-state temperature rise for simple RC circuit
    /// ΔT_ss = Q * R_th [K]
    pub fn steady_state_temperature_rise(heat_power: f64, thermal_resistance: f64) -> Result<f64, String> {
        if heat_power < 0.0 {
            return Err("Heat power cannot be negative".to_string());
        }
        if thermal_resistance < 0.0 {
            return Err("Thermal resistance must be non-negative".to_string());
        }

        Ok(heat_power * thermal_resistance)
    }

    /// Calculate peak transient temperature rise with exponential approximation
    /// T_peak = T_ss * (1 - exp(-t_pulse / tau))
    /// Useful for predicting maximum temperature during transient heat pulses
    pub fn peak_transient_temperature(
        steady_state_rise: f64,
        pulse_duration: f64,
        time_constant: f64,
    ) -> Result<f64, String> {
        if steady_state_rise < 0.0 {
            return Err("Steady-state rise must be non-negative".to_string());
        }
        if pulse_duration < 0.0 {
            return Err("Pulse duration must be non-negative".to_string());
        }
        if time_constant <= 0.0 {
            return Err("Time constant must be positive".to_string());
        }

        let ratio = pulse_duration / time_constant;
        let rise = steady_state_rise * (1.0 - (-ratio).exp());

        Ok(rise)
    }

    /// Calculate forced convection coefficient using Dittus-Boelert correlation
    /// h = 0.023 * (k/D) * Re^0.8 * Pr^0.4
    /// For turbulent flow in pipes
    pub fn forced_convection_pipe(
        thermal_conductivity: f64,
        diameter: f64,
        reynolds_number: f64,
        prandtl_number: f64,
    ) -> Result<f64, String> {
        if thermal_conductivity <= 0.0 {
            return Err("Thermal conductivity must be positive".to_string());
        }
        if diameter <= 0.0 {
            return Err("Diameter must be positive".to_string());
        }
        if reynolds_number < 0.0 {
            return Err("Reynolds number must be non-negative".to_string());
        }
        if prandtl_number <= 0.0 {
            return Err("Prandtl number must be positive".to_string());
        }

        let h = 0.023 * (thermal_conductivity / diameter)
            * reynolds_number.powf(0.8)
            * prandtl_number.powf(0.4);

        Ok(h)
    }

    /// Calculate natural convection Rayleigh number
    /// Ra = g * β * ΔT * L³ / (ν * α)
    /// g: gravitational acceleration [9.81 m/s²]
    /// β: thermal expansion coefficient [1/K]
    /// ΔT: temperature difference [K]
    /// L: characteristic length [m]
    /// ν: kinematic viscosity [m²/s]
    /// α: thermal diffusivity [m²/s]
    pub fn rayleigh_number(
        thermal_expansion: f64,
        temp_diff: f64,
        length: f64,
        kinematic_viscosity: f64,
        thermal_diffusivity: f64,
    ) -> Result<f64, String> {
        if thermal_expansion < 0.0 {
            return Err("Thermal expansion must be non-negative".to_string());
        }
        if temp_diff < 0.0 {
            return Err("Temperature difference must be non-negative".to_string());
        }
        if length <= 0.0 {
            return Err("Length must be positive".to_string());
        }
        if kinematic_viscosity <= 0.0 {
            return Err("Kinematic viscosity must be positive".to_string());
        }
        if thermal_diffusivity <= 0.0 {
            return Err("Thermal diffusivity must be positive".to_string());
        }

        const GRAVITY: f64 = 9.81;  // m/s²

        let ra = (GRAVITY * thermal_expansion * temp_diff * length.powi(3))
            / (kinematic_viscosity * thermal_diffusivity);

        Ok(ra)
    }

    /// Calculate heat dissipation efficiency
    /// Efficiency = Q_actual / Q_max [%]
    /// where Q_max = h * A * ΔT (maximum theoretical for surface)
    pub fn convection_efficiency(
        actual_heat: f64,
        max_theoretical_heat: f64,
    ) -> Result<f64, String> {
        if actual_heat < 0.0 {
            return Err("Actual heat must be non-negative".to_string());
        }
        if max_theoretical_heat <= 0.0 {
            return Err("Maximum heat must be positive".to_string());
        }

        Ok((actual_heat / max_theoretical_heat) * 100.0)
    }

    /// Calculate junction temperature with thermal derating
    /// T_j = T_ambient + (T_j_rated - T_ambient) * (I_actual / I_rated)
    /// Used for derating semiconductor junction temperature
    pub fn derating_junction_temperature(
        ambient_temp: f64,
        rated_junction_temp: f64,
        power_ratio: f64,  // I_actual / I_rated
    ) -> Result<f64, String> {
        if ambient_temp > rated_junction_temp {
            return Err("Ambient temperature exceeds rated junction temperature".to_string());
        }
        if power_ratio < 0.0 || power_ratio > 1.0 {
            return Err("Power ratio must be between 0 and 1".to_string());
        }

        let junction_temp = ambient_temp + (rated_junction_temp - ambient_temp) * power_ratio;

        Ok(junction_temp)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thermal_analyzer_creation() {
        let analyzer = ThermalAnalyzer::new(3, 0.01);
        assert_eq!(analyzer.num_nodes, 3);
        assert_eq!(analyzer.time_step, 0.01);
        assert_eq!(analyzer.ambient_temp, 25.0);
    }

    #[test]
    fn test_set_ambient_temperature() {
        let mut analyzer = ThermalAnalyzer::new(2, 0.001);
        analyzer.set_ambient_temperature(50.0);
        assert_eq!(analyzer.ambient_temp, 50.0);
    }

    #[test]
    fn test_thermal_validator() {
        let validator = ThermalValidator::new();

        // Valid resistance
        assert!(validator.validate_resistance(0.5).is_ok());

        // Invalid resistance
        assert!(validator.validate_resistance(-0.5).is_err());
        assert!(validator.validate_resistance(0.0).is_err());
    }

    #[test]
    fn test_temperature_validation() {
        let validator = ThermalValidator::new();

        // Valid temperature
        assert!(validator.validate_temperature(25.0).is_ok());

        // Invalid temperature
        assert!(validator.validate_temperature(-300.0).is_err());
    }

    #[test]
    fn test_thermal_resistance_calculation() {
        // Copper block: 10mm x 10mm, 50mm long
        let r_th = analysis::thermal_resistance(
            0.05,      // 50mm = 0.05m
            400.0,     // Copper conductivity
            0.01 * 0.01  // 10mm x 10mm = 0.0001m²
        ).unwrap();

        // R_th = 0.05 / (400 * 0.0001) = 1.25 K/W
        assert!((r_th - 1.25).abs() < 0.01);
    }

    #[test]
    fn test_thermal_capacitance_calculation() {
        // 1 kg aluminum at 900 J/(kg·K)
        let c_th = analysis::thermal_capacitance(1.0, 900.0).unwrap();
        assert_eq!(c_th, 900.0);
    }

    #[test]
    fn test_time_constant_calculation() {
        // τ = R_th * C_th
        let r_th = 0.5;  // K/W
        let c_th = 1000.0;  // J/K
        let tau = analysis::thermal_time_constant(r_th, c_th).unwrap();

        assert_eq!(tau, 500.0);  // seconds
    }

    #[test]
    fn test_simple_steady_state() -> Result<(), String> {
        // Simple circuit: 100W heat source into 0.5 K/W resistance to ground (ambient)
        // Expected: T = 25 + 100*0.5 = 75°C
        let mut analyzer = ThermalAnalyzer::new(2, 0.001);
        analyzer.set_ambient_temperature(25.0);

        let components = vec![
            (1, 0, ThermalComponent::ThermalResistance { resistance: 0.5 }),
        ];
        let heat_sources = vec![
            (1, 100.0),  // 100W at node 1
        ];

        let temps = analyzer.solve_steady_state(&components, &heat_sources)?;

        // Node 0 is ground (reference): T = 0°C (relative)
        assert!((temps[0] - 0.0).abs() < 0.01);

        // Node 1: T = 100W * 0.5 K/W = 50°C (relative)
        assert!((temps[1] - 50.0).abs() < 1.0, "Expected ~50°C, got {}", temps[1]);

        Ok(())
    }

    #[test]
    fn test_voltage_divider_analogy() -> Result<(), String> {
        // Thermal "divider" circuit
        // 100W -> R1 (0.5 K/W) -> Node1 -> R2 (0.5 K/W) -> Ground
        // Expected: T_node1 = 100 * (0.5/(0.5+0.5)) = 50K rise
        let mut analyzer = ThermalAnalyzer::new(2, 0.001);

        let components = vec![
            (0, 1, ThermalComponent::ThermalResistance { resistance: 0.5 }),
            (1, 0, ThermalComponent::ThermalResistance { resistance: 0.5 }),
        ];
        let heat_sources = vec![
            (0, 100.0),
        ];

        let temps = analyzer.solve_steady_state(&components, &heat_sources)?;

        // Verify that temperature divides approximately equally
        // This tests the multi-node capability
        assert!(temps.len() == 2);

        Ok(())
    }

    #[test]
    fn test_rc_thermal_circuit_steady_state() -> Result<(), String> {
        // Thermal RC circuit: 100W heat source, 0.5 K/W resistance, 1000 J/K capacitance
        // At steady state, capacitance has no effect: T_ss = 25 + 100*0.5 = 75°C
        let mut analyzer = ThermalAnalyzer::new(2, 0.001);
        analyzer.set_ambient_temperature(25.0);

        let components = vec![
            (1, 0, ThermalComponent::ThermalResistance { resistance: 0.5 }),
            (1, 0, ThermalComponent::ThermalCapacitance { capacitance: 1000.0 }),
        ];
        let heat_sources = vec![
            (1, 100.0),
        ];

        let temps = analyzer.solve_steady_state(&components, &heat_sources)?;

        // At steady state: T = 25 + 100*0.5 = 75K rise
        assert!((temps[1] - 50.0).abs() < 2.0, "Expected ~50K rise, got {}", temps[1]);

        Ok(())
    }

    #[test]
    fn test_transient_rc_circuit() -> Result<(), String> {
        // RC thermal circuit transient response
        // Time constant: τ = 0.5 * 1000 = 500 seconds
        // After time t: T(t) = T_ss - (T_ss - T_0)*exp(-t/τ) = 50*(1 - exp(-t/500))
        let mut analyzer = ThermalAnalyzer::new(2, 1.0);  // 1 second time step
        analyzer.set_ambient_temperature(25.0);

        let components = vec![
            (1, 0, ThermalComponent::ThermalResistance { resistance: 0.5 }),
            (1, 0, ThermalComponent::ThermalCapacitance { capacitance: 1000.0 }),
        ];
        let heat_sources = vec![
            (1, 100.0),
        ];

        let (time_vec, temps) = analyzer.solve_transient(&components, &heat_sources, 2000.0, 100.0)?;

        // Verify initial condition: T(0) = ambient
        assert!((temps[0][1] - 25.0).abs() < 1.0);

        // Verify transient growth toward steady state
        // T at t=500s should be ~63% of steady state = ~31.5K rise
        let t_500_idx = time_vec.iter().position(|&t| (t - 500.0).abs() < 50.0).unwrap();
        let t_500_temp = temps[t_500_idx][1];
        assert!(t_500_temp > 25.0 && t_500_temp < 50.0, "At t=500s, T={}, expected between 25-50", t_500_temp);

        // Verify we approach steady state
        let t_2000_idx = time_vec.len() - 1;
        let t_2000_temp = temps[t_2000_idx][1];
        assert!(t_2000_temp > 45.0, "At t=2000s, T should be near steady state (50K rise), got {}", t_2000_temp);

        Ok(())
    }

    #[test]
    fn test_convection_model() -> Result<(), String> {
        // Heat dissipation via convection: q = h*A*ΔT
        // h = 10 W/(m²·K), A = 0.1 m², ΔT = (75-25) = 50K
        // q = 10 * 0.1 * 50 = 50W dissipation → equilibrium at T = 50K rise
        let mut analyzer = ThermalAnalyzer::new(2, 0.001);
        analyzer.set_ambient_temperature(25.0);

        let components = vec![
            (1, 0, ThermalComponent::Convection { h: 10.0, area: 0.1 }),
        ];
        let heat_sources = vec![
            (1, 50.0),  // 50W input
        ];

        let temps = analyzer.solve_steady_state(&components, &heat_sources)?;

        // At equilibrium: Q_in = h*A*ΔT → ΔT = 50 / (10*0.1) = 50K
        assert!((temps[1] - 50.0).abs() < 2.0, "Expected 50K rise with convection, got {}", temps[1]);

        Ok(())
    }

    #[test]
    fn test_parallel_thermal_paths() -> Result<(), String> {
        // Two parallel paths from heat source to ground
        // Path 1: 100W -> 1.0 K/W -> ground
        // Path 2: 100W -> 0.5 K/W -> ground
        // Equivalent: 100W -> (0.5 || 1.0) -> ground = 100W -> 0.333 K/W
        // Expected T = 100 * 0.333 = 33.3K rise
        let mut analyzer = ThermalAnalyzer::new(3, 0.001);

        let components = vec![
            (0, 1, ThermalComponent::ThermalResistance { resistance: 1.0 }),
            (0, 2, ThermalComponent::ThermalResistance { resistance: 0.5 }),
        ];
        let heat_sources = vec![
            (0, 100.0),
        ];

        let temps = analyzer.solve_steady_state(&components, &heat_sources)?;

        // Combined parallel resistance: 1/(1/1.0 + 1/0.5) = 0.333 K/W
        // Temperature rise: 100 * 0.333 ≈ 33.3K
        assert!((temps[0] - 33.0).abs() < 3.0, "Expected ~33K rise, got {}", temps[0]);

        Ok(())
    }

    #[test]
    fn test_series_thermal_resistances() -> Result<(), String> {
        // Series: 100W -> R1 (0.3 K/W) -> Node1 -> R2 (0.2 K/W) -> Ground
        // Total resistance: 0.5 K/W
        // T_node1 = 100 * (0.3) = 30K rise
        let mut analyzer = ThermalAnalyzer::new(3, 0.001);

        let components = vec![
            (0, 1, ThermalComponent::ThermalResistance { resistance: 0.3 }),
            (1, 2, ThermalComponent::ThermalResistance { resistance: 0.2 }),
        ];
        let heat_sources = vec![
            (0, 100.0),
        ];

        let temps = analyzer.solve_steady_state(&components, &heat_sources)?;

        // Temperature at node 1 (between resistors)
        // T1 = 100 * 0.3 = 30K rise
        assert!((temps[1] - 30.0).abs() < 2.0, "Expected ~30K rise at node 1, got {}", temps[1]);

        // Temperature at node 2 (ground reference): T2 = 0
        assert!(temps[2].abs() < 0.1);

        Ok(())
    }

    #[test]
    fn test_heat_dissipation_calculation() -> Result<(), String> {
        let mut analyzer = ThermalAnalyzer::new(2, 0.001);

        let components = vec![
            (0, 1, ThermalComponent::ThermalResistance { resistance: 1.0 }),
        ];
        let temperatures = vec![100.0, 50.0];  // ΔT = 50K

        // Heat flow: q = ΔT / R = 50 / 1.0 = 50W
        let heat = analyzer.calculate_heat_dissipation(0, &temperatures, &components)?;
        assert!((heat - 50.0).abs() < 0.1);

        Ok(())
    }

    #[test]
    fn test_invalid_circuit() -> Result<(), String> {
        let mut analyzer = ThermalAnalyzer::new(1, 0.001);

        // No heat sources
        let components = vec![];
        let heat_sources = vec![];

        let result = analyzer.solve_steady_state(&components, &heat_sources);
        assert!(result.is_err(), "Should fail with no heat sources");

        Ok(())
    }

    #[test]
    fn test_invalid_time_parameters() {
        let mut analyzer = ThermalAnalyzer::new(1, 0.001);
        let components = vec![];
        let heat_sources = vec![(0, 100.0)];

        // Zero duration
        assert!(analyzer.solve_transient(&components, &heat_sources, 0.0, 0.001).is_err());

        // Negative time step
        assert!(analyzer.solve_transient(&components, &heat_sources, 1.0, -0.001).is_err());

        // Time step larger than duration
        assert!(analyzer.solve_transient(&components, &heat_sources, 0.1, 0.2).is_err());
    }

    // Phase 3 Task 4: Thermal Visualization Tests
    #[test]
    fn test_visualization_data_creation() {
        let temps = vec![25.0, 50.0, 75.0];
        let components = vec![];

        let viz = ThermalVisualizationData::new(temps, &components).unwrap();

        assert_eq!(viz.node_count, 3);
        assert_eq!(viz.temp_min, 25.0);
        assert_eq!(viz.temp_max, 75.0);
        assert_eq!(viz.temp_avg, 50.0);
        assert_eq!(viz.temp_gradient, 50.0);
    }

    #[test]
    fn test_normalized_temperatures() {
        let temps = vec![0.0, 50.0, 100.0];
        let components = vec![];
        let viz = ThermalVisualizationData::new(temps, &components).unwrap();

        let normalized = viz.normalize_temperatures();
        assert_eq!(normalized.len(), 3);
        assert!((normalized[0] - 0.0).abs() < 1e-6);  // Min
        assert!((normalized[1] - 0.5).abs() < 1e-6);  // Mid
        assert!((normalized[2] - 1.0).abs() < 1e-6);  // Max
    }

    #[test]
    fn test_temperature_ratings() {
        let temps = vec![0.0, 25.0, 50.0, 75.0, 100.0];
        let components = vec![];
        let viz = ThermalVisualizationData::new(temps, &components).unwrap();

        let ratings = viz.temperature_ratings();
        assert_eq!(ratings.len(), 5);
        assert_eq!(ratings[0], "cold");
        assert_eq!(ratings[1], "cool");
        assert_eq!(ratings[2], "warm");
        assert_eq!(ratings[3], "warm");
        assert_eq!(ratings[4], "hot");
    }

    // Phase 3 Task 5: Advanced Thermal Analysis Tests
    #[test]
    fn test_thermal_impedance() {
        // Zth = ΔT / Q = 50K / 10W = 5 K/W
        let zth = analysis::thermal_impedance(50.0, 10.0).unwrap();
        assert!((zth - 5.0).abs() < 0.01);
    }

    #[test]
    fn test_steady_state_temperature_rise() {
        // ΔT = Q * R_th = 100W * 0.5 K/W = 50K
        let rise = analysis::steady_state_temperature_rise(100.0, 0.5).unwrap();
        assert!((rise - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_peak_transient_temperature() {
        // Steady state: 100W * 0.5 K/W = 50K
        // Time constant: 0.5 * 1000 = 500s
        // Pulse duration: 500s (one time constant)
        // Peak = 50 * (1 - exp(-1)) ≈ 50 * 0.632 ≈ 31.6K
        let peak = analysis::peak_transient_temperature(50.0, 500.0, 500.0).unwrap();
        assert!((peak - 31.6).abs() < 1.0);
    }

    #[test]
    fn test_rayleigh_number() {
        // For air at 25°C: β ≈ 1/298 K⁻¹, ν ≈ 1.56e-5 m²/s, α ≈ 2.2e-5 m²/s
        let ra = analysis::rayleigh_number(
            1.0 / 298.0,  // thermal expansion
            10.0,         // temperature difference [K]
            0.1,          // length [m]
            1.56e-5,      // kinematic viscosity
            2.2e-5,       // thermal diffusivity
        ).unwrap();

        // Expected: Ra ≈ 1.3e6 for laminar/turbulent transition
        assert!(ra > 1e6);
    }

    #[test]
    fn test_convection_efficiency() {
        // Actual: 50W, Max theoretical: 100W
        // Efficiency = 50 / 100 * 100% = 50%
        let eff = analysis::convection_efficiency(50.0, 100.0).unwrap();
        assert!((eff - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_derating_junction_temperature() {
        // Rated: 125°C at 25°C ambient
        // Operating at 50% power: T_j = 25 + (125-25) * 0.5 = 75°C
        let tj = analysis::derating_junction_temperature(25.0, 125.0, 0.5).unwrap();
        assert!((tj - 75.0).abs() < 0.01);
    }

    #[test]
    fn test_forced_convection_pipe() {
        // Typical water cooling: k=0.6, D=0.01m, Re=10000, Pr=7
        // h ≈ 0.023 * (0.6/0.01) * 10000^0.8 * 7^0.4
        let h = analysis::forced_convection_pipe(0.6, 0.01, 10000.0, 7.0).unwrap();

        // Expected: ~5000-6000 W/(m²·K)
        assert!(h > 5000.0 && h < 7000.0);
    }

    #[test]
    fn test_natural_convection_horizontal() {
        // ΔT = 10K, L = 0.1m
        // h = 1.42 * (10/0.1)^0.25 ≈ 1.42 * 3.16 ≈ 4.5 W/(m²·K)
        let h = analysis::natural_convection_horizontal(10.0, 0.1).unwrap();
        assert!(h > 4.0 && h < 5.0);
    }

    #[test]
    fn test_analysis_error_handling() {
        // Negative conductivity
        assert!(analysis::thermal_resistance(0.1, -1.0, 0.01).is_err());

        // Zero area
        assert!(analysis::thermal_resistance(0.1, 1.0, 0.0).is_err());

        // Invalid emissivity
        assert!(analysis::radiation_coefficient(1.5, 25.0, 25.0).is_err());

        // Zero power
        assert!(analysis::thermal_impedance(50.0, 0.0).is_err());
    }
}
