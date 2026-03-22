//! State Machine Domain - Finite State Machines with transitions and actions
//!
//! This module implements discrete event simulation via state machines (FSM).
//! Unlike continuous systems (electrical, thermal), state machines transition
//! between discrete states based on events and guards.
//!
//! Features:
//! - States with entry/exit/do actions
//! - Event-triggered transitions with guards
//! - Composite states (hierarchy) support
//! - Event queue processing
//! - Reachability and deadlock analysis
//! - Action execution system

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use uuid::Uuid;

pub mod executor;
pub mod validation;
pub mod domain;

pub use executor::{StateMachineExecutor, StateChange, ExecutionResult};
pub use validation::{validate_state_machine, ReachabilityAnalysis};
pub use domain::{StateMachineDomain, StateDiagramData, StateNode, TransitionEdge, StateMachineStatistics};

/// Unique identifier for a state
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct StateId(Uuid);

impl StateId {
    /// Create a new unique state ID
    pub fn new() -> Self {
        StateId(Uuid::new_v4())
    }

    /// Create from UUID string
    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(StateId(Uuid::parse_str(s)?))
    }
}

impl Default for StateId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for StateId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Unique identifier for a transition
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct TransitionId(Uuid);

impl TransitionId {
    pub fn new() -> Self {
        TransitionId(Uuid::new_v4())
    }

    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(TransitionId(Uuid::parse_str(s)?))
    }
}

impl Default for TransitionId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for TransitionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Type of state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StateType {
    /// Normal state
    Normal,
    /// Initial state (entry point)
    Initial,
    /// Final/accepting state
    Final,
    /// Composite state (contains substates)
    Composite,
}

/// Type of transition
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransitionType {
    /// Normal state-to-state transition
    External,
    /// Action within a state without leaving
    Internal,
    /// Conditional branching (choice point)
    Choice,
    /// Fork into parallel substates
    Fork,
    /// Join parallel substates
    Join,
}

/// Event that can trigger transitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Event {
    /// Named signal event
    Signal(String),
    /// Time-based trigger
    Timeout(u64),  // milliseconds
    /// Data-driven condition
    Condition(String),
    /// Message passing
    Message(String),
}

impl Event {
    /// Get string representation
    pub fn label(&self) -> String {
        match self {
            Event::Signal(name) => name.clone(),
            Event::Timeout(ms) => format!("after {}ms", ms),
            Event::Condition(expr) => expr.clone(),
            Event::Message(msg) => format!("msg: {}", msg),
        }
    }
}

/// Guard condition for transitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guard {
    /// Boolean expression (as string, to be evaluated)
    pub condition: String,
    /// Context variables for condition evaluation
    pub context: HashMap<String, f64>,
}

impl Guard {
    pub fn new(condition: &str) -> Self {
        Guard {
            condition: condition.to_string(),
            context: HashMap::new(),
        }
    }

    pub fn with_context(condition: &str, context: HashMap<String, f64>) -> Self {
        Guard {
            condition: condition.to_string(),
            context,
        }
    }

    /// Simple guard evaluation (basic comparison support)
    pub fn evaluate(&self) -> bool {
        // Simplified evaluation: support "variable > value", "variable = value", etc.
        // Full implementation would use expression parser
        true  // Placeholder
    }
}

/// Action executed on states or transitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    /// Action code/behavior description
    pub code: String,
    /// Effects of the action
    pub effects: Vec<(String, f64)>,  // (variable, value_change)
}

impl Action {
    pub fn new(code: &str) -> Self {
        Action {
            code: code.to_string(),
            effects: Vec::new(),
        }
    }

    pub fn with_effect(mut self, var: &str, value: f64) -> Self {
        self.effects.push((var.to_string(), value));
        self
    }
}

/// State in a state machine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct State {
    /// Unique identifier
    pub id: StateId,
    /// Display name
    pub name: String,
    /// Type of state
    pub state_type: StateType,
    /// Action executed when entering state
    pub entry_action: Option<Action>,
    /// Action executed when leaving state
    pub exit_action: Option<Action>,
    /// Action executed while in state (per cycle)
    pub do_action: Option<Action>,
    /// Parent state ID (for composite states)
    pub parent: Option<StateId>,
}

impl State {
    pub fn new(id: StateId, name: &str, state_type: StateType) -> Self {
        State {
            id,
            name: name.to_string(),
            state_type,
            entry_action: None,
            exit_action: None,
            do_action: None,
            parent: None,
        }
    }

