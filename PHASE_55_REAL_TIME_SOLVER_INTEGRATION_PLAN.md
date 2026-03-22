# Phase 55: Real-Time Solver Integration - Implementation Plan

**Goal:** Integrate Phase 54 optimizations with ODE solver for live bond graph simulation
**Duration:** 2-3 weeks
**Status:** Planning & Design Phase

---

## Executive Summary

Phase 55 bridges the gap between bond graph causality optimization (Phase 54) and real-time simulation. Users will:

1. **Build** a bond graph in the editor
2. **Optimize** causalities using Phase 54 tools
3. **Simulate** with automatic solver selection based on stiffness
4. **Visualize** results in real-time on the canvas
5. **Interact** with simulations (pause, reset, vary parameters)

**Key Features:**
- Real-time ODE solving (<16ms per step for 60 FPS)
- Automatic solver selection (RK4 → RK45 → BDF → IDA)
- Live parameter adjustment during simulation
- State trajectory visualization
- Performance profiling integration

---

## Architecture

### Data Flow: Bond Graph → Solver → Canvas

```
User builds bond graph
    ↓
Phase 54 Optimization
    ├─ Detect issues (loops, derivatives, feedback)
    ├─ Suggest fixes (break points, reordering)
    └─ Optimize causalities
    ↓
Phase 55 Solver Integration
    ├─ Extract state vector from causalities
    ├─ Build system of equations (ODE or DAE)
    ├─ Select solver based on stiffness
    ├─ Initialize solver with initial conditions
    └─ Start real-time simulation loop
    ↓
Simulation Loop (60 FPS target)
    ├─ Step solver (dt ≈ 16ms)
    ├─ Extract state values
    ├─ Update visualization
    ├─ Handle user interactions
    └─ Repeat
    ↓
Canvas Visualization
    ├─ Node state values (voltage, temperature, velocity)
    ├─ Bond power flow (effort × flow)
    ├─ Energy dissipation (in resistors)
    └─ Plots of key variables over time
```

---

## Implementation Tasks

### Task 1: Solver Abstraction Layer
**Files:** `packages/core-ts/src/wasm-bridge/solver.ts` (new, 300 lines)

Create unified TypeScript interface for all solver types:

```typescript
export interface SolverConfig {
  type: 'RK4' | 'RK45' | 'BDF' | 'IDA';
  dt: number;              // Time step (seconds)
  maxStep?: number;        // Max allowed step
  tolerance?: number;      // Relative tolerance
  absoluteTolerance?: number;
}

export interface SolverState {
  time: number;
  state: Float64Array;     // Current state vector
  derivatives: Float64Array;
  error: number;           // Error estimate
}

export interface SimulationResult {
  success: boolean;
  time: number;
  state: Float64Array;
  error?: string;
}

export abstract class Solver {
  abstract initialize(initialState: Float64Array): void;
  abstract step(dt: number): SimulationResult;
  abstract getState(): SolverState;
  abstract reset(): void;
}
```

**Implementation:**
- RK4: Simple explicit 4th-order Runge-Kutta (baseline, fast)
- RK45: Dormand-Prince adaptive step (variable dt)
- WASM bindings for BDF/IDA (from Rust via Phase 47)

**Tests:**
- Solver interface completeness
- Step validation (dt, state progression)
- Error estimation accuracy
- Initialization correctness

---

### Task 2: Causality → State Vector Extraction
**Files:** `packages/core-ts/src/wasm-bridge/state-extraction.ts` (new, 200 lines)

Convert bond graph causalities to ODE state vector:

