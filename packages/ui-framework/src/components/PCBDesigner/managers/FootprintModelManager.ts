/**
 * Footprint Model Manager
 * Phase 16: 3D Component Models
 *
 * Manages associations between footprints and 3D models.
 * Handles model assignment, transformation, and library management.
 */

import { Model3D, FootprintWithModel, ModelLibraryStats } from '../types3d';
import { Footprint } from '../types';
import { ModelCache } from '../storage/ModelCache';
import { STLLoader } from '../loaders/STLLoader';
import { OBJLoader } from '../loaders/OBJLoader';

interface FootprintModelAssociation {
  footprintId: string;
  modelId: string;
  modelOffset?: { x: number; y: number; z: number };
  modelRotation?: { x: number; y: number; z: number };
  modelScale?: number;
}

/**
 * Manages 3D model associations with PCB footprints
 */
export class FootprintModelManager {
  private associations: Map<string, FootprintModelAssociation> = new Map();
  private modelCache: Map<string, Model3D> = new Map();

  constructor() {
    this.loadAssociations();
  }

  /**
   * Load associations from localStorage
   */
  private loadAssociations(): void {
    try {
      const stored = localStorage.getItem('footprint_model_associations');
      if (stored) {
        const data: FootprintModelAssociation[] = JSON.parse(stored);
        data.forEach((assoc) => {
          this.associations.set(assoc.footprintId, assoc);
        });
      }
    } catch (error) {
      console.error('Failed to load footprint model associations:', error);
    }
  }

  /**
   * Save associations to localStorage
   */
  private saveAssociations(): void {
    try {
      const data = Array.from(this.associations.values());
      localStorage.setItem(
        'footprint_model_associations',
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Failed to save footprint model associations:', error);
    }
  }

  /**
   * Assign a model to a footprint from file
   */
  async assignModelFromFile(
    footprint: Footprint,
    file: File
  ): Promise<FootprintWithModel> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await this.parseModelFile(arrayBuffer, file.name);

      // Store in cache
      await ModelCache.store(result.model);
      this.modelCache.set(result.model.id, result.model);

      // Create association
      this.associations.set(footprint.id, {
        footprintId: footprint.id,
        modelId: result.model.id,
        modelOffset: { x: 0, y: 0, z: 0 },
        modelRotation: { x: 0, y: 0, z: 0 },
        modelScale: 1.0,
      });

      this.saveAssociations();

      return {
        ...footprint,
        model3d: result.model,
        modelOffset: { x: 0, y: 0, z: 0 },
        modelRotation: { x: 0, y: 0, z: 0 },
        modelScale: 1.0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to assign model';
      throw new Error(`Failed to assign model to footprint: ${errorMessage}`);
    }
  }

