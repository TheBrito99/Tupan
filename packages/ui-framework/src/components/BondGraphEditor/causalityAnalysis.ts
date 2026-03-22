/**
 * Advanced Causality Analysis for Bond Graphs
 *
 * Performs detailed causality assignment with visualization support:
 * - Step-by-step SCAP algorithm
 * - Conflict detection and reporting
 * - Critical path analysis
 * - Derivative causality detection
 * - Bond prioritization for visualization
 */

import type { EditorElement, EditorBond } from './types';

/**
 * Causality status for a single bond
 */
export type CausalityStatus = 'Unassigned' | 'EffortOut' | 'FlowOut' | 'Conflict' | 'Derivative';

/**
 * Information about a bond's causality
 */
export interface BondCausalityInfo {
  bondId: string;
  fromElementId: string;
  toElementId: string;
  fromElementType: string;
  toElementType: string;
  status: CausalityStatus;
  step: number;                    // Which SCAP step assigned this causality
  reason: string;                  // Why this causality was assigned
  isCriticalPath: boolean;         // Part of critical path for some element
  hasDerivative: boolean;          // Requires derivative (problematic)
}

/**
 * Result of causality analysis
 */
export interface CausalityAnalysisResult {
  totalBonds: number;
  assignedBonds: number;
  unassignedBonds: number;
  conflictingBonds: number;
  derivativeBonds: number;
  bondDetails: BondCausalityInfo[];
  conflicts: CausalityConflict[];
  criticalPaths: ElementCriticalPath[];
  isValid: boolean;
  summary: string;
  steps: CausalityStep[];
}

/**
 * A causality conflict detected
 */
export interface CausalityConflict {
  bondId: string;
  reason: string;
  severity: 'error' | 'warning';
  suggestion: string;
  affectedElements: string[];
}

/**
 * Critical path through system
 */
export interface ElementCriticalPath {
  startElementId: string;
  endElementId: string;
  path: string[];              // Bond IDs forming path
  length: number;              // Number of bonds in path
  type: 'source-to-sink' | 'feedback-loop' | 'derivative-path';
}

/**
 * A step in the SCAP algorithm
 */
export interface CausalityStep {
  stepNumber: number;
  name: string;                // E.g., "Assign source causalities"
  description: string;
  bondsAssigned: string[];     // Bond IDs assigned in this step
  status: 'pending' | 'in_progress' | 'complete';
}

/**
 * Causality assignment status for visualization
 */
export interface CausalityVisualizationData {
  bondCausalities: Map<string, CausalityStatus>;
  criticalBonds: Set<string>;           // Bonds in critical paths
  conflictingBonds: Set<string>;        // Bonds with conflicts
  derivativeBonds: Set<string>;         // Bonds requiring derivatives
  stepProgress: number;                 // 0 to 1 (percentage complete)
  currentStep: CausalityStep | null;
  colors: Map<string, string>;          // Color for each bond based on status
}

/**
 * Detect element type
 */
function getElementCategory(type: string): 'source' | 'storage' | 'resistive' | 'transformer' | 'junction' {
  if (type === 'Se' || type === 'Sf') return 'source';
  if (type === 'C' || type === 'I') return 'storage';
  if (type === 'R') return 'resistive';
  if (type === 'TF' || type === 'GY') return 'transformer';
  if (type === 'Junction0' || type === 'Junction1') return 'junction';
  return 'resistive'; // Default fallback
}

/**
 * Perform comprehensive causality analysis
 */
