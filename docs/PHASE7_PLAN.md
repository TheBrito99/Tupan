# Phase 7 Plan: Flow-Based Programming (Node-RED Style)

**Date:** 2026-03-19
**Status:** PLANNING
**Estimated Duration:** 3-4 weeks
**Goal:** Implement complete visual data flow programming system

---

## Overview

Phase 7 adds **Flow-Based Programming (FBP)** capabilities to Tupan, enabling visual node-based data processing similar to Node-RED. This complements the discrete event systems (state machines, Petri nets) from Phase 6 with continuous data flow paradigm.

### Key Concepts

**Flow-Based Programming:**
- Nodes represent processing units/functions
- Ports represent data input/output
- Connections represent data flow
- Messages flow between nodes at runtime
- Enables visual programming without text code

### Integration with Tupan

```
Tupan Computation Domains
├── Continuous (Phase 1-5)
│   ├── Electrical circuits
│   ├── Thermal networks
│   ├── Mechanical systems
│   ├── Hydraulic/Pneumatic
│   └── Block diagrams
├── Discrete Event (Phase 6)
│   ├── State machines
│   └── Petri nets
└── Data Flow (Phase 7) ✨ NEW
    ├── Flow-based programming
    ├── Data processing pipelines
    ├── Signal processing
    └── Custom logic flows
```

---

## Phase 7 Tasks

### Task 1: FBP Core Types & Node System (Week 1)
**Objective:** Create foundational types for flow-based programming

**Deliverables:**
1. **FlowPort** struct
   - Port identifier and name
   - Port direction (Input/Output)
   - Data type specification
   - Optional default value
   - Metadata (required, array, object support)

2. **FlowNode** struct
   - Node identifier and name
   - Category (math, string, logic, control, custom)
   - Input/output ports
   - Configuration parameters
   - Execution context

3. **DataType** enum
   - Primitive: Number, String, Boolean, Null
   - Complex: Array, Object, Date, Buffer
   - Typed collections
   - Custom types

4. **Message** struct
   - Source node and port
   - Destination node and port
   - Payload data
   - Timestamp
   - Message ID

5. **FlowNetwork** struct
   - Name and metadata
   - Nodes hashmap
   - Connections list
   - Variables (flow-level data)
   - Start/stop node

6. **Connection** struct
   - Source node/port
   - Target node/port
   - Routing options

7. **StandardNodes** library (20+ built-in nodes)
   - Math nodes: Add, Subtract, Multiply, Divide, Modulo, Power, Sqrt, Sin, Cos, etc.
   - Logic nodes: And, Or, Not, If-Else, Switch, Comparison
   - String nodes: Concatenate, Split, Replace, Uppercase, Lowercase, Length
   - Array nodes: Index, Slice, Length, Join, Reverse, Sort, Map, Filter
   - Object nodes: Get, Set, Keys, Values, Entries, Merge
   - Control nodes: Pass, Drop, Delay, Buffer, Throttle
   - Type nodes: ToString, ToNumber, ToBoolean, TypeOf
   - I/O nodes: Log, Debug, Inject (input), Output (result)

**Implementation Details:**
- Use UUID for node/port identifiers
- Serializable with serde
- Support port type constraints
- Port validation for connections
- Error types for invalid operations

**Tests:** 25+ unit tests
- Node creation and configuration
- Port validation
- Data type checking
- Message creation
- Network structure

**Code Location:**
- `packages/core-rust/src/domains/flow_based/mod.rs`
- `packages/core-rust/src/domains/flow_based/nodes.rs`
- `packages/core-rust/src/domains/flow_based/types.rs`

---

### Task 2: FBP Executor & Runtime (Week 1-2)
**Objective:** Implement flow execution engine

**Deliverables:**
1. **FlowExecutor** struct
   - Network to execute
   - Node states
   - Message queue
   - Execution context
   - Time tracking

2. **Execution Engine**
   - Port connection validation
   - Message routing
   - Node execution scheduling
   - Error handling
   - Cycle detection (prevent infinite loops)

3. **Node Execution**
   - Port data access
   - Parameter application
   - Error propagation
   - Output port updates
   - Async support skeleton

4. **Data Flow Processing**
   - Message passing between nodes
   - Queue management
   - Execution order determination
   - State management
   - Conditional execution

5. **Control Flow**
   - Start node (injection point)
   - Stop node (termination point)
   - Branch execution (if/switch nodes)
   - Loop handling (repeat nodes)

6. **ExecutionTrace** struct
   - Message history
   - Node execution sequence
   - Timing information
   - Errors/warnings
   - Final state snapshots

7. **Debugging Support**
   - Breakpoints on nodes
   - Port inspection
   - Message logging
   - Execution trace visualization

**Tests:** 20+ integration tests
- Node execution
- Message routing
- Error handling
- Cycle detection
- Conditional branches
- Loop handling
- Execution traces

**Code Location:**
- `packages/core-rust/src/domains/flow_based/executor.rs`
- `packages/core-rust/src/domains/flow_based/routing.rs`

---

### Task 3: FBP Domain Wrapper & Visualization (Week 2)
**Objective:** Integrate FBP with Tupan architecture

