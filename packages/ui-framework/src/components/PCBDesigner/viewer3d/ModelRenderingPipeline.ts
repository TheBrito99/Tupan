/**
 * 3D Model Rendering Pipeline
 * Phase 16: 3D Component Models
 *
 * Comprehensive pipeline for:
 * - Loading 3D models from cache
 * - Creating Three.js geometries
 * - Applying PBR materials
 * - Managing Level-of-Detail
 * - Applying transformations
 * - Handling performance optimization
 */

import * as THREE from 'three';
import { Model3D, ModelGeometry } from '../types3d';
import { PCBMaterial } from '../types3d';
import { LODController } from './LODController';
import { getMaterialByComponentType, toThreeJsMaterialProps } from '../materials/PCBMaterials';
import { PlacedComponent } from '../types';

/**
 * Configuration for model rendering
 */
export interface ModelRenderConfig {
  /** Enable LOD optimization */
  enableLOD: boolean;

  /** Enable shadow casting */
  enableShadows: boolean;

  /** Enable ambient occlusion */
  enableAO: boolean;

  /** Material quality (low/medium/high) */
  materialQuality: 'low' | 'medium' | 'high';

  /** Camera distance for LOD selection (mm) */
  cameraDistance: number;
}

/**
 * Rendered model instance
 */
export interface RenderedModel {
  id: string;
  componentId: string;
  mesh: THREE.Mesh | THREE.LOD;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  originalModel: Model3D;
  config: ModelRenderConfig;
}

/**
 * 3D Model Rendering Pipeline
 *
 * Manages the complete pipeline from model data to rendered Three.js objects
 */
