# Phase 2: Electrical Circuit Simulator

**Objective:** Build first complete, working simulator end-to-end
**Timeline:** 2-3 weeks (~60-80 hours)
**Deliverable:** Working RC circuit simulation with visualization

## Overview

```
User Action: Create RC circuit with voltage source
         ↓
UI: Circuit editor (NodeEditor component)
         ↓
Graph: 3 nodes (resistor, capacitor, source) + 3 edges
         ↓
Rust: Modified Nodal Analysis solver
         ↓
WASM: Runs simulation step-by-step
         ↓
TypeScript: Collects results
         ↓
Visualization: Voltage/current waveforms in browser
```

## Tasks

### Task 1: Define Electrical Components (Rust)
**File:** `packages/core-rust/src/domains/electrical/mod.rs`

**Components needed:**
- Resistor (R) - Ohm's law: V = I * R
- Capacitor (C) - Capacitive behavior: I = C * dV/dt
- Inductor (L) - Inductive behavior: V = L * dI/dt
- Voltage Source (Vs) - Fixed voltage
- Current Source (Is) - Fixed current
- Ground (GND) - Reference node

**Structure:**
```rust
pub enum ElectricalComponent {
    Resistor { resistance: f64 },           // Ohms
    Capacitor { capacitance: f64 },         // Farads
    Inductor { inductance: f64 },           // Henries
    VoltageSource { voltage: f64 },         // Volts (can be time-varying)
    CurrentSource { current: f64 },         // Amps
    Ground,                                 // Reference
}

impl Node for ElectricalComponent {
    fn compute(&mut self, inputs: &[f64]) -> Vec<f64> {
        // Voltage/current computations
    }
}
```

**Estimated time:** 2-3 hours

### Task 2: Implement Modified Nodal Analysis (MNA) Solver
**File:** `packages/core-rust/src/domains/electrical/solver.rs`

