/**
 * Level-of-Detail (LOD) Controller
 * Phase 16: 3D Component Models
 *
 * Manages adaptive geometry simplification for performance optimization.
 * Reduces triangle count for distant objects.
 */

import { ModelGeometry, LODConfig } from '../types3d';

/**
 * Simplified geometry for LOD
 */
interface SimplifiedGeometry {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
}

/**
 * LOD level information
 */
interface LODLevel {
  distance: number;
  simplification: number;
  geometry?: SimplifiedGeometry;
}

/**
 * Manages Level-of-Detail rendering
 */
export class LODController {
  private config: LODConfig;
  private levelCache: Map<string, SimplifiedGeometry[]> = new Map();

  constructor(config: LODConfig) {
    this.config = config;
  }

  /**
   * Update LOD configuration
   */
  setConfig(config: LODConfig): void {
    this.config = config;
    this.levelCache.clear(); // Clear cache on config change
  }

  /**
   * Get current LOD level based on camera distance
   */
  getLODLevel(distance: number): number {
    if (distance < this.config.highDetailDistance) {
      return 0; // Full detail
    } else if (distance < this.config.mediumDetailDistance) {
      return 1; // Medium detail
    } else if (distance < this.config.lowDetailDistance) {
      return 2; // Low detail
    } else {
      return 3; // Minimal detail
    }
  }

  /**
   * Create multiple LOD levels from original geometry
   */
  createLODLevels(
    geometry: ModelGeometry,
    modelId: string
  ): SimplifiedGeometry[] {
    // Check cache first
    if (this.levelCache.has(modelId)) {
      return this.levelCache.get(modelId)!;
    }

    const levels: SimplifiedGeometry[] = [];

    // Level 0: Full detail (original)
    levels.push({
      vertices: geometry.vertices,
      normals: geometry.normals,
      indices: geometry.indices,
      triangleCount: geometry.indices.length / 3,
    });

    // Level 1: Medium detail
    const mediumGeometry = this.simplifyGeometry(
      geometry,
      this.config.mediumSimplification
    );
    levels.push(mediumGeometry);

    // Level 2: Low detail
    const lowGeometry = this.simplifyGeometry(
      geometry,
      this.config.lowSimplification
    );
    levels.push(lowGeometry);

    // Level 3: Minimal (bounding box)
    const minimalGeometry = this.createBoundingBoxGeometry(geometry);
    levels.push(minimalGeometry);

    // Cache the levels
    this.levelCache.set(modelId, levels);

    return levels;
  }

  /**
   * Simplify geometry by removing vertices
   */
  private simplifyGeometry(
    geometry: ModelGeometry,
    simplificationRatio: number
  ): SimplifiedGeometry {
    if (simplificationRatio >= 1.0) {
      return {
        vertices: geometry.vertices,
        normals: geometry.normals,
        indices: geometry.indices,
        triangleCount: geometry.indices.length / 3,
      };
    }

    const targetVertexCount = Math.max(
      1,
      Math.floor(geometry.vertices.length * simplificationRatio)
    );

    // Quadric error metric simplification (simplified version)
    // For performance, we'll use a simpler approach: remove vertices evenly
    const vertices = geometry.vertices;
    const normals = geometry.normals;
    const indices = geometry.indices;

    const vertexStep = Math.ceil(
      vertices.length / (targetVertexCount * 3)
    );

    const newVertices: number[] = [];
    const newNormals: number[] = [];
    const vertexMap = new Map<number, number>();

    let newIndex = 0;
    for (let i = 0; i < vertices.length; i += vertexStep * 3) {
      vertexMap.set(i / 3, newIndex);
      newVertices.push(vertices[i], vertices[i + 1], vertices[i + 2]);
      if (normals.length > i + 2) {
        newNormals.push(normals[i], normals[i + 1], normals[i + 2]);
      }
      newIndex++;
    }

    // Remap indices
    const newIndices: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const v1 = Math.floor(indices[i] / vertexStep);
      const v2 = Math.floor(indices[i + 1] / vertexStep);
      const v3 = Math.floor(indices[i + 2] / vertexStep);

      // Only add valid triangles (distinct vertices)
      if (v1 !== v2 && v2 !== v3 && v1 !== v3) {
        newIndices.push(
          vertexMap.get(v1) ?? v1,
          vertexMap.get(v2) ?? v2,
          vertexMap.get(v3) ?? v3
        );
      }
    }