**Deliverables:**
1. **FlowNetworkDomain** struct
   - Implements PhysicalDomain trait
   - Wraps FlowNetwork
   - Provides domain operations

2. **to_graph()** method
   - Convert nodes to Graph nodes
   - Convert connections to Graph edges
   - Preserve metadata

3. **Visualization Structures**
   - FlowNodeVisualization (position, size, color, label)
   - FlowConnectionVisualization (path, style, label)
   - FlowNetworkDiagramData (complete diagram)

4. **export_as_dot()** method
   - Graphviz representation
   - Node categories by color
   - Connection labels
   - Port information

5. **Visualization Data**
   - FlowNodeData (type, ports, config)
   - FlowPortData (name, type, direction)
   - FlowConnectionData (source→target, type)

6. **Statistics & Analysis**
   - FlowNetworkStatistics
   - Node count by category
   - Connection count
   - Execution complexity
   - Data flow paths

7. **Validation**
   - Cycle detection
   - Type checking on connections
   - Required port validation
   - Start/stop node verification

**Tests:** 15+ integration tests
- Domain creation
- Graph conversion
- Visualization generation
- Statistics computation
- Validation

**Code Location:**
- `packages/core-rust/src/domains/flow_based/domain.rs`
- `packages/core-rust/src/domains/flow_based/visualization.rs`

---

### Task 4: Built-in Node Library Extension (Week 3)
**Objective:** Expand standard node collection to 50+ nodes

**Node Categories:**

1. **Math Nodes (10)**
   - Basic arithmetic (Add, Subtract, Multiply, Divide, Modulo)
   - Advanced (Power, Sqrt, Abs, Round, Ceiling, Floor)
   - Trigonometry (Sin, Cos, Tan, Asin, Acos, Atan)
   - Logarithm (Log, Log10, Exp, Ln)

2. **Logic Nodes (8)**
   - Boolean (And, Or, Not, Xor)
   - Comparison (Equal, NotEqual, LessThan, GreaterThan, LessEqual, GreaterEqual)
   - Conditional (If-Else, Switch)
   - Verification (IsNull, IsUndefined, IsType)

3. **String Nodes (12)**
   - Basic (Concatenate, Substring, IndexOf, LastIndexOf)
   - Transform (Uppercase, Lowercase, Capitalize, Reverse)
   - Split/Join (Split, Join, Trim, Repeat)
   - Search/Replace (StartsWith, EndsWith, Includes, Replace)
   - Format (Sprintf-style, Template literal)

4. **Array Nodes (15)**
   - Access (Index, Slice, First, Last)
   - Modification (Push, Pop, Shift, Unshift, Splice)
   - Iteration (ForEach, Map, Filter, Reduce, Find)
   - Utility (Length, Reverse, Sort, Unique, Flatten)
   - Combination (Concat, Zip, Interleave)

5. **Object Nodes (10)**
   - Access (Get, GetPath, Has, Keys, Values, Entries)
   - Modification (Set, SetPath, Delete, Merge, Assign)
   - Creation (FromEntries, Entries, Create)
   - Inspection (KeyCount, IsEmpty)

6. **Type Nodes (8)**
   - Conversion (ToNumber, ToString, ToBoolean, ToArray, ToObject)
   - Inspection (TypeOf, InstanceOf, IsNumeric, IsString)
   - Validation (Assert, Validate, Coerce)

7. **I/O Nodes (6)**
   - Input (Inject, Input, Prompt, Read)
   - Output (Output, Log, Debug, Alert)
   - File (ReadFile, WriteFile) - basic

8. **Control Flow Nodes (8)**
   - Pass (Identity, Clone, Merge)
   - Timing (Delay, Timeout, Throttle, Debounce)
   - Buffering (Buffer, Window)
   - Flow Control (Passthrough, Break, Continue)

9. **Custom Nodes**
   - User-defined functions
   - Lambda/arrow functions
   - Code execution (JavaScript/WASM)

10. **Advanced Nodes (5+)**
    - JSON Parser/Stringify
    - Regular expression
    - Date/Time operations
    - Cryptographic functions
    - Matrix operations (for numerical computing)

**Tests:** 30+ tests
- Each node category tested
- Type validation
- Edge cases
- Error conditions

**Code Location:**
- `packages/core-rust/src/domains/flow_based/nodes/math.rs`
- `packages/core-rust/src/domains/flow_based/nodes/logic.rs`
- `packages/core-rust/src/domains/flow_based/nodes/string.rs`
- `packages/core-rust/src/domains/flow_based/nodes/array.rs`
- `packages/core-rust/src/domains/flow_based/nodes/object.rs`
- `packages/core-rust/src/domains/flow_based/nodes/types.rs`
- `packages/core-rust/src/domains/flow_based/nodes/io.rs`
- `packages/core-rust/src/domains/flow_based/nodes/control.rs`

---

## Architecture

### Module Structure

