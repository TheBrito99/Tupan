# Bond Graph Visual Editor - Tutorial

A comprehensive guide to creating, simulating, and analyzing bond graphs in the Tupan platform.

---

## Getting Started

### Launch the Editor

```typescript
import { BondGraphEditor } from '@tupan/ui-framework/components/BondGraphEditor';
import init from '@tupan/core-rust';

export function App() {
  const [wasmModule, setWasmModule] = useState(null);

  useEffect(() => {
    init().then(setWasmModule);
  }, []);

  return (
    <BondGraphEditor
      initialName="My Bond Graph"
      wasmModule={wasmModule}
    />
  );
}
```

### Editor Layout

```
┌─────────────────────────────────────────────────────────┐
│ Toolbar: [▶ Simulate] [🗑 Delete] [Clear All]          │
│ Elements: 0 | Bonds: 0 | Causality: 0/0                │
├──────────┬────────────────────────────┬────────────────┤
│ Palette  │ Canvas                     │ Properties     │
│          │ (Grid background)          │ + Analysis     │
│ • Se     │ [Element symbols]          │                │
│ • Sf     │ [Bond lines]               │                │
│ • C      │ (Empty initially)          │                │
│ • I      │                            │                │
│ • R      │                            │                │
│ • TF     │                            │                │
│ • GY     │                            │                │
│ • J0     │                            │                │
│ • J1     │                            │                │
└──────────┴────────────────────────────┴────────────────┘
```

---

## Example 1: RC Circuit

### Step 1: Add Elements

1. **Add Voltage Source (Se)**
   - Click "Se" in left palette
   - Click on canvas to place element
   - Element appears at random position on canvas
   - Status shows: "Elements: 1 | Bonds: 0"

2. **Add Resistor (R)**
   - Click "R" in palette
   - Click on canvas
   - Now: "Elements: 2 | Bonds: 0"

3. **Add Capacitor (C)**
   - Click "C" in palette
   - Click on canvas
   - Now: "Elements: 3 | Bonds: 0"

4. **Add 1-Junction**
   - Click "J1" in palette
   - Click on canvas
   - Now: "Elements: 4 | Bonds: 0"

### Step 2: Draw Bonds

1. **Se → J1 (Effort source to junction)**
   - Hold Alt and click on Se element
   - Cursor changes to crosshair
   - Drag line appears following mouse
   - Release over J1
   - Bond created: "Elements: 4 | Bonds: 1"

2. **J1 → R (Junction to resistor)**
   - Alt+click on J1
   - Drag to R element
   - Release: "Elements: 4 | Bonds: 2"

3. **R → C (Resistor to capacitor)**
   - Alt+click on R
   - Drag to C element
   - Release: "Elements: 4 | Bonds: 3"

4. **C → J1 (Complete the circuit)**
   - Alt+click on C
   - Drag back to J1
   - Release: "Elements: 4 | Bonds: 4"

### Step 3: Configure Parameters

1. **Select Voltage Source (Se)**
   - Click on Se element
   - Right panel shows properties
   - Set Effort = 5.0 (volts)
   - Press Tab or click elsewhere to confirm

2. **Select Resistor (R)**
   - Click on R element
   - Set Resistance = 1000 (ohms)

3. **Select Capacitor (C)**
   - Click on C element
   - Set Capacitance = 1e-6 (farads)
   - Leave Initial Charge = 0

### Step 4: Run Simulation

1. **Click "▶ Simulate" button**
   - Solver runs transient analysis
   - Duration: 1.0 second
   - Time step: 0.001 seconds
   - Solver: RK45 (adaptive)

2. **View Results in Analysis Panel**
   - Causality: "4/4" (all bonds assigned)
   - Transient Analysis results show:
     - Duration: 1.000 s
     - Time Steps: 1000
     - Power Conservation Error: < 1e-10
   - Status: "✓ Simulation completed successfully"

### Step 5: Interpret Results

