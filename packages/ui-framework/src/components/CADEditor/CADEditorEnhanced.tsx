/**
 * CADEditorEnhanced.tsx
 * Main CAD Editor container with full 3D capabilities
 * 
 * Features:
 * - Three-pane layout (toolbar, viewport, properties)
 * - Shape creation and management
 * - 3D visualization with multiple render modes
 * - Selection and property editing
 * - Undo/redo support
 */

import React, { useState, useCallback, useEffect } from "react";
import Toolbar from "./Toolbar";
import CAD3DViewerEnhanced from "./CAD3DViewerEnhanced";
import PropertyPanelEnhanced from "./PropertyPanelEnhanced";
import { useCADState } from "./useCADState";
import { useGeometryBridge } from "./useGeometryBridge";
import styles from "./CADEditor.module.css";

interface CADEditorEnhancedProps {
  title?: string;
  onSave?: () => void;
  onClose?: () => void;
}

/**
 * Enhanced CAD Editor Component
 */
export const CADEditorEnhanced: React.FC<CADEditorEnhancedProps> = ({
  title = "CAD Editor",
  onSave,
  onClose,
}) => {
  const cadState = useCADState();
  const geometryBridge = useGeometryBridge();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  // Create box
  const handleCreateBox = useCallback(async () => {
    try {
      const mesh = await geometryBridge.createBox(50, 50, 50);
      if (geometryBridge.validateGeometry(mesh)) {
        const id = cadState.addShape(mesh, "Box");
        cadState.selectShape(id);
        setStatusMessage("Created box");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create box";
      setError(msg);
      setStatusMessage("");
    }
  }, [geometryBridge, cadState]);

  // Create cylinder
  const handleCreateCylinder = useCallback(async () => {
    try {
      const mesh = await geometryBridge.createCylinder(25, 100, 32);
      if (geometryBridge.validateGeometry(mesh)) {
        const id = cadState.addShape(mesh, "Cylinder");
        cadState.selectShape(id);
        setStatusMessage("Created cylinder");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create cylinder";
      setError(msg);
      setStatusMessage("");
    }
  }, [geometryBridge, cadState]);

  // Create sphere
  const handleCreateSphere = useCallback(async () => {
    try {
      const mesh = await geometryBridge.createSphere(40, 32);
      if (geometryBridge.validateGeometry(mesh)) {
        const id = cadState.addShape(mesh, "Sphere");
        cadState.selectShape(id);
        setStatusMessage("Created sphere");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create sphere";
      setError(msg);
      setStatusMessage("");
    }
  }, [geometryBridge, cadState]);

  const handleDeleteShape = useCallback(() => {
    if (cadState.selectedId) {
      cadState.deleteShape(cadState.selectedId);
      setStatusMessage("Object deleted");
    }
  }, [cadState]);

  const handleDuplicateShape = useCallback(() => {
    if (cadState.selectedId) {
      const newId = cadState.duplicateShape(cadState.selectedId);
      if (newId) {
        cadState.selectShape(newId);
        setStatusMessage("Object duplicated");
      }
    }
  }, [cadState]);

  const handleViewPreset = useCallback(
    (preset: string) => {
      setStatusMessage(`View: ${preset}`);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.shiftKey) {
        switch (e.code) {
          case "KeyB":
            handleCreateBox();
            break;
          case "KeyC":
            handleCreateCylinder();
            break;
          case "KeyS":
            handleCreateSphere();
            break;
        }
      } else {
        switch (e.code) {
          case "Delete":
            handleDeleteShape();
            break;
          case "KeyD":
            if (e.ctrlKey) {
              handleDuplicateShape();
            }
            break;
        }
      }
    },
    [handleCreateBox, handleCreateCylinder, handleCreateSphere, handleDeleteShape, handleDuplicateShape]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const selectedShape =
    cadState.selectedId && cadState.getShape(cadState.selectedId)
      ? {
          id: cadState.selectedId,
          name: cadState.getShape(cadState.selectedId)?.name || "Unknown",
          mesh: cadState.getShape(cadState.selectedId)!.mesh,
        }
      : null;

  return (
    <div className={styles.editorContainer}>
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError(null)}>Close</button>
        </div>
      )}

      <Toolbar
        onCreateBox={handleCreateBox}
        onCreateCylinder={handleCreateCylinder}
        onCreateSphere={handleCreateSphere}
        viewMode={cadState.viewMode}
        onViewModeChange={cadState.setViewMode}
        onViewPreset={handleViewPreset}
        onResetCamera={() => setStatusMessage("Camera reset")}
        isCreating={geometryBridge.isLoading}
      />

      <div className={styles.editorContent}>
        <CAD3DViewerEnhanced
          shapes={cadState.shapes}
          selectedId={cadState.selectedId}
          viewMode={cadState.viewMode}
          onSelectionChange={cadState.selectShape}
        />

        <PropertyPanelEnhanced
          selectedShape={selectedShape}
          onDelete={handleDeleteShape}
          onDuplicate={handleDuplicateShape}
          onFitView={() => setStatusMessage("Fit to view")}
          onResetPosition={() => setStatusMessage("Position reset")}
          materialMode={cadState.viewMode}
          onMaterialChange={cadState.setViewMode}
        />
      </div>

      <div className={styles.statusBar}>
        <span className={styles.statusText}>{statusMessage || `Objects: ${cadState.shapes.size}`}</span>
        <div className={styles.statusActions}>
          {cadState.canUndo && (
            <button
              className={styles.statusButton}
              onClick={cadState.undo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
          )}
          {cadState.canRedo && (
            <button
              className={styles.statusButton}
              onClick={cadState.redo}
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CADEditorEnhanced;