```typescript
export interface StateMapping {
  elements: Map<string, ElementState>;
  bonds: Map<string, BondState>;
  stateVector: Float64Array;
  derivativeVector: Float64Array;
}

export interface ElementState {
  elementId: string;
  elementType: string;
  stateIndex: number;      // Index in state vector
  stateVariable: 'q' | 'p' | 'none'; // Charge/momentum or neither
  initialValue: number;
}

export class StateExtractor {
  /**
   * Extract initial state from bond graph causalities
   * C/I elements → state variables (q, p)
   * R/Se/Sf → algebraic (no state)
   * Junctions → constraints
   */
  extractStateVector(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): StateMapping {
    const mapping = new StateMapping();

    // Find all storage elements (C, I)
    const storageElements = elements.filter(e => e.type === 'C' || e.type === 'I');

    // Assign state indices
    let stateIndex = 0;
    for (const element of storageElements) {
      if (element.type === 'C') {
        mapping.elements.set(element.id, {
          elementId: element.id,
          elementType: 'C',
          stateIndex,
          stateVariable: 'q',
          initialValue: 0, // Could be loaded from element.parameters
        });
      } else if (element.type === 'I') {
        mapping.elements.set(element.id, {
          elementId: element.id,
          elementType: 'I',
          stateIndex,
          stateVariable: 'p',
          initialValue: 0,
        });
      }
      stateIndex++;
    }

    // Build state vector
    mapping.stateVector = new Float64Array(stateIndex);
    mapping.derivativeVector = new Float64Array(stateIndex);

    return mapping;
  }

  /**
   * Verify causality validity for state extraction
   */
  validateCausalities(
    mapping: StateMapping,
    causalities: Map<string, CausalityStatus>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check: All C elements have integral causality
    for (const [id, elem] of mapping.elements) {
      if (elem.stateVariable === 'q') {
        const bonds = /* find bonds connected to this C */;
        // Should have causality indicating effort input
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
```

**Algorithm:**
1. Find all C (capacitance) and I (inertance) elements
2. Assign state vector indices to each
3. Initialize state with element parameters or defaults
4. Validate causality enables integration (not differentiation)
5. Create mapping for solver ↔ element updates

**Tests:**
- RC circuit → [q_c] state vector
- LC circuit → [q_c, p_l] state vector
- Complex multi-domain → correct dimension
- Causality validation (reject improper causalities)

---

### Task 3: ODE System Builder
**Files:** `packages/core-ts/src/wasm-bridge/ode-builder.ts` (new, 250 lines)

Convert bond graph to system of ODEs:

```typescript
export interface ODESystem {
  stateCount: number;
  compute(t: number, state: Float64Array): Float64Array;
  getAlgebraicVariables(t: number, state: Float64Array): Map<string, number>;
}

export class ODEBuilder {
  /**
   * Build ODE system from bond graph
   * For each state variable q_i (charge on capacitor C_i):
   *   dq_i/dt = flow through C_i (from causality)
   *
   * Flow is determined by:
   * - Input sources (Se, Sf)
   * - Resistor dissipation (V/R or Q/Rth)
   * - Feedback from other state variables
   */
  buildODESystem(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>,
    stateMapping: StateMapping
  ): ODESystem {
    // Pre-compute derivative calculation for efficiency
    const derivativeComputation = this.precomputeDerivatives(
      elements,
      bonds,
      causalities,
      stateMapping
    );

    return new ODESystem({
      stateCount: stateMapping.stateVector.length,
      compute: (t: number, state: Float64Array) => {
        const derivatives = new Float64Array(stateMapping.stateVector.length);

        // For each state variable (charge q or momentum p)
        for (const [elementId, elemState] of stateMapping.elements) {
          const element = elements.find(e => e.id === elementId);
          if (!element) continue;

          if (elemState.stateVariable === 'q') {
            // dq/dt = i (flow through capacitor)
            derivatives[elemState.stateIndex] = this.computeCapacitorFlow(
              element,
              state,
              stateMapping,
              causalities
            );
          } else if (elemState.stateVariable === 'p') {
            // dp/dt = f (force on inductor)
            derivatives[elemState.stateIndex] = this.computeInductorForce(
              element,
              state,
              stateMapping,
              causalities
            );
          }
        }

        return derivatives;
      },
      getAlgebraicVariables: (t: number, state: Float64Array) => {
        const algebraic = new Map<string, number>();

        // Compute voltages, currents, temperatures, etc.
        // Using causality to determine which are inputs vs outputs

        return algebraic;
      },
    });
  }

  private computeCapacitorFlow(
    element: EditorElement,
    state: Float64Array,
    stateMapping: StateMapping,
    causalities: Map<string, CausalityStatus>
  ): number {
    // Find bonds connected to this capacitor
    // Using causality, determine which bond has flow input
    // Extract current value from state or compute from other elements

    return 0; // Placeholder
  }

  private computeInductorForce(
    element: EditorElement,
    state: Float64Array,
    stateMapping: StateMapping,
    causalities: Map<string, CausalityStatus>
  ): number {
    // Similar to capacitor but for force/voltage

    return 0; // Placeholder
  }

  private precomputeDerivatives(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>,
    stateMapping: StateMapping
  ) {
    // Cache computation graph to speed up derivative calculation
    // Avoid re-computing dependencies every step

    return {};
  }
}
```

