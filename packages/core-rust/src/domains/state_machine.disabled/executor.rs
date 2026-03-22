//! State Machine Executor - Runtime execution engine

use super::{Event, Guard, State, StateId, StateMachine, Transition, TransitionId};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// Change of state during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateChange {
    /// Source state
    pub from_state: StateId,
    /// Target state
    pub to_state: StateId,
    /// Transition that was taken
    pub transition_id: TransitionId,
    /// Event that triggered transition
    pub event: Option<Event>,
    /// Time of transition
    pub timestamp: f64,
}

/// Execution result from a simulation step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    /// Whether a transition occurred
    pub transitioned: bool,
    /// State change if transition occurred
    pub state_change: Option<StateChange>,
    /// Current state after execution
    pub current_state: StateId,
    /// Error message if execution failed
    pub error: Option<String>,
}

/// State Machine Executor - runs a state machine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateMachineExecutor {
    /// The state machine being executed
    machine: StateMachine,
    /// Current state
    current_state: StateId,
    /// Event queue for processing
    event_queue: VecDeque<Event>,
    /// History of state changes
    state_history: Vec<StateChange>,
    /// Current simulation time
    time: f64,
}

impl StateMachineExecutor {
    /// Create new executor for state machine
    pub fn new(machine: StateMachine) -> Result<Self, String> {
        // Validate machine before executing
        machine.validate()?;

        let initial = machine.initial_state;

        Ok(StateMachineExecutor {
            machine,
            current_state: initial,
            event_queue: VecDeque::new(),
            state_history: Vec::new(),
            time: 0.0,
        })
    }

    /// Get current state
    pub fn current_state(&self) -> StateId {
        self.current_state
    }

    /// Get current state info
    pub fn current_state_info(&self) -> Option<&State> {
        self.machine.states.get(&self.current_state)
    }

    /// Post event to queue
    pub fn post_event(&mut self, event: Event) {
        self.event_queue.push_back(event);
    }

    /// Process all queued events
    pub fn process_events(&mut self) -> Vec<ExecutionResult> {
        let mut results = Vec::new();

        while let Some(event) = self.event_queue.pop_front() {
            let result = self.process_single_event(event);
            results.push(result);
        }

        results
    }

    /// Process a single event
    fn process_single_event(&mut self, event: Event) -> ExecutionResult {
        // Find transitions from current state
        let feasible_transitions: Vec<_> = self
            .machine
            .transitions_from(self.current_state)
            .iter()
            .filter(|t| self.is_transition_feasible(t, Some(&event)))
            .cloned()
            .collect();

        if feasible_transitions.is_empty() {
            return ExecutionResult {
                transitioned: false,
                state_change: None,
                current_state: self.current_state,
                error: Some(format!(
                    "No feasible transition from {} for event {:?}",
                    self.current_state, event
                )),
            };
        }

        // Take first feasible transition (could be non-deterministic)
        let transition = feasible_transitions[0].clone();

        // Execute transition
        let old_state = self.current_state;
        let new_state = transition.target_state;

        // Execute exit action of current state (clone to avoid borrow conflict)
        let exit_action = self.machine.states[&self.current_state]
            .exit_action
            .clone();
        if let Some(exit_action) = exit_action {
            self.execute_action(&exit_action);
        }

        // Execute transition action
        let trans_action = transition.action.clone();
        if let Some(action) = trans_action {
            self.execute_action(&action);
        }

        // Change state
        self.current_state = new_state;

        // Execute entry action of new state (clone to avoid borrow conflict)
        let entry_action = self.machine.states[&new_state].entry_action.clone();
        if let Some(entry_action) = entry_action {
            self.execute_action(&entry_action);
        }

        // Record state change
        let state_change = StateChange {
            from_state: old_state,
            to_state: new_state,
            transition_id: transition.id,
            event: Some(event),
            timestamp: self.time,
        };

        self.state_history.push(state_change.clone());

        ExecutionResult {
            transitioned: true,
            state_change: Some(state_change),
            current_state: self.current_state,
            error: None,
        }
    }

