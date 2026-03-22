//! Generic Modified Nodal Analysis Solver
//!
//! Domain-agnostic MNA implementation usable across:
//! - Electrical circuits (V, I, R, C)
//! - Thermal circuits (T, q, R_th, C_th)
//! - Mechanical systems (F, v, f, m)
//! - Hydraulic systems (P, Q, R_h, A)
//! - Pneumatic systems (P, Q, R_p, V)
//! - Chemical systems (μ, ṅ, R_c, ρ)
//!
//! Core equation: G × X = Y
//! - G = conductance matrix (1/R for each domain)
//! - X = effort vector (V, T, F, P, μ)
//! - Y = flow source vector (I, q̇, v, Q, ṅ)

use nalgebra::{DMatrix, DVector, LU};
use serde::{Deserialize, Serialize};

/// Generic MNA solver for any domain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericMnaSolver {
    /// Number of independent nodes
    num_nodes: usize,
    /// Conductance matrix (G)
    g_matrix: Option<DMatrix<f64>>,
    /// Flow source vector (Y)
    y_vector: Option<DVector<f64>>,
    /// Effort vector solution (X)
    effort_vector: DVector<f64>,
    /// Previous effort for transient (implicit Euler)
    prev_effort: DVector<f64>,
    /// Time step for transient [s]
    time_step: f64,
}

impl GenericMnaSolver {
    /// Create new generic MNA solver
    pub fn new(num_nodes: usize, time_step: f64) -> Self {
        GenericMnaSolver {
            num_nodes,
            g_matrix: None,
            y_vector: None,
            effort_vector: DVector::zeros(num_nodes),
            prev_effort: DVector::zeros(num_nodes),
            time_step,
        }
    }

    /// Set time step for transient analysis
    pub fn set_time_step(&mut self, dt: f64) {
        self.time_step = dt;
    }

    /// Initialize matrices for DC analysis
    /// Sets up G and Y vectors to zero, ready for component additions
    pub fn initialize_dc(&mut self) -> Result<(), String> {
        if self.num_nodes == 0 {
            return Err("Cannot initialize with zero nodes".to_string());
        }

        self.g_matrix = Some(DMatrix::zeros(self.num_nodes, self.num_nodes));
        self.y_vector = Some(DVector::zeros(self.num_nodes));

        Ok(())
    }

    /// Add conductance element between two nodes
    /// Equivalent to:
    /// - Resistor in electrical (G = 1/R)
    /// - Thermal resistance (G = 1/R_th)
    /// - Mechanical damper (G = f [N·s/m])
    /// - Hydraulic resistance (G = 1/R_h)
    pub fn add_conductance(
        &mut self,
        node1: usize,
        node2: usize,
        conductance: f64,
    ) -> Result<(), String> {
        if conductance < 0.0 {
            return Err(format!("Negative conductance: {} (check your resistance signs)", conductance));
        }

        let g = self.g_matrix.as_mut()
            .ok_or("Matrix not initialized - call initialize_dc() first")?;

        // Diagonal terms (self-conductance)
        if node1 < self.num_nodes {
            g[(node1, node1)] += conductance;
        }
        if node2 < self.num_nodes {
            g[(node2, node2)] += conductance;
        }

        // Off-diagonal terms (coupling)
        if node1 < self.num_nodes && node2 < self.num_nodes {
            g[(node1, node2)] -= conductance;
            g[(node2, node1)] -= conductance;
        }

        Ok(())
    }

    /// Add flow source at a node
    /// Equivalent to:
    /// - Current source in electrical [A]
    /// - Heat source in thermal [W]
    /// - Force in mechanical [N]
    /// - Flow source in hydraulic [m³/s]
    pub fn add_flow_source(&mut self, node: usize, flow: f64) -> Result<(), String> {
        let y = self.y_vector.as_mut()
            .ok_or("Vector not initialized - call initialize_dc() first")?;

        if node < self.num_nodes {
            y[node] += flow;
        }

        Ok(())
    }

    /// Add capacitive element (transient only)
    /// Equivalent to:
    /// - Capacitor in electrical
    /// - Thermal capacitance
    /// - Mass in mechanical
    /// - Pressure/volume relationship in hydraulic
    ///
    /// Uses implicit Euler: C × (X_n - X_{n-1}) / dt
    pub fn add_capacitance_transient(
        &mut self,
        node1: usize,
        node2: usize,
        capacitance: f64,
    ) -> Result<(), String> {
        if capacitance <= 0.0 {
            return Err(format!("Invalid capacitance: {}", capacitance));
        }

        // Implicit Euler transforms capacitance to equivalent conductance
        let eq_conductance = capacitance / self.time_step;

        self.add_conductance(node1, node2, eq_conductance)?;

        // Add current source from previous state
        let flow_source = if node1 < self.num_nodes && node2 < self.num_nodes {
            capacitance / self.time_step * (self.prev_effort[node1] - self.prev_effort[node2])
        } else if node1 < self.num_nodes {
            capacitance / self.time_step * self.prev_effort[node1]
        } else if node2 < self.num_nodes {
            -capacitance / self.time_step * self.prev_effort[node2]
        } else {
            0.0
        };

        if node1 < self.num_nodes {
            self.add_flow_source(node1, flow_source)?;
        }
        if node2 < self.num_nodes {
            self.add_flow_source(node2, -flow_source)?;
        }

        Ok(())
    }

