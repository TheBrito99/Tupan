/**
 * Thermal Circuit Editor
 *
 * Provides a complete thermal network analysis and simulation tool.
 * Supports:
 * - Heat sources and temperature sources
 * - Thermal resistances (conduction, convection, radiation)
 * - Thermal capacitances (energy storage)
 * - Steady-state and transient analysis
 * - Network validation and error detection
 */

export { ThermalEditor } from './ThermalEditor';
export { Canvas } from './Canvas';
export { ComponentPalette } from './ComponentPalette';
export { PropertyPanel } from './PropertyPanel';
export { AnalysisPanel } from './AnalysisPanel';

export type {
  ThermalComponentType,
  ThermalComponent,
  ThermalConnection,
  EditorState,
  SimulationState,
  AnalysisData,
  Position,
  Bounds,
  CausalityType,
} from './types';

export type { ValidationResult } from './thermalInteractions';

export {
  COMPONENT_PROPERTIES,
  DEFAULT_PARAMETERS,
  getComponentBounds,
  pointInBounds,
  distance,
} from './types';
