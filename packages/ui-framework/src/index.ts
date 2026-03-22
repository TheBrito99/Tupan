/**
 * Tupan UI Framework
 *
 * Shared React components for all Tupan simulators.
 * Provides reusable UI building blocks following Material Design principles.
 */

export { NodeEditor } from './components/NodeEditor/NodeEditor';
export type { NodeEditorProps, NodeTypeDefinition, NodeEditorState } from './components/NodeEditor/NodeEditor';

export { StateMachineEditor } from './components/StateMachineEditor';
export type {
  StateMachineEditorProps,
  StateNodeData,
  TransitionData,
  StateMachineEditorData,
} from './components/StateMachineEditor';

export { PetriNetEditor } from './components/PetriNetEditor';
export type {
  PetriNetEditorProps,
  PlaceNodeData,
  TransitionNodeData,
  ArcData,
  PetriNetEditorData,
} from './components/PetriNetEditor';

export { LatexEditor } from './components/LatexEditor';
export type {
  LatexEditorProps,
  LatexCompileResult,
  LatexDiagnostic,
  LatexFile,
  LatexProject,
  LatexPdfCompileArtifact,
  LatexPdfCompiler,
  LatexPdfCompilerOptions,
  LatexPdfEngine,
} from './components/LatexEditor';

export { ThermalEditor, Canvas, ComponentPalette, PropertyPanel, AnalysisPanel } from './components/ThermalEditor';
export type {
  ThermalComponentType,
  ThermalComponent,
  ThermalConnection,
  EditorState as ThermalEditorState,
  SimulationState as ThermalSimulationState,
  AnalysisData as ThermalAnalysisData,
  Position as ThermalPosition,
  Bounds as ThermalBounds,
  CausalityType as ThermalCausalityType,
  ValidationResult as ThermalValidationResult,
} from './components/ThermalEditor';

export { MechanicalEditor, Canvas as MechanicalCanvas, ComponentPalette as MechanicalComponentPalette, PropertyPanel as MechanicalPropertyPanel, AnalysisPanel as MechanicalAnalysisPanel } from './components/MechanicalEditor';
export type {
  MechanicalComponentType,
  MechanicalComponent,
  MechanicalConnection,
} from './components/MechanicalEditor';

export { HydraulicEditor, Canvas as HydraulicCanvas, ComponentPalette as HydraulicComponentPalette, PropertyPanel as HydraulicPropertyPanel, AnalysisPanel as HydraulicAnalysisPanel } from './components/HydraulicEditor';
export type {
  HydraulicComponentType,
  HydraulicComponent,
  HydraulicConnection,
  AnalysisData as HydraulicAnalysisData,
  SteadyState as HydraulicSteadyState,
  EnergyAnalysis as HydraulicEnergyAnalysis,
} from './components/HydraulicEditor';

export { PneumaticEditor, Canvas as PneumaticCanvas, ComponentPalette as PneumaticComponentPalette, PropertyPanel as PneumaticPropertyPanel, AnalysisPanel as PneumaticAnalysisPanel } from './components/PneumaticEditor';
export type {
  PneumaticComponentType,
  PneumaticComponent,
  PneumaticConnection,
  AnalysisData as PneumaticAnalysisData,
  SteadyState as PneumaticSteadyState,
  Transient as PneumaticTransient,
  EnergyAnalysis as PneumaticEnergyAnalysis,
} from './components/PneumaticEditor';

export { BlockDiagramEditor, Canvas as BlockDiagramCanvas, ComponentPalette as BlockDiagramComponentPalette, PropertyPanel as BlockDiagramPropertyPanel, AnalysisPanel as BlockDiagramAnalysisPanel } from './components/BlockDiagramEditor';
export type {
  BlockDiagramComponentType,
  BlockDiagramComponent,
  BlockDiagramConnection,
  SimulationResult,
  EditorState as BlockDiagramEditorState,
} from './components/BlockDiagramEditor';

export { CircuitEditor, Canvas as CircuitEditorCanvas, ComponentPalette as CircuitEditorComponentPalette, PropertyPanel as CircuitEditorPropertyPanel, AnalysisPanel as CircuitEditorAnalysisPanel } from './components/CircuitEditor';
export type {
  CircuitComponentType,
  CircuitComponent,
  CircuitConnection,
  AnalysisData as CircuitAnalysisData,
  ValidationResult as CircuitValidationResult,
  SimulationResult as CircuitSimulationResult,
} from './components/CircuitEditor';

export const VERSION = '0.1.0';
