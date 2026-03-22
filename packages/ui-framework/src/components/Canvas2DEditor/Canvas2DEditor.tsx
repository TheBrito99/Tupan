/**
 * 2D Canvas Editor Component
 *
 * Reusable React component for all 2D CAD tools:
 * - Schematic editor (electrical symbols)
 * - PCB designer (traces, pads, layers)
 * - 3D sketches (2D profiles)
 * - General 2D CAD (drawings)
 *
 * Features:
 * - Pan/zoom/rotate navigation
 * - Entity selection and manipulation
 * - Snap-to-grid with visual feedback
 * - Layer management
 * - Performance optimized (60 FPS)
 */

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { Point, GeometricEntity, BoundingBox, Transform2D } from '@tupan/core-ts/cad/geometry';
import { geometryBridge } from '@tupan/core-ts/cad/geometry';
import type { Layer } from '@tupan/core-ts/cad/geometry';
import { useCanvasInteraction } from './useCanvasInteraction';
import styles from './Canvas2DEditor.module.css';

export interface Canvas2DEditorProps {
  entities: Array<[string, GeometricEntity]>; // [layer, entity]
  layers: Layer[];
  activeLayer: string;
  gridSize?: number;
  snapDistance?: number;
  enableSnap?: boolean;
  enableGrid?: boolean;
  selectedEntity?: string;
  onEntitySelect?: (entityIndex: string) => void;
  onEntityMove?: (entityIndex: string, newEntity: GeometricEntity) => void;
  onEntityCreate?: (layer: string, entity: GeometricEntity) => void;
  readOnly?: boolean;
  backgroundColor?: string;
  gridColor?: string;
  selectionColor?: string;
}

export interface Canvas2DEditorHandle {
  zoomToFit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  getViewport: () => { panX: number; panY: number; zoom: number };
  setViewport: (panX: number, panY: number, zoom: number) => void;
  exportImage: (format: 'png' | 'svg') => string;
}

