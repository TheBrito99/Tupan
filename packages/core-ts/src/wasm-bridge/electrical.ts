/**
 * TypeScript bridge for electrical circuit analysis via WASM
 *
 * Provides high-level interface to Rust electrical solver through WASM bindings.
 * Handles serialization/deserialization of circuit data and analysis results.
 */

import type { WasmElectricalAnalyzer } from '@tupan/core-rust';

/**
 * Circuit node representation for WASM transmission
 */
export interface CircuitNode {
  id: string;
  type: string;
  name: string;
  parameters: Record<string, number>;
  x?: number;
  y?: number;
}

/**
 * Circuit edge representation for WASM transmission
 */
export interface CircuitEdge {
  source: [string, string];  // [nodeId, portId]
  target: [string, string];
}

/**
 * Circuit representation
 */
export interface Circuit {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  nodeCount: number;
  edgeCount: number;
}

/**
 * DC analysis result
 */
export interface DcAnalysisResult {
  analysisType: 'DC';
  nodeVoltages: number[];
  simulationTime: number;
}

/**
 * Transient analysis result
 */
export interface TransientAnalysisResult {
  analysisType: 'TRANSIENT';
  duration: number;
  timeStep: number;
  timeVector: number[];
  nodeVoltages: number[][];
  stepCount: number;
}

/**
 * Circuit validation result
 */
export interface CircuitValidation {
  isValid: boolean;
  issueCount: number;
  issues: string[];
  totalNodes: number;
  floatingNodes: number;
  groundNodes: number;
}

/**
 * Circuit statistics
 */
export interface CircuitStats {
  totalNodes: number;
  floatingNodes: number;
  connectedNodes: number;
  totalResistors: number;
  totalCapacitors: number;
  totalInductors: number;
  totalSources: number;
}

/**
 * High-level wrapper for electrical circuit analysis
 *
 * Example usage:
 * ```typescript
 * const analyzer = new ElectricalAnalyzer('My Circuit');
 * const circuit: Circuit = {
 *   nodes: [
 *     { id: '1', type: 'voltage_source', name: 'V1', parameters: { voltage: 5.0 } },
 *     { id: '2', type: 'resistor', name: 'R1', parameters: { resistance: 1000 } },
 *     { id: '3', type: 'ground', name: 'GND', parameters: {} },
 *   ],
 *   edges: [
 *     { source: ['1', 'pos'], target: ['2', 'in'] },
 *     { source: ['2', 'out'], target: ['3', 'ref'] },
 *   ],
 *   nodeCount: 3,
 *   edgeCount: 2,
 * };
 *
 * const validation = await analyzer.validateCircuit(circuit);
 * if (validation.isValid) {
 *   const dcResult = await analyzer.analyzeDc(circuit);
 *   console.log('Node voltages:', dcResult.nodeVoltages);
 * }
 * ```
 */
export class ElectricalAnalyzer {
  private wasmAnalyzer: WasmElectricalAnalyzer | null = null;
  private circuitName: string;
  private initialized: boolean = false;

  /**
   * Create a new electrical analyzer
   * @param circuitName - Name of the circuit
   */
  constructor(circuitName: string) {
    this.circuitName = circuitName;
  }

