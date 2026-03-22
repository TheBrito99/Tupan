/**
 * Interactive Causality Debugger
 *
 * Provides step-by-step SCAP algorithm execution with:
 * - Manual causality assignment
 * - Undo/redo support
 * - Validation at each step
 * - Educational reasoning explanations
 * - Suggested fixes for conflicts
 */

import type { EditorElement, EditorBond } from './types';
import type { BondCausalityInfo, CausalityStatus } from './causalityAnalysis';

/**
 * State of debugger execution
 */
export type DebuggerState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

/**
 * Step in the debugger walkthrough
 */
export interface DebuggerStep {
  stepNumber: number;
  phaseName: 'Sources' | 'Storage' | 'Junctions' | 'Flexible' | 'Complete';
  description: string;
  reasoning: string;                    // Why this step is being done
  bondAssignments: Array<{
    bondId: string;
    fromElementId: string;
    toElementId: string;
    assignedCausality: CausalityStatus;
    reason: string;                     // Specific reason for this assignment
  }>;
  elementsAffected: string[];           // Element IDs affected in this step
  bondsAffected: string[];              // Bond IDs affected in this step
  conflictsFound: string[];             // New conflicts discovered
  isOptional: boolean;                  // Can user skip or modify this step
}

/**
 * Manual override for a bond's causality
 */
export interface ManualOverride {
  bondId: string;
  forcedCausality: CausalityStatus;
  reason: string;
  timestamp: number;
}

/**
 * Undo/redo history entry
 */
export interface HistoryEntry {
  timestamp: number;
  action: 'assign_causality' | 'manual_override' | 'auto_assign' | 'reset';
  affectedBonds: string[];
  causalities: Map<string, CausalityStatus>;
  description: string;
}

/**
 * State of the debugger during execution
 */
export interface CausalityDebuggerState {
  currentStepIndex: number;
  totalSteps: number;
  state: DebuggerState;
  bondCausalities: Map<string, CausalityStatus>;
  bondReasons: Map<string, string>;
  manualOverrides: Map<string, ManualOverride>;
  conflicts: Array<{
    bondId: string;
    reason: string;
    severity: 'error' | 'warning';
    suggestion: string;
  }>;
  unassignedBonds: Set<string>;
  history: HistoryEntry[];
  historyIndex: number;                 // Current position in history
}

/**
 * Interactive Causality Debugger
 *
 * Executes SCAP algorithm step-by-step with manual intervention support
 */
export class CausalityDebugger {
  private elements: EditorElement[];
  private bonds: EditorBond[];
  private state: CausalityDebuggerState;
  private steps: DebuggerStep[] = [];

  constructor(elements: EditorElement[], bonds: EditorBond[]) {
    this.elements = elements;
    this.bonds = bonds;

    this.state = {
      currentStepIndex: 0,
      totalSteps: 0,
      state: 'idle',
      bondCausalities: new Map(),
      bondReasons: new Map(),
      manualOverrides: new Map(),
      conflicts: [],
      unassignedBonds: new Set(bonds.map((b) => b.id)),
      history: [],
      historyIndex: -1,
    };

    this.initializeSteps();
  }

