/**
 * Circuit Simulator - Main integration point
 *
 * Orchestrates:
 * - Netlist parsing
 * - Component model lookup
 * - Simulation execution
 * - Result management
 */

import { Netlist, PlacedSymbol, Wire } from '../../../ui-framework/src/components/SchematicEditor/types';
import {
  generateNetlist,
  generateSpiceNetlist,
  validateNetlist
} from '../../../ui-framework/src/components/SchematicEditor/netlistGenerator';
import { SimulationBridge, SimulationResult, SimulationConfig, Measurement, Probe } from './SimulationBridge';
import { NetlistParser, ParsedNetlist, ParsedComponent } from './NetlistParser';

/**
 * Component model for simulation
 */
export interface ComponentModel {
  refdes: string;
  type: string;
  nodes: string[];
  value: number;
  parameters?: Record<string, any>;
}

/**
 * Circuit simulator main class
 */
export class CircuitSimulator {
  private bridge: SimulationBridge;
  private parser: NetlistParser;
  private isRunning: boolean = false;
  private simulationTime: number = 0;

  constructor() {
    this.bridge = new SimulationBridge();
    this.parser = new NetlistParser();
  }

  /**
   * Simulate circuit from schematic
   */
  async simulateSchematic(
    symbols: PlacedSymbol[],
    wires: Wire[],
    config?: Partial<SimulationConfig>
  ): Promise<SimulationResult> {
    // Generate netlist from schematic
    const netlist = generateNetlist(symbols, wires, 'Simulated Circuit');

    // Validate
    const errors = validateNetlist(symbols, wires);
    if (errors.some(e => e.severity === 'error')) {
      return {
        success: false,
        duration: 0,
        error: 'Circuit validation failed',
        nodeVoltages: {},
        componentCurrents: {},
        componentPowers: {},
        timestamp: Date.now(),
        simulationTime: 0,
      };
    }

    // Convert to SPICE netlist
    const spiceNetlist = generateSpiceNetlist(symbols, wires);

    // Run simulation
    return this.simulateNetlist(spiceNetlist, config);
  }

  /**
   * Simulate from SPICE netlist string
   */
  async simulateNetlist(
    spiceText: string,
    config?: Partial<SimulationConfig>
  ): Promise<SimulationResult> {
    const startTime = Date.now();

    try {
      this.isRunning = true;

      // Parse netlist
      const parsed = this.parser.parseNetlist(spiceText);

      if (parsed.errors.length > 0) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: `Parse error: ${parsed.errors.join(', ')}`,
          nodeVoltages: {},
          componentCurrents: {},
          componentPowers: {},
          timestamp: Date.now(),
          simulationTime: 0,
        };
      }

      // Build component models
      const components = this.buildComponentModels(parsed);

      // Run simulation (stub for now - calls actual WASM solver)
      const result = await this.runSimulation(components, parsed, config);

      this.bridge.setResult(result);

      return result;
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: `Simulation error: ${error}`,
        nodeVoltages: {},
        componentCurrents: {},
        componentPowers: {},
        timestamp: Date.now(),
        simulationTime: 0,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Build component models from parsed netlist
   */
  private buildComponentModels(parsed: ParsedNetlist): ComponentModel[] {
    return parsed.components.map(comp => ({
      refdes: comp.refdes,
      type: comp.type,
      nodes: comp.nodes,
      value: this.parser.parseValue(comp.value),
      parameters: comp.parameters,
    }));
  }

  /**
   * Run simulation with ODE solver
   * This is where the actual WASM solver would be called
   */
  private async runSimulation(
    components: ComponentModel[],
    parsed: ParsedNetlist,
    config?: Partial<SimulationConfig>
  ): Promise<SimulationResult> {
    const mergedConfig = { ...SimulationBridge.getDefaultConfig(), ...config };

    // TODO: Call actual WASM ODE solver here
    // For now, return mock results for demonstration

    const nodeVoltages: Record<string, number> = {};
    const componentCurrents: Record<string, number> = {};
    const componentPowers: Record<string, number> = {};

    // Initialize node voltages
    for (const node of parsed.nodes) {
      nodeVoltages[node] = 0;
    }

    // Run ODE solver simulation
    // Mock implementation: simple linear circuit analysis
    for (const comp of components) {
      if (comp.type === 'V') {
        // Voltage source: set node voltage
        nodeVoltages[comp.nodes[0]] = comp.value;
      } else if (comp.type === 'R' && comp.value > 0) {
        // Resistor: calculate current
        const v1 = nodeVoltages[comp.nodes[0]] || 0;
        const v2 = nodeVoltages[comp.nodes[1]] || 0;
        const current = (v1 - v2) / comp.value;

        componentCurrents[comp.refdes] = current;
        componentPowers[comp.refdes] = current * current * comp.value;
      }
    }

    // Ground node voltage
    nodeVoltages[parsed.groundNode] = 0;

    const duration = Date.now();

    return {
      success: true,
      duration,
      nodeVoltages,
      componentCurrents,
      componentPowers,
      timestamp: Date.now(),
      simulationTime: mergedConfig.duration,
    };
  }

  /**
   * Get simulation bridge for measurements/probes
   */
  getBridge(): SimulationBridge {
    return this.bridge;
  }

  /**
   * Add voltage measurement at node
   */
  addVoltageMeasurement(nodeName: string): string {
    return this.bridge.addMeasurement('voltage', 'node', nodeName, 'V');
  }

  /**
   * Add current measurement through component
   */
  addCurrentMeasurement(componentRef: string): string {
    return this.bridge.addMeasurement('current', 'component', componentRef, 'A');
  }

  /**
   * Add power measurement
   */
  addPowerMeasurement(componentRef: string): string {
    return this.bridge.addMeasurement('power', 'component', componentRef, 'W');
  }

  /**
   * Add voltage probe for real-time tracking
   */
  addVoltageProbe(nodeName: string): string {
    return this.bridge.addProbe('voltage', nodeName);
  }

  /**
   * Add current probe for real-time tracking
   */
  addCurrentProbe(componentRef: string): string {
    return this.bridge.addProbe('current', componentRef);
  }

  /**
   * Remove measurement
   */
  removeMeasurement(id: string): boolean {
    return this.bridge.removeMeasurement(id);
  }

  /**
   * Remove probe
   */
  removeProbe(id: string): boolean {
    return this.bridge.removeProbe(id);
  }

  /**
   * Get all measurements
   */
  getMeasurements() {
    return this.bridge.getMeasurements();
  }

  /**
   * Get all probes
   */
  getProbes() {
    return this.bridge.getProbes();
  }

  /**
   * Get result
   */
  getResult(): SimulationResult | null {
    return this.bridge.getResult();
  }

  /**
   * Get summary
   */
  getSummary() {
    return this.bridge.getSummary();
  }

  /**
   * Check if simulation is running
   */
  isSimulationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.bridge.clear();
  }

  /**
   * Export simulation data
   */
  export(): string {
    return this.bridge.exportResults();
  }
}

// Export singleton instance
export const circuitSimulator = new CircuitSimulator();
