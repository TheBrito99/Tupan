//! Petri Net Analysis - Liveness, safety, and reachability properties

use super::{Marking, PetriNet, PetriNetExecutor, TransitionId};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Analysis result for a Petri net
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    /// Number of reachable markings
    pub reachable_count: usize,
    /// Is the net live (can always make progress)
    pub is_live: bool,
    /// Is the net safe (≤1 token per place)
    pub is_safe: bool,
    /// Is the net deadlock-free
    pub is_deadlock_free: bool,
    /// Maximum tokens in any place across reachable markings
    pub max_tokens: u32,
    /// Places with capacity violations
    pub capacity_violations: Vec<String>,
    /// Transitions that can never fire (dead transitions)
    pub dead_transitions: Vec<TransitionId>,
}

/// Analyze Petri net properties
pub fn analyze_petri_net(net: &PetriNet) -> Result<AnalysisResult, String> {
    let executor = PetriNetExecutor::new(net.clone())?;

    // Compute reachable markings
    let reachable = executor.reachable_markings()?;
    let reachable_count = reachable.len();

    // Check liveness
    let is_live = executor.is_live()?;

    // Check safety
    let is_safe = executor.is_safe()?;

    // Check deadlock-free
    let is_deadlock_free = executor.is_deadlock_free()?;

    // Find max tokens
    let max_tokens = reachable
        .iter()
        .flat_map(|m| m.tokens.values())
        .max()
        .copied()
        .unwrap_or(0);

    // Check capacity violations
    let capacity_violations = check_capacity_violations(net, &reachable);

    // Find dead transitions
    let dead_transitions = find_dead_transitions(net, &executor, &reachable)?;

    Ok(AnalysisResult {
        reachable_count,
        is_live,
        is_safe,
        is_deadlock_free,
        max_tokens,
        capacity_violations,
        dead_transitions,
    })
}

/// Find places with capacity violations
fn check_capacity_violations(net: &PetriNet, reachable: &[Marking]) -> Vec<String> {
    let mut violations = Vec::new();

    for (pid, place) in &net.places {
        if let Some(capacity) = place.capacity {
            for marking in reachable {
                if marking.get(*pid) > capacity {
                    violations.push(format!(
                        "{}: {} tokens exceed capacity {}",
                        place.name,
                        marking.get(*pid),
                        capacity
                    ));
                }
            }
        }
    }

    violations
}

/// Find transitions that can never fire
///
/// Optimized to avoid expensive executor cloning.
/// Instead, we use `is_enabled_with_marking()` to check enablement with arbitrary markings.
///
/// # Complexity
/// O(T × M × A) where:
/// - T = number of transitions
/// - M = number of reachable markings
/// - A = average number of input arcs per transition
///
/// Previous complexity was O(T × M × C) where C is the clone cost of the entire executor.
fn find_dead_transitions(
    net: &PetriNet,
    executor: &PetriNetExecutor,
    reachable: &[Marking],
) -> Result<Vec<TransitionId>, String> {
    let mut dead_transitions = Vec::new();

    for (tid, _) in &net.transitions {
        let mut can_fire = false;

        // Check if transition can fire in ANY reachable marking
        // Early exit as soon as we find one marking where it can fire
        for marking in reachable {
            if executor.is_enabled_with_marking(*tid, marking) {
                can_fire = true;
                break;
            }
        }

        if !can_fire {
            dead_transitions.push(*tid);
        }
    }

    Ok(dead_transitions)
}

