/**
 * CAD3DViewerEnhanced.tsx
 * Enhanced 3D viewport using Three.js
 */

import React, { useRef, useEffect, useState } from "react";
import type { TriangleMesh } from "./SceneManager";
import {
  createScene,
  createCamera,
  createRenderer,
  addGridHelper,
  addAxesHelper,
  createLights,
  meshFromTriangleMesh,
  createMaterial,
  PerformanceMonitor,
} from "./SceneManager";
import { ViewportControls } from "./ViewportControls";
import styles from "./CAD3DViewer.module.css";

interface CAD3DViewerProps {
  shapes: Map<string, { mesh: TriangleMesh; visible: boolean }>;
  selectedId?: string | null;
  viewMode?: "wireframe" | "solid" | "shaded";
  onSelectionChange?: (id: string | null) => void;
}

export const CAD3DViewerEnhanced: React.FC<CAD3DViewerProps> = ({
  shapes,
  selectedId,
  viewMode = "shaded",
  onSelectionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<ViewportControls | null>(null);
  const meshesRef = useRef<Map<string, any>>(new Map());
  const performanceRef = useRef<PerformanceMonitor | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const [fps, setFps] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || isInitialized) return;

    const initScene = async () => {
      try {
        const scene = createScene();
        const camera = createCamera(
          canvasRef.current!.clientWidth,
          canvasRef.current!.clientHeight
        );
        const renderer = createRenderer(canvasRef.current!);

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;

        addGridHelper(scene);
        addAxesHelper(scene);
        createLights(scene);

        const controls = new ViewportControls(camera);
        controlsRef.current = controls;

        performanceRef.current = new PerformanceMonitor();

        const animate = () => {
          animationIdRef.current = requestAnimationFrame(animate);

          if (performanceRef.current) {
            const currentFps = performanceRef.current.update();
            setFps(currentFps);
          }

          renderer.render(scene, camera);
        };

        animate();
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize 3D viewer:", error);
      }
    };

    initScene();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isInitialized]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    meshesRef.current.forEach((mesh) => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m: any) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    meshesRef.current.clear();

    shapes.forEach((shapeData, id) => {
      if (!shapeData.visible) return;

      try {
        const mesh = meshFromTriangleMesh(shapeData.mesh);
        mesh.userData.id = id;
        scene.add(mesh);
        meshesRef.current.set(id, mesh);

        if (selectedId === id) {
          mesh.material.emissive.setHex(0x444444);
        }
      } catch (error) {
        console.error(`Failed to add shape ${id}:`, error);
      }
    });
  }, [shapes, selectedId]);

  useEffect(() => {
    meshesRef.current.forEach((mesh) => {
      const newMaterial = createMaterial(viewMode);
      mesh.material = newMaterial;

      if (selectedId === mesh.userData.id) {
        mesh.material.emissive.setHex(0x444444);
      }
    });
  }, [viewMode, selectedId]);

  return (
    <div className={styles.viewer3dContainer} ref={containerRef}>
      <canvas ref={canvasRef} className={styles.viewer3dCanvas} />
      <div className={styles.viewer3dFpsCounter}>FPS: {fps}</div>
    </div>
  );
};

export default CAD3DViewerEnhanced;
