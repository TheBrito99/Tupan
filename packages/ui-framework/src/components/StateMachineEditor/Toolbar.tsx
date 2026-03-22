/**
 * State Machine Editor Toolbar
 *
 * Tools for zoom, pan, and editor controls
 */

import React from 'react';
import styles from './StateMachineEditor.module.css';

export interface ToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoom: number;
  onTogglePropertyPanel: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  zoom,
  onTogglePropertyPanel,
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
          className={styles.toolButton}
          onClick={onTogglePropertyPanel}
          title="Toggle Property Panel"
        >
          ⚙
        </button>
      </div>

      <div className={styles.help}>
        <span title="Click empty space to add state. Alt+Click state to draw transition. Right-click to delete.">
          ℹ Help
        </span>
      </div>
    </div>
  );
};
