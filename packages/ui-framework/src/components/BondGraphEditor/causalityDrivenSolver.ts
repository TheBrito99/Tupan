/**
 * Causality-Driven Solver Selection & Optimization
 *
 * Uses causality structure to:
 * - Detect algebraic loops before simulation
 * - Predict system stiffness
 * - Choose appropriate numerical solver
 * - Optimize equation evaluation order
 * - Provide performance recommendations
 */

import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';

/**
 * Solver types with characteristics
 */
export type SolverType =
  | 'RK4'           // Explicit Runge-Kutta 4, non-stiff systems
  | 'RK45'          // Explicit Runge-Kutta 4/5 (Dormand-Prince), adaptive
  | 'BDF'           // Backward differentiation formula, stiff systems
  | 'IDA'           // Implicit differential-algebraic, general purpose
  | 'DOPRI'         // DOPRI5, explicit, adaptive
  | 'RADAU';        // Radau method, implicit, stiff

/**
 * Algebraic loop information
 */
export interface AlgebraicLoop {
  loopId: string;
  bondIds: string[];
  elementIds: string[];
  severity: 'error' | 'warning';
  reason: string;
  suggestion: string;
}

/**
 * Stiffness prediction result
 */
export interface StiffnessAnalysis {
  isStiff: boolean;
  stiffnessRatio: number;           // Ratio of largest to smallest eigenvalue
  confidence: number;               // 0-1, how certain the prediction is
  indicators: {
    hasRapidTransients: boolean;
    hasDifferentTimeScales: boolean;
    hasEnergyStorage: boolean;
    hasHighResistance: boolean;
  };
  reason: string;
}

/**
 * Solver recommendation
 */
export interface SolverRecommendation {
  recommendedSolver: SolverType;
  alternatives: SolverType[];
  timeStepSuggestion: number;        // Initial dt suggestion
  stiffnessAnalysis: StiffnessAnalysis;
  algebraicLoops: AlgebraicLoop[];
  estimatedMemory: number;           // MB
  estimatedSpeed: 'very_fast' | 'fast' | 'moderate' | 'slow';
  warnings: string[];
  optimizationOpportunities: string[];
}

/**
 * Equation ordering for evaluation
 */
export interface EquationOrder {
  bondIds: string[];                // Order to evaluate equations
  dependencies: Map<string, Set<string>>;  // bondId -> dependencies
  hasCycles: boolean;
  cycles: string[][];
}

/**
 * Causality-Driven Solver Analyzer
 */
export class CausalityDrivenSolver {
  private elements: EditorElement[];
  private bonds: EditorBond[];
  private causalities: Map<string, CausalityStatus>;

  constructor(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ) {
    this.elements = elements;
    this.bonds = bonds;
    this.causalities = causalities;
  }

  /**
   * Main recommendation function
   */
  public getRecommendation(): SolverRecommendation {
    const algebraicLoops = this.detectAlgebraicLoops();
    const stiffness = this.analyzeStiffness();
    const order = this.optimizeEquationOrder();
    const memory = this.estimateMemory();

    const recommendedSolver = this.selectSolver(stiffness, algebraicLoops);
    const alternatives = this.getAlternativeSolvers(recommendedSolver);

    return {
      recommendedSolver,
      alternatives,
      timeStepSuggestion: this.suggestTimeStep(stiffness, recommendedSolver),
      stiffnessAnalysis: stiffness,
      algebraicLoops,
      estimatedMemory: memory,
      estimatedSpeed: this.estimateSpeed(stiffness, algebraicLoops),
      warnings: this.generateWarnings(algebraicLoops, stiffness),
      optimizationOpportunities: this.suggestOptimizations(order, stiffness),
    };
  }

