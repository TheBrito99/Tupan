/**
 * Unified Solver Abstraction Layer
 *
 * Provides a single interface for all ODE solvers:
 * - RK4: Simple 4th-order Runge-Kutta (explicit, fast, non-stiff)
 * - RK45: Dormand-Prince adaptive (explicit, automatic stepping)
 * - BDF: Backward Differentiation Formula (implicit, stiff systems)
 * - IDA: Index-1 DAE solver (implicit, highest accuracy, very stiff)
 *
 * All solvers implement the same interface for seamless switching.
 */

/**
 * Configuration for solver behavior
 */
export interface SolverConfig {
  type: 'RK4' | 'RK45' | 'BDF' | 'IDA';
  dt: number;                    // Initial/fixed time step (seconds)
  maxStep?: number;              // Maximum allowed step size
  minStep?: number;              // Minimum allowed step size (adaptive solvers)
  tolerance?: number;            // Relative tolerance (adaptive/implicit solvers)
  absoluteTolerance?: number;    // Absolute tolerance (for small values)
  maxIterations?: number;        // Max Newton iterations (implicit solvers)
}

/**
 * Current solver state at a given time point
 */
export interface SolverState {
  time: number;                  // Current simulation time (seconds)
  state: Float64Array;           // Current state vector
  derivatives: Float64Array;     // Current derivatives (dy/dt)
  error: number;                 // Estimated local error
  stepSize: number;              // Last step size used
}

/**
 * Result of a single solver step
 */
export interface SimulationResult {
  success: boolean;              // Step completed without error
  time: number;                  // New time after step
  state: Float64Array;           // New state after step
  error?: string;                // Error message if failed
  errorEstimate?: number;        // Estimated truncation error
  stepSize?: number;             // Actual step size used
}

/**
 * ODE system to solve: dy/dt = f(t, y)
 */
export interface ODESystem {
  /**
   * Compute derivatives at time t with state y
   */
  compute(t: number, state: Float64Array): Float64Array;

  /**
   * Get algebraic variables (non-differential states)
   * Example: voltages computed from currents via resistor law
   */
  getAlgebraicVariables?(t: number, state: Float64Array): Map<string, number>;

  /**
   * System dimension (number of state variables)
   */
  dimension: number;
}

/**
 * Abstract base class for all solvers
 * Implements common interface; subclasses provide specific algorithms
 */
export abstract class Solver {
  protected config: SolverConfig;
  protected system: ODESystem;
  protected currentState: SolverState;

  constructor(system: ODESystem, config: SolverConfig) {
    this.system = system;
    this.config = config;

    // Initialize state
    this.currentState = {
      time: 0,
      state: new Float64Array(system.dimension),
      derivatives: new Float64Array(system.dimension),
      error: 0,
      stepSize: config.dt,
    };
  }

  /**
   * Initialize solver with initial conditions
   */
  abstract initialize(t0: number, y0: Float64Array): void;

  /**
   * Execute one time step, returning new state
   */
  abstract step(dt?: number): SimulationResult;

  /**
   * Get current solver state
   */
  getState(): SolverState {
    return {
      time: this.currentState.time,
      state: new Float64Array(this.currentState.state),
      derivatives: new Float64Array(this.currentState.derivatives),
      error: this.currentState.error,
      stepSize: this.currentState.stepSize,
    };
  }

  /**
   * Reset solver to initial state
   */
  abstract reset(): void;

  /**
   * Get solver name for display/logging
   */
  abstract getName(): string;

  /**
   * Check if solver is suitable for given system stiffness
   */
  abstract isSuitableFor(stiffness: 'non-stiff' | 'mildly-stiff' | 'stiff' | 'very-stiff'): boolean;
}

/**
 * RK4: 4th-order Runge-Kutta method
 * - Explicit (fast)
 * - Fixed step size
 * - Good for non-stiff systems
 * - No adaptivity
 */
export class RK4Solver extends Solver {
  private k1: Float64Array;
  private k2: Float64Array;
  private k3: Float64Array;
  private k4: Float64Array;
  private temp: Float64Array;