    // Ensure we have normals for all vertices
    if (newNormals.length === 0) {
      newNormals.length = newVertices.length;
      newNormals.fill(0);
    }

    return {
      vertices: new Float32Array(newVertices),
      normals: new Float32Array(newNormals),
      indices: new Uint32Array(newIndices),
      triangleCount: newIndices.length / 3,
    };
  }

  /**
   * Create minimal bounding box geometry
   */
  private createBoundingBoxGeometry(
    geometry: ModelGeometry
  ): SimplifiedGeometry {
    // Find bounds
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    const vertices = geometry.vertices;
    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i]);
      maxX = Math.max(maxX, vertices[i]);
      minY = Math.min(minY, vertices[i + 1]);
      maxY = Math.max(maxY, vertices[i + 1]);
      minZ = Math.min(minZ, vertices[i + 2]);
      maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    // Create box vertices (8 corners)
    const boxVertices = new Float32Array([
      minX, minY, minZ, // 0
      maxX, minY, minZ, // 1
      maxX, maxY, minZ, // 2
      minX, maxY, minZ, // 3
      minX, minY, maxZ, // 4
      maxX, minY, maxZ, // 5
      maxX, maxY, maxZ, // 6
      minX, maxY, maxZ, // 7
    ]);

    // Create normals pointing outward
    const boxNormals = new Float32Array([
      0, 0, -1, // front face
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, 1, // back face
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);

    // Create box indices (12 triangles, 2 per face)
    const boxIndices = new Uint32Array([
      // Front
      0, 1, 2, 0, 2, 3,
      // Back
      5, 4, 7, 5, 7, 6,
      // Top
      3, 2, 6, 3, 6, 7,
      // Bottom
      4, 5, 1, 4, 1, 0,
      // Right
      1, 5, 6, 1, 6, 2,
      // Left
      4, 0, 3, 4, 3, 7,
    ]);

    return {
      vertices: boxVertices,
      normals: boxNormals,
      indices: boxIndices,
      triangleCount: 12,
    };
  }

  /**
   * Calculate optimal camera distance based on model bounds
   */
  calculateOptimalDistance(bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  }): number {
    const dx = bounds.max.x - bounds.min.x;
    const dy = bounds.max.y - bounds.min.y;
    const dz = bounds.max.z - bounds.min.z;

    const maxDim = Math.max(dx, dy, dz);
    const distance = maxDim / Math.tan(Math.PI / 8); // Assume ~22.5° FOV

    return distance;
  }

  /**
   * Get memory usage estimate for all LOD levels
   */
  getMemoryUsage(originalTriangleCount: number): {
    level0: number;
    level1: number;
    level2: number;
    level3: number;
    total: number;
  } {
    const bytesPerTriangle = 36; // 3 vertices × 3 floats × 4 bytes

    return {
      level0: originalTriangleCount * bytesPerTriangle,
      level1: Math.round(
        originalTriangleCount *
          this.config.mediumSimplification *
          bytesPerTriangle
      ),
      level2: Math.round(
        originalTriangleCount *
          this.config.lowSimplification *
          bytesPerTriangle
      ),
      level3: 12 * bytesPerTriangle, // Bounding box
      total:
        (originalTriangleCount +
          Math.round(
            originalTriangleCount * this.config.mediumSimplification
          ) +
          Math.round(originalTriangleCount * this.config.lowSimplification) +
          12) *
        bytesPerTriangle,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.levelCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedModels: number;
    totalMemoryUsage: number;
  } {
    let totalMemory = 0;

    for (const levels of this.levelCache.values()) {
      for (const level of levels) {
        totalMemory +=
          level.vertices.byteLength +
          level.normals.byteLength +
          level.indices.byteLength;
      }
    }

    return {
      cachedModels: this.levelCache.size,
      totalMemoryUsage: totalMemory,
    };
  }

  /**
   * Get LOD level description
   */
  getLODLevelDescription(level: number): string {
    switch (level) {
      case 0:
        return 'Full Detail (< 10mm)';
      case 1:
        return 'Medium Detail (10-50mm)';
      case 2:
        return 'Low Detail (50-100mm)';
      case 3:
        return 'Minimal (> 100mm)';
      default:
        return 'Unknown';
    }
  }
}

/**
 * Create default LOD controller
 */
export function createDefaultLODController(): LODController {
  return new LODController({
    highDetailDistance: 10,
    mediumDetailDistance: 50,
    lowDetailDistance: 100,
    mediumSimplification: 0.5,
    lowSimplification: 0.2,
  });
}
