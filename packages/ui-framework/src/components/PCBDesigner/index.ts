/**
 * PCB Designer Module - Exports
 *
 * Complete PCB design system with:
 * - Board management and component placement
 * - Design rule checking (DRC)
 * - Automated trace routing
 * - Footprint library
 * - Real-time visualization
 */

// Components
export { PCBDesigner } from './PCBDesigner';

// Core managers
export { PCBBoardManager } from './PCBBoardManager';
export type { NetlistImport, UnroutedNet } from './PCBBoardManager';

// DRC Engine
export { DRCEngine } from './DRCEngine';
export type { DRCConfig } from './DRCEngine';

// Trace routing
export { TraceRouter } from './TraceRouter';
export type { RoutingNode, RoutePath } from './TraceRouter';

// Footprint library
export { FootprintLibrary, footprintLibrary } from './FootprintLibrary';
export {
  createFootprintR0603,
  createFootprintR0805,
  createFootprintC0603,
  createFootprintC1206,
  createFootprintSOIC8,
  createFootprintDIP8,
  createFootprintHeader2x1,
  createFootprintUSBC,
} from './FootprintLibrary';

// Type definitions
export type {
  PCBLayer,
  Pad,
  PadShape,
  PadConnectionType,
  Footprint,
  PlacedComponent,
  Trace,
  Via,
  Zone,
  DesignRule,
  DRCViolation,
  PCBBoard,
} from './types';
export { PCBLayer, PadShape, PadConnectionType } from './types';