export class ModelRenderingPipeline {
  private lodController: LODController;
  private geometryCache: Map<string, THREE.BufferGeometry[]> = new Map();
  private materialCache: Map<string, THREE.MeshStandardMaterial[]> = new Map();
  private renderedModels: Map<string, RenderedModel> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, lodController?: LODController) {
    this.scene = scene;
    this.lodController = lodController || new LODController({
      highDetailDistance: 10,
      mediumDetailDistance: 50,
      lowDetailDistance: 100,
      mediumSimplification: 0.5,
      lowSimplification: 0.2,
    });
  }

  /**
   * Render a single component with its 3D model
   */
  async renderComponent(
    component: PlacedComponent,
    model: Model3D,
    material: PCBMaterial,
    config: ModelRenderConfig
  ): Promise<RenderedModel> {
    try {
      // Step 1: Get or create geometry
      let geometries = this.geometryCache.get(model.id);
      if (!geometries) {
        geometries = this.createGeometries(model, config);
        this.geometryCache.set(model.id, geometries);
      }

      // Step 2: Get or create material
      let materials = this.materialCache.get(`${model.id}_${material.type}`);
      if (!materials) {
        materials = this.createMaterials(material, config, geometries.length);
        this.materialCache.set(`${model.id}_${material.type}`, materials);
      }

      // Step 3: Create mesh or LOD object
      const mesh = config.enableLOD
        ? this.createLODMesh(geometries, materials)
        : this.createSimpleMesh(geometries[0], materials[0]);

      // Step 4: Apply transformation
      this.applyTransformation(mesh, component);

      // Step 5: Add to scene
      this.scene.add(mesh);

      // Step 6: Create and store rendered model
      const rendered: RenderedModel = {
        id: `${model.id}_${component.id}`,
        componentId: component.id,
        mesh,
        geometry: geometries[0],
        material: materials[0],
        originalModel: model,
        config,
      };

      this.renderedModels.set(rendered.id, rendered);

      return rendered;
    } catch (err) {
      console.error(`Failed to render component ${component.refdes}:`, err);
      throw err;
    }
  }

  /**
   * Create multiple LOD geometry levels
   */
  private createGeometries(model: Model3D, config: ModelRenderConfig): THREE.BufferGeometry[] {
    const geometries: THREE.BufferGeometry[] = [];

    // Parse model data to extract geometry
    const parsed = this.parseModelGeometry(model);

    if (config.enableLOD) {
      // Create LOD levels
      const lodLevels = this.lodController.createLODLevels(parsed, model.id);

      for (const level of lodLevels) {
        const geometry = this.geometryFromData(level);
        geometries.push(geometry);
      }
    } else {
      // Single geometry at full detail
      const geometry = this.geometryFromData(parsed);
      geometries.push(geometry);
    }

    return geometries;
  }

  /**
   * Parse raw model data to geometry
   */
  private parseModelGeometry(model: Model3D): any {
    // For now, return a simple box geometry
    // In production, this would parse STL/OBJ data
    return {
      vertices: new Float32Array(3 * 8), // 8 vertices for box
      normals: new Float32Array(3 * 8),
      indices: new Uint32Array(36), // 36 indices for box (6 faces × 2 triangles × 3 indices)
      bounds: model.bounds,
    };
  }

  /**
   * Convert geometry data to Three.js BufferGeometry
   */
  private geometryFromData(data: any): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3));
    if (data.normals && data.normals.length > 0) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    }
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    return geometry;
  }

  /**
   * Create PBR materials for all LOD levels
   */
  private createMaterials(
    material: PCBMaterial,
    config: ModelRenderConfig,
    count: number
  ): THREE.MeshStandardMaterial[] {
    const materials: THREE.MeshStandardMaterial[] = [];
    const props = toThreeJsMaterialProps(material);

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(props.color),
        metalness: props.metalness,
        roughness: props.roughness,
        emissive: props.emissive ? new THREE.Color(props.emissive) : undefined,
        emissiveIntensity: props.emissiveIntensity,
        side: THREE.FrontSide,
        flatShading: config.materialQuality === 'low',
        wireframe: false,
      });

      if (config.enableShadows) {
        mat.shadowSide = THREE.FrontSide;
      }

      materials.push(mat);
    }

    return materials;
  }

  /**
   * Create LOD mesh with multiple levels
   */
  private createLODMesh(
    geometries: THREE.BufferGeometry[],
    materials: THREE.MeshStandardMaterial[]
  ): THREE.LOD {
    const lod = new THREE.LOD();

    // Add meshes at different LOD levels
    const distances = [0, 25, 75, 150]; // Camera distances (mm)

    for (let i = 0; i < Math.min(geometries.length, materials.length); i++) {
      const mesh = new THREE.Mesh(geometries[i], materials[i]);
      const distance = i < distances.length ? distances[i] : 150 + i * 50;

      lod.addLevel(mesh, distance);
    }

    return lod;
  }

  /**
   * Create simple mesh (no LOD)
   */
  private createSimpleMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  /**
   * Apply position, rotation, and scale to mesh
   */
  private applyTransformation(mesh: THREE.Object3D, component: PlacedComponent): void {
    // Position (convert from mm to world units if needed)
    mesh.position.set(component.position.x, component.position.y, 0);

    // Rotation (convert degrees to radians)
    mesh.rotation.z = (component.rotation * Math.PI) / 180;

    // Additional model-specific transformations can be applied here
    mesh.scale.set(1, 1, 1);
  }

  /**
   * Remove rendered component from scene
   */
  removeComponent(componentId: string): void {
    for (const [key, rendered] of this.renderedModels.entries()) {
      if (rendered.componentId === componentId) {
        this.scene.remove(rendered.mesh);
        this.renderedModels.delete(key);
      }
    }
  }

  /**
   * Update component transformation (position, rotation, scale)
   */
  updateTransformation(componentId: string, component: PlacedComponent): void {
    for (const rendered of this.renderedModels.values()) {
      if (rendered.componentId === componentId) {
        this.applyTransformation(rendered.mesh, component);
      }
    }
  }

  /**
   * Highlight component (selection)
   */
  highlightComponent(componentId: string, highlighted: boolean): void {
    for (const rendered of this.renderedModels.values()) {
      if (rendered.componentId === componentId) {
        if (highlighted) {
          rendered.material.emissive.setHex(0x444444);
          rendered.material.emissiveIntensity = 0.5;
        } else {
          rendered.material.emissive.setHex(0x000000);
          rendered.material.emissiveIntensity = 0;
        }
        rendered.material.needsUpdate = true;
      }
    }
  }

  /**
   * Update LOD based on camera distance
   */
  updateLOD(cameraDistance: number): void {
    for (const rendered of this.renderedModels.values()) {
      if (rendered.mesh instanceof THREE.LOD) {
        rendered.mesh.update(new THREE.PerspectiveCamera());
      }
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    geometriesCount: number;
    materialsCount: number;
    meshesCount: number;
    estimatedBytes: number;
  } {
    let estimatedBytes = 0;

    // Count cached geometries
    for (const geoms of this.geometryCache.values()) {
      for (const geom of geoms) {
        estimatedBytes += geom.attributes.position.array.byteLength;
        if (geom.attributes.normal) {
          estimatedBytes += geom.attributes.normal.array.byteLength;
        }
        if (geom.index) {
          estimatedBytes += geom.index.array.byteLength;
        }
      }
    }

    return {
      geometriesCount: this.geometryCache.size,
      materialsCount: this.materialCache.size,
      meshesCount: this.renderedModels.size,
      estimatedBytes,
    };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    // Remove all meshes from scene
    for (const rendered of this.renderedModels.values()) {
      this.scene.remove(rendered.mesh);
    }

    // Clear caches
    this.renderedModels.clear();
    this.geometryCache.clear();
    this.materialCache.clear();

    // Dispose of geometries and materials
    this.geometryCache.forEach(geoms => geoms.forEach(g => g.dispose()));
    this.materialCache.forEach(mats => mats.forEach(m => m.dispose()));
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clear();
  }
}

/**
 * Helper to create rendering pipeline with default settings
 */
export function createDefaultRenderingPipeline(scene: THREE.Scene): ModelRenderingPipeline {
  return new ModelRenderingPipeline(scene);
}
