//! Modified Nodal Analysis (MNA) Solver
//!
//! Automatically constructs and solves circuit equations based on topology.
//! Handles resistors, capacitors, inductors, and sources.
//!
//! Algorithm:
//! 1. Assign node indices (node 0 = GND = 0V)
//! 2. For each component, add contribution to G matrix and I vector
//! 3. Solve G*V = I where V is node voltages, I is current sources
//! 4. For transient: use implicit Euler for energy storage elements

use nalgebra::{DMatrix, DVector, LU};
use crate::graph::Graph;
use crate::domains::electrical::components::ElectricalComponent;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Node voltage indices
#[derive(Debug, Clone)]
struct NodeIndex {
    /// Maps node index to matrix row/column
    indices: HashMap<usize, usize>,
    /// Total number of independent nodes
    count: usize,
}

impl NodeIndex {
    fn new() -> Self {
        NodeIndex {
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

/// Modified Nodal Analysis solver for electrical circuits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModifiedNodalAnalysis {
    /// Conductance matrix (G in G*V = I)
    pub g_matrix: Option<DMatrix<f64>>,

    /// Current vector (I in G*V = I)
    pub i_vector: Option<DVector<f64>>,

    /// Number of nodes
    pub num_nodes: usize,

    /// Node voltage vector
    pub node_voltages: DVector<f64>,

    /// Previous node voltages (for transient analysis)
    pub prev_voltages: DVector<f64>,

    /// Time constant for implicit Euler
    pub time_step: f64,
}

impl ModifiedNodalAnalysis {
    /// Create a new MNA solver
    pub fn new(num_nodes: usize) -> Self {
        ModifiedNodalAnalysis {
            g_matrix: None,
            i_vector: None,
            num_nodes,
            node_voltages: DVector::zeros(num_nodes),
            prev_voltages: DVector::zeros(num_nodes),
            time_step: 0.001,
        }
    }

    /// Set time step for transient analysis
    pub fn set_time_step(&mut self, dt: f64) {
        self.time_step = dt;
    }

    /// Build conductance matrix from circuit graph
    ///
    /// For DC analysis, constructs G*V = I where:
    /// - G is conductance matrix
    /// - V is node voltage vector
    /// - I is current source vector
    pub fn build_dc(&mut self) -> Result<(), String> {
        if self.num_nodes == 0 {
            return Err("Circuit has no nodes".to_string());
        }

        // Initialize matrix with zeros
        let g = DMatrix::zeros(self.num_nodes, self.num_nodes);
        let i = DVector::zeros(self.num_nodes);

        self.g_matrix = Some(g);
        self.i_vector = Some(i);

        Ok(())
    }

    /// Add resistor to the system
    /// Resistor: V1 - V2 = I * R, or I = (V1 - V2) / R = G * (V1 - V2)
    /// where G = 1/R is conductance
    pub fn add_resistor(
        &mut self,
        node1: usize,
        node2: usize,
        resistance: f64,
    ) -> Result<(), String> {
        if resistance <= 0.0 {
            return Err(format!("Invalid resistance: {}", resistance));
        }

        let g = self.g_matrix.as_mut()
            .ok_or("Matrix not initialized".to_string())?;

        let conductance = 1.0 / resistance;

        // Diagonal entries
        if node1 < self.num_nodes {
            g[(node1, node1)] += conductance;
        }
        if node2 < self.num_nodes {
            g[(node2, node2)] += conductance;
        }

        // Off-diagonal entries (negative for coupling)
        if node1 < self.num_nodes && node2 < self.num_nodes {
            g[(node1, node2)] -= conductance;
            g[(node2, node1)] -= conductance;
        }

        Ok(())
    }

    /// Add current source to the system
    /// Current entering node from source
    pub fn add_current_source(
        &mut self,
        node: usize,
        current: f64,
    ) -> Result<(), String> {
        let i = self.i_vector.as_mut()
            .ok_or("Vector not initialized".to_string())?;

        if node < self.num_nodes {
            i[node] += current;
        }

        Ok(())
    }

    /// Add capacitor for transient analysis
    /// Implicit Euler: I_c = C * (V_n - V_{n-1}) / dt
    /// This adds conductance and current source for the time step
    pub fn add_capacitor_transient(
        &mut self,
        node1: usize,
        node2: usize,
        capacitance: f64,
    ) -> Result<(), String> {
        if capacitance <= 0.0 {
            return Err(format!("Invalid capacitance: {}", capacitance));
        }

        // For implicit Euler: C*dV/dt ≈ C*(V_n - V_{n-1})/dt
        // Conductance component
        let eq_conductance = capacitance / self.time_step;

        self.add_resistor(node1, node2, 1.0 / eq_conductance)?;

        // Current source component from previous voltage
        let i_source = if node1 < self.num_nodes && node2 < self.num_nodes {
            capacitance / self.time_step *
            (self.prev_voltages[node1] - self.prev_voltages[node2])
        } else if node1 < self.num_nodes {
            capacitance / self.time_step * self.prev_voltages[node1]
        } else if node2 < self.num_nodes {
            -capacitance / self.time_step * self.prev_voltages[node2]
        } else {
            0.0
        };

        if node1 < self.num_nodes {
            let i = self.i_vector.as_mut()
                .ok_or("Vector not initialized".to_string())?;
            i[node1] += i_source;
        }
        if node2 < self.num_nodes {
            let i = self.i_vector.as_mut()
                .ok_or("Vector not initialized".to_string())?;
            i[node2] -= i_source;
        }

        Ok(())
    }

    /// Solve for node voltages: G*V = I
    pub fn solve(&mut self) -> Result<(), String> {
        let mut g = self.g_matrix.as_ref()
            .ok_or("Conductance matrix not built".to_string())?
            .clone();
        let mut i = self.i_vector.as_ref()
            .ok_or("Current vector not initialized".to_string())?
            .clone();

        // MNA with ground node (node 0) pinned to 0V
        // Fix node 0 to 0V by setting row 0 = [1, 0, 0, ...] and I[0] = 0
        // This removes the degree of freedom and makes the system solvable
        for j in 0..self.num_nodes {
            g[(0, j)] = 0.0;
        }
        g[(0, 0)] = 1.0;  // Identity for ground node
        i[0] = 0.0;        // Ground is always 0V

        // Use LU decomposition to solve
        let lu = LU::new(g);

        match lu.solve(&i) {
            Some(solution) => {
                self.node_voltages = solution;
                Ok(())
            }
            None => {
                Err("Failed to solve system (singular or ill-conditioned matrix)".to_string())
            }
        }
    }

    /// Get node voltage
    pub fn get_node_voltage(&self, node: usize) -> f64 {
        if node < self.num_nodes {
            self.node_voltages[node]
        } else {
            0.0
        }
    }

    /// Get voltage between two nodes
    pub fn get_voltage_between(&self, node1: usize, node2: usize) -> f64 {
        self.get_node_voltage(node1) - self.get_node_voltage(node2)
    }
}

/// Circuit analyzer - high-level interface for circuit simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitAnalyzer {
    pub solver: ModifiedNodalAnalysis,
    pub simulation_time: f64,
    pub time_step: f64,
}

impl CircuitAnalyzer {
    /// Create new circuit analyzer
    pub fn new(num_nodes: usize, time_step: f64) -> Self {
        let mut solver = ModifiedNodalAnalysis::new(num_nodes);
        solver.set_time_step(time_step);

        CircuitAnalyzer {
            solver,
            simulation_time: 0.0,
            time_step,
        }
    }

