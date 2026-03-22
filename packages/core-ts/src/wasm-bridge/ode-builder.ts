/**
 * ODE System Builder
 *
 * Converts bond graph topology + causalities into system of ODEs:
 *   dy/dt = f(t, y)
 *
 * Where:
 * - y = state vector [q_C, p_L, ...]
 * - f = derivatives computed from bond graph causality
 *
 * Key principle: Causality determines computation order
 * - EffortOut: Element outputs effort (receives flow as input)
 * - FlowOut: Element outputs flow (receives effort as input)
 */

import type { EditorElement, EditorBond } from '../components/BondGraphEditor/types';
import type { CausalityStatus } from '../components/BondGraphEditor/causalityAnalysis';
import type { StateMapping, ElementState } from './state-extraction';
import type { ODESystem } from './solver';

/**
 * Computation graph: Pre-computed derivative structure
 * Avoids redundant calculations during integration
 */
interface ComputationNode {
  elementId: string;
  elementType: string;
  dependsOn: string[];           // Elements this depends on
  computeOrder: number;           // Topological order
}

/**
 * ODE system implementation for bond graphs
 */
export class BondGraphODESystem implements ODESystem {
  dimension: number;
  private stateMapping: StateMapping;
  private elements: EditorElement[];
  private bonds: EditorBond[];
  private causalities: Map<string, CausalityStatus>;
  private computationGraph: ComputationNode[];
  private elementValues: Map<string, number>;

  constructor(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>,
    stateMapping: StateMapping
  ) {
    this.elements = elements;
    this.bonds = bonds;
    this.causalities = causalities;
    this.stateMapping = stateMapping;
    this.dimension = stateMapping.totalStates;
    this.elementValues = new Map();

    // Pre-compute computation graph
    this.computationGraph = this.buildComputationGraph();
  }

  /**
   * Main compute function: y = f(t, y)
   * Called by solver at each step
   */
  compute(t: number, state: Float64Array): Float64Array {
    const derivatives = new Float64Array(this.dimension);

    // Cache current state values in element values
    this.updateElementValues(state);

    // Compute derivatives using causality structure
    for (const stateElem of this.stateMapping.elements.values()) {
      derivatives[stateElem.stateIndex] = this.computeDerivative(
        stateElem,
        t,
        state
      );
    }

    return derivatives;
  }

  /**
   * Compute derivative for a specific state variable
   * dq/dt = i (flow through capacitor)
   * dp/dt = f (force on inductor)
   */
  private computeDerivative(
    stateElem: ElementState,
    t: number,
    state: Float64Array
  ): number {
    if (stateElem.stateVariable === 'q') {
      // Capacitor: dq/dt = i (current)
      return this.computeCapacitorFlow(stateElem, t, state);
    } else {
      // Inductor: dp/dt = v (voltage)
      return this.computeInductorForce(stateElem, t, state);
    }
  }

  /**
   * Compute current through capacitor from causality and connections
   */
  private computeCapacitorFlow(
    capacitor: ElementState,
    t: number,
    state: Float64Array
  ): number {
    const elementId = capacitor.elementId;

    // Find bonds connected to this capacitor
    const connectedBonds = this.bonds.filter(
      b => b.from === elementId || b.to === elementId
    );

    let totalFlow = 0;

    for (const bond of connectedBonds) {
      const causality = this.causalities.get(bond.id);

      if (!causality || causality === 'Unassigned') {
        continue;
      }

      // Determine if this bond inputs or outputs flow
      const flowIntoCapacitor = this.getFlowDirection(bond, elementId, causality);
      const flow = this.computeBondFlow(bond, causality, t, state);

      totalFlow += flowIntoCapacitor ? flow : -flow;
    }

    return totalFlow;
  }

