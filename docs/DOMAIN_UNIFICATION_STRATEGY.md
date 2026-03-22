# Domain Unification Strategy: Code Reuse Across Physical Domains

**Date:** 2026-03-18
**Status:** Architecture Strategy Document
**Implementation:** Phases 3-4 and beyond

---

## Executive Summary

All physical domains (electrical, thermal, mechanical, hydraulic, pneumatic, chemical) share the same **fundamental mathematical structure**. By implementing a **generic Modified Nodal Analysis (MNA) solver**, we achieve massive code reuse:

**One solver equation:** `G × X = Y`

**Used by all domains:**
- Electrical circuits
- Thermal circuits
- Mechanical systems
- Hydraulic systems
- Pneumatic systems
- Chemical systems

**Result:** ~60% reduction in solver code across all domains

---

## The Unified Mathematical Framework

### Core Analogy: Energy Port Representation

Every domain has:
1. **Effort variable** (T, V, F, P, μ) - the "potential"
2. **Flow variable** (q̇, I, v, Q, ṅ) - the "current"
3. **Resistance** (R_th, R, f, R_h, R_c) - energy dissipation
4. **Capacitance** (C_th, C, m, A, ρ) - energy storage

### The MNA Equation: `G × X = Y`

| Domain | Effort (X) | Flow (Y) | Conductance (G) | Capacitance | Example |
|--------|-----------|---------|-----------------|-------------|---------|
| **Electrical** | V [V] | I [A] | G = 1/R [S] | C [F] | Resistor-capacitor circuit |
| **Thermal** | T [K] | q̇ [W] | G_th = 1/R_th [W/K] | C_th [J/K] | Heat sink cooling |
| **Mechanical** | F [N] | v [m/s] | f [N·s/m] | m [kg] | Spring-damper system |
| **Hydraulic** | P [Pa] | Q [m³/s] | G_h = 1/R_h [m³/(s·Pa)] | A [m²] | Pipe network |
| **Pneumatic** | P [Pa] | Q [m³/s] | G_p = 1/R_p [m³/(s·Pa)] | V [m³] | Air piping |
| **Chemical** | μ [J/mol] | ṅ [mol/s] | G_c [varies] | ρ [kg/m³] | Reaction network |

---

## Implementation Strategy

### Phase 1: Generic MNA Solver (✅ Complete)

**File:** `packages/core-rust/src/solvers/mna_generic.rs`

**What it does:**
```rust
pub struct GenericMnaSolver {
    num_nodes: usize,
    g_matrix: Option<DMatrix<f64>>,  // Conductance
    y_vector: Option<DVector<f64>>,  // Flow sources
    effort_vector: DVector<f64>,     // Solution vector
}

impl GenericMnaSolver {
    pub fn add_conductance(&mut self, node1, node2, conductance);
    pub fn add_flow_source(&mut self, node, flow);
    pub fn add_capacitance_transient(&mut self, node1, node2, capacitance);
    pub fn solve(&mut self) -> Result<(), String>;
    pub fn get_effort(&self, node: usize) -> f64;
}
```

**Key features:**
- ✅ Domain-agnostic matrix operations
- ✅ Implicit Euler for transient (C/dt + G) × X_n
- ✅ Reference node pinning (X_0 = 0)
- ✅ LU decomposition solver
- ✅ 100% reusable across domains

---

### Phase 2: Domain-Specific Wrappers (Thermal Example)

**File:** `packages/core-rust/src/domains/thermal/solver.rs`

**Pattern:**
```rust
pub struct ThermalAnalyzer {
    num_nodes: usize,
    time_step: f64,
    solver: Option<GenericMnaSolver>,  // ← Reused!
}

impl ThermalAnalyzer {
    pub fn solve_steady_state(&mut self) -> Result<Vec<f64>, String> {
        // 1. Create generic solver
        let mut solver = GenericMnaSolver::new(self.num_nodes, self.time_step);

        // 2. Add thermal components as conductances
        solver.add_conductance(0, 1, 1.0/0.5)?;  // R_th = 0.5 K/W

        // 3. Add heat sources as flow sources
        solver.add_flow_source(1, 100.0)?;  // Q̇ = 100 W

        // 4. Solve
        solver.solve()?;

        // 5. Extract temperatures
        let temps = (0..self.num_nodes)
            .map(|i| solver.get_effort(i))  // T in °C
            .collect();

        Ok(temps)
    }
}
```

**Thermal-specific:**
- `add_conductance(node1, node2, 1/R_th)` ← Maps to generic
- `add_flow_source(node, Q̇)` ← Maps to generic
- `get_effort(node)` → Temperature [K or °C]

**Identical pattern works for:**
- Mechanical (F in Newtons, v in m/s)
- Hydraulic (P in Pa, Q in m³/s)
- Pneumatic (P in Pa, Q in m³/s)
- Chemical (μ, ṅ)

---

## Implementation Roadmap

### Phase 3: Thermal (✅ In Progress)

