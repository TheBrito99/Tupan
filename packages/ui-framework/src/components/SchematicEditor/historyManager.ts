/**
 * History Manager - Undo/Redo System
 *
 * Features:
 * - Unlimited undo/redo stack
 * - Action batching (combine multiple changes)
 * - History clearing and limits
 * - State snapshots
 */

import { SchematicEditorState, PlacedSymbol, Wire } from './types';

/**
 * Action in history
 */
export interface HistoryAction {
  id: string;
  timestamp: number;
  description: string;
  before: SchematicEditorState;
  after: SchematicEditorState;
  merged?: boolean;  // Can be merged with next action
}

/**
 * History manager for undo/redo
 */
export class HistoryManager {
  private stack: HistoryAction[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 100;
  private lastActionTime: number = 0;
  private batchMode: boolean = false;
  private batchBuffer: HistoryAction[] = [];

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Push action to history
   */
  push(
    description: string,
    before: SchematicEditorState,
    after: SchematicEditorState,
    mergeable: boolean = false
  ): void {
    // If batching, buffer the action
    if (this.batchMode) {
      this.batchBuffer.push({
        id: this.generateId(),
        timestamp: Date.now(),
        description,
        before,
        after,
        merged: mergeable,
      });
      return;
    }

    // Trim redo stack
    this.stack = this.stack.slice(0, this.currentIndex + 1);

    // Try to merge with previous action if mergeable
    const now = Date.now();
    const shouldMerge =
      mergeable &&
      this.currentIndex >= 0 &&
      this.stack[this.currentIndex].merged &&
      now - this.lastActionTime < 500; // 500ms merge window

    if (shouldMerge) {
      // Merge with previous action
      const previousAction = this.stack[this.currentIndex];
      previousAction.after = after;
      previousAction.description = description;
    } else {
      // New action
      const action: HistoryAction = {
        id: this.generateId(),
        timestamp: now,
        description,
        before,
        after,
        merged: mergeable,
      };

      this.stack.push(action);
      this.currentIndex++;
    }

    // Enforce size limit
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
      this.currentIndex--;
    }

    this.lastActionTime = now;
  }

  /**
   * Start batch mode (combine multiple actions into one)
   */
  startBatch(): void {
    this.batchMode = true;
    this.batchBuffer = [];
  }

  /**
   * End batch mode and commit all buffered actions as one
   */
  endBatch(description: string, before: SchematicEditorState, after: SchematicEditorState): void {
    if (!this.batchMode) return;

    this.batchMode = false;

    if (this.batchBuffer.length === 0) {
      this.batchBuffer = [];
      return;
    }

    // Create single action from all buffered changes
    const action: HistoryAction = {
      id: this.generateId(),
      timestamp: Date.now(),
      description,
      before,
      after,
      merged: false,
    };

    // Trim redo stack
    this.stack = this.stack.slice(0, this.currentIndex + 1);
    this.stack.push(action);
    this.currentIndex++;

    // Enforce size limit
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
      this.currentIndex--;
    }

    this.batchBuffer = [];
    this.lastActionTime = Date.now();
  }

  /**
   * Cancel batch mode without committing
   */
  cancelBatch(): void {
    this.batchMode = false;
    this.batchBuffer = [];
  }

  /**
   * Undo last action
   */
  undo(): SchematicEditorState | null {
    if (!this.canUndo()) return null;

    const action = this.stack[this.currentIndex];
    this.currentIndex--;
    return action.before;
  }

  /**
   * Redo last undone action
   */
  redo(): SchematicEditorState | null {
    if (!this.canRedo()) return null;

    this.currentIndex++;
    const action = this.stack[this.currentIndex];
    return action.after;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0 && !this.batchMode;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.stack.length - 1 && !this.batchMode;
  }

  /**
   * Get current action description
   */
  getCurrentAction(): string {
    if (this.currentIndex < 0 || this.currentIndex >= this.stack.length) {
      return 'Initial state';
    }
    return this.stack[this.currentIndex].description;
  }

  /**
   * Get next action description (for redo)
   */
  getNextAction(): string {
    const nextIndex = this.currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= this.stack.length) {
      return '';
    }
    return this.stack[nextIndex].description;
  }

  /**
   * Get history as string (for debugging)
   */
  getHistory(): string[] {
    return this.stack
      .slice(0, this.currentIndex + 1)
      .map((action, index) => `${index + 1}. ${action.description}`);
  }

  /**
   * Get full history including undone actions
   */
  getFullHistory(): string[] {
    return this.stack.map((action, index) => {
      const isCurrent = index === this.currentIndex;
      const prefix = isCurrent ? '→ ' : '  ';
      return `${prefix}${index + 1}. ${action.description}`;
    });
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.stack = [];
    this.currentIndex = -1;
    this.batchBuffer = [];
    this.batchMode = false;
  }

  /**
   * Get history stack size
   */
  getSize(): number {
    return this.stack.length;
  }

  /**
   * Get current position in stack
   */
  getPosition(): number {
    return this.currentIndex;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Helper function to create state snapshots efficiently
 */
export function createStateSnapshot(state: SchematicEditorState): SchematicEditorState {
  return {
    placedSymbols: state.placedSymbols.map(s => ({ ...s, pins: [...s.pins] })),
    wires: state.wires.map(w => ({
      ...w,
      segments: [...w.segments],
      properties: { ...w.properties },
    })),
    selectedSymbol: state.selectedSymbol,
    selectedWire: state.selectedWire,
    dragState: { ...state.dragState },
    isDrawingWire: state.isDrawingWire,
    wireStart: state.wireStart ? { ...state.wireStart } : undefined,
    wirePath: [...state.wirePath],
    clipboard: state.clipboard?.map(s => ({ ...s, pins: [...s.pins] })),
    history: [],  // Don't copy history
    historyIndex: state.historyIndex,
  };
}

/**
 * Detect what changed between two states
 */
export function detectChanges(
  before: SchematicEditorState,
  after: SchematicEditorState
): string {
  if (before.placedSymbols.length !== after.placedSymbols.length) {
    return before.placedSymbols.length < after.placedSymbols.length
      ? 'Add symbol'
      : 'Delete symbol';
  }

  if (before.wires.length !== after.wires.length) {
    return before.wires.length < after.wires.length ? 'Add wire' : 'Delete wire';
  }

  if (before.selectedSymbol !== after.selectedSymbol) {
    return 'Select symbol';
  }

  if (before.selectedWire !== after.selectedWire) {
    return 'Select wire';
  }

  // Check for position/rotation/scale changes
  for (let i = 0; i < before.placedSymbols.length; i++) {
    const bs = before.placedSymbols[i];
    const as = after.placedSymbols[i];

    if (bs.position.x !== as.position.x || bs.position.y !== as.position.y) {
      return 'Move symbol';
    }
    if (bs.rotation !== as.rotation) {
      return 'Rotate symbol';
    }
    if (bs.scale !== as.scale) {
      return 'Scale symbol';
    }
    if (bs.parameters.value !== as.parameters.value) {
      return 'Edit component value';
    }
  }

  return 'Modify';
}
