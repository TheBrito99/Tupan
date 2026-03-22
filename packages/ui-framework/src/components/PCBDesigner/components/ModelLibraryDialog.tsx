/**
 * Model Library Dialog Component
 * Phase 16: 3D Component Models
 *
 * Provides UI for managing uploaded 3D models and assigning them to footprints.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Model3D, ModelLibraryStats } from '../types3d';
import { ModelCache } from '../storage/ModelCache';
import { getFootprintModelManager } from '../managers/FootprintModelManager';
import { Footprint } from '../types';
import styles from './ModelLibraryDialog.module.css';

interface ModelLibraryDialogProps {
  /** Show dialog */
  isOpen: boolean;

  /** Callback to close dialog */
  onClose: () => void;

  /** Callback when model is selected for footprint */
  onAssignModel?: (modelId: string, footprintId?: string) => void;

  /** Optional footprint to assign model to */
  targetFootprint?: Footprint;

  /** Available footprints for assignment */
  footprints?: Footprint[];
}

/**
 * Dialog for managing 3D model library
 */
export function ModelLibraryDialog({
  isOpen,
  onClose,
  onAssignModel,
  targetFootprint,
  footprints,
}: ModelLibraryDialogProps) {
  const [models, setModels] = useState<Model3D[]>([]);
  const [stats, setStats] = useState<ModelLibraryStats | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormat, setFilterFormat] = useState<'stl' | 'obj' | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelManager = useMemo(() => getFootprintModelManager(), []);

  // Load models on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const allModels = await ModelCache.getAll();
        const allStats = await ModelCache.getStats();

        setModels(allModels);
        setStats(allStats);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load models';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, [isOpen]);

  // Filter models
  const filteredModels = useMemo(() => {
    let result = models;

    // Filter by format
    if (filterFormat !== 'all') {
      result = result.filter((m) => m.format === filterFormat);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [models, searchQuery, filterFormat]);

  // Delete model
  const handleDeleteModel = useCallback(
    async (modelId: string) => {
      if (!window.confirm('Are you sure you want to delete this model?')) {
        return;
      }

      try {
        await modelManager.deleteModel(modelId);
        setModels((prev) => prev.filter((m) => m.id !== modelId));
        setSelectedModelId(null);

        // Reload stats
        const newStats = await ModelCache.getStats();
        setStats(newStats);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to delete model';
        setError(errorMessage);
      }
    },
    [modelManager]
  );

  // Assign model to footprint
  const handleAssignModel = useCallback(async () => {
    if (!selectedModelId) return;

    try {
      onAssignModel?.(selectedModelId, targetFootprint?.id);
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to assign model';
      setError(errorMessage);
    }
  }, [selectedModelId, targetFootprint, onAssignModel, onClose]);

  // Clear cache
  const handleClearCache = useCallback(async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete all models? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      await ModelCache.clear();
      setModels([]);
      setSelectedModelId(null);
      setStats(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to clear cache';
      setError(errorMessage);
    }
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2>3D Model Library</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Search and Filter Bar */}
          <div className={styles.toolbar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className={styles.filterSelect}
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value as any)}
            >
              <option value="all">All Formats</option>
              <option value="stl">STL Only</option>
              <option value="obj">OBJ Only</option>
            </select>

            <button
              className={styles.clearButton}
              onClick={handleClearCache}
              title="Clear entire cache"
            >
              Clear All
            </button>
          </div>

          {/* Statistics */}
          {stats && (
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Models:</span>
                <span className={styles.statValue}>{stats.totalModels}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Storage:</span>
                <span className={styles.statValue}>
                  {(stats.totalStorage / 1024 / 1024).toFixed(1)}MB
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Triangles:</span>
                <span className={styles.statValue}>
                  {stats.totalTriangles.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Models List */}
          {isLoading ? (
            <div className={styles.loadingState}>Loading models...</div>
          ) : error ? (
            <div className={styles.errorState}>{error}</div>
          ) : filteredModels.length === 0 ? (
            <div className={styles.emptyState}>
              {models.length === 0
                ? 'No models uploaded yet'
                : 'No models match your search'}
            </div>
          ) : (
            <div className={styles.modelsList}>
              {filteredModels.map((model) => (
                <div
                  key={model.id}
                  className={`${styles.modelItem} ${
                    selectedModelId === model.id ? styles.selected : ''
                  }`}
                  onClick={() => setSelectedModelId(model.id)}
                >
                  {/* Preview Thumbnail */}
                  {model.preview && (
                    <div className={styles.preview}>
                      <img
                        src={model.preview}
                        alt={model.name}
                        className={styles.previewImage}
                      />
                    </div>
                  )}

                  {/* Model Info */}
                  <div className={styles.modelInfo}>
                    <div className={styles.modelName}>{model.name}</div>
                    <div className={styles.modelDetails}>
                      <span className={styles.badge}>{model.format.toUpperCase()}</span>
                      <span className={styles.detail}>
                        {model.vertices.toLocaleString()} vertices
                      </span>
                      <span className={styles.detail}>
                        {model.triangles.toLocaleString()} triangles
                      </span>
                      <span className={styles.detail}>
                        {(model.fileSize / 1024).toFixed(1)}KB
                      </span>
                    </div>
                    <div className={styles.modelDimensions}>
                      <span>
                        {model.bounds.width.toFixed(1)} × {model.bounds.height.toFixed(1)} × {model.bounds.depth.toFixed(1)} mm
                      </span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteModel(model.id);
                    }}
                    title="Delete model"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerText}>
            {selectedModelId
              ? 'Select a model and click Assign to use it'
              : 'Select a model from the list'}
          </div>

          <div className={styles.buttonGroup}>
            {targetFootprint && (
              <button
                className={styles.assignButton}
                onClick={handleAssignModel}
                disabled={!selectedModelId}
              >
                Assign to {targetFootprint.name}
              </button>
            )}

            <button className={styles.cancelButton} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelLibraryDialog;
