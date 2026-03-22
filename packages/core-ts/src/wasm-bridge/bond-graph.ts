/**
 * TypeScript bridge for bond graph analysis via WASM
 *
 * Provides high-level interface to Rust bond graph solver through WASM bindings.
 * Supports all 9 bond graph element types and causality assignment.
 */

import type { WasmBondGraphAnalyzer } from '@tupan/core-rust';

/**
 * Bond graph element types (9 standard types)
 */
export type BondGraphElementType = 'Se' | 'Sf' | 'C' | 'I' | 'R' | 'TF' | 'GY' | 'Junction0' | 'Junction1';

/**
 * Bond graph element representation
 */
export interface BondGraphElement {
  id: string;
  type: BondGraphElementType;
  parameters?: Record<string, number>;
  name?: string;
}

/**
 * Causality type
 */
export type CausalityType = 'EffortOut' | 'FlowOut' | 'Unassigned';

/**
 * Bond between two elements
 */
export interface BondGraphBond {
  id: string;
  from: string;           // source element ID
  to: string;             // target element ID
  causality: CausalityType;
  effort: number;
  flow: number;
}

/**
 * Complete bond graph representation
 */
export interface BondGraphData {
  name: string;
  elements: BondGraphElement[];
  bonds: BondGraphBond[];
  causalityAssigned: boolean;
}

/**
 * Causality assignment result
 */
export interface CausalityResult {
  success: boolean;
  message: string;
  causalityAssigned: boolean;
  conflicts?: string[];
}

/**
 * Simulation parameters
 */
export interface SimulationParams {
  duration: number;      // seconds
  timeStep: number;      // seconds
  solver: 'RK4' | 'RK45';
}

/**
 * Simulation result
 */
export interface SimulationResult {
  success: boolean;
  duration: number;
  timeSteps: number;
  stateHistory: number[][];
  powerConservation: number;  // relative error
}

/**
 * Element statistics
 */
export interface ElementStats {
  totalElements: number;
  sources: number;        // Se + Sf
  storage: number;        // C + I
  dissipators: number;    // R
  transformers: number;   // TF + GY
  junctions: number;      // J0 + J1
}

/**
 * High-level wrapper for bond graph analysis
 *
 * Example usage:
 * ```typescript
 * const analyzer = new BondGraphAnalyzer('RC Circuit');
 * const bondGraph: BondGraphData = {
 *   name: 'RC Circuit',
 *   elements: [
 *     { id: 'se_1', type: 'Se', parameters: { effort: 5.0 } },
 *     { id: 'r_1', type: 'R', parameters: { resistance: 1000.0 } },
 *     { id: 'c_1', type: 'C', parameters: { capacitance: 1e-6 } },
 *     { id: 'j_1', type: 'Junction1', parameters: {} },
 *   ],
 *   bonds: [],
 *   causalityAssigned: false
 * };
 *
 * const result = await analyzer.assignCausality(bondGraph);
 * if (result.success) {
 *   const sim = await analyzer.simulate(bondGraph, { duration: 1.0, timeStep: 0.001, solver: 'RK45' });
 *   console.log('Power conservation error:', sim.powerConservation);
 * }
 * ```
 */
export class BondGraphAnalyzer {
  private wasmAnalyzer: WasmBondGraphAnalyzer | null = null;
  private graphName: string;
  private initialized: boolean = false;
  private elements: BondGraphElement[] = [];

  /**
   * Create a new bond graph analyzer
   * @param graphName - Name of the bond graph
   */
  constructor(graphName: string) {
    this.graphName = graphName;
  }

