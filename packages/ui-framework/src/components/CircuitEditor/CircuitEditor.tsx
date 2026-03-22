/**
 * Circuit Editor Component
 *
 * SPICE-like electrical circuit editor with component schematic, DC operating point
 * analysis, transient simulation. Supports RLC networks with active components
 * (op-amps, diodes, switches, transformers).
 *
 * Architecture: 9-file pattern
 * - types.ts: Type definitions
 * - circuitInteractions.ts: Circuit analysis functions
 * - CircuitEditor.tsx: Main orchestrator (this file)
 * - Canvas.tsx: SVG schematic visualization
 * - ComponentPalette.tsx: Component selector
 * - PropertyPanel.tsx: Parameter editor
 * - AnalysisPanel.tsx: Results display
 * - CircuitEditor.module.css: Styling
 * - index.ts: Barrel export
 */

import React, { useReducer, useState, useCallback, useMemo } from 'react';
import {
  CircuitComponent,
  CircuitConnection,
  SimulationResult,
  CircuitComponentType,
  COMPONENT_PROPERTIES,
  DEFAULT_PARAMETERS,
  EditorState,
  AnalysisData,
  ValidationResult,
} from './types';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { PropertyPanel } from './PropertyPanel';
import { AnalysisPanel } from './AnalysisPanel';
import {
  validateCircuit,
  computeDCOperatingPoint,
  simulateCircuit,
  analyzeCircuit,
} from './circuitInteractions';
import styles from './CircuitEditor.module.css';

/**
 * Action types for circuit editor state management
 */
type CircuitAction =
  | { type: 'ADD_COMPONENT'; payload: CircuitComponent }
  | { type: 'UPDATE_COMPONENT'; payload: CircuitComponent }
  | { type: 'DELETE_COMPONENT'; payload: string }
  | { type: 'ADD_CONNECTION'; payload: CircuitConnection }
  | { type: 'DELETE_CONNECTION'; payload: string }
  | { type: 'SELECT_COMPONENT'; payload: string }
  | { type: 'DESELECT_COMPONENT' }
  | { type: 'START_DRAG'; payload: string }
  | { type: 'STOP_DRAG' }
  | { type: 'START_CONNECTION'; payload: { componentId: string; port: string } }
  | { type: 'COMPLETE_CONNECTION'; payload: CircuitConnection }
  | { type: 'CANCEL_CONNECTION' }
  | { type: 'PAN'; payload: { dx: number; dy: number } }
  | { type: 'ZOOM'; payload: number }
  | { type: 'SET_SIMULATION_RESULT'; payload: SimulationResult | null }
  | { type: 'SET_ANALYSIS_DATA'; payload: AnalysisData | null }
  | { type: 'SET_VALIDATION'; payload: ValidationResult };

/**
 * Initial editor state
 */
const initialCircuitState: EditorState = {
  components: [],
  connections: [],
  selectedComponentId: null,
  draggingComponentId: null,
  drawingConnection: null,
  panX: 0,
  panY: 0,
  zoom: 1.0,
  simulationRunning: false,
  simulationResult: null,
};

/**
 * Reducer for circuit editor state
 */
