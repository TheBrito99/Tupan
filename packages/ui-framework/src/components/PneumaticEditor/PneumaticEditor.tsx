import React, { useReducer, useRef, useState } from 'react';
import {
  PneumaticComponent,
  PneumaticConnection,
  EditorState,
  AnalysisData,
  DEFAULT_PARAMETERS,
} from './types';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { PropertyPanel } from './PropertyPanel';
import { AnalysisPanel } from './AnalysisPanel';
import {
  analyzePneumaticNetwork,
  validatePneumaticNetwork,
} from './pneumaticInteractions';
import styles from './PneumaticEditor.module.css';

interface EditorAction {
  type:
    | 'ADD_COMPONENT'
    | 'UPDATE_COMPONENT'
    | 'DELETE_COMPONENT'
    | 'ADD_CONNECTION'
    | 'DELETE_CONNECTION'
    | 'SELECT_COMPONENT'
    | 'DESELECT_COMPONENT'
    | 'START_DRAG'
    | 'STOP_DRAG'
    | 'START_CONNECTION'
    | 'COMPLETE_CONNECTION'
    | 'CANCEL_CONNECTION'
    | 'PAN'
    | 'ZOOM'
    | 'SET_MODE'
    | 'RUN_ANALYSIS';
  payload?: any;
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'ADD_COMPONENT': {
      const component: PneumaticComponent = {
        id: `component-${Date.now()}`,
        type: action.payload.type,
        name: `${action.payload.type}-${Math.random().toString(36).substr(2, 9)}`,
        position: {
          x: 200 + Math.random() * 100,
          y: 200 + Math.random() * 100,
        },
        parameters: { ...DEFAULT_PARAMETERS[action.payload.type] },
      };
      return {
        ...state,
        components: [...state.components, component],
      };
    }

    case 'UPDATE_COMPONENT': {
      return {
        ...state,
        components: state.components.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload.updates } : c
        ),
      };
    }

    case 'DELETE_COMPONENT': {
      return {
        ...state,
        components: state.components.filter((c) => c.id !== action.payload),
        connections: state.connections.filter(
          (conn) =>
            conn.from !== action.payload && conn.to !== action.payload
        ),
        selectedComponentId:
          state.selectedComponentId === action.payload
            ? null
            : state.selectedComponentId,
      };
    }

    case 'ADD_CONNECTION': {
      const connection: PneumaticConnection = {
        id: `connection-${Date.now()}`,
        from: action.payload.from,
        to: action.payload.to,
        connection_type: 'pipe',
        length: 1.0,
        diameter: 10.0,
      };
      return {
        ...state,
        connections: [...state.connections, connection],
        drawingConnection: null,
      };
    }

    case 'DELETE_CONNECTION': {
      return {
        ...state,
        connections: state.connections.filter((c) => c.id !== action.payload),
      };
    }

    case 'SELECT_COMPONENT': {
      return {
        ...state,
        selectedComponentId: action.payload,
      };
    }

    case 'DESELECT_COMPONENT': {
      return {
        ...state,
        selectedComponentId: null,
      };
    }

    case 'START_DRAG': {
      return {
        ...state,
        draggingComponentId: action.payload,
      };
    }

    case 'STOP_DRAG': {
      return {
        ...state,
        draggingComponentId: null,
      };
    }

    case 'START_CONNECTION': {
      return {
        ...state,
        drawingConnection: { from: action.payload },
      };
    }

    case 'COMPLETE_CONNECTION': {
      if (
        state.drawingConnection &&
        state.drawingConnection.from !== action.payload
      ) {
        return {
          ...state,
          connections: [
            ...state.connections,
            {
              id: `connection-${Date.now()}`,
              from: state.drawingConnection.from,
              to: action.payload,
              connection_type: 'pipe',
              length: 1.0,
              diameter: 10.0,
            },
          ],
          drawingConnection: null,
        };
      }
      return state;
    }

    case 'CANCEL_CONNECTION': {
      return {
        ...state,
        drawingConnection: null,
      };
    }

    case 'PAN': {
      return {
        ...state,
        panX: state.panX + action.payload.dx,
        panY: state.panY + action.payload.dy,
      };
    }

    case 'ZOOM': {
      const newZoom = Math.max(0.1, Math.min(3, state.zoom + action.payload));
      return {
        ...state,
        zoom: newZoom,
      };
    }

    case 'SET_MODE': {
      return {
        ...state,
        mode: action.payload,
      };
    }

    case 'RUN_ANALYSIS': {
      return {
        ...state,
        analysisData: action.payload,
      };
    }

    default:
      return state;
  }
}

interface PneumaticEditorProps {
  onAnalysisComplete?: (data: AnalysisData) => void;
}

