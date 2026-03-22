/**
 * CADEditor Module Exports
 * 
 * Enhanced 3D CAD components with full viewer capabilities
 */

// Components
export { CADEditorEnhanced as CADEditorNew } from './CADEditorEnhanced';
export { CAD3DViewerEnhanced as CAD3DViewerNew } from './CAD3DViewerEnhanced';
export { PropertyPanelEnhanced as PropertyPanelNew } from './PropertyPanelEnhanced';
export { Toolbar } from './Toolbar';

// Utilities & Managers
export { ViewportControls } from './ViewportControls';
export {
  createScene,
  createCamera,
  createRenderer,
  addGridHelper,
  addAxesHelper,
  createLights,
  meshFromTriangleMesh,
  createMaterial,
  getGeometryBounds,
  getGeometryStats,
  updateCameraAspect,
  updateRendererSize,
  PerformanceMonitor,
} from './SceneManager';

// Custom Hooks
export { useCADState } from './useCADState';
export { useGeometryBridge } from './useGeometryBridge';

// Types
export type { TriangleMesh, BoundingBox } from './SceneManager';

// Legacy Exports (keeping existing API)
export { CADEditor } from './CADEditor';
export { CAD3DViewer } from './CAD3DViewer';
export { PropertyPanel } from './PropertyPanel';
