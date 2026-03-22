//! Mechanical System Solver
//!
//! Uses generic Modified Nodal Analysis (MNA) to solve mechanical systems.
//!
//! Mechanical System → Electrical Analogy:
//! - Velocity (v) [m/s] ↔ Voltage (V) [V]
//! - Force (F) [N] ↔ Current (I) [A]
//! - Damping (f) [N·s/m] ↔ Conductance (G = 1/R) [S]
//! - Mass (m) [kg] ↔ Capacitance (C) [F]
//! - Force Source (F) [N] ↔ Current Source (I) [A]
//!
//! Key insight: Uses GenericMnaSolver - same code works for all domains!
//!
//! Example: Simple Mass-Damper system
//! ```
//! // Applied force (100N) -> Damper (100 N·s/m) -> Fixed support
//! //
//! // Steady-state: v = F / f = 100 / 100 = 1.0 m/s
//! // Time constant: τ = m / f = 5 / 100 = 0.05 s
//! // Transient: v(t) = 1.0 * (1 - exp(-t/0.05)) = 1.0 * (1 - exp(-20t))
//! ```

use crate::solvers::mna_generic::GenericMnaSolver;
use crate::domains::mechanical::components::MechanicalComponent;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Node index mapping for mechanical systems
#[derive(Debug, Clone)]
struct MechanicalNodeIndex {
    /// Maps node ID to matrix row/column
    indices: HashMap<usize, usize>,
    /// Total independent nodes
    count: usize,
}