  /**
   * Initialize all SCAP steps
   */
  private initializeSteps(): void {
    this.steps = [
      {
        stepNumber: 1,
        phaseName: 'Sources',
        description: 'Assign causality to effort and flow sources',
        reasoning:
          'Sources drive the system. Effort sources (Se) output effort, flow sources (Sf) output flow. This is the starting point for causality propagation.',
        bondAssignments: this.computeSourceCausalities(),
        elementsAffected: this.elements
          .filter((e) => e.type === 'Se' || e.type === 'Sf')
          .map((e) => e.id),
        bondsAffected: [],
        conflictsFound: [],
        isOptional: false,
      },
      {
        stepNumber: 2,
        phaseName: 'Storage',
        description: 'Assign mandatory causality to storage elements',
        reasoning:
          'Capacitors and inductors have preferred integral causality. C elements prefer effort input (flow drives charge), I elements prefer flow input (effort drives momentum). This avoids taking derivatives of state variables.',
        bondAssignments: this.computeStorageCausalities(),
        elementsAffected: this.elements
          .filter((e) => e.type === 'C' || e.type === 'I')
          .map((e) => e.id),
        bondsAffected: [],
        conflictsFound: [],
        isOptional: false,
      },
      {
        stepNumber: 3,
        phaseName: 'Junctions',
        description: 'Propagate causality through junctions',
        reasoning:
          '0-junctions (effort common): one effort out, others flow out. 1-junctions (flow common): one flow out, others effort out. Junction rules enforce compatibility.',
        bondAssignments: this.computeJunctionCausalities(),
        elementsAffected: this.elements
          .filter((e) => e.type === 'Junction0' || e.type === 'Junction1')
          .map((e) => e.id),
        bondsAffected: [],
        conflictsFound: [],
        isOptional: false,
      },
      {
        stepNumber: 4,
        phaseName: 'Flexible',
        description: 'Assign arbitrary causality to flexible elements',
        reasoning:
          'Resistors, transformers, and gyrators can have causality in either direction. Assign based on remaining unassigned bonds. Minimize derivatives if possible.',
        bondAssignments: this.computeFlexibleCausalities(),
        elementsAffected: this.elements
          .filter((e) => e.type === 'R' || e.type === 'TF' || e.type === 'GY')
          .map((e) => e.id),
        bondsAffected: [],
        conflictsFound: [],
        isOptional: true,
      },
      {
        stepNumber: 5,
        phaseName: 'Complete',
        description: 'Complete causality assignment',
        reasoning:
          'Check for conflicts, validate causality, and report any unresolved issues. If derivatives are required, note which bonds have non-integral causality.',
        bondAssignments: [],
        elementsAffected: [],
        bondsAffected: [],
        conflictsFound: [],
        isOptional: false,
      },
    ];

    this.state.totalSteps = this.steps.length;
  }

  /**
   * Compute Step 1: Source causalities
   */
  private computeSourceCausalities(): DebuggerStep['bondAssignments'] {
    const assignments: DebuggerStep['bondAssignments'] = [];

    for (const bond of this.bonds) {
      const fromElement = this.elements.find((e) => e.id === bond.from);
      if (!fromElement) continue;

      if (fromElement.type === 'Se') {
        assignments.push({
          bondId: bond.id,
          fromElementId: bond.from,
          toElementId: bond.to,
          assignedCausality: 'EffortOut',
          reason: `Se (effort source) at ${fromElement.name || bond.from} drives effort through bond`,
        });
      } else if (fromElement.type === 'Sf') {
        assignments.push({
          bondId: bond.id,
          fromElementId: bond.from,
          toElementId: bond.to,
          assignedCausality: 'FlowOut',
          reason: `Sf (flow source) at ${fromElement.name || bond.from} drives flow through bond`,
        });
      }
    }

    return assignments;
  }

  /**
   * Compute Step 2: Storage element causalities
   */
  private computeStorageCausalities(): DebuggerStep['bondAssignments'] {
    const assignments: DebuggerStep['bondAssignments'] = [];

    for (const bond of this.bonds) {
      // Check if either end is a storage element
      const toElement = this.elements.find((e) => e.id === bond.to);
      const fromElement = this.elements.find((e) => e.id === bond.from);

      if (toElement?.type === 'C' && !this.state.bondCausalities.has(bond.id)) {
        assignments.push({
          bondId: bond.id,
          fromElementId: bond.from,
          toElementId: bond.to,
          assignedCausality: 'EffortIn',
          reason: `Capacitor ${toElement.name || bond.to} prefers effort input (integral causality: dQ/dt = flow)`,
        });
      } else if (toElement?.type === 'I' && !this.state.bondCausalities.has(bond.id)) {
        assignments.push({
          bondId: bond.id,
          fromElementId: bond.from,
          toElementId: bond.to,
          assignedCausality: 'FlowIn',
          reason: `Inductor ${toElement.name || bond.to} prefers flow input (integral causality: dP/dt = effort)`,
        });
      }
    }

    return assignments;
  }

