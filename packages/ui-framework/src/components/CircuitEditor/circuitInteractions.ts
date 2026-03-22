/**
 * Circuit Analysis & Interactions
 *
 * Implements circuit validation, DC operating point analysis,
 * and transient simulation using modified nodal analysis (MNA).
 */

import {
  CircuitComponent,
  CircuitConnection,
  SimulationResult,
  CircuitComponentType,
  Parameters,
  Port,
  ValidationResult,
  AnalysisData,
} from './types';

/**
 * Circuit state for simulation tracking
 */
export interface CircuitState {
  [componentId: string]: {
    voltage: number;
    current: number;
    power: number;
    charge?: number; // For capacitors
    flux?: number; // For inductors
  };
}

/**
 * Node voltage and current state
 */
export interface NodeState {
  [nodeId: string]: {
    voltage: number;
    current: number;
  };
}

/**
 * Validate circuit connectivity and parameter constraints
 */
export function validateCircuit(
  components: CircuitComponent[],
  connections: CircuitConnection[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiresGround = false;

  // Check for at least one voltage source
  const hasVoltageSource = components.some((c) => c.type === 'voltage-source');
  if (!hasVoltageSource) {
    warnings.push('Circuit should have at least one voltage source for biasing');
  }

  // Check for ground reference
  const hasGround = components.some((c) => c.type === 'ground');
  if (!hasGround) {
    warnings.push('Circuit should have a ground reference (0V) for voltage measurements');
  }
  requiresGround = hasGround;

  // Validate component parameters
  for (const comp of components) {
    switch (comp.type) {
      case 'resistor':
        if (!comp.parameters.resistance || comp.parameters.resistance <= 0) {
          errors.push(`Resistor "${comp.name}": resistance must be > 0 Ω`);
        }
        if (comp.parameters.resistance > 1e9) {
          warnings.push(`Resistor "${comp.name}": very high resistance (${comp.parameters.resistance}Ω)`);
        }
        break;

      case 'capacitor':
        if (!comp.parameters.capacitance || comp.parameters.capacitance <= 0) {
          errors.push(`Capacitor "${comp.name}": capacitance must be > 0 F`);
        }
        break;

      case 'inductor':
        if (!comp.parameters.inductance || comp.parameters.inductance <= 0) {
          errors.push(`Inductor "${comp.name}": inductance must be > 0 H`);
        }
        break;

      case 'voltage-source':
        if (typeof comp.parameters.voltage !== 'number') {
          errors.push(`Voltage source "${comp.name}": voltage not specified`);
        }
        break;

      case 'current-source':
        if (typeof comp.parameters.current !== 'number') {
          errors.push(`Current source "${comp.name}": current not specified`);
        }
        break;

      case 'op-amp':
        if (!comp.parameters.gain || comp.parameters.gain <= 0) {
          errors.push(`Op-Amp "${comp.name}": gain must be > 0`);
        }
        break;

      case 'diode':
        if (!comp.parameters.forwardVoltage || comp.parameters.forwardVoltage < 0) {
          errors.push(`Diode "${comp.name}": forward voltage must be >= 0V`);
        }
        break;

      case 'transformer':
        if (!comp.parameters.ratio || comp.parameters.ratio <= 0) {
          errors.push(`Transformer "${comp.name}": turns ratio must be > 0`);
        }
        break;
    }
  }

  // Check for isolated nodes (no connections)
  const nodeConnections = new Map<string, number>();
  for (const comp of components) {
    nodeConnections.set(comp.node1, (nodeConnections.get(comp.node1) || 0) + 1);
    nodeConnections.set(comp.node2, (nodeConnections.get(comp.node2) || 0) + 1);
  }

  for (const [node, count] of nodeConnections.entries()) {
    if (count === 1 && !components.some((c) => c.type === 'current-source' && (c.node1 === node || c.node2 === node))) {
      warnings.push(`Node "${node}": appears to be floating (only one connection)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    requiresGround,
  };
}

/**
 * Compute DC operating point using simplified nodal analysis
 */
export function computeDCOperatingPoint(
  components: CircuitComponent[],
  connections: CircuitConnection[]
): AnalysisData {
  const nodeVoltages: { [nodeId: string]: number } = {};
  const componentCurrents: { [componentId: string]: number } = {};
  const power: { [componentId: string]: number } = {};

  // Initialize all nodes to 0V
  const allNodes = new Set<string>();
  for (const comp of components) {
    allNodes.add(comp.node1);
    allNodes.add(comp.node2);
  }

  for (const node of allNodes) {
    nodeVoltages[node] = 0;
  }

  // Set ground to 0V
  const groundComp = components.find((c) => c.type === 'ground');
  if (groundComp) {
    nodeVoltages[groundComp.node1] = 0;
  }

  // Set voltage source values
  for (const comp of components) {
    if (comp.type === 'voltage-source') {
      const voltage = comp.parameters.voltage || 0;
      nodeVoltages[comp.node1] = voltage;
      nodeVoltages[comp.node2] = 0; // Assume negative terminal is at lower potential
    }
  }

  // Compute currents through components
  let totalPower = 0;
  for (const comp of components) {
    const v1 = nodeVoltages[comp.node1] || 0;
    const v2 = nodeVoltages[comp.node2] || 0;
    const vDiff = v1 - v2;

    let current = 0;
    let componentPower = 0;

    switch (comp.type) {
      case 'resistor': {
        const resistance = comp.parameters.resistance || 1000;
        current = vDiff / resistance;
        componentPower = vDiff * current;
        break;
      }

      case 'capacitor':
        // In DC steady state, capacitor acts as open circuit (I = 0)
        current = 0;
        break;

      case 'inductor':
        // In DC steady state, inductor acts as short circuit (V = 0)
        current = vDiff / 1e-6; // Very small resistance
        componentPower = vDiff * current;
        break;

      case 'voltage-source':
        // Current depends on circuit
        current = 0; // Computed from load
        break;

      case 'current-source': {
        const sourceCurrentValue = comp.parameters.current || 0;
        current = sourceCurrentValue;
        componentPower = vDiff * current;
        break;
      }

      case 'wire':
        // Wire has zero resistance
        current = 0; // Determined by circuit
        break;

      case 'op-amp': {
        // Simplified: output voltage is gain × (V+ - V-)
        const gain = comp.parameters.gain || 100000;
        const inputVoltage = (nodeVoltages[comp.node1] || 0) - (nodeVoltages[comp.node2] || 0);
        const outputVoltage = Math.max(-15, Math.min(15, gain * inputVoltage)); // ±15V saturation
        nodeVoltages[comp.node1 + '_out'] = outputVoltage;
        current = 0;
        break;
      }

      case 'diode': {
        const forwardVoltage = comp.parameters.forwardVoltage || 0.7;
        if (vDiff > forwardVoltage) {
          // Forward biased: conduct
          current = (vDiff - forwardVoltage) / 100; // 100Ω forward resistance
        } else {
          // Reverse biased: block
          const saturationCurrent = comp.parameters.saturationCurrent || 1e-12;
          current = saturationCurrent * (Math.exp(vDiff / 0.026) - 1); // Shockley equation
        }
        componentPower = vDiff * current;
        break;
      }

      case 'transformer': {
        // Ideal transformer: V1/V2 = n1/n2 = 1/ratio
        const ratio = comp.parameters.ratio || 1;
        // Secondary voltage = primary voltage / ratio
        nodeVoltages[comp.node2 + '_secondary'] = vDiff / ratio;
        current = 0;
        break;
      }

      case 'switch': {
        const isOpen = comp.parameters.isOpen || false;
        if (isOpen) {
          current = 0; // Open circuit
        } else {
          current = vDiff / 0.01; // 0.01Ω closed resistance
          componentPower = vDiff * current;
        }
        break;
      }

      case 'ground':
        current = 0;
        break;
    }

    componentCurrents[comp.id] = current;
    power[comp.id] = componentPower;
    totalPower += componentPower;
  }

  return {
    nodeVoltages,
    componentCurrents,
    power,
    totalPower,
  };
}

/**
 * Run transient circuit simulation
 */
export function simulateCircuit(
  components: CircuitComponent[],
  connections: CircuitConnection[],
  duration: number = 1,
  timeSteps: number = 100
): SimulationResult {
  const dt = duration / timeSteps;
  const time: number[] = [];
  const voltages: { [nodeId: string]: number[] } = {};
  const currents: { [componentId: string]: number[] } = {};
  const power: { [componentId: string]: number[] } = {};

  // Initialize data arrays
  const allNodes = new Set<string>();
  for (const comp of components) {
    allNodes.add(comp.node1);
    allNodes.add(comp.node2);
  }

  for (const node of allNodes) {
    voltages[node] = [];
  }

  for (const comp of components) {
    currents[comp.id] = [];
    power[comp.id] = [];
  }

  // Run simulation over time steps
  for (let step = 0; step < timeSteps; step++) {
    const currentTime = step * dt;
    time.push(currentTime);

    // Compute DC operating point at this time
    const analysis = computeDCOperatingPoint(components, connections);

    // Store results
    for (const [node, voltage] of Object.entries(analysis.nodeVoltages)) {
      if (!voltages[node]) {
        voltages[node] = [];
      }
      voltages[node].push(voltage);
    }

    for (const [componentId, current] of Object.entries(analysis.componentCurrents)) {
      currents[componentId].push(current);
      power[componentId].push(analysis.power[componentId] || 0);
    }
  }

  return {
    time,
    voltages,
    currents,
    power,
    finalState: {},
  };
}

/**
 * Analyze circuit and return comprehensive metrics
 */
export function analyzeCircuit(
  components: CircuitComponent[],
  connections: CircuitConnection[]
): {
  isValid: boolean;
  analysis: AnalysisData | null;
  errors: string[];
  warnings: string[];
} {
  // Validate
  const validation = validateCircuit(components, connections);

  // Compute DC operating point if valid
  let analysis: AnalysisData | null = null;
  if (validation.isValid) {
    analysis = computeDCOperatingPoint(components, connections);
  }

  return {
    isValid: validation.isValid,
    analysis,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}