function circuitReducer(state: EditorState, action: CircuitAction): EditorState {
  switch (action.type) {
    case 'ADD_COMPONENT':
      return {
        ...state,
        components: [...state.components, action.payload],
      };

    case 'UPDATE_COMPONENT':
      return {
        ...state,
        components: state.components.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };

    case 'DELETE_COMPONENT':
      return {
        ...state,
        components: state.components.filter((c) => c.id !== action.payload),
        connections: state.connections.filter(
          (conn) => conn.id !== action.payload
        ),
        selectedComponentId:
          state.selectedComponentId === action.payload
            ? null
            : state.selectedComponentId,
      };

    case 'ADD_CONNECTION':
      return {
        ...state,
        connections: [...state.connections, action.payload],
      };

    case 'DELETE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter((c) => c.id !== action.payload),
      };

    case 'SELECT_COMPONENT':
      return {
        ...state,
        selectedComponentId: action.payload,
      };

    case 'DESELECT_COMPONENT':
      return {
        ...state,
        selectedComponentId: null,
      };

    case 'START_DRAG':
      return {
        ...state,
        draggingComponentId: action.payload,
      };

    case 'STOP_DRAG':
      return {
        ...state,
        draggingComponentId: null,
      };

    case 'START_CONNECTION':
      return {
        ...state,
        drawingConnection: {
          fromComponentId: action.payload.componentId,
          fromPort: action.payload.port,
        },
      };

    case 'COMPLETE_CONNECTION':
      return {
        ...state,
        connections: [...state.connections, action.payload],
        drawingConnection: null,
      };

    case 'CANCEL_CONNECTION':
      return {
        ...state,
        drawingConnection: null,
      };

    case 'PAN':
      return {
        ...state,
        panX: state.panX + action.payload.dx,
        panY: state.panY + action.payload.dy,
      };

    case 'ZOOM':
      return {
        ...state,
        zoom: Math.max(0.5, Math.min(3.0, state.zoom * action.payload)),
      };

    case 'SET_SIMULATION_RESULT':
      return {
        ...state,
        simulationResult: action.payload,
      };

    case 'SET_ANALYSIS_DATA':
      return {
        ...state,
        simulationResult: action.payload as any,
      };

    case 'SET_VALIDATION':
      return state;

    default:
      return state;
  }
}

/**
 * Main Circuit Editor Component
 */