**Thermal components:**
```rust
ThermalResistance {      // → add_conductance(1/R_th)
    resistance: 0.5,     // [K/W]
}

ThermalCapacitance {     // → add_capacitance_transient(C_th)
    capacitance: 5000.0, // [J/K]
}

HeatSource {             // → add_flow_source(Q̇)
    power: 100.0,        // [W]
}
```

**Equations solved:**
```
Steady-state: G_th × T = Q̇
Transient:    (C_th/dt + G_th) × T_n = (C_th/dt) × T_{n-1} + Q̇
```

**Files:**
- ✅ `solvers/mna_generic.rs` - Generic solver
- ✅ `domains/thermal/solver.rs` - Thermal wrapper
- ✅ `domains/thermal/components.rs` - Component definitions
- ⏳ `domains/thermal/mod.rs` - Complete integration

---

### Phase 4: Mechanical System

**Mechanical components:**
```rust
Damper {                 // → add_conductance(f)
    damping: 100.0,      // [N·s/m]
}

Mass {                   // → add_capacitance_transient(m)
    mass: 5.0,           // [kg]
}

Force {                  // → add_flow_source(F)
    force: 50.0,         // [N]
}
```

**Equations solved:**
```
Steady-state: f × v = F
Transient:    (m/dt + f) × v_n = (m/dt) × v_{n-1} + F
```

**Code reuse:** ~80% identical to thermal!

---

### Phase 4: Hydraulic System

**Hydraulic components:**
```rust
HydraulicResistance {    // → add_conductance(1/R_h)
    resistance: 1e6,     // [Pa·s/m³]
}

AccumulatorVolume {      // → add_capacitance_transient(A)
    area: 0.001,         // [m²]
}

FlowSource {             // → add_flow_source(Q)
    flow: 0.001,         // [m³/s]
}
```

**Equations solved:**
```
Steady-state: G_h × P = Q
Transient:    (A/dt + G_h) × P_n = (A/dt) × P_{n-1} + Q
```

**Code reuse:** ~80% identical to thermal!

---

### Phase 4: Pneumatic System

Nearly identical to hydraulic, with gas-specific properties.

---

### Phase 5+: Chemistry & Combined Domains

**Chemical system:**
```rust
Reaction {               // → add_conductance(k)
    rate_constant: 0.1,  // [1/s]
}

Accumulator {            // → add_capacitance_transient(ρ)
    density: 1000.0,     // [kg/m³]
}

MolecularSource {        // → add_flow_source(ṅ)
    molar_flow: 0.01,    // [mol/s]
}
```

---

## Code Structure: Domain-Agnostic Design

### Solver Layer (100% Reusable)

```
solvers/
├── mna_generic.rs          ← ONE solver, all domains use it
└── ode.rs                  ← ODE solver (future enhancement)
```

**Size:** ~500 lines total
**Used by:** Electrical, Thermal, Mechanical, Hydraulic, Pneumatic, Chemical

---

### Domain Layer (Domain-Specific Wrappers)

```
domains/
├── electrical/
│   ├── mod.rs              ← Domain interface
│   ├── components.rs       ← Component types
│   └── solver.rs           ← Wrapper around GenericMnaSolver
├── thermal/
│   ├── mod.rs
│   ├── components.rs
│   └── solver.rs           ← Reuses GenericMnaSolver
├── mechanical/
│   ├── mod.rs
│   ├── components.rs
│   └── solver.rs           ← Reuses GenericMnaSolver
├── hydraulic/
│   ├── mod.rs
│   ├── components.rs
│   └── solver.rs           ← Reuses GenericMnaSolver
└── ...
```

**Each domain:**
- ~500 lines component definitions
- ~200 lines solver wrapper (uses GenericMnaSolver)
- ~300 lines module interface

**Total per domain:** ~1,000 lines
**Without reuse:** Would be ~2,500 lines (solver duplication)

**Savings:** 60% code reduction per domain

---

## Bond Graph Integration (Phase 5+)

Once multiple domains are implemented, **bond graphs** will provide a unified coupling mechanism:

```
Electrical Domain          Thermal Domain
    ↓ (coupling)              ↑
    └──→ Bond Graph ←─────────┘
    ↑ (coupling)              ↓
Mechanical Domain ←───→ Hydraulic Domain
```

**Example: Electro-thermal coupling**
```
Electrical → (I² R loss) → Thermal
```

Implemented as bond graph transformation:
```
Power dissipation [W]
  ↓ (from electrical solver)
Heat source [W]
  ↓ (in thermal domain)
Temperature rise [K]
```

---

## Design Principles for Code Reuse

### 1. **Abstraction by Variables, Not by Domain**

❌ **Wrong approach:**
```rust
struct ElectricalSolver { ... }
struct ThermalSolver { ... }
struct MechanicalSolver { ... }
// → Code duplication!
```

✅ **Right approach:**
```rust
struct GenericMnaSolver {
    g_matrix: DMatrix,  // Conductance (generic concept)
    y_vector: DVector,  // Flow source (generic concept)
    x_vector: DVector,  // Effort (generic concept)
}
// → Reuse for all domains!
```

