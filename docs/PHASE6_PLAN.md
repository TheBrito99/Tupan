# Phase 6: State Machines & Petri Nets - Implementation Plan

**Date:** 2026-03-19
**Status:** PLANNING
**Target:** State machine simulator + Petri net simulator
**Scope:** 2 major features with comprehensive testing

---

## Overview

Phase 6 extends Tupan with **discrete event simulation** capabilities:

1. **State Machine Simulator** - Finite State Machines (FSM) with state transitions
2. **Petri Net Simulator** - Place/Transition networks for concurrent process modeling

Both share the same Graph abstraction used by block diagrams and electrical circuits.

---

## Phase 6 Task 1: State Machine Core Types & Transition Engine

### Deliverables

**File:** `packages/core-rust/src/domains/state_machine/mod.rs`

#### 1. State Types

```rust
pub enum StateType {
    Normal,           // Regular state
    Initial,          // Starting state
    Final,            // Terminal state
    Composite,        // Contains substates (hierarchy)
}

pub struct State {
    pub id: StateId,
    pub name: String,
    pub state_type: StateType,
    pub entry_action: Option<Action>,      // Execute when entering
    pub exit_action: Option<Action>,       // Execute when leaving
    pub do_action: Option<Action>,         // Execute while in state
}
```

#### 2. Transition Types

```rust
pub enum TransitionType {
    External,         // Normal transition
    Internal,         // Action without leaving state
    Choice,           // Conditional branching
    Fork,            // Split into parallel paths
    Join,            // Merge parallel paths
}

pub struct Transition {
    pub id: TransitionId,
    pub source_state: StateId,
    pub target_state: StateId,
    pub trigger: Option<Event>,           // What triggers transition
    pub guard: Option<Guard>,             // Condition to check
    pub action: Option<Action>,           // Execute on transition
    pub transition_type: TransitionType,
}
```

#### 3. Event & Guard System

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Event {
    Signal(String),           // Named signal: "button_pressed"
    Timeout(Duration),        // Time-based: after 5 seconds
    Condition(String),        // Data-driven: "count > 10"
    Message(String),          // Message passing: "data_ready"
}

pub struct Guard {
    pub condition: String,    // Boolean expression
    pub context: HashMap<String, Value>,  // Variables available in condition
}

pub struct Action {
    pub code: String,         // Action code/behavior
    pub effects: Vec<Effect>, // Changes to state variables
}
```

#### 4. State Machine Definition

```rust
pub struct StateMachine {
    pub name: String,
    pub initial_state: StateId,
    pub states: HashMap<StateId, State>,
    pub transitions: HashMap<TransitionId, Transition>,
    pub context: HashMap<String, Value>,  // Data variables
}

impl StateMachine {
    pub fn new(name: &str, initial_state: StateId) -> Self;
    pub fn add_state(&mut self, state: State) -> Result<StateId, String>;
    pub fn add_transition(&mut self, transition: Transition) -> Result<TransitionId, String>;
    pub fn validate(&self) -> Result<(), Vec<String>>;  // Check for errors
}
```

#### 5. State Machine Executor

```rust
pub struct StateMachineExecutor {
    machine: StateMachine,
    current_state: StateId,
    event_queue: VecDeque<Event>,
    state_history: Vec<(StateId, Timestamp)>,
    context: HashMap<String, Value>,
}

impl StateMachineExecutor {
    pub fn new(machine: StateMachine) -> Result<Self, String>;

    // Event handling
    pub fn post_event(&mut self, event: Event);
    pub fn process_events(&mut self) -> Vec<StateChange>;

    // Query
    pub fn current_state(&self) -> StateId;
    pub fn can_transition(&self, target: StateId) -> bool;
    pub fn get_context(&self) -> &HashMap<String, Value>;

    // Analysis
    pub fn reachable_states(&self) -> HashSet<StateId>;
    pub fn state_history(&self) -> &[(StateId, Timestamp)];
}
```

### Architecture

```
User defines FSM
    ↓
StateMachine (structure: states + transitions)
    ↓
Validation (reachability, deadlock detection)
    ↓
StateMachineExecutor (runtime)
    ├─ Post events
    ├─ Process transitions
    ├─ Execute actions
    └─ Record history
    ↓
Results (state sequence, context changes)
```

### Key Algorithms

**1. Transition Feasibility Check**
```
For each transition from current_state:
  1. Check trigger (event matches)
  2. Evaluate guard (condition true)
  3. If both pass: transition is feasible
```

**2. Reachability Analysis**
```
BFS from initial_state:
  1. Mark initial as reachable
  2. For each reachable state:
     - For each outgoing transition:
       - If guard always true: mark target as reachable
  3. Return set of reachable states
