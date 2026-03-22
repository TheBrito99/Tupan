/**
 * PCB 3D Viewer Control Panel
 * Phase 15: 3D Visualization
 *
 * UI controls for:
 * - Layer visibility
 * - Rendering options (components, traces, vias)
 * - Material colors
 * - Camera reset
 */

import React, { useCallback } from 'react';
import { PCBBoard, PCBLayer } from './types';
import { Viewer3DState } from './PCBCanvas3D';
import styles from './PCB3DPanel.module.css';

export interface PCB3DPanelProps {
  board: PCBBoard;
  viewer3DState: Viewer3DState;
  onChange: (state: Viewer3DState) => void;
  onResetCamera?: () => void;
  onToggleComponentDetail?: () => void;
  onOpenModelLibrary?: () => void;
}

/**
 * PCB 3D Panel Component
 * Provides controls for the 3D viewer
 */
export const PCB3DPanel: React.FC<PCB3DPanelProps> = ({
  board,
  viewer3DState,
  onChange,
  onResetCamera,
  onToggleComponentDetail,
  onOpenModelLibrary,
}) => {
  // Layer visibility toggle
  const handleLayerToggle = useCallback(
    (layer: PCBLayer, visible: boolean) => {
      const newVisible = new Set(viewer3DState.layers.visible);
      if (visible) {
        newVisible.add(layer);
      } else {
        newVisible.delete(layer);
      }

      onChange({
        ...viewer3DState,
        layers: {
          ...viewer3DState.layers,
          visible: newVisible,
        },
      });
    },
    [viewer3DState, onChange]
  );

  // Rendering option toggle
  const handleRenderingToggle = useCallback(
    (key: keyof typeof viewer3DState.rendering, value: boolean) => {
      onChange({
        ...viewer3DState,
        rendering: {
          ...viewer3DState.rendering,
          [key]: value,
        },
      });
    },
    [viewer3DState, onChange]
  );

  // Material color change
  const handleMaterialChange = useCallback(
    (key: keyof typeof viewer3DState.materials, value: string) => {
      onChange({
        ...viewer3DState,
        materials: {
          ...viewer3DState.materials,
          [key]: value,
        },
      });
    },
    [viewer3DState, onChange]
  );

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <h3>3D View Settings</h3>
        <button
          className={styles.resetButton}
          onClick={onResetCamera}
          title="Reset camera to default view"
        >
          ↺ Reset
        </button>
      </div>

      {/* Content */}
      <div className={styles.panelContent}>
        {/* Camera Section */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Camera</h4>
          <div className={styles.sectionContent}>
            <p className={styles.helpText}>
              Orbit: Click + Drag | Pan: Shift + Drag | Zoom: Scroll
            </p>
            <button
              className={styles.actionButton}
              onClick={onResetCamera}
            >
              Reset View
            </button>
          </div>
        </section>

        {/* Layer Visibility Section */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Layers</h4>
          <div className={styles.sectionContent}>
            <div className={styles.layerList}>
              {board.layers.map(layer => (
                <label key={layer} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={viewer3DState.layers.visible.has(layer)}
                    onChange={e => handleLayerToggle(layer, e.target.checked)}
                  />
                  <span className={styles.labelText}>{layer}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Display Options Section */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Display</h4>
          <div className={styles.sectionContent}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={viewer3DState.rendering.showComponents}
                onChange={e =>
                  handleRenderingToggle('showComponents', e.target.checked)
                }
              />
              <span className={styles.labelText}>Components</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={viewer3DState.rendering.showTraces}
                onChange={e =>
                  handleRenderingToggle('showTraces', e.target.checked)
                }
              />
              <span className={styles.labelText}>Traces</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={viewer3DState.rendering.showVias}
                onChange={e =>
                  handleRenderingToggle('showVias', e.target.checked)
                }
              />
              <span className={styles.labelText}>Vias</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={viewer3DState.rendering.showZones}
                onChange={e =>
                  handleRenderingToggle('showZones', e.target.checked)
                }
              />
              <span className={styles.labelText}>Zones</span>
            </label>
          </div>
        </section>

        {/* Component Detail Mode Section (Phase 16) */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Component Models</h4>
          <div className={styles.sectionContent}>
            <div className={styles.detailModeControl}>
              <label className={styles.modeLabel}>
                Rendering Mode
              </label>
              <div className={styles.modeButtonGroup}>
                <button
                  className={`${styles.modeButton} ${
                    viewer3DState.rendering.componentDetail === 'box' ? styles.active : ''
                  }`}
                  onClick={onToggleComponentDetail}
                  title="Fast box geometry rendering"
                >
                  {viewer3DState.rendering.componentDetail === 'box' ? '✓ ' : ''}
                  Box View
                </button>
                <button
                  className={`${styles.modeButton} ${
                    viewer3DState.rendering.componentDetail === 'model' ? styles.active : ''
                  }`}
                  onClick={onToggleComponentDetail}
                  title="Realistic 3D component models"
                >
                  {viewer3DState.rendering.componentDetail === 'model' ? '✓ ' : ''}
                  Model View
                </button>
              </div>
            </div>

            {viewer3DState.rendering.componentDetail === 'model' && (
              <button
                className={styles.actionButton}
                onClick={onOpenModelLibrary}
                title="Manage 3D component models"
              >
                📚 Model Library
              </button>
            )}

            <p className={styles.helpText}>
              {viewer3DState.rendering.componentDetail === 'box'
                ? 'Box View: Fast, simple component geometry'
                : 'Model View: Realistic 3D component models with PBR materials'}
            </p>
          </div>
        </section>

        {/* Materials Section */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Materials</h4>
          <div className={styles.sectionContent}>
            <div className={styles.colorControl}>
              <label className={styles.colorLabel}>Solder Mask</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={viewer3DState.materials.soldermaskColor}
                  onChange={e =>
                    handleMaterialChange('soldermaskColor', e.target.value)
                  }
                />
                <span className={styles.colorValue}>
                  {viewer3DState.materials.soldermaskColor}
                </span>
              </div>
            </div>

            <div className={styles.colorControl}>
              <label className={styles.colorLabel}>Copper</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={viewer3DState.materials.copperColor}
                  onChange={e =>
                    handleMaterialChange('copperColor', e.target.value)
                  }
                />
                <span className={styles.colorValue}>
                  {viewer3DState.materials.copperColor}
                </span>
              </div>
            </div>

            <div className={styles.colorControl}>
              <label className={styles.colorLabel}>Silkscreen</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={viewer3DState.materials.silkscreenColor}
                  onChange={e =>
                    handleMaterialChange('silkscreenColor', e.target.value)
                  }
                />
                <span className={styles.colorValue}>
                  {viewer3DState.materials.silkscreenColor}
                </span>
              </div>
            </div>

            <div className={styles.colorControl}>
              <label className={styles.colorLabel}>Substrate</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={viewer3DState.materials.substrateColor}
                  onChange={e =>
                    handleMaterialChange('substrateColor', e.target.value)
                  }
                />
                <span className={styles.colorValue}>
                  {viewer3DState.materials.substrateColor}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Board Info Section */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Board Info</h4>
          <div className={styles.sectionContent}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Dimensions:</span>
              <span className={styles.infoValue}>
                {board.width.toFixed(2)} × {board.height.toFixed(2)} mm
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Thickness:</span>
              <span className={styles.infoValue}>{board.thickness.toFixed(2)} mm</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Layers:</span>
              <span className={styles.infoValue}>{board.layers.length}</span>
            </div>
          </div>
        </section>

        {/* Help Section */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Keyboard Shortcuts</h4>
          <div className={styles.sectionContent}>
            <ul className={styles.helpList}>
              <li>
                <kbd>Esc</kbd> - Return to 2D view
              </li>
              <li>
                <kbd>R</kbd> - Reset camera
              </li>
              <li>
                <kbd>+</kbd> - Zoom in
              </li>
              <li>
                <kbd>-</kbd> - Zoom out
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

PCB3DPanel.displayName = 'PCB3DPanel';