impl MechanicalNodeIndex {
    fn new() -> Self {
        MechanicalNodeIndex {
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

/// Mechanical system analyzer
/// Uses generic MNA solver to analyze mechanical systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalAnalyzer {
    /// Number of nodes
    num_nodes: usize,
    /// Time step for transient [s]
    time_step: f64,
    /// Generic MNA solver (reusable across domains!)
    #[serde(skip)]
    solver: Option<GenericMnaSolver>,
    /// Reference velocity [m/s]
    reference_velocity: f64,
}

impl MechanicalAnalyzer {
    /// Create new mechanical analyzer
    pub fn new(num_nodes: usize, time_step: f64) -> Self {
        MechanicalAnalyzer {
            num_nodes,
            time_step,
            solver: Some(GenericMnaSolver::new(num_nodes, time_step)),
            reference_velocity: 0.0,
        }
    }

    /// Set reference velocity for boundary conditions
    pub fn set_reference_velocity(&mut self, vel: f64) {
        self.reference_velocity = vel;
    }

    /// Build mechanical system from component definitions
    /// Maps mechanical components to generic solver conductances and sources
    fn build_system(
        &mut self,
        components: &[(usize, usize, MechanicalComponent)],  // (node1, node2, component)
        force_sources: &[(usize, f64)],  // (node, force)
    ) -> Result<(), String> {
        let mut solver = GenericMnaSolver::new(self.num_nodes, self.time_step);
        solver.initialize_dc()?;

        // Add all dampers and bearings
        for (node1, node2, component) in components {
            match component {
                MechanicalComponent::Damper { damping } => {
                    // Damping: f = G
                    solver.add_conductance(*node1, *node2, *damping)?;
                }
                MechanicalComponent::Mass { mass: _ } => {
                    // For DC analysis, mass has no effect
                    // For transient, will be added in time-stepping loop
                }
                MechanicalComponent::Spring { stiffness: _ } => {
                    // Springs require displacement integration
                    // Approximated as zero for pure velocity analysis
                }
                MechanicalComponent::LinearBearing { friction } => {
                    let conductance = *friction;
                    solver.add_conductance(*node1, *node2, conductance)?;
                }
                MechanicalComponent::Friction { friction_coefficient, normal_force } => {
                    // Viscous friction: f_eq = μ × N
                    let conductance = friction_coefficient * normal_force;
                    solver.add_conductance(*node1, *node2, conductance)?;
                }
                MechanicalComponent::TorsionalDamper { damping } => {
                    // Rotational damping
                    solver.add_conductance(*node1, *node2, *damping)?;
                }
                _ => {}
            }
        }

        // Add all force sources
        for (node, force) in force_sources {
            solver.add_flow_source(*node, *force)?;
        }

        self.solver = Some(solver);
        Ok(())
    }

    /// Solve steady-state mechanical system
    /// f × v = F
    /// where:
    ///   f = damping matrix (N·s/m for each damper)
    ///   v = velocity vector [m/s]
    ///   F = force source vector [N]
    pub fn solve_steady_state(
        &mut self,
        components: &[(usize, usize, MechanicalComponent)],
        force_sources: &[(usize, f64)],
    ) -> Result<Vec<f64>, String> {
        if self.num_nodes == 0 {
            return Err("System has no nodes".to_string());
        }

        if force_sources.is_empty() {
            return Err("System must have at least one force source".to_string());
        }

        // Build system from components
        self.build_system(components, force_sources)?;

        // Solve using generic MNA
        let solver = self.solver.as_mut()
            .ok_or("Solver initialization failed")?;

        solver.solve()?;

        // Extract velocity vector
        let velocities: Vec<f64> = (0..self.num_nodes)
            .map(|i| solver.get_effort(i))
            .collect();

        Ok(velocities)
    }

    /// Solve transient mechanical system
    /// Uses implicit Euler: (m/dt + f) × v_n = (m/dt) × v_{n-1} + F
    /// Returns (time_vector, node_velocities, displacements)
    pub fn solve_transient(
        &mut self,
        components: &[(usize, usize, MechanicalComponent)],
        force_sources: &[(usize, f64)],
        duration: f64,
        time_step: f64,
    ) -> Result<(Vec<f64>, Vec<Vec<f64>>, Vec<Vec<f64>>), String> {
        if self.num_nodes == 0 {
            return Err("System has no nodes".to_string());
        }
        if duration <= 0.0 {
            return Err("Duration must be positive".to_string());
        }
        if time_step <= 0.0 || time_step > duration {
            return Err("Invalid time step".to_string());
        }
        if force_sources.is_empty() {
            return Err("System must have at least one force source".to_string());
        }

        let mut time_vec = Vec::new();
        let mut velocities = Vec::new();
        let mut displacements: Vec<Vec<f64>> = vec![vec![0.0; self.num_nodes]];

        // Initial condition: all nodes at rest (v = 0)
        let mut current_velocities = vec![self.reference_velocity; self.num_nodes];
        let mut current_displacements = vec![0.0; self.num_nodes];

        let mut t = 0.0;
        while t <= duration + time_step / 2.0 {
            time_vec.push(t);
            velocities.push(current_velocities.clone());

            // Solve at this time step
            let mut solver = GenericMnaSolver::new(self.num_nodes, time_step);
            solver.initialize_dc()?;

            // Add all dampers and masses
            for (node1, node2, component) in components {
                match component {
                    MechanicalComponent::Damper { damping } => {
                        solver.add_conductance(*node1, *node2, *damping)?;
                    }
                    MechanicalComponent::Mass { mass } => {
                        // Implicit Euler: adds (m/dt) to conductance
                        solver.add_capacitance_transient(*node1, *node2, *mass)?;
                    }
                    MechanicalComponent::LinearBearing { friction } => {
                        solver.add_conductance(*node1, *node2, *friction)?;
                    }
                    MechanicalComponent::Friction { friction_coefficient, normal_force } => {
                        let conductance = friction_coefficient * normal_force;
                        solver.add_conductance(*node1, *node2, conductance)?;
                    }
                    MechanicalComponent::TorsionalDamper { damping } => {
                        solver.add_conductance(*node1, *node2, *damping)?;
                    }
                    MechanicalComponent::RotationalMass { inertia } => {
                        solver.add_capacitance_transient(*node1, *node2, *inertia)?;
                    }
                    _ => {}
                }
            }

            // Add all force sources
            for (node, force) in force_sources {
                solver.add_flow_source(*node, *force)?;
            }

            // Solve for this time step
            solver.solve()?;

            // Extract new velocities
            current_velocities = (0..self.num_nodes)
                .map(|i| solver.get_effort(i))
                .collect();

            // Integrate velocities to get displacement: x = ∫v dt
            for i in 0..self.num_nodes {
                current_displacements[i] += current_velocities[i] * time_step;
            }

            displacements.push(current_displacements.clone());
            t += time_step;
        }

        Ok((time_vec, velocities, displacements))
    }

    /// Calculate power at a node
    /// P = F × v
    pub fn calculate_power(
        &self,
        node: usize,
        velocities: &[f64],
        components: &[(usize, usize, MechanicalComponent)],
    ) -> Result<f64, String> {
        if node >= self.num_nodes {
            return Err(format!("Invalid node: {}", node));
        }
        if velocities.len() != self.num_nodes {
            return Err("Velocity vector size mismatch".to_string());
        }

        let mut total_power = 0.0;

        for (n1, n2, component) in components {
            if *n1 == node || *n2 == node {
                match component {
                    MechanicalComponent::Damper { damping } => {
                        // Power dissipated: P = f × v²
                        let velocity_diff = velocities[*n1] - velocities[*n2];
                        let power = damping * velocity_diff * velocity_diff;
                        total_power += power;
                    }
                    MechanicalComponent::ForceSource { force } => {
                        // Power input: P = F × v
                        if *n1 == node {
                            total_power += force * velocities[node];
                        } else {
                            total_power -= force * velocities[node];
                        }
                    }
                    _ => {}
                }
            }
        }

        Ok(total_power)
    }
}

/// Mechanical system validation helper
pub struct MechanicalValidator {
    /// Minimum valid damping [N·s/m]
    min_damping: f64,
    /// Maximum valid damping [N·s/m]
    max_damping: f64,
    /// Minimum valid mass [kg]
    min_mass: f64,
    /// Maximum valid mass [kg]
    max_mass: f64,
}

impl MechanicalValidator {
    /// Create new validator with default limits
    pub fn new() -> Self {
        MechanicalValidator {
            min_damping: 0.0,
            max_damping: 1e6,      // 1 MN·s/m (very high)
            min_mass: 1e-6,        // 1 μg (very light)
            max_mass: 1e6,         // 1 million kg
        }
    }

    /// Validate damping value
    pub fn validate_damping(&self, f: f64) -> Result<(), String> {
        if f < self.min_damping {
            Err(format!("Damping {} N·s/m is negative", f))
        } else if f > self.max_damping {
            Err(format!("Damping {} N·s/m is too high", f))
        } else {
            Ok(())
        }
    }

    /// Validate mass value
    pub fn validate_mass(&self, m: f64) -> Result<(), String> {
        if m < self.min_mass {
            Err(format!("Mass {} kg is too light", m))
        } else if m > self.max_mass {
            Err(format!("Mass {} kg is too heavy", m))
        } else {
            Ok(())
        }
    }
}

impl Default for MechanicalValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mechanical_analyzer_creation() {
        let analyzer = MechanicalAnalyzer::new(3, 0.01);
        assert_eq!(analyzer.num_nodes, 3);
        assert_eq!(analyzer.time_step, 0.01);
        assert_eq!(analyzer.reference_velocity, 0.0);
    }

    #[test]
    fn test_set_reference_velocity() {
        let mut analyzer = MechanicalAnalyzer::new(2, 0.001);
        analyzer.set_reference_velocity(5.0);
        assert_eq!(analyzer.reference_velocity, 5.0);
    }

    #[test]
    fn test_mechanical_validator() {
        let validator = MechanicalValidator::new();
        assert!(validator.validate_damping(100.0).is_ok());
        assert!(validator.validate_damping(-10.0).is_err());
    }

    #[test]
    fn test_simple_steady_state() -> Result<(), String> {
        // Simple system: 100N force -> 100 N·s/m damper
        // Expected: v = F / f = 100 / 100 = 1.0 m/s
        let mut analyzer = MechanicalAnalyzer::new(2, 0.001);

        let components = vec![
            (1, 0, MechanicalComponent::Damper { damping: 100.0 }),
        ];
        let force_sources = vec![
            (1, 100.0),  // 100N at node 1
        ];

        let velocities = analyzer.solve_steady_state(&components, &force_sources)?;

        // Node 0 is ground (reference): v = 0 m/s
        assert!((velocities[0] - 0.0).abs() < 0.01);

        // Node 1: v = 100N / 100 N·s/m = 1.0 m/s
        assert!((velocities[1] - 1.0).abs() < 0.1, "Expected ~1.0 m/s, got {}", velocities[1]);

        Ok(())
    }

    #[test]
    fn test_parallel_dampers() -> Result<(), String> {
        // Two parallel paths: 100N -> (100 N·s/m || 100 N·s/m)
        // Equivalent: 100N -> 50 N·s/m → v = 100/50 = 2.0 m/s
        let mut analyzer = MechanicalAnalyzer::new(3, 0.001);

        let components = vec![
            (0, 1, MechanicalComponent::Damper { damping: 100.0 }),
            (0, 2, MechanicalComponent::Damper { damping: 100.0 }),
        ];
        let force_sources = vec![
            (0, 100.0),
        ];

        let velocities = analyzer.solve_steady_state(&components, &force_sources)?;

        // Velocity should be 100 / (1/(100) + 1/(100))^-1 = 2.0 m/s
        assert!(velocities[0] > 1.5 && velocities[0] < 2.5);

        Ok(())
    }

    #[test]
    fn test_series_dampers() -> Result<(), String> {
        // Series: 100N -> 50 N·s/m -> Node1 -> 50 N·s/m -> Ground
        // Total damping: 100 N·s/m → v = 100/100 = 1.0 m/s at Node1
        let mut analyzer = MechanicalAnalyzer::new(3, 0.001);

        let components = vec![
            (0, 1, MechanicalComponent::Damper { damping: 50.0 }),
            (1, 2, MechanicalComponent::Damper { damping: 50.0 }),
        ];
        let force_sources = vec![
            (0, 100.0),
        ];

        let velocities = analyzer.solve_steady_state(&components, &force_sources)?;

        // Velocity at node 1
        assert!((velocities[1] - 1.0).abs() < 0.1);

        Ok(())
    }

    #[test]
    fn test_transient_mass_damper() -> Result<(), String> {
        // Mass-damper transient: τ = m / f = 5 / 100 = 0.05 s
        let mut analyzer = MechanicalAnalyzer::new(2, 0.1);

        let components = vec![
            (1, 0, MechanicalComponent::Damper { damping: 100.0 }),
            (1, 0, MechanicalComponent::Mass { mass: 5.0 }),
        ];
        let force_sources = vec![
            (1, 100.0),
        ];

        let (time_vec, velocities) = analyzer.solve_transient(&components, &force_sources, 1.0, 0.1)?;

        // Verify initial condition
        assert!((velocities[0][1] - 0.0).abs() < 0.1);

        // Verify approach to steady state
        let final_velocity = velocities[velocities.len() - 1][1];
        assert!(final_velocity > 0.8 && final_velocity < 1.2);

        Ok(())
    }

    #[test]
    fn test_power_calculation() -> Result<(), String> {
        let mut analyzer = MechanicalAnalyzer::new(2, 0.001);

        let components = vec![
            (0, 1, MechanicalComponent::Damper { damping: 100.0 }),
        ];
        let velocities = vec![2.0, 1.0];  // Δv = 1.0 m/s

        // Power dissipated: P = f × (v1 - v2)² = 100 × 1² = 100 W
        let power = analyzer.calculate_power(0, &velocities, &components)?;
        assert!((power - 100.0).abs() < 1.0);

        Ok(())
    }

    #[test]
    fn test_invalid_system() -> Result<(), String> {
        let mut analyzer = MechanicalAnalyzer::new(1, 0.001);

        // No force sources
        let components = vec![];
        let force_sources = vec![];

        let result = analyzer.solve_steady_state(&components, &force_sources);
        assert!(result.is_err(), "Should fail with no force sources");

        Ok(())
    }

    #[test]
    fn test_invalid_time_parameters() {
        let mut analyzer = MechanicalAnalyzer::new(1, 0.001);
        let components = vec![];
        let force_sources = vec![(0, 100.0)];

        // Zero duration
        assert!(analyzer.solve_transient(&components, &force_sources, 0.0, 0.001).is_err());

        // Negative time step
        assert!(analyzer.solve_transient(&components, &force_sources, 1.0, -0.001).is_err());

        // Time step larger than duration
        assert!(analyzer.solve_transient(&components, &force_sources, 0.1, 0.2).is_err());
    }
}