**Key Insight:** Causality determines the structure of the ODE:
- If C has **integral causality** → dq/dt = f (flow is input)
- If C has **derivative causality** → e = dq/dt (problematic!)

---

### Task 4: Solver Selection Engine
**Files:** `packages/core-ts/src/wasm-bridge/solver-selector.ts` (new, 200 lines)

Automatic solver selection based on stiffness (from Phase 54):

```typescript
export class SolverSelector {
  selectSolver(stiffness: StiffnessRating, systemSize: number): SolverConfig {
    // Decision tree:
    if (stiffness.classification === 'non-stiff') {
      return {
        type: 'RK4',
        dt: 0.001,  // 1ms steps
        maxStep: 0.01,
      };
    } else if (stiffness.classification === 'mildly-stiff') {
      return {
        type: 'RK45',
        dt: 0.001,
        tolerance: 1e-5,
        maxStep: 0.01,
      };
    } else if (stiffness.classification === 'stiff') {
      return {
        type: 'BDF',
        dt: 0.001,
        tolerance: 1e-6,
        maxStep: 0.01,
      };
    } else {
      // very-stiff
      return {
        type: 'IDA',
        dt: 0.001,
        tolerance: 1e-8,
        absoluteTolerance: 1e-10,
        maxStep: 0.01,
      };
    }
  }

  /**
   * Estimate time step for real-time simulation
   * Want 60 FPS (16.67ms per frame)
   * Use 4-10 solver steps per frame
   */
  estimateTimeStep(
    stiffness: StiffnessRating,
    fastestTimeConstant: number,
    targetFPS: number = 60
  ): number {
    const frameTime = 1 / targetFPS; // ~16.67ms
    const stepsPerFrame = 8;
    const dt = frameTime / stepsPerFrame;

    // Ensure dt is much smaller than fastest time constant
    const maxSafedt = fastestTimeConstant / 10;

    return Math.min(dt, maxSafedt);
  }
}
```

**Strategy:**
- Non-stiff: RK4 (simplest, fastest)
- Mildly-stiff: RK45 (adaptive, accurate)
- Stiff: BDF (implicit, stable for stiff systems)
- Very-stiff: IDA (DAE solver, highest accuracy)

---

### Task 5: Real-Time Simulation Engine
**Files:** `packages/ui-framework/src/components/BondGraphEditor/SimulationEngine.ts` (new, 400 lines)

Main simulation loop with real-time capabilities:

```typescript
export interface SimulationConfig {
  initialConditions: Map<string, number>;  // Element id → initial value
  duration: number;                        // Simulation end time (seconds)
  targetFPS: number;                       // Display refresh rate (60)
  interactive: boolean;                    // Allow parameter changes during sim
  recordHistory: boolean;                  // Store full trajectory
}

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  currentTime: number;
  stepCount: number;
  executionTime: number;
  state: Float64Array;
  energy: number;
  errorEstimate: number;
}

export class SimulationEngine {
  private solver: Solver;
  private odeSystem: ODESystem;
  private config: SimulationConfig;
  private state: SimulationState;
  private history: SimulationSnapshot[];
  private animationFrameId: number | null = null;

  constructor(
    odeSystem: ODESystem,
    solver: Solver,
    config: SimulationConfig
  ) {
    this.odeSystem = odeSystem;
    this.solver = solver;
    this.config = config;

    this.state = {
      isRunning: false,
      isPaused: false,
      currentTime: 0,
      stepCount: 0,
      executionTime: 0,
      state: new Float64Array(odeSystem.stateCount),
      energy: 0,
      errorEstimate: 0,
    };

    this.history = [];
  }

  /**
   * Start real-time simulation
   * Uses requestAnimationFrame for smooth 60 FPS visualization
   */
  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.state.stepCount = 0;

    const startTime = performance.now();
    const simulationStartTime = Date.now();

    const step = (frameTime: number) => {
      if (!this.state.isRunning) return;

      const wallClockTime = performance.now() - startTime;
      const frameTimeMs = 16.67; // 60 FPS

      // Execute multiple solver steps to reach wall-clock time
      // This keeps simulation in sync with display
      while (this.state.currentTime < wallClockTime / 1000 && this.state.isRunning) {
        const result = this.solver.step(0.001); // 1ms steps

        if (!result.success) {
          console.error('Solver failed:', result.error);
          this.stop();
          return;
        }

        this.state.currentTime += 0.001;
        this.state.stepCount++;
        this.state.errorEstimate = result.error || 0;

        // Optionally record history
        if (this.config.recordHistory) {
          this.history.push({
            time: this.state.currentTime,
            state: new Float64Array(result.state),
          });
        }

        // Stop at duration
        if (this.state.currentTime >= this.config.duration) {
          this.stop();
          return;
        }
      }

      this.state.executionTime = performance.now() - startTime;
      this.animationFrameId = requestAnimationFrame(step);
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  pause(): void {
    this.state.isPaused = true;
  }

  resume(): void {
    if (this.state.isRunning) {
      this.state.isPaused = false;
      this.start();
    }
  }

  stop(): void {
    this.state.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset(): void {
    this.stop();
    this.solver.reset();
    this.state.currentTime = 0;
    this.state.stepCount = 0;
    this.history = [];
  }

  /**
   * Get current simulation state for visualization
   */
  getVisualizationData(): VisualizationData {
    const solverState = this.solver.getState();

    return {
      time: this.state.currentTime,
      stateVector: solverState.state,
      algebraicVariables: this.odeSystem.getAlgebraicVariables(
        this.state.currentTime,
        solverState.state
      ),
      energy: this.computeEnergy(solverState.state),
      error: solverState.error,
    };
  }

  /**
   * Record simulation execution performance
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      wallClockTime: this.state.executionTime,
      simulationTime: this.state.currentTime,
      stepCount: this.state.stepCount,
      stepsPerSecond: this.state.stepCount / (this.state.executionTime / 1000),
      averageStepTime: this.state.executionTime / this.state.stepCount,
      fps: this.estimateFPS(),
    };
  }

  private computeEnergy(state: Float64Array): number {
    // Energy = sum of (q²/2C + p²/2L)
    // For generalized coordinates in bond graphs

    let energy = 0;
    // Implementation depends on element types

    return energy;
  }

  private estimateFPS(): number {
    // Count number of history points in last second

    const now = this.state.currentTime;
    const lastSecond = this.history.filter(h => h.time > now - 1);

    return lastSecond.length;
  }
}
```

**Real-Time Performance Strategy:**
- Use `requestAnimationFrame` for smooth 60 FPS
- Execute multiple solver steps per frame
- Keep state synchronized with wall clock time
- Record history only if needed
- Profile execution time

---

### Task 6: Canvas Simulation Visualization
**Files:** `packages/ui-framework/src/components/BondGraphEditor/SimulationCanvas.tsx` (new, 500 lines)

Visualize simulation results in real-time:

```typescript
interface SimulationVisualization {
  // Node visualization
  nodeValues: Map<string, number>;      // Current value at each node
  nodeValueTypes: Map<string, string>;  // 'voltage', 'temperature', 'force'

  // Bond visualization
  bondPowers: Map<string, number>;      // Power flow (effort × flow)
  bondEnergies: Map<string, number>;    // Cumulative energy dissipated

  // Global visualization
  totalEnergy: number;
  dissipatedEnergy: number;
  efficiency: number;

  // Time series (for plots)
  timeHistory: number[];
  stateHistory: Map<string, number[]>;
}

export function SimulationCanvas({
  elements,
  bonds,
  simulationEngine,
  stateMapping,
}: {
  elements: EditorElement[];
  bonds: EditorBond[];
  simulationEngine: SimulationEngine;
  stateMapping: StateMapping;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vizData, setVizData] = useState<SimulationVisualization | null>(null);

  useEffect(() => {
    const animationId = requestAnimationFrame(() => {
      const simData = simulationEngine.getVisualizationData();

      // Convert solver state to element values
      const visualization = buildVisualization(
        simData,
        elements,
        bonds,
        stateMapping
      );

      setVizData(visualization);

      // Render to canvas
      if (canvasRef.current) {
        renderSimulation(canvasRef.current, visualization, elements, bonds);
      }
    });

    return () => cancelAnimationFrame(animationId);
  }, [simulationEngine, elements, bonds, stateMapping]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ border: '1px solid #ccc', width: '100%', height: '500px' }}
      />

      <div style={{ padding: '10px', backgroundColor: '#f5f5f5' }}>
        <div>Time: {simulationEngine.getVisualizationData()?.time.toFixed(3)}s</div>
        <div>Energy: {vizData?.totalEnergy.toFixed(3)} J</div>
        <div>Dissipated: {vizData?.dissipatedEnergy.toFixed(3)} J</div>
        <div>Efficiency: {(vizData?.efficiency ?? 0).toFixed(1)}%</div>
      </div>
    </div>
  );
}

function renderSimulation(
  canvas: HTMLCanvasElement,
  vizData: SimulationVisualization,
  elements: EditorElement[],
  bonds: EditorBond[]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw elements with current values
  for (const element of elements) {
    const value = vizData.nodeValues.get(element.id) ?? 0;
    const valueType = vizData.nodeValueTypes.get(element.id) ?? 'unknown';

    // Color intensity based on value magnitude
    const intensity = Math.min(255, Math.abs(value) * 50);
    ctx.fillStyle = `rgb(${intensity}, 0, ${255 - intensity})`;

    // Draw element circle
    ctx.beginPath();
    ctx.arc(element.position.x, element.position.y, 20, 0, 2 * Math.PI);
    ctx.fill();

    // Draw value label
    ctx.fillStyle = 'black';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(value.toFixed(2), element.position.x, element.position.y);
  }

  // Draw bonds with power flow visualization
  for (const bond of bonds) {
    const power = vizData.bondPowers.get(bond.id) ?? 0;

    // Line width based on power
    ctx.lineWidth = 1 + Math.min(5, Math.abs(power) * 0.5);

    // Color based on power direction
    if (power > 0) {
      ctx.strokeStyle = 'green'; // Power flowing
    } else if (power < 0) {
      ctx.strokeStyle = 'red'; // Power flowing opposite direction
    } else {
      ctx.strokeStyle = 'gray'; // No power
    }

    ctx.beginPath();
    const fromEl = elements.find(e => e.id === bond.from);
    const toEl = elements.find(e => e.id === bond.to);

    if (fromEl && toEl) {
      ctx.moveTo(fromEl.position.x, fromEl.position.y);
      ctx.lineTo(toEl.position.x, toEl.position.y);
      ctx.stroke();

      // Draw arrow indicating power flow
      if (Math.abs(power) > 0.01) {
        drawArrow(ctx, fromEl.position, toEl.position, power > 0);
      }
    }
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  direction: boolean
) {
  // Draw arrow in middle of bond
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);

  const arrowSize = 10;

  if (direction) {
    // Arrow points from 'to'
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midX - arrowSize * Math.cos(angle - 0.5), midY - arrowSize * Math.sin(angle - 0.5));
    ctx.lineTo(midX - arrowSize * Math.cos(angle + 0.5), midY - arrowSize * Math.sin(angle + 0.5));
    ctx.closePath();
    ctx.fill();
  } else {
    // Arrow points from 'from'
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midX + arrowSize * Math.cos(angle - 0.5), midY + arrowSize * Math.sin(angle - 0.5));
    ctx.lineTo(midX + arrowSize * Math.cos(angle + 0.5), midY + arrowSize * Math.sin(angle + 0.5));
    ctx.closePath();
    ctx.fill();
  }
}
```

**Visualization Features:**
- Element values displayed with color intensity
- Bond power flow with arrows
- Global energy display
- Real-time metrics (time, energy, efficiency)
- Color coding (green = power, red = reverse, gray = none)

---

### Task 7: Simulation Control Panel
**Files:** `packages/ui-framework/src/components/BondGraphEditor/SimulationPanel.tsx` (new, 300 lines)

User controls for simulation:

