/**
 * Canvas Renderer Component
 *
 * Renders bond graph elements and bonds using HTML5 Canvas
 * Handles mouse interactions for element selection and manipulation
 */

import React, { useRef, useEffect, useState } from 'react';
import type { EditorElement, EditorBond, EditorState, Position, Bounds } from './types';
import type { CausalityStatus } from './causalityAnalysis';
import { pointInBounds, getElementBounds, distance } from './types';
import { useCanvasCausality } from './useCanvasCausality';
import styles from './BondGraphEditor.module.css';

interface CanvasProps {
  elements: EditorElement[];
  bonds: EditorBond[];
  editorState: EditorState;
  causalities?: Map<string, CausalityStatus>;
  criticalPaths?: string[][];
  conflictingBonds?: string[];
  enableCausalityVisualization?: boolean;
  showCausalityTooltips?: boolean;
  animateCausalityAssignment?: boolean;
  highlightConflicts?: boolean;
  highlightCriticalPaths?: boolean;
  onElementSelect?: (elementId: string | null) => void;
  onElementMove?: (elementId: string, x: number, y: number) => void;
  onBondStart?: (fromId: string) => void;
  onBondEnd?: (fromId: string, toId: string) => void;
  onCanvasPan?: (panX: number, panY: number) => void;
  onCanvasZoom?: (zoom: number) => void;
  disabled?: boolean;
}

const ELEMENT_COLORS: Record<string, string> = {
  'Se': '#FF6B6B',
  'Sf': '#4ECDC4',
  'C': '#FFE66D',
  'I': '#95E1D3',
  'R': '#F38181',
  'TF': '#AA96DA',
  'GY': '#FCBAD3',
  'Junction0': '#A8E6CF',
  'Junction1': '#FFD3B6',
};

