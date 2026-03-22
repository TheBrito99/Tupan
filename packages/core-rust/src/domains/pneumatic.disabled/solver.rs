//! Pneumatic System Solver
//!
//! Uses MNA with the analogy:
//! - Pressure (P) [Pa] ↔ Voltage (V) [V]
//! - Flow (Q) [m³/s] ↔ Current (I) [A]
//! - Pneumatic Resistance (R_p) [Pa·s/m³] ↔ Resistance (R) [Ω]
//! - Tank Volume (V) [m³] ↔ Capacitance (C) [F]
//!
//! Governing equation: G × P = Q
//! where G = 1/R_p (pneumatic conductance), P = pressure vector, Q = flow source vector
//!
//! Transient: (C/dt + G) × P_n = (C/dt) × P_{n-1} + Q
//! Note: For compressed gas, C represents tank volume/capacitance

use super::components::{PneumaticComponent, analysis};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Pneumatic system analyzer
/// Maps pneumatic components to MNA equation: G × P = Q
pub struct PneumaticAnalyzer {
    /// Component resistances [Pa·s/m³]
    resistances: HashMap<(usize, usize), f64>,
    /// Component capacitances [m³] (tank volumes)
    capacitances: HashMap<usize, f64>,
    /// Flow sources [m³/s] (compressors)
    flow_sources: HashMap<usize, f64>,
    /// Pressure sources [Pa]
    pressure_sources: HashMap<usize, f64>,
    /// Node count
    node_count: usize,
    /// Reference pressure [Pa] (atmosphere)
    atmosphere_pressure: f64,
}

impl PneumaticAnalyzer {
    /// Create new pneumatic analyzer
    pub fn new() -> Self {
        PneumaticAnalyzer {
            resistances: HashMap::new(),
            capacitances: HashMap::new(),
            flow_sources: HashMap::new(),
            pressure_sources: HashMap::new(),
            node_count: 0,
            atmosphere_pressure: 101325.0,  // 1 atm
        }
    }

    /// Set atmospheric (reference) pressure
    pub fn set_atmosphere_pressure(&mut self, pressure: f64) {
        self.atmosphere_pressure = pressure;
    }

    /// Build pneumatic circuit from components and connections
    fn build_circuit(
        &mut self,
        components: &[(usize, usize, PneumaticComponent)],
        flow_sources: &[(usize, f64)],
    ) -> Result<(), String> {
        // Clear previous state
        self.resistances.clear();
        self.capacitances.clear();
        self.flow_sources.clear();
        self.pressure_sources.clear();

        // Find maximum node index
        let mut max_node = 0;
        for (from, to, _comp) in components {
            if *from > max_node { max_node = *from; }
            if *to > max_node { max_node = *to; }
        }
        self.node_count = max_node + 1;

        // Process components
        for (from, to, comp) in components {
            comp.validate()?;

            // Extract resistance (Pa·s/m³)
            if let Some(r_p) = comp.get_resistance() {
                if r_p > 0.0 {
                    self.resistances.insert((*from, *to), r_p);
                }
            }

            // Extract capacitance (volume in m³)
            if let Some(cap) = comp.get_capacitance() {
                if cap > 0.0 {
                    self.capacitances.insert(*from, cap);
                }
            }

            // Extract flow source (m³/s)
            if let Some(q) = comp.get_flow() {
                if q > 0.0 {
                    self.flow_sources.insert(*from, q);
                }
            }

            // Extract pressure source (Pa)
            if let Some(p) = comp.get_pressure() {
                self.pressure_sources.insert(*from, p);
            }
        }

        // Add external flow sources
        for (node, flow) in flow_sources {
            *self.flow_sources.entry(*node).or_insert(0.0) += flow;
        }

        Ok(())
    }

