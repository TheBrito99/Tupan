/**
 * State Machine Canvas Renderer
 *
 * Renders states and transitions on canvas with interactive features
 */

import React, { forwardRef, useEffect } from 'react';
import { StateMachineEditorData, EditorState, StateNodeData, TransitionData } from './types';
import styles from './StateMachineEditor.module.css';

export interface CanvasProps {
  data: StateMachineEditorData;
  editorState: EditorState;
  simulationMode?: boolean;
  activeStateId?: string;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  onDragState?: (stateId: string, dx: number, dy: number) => void;
}

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  ({
    data,
    editorState,
    simulationMode = false,
    activeStateId,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onWheel,
    onDragState,
  }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const lastMousePos = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isMouseDown, setIsMouseDown] = React.useState(false);
    const [draggedStateId, setDraggedStateId] = React.useState<string>();

    React.useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    // Render loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Clear canvas
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      drawGrid(ctx, canvas.width, canvas.height, editorState.panX, editorState.panY, editorState.zoom);

      // Save context for transformations
      ctx.save();
      ctx.translate(editorState.panX, editorState.panY);
      ctx.scale(editorState.zoom, editorState.zoom);

      // Draw transitions first (so they appear behind states)
      data.transitions.forEach(transition => {
        const fromState = data.states.find(s => s.id === transition.from);
        const toState = data.states.find(s => s.id === transition.to);

        if (fromState && toState) {
          drawTransition(
            ctx,
            fromState,
            toState,
            transition,
            editorState.selectedTransitionId === transition.id
          );
        }
      });

      // Draw in-progress transition
      if (editorState.isDrawingTransition) {
        const fromState = data.states.find(
          s => s.id === editorState.isDrawingTransition?.fromStateId
        );
        if (fromState) {
          ctx.strokeStyle = '#999';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(fromState.x, fromState.y);
          ctx.lineTo(
            editorState.isDrawingTransition.currentX,
            editorState.isDrawingTransition.currentY
          );
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw states
      data.states.forEach(state => {
        const isSelected = editorState.selectedStateId === state.id;
        const isActive = simulationMode && activeStateId === state.id;
        drawStateNode(ctx, state, isSelected, isActive, simulationMode);
      });

      ctx.restore();

      // Draw UI overlay (zoom level, etc.)
      drawUIOverlay(ctx, editorState.zoom);
    }, [data, editorState, simulationMode, activeStateId]);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      lastMousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      if (e.button === 1) {
        // Middle mouse button for panning
        setIsMouseDown(true);
      }

      onMouseDown(e);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const currentPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      if (isMouseDown) {
        // Pan with middle mouse button
        const deltaX = currentPos.x - lastMousePos.current.x;
        const deltaY = currentPos.y - lastMousePos.current.y;
        // Would call onPan here if available
      }

      lastMousePos.current = currentPos;
      onMouseMove(e);
    };

    const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsMouseDown(false);
      setDraggedStateId(undefined);
      onMouseUp(e);
    };

    return (
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={onWheel}
        onContextMenu={e => e.preventDefault()}
      />
    );
  }
);

Canvas.displayName = 'StateMachineCanvas';