  /**
   * Compute Step 3: Junction causalities
   */
  private computeJunctionCausalities(): DebuggerStep['bondAssignments'] {
    const assignments: DebuggerStep['bondAssignments'] = [];

    // For each junction, apply junction rules
    for (const element of this.elements) {
      if (element.type !== 'Junction0' && element.type !== 'Junction1') continue;

      const connectedBonds = this.bonds.filter((b) => b.from === element.id || b.to === element.id);
      const assignedBonds = connectedBonds.filter((b) => this.state.bondCausalities.has(b.id));

      if (element.type === 'Junction0') {
        // 0-junction: one EffortOut, rest FlowOut
        const effortOuts = assignedBonds.filter(
          (b) => this.state.bondCausalities.get(b.id) === 'EffortOut'
        );

        if (effortOuts.length === 0 && assignedBonds.length > 0) {
          // Assign one effort out, rest flow out
          for (const bond of connectedBonds) {
            if (this.state.bondCausalities.has(bond.id)) continue;

            if (assignedBonds.indexOf(bond) === 0) {
              assignments.push({
                bondId: bond.id,
                fromElementId: bond.from,
                toElementId: bond.to,
                assignedCausality: 'EffortOut',
                reason: `0-junction: first assigned bond drives effort, others follow flow`,
              });
            } else {
              assignments.push({
                bondId: bond.id,
                fromElementId: bond.from,
                toElementId: bond.to,
                assignedCausality: 'FlowOut',
                reason: `0-junction rule: effort common, so other bonds output flow`,
              });
            }
          }
        }
      } else if (element.type === 'Junction1') {
        // 1-junction: one FlowOut, rest EffortOut
        const flowOuts = assignedBonds.filter((b) => this.state.bondCausalities.get(b.id) === 'FlowOut');

        if (flowOuts.length === 0 && assignedBonds.length > 0) {
          for (const bond of connectedBonds) {
            if (this.state.bondCausalities.has(bond.id)) continue;

            if (assignedBonds.indexOf(bond) === 0) {
              assignments.push({
                bondId: bond.id,
                fromElementId: bond.from,
                toElementId: bond.to,
                assignedCausality: 'FlowOut',
                reason: `1-junction: first assigned bond drives flow, others follow effort`,
              });
            } else {
              assignments.push({
                bondId: bond.id,
                fromElementId: bond.from,
                toElementId: bond.to,
                assignedCausality: 'EffortOut',
                reason: `1-junction rule: flow common, so other bonds output effort`,
              });
            }
          }
        }
      }
    }

    return assignments;
  }

  /**
   * Compute Step 4: Flexible element causalities
   */
  private computeFlexibleCausalities(): DebuggerStep['bondAssignments'] {
    const assignments: DebuggerStep['bondAssignments'] = [];

    for (const bond of this.bonds) {
      if (this.state.bondCausalities.has(bond.id)) continue;

      const fromElement = this.elements.find((e) => e.id === bond.from);
      if (!fromElement || !['R', 'TF', 'GY'].includes(fromElement.type)) continue;

      // For flexible elements, prefer arbitrary direction
      // Default: from → to (but can be overridden)
      assignments.push({
        bondId: bond.id,
        fromElementId: bond.from,
        toElementId: bond.to,
        assignedCausality: 'EffortOut',
        reason: `${fromElement.type} element can have arbitrary causality. Default: element drives effort.`,
      });
    }

    return assignments;
  }

  /**
   * Start debugger execution
   */
  public start(): void {
    this.state.state = 'running';
    this.state.currentStepIndex = 0;
    this.state.bondCausalities.clear();
    this.state.manualOverrides.clear();
    this.state.conflicts = [];
    this.state.unassignedBonds = new Set(this.bonds.map((b) => b.id));
  }

  /**
   * Execute next step automatically
   */
  public nextStep(): boolean {
    if (this.state.currentStepIndex >= this.steps.length) {
      this.state.state = 'completed';
      return false;
    }

    const step = this.steps[this.state.currentStepIndex];

    // Apply all assignments in this step
    for (const assignment of step.bondAssignments) {
      this.state.bondCausalities.set(assignment.bondId, assignment.assignedCausality);
      this.state.bondReasons.set(assignment.bondId, assignment.reason);
      this.state.unassignedBonds.delete(assignment.bondId);
    }

    // Record history
    this.recordHistory('auto_assign', step.bondAssignments.map((a) => a.bondId), step.description);

    this.state.currentStepIndex++;

    if (this.state.currentStepIndex >= this.steps.length) {
      this.state.state = 'completed';
    }

    return true;
  }