```typescript
interface SimulationPanelProps {
  simulationEngine: SimulationEngine;
  performanceMetrics: PerformanceMetrics;
  onSave?: (history: SimulationSnapshot[]) => void;
}

export function SimulationPanel({
  simulationEngine,
  performanceMetrics,
  onSave,
}: SimulationPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1.0);

  const handleStart = () => {
    simulationEngine.start();
    setIsRunning(true);
  };

  const handlePause = () => {
    simulationEngine.pause();
    setIsRunning(false);
  };

  const handleResume = () => {
    simulationEngine.resume();
    setIsRunning(true);
  };

  const handleStop = () => {
    simulationEngine.stop();
    setIsRunning(false);
  };

  const handleReset = () => {
    simulationEngine.reset();
    setIsRunning(false);
  };

  return (
    <div style={panelStyle}>
      <h3>Simulation Control</h3>

      {/* Playback Controls */}
      <div style={controlsStyle}>
        <button onClick={handleStart} disabled={isRunning}>
          ▶ Start
        </button>
        <button onClick={handlePause} disabled={!isRunning}>
          ⏸ Pause
        </button>
        <button onClick={handleResume} disabled={isRunning}>
          ▶ Resume
        </button>
        <button onClick={handleStop}>
          ⏹ Stop
        </button>
        <button onClick={handleReset}>
          🔄 Reset
        </button>
      </div>

      {/* Speed Control */}
      <div style={controlStyle}>
        <label>Speed Multiplier:</label>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
        />
        <span>{speed.toFixed(1)}x</span>
      </div>

      {/* Performance Metrics */}
      <div style={metricsStyle}>
        <h4>Performance</h4>
        <MetricsTable metrics={performanceMetrics} />
      </div>

      {/* Save Results */}
      {!isRunning && (
        <button onClick={() => onSave?.(simulationEngine.history)}>
          💾 Save Results
        </button>
      )}
    </div>
  );
}

function MetricsTable({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <table style={tableStyle}>
      <tbody>
        <tr>
          <td>Simulation Time:</td>
          <td>{metrics.simulationTime.toFixed(3)} s</td>
        </tr>
        <tr>
          <td>Wall Clock Time:</td>
          <td>{(metrics.wallClockTime / 1000).toFixed(3)} s</td>
        </tr>
        <tr>
          <td>Steps:</td>
          <td>{metrics.stepCount}</td>
        </tr>
        <tr>
          <td>Steps/sec:</td>
          <td>{metrics.stepsPerSecond.toFixed(0)}</td>
        </tr>
        <tr>
          <td>Avg Step Time:</td>
          <td>{(metrics.averageStepTime * 1000).toFixed(3)} ms</td>
        </tr>
        <tr>
          <td>Display FPS:</td>
          <td>{metrics.fps.toFixed(1)}</td>
        </tr>
      </tbody>
    </table>
  );
}
```

**Controls:**
- ▶ Start/Resume/Pause/Stop/Reset buttons
- Speed multiplier (0.1x to 10x)
- Performance metrics display
- Save/Export results

---

### Task 8: Integration with BondGraphEditor
**Files:** `packages/ui-framework/src/components/BondGraphEditor/BondGraphEditor.tsx` (MODIFY, +100 lines)

Add simulation mode to editor:

```typescript
export function BondGraphEditor({
  elements,
  bonds,
  initialCausalities,
}: BondGraphEditorProps) {
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationEngine, setSimulationEngine] = useState<SimulationEngine | null>(null);
  const [stateMapping, setStateMapping] = useState<StateMapping | null>(null);

  // When switching to simulation mode
  const startSimulation = async () => {
    // 1. Extract state from causalities
    const extractor = new StateExtractor();
    const mapping = extractor.extractStateVector(elements, bonds, causalities);
    setStateMapping(mapping);

    // 2. Build ODE system
    const builder = new ODEBuilder();
    const odeSystem = builder.buildODESystem(elements, bonds, causalities, mapping);

    // 3. Select solver
    const selector = new SolverSelector();
    const stiffness = analyzer.rateStiffness(feedbackPaths); // From Phase 54
    const solverConfig = selector.selectSolver(stiffness, elements.length);

    // 4. Create solver
    const solver = createSolver(solverConfig); // RK4, RK45, BDF, or IDA

    // 5. Initialize engine
    const engine = new SimulationEngine(odeSystem, solver, {
      initialConditions: extractInitialConditions(elements),
      duration: 10.0, // seconds
      targetFPS: 60,
      interactive: true,
      recordHistory: true,
    });

    setSimulationEngine(engine);
    setSimulationMode(true);
  };

  return (
    <div style={editorStyle}>
      <Toolbar>
        {!simulationMode && (
          <button onClick={startSimulation}>
            ▶ Start Simulation
          </button>
        )}
        {simulationMode && (
          <button onClick={() => setSimulationMode(false)}>
            ✏ Edit Bond Graph
          </button>
        )}
      </Toolbar>

      {simulationMode && simulationEngine && stateMapping && (
        <>
          <SimulationCanvas
            elements={elements}
            bonds={bonds}
            simulationEngine={simulationEngine}
            stateMapping={stateMapping}
          />
          <SimulationPanel simulationEngine={simulationEngine} />
        </>
      )}

      {!simulationMode && (
        <>
          <Canvas elements={elements} bonds={bonds} />
          <PropertyPanel elements={elements} bonds={bonds} />
        </>
      )}
    </div>
  );
}
```

