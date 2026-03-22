/**
 * Petri Net Canvas Renderer
 *
 * Renders places, transitions, arcs, and tokens
 */

import React, { forwardRef, useEffect } from 'react';
import {
  PetriNetEditorData,
  EditorState,
  PlaceNodeData,
  TransitionNodeData,
  SimulationState,
} from './types';
import styles from './PetriNetEditor.module.css';

export interface CanvasProps {
  data: PetriNetEditorData;
  editorState: EditorState;
  simulationState: SimulationState;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  onDragPlace?: (placeId: string, dx: number, dy: number) => void;
  onDragTransition?: (transitionId: string, dx: number, dy: number) => void;
}

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  ({
    data,
    editorState,
    simulationState,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onWheel,
    onDragPlace,
    onDragTransition,
  }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

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

      // Save context
      ctx.save();
      ctx.translate(editorState.panX, editorState.panY);
      ctx.scale(editorState.zoom, editorState.zoom);

      // Draw arcs first (behind nodes)
      data.arcs.forEach(arc => {
        const fromNode = data.places.find(p => p.id === arc.from) ||
                        data.transitions.find(t => t.id === arc.from);
        const toNode = data.places.find(p => p.id === arc.to) ||
                      data.transitions.find(t => t.id === arc.to);

        if (fromNode && toNode) {
          drawArc(
            ctx,
            fromNode,
            toNode,
            arc,
            editorState.selectedArcId === arc.id
          );
        }
      });

      // Draw in-progress arc
      if (editorState.isDrawingArc) {
        const fromNode = data.places.find(p => p.id === editorState.isDrawingArc?.fromId) ||
                        data.transitions.find(t => t.id === editorState.isDrawingArc?.fromId);
        if (fromNode) {
          ctx.strokeStyle = '#999';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(editorState.isDrawingArc.currentX, editorState.isDrawingArc.currentY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw places
      data.places.forEach(place => {
        const tokens = simulationState.marking[place.id] || place.tokens || 0;
        const isSelected = editorState.selectedPlaceId === place.id;
        drawPlace(ctx, place, tokens, isSelected);
      });

      // Draw transitions
      data.transitions.forEach(trans => {
        const isSelected = editorState.selectedTransitionId === trans.id;
        const isFiring = editorState.firingAnimation?.transitionId === trans.id;
        const isEnabled = checkTransitionEnabled(trans.id, data, simulationState);
        drawTransition(ctx, trans, isSelected, isEnabled, isFiring, editorState.firingAnimation?.progress || 0);
      });

      ctx.restore();

      // Draw UI overlay
      drawUIOverlay(ctx, editorState.zoom);
    }, [data, editorState, simulationState]);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      onMouseDown(e);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      onMouseMove(e);
    };

    const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

Canvas.displayName = 'PetriNetCanvas';

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

function drawPlace(
  ctx: CanvasRenderingContext2D,
  place: PlaceNodeData,
  tokens: number,
  isSelected: boolean
) {
  const radius = place.width / 2;

  // Draw circle
  ctx.beginPath();
  ctx.arc(place.x, place.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = isSelected ? '#e3f2fd' : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#1976d2' : '#333';
  ctx.lineWidth = isSelected ? 2.5 : 2;
  ctx.stroke();

  // Draw place name
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(place.name, place.x, place.y - radius - 15);

  // Draw tokens (dots)
  if (tokens > 0) {
    drawTokens(ctx, place.x, place.y, radius, tokens);
  }

  // Draw capacity if defined
  if (place.capacity !== undefined) {
    ctx.fillStyle = '#999';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`cap:${place.capacity}`, place.x, place.y + radius + 10);
  }
}

function drawTokens(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, count: number) {
  if (count === 0) return;

  const tokenRadius = 3;
  const positions: Array<[number, number]> = [];

  if (count === 1) {
    positions.push([x, y]);
  } else if (count === 2) {
    positions.push([x - 6, y]);
    positions.push([x + 6, y]);
  } else if (count === 3) {
    positions.push([x - 8, y - 4]);
    positions.push([x + 8, y - 4]);
    positions.push([x, y + 6]);
  } else {
    // Grid layout for more tokens
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = radius * 1.4 / cols;
    let idx = 0;
    for (let i = 0; i < cols && idx < count; i++) {
      for (let j = 0; j < cols && idx < count; j++) {
        const px = x - radius * 0.6 + i * spacing;
        const py = y - radius * 0.6 + j * spacing;
        positions.push([px, py]);
        idx++;
      }
    }
  }

  ctx.fillStyle = '#ff6b6b';
  positions.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, tokenRadius, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Show token count if > 5
  if (count > 5) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count.toString(), x, y);
  }
}

