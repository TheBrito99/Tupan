/**
 * Petri Net Editor Types
 *
 * Type definitions for the visual Petri net editor
 * Places, transitions, arcs, and token definitions
 */

export interface PlaceNodeData {
  id: string;
  name: string;
  x: number;
  y: number;
  tokens: number;
  capacity?: number;  // Max tokens (infinite if undefined)
  width: number;
  height: number;
}

export interface TransitionNodeData {
  id: string;
  name: string;
  x: number;
  y: number;
  isEnabled: boolean;
  width: number;
  height: number;
}

export interface ArcData {
  id: string;
  from: string;      // place or transition id
  to: string;        // transition or place id
  weight: number;    // tokens consumed/produced
  type: 'normal' | 'inhibitor';  // inhibitor arcs block firing
  controlPoint?: { x: number; y: number };
}

export interface PetriNetEditorData {
  name: string;
  places: PlaceNodeData[];
  transitions: TransitionNodeData[];
  arcs: ArcData[];
  currentMarking?: Record<string, number>;  // place_id -> token_count
}

export interface EditorState {
  selectedPlaceId?: string;
  selectedTransitionId?: string;
  selectedArcId?: string;
  isDraggingPlace?: string;
  isDraggingTransition?: string;
  isDrawingArc?: {
    fromId: string;
    fromType: 'place' | 'transition';
    currentX: number;
    currentY: number;
  };
  zoom: number;
  panX: number;
  panY: number;
  showPropertyPanel: boolean;
  showAnalysisPanel: boolean;
  simulationMode: boolean;
  firingAnimation?: {
    transitionId: string;
    progress: number;  // 0 to 1
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface SimulationState {
  time: number;
  marking: Record<string, number>;
  enabledTransitions: string[];
  firedTransitions: Array<{ id: string; time: number }>;
  isDeadlock: boolean;
}

export interface AnalysisResult {
  boundedness: 'bounded' | 'unbounded';
  safeness: boolean;
  livenessLevel: 'dead' | 'deadlock-free' | 'live';
  conservativeness: boolean;
  reachabilityGraph?: {
    states: string[];
    edges: Array<{ from: string; to: string; transition: string }>;
  };
}
