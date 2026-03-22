/**
 * Type Definitions for 3D Component Models
 * Phase 16: 3D Component Models
 *
 * Defines interfaces for 3D model handling, footprint associations,
 * and PBR material properties.
 */

import { Footprint } from './types';

/**
 * Represents a 3D model file (STL, OBJ, or STEP)
 */
export interface Model3D {
  /** Unique identifier for the model */
  id: string;

  /** Human-readable model name */
  name: string;

  /** File format: STL, OBJ, or STEP */
  format: 'stl' | 'obj' | 'step';

  /** File size in bytes */
  fileSize: number;

  /** Number of vertices in the model */
  vertices: number;

  /** Number of triangles in the model */
  triangles: number;

  /** Bounding box dimensions in mm */
  bounds: {
    width: number;
    height: number;
    depth: number;
  };

  /** Base64-encoded preview image (optional) */
  preview?: string;

  /** Raw model file data */
  data: ArrayBuffer;

  /** Timestamp when model was uploaded */
  uploadedAt?: number;
}

/**
 * Extends Footprint with optional 3D model support
 */
export interface FootprintWithModel extends Footprint {
  /** Associated 3D model */
  model3d?: Model3D;

  /** Model offset from component center (mm) */
  modelOffset?: {
    x: number;
    y: number;
    z: number;
  };

  /** Model rotation (degrees) */
  modelRotation?: {
    x: number;
    y: number;
    z: number;
  };

  /** Model scale factor (1.0 = no scaling) */
  modelScale?: number;
}

/**
 * PBR (Physically Based Rendering) material definition
 */
export interface PCBMaterial {
  /** Material type */
  type:
    | 'copper'
    | 'soldermask'
    | 'silkscreen'
    | 'substrate'
    | 'component'
    | 'resistor'
    | 'capacitor'
    | 'inductor'
    | 'ic'
    | 'connector'
    | 'diode'
    | 'transistor'
    | 'custom';

  /** Color in hex format */
  color: string;

  /** Metalness value (0-1): 0=matte, 1=fully metallic */
  metalness?: number;

  /** Roughness value (0-1): 0=mirror-like, 1=completely rough */
  roughness?: number;

  /** Emissive color for glow effects */
  emissive?: string;

  /** Emissive intensity (default: 0) */
  emissiveIntensity?: number;

  /** Optional name for the material */
  name?: string;
}

/**
 * Geometry data extracted from parsed model files
 */
export interface ModelGeometry {
  /** Vertex positions as flat array [x1, y1, z1, x2, y2, z2, ...] */
  vertices: Float32Array;

  /** Vertex normals as flat array */
  normals: Float32Array;

  /** Face indices as flat array [i1, i2, i3, i4, i5, i6, ...] */
  indices: Uint32Array;

  /** Bounding box of the model */
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };

  /** Material index per face (optional) */
  materialIndices?: Uint32Array;
}

/**
 * Result of parsing a 3D model file
 */
export interface ParsedModel {
  /** Extracted geometry data */
  geometry: ModelGeometry;

  /** Triangle count */
  triangles: number;

  /** Vertex count */
  vertices: number;

  /** Optional material definitions (for OBJ) */
  materials?: Record<string, PCBMaterial>;
}

/**
 * Level-of-Detail (LOD) configuration for performance
 */
export interface LODConfig {
  /** Distance (mm) at which to use high detail */
  highDetailDistance: number;

  /** Distance (mm) at which to switch to medium detail */
  mediumDetailDistance: number;

  /** Distance (mm) at which to use low detail */
  lowDetailDistance: number;

  /** Simplification ratio for medium detail (0-1) */
  mediumSimplification: number;

  /** Simplification ratio for low detail (0-1) */
  lowSimplification: number;
}

/**
 * Model cache entry stored in IndexedDB
 */
export interface ModelCacheEntry {
  /** Model ID */
  id: string;

  /** Full model data */
  model: Model3D;

  /** Cached Three.js geometry (JSON stringified) */
  cachedGeometry?: string;

  /** Timestamp for cache invalidation */
  cachedAt: number;

  /** Cache version for compatibility */
  version: number;
}

