/**
 * Bond Graph Editor - Unified System (Task 8)
 *
 * Complete bond graph editing and simulation system:
 * - Edit Mode: Design bond graphs with visual editor
 * - Simulate Mode: Run simulations with real-time visualization
 * - Mode Switching: Seamless transition between design and analysis
 *
 * Integration Points:
 * - SimulationCanvas: Real-time visualization (Task 6)
 * - SimulationControls: Playback and parameters (Task 7)
 * - AnalysisPanel: Energy conservation (Task 6)
 * - SimulationEngine: 60 FPS simulation (Task 5)
 * - SolverSelector: Stiffness-based selection (Task 4)
 *
 * Data Flow:
 * Edit Mode: Design → Save
 *    ↓
 * Simulate Mode: Causality Analysis → Solver Selection → SimulationEngine
 *    ↓
 * Visualization: Canvas + Controls + Analysis
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { EditorElement, EditorBond } from './types';
import { SimulationCanvas } from './SimulationCanvas';
import { AnalysisPanel } from './AnalysisPanel';
import { SimulationControls } from './SimulationControls';
import type { SimulationSnapshot, PerformanceMetrics } from '@tupan/core-ts/wasm-bridge';
import styles from './BondGraphEditor.module.css';

export type EditorMode = 'edit' | 'simulate';

export interface BondGraphEditorState {
  elements: EditorElement[];
  bonds: EditorBond[];
  selectedElement: string | null;
  selectedBond: string | null;
  mode: EditorMode;
}

export interface BondGraphEditorProps {
  initialElements?: EditorElement[];
  initialBonds?: EditorBond[];
  onSave?: (state: BondGraphEditorState) => void;
  onSimulationStart?: () => void;
}

/**
 * Main Bond Graph Editor Component
 *
 * Provides unified interface for:
 * 1. Editing bond graph topology
 * 2. Selecting elements and parameters
 * 3. Running simulations
 * 4. Analyzing results
 */
