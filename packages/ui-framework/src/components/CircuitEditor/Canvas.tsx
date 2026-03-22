/**
 * Circuit Canvas Component
 *
 * SVG-based schematic visualization with component shapes, connections,
 * drag-and-drop, and interactive editing.
 */

import React, { useRef, useState, useCallback } from 'react';
import { CircuitComponent, CircuitConnection, COMPONENT_PROPERTIES } from './types';
import styles from './CircuitEditor.module.css';

export interface CanvasProps {
  components: CircuitComponent[];
  connections: CircuitConnection[];
  selectedComponentId: string | null;
  drawingConnection: any;
  panX: number;
  panY: number;
  zoom: number;
  onComponentSelect: (componentId: string) => void;
  onComponentDelete: (componentId: string) => void;
  onComponentDrag: (componentId: string, x: number, y: number) => void;
  onConnectionStart: (componentId: string, port: string) => void;
  onConnectionComplete: (connection: CircuitConnection) => void;
  onConnectionCancel: () => void;
  onConnectionDelete: (connectionId: string) => void;
  onPan: (dx: number, dy: number) => void;
  onZoom: (scale: number) => void;
}

/**
 * Component shape renderers for each electrical component type
 */
const ComponentShapes: Record<string, (x: number, y: number, size: number) => JSX.Element> = {
  resistor: (x, y, size) => (
    <g>
      {/* Zigzag symbol */}
      <line x1={x - size} y1={y} x2={x - size / 2} y2={y - size / 3} stroke="black" strokeWidth="2" />
      <line x1={x - size / 2} y1={y - size / 3} x2={x} y2={y + size / 3} stroke="black" strokeWidth="2" />
      <line x1={x} y1={y + size / 3} x2={x + size / 2} y2={y - size / 3} stroke="black" strokeWidth="2" />
      <line x1={x + size / 2} y1={y - size / 3} x2={x + size} y2={y} stroke="black" strokeWidth="2" />
    </g>
  ),

  capacitor: (x, y, size) => (
    <g>
      {/* Two parallel lines */}
      <line x1={x - size / 2} y1={y - size / 3} x2={x + size / 2} y2={y - size / 3} stroke="black" strokeWidth="2" />
      <line x1={x - size / 2} y1={y + size / 3} x2={x + size / 2} y2={y + size / 3} stroke="black" strokeWidth="2" />
    </g>
  ),

  inductor: (x, y, size) => (
    <g>
      {/* Coil symbol */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={x - size / 2 + i * (size / 4)} cy={y} r={size / 6} fill="none" stroke="black" strokeWidth="2" />
      ))}
    </g>
  ),

  'voltage-source': (x, y, size) => (
    <g>
      {/* Circle with + */}
      <circle cx={x} cy={y} r={size / 2} fill="none" stroke="black" strokeWidth="2" />
      <text x={x - 4} y={y + 5} fontSize="14" fontWeight="bold" fill="black">
        V
      </text>
    </g>
  ),

  'current-source': (x, y, size) => (
    <g>
      {/* Circle with I */}
      <circle cx={x} cy={y} r={size / 2} fill="none" stroke="black" strokeWidth="2" />
      <text x={x - 3} y={y + 5} fontSize="14" fontWeight="bold" fill="black">
        I
      </text>
    </g>
  ),

  ground: (x, y, size) => (
    <g>
      {/* Ground symbol: horizontal lines decreasing */}
      <line x1={x} y1={y} x2={x} y2={y + size / 2} stroke="black" strokeWidth="2" />
      <line x1={x - size / 3} y1={y + size / 3} x2={x + size / 3} y2={y + size / 3} stroke="black" strokeWidth="2" />
      <line x1={x - size / 4} y1={y + size / 2} x2={x + size / 4} y2={y + size / 2} stroke="black" strokeWidth="2" />
    </g>
  ),

  wire: (x, y, size) => (
    <g>
      {/* Just a dot for wire node */}
      <circle cx={x} cy={y} r={4} fill="black" />
    </g>
  ),

  'op-amp': (x, y, size) => (
    <g>
      {/* Triangle */}
      <polygon points={`${x},${y - size / 2} ${x + size / 2},${y + size / 2} ${x - size / 2},${y + size / 2}`} fill="none" stroke="black" strokeWidth="2" />
      <text x={x - 8} y={y + 5} fontSize="10" fill="black">
        U
      </text>
    </g>
  ),

  switch: (x, y, size) => (
    <g>
      {/* Switch symbol */}
      <line x1={x - size / 2} y1={y} x2={x} y2={y - size / 3} stroke="black" strokeWidth="2" />
      <circle cx={x + size / 2} cy={y} r={4} fill="black" />
    </g>
  ),

  diode: (x, y, size) => (
    <g>
      {/* Triangle pointing right with bar */}
      <polygon points={`${x - size / 3},${y - size / 3} ${x - size / 3},${y + size / 3} ${x + size / 3},${y}`} fill="none" stroke="black" strokeWidth="2" />
      <line x1={x + size / 3} y1={y - size / 3} x2={x + size / 3} y2={y + size / 3} stroke="black" strokeWidth="2" />
    </g>
  ),

  transformer: (x, y, size) => (
    <g>
      {/* Two coils */}
      {[0, 1].map((i) => (
        <circle
          key={i}
          cx={x - size / 4 + i * (size / 2)}
          cy={y}
          r={size / 4}
          fill="none"
          stroke="black"
          strokeWidth="2"
        />
      ))}
    </g>
  ),
};

