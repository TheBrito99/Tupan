/**
 * Petri Net Editor Toolbar
 *
 * Tools for zoom, pan, simulation, and analysis
 */

import React from 'react';
import styles from './PetriNetEditor.module.css';

export interface ToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoom: number;
  onTogglePropertyPanel: () => void;
  onToggleAnalysisPanel: () => void;
  simulationMode: boolean;
  onToggleSimulation: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  zoom,
  onTogglePropertyPanel,
  onToggleAnalysisPanel,
  simulationMode,
  onToggleSimulation,
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <button
          className={styles.toolButton}
          onClick={onZoomOut}
          title="Zoom Out (Ctrl + -)"
        >
          🔍−
        </button>

        <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>

        <button
          className={styles.toolButton}
          onClick={onZoomIn}
          title="Zoom In (Ctrl + +)"
        >
          🔍+
        </button>

        <div className={styles.separator}></div>

        <button
          className={`${styles.toolButton} ${simulationMode ? styles.active : ''}`}
          onClick={onToggleSimulation}
          title="Toggle Simulation Mode"
        >
          ▶ Sim
        </button>

        <button
          className={styles.toolButton}
          onClick={onTogglePropertyPanel}
          title="Toggle Property Panel"
        >
          ⚙
        </button>

        <button
          className={styles.toolButton}
          onClick={onToggleAnalysisPanel}
          title="Toggle Analysis Panel"
        >
          📊
        </button>
      </div>

      <div className={styles.help}>
        <span title="Click to add place. Shift+Click to add transition. Alt+Click to draw arc. Right-click to delete.">
          ℹ Help
        </span>
      </div>
    </div>
  );
};