---

## Implementation Sequence

### Week 1: Core Components
- **Day 1-2:** Solver abstraction (Task 1)
- **Day 2-3:** State extraction (Task 2)
- **Day 3-4:** ODE builder (Task 3)
- **Day 4-5:** Solver selection (Task 4)

### Week 2: Simulation & Visualization
- **Day 1-2:** Simulation engine (Task 5)
- **Day 2-3:** Canvas visualization (Task 6)
- **Day 3-4:** Control panel (Task 7)
- **Day 4-5:** BondGraphEditor integration (Task 8)

### Week 3: Testing & Refinement
- **Day 1-2:** Unit tests (solvers, state extraction, ODE builder)
- **Day 2-3:** Integration tests (full workflow)
- **Day 3-4:** Performance optimization & profiling
- **Day 4-5:** Documentation & polish

---

## Testing Strategy

### Unit Tests

**Solver Tests (20 tests):**
- RK4 stability on linear systems
- RK45 adaptive stepping
- Solver error estimates
- Step validation

**State Extraction Tests (15 tests):**
- RC circuit state dimension
- Complex multi-domain state
- Causality validation

**ODE Builder Tests (20 tests):**
- Simple RC ODE correctness
- Energy conservation
- Causality effect on equations

**Solver Selection Tests (10 tests):**
- Non-stiff → RK4
- Stiff → BDF/IDA
- Time step estimation

### Integration Tests

**End-to-End Tests (15 tests):**
- Complete RC circuit simulation
- Thermal system simulation
- Multi-domain coupling
- Parameter variation

**Performance Tests (5 tests):**
- 60 FPS maintenance
- Large system handling (100+ elements)
- Memory efficiency

### Total: 85 tests

---

## Success Criteria

✅ **Simulation Execution:**
- Solver steps complete without errors
- State progression is continuous and smooth
- Energy is conserved (within numerical tolerance)
- Solver selection matches Phase 54 recommendations

✅ **Real-Time Performance:**
- 60 FPS display maintained
- <16.67ms per frame
- <1ms average solver step
- <100ms for 100-element systems

✅ **Visualization:**
- Node values display correctly
- Power flow shown with arrows
- Energy metrics accurate
- Performance stats displayed

✅ **User Experience:**
- Start/pause/resume/reset work smoothly
- Parameter changes during simulation possible
- History recording optional
- Results exportable

✅ **Code Quality:**
- Full type safety
- Comprehensive test coverage (85+ tests)
- Clear separation of concerns
- Performance profiled and optimized

---

## Key Insights

1. **Causality is Essential:** Bond graph causality directly determines ODE structure. Integral causality ↔ state variable.

2. **Real-Time Constraint:** 60 FPS requires <16.67ms per frame. Multiple solver steps fit within this budget.

3. **Stiffness Matters:** Phase 54 stiffness rating drives solver selection. Non-stiff systems use fast RK4; stiff use implicit methods.

4. **Energy is Truth:** Energy conservation validates entire pipeline (causality → ODE → solver).

5. **Performance Profiling:** Must measure actual execution time. Estimate first, optimize based on measurements.

---

## Integration with Previous Phases

```
Phase 47-48: Bond Graph Core & Multi-Domain Coupling
    ↓
Phase 51-54: Causality Optimization
    ├─ Phase 51: Interactive Debugger
    ├─ Phase 52: Causality-Driven Solver Recommendation
    ├─ Phase 53: Canvas Visualization
    └─ Phase 54: Advanced Optimization
    ↓
Phase 55: Real-Time Solver Integration ← CURRENT
    ├─ State extraction from Phase 54 causalities
    ├─ ODE system from bond graph
    ├─ Solver selection from Phase 54 stiffness rating
    └─ Visualization of simulation results
    ↓
Phase 56+: Advanced Features (undo/redo, parameter sweeps, parameter estimation)
```

---

## Next Steps

1. ✅ **Plan complete** - Ready for implementation
2. **Create Solver abstraction** (Task 1)
3. **Implement state extraction** (Task 2)
4. **Build ODE builder** (Task 3)
5. ... continue through Task 8
6. **Write 85+ tests**
7. **Performance optimization**
8. **Documentation & demo**

---

**Status:** Design Phase Complete ✅
**Ready for:** Implementation (Week 1-3)
**Estimated Completion:** 2-3 weeks