export const PneumaticEditor: React.FC<PneumaticEditorProps> = ({
  onAnalysisComplete,
}) => {
  const initialState: EditorState = {
    components: [],
    connections: [],
    selectedComponentId: null,
    draggingComponentId: null,
    drawingConnection: null,
    panX: 0,
    panY: 0,
    zoom: 1,
    mode: 'select',
  };

  const [state, dispatch] = useReducer(editorReducer, initialState);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const canvasRef = useRef<SVGSVGElement>(null);

  const handleAddComponent = (type: any) => {
    dispatch({ type: 'ADD_COMPONENT', payload: { type } });
  };

  const handleComponentClick = (id: string) => {
    dispatch({ type: 'SELECT_COMPONENT', payload: id });
  };

  const handleComponentUpdate = (
    id: string,
    updates: Partial<PneumaticComponent>
  ) => {
    dispatch({ type: 'UPDATE_COMPONENT', payload: { id, updates } });
  };

  const handleComponentDelete = (id: string) => {
    dispatch({ type: 'DELETE_COMPONENT', payload: id });
  };

  const handleConnectionDraw = (fromId: string) => {
    dispatch({ type: 'START_CONNECTION', payload: fromId });
  };

  const handleConnectionComplete = (toId: string) => {
    dispatch({ type: 'COMPLETE_CONNECTION', payload: toId });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;

    const component = state.components.find((c) => {
      const bounds = {
        x: c.position.x - 35,
        y: c.position.y - 25,
        width: 70,
        height: 50,
      };
      return (
        e.clientX >= bounds.x &&
        e.clientX <= bounds.x + bounds.width &&
        e.clientY >= bounds.y &&
        e.clientY <= bounds.y + bounds.height
      );
    });

    if (component) {
      dispatch({ type: 'START_DRAG', payload: component.id });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (state.draggingComponentId && e.buttons === 1) {
      const component = state.components.find(
        (c) => c.id === state.draggingComponentId
      );
      if (component) {
        handleComponentUpdate(state.draggingComponentId, {
          position: {
            x: component.position.x + e.movementX / state.zoom,
            y: component.position.y + e.movementY / state.zoom,
          },
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    dispatch({ type: 'STOP_DRAG' });
  };

  const handleRunAnalysis = () => {
    const errors = validatePneumaticNetwork(state.components, state.connections);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);

    try {
      const results = analyzePneumaticNetwork(state.components, state.connections);
      setAnalysisData(results);
      dispatch({ type: 'RUN_ANALYSIS', payload: results });
      onAnalysisComplete?.(results);
    } catch (error) {
      setValidationErrors([
        `Analysis failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      ]);
    }
  };

  const selectedComponent = state.selectedComponentId
    ? state.components.find((c) => c.id === state.selectedComponentId)
    : null;

  return (
    <div className={styles.pneumaticEditor}>
      <div className={styles.toolbar}>
        <button
          onClick={() => dispatch({ type: 'SET_MODE', payload: 'select' })}
          className={state.mode === 'select' ? styles.active : ''}
        >
          Select
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_MODE', payload: 'pan' })}
          className={state.mode === 'pan' ? styles.active : ''}
        >
          Pan
        </button>
        <button onClick={handleRunAnalysis} className={styles.analyzeButton}>
          Run Analysis
        </button>
        <span className={styles.zoom}>
          Zoom: {Math.round(state.zoom * 100)}%
        </span>
      </div>

      {validationErrors.length > 0 && (
        <div className={styles.errorPanel}>
          <strong>Validation Errors:</strong>
          <ul>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.editorLayout}>
        <ComponentPalette onAddComponent={handleAddComponent} />

        <Canvas
          ref={canvasRef}
          components={state.components}
          connections={state.connections}
          selectedComponentId={state.selectedComponentId}
          draggingComponentId={state.draggingComponentId}
          drawingConnection={state.drawingConnection}
          panX={state.panX}
          panY={state.panY}
          zoom={state.zoom}
          onCanvasMouseDown={handleCanvasMouseDown}
          onCanvasMouseMove={handleCanvasMouseMove}
          onCanvasMouseUp={handleCanvasMouseUp}
          onComponentClick={handleComponentClick}
          onConnectionDraw={handleConnectionDraw}
          onConnectionComplete={handleConnectionComplete}
        />

        <PropertyPanel
          selectedComponent={selectedComponent}
          onComponentUpdate={handleComponentUpdate}
          onComponentDelete={handleComponentDelete}
        />

        {analysisData && (
          <AnalysisPanel
            analysisData={analysisData}
            onRunAnalysis={handleRunAnalysis}
          />
        )}
      </div>
    </div>
  );
};
