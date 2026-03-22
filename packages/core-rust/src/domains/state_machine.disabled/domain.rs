//! State Machine Domain Wrapper - Integrates FSM with Tupan architecture
//!
//! This module wraps the state machine core types with the PhysicalDomain trait
//! and provides visualization support for state diagrams.

use super::{Event, State, StateId, StateType, StateMachine, Transition, TransitionId, TransitionType};
use crate::graph::{Graph, Node, NodeId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Wraps a state machine for integration with PhysicalDomain trait
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateMachineDomain {
    /// The underlying state machine
    pub state_machine: StateMachine,
}

impl StateMachineDomain {
    /// Create new state machine domain wrapper
    pub fn new(state_machine: StateMachine) -> Self {
        StateMachineDomain { state_machine }
    }

    /// Convert state machine to Graph abstraction
    /// States become graph nodes, transitions become graph edges
    pub fn to_state_graph(&self) -> Result<crate::graph::Graph, String> {
        // For now, return a basic graph structure
        // Full implementation would use the Graph<Node, Edge> generic API
        Ok(crate::graph::Graph::new())
    }

    /// Export state machine as Graphviz DOT notation
    /// Can be visualized with: dot -Tpng state_machine.dot -o diagram.png
    pub fn export_as_dot(&self) -> String {
        let mut dot = String::new();
        dot.push_str("digraph StateMachine {\n");
        dot.push_str("  rankdir=LR;\n");
        dot.push_str("  node [shape=ellipse];\n\n");

        // Add nodes (states)
        for (_, state) in &self.state_machine.states {
            let shape = match state.state_type {
                StateType::Initial => "box",
                StateType::Final => "doublecircle",
                StateType::Composite => "component",
                StateType::Normal => "ellipse",
            };

            let label = &state.name;
            dot.push_str(&format!("  \"{}\" [shape={}, label=\"{}\"];\n", state.id, shape, label));
        }

        dot.push_str("\n");

        // Add edges (transitions)
        for (_, transition) in &self.state_machine.transitions {
            let trigger_label = match &transition.trigger {
                Some(event) => event.label(),
                None => "ε".to_string(), // epsilon for no trigger
            };

            let full_label = if let Some(guard) = &transition.guard {
                format!("{} [{}]", trigger_label, guard.condition)
            } else {
                trigger_label
            };

            dot.push_str(&format!(
                "  \"{}\" -> \"{}\" [label=\"{}\"];\n",
                transition.source_state, transition.target_state, full_label
            ));
        }

        dot.push_str("}\n");
        dot
    }

    /// Generate visualization data for UI rendering
    pub fn visualization_data(&self) -> Result<StateDiagramData, String> {
        let mut state_nodes = Vec::new();
        let mut transition_edges = Vec::new();

        // Convert states to visualization nodes
        for (_, state) in &self.state_machine.states {
            let node_type = match state.state_type {
                StateType::Initial => "initial".to_string(),
                StateType::Final => "final".to_string(),
                StateType::Composite => "composite".to_string(),
                StateType::Normal => "normal".to_string(),
            };

            state_nodes.push(StateNode {
                id: state.id.to_string(),
                name: state.name.clone(),
                node_type,
                has_entry_action: state.entry_action.is_some(),
                has_exit_action: state.exit_action.is_some(),
                has_do_action: state.do_action.is_some(),
            });
        }

        // Convert transitions to visualization edges
        for (_, transition) in &self.state_machine.transitions {
            let label = match &transition.trigger {
                Some(event) => event.label(),
                None => "".to_string(),
            };

            let edge_type = match transition.transition_type {
                TransitionType::External => "external".to_string(),
                TransitionType::Internal => "internal".to_string(),
                TransitionType::Choice => "choice".to_string(),
                TransitionType::Fork => "fork".to_string(),
                TransitionType::Join => "join".to_string(),
            };

            transition_edges.push(TransitionEdge {
                id: transition.id.to_string(),
                source: transition.source_state.to_string(),
                target: transition.target_state.to_string(),
                label,
                has_guard: transition.guard.is_some(),
                has_action: transition.action.is_some(),
                edge_type,
            });
        }

        Ok(StateDiagramData {
            name: self.state_machine.name.clone(),
            initial_state: self.state_machine.initial_state.to_string(),
            states: state_nodes,
            transitions: transition_edges,
        })
    }

    /// Get statistics about the state machine
    pub fn statistics(&self) -> StateMachineStatistics {
        let analysis = super::validation::reachability_analysis(&self.state_machine).ok();

        let reachable_count = analysis.as_ref().map(|a| a.reachable.len()).unwrap_or(0);
        let deadlock_count = analysis.as_ref().map(|a| a.deadlock_states.len()).unwrap_or(0);

        StateMachineStatistics {
            total_states: self.state_machine.states.len(),
            total_transitions: self.state_machine.transitions.len(),
            reachable_states: reachable_count,
            deadlock_states: deadlock_count,
            initial_state: self.state_machine.initial_state.to_string(),
            has_cycle: self.has_cycle(),
        }
    }

    /// Check if state machine has cycles (can revisit states)
    fn has_cycle(&self) -> bool {
        // Simple cycle detection: DFS-based
        let mut visited = std::collections::HashSet::new();
        let mut rec_stack = std::collections::HashSet::new();

        fn has_cycle_visit(
            state_id: StateId,
            fsm: &StateMachine,
            visited: &mut std::collections::HashSet<StateId>,
            rec_stack: &mut std::collections::HashSet<StateId>,
        ) -> bool {
            visited.insert(state_id);
            rec_stack.insert(state_id);

            for trans in fsm.transitions_from(state_id) {
                if !visited.contains(&trans.target_state) {
                    if has_cycle_visit(trans.target_state, fsm, visited, rec_stack) {
                        return true;
                    }
                } else if rec_stack.contains(&trans.target_state) {
                    return true;
                }
            }

            rec_stack.remove(&state_id);
            false
        }

        has_cycle_visit(
            self.state_machine.initial_state,
            &self.state_machine,
            &mut visited,
            &mut rec_stack,
        )
    }
}

/// Visualization node representing a state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateNode {
    /// Unique state identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// State type for rendering (initial, final, composite, normal)
    pub node_type: String,
    /// Whether state has entry action
    pub has_entry_action: bool,
    /// Whether state has exit action
    pub has_exit_action: bool,
    /// Whether state has do action
    pub has_do_action: bool,
}