  constructor(system: ODESystem, config: SolverConfig) {
    super(system, config);

    const n = system.dimension;
    this.k1 = new Float64Array(n);
    this.k2 = new Float64Array(n);
    this.k3 = new Float64Array(n);
    this.k4 = new Float64Array(n);
    this.temp = new Float64Array(n);
  }

  initialize(t0: number, y0: Float64Array): void {
    this.currentState.time = t0;
    this.currentState.state.set(y0);
    this.currentState.derivatives = this.system.compute(t0, y0);
    this.currentState.error = 0;
  }

  step(dt?: number): SimulationResult {
    const h = dt ?? this.config.dt;
    const t = this.currentState.time;
    const y = this.currentState.state;
    const n = this.system.dimension;

    try {
      // k1 = f(t, y)
      this.k1 = this.system.compute(t, y);

      // k2 = f(t + h/2, y + h*k1/2)
      for (let i = 0; i < n; i++) {
        this.temp[i] = y[i] + (h * this.k1[i]) / 2;
      }
      this.k2 = this.system.compute(t + h / 2, this.temp);

      // k3 = f(t + h/2, y + h*k2/2)
      for (let i = 0; i < n; i++) {
        this.temp[i] = y[i] + (h * this.k2[i]) / 2;
      }
      this.k3 = this.system.compute(t + h / 2, this.temp);

      // k4 = f(t + h, y + h*k3)
      for (let i = 0; i < n; i++) {
        this.temp[i] = y[i] + h * this.k3[i];
      }
      this.k4 = this.system.compute(t + h, this.temp);

      // y_new = y + h * (k1 + 2*k2 + 2*k3 + k4) / 6
      for (let i = 0; i < n; i++) {
        this.currentState.state[i] =
          y[i] + (h * (this.k1[i] + 2 * this.k2[i] + 2 * this.k3[i] + this.k4[i])) / 6;
      }

      this.currentState.time = t + h;
      this.currentState.derivatives = this.system.compute(this.currentState.time, this.currentState.state);
      this.currentState.stepSize = h;
      this.currentState.error = 0; // RK4 doesn't estimate error

      return {
        success: true,
        time: this.currentState.time,
        state: new Float64Array(this.currentState.state),
        stepSize: h,
      };
    } catch (error) {
      return {
        success: false,
        time: t,
        state: new Float64Array(y),
        error: `RK4 step failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  reset(): void {
    this.currentState.time = 0;
    this.currentState.state.fill(0);
    this.currentState.derivatives.fill(0);
    this.currentState.error = 0;
  }

  getName(): string {
    return 'RK4 (4th-order Runge-Kutta)';
  }

  isSuitableFor(stiffness: string): boolean {
    return stiffness === 'non-stiff';
  }
}

/**
 * RK45: Dormand-Prince 5(4) method with automatic step adjustment
 * - Explicit (reasonably fast)
 * - Adaptive step size
 * - Good for mildly stiff systems
 * - Automatic error control
 */
export class RK45Solver extends Solver {
  private tolerance: number;
  private absoluteTolerance: number;
  private k1: Float64Array;
  private k2: Float64Array;
  private k3: Float64Array;
  private k4: Float64Array;
  private k5: Float64Array;
  private k6: Float64Array;
  private temp: Float64Array;
  private y4: Float64Array; // 4th order approximation
  private y5: Float64Array; // 5th order approximation

  constructor(system: ODESystem, config: SolverConfig) {
    super(system, config);

    this.tolerance = config.tolerance ?? 1e-5;
    this.absoluteTolerance = config.absoluteTolerance ?? 1e-8;

    const n = system.dimension;
    this.k1 = new Float64Array(n);
    this.k2 = new Float64Array(n);
    this.k3 = new Float64Array(n);
    this.k4 = new Float64Array(n);
    this.k5 = new Float64Array(n);
    this.k6 = new Float64Array(n);
    this.temp = new Float64Array(n);
    this.y4 = new Float64Array(n);
    this.y5 = new Float64Array(n);
  }

  initialize(t0: number, y0: Float64Array): void {
    this.currentState.time = t0;
    this.currentState.state.set(y0);
    this.currentState.derivatives = this.system.compute(t0, y0);
    this.currentState.error = 0;
  }

  step(dt?: number): SimulationResult {
    let h = dt ?? this.config.dt;
    const t = this.currentState.time;
    const y = this.currentState.state;
    const n = this.system.dimension;
    const maxStep = this.config.maxStep ?? h * 10;
    const minStep = this.config.minStep ?? h / 100;

    // Limit step size
    h = Math.min(h, maxStep);
    h = Math.max(h, minStep);

    try {
      // Dormand-Prince coefficients
      const c2 = 1 / 5;
      const c3 = 3 / 10;
      const c4 = 4 / 5;
      const c5 = 8 / 9;
      const c6 = 1;
      const c7 = 1;

      const b1 = 35 / 384;
      const b3 = 500 / 1113;
      const b4 = 125 / 192;
      const b5 = -2187 / 6784;
      const b6 = 11 / 84;

      const b1s = 5179 / 57600;
      const b3s = 7571 / 16695;
      const b4s = 393 / 640;
      const b5s = -92097 / 339200;
      const b6s = 187 / 2100;

      // Stage 1
      this.k1 = this.system.compute(t, y);

      // Stage 2
      for (let i = 0; i < n; i++) {
        this.temp[i] = y[i] + (h * c2 * this.k1[i]) / 5;
      }
      this.k2 = this.system.compute(t + h * c2, this.temp);

      // Stage 3
      for (let i = 0; i < n; i++) {
        this.temp[i] = y[i] + (h * (3 * this.k1[i] + 9 * this.k2[i])) / 40;
      }
      this.k3 = this.system.compute(t + h * c3, this.temp);

      // Stage 4
      for (let i = 0; i < n; i++) {
        this.temp[i] =
          y[i] +
          (h * (44 * this.k1[i] - 168 * this.k2[i] + 160 * this.k3[i])) / 45;
      }
      this.k4 = this.system.compute(t + h * c4, this.temp);

      // Stage 5
      for (let i = 0; i < n; i++) {
        this.temp[i] =
          y[i] +
          (h *
            (19372 * this.k1[i] -
              76080 * this.k2[i] +
              64448 * this.k3[i] -
              1908 * this.k4[i])) /
            6561;
      }
      this.k5 = this.system.compute(t + h * c5, this.temp);

      // Stage 6
      for (let i = 0; i < n; i++) {
        this.temp[i] =
          y[i] +
          (h *
            (9017 * this.k1[i] -
              35240 * this.k2[i] +
              34144 * this.k3[i] -
              5248 * this.k4[i] +
              40 * this.k5[i])) /
            6480;
      }
      this.k6 = this.system.compute(t + h * c6, this.temp);

      // Compute 4th and 5th order approximations
      for (let i = 0; i < n; i++) {
        this.y4[i] =
          y[i] +
          h *
            (b1 * this.k1[i] +
              b3 * this.k3[i] +
              b4 * this.k4[i] +
              b5 * this.k5[i] +
              b6 * this.k6[i]);

        this.y5[i] =
          y[i] +
          h *
            (b1s * this.k1[i] +
              b3s * this.k3[i] +
              b4s * this.k4[i] +
              b5s * this.k5[i] +
              b6s * this.k6[i]);
      }

      // Compute error estimate
      let error = 0;
      for (let i = 0; i < n; i++) {
        const scale = Math.abs(this.y5[i]) > this.absoluteTolerance
          ? Math.abs(this.y5[i])
          : this.absoluteTolerance;
        const diff = Math.abs(this.y5[i] - this.y4[i]);
        error = Math.max(error, diff / (this.tolerance * scale));
      }

      // Accept step if error is acceptable
      if (error <= 1.0) {
        this.currentState.time = t + h;
        this.currentState.state.set(this.y5);
        this.currentState.derivatives = this.system.compute(this.currentState.time, this.currentState.state);
        this.currentState.stepSize = h;
        this.currentState.error = error;

        return {
          success: true,
          time: this.currentState.time,
          state: new Float64Array(this.currentState.state),
          stepSize: h,
          errorEstimate: error,
        };
      } else {
        // Reject step and retry with smaller step
        const reduction = Math.pow(error, -0.2);
        const newH = h * Math.max(0.1, Math.min(5, reduction));

        return this.step(newH);
      }
    } catch (error) {
      return {
        success: false,
        time: t,
        state: new Float64Array(y),
        error: `RK45 step failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  reset(): void {
    this.currentState.time = 0;
    this.currentState.state.fill(0);
    this.currentState.derivatives.fill(0);
    this.currentState.error = 0;
  }

  getName(): string {
    return 'RK45 (Dormand-Prince 5(4) Adaptive)';
  }

  isSuitableFor(stiffness: string): boolean {
    return stiffness === 'non-stiff' || stiffness === 'mildly-stiff';
  }
}

/**
 * Placeholder for BDF solver
 * Would be implemented via WASM binding to Rust IDA in Phase 55
 */
export class BDFSolver extends Solver {
  initialize(t0: number, y0: Float64Array): void {
    this.currentState.time = t0;
    this.currentState.state.set(y0);
    this.currentState.derivatives = this.system.compute(t0, y0);
  }

  step(dt?: number): SimulationResult {
    // Placeholder: Would implement BDF via WASM
    // For now, fall back to RK45
    console.warn('BDF solver not yet implemented, using RK45 fallback');
    const fallback = new RK45Solver(this.system, this.config);
    fallback.initialize(this.currentState.time, this.currentState.state);
    return fallback.step(dt);
  }

  reset(): void {
    this.currentState.time = 0;
    this.currentState.state.fill(0);
    this.currentState.derivatives.fill(0);
  }

  getName(): string {
    return 'BDF (Backward Differentiation Formula) - TODO';
  }

  isSuitableFor(stiffness: string): boolean {
    return stiffness === 'stiff';
  }
}

/**
 * Placeholder for IDA solver
 * Would be implemented via WASM binding to Rust IDA in Phase 55
 */
export class IDASolver extends Solver {
  initialize(t0: number, y0: Float64Array): void {
    this.currentState.time = t0;
    this.currentState.state.set(y0);
    this.currentState.derivatives = this.system.compute(t0, y0);
  }

  step(dt?: number): SimulationResult {
    // Placeholder: Would implement IDA via WASM
    // For now, fall back to RK45
    console.warn('IDA solver not yet implemented, using RK45 fallback');
    const fallback = new RK45Solver(this.system, this.config);
    fallback.initialize(this.currentState.time, this.currentState.state);
    return fallback.step(dt);
  }

  reset(): void {
    this.currentState.time = 0;
    this.currentState.state.fill(0);
    this.currentState.derivatives.fill(0);
  }

  getName(): string {
    return 'IDA (DAE Solver) - TODO';
  }

  isSuitableFor(stiffness: string): boolean {
    return stiffness === 'very-stiff';
  }
}

/**
 * Factory function to create appropriate solver for given config
 */
export function createSolver(system: ODESystem, config: SolverConfig): Solver {
  switch (config.type) {
    case 'RK4':
      return new RK4Solver(system, config);
    case 'RK45':
      return new RK45Solver(system, config);
    case 'BDF':
      return new BDFSolver(system, config);
    case 'IDA':
      return new IDASolver(system, config);
    default:
      throw new Error(`Unknown solver type: ${config.type}`);
  }
}

/**
 * Convenience function to select best solver for system stiffness
 */
export function selectBestSolver(
  system: ODESystem,
  stiffness: 'non-stiff' | 'mildly-stiff' | 'stiff' | 'very-stiff',
  dt: number = 0.001
): Solver {
  const config: SolverConfig = {
    type: 'RK4',
    dt,
    tolerance: 1e-5,
  };

  switch (stiffness) {
    case 'non-stiff':
      config.type = 'RK4';
      break;
    case 'mildly-stiff':
      config.type = 'RK45';
      break;
    case 'stiff':
      config.type = 'BDF';
      config.tolerance = 1e-6;
      break;
    case 'very-stiff':
      config.type = 'IDA';
      config.tolerance = 1e-8;
      config.absoluteTolerance = 1e-10;
      break;
  }

  return createSolver(system, config);
}
