/**
 * Drawing Tools Type Definitions
 *
 * Base types and interfaces for all drawing tools used in 2D CAD
 */

import type { GeometricEntity, Point } from '@tupan/core-ts/cad/geometry';

/**
 * Drawing tool state during creation
 */
export interface DrawingToolState {
  isActive: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
  points: Point[];
  preview: GeometricEntity | null;
}

/**
 * Drawing tool interface (abstract)
 */
export interface IDrawingTool {
  name: string;
  icon: string;
  cursor: string;

  // Called when tool activated
  activate(): void;

  // Called when tool deactivated
  deactivate(): void;

  // Mouse down at point
  onMouseDown(point: Point): void;

  // Mouse move while dragging
  onMouseMove(point: Point): void;

  // Mouse up - finalize entity
  onMouseUp(point: Point): void;

  // Get preview entity (shown while drawing)
  getPreview(): GeometricEntity | null;

  // Get completed entity (if any)
  getEntity(): GeometricEntity | null;

  // Reset tool state
  reset(): void;
}

/**
 * Drawing tool creation callback
 */
export type OnEntityCreated = (entity: GeometricEntity) => void;

/**
 * Symbol definition - a named collection of geometries
 */
export interface Symbol {
  id: string;
  name: string;
  category: SymbolCategory;
  description: string;
  entities: GeometricEntity[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  properties?: {
    [key: string]: string | number | boolean;
  };
}

/**
 * Symbol categories for organization
 */
export enum SymbolCategory {
  // Passive components
  Resistor = 'resistor',
  Capacitor = 'capacitor',
  Inductor = 'inductor',
  Diode = 'diode',
  Led = 'led',
  Fuse = 'fuse',

  // Active components
  Transistor = 'transistor',
  OpAmp = 'opamp',
  Ic = 'ic',

  // Sources
  VoltageSource = 'voltage_source',
  CurrentSource = 'current_source',
  Battery = 'battery',

  // Connectors & Junctions
  Wire = 'wire',
  Junction = 'junction',
  Connector = 'connector',
  Header = 'header',

  // Switches & Controls
  Switch = 'switch',
  Button = 'button',
  Relay = 'relay',

  // Other
  Ground = 'ground',
  Signal = 'signal',
  Test = 'test',
}

/**
 * Symbol library
 */
export interface SymbolLibrary {
  symbols: Symbol[];
  categories: SymbolCategory[];
}

/**
 * Drawing tool manager state
 */
export interface DrawingToolManagerState {
  activeTool: string | null;
  tools: Map<string, IDrawingTool>;
  entities: Array<[string, GeometricEntity]>;
  selectedLayer: string;
}
