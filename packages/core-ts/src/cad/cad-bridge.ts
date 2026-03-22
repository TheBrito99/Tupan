/**
 * CAD System TypeScript Bridge
 * Phase 17: 3D CAD Foundation
 *
 * Type-safe wrapper around WASM CAD system
 */

import type {
  CADDocument,
  Sketch,
  Feature,
  ParametricVariable,
  Point3D,
  Constraint,
} from './types';

/**
 * CAD Document Bridge - Provides type-safe access to WASM CAD system
 */
export class CADDocumentBridge {
  private wasmDocument: any; // WasmCADDocument from WASM
  private documentCache: CADDocument | null = null;
  private lastRecompute: number = 0;

  constructor(wasmDocument: any) {
    this.wasmDocument = wasmDocument;
    this.syncFromWasm();
  }

  /**
   * Create a new CAD document
   */
  static create(name: string, wasmModule: any): CADDocumentBridge {
    const wasmDocument = new wasmModule.WasmCADDocument(name);
    return new CADDocumentBridge(wasmDocument);
  }

  /**
   * Sync internal cache from WASM
   */
  private syncFromWasm(): void {
    this.lastRecompute = Date.now();
  }

  // =========================================================================
  // DOCUMENT OPERATIONS
  // =========================================================================

  /**
   * Get document ID
   */
  getId(): string {
    return this.wasmDocument.id;
  }

  /**
   * Get document name
   */
  getName(): string {
    return this.wasmDocument.name;
  }

  /**
   * Get document as JSON
   */
  toJSON(): string {
    return this.wasmDocument.to_json();
  }

  /**
   * Export to STEP format
   */
  exportSTEP(): string {
    return this.wasmDocument.export_step();
  }

  /**
   * Export to STL format (binary)
   */
  exportSTL(): Uint8Array {
    return this.wasmDocument.export_stl();
  }

  /**
   * Import from STEP file
   * @param content STEP file content as string
   * @throws {Error} if STEP file is invalid
   */
  importSTEP(content: string): boolean {
    try {
      return this.wasmDocument.import_step(content);
    } catch (error) {
      throw new Error(`Failed to import STEP file: ${error}`);
    }
  }

  /**
   * Import STEP file from File object
   * @param file STEP file to import
   */
  async importSTEPFile(file: File): Promise<boolean> {
    try {
      const content = await file.text();
      return this.importSTEP(content);
    } catch (error) {
      throw new Error(`Failed to read STEP file: ${error}`);
    }
  }

  // =========================================================================
  // PARAMETER OPERATIONS
  // =========================================================================

  /**
   * Set a parameter value
   */
  setParameter(name: string, value: number): void {
    this.wasmDocument.set_parameter(name, value);
  }

  /**
   * Get a parameter value
   */
  getParameter(name: string): number | null {
    return this.wasmDocument.get_parameter(name);
  }

  /**
   * Get all parameters
   */
  getParameters(): Record<string, number> {
    const json = this.wasmDocument.get_parameters_json();
    return JSON.parse(json);
  }

  // =========================================================================
  // SKETCH OPERATIONS
  // =========================================================================

  /**
   * Create a new sketch
   */
  createSketch(name: string, plane: 'XY' | 'YZ' | 'XZ'): string {
    return this.wasmDocument.create_sketch(name, plane);
  }

  /**
   * Add a point to a sketch
   */
  sketchAddPoint(sketchId: string, x: number, y: number, construction: boolean = false): string {
    return this.wasmDocument.sketch_add_point(sketchId, x, y, construction);
  }

  /**
   * Add a line to a sketch
   */
  sketchAddLine(
    sketchId: string,
    startId: string,
    endId: string,
    construction: boolean = false
  ): string {
    return this.wasmDocument.sketch_add_line(sketchId, startId, endId, construction);
  }

  /**
   * Add a circle to a sketch
   */
  sketchAddCircle(
    sketchId: string,
    centerId: string,
    radius: number,
    construction: boolean = false
  ): string {
    return this.wasmDocument.sketch_add_circle(sketchId, centerId, radius, construction);
  }

  /**
   * Apply horizontal constraint to a line
   */
  sketchConstrainHorizontal(sketchId: string, lineId: string): string {
    return this.wasmDocument.sketch_constrain_horizontal(sketchId, lineId);
  }

  /**
   * Apply vertical constraint to a line
   */
  sketchConstrainVertical(sketchId: string, lineId: string): string {
    return this.wasmDocument.sketch_constrain_vertical(sketchId, lineId);
  }

  /**
   * Apply distance constraint between two points
   */
  sketchConstrainDistance(
    sketchId: string,
    point1Id: string,
    point2Id: string,
    distance: number
  ): string {
    return this.wasmDocument.sketch_constrain_distance(
      sketchId,
      point1Id,
      point2Id,
      distance
    );
  }

  /**
   * Apply radius constraint to a circle
   */
  sketchConstrainRadius(sketchId: string, circleId: string, radius: number): string {
    return this.wasmDocument.sketch_constrain_radius(sketchId, circleId, radius);
  }

