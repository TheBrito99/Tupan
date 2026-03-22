import React, { forwardRef } from 'react';
import {
  PneumaticComponent,
  PneumaticConnection,
  COMPONENT_PROPERTIES,
} from './types';
import styles from './PneumaticEditor.module.css';

interface CanvasProps {
  components: PneumaticComponent[];
  connections: PneumaticConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { from: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  onCanvasMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onCanvasMouseUp: () => void;
  onComponentClick: (id: string) => void;
  onConnectionDraw: (fromId: string) => void;
  onConnectionComplete: (toId: string) => void;
}

export const Canvas = forwardRef<SVGSVGElement, CanvasProps>(
  (
    {
      components,
      connections,
      selectedComponentId,
      draggingComponentId,
      drawingConnection,
      panX,
      panY,
      zoom,
      onCanvasMouseDown,
      onCanvasMouseMove,
      onCanvasMouseUp,
      onComponentClick,
      onConnectionDraw,
      onConnectionComplete,
    },
    ref
  ) => {
    const getComponentShape = (component: PneumaticComponent) => {
      const props = COMPONENT_PROPERTIES[component.type];
      const { x, y } = component.position;
      const isSelected = component.id === selectedComponentId;
      const isDragging = component.id === draggingComponentId;

      const commonProps = {
        onMouseDown: (e: React.MouseEvent) => {
          e.stopPropagation();
          onComponentClick(component.id);
        },
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onConnectionDraw(component.id);
        },
        style: {
          cursor: 'move',
          opacity: isDragging ? 0.7 : 1,
        },
      };

      switch (component.type) {
        case 'compressor':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <circle
                cx="0"
                cy="0"
                r="25"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                ↻
              </text>
              <text
                x="0"
                y="32"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'tank':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <rect
                x="-30"
                y="-25"
                width="60"
                height="50"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
                rx="3"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                ◈
              </text>
              <text
                x="0"
                y="32"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'motor':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <circle
                cx="0"
                cy="0"
                r="20"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                ⟲
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'cylinder':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <rect
                x="-30"
                y="-15"
                width="60"
                height="30"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
                rx="2"
              />
              <line x1="30" y1="-8" x2="45" y2="-8" stroke={props.color} strokeWidth="2" />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
              >
                ━━▶
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'valve':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <polygon
                points="0,-20 20,0 0,20 -20,0"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="8"
                fontWeight="bold"
              >
                ◄►
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'regulator':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <circle
                cx="0"
                cy="0"
                r="18"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
              >
                P
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'filter':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <polygon
                points="0,-20 25,-5 25,5 0,20 -25,5 -25,-5"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="8"
                fontWeight="bold"
              >
                ⊞
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'muffler':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <rect
                x="-20"
                y="-18"
                width="40"
                height="36"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
                rx="2"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
              >
                ◀◀
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'pressure-source':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <rect
                x="-25"
                y="-18"
                width="50"
                height="36"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
                rx="2"
              />
              <text
                x="0"
                y="-5"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="8"
                fontWeight="bold"
              >
                P=
              </text>
              <text
                x="0"
                y="8"
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                {(component.parameters.pressure as number).toFixed(1)}
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        case 'flow-source':
          return (
            <g key={component.id} transform={`translate(${x},${y})`} {...commonProps}>
              <rect
                x="-25"
                y="-18"
                width="50"
                height="36"
                fill={props.color}
                stroke={isSelected ? '#000' : props.color}
                strokeWidth={isSelected ? 3 : 1}
                rx="2"
              />
              <text
                x="0"
                y="-5"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="8"
                fontWeight="bold"
              >
                Q=
              </text>
              <text
                x="0"
                y="8"
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                {(component.parameters.flow as number).toFixed(0)}
              </text>
              <text
                x="0"
                y="28"
                textAnchor="middle"
                fill="#333"
                fontSize="11"
              >
                {component.name}
              </text>
            </g>
          );

        default:
          return null;
      }
    };

    return (
      <svg
        ref={ref}
        className={styles.canvas}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
      >
        <defs>
          <pattern
            id="grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#eee" strokeWidth="0.5" />
          </pattern>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#666" />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
          {/* Render connections */}
          {connections.map((conn) => {
            const fromComp = components.find((c) => c.id === conn.from);
            const toComp = components.find((c) => c.id === conn.to);

            if (!fromComp || !toComp) return null;

            return (
              <line
                key={conn.id}
                x1={fromComp.position.x}
                y1={fromComp.position.y}
                x2={toComp.position.x}
                y2={toComp.position.y}
                stroke="#666"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Render drawing connection */}
          {drawingConnection && (
            <line
              x1={
                components.find((c) => c.id === drawingConnection.from)
                  ?.position.x || 0
              }
              y1={
                components.find((c) => c.id === drawingConnection.from)
                  ?.position.y || 0
              }
              x2={0}
              y2={0}
              stroke="#999"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          )}

          {/* Render components */}
          {components.map((component) => getComponentShape(component))}
        </g>
      </svg>
    );
  }
);

Canvas.displayName = 'PneumaticCanvas';
