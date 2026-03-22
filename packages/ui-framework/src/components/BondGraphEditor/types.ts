/**
 * Type definitions for Bond Graph Editor
 */

import type { BondGraphElement, BondGraphBond, BondGraphElementType } from '@tupan/core-ts/wasm-bridge';

/**
 * Internal representation of a bond graph element with position
 */
export interface EditorElement extends BondGraphElement {
  x: number;
  y: number;
  width?: number;
  height?: number;
  selected?: boolean;
}

/**
 * Internal representation of a bond with visual properties
 */
export interface EditorBond extends BondGraphBond {
  points?: Array<{ x: number; y: number }>;
  selected?: boolean;
}

/**
 * Editor state for managing canvas state
 */
export interface EditorState {
  selectedElement: string | null;
  selectedBond: string | null;
  draggingElement: string | null;
  drawingBond: {
    fromId: string | null;
    toId: string | null;
  } | null;
  panX: number;
  panY: number;
  zoom: number;
  mode: 'select' | 'draw' | 'pan';
}

/**
 * Property panel state
 */
export interface PropertyPanelState {
  selectedElement: EditorElement | null;
  parameters: Record<string, number | string>;
}

/**
 * Simulation state
 */
export interface SimulationState {
  running: boolean;
  duration: number;
  timeStep: number;
  currentTime: number;
  stateHistory: number[][];
  powerConservation: number;
}

/**
 * Analysis results
 */
export interface AnalysisData {
  type: 'transient' | 'steadystate' | 'causality';
  success: boolean;
  message: string;
  data?: any;
  timestamp: number;
}

/**
 * Element palette item
 */
export interface PaletteItem {
  type: BondGraphElementType;
  label: string;
  icon: string;
  description: string;
  color: string;
}

/**
 * Canvas position
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Bounds for collision detection
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if point is inside bounds
 */
export function pointInBounds(point: Position, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Get element bounds
 */
export function getElementBounds(element: EditorElement): Bounds {
  const width = element.width ?? 60;
  const height = element.height ?? 60;
  return {
    x: element.x - width / 2,
    y: element.y - width / 2,
    width,
    height,
  };
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Position, p2: Position): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}