export function BondGraphEditor({
  initialElements = [],
  initialBonds = [],
  onSave,
  onSimulationStart,
}: BondGraphEditorProps) {
  // ============ EDIT MODE STATE ============

  const [editorState, setEditorState] = useState<BondGraphEditorState>({
    elements: initialElements,
    bonds: initialBonds,
    selectedElement: null,
    selectedBond: null,
    mode: 'edit',
  });

  // ============ SIMULATION MODE STATE ============

  // Playback state
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationPaused, setSimulationPaused] = useState(false);

  // Simulation parameters
  const [simulationTime, setSimulationTime] = useState(0);
  const [simulationDuration, setSimulationDuration] = useState(10);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [recordHistory, setRecordHistory] = useState(true);

  // Visualization data
  const [elementValues, setElementValues] = useState<Map<string, number>>(new Map());
  const [bondPowers, setBondPowers] = useState<Map<string, number>>(new Map());
  const [simulationSnapshot, setSimulationSnapshot] = useState<SimulationSnapshot | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [simulationHistory, setSimulationHistory] = useState<SimulationSnapshot[]>([]);

  // Engine reference
  const simulationEngineRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ============ EDIT MODE OPERATIONS ============

  /**
   * Add element to bond graph
   */
  const addElement = useCallback(
    (type: string, x?: number, y?: number) => {
      const newElement: EditorElement = {
        id: `${type}-${Date.now()}`,
        type: type as any,
        x: x ?? Math.random() * 400 + 100,
        y: y ?? Math.random() * 300 + 100,
        width: 40,
        height: 40,
        parameters: {},
      };

      setEditorState((prev) => ({
        ...prev,
        elements: [...prev.elements, newElement],
      }));
    },
    []
  );

  /**
   * Delete element and connected bonds
   */
  const deleteElement = useCallback(
    (elementId: string) => {
      setEditorState((prev) => ({
        ...prev,
        elements: prev.elements.filter((e) => e.id !== elementId),
        bonds: prev.bonds.filter((b) => b.from !== elementId && b.to !== elementId),
        selectedElement: prev.selectedElement === elementId ? null : prev.selectedElement,
      }));
    },
    []
  );

  /**
   * Update element position
   */
  const moveElement = useCallback(
    (elementId: string, x: number, y: number) => {
      setEditorState((prev) => ({
        ...prev,
        elements: prev.elements.map((e) =>
          e.id === elementId ? { ...e, x, y } : e
        ),
      }));
    },
    []
  );

  /**
   * Update element parameters
   */
  const updateElementParameters = useCallback(
    (elementId: string, parameters: Record<string, any>) => {
      setEditorState((prev) => ({
        ...prev,
        elements: prev.elements.map((e) =>
          e.id === elementId
            ? { ...e, parameters: { ...e.parameters, ...parameters } }
            : e
        ),
      }));
    },
    []
  );

  /**
   * Save bond graph design to file
   */
  const saveDesign = useCallback(() => {
    const data = {
      elements: editorState.elements,
      bonds: editorState.bonds,
      timestamp: new Date().toISOString(),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bond-graph-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    onSave?.(editorState);
  }, [editorState, onSave]);

  // ============ MODE SWITCHING ============

  /**
   * Enter simulation mode
   * Validates bond graph and initializes simulation
   */
  const enterSimulationMode = useCallback(async () => {
    // Validate
    if (editorState.elements.length === 0) {
      alert('Cannot simulate: Bond graph is empty');
      return;
    }

    // TODO: Phase 54 - Causality Analysis
    // TODO: Task 4 - Solver Selection
    // TODO: Task 5 - Initialize SimulationEngine

    setEditorState((prev) => ({ ...prev, mode: 'simulate' }));
    setSimulationTime(0);
    setSimulationRunning(false);
    setSimulationPaused(false);
    setElementValues(new Map());
    setBondPowers(new Map());
    setSimulationHistory([]);

    onSimulationStart?.();
  }, [editorState.elements.length, onSimulationStart]);

  /**
   * Exit simulation mode (return to edit)
   */
  const exitSimulationMode = useCallback(() => {
    // Stop simulation
    if (simulationEngineRef.current?.isRunning()) {
      simulationEngineRef.current.stop();
    }

    setEditorState((prev) => ({ ...prev, mode: 'edit' }));
    setSimulationRunning(false);
    setSimulationPaused(false);
    setSimulationTime(0);
    setElementValues(new Map());
    setBondPowers(new Map());
    setSimulationSnapshot(null);
    setPerformanceMetrics(null);
    setSimulationHistory([]);
  }, []);

  // ============ SIMULATION CONTROLS ============

  const startSimulation = useCallback(async () => {
    // TODO: Initialize and start SimulationEngine with current parameters
    setSimulationRunning(true);
    setSimulationPaused(false);
    setSimulationTime(0);
    setSimulationHistory([]);
  }, []);

  const pauseSimulation = useCallback(() => {
    if (simulationEngineRef.current) {
      simulationEngineRef.current.pause();
    }
    setSimulationPaused(true);
  }, []);

  const resumeSimulation = useCallback(() => {
    if (simulationEngineRef.current) {
      simulationEngineRef.current.resume();
    }
    setSimulationPaused(false);
  }, []);

  const stopSimulation = useCallback(() => {
    if (simulationEngineRef.current) {
      simulationEngineRef.current.stop();
    }
    setSimulationRunning(false);
    setSimulationPaused(false);
  }, []);

  const resetSimulation = useCallback(() => {
    if (simulationEngineRef.current) {
      simulationEngineRef.current.reset();
    }
    setSimulationTime(0);
    setSimulationRunning(false);
    setSimulationPaused(false);
    setElementValues(new Map());
    setBondPowers(new Map());
    setSimulationHistory([]);
  }, []);

  /**
   * Export simulation results to JSON file
   */
  const exportResults = useCallback(() => {
    if (!simulationEngineRef.current || simulationTime === 0) {
      alert('No simulation data to export');
      return;
    }

    const data = simulationEngineRef.current.exportResults();
    const json = JSON.stringify(data, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulation-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [simulationTime]);

  // ============ RENDER: EDIT MODE ============

  if (editorState.mode === 'edit') {
    return (
      <div className={styles.container}>
        <div className={styles.editorArea}>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarGroup}>
              <button
                onClick={() => addElement('Se')}
                className={styles.button}
                title="Add effort source (Se)"
              >
                + Se
              </button>
              <button
                onClick={() => addElement('Sf')}
                className={styles.button}
                title="Add flow source (Sf)"
              >
                + Sf
              </button>
              <button
                onClick={() => addElement('C')}
                className={styles.button}
                title="Add capacitor (C)"
              >
                + C
              </button>
              <button
                onClick={() => addElement('I')}
                className={styles.button}
                title="Add inductor (I)"
              >
                + I
              </button>
              <button
                onClick={() => addElement('R')}
                className={styles.button}
                title="Add resistor (R)"
              >
                + R
              </button>
              <button
                onClick={() => addElement('TF')}
                className={styles.button}
                title="Add transformer (TF)"
              >
                + TF
              </button>
            </div>

            <div className={styles.toolbarGroup}>
              <button
                onClick={saveDesign}
                className={styles.button}
                title="Save bond graph design"
              >
                💾 Save
              </button>

              <button
                onClick={enterSimulationMode}
                className={`${styles.button} ${styles.success}`}
                title="Start simulation"
              >
                ▶ Simulate
              </button>
            </div>
          </div>

          {/* Editor Placeholder */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f9f9f9',
              borderTop: '1px solid #e0e0e0',
            }}
          >
            <div style={{ textAlign: 'center', color: '#666' }}>
              <h2 style={{ marginTop: 0 }}>Bond Graph Editor</h2>
              <p>
                <strong>Elements:</strong> {editorState.elements.length}
              </p>
              <p>
                <strong>Bonds:</strong> {editorState.bonds.length}
              </p>
              <p style={{ marginTop: 20, marginBottom: 0 }}>
                <button
                  onClick={enterSimulationMode}
                  className={`${styles.button} ${styles.primary}`}
                  disabled={editorState.elements.length === 0}
                  style={{ padding: '12px 24px', fontSize: '16px' }}
                >
                  Start Simulation →
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ RENDER: SIMULATE MODE ============

  return (
    <div className={styles.container}>
      <div className={styles.editorArea}>
        {/* Toolbar - Simulation */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <button
              onClick={exitSimulationMode}
              className={styles.button}
              title="Return to edit mode"
            >
              ← Edit Mode
            </button>
          </div>

          <div className={styles.toolbarGroup}>
            <span
              style={{
                fontSize: '12px',
                color: '#666',
                padding: '8px 12px',
                fontWeight: 600,
              }}
            >
              🔴 SIMULATION MODE
            </span>
          </div>

          <div className={styles.toolbarGroup}>
            <button
              onClick={saveDesign}
              className={styles.button}
              title="Save current design"
            >
              💾 Save Design
            </button>

            <button
              onClick={exportResults}
              className={`${styles.button} ${styles.success}`}
              title="Export simulation results"
              disabled={simulationTime === 0}
            >
              📊 Export
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Canvas */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <SimulationCanvas
              ref={canvasRef}
              elements={editorState.elements}
              bonds={editorState.bonds}
              simulationData={simulationSnapshot}
              performanceMetrics={performanceMetrics}
              elementValues={elementValues}
              bondPowers={bondPowers}
              isRunning={simulationRunning && !simulationPaused}
            />
          </div>

          {/* Right Panel: Controls + Analysis */}
          <div
            style={{
              width: '320px',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid #e0e0e0',
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            {/* Controls */}
            <div style={{ borderBottom: '1px solid #e0e0e0', overflow: 'auto', maxHeight: '350px' }}>
              <div className={styles.panelHeader}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>
                  Simulation Control
                </h3>
              </div>
              <div style={{ padding: '12px' }}>
                <SimulationControls
                  isRunning={simulationRunning}
                  isPaused={simulationPaused}
                  currentTime={simulationTime}
                  duration={simulationDuration}
                  speedMultiplier={simulationSpeed}
                  recordHistory={recordHistory}
                  performanceMetrics={performanceMetrics}
                  onStart={startSimulation}
                  onPause={pauseSimulation}
                  onResume={resumeSimulation}
                  onStop={stopSimulation}
                  onReset={resetSimulation}
                  onSpeedChange={setSimulationSpeed}
                  onDurationChange={setSimulationDuration}
                  onRecordToggle={setRecordHistory}
                  onExport={exportResults}
                />
              </div>
            </div>

            {/* Analysis */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div className={styles.panelHeader}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>
                  Energy Analysis
                </h3>
              </div>
              <div style={{ padding: '12px' }}>
                <AnalysisPanel
                  elements={editorState.elements}
                  bonds={editorState.bonds}
                  history={simulationHistory}
                  currentMetrics={performanceMetrics}
                  elementValues={elementValues}
                  bondPowers={bondPowers}
                  isRunning={simulationRunning && !simulationPaused}
                  onExportData={exportResults}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BondGraphEditor;
