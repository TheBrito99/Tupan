/**
 * Derivative Causality Minimization
 *
 * Identifies storage elements (C, I) with derivative causality and suggests
 * fixes to minimize numerical instability. Derivative causality occurs when
 * an element is required to produce a derivative output, which is numerically
 * problematic and should be avoided.
 */

import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';

/**
 * Severity levels for derivative causality
 * Order 0: Integral causality (perfect) - element computes integral
 * Order 1: Non-integral (problematic) - requires differentiating input
 * Order 2: 2nd derivative (very bad) - numerically unstable
 */
export type DerivativeOrder = 0 | 1 | 2;

/**
 * Ways to fix derivative causality issues
 */
export type Remedy = 'reorder' | 'restructure' | 'damp' | 'scale' | 'solver';

export interface RemedyInfo {
  type: Remedy;
  description: string;
  impact: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'medium' | 'complex';
  example?: string;
  implementation?: string;
}

/**
 * Detected derivative causality issue
 */
export interface DerivativeCausalityIssue {
  bondId: string;                           // Bond with problematic causality
  elementId: string;                        // Storage element (C or I)
  elementType: 'C' | 'I';                   // Type of storage
  derivativeOrder: DerivativeOrder;         // 0 = good, 1 = bad, 2 = very bad
  severity: 'critical' | 'warning' | 'info';
  explanation: string;                      // Human-readable description
  remedies: RemedyInfo[];                   // Ranked list of solutions
  affectedBonds: string[];                  // Bonds that depend on this
}

/**
 * Derivative causality optimizer
 */
export class DerivativeCausalityOptimizer {
  /**
   * Find all storage elements with problematic derivative causality
   */
  public findDerivativeCausalities(
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): DerivativeCausalityIssue[] {
    const issues: DerivativeCausalityIssue[] = [];

    // Check each storage element (C and I)
    for (const element of elements) {
      if (element.type !== 'C' && element.type !== 'I') continue;

      const elementBonds = bonds.filter(b => b.from === element.id || b.to === element.id);

      for (const bond of elementBonds) {
        const causality = causalities.get(bond.id);
        if (!causality) continue;

        const order = this.getDerivativeOrder(element, bond, causality);

        if (order > 0) {
          // Found a derivative causality issue
          const severity =
            order === 2 ? 'critical' : order === 1 ? 'warning' : 'info';

          const issue: DerivativeCausalityIssue = {
            bondId: bond.id,
            elementId: element.id,
            elementType: element.type,
            derivativeOrder: order,
            severity,
            explanation: this.explainDerivativeCausality(
              element,
              bond,
              causality,
              order
            ),
            remedies: [],
            affectedBonds: this.findAffectedBonds(bond, bonds),
          };

          issue.remedies = this.findRemedies(
            issue,
            element,
            bond,
            elements,
            bonds,
            causalities
          );

          issues.push(issue);
        }
      }
    }

    // Sort by severity
    return issues.sort((a, b) => {
      const severityRank = { critical: 0, warning: 1, info: 2 };
      return severityRank[a.severity] - severityRank[b.severity];
    });
  }

  /**
   * Determine derivative order for a storage element
   *
   * Integral causality (Order 0):
   * - Capacitor with EffortIn: V(t) = (1/C)∫i·dt (integrate current)
   * - Inductor with FlowIn: I(t) = (1/L)∫V·dt (integrate voltage)
   *
   * Non-integral causality (Order 1):
   * - Capacitor with FlowIn: V(t) = C·(di/dt) (differentiate current)
   * - Inductor with EffortOut: I(t) = (1/L)∫V·dt BUT V must be output
   *
   * 2nd Derivative (Order 2):
   * - Capacitor with EffortOut: i(t) = C·(dV/dt)
   * - Requires differentiating voltage twice in some configurations
   */
  private getDerivativeOrder(
    element: EditorElement,
    bond: EditorBond,
    causality: CausalityStatus
  ): DerivativeOrder {
    const isFrom = element.id === bond.from;

    if (element.type === 'C') {
      // Capacitor: q̇ = i/C, V = q/C
      // Integral causality: EffortIn (output current, input voltage)
      if (isFrom && causality === 'FlowOut') {
        // C outputs current → must differentiate charge → Order 1
        return 1;
      }
      if (!isFrom && causality === 'EffortOut') {
        // C outputs voltage → must differentiate charge twice → Order 2
        return 2;
      }
      // EffortIn and FlowIn are both reasonable, depending on context
      if (isFrom && causality === 'EffortOut') return 1;
      if (!isFrom && causality === 'FlowOut') return 1;
    }

    if (element.type === 'I') {
      // Inductor: ṗ = V, i = p/L
      // Integral causality: FlowIn (output voltage, input current)
      if (isFrom && causality === 'EffortOut') {
        // I outputs voltage → must differentiate momentum → Order 1
        return 1;
      }
      if (!isFrom && causality === 'FlowOut') {
        // I outputs current → requires integrating voltage
        // But if forced to output current: Order 2
        return 2;
      }
      if (isFrom && causality === 'FlowOut') return 1;
      if (!isFrom && causality === 'EffortOut') return 1;
    }

    return 0; // Integral causality
  }