export function analyzeCausality(
  elements: EditorElement[],
  bonds: EditorBond[]
): CausalityAnalysisResult {
  const bondDetails: BondCausalityInfo[] = [];
  const conflicts: CausalityConflict[] = [];
  const criticalPaths: ElementCriticalPath[] = [];
  const steps: CausalityStep[] = [];

  let assignedCount = 0;
  let conflictCount = 0;
  let derivativeCount = 0;

  // Step 1: Assign source causalities
  steps.push({
    stepNumber: 1,
    name: 'Assign Source Causalities',
    description: 'Se elements have EffortOut, Sf elements have FlowOut',
    bondsAssigned: [],
    status: 'pending',
  });

  const sourceEffortOutBonds = new Set<string>();
  const sourceFlowOutBonds = new Set<string>();

  for (const bond of bonds) {
    const fromElement = elements.find(e => e.id === bond.from);
    if (fromElement?.type === 'Se') {
      bondDetails.push({
        bondId: bond.id,
        fromElementId: bond.from,
        toElementId: bond.to,
        fromElementType: 'Se',
        toElementType: fromElement.type,
        status: 'EffortOut',
        step: 1,
        reason: 'Effort source has mandatory EffortOut causality',
        isCriticalPath: false,
        hasDerivative: false,
      });
      sourceEffortOutBonds.add(bond.id);
      assignedCount++;
      steps[0].bondsAssigned.push(bond.id);
    } else if (fromElement?.type === 'Sf') {
      bondDetails.push({
        bondId: bond.id,
        fromElementId: bond.from,
        toElementId: bond.to,
        fromElementType: 'Sf',
        toElementType: fromElement.type,
        status: 'FlowOut',
        step: 1,
        reason: 'Flow source has mandatory FlowOut causality',
        isCriticalPath: false,
        hasDerivative: false,
      });
      sourceFlowOutBonds.add(bond.id);
      assignedCount++;
      steps[0].bondsAssigned.push(bond.id);
    }
  }

  // Step 2: Assign mandatory storage causalities
  steps.push({
    stepNumber: 2,
    name: 'Assign Storage Mandatory Causality',
    description: 'C elements prefer EffortIn (integral causality), I elements prefer FlowIn',
    bondsAssigned: [],
    status: 'pending',
  });

  const storageInBonds = new Set<string>();

  for (const bond of bonds) {
    const toElement = elements.find(e => e.id === bond.to);
    if (toElement?.type === 'C') {
      // C element prefers EffortIn (effort from junction, flow into storage)
      const existingDetail = bondDetails.find(b => b.bondId === bond.id);
      if (!existingDetail) {
        bondDetails.push({
          bondId: bond.id,
          fromElementId: bond.from,
          toElementId: bond.to,
          fromElementType: elements.find(e => e.id === bond.from)?.type || 'unknown',
          toElementType: 'C',
          status: 'EffortOut',
          step: 2,
          reason: 'Capacitance has mandatory integral causality (EffortOut)',
          isCriticalPath: false,
          hasDerivative: false,
        });
        storageInBonds.add(bond.id);
        assignedCount++;
        steps[1].bondsAssigned.push(bond.id);
      }
    } else if (toElement?.type === 'I') {
      // I element prefers FlowIn (flow from junction, effort into storage)
      const existingDetail = bondDetails.find(b => b.bondId === bond.id);
      if (!existingDetail) {
        bondDetails.push({
          bondId: bond.id,
          fromElementId: bond.from,
          toElementId: bond.to,
          fromElementType: elements.find(e => e.id === bond.from)?.type || 'unknown',
          toElementType: 'I',
          status: 'FlowOut',
          step: 2,
          reason: 'Inductance has mandatory integral causality (FlowOut)',
          isCriticalPath: false,
          hasDerivative: false,
        });
        storageInBonds.add(bond.id);
        assignedCount++;
        steps[1].bondsAssigned.push(bond.id);
      }
    }
  }

  // Step 3: Propagate through junctions
  steps.push({
    stepNumber: 3,
    name: 'Propagate Through Junctions',
    description: '0-junction: one EffortOut (others FlowOut), 1-junction: one FlowOut (others EffortOut)',
    bondsAssigned: [],
    status: 'pending',
  });

  for (const element of elements) {
    if (element.type === 'Junction0' || element.type === 'Junction1') {
      const connectedBonds = bonds.filter(b => b.from === element.id || b.to === element.id);
      const isZeroJunction = element.type === 'Junction0';

      let effortOutCount = connectedBonds.filter(b => {
        const detail = bondDetails.find(d => d.bondId === b.id);
        return detail?.status === 'EffortOut';
      }).length;

      let flowOutCount = connectedBonds.filter(b => {
        const detail = bondDetails.find(d => d.bondId === b.id);
        return detail?.status === 'FlowOut';
      }).length;

      // Enforce junction rule
      if (isZeroJunction) {
        // 0-junction: exactly one EffortOut, rest FlowOut
        for (const bond of connectedBonds) {
          const existingDetail = bondDetails.find(b => b.bondId === bond.id);
          if (!existingDetail) {
            const newStatus = effortOutCount === 0 ? 'EffortOut' : 'FlowOut';
            bondDetails.push({
              bondId: bond.id,
              fromElementId: bond.from,
              toElementId: bond.to,
              fromElementType: elements.find(e => e.id === bond.from)?.type || 'unknown',
              toElementType: elements.find(e => e.id === bond.to)?.type || 'unknown',
              status: newStatus,
              step: 3,
              reason: `0-junction: ${effortOutCount === 0 ? 'first EffortOut' : 'remaining FlowOut'}`,
              isCriticalPath: false,
              hasDerivative: false,
            });
            assignedCount++;
            steps[2].bondsAssigned.push(bond.id);
            if (newStatus === 'EffortOut') effortOutCount++;
          }
        }
      } else {
        // 1-junction: exactly one FlowOut, rest EffortOut
        for (const bond of connectedBonds) {
          const existingDetail = bondDetails.find(b => b.bondId === bond.id);
          if (!existingDetail) {
            const newStatus = flowOutCount === 0 ? 'FlowOut' : 'EffortOut';
            bondDetails.push({
              bondId: bond.id,
              fromElementId: bond.from,
              toElementId: bond.to,
              fromElementType: elements.find(e => e.id === bond.from)?.type || 'unknown',
              toElementType: elements.find(e => e.id === bond.to)?.type || 'unknown',
              status: newStatus,
              step: 3,
              reason: `1-junction: ${flowOutCount === 0 ? 'first FlowOut' : 'remaining EffortOut'}`,
              isCriticalPath: false,
              hasDerivative: false,
            });
            assignedCount++;
            steps[2].bondsAssigned.push(bond.id);
            if (newStatus === 'FlowOut') flowOutCount++;
          }
        }
      }
    }
  }

  // Step 4: Flexible element assignment (R, TF, GY)
  steps.push({
    stepNumber: 4,
    name: 'Assign Flexible Elements',
    description: 'R, TF, GY elements can have either causality; assign based on constraints',
    bondsAssigned: [],
    status: 'pending',
  });

  for (const bond of bonds) {
    const fromElement = elements.find(e => e.id === bond.from);
    const toElement = elements.find(e => e.id === bond.to);

    if (fromElement && ['R', 'TF', 'GY'].includes(fromElement.type)) {
      if (!bondDetails.find(b => b.bondId === bond.id)) {
        // Assign arbitrary causality (prefer EffortOut for resistive)
        const newStatus = fromElement.type === 'R' ? 'EffortOut' : 'FlowOut';
        bondDetails.push({
          bondId: bond.id,
          fromElementId: bond.from,
          toElementId: bond.to,
          fromElementType: fromElement.type,
          toElementType: toElement?.type || 'unknown',
          status: newStatus,
          step: 4,
          reason: `Flexible ${fromElement.type} element: assigned arbitrary causality`,
          isCriticalPath: false,
          hasDerivative: false,
        });
        assignedCount++;
        steps[3].bondsAssigned.push(bond.id);
      }
    }
  }

  // Detect conflicts
  for (const junction of elements.filter(e => e.type === 'Junction0' || e.type === 'Junction1')) {
    const connectedBonds = bonds.filter(b => b.from === junction.id || b.to === junction.id);
    const isZeroJunction = junction.type === 'Junction0';

    const effortOutBonds = connectedBonds.filter(b => {
      const detail = bondDetails.find(d => d.bondId === b.id);
      return detail?.status === 'EffortOut';
    });

    const flowOutBonds = connectedBonds.filter(b => {
      const detail = bondDetails.find(d => d.bondId === b.id);
      return detail?.status === 'FlowOut';
    });

    if (isZeroJunction && effortOutBonds.length !== 1) {
      conflicts.push({
        bondId: effortOutBonds[0]?.id || '',
        reason: `0-junction has ${effortOutBonds.length} EffortOut bonds (should be exactly 1)`,
        severity: 'error',
        suggestion: 'Ensure exactly one bond has EffortOut causality at each 0-junction',
        affectedElements: [junction.id],
      });
      conflictCount++;
    }

    if (!isZeroJunction && flowOutBonds.length !== 1) {
      conflicts.push({
        bondId: flowOutBonds[0]?.id || '',
        reason: `1-junction has ${flowOutBonds.length} FlowOut bonds (should be exactly 1)`,
        severity: 'error',
        suggestion: 'Ensure exactly one bond has FlowOut causality at each 1-junction',
        affectedElements: [junction.id],
      });
      conflictCount++;
    }
  }

  // Detect derivative causality (problematic)
  for (const bond of bonds) {
    const fromElement = elements.find(e => e.id === bond.from);
    const toElement = elements.find(e => e.id === bond.to);
    const detail = bondDetails.find(d => d.bondId === bond.id);

    // C element with FlowOut requires derivative (not ideal)
    if (toElement?.type === 'C' && detail?.status === 'FlowOut') {
      if (detail) {
        detail.hasDerivative = true;
        derivativeCount++;
      }
      conflicts.push({
        bondId: bond.id,
        reason: 'Capacitor has derivative causality (requires dq/dt)',
        severity: 'warning',
        suggestion: 'Avoid derivative causality on storage elements if possible',
        affectedElements: [bond.from, bond.to],
      });
    }

    // I element with EffortOut requires derivative (not ideal)
    if (toElement?.type === 'I' && detail?.status === 'EffortOut') {
      if (detail) {
        detail.hasDerivative = true;
        derivativeCount++;
      }
      conflicts.push({
        bondId: bond.id,
        reason: 'Inductor has derivative causality (requires dp/dt)',
        severity: 'warning',
        suggestion: 'Avoid derivative causality on storage elements if possible',
        affectedElements: [bond.from, bond.to],
      });
    }
  }

  // Analyze critical paths
  const visitedBonds = new Set<string>();

  function findCriticalPath(startBondId: string, visited = new Set<string>()): string[] {
    if (visited.has(startBondId)) return [];
    visited.add(startBondId);

    const bond = bonds.find(b => b.id === startBondId);
    if (!bond) return [startBondId];

    const nextBonds = bonds.filter(b => b.from === bond.to && !visited.has(b.id));
    const path = [startBondId];

    for (const nextBond of nextBonds) {
      const subpath = findCriticalPath(nextBond.id, new Set(visited));
      if (subpath.length > 0) {
        return path.concat(subpath);
      }
    }

    return path;
  }

  // Mark bonds in critical paths
  for (const bond of bonds) {
    const path = findCriticalPath(bond.id);
    if (path.length > 2) {
      for (const bondId of path) {
        const detail = bondDetails.find(d => d.bondId === bondId);
        if (detail) detail.isCriticalPath = true;
      }

      criticalPaths.push({
        startElementId: bond.from,
        endElementId: bonds[bonds.length - 1].to,
        path,
        length: path.length,
        type: 'source-to-sink',
      });
    }
  }

  // Update step statuses
  steps.forEach((step, idx) => {
    step.status = idx <= 3 ? 'complete' : 'pending';
  });

  const unassignedBonds = bonds.filter(b => !bondDetails.find(d => d.bondId === b.id)).length;
  const isValid = conflictCount === 0 && unassignedBonds === 0;

  const summary = isValid
    ? `✓ Valid causality: ${assignedCount}/${bonds.length} bonds assigned, no conflicts`
    : `✗ Causality issues: ${assignedCount}/${bonds.length} assigned, ${conflictCount} conflicts, ${unassignedBonds} unassigned`;

  return {
    totalBonds: bonds.length,
    assignedBonds: assignedCount,
    unassignedBonds,
    conflictingBonds: conflictCount,
    derivativeBonds: derivativeCount,
    bondDetails,
    conflicts,
    criticalPaths,
    isValid,
    summary,
    steps,
  };
}

/**
 * Get visualization colors for causality bonds
 */
export function getCausalityVisualizationColors(): Map<string, string> {
  return new Map([
    ['EffortOut', '#2196F3'],      // Blue
    ['FlowOut', '#4CAF50'],        // Green
    ['Unassigned', '#CCCCCC'],     // Gray
    ['Conflict', '#F44336'],       // Red
    ['Derivative', '#FF9800'],     // Orange
    ['Critical', '#FFD700'],       // Gold (highlight)
  ]);
}

/**
 * Generate human-readable causality explanation
 */
export function explainCausality(bond: BondCausalityInfo): string {
  const explanations: Record<CausalityStatus, string> = {
    EffortOut: `Effort (voltage/force/temperature) flows from ${bond.fromElementType} to ${bond.toElementType}; flow is the input`,
    FlowOut: `Flow (current/velocity/heat-flow) flows from ${bond.fromElementType} to ${bond.toElementType}; effort is the input`,
    Unassigned: 'This bond has not yet been assigned causality. This may be an error.',
    Conflict: 'This bond has conflicting causality constraints. Check junction connections.',
    Derivative: `This bond requires the derivative of its across-variable. This is less desirable than integral causality.`,
  };

  return explanations[bond.status] || 'Unknown causality status';
}