// Helper functions
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  panX: number,
  panY: number,
  zoom: number
) {
  const gridSize = 20;
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;

  const startX = Math.floor(-panX / zoom / gridSize) * gridSize;
  const startY = Math.floor(-panY / zoom / gridSize) * gridSize;
  const endX = startX + (width / zoom) + gridSize;
  const endY = startY + (height / zoom) + gridSize;

  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

function drawStateNode(
  ctx: CanvasRenderingContext2D,
  state: StateNodeData,
  isSelected: boolean,
  isActive: boolean,
  simulationMode: boolean
) {
  const radius = state.width / 2;

  // Draw state circle/ellipse
  ctx.beginPath();
  ctx.ellipse(state.x, state.y, radius, state.height / 2, 0, 0, 2 * Math.PI);

  if (isActive && simulationMode) {
    // Active state in simulation mode
    ctx.fillStyle = '#4CAF50';
    ctx.fill();
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 3;
  } else if (isSelected) {
    // Selected state
    ctx.fillStyle = '#e3f2fd';
    ctx.fill();
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 2.5;
  } else {
    // Normal state
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
  }
  ctx.stroke();

  // Draw double circle for final states
  if (state.isFinal) {
    ctx.beginPath();
    ctx.ellipse(state.x, state.y, radius - 5, state.height / 2 - 5, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = isSelected ? '#1976d2' : '#666';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw initial marker (arrow)
  if (state.isInitial) {
    const arrowSize = 15;
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.moveTo(state.x - arrowSize, state.y - state.height / 2 - 10);
    ctx.lineTo(state.x - arrowSize + arrowSize * 0.6, state.y - state.height / 2 - 10 + arrowSize * 0.6);
    ctx.lineTo(state.x - arrowSize + arrowSize * 0.3, state.y - state.height / 2 - 10 + arrowSize * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  // Draw state name
  ctx.fillStyle = isActive && simulationMode ? '#fff' : '#000';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.name, state.x, state.y);
}

function drawTransition(
  ctx: CanvasRenderingContext2D,
  fromState: StateNodeData,
  toState: StateNodeData,
  transition: TransitionData,
  isSelected: boolean
) {
  const fromRadius = fromState.width / 2;
  const toRadius = toState.width / 2;

  // Calculate connection points
  const dx = toState.x - fromState.x;
  const dy = toState.y - fromState.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    // Self-loop
    drawSelfLoop(ctx, fromState, transition, isSelected);
    return;
  }

  const fromAngle = Math.atan2(dy, dx);
  const toAngle = fromAngle + Math.PI;

  const fromX = fromState.x + fromRadius * Math.cos(fromAngle);
  const fromY = fromState.y + (fromState.height / 2) * Math.sin(fromAngle);
  const toX = toState.x + toRadius * Math.cos(toAngle);
  const toY = toState.y + (toState.height / 2) * Math.sin(toAngle);

  // Draw line
  ctx.strokeStyle = isSelected ? '#1976d2' : '#666';
  ctx.lineWidth = isSelected ? 2.5 : 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Draw arrowhead
  const arrowSize = 10;
  const endAngle = Math.atan2(toY - fromY, toX - fromX);
  ctx.fillStyle = isSelected ? '#1976d2' : '#666';
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - arrowSize * Math.cos(endAngle - Math.PI / 6),
    toY - arrowSize * Math.sin(endAngle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - arrowSize * Math.cos(endAngle + Math.PI / 6),
    toY - arrowSize * Math.sin(endAngle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  // Draw event label
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const labelOffsetX = -dy / distance * 20;
  const labelOffsetY = dx / distance * 20;

  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(transition.event, midX + labelOffsetX, midY + labelOffsetY);

  // Draw guard/action label if present
  if (transition.guard || transition.action) {
    const detailText = transition.guard ? `[${transition.guard}]` : '';
    ctx.font = '10px Arial';
    ctx.fillStyle = '#999';
    ctx.fillText(
      detailText,
      midX + labelOffsetX,
      midY + labelOffsetY + 15
    );
  }
}

function drawSelfLoop(
  ctx: CanvasRenderingContext2D,
  state: StateNodeData,
  transition: TransitionData,
  isSelected: boolean
) {
  // Draw loop at top of state
  const loopRadius = 30;
  const loopX = state.x;
  const loopY = state.y - state.height / 2 - loopRadius;

  ctx.strokeStyle = isSelected ? '#1976d2' : '#666';
  ctx.lineWidth = isSelected ? 2.5 : 2;
  ctx.beginPath();
  ctx.arc(loopX, loopY, loopRadius, 0.2 * Math.PI, 1.8 * Math.PI, false);
  ctx.stroke();

  // Draw arrowhead
  const arrowSize = 10;
  ctx.fillStyle = isSelected ? '#1976d2' : '#666';
  ctx.beginPath();
  ctx.moveTo(loopX + loopRadius * Math.cos(1.8 * Math.PI), loopY + loopRadius * Math.sin(1.8 * Math.PI));
  ctx.lineTo(
    loopX + loopRadius * Math.cos(1.8 * Math.PI) - arrowSize * Math.cos(1.8 * Math.PI - Math.PI / 6),
    loopY + loopRadius * Math.sin(1.8 * Math.PI) - arrowSize * Math.sin(1.8 * Math.PI - Math.PI / 6)
  );
  ctx.lineTo(
    loopX + loopRadius * Math.cos(1.8 * Math.PI) - arrowSize * Math.cos(1.8 * Math.PI + Math.PI / 6),
    loopY + loopRadius * Math.sin(1.8 * Math.PI) - arrowSize * Math.sin(1.8 * Math.PI + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  // Draw event label
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(transition.event, loopX, loopY - loopRadius - 15);
}

function drawUIOverlay(ctx: CanvasRenderingContext2D, zoom: number) {
  // Draw zoom level in corner
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${Math.round(zoom * 100)}%`, 10, ctx.canvas.height - 10);
}