    /// Create normal state
    pub fn normal(name: &str) -> Self {
        Self::new(StateId::new(), name, StateType::Normal)
    }

    /// Create initial state
    pub fn initial(name: &str) -> Self {
        Self::new(StateId::new(), name, StateType::Initial)
    }

    /// Create final state
    pub fn final_state(name: &str) -> Self {
        Self::new(StateId::new(), name, StateType::Final)
    }

    pub fn with_entry_action(mut self, action: Action) -> Self {
        self.entry_action = Some(action);
        self
    }

    pub fn with_exit_action(mut self, action: Action) -> Self {
        self.exit_action = Some(action);
        self
    }

    pub fn with_do_action(mut self, action: Action) -> Self {
        self.do_action = Some(action);
        self
    }
}

/// Transition between states
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transition {
    /// Unique identifier
    pub id: TransitionId,
    /// Source state
    pub source_state: StateId,
    /// Target state
    pub target_state: StateId,
    /// Type of transition
    pub transition_type: TransitionType,
    /// Event that triggers transition
    pub trigger: Option<Event>,
    /// Guard condition (must be true to transition)
    pub guard: Option<Guard>,
    /// Action executed during transition
    pub action: Option<Action>,
}

impl Transition {
    pub fn new(source: StateId, target: StateId) -> Self {
        Transition {
            id: TransitionId::new(),
            source_state: source,
            target_state: target,
            transition_type: TransitionType::External,
            trigger: None,
            guard: None,
            action: None,
        }
    }

    pub fn with_trigger(mut self, event: Event) -> Self {
        self.trigger = Some(event);
        self
    }

    pub fn with_guard(mut self, guard: Guard) -> Self {
        self.guard = Some(guard);
        self
    }

    pub fn with_action(mut self, action: Action) -> Self {
        self.action = Some(action);
        self
    }

    pub fn with_type(mut self, transition_type: TransitionType) -> Self {
        self.transition_type = transition_type;
        self
    }
}

/// Complete state machine definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateMachine {
    /// Name of the state machine
    pub name: String,
    /// Initial state ID
    pub initial_state: StateId,
    /// All states indexed by ID
    pub states: HashMap<StateId, State>,
    /// All transitions indexed by ID
    pub transitions: HashMap<TransitionId, Transition>,
    /// Context variables (persistent state)
    pub context: HashMap<String, f64>,
}

impl StateMachine {
    /// Create new state machine with initial state
    pub fn new(name: &str, initial_state: StateId) -> Self {
        let mut states = HashMap::new();
        // Add placeholder initial state if needed

        StateMachine {
            name: name.to_string(),
            initial_state,
            states,
            transitions: HashMap::new(),
            context: HashMap::new(),
        }
    }

    /// Add state to machine
    pub fn add_state(&mut self, state: State) -> Result<StateId, String> {
        if self.states.contains_key(&state.id) {
            return Err(format!("State {} already exists", state.id));
        }
        let id = state.id;
        self.states.insert(id, state);
        Ok(id)
    }

    /// Add transition to machine
    pub fn add_transition(&mut self, transition: Transition) -> Result<TransitionId, String> {
        // Validate source and target states exist
        if !self.states.contains_key(&transition.source_state) {
            return Err(format!("Source state {} not found", transition.source_state));
        }
        if !self.states.contains_key(&transition.target_state) {
            return Err(format!("Target state {} not found", transition.target_state));
        }

        let id = transition.id;
        self.transitions.insert(id, transition);
        Ok(id)
    }

    /// Get all transitions from a state
    pub fn transitions_from(&self, state_id: StateId) -> Vec<&Transition> {
        self.transitions
            .values()
            .filter(|t| t.source_state == state_id)
            .collect()
    }

    /// Get all transitions to a state
    pub fn transitions_to(&self, state_id: StateId) -> Vec<&Transition> {
        self.transitions
            .values()
            .filter(|t| t.target_state == state_id)
            .collect()
    }

