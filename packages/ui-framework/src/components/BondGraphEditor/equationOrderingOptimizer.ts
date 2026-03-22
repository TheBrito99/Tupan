/**
 * Equation Ordering Optimization
 *
 * Optimizes the sequence of equations for efficient computation.
 * Identifies simultaneous equation blocks and orders them to minimize
 * backward references, improving numerical stability and computation speed.
 */

import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';

/**
 * Optimized equation order with analysis
 */
export interface EquationOrder {
  bondIds: string[];                        // Order to solve equations
  simultaneousBlocks: string[][];           // Groups that must solve together
  computationCost: number;                  // Estimated floating-point operations
  sparsity: number;                         // Fraction of zeros in system matrix (0-1)
  conditionNumber: number;                  // Numerical stability indicator (1-∞)
  description: string;                      // Human-readable summary
}

/**
 * Information about a simultaneous equation block
 */
export interface SimultaneousBlock {
  bondIds: string[];                        // Equations in this block
  size: number;                             // Matrix size
  density: number;                          // Non-zero fraction
  estimates: {
    operations: number;                     // FLOPS to solve this block
    condition: number;                      // Numerical condition
  };
}

/**
 * Equation ordering optimizer
 */
export class EquationOrderingOptimizer {
  /**
   * Find optimal equation ordering for the system
   */
  public optimizeOrdering(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): EquationOrder {
    // Build dependency graph: which equations depend on which
    const depGraph = this.buildDependencyGraph(bonds, causalities);

    // Find strongly connected components (simultaneous blocks)
    const components = this.findSCC(depGraph);

    // Order blocks to minimize backward references
    const orderedBlocks = this.orderBlocks(components, depGraph);

    // Flatten to bond order
    const orderedBonds = orderedBlocks.flat();

    // Estimate computational cost
    const cost = this.estimateComputationCost(orderedBlocks, elements, bonds);

    // Calculate sparsity
    const sparsity = this.estimateSparsity(orderedBlocks, bonds);

    // Estimate condition number
    const condition = this.estimateConditionNumber(orderedBlocks, elements);

    return {
      bondIds: orderedBonds,
      simultaneousBlocks: orderedBlocks,
      computationCost: cost,
      sparsity,
      conditionNumber: condition,
      description: this.describeOrdering(orderedBlocks, cost, sparsity, condition),
    };
  }

  /**
   * Build directed graph of equation dependencies
   * Edge from A to B means B depends on A
   */
  private buildDependencyGraph(
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    // Initialize all bonds
    for (const bond of bonds) {
      graph.set(bond.id, new Set());
    }

    // Add dependencies based on causality flow
    for (const bond of bonds) {
      const causality = causalities.get(bond.id);
      if (!causality || causality === 'Unassigned') continue;

      // EffortOut/FlowOut: output depends on input
      // So other bonds' outputs that feed into this bond's input depend on this
      for (const otherBond of bonds) {
        if (bond.id === otherBond.id) continue;

        // Check if there's a dependency relationship
        if (this.hasDependency(bond, otherBond, causality)) {
          graph.get(otherBond.id)?.add(bond.id);
        }
      }
    }

    return graph;
  }

