/**
 * Schematic Editor - Complete schematic capture tool
 *
 * Features:
 * - Symbol placement with drag-drop
 * - Wire routing (manual and auto)
 * - Net assignment and labeling
 * - SPICE netlist generation
 * - Integration with circuit simulator
 */

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { Point } from '../../types/geometry';
import { Symbol } from '../DrawingTools/types';
import {
  PlacedSymbol,
  Wire,
  SchematicEditorState,
  SchematicEditorConfig,
  DragState,
  SymbolParameters,
} from './types';
import {
  placeSymbol,
  moveSymbol,
  rotateSymbol,
  findPinAtPosition,
  updateSymbolParameters,
  deleteSymbol,
} from './symbolPlacer';
import {
  createWire,
  addWireWaypoint,
  completeWire,
  autoRouteWire,
  deleteWire,
  getWireLength,
} from './wireRouter';
import { generateSpiceNetlist, generateNetlist, validateNetlist, generateBOM } from './netlistGenerator';
import styles from './SchematicEditor.module.css';

export interface SchematicEditorHandle {
  exportSPICE(): string;
  exportJSON(): string;
  exportBOM(): string;
  getNetlist(): any;
  zoomToFit(): void;
  getState(): SchematicEditorState;
}

export interface SchematicEditorProps {
  config?: Partial<SchematicEditorConfig>;
  readOnly?: boolean;
  onStateChange?: (state: SchematicEditorState) => void;
  onSymbolSelect?: (symbol: PlacedSymbol | null) => void;
}

const DefaultConfig: SchematicEditorConfig = {
  gridSize: 10,
  snapToGrid: true,
  snapToPin: true,
  snapDistance: 10,
  autoLabel: true,
  showGrid: true,
  showPinLabels: true,
  readOnly: false,
};

