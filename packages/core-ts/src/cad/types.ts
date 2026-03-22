/**
 * CAD System Type Definitions
 * Phase 17: 3D CAD Foundation
 *
 * Core types for parametric modeling, constraints, and BREP geometry
 */

// ============================================================================
// BASIC GEOMETRY TYPES
// ============================================================================

export type Point2D = { x: number; y: number };
export type Point3D = { x: number; y: number; z: number };
export type Vector2D = { dx: number; dy: number };
export type Vector3D = { dx: number; dy: number; dz: number };
export type Matrix4 = number[]; // 16-element column-major transformation matrix

export interface BoundingBox3D {
  min: Point3D;
  max: Point3D;
  width: number;
  height: number;
  depth: number;
}

// ============================================================================
// SKETCH GEOMETRY
// ============================================================================

export enum SketchGeometryType {
  Point = 'point',
  Line = 'line',
  Circle = 'circle',
  Arc = 'arc',
  Ellipse = 'ellipse',
  Spline = 'spline',
  Rectangle = 'rectangle',
  Polygon = 'polygon',
}

export interface SketchPoint {
  id: string;
  type: SketchGeometryType.Point;
  position: Point2D;
  construction: boolean; // Construction geometry (blue, not part of profile)
  isFixed: boolean;
  dependsOn?: string[]; // IDs of constraints
}

export interface SketchLine {
  id: string;
  type: SketchGeometryType.Line;
  startPoint: string; // Point ID
  endPoint: string;
  construction: boolean;
  isFixed: boolean;
  dependsOn?: string[];
}

export interface SketchCircle {
  id: string;
  type: SketchGeometryType.Circle;
  center: string; // Point ID
  radius: number;
  construction: boolean;
  isFixed: boolean;
  dependsOn?: string[];
}

export type SketchElement = SketchPoint | SketchLine | SketchCircle;

// ============================================================================
// CONSTRAINTS
// ============================================================================

export enum ConstraintType {
  // Geometric
  Coincident = 'coincident',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
  Perpendicular = 'perpendicular',
  Parallel = 'parallel',
  Tangent = 'tangent',
  Concentric = 'concentric',
  Equal = 'equal',
  Symmetry = 'symmetry',

  // Dimensional
  Distance = 'distance',
  Angle = 'angle',
  Radius = 'radius',
  Diameter = 'diameter',
  FixedLength = 'fixedLength',
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  geometryIds: string[]; // Which sketch elements this applies to
  value?: number; // For dimensional constraints (distance, angle, radius, etc.)
  label?: string;
  isReference: boolean; // Reference constraints don't constrain (blue)
  isDriving: boolean; // Driven constraints (gray) vs driving (black)
}

// ============================================================================
// PARAMETRIC VARIABLES
// ============================================================================

export interface ParametricVariable {
  id: string;
  name: string; // e.g., "pad_pitch", "resistor_height"
  value: number;
  unit: string; // 'mm', 'in', 'deg', etc.
  expression?: string; // e.g., "2.54 * 2" or "= other_param + 5"
  description?: string;
  minValue?: number;
  maxValue?: number;
}

export interface ParameterSpreadsheet {
  id: string;
  name: string;
  variables: Map<string, ParametricVariable>;
  lastModified: number;
}

// ============================================================================
// SKETCH DEFINITION
// ============================================================================

export interface Sketch {
  id: string;
  name: string;
  plane: 'XY' | 'YZ' | 'XZ' | 'Custom'; // Which plane the sketch is on
  planeNormal?: Vector3D; // For custom planes
  planeOrigin?: Point3D;
  elements: Map<string, SketchElement>;
  constraints: Map<string, Constraint>;
  isProfiled: boolean; // Is this sketch a closed profile ready for 3D?
  profileLoops?: string[][]; // IDs of elements forming loops (for extrude/revolve)
  createdAt: number;
  modifiedAt: number;
}

// ============================================================================
// PARAMETRIC FEATURES (3D OPERATIONS)
// ============================================================================

export enum FeatureType {
  Extrude = 'extrude',
  Revolve = 'revolve',
  Loft = 'loft',
  Sweep = 'sweep',
  Pocket = 'pocket', // Extrude removal
  Hole = 'hole',
  Fillet = 'fillet',
  Chamfer = 'chamfer',
  Pattern = 'pattern', // Linear or circular array
  Rib = 'rib',
  Shell = 'shell',
  Mirror = 'mirror',
  Combine = 'combine', // Union, subtract, intersect
}