```
packages/core-rust/src/domains/flow_based/
├── mod.rs                    # Core types (FlowPort, FlowNode, FlowNetwork, etc.)
├── types.rs                  # DataType, Message, Connection enums
├── executor.rs               # FlowExecutor and execution engine
├── routing.rs                # Message routing and scheduling
├── domain.rs                 # FlowNetworkDomain wrapper
├── visualization.rs          # Visualization structures and DOT export
├── nodes.rs                  # StandardNodes factory
├── nodes/
│   ├── math.rs              # Math node implementations
│   ├── logic.rs             # Logic node implementations
│   ├── string.rs            # String node implementations
│   ├── array.rs             # Array node implementations
│   ├── object.rs            # Object node implementations
│   ├── types.rs             # Type conversion nodes
│   ├── io.rs                # I/O nodes
│   ├── control.rs           # Control flow nodes
│   └── custom.rs            # Custom node support
└── tests/                   # Comprehensive test suite
```

### Data Flow Execution Model

```
1. Start Node (Inject)
   ↓
2. Message Queue [msg1, msg2, ...]
   ↓
3. Select Node to Execute
   ↓
4. Execute Node (read inputs → compute → write outputs)
   ↓
5. Route Output Messages
   ↓
6. Enqueue Downstream Nodes
   ↓
7. Repeat until Stop Node or Empty Queue
```

### Port Type System

```
Primitive Types:
  - number (f64 / i32 / u32)
  - string
  - boolean
  - null
  - undefined

Complex Types:
  - array<T>
  - object<K, V>
  - date
  - buffer
  - any (unrestricted)

Constraints:
  - required / optional
  - array vs scalar
  - custom validators
```

---

## Integration Points

### With Graph Abstraction
```
FlowNetwork → Graph
  Nodes → Graph Nodes
  Connections → Graph Edges
  Enables unified visualization
```

### With Existing Domains
```
FBP can orchestrate:
  - Circuit simulations (read voltages, control parameters)
  - Thermal analysis (process temperatures, control fans)
  - Block diagram blocks (pass signals through FBP)
  - State machine triggers (send events to FSMs)
  - Custom algorithms
```

### With UI Framework
```
FlowNetwork → FlowNetworkDiagramData
  ↓
React NodeEditor (customized for FBP)
  ↓
Interactive flow design and execution
```

---

## Testing Strategy

**Unit Tests:**
- Individual node functionality
- Port validation
- Data type checking
- Message creation

**Integration Tests:**
- Multi-node flows
- Message routing
- Conditional execution
- Error propagation

**End-to-End Tests:**
- Complete flow execution
- Visualization generation
- Statistics computation
- Domain integration

**Performance Tests:**
- Large networks (1000+ nodes)
- High message throughput
- Memory efficiency

---

## Documentation Plan

1. **PHASE7_TASK1_FBP_CORE_TYPES.md**
   - Node system architecture
   - Port specifications
   - Data type system
   - Message format
   - Network structure

2. **PHASE7_TASK2_FBP_EXECUTOR.md**
   - Execution engine design
   - Message routing algorithm
   - Scheduling strategy
   - Error handling
   - Debug support

3. **PHASE7_TASK3_FBP_DOMAIN.md**
   - Domain wrapper implementation
   - Visualization structures
   - Graph integration
   - Validation framework

4. **PHASE7_TASK4_FBP_NODES.md**
   - Standard node library documentation
   - Node categories and specifications
   - Usage examples
   - Custom node development guide

5. **FLOW_EXAMPLES.md**
   - Example flows (signal processing, data transformation, etc.)
   - Step-by-step tutorials
   - Best practices

---

## Success Criteria

- ✅ All 50+ standard nodes implemented and tested
- ✅ Flexible message routing and execution
- ✅ Integration with Tupan graph abstraction
- ✅ UI-ready visualization structures
- ✅ Comprehensive error handling
- ✅ 80+ integration tests
- ✅ Complete documentation
- ✅ Performance benchmarks met
- ✅ Support for custom node development

---

## Timeline

```
Week 1:
  - Task 1: FBP Core Types & Node System
    - FlowPort, FlowNode, DataType, Message, FlowNetwork
    - StandardNodes base classes
    - 25+ tests

Week 1-2:
  - Task 2: FBP Executor & Runtime
    - FlowExecutor implementation
    - Message routing and scheduling
    - Execution traces
    - 20+ tests

Week 2:
  - Task 3: FBP Domain Wrapper & Visualization
    - FlowNetworkDomain
    - Visualization structures
    - DOT export
    - Validation
    - 15+ tests

Week 3:
  - Task 4: Built-in Node Library Extension
    - Implement 30+ additional nodes
    - Math, logic, string, array, object nodes
    - I/O and control flow nodes
    - 30+ tests

Total: ~3-4 weeks, ~2500 lines Rust code + 90+ tests
```

---

## Next Phase (Phase 8)

**Symbolic Mathematics & Computer Algebra System**
- Expression parsing and manipulation
- Symbolic differentiation/integration
- Equation solving
- Graphing and visualization
- Integration with FBP for mathematical workflows

---

**Status:** PLANNING PHASE 7
**Next Action:** Implement Phase 7 Task 1 (FBP Core Types)
