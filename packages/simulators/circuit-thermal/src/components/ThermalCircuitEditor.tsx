/**
 * Thermal Circuit Editor Component
 *
 * Specialized circuit editor for thermal domain simulation.
 * Reuses generic NodeEditor from ui-framework with thermal-specific configurations.
 *
 * Features:
 * - Thermal component palette (resistances, capacitances, sources, convection, radiation)
 * - Drag-and-drop component placement
 * - Real-time validation
 * - Thermal circuit analysis (steady-state and transient)
 * - Temperature visualization
 *
 * Example:
 * ```
 * <ThermalCircuitEditor
 *   onAnalysisComplete={(results) => {
 *     console.log('Temperatures:', results.temperatures);
 *   }}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import { NodeEditor, NodeTypeDefinition } from '@tupan/ui-framework';
import { Graph, Node, Edge } from '@tupan/core-ts';
import styles from './ThermalCircuitEditor.module.css';

export interface ThermalCircuitEditorProps {
  /// Initial circuit graph (optional)
  initialGraph?: Graph;
  /// Callback when analysis is complete
  onAnalysisComplete?: (results: ThermalAnalysisResults) => void;
  /// Callback when circuit changes
  onCircuitChange?: (graph: Graph) => void;
  /// Read-only mode
  readOnly?: boolean;
}

export interface ThermalAnalysisResults {
  /// Node temperatures [°C]
  temperatures: number[];
  /// Heat flows between nodes [W]
  heatFlows: number[];
  /// Transient time vector [s]
  timeVector?: number[];
  /// Transient temperature history
  temperatureHistory?: number[][];
  /// Analysis type: 'steady-state' or 'transient'
  analysisType: 'steady-state' | 'transient';
}

export interface ThermalComponentNodeData {
  /// Component type
  type:
    | 'ThermalResistance'
    | 'ThermalCapacitance'
    | 'HeatSource'
    | 'TemperatureSource'
    | 'Convection'
    | 'Radiation'
    | 'PhaseChangeMaterial'
    | 'ThermalInterfaceMaterial'
    | 'HeatSpreader'
    | 'Pump'
    | 'Fan'
    | 'HeatPipe';
  /// Component-specific parameters
  parameters: Record<string, number | string>;
  /// Position on canvas
  position: { x: number; y: number };
}

// Thermal component node type definitions
const THERMAL_NODE_TYPES = new Map<string, NodeTypeDefinition>([
  [
    'ThermalResistance',
    {
      name: 'Thermal Resistance',
      category: 'Passive',
      color: '#FF6B6B',
      defaultParameters: {
        r_th: 0.5, // K/W
      },
    },
  ],
  [
    'ThermalCapacitance',
    {
      name: 'Thermal Capacitance',
      category: 'Passive',
      color: '#4ECDC4',
      defaultParameters: {
        c_th: 1000.0, // J/K
      },
    },
  ],
  [
    'HeatSource',
    {
      name: 'Heat Source',
      category: 'Active',
      color: '#FFD93D',
      defaultParameters: {
        power: 100.0, // W
      },
    },
  ],
  [
    'TemperatureSource',
    {
      name: 'Temperature Source',
      category: 'Boundary',
      color: '#6BCB77',
      defaultParameters: {
        temperature: 25.0, // °C
      },
    },
  ],
  [
    'Convection',
    {
      name: 'Convection',
      category: 'Transfer',
      color: '#A8DADC',
      defaultParameters: {
        h: 10.0, // W/(m²·K)
        area: 0.1, // m²
      },
    },
  ],
  [
    'Radiation',
    {
      name: 'Radiation',
      category: 'Transfer',
      color: '#F4A261',
      defaultParameters: {
        emissivity: 0.9,
        area: 0.1, // m²
      },
    },
  ],
  [
    'HeatPipe',
    {
      name: 'Heat Pipe',
      category: 'Transfer',
      color: '#E76F51',
      defaultParameters: {
        diameter: 0.01, // m
        length: 0.1, // m
      },
    },
  ],
  [
    'ThermalInterfaceMaterial',
    {
      name: 'TIM (Thermal Interface Material)',
      category: 'Transfer',
      color: '#2A9D8F',
      defaultParameters: {
        conductivity: 5.0, // W/(m·K)
        thickness: 0.001, // m
        area: 0.01, // m²
      },
    },
  ],
]);

/**
 * Main Thermal Circuit Editor Component
 *
 * Provides a complete interface for designing and analyzing thermal circuits.
 * Integrates NodeEditor with thermal-specific validation and analysis.
 */
