/**
 * Simulation Bridge - Connects Schematic Editor to Circuit Simulator
 *
 * Features:
 * - Netlist → Circuit Graph conversion
 * - Component model lookup
 * - Simulation execution
 * - Results visualization
 * - Measurement tracking
 */

/**
 * Circuit simulation result
 */
export interface SimulationResult {
  success: boolean;
  duration: number;           // Simulation time in ms
  error?: string;
  nodeVoltages: Record<string, number>;   // Node name → voltage
  componentCurrents: Record<string, number>; // Component ref → current
  componentPowers: Record<string, number>;   // Component ref → power
  timestamp: number;
  simulationTime: number;     // Simulated time in seconds
}

/**
 * Measurement point on schematic
 */
export interface Measurement {
  id: string;
  type: 'voltage' | 'current' | 'power' | 'impedance';
  location: 'node' | 'component' | 'wire';
  targetId: string;           // Node ID or component ID
  value?: number;
  unit: string;
  timestamp?: number;
}

/**
 * Probe for real-time measurements
 */
export interface Probe {
  id: string;
  type: 'voltage' | 'current';
  location: string;           // Node name or component ref
  value: number;
  active: boolean;
}

/**
 * Simulation configuration
 */
export interface SimulationConfig {
  duration: number;           // Total simulation time (seconds)
  timeStep: number;          // Initial time step (seconds)
  maxTimeStep: number;       // Maximum allowed step
  minTimeStep: number;       // Minimum allowed step
  tolerance: number;         // ODE solver tolerance (1e-6)
  method: 'RK4' | 'RK45';   // Integration method
  maxIterations: number;     // Maximum integration steps
  steadyState: boolean;      // Find steady state instead of transient
  steadyStateError: number;  // Threshold for steady state (1e-8)
}

/**
 * Simulation bridge connecting schematic to solver
 */
export class SimulationBridge {
  private lastResult: SimulationResult | null = null;
  private measurements: Map<string, Measurement> = new Map();
  private probes: Map<string, Probe> = new Map();
  private probeHistory: Map<string, number[]> = new Map();
  private maxHistoryPoints: number = 1000;

  /**
   * Default configuration
   */
  static getDefaultConfig(): SimulationConfig {
    return {
      duration: 1.0,
      timeStep: 0.001,
      maxTimeStep: 0.01,
      minTimeStep: 1e-6,
      tolerance: 1e-6,
      method: 'RK45',
      maxIterations: 100000,
      steadyState: false,
      steadyStateError: 1e-8,
    };
  }

  /**
   * Create measurement point
   */
  addMeasurement(
    type: 'voltage' | 'current' | 'power' | 'impedance',
    location: 'node' | 'component' | 'wire',
    targetId: string,
    unit: string
  ): string {
    const id = `meas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.measurements.set(id, {
      id,
      type,
      location,
      targetId,
      unit,
      timestamp: Date.now(),
    });

    return id;
  }

  /**
   * Remove measurement
   */
  removeMeasurement(id: string): boolean {
    return this.measurements.delete(id);
  }

  /**
   * Get all measurements
   */
  getMeasurements(): Measurement[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Update measurement value from simulation result
   */
  updateMeasurementValues(result: SimulationResult): void {
    for (const measurement of this.measurements.values()) {
      if (measurement.location === 'node') {
        measurement.value = result.nodeVoltages[measurement.targetId];
      } else if (measurement.location === 'component') {
        measurement.value = result.componentCurrents[measurement.targetId];
      } else if (measurement.location === 'wire') {
        // Wire current is component current
        measurement.value = result.componentCurrents[measurement.targetId];
      }

      measurement.timestamp = Date.now();
    }
  }

  /**
   * Add probe for real-time tracking
   */
  addProbe(type: 'voltage' | 'current', location: string): string {
    const id = `probe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.probes.set(id, {
      id,
      type,
      location,
      value: 0,
      active: true,
    });

    this.probeHistory.set(id, []);

    return id;
  }

  /**
   * Remove probe
   */
  removeProbe(id: string): boolean {
    this.probeHistory.delete(id);
    return this.probes.delete(id);
  }

  /**
   * Get all active probes
   */
  getProbes(): Probe[] {
    return Array.from(this.probes.values()).filter(p => p.active);
  }

  /**
   * Update probe values from simulation
   */
  updateProbeValues(result: SimulationResult): void {
    for (const probe of this.probes.values()) {
      if (!probe.active) continue;

      if (probe.type === 'voltage') {
        probe.value = result.nodeVoltages[probe.location] || 0;
      } else if (probe.type === 'current') {
        probe.value = result.componentCurrents[probe.location] || 0;
      }

      // Record in history
      const history = this.probeHistory.get(probe.id);
      if (history) {
        history.push(probe.value);

        // Limit history size
        if (history.length > this.maxHistoryPoints) {
          history.shift();
        }
      }
    }
  }