  /**
   * Detect algebraic loops
   *
   * Algebraic loops occur when there's a direct feedback path without
   * an integrator (C or I element), creating instant causality conflicts.
   */
  private detectAlgebraicLoops(): AlgebraicLoop[] {
    const loops: AlgebraicLoop[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    /**
     * DFS to find cycles in causality graph
     */
    const findCycles = (
      bondId: string,
      path: string[],
      pathElements: string[]
    ): AlgebraicLoop[] => {
      if (recursionStack.has(bondId)) {
        // Found a cycle
        const cycleStart = path.indexOf(bondId);
        const cyclePath = path.slice(cycleStart);
        const cycleElements = pathElements.slice(cycleStart);

        // Check if cycle has any storage elements (integral causality)
        const hasStorage = cycleElements.some((eId) => {
          const elem = this.elements.find((e) => e.id === eId);
          return elem?.type === 'C' || elem?.type === 'I';
        });

        if (!hasStorage) {
          // Algebraic loop: no storage elements
          const bond = this.bonds.find((b) => b.id === bondId);
          return [
            {
              loopId: `loop_${Date.now()}_${Math.random()}`,
              bondIds: cyclePath,
              elementIds: cycleElements,
              severity: 'error',
              reason: 'Algebraic loop detected: causality path has no integrators (C/I elements)',
              suggestion:
                'Add capacitor or inductor to break the loop, or restructure the system topology',
            },
          ];
        }

        return [];
      }

      if (visited.has(bondId)) {
        return [];
      }

      visited.add(bondId);
      recursionStack.add(bondId);

      const newLoops: AlgebraicLoop[] = [];
      const bond = this.bonds.find((b) => b.id === bondId);
      if (!bond) return [];

      const causality = this.causalities.get(bondId);
      let nextBonds: string[] = [];

      if (causality === 'EffortOut') {
        // This bond outputs effort, find bonds that depend on this element's effort
        nextBonds = this.bonds
          .filter(
            (b) =>
              (b.from === bond.to || b.to === bond.to) &&
              b.id !== bondId &&
              this.causalities.get(b.id) === 'EffortOut'
          )
          .map((b) => b.id);
      } else if (causality === 'FlowOut') {
        // This bond outputs flow, find bonds that depend on this element's flow
        nextBonds = this.bonds
          .filter(
            (b) =>
              (b.from === bond.to || b.to === bond.to) &&
              b.id !== bondId &&
              this.causalities.get(b.id) === 'FlowOut'
          )
          .map((b) => b.id);
      }

      for (const nextBondId of nextBonds) {
        const nextBond = this.bonds.find((b) => b.id === nextBondId);
        if (nextBond) {
          const cyclePath = findCycles(
            nextBondId,
            [...path, nextBondId],
            [...pathElements, nextBond.to]
          );
          newLoops.push(...cyclePath);
        }
      }

      recursionStack.delete(bondId);
      return newLoops;
    };

    // Start DFS from each bond
    for (const bond of this.bonds) {
      visited.clear();
      recursionStack.clear();
      const foundLoops = findCycles(bond.id, [bond.id], [bond.from, bond.to]);
      loops.push(...foundLoops);
    }

    // Remove duplicates
    const uniqueLoops = loops.filter(
      (loop, idx, arr) =>
        arr.findIndex((l) => JSON.stringify(l.bondIds) === JSON.stringify(loop.bondIds)) === idx
    );

    return uniqueLoops;
  }

  /**
   * Analyze stiffness from causality structure
   *
   * Stiff systems have multiple time scales (e.g., fast transients + slow drift).
   * Causality structure hints at this:
   * - R elements with very different resistances
   * - Multiple C/I elements at different scales
   * - Deep feedback paths
   */
  private analyzeStiffness(): StiffnessAnalysis {
    const indicators = {
      hasRapidTransients: false,
      hasDifferentTimeScales: false,
      hasEnergyStorage: false,
      hasHighResistance: false,
    };

    // Check for energy storage elements
    const storageElements = this.elements.filter((e) => e.type === 'C' || e.type === 'I');
    if (storageElements.length > 1) {
      indicators.hasEnergyStorage = true;
    }

    // Check for resistances
    const resistors = this.elements.filter((e) => e.type === 'R');
    if (resistors.length > 0) {
      // Extract resistance values from parameters
      const resistances = resistors
        .map((r) => (r.parameters as Record<string, number>)?.resistance || 1000)
        .filter((v) => v > 0);

      if (resistances.length > 1) {
        const max = Math.max(...resistances);
        const min = Math.min(...resistances);
        const ratio = max / min;
        if (ratio > 100) {
          indicators.hasHighResistance = true;
          indicators.hasDifferentTimeScales = true;
        }
      }
    }

    // Check for feedback depth (length of critical paths)
    const criticalPaths = this.findCriticalPaths();
    if (criticalPaths.some((path) => path.length > 5)) {
      indicators.hasRapidTransients = true;
    }

    // Estimate stiffness ratio
    let stiffnessRatio = 1.0;
    if (indicators.hasHighResistance) stiffnessRatio *= 100;
    if (indicators.hasDifferentTimeScales) stiffnessRatio *= 10;
    if (indicators.hasRapidTransients) stiffnessRatio *= 5;

    const isStiff = stiffnessRatio > 10;

    return {
      isStiff,
      stiffnessRatio,
      confidence: 0.6 + (storageElements.length * 0.1 + resistors.length * 0.05),
      indicators,
      reason: isStiff
        ? `System appears stiff: high resistance values, multiple time scales, or deep feedback paths detected`
        : `System appears non-stiff: single time scale, moderate resistance values`,
    };
  }

  /**
   * Optimize equation evaluation order
   *
   * Uses causality to determine which equations should be evaluated first.
   * Equations with EffortOut causality should be evaluated before those that
   * depend on their effort.
   */
  private optimizeEquationOrder(): EquationOrder {
    const dependencies = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const bond of this.bonds) {
      dependencies.set(bond.id, new Set());
      inDegree.set(bond.id, 0);
    }

    // Build dependency graph
    for (const bond of this.bonds) {
      const causality = this.causalities.get(bond.id);
      if (causality === 'EffortOut') {
        // This bond drives effort, find dependent bonds
        for (const otherBond of this.bonds) {
          if (otherBond.id === bond.id) continue;
          if (
            otherBond.from === bond.to ||
            otherBond.to === bond.to
          ) {
            dependencies.get(bond.id)?.add(otherBond.id);
            inDegree.set(otherBond.id, (inDegree.get(otherBond.id) || 0) + 1);
          }
        }
      }
    }

    // Topological sort (Kahn's algorithm)
    const queue = Array.from(this.bonds.keys()).filter((idx) => inDegree.get(this.bonds[idx].id) === 0);
    const sorted: string[] = [];
    const tempInDegree = new Map(inDegree);

    while (queue.length > 0) {
      const idx = queue.shift()!;
      const bondId = this.bonds[idx].id;
      sorted.push(bondId);

      const deps = dependencies.get(bondId) || new Set();
      for (const depId of deps) {
        tempInDegree.set(depId, (tempInDegree.get(depId) || 1) - 1);
        if (tempInDegree.get(depId) === 0) {
          const depIdx = this.bonds.findIndex((b) => b.id === depId);
          if (depIdx >= 0) queue.push(depIdx);
        }
      }
    }

    // Check for cycles
    const hasCycles = sorted.length < this.bonds.length;
    const cycles: string[][] = hasCycles ? this.findCycles() : [];

    return {
      bondIds: sorted,
      dependencies,
      hasCycles,
      cycles,
    };
  }