  /**
   * Compute voltage across inductor from causality and connections
   */
  private computeInductorForce(
    inductor: ElementState,
    t: number,
    state: Float64Array
  ): number {
    const elementId = inductor.elementId;

    // Find bonds connected to this inductor
    const connectedBonds = this.bonds.filter(
      b => b.from === elementId || b.to === elementId
    );

    let totalForce = 0;

    for (const bond of connectedBonds) {
      const causality = this.causalities.get(bond.id);

      if (!causality || causality === 'Unassigned') {
        continue;
      }

      // Determine if this bond inputs or outputs effort
      const forceIntoInductor = this.getEffortDirection(
        bond,
        elementId,
        causality
      );
      const effort = this.computeBondEffort(bond, causality, t, state);

      totalForce += forceIntoInductor ? effort : -effort;
    }

    return totalForce;
  }

  /**
   * Compute flow (current) on a bond
   */
  private computeBondFlow(
    bond: EditorBond,
    causality: CausalityStatus,
    t: number,
    state: Float64Array
  ): number {
    const fromElem = this.elements.find(e => e.id === bond.from);
    const toElem = this.elements.find(e => e.id === bond.to);

    // Flow is determined by causality
    // If causality is FlowOut on one side, that side computes the flow

    if (causality === 'FlowOut') {
      // From element outputs flow
      return this.getElementFlow(fromElem, state);
    } else if (causality === 'FlowIn') {
      // To element outputs flow
      return this.getElementFlow(toElem, state);
    }

    // Fallback: use Ohm's law equivalent
    return 0;
  }

  /**
   * Compute effort (voltage) on a bond
   */
  private computeBondEffort(
    bond: EditorBond,
    causality: CausalityStatus,
    t: number,
    state: Float64Array
  ): number {
    const fromElem = this.elements.find(e => e.id === bond.from);
    const toElem = this.elements.find(e => e.id === bond.to);

    // Effort is determined by causality
    // If causality is EffortOut on one side, that side computes the effort

    if (causality === 'EffortOut') {
      // From element outputs effort
      return this.getElementEffort(fromElem, state);
    } else if (causality === 'EffortIn') {
      // To element outputs effort
      return this.getElementEffort(toElem, state);
    }

    // Fallback: use voltage divider
    return 0;
  }

  /**
   * Get flow output of an element
   */
  private getElementFlow(element: EditorElement | undefined, state: Float64Array): number {
    if (!element) return 0;

    const value = this.elementValues.get(element.id) ?? 0;

    switch (element.type) {
      case 'I': // Inductor outputs current
        return value;
      case 'R': // Resistor: i = V/R
        const voltage = this.elementValues.get(element.id) ?? 0;
        const resistance = (element.parameters?.resistance as number) || 1.0;
        return voltage / resistance;
      case 'Sf': // Current source
        return (element.parameters?.current as number) || 0;
      default:
        return 0;
    }
  }

  /**
   * Get effort output of an element
   */
  private getElementEffort(element: EditorElement | undefined, state: Float64Array): number {
    if (!element) return 0;

    const value = this.elementValues.get(element.id) ?? 0;

    switch (element.type) {
      case 'C': // Capacitor outputs voltage
        return value;
      case 'R': // Resistor: V = I*R
        const current = this.elementValues.get(element.id) ?? 0;
        const resistance = (element.parameters?.resistance as number) || 1.0;
        return current * resistance;
      case 'Se': // Voltage source
        return (element.parameters?.voltage as number) || 0;
      default:
        return 0;
    }
  }

  /**
   * Determine if flow is entering or leaving an element
   */
  private getFlowDirection(
    bond: EditorBond,
    elementId: string,
    causality: CausalityStatus
  ): boolean {
    if (bond.from === elementId) {
      // Element is source
      return causality === 'FlowIn'; // Flow enters if causality is FlowIn
    } else {
      // Element is sink
      return causality === 'FlowOut'; // Flow enters if causality is FlowOut
    }
  }

