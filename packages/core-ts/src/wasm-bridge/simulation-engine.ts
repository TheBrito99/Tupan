/**
 * Real-Time Simulation Engine
 *
 * Manages the main simulation loop at 60 FPS:
 * - Uses requestAnimationFrame for smooth display
 * - Executes multiple solver steps per frame
 * - Maintains wall-clock time synchronization
 * - Supports play/pause/reset/stop
 * - Records history for playback/analysis
 * - Provides performance metrics
 *
 * Architecture:
 * 1. User clicks "Start Simulation"
 * 2. Initialize solver with IC from bond graph
 * 3. Enter requestAnimationFrame loop
 * 4. Each frame: execute 8-10 solver steps
 * 5. Update visualization
 * 6. Loop until duration reached or stopped
 */

import type { Solver, SimulationResult, ODESystem, SolverState } from './solver';
import type { SolverRecommendation } from './solver-selector';

/**
 * Configuration for simulation run
 */
export interface SimulationConfig {
  initialConditions: Map<string, number>;  // Element ID → initial value
  duration: number;                        // Total simulation time (seconds)
  targetFPS: number;                       // Display refresh rate (typical: 60)
  interactive: boolean;                    // Allow parameter changes during sim
  recordHistory: boolean;                  // Store full trajectory
  maxHistoryPoints?: number;               // Limit history (every Nth step)
}

/**
 * Simulation state snapshot at a time point
 */
export interface SimulationSnapshot {
  time: number;                            // Simulation time (seconds)
  state: Float64Array;                     // State vector at this time
  timestamp: number;                       // Wall-clock time (ms)
}

/**
 * Current simulation execution state
 */
export interface SimulationState {
  isRunning: boolean;                      // Simulation active
  isPaused: boolean;                       // Currently paused
  currentTime: number;                     // Simulation time (seconds)
  stepCount: number;                       // Total steps executed
  stepCountThisFrame: number;              // Steps in current frame
  executionTime: number;                   // Wall-clock time elapsed (ms)
  solverState: SolverState;                // Current solver state
  errorAccumulation: number;               // Sum of step errors
  maxError: number;                        // Largest step error
}

/**
 * Performance metrics from simulation
 */
export interface PerformanceMetrics {
  wallClockTime: number;                   // Real time elapsed (ms)
  simulationTime: number;                  // Simulated time (seconds)
  totalSteps: number;                      // Total solver steps
  stepsPerSecond: number;                  // Solver throughput
  averageStepTime: number;                 // ms per step
  fps: number;                             // Display frame rate
  cpuLoad: number;                         // % of frame time used by solver
  averageError: number;                    // Mean step error
  maxError: number;                        // Peak step error
}

/**
 * Simulation callbacks for event handling
 */
export interface SimulationCallbacks {
  onStateUpdate?: (state: SimulationSnapshot) => void;
  onStepComplete?: (metrics: PerformanceMetrics) => void;
  onSimulationEnd?: (finalMetrics: PerformanceMetrics) => void;
  onError?: (error: string) => void;
}

/**
 * Main simulation engine
 */
export class SimulationEngine {
  private solver: Solver;
  private odeSystem: ODESystem;
  private config: SimulationConfig;
  private callbacks: SimulationCallbacks;

  private state: SimulationState;
  private history: SimulationSnapshot[];
  private animationFrameId: number | null = null;

  // Performance tracking
  private frameStartTime: number = 0;
  private frameCount: number = 0;
  private fpsHistory: number[] = [];
  private lastFpsUpdate: number = 0;

  // Pause state
  private pausedState: SimulationSnapshot | null = null;

  constructor(
    solver: Solver,
    odeSystem: ODESystem,
    config: SimulationConfig,
    callbacks: SimulationCallbacks = {}
  ) {
    this.solver = solver;
    this.odeSystem = odeSystem;
    this.config = config;
    this.callbacks = callbacks;

    // Initialize state
    this.state = {
      isRunning: false,
      isPaused: false,
      currentTime: 0,
      stepCount: 0,
      stepCountThisFrame: 0,
      executionTime: 0,
      solverState: solver.getState(),
      errorAccumulation: 0,
      maxError: 0,
    };

    this.history = [];
  }

