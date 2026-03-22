/**
 * Thermal Circuit Editor
 *
 * Visual editor for creating and simulating thermal networks with heat transfer,
 * thermal resistances, capacitances, and convection elements.
 */

import React, { useCallback, useReducer, useState, useEffect } from 'react'
import type { ThermalComponent, ThermalConnection, EditorState, SimulationState, AnalysisData } from './types'
import { getComponentBounds, distance } from './types'
import { Canvas } from './Canvas'
import { ComponentPalette } from './ComponentPalette'
import { PropertyPanel } from './PropertyPanel'
import { AnalysisPanel } from './AnalysisPanel'
import { validateThermalNetwork, analyzeNetwork } from './thermalInteractions'
import styles from './ThermalEditor.module.css'

export interface ThermalEditorProps {
  initialName?: string
  onDataChange?: (components: ThermalComponent[], connections: ThermalConnection[]) => void
  readOnly?: boolean
}

// Initial editor state
const initialEditorState: EditorState = {
  selectedComponent: null,
  selectedConnection: null,
  draggingComponent: null,
  drawingConnection: null,
  panX: 0,
  panY: 0,
  zoom: 1,
  mode: 'select',
}

type EditorAction =
  | { type: 'SELECT_COMPONENT'; payload: string | null }
  | { type: 'SELECT_CONNECTION'; payload: string | null }
  | { type: 'DRAG_COMPONENT'; payload: string | null }
  | { type: 'START_CONNECTION'; payload: string }
  | { type: 'END_CONNECTION'; payload: { from: string; to: string } | null }
  | { type: 'PAN'; payload: { x: number; y: number } }
  | { type: 'ZOOM'; payload: number }
  | { type: 'SET_MODE'; payload: 'select' | 'draw' | 'pan' }
  | { type: 'RESET' }

const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'SELECT_COMPONENT':
      return { ...state, selectedComponent: action.payload, selectedConnection: null }
    case 'SELECT_CONNECTION':
      return { ...state, selectedConnection: action.payload, selectedComponent: null }
    case 'DRAG_COMPONENT':
      return { ...state, draggingComponent: action.payload }
    case 'START_CONNECTION':
      return {
        ...state,
        drawingConnection: { fromId: action.payload, toId: null },
        mode: 'draw',
      }
    case 'END_CONNECTION':
      return {
        ...state,
        drawingConnection: null,
        mode: 'select',
      }
    case 'PAN':
      return {
        ...state,
        panX: state.panX + action.payload.x,
        panY: state.panY + action.payload.y,
      }
    case 'ZOOM':
      return { ...state, zoom: action.payload }
    case 'SET_MODE':
      return { ...state, mode: action.payload }
    case 'RESET':
      return initialEditorState
    default:
      return state
  }
}

