/**
 * Block Diagram Editor - Barrel Export
 *
 * Simulink-style block diagram editor with transfer functions, control blocks,
 * and signal processing components. Supports simulation and frequency domain analysis.
 */

export { BlockDiagramEditor } from './BlockDiagramEditor';
export { Canvas, Canvas as BlockDiagramCanvas } from './Canvas';
export { ComponentPalette, ComponentPalette as BlockDiagramComponentPalette } from './ComponentPalette';
export { PropertyPanel, PropertyPanel as BlockDiagramPropertyPanel } from './PropertyPanel';
export { AnalysisPanel, AnalysisPanel as BlockDiagramAnalysisPanel } from './AnalysisPanel';

export type {
  BlockDiagramComponent,
  BlockDiagramConnection,
  BlockDiagramComponentType,
  SimulationResult,
  EditorState,
  Port,
  Parameters,
} from './types';

export {
  COMPONENT_PROPERTIES,
  DEFAULT_PARAMETERS,
} from './types';

export {
  analyzeBlockDiagram,
  createBlockState,
  evaluateBlock,
  validateBlockDiagram,
  detectAlgebraicLoops,
  topologicalSort,
} from './blockDiagramInteractions';

export type {
  ValidationResult,
  AlgebraicLoopInfo,
  BlockState,
} from './blockDiagramInteractions';
