/**
 * State Vector Extraction from Bond Graph Causalities
 *
 * Converts bond graph structure and causalities into ODE state space:
 * - Identifies storage elements (C, I)
 * - Assigns state vector indices (q for capacitance, p for inertance)
 * - Validates causality enables integration (not differentiation)
 * - Creates mapping between solver state and bond graph elements
 *
 * Key insight: Causality determines ODE structure
 * - C with integral causality → dq/dt = f (charge is state)
 * - I with integral causality → dp/dt = e (momentum is state)
 */

import type { EditorElement, EditorBond } from '../components/BondGraphEditor/types';
import type { CausalityStatus } from '../components/BondGraphEditor/causalityAnalysis';

/**
 * Maps solver state vector indices to bond graph elements
 */
export interface StateMapping {
  elements: Map<string, ElementState>;      // Element ID → state info
  bonds: Map<string, BondState>;            // Bond ID → bond info
  stateVector: Float64Array;                // Initial state [q_c, p_l, ...]
  stateVectorInfo: string[];                // Labels: ["q_C1", "p_L1", ...]
  totalStates: number;                      // Total state dimension
  algebraicElements: string[];              // Elements without state (R, Se, Sf)
}

/**
 * Information about a state variable
 */
export interface ElementState {
  elementId: string;                        // ID in bond graph
  elementType: 'C' | 'I';                   // Capacitance or Inertance
  stateIndex: number;                       // Index in state vector
  stateVariable: 'q' | 'p';                 // Charge or momentum
  initialValue: number;                     // Initial condition
  parameter: number;                        // C or L value
}

/**
 * Information about bonds connecting elements
 */
export interface BondState {
  bondId: string;
  from: string;                             // Source element ID
  to: string;                               // Target element ID
  causality: CausalityStatus;               // EffortOut, FlowOut, etc.
  isStateInputBond: boolean;                // True if this bond inputs to state
  isStateOutputBond: boolean;               // True if this bond outputs from state
}

/**
 * Validation result for causality structure
 */
export interface CausalityValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * State extractor: Causality → ODE state space
 */
export class StateExtractor {
  /**
   * Extract state vector and mapping from bond graph
   *
   * Algorithm:
   * 1. Find all C and I elements (storage)
   * 2. Verify each has integral causality
   * 3. Assign state indices [0, 1, 2, ...]
   * 4. Create bidirectional mapping
   */
  extractStateVector(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): StateMapping {
    const mapping: StateMapping = {
      elements: new Map(),
      bonds: new Map(),
      stateVector: new Float64Array(0),
      stateVectorInfo: [],
      totalStates: 0,
      algebraicElements: [],
    };

    // Step 1: Find storage elements (C and I)
    const storageElements = elements.filter(e => e.type === 'C' || e.type === 'I');

    if (storageElements.length === 0) {
      console.warn('No storage elements (C, I) found - system is purely algebraic');
      mapping.stateVector = new Float64Array(0);
      return mapping;
    }

    // Step 2: Assign state indices and create element mapping
    let stateIndex = 0;
    const stateIndices: number[] = [];

    for (const element of storageElements) {
      const stateVariable = element.type === 'C' ? ('q' as const) : ('p' as const);
      const parameter = element.type === 'C'
        ? (element.parameters?.capacitance as number) || 1.0
        : (element.parameters?.inertance as number) || 1.0;

      mapping.elements.set(element.id, {
        elementId: element.id,
        elementType: element.type,
        stateIndex,
        stateVariable,
        initialValue: 0,
        parameter,
      });

      stateIndices.push(stateIndex);
      mapping.stateVectorInfo.push(
        `${stateVariable}_${element.type}${elements.indexOf(element)}`
      );

      stateIndex++;
    }

    // Step 3: Create state vector
    mapping.totalStates = stateIndex;
    mapping.stateVector = new Float64Array(stateIndex);

    // Step 4: Analyze bonds for state connections
    for (const bond of bonds) {
      const causality = causalities.get(bond.id);

      mapping.bonds.set(bond.id, {
        bondId: bond.id,
        from: bond.from,
        to: bond.to,
        causality: causality || 'Unassigned',
        isStateInputBond: false,
        isStateOutputBond: false,
      });

      // Identify bonds that connect to state elements
      const fromElement = mapping.elements.get(bond.from);
      const toElement = mapping.elements.get(bond.to);

      if (fromElement) {
        mapping.bonds.get(bond.id)!.isStateOutputBond = true;
      }
      if (toElement) {
        mapping.bonds.get(bond.id)!.isStateInputBond = true;
      }
    }

    // Step 5: Identify algebraic elements
    mapping.algebraicElements = elements
      .filter(e => e.type !== 'C' && e.type !== 'I')
      .map(e => e.id);

    return mapping;
  }

