/**
 * PropertyPanelEnhanced.tsx
 * Enhanced property panel with geometry stats
 */

import React from "react";
import type { TriangleMesh } from "./SceneManager";
import { getGeometryStats, getGeometryBounds } from "./SceneManager";
import styles from "./PropertyPanel.module.css";

interface Shape {
  id: string;
  mesh: TriangleMesh;
  name: string;
}

interface PropertyPanelProps {
  selectedShape?: Shape | null;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onFitView?: () => void;
  onResetPosition?: () => void;
  materialMode?: "wireframe" | "solid" | "shaded";
  onMaterialChange?: (mode: "wireframe" | "solid" | "shaded") => void;
}

interface GeometryStats {
  vertexCount: number;
  faceCount: number;
  volume: number;
  surfaceArea: number;
}

export const PropertyPanelEnhanced: React.FC<PropertyPanelProps> = ({
  selectedShape,
  onDelete,
  onDuplicate,
  onFitView,
  onResetPosition,
  materialMode,
  onMaterialChange,
}) => {
  const getStats = (mesh: TriangleMesh): GeometryStats => {
    const vertexCount = mesh.vertices.length / 3;
    const faceCount = mesh.indices.length / 3;
    
    const vertices = [];
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      vertices.push({
        x: mesh.vertices[i],
        y: mesh.vertices[i + 1],
        z: mesh.vertices[i + 2],
      });
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    vertices.forEach((v) => {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z);
    });

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dz = maxZ - minZ;
    const volume = dx * dy * dz;
    const surfaceArea = 2 * (dx * dy + dy * dz + dz * dx);

    return {
      vertexCount,
      faceCount,
      volume,
      surfaceArea,
    };
  };

  if (!selectedShape) {
    return (
      <div className={styles.propertyPanel}>
        <div className={styles.emptyState}>
          <p>Select an object to view its properties</p>
        </div>
      </div>
    );
  }

  const stats = getStats(selectedShape.mesh);

  return (
    <div className={styles.propertyPanel}>
      <h3 className={styles.propertyPanelTitle}>Properties</h3>

      <div className={styles.propertySection}>
        <label className={styles.propertyLabel}>Name</label>
        <input
          type="text"
          className={styles.propertyInput}
          value={selectedShape.name}
          readOnly
        />
      </div>

      <div className={styles.propertySection}>
        <label className={styles.propertyLabel}>ID</label>
        <input
          type="text"
          className={styles.propertyInput}
          value={selectedShape.id}
          readOnly
          size={20}
        />
      </div>

      <div className={styles.divider} />

      <div className={styles.propertySection}>
        <label className={styles.propertyLabel}>Geometry Stats</label>
        <div className={styles.statItem}>
          <span>Vertices:</span>
          <span className={styles.statValue}>{stats.vertexCount.toLocaleString()}</span>
        </div>
        <div className={styles.statItem}>
          <span>Faces:</span>
          <span className={styles.statValue}>{stats.faceCount.toLocaleString()}</span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.propertySection}>
        <label className={styles.propertyLabel}>Volume</label>
        <div className={styles.statValue}>
          {stats.volume.toFixed(2)} units³
        </div>
      </div>

      <div className={styles.propertySection}>
        <label className={styles.propertyLabel}>Surface Area</label>
        <div className={styles.statValue}>
          {stats.surfaceArea.toFixed(2)} units²
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.propertySection}>
        <label className={styles.propertyLabel}>Material</label>
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.smallButton} ${materialMode === "wireframe" ? styles.active : ""}`}
            onClick={() => onMaterialChange?.("wireframe")}
          >
            Wire
          </button>
          <button
            className={`${styles.smallButton} ${materialMode === "solid" ? styles.active : ""}`}
            onClick={() => onMaterialChange?.("solid")}
          >
            Solid
          </button>
          <button
            className={`${styles.smallButton} ${materialMode === "shaded" ? styles.active : ""}`}
            onClick={() => onMaterialChange?.("shaded")}
          >
            Shaded
          </button>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.buttonGroup}>
        <button
          className={styles.propertyButton}
          onClick={onFitView}
          title="Frame selected object in view"
        >
          Fit View
        </button>
        <button
          className={styles.propertyButton}
          onClick={onDuplicate}
          title="Create a copy of the selected object"
        >
          Duplicate
        </button>
      </div>

      <div className={styles.buttonGroup}>
        <button
          className={styles.propertyButton}
          onClick={onResetPosition}
          title="Reset object position to origin"
        >
          Reset Pos
        </button>
        <button
          className={`${styles.propertyButton} ${styles.dangerButton}`}
          onClick={onDelete}
          title="Delete the selected object"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default PropertyPanelEnhanced;