  /**
   * Assign a model to a footprint from cache
   */
  async assignModelFromCache(
    footprint: Footprint,
    modelId: string
  ): Promise<FootprintWithModel> {
    const model = await ModelCache.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found in cache`);
    }

    this.modelCache.set(modelId, model);

    // Create association
    this.associations.set(footprint.id, {
      footprintId: footprint.id,
      modelId: modelId,
      modelOffset: { x: 0, y: 0, z: 0 },
      modelRotation: { x: 0, y: 0, z: 0 },
      modelScale: 1.0,
    });

    this.saveAssociations();

    return {
      ...footprint,
      model3d: model,
      modelOffset: { x: 0, y: 0, z: 0 },
      modelRotation: { x: 0, y: 0, z: 0 },
      modelScale: 1.0,
    };
  }

  /**
   * Get model for a footprint
   */
  async getModelForFootprint(footprintId: string): Promise<Model3D | null> {
    const assoc = this.associations.get(footprintId);
    if (!assoc) {
      return null;
    }

    if (this.modelCache.has(assoc.modelId)) {
      return this.modelCache.get(assoc.modelId) || null;
    }

    const model = await ModelCache.get(assoc.modelId);
    if (model) {
      this.modelCache.set(assoc.modelId, model);
    }
    return model;
  }

  /**
   * Get footprint with its model
   */
  async getFootprintWithModel(footprint: Footprint): Promise<FootprintWithModel> {
    const model = await this.getModelForFootprint(footprint.id);
    const assoc = this.associations.get(footprint.id);

    if (!model) {
      return footprint as FootprintWithModel;
    }

    return {
      ...footprint,
      model3d: model,
      modelOffset: assoc?.modelOffset ?? { x: 0, y: 0, z: 0 },
      modelRotation: assoc?.modelRotation ?? { x: 0, y: 0, z: 0 },
      modelScale: assoc?.modelScale ?? 1.0,
    };
  }

  /**
   * Remove model from footprint
   */
  async removeModelFromFootprint(footprintId: string): Promise<void> {
    this.associations.delete(footprintId);
    this.saveAssociations();
  }

  /**
   * Update model transformation
   */
  updateModelTransformation(
    footprintId: string,
    transformation: {
      offset?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: number;
    }
  ): void {
    const assoc = this.associations.get(footprintId);
    if (!assoc) {
      return;
    }

    if (transformation.offset) {
      assoc.modelOffset = transformation.offset;
    }
    if (transformation.rotation) {
      assoc.modelRotation = transformation.rotation;
    }
    if (transformation.scale) {
      assoc.modelScale = transformation.scale;
    }

    this.saveAssociations();
  }

  /**
   * Get all model associations
   */
  getAllAssociations(): FootprintModelAssociation[] {
    return Array.from(this.associations.values());
  }

  /**
   * Get footprints with models
   */
  async getFootprintsWithModels(
    footprints: Footprint[]
  ): Promise<FootprintWithModel[]> {
    const results: FootprintWithModel[] = [];

    for (const footprint of footprints) {
      const withModel = await this.getFootprintWithModel(footprint);
      results.push(withModel);
    }

    return results;
  }

  /**
   * Parse model file (detects format)
   */
  private async parseModelFile(
    arrayBuffer: ArrayBuffer,
    filename: string
  ): Promise<{ model: Model3D }> {
    if (filename.toLowerCase().endsWith('.stl')) {
      const loader = new STLLoader();
      const result = await loader.parse(arrayBuffer, filename);
      return { model: result.model };
    } else if (filename.toLowerCase().endsWith('.obj')) {
      const loader = new OBJLoader();
      const result = await loader.parse(arrayBuffer, filename);
      return { model: result.model };
    } else {
      throw new Error('Unsupported file format');
    }
  }

  /**
   * Get all available models in cache
   */
  async getAvailableModels(): Promise<Model3D[]> {
    return ModelCache.getAll();
  }

  /**
   * Get library statistics
   */
  async getLibraryStats(): Promise<ModelLibraryStats> {
    return ModelCache.getStats();
  }

  /**
   * Search for models
   */
  async searchModels(query: string): Promise<Model3D[]> {
    return ModelCache.search(query);
  }

  /**
   * Clear all associations
   */
  async clearAllAssociations(): Promise<void> {
    this.associations.clear();
    this.saveAssociations();
  }

  /**
   * Export associations as JSON
   */
  exportAssociationsJSON(): string {
    const data = Array.from(this.associations.values());
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import associations from JSON
   */
  importAssociationsJSON(json: string): number {
    try {
      const data = JSON.parse(json) as FootprintModelAssociation[];
      let count = 0;

      for (const assoc of data) {
        this.associations.set(assoc.footprintId, assoc);
        count++;
      }

      this.saveAssociations();
      return count;
    } catch (error) {
      console.error('Failed to import associations:', error);
      return 0;
    }
  }

  /**
   * Check if footprint has a model
   */
  hasModel(footprintId: string): boolean {
    return this.associations.has(footprintId);
  }

  /**
   * Get count of footprints with models
   */
  getModelCount(): number {
    return this.associations.size;
  }

  /**
   * Get association for a footprint
   */
  getAssociation(
    footprintId: string
  ): FootprintModelAssociation | undefined {
    return this.associations.get(footprintId);
  }

  /**
   * Delete model from library (removes all associations)
   */
  async deleteModel(modelId: string): Promise<void> {
    // Remove from cache
    await ModelCache.delete(modelId);
    this.modelCache.delete(modelId);

    // Remove associations
    const idsToDelete: string[] = [];
    for (const [footprintId, assoc] of this.associations) {
      if (assoc.modelId === modelId) {
        idsToDelete.push(footprintId);
      }
    }

    idsToDelete.forEach((id) => this.associations.delete(id));
    this.saveAssociations();
  }

  /**
   * Batch import models with associations
   */
  async batchImportModels(
    files: File[],
    footprints: Footprint[]
  ): Promise<Map<string, Model3D>> {
    const modelMap = new Map<string, Model3D>();
    const footprintMap = new Map(footprints.map((f) => [f.name, f]));

    for (const file of files) {
      const footprint = footprintMap.get(this.extractFootprintName(file.name));
      if (footprint) {
        try {
          const result = await this.assignModelFromFile(footprint, file);
          if (result.model3d) {
            modelMap.set(footprint.id, result.model3d);
          }
        } catch (error) {
          console.error(`Failed to import model for ${footprint.name}:`, error);
        }
      }
    }

    return modelMap;
  }

  /**
   * Extract footprint name from model filename
   * Assumes format like "R0603_model.stl" -> "R0603"
   */
  private extractFootprintName(filename: string): string {
    const name = filename.split('_')[0];
    return name.split('.')[0];
  }
}

// Global instance
let managerInstance: FootprintModelManager | null = null;

/**
 * Get or create the global FootprintModelManager instance
 */
export function getFootprintModelManager(): FootprintModelManager {
  if (!managerInstance) {
    managerInstance = new FootprintModelManager();
  }
  return managerInstance;
}