**What is MNA?**
- Automatic solver for circuits without manual manipulation
- Creates conductance matrix from circuit topology
- Solves: G * V = I (Kirchhoff's laws)

**Algorithm:**
1. Identify nodes and assign indices
2. Build conductance matrix G (2D array)
3. Build current vector I (1D array)
4. For each component:
   - If resistor: Add conductance to G
   - If voltage source: Add constraint equation
   - If capacitor: Add to dQ/dV term
5. Solve G * V = I at each time step

**Estimated time:** 4-5 hours

### Task 3: Create Electrical Domain Module
**File:** `packages/core-rust/src/domains/electrical/`

**Structure:**
```
electrical/
├── mod.rs          # Main domain definition
├── components.rs   # ElectricalComponent enum
├── solver.rs       # Modified Nodal Analysis
└── tests.rs        # Test circuits
```

**Implement:**
- `PhysicalDomain` trait for electrical domain
- Topology analysis (find nodes, check connectivity)
- Matrix construction and solving
- Integration with ODE solver

**Estimated time:** 3-4 hours

### Task 4: Update Graph to Support Domains
**File:** `packages/core-rust/src/graph/`

**Changes:**
- Generic node types (not just `NodeData`)
- Support for component-specific compute logic
- Connection validation (only compatible port types)

**Estimated time:** 1-2 hours

### Task 5: Create Electrical Circuit Editor UI
**File:** `packages/simulators/circuit-electrical/src/`

**Components needed:**
- Circuit editor (uses `NodeEditor` from ui-framework)
- Component palette (resistor, capacitor, etc.)
- Property panel (edit resistance, capacitance values)
- Simulation controls (start, stop, speed)
- Plot visualization (voltage/current over time)

**Features:**
- Drag components onto canvas
- Connect with wires
- Edit component values
- Run simulation
- Plot results

**Estimated time:** 3-4 hours

### Task 6: WASM Integration for Electrical
**File:** `packages/core-rust/src/wasm.rs` (extend)

**New methods:**
```rust
pub fn simulate_electrical_circuit(
    graph_json: &str,
    solver_config: &str,  // dt, duration, etc.
) -> Result<String, JsValue> {
    // Deserialize graph
    // Create MNA solver
    // Run simulation loop
    // Serialize results
    // Return time/voltage/current arrays
}
```

**Estimated time:** 2-3 hours

### Task 7: Visualization & Plotting
**File:** `packages/simulators/circuit-electrical/src/Plot.tsx`

**Use:** Plotly.js (already in dependencies)

**Plots needed:**
- Voltage vs. time (for each node)
- Current vs. time (for each component)
- Power dissipation (for resistors)

**Estimated time:** 2-3 hours

### Task 8: Testing & Validation
**Files:** `packages/core-rust/src/domains/electrical/tests.rs`

**Test cases:**
1. **RC Circuit (charging):**
   - V = 5V, R = 1kΩ, C = 10µF
   - τ = RC = 0.01s
   - Verify: V(t) = 5(1 - e^(-t/τ))

2. **RL Circuit (inductive):**
   - V = 10V, R = 100Ω, L = 100mH
   - τ = L/R = 0.001s
   - Verify: I(t) = (V/R)(1 - e^(-t/τ))

3. **RLC Circuit (resonant):**
   - V = 10V, R = 10Ω, L = 100mH, C = 1µF
   - Verify oscillation frequency

4. **Series circuit:**
   - Multiple components in series
   - Verify Kirchhoff's voltage law

**Estimated time:** 3-4 hours

## Implementation Order

1. **Week 1:**
   - Task 1: Electrical components
   - Task 2: MNA solver
   - Task 3: Domain module
   - Task 8: Basic tests

2. **Week 2:**
   - Task 4: Graph updates
   - Task 6: WASM integration
   - Task 5: UI implementation

3. **Week 3:**
   - Task 7: Visualization
   - End-to-end testing
   - Documentation
   - Performance optimization

## Success Criteria

✅ **Phase 2 Complete when:**
- [ ] RC circuit creates 3 nodes and 3 edges
- [ ] Simulation runs without errors
- [ ] Results match theoretical values (< 1% error)
- [ ] Voltage/current plots display correctly
- [ ] Can edit component values and re-run
- [ ] No console errors
- [ ] Tests pass for RC, RL, RLC circuits

## Key Challenges & Solutions

### Challenge 1: Numerical Instability
**Problem:** Some solver configurations cause divergence
**Solution:**
- Implement implicit Euler for capacitors/inductors
- Adaptive time stepping
- Matrix conditioning checks

### Challenge 2: Singularities
**Problem:** Floating voltage nodes (not connected to GND)
**Solution:**
- Automatic GND addition
- Validation of circuit connectivity
- Error messages for invalid circuits

### Challenge 3: Performance
**Problem:** Matrix operations for large circuits slow
**Solution:**
- Sparse matrix representation (not dense)
- Precompute topology once
- Cache factorization

## Architecture Decision: MNA Over Transient Analysis

**Why MNA?**
- Works for DC and AC analysis
- Automatically handles all component types
- No need to manually rearrange equations
- Scales to larger circuits
- Industry standard (SPICE uses it)

**Alternative considered: Transient Analysis**
- Would need custom solvers per circuit topology
- More manual work
- Less extensible to other domains

## Testing Strategy

### Unit Tests (Rust)
- Component models
- MNA matrix construction
- Solver convergence

### Integration Tests
- Circuit topology validation
- End-to-end simulation

### Visual Tests
- Plot generation
- Waveform correctness

## Performance Targets

- **Simulation step:** < 1ms for 10-node circuit
- **Circuit rendering:** 60 FPS
- **Plot rendering:** 60 FPS during animation
- **Total simulation:** 1s circuit in ~100ms

## Documentation

Docs to write:
- Circuit simulation theory (MNA algorithm)
- Component equations and parameters
- How to use electrical simulator
- Troubleshooting guide

## Next Phase After Phase 2

**Phase 3: Bond Graph Foundation**
- Implement bond graph engine
- Convert electrical circuit to bond graph
- Add thermal domain using same infrastructure
- Prove multi-domain unification works

---

**Status:** Ready to start
**Start Date:** After Phase 1b completion
**Target Completion:** 2-3 weeks