  /**
   * Start simulation from initial conditions
   * Sets up solver and enters main loop
   */
  start(): void {
    if (this.state.isRunning) {
      console.warn('Simulation already running');
      return;
    }

    // Initialize solver
    const initialState = new Float64Array(this.odeSystem.dimension);

    // Load initial conditions from config
    for (let i = 0; i < this.odeSystem.dimension; i++) {
      initialState[i] = 0;
    }

    this.solver.initialize(0, initialState);

    // Reset state
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.state.stepCount = 0;
    this.state.errorAccumulation = 0;
    this.state.maxError = 0;
    this.history = [];
    this.frameCount = 0;
    this.fpsHistory = [];

    // Record initial state
    if (this.config.recordHistory) {
      this.history.push({
        time: 0,
        state: new Float64Array(this.solver.getState().state),
        timestamp: performance.now(),
      });
    }

    // Enter animation frame loop
    this.frameStartTime = performance.now();
    this.animationFrameId = requestAnimationFrame((t) => this.animationFrame(t));
  }

  /**
   * Pause simulation (can be resumed)
   */
  pause(): void {
    if (!this.state.isRunning) {
      console.warn('Simulation not running');
      return;
    }

    this.state.isPaused = true;
    this.pausedState = {
      time: this.state.currentTime,
      state: new Float64Array(this.solver.getState().state),
      timestamp: performance.now(),
    };

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (!this.state.isRunning || !this.state.isPaused) {
      console.warn('No paused simulation to resume');
      return;
    }

    this.state.isPaused = false;
    this.frameStartTime = performance.now();
    this.animationFrameId = requestAnimationFrame((t) => this.animationFrame(t));
  }

  /**
   * Stop simulation (cannot resume)
   */
  stop(): void {
    if (!this.state.isRunning) return;

    this.state.isRunning = false;
    this.state.isPaused = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Invoke completion callback
    if (this.callbacks.onSimulationEnd) {
      this.callbacks.onSimulationEnd(this.getPerformanceMetrics());
    }
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    this.stop();
    this.solver.reset();
    this.state = {
      isRunning: false,
      isPaused: false,
      currentTime: 0,
      stepCount: 0,
      stepCountThisFrame: 0,
      executionTime: 0,
      solverState: this.solver.getState(),
      errorAccumulation: 0,
      maxError: 0,
    };
    this.history = [];
    this.pausedState = null;
    this.frameCount = 0;
    this.fpsHistory = [];
  }

  /**
   * Main animation frame callback
   * Executes solver steps and updates visualization
   */
  private animationFrame(currentTime: number): void {
    if (!this.state.isRunning || this.state.isPaused) {
      return;
    }

    const frameStartTime = performance.now();
    const wallClockElapsed = (currentTime - this.frameStartTime) / 1000; // Convert to seconds
    const targetFrameTime = 1 / this.config.targetFPS;

    this.state.stepCountThisFrame = 0;

    // Execute solver steps until wall-clock time is caught up
    // This keeps simulation synchronized with display
    while (
      this.state.currentTime < wallClockElapsed &&
      this.state.isRunning &&
      this.state.currentTime < this.config.duration
    ) {
      // Compute adaptive time step
      const timeRemaining = this.config.duration - this.state.currentTime;
      let dt = 0.001; // Default 1ms step

      // Limit step to remaining time
      dt = Math.min(dt, timeRemaining);

      // Execute step
      const result = this.solver.step(dt);

      if (!result.success) {
        this.callbacks.onError?.(
          `Solver failed at t=${this.state.currentTime.toFixed(3)}s: ${result.error}`
        );
        this.stop();
        return;
      }

      // Update state
      this.state.currentTime = result.time;
      this.state.stepCount++;
      this.state.stepCountThisFrame++;

      // Track error
      const stepError = result.errorEstimate ?? 0;
      this.state.errorAccumulation += stepError;
      this.state.maxError = Math.max(this.state.maxError, stepError);

      // Record history (sample if too frequent)
      if (
        this.config.recordHistory &&
        (!this.config.maxHistoryPoints ||
          this.history.length < this.config.maxHistoryPoints)
      ) {
        this.history.push({
          time: this.state.currentTime,
          state: new Float64Array(this.solver.getState().state),
          timestamp: performance.now(),
        });
      }

      // Check if we've exceeded duration
      if (this.state.currentTime >= this.config.duration) {
        this.stop();
        return;
      }
    }

    // Update solver state in simulation state
    this.state.solverState = this.solver.getState();

    // Calculate frame time
    const frameTime = performance.now() - frameStartTime;
    this.state.executionTime = performance.now() - this.frameStartTime;

    // Update FPS
    this.frameCount++;
    this.fpsHistory.push(1000 / (frameTime + targetFrameTime * 1000));

    // Limit FPS history to last 60 frames
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }

    // Invoke state update callback
    if (this.callbacks.onStateUpdate) {
      this.callbacks.onStateUpdate({
        time: this.state.currentTime,
        state: new Float64Array(this.state.solverState.state),
        timestamp: performance.now(),
      });
    }

