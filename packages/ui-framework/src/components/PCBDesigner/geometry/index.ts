/**
 * PCB 3D Geometry Builders
 * Phase 15: 3D Visualization - Exports
 */

export {
  PCBColors,
  calculateLayerZOffset,
  buildBoardGeometry,
  buildCopperLayerGeometry,
  buildSoldermaskGeometry,
  buildAllBoardGeometry,
} from './boardGeometry';

export {
  ComponentColors,
  buildComponentGeometry,
  buildAllComponentGeometry,
} from './componentGeometry';

export {
  buildTraceGeometry,
  batchTraceGeometry,
  buildAllTraceGeometry,
} from './traceGeometry';

export {
  buildViaGeometry,
  buildViaDrillGeometry,
  buildAllViaGeometry,
} from './viaGeometry';