  /**
   * Generate human-readable explanation of the derivative causality issue
   */
  private explainDerivativeCausality(
    element: EditorElement,
    bond: EditorBond,
    causality: CausalityStatus,
    order: DerivativeOrder
  ): string {
    const elementName = element.type === 'C' ? 'Capacitor' : 'Inductor';
    const orderStr =
      order === 1
        ? 'first derivative'
        : order === 2
          ? 'second derivative'
          : 'normal';

    return `${elementName} (${element.id}) has ${orderStr} causality (${causality}). ${
      order === 2
        ? 'This is very problematic - strongly recommend fixing.'
        : order === 1
          ? 'This requires differentiation - may cause numerical issues.'
          : 'This is acceptable.'
    }`;
  }

  /**
   * Find remedies for a derivative causality issue
   */
  private findRemedies(
    issue: DerivativeCausalityIssue,
    element: EditorElement,
    bond: EditorBond,
    elements: EditorElement[],
    bonds: EditorBond[],
    causalities: Map<string, CausalityStatus>
  ): RemedyInfo[] {
    const remedies: RemedyInfo[] = [];

    if (issue.derivativeOrder === 0) {
      return remedies; // No fixes needed
    }

    // 1. Reordering: try different causality assignments
    remedies.push({
      type: 'reorder',
      description: 'Change causality of connected bonds to force integral causality',
      impact: 'medium',
      complexity: 'simple',
      example:
        'If capacitor has FlowOut, change resistor output to force FlowIn on capacitor',
      implementation:
        'Run local SCAP propagation with different assumptions at this element',
    });

    // 2. Restructuring: add components
    if (issue.elementType === 'C') {
      remedies.push({
        type: 'restructure',
        description: 'Add series resistor to smooth voltage changes',
        impact: 'high',
        complexity: 'medium',
        example: 'Insert small resistor (1-10Ω) in series with problematic capacitor',
        implementation:
          'Requires user to manually add component or semi-automated insertion',
      });
    } else if (issue.elementType === 'I') {
      remedies.push({
        type: 'restructure',
        description: 'Add series resistor to model real inductor resistance',
        impact: 'high',
        complexity: 'medium',
        example: 'Insert small resistor (0.01-1Ω) to represent winding resistance',
        implementation:
          'Requires adding resistor in series or modifying inductor parameters',
      });
    }

    // 3. Damping: add parallel resistor
    remedies.push({
      type: 'damp',
      description: 'Add parallel resistor to dissipate problematic energy',
      impact: 'medium',
      complexity: 'simple',
      example:
        issue.elementType === 'C'
          ? 'Add 1MΩ resistor in parallel with capacitor'
          : 'Add high-resistance path in parallel',
      implementation: 'Add parallel component to reduce oscillations',
    });

    // 4. Scaling: adjust element values
    remedies.push({
      type: 'scale',
      description: 'Adjust element values to improve numerical conditioning',
      impact: 'low',
      complexity: 'simple',
      example:
        issue.elementType === 'C'
          ? 'Increase capacitance value to reduce dV/dt magnitude'
          : 'Increase inductance to reduce dI/dt magnitude',
      implementation:
        'Modify element parameters to increase time constants and reduce derivatives',
    });

    // 5. Solver adjustment
    remedies.push({
      type: 'solver',
      description: 'Use implicit solver designed for stiff systems',
      impact: 'low',
      complexity: 'simple',
      example: 'Switch from RK4 to BDF or IDA solver',
      implementation:
        'Phase 52 solver recommendation will automatically suggest appropriate solver',
    });

    // Rank by impact (low to high)
    return remedies.sort((a, b) => {
      const impactRank = { low: 2, medium: 1, high: 0 };
      return impactRank[a.impact] - impactRank[b.impact];
    });
  }

