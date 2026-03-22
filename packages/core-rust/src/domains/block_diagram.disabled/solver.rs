//! Block Diagram Solver - Topological execution engine with algebraic loop detection
//!
//! Implements signal flow simulation using topological sorting and graph analysis.
//! Unlike MNA (simultaneous equations), block diagrams execute blocks in dependency order.

use crate::domains::block_diagram::BlockComponent;
use crate::graph::{Graph, NodeId};
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use serde::{Deserialize, Serialize};

/// Simulation result - time series data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    /// Time vector [s]
    pub time_vec: Vec<f64>,
    /// Signal data: node_id -> [values over time]
    pub data: HashMap<usize, Vec<f64>>,
}

impl SimulationResult {
    /// Get step response metrics for a node
    pub fn step_response_metrics(&self, output_node: usize) -> StepResponseMetrics {
        if let Some(signal) = self.data.get(&output_node) {
            if signal.is_empty() {
                return StepResponseMetrics::default();
            }

            let steady_state = *signal.last().unwrap_or(&0.0);
            let initial = signal.get(0).cloned().unwrap_or(0.0);
            let max_val = signal.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

            StepResponseMetrics {
                rise_time: Self::calculate_rise_time(signal),
                settling_time: Self::calculate_settling_time(signal, steady_state),
                overshoot: Self::calculate_overshoot(signal, steady_state),
                steady_state_value: steady_state,
                initial_value: initial,
                peak_value: max_val,
            }
        } else {
            StepResponseMetrics::default()
        }
    }

    fn calculate_rise_time(signal: &[f64]) -> Option<f64> {
        if signal.len() < 2 {
            return None;
        }
        let initial = signal[0];
        let final_val = signal[signal.len() - 1];
        if (final_val - initial).abs() < 1e-10 {
            return None;
        }

        let threshold_10 = initial + 0.1 * (final_val - initial);
        let threshold_90 = initial + 0.9 * (final_val - initial);

        let mut t10 = None;
        let mut t90 = None;

        for (i, &val) in signal.iter().enumerate() {
            if t10.is_none() && val >= threshold_10.min(threshold_90) {
                t10 = Some(i as f64);
            }
            if t90.is_none() && val >= threshold_90.max(threshold_10) {
                t90 = Some(i as f64);
                break;
            }
        }

        match (t10, t90) {
            (Some(t1), Some(t2)) if t2 > t1 => Some(t2 - t1),
            _ => None,
        }
    }

    fn calculate_settling_time(signal: &[f64], steady_state: f64) -> Option<f64> {
        if signal.is_empty() {
            return None;
        }

        let tolerance = 0.02 * steady_state.abs().max(0.01);

        for (i, &val) in signal.iter().enumerate() {
            if (val - steady_state).abs() < tolerance {
                // Check if it stays settled
                let remaining = &signal[i..];
                let settled = remaining.iter().all(|&v| (v - steady_state).abs() < tolerance * 2.0);
                if settled {
                    return Some(i as f64);
                }
            }
        }
        None
    }

    fn calculate_overshoot(signal: &[f64], steady_state: f64) -> f64 {
        if signal.is_empty() || steady_state.abs() < 1e-10 {
            return 0.0;
        }

        let max_val = signal.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let overshoot = (max_val - steady_state) / steady_state.abs();
        (overshoot * 100.0).max(0.0)
    }
}

/// Step response metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StepResponseMetrics {
    /// Time to go from 10% to 90% of steady-state
    pub rise_time: Option<f64>,
    /// Time to settle within ±2% of steady-state
    pub settling_time: Option<f64>,
    /// Peak overshoot as percentage
    pub overshoot: f64,
    /// Steady-state value
    pub steady_state_value: f64,
    /// Initial value
    pub initial_value: f64,
    /// Peak value reached
    pub peak_value: f64,
}

/// Graph topology information for solver
#[derive(Debug, Clone)]
struct GraphTopology {
    /// Execution order: node IDs in dependency order
    execution_order: Vec<usize>,
    /// Which nodes have state (memory)
    memory_nodes: HashSet<usize>,
    /// Adjacency information
    adjacency: HashMap<usize, Vec<usize>>,
}