export const Canvas: React.FC<CanvasProps> = ({
  components,
  connections,
  selectedComponentId,
  drawingConnection,
  panX,
  panY,
  zoom,
  onComponentSelect,
  onComponentDelete,
  onComponentDrag,
  onConnectionStart,
  onConnectionComplete,
  onConnectionCancel,
  onConnectionDelete,
  onPan,
  onZoom,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingComponent, setDraggingComponent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const GRID_SIZE = 20;
  const COMPONENT_SIZE = 40;

  // Mouse down handler for dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - panX) / zoom;
      const y = (e.clientY - rect.top - panY) / zoom;

      // Check if clicking on a component
      for (const comp of components) {
        const dist = Math.sqrt(
          Math.pow(comp.x - x, 2) + Math.pow(comp.y - y, 2)
        );
        if (dist < COMPONENT_SIZE / 2) {
          setDraggingComponent(comp.id);
          setDragOffset({
            x: comp.x - x,
            y: comp.y - y,
          });
          onComponentSelect(comp.id);
          return;
        }
      }

      // Deselect if clicking on empty space
      onComponentSelect('');
    },
    [components, panX, panY, zoom, onComponentSelect]
  );

  // Mouse move handler for dragging
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!draggingComponent || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - panX) / zoom;
      const y = (e.clientY - rect.top - panY) / zoom;

      // Snap to grid
      const snappedX = Math.round((x + dragOffset.x) / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round((y + dragOffset.y) / GRID_SIZE) * GRID_SIZE;

      onComponentDrag(draggingComponent, snappedX, snappedY);
    },
    [draggingComponent, panX, panY, zoom, dragOffset, onComponentDrag]
  );

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    setDraggingComponent(null);
  }, []);

  // Wheel handler for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const scale = e.deltaY > 0 ? 0.9 : 1.1;
      onZoom(scale);
    },
    [onZoom]
  );

  return (
    <svg
      ref={svgRef}
      className={styles.canvas}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid background */}
      <defs>
        <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Connections */}
      <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
        {connections.map((conn) => {
          const fromComponent = components.find((c) => c.id === conn.from);
          const toComponent = components.find((c) => c.id === conn.to);

          if (!fromComponent || !toComponent) return null;

          return (
            <line
              key={conn.id}
              x1={fromComponent.x}
              y1={fromComponent.y}
              x2={toComponent.x}
              y2={toComponent.y}
              stroke="#666"
              strokeWidth="2"
              pointerEvents="none"
            />
          );
        })}

        {/* Drawing connection line */}
        {drawingConnection && (
          <line
            x1={components.find((c) => c.id === drawingConnection.fromComponentId)?.x || 0}
            y1={components.find((c) => c.id === drawingConnection.fromComponentId)?.y || 0}
            x2={drawingConnection.x || 0}
            y2={drawingConnection.y || 0}
            stroke="#0066cc"
            strokeWidth="2"
            strokeDasharray="5,5"
            pointerEvents="none"
          />
        )}

        {/* Components */}
        {components.map((comp) => {
          const props = COMPONENT_PROPERTIES[comp.type];
          const ShapeComponent = ComponentShapes[comp.type];

          return (
            <g
              key={comp.id}
              transform={`translate(${comp.x},${comp.y})`}
              onClick={() => onComponentSelect(comp.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onComponentDelete(comp.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Component shape */}
              {ShapeComponent ? ShapeComponent(0, 0, COMPONENT_SIZE) : null}

              {/* Selection highlight */}
              {selectedComponentId === comp.id && (
                <circle
                  cx={0}
                  cy={0}
                  r={COMPONENT_SIZE}
                  fill="none"
                  stroke="#0066cc"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {/* Label */}
              <text x={-15} y={-COMPONENT_SIZE / 2 - 10} fontSize="12" fill="#333">
                {comp.name}
              </text>

              {/* Connection ports */}
              <circle cx={-COMPONENT_SIZE / 2 - 5} cy={0} r={5} fill="#ccc" />
              <circle cx={COMPONENT_SIZE / 2 + 5} cy={0} r={5} fill="#ccc" />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default Canvas;