export interface ExtrudeFeature {
  type: FeatureType.Extrude;
  sketchId: string;
  length: number; // mm
  lengthExpression?: string;
  direction: 'Normal' | 'Reverse' | 'Symmetric';
  isSolid: boolean; // Create solid vs surface
  draftAngle?: number; // Taper angle
}

export interface RevolveFeature {
  type: FeatureType.Revolve;
  sketchId: string;
  axisType: 'SketchAxis' | 'CustomAxis'; // Revolve around axis
  axisId?: string; // Sketch element ID or custom axis
  angle: number; // degrees
  angleExpression?: string;
  reverse: boolean;
}

export interface FilletFeature {
  type: FeatureType.Fillet;
  radius: number;
  radiusExpression?: string;
  edgeIds: string[]; // Which edges to fillet
}

export interface HoleFeature {
  type: FeatureType.Hole;
  holeType: 'Blind' | 'Through' | 'CounterBore' | 'CounterSink' | 'Tapped';
  diameter: number;
  diameterExpression?: string;
  depth?: number; // For blind holes
  depthExpression?: string;
  sketchPointId: string; // Hole center
}

export type Feature = ExtrudeFeature | RevolveFeature | FilletFeature | HoleFeature;

export interface FeatureNode {
  id: string;
  index: number; // Position in feature tree
  feature: Feature;
  isActive: boolean; // Visible/active in model
  isSuppressed: boolean; // Suppressed (grayed out)
  dependsOn: string[]; // Previous features this depends on
  resultingGeometry?: string; // BREP face/shell ID
}

// ============================================================================
// PARAMETRIC BODY & COMPONENT
// ============================================================================

export interface ParametricBody {
  id: string;
  name: string;
  featureTree: FeatureNode[]; // Ordered list of features
  currentFeatureIndex: number; // Which feature is "current" for editing
  origin: {
    point: Point3D;
    axes: { x: Vector3D; y: Vector3D; z: Vector3D };
  };
  variables: ParameterSpreadsheet;
  lastRecomputed: number;
}

export interface ParametricComponent {
  id: string;
  name: string;
  description?: string;
  bodies: Map<string, ParametricBody>;
  assemblies?: AssemblyConstraint[]; // Multi-body constraints
  exportSettings: {
    stepFile?: string; // Path/URL to STEP file
    stlFile?: string;
    igesFile?: string;
  };
}

// ============================================================================
// ASSEMBLY (Multi-Body Modeling)
// ============================================================================

export enum AssemblyConstraintType {
  Coincident = 'coincident', // Faces/edges coincident
  Distance = 'distance', // Fixed distance between faces
  Parallel = 'parallel',
  Perpendicular = 'perpendicular',
  Concentric = 'concentric', // Axes/circles concentric
  Fixed = 'fixed', // Body fixed in place
}

export interface AssemblyConstraint {
  id: string;
  type: AssemblyConstraintType;
  body1Id: string;
  face1Id?: string; // BREP face ID
  body2Id: string;
  face2Id?: string;
  offset?: number; // For distance constraints
  isActive: boolean;
}

// ============================================================================
// BREP (Boundary Representation) GEOMETRY
// ============================================================================

export interface BREPVertex {
  id: string;
  position: Point3D;
  edges: string[]; // Connected edge IDs
}

export interface BREPEdge {
  id: string;
  startVertex: string;
  endVertex: string;
  curve: 'Line' | 'Circle' | 'Ellipse' | 'Spline'; // Curve type
  curveData: any; // Curve parameters (line direction, circle radius, etc.)
  faces: string[]; // Adjacent face IDs
}

export interface BREPFace {
  id: string;
  surface: 'Plane' | 'Cylinder' | 'Sphere' | 'Cone' | 'Torus' | 'NURBS';
  surfaceData: any; // Surface parameters
  edges: string[]; // Boundary edges (closed loop)
  normal: Vector3D;
  area: number; // For calculations
  isOuter: boolean; // Outer faces vs holes
}