  /**
   * Find cycles in bond graph
   */
  private findCycles(): string[][] {
    // Simplified: return bonds involved in algebraic loops
    const loops = this.detectAlgebraicLoops();
    return loops.map((loop) => loop.bondIds);
  }

  /**
   * Find critical paths (source to sink)
   */
  private findCriticalPaths(): string[][] {
    const paths: string[][] = [];
    const sources = this.bonds.filter((b) => {
      const elem = this.elements.find((e) => e.id === b.from);
      return elem?.type === 'Se' || elem?.type === 'Sf';
    });

    for (const source of sources) {
      const path: string[] = [source.id];
      this.findPathsDFS(source.to, new Set([source.id]), path, paths);
    }

    return paths;
  }

  /**
   * DFS for path finding
   */
  private findPathsDFS(
    elementId: string,
    visited: Set<string>,
    currentPath: string[],
    allPaths: string[][]
  ): void {
    const outgoing = this.bonds.filter((b) => b.from === elementId && !visited.has(b.id));

    if (outgoing.length === 0) {
      allPaths.push([...currentPath]);
      return;
    }

    for (const bond of outgoing) {
      visited.add(bond.id);
      currentPath.push(bond.id);
      this.findPathsDFS(bond.to, visited, currentPath, allPaths);
      currentPath.pop();
      visited.delete(bond.id);
    }
  }

  /**
   * Select appropriate solver based on system characteristics
   */
  private selectSolver(stiffness: StiffnessAnalysis, loops: AlgebraicLoop[]): SolverType {
    // If algebraic loops detected, need implicit solver
    if (loops.length > 0) {
      return 'IDA'; // Can handle DAE systems with algebraic loops
    }

    // If stiff, use BDF
    if (stiffness.isStiff) {
      return 'BDF';
    }

    // Non-stiff: use explicit RK45 (adaptive)
    return 'RK45';
  }

  /**
   * Get alternative solvers
   */
  private getAlternativeSolvers(recommended: SolverType): SolverType[] {
    const alternatives: Record<SolverType, SolverType[]> = {
      RK4: ['RK45', 'DOPRI'],
      RK45: ['RK4', 'DOPRI'],
      BDF: ['IDA', 'RADAU'],
      IDA: ['BDF', 'RADAU'],
      DOPRI: ['RK45', 'RK4'],
      RADAU: ['IDA', 'BDF'],
    };

    return alternatives[recommended] || [];
  }