    /// Check if transition is feasible (trigger matches and guard is satisfied)
    fn is_transition_feasible(&self, transition: &Transition, event: Option<&Event>) -> bool {
        // Check trigger
        if let Some(required_event) = &transition.trigger {
            if let Some(event) = event {
                if !self.events_match(required_event, event) {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Check guard
        if let Some(guard) = &transition.guard {
            if !guard.evaluate() {
                return false;
            }
        }

        true
    }

    /// Check if two events match
    fn events_match(&self, required: &Event, actual: &Event) -> bool {
        match (required, actual) {
            (Event::Signal(r), Event::Signal(a)) => r == a,
            (Event::Timeout(r), Event::Timeout(a)) => r == a,
            (Event::Condition(r), Event::Condition(a)) => r == a,
            (Event::Message(r), Event::Message(a)) => r == a,
            _ => false,
        }
    }

    /// Execute an action (update context variables)
    fn execute_action(&mut self, action: &super::Action) {
        // Apply effects to context
        for (var, value) in &action.effects {
            let current = self.machine.context.get(var).copied().unwrap_or(0.0);
            self.machine.context.insert(var.clone(), current + value);
        }
    }

    /// Get state history
    pub fn state_history(&self) -> &[StateChange] {
        &self.state_history
    }

    /// Get enabled transitions from current state
    pub fn enabled_transitions(&self) -> Vec<&Transition> {
        self.machine
            .transitions_from(self.current_state)
            .into_iter()
            .filter(|t| {
                // Can be taken without an event (environmental transitions)
                self.is_transition_feasible(t, None)
            })
            .collect()
    }

    /// Check if can transition to specific state
    pub fn can_transition_to(&self, target: StateId) -> bool {
        self.machine
            .transitions_from(self.current_state)
            .iter()
            .any(|t| t.target_state == target && self.is_transition_feasible(t, None))
    }

    /// Get context variable
    pub fn get_context(&self, name: &str) -> Option<f64> {
        self.machine.context.get(name).copied()
    }

    /// Set simulation time
    pub fn set_time(&mut self, time: f64) {
        self.time = time;
    }

    /// Get current time
    pub fn get_time(&self) -> f64 {
        self.time
    }

    /// Simulate for a duration with event sequence
    pub fn simulate(
        &mut self,
        events: Vec<(f64, Event)>, // (timestamp, event) pairs
        max_time: f64,
    ) -> Result<SimulationTrace, String> {
        let mut trace = SimulationTrace {
            states: vec![self.current_state],
            timestamps: vec![0.0],
            transitions: Vec::new(),
            final_state: self.current_state,
        };

        let mut event_idx = 0;

        while self.time < max_time {
            // Check if event is due
            if event_idx < events.len() && events[event_idx].0 <= self.time {
                self.post_event(events[event_idx].1.clone());
                event_idx += 1;
            }

            // Process one event
            let results = self.process_events();
            if !results.is_empty() {
                for result in results {
                    if let Some(change) = result.state_change {
                        trace.transitions.push(change.clone());
                        trace.states.push(change.to_state);
                        trace.timestamps.push(self.time);
                    }
                }
            }

            // Advance time slightly
            self.time += 0.01;
        }

        trace.final_state = self.current_state;
        Ok(trace)
    }

    /// Reset to initial state
    pub fn reset(&mut self) -> Result<(), String> {
        self.current_state = self.machine.initial_state;
        self.event_queue.clear();
        self.state_history.clear();
        self.time = 0.0;
        Ok(())
    }
}

/// Simulation trace showing state sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationTrace {
    /// Sequence of states visited
    pub states: Vec<StateId>,
    /// Timestamps of each state
    pub timestamps: Vec<f64>,
    /// Transitions that occurred
    pub transitions: Vec<StateChange>,
    /// Final state reached
    pub final_state: StateId,
}

impl SimulationTrace {
    /// Get state at time t
    pub fn state_at_time(&self, t: f64) -> Option<StateId> {
        for (i, timestamp) in self.timestamps.iter().enumerate() {
            if *timestamp > t {
                return if i > 0 {
                    self.states.get(i - 1).copied()
                } else {
                    None
                };
            }
        }
        self.states.last().copied()
    }

    /// Count state visits
    pub fn state_visit_count(&self, state: StateId) -> usize {
        self.states.iter().filter(|s| **s == state).count()
    }

    /// Check if deadlock occurred (final transition but non-final state)
    pub fn is_deadlock(&self, machine: &StateMachine) -> bool {
        if let Some(final_info) = machine.states.get(&self.final_state) {
            final_info.state_type != super::StateType::Final &&
                self.transitions.is_empty() // No transitions in last phase
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::state_machine::{State, StateMachine, StateId, StateType, Transition};

    fn create_simple_fsm() -> StateMachine {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let mut fsm = StateMachine::new("SimpleTest", s1);

        fsm.add_state(State::new(s1, "State1", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(s2, "State2", StateType::Final))
            .unwrap();

        fsm.add_transition(
            Transition::new(s1, s2).with_trigger(Event::Signal("go".to_string())),
        )
        .unwrap();

        fsm
    }

    #[test]
    fn test_executor_creation() {
        let fsm = create_simple_fsm();
        let executor = StateMachineExecutor::new(fsm);
        assert!(executor.is_ok());
    }

    #[test]
    fn test_executor_current_state() {
        let fsm = create_simple_fsm();
        let executor = StateMachineExecutor::new(fsm).unwrap();
        assert_eq!(executor.current_state(), executor.machine.initial_state);
    }

    #[test]
    fn test_post_event() {
        let fsm = create_simple_fsm();
        let mut executor = StateMachineExecutor::new(fsm).unwrap();
        executor.post_event(Event::Signal("go".to_string()));
        assert_eq!(executor.event_queue.len(), 1);
    }

    #[test]
    fn test_simple_transition() {
        let fsm = create_simple_fsm();
        let s2 = fsm
            .states
            .values()
            .find(|s| s.name == "State2")
            .unwrap()
            .id;

        let mut executor = StateMachineExecutor::new(fsm).unwrap();
        executor.post_event(Event::Signal("go".to_string()));
        let results = executor.process_events();

        assert!(!results.is_empty());
        assert!(results[0].transitioned);
        assert_eq!(executor.current_state(), s2);
    }

    #[test]
    fn test_disabled_transition() {
        let fsm = create_simple_fsm();
        let mut executor = StateMachineExecutor::new(fsm).unwrap();

        // Post wrong event
        executor.post_event(Event::Signal("wrong".to_string()));
        let results = executor.process_events();

        // Should not transition
        assert_eq!(results.len(), 1);
        assert!(!results[0].transitioned);
        assert!(results[0].error.is_some());
    }

    #[test]
    fn test_state_history() {
        let fsm = create_simple_fsm();
        let mut executor = StateMachineExecutor::new(fsm).unwrap();
        executor.post_event(Event::Signal("go".to_string()));
        executor.process_events();

        assert!(!executor.state_history.is_empty());
    }

    #[test]
    fn test_reset_executor() {
        let fsm = create_simple_fsm();
        let initial = fsm.initial_state;
        let mut executor = StateMachineExecutor::new(fsm).unwrap();

        executor.post_event(Event::Signal("go".to_string()));
        executor.process_events();
        executor.reset().unwrap();

        assert_eq!(executor.current_state(), initial);
        assert!(executor.state_history.is_empty());
    }

    #[test]
    fn test_context_variables() {
        let fsm = create_simple_fsm();
        let mut executor = StateMachineExecutor::new(fsm).unwrap();

        executor.machine.set_context("counter", 5.0);
        assert_eq!(executor.get_context("counter"), Some(5.0));
    }

    #[test]
    fn test_trace_state_at_time() {
        let trace = SimulationTrace {
            states: vec![StateId::new(), StateId::new(), StateId::new()],
            timestamps: vec![0.0, 1.0, 2.0],
            transitions: Vec::new(),
            final_state: StateId::new(),
        };

        let state_at_05 = trace.state_at_time(0.5);
        assert!(state_at_05.is_some());
    }

    #[test]
    fn test_trace_visit_count() {
        let s1 = StateId::new();
        let trace = SimulationTrace {
            states: vec![s1, StateId::new(), s1, StateId::new(), s1],
            timestamps: vec![0.0, 1.0, 2.0, 3.0, 4.0],
            transitions: Vec::new(),
            final_state: s1,
        };

        assert_eq!(trace.state_visit_count(s1), 3);
    }
}
