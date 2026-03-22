/**
 * Feedback Path Analysis
 *
 * Identifies feedback loops in the system and classifies them as positive
 * (destabilizing) or negative (stabilizing). Estimates loop gain and
 * system stiffness from feedback structure and element values.
 */

import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';

/**
 * Feedback loop with gain and stability information
 */
export interface FeedbackPath {
  bondIds: string[];                        // Complete path from source to sink
  elementIds: string[];                     // Elements in the path
  type: 'positive' | 'negative' | 'structural';
  loopGain: number;                         // Product of gains along path
  timeConstant: number;                     // Dominant time scale (seconds)
  stability: 'stable' | 'marginally' | 'unstable';
  components: {
    storageCount: number;                   // Number of C/I elements
    gainProduct: number;                    // Product of resistor values (inverse)
    totalDelay: number;                     // Sum of time constants
  };
  description: string;                      // Human-readable explanation
  affectedElements: string[];               // Elements strongly influenced by this loop
}

/**
 * Stiffness rating for the system
 */
export interface StiffnessRating {
  ratio: number;                            // Condition number estimate
  classification: 'non-stiff' | 'mildly-stiff' | 'stiff' | 'very-stiff';
  explanation: string;
  feedbackContribution: number;             // 0-1: how much feedback contributes to stiffness
}

/**
 * Feedback path analyzer
 */
export class FeedbackPathAnalyzer {
  /**
   * Find all feedback paths in the system
   */
  public findFeedbackPaths(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): FeedbackPath[] {
    const paths: FeedbackPath[] = [];

    // Build a directed graph of causality dependencies
    const graph = this.buildCausalityGraph(bonds, causalities);

    // Find cycles in the graph (feedback loops)
    const cycles = this.findCycles(graph, bonds);

    // Analyze each cycle
    for (const cycle of cycles) {
      const path = this.analyzeCycle(
        cycle,
        bonds,
        elements,
        causalities
      );
      if (path) {
        paths.push(path);
      }
    }

    // Sort by loop gain (most influential first)
    return paths.sort((a, b) => Math.abs(b.loopGain) - Math.abs(a.loopGain));
  }

  /**
   * Build directed graph of causality dependencies
   */
  private buildCausalityGraph(
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const bond of bonds) {
      if (!graph.has(bond.id)) {
        graph.set(bond.id, []);
      }

      const causality = causalities.get(bond.id);
      if (!causality || causality === 'Unassigned') continue;

      // Add edges based on causality direction
      // Edge from A to B means B depends on A's computation
      for (const otherBond of bonds) {
        if (bond.id === otherBond.id) continue;

        // Check if there's a dependency
        if (this.hasDependency(bond, otherBond, causality)) {
          graph.get(bond.id)?.push(otherBond.id);
        }
      }
    }

