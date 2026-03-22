/**
 * Block Diagram Editor Component
 *
 * Simulink-style block diagram editor with transfer functions, control blocks,
 * and signal processing components. Supports simulation and frequency domain analysis.
 */

import React, { useReducer, useState, useCallback } from 'react';
import {
  BlockDiagramComponent,
  BlockDiagramConnection,
  SimulationResult,
  BlockDiagramComponentType,
  COMPONENT_PROPERTIES,
  DEFAULT_PARAMETERS,
  EditorState,
} from './types';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { PropertyPanel } from './PropertyPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { analyzeBlockDiagram, createBlockState, evaluateBlock } from './blockDiagramInteractions';
import styles from './BlockDiagramEditor.module.css';

/**
 * Action types for block diagram state management
 */
type Action =
  | { type: 'ADD_COMPONENT'; payload: BlockDiagramComponent }
  | { type: 'UPDATE_COMPONENT'; payload: BlockDiagramComponent }
  | { type: 'DELETE_COMPONENT'; payload: string }
  | { type: 'ADD_CONNECTION'; payload: BlockDiagramConnection }
  | { type: 'DELETE_CONNECTION'; payload: string }
  | { type: 'SELECT_COMPONENT'; payload: string }
  | { type: 'DESELECT_COMPONENT' }
  | { type: 'START_DRAG'; payload: string }
  | { type: 'STOP_DRAG' }
  | { type: 'START_CONNECTION'; payload: { fromId: string; fromPort: string } }
  | { type: 'COMPLETE_CONNECTION'; payload: BlockDiagramConnection }
  | { type: 'CANCEL_CONNECTION' }
  | { type: 'PAN'; payload: { x: number; y: number } }
  | { type: 'ZOOM'; payload: number }
  | { type: 'SET_MODE'; payload: 'select' | 'pan' }
  | { type: 'SET_SIMULATION_RESULT'; payload: SimulationResult | null };

/**
 * Initial editor state
 */
const initialState: EditorState = {
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
 * Reducer for block diagram state
 */
function blockDiagramReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'ADD_COMPONENT':
      return {
        ...state,
        components: [...state.components, action.payload],
      };

    case 'UPDATE_COMPONENT':
      return {
        ...state,
        components: state.components.map((c) => (c.id === action.payload.id ? action.payload : c)),
      };

    case 'DELETE_COMPONENT':
      return {
        ...state,
        components: state.components.filter((c) => c.id !== action.payload),
        connections: state.connections.filter(
          (conn) => conn.from !== action.payload && conn.to !== action.payload
        ),
        selectedComponentId: state.selectedComponentId === action.payload ? null : state.selectedComponentId,
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
        drawingConnection: { from: action.payload.fromId, fromPort: action.payload.fromPort },
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
        panX: state.panX + action.payload.x,
        panY: state.panY + action.payload.y,
      };

    case 'ZOOM':
      return {
        ...state,
        zoom: Math.max(0.5, Math.min(3.0, state.zoom * action.payload)),
      };

    case 'SET_MODE':
      // Mode setting for future UI controls
      return state;

    case 'SET_SIMULATION_RESULT':
      return {
        ...state,
        simulationResult: action.payload,
      };

    default:
      return state;
  }
}

/**
 * Main block diagram editor component
 */