  /**
   * Initialize WASM module (must be called before analysis)
   * @param wasmModule - Initialized WASM module from core-rust
   */
  public initialize(wasmModule: any): void {
    try {
      this.wasmAnalyzer = new wasmModule.WasmElectricalAnalyzer(this.circuitName);
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize electrical analyzer: ${error}`);
    }
  }

  /**
   * Check if analyzer is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.wasmAnalyzer !== null;
  }

  /**
   * Load circuit from circuit description
   * @param circuit - Circuit nodes and edges
   * @throws Error if WASM not initialized or circuit invalid
   */
  public loadCircuit(circuit: Circuit): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    try {
      const circuitJson = JSON.stringify(circuit);
      const result = this.wasmAnalyzer!.load_circuit(circuitJson);
      const loadResult = JSON.parse(result);

      if (!loadResult.success) {
        throw new Error(`Failed to load circuit: ${result}`);
      }
    } catch (error) {
      throw new Error(`Circuit loading failed: ${error}`);
    }
  }

  /**
   * Validate circuit without running analysis
   * @param circuit - Circuit nodes and edges
   * @returns Validation result
   * @throws Error if WASM not initialized
   */
  public validateCircuit(circuit: Circuit): CircuitValidation {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    try {
      this.loadCircuit(circuit);
      const result = this.wasmAnalyzer!.validate_circuit();
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Circuit validation failed: ${error}`);
    }
  }

  /**
   * Run DC operating point analysis
   * @param circuit - Circuit nodes and edges
   * @returns DC analysis results
   * @throws Error if circuit invalid or analysis fails
   */
  public analyzeDc(circuit: Circuit): DcAnalysisResult {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    try {
      this.loadCircuit(circuit);

      // Validate before analysis
      const validation = this.validateCircuit(circuit);
      if (!validation.isValid) {
        throw new Error(`Circuit validation failed: ${validation.issues.join(', ')}`);
      }

      const result = this.wasmAnalyzer!.analyze_dc();
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`DC analysis failed: ${error}`);
    }
  }

  /**
   * Run transient (time-domain) analysis
   * @param circuit - Circuit nodes and edges
   * @param duration - Total simulation time in seconds
   * @param timeStep - Time step for integration in seconds
   * @returns Transient analysis results
   * @throws Error if circuit invalid or analysis fails
   */
  public analyzeTransient(
    circuit: Circuit,
    duration: number,
    timeStep: number
  ): TransientAnalysisResult {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    if (duration <= 0) {
      throw new Error('Duration must be positive');
    }
    if (timeStep <= 0) {
      throw new Error('Time step must be positive');
    }
    if (timeStep > duration) {
      throw new Error('Time step cannot exceed duration');
    }

    try {
      this.loadCircuit(circuit);

      // Validate before analysis
      const validation = this.validateCircuit(circuit);
      if (!validation.isValid) {
        throw new Error(`Circuit validation failed: ${validation.issues.join(', ')}`);
      }

      const result = this.wasmAnalyzer!.analyze_transient(duration, timeStep);
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Transient analysis failed: ${error}`);
    }
  }

  /**
   * Get circuit statistics
   * @param circuit - Circuit nodes and edges
   * @returns Circuit statistics
   * @throws Error if circuit analysis fails
   */
  public getCircuitStats(circuit: Circuit): CircuitStats {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    try {
      this.loadCircuit(circuit);
      const result = this.wasmAnalyzer!.get_circuit_stats();
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Failed to get circuit stats: ${error}`);
    }
  }

  /**
   * Set operating frequency for AC analysis
   * @param frequency - Frequency in Hz (0 for DC)
   */
  public setFrequency(frequency: number): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    if (frequency < 0) {
      throw new Error('Frequency cannot be negative');
    }

    this.wasmAnalyzer!.set_frequency(frequency);
  }

  /**
   * Set operating temperature for temperature-dependent analysis
   * @param temperature - Temperature in Celsius
   */
  public setTemperature(temperature: number): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    this.wasmAnalyzer!.set_temperature(temperature);
  }

  /**
   * Get current circuit as JSON
   * @returns Circuit JSON representation
   * @throws Error if WASM not initialized
   */
  public getCircuitJson(): Circuit {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    try {
      const result = this.wasmAnalyzer!.get_circuit_json();
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Failed to get circuit JSON: ${error}`);
    }
  }
}

/**
 * Singleton instance of electrical analyzer
 * Provides global access to electrical analysis functionality
 */
let globalAnalyzer: ElectricalAnalyzer | null = null;

/**
 * Get or create global electrical analyzer instance
 * @param circuitName - Name for the circuit (used on first creation)
 * @returns Global analyzer instance
 */
export function getElectricalAnalyzer(circuitName: string = 'Default Circuit'): ElectricalAnalyzer {
  if (!globalAnalyzer) {
    globalAnalyzer = new ElectricalAnalyzer(circuitName);
  }
  return globalAnalyzer;
}

/**
 * Reset global analyzer instance
 */
export function resetElectricalAnalyzer(): void {
  globalAnalyzer = null;
}