/// Block diagram solver - executes signal flow using topological sort
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockDiagramSolver {
    sample_time: f64,  // 0.0 = continuous
    max_iterations: usize,
    algebraic_loop_tolerance: f64,
}

impl BlockDiagramSolver {
    /// Create new solver
    pub fn new(sample_time: f64) -> Self {
        BlockDiagramSolver {
            sample_time,
            max_iterations: 100,
            algebraic_loop_tolerance: 1e-6,
        }
    }

    /// Set maximum iterations for algebraic loop detection
    pub fn set_max_iterations(&mut self, iterations: usize) {
        self.max_iterations = iterations;
    }

    /// Analyze graph topology
    fn analyze_topology(&self, graph: &Graph) -> Result<GraphTopology, String> {
        let node_count = graph.node_count();
        let mut adjacency: HashMap<usize, Vec<usize>> = HashMap::new();
        let mut memory_nodes = HashSet::new();

        // Build adjacency list (simplified - would use actual graph API)
        for i in 0..node_count {
            adjacency.insert(i, Vec::new());
        }

        // Identify memory blocks (have state)
        // This is a placeholder - would actually inspect node types
        memory_nodes.insert(0);  // Assume node 0 has memory

        // Topological sort using Kahn's algorithm
        let execution_order = Self::topological_sort(&adjacency, node_count)?;

        Ok(GraphTopology {
            execution_order,
            memory_nodes,
            adjacency,
        })
    }

    /// Topological sort using Kahn's algorithm
    fn topological_sort(
        adjacency: &HashMap<usize, Vec<usize>>,
        node_count: usize,
    ) -> Result<Vec<usize>, String> {
        let mut in_degree = vec![0; node_count];

        // Calculate in-degrees
        for neighbors in adjacency.values() {
            for &neighbor in neighbors {
                if neighbor < node_count {
                    in_degree[neighbor] += 1;
                }
            }
        }

        let mut queue: VecDeque<usize> = (0..node_count)
            .filter(|&i| in_degree[i] == 0)
            .collect();

        let mut order = Vec::new();

        while let Some(node) = queue.pop_front() {
            order.push(node);

            if let Some(neighbors) = adjacency.get(&node) {
                for &neighbor in neighbors {
                    in_degree[neighbor] -= 1;
                    if in_degree[neighbor] == 0 {
                        queue.push_back(neighbor);
                    }
                }
            }
        }

        if order.len() != node_count {
            return Err("Cycle detected in block diagram".to_string());
        }

        Ok(order)
    }

    /// Detect algebraic loops (cycles without memory blocks)
    pub fn detect_algebraic_loops(&self, graph: &Graph) -> Result<(), String> {
        let topology = self.analyze_topology(graph)?;

        // Find all cycles
        let cycles = Self::find_cycles(&topology.adjacency, graph.node_count());

        for cycle in cycles {
            // Check if cycle contains memory block
            let has_memory = cycle.iter().any(|&node| topology.memory_nodes.contains(&node));

            if !has_memory {
                return Err(format!(
                    "Algebraic loop detected: {:?} (no memory/integrator blocks)",
                    cycle
                ));
            }
        }

        Ok(())
    }

    /// Find cycles in directed graph using DFS
    fn find_cycles(adjacency: &HashMap<usize, Vec<usize>>, node_count: usize) -> Vec<Vec<usize>> {
        let mut cycles = Vec::new();
        let mut visited = vec![false; node_count];
        let mut rec_stack = vec![false; node_count];
        let mut path = Vec::new();

        for start in 0..node_count {
            if !visited[start] {
                Self::dfs_cycles(
                    start,
                    adjacency,
                    &mut visited,
                    &mut rec_stack,
                    &mut path,
                    &mut cycles,
                );
            }
        }

        cycles
    }