export interface BREPShell {
  id: string;
  name: string;
  vertices: Map<string, BREPVertex>;
  edges: Map<string, BREPEdge>;
  faces: Map<string, BREPFace>;
  isClosed: boolean; // Is this a closed solid?
  volume?: number;
  boundingBox: BoundingBox3D;
  material?: string; // Material assignment for rendering
}

// ============================================================================
// VISUALIZATION & RENDERING
// ============================================================================

export interface CADViewState {
  // Camera
  cameraPosition: Point3D;
  cameraTarget: Point3D;
  zoomLevel: number;
  fieldOfView: number; // degrees

  // Display modes
  displayMode: 'Wireframe' | 'Shaded' | 'Rendered' | 'Section';
  showEdges: boolean;
  showFaces: boolean;
  showHiddenGeometry: boolean;
  showConstructionGeometry: boolean;
  showConstraints: boolean;

  // Selection
  selectedElement?: string; // Sketch element or face ID
  selectedFeature?: string; // Feature ID
  highlightedGeometry: Set<string>;

  // Section view
  sectionPlane?: { normal: Vector3D; origin: Point3D };
}

export interface CADExportSettings {
  format: 'STEP' | 'STL' | 'IGES' | 'IGES' | 'JSON';
  units: 'mm' | 'in' | 'cm';
  precision: number; // Decimal places
  includeAssembly: boolean; // For multi-body exports
  mergeShells: boolean;
  triangulationTolerance?: number; // For STL export
}

// ============================================================================
// CAD DOCUMENT
// ============================================================================

export interface CADDocument {
  id: string;
  name: string;
  version: string;
  createdAt: number;
  modifiedAt: number;
  component: ParametricComponent;
  viewState: CADViewState;
  recentSketches: string[]; // Recent sketch IDs for quick access
  undo: CADDocument[]; // Undo stack
  redo: CADDocument[]; // Redo stack
  isModified: boolean;
}


// ============================================================================
// GEOMETRY BRIDGE EXTENSIONS
// ============================================================================

/**
 * Extended 3D Point with computational geometry methods
 */
export interface Point3DExtended extends Point3D {
  distanceTo(other: Point3D): number;
  clone(): Point3DExtended;
  add(vector: Vector3D): Point3DExtended;
  subtract(other: Point3D): Vector3D;
}

/**
 * Extended 3D Vector with linear algebra operations
 */
export interface Vector3DExtended extends Vector3D {
  magnitude(): number;
  normalize(): Vector3DExtended;
  dot(other: Vector3D): number;
  cross(other: Vector3D): Vector3DExtended;
  scale(factor: number): Vector3DExtended;
  clone(): Vector3DExtended;
}

/**
 * Extended Bounding Box with spatial queries
 */
export interface BoundingBoxExtended extends BoundingBox3D {
  volume(): number;
  center(): Point3D;
  diagonal(): number;
  containsPoint(point: Point3D, tolerance?: number): boolean;
  intersectsBox(other: BoundingBox3D, tolerance?: number): boolean;
  expand(amount: number): BoundingBoxExtended;
}

/**
 * Detailed shell validation results with topology analysis
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  eulerCharacteristic: {
    computed: number;
    expected: number;
    isCorrect: boolean;
  };
  topology: {
    vertexCount: number;
    edgeCount: number;
    faceCount: number;
  };
  boundingBox: BoundingBox3D;
  volume?: number;
  isClosed: boolean;
}

/**
 * Triangle mesh data structure for rendering and export
 */
export interface TriangleMeshData {
  vertices: number[][] | Float32Array;
  indices: number[] | Uint32Array;
  vertexCount: number;
  triangleCount: number;
  normals?: number[][] | Float32Array;
  boundingBox: BoundingBox3D;
}

/**
 * JSON-serializable mesh format for Three.js compatibility
 */
export interface MeshJSON {
  vertices: number[];
  indices: number[];
  normals?: number[];
  vertexCount: number;
  triangleCount: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

// ============================================================================
// CAD GEOMETRY MODULE EXPORTS
// ============================================================================

export {
  Point3DExtended,
  Vector3DExtended,
  BoundingBoxExtended,
  ValidationResult,
  TriangleMeshData,
  MeshJSON,
  CADGeometryBridge,
  createCADGeometryBridge,
  wasmPointToTS,
  tsPointToWasm,
  wasmVectorToTS,
  wasmBBoxToTS,
  tsMeshToJSON,
} from "./geometry-bridge";