  /**
   * Get probe history
   */
  getProbeHistory(probeId: string): number[] {
    return this.probeHistory.get(probeId) || [];
  }

  /**
   * Clear all probe histories
   */
  clearProbeHistories(): void {
    for (const history of this.probeHistory.values()) {
      history.length = 0;
    }
  }

  /**
   * Store simulation result
   */
  setResult(result: SimulationResult): void {
    this.lastResult = result;
    this.updateMeasurementValues(result);
    this.updateProbeValues(result);
  }

  /**
   * Get last simulation result
   */
  getResult(): SimulationResult | null {
    return this.lastResult;
  }

  /**
   * Get node voltage
   */
  getNodeVoltage(nodeName: string): number {
    return this.lastResult?.nodeVoltages[nodeName] ?? 0;
  }

  /**
   * Get component current
   */
  getComponentCurrent(componentRef: string): number {
    return this.lastResult?.componentCurrents[componentRef] ?? 0;
  }

  /**
   * Get component power
   */
  getComponentPower(componentRef: string): number {
    return this.lastResult?.componentPowers[componentRef] ?? 0;
  }

  /**
   * Check if simulation succeeded
   */
  isSimulationValid(): boolean {
    return this.lastResult?.success ?? false;
  }

  /**
   * Get all node voltages
   */
  getAllNodeVoltages(): Record<string, number> {
    return this.lastResult?.nodeVoltages ?? {};
  }

  /**
   * Get all component currents
   */
  getAllComponentCurrents(): Record<string, number> {
    return this.lastResult?.componentCurrents ?? {};
  }

  /**
   * Find nodes above/below threshold
   */
  findNodesAboveThreshold(threshold: number): string[] {
    if (!this.lastResult) return [];

    return Object.entries(this.lastResult.nodeVoltages)
      .filter(([_, voltage]) => voltage > threshold)
      .map(([node, _]) => node);
  }

  /**
   * Find components drawing most power
   */
  findHighPowerComponents(threshold: number): string[] {
    if (!this.lastResult) return [];

    return Object.entries(this.lastResult.componentPowers)
      .filter(([_, power]) => Math.abs(power) > threshold)
      .map(([ref, _]) => ref);
  }

  /**
   * Calculate total power
   */
  getTotalPower(): number {
    if (!this.lastResult) return 0;

    return Object.values(this.lastResult.componentPowers).reduce((sum, p) => sum + p, 0);
  }

  /**
   * Calculate circuit efficiency
   */
  getCircuitEfficiency(): number {
    if (!this.lastResult) return 0;

    const inputPower = Object.entries(this.lastResult.componentPowers)
      .filter(([ref, _]) => ref.startsWith('V')) // Voltage sources
      .reduce((sum, [_, power]) => sum + Math.max(0, power), 0);

    if (inputPower === 0) return 0;

    const dissipatedPower = Object.entries(this.lastResult.componentPowers)
      .filter(([ref, _]) => ref.startsWith('R')) // Resistors
      .reduce((sum, [_, power]) => sum + power, 0);

    return (dissipatedPower / inputPower) * 100;
  }

  /**
   * Get simulation summary
   */
  getSummary(): {
    success: boolean;
    duration: number;
    nodeCount: number;
    componentCount: number;
    totalPower: number;
    maxVoltage: number;
    maxCurrent: number;
    efficiency: number;
  } | null {
    if (!this.lastResult) return null;

    const voltages = Object.values(this.lastResult.nodeVoltages);
    const currents = Object.values(this.lastResult.componentCurrents);

    return {
      success: this.lastResult.success,
      duration: this.lastResult.duration,
      nodeCount: voltages.length,
      componentCount: currents.length,
      totalPower: this.getTotalPower(),
      maxVoltage: Math.max(...voltages, 0),
      maxCurrent: Math.max(...currents.map(Math.abs), 0),
      efficiency: this.getCircuitEfficiency(),
    };
  }

  /**
   * Export results as JSON
   */
  exportResults(): string {
    if (!this.lastResult) return '{}';

    return JSON.stringify(
      {
        result: this.lastResult,
        measurements: Array.from(this.measurements.values()),
        probes: Array.from(this.probes.values()),
        summary: this.getSummary(),
      },
      null,
      2
    );
  }

  /**
   * Export probe data for plotting
   */
  exportProbeData(): Array<{ probeId: string; location: string; type: string; history: number[] }> {
    return Array.from(this.probes.values()).map(probe => ({
      probeId: probe.id,
      location: probe.location,
      type: probe.type,
      history: this.probeHistory.get(probe.id) || [],
    }));
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.lastResult = null;
    this.measurements.clear();
    this.probes.clear();
    this.clearProbeHistories();
  }
}