  /**
   * Pause execution
   */
  public pause(): void {
    this.state.state = 'paused';
  }

  /**
   * Resume execution
   */
  public resume(): void {
    if (this.state.state === 'paused') {
      this.state.state = 'running';
    }
  }

  /**
   * Manually assign causality to a bond
   */
  public manualAssign(bondId: string, causality: CausalityStatus, reason: string): boolean {
    const bond = this.bonds.find((b) => b.id === bondId);
    if (!bond) return false;

    // Validate assignment
    const validation = this.validateAssignment(bondId, causality);
    if (!validation.valid) {
      this.state.conflicts.push({
        bondId,
        reason: validation.reason,
        severity: validation.severity,
        suggestion: validation.suggestion,
      });
      return false;
    }

    // Record override
    this.state.manualOverrides.set(bondId, {
      bondId,
      forcedCausality: causality,
      reason,
      timestamp: Date.now(),
    });

    this.state.bondCausalities.set(bondId, causality);
    this.state.bondReasons.set(bondId, `Manual: ${reason}`);
    this.state.unassignedBonds.delete(bondId);

    this.recordHistory('manual_override', [bondId], `Manual assignment: ${reason}`);

    return true;
  }

  /**
   * Validate a proposed causality assignment
   */
  private validateAssignment(
    bondId: string,
    causality: CausalityStatus
  ): { valid: boolean; reason: string; severity: 'error' | 'warning'; suggestion: string } {
    const bond = this.bonds.find((b) => b.id === bondId);
    if (!bond) {
      return { valid: false, reason: 'Bond not found', severity: 'error', suggestion: 'Check bond ID' };
    }

    const fromElement = this.elements.find((e) => e.id === bond.from);
    const toElement = this.elements.find((e) => e.id === bond.to);

    // Check for derivative causality on storage
    if (causality === 'FlowOut' && toElement?.type === 'C') {
      return {
        valid: false,
        reason: 'Capacitor cannot have flow output (requires derivative)',
        severity: 'error',
        suggestion: 'Use EffortIn for integral causality',
      };
    }

    if (causality === 'EffortOut' && toElement?.type === 'I') {
      return {
        valid: false,
        reason: 'Inductor cannot have effort output (requires derivative)',
        severity: 'error',
        suggestion: 'Use FlowIn for integral causality',
      };
    }

    // Check junction rules
    if (fromElement?.type === 'Junction0' || toElement?.type === 'Junction0') {
      // 0-junction can only have one EffortOut
      const junctionId = fromElement?.type === 'Junction0' ? bond.from : bond.to;
      const connectedBonds = this.bonds.filter(
        (b) => b.from === junctionId || b.to === junctionId
      );
      const existingEffortOuts = connectedBonds.filter(
        (b) => b.id !== bondId && this.state.bondCausalities.get(b.id) === 'EffortOut'
      );

      if (causality === 'EffortOut' && existingEffortOuts.length > 0) {
        return {
          valid: false,
          reason: '0-junction can only have one EffortOut',
          severity: 'error',
          suggestion: 'Change another bond on this junction to FlowOut',
        };
      }
    }

    if (fromElement?.type === 'Junction1' || toElement?.type === 'Junction1') {
      // 1-junction can only have one FlowOut
      const junctionId = fromElement?.type === 'Junction1' ? bond.from : bond.to;
      const connectedBonds = this.bonds.filter(
        (b) => b.from === junctionId || b.to === junctionId
      );
      const existingFlowOuts = connectedBonds.filter(
        (b) => b.id !== bondId && this.state.bondCausalities.get(b.id) === 'FlowOut'
      );

      if (causality === 'FlowOut' && existingFlowOuts.length > 0) {
        return {
          valid: false,
          reason: '1-junction can only have one FlowOut',
          severity: 'error',
          suggestion: 'Change another bond on this junction to EffortOut',
        };
      }
    }

    return { valid: true, reason: '', severity: 'warning', suggestion: '' };
  }

