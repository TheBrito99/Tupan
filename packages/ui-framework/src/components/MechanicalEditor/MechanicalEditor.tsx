/**
 * Mechanical System Editor Component
 *
 * Interactive editor for designing and simulating mechanical systems.
 * Supports mass-spring-damper systems, constraints, and joints.
 */

import React, { useReducer, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  MechanicalComponentType,
  MechanicalComponent,
  MechanicalConnection,
  EditorState,
  SimulationState,
  AnalysisData,
  Position,
  DEFAULT_PARAMETERS,
} from './types';
import { validateMechanicalNetwork, analyzeNetwork } from './mechanicalInteractions';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { PropertyPanel } from './PropertyPanel';
import { AnalysisPanel } from './AnalysisPanel';
import styles from './MechanicalEditor.module.css';

interface MechanicalEditorProps {
  initialName?: string;
  onDataChange?: (data: { components: MechanicalComponent[]; connections: MechanicalConnection[] }) => void;
  readOnly?: boolean;
}

type EditorAction =
  | { type: 'SET_COMPONENTS'; payload: MechanicalComponent[] }
  | { type: 'SET_CONNECTIONS'; payload: MechanicalConnection[] }
  | { type: 'ADD_COMPONENT'; payload: MechanicalComponent }
  | { type: 'UPDATE_COMPONENT'; payload: { id: string; updates: Partial<MechanicalComponent> } }
  | { type: 'DELETE_COMPONENT'; payload: string }
  | { type: 'ADD_CONNECTION'; payload: MechanicalConnection }
  | { type: 'DELETE_CONNECTION'; payload: string }
  | { type: 'SET_SELECTED'; payload: string | null }
  | { type: 'SET_DRAGGING'; payload: string | null }
  | { type: 'START_CONNECTION'; payload: string }
  | { type: 'END_CONNECTION'; payload?: string }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_MODE'; payload: 'select' | 'pan' | 'connect' };

const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'SET_COMPONENTS':
      return { ...state, components: action.payload };
    case 'SET_CONNECTIONS':
      return { ...state, connections: action.payload };
    case 'ADD_COMPONENT':
      return { ...state, components: [...state.components, action.payload] };
    case 'UPDATE_COMPONENT':
      return {
        ...state,
        components: state.components.map((c) => (c.id === action.payload.id ? { ...c, ...action.payload.updates } : c)),
      };
    case 'DELETE_COMPONENT':
      return {
        ...state,
        components: state.components.filter((c) => c.id !== action.payload),
        connections: state.connections.filter((conn) => conn.from !== action.payload && conn.to !== action.payload),
        selectedComponentId: state.selectedComponentId === action.payload ? null : state.selectedComponentId,
      };
    case 'ADD_CONNECTION':
      return { ...state, connections: [...state.connections, action.payload] };
    case 'DELETE_CONNECTION':
      return { ...state, connections: state.connections.filter((c) => c.id !== action.payload) };
    case 'SET_SELECTED':
      return { ...state, selectedComponentId: action.payload };
    case 'SET_DRAGGING':
      return { ...state, draggingComponentId: action.payload };
    case 'START_CONNECTION':
      return { ...state, drawingConnection: { from: action.payload } };
    case 'END_CONNECTION':
      return { ...state, drawingConnection: null };
    case 'SET_PAN':
      return { ...state, panX: action.payload.x, panY: action.payload.y };
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    default:
      return state;
  }
};

