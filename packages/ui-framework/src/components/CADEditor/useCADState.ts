/**
 * useCADState.ts
 * Custom hook for CAD state management
 * 
 * Features:
 * - Shape collection management
 * - Selection state
 * - View mode switching
 * - Camera state persistence
 * - Undo/redo with 20-step history
 */

import { useState, useCallback, useRef } from "react";
import type { TriangleMesh } from "./SceneManager";

interface Shape {
  id: string;
  mesh: TriangleMesh;
  name: string;
  visible: boolean;
  matrix: number[];
}

interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
}

interface CADStateSnapshot {
  shapes: Map<string, Shape>;
  selectedId: string | null;
  viewMode: "wireframe" | "solid" | "shaded";
  cameraState: CameraState;
}

const HISTORY_SIZE = 20;

/**
 * useCADState hook
 * Manages CAD document state with undo/redo
 */
export function useCADState() {
  const [shapes, setShapes] = useState<Map<string, Shape>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"wireframe" | "solid" | "shaded">("shaded");
  const [cameraState, setCameraState] = useState<CameraState>({
    position: { x: 100, y: 100, z: 100 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1,
  });

  const historyRef = useRef<CADStateSnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Save snapshot to history
  const saveSnapshot = useCallback(() => {
    const snapshot: CADStateSnapshot = {
      shapes: new Map(shapes),
      selectedId,
      viewMode,
      cameraState: { ...cameraState },
    };

    // Remove any redo history
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Add new snapshot
    historyRef.current.push(snapshot);

    // Maintain max history size
    if (historyRef.current.length > HISTORY_SIZE) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
  }, [shapes, selectedId, viewMode, cameraState]);

  /**
   * Add a new shape to the scene
   */
  const addShape = useCallback(
    (mesh: TriangleMesh, name: string = "Shape") => {
      const id = `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newShapes = new Map(shapes);
      newShapes.set(id, {
        id,
        mesh,
        name,
        visible: true,
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      });
      setShapes(newShapes);
      saveSnapshot();
      return id;
    },
    [shapes, saveSnapshot]
  );

  /**
   * Delete shape by ID
   */
  const deleteShape = useCallback(
    (id: string) => {
      const newShapes = new Map(shapes);
      newShapes.delete(id);
      setShapes(newShapes);
      if (selectedId === id) {
        setSelectedId(null);
      }
      saveSnapshot();
    },
    [shapes, selectedId, saveSnapshot]
  );

  /**
   * Select shape by ID
   */
  const selectShape = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  /**
   * Deselect current shape
   */
  const deselect = useCallback(() => {
    setSelectedId(null);
  }, []);

  /**
   * Change view mode
   */
  const setViewModeState = useCallback((mode: "wireframe" | "solid" | "shaded") => {
    setViewMode(mode);
    saveSnapshot();
  }, [saveSnapshot]);

  /**
   * Update camera state
   */
  const setCameraStateInternal = useCallback((state: Partial<CameraState>) => {
    setCameraState((prev) => ({ ...prev, ...state }));
  }, []);

  /**
   * Undo last action
   */
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const snapshot = historyRef.current[historyIndexRef.current];
      setShapes(new Map(snapshot.shapes));
      setSelectedId(snapshot.selectedId);
      setViewMode(snapshot.viewMode);
      setCameraState({ ...snapshot.cameraState });
    }
  }, []);

  /**
   * Redo last undone action
   */
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const snapshot = historyRef.current[historyIndexRef.current];
      setShapes(new Map(snapshot.shapes));
      setSelectedId(snapshot.selectedId);
      setViewMode(snapshot.viewMode);
      setCameraState({ ...snapshot.cameraState });
    }
  }, []);

  /**
   * Get shape by ID
   */
  const getShape = useCallback(
    (id: string): Shape | undefined => {
      return shapes.get(id);
    },
    [shapes]
  );

  /**
   * Toggle shape visibility
   */
  const toggleVisibility = useCallback(
    (id: string) => {
      const newShapes = new Map(shapes);
      const shape = newShapes.get(id);
      if (shape) {
        shape.visible = !shape.visible;
        setShapes(newShapes);
        saveSnapshot();
      }
    },
    [shapes, saveSnapshot]
  );

  /**
   * Duplicate shape
   */
  const duplicateShape = useCallback(
    (id: string) => {
      const shape = shapes.get(id);
      if (shape) {
        const newId = addShape(shape.mesh, shape.name + " Copy");
        return newId;
      }
      return null;
    },
    [shapes, addShape]
  );

  return {
    shapes,
    selectedId,
    viewMode,
    cameraState,
    addShape,
    deleteShape,
    selectShape,
    deselect,
    setViewMode: setViewModeState,
    setCameraState: setCameraStateInternal,
    undo,
    redo,
    getShape,
    toggleVisibility,
    duplicateShape,
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,
  };
}
