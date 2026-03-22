/**
 * Mechanical System Editor - Barrel Export
 *
 * Exports all components and types needed for mechanical system simulation
 */

export { MechanicalEditor } from './MechanicalEditor';
export { Canvas } from './Canvas';
export { ComponentPalette } from './ComponentPalette';
export { PropertyPanel } from './PropertyPanel';
export { AnalysisPanel } from './AnalysisPanel';

export type {
  MechanicalComponentType,
  MechanicalComponent,
  MechanicalConnection,
  EditorState,
  SimulationState,
  AnalysisData,
  Position,
  Parameters,
  ValidationResult,
  ComponentProperties,
} from './types';

export {
  COMPONENT_PROPERTIES,
  DEFAULT_PARAMETERS,
} from './types';

export {
  validateMechanicalNetwork,
  analyzeNetwork,
  exportMechanicalNetwork,
  importMechanicalNetwork,
} from './mechanicalInteractions';