    /// Solve G × X = Y
    /// Returns effort vector (voltages, temperatures, forces, pressures, etc.)
    pub fn solve(&mut self) -> Result<(), String> {
        let mut g = self.g_matrix.as_ref()
            .ok_or("Conductance matrix not built")?
            .clone();
        let mut y = self.y_vector.as_ref()
            .ok_or("Flow vector not initialized")?
            .clone();

        // Pin first node (node 0) as reference (effort = 0)
        // This removes the null-space solution and makes the system unique
        // Equivalent to:
        // - Grounding node 0 in electrical (V_0 = 0)
        // - Setting T_0 as reference in thermal (T_0 = 0°C or fixed)
        // - Fixing position of node 0 in mechanical
        // - Setting reference pressure in hydraulic
        for j in 0..self.num_nodes {
            g[(0, j)] = 0.0;
        }
        g[(0, 0)] = 1.0;
        y[0] = 0.0;

        // Solve using LU decomposition
        let lu = LU::new(g);

        match lu.solve(&y) {
            Some(solution) => {
                self.effort_vector = solution;
                Ok(())
            }
            None => {
                Err("Failed to solve system - singular or ill-conditioned matrix".to_string())
            }
        }
    }

    /// Get effort at a node
    pub fn get_effort(&self, node: usize) -> f64 {
        if node < self.num_nodes {
            self.effort_vector[node]
        } else {
            0.0
        }
    }

    /// Get effort difference between two nodes
    pub fn get_effort_difference(&self, node1: usize, node2: usize) -> f64 {
        self.get_effort(node1) - self.get_effort(node2)
    }

    /// Update previous effort for next transient step
    pub fn update_history(&mut self) {
        self.prev_effort = self.effort_vector.clone();
    }

    /// Reset matrices for next time step
    pub fn reset_matrices(&mut self) -> Result<(), String> {
        self.g_matrix = Some(DMatrix::zeros(self.num_nodes, self.num_nodes));
        self.y_vector = Some(DVector::zeros(self.num_nodes));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solver_creation() {
        let solver = GenericMnaSolver::new(3, 0.001);
        assert_eq!(solver.num_nodes, 3);
        assert_eq!(solver.time_step, 0.001);
    }

    #[test]
    fn test_solver_initialization() {
        let mut solver = GenericMnaSolver::new(2, 0.001);
        assert!(solver.initialize_dc().is_ok());
        assert!(solver.g_matrix.is_some());
        assert!(solver.y_vector.is_some());
    }

    #[test]
    fn test_add_conductance() {
        let mut solver = GenericMnaSolver::new(2, 0.001);
        solver.initialize_dc().unwrap();

        // Add conductance between nodes 0 and 1
        assert!(solver.add_conductance(0, 1, 1.0).is_ok());
    }

    #[test]
    fn test_invalid_conductance() {
        let mut solver = GenericMnaSolver::new(2, 0.001);
        solver.initialize_dc().unwrap();

        // Negative conductance should fail
        assert!(solver.add_conductance(0, 1, -1.0).is_err());
    }

    #[test]
    fn test_add_flow_source() {
        let mut solver = GenericMnaSolver::new(2, 0.001);
        solver.initialize_dc().unwrap();

        assert!(solver.add_flow_source(1, 5.0).is_ok());
    }

    #[test]
    fn test_simple_system_solution() -> Result<(), String> {
        // Simple system: Single conductance with flow source
        // G × X = Y
        // 1.0 × X = 5.0
        // X = 5.0

        let mut solver = GenericMnaSolver::new(2, 0.001);
        solver.initialize_dc()?;

        // Node 1 to ground with conductance 1.0 S
        solver.add_conductance(1, 0, 1.0)?;

        // Apply flow source of 5.0 A
        solver.add_flow_source(1, 5.0)?;

        solver.solve()?;

        let effort = solver.get_effort(1);
        assert!((effort - 5.0).abs() < 0.01, "Expected 5.0, got {}", effort);

        Ok(())
    }

    #[test]
    fn test_effort_difference() -> Result<(), String> {
        let mut solver = GenericMnaSolver::new(3, 0.001);
        solver.initialize_dc()?;

        solver.add_conductance(1, 0, 1.0)?;
        solver.add_conductance(2, 0, 1.0)?;
        solver.add_flow_source(1, 10.0)?;
        solver.add_flow_source(2, 5.0)?;

        solver.solve()?;

        let diff = solver.get_effort_difference(1, 2);
        assert!(diff > 0.0);

        Ok(())
    }

    #[test]
    fn test_get_effort() -> Result<(), String> {
        let mut solver = GenericMnaSolver::new(2, 0.001);
        solver.initialize_dc()?;

        solver.add_conductance(1, 0, 0.5)?;
        solver.add_flow_source(1, 2.5)?;

        solver.solve()?;

        let effort = solver.get_effort(1);
        assert!((effort - 5.0).abs() < 0.01);

        Ok(())
    }
}