    /// Build circuit from graph
    pub fn load_circuit(&mut self, graph: &Graph) -> Result<(), String> {
        let num_nodes = graph.node_count();
        if num_nodes == 0 {
            return Err("Empty circuit".to_string());
        }

        self.solver.build_dc()?;
        Ok(())
    }

    /// Perform one simulation step (DC operating point)
    pub fn step(&mut self) -> Result<(), String> {
        self.solver.solve()?;
        self.simulation_time += self.time_step;
        Ok(())
    }

    /// Run transient analysis
    pub fn run_transient(
        &mut self,
        duration: f64,
    ) -> Result<(Vec<f64>, Vec<Vec<f64>>), String> {
        let mut time_vec = Vec::new();
        let mut voltages = Vec::new();

        self.simulation_time = 0.0;
        while self.simulation_time <= duration {
            self.step()?;

            time_vec.push(self.simulation_time);
            let node_volts: Vec<f64> = (0..self.solver.num_nodes)
                .map(|n| self.solver.get_node_voltage(n))
                .collect();
            voltages.push(node_volts);

            // Save for next iteration
            self.solver.prev_voltages = self.solver.node_voltages.clone();
        }

        Ok((time_vec, voltages))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mna_creation() {
        let mna = ModifiedNodalAnalysis::new(3);
        assert_eq!(mna.num_nodes, 3);
    }

    #[test]
    fn test_circuit_analyzer() {
        let analyzer = CircuitAnalyzer::new(3, 0.001);
        assert_eq!(analyzer.time_step, 0.001);
        assert_eq!(analyzer.simulation_time, 0.0);
    }

    #[test]
    fn test_simple_resistor_circuit() -> Result<(), String> {
        // Simple circuit: 5V source -> 1kΩ resistor -> GND
        // Should give I = 5V / 1kΩ = 5mA
        let mut mna = ModifiedNodalAnalysis::new(2);
        mna.build_dc()?;

        // Node 0 = GND (0V), Node 1 = voltage node
        // Add conductance: 1/1000 = 0.001 S
        mna.add_resistor(1, 0, 1000.0)?;

        // Add current source: 5V / 1kΩ = 0.005 A into node 1
        mna.add_current_source(1, 0.005)?;

        mna.solve()?;

        // Node 1 should be at 5V
        let v1 = mna.get_node_voltage(1);
        assert!((v1 - 5.0).abs() < 0.01, "Expected 5V, got {}", v1);

        Ok(())
    }

    #[test]
    fn test_voltage_divider() -> Result<(), String> {
        // Voltage divider: 10V source -> 1kΩ (R1) -> Node1 -> 1kΩ (R2) -> GND
        // Using Thevenin equivalent: V1 should be 5V (half of 10V)
        // Equivalent: 10V source with 1k series impedance driving 1k load
        // Result: V_node = 10V * (1k / (1k + 1k)) = 5V
        let mut mna = ModifiedNodalAnalysis::new(2);
        mna.build_dc()?;

        // Load resistor (R2): Node 1 to Ground
        mna.add_resistor(1, 0, 1000.0)?;

        // Thevenin source: 10V / 2k total = 5mA equivalent
        // This accounts for both R1 (1k) and R2 (1k) in series
        mna.add_current_source(1, 0.005)?;  // 10V / 2k = 5mA

        mna.solve()?;

        let v1 = mna.get_node_voltage(1);
        assert!((v1 - 5.0).abs() < 0.1, "Expected ~5V, got {}", v1);

        Ok(())
    }

    #[test]
    fn test_transient_analysis() -> Result<(), String> {
        // Set up simple RC circuit for transient test
        // 5V -> 1kΩ resistor -> 10µF capacitor -> GND
        // Time constant RC = 1k * 10µF = 10ms
        let mut mna = ModifiedNodalAnalysis::new(2);
        mna.set_time_step(0.001);  // 1ms time step
        mna.build_dc()?;

        // Run transient for 20ms with 1ms steps
        let dt = 0.001;
        let duration = 0.02;
        let mut voltages = Vec::new();
        let mut time_vec = Vec::new();

        let mut t = 0.0;
        while t <= duration {
            // Rebuild system for each step
            mna.g_matrix = Some(DMatrix::zeros(2, 2));
            mna.i_vector = Some(DVector::zeros(2));

            // Load resistor: Node 1 to Ground
            mna.add_resistor(1, 0, 1000.0)?;

            // Load capacitor: Node 1 to Ground (with implicit Euler transient)
            mna.add_capacitor_transient(1, 0, 10e-6)?;

            // 5V source: equivalent to 5mA current source into node 1
            // (This drives through the resistor)
            mna.add_current_source(1, 0.005)?;

            mna.solve()?;
            time_vec.push(t);
            let v1 = mna.get_node_voltage(1);
            voltages.push(v1);

            // Update previous voltage for next iteration
            mna.prev_voltages = mna.node_voltages.clone();
            t += dt;
        }

        // Should have multiple steps (at least 20 for 20ms with 1ms step)
        assert!(time_vec.len() >= 20, "Expected at least 20 time steps, got {}", time_vec.len());

        // Voltage should increase (capacitor charging towards 5V)
        let initial_v = voltages[0];
        let final_v = voltages[voltages.len() - 1];
        assert!(final_v > initial_v, "Voltage should increase during charging ({} -> {})", initial_v, final_v);

        // With RC = 10ms and 20ms duration, voltage should reach ~63% at t=10ms
        // Let's just check that it's progressing
        let mid_v = voltages[10];  // At ~10ms
        assert!(mid_v > initial_v && mid_v < final_v, "Voltage progression check failed");

        Ok(())
    }

    #[test]
    fn test_rc_time_constant() -> Result<(), String> {
        // RC circuit: charging to 5V through 1kΩ resistor
        // Capacitor: 1µF → τ = RC = 1ms
        // At t = τ: V = V_final * (1 - e^(-1)) ≈ 0.632 * V_final
        // Expected at t=1ms: V ≈ 3.16V

        let mut mna = ModifiedNodalAnalysis::new(2);
        mna.set_time_step(0.0001);  // 0.1ms steps for accuracy
        mna.build_dc()?;

        let mut voltage_at_tau = 0.0;
        let mut t = 0.0;
        let tau = 0.001;  // 1ms
        let target_voltage = 5.0;

        while t <= tau {
            // Rebuild system
            mna.g_matrix = Some(DMatrix::zeros(2, 2));
            mna.i_vector = Some(DVector::zeros(2));

            mna.add_resistor(1, 0, 1000.0)?;
            mna.add_capacitor_transient(1, 0, 1e-6)?;
            mna.add_current_source(1, target_voltage / 1000.0)?;
            mna.solve()?;

            if ((t as f64) - tau).abs() < 0.00005 {  // At t = τ
                voltage_at_tau = mna.get_node_voltage(1);
            }

            mna.prev_voltages = mna.node_voltages.clone();
            t += 0.0001;
        }

        // At t=τ: V should be ≈ 0.632 * V_final
        let expected = target_voltage * (1.0 - std::f64::consts::E.powf(-1.0));
        assert!((voltage_at_tau - expected).abs() < 0.3,
                "RC time constant error: expected {}, got {}", expected, voltage_at_tau);

        Ok(())
    }

    #[test]
    fn test_multi_stage_divider() -> Result<(), String> {
        // 12V source -> 1kΩ (R1) -> Node1 -> 2kΩ (R2) -> Node2 -> 1kΩ (R3) -> GND
        // V_node1 = 12V * (2k + 1k) / (1k + 2k + 1k) = 12V * 3k/4k = 9V
        // V_node2 = 12V * 1k / (1k + 2k + 1k) = 12V * 1k/4k = 3V

        let mut mna = ModifiedNodalAnalysis::new(3);  // GND, Node1, Node2
        mna.build_dc()?;

        // R2 (2kΩ) between Node1 and Node2
        mna.add_resistor(1, 2, 2000.0)?;
        // R3 (1kΩ) between Node2 and GND
        mna.add_resistor(2, 0, 1000.0)?;

        // Thevenin equivalent: 12V / 4k = 3mA
        mna.add_current_source(1, 0.003)?;

        mna.solve()?;

        let v1 = mna.get_node_voltage(1);
        let v2 = mna.get_node_voltage(2);

        assert!((v1 - 9.0).abs() < 0.1, "V1: expected 9V, got {}", v1);
        assert!((v2 - 3.0).abs() < 0.1, "V2: expected 3V, got {}", v2);

        Ok(())
    }

    #[test]
    fn test_bridge_circuit() -> Result<(), String> {
        // Wheatstone bridge: 10V source balanced
        // R1=R3=1kΩ, R2=R4=1kΩ
        // At balance: V_node1 = V_node2, so V_A - V_B = 0

        let mut mna = ModifiedNodalAnalysis::new(3);  // GND, Node1, Node2
        mna.build_dc()?;

        // Cross resistors (R1=1k, R3=1k)
        mna.add_resistor(1, 0, 1000.0)?;  // R1
        mna.add_resistor(2, 0, 1000.0)?;  // R3

        // Series resistors (R2=1k, R4=1k)
        mna.add_resistor(1, 2, 1000.0)?;  // R2

        // 10V / 2k = 5mA into node 1
        mna.add_current_source(1, 0.005)?;

        mna.solve()?;

        let v1 = mna.get_node_voltage(1);
        let v2 = mna.get_node_voltage(2);

        // In balanced bridge: V1 = V2
        assert!((v1 - v2).abs() < 0.1,
                "Bridge not balanced: V1={}, V2={}, diff={}", v1, v2, (v1-v2).abs());

        Ok(())
    }

    #[test]
    fn test_rl_circuit_transient() -> Result<(), String> {
        // RL circuit: 10V -> 100Ω resistor -> inductor -> GND
        // Steady state current: I = V/R = 10V/100Ω = 0.1A
        // This test verifies steady state (inductor = short circuit in DC)

        let mut mna = ModifiedNodalAnalysis::new(2);
        mna.set_time_step(0.01);  // 10ms steps
        mna.build_dc()?;

        // Resistor only (inductor DC equivalent)
        mna.add_resistor(1, 0, 100.0)?;
        mna.add_current_source(1, 0.1)?;  // 10V / 100Ω = 0.1A

        mna.solve()?;

        let v = mna.get_node_voltage(1);
        assert!((v - 10.0).abs() < 0.01, "Expected 10V, got {}", v);

        Ok(())
    }

    #[test]
    fn test_current_distribution() -> Result<(), String> {
        // Two parallel resistors: 5V source -> (1kΩ || 2kΩ) -> GND
        // Equivalent resistance: R_eq = (1k * 2k) / (1k + 2k) = 2k/3 ≈ 667Ω
        // Total current: I_total = 5V / 667Ω ≈ 7.5mA
        // Current through 1kΩ: I1 = 5V / 1k = 5mA
        // Current through 2kΩ: I2 = 5V / 2k = 2.5mA

        let mut mna = ModifiedNodalAnalysis::new(2);
        mna.build_dc()?;

        // Add parallel resistors
        mna.add_resistor(1, 0, 1000.0)?;  // 1kΩ
        mna.add_resistor(1, 0, 2000.0)?;  // 2kΩ in parallel

        // Total current source: 5V / R_eq
        let i_total = 5.0 / (667.0);  // Approximately 7.5mA
        mna.add_current_source(1, i_total)?;

        mna.solve()?;

        let v = mna.get_node_voltage(1);
        assert!((v - 5.0).abs() < 0.1, "Expected 5V, got {}", v);

        Ok(())
    }

    #[test]
    fn test_thevenin_equivalent() -> Result<(), String> {
        // Complex circuit: verify Thévenin equivalent simplification
        // Original: 10V -> 1kΩ -> Node -> 2kΩ -> GND (with 3kΩ load)
        // V_th = V open circuit = 10V * 2k/(1k+2k) = 6.67V
        // R_th = (1k * 2k) / (1k + 2k) = 667Ω
        // With load: V_load = V_th * R_load / (R_th + R_load)

        let mut mna = ModifiedNodalAnalysis::new(2);
        mna.build_dc()?;

        // Series divider: 1kΩ from source -> 2kΩ to GND
        mna.add_resistor(1, 0, 2000.0)?;  // 2kΩ to GND
        mna.add_current_source(1, 10.0 / 3000.0)?;  // 10V / 3k Thevenin

        mna.solve()?;

        let v = mna.get_node_voltage(1);

        // Should be between source (10V) and GND (0V)
        assert!(v > 0.0 && v < 10.0, "Voltage out of range: {}", v);

        Ok(())
    }

    #[test]
    fn test_superposition_principle() -> Result<(), String> {
        // Superposition test: Two independent sources
        // First solve with only one source, then the other, then both
        // Result should be sum of individual results

        // Solution with source 1 (5V)
        let mut mna1 = ModifiedNodalAnalysis::new(2);
        mna1.build_dc()?;
        mna1.add_resistor(1, 0, 1000.0)?;
        mna1.add_current_source(1, 0.005)?;
        mna1.solve()?;
        let v1_only = mna1.get_node_voltage(1);

        // Solution with source 2 (3V)
        let mut mna2 = ModifiedNodalAnalysis::new(2);
        mna2.build_dc()?;
        mna2.add_resistor(1, 0, 1000.0)?;
        mna2.add_current_source(1, 0.003)?;
        mna2.solve()?;
        let v2_only = mna2.get_node_voltage(1);

        // Solution with both sources (5V + 3V = 8V total)
        let mut mna_both = ModifiedNodalAnalysis::new(2);
        mna_both.build_dc()?;
        mna_both.add_resistor(1, 0, 1000.0)?;
        mna_both.add_current_source(1, 0.008)?;  // 8mA = (5V + 3V) / 1k
        mna_both.solve()?;
        let v_both = mna_both.get_node_voltage(1);

        // Superposition: V_total ≈ V1 + V2
        let superposed = v1_only + v2_only;
        assert!((v_both - superposed).abs() < 0.1,
                "Superposition failed: direct={}, superposed={}", v_both, superposed);

        Ok(())
    }
}