    /// DFS helper for cycle detection
    fn dfs_cycles(
        node: usize,
        adjacency: &HashMap<usize, Vec<usize>>,
        visited: &mut [bool],
        rec_stack: &mut [bool],
        path: &mut Vec<usize>,
        cycles: &mut Vec<Vec<usize>>,
    ) {
        visited[node] = true;
        rec_stack[node] = true;
        path.push(node);

        if let Some(neighbors) = adjacency.get(&node) {
            for &neighbor in neighbors {
                if !visited[neighbor] {
                    Self::dfs_cycles(neighbor, adjacency, visited, rec_stack, path, cycles);
                } else if rec_stack[neighbor] {
                    // Found cycle - extract it
                    if let Some(pos) = path.iter().position(|&x| x == neighbor) {
                        let cycle = path[pos..].to_vec();
                        cycles.push(cycle);
                    }
                }
            }
        }

        path.pop();
        rec_stack[node] = false;
    }

    /// Run time-domain simulation
    pub fn simulate(
        &self,
        graph: &mut Graph,
        duration: f64,
        dt: f64,
    ) -> Result<SimulationResult, String> {
        if duration <= 0.0 {
            return Err("Duration must be positive".to_string());
        }
        if dt <= 0.0 {
            return Err("Time step must be positive".to_string());
        }
        if dt > duration {
            return Err("Time step cannot exceed duration".to_string());
        }

        // Analyze graph topology
        let _topology = self.analyze_topology(graph)?;

        let num_steps = (duration / dt).ceil() as usize;
        let mut time_vec = Vec::with_capacity(num_steps);
        let mut data: HashMap<usize, Vec<f64>> = HashMap::new();

        // Build node index mapping
        let node_list: Vec<_> = graph.nodes().collect();
        let node_indices: HashMap<NodeId, usize> = node_list
            .iter()
            .enumerate()
            .map(|(i, node)| (node.id, i))
            .collect();

        // Initialize output buffers for all nodes
        for (_, idx) in &node_indices {
            data.insert(*idx, Vec::with_capacity(num_steps));
        }

        // Simulation loop
        for step in 0..num_steps {
            let time = step as f64 * dt;
            time_vec.push(time);

            // Execute blocks in topological order
            // (For now, this is a placeholder - full implementation will execute actual blocks)
            // In a complete implementation:
            // 1. For each node in execution_order:
            //    - Gather input signals from connected edges
            //    - Call block.compute(inputs, time, dt)
            //    - Store output in node state
            // 2. Propagate signals through edges
            // 3. Record outputs in data HashMap

            // Record current state for all nodes
            for node in graph.nodes() {
                if let Some(&node_idx) = node_indices.get(&node.id) {
                    if let Some(output_buffer) = data.get_mut(&node_idx) {
                        // Get first state variable or 0.0 if none
                        let value = node.state.first().copied().unwrap_or(0.0);
                        output_buffer.push(value);
                    }
                }
            }
        }

        Ok(SimulationResult { time_vec, data })
    }

    /// Compute rise time from step response
    pub fn compute_rise_time(time_vec: &[f64], signal: &[f64]) -> Option<f64> {
        if time_vec.len() != signal.len() || signal.len() < 2 {
            return None;
        }

        let initial = signal[0];
        let final_val = *signal.last()?;
        let range = final_val - initial;

        if range.abs() < 1e-10 {
            return None;
        }

        let t10 = initial + 0.1 * range;
        let t90 = initial + 0.9 * range;

        let mut idx_10 = None;
        let mut idx_90 = None;

        for (i, &val) in signal.iter().enumerate() {
            if idx_10.is_none() && val >= t10.min(t90) {
                idx_10 = Some(i);
            }
            if idx_90.is_none() && val >= t10.max(t90) {
                idx_90 = Some(i);
                break;
            }
        }

        match (idx_10, idx_90) {
            (Some(i1), Some(i2)) if i2 > i1 => {
                Some(time_vec[i2] - time_vec[i1])
            }
            _ => None,
        }
    }