    return graph;
  }

  /**
   * Check if bond A creates a dependency on bond B
   */
  private hasDependency(
    bondA: EditorBond,
    bondB: EditorBond,
    causalityA: CausalityStatus
  ): boolean {
    // Effort/Flow out means the element's output depends on input
    // So if A's target element is B's source, there's a dependency
    if (
      (causalityA === 'EffortOut' || causalityA === 'FlowOut') &&
      (bondA.to === bondB.from || bondA.to === bondB.to)
    ) {
      return true;
    }

    // Effort/Flow in means the element's input depends on output
    if (
      (causalityA === 'EffortIn' || causalityA === 'FlowIn') &&
      (bondA.from === bondB.from || bondA.from === bondB.to)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Find all cycles in the dependency graph using DFS
   */
  private findCycles(graph: Map<string, string[]>, bonds: EditorBond[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, path);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycles.push(cycle);
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Analyze a feedback cycle and create FeedbackPath
   */
  private analyzeCycle(
    cycle: string[],
    bonds: EditorBond[],
    elements: EditorElement[],
    causalities: Map<string, CausalityStatus>
  ): FeedbackPath | null {
    // Get all elements in the cycle
    const elementIds = new Set<string>();
    for (const bondId of cycle) {
      const bond = bonds.find(b => b.id === bondId);
      if (bond) {
        elementIds.add(bond.from);
        elementIds.add(bond.to);
      }
    }

    // Calculate loop gain
    let loopGain = 1.0;
    let storageCount = 0;
    let totalDelay = 0;

    for (const elementId of elementIds) {
      const element = elements.find(e => e.id === elementId);
      if (!element) continue;

      if (element.type === 'R') {
        // Resistance adds gain (1/R)
        const resistance = (element.parameters?.resistance as number) || 1.0;
        loopGain *= 1.0 / resistance;
      } else if (element.type === 'C') {
        storageCount++;
        // Capacitance adds time constant
        const capacitance = (element.parameters?.capacitance as number) || 1.0;
        totalDelay += capacitance; // Simplified: real formula is R*C
      } else if (element.type === 'I') {
        storageCount++;
        // Inductance adds time constant
        const inertance = (element.parameters?.inertance as number) || 1.0;
        totalDelay += inertance;
      } else if (element.type === 'TF') {
        // Transformer scales gain
        const ratio = (element.parameters?.ratio as number) || 1.0;
        loopGain *= ratio;
      } else if (element.type === 'GY') {
        // Gyrator inverts gain
        const ratio = (element.parameters?.ratio as number) || 1.0;
        loopGain *= -ratio;
      }
    }

    // Clamp loop gain to reasonable range
    loopGain = Math.max(-100, Math.min(100, loopGain));

    // Determine feedback type
    const type = this.classifyFeedback(cycle, bonds, loopGain);

    // Determine stability
    const stability = this.classifyStability(loopGain);

    // Average time constant
    const timeConstant = storageCount > 0 ? totalDelay / storageCount : 0.001;

    // Generate description
    const description = this.describeFeedback(
      type,
      loopGain,
      storageCount,
      timeConstant
    );

    return {
      bondIds: cycle,
      elementIds: Array.from(elementIds),
      type,
      loopGain: Math.abs(loopGain) > 0.01 ? loopGain : 0, // Avoid very small values
      timeConstant: Math.max(0.0001, timeConstant),
      stability,
      components: {
        storageCount,
        gainProduct: loopGain,
        totalDelay,
      },
      description,
      affectedElements: Array.from(elementIds),
    };
  }

  /**
   * Classify feedback as positive or negative
   */
  private classifyFeedback(
    cycle: string[],
    bonds: EditorBond[],
    loopGain: number
  ): 'positive' | 'negative' | 'structural' {
    // Count inversions in the path (sign changes)
    let inversionCount = 0;

    // This is simplified - real implementation would track sign through entire path
    // For now, use loop gain to determine type
    if (Math.abs(loopGain) < 0.01) {
      return 'structural'; // Very weak feedback
    } else if (loopGain < 0) {
      return 'negative'; // Negative gain → stable
    } else {
      return 'positive'; // Positive gain → potentially unstable
    }
  }

  /**
   * Classify stability of feedback path
   */
  private classifyStability(loopGain: number): 'stable' | 'marginally' | 'unstable' {
    const absGain = Math.abs(loopGain);

    if (absGain > 1.1) {
      return 'unstable'; // Gain > 1 → grows unbounded
    } else if (absGain > 0.9) {
      return 'marginally'; // Gain ≈ 1 → critical stability
    } else {
      return 'stable'; // Gain < 1 → decays
    }
  }

  /**
   * Generate human-readable description of feedback
   */
  private describeFeedback(
    type: string,
    loopGain: number,
    storageCount: number,
    timeConstant: number
  ): string {
    const gainStr = loopGain > 0 ? `+${loopGain.toFixed(2)}` : loopGain.toFixed(2);
    const storageStr =
      storageCount === 0
        ? 'instantaneous'
        : storageCount === 1
          ? 'single-order'
          : `${storageCount}th-order`;

    return `${type.toUpperCase()} feedback loop (gain: ${gainStr}, ${storageStr}, τ=${timeConstant.toFixed(3)}s)`;
  }

  /**
   * Rate system stiffness based on feedback paths
   */
  public rateStiffness(paths: FeedbackPath[]): StiffnessRating {
    if (paths.length === 0) {
      return {
        ratio: 1.0,
        classification: 'non-stiff',
        explanation: 'No feedback paths detected - system should solve easily',
        feedbackContribution: 0,
      };
    }

    // Estimate stiffness from time scale separation
    let maxTimeConstant = 0;
    let minTimeConstant = Infinity;

    for (const path of paths) {
      maxTimeConstant = Math.max(maxTimeConstant, path.timeConstant);
      minTimeConstant = Math.min(minTimeConstant, path.timeConstant);
    }

    // Stiffness ratio = max time constant / min time constant
    const ratio =
      minTimeConstant > 0 ? maxTimeConstant / minTimeConstant : 1.0;

    let classification: 'non-stiff' | 'mildly-stiff' | 'stiff' | 'very-stiff';
    if (ratio < 10) {
      classification = 'non-stiff';
    } else if (ratio < 100) {
      classification = 'mildly-stiff';
    } else if (ratio < 1000) {
      classification = 'stiff';
    } else {
      classification = 'very-stiff';
    }

    // Calculate feedback contribution
    let feedbackContribution = 0;
    const unstablePaths = paths.filter(p => p.stability === 'unstable').length;
    feedbackContribution = Math.min(1.0, unstablePaths / Math.max(1, paths.length));

    const explanation = this.explainStiffness(
      ratio,
      classification,
      paths.length,
      unstablePaths
    );

    return {
      ratio,
      classification,
      explanation,
      feedbackContribution,
    };
  }

  /**
   * Generate explanation of stiffness rating
   */
  private explainStiffness(
    ratio: number,
    classification: string,
    pathCount: number,
    unstableCount: number
  ): string {
    const ratioStr = `Stiffness ratio: ${ratio.toFixed(1)}:1`;

    let detail = '';
    if (classification === 'non-stiff') {
      detail =
        '- All time scales similar, standard explicit solver (RK4) suitable';
    } else if (classification === 'mildly-stiff') {
      detail =
        '- Some time scale separation, consider adaptive solver (RK45) or implicit';
    } else if (classification === 'stiff') {
      detail =
        '- Significant time scale separation, implicit solver (BDF/IDA) recommended';
    } else {
      detail =
        '- Very stiff system, use robust implicit solver with small time steps';
    }

    let stability = '';
    if (unstableCount > 0) {
      stability = ` (⚠️ ${unstableCount} unstable feedback path${unstableCount > 1 ? 's' : ''})`;
    }

    return `${ratioStr}. ${pathCount} feedback path${pathCount > 1 ? 's' : ''} found${stability}. ${detail}`;
  }

  /**
   * Find critical feedback paths (those most affecting system behavior)
   */
  public findCriticalPaths(
    paths: FeedbackPath[],
    threshold: number = 0.8
  ): FeedbackPath[] {
    if (paths.length === 0) return [];

    // Sort by absolute loop gain
    const sorted = [...paths].sort((a, b) => Math.abs(b.loopGain) - Math.abs(a.loopGain));

    // Find paths with significant loop gain
    const maxGain = Math.abs(sorted[0]?.loopGain || 1);
    return sorted.filter(p => Math.abs(p.loopGain) > threshold * maxGain);
  }

  /**
   * Suggest solver based on feedback analysis
   */
  public suggestSolver(
    stiffness: StiffnessRating
  ): 'RK4' | 'RK45' | 'DOPRI' | 'BDF' | 'IDA' {
    if (stiffness.feedbackContribution > 0.5 || stiffness.ratio > 100) {
      // Stiff system with unstable feedback → implicit solver
      return 'IDA';
    } else if (stiffness.classification === 'stiff') {
      return 'BDF';
    } else if (stiffness.classification === 'mildly-stiff') {
      return 'RK45'; // Adaptive explicit
    } else {
      return 'RK4'; // Simple explicit
    }
  }

  /**
   * Estimate how system will respond to perturbations
   */
  public estimateResponseSpeed(paths: FeedbackPath[]): {
    fastest: number;
    slowest: number;
    avgTimeConstant: number;
  } {
    if (paths.length === 0) {
      return { fastest: 0.001, slowest: 1.0, avgTimeConstant: 0.1 };
    }

    const timeConstants = paths.map(p => p.timeConstant);
    const sorted = timeConstants.sort((a, b) => a - b);

    return {
      fastest: sorted[0],
      slowest: sorted[sorted.length - 1],
      avgTimeConstant:
        timeConstants.reduce((a, b) => a + b, 0) / timeConstants.length,
    };
  }
}

/**
 * Convenience function to find feedback paths
 */
export function findFeedbackPaths(
  elements: EditorElement[],
  bonds: EditorBond[],
  causalities: Map<string, CausalityStatus>
): FeedbackPath[] {
  const analyzer = new FeedbackPathAnalyzer();
  return analyzer.findFeedbackPaths(elements, bonds, causalities);
}

/**
 * Convenience function to rate system stiffness
 */
export function rateSystemStiffness(
  paths: FeedbackPath[]
): StiffnessRating {
  const analyzer = new FeedbackPathAnalyzer();
  return analyzer.rateStiffness(paths);
}
