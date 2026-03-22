/**
 * Advanced Routing Module - Exports
 *
 * Phase 13: Advanced PCB routing with signal integrity
 * - Impedance control and calculation
 * - Differential pair routing
 * - Length matching (meander/serpentine)
 * - Escape routing for dense components
 */

export { ImpedanceCalculator } from './ImpedanceCalculator';
export type {
  TraceGeometry,
  PCBStackup,
  TraceProperties,
  ImpedanceResult,
} from './ImpedanceCalculator';
export {
  TraceGeometry as TraceGeometryEnum,
  type PCBStackup as PCBStackupType,
} from './ImpedanceCalculator';

export { DifferentialPairRouter } from './DifferentialPairRouter';
export type {
  DifferentialPair,
  PairRoutingResult,
} from './DifferentialPairRouter';

export { LengthMatcher } from './LengthMatcher';
export type {
  LengthGroup,
  MeanderSpec,
  MatchingResult,
} from './LengthMatcher';

export { EscapeRouter, PinPriority } from './EscapeRouter';
export type {
  EscapePath,
  EscapeRoute,
} from './EscapeRouter';

export { AdvancedRoutingPanel } from './AdvancedRoutingPanel';
export type { AdvancedRoutingPanelProps } from './AdvancedRoutingPanel';