  /**
   * Find all bonds affected by this element's causality
   */
  private findAffectedBonds(bond: EditorBond, bonds: EditorBond[]): string[] {
    const affected: string[] = [];

    for (const otherBond of bonds) {
      if (otherBond.id === bond.id) continue;

      // Bonds sharing the same elements
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
   * Try to reorder causality to eliminate derivative causality
   * Returns new causality map if successful, null if not possible
   */
  public tryReordering(
    issue: DerivativeCausalityIssue,
    causalities: Map<string, CausalityStatus>,
    bonds: EditorBond[],
    elements: EditorElement[]
  ): Map<string, CausalityStatus> | null {
    // For now, return null - full implementation would run local SCAP
    // This is a placeholder for the complex reordering algorithm
    console.warn(
      'Reordering not yet implemented - use interactive debugger to manually explore alternatives'
    );
    return null;
  }

  /**
   * Get recommended remedy priority for this issue
   */
  public getRecommendedRemedy(
    issue: DerivativeCausalityIssue
  ): RemedyInfo | null {
    if (issue.remedies.length === 0) return null;

    // For critical issues, prefer immediate fixes (reorder, damp)
    if (issue.severity === 'critical') {
      const immediate = issue.remedies.find(r =>
        ['reorder', 'damp'].includes(r.type)
      );
      return immediate || issue.remedies[0];
    }

    // For warnings, prefer low-impact fixes
    const lowImpact = issue.remedies.find(r => r.impact === 'low');
    return lowImpact || issue.remedies[0];
  }

  /**
   * Estimate how much each remedy helps (0-1 scale)
   */
  public estimateRemedyEffectiveness(
    remedy: RemedyInfo,
    issue: DerivativeCausalityIssue
  ): number {
    // Effectiveness based on remedy type and issue severity
    const baseEffectiveness: Record<Remedy, number> = {
      reorder: 0.95,     // Fixes by design
      restructure: 0.85, // Adds component complexity
      damp: 0.7,         // Reduces but doesn't eliminate
      scale: 0.6,        // Helps numerically but not fundamentally
      solver: 0.5,       // Handles but doesn't fix
    };

    let effectiveness = baseEffectiveness[remedy.type];

    // Reduce effectiveness if issue is very severe
    if (issue.derivativeOrder === 2) {
      effectiveness *= 0.8; // 2nd derivatives are harder to fix
    }

    return Math.max(0, Math.min(1, effectiveness));
  }

  /**
   * Generate summary of all derivative causality issues
   */
  public summarizeIssues(issues: DerivativeCausalityIssue[]): {
    total: number;
    critical: number;
    warning: number;
    info: number;
    avgSeverity: number;
  } {
    const severityRank = { critical: 3, warning: 2, info: 1 };
    const severitySum = issues.reduce((sum, issue) => sum + severityRank[issue.severity], 0);

    return {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
      avgSeverity: issues.length > 0 ? severitySum / issues.length : 0,
    };
  }
}

/**
 * Convenience function to find all derivative causality issues
 */
export function findDerivativeCausalities(
  elements: EditorElement[],
  bonds: EditorBond[],
  causalities: Map<string, CausalityStatus>
): DerivativeCausalityIssue[] {
  const optimizer = new DerivativeCausalityOptimizer();
  return optimizer.findDerivativeCausalities(elements, bonds, causalities);
}

/**
 * Convert derivative order to human-readable string
 */
export function formatDerivativeOrder(order: DerivativeOrder): string {
  const names = {
    0: 'Integral (Good)',
    1: 'Non-integral (Problematic)',
    2: '2nd Derivative (Critical)',
  };
  return names[order];
}
