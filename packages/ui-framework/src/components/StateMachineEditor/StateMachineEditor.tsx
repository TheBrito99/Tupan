/**
 * State Machine Editor Component
 *
 * Visual editor for finite state machines with:
 * - State node creation/deletion
 * - Transition drawing between states
 * - Guard and action configuration
 * - Initial/final state marking
 * - Live simulation support
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StateMachineEditorData, EditorState, StateNodeData, TransitionData, Point } from './types';
import { Canvas } from './Canvas';
import { PropertyPanel } from './PropertyPanel';
import { Toolbar } from './Toolbar';
import styles from './StateMachineEditor.module.css';

export interface StateMachineEditorProps {
  initialData?: StateMachineEditorData;
  onDataChange?: (data: StateMachineEditorData) => void;
  readOnly?: boolean;
  simulationMode?: boolean;
  activeStateId?: string;
}

export const StateMachineEditor: React.FC<StateMachineEditorProps> = ({
  initialData,
  onDataChange,
  readOnly = false,
  simulationMode = false,
  activeStateId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data state
  const [data, setData] = useState<StateMachineEditorData>(
    initialData || {
      name: 'New State Machine',
      states: [],
      transitions: [],
    }
  );

  // UI state
  const [editorState, setEditorState] = useState<EditorState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    showPropertyPanel: true,
  });

  // Handle data changes
  const updateData = useCallback((newData: StateMachineEditorData) => {
    setData(newData);
    onDataChange?.(newData);
  }, [onDataChange]);

  // Add new state
  const handleAddState = useCallback(
    (x: number, y: number) => {
      if (readOnly) return;

      const newState: StateNodeData = {
        id: `state_${Date.now()}`,
        name: `State ${data.states.length + 1}`,
        x,
        y,
        isInitial: data.states.length === 0,
        isFinal: false,
        width: 100,
        height: 60,
      };

      const newData = { ...data, states: [...data.states, newState] };
      if (newState.isInitial) {
        newData.initialStateId = newState.id;
      }
      updateData(newData);
    },
    [data, readOnly, updateData]
  );

  // Delete state
  const handleDeleteState = useCallback(
    (stateId: string) => {
      if (readOnly) return;

      const newStates = data.states.filter(s => s.id !== stateId);
      const newTransitions = data.transitions.filter(
        t => t.from !== stateId && t.to !== stateId
      );

      updateData({
        ...data,
        states: newStates,
        transitions: newTransitions,
        initialStateId:
          data.initialStateId === stateId
            ? newStates[0]?.id
            : data.initialStateId,
      });

      setEditorState(prev => ({ ...prev, selectedStateId: undefined }));
    },
    [data, readOnly, updateData]
  );

  // Add transition
  const handleAddTransition = useCallback(
    (from: string, to: string, event: string) => {
      if (readOnly) return;

      const newTransition: TransitionData = {
        id: `trans_${Date.now()}`,
        from,
        to,
        event,
      };

      updateData({
        ...data,
        transitions: [...data.transitions, newTransition],
      });
    },
    [data, readOnly, updateData]
  );

  // Delete transition
  const handleDeleteTransition = useCallback(
    (transitionId: string) => {
      if (readOnly) return;

      updateData({
        ...data,
        transitions: data.transitions.filter(t => t.id !== transitionId),
      });

      setEditorState(prev => ({ ...prev, selectedTransitionId: undefined }));
    },
    [data, readOnly, updateData]
  );

  // Update state properties
  const handleUpdateState = useCallback(
    (stateId: string, updates: Partial<StateNodeData>) => {
      if (readOnly) return;

      const newStates = data.states.map(s =>
        s.id === stateId ? { ...s, ...updates } : s
      );

      let newInitialStateId = data.initialStateId;
      if (updates.isInitial) {
        newInitialStateId = stateId;
      } else if (updates.isInitial === false && data.initialStateId === stateId) {
        newInitialStateId = undefined;
      }

      updateData({
        ...data,
        states: newStates,
        initialStateId: newInitialStateId,
      });
    },
    [data, readOnly, updateData]
  );

  // Update transition properties
  const handleUpdateTransition = useCallback(
    (transitionId: string, updates: Partial<TransitionData>) => {
      if (readOnly) return;

      updateData({
        ...data,
        transitions: data.transitions.map(t =>
          t.id === transitionId ? { ...t, ...updates } : t
        ),
      });
    },
    [data, readOnly, updateData]
  );

  // Pan and zoom
  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    setEditorState(prev => ({
      ...prev,
      panX: prev.panX + deltaX,
      panY: prev.panY + deltaY,
    }));
  }, []);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    setEditorState(prev => ({
      ...prev,
      zoom: direction === 'in'
        ? Math.min(prev.zoom * 1.2, 3)
        : Math.max(prev.zoom / 1.2, 0.5),
    }));
  }, []);

  // Mouse event handlers
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editorState.isDrawingTransition) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setEditorState(prev => ({
          ...prev,
          isDrawingTransition: prev.isDrawingTransition
            ? {
                ...prev.isDrawingTransition,
                currentX: (e.clientX - rect.left - prev.panX) / prev.zoom,
                currentY: (e.clientY - rect.top - prev.panY) / prev.zoom,
              }
            : undefined,
        }));
      }
    }
  }, [editorState.isDrawingTransition]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
    const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;

    // Check if clicked on existing state
    let clickedState: StateNodeData | undefined;
    for (const state of data.states) {
      const dx = x - state.x;
      const dy = y - state.y;
      if (dx * dx + dy * dy <= (state.width / 2) * (state.width / 2)) {
        clickedState = state;
        break;
      }
    }

    if (e.button === 0) {
      // Left click
      if (clickedState) {
        if (e.altKey) {
          // Alt+click starts transition drawing
          setEditorState(prev => ({
            ...prev,
            isDrawingTransition: {
              fromStateId: clickedState!.id,
              currentX: x,
              currentY: y,
            },
          }));
        } else {
          // Normal click selects state
          setEditorState(prev => ({
            ...prev,
            selectedStateId: clickedState?.id,
            selectedTransitionId: undefined,
            isDraggingState: clickedState?.id,
          }));
        }
      } else {
        // Click on empty space adds new state (if not in drawing mode)
        if (!editorState.isDrawingTransition) {
          handleAddState(x, y);
        }
      }
    } else if (e.button === 2) {
      // Right click
      if (clickedState) {
        e.preventDefault();
        handleDeleteState(clickedState.id);
      }
    }
  }, [data, editorState, readOnly, handleAddState, handleDeleteState]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editorState.isDraggingState) {
      setEditorState(prev => ({ ...prev, isDraggingState: undefined }));
    }

    if (editorState.isDrawingTransition) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
        const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;

        // Check if released over a state
        let targetState: StateNodeData | undefined;
        for (const state of data.states) {
          const dx = x - state.x;
          const dy = y - state.y;
          if (dx * dx + dy * dy <= (state.width / 2) * (state.width / 2)) {
            targetState = state;
            break;
          }
        }

        if (targetState && targetState.id !== editorState.isDrawingTransition.fromStateId) {
          const eventName = prompt('Enter event name:') || 'event';
          handleAddTransition(
            editorState.isDrawingTransition.fromStateId,
            targetState.id,
            eventName
          );
        }
      }

      setEditorState(prev => ({ ...prev, isDrawingTransition: undefined }));
    }
  }, [data, editorState, handleAddTransition]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoom('in');
    } else {
      handleZoom('out');
    }
  }, [handleZoom]);

  return (
    <div className={styles.container} ref={containerRef}>
      <Toolbar
        onZoomIn={() => handleZoom('in')}
        onZoomOut={() => handleZoom('out')}
        zoom={editorState.zoom}
        onTogglePropertyPanel={() =>
          setEditorState(prev => ({
            ...prev,
            showPropertyPanel: !prev.showPropertyPanel,
          }))
        }
      />

      <div className={styles.editorArea}>
        <Canvas
          ref={canvasRef}
          data={data}
          editorState={editorState}
          simulationMode={simulationMode}
          activeStateId={activeStateId}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleWheel}
          onDragState={(stateId, dx, dy) => {
            handleUpdateState(stateId, {
              x: (data.states.find(s => s.id === stateId)?.x || 0) + dx,
              y: (data.states.find(s => s.id === stateId)?.y || 0) + dy,
            });
          }}
        />

        {editorState.showPropertyPanel && (
          <PropertyPanel
            data={data}
            selectedStateId={editorState.selectedStateId}
            selectedTransitionId={editorState.selectedTransitionId}
            onUpdateState={handleUpdateState}
            onUpdateTransition={handleUpdateTransition}
            onDeleteState={handleDeleteState}
            onDeleteTransition={handleDeleteTransition}
            onSelectState={(id) =>
              setEditorState(prev => ({ ...prev, selectedStateId: id }))
            }
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
};