export const MechanicalEditor: React.FC<MechanicalEditorProps> = ({
  initialName = 'Mechanical System',
  onDataChange,
  readOnly = false,
}) => {
  const [editorState, dispatch] = useReducer(editorReducer, {
    components: [
      {
        id: uuidv4(),
        type: 'ground',
        name: 'Ground',
        position: { x: 150, y: 400 },
        parameters: {},
      },
      {
        id: uuidv4(),
        type: 'mass',
        name: 'Mass 1',
        position: { x: 300, y: 250 },
        parameters: { mass: 1.0, inertia: 0.1 },
      },
      {
        id: uuidv4(),
        type: 'spring',
        name: 'Spring 1',
        position: { x: 225, y: 325 },
        parameters: { stiffness: 100, natural_length: 0.1 },
      },
    ],
    connections: [
      {
        id: uuidv4(),
        from: '',
        to: '',
        connection_type: 'spring',
        length: 0.5,
      },
    ],
    selectedComponentId: null,
    draggingComponentId: null,
    drawingConnection: null,
    panX: 0,
    panY: 0,
    zoom: 1.0,
    mode: 'select',
  });

  const [simulationState] = useState<SimulationState>({
    isRunning: false,
    currentTime: 0,
    timeStep: 0.001,
    simulationSpeed: 1.0,
  });

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Notify parent component of changes
  const handleStateChange = useCallback(() => {
    if (onDataChange) {
      onDataChange({
        components: editorState.components,
        connections: editorState.connections,
      });
    }
  }, [editorState.components, editorState.connections, onDataChange]);

  const addComponent = (type: MechanicalComponentType) => {
    const newComponent: MechanicalComponent = {
      id: uuidv4(),
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${editorState.components.length + 1}`,
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      parameters: DEFAULT_PARAMETERS[type],
    };
    dispatch({ type: 'ADD_COMPONENT', payload: newComponent });
  };

  const updateComponent = (id: string, updates: Partial<MechanicalComponent>) => {
    dispatch({ type: 'UPDATE_COMPONENT', payload: { id, updates } });
  };

  const deleteComponent = (id: string) => {
    dispatch({ type: 'DELETE_COMPONENT', payload: id });
  };

  const addConnection = (fromId: string, toId: string) => {
    if (fromId === toId) return; // Prevent self-loops
    if (editorState.connections.some((c) => c.from === fromId && c.to === toId)) return; // Prevent duplicates

    const fromComp = editorState.components.find((c) => c.id === fromId);
    const toComp = editorState.components.find((c) => c.id === toId);

    if (!fromComp || !toComp) return;

    const length = Math.sqrt(
      Math.pow(toComp.position.x - fromComp.position.x, 2) +
        Math.pow(toComp.position.y - fromComp.position.y, 2)
    );

    const newConnection: MechanicalConnection = {
      id: uuidv4(),
      from: fromId,
      to: toId,
      connection_type: 'rigid',
      length: length / 100, // Convert to meters (approx)
    };

    dispatch({ type: 'ADD_CONNECTION', payload: newConnection });
  };

  const deleteConnection = (id: string) => {
    dispatch({ type: 'DELETE_CONNECTION', payload: id });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
    const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;

    // Check if clicked on a component
    for (const comp of editorState.components) {
      if (Math.hypot(x - comp.position.x, y - comp.position.y) < 40) {
        dispatch({ type: 'SET_SELECTED', payload: comp.id });
        dispatch({ type: 'SET_DRAGGING', payload: comp.id });
        return;
      }
    }

    dispatch({ type: 'SET_SELECTED', payload: null });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editorState.draggingComponentId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
    const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;

    updateComponent(editorState.draggingComponentId, {
      position: { x, y },
    });
  };

  const handleCanvasMouseUp = () => {
    dispatch({ type: 'SET_DRAGGING', payload: null });
  };

  const handleComponentClick = (id: string) => {
    dispatch({ type: 'SET_SELECTED', payload: id });
  };

  const handleConnectionDraw = (fromId: string, e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    dispatch({ type: 'START_CONNECTION', payload: fromId });
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Validate network
      const validation = validateMechanicalNetwork(editorState.components, editorState.connections);
      if (!validation.valid) {
        console.warn('Network validation errors:', validation.errors);
        return;
      }

      // Analyze network
      const result = analyzeNetwork(editorState.components, editorState.connections);
      setAnalysisData(result);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button className={styles.toolbarButton} onClick={runAnalysis} disabled={isAnalyzing || readOnly}>
          {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
        <span className={styles.separator} />
        <span style={{ fontSize: '12px', color: '#666' }}>{initialName}</span>
      </div>

      <div className={styles.container}>
        <ComponentPalette onAddComponent={addComponent} />

        <Canvas
          components={editorState.components}
          connections={editorState.connections}
          selectedComponentId={editorState.selectedComponentId}
          draggingComponentId={editorState.draggingComponentId}
          drawingConnection={editorState.drawingConnection}
          panX={editorState.panX}
          panY={editorState.panY}
          zoom={editorState.zoom}
          onCanvasMouseDown={handleCanvasMouseDown}
          onCanvasMouseMove={handleCanvasMouseMove}
          onCanvasMouseUp={handleCanvasMouseUp}
          onComponentClick={handleComponentClick}
          onConnectionDraw={handleConnectionDraw}
        />

        <PropertyPanel
          selectedComponent={editorState.components.find((c) => c.id === editorState.selectedComponentId) || null}
          onComponentUpdate={updateComponent}
          onComponentDelete={deleteComponent}
        />

        <AnalysisPanel
          analysisData={analysisData}
          components={editorState.components}
          isAnalyzing={isAnalyzing}
          onRunAnalysis={runAnalysis}
        />
      </div>
    </div>
  );
};