/**
 * Statistics for model library
 */
export interface ModelLibraryStats {
  /** Total number of models */
  totalModels: number;

  /** Total storage used (bytes) */
  totalStorage: number;

  /** Total triangles across all models */
  totalTriangles: number;

  /** Models by format */
  byFormat: {
    stl: number;
    obj: number;
    step: number;
  };

  /** Average model complexity (triangles) */
  averageComplexity: number;
}

/**
 * Model library state for UI
 */
export interface ModelLibraryState {
  /** All loaded models */
  models: Model3D[];

  /** Currently selected model ID */
  selectedModelId?: string;

  /** Search query */
  searchQuery: string;

  /** Filter by format */
  formatFilter?: 'stl' | 'obj' | 'step' | 'all';

  /** Statistics */
  stats: ModelLibraryStats;

  /** Loading state */
  isLoading: boolean;

  /** Error message if any */
  error?: string;
}

/**
 * Viewer3D state extensions for model mode
 * This extends the existing Viewer3DState from PCBDesigner
 */
export interface Viewer3DStateWithModels {
  /** Rendering mode: 'box' for simple boxes, 'model' for realistic models */
  componentDetail: 'box' | 'model';

  /** Enable level-of-detail optimization */
  enableLOD: boolean;

  /** LOD configuration */
  lodConfig: LODConfig;

  /** Enable PBR material rendering */
  enablePBRMaterials: boolean;

  /** Model library state */
  modelLibrary: ModelLibraryState;
}

/**
 * Component with model reference
 */
export interface PlacedComponentWithModel {
  /** Standard component properties */
  id: string;
  refdes: string;
  footprintId: string;
  position: { x: number; y: number };
  rotation: number;
  side: 'top' | 'bottom';

  /** Associated 3D model (if available) */
  model3d?: Model3D;

  /** Model transformations */
  modelTransform?: {
    offset: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  };

  /** Material override */
  material?: PCBMaterial;
}

/**
 * Loader result with metadata
 */
export interface LoaderResult {
  /** Parsed model data */
  model: Model3D;

  /** Geometry information */
  geometry: ModelGeometry;

  /** Loading time in milliseconds */
  loadTime: number;

  /** Memory used by raw data (bytes) */
  memoryUsage: number;
}

/**
 * Default LOD configuration
 */
export const DEFAULT_LOD_CONFIG: LODConfig = {
  highDetailDistance: 10, // 0-10mm: full detail
  mediumDetailDistance: 50, // 10-50mm: medium detail
  lowDetailDistance: 100, // 50-100mm: low detail
  mediumSimplification: 0.5, // 50% of triangles
  lowSimplification: 0.2, // 20% of triangles
};

/**
 * Default PBR materials for common component types
 */
export const DEFAULT_PCB_MATERIALS: Record<string, PCBMaterial> = {
  copper: {
    type: 'copper',
    color: '#B87333',
    metalness: 1.0,
    roughness: 0.3,
    name: 'Copper',
  },
  soldermask: {
    type: 'soldermask',
    color: '#2d5016',
    metalness: 0.0,
    roughness: 0.6,
    name: 'Solder Mask (Green)',
  },
  silkscreen: {
    type: 'silkscreen',
    color: '#FFFFFF',
    metalness: 0.0,
    roughness: 0.7,
    name: 'Silk Screen',
  },
  substrate: {
    type: 'substrate',
    color: '#3A3A2A',
    metalness: 0.0,
    roughness: 0.8,
    name: 'FR-4 Substrate',
  },
  resistor: {
    type: 'resistor',
    color: '#8B4513',
    metalness: 0.1,
    roughness: 0.5,
    name: 'Resistor',
  },
  capacitor: {
    type: 'capacitor',
    color: '#FFD700',
    metalness: 0.2,
    roughness: 0.4,
    name: 'Capacitor',
  },
  ic: {
    type: 'ic',
    color: '#1a1a1a',
    metalness: 0.0,
    roughness: 0.6,
    name: 'IC Package',
  },
  connector: {
    type: 'connector',
    color: '#CC0000',
    metalness: 0.8,
    roughness: 0.2,
    name: 'Connector',
  },
};
