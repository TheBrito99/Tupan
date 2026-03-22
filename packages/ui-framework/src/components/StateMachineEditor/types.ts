/**
 * State Machine Editor Types
 *
 * Type definitions for the visual state machine editor
 */

export interface StateNodeData {
  id: string;
  name: string;
  x: number;
  y: number;
  isInitial: boolean;
  isFinal: boolean;
  entryAction?: string;
  exitAction?: string;
  width: number;
  height: number;
}

export interface TransitionData {
  id: string;
  from: string;  // state id
  to: string;    // state id
  event: string;
  guard?: string;
  action?: string;
  controlPoint?: { x: number; y: number };  // for curved transitions
}

export interface StateMachineEditorData {
  name: string;
  states: StateNodeData[];
  transitions: TransitionData[];
  initialStateId?: string;
}

export interface EditorState {
  selectedStateId?: string;
  selectedTransitionId?: string;
  isDraggingState?: string;
  isDrawingTransition?: {
    fromStateId: string;
    currentX: number;
    currentY: number;
  };
  zoom: number;
  panX: number;
  panY: number;
  showPropertyPanel: boolean;
  editingTransitionId?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface StateNodeUIState {
  isHovered: boolean;
  isSelected: boolean;
  isDragging: boolean;
}
