/**
 * PCB Design Types
 *
 * Core data structures for PCB layout, routing, and manufacturing
 */

import { Point } from '../../types/geometry';

/**
 * PCB Layer definition
 */
export enum PCBLayer {
  SIGNAL_TOP = 'signal_top',
  SIGNAL_INNER1 = 'signal_inner1',
  SIGNAL_INNER2 = 'signal_inner2',
  SIGNAL_BOTTOM = 'signal_bottom',
  GROUND = 'ground',
  POWER = 'power',
  SILK_TOP = 'silk_top',
  SILK_BOTTOM = 'silk_bottom',
  MASK_TOP = 'mask_top',
  MASK_BOTTOM = 'mask_bottom',
  PASTE_TOP = 'paste_top',
  PASTE_BOTTOM = 'paste_bottom',
}

/**
 * Pad shape
 */
export enum PadShape {
  CIRCLE = 'circle',
  SQUARE = 'square',
  RECTANGLE = 'rectangle',
  OVAL = 'oval',
  POLYGON = 'polygon',
}

/**
 * Pad connection type
 */
export enum PadConnectionType {
  THROUGH_HOLE = 'through_hole',
  SMD = 'smd',
  CASTELLATED = 'castellated',
  VIA = 'via',
}

/**
 * Trace connection style
 */
export enum TraceStyle {
  STRAIGHT = 'straight',
  MANHATTAN = 'manhattan',
  DIAGONAL = 'diagonal',
}

/**
 * Pad definition in footprint
 */
export interface Pad {
  id: string;
  number: string;              // Pin number (1, 2, A, B, etc.)
  name: string;                // Pin name (VCC, GND, SDA, etc.)
  shape: PadShape;
  position: Point;             // Position relative to footprint origin
  width: number;               // Width in mm
  height: number;              // Height in mm
  rotation: number;            // Rotation in degrees
  drill?: number;              // Drill size for through-hole
  layers: PCBLayer[];          // Which layers this pad appears on
  connectionType: PadConnectionType;
  thermalRelief?: boolean;     // Add thermal relief pattern
}

/**
 * Footprint definition
 */
export interface Footprint {
  id: string;
  name: string;                // Footprint name (e.g., "SOIC-8", "0603")
  description: string;
  package: string;             // Package type
  pads: Pad[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  silkscreen?: string[];       // Silkscreen line definitions
  courtyard?: string[];        // Courtyard boundaries
  models3d?: {
    format: string;            // STEP, IGES, etc.
    url: string;
  }[];
}

/**
 * Placed component on board (footprint instance)
 */
export interface PlacedComponent {
  id: string;
  refdes: string;              // Reference designator (R1, C2, U1, etc.)
  footprintId: string;
  footprint: Footprint;
  position: Point;             // Position on board (mm)
  rotation: number;            // Rotation in degrees
  side: 'top' | 'bottom';
  locked: boolean;
  visible: boolean;
  attributes: Record<string, string>;
}

/**
 * PCB trace (track)
 */
export interface Trace {
  id: string;
  netName: string;             // Connected net name
  startPad: { componentId: string; padId: string };
  endPad: { componentId: string; padId: string };
  width: number;               // Trace width in mm
  layer: PCBLayer;
  segments: TraceSegment[];    // Path segments
  style: TraceStyle;
  locked: boolean;
  selected: boolean;
}

/**
 * Single segment of a trace
 */
export interface TraceSegment {
  start: Point;
  end: Point;
  width: number;
  via?: Via;                   // Via at end point if layer changes
}

/**
 * Via (electrical connection between layers)
 */
export interface Via {
  id: string;
  position: Point;
  diameterOuter: number;       // Outer diameter in mm
  diameterInner: number;       // Drill diameter in mm
  fromLayer: PCBLayer;
  toLayer: PCBLayer;
  netName: string;
}

/**
 * Copper zone (pour area)
 */
export interface Zone {
  id: string;
  name: string;
  netName: string;
  layer: PCBLayer;
  outline: Point[];            // Polygon boundary
  minWidth: number;            // Minimum copper width
  thermalGap?: number;         // Gap from other nets
  minIsland?: number;          // Minimum island size
  fillType: 'solid' | 'hatched';
}

/**
 * Board outline/edge cuts
 */
export interface BoardOutline {
  segments: BoardSegment[];
  holes?: Point[][];           // Cutouts
}

/**
 * Single board edge segment
 */
export interface BoardSegment {
  start: Point;
  end: Point;
  width?: number;              // Edge width/chamfer
}

/**
 * Design Rule (constraint)
 */
export interface DesignRule {
  id: string;
  type: 'trace_width' | 'clearance' | 'via_size' | 'pad_size' | 'annulus';
  value: number;
  unit: 'mm' | 'mil';
  description: string;
  applies?: {
    nets?: string[];
    layers?: PCBLayer[];
    components?: string[];
  };
}

/**
 * DRC violation
 */
export interface DRCViolation {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  location?: Point;
  items?: string[];           // IDs of affected items (traces, pads, etc.)
}

/**
 * PCB Board definition
 */
export interface PCBBoard {
  id: string;
  name: string;
  description: string;

