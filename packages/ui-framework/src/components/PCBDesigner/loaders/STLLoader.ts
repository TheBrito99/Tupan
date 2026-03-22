/**
 * STL File Loader
 * Phase 16: 3D Component Models
 *
 * Parses binary and ASCII STL files and extracts geometry data.
 * STL is a common 3D format used for 3D printing and CAD.
 */

import {
  Model3D,
  ModelGeometry,
  ParsedModel,
  LoaderResult,
} from '../types3d';

/**
 * STL loader for parsing binary and ASCII STL files
 */
export class STLLoader {
  /**
   * Parse an STL file (automatically detects binary or ASCII format)
   */
  async parse(arrayBuffer: ArrayBuffer, filename: string): Promise<LoaderResult> {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize ?? 0;

    try {
      // Try to detect format and parse
      let geometry: ModelGeometry;
      const isAscii = this.isASCII(arrayBuffer);

      if (isAscii) {
        geometry = await this.parseASCII(arrayBuffer);
      } else {
        geometry = this.parseBinary(arrayBuffer);
      }

      // Create model object
      const model: Model3D = {
        id: this.generateId(),
        name: this.extractFilename(filename),
        format: 'stl',
        fileSize: arrayBuffer.byteLength,
        vertices: geometry.vertices.length / 3,
        triangles: geometry.indices.length / 3,
        bounds: this.calculateBounds(geometry.vertices),
        data: arrayBuffer,
        uploadedAt: Date.now(),
      };

      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize ?? 0;

      return {
        model,
        geometry,
        loadTime: endTime - startTime,
        memoryUsage: Math.max(0, endMemory - startMemory),
      };
    } catch (error) {
      throw new Error(
        `Failed to parse STL file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse binary STL file format
   * Format: 80-byte header + 4-byte triangle count + triangle data
   */
  private parseBinary(arrayBuffer: ArrayBuffer): ModelGeometry {
    const view = new DataView(arrayBuffer);

    // Skip 80-byte header
    const triangleCount = view.getUint32(80, true);
    const expectedSize = 84 + triangleCount * 50; // 84-byte header + 50 bytes per triangle

    if (arrayBuffer.byteLength < expectedSize) {
      throw new Error(
        `Invalid STL file: expected ${expectedSize} bytes but got ${arrayBuffer.byteLength}`
      );
    }

    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    let offset = 84; // Skip header and triangle count
    let vertexIndex = 0;

    for (let i = 0; i < triangleCount; i++) {
      // Read normal (3 floats)
      const nx = view.getFloat32(offset, true);
      const ny = view.getFloat32(offset + 4, true);
      const nz = view.getFloat32(offset + 8, true);
      offset += 12;

      // Read 3 vertices (3 floats each)
      const v1x = view.getFloat32(offset, true);
      const v1y = view.getFloat32(offset + 4, true);
      const v1z = view.getFloat32(offset + 8, true);
      offset += 12;

      const v2x = view.getFloat32(offset, true);
      const v2y = view.getFloat32(offset + 4, true);
      const v2z = view.getFloat32(offset + 8, true);
      offset += 12;

      const v3x = view.getFloat32(offset, true);
      const v3y = view.getFloat32(offset + 4, true);
      const v3z = view.getFloat32(offset + 8, true);
      offset += 12;

      // Skip attribute byte count
      offset += 2;

      // Add vertices
      vertices.push(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z);

      // Add normals for each vertex
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);

      // Add indices (triangle)
      indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      vertexIndex += 3;
    }

    // Recalculate normals for better shading
    const calculatedNormals = this.calculateNormals(
      new Float32Array(vertices),
      new Uint32Array(indices)
    );

    return {
      vertices: new Float32Array(vertices),
      normals: calculatedNormals,
      indices: new Uint32Array(indices),
      bounds: this.calculateBounds(new Float32Array(vertices)),
    };
  }

  /**
   * Parse ASCII STL file format
   * Uses regex to extract vertices from text format
   */
  private async parseASCII(arrayBuffer: ArrayBuffer): Promise<ModelGeometry> {
    const text = new TextDecoder().decode(arrayBuffer);
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Parse vertices from "vertex x y z" lines
    const vertexPattern = /vertex\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g;
    const normalPattern = /facet normal\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g;

    // Extract normals
    const normalMatches = Array.from(text.matchAll(normalPattern));
    const facetNormals: Array<[number, number, number]> = normalMatches.map(
      (match) => [parseFloat(match[1]), parseFloat(match[3]), parseFloat(match[5])]
    );

    // Extract vertices
    const vertexMatches = Array.from(text.matchAll(vertexPattern));
    if (vertexMatches.length === 0) {
      throw new Error('No vertices found in ASCII STL file');
    }

    let facetIndex = 0;
    let vertexInFacet = 0;
    let vertexIndex = 0;

    for (const match of vertexMatches) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[3]);
      const z = parseFloat(match[5]);

      vertices.push(x, y, z);

      // Add normal for this vertex
      if (facetIndex < facetNormals.length) {
        const [nx, ny, nz] = facetNormals[facetIndex];
        normals.push(nx, ny, nz);
      } else {
        normals.push(0, 0, 1); // Default normal
      }

      vertexInFacet++;

      // Every 3 vertices makes a triangle
      if (vertexInFacet === 3) {
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
        vertexInFacet = 0;
        facetIndex++;
      }
    }

    // Recalculate normals for better shading
    const calculatedNormals = this.calculateNormals(
      new Float32Array(vertices),
      new Uint32Array(indices)
    );

    return {
      vertices: new Float32Array(vertices),
      normals: calculatedNormals,
      indices: new Uint32Array(indices),
      bounds: this.calculateBounds(new Float32Array(vertices)),
    };
  }

  /**
   * Detect if file is ASCII or binary format
   */
  private isASCII(arrayBuffer: ArrayBuffer): boolean {
    // ASCII STL files start with "solid"
    const view = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(view.slice(0, 100));

    return text.toLowerCase().startsWith('solid');
  }

  /**
   * Calculate vertex normals from face data
   */
  private calculateNormals(
    vertices: Float32Array,
    indices: Uint32Array
  ): Float32Array {
    const normals = new Float32Array(vertices.length);

    // Accumulate normals from all faces sharing each vertex
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i];
      const i2 = indices[i + 1];
      const i3 = indices[i + 2];

      // Get vertices
      const v1 = [
        vertices[i1 * 3],
        vertices[i1 * 3 + 1],
        vertices[i1 * 3 + 2],
      ];
      const v2 = [
        vertices[i2 * 3],
        vertices[i2 * 3 + 1],
        vertices[i2 * 3 + 2],
      ];
      const v3 = [
        vertices[i3 * 3],
        vertices[i3 * 3 + 1],
        vertices[i3 * 3 + 2],
      ];

      // Calculate face normal using cross product
      const edge1 = [
        v2[0] - v1[0],
        v2[1] - v1[1],
        v2[2] - v1[2],
      ];
      const edge2 = [
        v3[0] - v1[0],
        v3[1] - v1[1],
        v3[2] - v1[2],
      ];

      const normal = this.crossProduct(edge1, edge2);

      // Add face normal to all vertices
      normals[i1 * 3] += normal[0];
      normals[i1 * 3 + 1] += normal[1];
      normals[i1 * 3 + 2] += normal[2];

      normals[i2 * 3] += normal[0];
      normals[i2 * 3 + 1] += normal[1];
      normals[i2 * 3 + 2] += normal[2];

      normals[i3 * 3] += normal[0];
      normals[i3 * 3 + 1] += normal[1];
      normals[i3 * 3 + 2] += normal[2];
    }

    // Normalize all normals
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.sqrt(
        normals[i] * normals[i] +
          normals[i + 1] * normals[i + 1] +
          normals[i + 2] * normals[i + 2]
      );

      if (len > 0) {
        normals[i] /= len;
        normals[i + 1] /= len;
        normals[i + 2] /= len;
      }
    }

    return normals;
  }

  /**
   * Cross product of two 3D vectors
   */
  private crossProduct(a: number[], b: number[]): number[] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  /**
   * Calculate bounding box of vertices
   */
  private calculateBounds(
    vertices: Float32Array
  ): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (let i = 0; i < vertices.length; i += 3) {
      min.x = Math.min(min.x, vertices[i]);
      min.y = Math.min(min.y, vertices[i + 1]);
      min.z = Math.min(min.z, vertices[i + 2]);

      max.x = Math.max(max.x, vertices[i]);
      max.y = Math.max(max.y, vertices[i + 1]);
      max.z = Math.max(max.z, vertices[i + 2]);
    }

    return {
      min,
      max,
      width: max.x - min.x,
      height: max.y - min.y,
      depth: max.z - min.z,
    } as any;
  }

  /**
   * Calculate bounds in mm
   */
  private calculateBoundsInMm(
    bounds: any
  ): { width: number; height: number; depth: number } {
    return {
      width: bounds.width,
      height: bounds.height,
      depth: bounds.depth,
    };
  }

  /**
   * Extract filename from path
   */
  private extractFilename(filepath: string): string {
    return filepath.split('/').pop()?.split('\\').pop() || 'Unnamed Model';
  }

  /**
   * Generate unique ID for model
   */
  private generateId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
