/**
 * Circuit Editor - Electrical Circuit Schematic Editor
 *
 * Barrel export for all CircuitEditor components and types
 */

// Main component
export { CircuitEditor as CircuitEditorComponent } from './CircuitEditor';
export type { CircuitEditorProps } from './CircuitEditor';

// Sub-components (exported with both base and prefixed names)
export { Canvas, Canvas as CircuitEditorCanvas } from './Canvas';
export { ComponentPalette, ComponentPalette as CircuitEditorComponentPalette } from './ComponentPalette';
export { PropertyPanel, PropertyPanel as CircuitEditorPropertyPanel } from './PropertyPanel';
export { AnalysisPanel, AnalysisPanel as CircuitEditorAnalysisPanel } from './AnalysisPanel';

// Types and utilities
export {
  CircuitComponent,
  CircuitConnection,
  CircuitComponentType,
  COMPONENT_PROPERTIES,
  DEFAULT_PARAMETERS,
  EditorState,
  ValidationResult,
  AnalysisData,
  SimulationResult,
  Port,
  Parameters,
} from './types';

export { validateCircuit, computeDCOperatingPoint, simulateCircuit, analyzeCircuit } from './circuitInteractions';

// Default exports for convenience
export { default as CircuitEditor } from './CircuitEditor';