### 2. **Domain Wrapper Pattern**

Each domain provides:
- **Component definitions** (R_th, C_th, Q̇)
- **Parameter validation** (thermal-specific ranges)
- **Result interpretation** (effort → temperature)
- **Uses generic solver** (no duplication)

### 3. **Interface Consistency**

All domain solvers expose:
```rust
pub fn solve_steady_state(&mut self) -> Result<Vec<f64>, String>;
pub fn solve_transient(&mut self, duration, dt)
    -> Result<(Vec<f64>, Vec<Vec<f64>>), String>;
pub fn get_statistics(&self) -> DomainStats;
```

**Enables:** Identical UI components for all domains!

---

## Expected Code Metrics

### Current (Phase 3 Start)

```
core-rust/src/
├── solvers/
│   ├── ode.rs (existing)
│   └── mna_generic.rs (NEW) ..................... 500 lines
├── domains/
│   ├── electrical/
│   │   ├── components.rs ........................ 450 lines
│   │   ├── solver.rs ............................ 250 lines
│   │   └── mod.rs ............................... 250 lines
│   └── thermal/
│       ├── components.rs (NEW) .................. 450 lines
│       ├── solver.rs (NEW) ...................... 150 lines (reuses generic!)
│       └── mod.rs (NEW) ......................... 250 lines
──────────────────────────────────────────────────────
Total NEW code: ~2,000 lines
Without reuse, would need ~3,500 lines (40% savings!)
```

### After Phase 4 (Mechanical + Hydraulic + Pneumatic)

```
New domains:
├── mechanical/
│   └── Total ................................. ~1,000 lines
├── hydraulic/
│   └── Total ................................. ~1,000 lines
└── pneumatic/
    └── Total ................................. ~1,000 lines
──────────────────────────────────────────────────────
New code: ~3,000 lines

WITHOUT reuse: Would need ~7,500 lines
WITH reuse: Only ~3,000 lines
SAVINGS: 60% reduction (4,500 lines avoided!)
```

---

## Testing Strategy for Code Reuse

### Verify Generic Solver Works for All Domains

```rust
#[test]
fn test_generic_solver_electrical() { ... }

#[test]
fn test_generic_solver_thermal() { ... }

#[test]
fn test_generic_solver_mechanical() { ... }

#[test]
fn test_generic_solver_hydraulic() { ... }
```

Each test:
1. Creates GenericMnaSolver
2. Adds conductances (domain-specific values)
3. Adds flow sources (domain-specific values)
4. Solves and validates
5. Verifies results match theoretical predictions

---

## Future: Multi-Domain Coupling

Once all domains use the same generic solver, coupling becomes straightforward:

**Example: Electro-thermal-mechanical system**

```rust
// Create all solvers
let mut electrical_solver = ElectricalAnalyzer::new(3, 0.001);
let mut thermal_solver = ThermalAnalyzer::new(3, 0.001);
let mut mechanical_solver = MechanicalAnalyzer::new(3, 0.001);

// Solve sequentially with coupling
for step in 0..1000 {
    // 1. Electrical analysis
    electrical_solver.add_resistor(0, 1, 1000.0);
    electrical_solver.solve()?;
    let power = I² × R;  // Get power dissipation

    // 2. Thermal analysis (coupled from electrical)
    thermal_solver.add_heat_source(1, power);  // ← Coupling!
    thermal_solver.solve()?;
    let temperature = thermal_solver.get_temperature(1);

    // 3. Mechanical analysis (coupled from thermal)
    let thermal_expansion = temperature_coefficient × temperature;
    mechanical_solver.add_constraint(thermal_expansion);  // ← Coupling!
    mechanical_solver.solve()?;
}
```

**Result:** Natural, intuitive multi-domain simulation!

---

## Summary: Code Reuse Strategy

### Core Insight
**All physical domains are energy networks** with the same mathematical structure: `G × X = Y`

### Implementation
1. ✅ **Generic MNA Solver** - One solver for all domains
2. ✅ **Domain Components** - Define R, C, sources for each domain
3. ✅ **Domain Wrappers** - Map domain components to generic solver
4. ✅ **Unified Interface** - Same methods across all domains

### Benefits
- **60% code reduction** across multiple domains
- **Unified testing** - One solver validates all domains
- **Natural coupling** - Easy multi-domain integration
- **Fast implementation** - Add new domains in ~1 week

### Timeline
- **Phase 3:** Thermal (✅ In progress)
- **Phase 4:** Mechanical + Hydraulic + Pneumatic (~4 weeks)
- **Phase 5:** Chemical + Bond Graph unification (~2 weeks)
- **Phases 6-20:** Block diagrams, CAD, manufacturing tools

---

**Key Achievement:** Through unified abstraction and generic solvers, we build a comprehensive mechatronics platform in ~16 weeks instead of 48+ weeks (67% faster!).