```

**3. Deadlock Detection**
```
A state is deadlock if:
  1. It's not a final state
  2. It has no outgoing transitions
  3. OR all outgoing transitions have unsatisfiable guards
```

### Test Plan (15 tests)

1. **Basic FSM Tests (3)**
   - Create state machine with initial state
   - Add states and transitions
   - Validate basic structure

2. **Transition Tests (4)**
   - Simple transition (event trigger)
   - Guarded transition (conditional)
   - Multiple transitions from same state
   - Self-loop transitions

3. **Event Handling Tests (3)**
   - Post single event
   - Event queue processing
   - Event discarding (invalid in current state)

4. **Analysis Tests (3)**
   - Reachability analysis
   - Deadlock detection
   - State history tracking

5. **Action Execution Tests (2)**
   - Entry action execution
   - Exit action + transition action

---

## Phase 6 Task 2: Petri Net Types & Execution Engine

### Deliverables

**File:** `packages/core-rust/src/domains/petri_net/mod.rs`

#### 1. Petri Net Elements

```rust
pub struct Place {
    pub id: PlaceId,
    pub name: String,
    pub initial_tokens: u32,
    pub capacity: Option<u32>,  // Max tokens allowed
}

pub struct Transition {
    pub id: TransitionId,
    pub name: String,
    pub guard: Option<Guard>,   // Condition to fire
    pub weight: f64,            // Execution priority
}

pub struct Arc {
    pub id: ArcId,
    pub source: Element,         // Place or Transition
    pub target: Element,
    pub weight: u32,             // Tokens consumed/produced
    pub arc_type: ArcType,       // Normal, Inhibitor, Read
}

pub enum ArcType {
    Normal,       // Consume/produce tokens
    Inhibitor,    // Fire only if place has 0 tokens
    Read,         // Check without consuming
}
```

#### 2. Petri Net Definition

```rust
pub struct PetriNet {
    pub name: String,
    pub places: HashMap<PlaceId, Place>,
    pub transitions: HashMap<TransitionId, Transition>,
    pub arcs: HashMap<ArcId, Arc>,
}

impl PetriNet {
    pub fn new(name: &str) -> Self;
    pub fn add_place(&mut self, place: Place) -> Result<PlaceId, String>;
    pub fn add_transition(&mut self, transition: Transition) -> Result<TransitionId, String>;
    pub fn add_arc(&mut self, arc: Arc) -> Result<ArcId, String>;
    pub fn validate(&self) -> Result<(), Vec<String>>;
}
```

#### 3. Petri Net Executor (Marking)

```rust
pub struct Marking {
    pub tokens: HashMap<PlaceId, u32>,
    pub timestamp: f64,
}

pub struct PetriNetExecutor {
    net: PetriNet,
    marking: Marking,
    history: Vec<Marking>,
}

impl PetriNetExecutor {
    pub fn new(net: PetriNet) -> Result<Self, String>;

    // Execution
    pub fn enabled_transitions(&self) -> Vec<TransitionId>;
    pub fn fire_transition(&mut self, tid: TransitionId) -> Result<(), String>;
    pub fn step(&mut self) -> Option<TransitionId>;  // Fire one transition

    // Analysis
    pub fn reachable_markings(&self) -> Vec<Marking>;
    pub fn is_live(&self) -> bool;          // Can always progress
    pub fn is_safe(&self) -> bool;          // Each place has ≤1 token
    pub fn deadlock_free(&self) -> bool;
}
```

#### 4. Firing Rules

```
A transition T is ENABLED if:
  For each input arc (p, T, w):
    - If Normal: marking[p] ≥ w
    - If Inhibitor: marking[p] = 0
    - If Read: marking[p] ≥ w (not consumed)

When T FIRES:
  For each input arc (p, T, w):
    marking[p] -= w
  For each output arc (T, q, w):
    marking[q] += w
```

### Test Plan (15 tests)

1. **Basic Petri Net Tests (3)**
   - Create net with places and transitions
   - Add arcs (normal, inhibitor, read)
   - Validate structure

2. **Enabling Tests (4)**
   - Sufficient tokens for transition
   - Insufficient tokens (disabled)
   - Inhibitor arc prevents firing
   - Read arc doesn't consume

3. **Firing Tests (3)**
   - Simple transition firing
   - Multiple transitions enabled
   - Non-deterministic choice

4. **Analysis Tests (3)**
   - Reachability analysis
   - Liveness checking
   - Safety checking (bounded)

5. **Advanced Features Tests (2)**
   - Weighted arcs
   - Capacity constraints

---

## Phase 6 Task 3: State Machine Domain Wrapper & Visualization

### Deliverables

**File:** `packages/core-rust/src/domains/state_machine/domain.rs`

#### StateMachineDomain

```rust
pub struct StateMachineDomain {
    executor: StateMachineExecutor,
    output_signals: HashMap<String, Value>,
}