**RC Circuit Behavior:**
- Voltage source drives current through resistor
- Capacitor charges exponentially
- Time constant τ = RC = 1000 × 1e-6 = 0.001 s
- After ~5τ = 0.005 s, capacitor reaches steady state
- Final voltage across C = 5V (source voltage)

**Power Conservation:**
- Input power: P_in = V × I (from source)
- Dissipation in R: P_R = I² × R = V²/R
- Energy storage in C: E = ½CV²
- Total energy is conserved: ∫P_in dt = ∫P_R dt + E_C
- Relative error < 1e-16 (numerical precision limit)

---

## Example 2: Thermal Circuit

### Scenario: Component Cooling

A CPU with power dissipation must be cooled via heat sink and forced convection.

### Step 1: Create the System

1. **Add Heat Source (Sf)**
   - This represents steady-state power dissipation
   - Set Flow = 100 (watts)

2. **Add Thermal Resistance (R)**
   - Interface resistance between component and heat sink
   - Set Resistance = 0.1 (K/W)

3. **Add Thermal Capacitance (C)**
   - Thermal mass of the heat sink
   - Set Capacitance = 1000 (J/K)

4. **Add Environment Temperature Source (Se)**
   - Set Effort = 293.15 (20°C in Kelvin)

5. **Add Second Thermal Resistance (R)**
   - Heat sink to environment
   - Set Resistance = 0.05 (K/W)

6. **Junctions (J0)**
   - For temperature nodes
   - Use 2 junctions (isothermal nodes)

### Step 2: Bond Connections

```
Heat Source (Sf=100W) ──→ R₁ (0.1 K/W) ──→ J0 ──→ R₂ (0.05 K/W) ──→ Env (Se=293.15K)
                                            ↑
                                            └── C (1000 J/K)
```

### Step 3: Simulate

- Run simulation for 10 seconds
- Observe temperature rise over time

**Expected Results:**
- Transient: Temperature rises exponentially
- Steady-state: T = T_ambient + Q × R_total
  - T_ss = 293.15 + 100 × (0.1 + 0.05) = 293.15 + 15 = 308.15 K (35°C)
- Time constant: τ = C × R_eq ≈ 1000 × 0.05 = 50 seconds

---

## Example 3: Motor-Pump System (Multi-Domain)

### Scenario: Hydraulic Pump Driven by Electric Motor

Demonstrates coupling between electrical and mechanical domains.

### Electrical Part
- Voltage source: 24V DC
- Motor resistance: 10Ω
- Motor inductance: 0.1H

### Mechanical Part
- Pump displacement: 0.5 cc/rev
- Load inertia: 0.01 kg⋅m²
- Load viscous friction: 0.1 N⋅s/m

### Implementation

1. **Electrical Circuit**
   ```
   Se (24V) → R (10Ω) → J1 → L (0.1H) → J1 → Motor (TF, ratio=0.5)
   ```

2. **Mechanical Circuit**
   ```
   Motor (GY) → J1 → I (0.01kg⋅m²) → J1 → R (0.1 N⋅s/m) → Ground
   ```

3. **Cross-Domain Connection**
   - Use Gyrator (GY) or Transformer (TF) to couple electrical to mechanical
   - Ratio: 0.5 rad/s per volt (motor constant)

4. **Simulate**
   - Run for 2 seconds
   - Motor accelerates from rest
   - Current decreases as motor speeds up (back-EMF)
   - Mechanical load reaches steady-state speed

---

## User Interface Guide

### Keyboard Shortcuts

| Action | Shortcut | Notes |
|--------|----------|-------|
| Draw Bond | Alt + Click + Drag | Hold Alt to start, drag, release on target |
| Delete Element | Select + Press Delete | Or use 🗑 button in toolbar |
| Select Element | Click | Click on element to select |
| Zoom In | Scroll ↑ | Zoom up to 3x |
| Zoom Out | Scroll ↓ | Zoom down to 0.5x |
| Pan | Click + Drag (no Alt) | Drag on empty canvas to pan |
| Simulate | Ctrl + Enter or Click button | Run analysis |

