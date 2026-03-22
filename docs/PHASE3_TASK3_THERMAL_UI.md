# Phase 3 Task 3: Thermal Circuit Editor UI

**Date:** 2026-03-19
**Status:** IN PROGRESS
**Focus:** Visual interface for thermal circuit design and analysis

---

## Overview

**Phase 3 Task 3** implements the user interface for the thermal circuit simulator by creating a specialized circuit editor that reuses the generic NodeEditor component from the ui-framework.

This task leverages:
- ✅ Generic NodeEditor (from ui-framework) - reusable across all simulators
- ✅ Thermal solver (from Phase 3 Task 2) - backend computation
- ✅ Thermal components (from Phase 3 Task 1) - component definitions

### Key Design Principle

**Reuse the generic NodeEditor** with thermal-specific configurations rather than building a custom editor. This is consistent with the DRY principle and the architectural vision where one generic editor serves all simulator domains.

---

## Components Implemented

### 1. ThermalCircuitEditor (Main Component)

**File:** `packages/simulators/circuit-thermal/src/components/ThermalCircuitEditor.tsx` (400+ lines)

**Responsibilities:**
- Manages thermal circuit state (graph, components, connections)
- Provides UI for thermal circuit configuration
- Handles analysis triggers (steady-state and transient)
- Displays validation errors
- Shows analysis results

**Key Features:**

#### Component Palette
- **Passive Components**
  - Thermal Resistance (R_th)
  - Thermal Capacitance (C_th)

- **Active Components**
  - Heat Source (constant power dissipation)

- **Boundary Conditions**
  - Temperature Source (fixed temperature node)

- **Heat Transfer**
  - Convection (natural and forced)
  - Radiation (linearized model)
  - Heat Pipe (high-efficiency transfer)
  - TIM - Thermal Interface Material

#### Analysis Controls
- Ambient temperature setting (default: 25°C)
- Analysis type selection (steady-state or transient)
- Transient parameters (duration, time step)

#### Validation
```typescript
validateCircuit(): string[]
```

Checks:
- Minimum 2 nodes required
- At least one heat source present
- Thermal resistance values positive and reasonable (< 1000 K/W)
- Thermal capacitance values positive
- Convection coefficients and areas positive
- No isolated circuit segments

#### Results Display
Shows:
- Node temperatures in table format
- Heat flow calculations
- For transient: time steps and final steady-state

### 2. Component Palette Configuration

```typescript
const THERMAL_NODE_TYPES = new Map<string, NodeTypeDefinition>([
  ['ThermalResistance', { name: 'Thermal Resistance', color: '#FF6B6B', ... }],
  ['ThermalCapacitance', { name: 'Thermal Capacitance', color: '#4ECDC4', ... }],
  ['HeatSource', { name: 'Heat Source', color: '#FFD93D', ... }],
  ['TemperatureSource', { name: 'Temperature Source', color: '#6BCB77', ... }],
  ['Convection', { name: 'Convection', color: '#A8DADC', ... }],
  ['Radiation', { name: 'Radiation', color: '#F4A261', ... }],
  ['HeatPipe', { name: 'Heat Pipe', color: '#E76F51', ... }],
  ['ThermalInterfaceMaterial', { name: 'TIM', color: '#2A9D8F', ... }],
])
```