export const ThermalEditor: React.FC<ThermalEditorProps> = ({ initialName = 'Thermal Circuit', onDataChange, readOnly }) => {
  const [components, setComponents] = useState<ThermalComponent[]>([
    {
      id: 'source-1',
      type: 'heat-source',
      name: 'Heat Source',
      position: { x: 100, y: 100 },
      parameters: { power: 100 },
    },
    {
      id: 'resist-1',
      type: 'thermal-resistance',
      name: 'Thermal Resistance',
      position: { x: 250, y: 100 },
      parameters: { resistance: 0.1 },
    },
    {
      id: 'ambient-1',
      type: 'ambient',
      name: 'Ambient',
      position: { x: 400, y: 100 },
      parameters: { temperature: 300 },
    },
  ])

  const [connections, setConnections] = useState<ThermalConnection[]>([
    {
      id: 'conn-1',
      from: 'source-1',
      to: 'resist-1',
      causality: 'flow-out',
      flow: 100,
    },
    {
      id: 'conn-2',
      from: 'resist-1',
      to: 'ambient-1',
      causality: 'flow-out',
      flow: 100,
    },
  ])

  const [editorState, dispatch] = useReducer(editorReducer, initialEditorState)
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    simulationTime: 0,
    timestep: 0.01,
    temperature: {},
    heatFlow: {},
  })
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [name] = useState(initialName)

  // Notify parent of changes
  useEffect(() => {
    onDataChange?.(components, connections)
  }, [components, connections, onDataChange])

  // Add new component
  const addComponent = useCallback(
    (type: ThermalComponent['type']) => {
      if (readOnly) return

      const newComponent: ThermalComponent = {
        id: `component-${Date.now()}`,
        type,
        name: type,
        position: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
        parameters: type === 'thermal-resistance' ? { resistance: 0.1 } : type === 'thermal-capacitance' ? { capacity: 1000 } : { power: 100 },
      }
      setComponents([...components, newComponent])
    },
    [components, readOnly]
  )

  // Update component parameters
  const updateComponent = useCallback(
    (id: string, updates: Partial<ThermalComponent>) => {
      if (readOnly) return
      setComponents(components.map(c => (c.id === id ? { ...c, ...updates } : c)))
    },
    [components, readOnly]
  )

  // Delete component
  const deleteComponent = useCallback(
    (id: string) => {
      if (readOnly) return
      setComponents(components.filter(c => c.id !== id))
      setConnections(connections.filter(conn => conn.from !== id && conn.to !== id))
      dispatch({ type: 'SELECT_COMPONENT', payload: null })
    },
    [components, connections, readOnly]
  )

  // Add connection
  const addConnection = useCallback(
    (from: string, to: string) => {
      if (readOnly) return
      if (from === to) return // No self-loops

      // Check if connection already exists
      if (connections.some(c => c.from === from && c.to === to)) return

      const newConnection: ThermalConnection = {
        id: `connection-${Date.now()}`,
        from,
        to,
        causality: 'flow-out',
      }
      setConnections([...connections, newConnection])
    },
    [connections, readOnly]
  )

  // Delete connection
  const deleteConnection = useCallback(
    (id: string) => {
      if (readOnly) return
      setConnections(connections.filter(c => c.id !== id))
      dispatch({ type: 'SELECT_CONNECTION', payload: null })
    },
    [connections, readOnly]
  )

  // Run steady-state analysis
  const runAnalysis = useCallback(() => {
    const validation = validateThermalNetwork(components, connections)
    if (!validation.valid) {
      console.warn('Invalid thermal network:', validation.errors)
      return
    }

    const analysis = analyzeNetwork(components, connections)
    setAnalysisData(analysis)

    // Update simulation state with steady-state results
    setSimulationState(prev => ({
      ...prev,
      temperature: analysis.steadyState.temperatures,
      heatFlow: analysis.steadyState.heatFlows,
    }))
  }, [components, connections])

  // Handle canvas interactions
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return

    // Check if clicking on a component
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const x = (e.clientX - rect.left) / editorState.zoom - editorState.panX
    const y = (e.clientY - rect.top) / editorState.zoom - editorState.panY

    for (const component of components) {
      const bounds = getComponentBounds(component)
      if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
        if (e.shiftKey) {
          // Start drawing connection
          dispatch({ type: 'START_CONNECTION', payload: component.id })
        } else {
          // Select component
          dispatch({ type: 'SELECT_COMPONENT', payload: component.id })
          dispatch({ type: 'DRAG_COMPONENT', payload: component.id })
        }
        return
      }
    }

    // Deselect if clicking on empty space
    dispatch({ type: 'SELECT_COMPONENT', payload: null })
    dispatch({ type: 'SELECT_CONNECTION', payload: null })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!editorState.draggingComponent && editorState.mode === 'select') return

    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const deltaX = (e.movementX / editorState.zoom) || 0
    const deltaY = (e.movementY / editorState.zoom) || 0

    if (editorState.draggingComponent) {
      updateComponent(editorState.draggingComponent, {
        position: {
          x: (components.find(c => c.id === editorState.draggingComponent)?.position.x || 0) + deltaX,
          y: (components.find(c => c.id === editorState.draggingComponent)?.position.y || 0) + deltaY,
        },
      })
    } else if (editorState.mode === 'pan') {
      dispatch({ type: 'PAN', payload: { x: deltaX, y: deltaY } })
    }
  }

  const handleCanvasMouseUp = () => {
    dispatch({ type: 'DRAG_COMPONENT', payload: null })
  }

  return (
    <div className={styles.thermalEditor}>
      <div className={styles.toolbar}>
        <h2>{name}</h2>
        <button onClick={runAnalysis} disabled={readOnly}>
          Analyze
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_MODE', payload: editorState.mode === 'pan' ? 'select' : 'pan' })}
          className={editorState.mode === 'pan' ? styles.active : ''}
        >
          Pan
        </button>
      </div>

      <div className={styles.editorContainer}>
        <ComponentPalette onAdd={addComponent} disabled={readOnly} />

        <div className={styles.canvasWrapper}>
          <Canvas
            components={components}
            connections={connections}
            editorState={editorState}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onComponentSelect={id => dispatch({ type: 'SELECT_COMPONENT', payload: id })}
            onComponentDelete={deleteComponent}
            onConnectionAdd={addConnection}
            onConnectionDelete={deleteConnection}
          />
        </div>

        <div className={styles.sidePanels}>
          <PropertyPanel
            component={components.find(c => c.id === editorState.selectedComponent) || null}
            connection={connections.find(c => c.id === editorState.selectedConnection) || null}
            onComponentUpdate={updateComponent}
            disabled={readOnly}
          />

          {analysisData && <AnalysisPanel data={analysisData} simulationState={simulationState} />}
        </div>
      </div>
    </div>
  )
}

export default ThermalEditor