### Mouse Behavior

| State | Cursor | Action |
|-------|--------|--------|
| Normal | default | Hover over elements |
| Over Element | default | Ready to select |
| Dragging Element | grab | Element moves with mouse |
| Drawing Bond | crosshair | Drag line to target |
| Over Target | crosshair | Ready to create bond |

### Toolbar Buttons

| Button | Function | Shortcut | Disabled When |
|--------|----------|----------|----------------|
| ▶ Simulate | Run analysis | Ctrl+Enter | No elements, still running |
| 🗑 Delete | Delete selected element | Delete | Nothing selected |
| Clear All | Remove everything | - | Never (confirmation ready) |

---

## Properties Panel Guide

### Element Type-Specific Parameters

#### **Se (Effort Source)**
- Effort: Voltage/Temperature/Force (default: 1.0)
- Units: V/K/N depending on domain

#### **Sf (Flow Source)**
- Flow: Current/Heat flow/Velocity (default: 1.0)
- Units: A/W/m-s depending on domain

#### **R (Resistor)**
- Resistance: Electrical/Thermal/Mechanical (default: 1.0)
- Units: Ω / K-W / N-s-m

#### **C (Capacitor)**
- Capacitance: Electrical/Thermal/Mechanical (default: 1.0)
- Initial Charge: 0.0 (for transient analysis)
- Units: F / J-K / m-N

#### **I (Inductor)**
- Inertance: Electrical/Mechanical (default: 1.0)
- Initial Momentum: 0.0
- Units: H / kg

#### **TF (Transformer)**
- Ratio: Coupling ratio (default: 1.0)
- Example: 2.0 = 2:1 voltage step-down

#### **GY (Gyrator)**
- Ratio: Cross-domain coupling (default: 1.0)
- Example: 0.5 = motor constant

#### **J0 (0-Junction)**
- Name: Optional (for documentation)
- All bonds have equal effort (Kirchhoff voltage law equivalent)

#### **J1 (1-Junction)**
- Name: Optional
- All bonds have equal flow (Kirchhoff current law equivalent)

---

## Analysis Panel Guide

### Causality Assignment

**Status Indicators:**
- ✓ Success: All bonds assigned causality (green)
- ✗ Failure: Causality conflict detected (red)

**Summary:**
- Assigned: Number of bonds with causality (EffortOut or FlowOut)
- Unassigned: Number of bonds pending causality
- Total: Total bonds in graph

**Example:**
- "Causality: 8/8" = All 8 bonds have valid causality
- "Causality: 4/8" = 4 bonds assigned, 4 still unassigned

### Simulation Results

**Transient Analysis:**
- Duration: Total simulation time (seconds)
- Time Steps: Number of integration steps
- Current Time: Simulation progress
- State History: Number of recorded states and variables

**Power Conservation (Critical!)**
- Shows relative error in energy conservation
- Ideal: < 1e-10 (floating-point precision)
- Good: < 1e-6 (excellent numerical accuracy)
- Acceptable: < 1e-3 (good for practical use)
- Poor: > 1e-3 (check model or parameters)

**Example:**
```
Power Conservation Error: 1.48e-16
```
This indicates perfect energy conservation (numerical rounding only)

---

## Advanced Features

### Bond Graph Validation

The editor validates your bond graph for common errors:

1. **Disconnected Elements**
   - Warning: Element has no bonds
   - Suggests: Connect to circuit or remove

2. **Source Without Output**
   - Warning: Source (Se/Sf) has no outgoing bonds
   - Suggests: Connect to at least one element

3. **Floating Nodes**
   - Warning: Element not connected to complete circuit
   - Suggests: Complete the topology

### Import/Export