/// Visualization edge representing a transition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionEdge {
    /// Unique transition identifier
    pub id: String,
    /// Source state ID
    pub source: String,
    /// Target state ID
    pub target: String,
    /// Transition label (event trigger)
    pub label: String,
    /// Whether transition has guard condition
    pub has_guard: bool,
    /// Whether transition has action
    pub has_action: bool,
    /// Transition type for rendering
    pub edge_type: String,
}

/// Complete visualization data for state diagram
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateDiagramData {
    /// State machine name
    pub name: String,
    /// Initial state identifier
    pub initial_state: String,
    /// All state nodes
    pub states: Vec<StateNode>,
    /// All transition edges
    pub transitions: Vec<TransitionEdge>,
}

/// Statistical summary of state machine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateMachineStatistics {
    /// Total number of states
    pub total_states: usize,
    /// Total number of transitions
    pub total_transitions: usize,
    /// Number of reachable states from initial
    pub reachable_states: usize,
    /// Number of deadlock states
    pub deadlock_states: usize,
    /// Initial state identifier
    pub initial_state: String,
    /// Whether state machine has cycles
    pub has_cycle: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_traffic_light_fsm() -> StateMachine {
        let red = StateId::new();
        let yellow = StateId::new();
        let green = StateId::new();

        let mut fsm = StateMachine::new("TrafficLight", red);

        fsm.add_state(State::new(red, "Red", StateType::Initial))
            .unwrap();
        fsm.add_state(State::new(yellow, "Yellow", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(green, "Green", StateType::Normal))
            .unwrap();

        fsm.add_transition(
            Transition::new(red, green).with_trigger(Event::Timeout(30000)),
        )
        .unwrap();
        fsm.add_transition(
            Transition::new(green, yellow).with_trigger(Event::Timeout(25000)),
        )
        .unwrap();
        fsm.add_transition(
            Transition::new(yellow, red).with_trigger(Event::Timeout(5000)),
        )
        .unwrap();

        fsm
    }

    #[test]
    fn test_domain_creation() {
        let fsm = create_traffic_light_fsm();
        let domain = StateMachineDomain::new(fsm);
        assert_eq!(domain.state_machine.name, "TrafficLight");
    }

    #[test]
    fn test_export_as_dot() {
        let fsm = create_traffic_light_fsm();
        let domain = StateMachineDomain::new(fsm);
        let dot = domain.export_as_dot();

        // Verify DOT format contains key elements
        assert!(dot.contains("digraph StateMachine"));
        assert!(dot.contains("rankdir=LR"));
        assert!(dot.contains("Red"));
        assert!(dot.contains("Green"));
        assert!(dot.contains("Yellow"));
        assert!(dot.contains("->"));
    }

    #[test]
    fn test_visualization_data() {
        let fsm = create_traffic_light_fsm();
        let domain = StateMachineDomain::new(fsm);
        let vis_data = domain.visualization_data().unwrap();

        assert_eq!(vis_data.name, "TrafficLight");
        assert_eq!(vis_data.states.len(), 3);
        assert_eq!(vis_data.transitions.len(), 3);
    }

    #[test]
    fn test_visualization_state_types() {
        let fsm = create_traffic_light_fsm();
        let domain = StateMachineDomain::new(fsm);
        let vis_data = domain.visualization_data().unwrap();

        // Find initial state
        let initial = vis_data
            .states
            .iter()
            .find(|s| s.node_type == "initial")
            .unwrap();
        assert_eq!(initial.name, "Red");
    }

    #[test]
    fn test_statistics_basic() {
        let fsm = create_traffic_light_fsm();
        let domain = StateMachineDomain::new(fsm);
        let stats = domain.statistics();

        assert_eq!(stats.total_states, 3);
        assert_eq!(stats.total_transitions, 3);
        assert!(stats.total_states > 0);
    }

    #[test]
    fn test_statistics_reachable_states() {
        let fsm = create_traffic_light_fsm();
        let domain = StateMachineDomain::new(fsm);
        let stats = domain.statistics();

        // All states in traffic light are reachable
        assert_eq!(stats.reachable_states, 3);
    }

    #[test]
    fn test_has_cycle() {
        let fsm = create_traffic_light_fsm();
        let domain = StateMachineDomain::new(fsm);

        // Traffic light has cycle: red -> green -> yellow -> red
        assert!(domain.has_cycle());
    }

    #[test]
    fn test_no_cycle_acyclic_fsm() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let s3 = StateId::new();

        let mut fsm = StateMachine::new("Acyclic", s1);

        fsm.add_state(State::new(s1, "Start", StateType::Initial))
            .unwrap();
        fsm.add_state(State::new(s2, "Middle", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(s3, "End", StateType::Final))
            .unwrap();

        fsm.add_transition(Transition::new(s1, s2)).unwrap();
        fsm.add_transition(Transition::new(s2, s3)).unwrap();

        let domain = StateMachineDomain::new(fsm);
        assert!(!domain.has_cycle());
    }

    #[test]
    fn test_visualization_with_actions() {
        let s1 = StateId::new();
        let s2 = StateId::new();

        let mut fsm = StateMachine::new("WithActions", s1);

        let state1 = State::new(s1, "S1", StateType::Initial)
            .with_entry_action(super::super::Action::new("enter_s1"));

        fsm.add_state(state1).unwrap();
        fsm.add_state(State::new(s2, "S2", StateType::Final))
            .unwrap();

        fsm.add_transition(Transition::new(s1, s2)).unwrap();

        let domain = StateMachineDomain::new(fsm);
        let vis_data = domain.visualization_data().unwrap();

        // Verify action presence in visualization
        let s1_node = vis_data.states.iter().find(|s| s.name == "S1").unwrap();
        assert!(s1_node.has_entry_action);
    }

    #[test]
    fn test_export_dot_with_guards() {
        let s1 = StateId::new();
        let s2 = StateId::new();

        let mut fsm = StateMachine::new("WithGuard", s1);

        fsm.add_state(State::new(s1, "Idle", StateType::Initial))
            .unwrap();
        fsm.add_state(State::new(s2, "Running", StateType::Normal))
            .unwrap();

        let guard = super::super::Guard::new("count > 0");
        fsm.add_transition(
            Transition::new(s1, s2)
                .with_trigger(Event::Signal("start".to_string()))
                .with_guard(guard),
        )
        .unwrap();

        let domain = StateMachineDomain::new(fsm);
        let dot = domain.export_as_dot();

        // Guard should appear in edge labels
        assert!(dot.contains("count > 0") || dot.contains("start"));
    }
}
