/**
 * Sketcher Canvas Component
 * Phase 17: 3D CAD Foundation - Sketcher UI
 *
 * 2D sketch editing with real-time constraint visualization
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Sketch, SketchElement, Constraint, Point2D } from '../../cad/types';
import styles from './SketcherCanvas.module.css';

interface SketcherCanvasProps {
  sketch: Sketch;
  onElementClick?: (elementId: string) => void;
  onElementAdded?: (element: SketchElement) => void;
  onConstraintAdded?: (constraint: Constraint) => void;
  readOnly?: boolean;
}

/**
 * 2D Sketcher Canvas
 * - Draw points, lines, circles
 * - Apply constraints (horizontal, vertical, distance, radius, etc.)
 * - Real-time constraint visualization
 * - Snap-to-grid support
 */
export const SketcherCanvas: React.FC<SketcherCanvasProps> = ({
  sketch,
  onElementClick,
  onElementAdded,
  onConstraintAdded,
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'select' | 'point' | 'line' | 'circle'>('select');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Point2D | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(5);

  // =========================================================================
  // RENDERING
  // =========================================================================

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw sketch elements
    drawSketchElements(ctx);

    // Draw constraints
    drawConstraints(ctx);
  }, [sketch, zoom, pan]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#eeeeee';
    ctx.lineWidth = 0.5;

    const gridSpacing = gridSize * zoom;
    const offsetX = pan.x % gridSpacing;
    const offsetY = pan.y % gridSpacing;

    // Vertical lines
    for (let x = offsetX; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw origin
    ctx.fillStyle = '#000000';
    ctx.fillRect(pan.x - 2, pan.y - 2, 4, 4);
  };

  const drawSketchElements = (ctx: CanvasRenderingContext2D) => {
    // Draw in order: construction elements, then regular elements
    const elements = Array.from(sketch.elements.values());

    // Draw construction elements (light blue)
    elements.forEach((element) => {
      if (!isConstructionElement(element)) return;

      ctx.strokeStyle = '#5BA3D0';
      ctx.fillStyle = '#5BA3D0';
      ctx.lineWidth = 1;

      drawElement(ctx, element);
    });

    // Draw regular elements (black)
    elements.forEach((element) => {
      if (isConstructionElement(element)) return;

      const isSelected = element.id === selectedElement;
      ctx.strokeStyle = isSelected ? '#ff0000' : '#000000';
      ctx.fillStyle = isSelected ? '#ff0000' : '#000000';
      ctx.lineWidth = isSelected ? 2 : 1;

      drawElement(ctx, element);
    });
  };

  const drawElement = (ctx: CanvasRenderingContext2D, element: SketchElement) => {
    const type = getElementType(element);

    switch (type) {
      case 'Point': {
        const point = getElementPosition(element);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        break;
      }

      case 'Line': {
        const start = getElementPosition(element);
        const end = getLinEndPoint(element);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }

      case 'Circle': {
        const center = getElementPosition(element);
        const radius = getCircleRadius(element);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
    }
  };

  const drawConstraints = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.font = '12px Arial';

    Array.from(sketch.constraints.values()).forEach((constraint) => {
      // Draw constraint indicator near geometry
      // E.g., "H" for horizontal, "V" for vertical, dimension values, etc.

      if (constraint.entity_ids.length > 0) {
        const element = sketch.elements.get(constraint.entity_ids[0]);
        if (element) {
          const pos = getElementPosition(element);
          const label = getConstraintLabel(constraint);

          ctx.fillText(label, pos.x + 10, pos.y - 10);
        }
      }
    });
  };

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  const isConstructionElement = (element: SketchElement): boolean => {
    const type = getElementType(element);
    switch (type) {
      case 'Point':
        return (element as any).position?.construction ?? false;
      case 'Line':
        return (element as any).startPoint?.construction ?? false;
      case 'Circle':
        return (element as any).construction ?? false;
      default:
        return false;
    }
  };

  const getElementType = (element: SketchElement): string => {
    if ((element as any).position !== undefined) return 'Point';
    if ((element as any).startPoint !== undefined) return 'Line';
    if ((element as any).center !== undefined) return 'Circle';
    return 'Unknown';
  };

  const getElementPosition = (element: SketchElement): Point2D => {
    const x = (element as any).position?.x ?? (element as any).start?.x ?? 0;
    const y = (element as any).position?.y ?? (element as any).start?.y ?? 0;
    return screenCoords({ x, y });
  };

  const getLinEndPoint = (element: SketchElement): Point2D => {
    const x = (element as any).end?.x ?? 0;
    const y = (element as any).end?.y ?? 0;
    return screenCoords({ x, y });
  };

  const getCircleRadius = (element: SketchElement): number => {
    return ((element as any).radius ?? 10) * zoom;
  };

  const screenCoords = (world: Point2D): Point2D => ({
    x: world.x * zoom + pan.x,
    y: world.y * zoom + pan.y,
  });

  const worldCoords = (screen: Point2D): Point2D => ({
    x: (screen.x - pan.x) / zoom,
    y: (screen.y - pan.y) / zoom,
  });

  const getConstraintLabel = (constraint: Constraint): string => {
    const { type, value } = constraint;
    switch (type) {
      case 'Horizontal':
        return 'H';
      case 'Vertical':
        return 'V';
      case 'Parallel':
        return '∥';
      case 'Perpendicular':
        return '⊥';
      case 'Distance':
        return `${value?.toFixed(1)}`;
      case 'Radius':
        return `R${value?.toFixed(1)}`;
      case 'Diameter':
        return `Ø${value?.toFixed(1)}`;
      case 'Angle':
        return `${value?.toFixed(0)}°`;
      default:
        return '';
    }
  };

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (e.button === 2) {
      // Right-click: pan
      setDragStart(screenPos);
    } else {
      // Left-click: select or create element
      const world = worldCoords(screenPos);
      // TODO: Find element at position or create new element based on mode
    }
  }, [readOnly]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const delta = { x: current.x - dragStart.x, y: current.y - dragStart.y };

    // Pan the view
    setPan((prev) => ({ x: prev.x + delta.x, y: prev.y + delta.y }));
    setDragStart(current);
  }, [dragStart]);

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.1, Math.min(10, prev * delta)));
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button
          className={`${styles.toolButton} ${mode === 'select' ? styles.active : ''}`}
          onClick={() => setMode('select')}
          title="Select tool (S)"
        >
          ✋ Select
        </button>
        <button
          className={`${styles.toolButton} ${mode === 'point' ? styles.active : ''}`}
          onClick={() => setMode('point')}
          disabled={readOnly}
          title="Point tool (P)"
        >
          ● Point
        </button>
        <button
          className={`${styles.toolButton} ${mode === 'line' ? styles.active : ''}`}
          onClick={() => setMode('line')}
          disabled={readOnly}
          title="Line tool (L)"
        >
          ─ Line
        </button>
        <button
          className={`${styles.toolButton} ${mode === 'circle' ? styles.active : ''}`}
          onClick={() => setMode('circle')}
          disabled={readOnly}
          title="Circle tool (C)"
        >
          ◯ Circle
        </button>

        <div className={styles.separator} />

        <button
          className={`${styles.toolButton} ${snapToGrid ? styles.active : ''}`}
          onClick={() => setSnapToGrid(!snapToGrid)}
          title="Toggle snap to grid"
        >
          ⊞ Snap Grid
        </button>

        <div className={styles.separator} />

        <label className={styles.zoomLabel}>
          Zoom: {(zoom * 100).toFixed(0)}%
        </label>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={1200}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />

      {/* Status bar */}
      <div className={styles.statusBar}>
        <span className={styles.statusText}>
          {selectedElement ? `Selected: ${selectedElement}` : 'Ready'}
        </span>
        <span className={styles.statusText}>
          Elements: {sketch.elements.size} | Constraints: {sketch.constraints.size}
        </span>
      </div>
    </div>
  );
};

export default SketcherCanvas;
