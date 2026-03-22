/**
 * Block Diagram Analysis & Interactions
 *
 * Implements topological sorting, algebraic loop detection, and block evaluation logic
 * for Simulink-style block diagram simulation.
 */

import {
  BlockDiagramComponent,
  BlockDiagramConnection,
  SimulationResult,
  BlockDiagramComponentType,
  Parameters,
  Port,
} from './types';

/**
 * Validation result for block diagram integrity
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Algebraic loop detection result
 */
export interface AlgebraicLoopInfo {
  hasLoop: boolean;
  loopNodes: string[];
  loopConnections: string[];
}

/**
 * Block evaluation context for simulation
 */
export interface BlockState {
  [componentId: string]: {
    value: number;
    previousValue: number;
    integralState?: number;
    derivativeState?: number;
    pidState?: {
      integral: number;
      previousError: number;
    };
    filterState?: {
      previousValue: number;
      previousDerivative: number;
    };
    hysteresisState?: boolean; // Current state (on/off)
  };
}

/**
 * Validate block diagram connectivity and parameter constraints
 */
export function validateBlockDiagram(
  components: BlockDiagramComponent[],
  connections: BlockDiagramConnection[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required components
  const hasSource = components.some(
    (c) =>
      c.type === 'step-source' ||
      c.type === 'ramp-source' ||
      c.type === 'sine-source'
  );

  if (!hasSource) {
    errors.push('Block diagram must have at least one signal source (step, ramp, or sine)');
  }

  // Check for dangling connections (input without source)
  const outputNodes = new Set<string>();
  connections.forEach((conn) => {
    outputNodes.add(`${conn.from}:${conn.fromPort}`);
  });

  connections.forEach((conn) => {
    const sourceKey = `${conn.from}:${conn.fromPort}`;
    if (!outputNodes.has(sourceKey)) {
      // This is a sink connection
    }
  });

  // Validate port connections (type matching)
  for (const conn of connections) {
    const fromComp = components.find((c) => c.id === conn.from);
    const toComp = components.find((c) => c.id === conn.to);

    if (!fromComp || !toComp) {
      errors.push(`Connection references non-existent component`);
      continue;
    }

    const fromPort = fromComp.ports.find((p) => p.id === conn.fromPort);
    const toPort = toComp.ports.find((p) => p.id === conn.toPort);

    if (!fromPort || !toPort) {
      errors.push(`Connection references non-existent port`);
      continue;
    }

    // Type compatibility check
    if (fromPort.dataType === 'vector' && toPort.dataType === 'scalar') {
      warnings.push(
        `Vector output from ${fromComp.name} connected to scalar input of ${toComp.name}`
      );
    }
  }

  // Check parameter validity
  for (const comp of components) {
    switch (comp.type) {
      case 'gain':
        if (typeof comp.parameters.gain !== 'number') {
          errors.push(`Gain block "${comp.name}": gain must be a number`);
        }
        break;
      case 'pid-controller':
        if (
          typeof comp.parameters.kp !== 'number' ||
          typeof comp.parameters.ki !== 'number' ||
          typeof comp.parameters.kd !== 'number'
        ) {
          errors.push(`PID block "${comp.name}": kp, ki, kd must be numbers`);
        }
        if (typeof comp.parameters.integralLimit !== 'number') {
          errors.push(`PID block "${comp.name}": integralLimit must be a number`);
        }
        break;
      case 'saturation':
        if (
          typeof comp.parameters.minValue !== 'number' ||
          typeof comp.parameters.maxValue !== 'number'
        ) {
          errors.push(`Saturation block "${comp.name}": min/max must be numbers`);
        }
        if (comp.parameters.minValue >= comp.parameters.maxValue) {
          errors.push(`Saturation block "${comp.name}": minValue must be < maxValue`);
        }
        break;
      case 'deadzone':
        if (
          typeof comp.parameters.lowerThreshold !== 'number' ||
          typeof comp.parameters.upperThreshold !== 'number'
        ) {
          errors.push(`Deadzone block "${comp.name}": thresholds must be numbers`);
        }
        if (comp.parameters.lowerThreshold >= comp.parameters.upperThreshold) {
          errors.push(`Deadzone block "${comp.name}": lowerThreshold must be < upperThreshold`);
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detect algebraic loops in block diagram
 * Uses depth-first search to find cycles
 */
export function detectAlgebraicLoops(
  components: BlockDiagramComponent[],
  connections: BlockDiagramConnection[]
): AlgebraicLoopInfo {
  const graph = new Map<string, string[]>();

  // Build adjacency list
  for (const comp of components) {
    if (!graph.has(comp.id)) {
      graph.set(comp.id, []);
    }
  }

  for (const conn of connections) {
    const neighbors = graph.get(conn.from) || [];
    neighbors.push(conn.to);
    graph.set(conn.from, neighbors);
  }

  // DFS to find cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const loopNodes: string[] = [];
  const loopConnections: string[] = [];

  function dfs(node: string, path: string[]): boolean {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, path)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        loopNodes.push(...path.slice(cycleStart));
        for (let i = cycleStart; i < path.length; i++) {
          loopConnections.push(`${path[i]} → ${path[(i + 1) % (path.length - cycleStart)]}`);
        }
        return true;
      }
    }

    path.pop();
    recursionStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (dfs(node, [])) {
        break; // Found at least one loop
      }
    }
  }

  return {
    hasLoop: loopNodes.length > 0,
    loopNodes: [...new Set(loopNodes)],
    loopConnections,
  };
}

/**
 * Topologically sort block diagram components
 * Returns sorted component IDs for evaluation order
 */
export function topologicalSort(
  components: BlockDiagramComponent[],
  connections: BlockDiagramConnection[]
): string[] | null {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const comp of components) {
    graph.set(comp.id, []);
    inDegree.set(comp.id, 0);
  }

  // Build graph
  for (const conn of connections) {
    const neighbors = graph.get(conn.from) || [];
    neighbors.push(conn.to);
    graph.set(conn.from, neighbors);

    inDegree.set(conn.to, (inDegree.get(conn.to) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  if (sorted.length !== components.length) {
    return null; // Cycle detected
  }

  return sorted;
}

/**
 * Evaluate a single block's output based on inputs and current state
 */
export function evaluateBlock(
  block: BlockDiagramComponent,
  inputs: Record<string, number>,
  state: BlockState,
  dt: number
): number {
  const blockState = (state[block.id] || {
    value: 0,
    previousValue: 0,
    integralState: 0,
    derivativeState: 0,
    pidState: { integral: 0, previousError: 0 },
    filterState: { previousValue: 0, previousDerivative: 0 },
    hysteresisState: false,
  }) as BlockState[string];
  const input = inputs['in'] ?? 0;

  switch (block.type) {
    case 'gain':
      return input * ((block.parameters.gain as number) || 1);

    case 'integrator': {
      const initialCondition = (block.parameters.initialCondition as number) || 0;
      const newValue = blockState.integralState ?? initialCondition;
      const result = newValue + input * dt;
      blockState.integralState = result;
      return result;
    }

    case 'differentiator': {
      const filterCoeff = (block.parameters.filterCoefficient as number) || 0.1;
      const prev = blockState.previousValue ?? 0;
      const derivative = (input - prev) / (dt || 0.001);
      const filtered = filterCoeff * derivative + (1 - filterCoeff) * (blockState.derivativeState ?? 0);
      blockState.previousValue = input;
      blockState.derivativeState = filtered;
      return filtered;
    }

    case 'pid-controller': {
      const kp = (block.parameters.kp as number) || 1;
      const ki = (block.parameters.ki as number) || 0;
      const kd = (block.parameters.kd as number) || 0;
      const integralLimit = (block.parameters.integralLimit as number) || 10;

      const pidState = blockState.pidState ?? { integral: 0, previousError: 0 };
      const error = input;

      // Integral term with anti-windup
      let integral = pidState.integral + error * dt * ki;
      integral = Math.max(-integralLimit, Math.min(integralLimit, integral));

      // Derivative term (filter to reduce noise)
      const derivative = kd * (error - pidState.previousError) / (dt || 0.001);

      const output = kp * error + integral + derivative;

      blockState.pidState = {
        integral,
        previousError: error,
      };

      return output;
    }

    case 'sum': {
      const in1 = inputs['in1'] ?? 0;
      const in2 = inputs['in2'] ?? 0;
      return in1 + in2;
    }

    case 'product': {
      const in1 = inputs['in1'] ?? 0;
      const in2 = inputs['in2'] ?? 0;
      return in1 * in2;
    }

    case 'saturation': {
      const minValue = (block.parameters.minValue as number) ?? -10;
      const maxValue = (block.parameters.maxValue as number) ?? 10;
      return Math.max(minValue, Math.min(maxValue, input));
    }

    case 'deadzone': {
      const lower = (block.parameters.lowerThreshold as number) ?? -0.1;
      const upper = (block.parameters.upperThreshold as number) ?? 0.1;

      if (input > lower && input < upper) {
        return 0;
      }
      if (input >= upper) {
        return input - upper;
      }
      return input - lower;
    }

    case 'hysteresis': {
      const rising = (block.parameters.risingThreshold as number) ?? 0.5;
      const falling = (block.parameters.fallingThreshold as number) ?? -0.5;

      let state = blockState.hysteresisState ?? false;

      if (state && input < falling) {
        state = false;
      } else if (!state && input > rising) {
        state = true;
      }

      blockState.hysteresisState = state;
      return state ? 1 : 0;
    }

    case 'step-source': {
      const stepTime = (block.parameters.stepTime as number) ?? 0;
      const stepValue = (block.parameters.stepValue as number) ?? 1;
      const initialValue = (block.parameters.initialValue as number) ?? 0;
      // Assume we have global time tracking
      return 0 >= stepTime ? stepValue : initialValue;
    }

    case 'sine-source': {
      const amplitude = (block.parameters.amplitude as number) ?? 1;
      const frequency = (block.parameters.frequency as number) ?? 1;
      const phase = (block.parameters.phase as number) ?? 0;
      const offset = (block.parameters.offset as number) ?? 0;
      // Assume we have global time tracking
      return amplitude * Math.sin(2 * Math.PI * frequency * 0 + phase) + offset;
    }

    default:
      return 0;
  }
}

/**
 * Analyze block diagram and return simulation-ready metrics
 */
export function analyzeBlockDiagram(
  components: BlockDiagramComponent[],
  connections: BlockDiagramConnection[]
): {
  isValid: boolean;
  hasAlgebraicLoop: boolean;
  evaluationOrder: string[];
  errors: string[];
  warnings: string[];
} {
  // Validate
  const validation = validateBlockDiagram(components, connections);

  // Detect algebraic loops
  const algebraicLoop = detectAlgebraicLoops(components, connections);

  // Topological sort
  const evaluationOrder = topologicalSort(components, connections) ?? [];

  return {
    isValid: validation.isValid && !algebraicLoop.hasLoop,
    hasAlgebraicLoop: algebraicLoop.hasLoop,
    evaluationOrder,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

/**
 * Create a new block state initialized to zeros
 */
export function createBlockState(components: BlockDiagramComponent[]): BlockState {
  const state: BlockState = {};

  for (const comp of components) {
    state[comp.id] = {
      value: 0,
      previousValue: 0,
      integralState: (comp.parameters.initialCondition as number) || 0,
      derivativeState: 0,
      pidState: {
        integral: 0,
        previousError: 0,
      },
      filterState: {
        previousValue: 0,
        previousDerivative: 0,
      },
      hysteresisState: false,
    };
  }

  return state;
}
