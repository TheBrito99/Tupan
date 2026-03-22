/**
 * Schematic Editor - Complete Exports
 *
 * Includes base editor, advanced features, and utilities
 */

// Main components
export { default as SchematicEditor } from './SchematicEditor';
export type { SchematicEditorProps, SchematicEditorHandle } from './SchematicEditor';

export { default as SchematicEditorAdvanced } from './SchematicEditorAdvanced';
export type { SchematicEditorAdvancedProps, SchematicEditorAdvancedHandle } from './SchematicEditorAdvanced';

// Core types
export type {
  PlacedSymbol,
  SymbolParameters,
  PinConnection,
  Wire,
  LineSegment,
  WireProperties,
  NetlistEntry,
  NetConnection,
  Netlist,
  ComponentEntry,
  DragState,
  SchematicEditorState,
  SchematicEditorConfig,
  CircuitSimulatorLink,
} from './types';
export { ExportFormat } from './types';

// Symbol placement utilities
export {
  placeSymbol,
  moveSymbol,
  rotateSymbol,
  scaleSymbol,
  findPinAtPosition,
  updateSymbolParameters,
  cloneSymbol,
  deleteSymbol,
  getNextRefDes,
  resetRefDesCounters,
  createPinsForSymbol,
} from './symbolPlacer';

// Wire routing utilities
export {
  createWire,
  addWireWaypoint,
  completeWire,
  autoRouteWire,
  doWiresCross,
  getWireSegments,
  findWiresForSymbol,
  findWiresOnNet,
  assignNetName,
  getWireLength,
  isPointOnWire,
  splitWireAtPoint,
  deleteWire,
  getAllNets,
  validateWireConnections,
} from './wireRouter';

// Netlist generation
export {
  generateSpiceNetlist,
  generateNetlist,
  generateBOM,
  exportNetlistJSON,
  validateNetlist,
} from './netlistGenerator';
export type { ValidationError } from './netlistGenerator';

// Advanced features: History management (Undo/Redo)
export {
  HistoryManager,
  createStateSnapshot,
  detectChanges,
} from './historyManager';
export type { HistoryAction } from './historyManager';

// Advanced features: Selection & alignment
export {
  SelectionManager,
  isPointInSymbol,
  isPointInBox,
} from './selectionManager';
export { SelectionMode, AlignmentOption, DistributionOption } from './selectionManager';
export type { SelectionContext } from './selectionManager';

// Advanced features: Clipboard (Copy/Paste)
export {
  ClipboardManager,
} from './clipboardManager';
export type { ClipboardEntry } from './clipboardManager';

// Advanced features: Net management
export {
  NetManager,
} from './netManager';
export type { NetInfo } from './netManager';

// Advanced features: Symbol search & quick-place
export {
  SymbolSearch,
  fuzzyMatch,
} from './symbolSearch';
export type { SearchResult } from './symbolSearch';
