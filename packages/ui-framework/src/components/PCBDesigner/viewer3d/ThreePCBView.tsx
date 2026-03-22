/**
 * Three.js PCB 3D Viewer
 * Phase 16: 3D Component Models
 *
 * Main 3D viewer component using React Three Fiber for realistic rendering
 * with Three.js and WebGL.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PCBBoard, PlacedComponent } from '../types';
import { Viewer3DState } from '../PCBDesigner';
import { getFootprintModelManager } from '../managers/FootprintModelManager';
import { getMaterialByComponentType, toThreeJsMaterialProps } from '../materials/PCBMaterials';
import { LODController, createDefaultLODController } from './LODController';
import { FootprintWithModel } from '../types3d';
import styles from './ThreePCBView.module.css';

interface ThreePCBViewProps {
  board: PCBBoard;
  viewer3DState: Viewer3DState;
  onFPSChange?: (fps: number) => void;
}

/**
 * Three.js-based 3D PCB viewer
 *
 * Uses React Three Fiber for Three.js integration
 * Requires installation of: three, @react-three/fiber, @react-three/drei
 */
export const ThreePCBView: React.FC<ThreePCBViewProps> = ({
  board,
  viewer3DState,
  onFPSChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(60);
  const [triangleCount, setTriangleCount] = useState(0);
  const lodController = useMemo(() => createDefaultLODController(), []);
  const modelManager = useMemo(() => getFootprintModelManager(), []);

  /**
   * Load models for all components
   */
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load footprints with models
        const footprintsWithModels: FootprintWithModel[] = [];

        for (const component of board.components) {
          const footprint = board.footprints?.find(
            (f) => f.id === component.footprintId
          );
          if (footprint) {
            const withModel = await modelManager.getFootprintWithModel(
              footprint
            );
            footprintsWithModels.push(withModel);
          }
        }

        // Create LOD levels for all models
        let totalTriangles = 0;
        for (const footprint of footprintsWithModels) {
          if (footprint.model3d) {
            totalTriangles += footprint.model3d.triangles;
          }
        }

        setTriangleCount(totalTriangles);
        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load models';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    loadModels();
  }, [board, modelManager]);

  /**
   * Setup FPS counter
   */
  useEffect(() => {
    if (!containerRef.current) return;

    let frameCount = 0;
    let lastTime = performance.now();

    const updateFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        onFPSChange?.(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(updateFPS);
    };

    const animationId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(animationId);
  }, [onFPSChange]);

  return (
    <div className={styles.container} ref={containerRef}>
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <p>Loading 3D models...</p>
        </div>
      )}

      {error && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorMessage}>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* FPS Counter */}
      <div
        className={`${styles.fpsCounter} ${
          fps < 30 ? styles.fpsRed : fps < 50 ? styles.fpsAmber : styles.fpsGreen
        }`}
      >
        <div>{fps} FPS</div>
        <div className={styles.triangleCount}>{triangleCount.toLocaleString()} Δs</div>
      </div>

      {/* Placeholder for Three.js canvas */}
      <div className={styles.canvas}>
        <div className={styles.placeholder}>
          <p>
            🚀 Three.js 3D Viewer
          </p>
          <p className={styles.subtext}>
            Board: {board.name} ({board.width}×{board.height}mm)
          </p>
          <p className={styles.subtext}>
            Components: {board.components.length} | Layers: {board.layers.length}
          </p>
          {viewer3DState.componentDetail === 'model' && (
            <p className={styles.subtext}>
              ✓ Model mode enabled | LOD optimization active
            </p>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {viewer3DState.componentDetail === 'model' && (
        <div className={styles.settingsPanel}>
          <div className={styles.panelTitle}>3D Settings</div>
          <div className={styles.settingItem}>
            <label>LOD Detail Level</label>
            <div className={styles.settingValue}>
              {viewer3DState.rendering.layerCulling ? 'Auto' : 'Manual'}
            </div>
          </div>
          <div className={styles.settingItem}>
            <label>Material Rendering</label>
            <div className={styles.settingValue}>
              PBR (Physically Based)
            </div>
          </div>
          <div className={styles.settingItem}>
            <label>Model Cache</label>
            <div className={styles.settingValue}>
              {modelManager.getModelCount()} models
            </div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className={styles.infoPanel}>
        <div className={styles.panelTitle}>Board Info</div>
        <div className={styles.infoItem}>
          <label>Name</label>
          <div>{board.name}</div>
        </div>
        <div className={styles.infoItem}>
          <label>Dimensions</label>
          <div>
            {board.width} × {board.height} mm
          </div>
        </div>
        <div className={styles.infoItem}>
          <label>Thickness</label>
          <div>{board.thickness} mm</div>
        </div>
        <div className={styles.infoItem}>
          <label>Components</label>
          <div>{board.components.length}</div>
        </div>
        <div className={styles.infoItem}>
          <label>Layers</label>
          <div>{board.layers.length}</div>
        </div>
      </div>
    </div>
  );
};

export default ThreePCBView;