/// Generate human-readable analysis report
///
/// # Errors
/// Returns `Err(String)` if:
/// - Reachability analysis fails (infinite search space)
/// - Network validation fails (disconnected components)
/// - Cycle detection fails (system error)
pub fn generate_analysis_report(net: &PetriNet) -> Result<String, String> {
    let mut report = String::new();

    report.push_str(&format!("Petri Net Analysis Report: {}\n", net.name));
    report.push_str(&format!(
        "Places: {}, Transitions: {}, Arcs: {}\n\n",
        net.places.len(),
        net.transitions.len(),
        net.arcs.len()
    ));

    // Propagate error instead of silently swallowing it
    let result = analyze_petri_net(net)?;

    report.push_str("✓ Analysis Completed\n\n");
    report.push_str(&format!("Reachable Markings: {}\n", result.reachable_count));
    report.push_str(&format!(
        "Live (can always progress): {}\n",
        if result.is_live { "✓ YES" } else { "✗ NO" }
    ));
    report.push_str(&format!(
        "Safe (≤1 token per place): {}\n",
        if result.is_safe { "✓ YES" } else { "✗ NO" }
    ));
    report.push_str(&format!(
        "Deadlock-Free: {}\n",
        if result.is_deadlock_free { "✓ YES" } else { "✗ NO" }
    ));
    report.push_str(&format!("Max Tokens (any marking): {}\n", result.max_tokens));

    if !result.capacity_violations.is_empty() {
        report.push_str("\n⚠ Capacity Violations:\n");
        for violation in &result.capacity_violations {
            report.push_str(&format!("  - {}\n", violation));
        }
    }

    if !result.dead_transitions.is_empty() {
        report.push_str("\n⚠ Dead Transitions (never fire):\n");
        for tid in &result.dead_transitions {
            if let Some(transition) = net.transitions.get(tid) {
                report.push_str(&format!("  - {}\n", transition.name));
            }
        }
    }

    if result.is_live && result.is_safe && result.is_deadlock_free {
        report.push_str("\n✓ Net has good properties\n");
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::petri_net::{Arc, Element, Place, Transition};

    fn create_valid_net() -> PetriNet {
        let mut net = PetriNet::new("ValidNet");
        let p1 = Place::unbounded("P1");
        let p2 = Place::unbounded("P2");
        let t1 = Transition::simple("T1");

        let p1_id = p1.id;
        let p2_id = p2.id;
        let t1_id = t1.id;

        net.add_place(p1).unwrap();
        net.add_place(p2).unwrap();
        net.add_transition(t1).unwrap();

        net.add_arc(Arc::new(
            Element::Place(p1_id),
            Element::Transition(t1_id),
            1,
        ))
        .unwrap();
        net.add_arc(Arc::new(
            Element::Transition(t1_id),
            Element::Place(p2_id),
            1,
        ))
        .unwrap();

        net
    }

    #[test]
    fn test_analyze_valid_net() {
        let net = create_valid_net();
        let result = analyze_petri_net(&net);
        assert!(result.is_ok());
    }

    #[test]
    fn test_reachable_count() {
        let net = create_valid_net();
        let result = analyze_petri_net(&net).unwrap();
        assert!(result.reachable_count > 0);
    }

    #[test]
    fn test_dead_transitions() {
        let mut net = PetriNet::new("DeadNet");
        let p1 = Place::unbounded("P1");
        let t1 = Transition::simple("T1");
        let t2 = Transition::simple("T2");

        let p1_id = p1.id;
        let t1_id = t1.id;
        let t2_id = t2.id;

        net.add_place(p1).unwrap();
        net.add_transition(t1).unwrap();
        net.add_transition(t2).unwrap();

        // Only T1 can fire
        net.add_arc(Arc::new(
            Element::Place(p1_id),
            Element::Transition(t1_id),
            1,
        ))
        .unwrap();

        let result = analyze_petri_net(&net).unwrap();
        assert!(result.dead_transitions.contains(&t2_id));
    }

    #[test]
    fn test_report_generation_success() {
        let net = create_valid_net();
        let report = generate_analysis_report(&net).expect("Report generation should succeed");
        assert!(report.contains("Petri Net Analysis Report"));
        assert!(report.contains("Reachable Markings"));
        assert!(report.contains("✓ Analysis Completed"));
    }

    #[test]
    fn test_report_generation_error_propagation() {
        // Create a net that will fail analysis (empty net with no tokens)
        let net = PetriNet::new("EmptyNet");
        let report = generate_analysis_report(&net);
        // Should propagate the error from analyze_petri_net
        assert!(report.is_err());
    }
}
