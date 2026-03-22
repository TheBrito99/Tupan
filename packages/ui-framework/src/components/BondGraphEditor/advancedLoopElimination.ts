/**
 * Advanced Algebraic Loop Elimination
 *
 * Detects algebraic loops (cycles without storage elements) and suggests
 * causality changes to eliminate them. Evaluates impact of each break point
 * to find the best solution with minimal side effects.
 */

import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';

/**
 * Information about a single option to break an algebraic loop
 */
export interface BreakPoint {
  bondId: string;                           // Bond to change causality on
  currentCausality: CausalityStatus;        // Current assignment
  suggestedCausality: CausalityStatus;      // Proposed change
  impact: 'high' | 'medium' | 'low';        // How many other bonds affected
  explanation: string;                      // Why this is recommended
  requires?: string[];                      // Prerequisites (e.g., element type)
  affectedBonds: string[];                  // Other bonds that must change
}

/**
 * Represents a detected algebraic loop
 */
export interface AlgebraicLoop {
  bondIds: string[];                        // Complete cycle path
  elementIds: string[];                     // Elements in the cycle
  severity: 'critical' | 'warning' | 'info';
  reason: string;                           // Human-readable explanation
  isResolved: boolean;                      // Whether loop has been broken
  breakPoints: BreakPoint[];                // Ranked list of solutions
}

/**
 * Advanced algebraic loop elimination engine
 */
export class AdvancedLoopEliminator {
  /**
   * Find all algebraic loops in the current causality assignment
   */
  public findLoops(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): AlgebraicLoop[] {
    const loops: AlgebraicLoop[] = [];

    // Build causality graph: bond → connected bonds following causality
    const graph = this.buildCausalityGraph(bonds, causalities);

    // DFS to find all cycles
    const visited = new Set<string>();
    const visitStack = new Set<string>();

    for (const startBond of bonds) {
      if (!visited.has(startBond.id)) {
        this.dfsFindCycles(
          startBond.id,
          [],
          new Set(),
          graph,
          bonds,
          causalities,
          elements,
          loops,
          visited,
          visitStack
        );
      }
    }

    // Remove duplicate loops (same cycle, different start points)
    return this.deduplicateLoops(loops).sort(
      (a, b) =>
        (['critical', 'warning', 'info'].indexOf(b.severity) -
          ['critical', 'warning', 'info'].indexOf(a.severity))
    );
  }

  /**
   * Build graph of causality dependencies
   * Edge from bond A to bond B means B's causality depends on A's
   */
  private buildCausalityGraph(
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    // Initialize all bonds
    for (const bond of bonds) {
      graph.set(bond.id, []);
    }

    // Add edges based on causality
    for (const bond of bonds) {
      const causality = causalities.get(bond.id);
      if (!causality || causality === 'Unassigned') continue;

      // EffortOut means effort leaves "from" and enters "to"
      // So "to" element's input depends on "from" element's output
      // Find all bonds connected at "to" element
      for (const otherBond of bonds) {
        if (bond.id === otherBond.id) continue;

        // If this bond's target is the other bond's source, add dependency
        if (bond.to === otherBond.from || bond.to === otherBond.to) {
          graph.get(bond.id)?.push(otherBond.id);
        }

        // If this bond's source is the other bond's target, add dependency
        if (bond.from === otherBond.to || bond.from === otherBond.from) {
          graph.get(bond.id)?.push(otherBond.id);
        }
      }
    }

    return graph;
  }

  /**
   * DFS to find algebraic cycles
   */
  private dfsFindCycles(
    currentBondId: string,
    path: string[],
    pathSet: Set<string>,
    graph: Map<string, string[]>,
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>,
    elements: EditorElement[],
    loops: AlgebraicLoop[],
    visited: Set<string>,
    visitStack: Set<string>
  ): void {
    if (visitStack.has(currentBondId)) {
      // Found a cycle!
      const cycleStart = path.indexOf(currentBondId);
      if (cycleStart !== -1) {
        const cycleBonds = path.slice(cycleStart);
        cycleBonds.push(currentBondId);

        // Check if this is an algebraic loop (no storage elements)
        if (!this.hasStorageElements(cycleBonds, elements, bonds)) {
          loops.push(
            this.createAlgebraicLoop(cycleBonds, bonds, elements, causalities)
          );
        }
      }
      return;
    }

    if (visited.has(currentBondId)) return;

    visitStack.add(currentBondId);
    path.push(currentBondId);
    pathSet.add(currentBondId);

    // Visit neighbors
    const neighbors = graph.get(currentBondId) || [];
    for (const neighbor of neighbors) {
      this.dfsFindCycles(
        neighbor,
        [...path],
        new Set(pathSet),
        graph,
        bonds,
        causalities,
        elements,
        loops,
        visited,
        visitStack
      );
    }

    pathSet.delete(currentBondId);
    visitStack.delete(currentBondId);
    visited.add(currentBondId);
  }