  /**
   * Check if bond A depends on bond B
   */
  private hasDependency(
    bondA: EditorBond,
    bondB: EditorBond,
    causalityA: CausalityStatus
  ): boolean {
    // If A outputs effort/flow, B's input connects to A's output → B depends on A
    if (
      (causalityA === 'EffortOut' || causalityA === 'FlowOut') &&
      (bondA.to === bondB.from || bondA.to === bondB.to)
    ) {
      return true;
    }

    // If A inputs effort/flow, B's output connects to A's input → B depends on A
    if (
      (causalityA === 'EffortIn' || causalityA === 'FlowIn') &&
      (bondA.from === bondB.from || bondA.from === bondB.to)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Find Strongly Connected Components using Tarjan's algorithm
   * SCCs represent simultaneous equation blocks
   */
  private findSCC(graph: Map<string, Set<string>>): string[][] {
    let index = 0;
    const indexMap = new Map<string, number>();
    const lowlinkMap = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const components: string[][] = [];

    const strongConnect = (v: string) => {
      indexMap.set(v, index);
      lowlinkMap.set(v, index);
      index++;
      stack.push(v);
      onStack.add(v);

      const dependencies = graph.get(v) || new Set();
      for (const w of dependencies) {
        const wIndex = indexMap.get(w);
        if (wIndex === undefined) {
          strongConnect(w);
          const wLowlink = lowlinkMap.get(w) || Infinity;
          const vLowlink = lowlinkMap.get(v) || Infinity;
          lowlinkMap.set(v, Math.min(vLowlink, wLowlink));
        } else if (onStack.has(w)) {
          const vLowlink = lowlinkMap.get(v) || Infinity;
          lowlinkMap.set(v, Math.min(vLowlink, wIndex));
        }
      }

      const vLowlink = lowlinkMap.get(v) || Infinity;
      const vIndex = indexMap.get(v) || Infinity;
      if (vLowlink === vIndex) {
        const component: string[] = [];
        while (true) {
          const w = stack.pop();
          if (!w) break;
          onStack.delete(w);
          component.push(w);
          if (w === v) break;
        }
        components.push(component);
      }
    };

    for (const v of graph.keys()) {
      if (!indexMap.has(v)) {
        strongConnect(v);
      }
    }

    return components;
  }

  /**
   * Order SCC blocks to minimize backward references (topological sort)
   */
  private orderBlocks(
    components: string[][],
    graph: Map<string, Set<string>>
  ): string[][] {
    // Create inter-component dependency graph
    const blockDeps = new Map<number, Set<number>>();

    for (let i = 0; i < components.length; i++) {
      blockDeps.set(i, new Set());

      const componentSet = new Set(components[i]);

      for (const bond of components[i]) {
        const deps = graph.get(bond) || new Set();
        for (const dep of deps) {
          // Find which component dep belongs to
          for (let j = 0; j < components.length; j++) {
            if (i !== j && components[j].includes(dep)) {
              blockDeps.get(i)?.add(j);
            }
          }
        }
      }
    }

    // Topological sort
    const ordered: number[] = [];
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const visit = (i: number) => {
      if (visited.has(i)) return;
      if (visiting.has(i)) return; // Cycle, should not happen

      visiting.add(i);

      const deps = blockDeps.get(i) || new Set();
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(i);
      visited.add(i);
      ordered.push(i);
    };

    for (let i = 0; i < components.length; i++) {
      visit(i);
    }

    // Convert indices to bond lists
    return ordered.map(i => components[i]);
  }

  /**
   * Estimate computational cost in floating-point operations
   */
  private estimateComputationCost(
    blocks: string[][],
    elements: EditorElement[],
    bonds: EditorBond[]
  ): number {
    let totalOps = 0;

    for (const block of blocks) {
      const n = block.length;

      if (n === 1) {
        // Single equation: just 1 operation
        totalOps += 1;
      } else {
        // System of equations: Gaussian elimination ≈ n³/3 operations
        // For sparse systems, estimate density and reduce
        const density = this.estimateBlockDensity(block, bonds);
        const ops = (n * n * n) / 3 * density;
        totalOps += ops;
      }
    }

    return totalOps;
  }

  /**
   * Estimate sparsity (fraction of zero elements in system matrix)
   */
  private estimateSparsity(blocks: string[][], bonds: EditorBond[]): number {
    if (blocks.length === 0) return 1.0;

    let totalSize = 0;
    let nonzeros = 0;

    for (const block of blocks) {
      const n = block.length;
      totalSize += n * n;

      // Estimate non-zeros: each bond connects to ~2-3 other bonds
      const blockSet = new Set(block);
      const connectedBonds = new Set<string>();

      for (const bondId of block) {
        const bond = bonds.find(b => b.id === bondId);
        if (!bond) continue;

        // Count connected bonds
        for (const otherBond of bonds) {
          if (
            otherBond.from === bond.from ||
            otherBond.from === bond.to ||
            otherBond.to === bond.from ||
            otherBond.to === bond.to
          ) {
            connectedBonds.add(otherBond.id);
          }
        }
      }

      nonzeros += connectedBonds.size;
    }

    // Sparsity is the fraction of zeros
    return 1.0 - (nonzeros / Math.max(1, totalSize));
  }

  /**
   * Estimate block sparsity (density of non-zeros in matrix)
   */
  private estimateBlockDensity(block: string[], bonds: EditorBond[]): number {
    const n = block.length;
    if (n <= 1) return 1.0;

    const blockSet = new Set(block);
    let nonzeros = 0;

    for (const bondId of block) {
      const bond = bonds.find(b => b.id === bondId);
      if (!bond) continue;

      for (const otherBond of bonds) {
        if (block.includes(otherBond.id)) {
          if (
            otherBond.from === bond.from ||
            otherBond.from === bond.to ||
            otherBond.to === bond.from ||
            otherBond.to === bond.to
          ) {
            nonzeros++;
          }
        }
      }
    }

    // Clamp to [0, 1]
    return Math.min(1.0, nonzeros / (n * n));
  }

  /**
   * Estimate condition number of system matrix
   * Higher = more numerically sensitive
   */
  private estimateConditionNumber(
    blocks: string[][],
    elements: EditorElement[]
  ): number {
    // Simplified: condition number ≈ max(resistance)/min(resistance)
    // for electrical systems
    let maxResistance = 1.0;
    let minResistance = 1.0;

    for (const element of elements) {
      if (element.type === 'R') {
        const r = (element.parameters?.resistance as number) || 1.0;
        maxResistance = Math.max(maxResistance, r);
        minResistance = Math.min(minResistance, r);
      }
    }

    const resistanceRatio = maxResistance / maxResistance;

    // Add contribution from block sizes
    const largestBlock = Math.max(0, ...blocks.map(b => b.length));
    const blockContribution = 1.0 + largestBlock * 0.1;

    return resistanceRatio * blockContribution;
  }

  /**
   * Generate human-readable description of ordering
   */
  private describeOrdering(
    blocks: string[][],
    cost: number,
    sparsity: number,
    condition: number
  ): string {
    const blockStr = `${blocks.length} block${blocks.length > 1 ? 's' : ''}`;
    const largestBlock = Math.max(0, ...blocks.map(b => b.length));
    const simultaneousStr =
      largestBlock > 1
        ? `largest simultaneous block: ${largestBlock} equations`
        : 'all equations can be solved sequentially';

    const sparsityPercent = ((1 - sparsity) * 100).toFixed(0);
    const costStr = cost > 1000 ? `${(cost / 1000).toFixed(1)}K` : `${cost.toFixed(0)}`;

    return `Optimized ordering: ${blockStr}, ${simultaneousStr}, ${sparsityPercent}% dense, ~${costStr} operations`;
  }

  /**
   * Estimate how much this ordering improves performance
   */
  public estimateImprovement(
    originalOrder: string[],
    optimizedOrder: EquationOrder
  ): number {
    // Assuming original is sequential (cost ≈ originalOrder.length)
    // Optimized cost from analysis
    const improvementFactor = originalOrder.length / Math.max(1, optimizedOrder.computationCost);
    return Math.max(1.0, improvementFactor); // Return as speedup ratio
  }

  /**
   * Suggest parallelization strategy
   */
  public suggestParallelization(order: EquationOrder): {
    parallelizable: number;
    sequential: number;
    recommendation: string;
  } {
    const parallelizable = order.simultaneousBlocks.length;
    const sequential = order.simultaneousBlocks.filter(b => b.length === 1).length;

    let recommendation = '';
    if (parallelizable < 3) {
      recommendation = 'Limited parallelization opportunity - single/dual threaded recommended';
    } else if (sequential < parallelizable / 2) {
      recommendation = 'Good parallelization opportunity - can use 4+ threads';
    } else {
      recommendation = 'Sequential solving recommended - significant dependencies';
    }

    return { parallelizable, sequential, recommendation };
  }
}

/**
 * Convenience function to optimize equation ordering
 */
export function optimizeEquationOrder(
  elements: EditorElement[],
  bonds: EditorBond[],
  causalities: Map<string, CausalityStatus>
): EquationOrder {
  const optimizer = new EquationOrderingOptimizer();
  return optimizer.optimizeOrdering(elements, bonds, causalities);
}