  /**
   * Suggest initial time step
   */
  private suggestTimeStep(stiffness: StiffnessAnalysis, solver: SolverType): number {
    const baseStep = 0.001; // 1ms default

    // Stiff systems need smaller steps
    if (stiffness.isStiff) {
      return baseStep / (stiffness.stiffnessRatio || 10);
    }

    // Implicit solvers can use larger steps
    if (['BDF', 'IDA', 'RADAU'].includes(solver)) {
      return baseStep * 10;
    }

    return baseStep;
  }

  /**
   * Estimate memory requirements
   */
  private estimateMemory(): number {
    // Rough estimate in MB
    const numBonds = this.bonds.length;
    const numElements = this.elements.length;

    // Each double: 8 bytes
    // State vector: numBonds * 8
    // Jacobian: numBonds^2 * 8
    // History (adaptive): 5 * numBonds * 8

    const stateVector = (numBonds * 8) / 1e6;
    const jacobian = (Math.min(numBonds, 100) ** 2 * 8) / 1e6; // Cap at 100x100
    const history = (5 * numBonds * 8) / 1e6;

    return Math.max(1, stateVector + jacobian + history);
  }

  /**
   * Estimate computational speed
   */
  private estimateSpeed(
    stiffness: StiffnessAnalysis,
    loops: AlgebraicLoop[]
  ): 'very_fast' | 'fast' | 'moderate' | 'slow' {
    let score = 0;

    // Fewer loops = faster
    score += loops.length > 0 ? -2 : 0;

    // Non-stiff = faster
    score += !stiffness.isStiff ? 2 : 0;

    // Small stiffness ratio = faster
    if (stiffness.stiffnessRatio < 10) score += 2;
    if (stiffness.stiffnessRatio > 1000) score -= 2;

    if (score >= 3) return 'very_fast';
    if (score >= 1) return 'fast';
    if (score >= -1) return 'moderate';
    return 'slow';
  }

  /**
   * Generate warnings
   */
  private generateWarnings(loops: AlgebraicLoop[], stiffness: StiffnessAnalysis): string[] {
    const warnings: string[] = [];

    if (loops.length > 0) {
      warnings.push(`⚠️ ${loops.length} algebraic loop(s) detected - may require DAE solver`);
    }

    if (stiffness.isStiff && stiffness.stiffnessRatio > 1000) {
      warnings.push(
        `⚠️ Highly stiff system (ratio ${stiffness.stiffnessRatio.toFixed(0)}) - expect slow computation`
      );
    }

    if (stiffness.confidence < 0.4) {
      warnings.push('⚠️ Low confidence in stiffness prediction - run actual simulation to verify');
    }

    return warnings;
  }

  /**
   * Suggest optimizations
   */
  private suggestOptimizations(order: EquationOrder, stiffness: StiffnessAnalysis): string[] {
    const suggestions: string[] = [];

    if (order.hasCycles) {
      suggestions.push('💡 Restructure system to eliminate cycles for faster computation');
    }

    if (stiffness.isStiff) {
      suggestions.push('💡 Consider implicit solver (BDF/IDA) for stiff system');
    }

    if (stiffness.indicators.hasHighResistance) {
      suggestions.push('💡 Large resistance values detected - consider scaling variables');
    }

    const storageElements = this.elements.filter((e) => e.type === 'C' || e.type === 'I');
    if (storageElements.length > 10) {
      suggestions.push('💡 Large number of storage elements - consider model reduction');
    }

    return suggestions;
  }

  /**
   * Estimate total simulation runtime
   */
  public estimateRuntime(duration: number, timeStep: number): number {
    const numSteps = duration / timeStep;
    const recommendation = this.getRecommendation();

    // Speed factors (arbitrary units)
    const speedFactors: Record<SolverType, number> = {
      RK4: 1.0,
      RK45: 1.5, // Adaptive, might be slower
      BDF: 3.0, // Implicit, need to solve linear system
      IDA: 4.0, // DAE solver, more complex
      DOPRI: 1.2,
      RADAU: 3.5,
    };

    const speedFactor = speedFactors[recommendation.recommendedSolver];
    const baseCost = numSteps * speedFactor;

    // Stiff system multiplier
    const stiffMultiplier = recommendation.stiffnessAnalysis.isStiff
      ? recommendation.stiffnessAnalysis.stiffnessRatio / 10
      : 1.0;

    return baseCost * stiffMultiplier;
  }
}
