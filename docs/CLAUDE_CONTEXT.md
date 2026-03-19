# Tupan - Quick Context for Claude

**Last Updated:** 2026-03-18

## What is Tupan?

Tupan is a comprehensive **mechatronics engineering simulation platform** combining:
- Multi-domain physical simulators (electrical, thermal, mechanical, hydraulic, pneumatic, magnetic)
- Visual programming environments (block diagrams, state machines, Petri nets, FBP)
- Symbolic mathematics with intelligent graph visualization
- Circuit simulators, FEA, P&ID diagrams, and chemistry support

**Status:** Early Phase 1 (Foundation Layer)

---

## Architecture in 30 Seconds

```
UI Layer (TypeScript/React)
        ↕ WASM Bindings
Application Layer (TypeScript)
        ↕ WASM Interop
Computation Core (Rust → WASM)
```

- **Rust WASM**: All computation (graph engine, solvers, physics)
- **TypeScript**: UI, orchestration, visualization
- **Key Pattern**: Everything is a **graph** - unified abstraction shared by all simulators
- **Bond Graph**: Universal translator between physical domains

---

## Where to Find Things

### Core Rust Engine
- **Location:** `packages/core-rust/src/`
- **Main Abstraction:** `src/graph/` - Core graph types, nodes, edges, ports
- **Solvers:** `src/solvers/ode.rs` - RK4/RK45 solvers (needs derivative function integration)
- **Domains:** `src/domains/` - Physical domain implementations (empty, ready for implementation)
- **Entry Point:** `src/lib.rs` - WASM exports

### TypeScript Core
- **Location:** `packages/core-ts/src/`
- **Graph Implementation:** `graph/Graph.ts` - TypeScript mirror of Rust graph
- **WASM Bridge:** `wasm-bridge/GraphBridge.ts` - Communication layer (placeholder)
- **Entry Point:** `src/index.ts` - Public exports

### UI Framework
- **Location:** `packages/ui-framework/src/`
- **Generic Node Editor:** `components/NodeEditor/NodeEditor.tsx` - Reusable visual editor
- **Used By:** All simulators (circuits, block diagrams, state machines, P&ID, etc.)

### Web Application
- **Location:** `packages/web-app/src/`
- **Main App:** `App.tsx` - Entry point, integrates NodeEditor
- **Development:** `npm run dev` from web-app directory
- **Build:** `npm run build`

---

## Key Abstractions (DON'T REINVENT)

### 1. Graph System (The Foundation)
```rust
// packages/core-rust/src/graph/mod.rs
pub trait Node { /* compute, get inputs/outputs */ }
pub trait Edge { /* connect nodes */ }
pub struct Graph { /* manages all nodes and edges */ }
```

**Why?** All simulators (circuits, block diagrams, bond graphs, state machines, FBP, P&ID) are just graphs with different node types.

**Used By:**
- Electrical circuit simulator (resistors, capacitors = nodes)
- Block diagrams (blocks, transfer functions = nodes)
- State machines (states = nodes, transitions = edges)
- Petri nets (places/transitions = nodes)
- FBP (functions = nodes, data flows = edges)
- Bond graphs (elements = nodes)

### 2. Numerical Solvers
```rust
// packages/core-rust/src/solvers/ode.rs
pub struct OdeSolver { /* RK4/RK45 */ }
pub trait Solver { fn step(&mut self) -> Result<f64> }
```

**Shared by:** All time-domain simulators (electrical, thermal, mechanical, hydraulic, pneumatic)

### 3. Physical Domain Trait
```rust
// packages/core-rust/src/domains/mod.rs
pub trait PhysicalDomain {
    fn to_bond_graph(&self) -> BondGraph;
    fn governing_equations(&self) -> SystemOfEquations;
}
```

**Purpose:** Convert domain-specific circuits to bond graphs for unified solving

### 4. TypeScript Graph Mirror
```typescript
// packages/core-ts/src/graph/Graph.ts
export class Graph { /* mirrors Rust structure */ }
export class Node { /* mirrors Rust */ }
```

**Purpose:** Type-safe TypeScript representation of graphs

### 5. UI Node Editor
```typescript
// packages/ui-framework/src/components/NodeEditor/NodeEditor.tsx
<NodeEditor graph={graph} onGraphChange={handleChange} />
```

**Shared by:** Circuit editor, block diagram editor, state machine editor, Petri net editor, FBP editor, P&ID editor

---

## Common Tasks

### Adding a New Component Type (e.g., inductor)

1. **Rust:** Define in `core-rust/src/domains/electrical/components.rs`
   ```rust
   pub enum ElectricalComponent {
       Resistor { resistance: f64 },
       Inductor { inductance: f64 },  // NEW
   }
   ```

