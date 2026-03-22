/**
 * CAD Editor Component
 * Phase 17: 3D CAD Foundation
 *
 * Main CAD editor combining:
 * - Parametric sketcher
 * - Feature tree
 * - 3D viewport (Three.js)
 * - Property panels
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { CADDocument, Sketch, Feature } from '../../cad/types';
import { CADDocumentBridge, initializeCAD } from '../../cad/cad-bridge';
import SketcherCanvas from './SketcherCanvas';
import CAD3DViewer from './CAD3DViewer';
import { HoleWizard, type HoleType } from './HoleWizard';
import styles from './CADEditor.module.css';

interface CADEditorProps {
  documentName?: string;
  onDocumentChange?: (doc: CADDocument) => void;
  readOnly?: boolean;
}

type EditorView = 'sketch' | 'model' | 'assembly';
type PanelSide = 'left' | 'right' | 'bottom';

/**
 * Main CAD Editor
 * Three-panel layout:
 * - Left: Feature tree, sketches
 * - Center: Sketcher or 3D viewport
 * - Right: Properties, constraints, measurements
 */
export const CADEditor: React.FC<CADEditorProps> = ({
  documentName = 'Untitled',
  onDocumentChange,
  readOnly = false,
}) => {
  const [document, setDocument] = useState<CADDocumentBridge | null>(null);
  const [view, setView] = useState<EditorView>('sketch');
  const [activeSketchId, setActiveSketchId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [panelVisible, setPanelVisible] = useState<Record<PanelSide, boolean>>({
    left: true,
    right: true,
    bottom: false,
  });
  const [showHoleWizard, setShowHoleWizard] = useState(false);

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeCAD();
        // Create new document
        const newDoc = new (require('../../cad/cad-bridge').CADDocumentBridge)(
          {}
        );
        setDocument(newDoc);
      } catch (error) {
        console.error('Failed to initialize CAD system:', error);
      }
    };

    initialize();
  }, []);

  // =========================================================================
  // SKETCH OPERATIONS
  // =========================================================================

  const handleCreateSketch = useCallback(() => {
    if (!document) return;

    const sketchName = `Sketch${sketches.length + 1}`;
    const sketchId = document.createSketch(sketchName, 'XY');

    // Update UI
    const updated = document.getSketches();
    setSketches(updated);
    setActiveSketchId(sketchId);
    setView('sketch');
  }, [document, sketches]);

  const handleDeleteSketch = useCallback((sketchId: string) => {
    if (!document) return;
    // TODO: Implement delete in CAD bridge
    const updated = document.getSketches();
    setSketches(updated);
    if (activeSketchId === sketchId) {
      setActiveSketchId(null);
    }
  }, [document, activeSketchId]);

  const handleResolveConstraints = useCallback((sketchId: string) => {
    if (!document) return;

    try {
      document.sketchSolve(sketchId);
      const updated = document.getSketches();
      setSketches(updated);
      console.log(`Constraints solved for ${sketchId}`);
    } catch (error) {
      console.error('Failed to solve constraints:', error);
    }
  }, [document]);

  // =========================================================================
  // FEATURE OPERATIONS
  // =========================================================================

  const handleCreateExtrude = useCallback(() => {
    if (!document || !activeSketchId) return;

    const featureName = `Extrude${features.length + 1}`;
    const featureId = document.createExtrude(featureName, activeSketchId, 10);

    const updated = document.getFeatures();
    setFeatures(updated);
    setSelectedFeatureId(featureId);
    setView('model');
  }, [document, activeSketchId, features]);

  const handleCreateHole = useCallback((diameter: number, pointId: string, holeType: HoleType = 'Through') => {
    if (!document) return;

    const featureName = `Hole${features.length + 1}`;
    const featureId = document.createHole(
      featureName,
      diameter,
      pointId,
      holeType
    );

    const updated = document.getFeatures();
    setFeatures(updated);
    setSelectedFeatureId(featureId);
  }, [document, features]);

  const handleHoleWizardCreate = useCallback(
    (name: string, diameter: number, holeType: HoleType, params?: any) => {
      if (!document || !activeSketchId) return;

      // Create a hole at the origin of the active sketch
      // In a full implementation, user would select a point in the sketch
      const featureId = document.createHole(name, diameter, '', holeType);

      const updated = document.getFeatures();
      setFeatures(updated);
      setSelectedFeatureId(featureId);
      setShowHoleWizard(false);

      // Recompute to update 3D view
      setTimeout(() => handleRecompute(), 100);
    },
    [document, activeSketchId, features, handleRecompute]
  );

  const handleRecompute = useCallback(() => {
    if (!document) return;

    try {
      document.recompute();
      console.log('Model recomputed');
      // Update all data
      setSketches(document.getSketches());
      setFeatures(document.getFeatures());
    } catch (error) {
      console.error('Failed to recompute:', error);
    }
  }, [document]);

  // =========================================================================
  // EXPORT OPERATIONS
  // =========================================================================

  const handleExportSTEP = useCallback(() => {
    if (!document) return;

    try {
      const stepData = document.exportSTEP();
      // Create download link
      const blob = new Blob([stepData], { type: 'application/step' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${document.getName()}.step`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export STEP:', error);
    }
  }, [document]);

  const handleExportSTL = useCallback(() => {
    if (!document) return;

    try {
      const stlData = document.exportSTL();
      const blob = new Blob([stlData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${document.getName()}.stl`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export STL:', error);
    }
  }, [document]);

  // =========================================================================
  // RENDERING
  // =========================================================================

  const activeSketch = sketches.find((s) => s.id === activeSketchId);

  return (
    <div className={styles.container}>
      {/* Top toolbar */}
      <div className={styles.topBar}>
        <div className={styles.title}>{document?.getName() || documentName}</div>

        <div className={styles.viewButtons}>
          <button
            className={`${styles.viewButton} ${view === 'sketch' ? styles.active : ''}`}
            onClick={() => setView('sketch')}
            title="Sketch mode (2D)"
          >
            📐 Sketch
          </button>
          <button
            className={`${styles.viewButton} ${view === 'model' ? styles.active : ''}`}
            onClick={() => setView('model')}
            title="Model mode (3D)"
          >
            🎯 Model
          </button>
          <button
            className={`${styles.viewButton} ${view === 'assembly' ? styles.active : ''}`}
            onClick={() => setView('assembly')}
            title="Assembly mode"
          >
            ⚙️ Assembly
          </button>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.actionButton}
            onClick={() => setShowHoleWizard(true)}
            disabled={!activeSketchId}
            title="Create hole from template"
          >
            🕳️ Hole Wizard
          </button>
          <button className={styles.actionButton} onClick={handleRecompute} title="Recompute model">
            🔄 Recompute
          </button>
          <button className={styles.actionButton} onClick={handleExportSTEP} title="Export as STEP">
            💾 STEP
          </button>
          <button className={styles.actionButton} onClick={handleExportSTL} title="Export as STL">
            📦 STL
          </button>
        </div>
      </div>

      <div className={styles.mainLayout}>
        {/* Left panel: Feature tree & sketches */}
        {panelVisible.left && (
          <div className={styles.leftPanel}>
            <div className={styles.panelHeader}>
              <h3>Features & Sketches</h3>
              <button
                className={styles.collapseButton}
                onClick={() =>
                  setPanelVisible((prev) => ({ ...prev, left: false }))
                }
              >
                ◀
              </button>
            </div>

            <div className={styles.panelContent}>
              {/* Sketches section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h4>Sketches ({sketches.length})</h4>
                  <button
                    className={styles.addButton}
                    onClick={handleCreateSketch}
                    title="Create new sketch"
                  >
                    ➕
                  </button>
                </div>
                <div className={styles.itemList}>
                  {sketches.map((sketch) => (
                    <div
                      key={sketch.id}
                      className={`${styles.item} ${
                        activeSketchId === sketch.id ? styles.active : ''
                      }`}
                      onClick={() => {
                        setActiveSketchId(sketch.id);
                        setView('sketch');
                      }}
                    >
                      <span className={styles.itemName}>📋 {sketch.name}</span>
                      <span className={styles.itemInfo}>
                        {sketch.elements.size} elements, {sketch.constraints.size}{' '}
                        constraints
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h4>Features ({features.length})</h4>
                  <button
                    className={styles.addButton}
                    onClick={handleCreateExtrude}
                    disabled={!activeSketchId}
                    title="Create extrude from active sketch"
                  >
                    ➕
                  </button>
                </div>
                <div className={styles.itemList}>
                  {features.map((feature) => (
                    <div
                      key={feature.id}
                      className={`${styles.item} ${
                        selectedFeatureId === feature.id ? styles.active : ''
                      }`}
                      onClick={() => setSelectedFeatureId(feature.id)}
                    >
                      <span className={styles.itemName}>🔧 {feature.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Center panel: Sketcher or 3D viewport */}
        <div className={styles.centerPanel}>
          {view === 'sketch' && activeSketch ? (
            <div className={styles.sketcherContainer}>
              <SketcherCanvas
                sketch={activeSketch}
                readOnly={readOnly}
                onConstraintAdded={() => handleResolveConstraints(activeSketch.id)}
              />
              <div className={styles.sketcherFooter}>
                <button
                  className={styles.solveButton}
                  onClick={() => handleResolveConstraints(activeSketch.id)}
                >
                  ✓ Solve Constraints
                </button>
                <span className={styles.sketchStatus}>
                  {activeSketch.is_profiled ? '✓ Closed profile' : 'Open profile'}
                </span>
              </div>
            </div>
          ) : view === 'model' ? (
            <CAD3DViewer
              features={features}
              selectedFeatureId={selectedFeatureId}
              onFeatureSelected={setSelectedFeatureId}
              showEdges={true}
              showFaces={true}
            />
          ) : (
            <div className={styles.viewportPlaceholder}>
              <div className={styles.placeholderText}>
                Assembly View - Multi-Body Modeling
                <br />
                <small>(Phase 18 - Coming Soon)</small>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Properties & constraints */}
        {panelVisible.right && (
          <div className={styles.rightPanel}>
            <div className={styles.panelHeader}>
              <h3>Properties</h3>
              <button
                className={styles.collapseButton}
                onClick={() =>
                  setPanelVisible((prev) => ({ ...prev, right: false }))
                }
              >
                ▶
              </button>
            </div>

            <div className={styles.panelContent}>
              {activeSketch ? (
                <>
                  <div className={styles.section}>
                    <h4>Sketch Info</h4>
                    <div className={styles.property}>
                      <span className={styles.label}>Name:</span>
                      <span className={styles.value}>{activeSketch.name}</span>
                    </div>
                    <div className={styles.property}>
                      <span className={styles.label}>Plane:</span>
                      <span className={styles.value}>{activeSketch.plane}</span>
                    </div>
                    <div className={styles.property}>
                      <span className={styles.label}>Elements:</span>
                      <span className={styles.value}>{activeSketch.elements.size}</span>
                    </div>
                    <div className={styles.property}>
                      <span className={styles.label}>Constraints:</span>
                      <span className={styles.value}>{activeSketch.constraints.size}</span>
                    </div>
                  </div>

                  <div className={styles.section}>
                    <h4>Constraints</h4>
                    <div className={styles.constraintsList}>
                      {Array.from(activeSketch.constraints.values()).map(
                        (constraint) => (
                          <div key={constraint.id} className={styles.constraintItem}>
                            <span className={styles.constraintType}>
                              {constraint.type}
                            </span>
                            {constraint.value && (
                              <span className={styles.constraintValue}>
                                = {constraint.value.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              ) : selectedFeatureId ? (
                <>
                  <div className={styles.section}>
                    <h4>Feature Info</h4>
                    <div className={styles.property}>
                      <span className={styles.label}>Type:</span>
                      <span className={styles.value}>
                        {features.find((f) => f.id === selectedFeatureId)?.feature_type
                          ?.type || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <p>Select a sketch or feature to view properties</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Panel toggles */}
        {!panelVisible.left && (
          <button
            className={styles.toggleButton}
            onClick={() =>
              setPanelVisible((prev) => ({ ...prev, left: true }))
            }
            title="Show left panel"
          >
            ▶
          </button>
        )}
        {!panelVisible.right && (
          <button
            className={styles.toggleButton}
            onClick={() =>
              setPanelVisible((prev) => ({ ...prev, right: true }))
            }
            title="Show right panel"
            style={{ right: 0 }}
          >
            ◀
          </button>
        )}

        {/* Hole Wizard Modal */}
        {showHoleWizard && (
          <div className={styles.modalOverlay}>
            <HoleWizard
              onCreateHole={handleHoleWizardCreate}
              onClose={() => setShowHoleWizard(false)}
              activePlaneZ={activeSketch ? 0 : 0}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CADEditor;
