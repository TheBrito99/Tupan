//! Petri Net Executor - Token firing and marking evolution

use super::{Arc, ArcType, Element, Marking as BasMarking, PetriNet, PlaceId, TransitionId};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

/// Firing rule for transitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiringRule {
    /// Transition that can fire
    pub transition: TransitionId,
    /// Places that must have sufficient tokens
    pub required_tokens: HashMap<PlaceId, u32>,
    /// Places that must be empty (inhibitor arcs)
    pub must_be_empty: HashSet<PlaceId>,
    /// Net change after firing
    pub token_changes: HashMap<PlaceId, i32>,
}

/// Marking - snapshot of token distribution
#[derive(Debug, Clone, Serialize, Deserialize, Eq, PartialEq, Hash)]
pub struct Marking {
    /// Tokens in each place
    pub tokens: HashMap<PlaceId, u32>,
}

impl Marking {
    /// Create marking from initial places
    pub fn from_net(net: &PetriNet) -> Self {
        let mut tokens = HashMap::new();
        for (pid, place) in &net.places {
            tokens.insert(*pid, place.initial_tokens);
        }
        Marking { tokens }
    }

    /// Get tokens in a place
    pub fn get(&self, place: PlaceId) -> u32 {
        self.tokens.get(&place).copied().unwrap_or(0)
    }

    /// Set tokens in a place
    pub fn set(&mut self, place: PlaceId, count: u32) {
        self.tokens.insert(place, count);
    }

    /// Add tokens to a place
    pub fn add(&mut self, place: PlaceId, count: u32) {
        let current = self.get(place);
        self.set(place, current + count);
    }

    /// Remove tokens from a place
    pub fn remove(&mut self, place: PlaceId, count: u32) -> Result<(), String> {
        let current = self.get(place);
        if current < count {
            return Err(format!(
                "Insufficient tokens in place {} ({} < {})",
                place, current, count
            ));
        }
        self.set(place, current - count);
        Ok(())
    }

    /// Check if two markings are equal
    pub fn equals(&self, other: &Marking) -> bool {
        self == other
    }

    /// Get total token count
    pub fn total_tokens(&self) -> u32 {
        self.tokens.values().sum()
    }

    /// Check if place is empty
    pub fn is_empty(&self, place: PlaceId) -> bool {
        self.get(place) == 0
    }
}

/// Petri Net Executor - runs Petri net with markings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetriNetExecutor {
    /// The Petri net
    net: PetriNet,
    /// Current marking
    current_marking: Marking,
    /// History of markings
    marking_history: Vec<Marking>,
    /// Firing history
    firing_history: Vec<(TransitionId, Marking, Marking)>,
}

impl PetriNetExecutor {
    /// Create new executor for Petri net
    pub fn new(net: PetriNet) -> Result<Self, String> {
        net.validate()?;

        let marking = Marking::from_net(&net);

        Ok(PetriNetExecutor {
            net,
            current_marking: marking.clone(),
            marking_history: vec![marking],
            firing_history: Vec::new(),
        })
    }

    /// Get current marking
    pub fn current_marking(&self) -> &Marking {
        &self.current_marking
    }

    /// Get all enabled transitions
    pub fn enabled_transitions(&self) -> Vec<TransitionId> {
        self.enabled_transitions_with_marking(&self.current_marking)
    }

    /// Get all enabled transitions for a specific marking (non-mutating)
    ///
    /// Allows checking which transitions can fire with arbitrary markings
    /// without cloning the executor.
    ///
    /// # Complexity
    /// O(T × A) where T is number of transitions, A is average input arcs per transition
    pub fn enabled_transitions_with_marking(&self, marking: &Marking) -> Vec<TransitionId> {
        let mut enabled = Vec::new();

        for (tid, _) in &self.net.transitions {
            if self.is_enabled_with_marking(*tid, marking) {
                enabled.push(*tid);
            }
        }

        enabled
    }

    /// Check if transition is enabled
    pub fn is_enabled(&self, tid: TransitionId) -> bool {
        self.is_enabled_with_marking(tid, &self.current_marking)
    }