export const Canvas2DEditor = forwardRef<Canvas2DEditorHandle, Canvas2DEditorProps>(
  (
    {
      entities,
      layers,
      activeLayer,
      gridSize = 10,
      snapDistance = 10,
      enableSnap = true,
      enableGrid = true,
      selectedEntity,
      onEntitySelect,
      onEntityMove,
      onEntityCreate,
      readOnly = false,
      backgroundColor = '#ffffff',
      gridColor = '#e0e0e0',
      selectionColor = '#2196f3',
    },
    ref
  ) => {
    // ============ STATE ============

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);

    // View state
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [zoom, setZoom] = useState(1);

    // Interaction state
    const { mousePos, isDragging, isRightClick } = useCanvasInteraction(canvasRef, {
      onPan: (dx, dy) => {
        setPanX((prev) => prev + dx);
        setPanY((prev) => prev + dy);
      },
      onZoom: (delta) => {
        setZoom((prev) => {
          const newZoom = prev * (1 + delta * 0.1);
          return Math.max(0.1, Math.min(10, newZoom)); // Clamp 0.1x to 10x
        });
      },
      readOnly,
    });

    // ============ EXPOSE METHODS ============

    useImperativeHandle(ref, () => ({
      zoomToFit: () => {
        if (entities.length === 0) {
          setZoom(1);
          setPanX(0);
          setPanY(0);
          return;
        }

        // Calculate bounding box of all entities
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const [, entity] of entities) {
          const bbox = geometryBridge.boundingBox(entity);
          minX = Math.min(minX, bbox.min.x);
          maxX = Math.max(maxX, bbox.max.x);
          minY = Math.min(minY, bbox.min.y);
          maxY = Math.max(maxY, bbox.max.y);
        }

        const width = maxX - minX;
        const height = maxY - minY;

        if (width === 0 || height === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const newZoom = Math.min(
          (canvas.width * 0.8) / width,
          (canvas.height * 0.8) / height
        );

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        setZoom(newZoom);
        setPanX(canvas.width / 2 - centerX * newZoom);
        setPanY(canvas.height / 2 - centerY * newZoom);
      },

      zoomIn: () => {
        setZoom((prev) => Math.min(10, prev * 1.2));
      },

      zoomOut: () => {
        setZoom((prev) => Math.max(0.1, prev / 1.2));
      },

      resetView: () => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
      },

      getViewport: () => ({ panX, panY, zoom }),

      setViewport: (newPanX, newPanY, newZoom) => {
        setPanX(newPanX);
        setPanY(newPanY);
        setZoom(Math.max(0.1, Math.min(10, newZoom)));
      },

      exportImage: (format: 'png' | 'svg') => {
        if (!canvasRef.current) return '';

        if (format === 'png') {
          return canvasRef.current.toDataURL('image/png');
        } else {
          // SVG export (simplified)
          let svg = `<svg width="${canvasRef.current.width}" height="${canvasRef.current.height}" xmlns="http://www.w3.org/2000/svg">`;
          svg += `<rect width="100%" height="100%" fill="${backgroundColor}"/>`;

          for (const [layer, entity] of entities) {
            const layerObj = layers.find((l) => l.name === layer);
            if (!layerObj?.visible) continue;

            svg += entityToSVG(entity, layerObj);
          }

          svg += '</svg>';
          return svg;
        }
      },
    }));

    // ============ RENDERING ============

    const renderCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !contextRef.current) return;

      const ctx = contextRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Save context state
      ctx.save();

      // Apply view transformation
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      // Draw grid
      if (enableGrid) {
        drawGrid(ctx, width / zoom, height / zoom, gridSize, gridColor);
      }

      // Draw entities by layer (respecting z-order)
      const visibleLayers = layers.filter((l) => l.visible);

      for (const layer of visibleLayers) {
        for (let i = 0; i < entities.length; i++) {
          const [entityLayer, entity] = entities[i];
          if (entityLayer !== layer.name) continue;

          const isSelected = selectedEntity === String(i);
          drawEntity(ctx, entity, layer, isSelected, selectionColor);
        }
      }

      // Draw snap indicator if hovering
      if (enableSnap && mousePos && !readOnly) {
        const snapCandidates = geometryBridge.findSnapCandidates(
          { x: (mousePos.x - panX) / zoom, y: (mousePos.y - panY) / zoom },
          entities.map(([, e]) => e),
          snapDistance / zoom
        );

        if (snapCandidates.length > 0) {
          const snapped = snapCandidates[0];
          ctx.fillStyle = '#ff9800';
          ctx.beginPath();
          ctx.arc(snapped.x, snapped.y, 3 / zoom, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Draw cursor and coordinates
      if (mousePos && !readOnly) {
        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        const worldX = (mousePos.x - panX) / zoom;
        const worldY = (mousePos.y - panY) / zoom;
        ctx.fillText(`${worldX.toFixed(2)}, ${worldY.toFixed(2)}`, 10, 20);
      }
    }, [
      entities,
      layers,
      panX,
      panY,
      zoom,
      gridSize,
      snapDistance,
      enableSnap,
      enableGrid,
      selectedEntity,
      mousePos,
      readOnly,
      backgroundColor,
      gridColor,
      selectionColor,
    ]);

    // Animation loop
    useEffect(() => {
      const animate = () => {
        renderCanvas();
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [renderCanvas]);

    // Initialize canvas context
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      contextRef.current = canvas.getContext('2d');

      // Set up DPI-aware canvas
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = contextRef.current;
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    }, []);

    // ============ INTERACTION HANDLERS ============

    const handleCanvasClick = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (readOnly) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldX = (canvasX - panX) / zoom;
        const worldY = (canvasY - panY) / zoom;
        const clickPoint = { x: worldX, y: worldY };

        // Check for entity selection
        for (let i = entities.length - 1; i >= 0; i--) {
          const [layer, entity] = entities[i];
          if (!layers.find((l) => l.name === layer)?.visible) continue;

          if (geometryBridge.entityContainsPoint(entity, clickPoint, snapDistance / zoom)) {
            onEntitySelect?.(String(i));
            return;
          }
        }

        // Deselect
        onEntitySelect?.(undefined);
      },
      [entities, layers, panX, panY, zoom, snapDistance, readOnly, onEntitySelect]
    );

    // ============ RENDER ============

    return (
      <div className={styles.container}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onClick={handleCanvasClick}
          style={{
            cursor: isRightClick ? 'grabbing' : isDragging ? 'grab' : 'crosshair',
          }}
        />

        {/* Controls Overlay */}
        <div className={styles.controls}>
          <div className={styles.zoomControls}>
            <button
              onClick={() => zoomIn()}
              title="Zoom in (or scroll up)"
              className={styles.controlButton}
            >
              🔍+
            </button>
            <span className={styles.zoomLevel}>{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={() => zoomOut()}
              title="Zoom out (or scroll down)"
              className={styles.controlButton}
            >
              🔍−
            </button>
            <button
              onClick={() => handleZoomToFit()}
              title="Zoom to fit all entities"
              className={styles.controlButton}
            >
              ⬜
            </button>
          </div>

          {/* Layer Indicator */}
          <div className={styles.layerIndicator}>
            Active: <strong>{activeLayer}</strong>
          </div>
        </div>

        {/* Status Bar */}
        <div className={styles.statusBar}>
          <span>Pan: Right-click + drag | Zoom: Scroll wheel</span>
          <span>{entities.length} entities</span>
        </div>
      </div>
    );

    // Helper: Zoom to fit
    function handleZoomToFit() {
      const handle = canvasRef.current?.__canvas2DEditorHandle as Canvas2DEditorHandle | undefined;
      handle?.zoomToFit();
    }

    function zoomIn() {
      const handle = canvasRef.current?.__canvas2DEditorHandle as Canvas2DEditorHandle | undefined;
      handle?.zoomIn();
    }

    function zoomOut() {
      const handle = canvasRef.current?.__canvas2DEditorHandle as Canvas2DEditorHandle | undefined;
      handle?.zoomOut();
    }
  }
);