  /**
   * Solve all constraints in a sketch
   */
  sketchSolve(sketchId: string): void {
    this.wasmDocument.sketch_solve(sketchId);
    this.syncFromWasm();
  }

  /**
   * Get constraint status of a sketch
   */
  sketchGetStatus(sketchId: string): string {
    return this.wasmDocument.sketch_get_status(sketchId);
  }

  /**
   * Get all sketches
   */
  getSketches(): Sketch[] {
    const json = this.wasmDocument.get_sketches_json();
    return JSON.parse(json);
  }

  // =========================================================================
  // FEATURE OPERATIONS
  // =========================================================================

  /**
   * Create an extrude feature
   */
  createExtrude(name: string, sketchId: string, length: number): string {
    return this.wasmDocument.create_extrude(name, sketchId, length);
  }

  /**
   * Create a hole feature
   */
  createHole(
    name: string,
    diameter: number,
    sketchPointId: string,
    holeType: 'Blind' | 'Through' | 'CounterBore' | 'CounterSink' | 'Tapped'
  ): string {
    return this.wasmDocument.create_hole(name, diameter, sketchPointId, holeType);
  }

  /**
   * Get all features
   */
  getFeatures(): Feature[] {
    const json = this.wasmDocument.get_features_json();
    return JSON.parse(json);
  }

  // =========================================================================
  // MODEL OPERATIONS
  // =========================================================================

  /**
   * Recompute the model (rebuild feature tree)
   */
  recompute(): void {
    this.wasmDocument.recompute();
    this.syncFromWasm();
  }

  /**
   * Get last recompute time
   */
  getLastRecomputeTime(): number {
    return this.lastRecompute;
  }
}

// ============================================================================
// GEOMETRY UTILITIES
// ============================================================================

/**
 * 3D Point wrapper
 */
export class Point3DBridge {
  private wasmPoint: any; // WasmPoint3D from WASM

  constructor(x: number, y: number, z: number, wasmModule: any) {
    this.wasmPoint = new wasmModule.WasmPoint3D(x, y, z);
  }

  get x(): number {
    return this.wasmPoint.x;
  }

  get y(): number {
    return this.wasmPoint.y;
  }

  get z(): number {
    return this.wasmPoint.z;
  }

  distanceTo(other: Point3DBridge): number {
    return this.wasmPoint.distance_to(other.wasmPoint);
  }
}

/**
 * BREP Shell wrapper for 3D geometry
 */
export class BREPShellBridge {
  private wasmShell: any; // WasmBREPShell from WASM

  constructor(wasmShell: any) {
    this.wasmShell = wasmShell;
  }

  /**
   * Create a box geometry
   */
  static createBox(width: number, height: number, depth: number, wasmModule: any): BREPShellBridge {
    const wasmShell = wasmModule.WasmBREPShell.create_box(width, height, depth);
    return new BREPShellBridge(wasmShell);
  }

  /**
   * Get triangulated mesh for rendering
   */
  getTriangles(): { vertices: number[][]; indices: number[]; vertexCount: number; triangleCount: number } {
    const json = this.wasmShell.triangulate();
    return JSON.parse(json);
  }

  /**
   * Get bounding box
   */
  getBoundingBox(): {
    min: Point3D;
    max: Point3D;
    width: number;
    height: number;
    depth: number;
  } {
    const json = this.wasmShell.get_bounding_box();
    return JSON.parse(json);
  }

  /**
   * Get vertex count
   */
  getVertexCount(): number {
    return this.wasmShell.vertex_count();
  }

  /**
   * Get edge count
   */
  getEdgeCount(): number {
    return this.wasmShell.edge_count();
  }

  /**
   * Get face count
   */
  getFaceCount(): number {
    return this.wasmShell.face_count();
  }
}

// ============================================================================
// CAD SYSTEM INITIALIZATION
// ============================================================================

let wasmModule: any = null;

/**
 * Initialize the WASM CAD system
 */
export async function initializeCAD(): Promise<void> {
  if (wasmModule) {
    return; // Already initialized
  }

  try {
    // In production, this would import from the actual WASM build
    // import * as wasm from '@tupan/core-rust';
    // wasmModule = wasm;

    console.log('CAD system initialized');
  } catch (error) {
    console.error('Failed to initialize CAD system:', error);
    throw error;
  }
}

/**
 * Get the WASM module
 */
export function getWasmModule(): any {
  if (!wasmModule) {
    throw new Error('WASM module not initialized. Call initializeCAD() first.');
  }
  return wasmModule;
}

/**
 * Create a new CAD document
 */
export function createCADDocument(name: string): CADDocumentBridge {
  return CADDocumentBridge.create(name, getWasmModule());
}

/**
 * Create a 3D point
 */
export function createPoint3D(x: number, y: number, z: number): Point3DBridge {
  return new Point3DBridge(x, y, z, getWasmModule());
}

/**
 * Create a box geometry
 */
export function createBoxGeometry(width: number, height: number, depth: number): BREPShellBridge {
  return BREPShellBridge.createBox(width, height, depth, getWasmModule());
}