function drawTransition(
  ctx: CanvasRenderingContext2D,
  transition: TransitionNodeData,
  isSelected: boolean,
  isEnabled: boolean,
  isFiring: boolean,
  firingProgress: number
) {
  const width = transition.width;
  const height = transition.height;

  // Draw rectangle
  ctx.fillStyle = isFiring ? '#ffeb3b' : (isEnabled ? '#4CAF50' : '#fff');
  ctx.fillRect(transition.x - width / 2, transition.y - height / 2, width, height);

  ctx.strokeStyle = isSelected ? '#1976d2' : (isEnabled ? '#2E7D32' : '#333');
  ctx.lineWidth = isSelected ? 2.5 : 2;
  ctx.strokeRect(transition.x - width / 2, transition.y - height / 2, width, height);

  // Draw name
  ctx.fillStyle = '#333';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(transition.name, transition.x, transition.y + height / 2 + 15);

  // Draw firing animation (expanding circle)
  if (isFiring && firingProgress < 1) {
    ctx.strokeStyle = `rgba(255, 152, 0, ${1 - firingProgress})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(transition.x, transition.y, 20 * firingProgress, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  fromNode: any,
  toNode: any,
  arc: any,
  isSelected: boolean
) {
  const isFromPlace = 'tokens' in fromNode;
  const toIsPlace = 'tokens' in toNode;

  // Calculate connection points
  let fromX = fromNode.x;
  let fromY = fromNode.y;
  let toX = toNode.x;
  let toY = toNode.y;

  if (isFromPlace) {
    const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const radius = fromNode.width / 2;
    fromX += radius * Math.cos(angle);
    fromY += radius * Math.sin(angle);
  } else {
    const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    toX -= (toNode.width / 2) * Math.cos(angle);
    toY -= (toNode.height / 2) * Math.sin(angle);
  }

  if (toIsPlace) {
    const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const radius = toNode.width / 2;
    toX -= radius * Math.cos(angle);
    toY -= radius * Math.sin(angle);
  } else {
    const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    toX -= (toNode.width / 2) * Math.cos(angle);
    toY -= (toNode.height / 2) * Math.sin(angle);
  }

  // Draw line
  ctx.strokeStyle = arc.type === 'inhibitor' ? '#f44336' : (isSelected ? '#1976d2' : '#666');
  ctx.lineWidth = isSelected ? 2.5 : 2;

  if (arc.type === 'inhibitor') {
    ctx.setLineDash([5, 5]);
  }

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  if (arc.type === 'inhibitor') {
    ctx.setLineDash([]);
  }

  // Draw arrowhead
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const arrowSize = 10;

  if (arc.type === 'inhibitor') {
    // Draw circle instead of arrowhead for inhibitor
    ctx.fillStyle = isSelected ? '#1976d2' : '#f44336';
    ctx.beginPath();
    ctx.arc(toX, toY, 5, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    // Normal arrowhead
    ctx.fillStyle = isSelected ? '#1976d2' : '#666';
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowSize * Math.cos(angle - Math.PI / 6),
      toY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - arrowSize * Math.cos(angle + Math.PI / 6),
      toY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  // Draw weight label
  if (arc.weight > 1 || arc.weight < 1) {
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const offset = 15;
    const labelX = midX - (toY - fromY) / Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2) * offset;
    const labelY = midY + (toX - fromX) / Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2) * offset;

    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arc.weight.toString(), labelX, labelY);
  }
}

function checkTransitionEnabled(
  transitionId: string,
  data: PetriNetEditorData,
  simulationState: SimulationState
): boolean {
  const inputArcs = data.arcs.filter(a => a.to === transitionId);

  return inputArcs.every(arc => {
    const tokens = simulationState.marking[arc.from] || 0;
    if (arc.type === 'inhibitor') {
      return tokens === 0;
    } else {
      return tokens >= arc.weight;
    }
  });
}

function drawUIOverlay(ctx: CanvasRenderingContext2D, zoom: number) {
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${Math.round(zoom * 100)}%`, 10, ctx.canvas.height - 10);
}