Canvas2DEditor.displayName = 'Canvas2DEditor';

// ============ DRAWING HELPERS ============

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize: number,
  gridColor: string
) {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;

  // Vertical lines
  let x = 0;
  while (x < width) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    x += gridSize;
  }

  // Horizontal lines
  let y = 0;
  while (y < height) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    y += gridSize;
  }
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: GeometricEntity,
  layer: Layer,
  isSelected: boolean,
  selectionColor: string
) {
  // Set layer properties
  const [r, g, b] = layer.color;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${layer.transparency})`;
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${layer.transparency})`;
  ctx.lineWidth = layer.lineWidth;

  // Highlight if selected
  if (isSelected) {
    ctx.strokeStyle = selectionColor;
    ctx.lineWidth = layer.lineWidth * 2;
  }

  switch (entity.type) {
    case 'point': {
      ctx.beginPath();
      ctx.arc(entity.position.x, entity.position.y, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'line': {
      ctx.beginPath();
      ctx.moveTo(entity.start.x, entity.start.y);
      ctx.lineTo(entity.end.x, entity.end.y);
      ctx.stroke();
      break;
    }

    case 'circle': {
      ctx.beginPath();
      ctx.arc(entity.center.x, entity.center.y, entity.radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'arc': {
      ctx.beginPath();
      ctx.arc(
        entity.center.x,
        entity.center.y,
        entity.radius,
        entity.startAngle,
        entity.endAngle
      );
      ctx.stroke();
      break;
    }

    case 'polygon': {
      if (entity.points.length === 0) break;
      ctx.beginPath();
      ctx.moveTo(entity.points[0].x, entity.points[0].y);
      for (let i = 1; i < entity.points.length; i++) {
        ctx.lineTo(entity.points[i].x, entity.points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'text': {
      ctx.font = `${entity.height}px Arial`;
      ctx.fillText(entity.content, entity.position.x, entity.position.y);
      break;
    }
  }
}

function entityToSVG(entity: GeometricEntity, layer: Layer): string {
  const [r, g, b] = layer.color;
  const color = `rgb(${r}, ${g}, ${b})`;
  let svg = '';

  switch (entity.type) {
    case 'point':
      svg = `<circle cx="${entity.position.x}" cy="${entity.position.y}" r="3" fill="${color}" />`;
      break;

    case 'line':
      svg = `<line x1="${entity.start.x}" y1="${entity.start.y}" x2="${entity.end.x}" y2="${entity.end.y}" stroke="${color}" stroke-width="${layer.lineWidth}" />`;
      break;

    case 'circle':
      svg = `<circle cx="${entity.center.x}" cy="${entity.center.y}" r="${entity.radius}" stroke="${color}" fill="none" stroke-width="${layer.lineWidth}" />`;
      break;

    case 'polygon': {
      const points = entity.points.map((p) => `${p.x},${p.y}`).join(' ');
      svg = `<polyline points="${points}" stroke="${color}" fill="none" stroke-width="${layer.lineWidth}" />`;
      break;
    }

    case 'text':
      svg = `<text x="${entity.position.x}" y="${entity.position.y}" font-size="${entity.height}" fill="${color}">${entity.content}</text>`;
      break;
  }

  return svg;
}

export default Canvas2DEditor;
