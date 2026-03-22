// CAD Geometry WASM Bridge
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
    return `${sketchId}-constraint-distance-${point1Id}-${point2Id}-${distance}`;
  }
}