  /**
   * Get suggested fix for a conflict
   */
  public getSuggestedFix(bondId: string): { bondId: string; causality: CausalityStatus; reason: string } | null {
    const bond = this.bonds.find((b) => b.id === bondId);
    if (!bond) return null;

    const toElement = this.elements.find((e) => e.id === bond.to);

    // Storage elements have clear preferences
    if (toElement?.type === 'C') {
      return { bondId, causality: 'EffortIn', reason: 'Capacitor integral causality' };
    }
    if (toElement?.type === 'I') {
      return { bondId, causality: 'FlowIn', reason: 'Inductor integral causality' };
    }

    // For junctions, suggest the opposite of existing causalities
    if (toElement?.type === 'Junction0') {
      const junctionBonds = this.bonds.filter((b) => b.to === toElement.id || b.from === toElement.id);
      const effortOuts = junctionBonds.filter(
        (b) => this.state.bondCausalities.get(b.id) === 'EffortOut'
      );
      if (effortOuts.length === 0) {
        return { bondId, causality: 'EffortOut', reason: 'First bond on 0-junction drives effort' };
      } else {
        return { bondId, causality: 'FlowOut', reason: 'Other bonds on 0-junction output flow' };
      }
    }

    return null;
  }

  /**
   * Undo last action
   */
  public undo(): boolean {
    if (this.state.historyIndex <= 0) return false;

    this.state.historyIndex--;
    const entry = this.state.history[this.state.historyIndex];

    // Revert to previous state
    this.state.bondCausalities.clear();
    this.state.bondReasons.clear();

    for (let i = 0; i <= this.state.historyIndex; i++) {
      const prevEntry = this.state.history[i];
      for (const [bondId, causality] of prevEntry.causalities) {
        this.state.bondCausalities.set(bondId, causality);
      }
    }

    return true;
  }

  /**
   * Redo last undone action
   */
  public redo(): boolean {
    if (this.state.historyIndex >= this.state.history.length - 1) return false;

    this.state.historyIndex++;
    const entry = this.state.history[this.state.historyIndex];

    this.state.bondCausalities.clear();
    for (const [bondId, causality] of entry.causalities) {
      this.state.bondCausalities.set(bondId, causality);
    }

    return true;
  }

  /**
   * Record action in history
   */
  private recordHistory(action: HistoryEntry['action'], affectedBonds: string[], description: string): void {
    // Remove any redo history
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);

    const entry: HistoryEntry = {
      timestamp: Date.now(),
      action,
      affectedBonds,
      causalities: new Map(this.state.bondCausalities),
      description,
    };

    this.state.history.push(entry);
    this.state.historyIndex++;
  }

  /**
   * Reset to initial state
   */
  public reset(): void {
    this.state.bondCausalities.clear();
    this.state.bondReasons.clear();
    this.state.manualOverrides.clear();
    this.state.conflicts = [];
    this.state.unassignedBonds = new Set(this.bonds.map((b) => b.id));
    this.state.currentStepIndex = 0;
    this.state.state = 'idle';
    this.recordHistory('reset', [], 'Reset to initial state');
  }

  /**
   * Get current state
   */
  public getState(): CausalityDebuggerState {
    return { ...this.state };
  }

  /**
   * Get current step
   */
  public getCurrentStep(): DebuggerStep | null {
    if (this.state.currentStepIndex >= this.steps.length) return null;
    return this.steps[this.state.currentStepIndex];
  }

  /**
   * Get all steps
   */
  public getAllSteps(): DebuggerStep[] {
    return [...this.steps];
  }

  /**
   * Get causality for a bond
   */
  public getCausality(bondId: string): CausalityStatus | null {
    return this.state.bondCausalities.get(bondId) || null;
  }

  /**
   * Get reason for causality assignment
   */
  public getReason(bondId: string): string | null {
    return this.state.bondReasons.get(bondId) || null;
  }

  /**
   * Get all assigned causalities
   */
  public getAllCausalities(): Map<string, CausalityStatus> {
    return new Map(this.state.bondCausalities);
  }

  /**
   * Can undo
   */
  public canUndo(): boolean {
    return this.state.historyIndex > 0;
  }

  /**
   * Can redo
   */
  public canRedo(): boolean {
    return this.state.historyIndex < this.state.history.length - 1;
  }
}
