//! Block Diagram Domain - Simulink-like block diagram simulator
//!
//! This module implements signal flow-based block diagram simulation for control systems.
//! Unlike physical domains which use energy flow (bilateral), block diagrams use
//! unidirectional signal flow.
//!
//! Features:
//! - 15+ block types (gain, sum, integrator, transfer function, PID, etc.)
//! - Dynamic port generation (Sum block can have variable inputs)
//! - Nonlinear blocks (saturation, deadzone, rate limiter)
//! - Control blocks (PID, filters, lead/lag)
//! - Signal sources (step, ramp, sine, constant)

pub mod components;
pub mod solver;

pub use components::BlockComponent;
pub use solver::{BlockDiagramSolver, SimulationResult};

use crate::domains::PhysicalDomain;
use crate::graph::Graph;
use serde::{Deserialize, Serialize};

/// Block diagram domain wrapper implementing PhysicalDomain trait
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockDiagramDomain {
    name: String,
    solver: Option<BlockDiagramSolver>,
    sample_time: f64,  // 0.0 = continuous, >0 = discrete
}

impl BlockDiagramDomain {
    /// Create new block diagram domain
    pub fn new(name: &str) -> Self {
        BlockDiagramDomain {
            name: name.to_string(),
            solver: None,
            sample_time: 0.0,  // Continuous by default
        }
    }

    /// Set sample time (0.0 = continuous)
    pub fn set_sample_time(&mut self, dt: f64) {
        self.sample_time = dt;
    }

    /// Load and validate diagram
    pub fn load_diagram(&mut self, graph: &Graph) -> Result<(), String> {
        let solver = BlockDiagramSolver::new(self.sample_time);
        self.solver = Some(solver);
        Ok(())
    }

    /// Run time-domain simulation
    pub fn simulate(
        &self,
        graph: &mut Graph,
        duration: f64,
        dt: f64,
    ) -> Result<SimulationResult, String> {
        let solver = self
            .solver
            .as_ref()
            .ok_or("Diagram not loaded")?;

        solver.simulate(graph, duration, dt)
    }

    /// Get step response
    pub fn step_response(
        &self,
        graph: &mut Graph,
        duration: f64,
        dt: f64,
    ) -> Result<SimulationResult, String> {
        self.simulate(graph, duration, dt)
    }
}

impl PhysicalDomain for BlockDiagramDomain {
    fn to_bond_graph(&self) -> Graph {
        // Block diagrams don't map to bond graphs (signal flow, not energy)
        Graph::new()
    }

    fn governing_equations(&self) -> String {
        "Signal flow: y = f(inputs, state, time)".to_string()
    }

    fn domain_name(&self) -> &str {
        "block_diagram"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_creation() {
        let domain = BlockDiagramDomain::new("Test Diagram");
        assert_eq!(domain.name, "Test Diagram");
        assert_eq!(domain.sample_time, 0.0);
    }

    #[test]
    fn test_sample_time_setting() {
        let mut domain = BlockDiagramDomain::new("Test");
        domain.set_sample_time(0.001);
        assert_eq!(domain.sample_time, 0.001);
    }

    #[test]
    fn test_governing_equations() {
        let domain = BlockDiagramDomain::new("Test");
        let eqs = domain.governing_equations();
        assert!(eqs.contains("Signal flow"));
    }

    #[test]
    fn test_domain_name() {
        let domain = BlockDiagramDomain::new("Test");
        assert_eq!(domain.domain_name(), "block_diagram");
    }
}
