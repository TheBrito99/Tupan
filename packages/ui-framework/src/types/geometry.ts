/**
 * Geometry primitives for UI components
 * Shared types for spatial calculations across PCBDesigner, SchematicEditor, and related components
 */

/**
 * 2D point coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 3D point coordinates extending 2D point
 */
export interface Point3D extends Point {
  z: number;
}

/**
 * Bounding box with position and dimensions
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 2D vector (same as Point but semantically different - represents direction/displacement)
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * 3D vector
 */
export interface Vector3D extends Vector2D {
  z: number;
}

/**
 * Rect/Rectangle geometry
 */
export interface Rect extends Bounds {
}

/**
 * Circle geometry
 */
export interface Circle {
  center: Point;
  radius: number;
}

/**
 * Ellipse geometry
 */
export interface Ellipse {
  center: Point;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}

/**
 * Line segment
 */
export interface LineSegment {
  start: Point;
  end: Point;
}

/**
 * Polygon defined by vertices
 */
export interface Polygon {
  vertices: Point[];
  closed?: boolean;
}

/**
 * Generic geometric entity (union type)
 */
export type GeometricEntity =
  | { type: 'point'; position: Point }
  | { type: 'line'; start: Point; end: Point; width?: number }
  | { type: 'circle'; center: Point; radius: number }
  | { type: 'ellipse'; center: Point; radiusX: number; radiusY: number }
  | { type: 'rectangle'; position: Point; width: number; height: number }
  | { type: 'polygon'; vertices: Point[] };

/**
 * Transform operations
 */
export interface Transform {
  translateX?: number;
  translateY?: number;
  scaleX?: number;
  scaleY?: number;
  rotateZ?: number; // in degrees
}