2. **Rust:** Implement `Node` trait compute function
   ```rust
   fn compute(&mut self, inputs: &[f64]) -> Vec<f64> {
       // V = L * dI/dt
   }
   ```

3. **TypeScript:** Add UI representation (color, icon, etc.)
   ```typescript
   nodeTypes.set('inductor', {
     name: 'Inductor',
     category: 'Electrical',
     color: '#FF5722'
   })
   ```

4. **Testing:** Add test case verifying behavior

### Adding a New Simulator Type

1. **Create package:** `packages/simulators/{name}/`
2. **Rust side:** Extend `PhysicalDomain` trait for your domain
3. **TypeScript side:** Create React components using `NodeEditor` from `ui-framework`
4. **WASM bridge:** Wire up in `core-ts/src/wasm-bridge/`
5. **Main app:** Add route in `web-app/src/App.tsx`

### Running the Web App

```bash
# From project root
pnpm install
cd packages/web-app
pnpm dev
```

Then open `http://localhost:5173` in your browser.

---

## Don't Recreate These (They Already Exist!)

| What | Where | Use When |
|------|-------|----------|
| Graph data structure | `core-rust/src/graph/` | Any node-based system |
| ODE solver | `core-rust/src/solvers/ode.rs` | Time-domain simulation |
| Node editor UI | `ui-framework/src/components/NodeEditor/` | Building visual editors |
| TypeScript graph | `core-ts/src/graph/Graph.ts` | Working with graphs in TS |
| WASM bridge | `core-ts/src/wasm-bridge/` | Calling Rust from TS |

---

## Project Structure Overview

```
tupan/
├── packages/
│   ├── core-rust/          # Rust computation engine → WASM
│   │   └── src/
│   │       ├── graph/      # Core abstraction
│   │       ├── solvers/    # ODE/DAE solvers
│   │       ├── domains/    # Physical domain implementations
│   │       └── lib.rs      # WASM exports
│   ├── core-ts/            # TypeScript wrappers
│   │   └── src/
│   │       ├── graph/      # Graph implementation (mirrors Rust)
│   │       └── wasm-bridge/
│   ├── ui-framework/       # Shared React components
│   │   └── src/
│   │       └── components/NodeEditor/
│   ├── simulators/         # Domain-specific simulators
│   │   ├── circuit-electrical/
│   │   ├── circuit-thermal/
│   │   └── ... (others to be added)
│   └── web-app/            # Main application
│       └── src/
│           └── App.tsx
├── docs/
│   ├── CLAUDE_CONTEXT.md   # This file!
│   ├── ARCHITECTURE.md     # Full architecture
│   └── DOMAIN_MODELS.md    # Physical equations
└── tools/
    └── doc-generator/      # Auto-generates docs
```

---

## Implementation Status

### ✅ Completed (Phase 1a)
- [x] Monorepo structure (pnpm workspaces)
- [x] Rust graph abstraction (node, edge, graph types)
- [x] ODE solver (RK4, RK45 structure)
- [x] TypeScript graph implementation
- [x] WASM bridge skeleton
- [x] React Node Editor component
- [x] Web app shell

### ⏳ Next (Phase 1b-1c)
- [ ] WASM build pipeline and compilation
- [ ] Wire WASM module into TypeScript
- [ ] End-to-end test: Create graph → simulate → return results
- [ ] Electrical domain implementation
- [ ] Modified Nodal Analysis solver

### 🚀 Future Phases
- Phase 2: First working simulator (electrical circuits)
- Phase 3: Bond graph foundation
- Phase 4-5: Expand domains & block diagrams
- Phase 6+: State machines, FBP, FEA, symbolic math

---

## Quick Reference: Adding Code

### Before writing new code...
1. Check if abstraction already exists (graph, solver, etc.)
2. Follow the established pattern
3. Add tests
4. Update this doc if architecture changes

### Code lives in multiple places:
- **Heavy computation:** Rust (`core-rust/`)
- **UI and logic:** TypeScript (`core-ts/`, `ui-framework/`, `web-app/`)
- **Simulator-specific:** Each simulator package

### When in doubt:
- Graph stuff → `core-rust/src/graph/`
- Physics stuff → `core-rust/src/domains/`
- UI stuff → `ui-framework/src/components/`
- App structure → `web-app/src/`

---

## Helpful Commands

```bash
# Build everything
pnpm build

# Run tests
pnpm test

# Run web app in dev mode
cd packages/web-app && pnpm dev

# Generate docs
pnpm docs:generate

# Format code
pnpm format
```

---

**This document is auto-generated. Update happens at every build.**

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md)
For domain-specific info, see [DOMAIN_MODELS.md](./DOMAIN_MODELS.md)
