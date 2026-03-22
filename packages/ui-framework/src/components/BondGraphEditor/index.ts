/**
 * Bond Graph Editor - Comprehensive visual editor for bond graphs
 *
 * Exports all components and types needed for bond graph editing and simulation
 */

export { BondGraphEditor } from './BondGraphEditor';
export type { BondGraphEditorProps } from './BondGraphEditor';

export { Canvas } from './Canvas';
export { ElementPalette } from './ElementPalette';
export { PropertyPanel } from './PropertyPanel';
export { AnalysisPanel } from './AnalysisPanel';
export { GyratorInfo } from './GyratorInfo';
export { NonlinearInfo } from './NonlinearInfo';
export { ModulatedTransformerInfo } from './ModulatedTransformerInfo';
export { default as CausalityVisualizationInfo } from './CausalityVisualizationInfo';
export { default as InteractiveCausalityDebugger } from './InteractiveCausalityDebugger';
export { default as SolverRecommendationPanel } from './SolverRecommendationPanel';
export { default as OptimizationPanel } from './OptimizationPanel';
export type { OptimizationSummary } from './OptimizationPanel';

export type {
  EditorElement,
  EditorBond,
  EditorState,
  PropertyPanelState,
  SimulationState,
  AnalysisData,
  PaletteItem,
  Position,
  Bounds,
} from './types';

export { pointInBounds, getElementBounds, distance } from './types';

// Multi-domain coupling support
export {
  DOMAINS,
  GYRATOR_EXAMPLES,
  validateGyratorCoupling,
  describeCoupling,
  getGyratorUnit,
  inferElementDomain,
  MOTOR_PUMP_THERMAL_EXAMPLE,
} from './domainMapping';
export type { PhysicalDomain, DomainInfo, GyratorCoupling } from './domainMapping';

// Nonlinear element support
export {
  NONLINEAR_LIBRARY,
  computeNonlinearResponse,
  validateNonlinearParams,
  describeNonlinearBehavior,
} from './nonlinearElements';
export type {
  NonlinearBehavior,
  NonlinearParams,
  NonlinearElement,
  SaturationParams,
  PowerLawParams,
  DiodeParams,
  CoulombFrictionParams,
  BacklashParams,
  DeadbandParams,
  RelayParams,
  PolynomialParams,
  LookupTableParams,
  HysteresisParams,
} from './nonlinearElements';

// Modulated transformer support
export {
  MODULATED_TRANSFORMER_LIBRARY,
  computeModulatedRatio,
  validateModulationParams,
  describeModulationType,
} from './modulatedTransformers';
export type {
  ModulationType,
  ModulationParams,
  ModulatedTransformer,
  StepFunctionParams,
  SineWaveParams,
  SquareWaveParams,
  SawtoothParams,
  TriangularParams,
  ExponentialParams,
  ControlSignalParams,
  StateDependentParams,
  LookupTableParams as ModulatedLookupTableParams,
  CustomFunctionParams,
} from './modulatedTransformers';

// Advanced causality visualization support
export {
  analyzeCausality,
  getCausalityVisualizationColors,
  explainCausality,
} from './causalityAnalysis';
export type {
  CausalityStatus,
  BondCausalityInfo,
  CausalityAnalysisResult,
  CausalityConflict,
  ElementCriticalPath,
  CausalityStep,
  CausalityVisualizationData,
} from './causalityAnalysis';

// Interactive causality debugger support
export { CausalityDebugger } from './causalityDebugger';
export type {
  DebuggerState,
  DebuggerStep,
  ManualOverride,
  HistoryEntry,
  CausalityDebuggerState,
} from './causalityDebugger';

// Causality-driven solver support
export { CausalityDrivenSolver } from './causalityDrivenSolver';
export type {
  SolverType,
  AlgebraicLoop,
  StiffnessAnalysis,
  SolverRecommendation,
  EquationOrder,
} from './causalityDrivenSolver';

// Canvas causality visualization support
export { useCanvasCausality } from './useCanvasCausality';
export { CausalityVisualizationRenderer, CausalityCanvasRenderer, CAUSALITY_COLORS } from './causalityVisualization';
export type {
  BondVisualization,
  CausalityVisualizationOptions,
} from './causalityVisualization';

// Advanced causality optimization support (Phase 54)
export { AdvancedLoopEliminator, detectAlgebraicLoops, suggestBreakPoints } from './advancedLoopElimination';
export type { AlgebraicLoop, BreakPoint } from './advancedLoopElimination';

export { DerivativeCausalityOptimizer, findDerivativeCausalities, formatDerivativeOrder } from './derivativeCausalityOptimizer';
export type { DerivativeCausalityIssue, DerivativeOrder, Remedy as DerivativeRemedy, RemedyInfo } from './derivativeCausalityOptimizer';

export { FeedbackPathAnalyzer, findFeedbackPaths, rateSystemStiffness } from './feedbackPathAnalyzer';
export type { FeedbackPath, StiffnessRating } from './feedbackPathAnalyzer';

export { EquationOrderingOptimizer, optimizeEquationOrder } from './equationOrderingOptimizer';
export type { EquationOrder, SimultaneousBlock } from './equationOrderingOptimizer';