impl PhysicalDomain for StateMachineDomain {
    fn to_bond_graph(&self) -> Graph {
        // State machines don't use bond graphs
        Graph::new()
    }

    fn governing_equations(&self) -> String {
        "Discrete state transitions: S(t) = f(S(t-1), E(t), G(t))"
            .to_string()
    }

    fn domain_name(&self) -> &str {
        "state_machine"
    }
}

impl StateMachineDomain {
    pub fn simulate(
        &mut self,
        events: Vec<Event>,
        max_steps: usize
    ) -> Result<SimulationResult, String> {
        // Execute FSM with given events
    }

    pub fn export_state_diagram(&self) -> String {
        // SVG or Graphviz DOT format
    }
}
```

#### Visualization Data

```rust
pub struct StateDiagramData {
    pub states: Vec<StateNode>,
    pub transitions: Vec<TransitionEdge>,
    pub initial: StateId,
    pub finals: HashSet<StateId>,
}

pub struct StateNode {
    pub id: StateId,
    pub label: String,
    pub x: f64, y: f64,      // Layout coordinates
    pub state_type: StateType,
}

pub struct TransitionEdge {
    pub source: StateId,
    pub target: StateId,
    pub label: String,        // "event [guard] / action"
    pub curved: bool,         // Self-loop or arc
}
```

### Test Plan (10 tests)

- Domain creation and configuration
- Simulation with event sequences
- State diagram export (DOT format)
- Integration with Graph system

---

## Phase 6 Task 4: Petri Net Domain Wrapper & Analysis

### Deliverables

**File:** `packages/core-rust/src/domains/petri_net/domain.rs`

#### PetriNetDomain

```rust
pub struct PetriNetDomain {
    executor: PetriNetExecutor,
    analysis_cache: Option<AnalysisResult>,
}

pub struct AnalysisResult {
    pub reachable_markings: Vec<Marking>,
    pub is_live: bool,
    pub is_safe: bool,
    pub deadlock_free: bool,
    pub boundedness: Option<u32>,
}

impl PhysicalDomain for PetriNetDomain {
    fn governing_equations(&self) -> String {
        "Petri net: M'(p) = M(p) + F(t)"
            .to_string()
    }
}

impl PetriNetDomain {
    pub fn analyze(&mut self) -> Result<AnalysisResult, String>;
    pub fn export_as_dot(&self) -> String;  // Graphviz format
}
```

### Test Plan (10 tests)

- Petri net analysis (liveness, safety)
- Reachability computation
- Dot export for visualization
- Integration with Graph

---

## Integration with Existing Systems

### Graph Integration

```
StateMachine ──→ Converts to Graph
  States = Nodes
  Transitions = Edges

Integrates with:
  - Generic Node Editor (shared UI)
  - Graph visualization library
  - Serialization system
```

### WASM Bridge

```typescript
// TypeScript/WASM side
async function simulateStateMachine(
    fsm: StateMachineJSON,
    events: EventSequence
): Promise<StateHistory> {
    // Uses same WASM bridge as block diagrams
}

async function analyzePetriNet(
    net: PetriNetJSON
): Promise<AnalysisResult> {
    // Reachability, liveness, safety
}
```

### UI Components

Reuse `NodeEditor` from `ui-framework`:
- State nodes with visual differentiation
- Transition arrows with labels
- Event/guard/action display
- Animation of state transitions
- Petri net token animation

---

## Complete Phase 6 Summary

| Task | Deliverable | Tests | Code |
|------|-------------|-------|------|
| 1 | State Machine Engine | 15 | ~600 lines |
| 2 | Petri Net Engine | 15 | ~500 lines |
| 3 | State Machine Domain | 10 | ~300 lines |
| 4 | Petri Net Domain | 10 | ~300 lines |
| **Total** | **Discrete Event Systems** | **50** | **~1700 lines** |

---

## Success Criteria

✅ State machines with guards, actions, and history
✅ Petri nets with enabling, firing, and analysis
✅ Reachability and liveness analysis
✅ Full integration with Graph system
✅ WASM serialization ready
✅ 50 comprehensive tests
✅ Example systems (traffic light, coffee machine, workflow)

---

## Next Phase (Phase 7)

After Phase 6 completes:
- **Phase 7: Flow-Based Programming** (Node-RED style)
  - Composition of functions into data flow graphs
  - Computer vision integration
  - Real-time data processing
  - 40+ node types

---

This plan positions Tupan as a comprehensive **modeling and simulation platform** spanning:
- **Continuous** systems (electrical, thermal, mechanical, control)
- **Discrete** systems (state machines, Petri nets)
- **Data flow** systems (FBP, computer vision)

---

**Ready to start Phase 6 Task 1: State Machine Core Types & Transition Engine**
