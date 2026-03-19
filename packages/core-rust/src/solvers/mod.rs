//! Numerical solvers for differential equations
//!
//! This module provides various solvers for simulating dynamic systems:
//! - ODE (Ordinary Differential Equations) solvers: RK4, RK45
//! - DAE (Differential-Algebraic Equations) solvers
//! - Steady-state solvers
//!
//! All solvers work with the unified graph abstraction, allowing any
//! simulator type to use them.

use serde::{Deserialize, Serialize};
use crate::error::{Result, TupanError};

pub mod ode;

pub use ode::{OdeSolver, RungeKuttaMethod};

/// Configuration for solvers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverConfig {
    /// Solver type ("ode", "dae", "steady_state")
    pub solver_type: String,
    /// Time step
    pub dt: f64,
    /// Maximum time step
    pub max_dt: f64,
    /// Minimum time step
    pub min_dt: f64,
    /// Absolute tolerance
    pub abs_tol: f64,
    /// Relative tolerance
    pub rel_tol: f64,
    /// Maximum iterations
    pub max_iterations: usize,
}

impl Default for SolverConfig {
    fn default() -> Self {
        SolverConfig {
            solver_type: "ode".to_string(),
            dt: 0.001,
            max_dt: 0.01,
            min_dt: 1e-6,
            abs_tol: 1e-6,
            rel_tol: 1e-4,
            max_iterations: 10000,
        }
    }
}

/// Core solver trait
pub trait Solver {
    /// Perform a single simulation step
    fn step(&mut self, state: &mut [f64]) -> Result<f64>;

    /// Get current simulation time
    fn time(&self) -> f64;

    /// Reset solver to initial state
    fn reset(&mut self);

    /// Get solver configuration
    fn config(&self) -> &SolverConfig;
}

/// Result of a simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    /// Time points
    pub time: Vec<f64>,
    /// State variables at each time point
    pub states: Vec<Vec<f64>>,
    /// Whether simulation converged
    pub converged: bool,
    /// Error message if failed
    pub error: Option<String>,
}

impl SimulationResult {
    pub fn new() -> Self {
        SimulationResult {
            time: Vec::new(),
            states: Vec::new(),
            converged: true,
            error: None,
        }
    }

    pub fn failed(error: String) -> Self {
        SimulationResult {
            time: Vec::new(),
            states: Vec::new(),
            converged: false,
            error: Some(error),
        }
    }
}

impl Default for SimulationResult {
    fn default() -> Self {
        Self::new()
    }
}