const ELEMENT_SIZE = 60;
const JUNCTION_SIZE = 40;

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  bonds,
  editorState,
  causalities = new Map(),
  criticalPaths = [],
  conflictingBonds = [],
  enableCausalityVisualization = true,
  showCausalityTooltips = true,
  animateCausalityAssignment = false,
  highlightConflicts = true,
  highlightCriticalPaths = true,
  onElementSelect,
  onElementMove,
  onBondStart,
  onBondEnd,
  onCanvasPan,
  onCanvasZoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });

  // Initialize causality visualization
  const causalityViz = useCanvasCausality({
    canvas: canvasRef.current,
    elements,
    bonds,
    causalities,
    criticalPaths,
    conflictingBonds,
    enabled: enableCausalityVisualization && causalities.size > 0,
    showTooltips: showCausalityTooltips,
    animateAssignment: animateCausalityAssignment,
    highlightConflicts,
    highlightCriticalPaths,
  });

  // Drawing utility functions
  const drawElement = (
    ctx: CanvasRenderingContext2D,
    element: EditorElement,
    selected: boolean,
    zoom: number,
    panX: number,
    panY: number
  ) => {
    const x = element.x * zoom + panX;
    const y = element.y * zoom + panY;
    const size = element.type.includes('Junction') ? JUNCTION_SIZE : ELEMENT_SIZE;
    const scaledSize = size * zoom;

    const color = ELEMENT_COLORS[element.type] || '#CCCCCC';
    const borderWidth = selected ? 3 : 2;

    ctx.fillStyle = color;
    ctx.fillRect(x - scaledSize / 2, y - scaledSize / 2, scaledSize, scaledSize);

    ctx.strokeStyle = selected ? '#000000' : '#666666';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(x - scaledSize / 2, y - scaledSize / 2, scaledSize, scaledSize);

    // Draw text label
    ctx.fillStyle = '#000000';
    ctx.font = `${12 * zoom}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(element.type, x, y);

    // Draw ID
    if (selected) {
      ctx.fillStyle = '#000000';
      ctx.font = `${10 * zoom}px Arial`;
      ctx.fillText(`(${element.id.substring(0, 4)})`, x, y + scaledSize / 2 + 12);
    }
  };

  const drawBond = (
    ctx: CanvasRenderingContext2D,
    bond: EditorBond,
    from: EditorElement,
    to: EditorElement,
    selected: boolean,
    zoom: number,
    panX: number,
    panY: number
  ) => {
    const x1 = from.x * zoom + panX;
    const y1 = from.y * zoom + panY;
    const x2 = to.x * zoom + panX;
    const y2 = to.y * zoom + panY;

    // Draw bond line
    ctx.strokeStyle = selected ? '#FF0000' : '#999999';
    ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw causality stroke (perpendicular to bond)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
      const perpX = -dy / len;
      const perpY = dx / len;
      const mid_x = (x1 + x2) / 2;
      const mid_y = (y1 + y2) / 2;
      const strokeLen = 10 * zoom;

      const causalityPos = bond.causality === 'EffortOut' ? 1 : 2; // 1 for from, 2 for to
      let pos_x, pos_y;

      if (causalityPos === 1) {
        pos_x = x1 + dx * 0.25;
        pos_y = y1 + dy * 0.25;
      } else {
        pos_x = x1 + dx * 0.75;
        pos_y = y1 + dy * 0.75;
      }

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2 * zoom;
      ctx.beginPath();
      ctx.moveTo(pos_x - perpX * strokeLen / 2, pos_y - perpY * strokeLen / 2);
      ctx.lineTo(pos_x + perpX * strokeLen / 2, pos_y + perpY * strokeLen / 2);
      ctx.stroke();
    }
  };

  // Draw canvas
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 1;
    const gridSize = 20 * editorState.zoom;
    for (let x = editorState.panX % gridSize; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = editorState.panY % gridSize; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw bonds
    bonds.forEach((bond) => {
      const from = elements.find((e) => e.id === bond.from);
      const to = elements.find((e) => e.id === bond.to);
      if (from && to) {
        drawBond(
          ctx,
          bond,
          from,
          to,
          bond.id === editorState.selectedBond,
          editorState.zoom,
          editorState.panX,
          editorState.panY
        );
      }
    });

    // Draw elements
    elements.forEach((element) => {
      drawElement(
        ctx,
        element,
        element.id === editorState.selectedElement,
        editorState.zoom,
        editorState.panX,
        editorState.panY
      );
    });

    // Draw causality visualization overlay
    if (enableCausalityVisualization && causalities.size > 0) {
      causalityViz.renderToCanvas();
    }

    // Draw drawing bond preview
    if (editorState.drawingBond?.fromId) {
      const fromElement = elements.find((e) => e.id === editorState.drawingBond!.fromId);
      if (fromElement) {
        const x1 = fromElement.x * editorState.zoom + editorState.panX;
        const y1 = fromElement.y * editorState.zoom + editorState.panY;
        const x2 = mousePos.x;
        const y2 = mousePos.y;

        ctx.strokeStyle = '#AAAAAA';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw small circle at mouse position
        ctx.fillStyle = '#AAAAAA';
        ctx.beginPath();
        ctx.arc(x2, y2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  useEffect(() => {
    redraw();
  }, [elements, bonds, editorState, mousePos, causalities, criticalPaths, conflictingBonds, enableCausalityVisualization]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
    const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;
    const pos = { x, y };

    // Check if clicked on element
    const clickedElement = elements.find((el) => {
      const bounds = getElementBounds(el);
      return pointInBounds(pos, bounds);
    });

    if (clickedElement) {
      if (e.altKey) {
        // Start drawing bond
        onBondStart?.(clickedElement.id);
      } else {
        // Select element
        onElementSelect?.(clickedElement.id);
        setIsDragging(true);
        setDragStart(pos);
      }
    } else {
      // Deselect
      onElementSelect?.(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const x = (screenX - editorState.panX) / editorState.zoom;
    const y = (screenY - editorState.panY) / editorState.zoom;

    // Update mouse position for bond drawing preview
    setMousePos({ x: screenX, y: screenY });

    // Handle element dragging
    if (isDragging && editorState.selectedElement) {
      onElementMove?.(editorState.selectedElement, x, y);
    }

    // Update cursor based on context
    if (editorState.drawingBond?.fromId) {
      canvas.style.cursor = 'crosshair';
    } else if (editorState.selectedElement) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);

    // Complete bond drawing if releasing on another element
    if (editorState.drawingBond?.fromId) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - editorState.panX) / editorState.zoom;
      const y = (e.clientY - rect.top - editorState.panY) / editorState.zoom;
      const pos = { x, y };

      // Check if releasing on an element
      const targetElement = elements.find((el) => {
        const bounds = getElementBounds(el);
        return pointInBounds(pos, bounds);
      });

      if (targetElement && targetElement.id !== editorState.drawingBond.fromId) {
        onBondEnd?.(editorState.drawingBond.fromId, targetElement.id);
      } else {
        // Cancel bond drawing
        onBondEnd?.(editorState.drawingBond.fromId, editorState.drawingBond.fromId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(3, editorState.zoom * delta));
    onCanvasZoom?.(newZoom);
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className={styles.canvas}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={(e) => handleMouseUp(e)}
      onWheel={handleWheel}
      style={{ cursor: 'default' }}
    />
  );
};

export default Canvas;