  // Dimensions
  width: number;              // mm
  height: number;             // mm
  thickness: number;          // mm
  layers: PCBLayer[];

  // Components and routing
  components: PlacedComponent[];
  traces: Trace[];
  vias: Via[];
  zones: Zone[];

  // Board geometry
  outline: BoardOutline;

  // Design rules
  designRules: DesignRule[];

  // Metadata
  manufacturer?: string;
  timestamp: number;
  version: string;
}

/**
 * Trace routing configuration
 */
export interface RoutingConfig {
  style: TraceStyle;
  width: number;               // Default trace width (mm)
  minWidth: number;            // Minimum allowed
  maxWidth: number;            // Maximum allowed
  autoRoute: boolean;
  optimizePath: boolean;
  avoidOtherTraces: boolean;
}

/**
 * Board material properties
 */
export interface BoardMaterial {
  name: string;
  type: string;                // FR4, CEM-1, etc.
  thickness: number;
  dielectric: number;          // Relative permittivity
  loss: number;                // Loss tangent
  copper: number;              // Copper weight (oz/ft²)
}

/**
 * Manufacturing output
 */
export interface GerberFile {
  layer: PCBLayer;
  filename: string;
  content: string;            // Gerber RS-274X format
}

/**
 * Bill of Materials for PCB
 */
export interface PCBBOM {
  refdes: string;
  value: string;
  footprint: string;
  package: string;
  quantity: number;
  supplier?: string;
  partNumber?: string;
  cost?: number;
}

/**
 * Assembly instruction
 */
export interface AssemblyInstruction {
  refdes: string;
  step: number;
  location: Point;
  rotation: number;
  side: 'top' | 'bottom';
  component: PlacedComponent;
}

/**
 * PCB design state
 */
export interface PCBDesignState {
  board: PCBBoard;
  selectedComponent?: string;
  selectedTrace?: string;
  selectedVia?: string;
  selectedZone?: string;

  // Editing mode
  editMode: 'select' | 'route' | 'zone' | 'measure' | 'annotate';
  routingConfig?: RoutingConfig;

  // Visibility
  visibleLayers: Set<PCBLayer>;
  showRatsnest: boolean;       // Show unrouted connections
  show3D: boolean;

  // History
  history: PCBBoard[];
  historyIndex: number;
}

/**
 * Connection to unroute (rat's nest)
 */
export interface UnroutedConnection {
  from: { componentId: string; padId: string };
  to: { componentId: string; padId: string };
  netName: string;
  routed: boolean;
}

/**
 * Manufacturing checkpoints
 */
export interface ManufacturingCheck {
  name: string;
  passed: boolean;
  violations: DRCViolation[];
  message: string;
}