**Color Scheme:**
- Red (#FF6B6B): Passive resistive
- Teal (#4ECDC4): Passive capacitive
- Yellow (#FFD93D): Active sources
- Green (#6BCB77): Boundary conditions
- Light blue (#A8DADC): Convection
- Orange (#F4A261): Radiation
- Dark red (#E76F51): Heat pipes
- Dark teal (#2A9D8F): TIM

### 3. Styling (CSS Module)

**File:** `ThermalCircuitEditor.module.css` (280+ lines)

**Layout:**
```
┌─────────────────────────────────────────┐
│           Toolbar (Config)              │ ← Ambient temp, analysis type, buttons
├──────────┬──────────────────────────────┤
│          │                              │
│ Palette  │   NodeEditor Canvas          │ ← Main editing area
│          │                              │
│ (8 comp) │                              │
│          ├──────────────────────────────┤
│          │     Results Panel            │ ← Temperature table, stats
└──────────┴──────────────────────────────┘
```

**Key Sections:**
- **Toolbar** (top): Configuration controls, analysis buttons, results preview
- **Sidebar** (left): Component palette (drag-to-add)
- **Editor Canvas** (center): NodeEditor rendering thermal circuit
- **Results Panel** (bottom-right): Analysis results table

---

## Usage Example

```typescript
import { ThermalCircuitEditor } from '@tupan/simulators/circuit-thermal';

export function App() {
  const handleAnalysisComplete = (results) => {
    console.log('Temperatures:', results.temperatures);
    console.log('Analysis type:', results.analysisType);
  };

  return (
    <ThermalCircuitEditor
      onAnalysisComplete={handleAnalysisComplete}
      onCircuitChange={(graph) => console.log('Circuit updated')}
    />
  );
}
```

---

## Integration Points

### 1. NodeEditor Integration
- Uses generic NodeEditor from `@tupan/ui-framework`
- Passes thermal-specific node types
- Receives graph change callbacks
- Supports drag-and-drop, zoom, pan, selection

### 2. Thermal Solver Integration
- Calls ThermalAnalyzer via WASM bridge (to be implemented)
- Passes circuit components and heat sources
- Receives temperatures and heat flows
- Handles both steady-state and transient

### 3. Data Flow

```
User Input
    ↓
ThermalCircuitEditor State
    ↓
Circuit Validation
    ↓
[Validation Error?] → Show errors to user
    ↓
Build component/source arrays
    ↓
WASM Bridge → ThermalAnalyzer (Rust)
    ↓
Solve G_th × T = Q̇
    ↓
Extract temperatures
    ↓
Display Results Panel
    ↓
Callback: onAnalysisComplete(results)
```

---

## Next Steps (Task 4-6)

### Task 4: Thermal Visualization
- Temperature heatmap visualization
- Time-domain transient plots
- Component-wise power dissipation breakdown
- Statistics and analysis metrics

### Task 5: Circuit Testing UI
- Pre-built circuit templates (CPU cooling, heat exchanger, etc.)
- Circuit loading/saving
- Export to different formats
- Thermal circuit library

### Task 6: Comprehensive Validation
- Test against known thermal problems
- Benchmark performance (100+ node networks)
- Edge case testing (extreme parameters)
- User interface testing and refinement

---

## Architecture Alignment

This implementation demonstrates the **reuse-first** principle:

**Electrical Circuit Editor** (existing)
```
├─ NodeEditor (generic) ← Shared
├─ Electrical-specific node types
└─ Electrical solver integration
```

**Thermal Circuit Editor** (this task)
```
├─ NodeEditor (generic) ← SAME component
├─ Thermal-specific node types
└─ Thermal solver integration
```

**Future: All Other Domain Editors**
```
├─ NodeEditor (generic) ← SAME component
├─ Domain-specific node types
└─ Domain solver integration
```

This ensures:
- ✅ Single implementation of editor logic
- ✅ Consistent UI/UX across all simulators
- ✅ Easy to maintain and enhance
- ✅ New domains can leverage existing UI

---

## Component Properties & Parameters

### ThermalResistance
```typescript
parameters: {
  r_th: number;  // Thermal resistance [K/W]
}
```

### ThermalCapacitance
```typescript
parameters: {
  c_th: number;  // Thermal capacitance [J/K]
}
```

### HeatSource
```typescript
parameters: {
  power: number;  // Heat generation [W]
}
```

### TemperatureSource
```typescript
parameters: {
  temperature: number;  // Fixed temperature [°C]
}
```

### Convection
```typescript
parameters: {
  h: number;      // Heat transfer coefficient [W/(m²·K)]
  area: number;   // Surface area [m²]
}
```

### Radiation
```typescript
parameters: {
  emissivity: number;  // Emissivity [0-1]
  area: number;        // Surface area [m²]
}
```

### HeatPipe
```typescript
parameters: {
  diameter: number;  // Pipe diameter [m]
  length: number;    // Pipe length [m]
}
```

### ThermalInterfaceMaterial (TIM)
```typescript
parameters: {
  conductivity: number;  // Thermal conductivity [W/(m·K)]
  thickness: number;     // Thickness [m]
  area: number;          // Contact area [m²]
}
```

---

## Validation Rules

| Rule | Check | Error Message |
|------|-------|---------------|
| Min nodes | >= 2 | "Circuit must have at least 2 nodes" |
| Heat source | >= 1 HeatSource or TemperatureSource | "Circuit must have at least one heat source" |
| Resistance | 0 < R_th < 1000 K/W | "Thermal resistance must be positive" / "...suspiciously high" |
| Capacitance | C_th > 0 | "Thermal capacitance must be positive" |
| Convection | h > 0, area > 0 | "Convection coefficient/area must be positive" |
| Connectivity | No isolated nodes | "Circuit has N isolated nodes" |

---

## State Management

**Local State:**
- `graph` - current thermal circuit graph
- `analysisState` - 'idle' \| 'analyzing' \| 'complete'
- `analysisResults` - ThermalAnalysisResults object
- `ambientTemperature` - reference temperature for convection [°C]
- `analysisType` - 'steady-state' or 'transient'
- `transientDuration` - total simulation time [s]
- `transientTimeStep` - integration step size [s]

**Callbacks:**
- `onGraphChange(graph)` - called when circuit topology changes
- `onAnalysisComplete(results)` - called when analysis finishes
- `validateCircuit()` - validation check before analysis

---

## Future Enhancements

### Phase 3 Task 4-6

1. **Visualization Improvements**
   - Animated transient response playback
   - Heat flow vector field display
   - Component tooltip with parameters
   - Zoom into specific circuit regions

2. **Circuit Library**
   - Save/load circuits
   - Template circuits (CPU cooling, heat sink, radiator)
   - Circuit examples from ASHRAE handbook
   - Community circuit sharing

3. **Advanced Analysis**
   - Frequency-domain analysis (sinusoidal heat sources)
   - Sensitivity analysis (parameter variations)
   - Optimization (find best heat sink size)
   - Monte Carlo parameter variation

4. **Integration**
   - Import from electrical simulator (I²R losses)
   - Multi-domain coupling (electrical → thermal)
   - Export to CAD tools
   - Generate thermal reports

---

## Testing Strategy

### Unit Tests
- Component validation rules
- Parameter range checking
- Circuit topology validation
- State management

### Integration Tests
- NodeEditor integration
- WASM solver communication
- Analysis result correctness
- UI state synchronization

### E2E Tests
- Create simple circuit (resistor + source)
- Run analysis
- Verify temperature calculation
- Check results table accuracy
- Test transient analysis

---

## Summary

**Phase 3 Task 3 (In Progress) will deliver:**

1. ✅ ThermalCircuitEditor component (reuses generic NodeEditor)
2. ✅ Thermal component palette (8 component types)
3. ✅ Validation engine (9 validation rules)
4. ✅ Analysis interface (steady-state and transient controls)
5. ✅ Results display (temperature table and statistics)
6. ✅ Responsive styling (mobile-friendly layout)

**Next tasks (3-6):**
- Task 4: Thermal visualization (heatmaps, plots)
- Task 5: Circuit library and templates
- Task 6: Comprehensive testing and validation

**Estimated completion:** 2-3 weeks (Tasks 3-6 combined)

---

**Status:** In progress - Core UI component complete, pending integration with WASM solver and visualization enhancements.