    /// Check if transition is enabled with a specific marking (non-mutating)
    ///
    /// This allows checking enablement with arbitrary markings without cloning the executor.
    /// Useful for reachability analysis and simulation without expensive clones.
    ///
    /// # Complexity
    /// O(A) where A is the number of input arcs to the transition
    ///
    /// # Example
    /// ```ignore
    /// for marking in reachable_markings {
    ///     if executor.is_enabled_with_marking(tid, &marking) {
    ///         // transition can fire
    ///     }
    /// }
    /// ```
    pub fn is_enabled_with_marking(&self, tid: TransitionId, marking: &Marking) -> bool {
        let input_arcs = self.net.arcs_to_transition(tid);

        for arc in input_arcs {
            if let Element::Place(pid) = arc.source {
                match arc.arc_type {
                    ArcType::Normal => {
                        // Need at least arc.weight tokens
                        if marking.get(pid) < arc.weight {
                            return false;
                        }
                    }
                    ArcType::Inhibitor => {
                        // Must have 0 tokens
                        if !marking.is_empty(pid) {
                            return false;
                        }
                    }
                    ArcType::Read => {
                        // Need tokens but don't consume
                        if marking.get(pid) < arc.weight {
                            return false;
                        }
                    }
                }
            }
        }

        true
    }

    /// Fire a transition (mutating)
    pub fn fire_transition(&mut self, tid: TransitionId) -> Result<(), String> {
        if !self.is_enabled(tid) {
            return Err(format!("Transition {} is not enabled", tid));
        }

        let old_marking = self.current_marking.clone();

        // Process input arcs (consume tokens)
        let input_arcs = self.net.arcs_to_transition(tid);
        for arc in input_arcs {
            if let Element::Place(pid) = arc.source {
                if arc.arc_type != ArcType::Read {
                    // Read arcs don't consume
                    self.current_marking.remove(pid, arc.weight)?;
                }
            }
        }

        // Process output arcs (produce tokens)
        let output_arcs = self.net.arcs_from_transition(tid);
        for arc in output_arcs {
            if let Element::Place(pid) = arc.target {
                // Check capacity
                if let Some(capacity) = self.net.places[&pid].capacity {
                    let new_count = self.current_marking.get(pid) + arc.weight;
                    if new_count > capacity {
                        // Rollback
                        self.current_marking = old_marking.clone();
                        return Err(format!(
                            "Firing {} would exceed capacity of place {}",
                            tid, pid
                        ));
                    }
                }
                self.current_marking.add(pid, arc.weight);
            }
        }

        // Record firing
        self.marking_history.push(self.current_marking.clone());
        self.firing_history
            .push((tid, old_marking, self.current_marking.clone()));

        Ok(())
    }

    /// Fire a transition with a specific marking, returning new marking without mutation
    ///
    /// This is useful for reachability analysis where we need to compute successor markings
    /// without maintaining executor state.
    ///
    /// # Returns
    /// The resulting marking if transition is enabled and firing succeeds, None otherwise.
    ///
    /// # Complexity
    /// O(I + O) where I is input arcs and O is output arcs
    pub fn fire_transition_from_marking(
        &self,
        tid: TransitionId,
        marking: &Marking,
    ) -> Option<Marking> {
        // Check if transition is enabled with this marking
        if !self.is_enabled_with_marking(tid, marking) {
            return None;
        }

        let mut new_marking = marking.clone();

        // Process input arcs (consume tokens)
        let input_arcs = self.net.arcs_to_transition(tid);
        for arc in input_arcs {
            if let Element::Place(pid) = arc.source {
                if arc.arc_type != ArcType::Read {
                    // Read arcs don't consume
                    if new_marking.remove(pid, arc.weight).is_err() {
                        return None;  // Shouldn't happen if is_enabled_with_marking() is correct
                    }
                }
            }
        }

        // Process output arcs (produce tokens)
        let output_arcs = self.net.arcs_from_transition(tid);
        for arc in output_arcs {
            if let Element::Place(pid) = arc.target {
                // Check capacity
                if let Some(capacity) = self.net.places[&pid].capacity {
                    let new_count = new_marking.get(pid) + arc.weight;
                    if new_count > capacity {
                        return None;  // Capacity violation
                    }
                }
                new_marking.add(pid, arc.weight);
            }
        }

        Some(new_marking)
    }

