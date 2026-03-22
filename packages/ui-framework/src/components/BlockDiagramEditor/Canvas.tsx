/**
 * Block Diagram Canvas Component
 *
 * SVG-based visualization for block diagram components with 18+ block types,
 * interactive drag-and-drop, connection drawing, and zoom/pan support.
 */

import React, { useState, useRef, useEffect } from 'react';
import { BlockDiagramComponent, BlockDiagramConnection, COMPONENT_PROPERTIES } from './types';
import styles from './BlockDiagramEditor.module.css';

interface CanvasProps {
  components: BlockDiagramComponent[];
  connections: BlockDiagramConnection[];
  selectedComponentId: string | null;
  panX: number;
  panY: number;
  zoom: number;
  onComponentClick: (id: string) => void;
  onComponentDrag: (id: string, position: { x: number; y: number }) => void;
  onConnectionDraw: (from: string, fromPort: string, to: string, toPort: string) => void;
  onPan: (dx: number, dy: number) => void;
  onZoom: (factor: number) => void;
}

/**
 * Renders a block component with SVG
 */
const BlockShape: React.FC<{
  component: BlockDiagramComponent;
  isSelected: boolean;
  onClick: () => void;
  onDrag: (pos: { x: number; y: number }) => void;
}> = ({ component, isSelected, onClick, onDrag }) => {
  const props = COMPONENT_PROPERTIES[component.type];
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click for drag
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - component.position.x,
        y: e.clientY - component.position.y,
      });
    } else if (e.button === 2) {
      // Right click for connection
      e.preventDefault();
      onClick();
    } else {
      onClick();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      onDrag({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const blockWidth = 80;
  const blockHeight = 60;
  const x = component.position.x;
  const y = component.position.y;

  // Block shape based on component type
  let shape: React.ReactNode;

  switch (component.type) {
    case 'transfer-function':
    case 'pid-controller':
    case 'lead-lag-filter':
    case 'low-pass-filter':
    case 'high-pass-filter':
      // Rectangle with rounded corners
      shape = (
        <rect
          x={x}
          y={y}
          width={blockWidth}
          height={blockHeight}
          rx="4"
          fill={props.color}
          stroke={isSelected ? '#000' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      );
      break;

    case 'integrator':
    case 'differentiator':
      // Rectangle
      shape = (
        <rect
          x={x}
          y={y}
          width={blockWidth}
          height={blockHeight}
          fill={props.color}
          stroke={isSelected ? '#000' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      );
      break;

    case 'gain':
    case 'sum':
    case 'product':
      // Diamond for sum/product
      if (component.type !== 'gain') {
        shape = (
          <polygon
            points={`${x + blockWidth / 2},${y} ${x + blockWidth},${y + blockHeight / 2} ${x + blockWidth / 2},${y + blockHeight} ${x},${y + blockHeight / 2}`}
            fill={props.color}
            stroke={isSelected ? '#000' : '#333'}
            strokeWidth={isSelected ? 3 : 1}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        );
      } else {
        // Rectangle for gain
        shape = (
          <rect
            x={x}
            y={y}
            width={blockWidth}
            height={blockHeight}
            fill={props.color}
            stroke={isSelected ? '#000' : '#333'}
            strokeWidth={isSelected ? 3 : 1}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        );
      }
      break;

    case 'saturation':
    case 'deadzone':
    case 'hysteresis':
      // Rectangle for nonlinear blocks
      shape = (
        <rect
          x={x}
          y={y}
          width={blockWidth}
          height={blockHeight}
          fill={props.color}
          stroke={isSelected ? '#000' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      );
      break;

    case 'step-source':
    case 'ramp-source':
    case 'sine-source':
      // Rectangle for sources
      shape = (
        <rect
          x={x}
          y={y}
          width={blockWidth}
          height={blockHeight}
          rx="3"
          fill={props.color}
          stroke={isSelected ? '#000' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      );
      break;

    case 'multiplexer':
    case 'demultiplexer':
      // Rectangle for mux/demux
      shape = (
        <rect
          x={x}
          y={y}
          width={blockWidth}
          height={blockHeight}
          fill={props.color}
          stroke={isSelected ? '#000' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      );
      break;

    case 'scope':
      // Rectangle for scope
      shape = (
        <rect
          x={x}
          y={y}
          width={blockWidth}
          height={blockHeight}
          fill={props.color}
          stroke={isSelected ? '#000' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      );
      break;

    default:
      shape = (
        <rect
          x={x}
          y={y}
          width={blockWidth}
          height={blockHeight}
          fill={props.color}
          stroke={isSelected ? '#000' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      );
  }

  return (
    <g>
      {shape}
      {/* Label */}
      <text
        x={x + blockWidth / 2}
        y={y + blockHeight / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize="12"
        fontWeight="bold"
        pointerEvents="none"
      >
        {props.icon}
      </text>
      {/* Component name below */}
      <text
        x={x + blockWidth / 2}
        y={y + blockHeight + 15}
        textAnchor="middle"
        fill="#333"
        fontSize="11"
        pointerEvents="none"
      >
        {component.name}
      </text>
    </g>
  );
};

/**
 * Canvas component for block diagram editing
 */
export const Canvas: React.FC<CanvasProps> = ({
  components,
  connections,
  selectedComponentId,
  panX,
  panY,
  zoom,
  onComponentClick,
  onComponentDrag,
  onConnectionDraw,
  onPan,
  onZoom,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleSVGWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    onZoom(factor);
  };

  const handleSVGMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.buttons === 4) {
      // Middle mouse or right mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleSVGMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      onPan(dx / zoom, dy / zoom);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleSVGMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div className={styles.canvasContainer}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className={styles.canvas}
        onWheel={handleSVGWheel}
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
        onMouseLeave={handleSVGMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Grid background */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="0.5" />
          </pattern>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#666" />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Transform group for pan and zoom */}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {/* Connections */}
          {connections.map((conn) => {
            const fromComp = components.find((c) => c.id === conn.from);
            const toComp = components.find((c) => c.id === conn.to);

            if (!fromComp || !toComp) return null;

            const x1 = fromComp.position.x + 80;
            const y1 = fromComp.position.y + 30;
            const x2 = toComp.position.x;
            const y2 = toComp.position.y + 30;

            return (
              <line key={conn.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth="2" markerEnd="url(#arrowhead)" />
            );
          })}

          {/* Components */}
          {components.map((comp) => (
            <BlockShape
              key={comp.id}
              component={comp}
              isSelected={selectedComponentId === comp.id}
              onClick={() => onComponentClick(comp.id)}
              onDrag={(pos) => onComponentDrag(comp.id, pos)}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
