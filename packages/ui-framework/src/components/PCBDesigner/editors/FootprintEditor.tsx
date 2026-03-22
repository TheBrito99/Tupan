/**
 * Footprint Editor - Edit footprint properties
 * Phase 16: 3D Component Models
 *
 * Features:
 * - Edit footprint properties (name, reference, value)
 * - Manage pads and their properties
 * - Upload and assign 3D models
 * - Preview 3D model with transformations (offset, rotation, scale)
 * - Thermal properties
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Footprint } from '../types';
import { Model3D, FootprintWithModel } from '../types3d';
import { getFootprintModelManager } from '../managers/FootprintModelManager';
import { ModelUploadDialog } from '../components/ModelUploadDialog';
import styles from './FootprintEditor.module.css';

interface FootprintEditorProps {
  /** Footprint to edit */
  footprint?: Footprint;

  /** Callback when footprint changes */
  onChange?: (footprint: Footprint) => void;

  /** Callback to save footprint */
  onSave?: (footprint: Footprint) => void;

  /** Is read-only */
  readOnly?: boolean;
}

type TabType = 'general' | 'pads' | '3d-model' | 'thermal';

/**
 * Footprint Editor Component
 *
 * Tabbed interface for editing footprint properties
 */
export const FootprintEditor: React.FC<FootprintEditorProps> = ({
  footprint,
  onChange,
  onSave,
  readOnly = false,
}) => {
  const [selectedTab, setSelectedTab] = useState<TabType>('general');
  const [modelUploadOpen, setModelUploadOpen] = useState(false);
  const [model3d, setModel3d] = useState<Model3D | undefined>(footprint?.model3d);
  const [modelOffset, setModelOffset] = useState({
    x: footprint?.modelOffset?.x ?? 0,
    y: footprint?.modelOffset?.y ?? 0,
    z: footprint?.modelOffset?.z ?? 0,
  });
  const [modelRotation, setModelRotation] = useState({
    x: footprint?.modelRotation?.x ?? 0,
    y: footprint?.modelRotation?.y ?? 0,
    z: footprint?.modelRotation?.z ?? 0,
  });
  const [modelScale, setModelScale] = useState(footprint?.modelScale ?? 1.0);

  const modelManager = useMemo(() => getFootprintModelManager(), []);

  if (!footprint) {
    return <div className={styles.empty}>No footprint selected</div>;
  }

  // Handle model upload
  const handleModelUpload = useCallback(
    async (file: File) => {
      try {
        const loader = file.name.endsWith('.stl') ? new STLLoader() : new OBJLoader();
        const buffer = await file.arrayBuffer();
        const geometry = await loader.parse(buffer);

        const modelData: Model3D = {
          id: `${footprint.id}_model_${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          format: file.name.endsWith('.stl') ? 'stl' : 'obj',
          fileSize: file.size,
          vertices: geometry.vertices.length / 3,
          triangles: geometry.indices.length / 3,
          bounds: geometry.bounds,
          data: buffer,
        };

        setModel3d(modelData);
        setModelUploadOpen(false);

        // Notify parent of change
        const updatedFootprint: Footprint = {
          ...footprint,
          model3d: modelData,
          modelOffset,
          modelRotation,
          modelScale,
        };
        onChange?.(updatedFootprint);
      } catch (err) {
        console.error('Failed to load model:', err);
      }
    },
    [footprint, modelOffset, modelRotation, modelScale, onChange]
  );

  // Handle model removal
  const handleRemoveModel = useCallback(() => {
    setModel3d(undefined);
    const updatedFootprint: Footprint = {
      ...footprint,
      model3d: undefined,
    };
    onChange?.(updatedFootprint);
  }, [footprint, onChange]);

  // Handle offset changes
  const handleOffsetChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: number) => {
      const newOffset = { ...modelOffset, [axis]: value };
      setModelOffset(newOffset);
      const updatedFootprint: Footprint = {
        ...footprint,
        modelOffset: newOffset,
      };
      onChange?.(updatedFootprint);
    },
    [footprint, modelOffset, onChange]
  );

  // Handle rotation changes
  const handleRotationChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: number) => {
      const newRotation = { ...modelRotation, [axis]: value };
      setModelRotation(newRotation);
      const updatedFootprint: Footprint = {
        ...footprint,
        modelRotation: newRotation,
      };
      onChange?.(updatedFootprint);
    },
    [footprint, modelRotation, onChange]
  );

  // Handle scale changes
  const handleScaleChange = useCallback(
    (value: number) => {
      setModelScale(value);
      const updatedFootprint: Footprint = {
        ...footprint,
        modelScale: value,
      };
      onChange?.(updatedFootprint);
    },
    [footprint, onChange]
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>{footprint.name}</h2>
          <p className={styles.subtitle}>{footprint.description}</p>
        </div>
        {!readOnly && (
          <button
            className={styles.saveButton}
            onClick={() => onSave?.(footprint)}
            title="Save footprint changes"
          >
            💾 Save
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${selectedTab === 'general' ? styles.active : ''}`}
          onClick={() => setSelectedTab('general')}
        >
          General
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'pads' ? styles.active : ''}`}
          onClick={() => setSelectedTab('pads')}
        >
          Pads
        </button>
        <button
          className={`${styles.tab} ${selectedTab === '3d-model' ? styles.active : ''}`}
          onClick={() => setSelectedTab('3d-model')}
        >
          3D Model
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'thermal' ? styles.active : ''}`}
          onClick={() => setSelectedTab('thermal')}
        >
          Thermal
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {/* General Tab */}
        {selectedTab === 'general' && (
          <div className={styles.tabContent}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Properties</h3>
              <div className={styles.formGroup}>
                <label>Name</label>
                <input
                  type="text"
                  value={footprint.name}
                  readOnly={readOnly}
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Reference Designator</label>
                <input
                  type="text"
                  value={footprint.refdes || ''}
                  readOnly={readOnly}
                  className={styles.input}
                  placeholder="e.g., R0603"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea
                  value={footprint.description}
                  readOnly={readOnly}
                  className={styles.textarea}
                  rows={3}
                />
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Dimensions</h3>
              <div className={styles.gridRow}>
                <div className={styles.formGroup}>
                  <label>Width (mm)</label>
                  <input
                    type="number"
                    value={footprint.width}
                    readOnly={readOnly}
                    className={styles.input}
                    step="0.01"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Height (mm)</label>
                  <input
                    type="number"
                    value={footprint.height}
                    readOnly={readOnly}
                    className={styles.input}
                    step="0.01"
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Pad Count</label>
                <input
                  type="number"
                  value={footprint.pads?.length ?? 0}
                  readOnly
                  className={styles.input}
                />
              </div>
            </section>
          </div>
        )}

        {/* Pads Tab */}
        {selectedTab === 'pads' && (
          <div className={styles.tabContent}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Pads ({footprint.pads?.length ?? 0})</h3>
              {footprint.pads && footprint.pads.length > 0 ? (
                <div className={styles.padsList}>
                  {footprint.pads.map((pad, idx) => (
                    <div key={idx} className={styles.padItem}>
                      <div className={styles.padName}>Pad {idx + 1}</div>
                      <div className={styles.padDetails}>
                        <span>
                          Position: ({pad.x.toFixed(2)}, {pad.y.toFixed(2)}) mm
                        </span>
                        <span>Size: {pad.width.toFixed(2)} × {pad.height.toFixed(2)} mm</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyMessage}>No pads defined</p>
              )}
            </section>
          </div>
        )}

        {/* 3D Model Tab */}
        {selectedTab === '3d-model' && (
          <div className={styles.tabContent}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>3D Model</h3>

              {model3d ? (
                <div className={styles.modelInfo}>
                  <div className={styles.modelHeader}>
                    <div>
                      <h4>{model3d.name}</h4>
                      <p className={styles.modelFormat}>{model3d.format.toUpperCase()}</p>
                    </div>
                    {!readOnly && (
                      <button
                        className={styles.removeButton}
                        onClick={handleRemoveModel}
                        title="Remove 3D model"
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  <div className={styles.modelStats}>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Triangles:</span>
                      <span className={styles.statValue}>
                        {model3d.triangles.toLocaleString()}
                      </span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Vertices:</span>
                      <span className={styles.statValue}>
                        {model3d.vertices.toLocaleString()}
                      </span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>File Size:</span>
                      <span className={styles.statValue}>
                        {(model3d.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>

                  <div className={styles.modelDimensions}>
                    <h5>Dimensions</h5>
                    <p>
                      {model3d.bounds.width.toFixed(1)} × {model3d.bounds.height.toFixed(1)} ×{' '}
                      {model3d.bounds.depth.toFixed(1)} mm
                    </p>
                  </div>

                  {!readOnly && (
                    <>
                      <div className={styles.transformSection}>
                        <h5>Position Offset</h5>
                        <div className={styles.transformGroup}>
                          <div className={styles.formGroup}>
                            <label>X (mm)</label>
                            <input
                              type="number"
                              value={modelOffset.x}
                              onChange={e =>
                                handleOffsetChange('x', parseFloat(e.target.value))
                              }
                              className={styles.input}
                              step="0.1"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Y (mm)</label>
                            <input
                              type="number"
                              value={modelOffset.y}
                              onChange={e =>
                                handleOffsetChange('y', parseFloat(e.target.value))
                              }
                              className={styles.input}
                              step="0.1"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Z (mm)</label>
                            <input
                              type="number"
                              value={modelOffset.z}
                              onChange={e =>
                                handleOffsetChange('z', parseFloat(e.target.value))
                              }
                              className={styles.input}
                              step="0.1"
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.transformSection}>
                        <h5>Rotation</h5>
                        <div className={styles.transformGroup}>
                          <div className={styles.formGroup}>
                            <label>X (°)</label>
                            <input
                              type="number"
                              value={modelRotation.x}
                              onChange={e =>
                                handleRotationChange('x', parseFloat(e.target.value))
                              }
                              className={styles.input}
                              step="1"
                              min="0"
                              max="360"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Y (°)</label>
                            <input
                              type="number"
                              value={modelRotation.y}
                              onChange={e =>
                                handleRotationChange('y', parseFloat(e.target.value))
                              }
                              className={styles.input}
                              step="1"
                              min="0"
                              max="360"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Z (°)</label>
                            <input
                              type="number"
                              value={modelRotation.z}
                              onChange={e =>
                                handleRotationChange('z', parseFloat(e.target.value))
                              }
                              className={styles.input}
                              step="1"
                              min="0"
                              max="360"
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.transformSection}>
                        <h5>Scale</h5>
                        <div className={styles.formGroup}>
                          <label>Scale Factor</label>
                          <input
                            type="number"
                            value={modelScale}
                            onChange={e => handleScaleChange(parseFloat(e.target.value))}
                            className={styles.input}
                            step="0.1"
                            min="0.1"
                            max="10"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.emptyModel}>
                  <p>No 3D model assigned</p>
                  {!readOnly && (
                    <button
                      className={styles.uploadButton}
                      onClick={() => setModelUploadOpen(true)}
                    >
                      📤 Upload Model
                    </button>
                  )}
                </div>
              )}

              {model3d && !readOnly && (
                <button
                  className={styles.uploadButton}
                  onClick={() => setModelUploadOpen(true)}
                >
                  📤 Replace Model
                </button>
              )}
            </section>
          </div>
        )}

        {/* Thermal Tab */}
        {selectedTab === 'thermal' && (
          <div className={styles.tabContent}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Thermal Properties</h3>
              <div className={styles.formGroup}>
                <label>Thermal Resistance (K/W)</label>
                <input
                  type="number"
                  value={footprint.thermalResistance ?? 0}
                  readOnly={readOnly}
                  className={styles.input}
                  step="0.01"
                  placeholder="Optional"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Heat Capacity (J/K)</label>
                <input
                  type="number"
                  value={footprint.heatCapacity ?? 0}
                  readOnly={readOnly}
                  className={styles.input}
                  step="0.01"
                  placeholder="Optional"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Maximum Temperature (°C)</label>
                <input
                  type="number"
                  value={footprint.maxTemperature ?? 25}
                  readOnly={readOnly}
                  className={styles.input}
                  step="1"
                />
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Model Upload Dialog */}
      <ModelUploadDialog
        isOpen={modelUploadOpen}
        onClose={() => setModelUploadOpen(false)}
        onUpload={handleModelUpload}
      />
    </div>
  );
};

export default FootprintEditor;