**Export to JSON:**
```json
{
  "name": "RC Circuit",
  "timestamp": "2026-03-19T12:00:00Z",
  "elements": [
    { "id": "se_0", "type": "Se", "x": 100, "y": 100, "parameters": {"effort": 5} },
    { "id": "r_1", "type": "R", "x": 200, "y": 100, "parameters": {"resistance": 1000} },
    { "id": "c_2", "type": "C", "x": 300, "y": 100, "parameters": {"capacitance": 1e-6} }
  ],
  "bonds": [
    { "id": "bond_0", "from": "se_0", "to": "r_1", "causality": "EffortOut" },
    { "id": "bond_1", "from": "r_1", "to": "c_2", "causality": "EffortOut" }
  ]
}
```

**Import from JSON:**
1. Export existing circuit
2. Modify as needed (add parameters, change layout)
3. Load modified JSON
4. All elements and bonds restore with correct parameters

---

## Common Mistakes & Solutions

### Mistake 1: Junction-to-Junction Bond
**Problem:** Can't create bond between two junctions
**Reason:** Physically invalid in bond graph theory
**Solution:** Insert an element (R, C, or I) between junctions

### Mistake 2: Floating Elements
**Problem:** Element has no bonds
**Reason:** Forgot to connect
**Solution:** Use Alt+Click to draw bonds from/to element

### Mistake 3: Source Disconnected
**Problem:** Source (Se/Sf) has no outgoing bonds
**Reason:** Source must drive the system
**Solution:** Connect source to at least one other element

### Mistake 4: Wrong Parameter Units
**Problem:** Values seem wrong (too large or small)
**Reason:** Mismatch with physical units
**Solution:** Check domain (electrical vs thermal vs mechanical) and use consistent units

### Mistake 5: Poor Power Conservation
**Problem:** Power error > 1e-3
**Reason:** Stiff system or bad parameters
**Solution:**
- Check element values (no extreme ratios)
- Reduce time step
- Use RK45 solver (adaptive)

---

## Troubleshooting

### Issue: Causality Won't Assign
- Ensure all elements are connected
- Check for floating elements
- Verify no duplicate bonds
- Try: Clear and rebuild circuit

### Issue: Simulation Takes Too Long
- Reduce duration (e.g., 1s instead of 10s)
- Increase time step (e.g., 0.01s instead of 0.001s)
- Use RK4 instead of RK45 (fixed step)

### Issue: Power Conservation Error Too Large
- Check element parameter values
- Reduce time step (smaller = more accurate)
- Verify no extreme parameter ratios (R_max/R_min < 1e6)

### Issue: Can't Draw Bond to Element
- Ensure you Alt+clicked to start bond
- Make sure target is not the same element
- Verify target can form valid bond (not J0↔J1 directly)

---

## Next Steps

### Explore Advanced Features
- [ ] Multi-domain coupling (electrical ↔ thermal)
- [ ] Nonlinear elements
- [ ] Modulated transformers
- [ ] Multi-body systems

### Create Examples
- [ ] Power electronics thermal model
- [ ] Motor control system
- [ ] Hydraulic actuator
- [ ] Thermal management network

### Learn Bond Graph Theory
- [ ] SCAP causality assignment algorithm
- [ ] Energy conservation verification
- [ ] Domain transformations
- [ ] Linear and nonlinear analysis

---

## References

1. **Bond Graph Theory**
   - Paynter, H. (1961). Analysis and Design of Engineering Systems
   - Karnopp, D. et al. (2012). System Dynamics: Modeling and Simulation of Mechatronic Systems

2. **Numerical Methods**
   - Runge-Kutta algorithms
   - Adaptive step control
   - Energy conservation in ODE solvers

3. **Engineering Domains**
   - Electrical circuit analysis
   - Thermal network modeling
   - Mechanical system dynamics
   - Hydraulic systems

---

**Happy simulating! 🚀**

For more information, see:
- [Phase 49 Completion Report](./PHASE_49_COMPLETION.md)
- [Bond Graph Theory Documentation](./docs/DOMAIN_MODELS.md)
- [API Reference](./docs/API_REFERENCE.md)