const SchematicEditor = forwardRef<SchematicEditorHandle, SchematicEditorProps>(
  ({ config = {}, readOnly = false, onStateChange, onSymbolSelect }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mergedConfig = { ...DefaultConfig, ...config, readOnly };

    // Editor state
    const [state, setState] = useState<SchematicEditorState>({
      placedSymbols: [],
      wires: [],
      dragState: {
        isDragging: false,
        startPos: { x: 0, y: 0 },
        currentPos: { x: 0, y: 0 },
        offset: { x: 0, y: 0 },
      },
      isDrawingWire: false,
      wirePath: [],
      history: [],
      historyIndex: -1,
    });

    // Viewport state
    const [viewport, setViewport] = useState({
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
    });

    const [showValidation, setShowValidation] = useState(false);
    const [validationErrors, setValidationErrors] = useState<any[]>([]);

    // Canvas rendering
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      // Clear canvas
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      if (mergedConfig.showGrid) {
        drawGrid(ctx, viewport, mergedConfig.gridSize);
      }

      // Draw wires
      for (const wire of state.wires) {
        drawWire(ctx, wire, viewport, state.selectedWire === wire.id);
      }

      // Draw symbols
      for (const symbol of state.placedSymbols) {
        drawSymbol(ctx, symbol, viewport, state.selectedSymbol === symbol.id);
      }

      // Draw wire being drawn
      if (state.isDrawingWire && state.wirePath.length > 0) {
        drawWirePreview(ctx, state.wirePath, viewport);
      }

      // Draw drag preview
      if (state.dragState.isDragging && state.dragState.draggedSymbolId) {
        const draggedSymbol = state.placedSymbols.find(s => s.id === state.dragState.draggedSymbolId);
        if (draggedSymbol) {
          const movedSymbol = moveSymbol(draggedSymbol, state.dragState.currentPos);
          drawSymbol(ctx, movedSymbol, viewport, false, 0.5);
        }
      }
    }, [state, viewport, mergedConfig]);

    // Handle canvas mouse events
    const handleCanvasMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (readOnly) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldPos = canvasToWorld(canvasX, canvasY, viewport);

        if (e.button === 0) {
          // Left click: symbol selection or start wire
          const pinAtPos = findPinAtPosition(state.placedSymbols, worldPos, mergedConfig.snapDistance);

          if (pinAtPos) {
            // Start wire
            setState(prev => ({
              ...prev,
              isDrawingWire: true,
              wireStart: pinAtPos,
              wirePath: [worldPos],
              selectedSymbol: undefined,
              selectedWire: undefined,
            }));
          } else {
            // Select symbol
            const symbolAtPos = state.placedSymbols.find(s =>
              isPointInSymbol(worldPos, s, viewport)
            );

            setState(prev => ({
              ...prev,
              selectedSymbol: symbolAtPos?.id,
              selectedWire: undefined,
              dragState: {
                isDragging: true,
                draggedSymbolId: symbolAtPos?.id,
                startPos: worldPos,
                currentPos: worldPos,
                offset: { x: 0, y: 0 },
              },
            }));

            onSymbolSelect?.(symbolAtPos || null);
          }
        }
      },
      [state.placedSymbols, viewport, mergedConfig, readOnly, onSymbolSelect]
    );

    const handleCanvasMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldPos = canvasToWorld(canvasX, canvasY, viewport);

        setState(prev => {
          const newState = { ...prev };

          // Handle wire drawing
          if (prev.isDrawingWire) {
            newState.wirePath = [...prev.wirePath, worldPos];
          }

          // Handle symbol dragging
          if (prev.dragState.isDragging && prev.dragState.draggedSymbolId) {
            const delta = {
              x: worldPos.x - prev.dragState.startPos.x,
              y: worldPos.y - prev.dragState.startPos.y,
            };

            newState.dragState = {
              ...prev.dragState,
              currentPos: worldPos,
              offset: delta,
            };
          }

          return newState;
        });
      },
      [viewport]
    );

    const handleCanvasMouseUp = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldPos = canvasToWorld(canvasX, canvasY, viewport);

        setState(prev => {
          const newState = { ...prev };

          // Handle wire completion
          if (prev.isDrawingWire && prev.wireStart) {
            const pinAtPos = findPinAtPosition(prev.placedSymbols, worldPos, mergedConfig.snapDistance);

            if (pinAtPos && pinAtPos.symbolId !== prev.wireStart.symbolId) {
              // Create wire
              const wire = createWire(
                prev.wireStart.symbolId,
                prev.wireStart.pinId,
                pinAtPos.symbolId,
                pinAtPos.pinId
              );

              const autoRoutedWire = autoRouteWire(wire, prev.placedSymbols, mergedConfig.gridSize);

              newState.wires = [...prev.wires, autoRoutedWire];
            }

            newState.isDrawingWire = false;
            newState.wireStart = undefined;
            newState.wirePath = [];
          }

          // Handle symbol drop
          if (prev.dragState.isDragging && prev.dragState.draggedSymbolId) {
            const draggedSymbol = prev.placedSymbols.find(s => s.id === prev.dragState.draggedSymbolId);

            if (draggedSymbol) {
              const newPos = mergedConfig.snapToGrid
                ? snapToGrid(worldPos, mergedConfig.gridSize)
                : worldPos;

              const movedSymbol = moveSymbol(draggedSymbol, newPos);

              newState.placedSymbols = prev.placedSymbols.map(s =>
                s.id === draggedSymbol.id ? movedSymbol : s
              );
            }

            newState.dragState = {
              isDragging: false,
              startPos: { x: 0, y: 0 },
              currentPos: { x: 0, y: 0 },
              offset: { x: 0, y: 0 },
            };
          }

          return newState;
        });
      },
      [viewport, mergedConfig]
    );

    // Public handle methods
    React.useImperativeHandle(ref, () => ({
      exportSPICE() {
        return generateSpiceNetlist(state.placedSymbols, state.wires);
      },
      exportJSON() {
        return JSON.stringify(generateNetlist(state.placedSymbols, state.wires), null, 2);
      },
      exportBOM() {
        return generateBOM(state.placedSymbols);
      },
      getNetlist() {
        return generateNetlist(state.placedSymbols, state.wires);
      },
      zoomToFit() {
        // TODO: Implement zoom to fit
      },
      getState() {
        return state;
      },
    }), [state]);

    // Validate schematic
    const handleValidate = useCallback(() => {
      const errors = validateNetlist(state.placedSymbols, state.wires);
      setValidationErrors(errors);
      setShowValidation(true);
    }, [state.placedSymbols, state.wires]);

    // Add symbol to schematic
    const addSymbol = useCallback((symbol: Symbol, position: Point) => {
      const placed = placeSymbol(symbol, position);
      setState(prev => ({
        ...prev,
        placedSymbols: [...prev.placedSymbols, placed],
      }));
    }, []);

    // Delete selected element
    const handleDelete = useCallback(() => {
      setState(prev => {
        let newState = { ...prev };

        if (prev.selectedSymbol) {
          newState.placedSymbols = deleteSymbol(prev.placedSymbols, prev.selectedSymbol);
          newState.selectedSymbol = undefined;
        }

        if (prev.selectedWire) {
          newState.wires = deleteWire(prev.wires, prev.selectedWire);
          newState.selectedWire = undefined;
        }

        return newState;
      });
    }, []);

    return (
      <div className={styles.container}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          style={{
            cursor: state.isDrawingWire ? 'crosshair' : 'default',
          }}
        />

        <div className={styles.toolbar}>
          <button onClick={() => addSymbol({ id: 'r', name: 'R', category: 'resistor', entities: [], properties: {} }, { x: 100, y: 100 })}>
            Add R
          </button>
          <button onClick={() => addSymbol({ id: 'c', name: 'C', category: 'capacitor', entities: [], properties: {} }, { x: 150, y: 100 })}>
            Add C
          </button>
          <button onClick={handleValidate}>Validate</button>
          <button onClick={handleDelete} disabled={!state.selectedSymbol && !state.selectedWire}>
            Delete
          </button>
        </div>

        {showValidation && (
          <div className={styles.validationPanel}>
            <h3>Netlist Validation</h3>
            {validationErrors.length === 0 ? (
              <p className={styles.success}>✓ Netlist is valid</p>
            ) : (
              <ul>
                {validationErrors.map((error, i) => (
                  <li key={i} className={styles[error.severity]}>
                    {error.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }
);

SchematicEditor.displayName = 'SchematicEditor';

// Helper functions

function drawGrid(ctx: CanvasRenderingContext2D, viewport: any, gridSize: number) {
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;

  const startX = Math.floor(viewport.offsetX / gridSize) * gridSize;
  const startY = Math.floor(viewport.offsetY / gridSize) * gridSize;

  const endX = startX + ctx.canvas.width;
  const endY = startY + ctx.canvas.height;

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

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: PlacedSymbol,
  viewport: any,
  selected: boolean = false,
  alpha: number = 1.0
) {
  const savedAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;

  // Draw symbol boundary
  if (selected) {
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
  }

  // Draw simple box for now
  const w = 40, h = 30;
  const x = worldToCanvas(symbol.position.x, viewport.offsetX);
  const y = worldToCanvas(symbol.position.y, viewport.offsetY);

  ctx.strokeRect(x, y, w, h);

  // Draw pins
  ctx.fillStyle = '#ff0000';
  for (const pin of symbol.pins) {
    const px = worldToCanvas(pin.position.x, viewport.offsetX);
    const py = worldToCanvas(pin.position.y, viewport.offsetY);
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  ctx.globalAlpha = savedAlpha;
}

function drawWire(
  ctx: CanvasRenderingContext2D,
  wire: Wire,
  viewport: any,
  selected: boolean = false
) {
  ctx.strokeStyle = selected ? '#2196f3' : '#000';
  ctx.lineWidth = selected ? 2 : 1;

  for (const segment of wire.segments) {
    const x1 = worldToCanvas(segment.start.x, viewport.offsetX);
    const y1 = worldToCanvas(segment.start.y, viewport.offsetY);
    const x2 = worldToCanvas(segment.end.x, viewport.offsetX);
    const y2 = worldToCanvas(segment.end.y, viewport.offsetY);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawWirePreview(ctx: CanvasRenderingContext2D, path: Point[], viewport: any) {
  ctx.strokeStyle = '#00aa00';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  for (let i = 0; i < path.length - 1; i++) {
    const x1 = worldToCanvas(path[i].x, viewport.offsetX);
    const y1 = worldToCanvas(path[i].y, viewport.offsetY);
    const x2 = worldToCanvas(path[i + 1].x, viewport.offsetX);
    const y2 = worldToCanvas(path[i + 1].y, viewport.offsetY);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function worldToCanvas(worldX: number, offset: number): number {
  return worldX - offset;
}

function canvasToWorld(canvasX: number, canvasY: number, viewport: any): Point {
  return {
    x: canvasX + viewport.offsetX,
    y: canvasY + viewport.offsetY,
  };
}

function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

function isPointInSymbol(point: Point, symbol: PlacedSymbol, viewport: any): boolean {
  const w = 40, h = 30;
  return (
    point.x >= symbol.position.x &&
    point.x <= symbol.position.x + w &&
    point.y >= symbol.position.y &&
    point.y <= symbol.position.y + h
  );
}

export default SchematicEditor;