    /// Execute one step (fire one enabled transition, non-deterministic if multiple)
    pub fn step(&mut self) -> Result<Option<TransitionId>, String> {
        let enabled = self.enabled_transitions();
        if enabled.is_empty() {
            return Ok(None);
        }

        // Fire first enabled transition (could be randomized)
        self.fire_transition(enabled[0])?;
        Ok(Some(enabled[0]))
    }

    /// Run simulation for maximum steps
    pub fn run(&mut self, max_steps: usize) -> Result<SimulationResult, String> {
        let mut step_count = 0;

        while step_count < max_steps {
            match self.step()? {
                Some(_) => step_count += 1,
                None => break,  // Deadlock
            }
        }

        Ok(SimulationResult {
            initial_marking: self.marking_history[0].clone(),
            final_marking: self.current_marking.clone(),
            steps: step_count,
            deadlock: self.enabled_transitions().is_empty(),
            firing_sequence: self
                .firing_history
                .iter()
                .map(|(tid, _, _)| *tid)
                .collect(),
        })
    }

    /// Get marking history
    pub fn marking_history(&self) -> &[Marking] {
        &self.marking_history
    }

    /// Get firing history
    pub fn firing_history(&self) -> &[(TransitionId, Marking, Marking)] {
        &self.firing_history
    }

    /// Reset to initial marking
    pub fn reset(&mut self) -> Result<(), String> {
        self.current_marking = Marking::from_net(&self.net);
        self.marking_history.clear();
        self.marking_history.push(self.current_marking.clone());
        self.firing_history.clear();
        Ok(())
    }

    /// Compute all reachable markings (BFS)
    ///
    /// Optimized to avoid expensive executor cloning.
    /// Uses `enabled_transitions_with_marking()` and `fire_transition_from_marking()`
    /// to compute reachable markings without cloning the executor.
    ///
    /// # Complexity
    /// O(M × T × (A + I + O)) where:
    /// - M = number of reachable markings
    /// - T = number of transitions
    /// - A = average input arcs per transition (for enablement check)
    /// - I = average input arcs (for firing)
    /// - O = average output arcs (for firing)
    pub fn reachable_markings(&self) -> Result<Vec<Marking>, String> {
        let mut reachable = vec![self.current_marking.clone()];
        let mut queue = vec![self.current_marking.clone()];
        let mut seen = HashSet::new();
        seen.insert(self.current_marking.clone());

        while !queue.is_empty() {
            let marking = queue.remove(0);

            // Get enabled transitions for this marking (no clone needed)
            let enabled = self.enabled_transitions_with_marking(&marking);

            // Try firing each transition (no clone needed)
            for tid in enabled {
                if let Some(new_marking) = self.fire_transition_from_marking(tid, &marking) {
                    if !seen.contains(&new_marking) {
                        seen.insert(new_marking.clone());
                        reachable.push(new_marking.clone());
                        queue.push(new_marking);
                    }
                }
            }
        }

        Ok(reachable)
    }