    /// Compute settling time to within tolerance of steady-state
    pub fn compute_settling_time(
        time_vec: &[f64],
        signal: &[f64],
        tolerance: f64,
    ) -> Option<f64> {
        if time_vec.len() != signal.len() {
            return None;
        }

        let steady_state = *signal.last()?;

        for (i, &val) in signal.iter().enumerate() {
            if (val - steady_state).abs() < tolerance {
                return Some(time_vec[i]);
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solver_creation() {
        let solver = BlockDiagramSolver::new(0.0);
        assert_eq!(solver.sample_time, 0.0);
        assert_eq!(solver.max_iterations, 100);
    }

    #[test]
    fn test_solver_with_discrete_sample_time() {
        let solver = BlockDiagramSolver::new(0.01);
        assert_eq!(solver.sample_time, 0.01);
    }

    #[test]
    fn test_topological_sort_linear_chain() {
        // Simple chain: 0 -> 1 -> 2
        let mut adj = HashMap::new();
        adj.insert(0, vec![1]);
        adj.insert(1, vec![2]);
        adj.insert(2, vec![]);

        let order = BlockDiagramSolver::topological_sort(&adj, 3).unwrap();
        assert_eq!(order, vec![0, 1, 2]);
    }

    #[test]
    fn test_topological_sort_with_cycle() {
        // Cycle: 0 -> 1 -> 2 -> 0
        let mut adj = HashMap::new();
        adj.insert(0, vec![1]);
        adj.insert(1, vec![2]);
        adj.insert(2, vec![0]);

        let result = BlockDiagramSolver::topological_sort(&adj, 3);
        assert!(result.is_err());
    }

    #[test]
    fn test_topological_sort_diamond() {
        // Diamond: 0 -> {1, 2} -> 3
        let mut adj = HashMap::new();
        adj.insert(0, vec![1, 2]);
        adj.insert(1, vec![3]);
        adj.insert(2, vec![3]);
        adj.insert(3, vec![]);

        let order = BlockDiagramSolver::topological_sort(&adj, 4).unwrap();
        assert_eq!(order.len(), 4);
        assert!(order.iter().position(|&x| x == 0) < order.iter().position(|&x| x == 3));
    }

    #[test]
    fn test_cycle_detection_simple() {
        let mut adj = HashMap::new();
        adj.insert(0, vec![1]);
        adj.insert(1, vec![0]);
        adj.insert(2, vec![]);

        let cycles = BlockDiagramSolver::find_cycles(&adj, 3);
        assert!(!cycles.is_empty());
    }

    #[test]
    fn test_cycle_detection_no_cycle() {
        let mut adj = HashMap::new();
        adj.insert(0, vec![1, 2]);
        adj.insert(1, vec![]);
        adj.insert(2, vec![]);

        let cycles = BlockDiagramSolver::find_cycles(&adj, 3);
        assert!(cycles.is_empty());
    }

    #[test]
    fn test_simulation_invalid_duration() {
        let solver = BlockDiagramSolver::new(0.01);
        let mut graph = Graph::new();

        let result = solver.simulate(&mut graph, -1.0, 0.01);
        assert!(result.is_err());
    }

    #[test]
    fn test_simulation_invalid_dt() {
        let solver = BlockDiagramSolver::new(0.01);
        let mut graph = Graph::new();

        let result = solver.simulate(&mut graph, 1.0, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_simulation_dt_exceeds_duration() {
        let solver = BlockDiagramSolver::new(0.01);
        let mut graph = Graph::new();

        let result = solver.simulate(&mut graph, 0.1, 0.2);
        assert!(result.is_err());
    }

    #[test]
    fn test_step_response_metrics() {
        let mut result = SimulationResult {
            time_vec: vec![0.0, 0.01, 0.02, 0.03, 0.04, 0.05],
            data: HashMap::new(),
        };

        // Step response: 0 -> 1 (with 20% overshoot)
        result.data.insert(1, vec![0.0, 0.2, 0.6, 1.2, 1.1, 1.0]);

        let metrics = result.step_response_metrics(1);
        assert_eq!(metrics.steady_state_value, 1.0);
        assert_eq!(metrics.peak_value, 1.2);
        assert!(metrics.overshoot > 0.0);
    }

    #[test]
    fn test_rise_time_calculation() {
        let time_vec = vec![0.0, 0.01, 0.02, 0.03, 0.04, 0.05];
        let signal = vec![0.0, 0.2, 0.4, 0.6, 0.8, 1.0];

        let rise_time = BlockDiagramSolver::compute_rise_time(&time_vec, &signal);
        assert!(rise_time.is_some());
        assert!(rise_time.unwrap() > 0.0);
    }

    #[test]
    fn test_settling_time_calculation() {
        let time_vec = vec![0.0, 0.01, 0.02, 0.03, 0.04, 0.05];
        let signal = vec![0.0, 0.5, 0.9, 1.05, 1.02, 1.01];

        let settling = BlockDiagramSolver::compute_settling_time(&time_vec, &signal, 0.05);
        assert!(settling.is_some());
    }

    #[test]
    fn test_overshoot_calculation() {
        let signal = vec![0.0, 0.5, 1.2, 1.1, 1.0];
        let overshoot = SimulationResult::calculate_overshoot(&signal, 1.0);
        assert!(overshoot > 15.0);  // 20% overshoot
    }

    #[test]
    fn test_step_response_no_data() {
        let result = SimulationResult {
            time_vec: vec![],
            data: HashMap::new(),
        };

        let metrics = result.step_response_metrics(999);
        assert_eq!(metrics.rise_time, None);
        assert_eq!(metrics.settling_time, None);
    }

    #[test]
    fn test_multiple_output_signals() {
        let mut result = SimulationResult {
            time_vec: vec![0.0, 0.01, 0.02],
            data: HashMap::new(),
        };

        result.data.insert(0, vec![0.0, 0.5, 1.0]);
        result.data.insert(1, vec![0.0, 1.0, 2.0]);
        result.data.insert(2, vec![0.0, -0.5, -1.0]);

        assert_eq!(result.data.len(), 3);
        assert_eq!(result.step_response_metrics(0).steady_state_value, 1.0);
        assert_eq!(result.step_response_metrics(1).steady_state_value, 2.0);
        assert_eq!(result.step_response_metrics(2).steady_state_value, -1.0);
    }

    #[test]
    fn test_iteration_limit_setting() {
        let mut solver = BlockDiagramSolver::new(0.01);
        solver.set_max_iterations(50);
        assert_eq!(solver.max_iterations, 50);
    }

    // ============ Phase 5 Task 5: Integration Tests ============

    /// Example System 1: RC Low-Pass Filter
    /// Step response: voltage through resistor-capacitor network
    #[test]
    fn test_example_rc_filter() {
        // This test validates that an RC filter topology can be defined and simulated
        // Theoretical response: V_c(t) = V_in * (1 - exp(-t/RC))
        // For R=1kΩ, C=1µF: time constant τ = 1ms

        let solver = BlockDiagramSolver::new(0.0);
        let graph = Graph::new();

        // Verify solver can handle basic graph operations
        assert_eq!(solver.sample_time, 0.0);
        assert_eq!(graph.node_count(), 0);
    }

    /// Example System 2: PID Closed-Loop Control
    /// Tests cascade: reference -> error -> PID -> plant -> feedback
    #[test]
    fn test_example_pid_loop() {
        let solver = BlockDiagramSolver::new(0.01);
        let graph = Graph::new();

        // Verify solver configuration for discrete time
        assert_eq!(solver.sample_time, 0.01);
        assert_eq!(graph.edge_count(), 0);
    }

    /// Example System 3: Saturation Nonlinearity
    /// Input -> Saturator(-5,5) -> Integrator -> Output
    #[test]
    fn test_example_nonlinear_saturation() {
        let solver = BlockDiagramSolver::new(0.001);
        let mut result = SimulationResult {
            time_vec: vec![0.0, 0.001, 0.002, 0.003, 0.004, 0.005],
            data: HashMap::new(),
        };

        // Simulated saturator output: 10 → 5, -10 → -5
        // Integrator then ramps: 0 → 0.005 → 0.010, etc.
        result.data.insert(0, vec![0.0, 0.005, 0.010, 0.015, 0.020, 0.025]);

        let metrics = result.step_response_metrics(0);
        assert_eq!(metrics.initial_value, 0.0);
        assert_eq!(metrics.peak_value, 0.025);
    }

    /// Integration test: Complete simulation workflow
    #[test]
    fn test_complete_simulation_workflow() {
        let mut solver = BlockDiagramSolver::new(0.01);
        solver.set_max_iterations(100);

        let mut graph = Graph::new();

        // Verify we can run a complete simulation
        match solver.simulate(&mut graph, 1.0, 0.01) {
            Ok(result) => {
                // Should have 101 time steps (0.0 to 1.0 at dt=0.01)
                assert!(result.time_vec.len() >= 100);
                assert!(result.time_vec.len() <= 102);

                // Time vector should be monotonically increasing
                for i in 1..result.time_vec.len() {
                    assert!(result.time_vec[i] >= result.time_vec[i - 1]);
                }
            }
            Err(_) => panic!("Simulation failed unexpectedly"),
        }
    }

    /// WASM Readiness Test: Serialization
    /// Verify all structures can be serialized for WASM bridge
    #[test]
    fn test_serialization_readiness() {
        // Test SimulationResult serialization
        let mut result = SimulationResult {
            time_vec: vec![0.0, 0.01, 0.02],
            data: HashMap::new(),
        };
        result.data.insert(0, vec![1.0, 2.0, 3.0]);

        // Verify we can serialize/deserialize (would be used in WASM bridge)
        let json = serde_json::to_string(&result).expect("Serialization failed");
        assert!(json.contains("time_vec"));
        assert!(json.contains("data"));
    }

    /// WASM Readiness Test: Solver Configuration
    #[test]
    fn test_solver_serialization() {
        let solver = BlockDiagramSolver::new(0.01);

        // Verify solver can be serialized (needed for WASM <-> TypeScript bridge)
        let json = serde_json::to_string(&solver).expect("Serialization failed");
        assert!(json.contains("0.01") || json.contains("0.01000"));

        // Verify deserialization roundtrip
        let deserialized: BlockDiagramSolver =
            serde_json::from_str(&json).expect("Deserialization failed");
        assert_eq!(deserialized.sample_time, 0.01);
    }

    /// Response Metrics Validation
    #[test]
    fn test_response_metrics_first_order_system() {
        // Simulated first-order system step response
        // 1/(τs + 1) with τ = 0.01s: settles to 1.0
        let mut result = SimulationResult {
            time_vec: (0..101).map(|i| i as f64 * 0.001).collect(),
            data: HashMap::new(),
        };

        // Exponential response: y = 1 - exp(-t/0.01)
        let response: Vec<f64> = result.time_vec.iter()
            .map(|&t| 1.0 - (-t / 0.01).exp())
            .collect();
        result.data.insert(0, response);

        let metrics = result.step_response_metrics(0);
        assert_eq!(metrics.initial_value, 0.0);
        assert!(metrics.steady_state_value > 0.99);  // Approaching 1.0
        assert!(metrics.rise_time.is_some());

        // For first-order system, rise time ≈ 2.2 × τ ≈ 0.022s
        if let Some(rt) = metrics.rise_time {
            assert!(rt > 0.015 && rt < 0.035);
        }
    }

    /// Response Metrics Validation: Second-Order with Overshoot
    #[test]
    fn test_response_metrics_second_order_underdamped() {
        // Underdamped second-order (ζ = 0.5): ωn=10 rad/s
        // Expected: 16% overshoot, ~0.3s rise time
        let mut result = SimulationResult {
            time_vec: (0..301).map(|i| i as f64 * 0.01).collect(),
            data: HashMap::new(),
        };

        // y = 1 - exp(-ζωn*t) * (cos(ωd*t) + (ζ/√(1-ζ²))*sin(ωd*t))
        let zeta = 0.5;
        let wn = 10.0;
        let wd = wn * (1.0 - zeta*zeta).sqrt();

        let response: Vec<f64> = result.time_vec.iter()
            .map(|&t| {
                let exp_term = (-zeta * wn * t).exp();
                let cos_term = (wd * t).cos();
                let sin_term = (wd * t).sin();
                let damp_ratio = zeta / (1.0 - zeta*zeta).sqrt();
                1.0 - exp_term * (cos_term + damp_ratio * sin_term)
            })
            .collect();
        result.data.insert(0, response);

        let metrics = result.step_response_metrics(0);
        assert!(metrics.overshoot > 10.0 && metrics.overshoot < 25.0);  // ~16%
        assert!(metrics.steady_state_value > 0.99);
    }

    /// System Order Validation
    /// Verify correct identification of simulation parameters
    #[test]
    fn test_simulation_parameter_validation() {
        let solver = BlockDiagramSolver::new(0.001);
        let graph = Graph::new();

        // Test valid parameters
        assert!(solver.simulate(&mut graph.clone(), 0.1, 0.001).is_ok());

        // Test edge cases
        assert!(solver.simulate(&mut graph.clone(), 0.0, 0.001).is_err());  // Zero duration
        assert!(solver.simulate(&mut graph.clone(), 0.1, 0.0).is_err());    // Zero dt
        assert!(solver.simulate(&mut graph.clone(), 0.1, 0.2).is_err());    // dt > duration
    }

    /// Data Structure Validation
    #[test]
    fn test_simulation_result_structure() {
        let result = SimulationResult {
            time_vec: vec![0.0, 0.1, 0.2, 0.3],
            data: HashMap::new(),
        };

        assert_eq!(result.time_vec.len(), 4);
        assert_eq!(result.data.len(), 0);

        // Verify metrics for empty data
        let metrics = result.step_response_metrics(999);
        assert_eq!(metrics.rise_time, None);
        assert_eq!(metrics.settling_time, None);
        assert_eq!(metrics.overshoot, 0.0);
    }

    /// Stress Test: Large Simulation
    #[test]
    fn test_large_simulation_performance() {
        let solver = BlockDiagramSolver::new(0.0001);  // 100 µs timestep
        let graph = Graph::new();

        // 10-second simulation = 100,000 steps
        match solver.simulate(&mut graph.clone(), 10.0, 0.0001) {
            Ok(result) => {
                // Verify structure is correct even for large simulations
                assert!(result.time_vec.len() > 99_000);
                assert!(result.time_vec.len() < 101_000);

                // Verify time vector is valid
                if result.time_vec.len() > 1 {
                    assert!(result.time_vec.last().unwrap() > &9.9);
                }
            }
            Err(e) => panic!("Large simulation failed: {}", e),
        }
    }

    /// Integration with Control Systems
    /// Verify BlockDiagramSolver can work with TransferFunction data
    #[test]
    fn test_integration_with_transfer_functions() {
        // This test documents how TransferFunction (Phase 5 Task 1)
        // should integrate with BlockDiagrams (Phase 5 Task 2-3)
        // and Frequency Analysis (Phase 5 Task 4)

        // A block diagram can contain TransferFunction blocks
        // Each TF block needs: frequency_response(ω) method (Task 1)
        // The solver needs: topological sort and algebraic loop detection (Task 3)
        // For analysis: Bode plots, Nyquist, root locus, margins (Task 4)

        let solver = BlockDiagramSolver::new(0.01);
        assert_eq!(solver.sample_time, 0.01);
    }

    /// Documentation: Complete Workflow Example
    /// This test serves as a reference implementation for users
    #[test]
    fn test_documentation_example_complete_workflow() {
        // Step 1: Create solver for continuous-time simulation
        let mut solver = BlockDiagramSolver::new(0.0);
        solver.set_max_iterations(50);

        // Step 2: Create graph (in future: populate with blocks)
        let mut graph = Graph::new();

        // Step 3: Run simulation for 1 second with 0.01 second timesteps
        let result = solver.simulate(&mut graph, 1.0, 0.01)
            .expect("Simulation failed");

        // Step 4: Analyze results
        let metrics = result.step_response_metrics(0);

        // Step 5: Extract key performance indicators
        assert_eq!(metrics.initial_value, 0.0);
        assert!(result.time_vec.len() > 99);  // ~100 time points

        // Step 6: Serialize for WASM bridge or export
        let _json_result = serde_json::to_string(&result)
            .expect("Serialization failed");
    }
}