export interface CircuitEditorProps {
  onComponentsChange?: (components: CircuitComponent[]) => void;
  onConnectionsChange?: (connections: CircuitConnection[]) => void;
  onValidationChange?: (validation: ValidationResult) => void;
  onAnalysisChange?: (analysis: SimulationResult | null) => void;
}
export const CircuitEditor: React.FC<CircuitEditorProps> = ({
  onComponentsChange,
  onConnectionsChange,
  onValidationChange,
  onAnalysisChange,
}) => {
  const [state, dispatch] = useReducer(circuitReducer, initialCircuitState);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  // Validate circuit whenever components or connections change
  const handleValidation = useCallback(() => {
    const result = validateCircuit(state.components, state.connections);
    setValidation(result);
    onValidationChange?.(result);
  }, [state.components, state.connections, onValidationChange]);

  // Add component handler
  const handleAddComponent = useCallback(
    (componentType: CircuitComponentType) => {
      const newComponent: CircuitComponent = {
        id: `${componentType}-${Date.now()}`,
        type: componentType,
        name: `${COMPONENT_PROPERTIES[componentType].name} ${state.components.length + 1}`,
        node1: 'n0',
        node2: 'n1',
        parameters: { ...DEFAULT_PARAMETERS[componentType] },
      };

      dispatch({ type: 'ADD_COMPONENT', payload: newComponent });
      onComponentsChange?.([...state.components, newComponent]);
    },
    [state.components.length, onComponentsChange]
  );

  // Update component handler
  const handleUpdateComponent = useCallback(
    (component: CircuitComponent) => {
      dispatch({ type: 'UPDATE_COMPONENT', payload: component });
      const updated = state.components.map((c) =>
        c.id === component.id ? component : c
      );
      onComponentsChange?.(updated);
    },
    [state.components, onComponentsChange]
  );

  // Delete component handler
  const handleDeleteComponent = useCallback(
    (componentId: string) => {
      dispatch({ type: 'DELETE_COMPONENT', payload: componentId });
      const updated = state.components.filter((c) => c.id !== componentId);
      onComponentsChange?.(updated);
    },
    [state.components, onComponentsChange]
  );

  // Add connection handler
  const handleAddConnection = useCallback(
    (connection: CircuitConnection) => {
      dispatch({ type: 'ADD_CONNECTION', payload: connection });
      const updated = [...state.connections, connection];
      onConnectionsChange?.(updated);
    },
    [state.connections, onConnectionsChange]
  );

  // Delete connection handler
  const handleDeleteConnection = useCallback(
    (connectionId: string) => {
      dispatch({ type: 'DELETE_CONNECTION', payload: connectionId });
      const updated = state.connections.filter((c) => c.id !== connectionId);
      onConnectionsChange?.(updated);
    },
    [state.connections, onConnectionsChange]
  );

  // Run DC analysis
  const handleRunAnalysis = useCallback(() => {
    if (!validation?.isValid) {
      return;
    }

    const analysis = computeDCOperatingPoint(
      state.components,
      state.connections
    );
    setAnalysisData(analysis);
    dispatch({ type: 'SET_ANALYSIS_DATA', payload: analysis });
    onAnalysisChange?.(analysis as any);
  }, [
    validation,
    state.components,
    state.connections,
    onAnalysisChange,
  ]);

  // Run transient simulation
  const handleRunSimulation = useCallback(() => {
    if (!validation?.isValid) {
      return;
    }

    const result = simulateCircuit(
      state.components,
      state.connections,
      1.0,
      100
    );
    dispatch({ type: 'SET_SIMULATION_RESULT', payload: result });
    onAnalysisChange?.(result as any);
  }, [validation, state.components, state.connections, onAnalysisChange]);

  // Trigger validation whenever components/connections change
  useMemo(() => {
    handleValidation();
  }, [state.components, state.connections, handleValidation]);

  // Select component handler
  const handleSelectComponent = useCallback((componentId: string) => {
    dispatch({ type: 'SELECT_COMPONENT', payload: componentId });
  }, []);

  // Pan handler
  const handlePan = useCallback((dx: number, dy: number) => {
    dispatch({ type: 'PAN', payload: { dx, dy } });
  }, []);

  // Zoom handler
  const handleZoom = useCallback((scale: number) => {
    dispatch({ type: 'ZOOM', payload: scale });
  }, []);

  return (
    <div className={styles.circuitEditor}>
      {/* Toolbar with analysis buttons */}
      <div className={styles.toolbar}>
        <div className={styles.controls}>
          <button
            className={styles.modeButton}
            onClick={handleRunAnalysis}
            disabled={!validation?.isValid}
            title="DC operating point analysis"
          >
            🔬 Analyze
          </button>
          <button
            className={styles.modeButton}
            onClick={handleRunSimulation}
            disabled={!validation?.isValid}
            title="Transient simulation"
          >
            ▶️ Simulate
          </button>
        </div>

        <div className={styles.info}>
          <span>{state.components.length} components</span>
          <span>{state.connections.length} connections</span>
        </div>
      </div>

      {/* Error panel if validation fails */}
      {validation && !validation.isValid && (
        <div className={styles.errorPanel}>
          <strong>Circuit Issues:</strong>
          <ul>
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main editor grid */}
      <div className={styles.editorContainer}>
        {/* Component palette */}
        <ComponentPalette onComponentAdd={handleAddComponent} />

        {/* Canvas */}
        <div className={styles.canvasContainer}>
          <Canvas
            components={state.components}
            connections={state.connections}
            selectedComponentId={state.selectedComponentId}
            drawingConnection={state.drawingConnection}
            panX={state.panX}
            panY={state.panY}
            zoom={state.zoom}
            onComponentSelect={handleSelectComponent}
            onComponentDelete={handleDeleteComponent}
            onComponentDrag={(componentId, x, y) => {
              const updated = state.components.map((c) =>
                c.id === componentId ? { ...c } : c
              );
              dispatch({ type: 'UPDATE_COMPONENT', payload: updated[0] });
            }}
            onConnectionStart={(componentId, port) => {
              dispatch({
                type: 'START_CONNECTION',
                payload: { componentId, port },
              });
            }}
            onConnectionComplete={(connection) => {
              dispatch({
                type: 'COMPLETE_CONNECTION',
                payload: connection,
              });
              handleAddConnection(connection);
            }}
            onConnectionCancel={() => {
              dispatch({ type: 'CANCEL_CONNECTION' });
            }}
            onConnectionDelete={handleDeleteConnection}
            onPan={handlePan}
            onZoom={handleZoom}
          />
        </div>

        {/* Property panel */}
        <PropertyPanel
          component={
            state.selectedComponentId
              ? state.components.find((c) => c.id === state.selectedComponentId)
              : undefined
          }
          onComponentUpdate={handleUpdateComponent}
          onComponentDelete={handleDeleteComponent}
        />

        {/* Analysis results panel */}
        <AnalysisPanel
          analysisData={analysisData}
          simulationResult={state.simulationResult}
          onRunAnalysis={handleRunAnalysis}
          onRunSimulation={handleRunSimulation}
        />
      </div>
    </div>
  );
};

export default CircuitEditor;