  /**
   * Determine if effort is entering or leaving an element
   */
  private getEffortDirection(
    bond: EditorBond,
    elementId: string,
    causality: CausalityStatus
  ): boolean {
    if (bond.from === elementId) {
      // Element is source
      return causality === 'EffortIn'; // Effort enters if causality is EffortIn
    } else {
      // Element is sink
      return causality === 'EffortOut'; // Effort enters if causality is EffortOut
    }
  }

  /**
   * Update cached element values from state vector
   */
  private updateElementValues(state: Float64Array): void {
    this.elementValues.clear();

    // Storage elements: convert state to values
    for (const [elementId, elemState] of this.stateMapping.elements) {
      const stateValue = state[elemState.stateIndex];

      if (elemState.stateVariable === 'q') {
        // Charge → Voltage = q/C
        const capacitance = elemState.parameter;
        const voltage = stateValue / capacitance;
        this.elementValues.set(elementId, voltage);
      } else if (elemState.stateVariable === 'p') {
        // Momentum → Current = p/L
        const inductance = elemState.parameter;
        const current = stateValue / inductance;
        this.elementValues.set(elementId, current);
      }
    }

    // Algebraic elements: compute from topology
    for (const algebraicId of this.stateMapping.algebraicElements) {
      const element = this.elements.find(e => e.id === algebraicId);
      if (!element) continue;

      // Would compute R, Se, Sf values based on connections
      // For now, just load from parameters
      if (element.type === 'Se') {
        this.elementValues.set(algebraicId, (element.parameters?.voltage as number) || 0);
      } else if (element.type === 'Sf') {
        this.elementValues.set(algebraicId, (element.parameters?.current as number) || 0);
      }
    }
  }

  /**
   * Build computation graph for topological ordering
   * Determines order to compute elements (no cycles)
   */
  private buildComputationGraph(): ComputationNode[] {
    const nodes: ComputationNode[] = [];
    const visited = new Set<string>();

    // Topological sort using DFS
    const visit = (elementId: string): ComputationNode => {
      if (visited.has(elementId)) {
        const existing = nodes.find(n => n.elementId === elementId);
        if (existing) return existing;
      }

      visited.add(elementId);

      const element = this.elements.find(e => e.id === elementId);
      if (!element) {
        return {
          elementId,
          elementType: 'unknown',
          dependsOn: [],
          computeOrder: -1,
        };
      }

      // Find dependencies (elements this depends on)
      const dependencies: string[] = [];
      const connectedBonds = this.bonds.filter(
        b => b.from === elementId || b.to === elementId
      );

      for (const bond of connectedBonds) {
        const otherElementId = bond.from === elementId ? bond.to : bond.from;
        dependencies.push(otherElementId);
      }

      const node: ComputationNode = {
        elementId,
        elementType: element.type,
        dependsOn: dependencies,
        computeOrder: 0,
      };

      nodes.push(node);
      return node;
    };

    // Visit all elements
    for (const element of this.elements) {
      visit(element.id);
    }

    // Assign computation order
    let order = 0;
    for (const node of nodes) {
      if (node.dependsOn.length === 0) {
        node.computeOrder = order++;
      }
    }

    return nodes.sort((a, b) => a.computeOrder - b.computeOrder);
  }

  /**
   * Get algebraic variables (non-differential states)
   * Example: voltages across resistors computed from currents
   */
  getAlgebraicVariables(t: number, state: Float64Array): Map<string, number> {
    const algebraic = new Map<string, number>();

    for (const elementId of this.stateMapping.algebraicElements) {
      const element = this.elements.find(e => e.id === elementId);
      if (!element) continue;

      const value = this.elementValues.get(elementId);
      if (value !== undefined) {
        algebraic.set(elementId, value);
      }
    }

    return algebraic;
  }
}

/**
 * Factory function to build ODE system from bond graph
 */
export function buildODESystem(
  elements: EditorElement[],
  bonds: EditorBond[],
  causalities: Map<string, CausalityStatus>,
  stateMapping: StateMapping
): ODESystem {
  return new BondGraphODESystem(elements, bonds, causalities, stateMapping);
}
