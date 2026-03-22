/**
 * Schematic Editor Types
 *
 * Defines data structures for schematic components, wires, and netlists
 */

import { Point, GeometricEntity } from '../../types/geometry';
import { Symbol } from '../DrawingTools/types';

/**
 * Represents a placed symbol instance in the schematic
 */
export interface PlacedSymbol {
  id: string;                    // Unique instance ID (UUID)
  symbolId: string;              // Reference to symbol library entry
  symbol: Symbol;                // Symbol data (contains GeometricEntity[])
  position: Point;               // Position of symbol origin
  rotation: number;              // Rotation in degrees (0-360)
  scale: number;                 // Scale factor (0.5-2.0)
  parameters: SymbolParameters;  // Electrical parameters (resistance, capacitance, etc.)
  pins: PinConnection[];         // Pin definitions for this instance
  locked: boolean;               // Cannot be modified
}

/**
 * Electrical parameters for components
 */
export interface SymbolParameters {
  value?: string;                // Component value (e.g., "1k", "10µF", "2N7000")
  unit?: string;                 // Unit (Ω, F, V, A, etc.)
  tolerance?: string;            // Tolerance (e.g., "±5%")
  package?: string;              // Package size (e.g., "SMD0603", "DIP8")
  footprint?: string;            // PCB footprint reference
  description?: string;          // Component description
  custom?: Record<string, any>;  // Custom parameters
}

/**
 * Pin definition for a symbol
 * Pins are connection points where wires attach
 */
export interface PinConnection {
  id: string;                    // Pin ID (e.g., "1", "2", "A", "B")
  name: string;                  // Pin name (e.g., "Anode", "Cathode", "Gate")
  position: Point;               // Pin position in symbol coordinates
  type: 'input' | 'output' | 'inout'; // Pin type (rarely used for passive)
  connected: boolean;            // Whether pin has a wire connected
  voltage?: number;              // Current voltage at pin (from simulation)
  current?: number;              // Current flowing through pin (from simulation)
}

/**
 * Represents a wire connecting two pins
 */
export interface Wire {
  id: string;                    // Unique wire ID (UUID)
  segments: LineSegment[];       // Path segments (connected waypoints)
  fromSymbol: string;            // Source symbol instance ID
  fromPin: string;               // Source pin ID
  toSymbol: string;              // Target symbol instance ID
  toPin: string;                 // Target pin ID
  properties: WireProperties;    // Electrical properties
}

/**
 * Individual line segment of a wire
 */
export interface LineSegment {
  start: Point;
  end: Point;
  routed: boolean;               // True if explicitly routed, false if calculated
}

/**
 * Wire electrical properties
 */
export interface WireProperties {
  name?: string;                 // Net name (e.g., "VCC", "GND")
  width?: number;                // Trace width (for PCB)
  color?: string;                // Display color
  highCurrent?: boolean;         // Flag for thick trace
}

/**
 * Netlist entry connecting components
 */
export interface NetlistEntry {
  netName: string;               // Net name (e.g., "VCC", "GND", "net_5")
  connections: NetConnection[];  // All connections on this net
}

/**
 * Single connection in a netlist
 */
export interface NetConnection {
  symbolId: string;              // Symbol instance ID
  symbolName: string;            // Component name (e.g., "R1", "C2")
  symbolValue: string;           // Component value (e.g., "1k", "10µF")
  pinId: string;                 // Pin ID on component
  pinName: string;               // Pin name (e.g., "1", "2")
}

/**
 * Complete schematic netlist
 * Can be exported to SPICE or used by circuit simulator
 */
export interface Netlist {
  title: string;
  timestamp: string;
  entries: NetlistEntry[];
  components: ComponentEntry[];
}

/**
 * Component entry in netlist
 */
export interface ComponentEntry {
  refdes: string;                // Reference designator (e.g., "R1", "C2", "Q1")
  value: string;                 // Component value
  footprint?: string;            // PCB footprint
  nets: string[];                // Connected net names
}

/**
 * Dragging state during symbol placement
 */
export interface DragState {
  isDragging: boolean;
  draggedSymbolId?: string;
  startPos: Point;
  currentPos: Point;
  offset: Point;                 // Offset from drag start
}

/**
 * Schematic editor state
 */
export interface SchematicEditorState {
  placedSymbols: PlacedSymbol[];
  wires: Wire[];
  selectedSymbol?: string;       // Selected symbol instance ID
  selectedWire?: string;         // Selected wire instance ID
  dragState: DragState;
  isDrawingWire: boolean;
  wireStart?: { symbolId: string; pinId: string };
  wirePath: Point[];             // Current wire path being drawn
  clipboard?: PlacedSymbol[];
  history: SchematicEditorState[];
  historyIndex: number;
}

/**
 * Schematic editor configuration
 */
export interface SchematicEditorConfig {
  gridSize: number;              // Grid spacing in pixels (default: 10)
  snapToGrid: boolean;
  snapToPin: boolean;
  snapDistance: number;          // Snap radius in pixels
  autoLabel: boolean;            // Auto-generate component labels
  showGrid: boolean;
  showPinLabels: boolean;
  readOnly: boolean;
}

/**
 * Circuit simulator integration
 */
export interface CircuitSimulatorLink {
  exportNetlist(): Netlist;
  getNodeVoltages(): Record<string, number>;
  getComponentCurrents(): Record<string, number>;
  setComponentValue(refdes: string, value: string): void;
}

/**
 * Export formats
 */
export enum ExportFormat {
  SPICE = 'spice',              // SPICE netlist
  JSON = 'json',                // JSON schematic
  SVG = 'svg',                  // Scalable vector
  DXF = 'dxf',                  // CAD format
}