export const BlockDiagramEditor: React.FC = () => {
  const [state, dispatch] = useReducer(blockDiagramReducer, initialState);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<'select' | 'pan'>('select');

  /**
   * Add a new component to the diagram
   */
  const handleComponentSelect = useCallback(
    (type: BlockDiagramComponentType) => {
      const id = `${type}-${Date.now()}`;
      const props = COMPONENT_PROPERTIES[type];
      const defaults = DEFAULT_PARAMETERS[type];

      const newComponent: BlockDiagramComponent = {
        id,
        type,
        name: props.label,
        position: { x: 100 + state.components.length * 50, y: 100 + state.components.length * 30 },
        parameters: defaults,
        ports: props.ports,
      };

      dispatch({ type: 'ADD_COMPONENT', payload: newComponent });
    },
    [state.components.length]
  );

  /**
   * Update component properties
   */
  const handleComponentUpdate = useCallback(
    (id: string, updates: Partial<BlockDiagramComponent>) => {
      const component = state.components.find((c) => c.id === id);
      if (!component) return;

      const updated = { ...component, ...updates };
      dispatch({ type: 'UPDATE_COMPONENT', payload: updated });
    },
    [state.components]
  );

  /**
   * Delete a component
   */
  const handleComponentDelete = useCallback((id: string) => {
    dispatch({ type: 'DELETE_COMPONENT', payload: id });
  }, []);

  /**
   * Handle component selection in canvas
   */
  const handleCanvasComponentClick = useCallback((componentId: string) => {
    dispatch({ type: 'SELECT_COMPONENT', payload: componentId });
  }, []);

  /**
   * Handle component drag
   */
  const handleCanvasComponentDrag = useCallback(
    (componentId: string, newPosition: { x: number; y: number }) => {
      const component = state.components.find((c) => c.id === componentId);
      if (component) {
        handleComponentUpdate(componentId, { position: newPosition });
      }
    },
    [state.components, handleComponentUpdate]
  );

  /**
   * Handle connection drawing
   */
  const handleConnectionDraw = useCallback(
    (from: string, fromPort: string, to: string, toPort: string) => {
      const connectionId = `${from}-${fromPort}-${to}-${toPort}`;

      const newConnection: BlockDiagramConnection = {
        id: connectionId,
        from,
        to,
        fromPort,
        toPort,
      };

      dispatch({ type: 'ADD_CONNECTION', payload: newConnection });
    },
    []
  );

  /**
   * Run simulation
   */
  const handleRunAnalysis = useCallback(() => {
    // Validate diagram
    const analysis = analyzeBlockDiagram(state.components, state.connections);

    if (!analysis.isValid) {
      setValidationErrors(analysis.errors);
      return;
    }

    setValidationErrors([]);

    // Simple simulation: evaluate each component once
    const blockState = createBlockState(state.components);
    const signals: { [componentId: string]: number[] } = {};

    // Initialize signal arrays
    state.components.forEach((comp) => {
      signals[comp.id] = [];
    });

    // Run simulation for 10 seconds with 100 time steps
    const dt = 0.1;
    const steps = 100;
    const time: number[] = [];

    for (let step = 0; step < steps; step++) {
      const currentTime = step * dt;
      time.push(currentTime);

      // Evaluate blocks in topological order
      for (const componentId of analysis.evaluationOrder) {
        const component = state.components.find((c) => c.id === componentId);
        if (!component) continue;

        // Gather inputs from connected components
        const inputs: { [portId: string]: number } = {};

        for (const conn of state.connections) {
          if (conn.to === componentId) {
            const fromComponent = state.components.find((c) => c.id === conn.from);
            if (fromComponent && blockState[conn.from]) {
              inputs[conn.toPort] = blockState[conn.from].value || 0;
            }
          }
        }

        // Evaluate block
        const output = evaluateBlock(component, inputs, blockState, dt);
        blockState[componentId].value = output;
        signals[componentId].push(output);
      }
    }

    const result: SimulationResult = {
      time,
      signals,
      finalState: {},
    };

    dispatch({ type: 'SET_SIMULATION_RESULT', payload: result });
  }, [state.components, state.connections]);

  /**
   * Selected component for property panel
   */
  const selectedComponent = state.selectedComponentId
    ? state.components.find((c) => c.id === state.selectedComponentId)
    : null;

  return (
    <div className={styles.blockDiagramEditor}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.controls}>
          <button
            className={`${styles.modeButton} ${mode === 'select' ? styles.active : ''}`}
            onClick={() => {
              setMode('select');
              dispatch({ type: 'SET_MODE', payload: 'select' });
            }}
            title="Select mode (S)"
          >
            ↖️ Select
          </button>
          <button
            className={`${styles.modeButton} ${mode === 'pan' ? styles.active : ''}`}
            onClick={() => {
              setMode('pan');
              dispatch({ type: 'SET_MODE', payload: 'pan' });
            }}
            title="Pan mode (P)"
          >
            ✋ Pan
          </button>
        </div>

        <div className={styles.info}>
          <span>{state.components.length} blocks</span>
          <span>{state.connections.length} connections</span>
          <span>Zoom: {(state.zoom * 100).toFixed(0)}%</span>
        </div>

        <button className={styles.analyzeButton} onClick={handleRunAnalysis}>
          Run Analysis
        </button>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className={styles.errorPanel}>
          <strong>Errors:</strong>
          <ul>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main editor area */}
      <div className={styles.editorContainer}>
        {/* Component palette */}
        <ComponentPalette onComponentSelect={handleComponentSelect} />

        {/* Canvas */}
        <Canvas
          components={state.components}
          connections={state.connections}
          selectedComponentId={state.selectedComponentId}
          panX={state.panX}
          panY={state.panY}
          zoom={state.zoom}
          onComponentClick={handleCanvasComponentClick}
          onComponentDrag={handleCanvasComponentDrag}
          onConnectionDraw={handleConnectionDraw}
          onPan={(dx, dy) => dispatch({ type: 'PAN', payload: { x: dx, y: dy } })}
          onZoom={(factor) => dispatch({ type: 'ZOOM', payload: factor })}
        />

        {/* Property panel */}
        <PropertyPanel
          selectedComponent={selectedComponent}
          onComponentUpdate={handleComponentUpdate}
          onComponentDelete={handleComponentDelete}
        />

        {/* Analysis panel */}
        <AnalysisPanel analysisData={state.simulationResult} onRunAnalysis={handleRunAnalysis} />
      </div>
    </div>
  );
};
