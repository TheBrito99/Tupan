# Tupan Architecture

**Version:** 0.1.0
**Last Updated:** 2026-03-18

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [System Architecture](#system-architecture)
4. [Core Abstractions](#core-abstractions)
5. [Module Organization](#module-organization)
6. [Data Flow](#data-flow)
7. [Extending the System](#extending-the-system)

---

## Overview

Tupan is built on a **unified graph abstraction** where all simulation types (circuits, block diagrams, state machines, etc.) are represented as directed graphs with typed nodes and edges.

### Key Architectural Decision: Bond Graphs as Universal Currency

Rather than having isolated solvers for each domain:
```
❌ BAD:  Electrical Solver ✗ Thermal Solver ✗ Hydraulic Solver
```

We use **bond graphs** as a universal translator:
```
✅ GOOD:  All Domains → Bond Graph → Unified Solver
```

This means:
- An electrical circuit is converted to a bond graph
- A thermal network is converted to a bond graph
- A mechanical system is converted to a bond graph
- All three can be solved with the same solver
- Multi-domain coupling is automatic (thermodynamics in hydraulics, etc.)

---

## Design Principles

### 1. **DRY (Don't Repeat Yourself)**
- Core graph abstraction is reused by all simulators
- Solvers are reused by all domains
- UI components are reused by all editors

### 2. **Clean Architecture**
- Clear separation of concerns: UI ↔ Application ↔ Core
- Dependencies point inward (Core has no dependencies on UI)
- Each layer has a single responsibility

### 3. **SOLID Principles**
- **S**ingle Responsibility: Each module has one job
- **O**pen/Closed: Open for extension (new simulators), closed for modification
- **L**iskov Substitution: Domains can be swapped in solver
- **I**nterface Segregation: Traits define minimal contracts
- **D**ependency Inversion: Depend on abstractions, not concrete implementations

### 4. **Performance First**
- Heavy computation in Rust (compiled to WASM)
- Web Workers for long-running tasks
- Canvas rendering for high-performance visualization
- Lazy evaluation of graph simulations

### 5. **Type Safety**
- TypeScript for all application code (catches errors at compile time)
- Rust for all computation (memory safety + performance)
- Serialization/deserialization for WASM boundary

---

## System Architecture

### High-Level Layers

```
┌─────────────────────────────────────────────────────────┐
│              USER INTERFACE (React)                      │
│  - Visual Editors (NodeEditor component)                │
│  - Visualization (Canvas, WebGL, D3.js)                 │
│  - Property Panels and Toolbars                         │
└─────────────────────────────────────────────────────────┘
                            ↕
                    WASM Boundary
                            ↕
┌─────────────────────────────────────────────────────────┐
│           APPLICATION LAYER (TypeScript)                │
│  - Graph Management (type-safe graph operations)        │
│  - Orchestration (coordinate between components)        │
│  - State Management (Zustand stores)                    │
│  - WASM Bridge (communication with Rust)                │
└─────────────────────────────────────────────────────────┘
                            ↕
                    WASM Boundary
                            ↕
┌─────────────────────────────────────────────────────────┐
│        COMPUTATION CORE (Rust → WASM)                   │
│  - Graph Engine (core abstraction)                      │
│  - Solvers (ODE, DAE, steady-state)                     │
│  - Domain Physics (electrical, thermal, etc.)           │
│  - Symbolic Math Engine (CAS)                           │
│  - Bond Graph Utilities                                 │
└─────────────────────────────────────────────────────────┘
```

### Package Organization

```
packages/
├── core-rust/          Rust computation engine
│                       - Everything compiles to WASM
│                       - No external dependencies (pure computation)
│
├── core-ts/            TypeScript wrappers for Rust types
│                       - Graph data structures
│                       - WASM bridge layer
│                       - Type definitions
│
├── ui-framework/       Shared React components
│                       - NodeEditor (generic node-based editor)
│                       - Visualization components
│                       - Common UI patterns
│
├── simulators/         Domain-specific applications
│   ├── circuit-electrical/
│   ├── circuit-thermal/
│   ├── block-diagram/
│   └── ... (others)
│
└── web-app/            Main application entry point
                        - Routes to different simulators
                        - Global state management
                        - UI coordination
```

---

## Core Abstractions

### 1. Graph System

The foundation of everything. Three main types:

```rust
// In core-rust/src/graph/

pub trait Node {
    fn id(&self) -> NodeId;
    fn node_type(&self) -> &str;
    fn inputs(&self) -> &[Port];        // Input ports
    fn outputs(&self) -> &[Port];       // Output ports
    fn compute(&mut self, ctx: &ComputeContext) -> Result<()>;
}

pub trait Edge {
    fn id(&self) -> EdgeId;
    fn source(&self) -> (NodeId, PortId);
    fn target(&self) -> (NodeId, PortId);
    fn properties(&self) -> &EdgeProperties;
}

pub struct Graph {
    nodes: HashMap<NodeId, NodeData>,
    edges: HashMap<EdgeId, EdgeData>,
    adjacency: HashMap<NodeId, Vec<EdgeId>>,
}
```

**Why this design?**
- `Node` and `Edge` are traits → easily extended for different types
- `Graph` is generic → works with any node/edge implementation
- `Port` system → multiple inputs/outputs with type information
- All operations are on the graph level → same solver works for all domains

### 2. Port System

Each node has typed input/output ports:

```rust
pub enum PortType {
    Electrical,    // Voltage/current
    Thermal,       // Temperature/heat flow
    Mechanical,    // Force/torque/position
    Hydraulic,     // Pressure/flow rate
    Signal,        // Generic numeric signal
}

pub enum PortDirection {
    Input,         // Receives data
    Output,        // Sends data
}

pub struct Port {
    id: PortId,
    name: String,
    direction: PortDirection,
    port_type: PortType,
    value: Vec<f64>,  // Can be multi-valued (e.g., 3D force)
    unit: Option<String>,
}
```

**Benefits:**
- Type checking: Can't connect electrical output to thermal input
- Units: Solver can validate consistency
- Multi-valued ports: Vectors for 3D forces, complex numbers, etc.

### 3. Solver Interface

```rust
pub trait Solver {
    fn step(&mut self, state: &mut [f64]) -> Result<f64>;
    fn time(&self) -> f64;
    fn reset(&mut self);
}
```

Implementations:
- `OdeSolver`: Runge-Kutta 4/45 for time-domain simulation
- `DaeSolver`: For differential-algebraic systems (coming soon)
- `SteadyStateSolver`: Newton-Raphson for steady-state (coming soon)

### 4. Physical Domain Trait

```rust
pub trait PhysicalDomain {
    type Component: Node;
    type Connection: Edge;

    fn governing_equations(&self, graph: &Graph)
        -> SystemOfEquations;

    fn to_bond_graph(&self, graph: &Graph)
        -> BondGraph;
}
```

Enables:
- Domain-specific component definitions
- Automatic conversion to bond graphs
- Multi-domain coupling

### 5. Bond Graph Model

```rust
pub enum BondGraphElement {
    Source(SourceType),      // Se (effort) or Sf (flow)
    Storage(StorageType),    // C (capacitance) or I (inertance)
    Dissipator(f64),         // R (resistance)
    Junction0,               // 0-junction (equal effort)
    Junction1,               // 1-junction (equal flow)
    Transformer(f64),        // TF (modulus)
    Gyrator(f64),            // GY (gyration ratio)
}
```

This unifies all domains:
- **Electrical**: V = effort, I = flow, R = resistance
- **Thermal**: T = effort, Q = flow, R = thermal resistance
- **Mechanical**: F = effort, v = flow, c = damping
- **Hydraulic**: P = effort, Q = flow, R = flow resistance

---

## Module Organization

### core-rust

```
src/
├── lib.rs                    WASM entry point
├── error.rs                  Error types
├── graph/
│   ├── mod.rs               Core traits
│   ├── node.rs              Node implementation
│   ├── edge.rs              Edge implementation
│   ├── port.rs              Port types
│   └── graph.rs             Graph data structure
├── solvers/
│   ├── mod.rs               Solver traits
│   ├── ode.rs               RK4/RK45 implementation
│   ├── dae.rs               (future)
│   └── steady_state.rs      (future)
├── domains/
│   ├── mod.rs               PhysicalDomain trait
│   ├── electrical/
│   │   ├── mod.rs
│   │   ├── components.rs
│   │   └── solver.rs        Modified Nodal Analysis
│   ├── thermal/
│   ├── mechanical/
│   ├── hydraulic/
│   ├── pneumatic/
│   └── chemistry/
├── bond_graph/
│   ├── mod.rs
│   ├── ports.rs             Energy port definitions
│   └── causality.rs         Causality assignment
├── symbolic/
│   ├── mod.rs
│   ├── expression.rs        Expression tree
│   ├── simplify.rs          Algebraic simplification
│   └── calculus.rs          Differentiation/integration
└── mechanics/
    ├── rigid_body.rs
    ├── continuum.rs         FEA solver
    └── inertia.rs           Moment calculations
```

### core-ts

```
src/
├── index.ts                 Public API
├── graph/
│   ├── types.ts             Type definitions
│   ├── Graph.ts             Graph implementation
│   └── index.ts             Exports
└── wasm-bridge/
    ├── GraphBridge.ts       Communication with Rust
    └── index.ts             Exports
```

### ui-framework

```
src/
├── index.ts                 Public API
├── components/
│   ├── NodeEditor/          Generic node-based editor
│   │   ├── NodeEditor.tsx
│   │   └── NodeEditor.module.css
│   ├── Canvas/              High-perf rendering
│   ├── PropertyPanel/       Node property editor
│   ├── Toolbar/             Tool selection
│   └── Graph/               Graph visualization
├── hooks/                   React hooks
├── store/                   Zustand stores
└── theme/                   Design system
```

### simulators (example: electrical)

```
packages/simulators/circuit-electrical/
├── src/
│   ├── editor/              UI for circuit design
│   ├── solver/              Domain-specific solver
│   └── App.tsx              Entry point
└── tests/                   Domain-specific tests
```

---

## Data Flow

### Creating a Simulation

```
1. User opens circuit editor
   ↓
2. NodeEditor loads with empty Graph
   ↓
3. User adds components (resistor, capacitor, etc.)
   ↓
4. Graph updated in TypeScript (Graph class)
   ↓
5. User clicks "Simulate"
   ↓
6. Graph serialized to JSON
   ↓
7. Passed to WASM via GraphBridge
   ↓
8. Rust: Deserialize JSON → Graph<ElectricalComponent>
   ↓
9. Rust: Convert to BondGraph
   ↓
10. Rust: Run OdeSolver.step() in loop
    ↓
11. Rust: Serialize results to JSON
    ↓
12. TypeScript: Deserialize, update visualization
    ↓
13. Canvas shows voltage/current waveforms
```

### Adding a New Component (e.g., Diode)

```
1. Rust: Define DiodeComponent struct
   ↓
2. Rust: Implement Node trait (compute voltage/current)
   ↓
3. Rust: Add to ElectricalComponent enum
   ↓
4. TypeScript: Define UI representation
   ↓
5. TypeScript: Add to nodeTypes palette
   ↓
6. UI: Diode now appears in toolbar
```

---

## Extending the System

### Adding a New Simulator

1. **Create package**: `packages/simulators/{name}/`

2. **Implement domain in Rust**:
   ```rust
   pub struct MyDomain;
   impl PhysicalDomain for MyDomain {
       fn to_bond_graph(...) { /* implementation */ }
   }
   ```

3. **Create React components**:
   ```typescript
   import { NodeEditor } from '@tupan/ui-framework'
   export function MySimulator() {
       return <NodeEditor graph={graph} />
   }
   ```

4. **Wire into main app**:
   ```typescript
   // web-app/src/App.tsx
   <Route path="/my-simulator" element={<MySimulator />} />
   ```

### Adding a New Physical Domain

1. **Define components**: `core-rust/src/domains/{name}/components.rs`

2. **Implement PhysicalDomain**: `core-rust/src/domains/{name}/mod.rs`

3. **Add bond graph conversion**: Implement `to_bond_graph()`

4. **Create simulator**: Use the generic NodeEditor + new domain

---

## Performance Considerations

### Why Rust?
- **Computation Speed**: 10-100x faster than JavaScript
- **Memory Safety**: No garbage collection pauses
- **WASM**: Compiles to bytecode optimizable by browser

### Why TypeScript?
- **Development Speed**: Rapid UI iteration
- **Type Safety**: Catch errors at compile time
- **Ecosystem**: Rich library ecosystem for visualization

### Performance Targets
- **Simulation Step**: < 1ms for 100-node circuit (allows 60 FPS)
- **WASM Load**: < 500ms
- **UI Frame Rate**: 60 FPS during pan/zoom
- **Memory**: < 500MB for typical simulation

### Optimization Strategies
- **Parallelization**: Rust uses rayon for multi-threaded solvers
- **Caching**: Topological sort cached if graph unchanged
- **Lazy Evaluation**: Only compute states that are visualized
- **Canvas**: Use requestAnimationFrame, not DOM updates

---

## Testing Strategy

### Unit Tests
- Each module has `#[cfg(test)]` tests
- Rust tests run with `cargo test`
- TypeScript tests run with `vitest`

### Integration Tests
- End-to-end: Create graph → simulate → verify results
- Example: RC circuit with known time constant

### Performance Tests
- Benchmark large graphs (1000+ nodes)
- Profile WASM load time
- Measure UI frame rate

---

## Future Architecture Improvements

1. **Plugin System**: Allow community-created simulators
2. **Distributed Solving**: Large simulations across multiple machines
3. **GPU Acceleration**: Offload matrix operations to GPU
4. **Real-Time Collaboration**: Multiple users editing same simulation
5. **Version Control**: Full git integration for simulation files
6. **Parametric Studies**: Sweep parameters and analyze results

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `core-rust/src/graph/mod.rs` | Core graph abstraction |
| `core-rust/src/solvers/ode.rs` | ODE solver |
| `core-ts/src/graph/Graph.ts` | TypeScript graph |
| `ui-framework/src/components/NodeEditor/NodeEditor.tsx` | Generic editor |
| `docs/CLAUDE_CONTEXT.md` | Quick reference for Claude |

---

**See also:** [CLAUDE_CONTEXT.md](./CLAUDE_CONTEXT.md) for quick reference, [DOMAIN_MODELS.md](./DOMAIN_MODELS.md) for physics details.