    // Invoke step complete callback
    if (this.callbacks.onStepComplete && this.frameCount % 10 === 0) {
      this.callbacks.onStepComplete(this.getPerformanceMetrics());
    }

    // Continue loop
    if (this.state.isRunning) {
      this.animationFrameId = requestAnimationFrame((t) => this.animationFrame(t));
    }
  }

  /**
   * Get current visualization data
   */
  getVisualizationData(): SimulationSnapshot {
    return {
      time: this.state.currentTime,
      state: new Float64Array(this.state.solverState.state),
      timestamp: performance.now(),
    };
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const avgFps =
      this.fpsHistory.length > 0
        ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
        : 0;

    const totalTime = Math.max(0.001, this.state.executionTime / 1000);
    const simTime = this.state.currentTime;
    const stepsPerSec = this.state.stepCount / totalTime;
    const avgStepTime = (this.state.executionTime / this.state.stepCount) * 1000;

    return {
      wallClockTime: this.state.executionTime,
      simulationTime: this.state.currentTime,
      totalSteps: this.state.stepCount,
      stepsPerSecond: stepsPerSec,
      averageStepTime: avgStepTime,
      fps: avgFps,
      cpuLoad: (this.state.executionTime / (this.state.executionTime + 100)) * 100, // Rough estimate
      averageError: this.state.stepCount > 0 ? this.state.errorAccumulation / this.state.stepCount : 0,
      maxError: this.state.maxError,
    };
  }

  /**
   * Get current simulation state
   */
  getCurrentState(): SimulationState {
    return {
      ...this.state,
      solverState: this.solver.getState(),
    };
  }

  /**
   * Get simulation history
   */
  getHistory(): SimulationSnapshot[] {
    return [...this.history];
  }

  /**
   * Get current time
   */
  getCurrentTime(): number {
    return this.state.currentTime;
  }

  /**
   * Check if simulation is running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Check if simulation is paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Export results as JSON
   */
  exportResults(): {
    config: SimulationConfig;
    metrics: PerformanceMetrics;
    finalState: SimulationState;
    history: SimulationSnapshot[];
  } {
    return {
      config: this.config,
      metrics: this.getPerformanceMetrics(),
      finalState: this.getCurrentState(),
      history: this.getHistory(),
    };
  }

  /**
   * Generate summary statistics
   */
  getSummary(): string {
    const metrics = this.getPerformanceMetrics();

    return (
      `Simulation Summary:\n` +
      `  Duration: ${metrics.simulationTime.toFixed(3)}s / ${this.config.duration.toFixed(3)}s\n` +
      `  Steps: ${metrics.totalSteps} steps\n` +
      `  Speed: ${metrics.stepsPerSecond.toFixed(0)} steps/sec\n` +
      `  Average step time: ${metrics.averageStepTime.toFixed(3)} ms\n` +
      `  Display FPS: ${metrics.fps.toFixed(1)} fps\n` +
      `  CPU Load: ${metrics.cpuLoad.toFixed(1)}%\n` +
      `  Max Error: ${metrics.maxError.toExponential(2)}\n` +
      `  Solver: ${this.solver.getName()}`
    );
  }
}

/**
 * Factory function to create simulation engine
 */
export function createSimulationEngine(
  solver: Solver,
  odeSystem: ODESystem,
  config: SimulationConfig,
  callbacks?: SimulationCallbacks
): SimulationEngine {
  return new SimulationEngine(solver, odeSystem, config, callbacks);
}

/**
 * Simulation manager for multiple runs
 */
export class SimulationManager {
  private engines: Map<string, SimulationEngine> = new Map();

  /**
   * Create new simulation engine
   */
  createSimulation(
    id: string,
    solver: Solver,
    odeSystem: ODESystem,
    config: SimulationConfig,
    callbacks?: SimulationCallbacks
  ): SimulationEngine {
    const engine = new SimulationEngine(solver, odeSystem, config, callbacks);
    this.engines.set(id, engine);
    return engine;
  }

  /**
   * Get existing simulation
   */
  getSimulation(id: string): SimulationEngine | undefined {
    return this.engines.get(id);
  }

  /**
   * Stop all simulations
   */
  stopAll(): void {
    for (const engine of this.engines.values()) {
      if (engine.isRunning()) {
        engine.stop();
      }
    }
  }

  /**
   * Clear all simulations
   */
  clearAll(): void {
    this.stopAll();
    this.engines.clear();
  }

  /**
   * Get all simulations
   */
  getAll(): Map<string, SimulationEngine> {
    return new Map(this.engines);
  }
}