  /**
   * Initialize WASM module (must be called before analysis)
   * @param wasmModule - Initialized WASM module from core-rust
   */
  public initialize(wasmModule: any): void {
    try {
      this.wasmAnalyzer = new wasmModule.WasmBondGraphAnalyzer(this.graphName);
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize bond graph analyzer: ${error}`);
    }
  }

  /**
   * Check if analyzer is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.wasmAnalyzer !== null;
  }

  /**
   * Add an effort source (Se) to the bond graph
   * @param element - Element with type 'Se'
   * @throws Error if not initialized
   */
  public addEffortSource(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
      effort: element.parameters?.effort ?? 1.0,
    });

    const result = this.wasmAnalyzer!.add_effort_source(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add effort source: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add a flow source (Sf) to the bond graph
   * @param element - Element with type 'Sf'
   * @throws Error if not initialized
   */
  public addFlowSource(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
      flow: element.parameters?.flow ?? 1.0,
    });

    const result = this.wasmAnalyzer!.add_flow_source(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add flow source: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add a resistor (R) to the bond graph
   * @param element - Element with type 'R'
   * @throws Error if not initialized
   */
  public addResistor(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
      resistance: element.parameters?.resistance ?? 1.0,
    });

    const result = this.wasmAnalyzer!.add_resistor(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add resistor: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add a capacitor (C) to the bond graph
   * @param element - Element with type 'C'
   * @throws Error if not initialized
   */
  public addCapacitor(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
      capacitance: element.parameters?.capacitance ?? 1.0,
      initial_charge: element.parameters?.initial_charge ?? 0.0,
    });

    const result = this.wasmAnalyzer!.add_capacitor(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add capacitor: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add an inductor (I) to the bond graph
   * @param element - Element with type 'I'
   * @throws Error if not initialized
   */
  public addInductor(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
      inertance: element.parameters?.inertance ?? 1.0,
      initial_momentum: element.parameters?.initial_momentum ?? 0.0,
    });

    const result = this.wasmAnalyzer!.add_inductor(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add inductor: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add a transformer (TF) to the bond graph
   * @param element - Element with type 'TF'
   * @throws Error if not initialized
   */
  public addTransformer(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
      ratio: element.parameters?.ratio ?? 1.0,
    });

    const result = this.wasmAnalyzer!.add_transformer(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add transformer: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add a gyrator (GY) to the bond graph
   * @param element - Element with type 'GY'
   * @throws Error if not initialized
   */
  public addGyrator(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
      ratio: element.parameters?.ratio ?? 1.0,
    });

    const result = this.wasmAnalyzer!.add_gyrator(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add gyrator: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add a 0-junction to the bond graph
   * @param element - Element with type 'Junction0'
   * @throws Error if not initialized
   */
  public addJunction0(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
    });

    const result = this.wasmAnalyzer!.add_junction0(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add 0-junction: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add a 1-junction to the bond graph
   * @param element - Element with type 'Junction1'
   * @throws Error if not initialized
   */
  public addJunction1(element: BondGraphElement): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    const json = JSON.stringify({
      id: element.id,
    });

    const result = this.wasmAnalyzer!.add_junction1(json);
    const parsed = JSON.parse(result);

    if (!parsed.success) {
      throw new Error(`Failed to add 1-junction: ${parsed.error}`);
    }

    this.elements.push(element);
  }

  /**
   * Add an element (dispatches to appropriate add method)
   * @param element - Bond graph element to add
   * @throws Error if element type not supported
   */
  public addElement(element: BondGraphElement): void {
    switch (element.type) {
      case 'Se':
        this.addEffortSource(element);
        break;
      case 'Sf':
        this.addFlowSource(element);
        break;
      case 'R':
        this.addResistor(element);
        break;
      case 'C':
        this.addCapacitor(element);
        break;
      case 'I':
        this.addInductor(element);
        break;
      case 'TF':
        this.addTransformer(element);
        break;
      case 'GY':
        this.addGyrator(element);
        break;
      case 'Junction0':
        this.addJunction0(element);
        break;
      case 'Junction1':
        this.addJunction1(element);
        break;
      default:
        throw new Error(`Unknown element type: ${element.type}`);
    }
  }

  /**
   * Add multiple elements to the bond graph
   * @param elements - Array of elements to add
   */
  public addElements(elements: BondGraphElement[]): void {
    for (const element of elements) {
      this.addElement(element);
    }
  }

  /**
   * Get the number of elements in the bond graph
   */
  public getElementCount(): number {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    return this.wasmAnalyzer!.element_count();
  }

  /**
   * Get all elements in the bond graph
   */
  public getElements(): BondGraphElement[] {
    return this.elements;
  }

  /**
   * Get element statistics
   */
  public getElementStats(): ElementStats {
    const stats: ElementStats = {
      totalElements: this.elements.length,
      sources: this.elements.filter(e => e.type === 'Se' || e.type === 'Sf').length,
      storage: this.elements.filter(e => e.type === 'C' || e.type === 'I').length,
      dissipators: this.elements.filter(e => e.type === 'R').length,
      transformers: this.elements.filter(e => e.type === 'TF' || e.type === 'GY').length,
      junctions: this.elements.filter(e => e.type === 'Junction0' || e.type === 'Junction1').length,
    };
    return stats;
  }

  /**
   * Clear all elements from the bond graph
   */
  public clear(): void {
    if (!this.isInitialized()) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    this.elements = [];
    this.wasmAnalyzer = new (this.wasmAnalyzer!.constructor as any)(this.graphName);
  }

  /**
   * Get bond graph data representation
   */
  public getBondGraphData(): BondGraphData {
    return {
      name: this.graphName,
      elements: this.elements,
      bonds: [],  // TODO: implement bond management
      causalityAssigned: false,  // TODO: track causality state
    };
  }
}