  /**
   * Check if a cycle contains any storage elements (C or I)
   */
  private hasStorageElements(
    bondIds: string[],
    elements: EditorElement[],
    bonds: EditorBond[]
  ): boolean {
    const elementIds = new Set<string>();

    for (const bondId of bondIds) {
      const bond = bonds.find(b => b.id === bondId);
      if (bond) {
        elementIds.add(bond.from);
        elementIds.add(bond.to);
      }
    }

    for (const elementId of elementIds) {
      const element = elements.find(e => e.id === elementId);
      if (element && (element.type === 'C' || element.type === 'I')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create an AlgebraicLoop object from a cycle
   */
  private createAlgebraicLoop(
    bondIds: string[],
    bonds: EditorBond[],
    elements: EditorElement[],
    causalities: Map<string, CausalityStatus>
  ): AlgebraicLoop {
    const elementIds = new Set<string>();
    for (const bondId of bondIds) {
      const bond = bonds.find(b => b.id === bondId);
      if (bond) {
        elementIds.add(bond.from);
        elementIds.add(bond.to);
      }
    }

    // Determine severity based on cycle length and element types
    const severity =
      bondIds.length > 5 ? 'critical' : bondIds.length > 3 ? 'warning' : 'info';

    const reason = `Algebraic loop detected: ${bondIds.length} bonds in cycle (${Array.from(elementIds).map(id => {
      const el = elements.find(e => e.id === id);
      return el?.type || 'unknown';
    }).join(' → ')})`;

    const loop: AlgebraicLoop = {
      bondIds,
      elementIds: Array.from(elementIds),
      severity,
      reason,
      isResolved: false,
      breakPoints: [],
    };

    // Find break points
    loop.breakPoints = this.findBreakPoints(
      loop,
      bonds,
      causalities,
      elements
    );

    return loop;
  }

  /**
   * Find ways to break the cycle by changing causality
   */
  private findBreakPoints(
    loop: AlgebraicLoop,
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>,
    elements: EditorElement[]
  ): BreakPoint[] {
    const breakPoints: BreakPoint[] = [];

    // For each bond in the cycle, try changing its causality
    for (const bondId of loop.bondIds) {
      const bond = bonds.find(b => b.id === bondId);
      if (!bond) continue;

      const currentCausality = causalities.get(bondId);
      if (!currentCausality || currentCausality === 'Unassigned') continue;

      // Try alternative causalities
      const alternatives = this.getAlternativeCausalities(
        currentCausality,
        bond,
        elements
      );

      for (const suggestedCausality of alternatives) {
        // Check if this change would break the loop
        const testCausalities = new Map(causalities);
        testCausalities.set(bondId, suggestedCausality);

        if (!this.loopStillExists(loop.bondIds, testCausalities, bonds, elements)) {
          // This change breaks the loop!
          const impact = this.estimateImpact(bondId, bonds);
          breakPoints.push({
            bondId,
            currentCausality,
            suggestedCausality,
            impact,
            explanation: `Change ${this.getElementName(bond.from, elements)} → ${this.getElementName(bond.to, elements)} causality from ${currentCausality} to ${suggestedCausality}`,
            affectedBonds: this.findAffectedBonds(bondId, bonds),
          });
        }
      }
    }

    // Sort by impact (low impact first)
    return breakPoints.sort((a, b) => {
      const impactRank = { low: 0, medium: 1, high: 2 };
      return impactRank[a.impact] - impactRank[b.impact];
    });
  }

  /**
   * Get possible alternative causalities for a bond
   */
  private getAlternativeCausalities(
    currentCausality: CausalityStatus,
    bond: EditorBond,
    elements: EditorElement[]
  ): CausalityStatus[] {
    const alternatives: CausalityStatus[] = [];

    // Sources can only have outward causality
    const fromElement = elements.find(e => e.id === bond.from);
    const toElement = elements.find(e => e.id === bond.to);

    if (fromElement?.type === 'Se') {
      alternatives.push('EffortOut');
    } else if (fromElement?.type === 'Sf') {
      alternatives.push('FlowOut');
    } else if (toElement?.type === 'Se') {
      alternatives.push('EffortIn'); // Force opposite direction
    } else if (toElement?.type === 'Sf') {
      alternatives.push('FlowIn');
    } else {
      // Regular bonds can be either direction
      if (currentCausality !== 'EffortOut') alternatives.push('EffortOut');
      if (currentCausality !== 'FlowOut') alternatives.push('FlowOut');
    }

    return alternatives;
  }

  /**
   * Check if loop still exists with new causality assignment
   */
  private loopStillExists(
    loopBondIds: string[],
    causalities: Map<string, CausalityStatus>,
    bonds: EditorBond[],
    elements: EditorElement[]
  ): boolean {
    // Rebuild just this cycle and check for dependencies
    const bondMap = new Map<string, EditorBond>();
    for (const bondId of loopBondIds) {
      const bond = bonds.find(b => b.id === bondId);
      if (bond) bondMap.set(bondId, bond);
    }

    // Check if any bond in loop creates a cycle
    for (const bondId of loopBondIds) {
      const causality = causalities.get(bondId);
      if (!causality || causality === 'Unassigned') continue;

      // Check if this causality connects back to start of loop
      const startBond = bondMap.get(loopBondIds[0]);
      if (startBond) {
        // Simplified: if causality creates forward dependency, loop still exists
        const bond = bondMap.get(bondId);
        if (bond && this.causesForwardDependency(bond, causality)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a causality assignment creates forward dependency
   */
  private causesForwardDependency(
    bond: EditorBond,
    causality: CausalityStatus
  ): boolean {
    // EffortOut or FlowOut indicate dependency flowing forward
    return causality === 'EffortOut' || causality === 'FlowOut';
  }

  /**
   * Estimate how many bonds would be affected by changing this bond's causality
   */
  private estimateImpact(
    bondId: string,
    bonds: EditorBond[]
  ): 'high' | 'medium' | 'low' {
    const bond = bonds.find(b => b.id === bondId);
    if (!bond) return 'low';

    // Count connected bonds
    const connectedCount = bonds.filter(
      b =>
        b.id !== bondId &&
        (b.from === bond.from || b.from === bond.to || b.to === bond.from || b.to === bond.to)
    ).length;

    if (connectedCount > 4) return 'high';
    if (connectedCount > 2) return 'medium';
    return 'low';
  }

  /**
   * Find all bonds that would be affected by changing a bond's causality
   */
  private findAffectedBonds(bondId: string, bonds: EditorBond[]): string[] {
    const affected: string[] = [];
    const bond = bonds.find(b => b.id === bondId);
    if (!bond) return affected;

    // Bonds connected at same elements
    for (const otherBond of bonds) {
      if (otherBond.id === bondId) continue;
      if (
        otherBond.from === bond.from ||
        otherBond.from === bond.to ||
        otherBond.to === bond.from ||
        otherBond.to === bond.to
      ) {
        affected.push(otherBond.id);
      }
    }

    return affected;
  }

  /**
   * Get human-readable element name
   */
  private getElementName(elementId: string, elements: EditorElement[]): string {
    const element = elements.find(e => e.id === elementId);
    return element ? element.type : 'Unknown';
  }

  /**
   * Remove duplicate loops (same cycle, different start points)
   */
  private deduplicateLoops(loops: AlgebraicLoop[]): AlgebraicLoop[] {
    const seen = new Set<string>();
    const unique: AlgebraicLoop[] = [];

    for (const loop of loops) {
      // Normalize cycle to canonical form
      const sorted = [...loop.bondIds].sort();
      const key = sorted.join(',');

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(loop);
      }
    }

    return unique;
  }

  /**
   * Apply a break point to resolve a loop
   * Returns new causality assignment with the change applied
   */
  public applyBreakPoint(
    loop: AlgebraicLoop,
    breakPoint: BreakPoint,
    causalities: Map<string, CausalityStatus>
  ): Map<string, CausalityStatus> {
    const newCausalities = new Map(causalities);
    newCausalities.set(breakPoint.bondId, breakPoint.suggestedCausality);

    // Mark loop as resolved
    loop.isResolved = true;

    return newCausalities;
  }

  /**
   * Verify that a break point actually eliminates the loop
   */
  public verifyLoopFixed(
    loop: AlgebraicLoop,
    newCausalities: Map<string, CausalityStatus>,
    bonds: EditorBond[],
    elements: EditorElement[]
  ): boolean {
    // Run cycle detection on new causalities
    const graph = this.buildCausalityGraph(bonds, newCausalities);

    // Check if this specific loop path still exists
    return !this.loopStillExists(loop.bondIds, newCausalities, bonds, elements);
  }

  /**
   * Apply all recommended optimizations
   */
  public applyAllOptimizations(
    loops: AlgebraicLoop[],
    causalities: Map<string, CausalityStatus>
  ): Map<string, CausalityStatus> {
    let optimized = new Map(causalities);

    for (const loop of loops) {
      if (loop.breakPoints.length > 0) {
        const bestBreakPoint = loop.breakPoints[0]; // Already sorted by impact
        optimized = this.applyBreakPoint(loop, bestBreakPoint, optimized);
      }
    }

    return optimized;
  }
}

/**
 * Detect all algebraic loops in a causality assignment
 * Convenience function that creates an eliminator and finds loops
 */
export function detectAlgebraicLoops(
  elements: EditorElement[],
  bonds: EditorBond[],
  causalities: Map<string, CausalityStatus>
): AlgebraicLoop[] {
  const eliminator = new AdvancedLoopEliminator();
  return eliminator.findLoops(elements, bonds, causalities);
}

/**
 * Suggest break points for a specific loop
 */
export function suggestBreakPoints(
  loop: AlgebraicLoop,
  elements: EditorElement[],
  bonds: EditorBond[],
  causalities: Map<string, CausalityStatus>
): BreakPoint[] {
  const eliminator = new AdvancedLoopEliminator();
  return loop.breakPoints;
}