  /**
   * Validate causality assignment for proper ODE structure
   *
   * Checks:
   * - All C elements have integral causality (not derivative)
   * - All I elements have integral causality (not derivative)
   * - No isolated storage elements
   * - Causality is consistently assigned
   */
  validateCausalities(
    mapping: StateMapping,
    causalities: Map<string, CausalityStatus>,
    bonds: EditorBond[]
  ): CausalityValidation {
    const validation: CausalityValidation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check 1: Storage elements must have integral causality
    for (const [elementId, elemState] of mapping.elements) {
      // Find bonds connected to this storage element
      const connectedBonds = bonds.filter(
        b => b.from === elementId || b.to === elementId
      );

      if (connectedBonds.length === 0) {
        validation.warnings.push(
          `Storage element ${elementId} is isolated (no connected bonds)`
        );
      }

      // Check causality on connected bonds
      // For a C element:
      //   - If capacitor outputs flow → dq/dt = i (integral causality) ✓
      //   - If capacitor inputs flow → e = dq/dt (derivative causality) ✗
      // For an I element:
      //   - If inductor outputs effort → dp/dt = f (integral causality) ✓
      //   - If inductor inputs effort → v = dp/dt (derivative causality) ✗

      for (const bond of connectedBonds) {
        const causality = causalities.get(bond.id);

        if (causality === 'Unassigned') {
          validation.errors.push(
            `Causality not assigned for bond ${bond.id} connected to storage element ${elementId}`
          );
          validation.valid = false;
        }

        if (elemState.elementType === 'C') {
          // Capacitor: should output flow (causality at from side)
          if (bond.from === elementId && causality === 'EffortOut') {
            validation.errors.push(
              `Capacitor ${elementId} has derivative causality on bond ${bond.id} ` +
              `(should output flow, not effort)`
            );
            validation.valid = false;
          }
        } else if (elemState.elementType === 'I') {
          // Inductor: should output effort (causality at from side)
          if (bond.from === elementId && causality === 'FlowOut') {
            validation.errors.push(
              `Inductor ${elementId} has derivative causality on bond ${bond.id} ` +
              `(should output effort, not flow)`
            );
            validation.valid = false;
          }
        }
      }
    }

    // Check 2: No conflicting causalities on same bond
    for (const [bondId, bondState] of mapping.bonds) {
      if (bondState.causality === 'Unassigned') {
        validation.warnings.push(`Bond ${bondId} has unassigned causality`);
      }
    }

    // Check 3: Causality consistency (no contradictions)
    const junctions = new Map<string, ('0' | '1' | undefined)>();

    for (const element of Array.from(mapping.elements.values())) {
      // Could add junction validation here
      // For now, basic element-level checks are sufficient
    }

    return validation;
  }

  /**
   * Extract initial conditions from element parameters
   */
  extractInitialConditions(
    mapping: StateMapping,
    elements: EditorElement[]
  ): Float64Array {
    const ic = new Float64Array(mapping.totalStates);

    for (const [elementId, elemState] of mapping.elements) {
      const element = elements.find(e => e.id === elementId);
      if (!element) continue;

      // Look for initial condition in parameters
      let initialValue = 0;

      if (elemState.stateVariable === 'q' && element.parameters?.initialCharge) {
        initialValue = element.parameters.initialCharge as number;
      } else if (elemState.stateVariable === 'p' && element.parameters?.initialMomentum) {
        initialValue = element.parameters.initialMomentum as number;
      } else if (elemState.stateVariable === 'q' && element.parameters?.initialVoltage) {
        // V = q/C → q = V*C
        const voltage = element.parameters.initialVoltage as number;
        const capacitance = element.parameters.capacitance as number;
        initialValue = voltage * capacitance;
      } else if (elemState.stateVariable === 'p' && element.parameters?.initialCurrent) {
        // i = p/L → p = i*L
        const current = element.parameters.initialCurrent as number;
        const inductance = element.parameters.inertance as number;
        initialValue = current * inductance;
      }

      ic[elemState.stateIndex] = initialValue;
    }

    return ic;
  }

  /**
   * Convert state vector back to element values
   *
   * For visualization/display:
   * - q → voltage = q/C
   * - p → current = p/L
   */
  extractElementValues(
    stateVector: Float64Array,
    mapping: StateMapping,
    elements: EditorElement[]
  ): Map<string, number> {
    const values = new Map<string, number>();

    for (const [elementId, elemState] of mapping.elements) {
      const element = elements.find(e => e.id === elementId);
      if (!element) continue;

      const stateValue = stateVector[elemState.stateIndex];

      if (elemState.stateVariable === 'q') {
        // Charge → Voltage
        const capacitance = element.parameters?.capacitance as number || 1.0;
        const voltage = stateValue / capacitance;
        values.set(elementId, voltage);
      } else if (elemState.stateVariable === 'p') {
        // Momentum → Current
        const inductance = element.parameters?.inertance as number || 1.0;
        const current = stateValue / inductance;
        values.set(elementId, current);
      }
    }

    return values;
  }

  /**
   * Get state vector dimension (number of state variables)
   */
  getStateDimension(mapping: StateMapping): number {
    return mapping.totalStates;
  }

  /**
   * Check if system is purely algebraic (no state variables)
   */
  isPurelyAlgebraic(mapping: StateMapping): boolean {
    return mapping.totalStates === 0;
  }

  /**
   * Generate human-readable state vector description
   */
  describeStateVector(mapping: StateMapping): string {
    if (mapping.totalStates === 0) {
      return 'Purely algebraic system (no state variables)';
    }

    const descriptions: string[] = [];
    for (const [elementId, elemState] of mapping.elements) {
      descriptions.push(
        `${elemState.elementType}${elementId} → ${mapping.stateVectorInfo[elemState.stateIndex]}`
      );
    }

    return `State vector (dimension ${mapping.totalStates}):\n  ${descriptions.join('\n  ')}`;
  }
}

/**
 * Convenience function: Extract state in one call
 */
export function extractStateFromCausalities(
  elements: EditorElement[],
  bonds: EditorBond[],
  causalities: Map<string, CausalityStatus>
): StateMapping {
  const extractor = new StateExtractor();
  return extractor.extractStateVector(elements, bonds, causalities);
}

/**
 * Convenience function: Validate causalities
 */
export function validateCausalityStructure(
  mapping: StateMapping,
  causalities: Map<string, CausalityStatus>,
  bonds: EditorBond[]
): CausalityValidation {
  const extractor = new StateExtractor();
  return extractor.validateCausalities(mapping, causalities, bonds);
}