    /// Solve steady-state pressure distribution
    /// G × P = Q where G is conductance matrix, P is pressure vector
    pub fn solve_steady_state(
        &mut self,
        components: &[(usize, usize, PneumaticComponent)],
        flow_sources: &[(usize, f64)],
    ) -> Result<Vec<f64>, String> {
        self.build_circuit(components, flow_sources)?;

        // Build conductance matrix: G = 1/R_p for each resistance
        let mut g_matrix = DMatrix::<f64>::zeros(self.node_count, self.node_count);
        for ((from, to), r_p) in &self.resistances {
            let g = 1.0 / r_p;  // conductance = 1/resistance
            g_matrix[(*from, *from)] += g;
            g_matrix[(*to, *to)] += g;
            g_matrix[(*from, *to)] -= g;
            g_matrix[(*to, *from)] -= g;
        }

        // Build flow source vector: Q (m³/s)
        let mut q_vector = DVector::<f64>::zeros(self.node_count);
        for (node, flow) in &self.flow_sources {
            q_vector[*node] += flow;
        }

        // Handle pressure sources by setting corresponding row
        for (node, pressure) in &self.pressure_sources {
            // Replace row with identity and set RHS to pressure value
            for j in 0..self.node_count {
                g_matrix[(*node, j)] = if j == *node { 1.0 } else { 0.0 };
            }
            q_vector[*node] = *pressure;
        }

        // Solve system: P = G^-1 × Q
        match g_matrix.try_inverse() {
            Some(g_inv) => {
                let pressures = g_inv * q_vector;
                Ok(pressures.as_slice().to_vec())
            }
            None => Err("Pneumatic system matrix is singular".to_string()),
        }
    }

    /// Solve transient (time-domain) pressure response
    /// (C/dt + G) × P_n = (C/dt) × P_{n-1} + Q
    /// Uses implicit Euler for stability
    pub fn solve_transient(
        &mut self,
        components: &[(usize, usize, PneumaticComponent)],
        flow_sources: &[(usize, f64)],
        duration: f64,
        time_step: f64,
    ) -> Result<(Vec<f64>, Vec<Vec<f64>>), String> {
        if duration <= 0.0 || time_step <= 0.0 {
            return Err("Duration and time step must be positive".to_string());
        }

        self.build_circuit(components, flow_sources)?;

        // Initial steady-state solution
        let mut p_current = self.solve_steady_state(components, flow_sources)?;

        // Build base conductance matrix
        let mut g_matrix = DMatrix::<f64>::zeros(self.node_count, self.node_count);
        for ((from, to), r_p) in &self.resistances {
            let g = 1.0 / r_p;
            g_matrix[(*from, *from)] += g;
            g_matrix[(*to, *to)] += g;
            g_matrix[(*from, *to)] -= g;
            g_matrix[(*to, *from)] -= g;
        }

        // Build capacitance contributions
        let mut c_over_dt = DVector::<f64>::zeros(self.node_count);
        for (node, cap) in &self.capacitances {
            c_over_dt[*node] = cap / time_step;
        }

        // Transient matrix: (C/dt + G)
        let mut transient_matrix = g_matrix.clone();
        for i in 0..self.node_count {
            transient_matrix[(i, i)] += c_over_dt[i];
        }

        // Time stepping
        let num_steps = ((duration / time_step) as usize).max(1);
        let mut times = vec![0.0];
        let mut pressures = vec![p_current.clone()];

        for step in 1..=num_steps {
            let time = step as f64 * time_step;

            // Build RHS: (C/dt) × P_{n-1} + Q
            let mut rhs = DVector::<f64>::zeros(self.node_count);
            for i in 0..self.node_count {
                rhs[i] = c_over_dt[i] * p_current[i];
            }
            for (node, flow) in &self.flow_sources {
                rhs[*node] += flow;
            }

            // Apply pressure sources
            let mut solver_matrix = transient_matrix.clone();
            let mut solver_rhs = rhs.clone();
            for (node, pressure) in &self.pressure_sources {
                for j in 0..self.node_count {
                    solver_matrix[(*node, j)] = if j == *node { 1.0 } else { 0.0 };
                }
                solver_rhs[*node] = *pressure;
            }

            // Solve for P_n
            match solver_matrix.try_inverse() {
                Some(inv) => {
                    p_current = (inv * solver_rhs).as_slice().to_vec();
                    times.push(time);
                    pressures.push(p_current.clone());
                }
                None => return Err("Transient system matrix became singular".to_string()),
            }
        }

        Ok((times, pressures))
    }