    /// Check if Petri net is live (can always make progress)
    ///
    /// Optimized: Uses `enabled_transitions_with_marking()` to avoid executor cloning.
    pub fn is_live(&self) -> Result<bool, String> {
        let reachable = self.reachable_markings()?;

        // For each reachable marking, at least one transition should be fireable
        // (This is a simplified liveness check)
        for marking in reachable {
            if self.enabled_transitions_with_marking(&marking).is_empty() {
                // Found a deadlock marking - net is not live
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Check if Petri net is safe (each place has ≤1 token)
    pub fn is_safe(&self) -> Result<bool, String> {
        let reachable = self.reachable_markings()?;

        for marking in reachable {
            for count in marking.tokens.values() {
                if *count > 1 {
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }

    /// Check if deadlock-free
    ///
    /// Optimized: Uses `enabled_transitions_with_marking()` to avoid executor cloning.
    pub fn is_deadlock_free(&self) -> Result<bool, String> {
        let reachable = self.reachable_markings()?;

        for marking in reachable {
            if self.enabled_transitions_with_marking(&marking).is_empty() {
                // Found a deadlock marking
                return Ok(false);
            }
        }

        Ok(true)
    }
}

/// Simulation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub initial_marking: Marking,
    pub final_marking: Marking,
    pub steps: usize,
    pub deadlock: bool,
    pub firing_sequence: Vec<TransitionId>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::petri_net::{Arc, Place, Transition};

    fn create_simple_net() -> PetriNet {
        let mut net = PetriNet::new("SimpleNet");
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
    fn test_marking_creation() {
        let marking = Marking {
            tokens: HashMap::new(),
        };
        assert_eq!(marking.total_tokens(), 0);
    }

    #[test]
    fn test_marking_operations() {
        let p = PlaceId::new();
        let mut marking = Marking {
            tokens: HashMap::new(),
        };

        marking.set(p, 5);
        assert_eq!(marking.get(p), 5);

        marking.add(p, 3);
        assert_eq!(marking.get(p), 8);

        marking.remove(p, 2).unwrap();
        assert_eq!(marking.get(p), 6);
    }

    #[test]
    fn test_executor_creation() {
        let net = create_simple_net();
        let executor = PetriNetExecutor::new(net);
        assert!(executor.is_ok());
    }

    #[test]
    fn test_enabled_transitions() {
        let net = create_simple_net();
        let executor = PetriNetExecutor::new(net).unwrap();

        let enabled = executor.enabled_transitions();
        assert!(!enabled.is_empty());
    }

    #[test]
    fn test_fire_transition() {
        let net = create_simple_net();
        let mut executor = PetriNetExecutor::new(net).unwrap();
        let tid = executor.enabled_transitions()[0];

        assert!(executor.fire_transition(tid).is_ok());
    }

    #[test]
    fn test_marking_history() {
        let net = create_simple_net();
        let mut executor = PetriNetExecutor::new(net).unwrap();

        let initial_count = executor.marking_history().len();
        let tid = executor.enabled_transitions()[0];
        executor.fire_transition(tid).unwrap();

        assert_eq!(executor.marking_history().len(), initial_count + 1);
    }

    #[test]
    fn test_reset() {
        let net = create_simple_net();
        let mut executor = PetriNetExecutor::new(net).unwrap();

        let tid = executor.enabled_transitions()[0];
        executor.fire_transition(tid).unwrap();

        executor.reset().unwrap();
        assert_eq!(executor.marking_history().len(), 1);
    }

    #[test]
    fn test_marking_equality() {
        let p = PlaceId::new();
        let m1 = Marking {
            tokens: vec![(p, 5)].into_iter().collect(),
        };
        let m2 = Marking {
            tokens: vec![(p, 5)].into_iter().collect(),
        };

        assert!(m1.equals(&m2));
    }

    #[test]
    fn test_insufficient_tokens() {
        let p = PlaceId::new();
        let mut marking = Marking {
            tokens: HashMap::new(),
        };
        marking.set(p, 2);

        let result = marking.remove(p, 5);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_enabled_with_marking() {
        let net = create_simple_net();
        let executor = PetriNetExecutor::new(net).unwrap();

        // Create a marking with tokens
        let mut marking = Marking {
            tokens: HashMap::new(),
        };
        let p1_id = executor.current_marking.tokens.keys().next().copied();
        if let Some(p1) = p1_id {
            marking.set(p1, 5);
        }

        // Check if T1 is enabled with this marking
        let t1_id = executor.enabled_transitions()[0];
        let result = executor.is_enabled_with_marking(t1_id, &marking);
        assert!(result);  // Should be enabled with sufficient tokens

        // Check with empty marking
        let empty_marking = Marking {
            tokens: HashMap::new(),
        };
        let result = executor.is_enabled_with_marking(t1_id, &empty_marking);
        assert!(!result);  // Should be disabled without tokens
    }

    #[test]
    fn test_is_enabled_with_marking_consistency() {
        // Verify that is_enabled_with_marking gives same result as is_enabled with current marking
        let net = create_simple_net();
        let executor = PetriNetExecutor::new(net).unwrap();

        let tid = executor.enabled_transitions()[0];

        // Both should give the same result
        assert_eq!(
            executor.is_enabled(tid),
            executor.is_enabled_with_marking(tid, executor.current_marking())
        );
    }
}
