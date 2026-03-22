/**
 * Toolbar.tsx
 * Top toolbar with creation and view controls
 * 
 * Features:
 * - Create geometry buttons (box, cylinder, sphere)
 * - View mode selector (wireframe, solid, shaded)
 * - View presets (top, front, right, isometric)
 * - Camera controls
 * - Help text with keyboard shortcuts
 */

import React from "react";
import styles from "./CADEditor.module.css";

interface ToolbarProps {
  onCreateBox: () => void;
  onCreateCylinder: () => void;
  onCreateSphere: () => void;
  viewMode: "wireframe" | "solid" | "shaded";
  onViewModeChange: (mode: "wireframe" | "solid" | "shaded") => void;
  onViewPreset: (preset: "top" | "front" | "right" | "isometric" | "fitAll") => void;
  onResetCamera: () => void;
  isCreating?: boolean;
}

/**
 * Top toolbar component
 */
export const Toolbar: React.FC<ToolbarProps> = ({
  onCreateBox,
  onCreateCylinder,
  onCreateSphere,
  viewMode,
  onViewModeChange,
  onViewPreset,
  onResetCamera,
  isCreating = false,
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <button
          className={styles.toolbarButton}
          onClick={onCreateBox}
          disabled={isCreating}
          title="Create Box (Shift+B)"
        >
          Box
        </button>
        <button
          className={styles.toolbarButton}
          onClick={onCreateCylinder}
          disabled={isCreating}
          title="Create Cylinder (Shift+C)"
        >
          Cylinder
        </button>
        <button
          className={styles.toolbarButton}
          onClick={onCreateSphere}
          disabled={isCreating}
          title="Create Sphere (Shift+S)"
        >
          Sphere
        </button>
      </div>

      <div className={styles.toolbarDivider} />

      <div className={styles.toolbarGroup}>
        <button
          className={`${styles.toolbarButton} ${viewMode === "wireframe" ? styles.active : ""}`}
          onClick={() => onViewModeChange("wireframe")}
          title="Wireframe View"
        >
          Wireframe
        </button>
        <button
          className={`${styles.toolbarButton} ${viewMode === "solid" ? styles.active : ""}`}
          onClick={() => onViewModeChange("solid")}
          title="Solid View"
        >
          Solid
        </button>
        <button
          className={`${styles.toolbarButton} ${viewMode === "shaded" ? styles.active : ""}`}
          onClick={() => onViewModeChange("shaded")}
          title="Shaded View"
        >
          Shaded
        </button>
      </div>

      <div className={styles.toolbarDivider} />

      <div className={styles.toolbarGroup}>
        <button
          className={styles.toolbarButton}
          onClick={() => onViewPreset("top")}
          title="Top View"
        >
          Top
        </button>
        <button
          className={styles.toolbarButton}
          onClick={() => onViewPreset("front")}
          title="Front View"
        >
          Front
        </button>
        <button
          className={styles.toolbarButton}
          onClick={() => onViewPreset("right")}
          title="Right View"
        >
          Right
        </button>
        <button
          className={styles.toolbarButton}
          onClick={() => onViewPreset("isometric")}
          title="Isometric View"
        >
          Isometric
        </button>
        <button
          className={styles.toolbarButton}
          onClick={() => onViewPreset("fitAll")}
          title="Fit All (F)"
        >
          Fit All
        </button>
      </div>

      <div className={styles.toolbarDivider} />

      <div className={styles.toolbarGroup}>
        <button
          className={styles.toolbarButton}
          onClick={onResetCamera}
          title="Reset Camera (R)"
        >
          Reset
        </button>
      </div>

      <div className={styles.toolbarSpacer} />

      <div className={styles.toolbarHelp}>
        <span>
          Left: Rotate | Right: Pan | Wheel: Zoom
        </span>
      </div>
    </div>
  );
};

export default Toolbar;