    /// Calculate system power [W]
    /// Power = ΣP × Q for each resistive element
    pub fn calculate_power(
        &self,
        pressures: &[f64],
    ) -> Result<f64, String> {
        if pressures.len() != self.node_count {
            return Err(format!(
                "Pressure vector size mismatch: expected {}, got {}",
                self.node_count,
                pressures.len()
            ));
        }

        let mut total_power = 0.0;
        for ((from, to), r_p) in &self.resistances {
            if *from < pressures.len() && *to < pressures.len() {
                let delta_p = pressures[*from] - pressures[*to];
                let flow = delta_p / r_p;
                let power = delta_p.abs() * flow.abs();
                total_power += power;
            }
        }

        Ok(total_power)
    }

    /// Get node count
    pub fn node_count(&self) -> usize {
        self.node_count
    }
}

/// Pneumatic validation helper
pub struct PneumaticValidator;

impl PneumaticValidator {
    /// Validate pneumatic system for analysis
    pub fn validate_system(
        components: &[(usize, usize, PneumaticComponent)],
    ) -> Result<(), String> {
        // Check component validity
        for (_, _, comp) in components {
            comp.validate()?;
        }

        // Check for at least one node
        if components.is_empty() {
            return Err("System must have at least one component".to_string());
        }

        // Check for at least one pressure or flow source
        let has_pressure = components.iter().any(|(_, _, c)| c.get_pressure().is_some());
        let has_flow = components.iter().any(|(_, _, c)| c.get_flow().is_some());
        if !has_pressure && !has_flow {
            return Err("System must have at least one pressure or flow source".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyzer_creation() {
        let analyzer = PneumaticAnalyzer::new();
        assert_eq!(analyzer.node_count(), 0);
    }

    #[test]
    fn test_simple_nozzle_steady_state() {
        let components = vec![
            (0, 1, PneumaticComponent::Nozzle { resistance: 5e6 }),
        ];
        let flow_sources = vec![(0, 0.001)];

        let mut analyzer = PneumaticAnalyzer::new();
        let pressures = analyzer.solve_steady_state(&components, &flow_sources)
            .expect("Steady-state solve failed");

        assert_eq!(pressures.len(), 2);
        assert!((pressures[0] - 5000.0).abs() < 100.0);
    }

    #[test]
    fn test_series_resistances() {
        let components = vec![
            (0, 1, PneumaticComponent::Nozzle { resistance: 2.5e6 }),
            (1, 2, PneumaticComponent::Nozzle { resistance: 2.5e6 }),
        ];
        let flow_sources = vec![(0, 0.001)];

        let mut analyzer = PneumaticAnalyzer::new();
        let pressures = analyzer.solve_steady_state(&components, &flow_sources)
            .expect("Series solve failed");

        assert_eq!(pressures.len(), 3);
        let total_drop = pressures[0] - pressures[2];
        assert!((total_drop - 5000.0).abs() < 300.0);
    }

    #[test]
    fn test_pipe_pressure_drop() {
        let pipe = PneumaticComponent::Pipe {
            length: 10.0,
            diameter: 0.015,
            roughness: 1e-5,
        };

        let components = vec![(0, 1, pipe)];
        let flow_sources = vec![(0, 0.001)];

        let mut analyzer = PneumaticAnalyzer::new();
        let pressures = analyzer.solve_steady_state(&components, &flow_sources)
            .expect("Pipe solve failed");

        assert!(pressures[0] > pressures[1]);
    }

    #[test]
    fn test_tank_steady_state() {
        let components = vec![
            (0, 1, PneumaticComponent::Tank { volume: 0.05, precharge: 101325.0 }),
        ];
        let flow_sources = vec![(0, 0.002)];

        let mut analyzer = PneumaticAnalyzer::new();
        let pressures = analyzer.solve_steady_state(&components, &flow_sources)
            .expect("Tank steady-state failed");

        assert_eq!(pressures.len(), 2);
        assert!(pressures[0] >= 0.0);
    }

    #[test]
    fn test_compressor_flow() {
        let components = vec![
            (0, 1, PneumaticComponent::Nozzle { resistance: 5e6 }),
        ];
        let flow_sources = vec![(0, 0.001)];

        let mut analyzer = PneumaticAnalyzer::new();
        let pressures = analyzer.solve_steady_state(&components, &flow_sources)
            .expect("Compressor test failed");

        let expected_pressure = 5e6 * 0.001;
        assert!((pressures[0] - expected_pressure).abs() < 100.0);
    }

    #[test]
    fn test_cylinder_force() {
        let pressure = 5e5;
        let area = 0.01;
        let force = analysis::cylinder_force(pressure, area);

        assert!((force - 5000.0).abs() < 1.0);
    }

    #[test]
    fn test_motor_torque() {
        let pressure = 5e5;
        let displacement = 100.0;
        let torque = analysis::motor_torque(pressure, displacement);
        assert!(torque > 0.0);
    }

    #[test]
    fn test_nozzle_flow() {
        let area = 1e-4;
        let pressure_drop = 1e5;
        let density = 1.204;

        let flow = analysis::nozzle_flow(area, pressure_drop, density)
            .expect("Nozzle flow calc failed");

        assert!(flow > 0.0);
    }

    #[test]
    fn test_tank_charge_time() {
        let volume = 0.05;
        let flow_rate = 0.002;
        let initial = 101325.0;
        let target = 5e5;

        let time = analysis::tank_charge_time(volume, flow_rate, initial, target)
            .expect("Charge time calc failed");

        assert!(time > 0.0);
    }

    #[test]
    fn test_transient_response() {
        let components = vec![
            (0, 1, PneumaticComponent::Tank { volume: 0.05, precharge: 101325.0 }),
        ];
        let flow_sources = vec![(0, 0.002)];

        let mut analyzer = PneumaticAnalyzer::new();
        let (times, pressures) = analyzer.solve_transient(&components, &flow_sources, 5.0, 0.1)
            .expect("Transient solve failed");

        assert!(times.len() > 30);
        assert_eq!(pressures.len(), times.len());
    }

    #[test]
    fn test_power_dissipation() {
        let components = vec![
            (0, 1, PneumaticComponent::Nozzle { resistance: 5e6 }),
        ];
        let flow_sources = vec![(0, 0.001)];

        let mut analyzer = PneumaticAnalyzer::new();
        let pressures = analyzer.solve_steady_state(&components, &flow_sources)
            .expect("Power test failed");

        let power = analyzer.calculate_power(&pressures)
            .expect("Power calculation failed");

        assert!((power - 5.0).abs() < 1.0);
    }

    #[test]
    fn test_invalid_system() {
        let components = vec![];
        assert!(PneumaticValidator::validate_system(&components).is_err());
    }

    #[test]
    fn test_system_time_constant() {
        let volume = 0.05;
        let flow_rate = 0.002;
        let tau = analysis::system_time_constant(volume, flow_rate)
            .expect("Time constant calc failed");

        assert_eq!(tau, 25.0);
    }

    #[test]
    fn test_relief_valve() {
        let valve = PneumaticComponent::PressureReliefValve {
            cracking_pressure: 5e5,
            flow_capacity: 0.01,
        };

        assert!(valve.validate().is_ok());
        assert!(valve.get_pressure().is_some());
    }
}