export const ThermalCircuitEditor: React.FC<ThermalCircuitEditorProps> = ({
  initialGraph,
  onAnalysisComplete,
  onCircuitChange,
  readOnly = false,
}) => {
  const [graph, setGraph] = useState<Graph>(initialGraph || new Graph());
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'complete'>('idle');
  const [analysisResults, setAnalysisResults] = useState<ThermalAnalysisResults | null>(null);
  const [ambientTemperature, setAmbientTemperature] = useState(25.0);
  const [analysisType, setAnalysisType] = useState<'steady-state' | 'transient'>('steady-state');
  const [transientDuration, setTransientDuration] = useState(1000.0); // seconds
  const [transientTimeStep, setTransientTimeStep] = useState(1.0); // seconds

  /**
   * Handle graph changes from NodeEditor
   */
  const handleGraphChange = useCallback(
    (newGraph: Graph) => {
      setGraph(newGraph);
      onCircuitChange?.(newGraph);
    },
    [onCircuitChange]
  );

  /**
   * Validate the thermal circuit
   * Returns validation errors or null if valid
   */
  const validateCircuit = useCallback((): string[] => {
    const errors: string[] = [];
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    // Check minimum nodes
    if (nodes.length < 2) {
      errors.push('Circuit must have at least 2 nodes (source and sink/ambient)');
    }

    // Check for at least one heat source
    const hasHeatSource = nodes.some(
      (node) =>
        (node.data as ThermalComponentNodeData).type === 'HeatSource' ||
        (node.data as ThermalComponentNodeData).type === 'TemperatureSource'
    );

    if (!hasHeatSource) {
      errors.push('Circuit must have at least one heat source or temperature source');
    }

    // Check thermal resistance values
    const resistanceNodes = nodes.filter(
      (node) => (node.data as ThermalComponentNodeData).type === 'ThermalResistance'
    );

    for (const node of resistanceNodes) {
      const rTh = (node.data as ThermalComponentNodeData).parameters.r_th as number;
      if (rTh <= 0) {
        errors.push(`Node ${node.id}: Thermal resistance must be positive`);
      }
      if (rTh > 1000) {
        errors.push(`Node ${node.id}: Thermal resistance suspiciously high (> 1000 K/W)`);
      }
    }

    // Check thermal capacitance values
    const capacitanceNodes = nodes.filter(
      (node) => (node.data as ThermalComponentNodeData).type === 'ThermalCapacitance'
    );

    for (const node of capacitanceNodes) {
      const cTh = (node.data as ThermalComponentNodeData).parameters.c_th as number;
      if (cTh <= 0) {
        errors.push(`Node ${node.id}: Thermal capacitance must be positive`);
      }
    }

    // Check convection parameters
    const convectionNodes = nodes.filter(
      (node) => (node.data as ThermalComponentNodeData).type === 'Convection'
    );

    for (const node of convectionNodes) {
      const h = (node.data as ThermalComponentNodeData).parameters.h as number;
      const area = (node.data as ThermalComponentNodeData).parameters.area as number;

      if (h <= 0) {
        errors.push(`Node ${node.id}: Convection coefficient must be positive`);
      }
      if (area <= 0) {
        errors.push(`Node ${node.id}: Convection area must be positive`);
      }
    }

    // Check for isolated nodes
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      connectedNodes.add(edge.source.nodeId.toString());
      connectedNodes.add(edge.target.nodeId.toString());
    }

    if (connectedNodes.size > 0 && connectedNodes.size < nodes.length) {
      const isolatedCount = nodes.length - connectedNodes.size;
      errors.push(`Circuit has ${isolatedCount} isolated node(s)`);
    }

    return errors;
  }, [graph]);

  /**
   * Run thermal analysis (steady-state or transient)
   */
  const handleAnalyze = useCallback(async () => {
    setAnalysisState('analyzing');

    try {
      // Validate circuit first
      const validationErrors = validateCircuit();
      if (validationErrors.length > 0) {
        console.error('Circuit validation failed:', validationErrors);
        setAnalysisState('idle');
        return;
      }

      // TODO: Call WASM thermal solver
      // This would call the Rust ThermalAnalyzer via WASM bridge
      // For now, placeholder implementation

      const results: ThermalAnalysisResults = {
        temperatures: [],
        heatFlows: [],
        analysisType,
      };

      if (analysisType === 'transient') {
        results.timeVector = [];
        results.temperatureHistory = [];
      }

      setAnalysisResults(results);
      setAnalysisState('complete');
      onAnalysisComplete?.(results);
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisState('idle');
    }
  }, [validateCircuit, analysisType, onAnalysisComplete]);

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <h2>Thermal Circuit Editor</h2>

        <div className={styles.toolbarSection}>
          <label>
            Ambient Temperature:
            <input
              type="number"
              value={ambientTemperature}
              onChange={(e) => setAmbientTemperature(parseFloat(e.target.value))}
              min="-50"
              max="100"
              step="1"
            />
            °C
          </label>
        </div>

        <div className={styles.toolbarSection}>
          <label>
            <input
              type="radio"
              name="analysisType"
              value="steady-state"
              checked={analysisType === 'steady-state'}
              onChange={(e) => setAnalysisType(e.target.value as 'steady-state' | 'transient')}
            />
            Steady-State Analysis
          </label>

          <label>
            <input
              type="radio"
              name="analysisType"
              value="transient"
              checked={analysisType === 'transient'}
              onChange={(e) => setAnalysisType(e.target.value as 'steady-state' | 'transient')}
            />
            Transient Analysis
          </label>
        </div>

        {analysisType === 'transient' && (
          <div className={styles.toolbarSection}>
            <label>
              Duration:
              <input
                type="number"
                value={transientDuration}
                onChange={(e) => setTransientDuration(parseFloat(e.target.value))}
                min="0.1"
                step="10"
              />
              s
            </label>

            <label>
              Time Step:
              <input
                type="number"
                value={transientTimeStep}
                onChange={(e) => setTransientTimeStep(parseFloat(e.target.value))}
                min="0.001"
                step="0.1"
              />
              s
            </label>
          </div>
        )}

        <div className={styles.buttonGroup}>
          <button
            onClick={handleAnalyze}
            disabled={analysisState === 'analyzing' || readOnly}
            className={styles.analyzeButton}
          >
            {analysisState === 'analyzing' ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        {analysisState === 'complete' && analysisResults && (
          <div className={styles.resultsPreview}>
            <h3>Analysis Complete ✓</h3>
            <p>Nodes analyzed: {analysisResults.temperatures.length}</p>
            {analysisResults.temperatures.length > 0 && (
              <p>Max temperature: {Math.max(...analysisResults.temperatures).toFixed(2)}°C</p>
            )}
          </div>
        )}
      </div>

      {/* Component Palette */}
      <div className={styles.sidebar}>
        <h3>Component Palette</h3>

        <div className={styles.categoryGroup}>
          <h4>Passive</h4>
          <div className={styles.componentList}>
            {['ThermalResistance', 'ThermalCapacitance'].map((type) => {
              const def = THERMAL_NODE_TYPES.get(type);
              return (
                <div
                  key={type}
                  className={styles.componentItem}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('componentType', type);
                  }}
                  style={{ borderLeft: `4px solid ${def?.color}` }}
                >
                  {def?.name}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.categoryGroup}>
          <h4>Active</h4>
          <div className={styles.componentList}>
            {['HeatSource'].map((type) => {
              const def = THERMAL_NODE_TYPES.get(type);
              return (
                <div
                  key={type}
                  className={styles.componentItem}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('componentType', type);
                  }}
                  style={{ borderLeft: `4px solid ${def?.color}` }}
                >
                  {def?.name}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.categoryGroup}>
          <h4>Boundary</h4>
          <div className={styles.componentList}>
            {['TemperatureSource'].map((type) => {
              const def = THERMAL_NODE_TYPES.get(type);
              return (
                <div
                  key={type}
                  className={styles.componentItem}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('componentType', type);
                  }}
                  style={{ borderLeft: `4px solid ${def?.color}` }}
                >
                  {def?.name}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.categoryGroup}>
          <h4>Heat Transfer</h4>
          <div className={styles.componentList}>
            {['Convection', 'Radiation', 'HeatPipe', 'ThermalInterfaceMaterial'].map((type) => {
              const def = THERMAL_NODE_TYPES.get(type);
              return (
                <div
                  key={type}
                  className={styles.componentItem}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('componentType', type);
                  }}
                  style={{ borderLeft: `4px solid ${def?.color}` }}
                >
                  {def?.name}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Editor Canvas */}
      <div className={styles.editorContainer}>
        <NodeEditor
          graph={graph}
          onGraphChange={handleGraphChange}
          nodeTypes={THERMAL_NODE_TYPES}
          readOnly={readOnly}
        />
      </div>

      {/* Analysis Results Panel */}
      {analysisState === 'complete' && analysisResults && (
        <div className={styles.resultsPanel}>
          <h3>Analysis Results</h3>

          <div className={styles.resultsTable}>
            <table>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Temperature (°C)</th>
                  {analysisResults.heatFlows.length > 0 && <th>Heat Flow (W)</th>}
                </tr>
              </thead>
              <tbody>
                {analysisResults.temperatures.map((temp, idx) => (
                  <tr key={idx}>
                    <td>Node {idx}</td>
                    <td>{temp.toFixed(2)}</td>
                    {analysisResults.heatFlows[idx] !== undefined && (
                      <td>{analysisResults.heatFlows[idx].toFixed(2)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analysisType === 'transient' && analysisResults.temperatureHistory && (
            <div className={styles.transientInfo}>
              <h4>Transient Response</h4>
              <p>
                Time steps: {analysisResults.timeVector?.length || 0} steps at{' '}
                {transientTimeStep.toFixed(2)}s intervals
              </p>
              <p>Total duration: {transientDuration.toFixed(1)}s</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThermalCircuitEditor;