    /// Validate state machine structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        validation::validate_state_machine(self)
    }

    /// Get reachable states from initial state
    pub fn reachable_states(&self) -> Result<HashSet<StateId>, String> {
        let analysis = validation::reachability_analysis(self)?;
        Ok(analysis.reachable)
    }

    /// Check for deadlock states (terminal non-final states)
    pub fn find_deadlock_states(&self) -> Vec<StateId> {
        self.states
            .iter()
            .filter(|(id, state)| {
                // Non-final state with no outgoing transitions
                state.state_type != StateType::Final &&
                    self.transitions_from(**id).is_empty()
            })
            .map(|(id, _)| *id)
            .collect()
    }

    /// Set context variable
    pub fn set_context(&mut self, name: &str, value: f64) {
        self.context.insert(name.to_string(), value);
    }

    /// Get context variable
    pub fn get_context(&self, name: &str) -> Option<f64> {
        self.context.get(name).copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_creation() {
        let state = State::normal("Idle");
        assert_eq!(state.name, "Idle");
        assert_eq!(state.state_type, StateType::Normal);
    }

    #[test]
    fn test_state_types() {
        let initial = State::initial("Start");
        assert_eq!(initial.state_type, StateType::Initial);

        let final_state = State::final_state("End");
        assert_eq!(final_state.state_type, StateType::Final);
    }

    #[test]
    fn test_transition_creation() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let trans = Transition::new(s1, s2)
            .with_trigger(Event::Signal("go".to_string()));

        assert_eq!(trans.source_state, s1);
        assert_eq!(trans.target_state, s2);
        assert!(trans.trigger.is_some());
    }

    #[test]
    fn test_state_machine_creation() {
        let initial = StateId::new();
        let fsm = StateMachine::new("test", initial);
        assert_eq!(fsm.name, "test");
        assert_eq!(fsm.initial_state, initial);
    }

    #[test]
    fn test_add_states() {
        let initial_id = StateId::new();
        let mut fsm = StateMachine::new("FSM", initial_id);

        let state = State::initial("Start");
        let id = state.id;
        fsm.add_state(state).expect("Should add state");

        assert!(fsm.states.contains_key(&id));
    }

    #[test]
    fn test_add_transition() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let mut fsm = StateMachine::new("FSM", s1);

        fsm.add_state(State::new(s1, "State1", StateType::Normal))
            .expect("Add state 1");
        fsm.add_state(State::new(s2, "State2", StateType::Normal))
            .expect("Add state 2");

        let trans = Transition::new(s1, s2);
        let trans_id = trans.id;
        fsm.add_transition(trans).expect("Add transition");

        assert!(fsm.transitions.contains_key(&trans_id));
    }

    #[test]
    fn test_transitions_from_state() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let s3 = StateId::new();
        let mut fsm = StateMachine::new("FSM", s1);

        fsm.add_state(State::new(s1, "S1", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(s2, "S2", StateType::Normal))
            .unwrap();
        fsm.add_state(State::new(s3, "S3", StateType::Normal))
            .unwrap();

        fsm.add_transition(Transition::new(s1, s2)).unwrap();
        fsm.add_transition(Transition::new(s1, s3)).unwrap();
        fsm.add_transition(Transition::new(s2, s3)).unwrap();

        let from_s1 = fsm.transitions_from(s1);
        assert_eq!(from_s1.len(), 2);

        let from_s2 = fsm.transitions_from(s2);
        assert_eq!(from_s2.len(), 1);
    }

    #[test]
    fn test_deadlock_detection() {
        let s1 = StateId::new();
        let s2 = StateId::new();
        let mut fsm = StateMachine::new("FSM", s1);

        fsm.add_state(State::new(s1, "S1", StateType::Normal))
            .unwrap();
        fsm.add_state(State::final_state("Final")).unwrap();
        fsm.add_state(State::new(s2, "Deadlock", StateType::Normal))
            .unwrap();

        // s1 transitions to final, but s2 has no outgoing transitions
        fsm.add_transition(Transition::new(s1, StateId::new())).ok();

        let deadlock = fsm.find_deadlock_states();
        assert!(deadlock.len() > 0);
    }

    #[test]
    fn test_event_label() {
        let sig = Event::Signal("button".to_string());
        assert_eq!(sig.label(), "button");

        let timeout = Event::Timeout(5000);
        assert!(timeout.label().contains("5000"));
    }

    #[test]
    fn test_action_with_effects() {
        let action = Action::new("increment_counter")
            .with_effect("counter", 1.0)
            .with_effect("timer", 0.0);

        assert_eq!(action.effects.len(), 2);
    }

    #[test]
    fn test_context_variables() {
        let mut fsm = StateMachine::new("test", StateId::new());
        fsm.set_context("count", 0.0);
        fsm.set_context("timer", 5.5);

        assert_eq!(fsm.get_context("count"), Some(0.0));
        assert_eq!(fsm.get_context("timer"), Some(5.5));
        assert_eq!(fsm.get_context("unknown"), None);
    }
}
