//! State Machine Validation - Reachability analysis and error checking

use super::{StateId, StateMachine, StateType};
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};

/// Reachability analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReachabilityAnalysis {
    /// States reachable from initial state
    pub reachable: HashSet<StateId>,
    /// Unreachable states (dead code)
    pub unreachable: HashSet<StateId>,
    /// States with no outgoing transitions (deadlock candidates)
    pub deadlock_states: Vec<StateId>,
    /// States that can reach a final state
    pub co_reachable: HashSet<StateId>,
}

impl ReachabilityAnalysis {
    /// Check if state is reachable
    pub fn is_reachable(&self, state: StateId) -> bool {
        self.reachable.contains(&state)
    }

    /// Check if state can reach a final state
    pub fn can_reach_final(&self, state: StateId) -> bool {
        self.co_reachable.contains(&state)
    }

    /// Check if state is potentially problematic
    pub fn is_problematic(&self, state: StateId) -> bool {
        !self.is_reachable(state) || (!self.can_reach_final(state) && !self.deadlock_states.contains(&state))
    }
}

/// Validate state machine structure
pub fn validate_state_machine(fsm: &StateMachine) -> Result<(), Vec<String>> {
    let mut errors = Vec::new();

    // Check initial state exists
    if !fsm.states.contains_key(&fsm.initial_state) {
        errors.push(format!(
            "Initial state {} does not exist",
            fsm.initial_state
        ));
    }

    // Check all transitions reference valid states
    for (tid, trans) in &fsm.transitions {
        if !fsm.states.contains_key(&trans.source_state) {
            errors.push(format!(
                "Transition {} references non-existent source state {}",
                tid, trans.source_state
            ));
        }
        if !fsm.states.contains_key(&trans.target_state) {
            errors.push(format!(
                "Transition {} references non-existent target state {}",
                tid, trans.target_state
            ));
        }
    }

    // Check at least one initial state
    let initial_count = fsm
        .states
        .values()
        .filter(|s| s.state_type == StateType::Initial)
        .count();
    if initial_count == 0 && !fsm.states.is_empty() {
        // Not necessarily an error, but warn if states exist
    }

    // Check at least one final state for non-empty FSM
    if !fsm.states.is_empty() {
        let final_count = fsm
            .states
            .values()
            .filter(|s| s.state_type == StateType::Final)
            .count();
        if final_count == 0 {
            errors.push("State machine has no final states".to_string());
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Compute reachable states using BFS
pub fn reachability_analysis(fsm: &StateMachine) -> Result<ReachabilityAnalysis, String> {
    let mut reachable = HashSet::new();
    let mut queue = VecDeque::new();

    queue.push_back(fsm.initial_state);
    reachable.insert(fsm.initial_state);

    while let Some(state_id) = queue.pop_front() {
        // Find all transitions from this state
        for transition in fsm.transitions_from(state_id) {
            let target = transition.target_state;
            if !reachable.contains(&target) {
                reachable.insert(target);
                queue.push_back(target);
            }
        }
    }

    // Find unreachable states
    let unreachable: HashSet<StateId> = fsm
        .states
        .keys()
        .filter(|s| !reachable.contains(s))
        .copied()
        .collect();

    // Find co-reachable states (can reach final state)
    let co_reachable = compute_co_reachable(fsm);

    // Find deadlock states (non-final with no outgoing transitions)
    let deadlock_states: Vec<StateId> = fsm
        .states
        .iter()
        .filter(|(id, state)| {
            state.state_type != StateType::Final && fsm.transitions_from(**id).is_empty()
        })
        .map(|(id, _)| *id)
        .collect();

    Ok(ReachabilityAnalysis {
        reachable,
        unreachable,
        deadlock_states,
        co_reachable,
    })
}

/// Compute co-reachable states (can reach a final state)
fn compute_co_reachable(fsm: &StateMachine) -> HashSet<StateId> {
    let mut co_reachable = HashSet::new();

    // Mark all final states as co-reachable
    for (id, state) in &fsm.states {
        if state.state_type == StateType::Final {
            co_reachable.insert(*id);
        }
    }

    // Backward propagate: if a state has transition to co_reachable, it's co_reachable
    let mut changed = true;
    while changed {
        changed = false;
        for (id, _) in &fsm.states {
            if !co_reachable.contains(id) {
                for transition in fsm.transitions_from(*id) {
                    if co_reachable.contains(&transition.target_state) {
                        co_reachable.insert(*id);
                        changed = true;
                        break;
                    }
                }
            }
        }
    }

    co_reachable
}

/// Generate error report
pub fn generate_error_report(fsm: &StateMachine) -> String {
    let mut report = String::new();

    // Validate structure
    match validate_state_machine(fsm) {
        Ok(_) => report.push_str("✓ Structure validation: PASS\n"),
        Err(errors) => {
            report.push_str("✗ Structure validation: FAIL\n");
            for error in errors {
                report.push_str(&format!("  - {}\n", error));
            }
        }
    }

    // Reachability analysis
    match reachability_analysis(fsm) {
        Ok(analysis) => {
            report.push_str("\n✓ Reachability Analysis:\n");
            report.push_str(&format!("  - Reachable states: {}\n", analysis.reachable.len()));
            report.push_str(&format!("  - Unreachable states: {}\n", analysis.unreachable.len()));

            if !analysis.unreachable.is_empty() {
                report.push_str("  - Unreachable: ");
                for (i, sid) in analysis.unreachable.iter().enumerate() {
                    if let Some(state) = fsm.states.get(sid) {
                        report.push_str(&format!("{}{}", state.name, if i < analysis.unreachable.len() - 1 { ", " } else { "" }));
                    }
                }
                report.push('\n');
            }

            report.push_str(&format!("  - Deadlock states: {}\n", analysis.deadlock_states.len()));
            if !analysis.deadlock_states.is_empty() {
                report.push_str("  - Deadlock: ");
                for (i, sid) in analysis.deadlock_states.iter().enumerate() {
                    if let Some(state) = fsm.states.get(sid) {
                        report.push_str(&format!("{}{}", state.name, if i < analysis.deadlock_states.len() - 1 { ", " } else { "" }));
                    }
                }
                report.push('\n');
            }

            report.push_str(&format!("  - Co-reachable (can reach final): {}\n", analysis.co_reachable.len()));
        }
        Err(e) => {
            report.push_str(&format!("✗ Reachability Analysis: {}\n", e));
        }
    }

    report
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::state_machine::{State, StateId, StateType, Transition};

    fn create_valid_fsm() -> StateMachine {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let mut fsm = StateMachine::new("ValidFSM", s1);

        fsm.add_state(State::new(s1, "Initial", StateType::Initial))
            .unwrap();
        fsm.add_state(State::new(s2, "Final", StateType::Final))
            .unwrap();

        fsm.add_transition(Transition::new(s1, s2))
            .unwrap();

        fsm
    }

    #[test]
    fn test_validate_valid_fsm() {
        let fsm = create_valid_fsm();
        assert!(validate_state_machine(&fsm).is_ok());
    }

    #[test]
    fn test_reachability_simple() {
        let fsm = create_valid_fsm();
        let analysis = reachability_analysis(&fsm).unwrap();

        assert!(analysis.is_reachable(fsm.initial_state));
    }

    #[test]
    fn test_unreachable_states() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let s3 = StateId::new();
        let mut fsm = StateMachine::new("FSM", s1);

        fsm.add_state(State::new(s1, "S1", StateType::Initial))
            .unwrap();
        fsm.add_state(State::new(s2, "S2", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(s3, "S3", StateType::Final))
            .unwrap();

        // Only s1 -> s2, so s3 is unreachable
        fsm.add_transition(Transition::new(s1, s2))
            .unwrap();

        let analysis = reachability_analysis(&fsm).unwrap();
        assert!(!analysis.is_reachable(s3));
        assert!(analysis.unreachable.contains(&s3));
    }

    #[test]
    fn test_deadlock_detection() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let mut fsm = StateMachine::new("FSM", s1);

        fsm.add_state(State::new(s1, "S1", StateType::Initial))
            .unwrap();
        fsm.add_state(State::new(s2, "S2", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(StateId::new(), "Final", StateType::Final))
            .unwrap();

        // s1 -> s2, but s2 has no outgoing transitions (deadlock)
        fsm.add_transition(Transition::new(s1, s2))
            .unwrap();

        let analysis = reachability_analysis(&fsm).unwrap();
        assert!(analysis.deadlock_states.contains(&s2));
    }

    #[test]
    fn test_co_reachable() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let s3 = StateId::new();
        let mut fsm = StateMachine::new("FSM", s1);

        fsm.add_state(State::new(s1, "S1", StateType::Initial))
            .unwrap();
        fsm.add_state(State::new(s2, "S2", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(s3, "S3", StateType::Final))
            .unwrap();

        fsm.add_transition(Transition::new(s1, s2))
            .unwrap();
        fsm.add_transition(Transition::new(s2, s3))
            .unwrap();

        let analysis = reachability_analysis(&fsm).unwrap();
        assert!(analysis.can_reach_final(s1));
        assert!(analysis.can_reach_final(s2));
    }

    #[test]
    fn test_error_report_generation() {
        let fsm = create_valid_fsm();
        let report = generate_error_report(&fsm);

        assert!(report.contains("PASS"));
        assert!(report.contains("Reachability Analysis"));
    }
}
