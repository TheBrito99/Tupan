/**
 * OBJ File Loader
 * Phase 16: 3D Component Models
 *
 * Parses Wavefront OBJ files and extracts geometry data.
 * OBJ is a widely-used 3D format that can include materials (MTL).
 */

import {
  Model3D,
  ModelGeometry,
  PCBMaterial,
  LoaderResult,
} from '../types3d';

interface OBJData {
  vertices: number[];
  normals: number[];
  texCoords: number[];
  faces: Array<Array<[number, number, number]>>; // [vertex, texCoord, normal] per vertex per face
  materials: Record<string, PCBMaterial>;
}

/**
 * OBJ loader for parsing Wavefront OBJ files
 */
export class OBJLoader {
  /**
   * Parse an OBJ file
   */
  async parse(arrayBuffer: ArrayBuffer, filename: string): Promise<LoaderResult> {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize ?? 0;

    try {
      const text = new TextDecoder().decode(arrayBuffer);
      const geometry = this.parseOBJ(text);

      // Create model object
      const model: Model3D = {
        id: this.generateId(),
        name: this.extractFilename(filename),
        format: 'obj',
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
        `Failed to parse OBJ file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse OBJ file format
   */
  private parseOBJ(text: string): ModelGeometry {
    const lines = text.split('\n');
    const objData: OBJData = {
      vertices: [],
      normals: [],
      texCoords: [],
      faces: [],
      materials: {},
    };

    let currentMaterial = 'default';
    let currentFaces: Array<[number, number, number]> = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const parts = trimmed.split(/\s+/);
      const command = parts[0];

      switch (command) {
        case 'v': // Vertex
          if (parts.length >= 4) {
            objData.vertices.push(
              parseFloat(parts[1]),
              parseFloat(parts[2]),
              parseFloat(parts[3])
            );
          }
          break;

        case 'vn': // Vertex normal
          if (parts.length >= 4) {
            objData.normals.push(
              parseFloat(parts[1]),
              parseFloat(parts[2]),
              parseFloat(parts[3])
            );
          }
          break;

        case 'vt': // Texture coordinate
          if (parts.length >= 3) {
            objData.texCoords.push(parseFloat(parts[1]), parseFloat(parts[2]));
          }
          break;

        case 'f': // Face
          this.parseFace(parts.slice(1), currentFaces);
          break;

        case 'usemtl': // Use material
          if (currentFaces.length > 0) {
            objData.faces.push(currentFaces);
            currentFaces = [];
          }
          currentMaterial = parts[1] || 'default';
          break;

        case 'mtllib': // Material library (ignored for now)
          break;
      }
    }

    // Add remaining faces
    if (currentFaces.length > 0) {
      objData.faces.push(currentFaces);
    }

    // Convert to indexed geometry
    return this.toIndexedGeometry(objData);
  }

  /**
   * Parse face definition (supports triangles and quads)
   */
  private parseFace(
    parts: string[],
    faces: Array<[number, number, number]>
  ): void {
    const vertices: Array<[number, number, number]> = [];

    for (const part of parts) {
      const indices = part.split('/');
      const vertexIndex = parseInt(indices[0]) - 1; // OBJ uses 1-based indexing
      const texIndex = indices[1] ? parseInt(indices[1]) - 1 : 0;
      const normalIndex = indices[2] ? parseInt(indices[2]) - 1 : 0;

      vertices.push([vertexIndex, texIndex, normalIndex]);
    }

    // Triangulate face (support quads by splitting)
    for (let i = 1; i < vertices.length - 1; i++) {
      faces.push(vertices[0]);
      faces.push(vertices[i]);
      faces.push(vertices[i + 1]);
    }
  }

  /**
   * Convert OBJ data to indexed geometry format
   */
  private toIndexedGeometry(objData: OBJData): ModelGeometry {
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();

    let vertexIndex = 0;

    for (const face of objData.faces) {
      for (const [vi, ti, ni] of face) {
        const key = `${vi}/${ti}/${ni}`;

        if (!vertexMap.has(key)) {
          // Add new vertex
          const vIdx = vi * 3;
          if (vIdx < objData.vertices.length) {
            vertices.push(
              objData.vertices[vIdx],
              objData.vertices[vIdx + 1],
              objData.vertices[vIdx + 2]
            );
          }

          // Add normal
          if (ni >= 0 && ni * 3 < objData.normals.length) {
            normals.push(
              objData.normals[ni * 3],
              objData.normals[ni * 3 + 1],
              objData.normals[ni * 3 + 2]
            );
          } else {
            normals.push(0, 0, 1); // Default normal
          }

          vertexMap.set(key, vertexIndex);
          indices.push(vertexIndex);
          vertexIndex++;
        } else {
          indices.push(vertexMap.get(key)!);
        }
      }
    }

    // Ensure we have normals for all vertices
    if (normals.length === 0) {
      normals.length = vertices.length;
      normals.fill(0);

      // Calculate normals from faces
      const calculatedNormals = this.calculateNormals(
        new Float32Array(vertices),
        new Uint32Array(indices)
      );
      for (let i = 0; i < calculatedNormals.length; i++) {
        normals[i] = calculatedNormals[i];
      }
    }

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      bounds: this.calculateBounds(new Float32Array(vertices)),
    };
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
    if (vertices.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        width: 0,
        height: 0,
        depth: 0,
      } as any;
    }

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
