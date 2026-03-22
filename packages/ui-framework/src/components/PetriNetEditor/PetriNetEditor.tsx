/**
 * Petri Net Editor Component
 *
 * Visual editor for Petri nets with:
 * - Place and transition nodes
 * - Weighted arcs (normal and inhibitor)
 * - Token marking visualization
 * - Transition firing simulation
 * - Petri net analysis
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  PetriNetEditorData,
  EditorState,
  PlaceNodeData,
  TransitionNodeData,
  ArcData,
  SimulationState,
  AnalysisResult,
} from './types';
import { Canvas } from './Canvas';
import { PropertyPanel } from './PropertyPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { Toolbar } from './Toolbar';
import styles from './PetriNetEditor.module.css';

export interface PetriNetEditorProps {
  initialData?: PetriNetEditorData;
  onDataChange?: (data: PetriNetEditorData) => void;
  onSimulationStateChange?: (state: SimulationState) => void;
  readOnly?: boolean;
  simulationMode?: boolean;
  analysisResults?: AnalysisResult;
}

export const PetriNetEditor: React.FC<PetriNetEditorProps> = ({
  initialData,
  onDataChange,
  onSimulationStateChange,
  readOnly = false,
  simulationMode = false,
  analysisResults,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data state
  const [data, setData] = useState<PetriNetEditorData>(
    initialData || {
      name: 'New Petri Net',
      places: [],
      transitions: [],
      arcs: [],
    }
  );

  // UI state
  const [editorState, setEditorState] = useState<EditorState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    showPropertyPanel: true,
    showAnalysisPanel: false,
    simulationMode: simulationMode || false,
  });

  // Simulation state
  const [simulationState, setSimulationState] = useState<SimulationState>({
    time: 0,
    marking: {},
    enabledTransitions: [],
    firedTransitions: [],
    isDeadlock: false,
  });

  // Handle data changes
  const updateData = useCallback((newData: PetriNetEditorData) => {
    setData(newData);
    onDataChange?.(newData);
  }, [onDataChange]);

  // Add new place
  const handleAddPlace = useCallback(
    (x: number, y: number) => {
      if (readOnly || simulationMode) return;

      const newPlace: PlaceNodeData = {
        id: `place_${Date.now()}`,
        name: `P${data.places.length + 1}`,
        x,
        y,
        tokens: 0,
        width: 60,
        height: 60,
      };

      updateData({
        ...data,
        places: [...data.places, newPlace],
      });
    },
    [data, readOnly, simulationMode, updateData]
  );

  // Add new transition
  const handleAddTransition = useCallback(
    (x: number, y: number) => {
      if (readOnly || simulationMode) return;

      const newTransition: TransitionNodeData = {
        id: `trans_${Date.now()}`,
        name: `T${data.transitions.length + 1}`,
        x,
        y,
        isEnabled: false,
        width: 15,
        height: 60,
      };

      updateData({
        ...data,
        transitions: [...data.transitions, newTransition],
      });
    },
    [data, readOnly, simulationMode, updateData]
  );

  // Delete place
  const handleDeletePlace = useCallback(
    (placeId: string) => {
      if (readOnly || simulationMode) return;

      const newPlaces = data.places.filter(p => p.id !== placeId);
      const newArcs = data.arcs.filter(a => a.from !== placeId && a.to !== placeId);

      updateData({
        ...data,
        places: newPlaces,
        arcs: newArcs,
      });

      setEditorState(prev => ({ ...prev, selectedPlaceId: undefined }));
    },
    [data, readOnly, simulationMode, updateData]
  );

  // Delete transition
  const handleDeleteTransition = useCallback(
    (transitionId: string) => {
      if (readOnly || simulationMode) return;

      const newTransitions = data.transitions.filter(t => t.id !== transitionId);
      const newArcs = data.arcs.filter(a => a.from !== transitionId && a.to !== transitionId);

      updateData({
        ...data,
        transitions: newTransitions,
        arcs: newArcs,
      });

      setEditorState(prev => ({ ...prev, selectedTransitionId: undefined }));
    },
    [data, readOnly, simulationMode, updateData]
  );

  // Add arc between place and transition
  const handleAddArc = useCallback(
    (from: string, to: string, fromType: 'place' | 'transition', toType: 'place' | 'transition') => {
      if (readOnly || simulationMode) return;

      // Prevent self-loops and invalid connections
      if (from === to || fromType === toType) return;

      // Only allow place->transition or transition->place
      if ((fromType === 'place' && toType !== 'transition') ||
          (fromType === 'transition' && toType !== 'place')) {
        return;
      }

      const newArc: ArcData = {
        id: `arc_${Date.now()}`,
        from,
        to,
        weight: 1,
        type: 'normal',
      };

      updateData({
        ...data,
        arcs: [...data.arcs, newArc],
      });
    },
    [data, readOnly, simulationMode, updateData]
  );

  // Delete arc
  const handleDeleteArc = useCallback(
    (arcId: string) => {
      if (readOnly || simulationMode) return;

      updateData({
        ...data,
        arcs: data.arcs.filter(a => a.id !== arcId),
      });

      setEditorState(prev => ({ ...prev, selectedArcId: undefined }));
    },
    [data, readOnly, simulationMode, updateData]
  );

  // Update place properties
  const handleUpdatePlace = useCallback(
    (placeId: string, updates: Partial<PlaceNodeData>) => {
      if (readOnly) return;

      const newPlaces = data.places.map(p =>
        p.id === placeId ? { ...p, ...updates } : p
      );

      updateData({
        ...data,
        places: newPlaces,
      });
    },
    [data, readOnly, updateData]
  );

  // Update transition properties
  const handleUpdateTransition = useCallback(
    (transitionId: string, updates: Partial<TransitionNodeData>) => {
      if (readOnly) return;

      const newTransitions = data.transitions.map(t =>
        t.id === transitionId ? { ...t, ...updates } : t
      );

      updateData({
        ...data,
        transitions: newTransitions,
      });
    },
    [data, readOnly, updateData]
  );

  // Update arc properties
  const handleUpdateArc = useCallback(
    (arcId: string, updates: Partial<ArcData>) => {
      if (readOnly) return;

      updateData({
        ...data,
        arcs: data.arcs.map(a =>
          a.id === arcId ? { ...a, ...updates } : a
        ),
      });
    },
    [data, readOnly, updateData]
  );

  // Fire a transition
  const handleFireTransition = useCallback(
    (transitionId: string) => {
      if (!simulationMode) return;

      // Get input/output places
      const inputArcs = data.arcs.filter(a => a.to === transitionId && a.from !== transitionId);
      const outputArcs = data.arcs.filter(a => a.from === transitionId && a.to !== transitionId);

      // Check if transition is enabled
      const enabled = inputArcs.every(arc => {
        const place = data.places.find(p => p.id === arc.from);
        const currentTokens = simulationState.marking[arc.from] || 0;
        return currentTokens >= arc.weight;
      });

      if (!enabled) return;

      // Update marking
      const newMarking = { ...simulationState.marking };

      // Consume tokens from input places
      inputArcs.forEach(arc => {
        const current = newMarking[arc.from] || 0;
        newMarking[arc.from] = current - arc.weight;
      });

      // Produce tokens to output places
      outputArcs.forEach(arc => {
        const current = newMarking[arc.to] || 0;
        newMarking[arc.to] = current + arc.weight;
      });

      // Update simulation state
      const newState: SimulationState = {
        ...simulationState,
        time: simulationState.time + 0.01,
        marking: newMarking,
        firedTransitions: [
          ...simulationState.firedTransitions,
          { id: transitionId, time: simulationState.time },
        ],
      };

      setSimulationState(newState);
      onSimulationStateChange?.(newState);

      // Animate firing
      setEditorState(prev => ({
        ...prev,
        firingAnimation: { transitionId, progress: 0 },
      }));

      setTimeout(() => {
        setEditorState(prev => ({ ...prev, firingAnimation: undefined }));
      }, 300);
    },
    [data, simulationState, simulationMode, onSimulationStateChange]
  );

  // Pan and zoom
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    setEditorState(prev => ({
      ...prev,
      zoom: direction === 'in'
        ? Math.min(prev.zoom * 1.2, 3)
        : Math.max(prev.zoom / 1.2, 0.5),
    }));
  }, []);

  // Mouse event handlers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly && !simulationMode) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
    const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;

    // Check if clicked on place
    let clickedPlace: PlaceNodeData | undefined;
    for (const place of data.places) {
      const dist = Math.sqrt((x - place.x) ** 2 + (y - place.y) ** 2);
      if (dist <= place.width / 2) {
        clickedPlace = place;
        break;
      }
    }

    // Check if clicked on transition
    let clickedTransition: TransitionNodeData | undefined;
    for (const trans of data.transitions) {
      const dx = Math.abs(x - trans.x);
      const dy = Math.abs(y - trans.y);
      if (dx <= trans.width / 2 && dy <= trans.height / 2) {
        clickedTransition = trans;
        break;
      }
    }

    if (simulationMode && clickedTransition) {
      // Fire transition in simulation mode
      handleFireTransition(clickedTransition.id);
      return;
    }

    if (e.button === 0) {
      // Left click
      if (clickedPlace) {
        if (e.altKey && !readOnly) {
          // Alt+click starts arc drawing
          setEditorState(prev => ({
            ...prev,
            isDrawingArc: {
              fromId: clickedPlace!.id,
              fromType: 'place',
              currentX: x,
              currentY: y,
            },
          }));
        } else {
          setEditorState(prev => ({
            ...prev,
            selectedPlaceId: clickedPlace?.id,
            selectedTransitionId: undefined,
            selectedArcId: undefined,
            isDraggingPlace: !readOnly ? clickedPlace?.id : undefined,
          }));
        }
      } else if (clickedTransition) {
        if (e.altKey && !readOnly) {
          // Alt+click starts arc drawing
          setEditorState(prev => ({
            ...prev,
            isDrawingArc: {
              fromId: clickedTransition!.id,
              fromType: 'transition',
              currentX: x,
              currentY: y,
            },
          }));
        } else {
          setEditorState(prev => ({
            ...prev,
            selectedTransitionId: clickedTransition?.id,
            selectedPlaceId: undefined,
            selectedArcId: undefined,
            isDraggingTransition: !readOnly ? clickedTransition?.id : undefined,
          }));
        }
      } else {
        // Click on empty space
        if (e.shiftKey && !readOnly) {
          // Shift+click adds transition
          handleAddTransition(x, y);
        } else if (!editorState.isDrawingArc && !readOnly) {
          // Normal click adds place
          handleAddPlace(x, y);
        }
        setEditorState(prev => ({
          ...prev,
          selectedPlaceId: undefined,
          selectedTransitionId: undefined,
          selectedArcId: undefined,
        }));
      }
    } else if (e.button === 2) {
      // Right click - delete
      if (clickedPlace && !readOnly) {
        e.preventDefault();
        handleDeletePlace(clickedPlace.id);
      } else if (clickedTransition && !readOnly) {
        e.preventDefault();
        handleDeleteTransition(clickedTransition.id);
      }
    }
  }, [
    data,
    editorState,
    readOnly,
    simulationMode,
    handleAddPlace,
    handleAddTransition,
    handleDeletePlace,
    handleDeleteTransition,
    handleFireTransition,
  ]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
    const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;

    if (editorState.isDrawingArc) {
      setEditorState(prev => ({
        ...prev,
        isDrawingArc: prev.isDrawingArc
          ? { ...prev.isDrawingArc, currentX: x, currentY: y }
          : undefined,
      }));
    }
  }, [editorState]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
    const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;

    if (editorState.isDraggingPlace) {
      setEditorState(prev => ({ ...prev, isDraggingPlace: undefined }));
    }

    if (editorState.isDraggingTransition) {
      setEditorState(prev => ({ ...prev, isDraggingTransition: undefined }));
    }

    if (editorState.isDrawingArc) {
      const { fromId, fromType } = editorState.isDrawingArc;

      // Find target
      let targetPlace: PlaceNodeData | undefined;
      let targetTransition: TransitionNodeData | undefined;

      for (const place of data.places) {
        if (place.id !== fromId) {
          const dist = Math.sqrt((x - place.x) ** 2 + (y - place.y) ** 2);
          if (dist <= place.width / 2) {
            targetPlace = place;
            break;
          }
        }
      }

      for (const trans of data.transitions) {
        if (trans.id !== fromId) {
          const dx = Math.abs(x - trans.x);
          const dy = Math.abs(y - trans.y);
          if (dx <= trans.width / 2 && dy <= trans.height / 2) {
            targetTransition = trans;
            break;
          }
        }
      }

      if (targetPlace && fromType === 'transition') {
        handleAddArc(fromId, targetPlace.id, 'transition', 'place');
      } else if (targetTransition && fromType === 'place') {
        handleAddArc(fromId, targetTransition.id, 'place', 'transition');
      }

      setEditorState(prev => ({ ...prev, isDrawingArc: undefined }));
    }
  }, [data, editorState, handleAddArc]);

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
        onToggleAnalysisPanel={() =>
          setEditorState(prev => ({
            ...prev,
            showAnalysisPanel: !prev.showAnalysisPanel,
          }))
        }
        simulationMode={editorState.simulationMode}
        onToggleSimulation={() =>
          setEditorState(prev => ({
            ...prev,
            simulationMode: !prev.simulationMode,
          }))
        }
      />

      <div className={styles.editorArea}>
        <Canvas
          ref={canvasRef}
          data={data}
          editorState={editorState}
          simulationState={simulationState}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleWheel}
          onDragPlace={(placeId, dx, dy) => {
            const place = data.places.find(p => p.id === placeId);
            if (place) {
              handleUpdatePlace(placeId, {
                x: place.x + dx,
                y: place.y + dy,
              });
            }
          }}
          onDragTransition={(transitionId, dx, dy) => {
            const trans = data.transitions.find(t => t.id === transitionId);
            if (trans) {
              handleUpdateTransition(transitionId, {
                x: trans.x + dx,
                y: trans.y + dy,
              });
            }
          }}
        />

        {editorState.showPropertyPanel && (
          <PropertyPanel
            data={data}
            selectedPlaceId={editorState.selectedPlaceId}
            selectedTransitionId={editorState.selectedTransitionId}
            selectedArcId={editorState.selectedArcId}
            onUpdatePlace={handleUpdatePlace}
            onUpdateTransition={handleUpdateTransition}
            onUpdateArc={handleUpdateArc}
            onDeletePlace={handleDeletePlace}
            onDeleteTransition={handleDeleteTransition}
            onDeleteArc={handleDeleteArc}
            readOnly={readOnly}
          />
        )}

        {editorState.showAnalysisPanel && (
          <AnalysisPanel
            data={data}
            analysisResults={analysisResults}
            simulationState={simulationState}
          />
        )}
      </div>
    </div>
  );
};
