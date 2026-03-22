import React, { useRef, useEffect } from 'react';
import { HydraulicComponent, HydraulicConnection, COMPONENT_PROPERTIES } from './types';
import styles from './HydraulicEditor.module.css';

interface CanvasProps {
  components: HydraulicComponent[];
  connections: HydraulicConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { from: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  onCanvasMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onCanvasMouseUp: (e: React.MouseEvent<SVGSVGElement>) => void;
  onComponentClick: (id: string) => void;
  onConnectionDraw: (fromId: string, e: React.MouseEvent<SVGCircleElement>) => void;
  onConnectionComplete: (toId: string) => void;
}

export const Canvas = React.forwardRef<SVGSVGElement, CanvasProps>(
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
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
      const svg = svgRef.current || ref?.current || null;
      if (!svg) return;

      const handleMouseMove = (e: MouseEvent) => {
        onCanvasMouseMove(e as any);
      };
      const handleMouseUp = (e: MouseEvent) => {
        onCanvasMouseUp();
      };

      svg.addEventListener('mousemove', handleMouseMove);
      svg.addEventListener('mouseup', handleMouseUp);

      return () => {
        svg.removeEventListener('mousemove', handleMouseMove);
        svg.removeEventListener('mouseup', handleMouseUp);
      };
    }, [onCanvasMouseMove, onCanvasMouseUp, ref]);

    const getComponentColor = (type: string): string => {
      const props = COMPONENT_PROPERTIES[type as keyof typeof COMPONENT_PROPERTIES];
      return props?.color || '#999999';
    };

    const getComponentShape = (comp: HydraulicComponent): React.ReactNode => {
      const color = getComponentColor(comp.type);
      const isSelected = selectedComponentId === comp.id;
      const isDragging = draggingComponentId === comp.id;

      const strokeColor = isSelected ? '#ff0000' : isDragging ? '#00ff00' : '#000';
      const strokeWidth = isSelected ? 3 : isDragging ? 2 : 1;

      switch (comp.type) {
        case 'pump':
          // Centrifugal pump: circle with rotation arrows
          return (
            <g key={comp.id}>
              <circle
                cx={comp.position.x}
                cy={comp.position.y}
                r={25}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.8}
                onMouseDown={() => onComponentClick(comp.id)}
                style={{ cursor: 'grab' }}
              />
              <path
                d={`M ${comp.position.x - 15},${comp.position.y} A 15,15 0 0,1 ${comp.position.x},${comp.position.y - 15}`}
                fill="none"
                stroke="#000"
                strokeWidth="2"
                pointerEvents="none"
              />
              <polygon points={`${comp.position.x + 2},${comp.position.y - 15} ${comp.position.x - 2},${comp.position.y - 20} ${comp.position.x - 2},${comp.position.y - 10}`} fill="#000" pointerEvents="none" />
              <text x={comp.position.x} y={comp.position.y + 35} textAnchor="middle" fontSize="10" fontWeight="bold" pointerEvents="none">
                Pump
              </text>
              <circle
                cx={comp.position.x + 25}
                cy={comp.position.y}
                r={6}
                fill="#666"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onConnectionDraw(comp.id, e as any);
                }}
                style={{ cursor: 'crosshair' }}
              />
            </g>
          );

        case 'motor':
          // Motor: circle with rotation arrows (opposite direction)
          return (
            <g key={comp.id}>
              <circle
                cx={comp.position.x}
                cy={comp.position.y}
                r={20}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.8}
                onMouseDown={() => onComponentClick(comp.id)}
                style={{ cursor: 'grab' }}
              />
              <path
                d={`M ${comp.position.x - 12},${comp.position.y} A 12,12 0 0,0 ${comp.position.x},${comp.position.y - 12}`}
                fill="none"
                stroke="#000"
                strokeWidth="2"
                pointerEvents="none"
              />
              <polygon points={`${comp.position.x - 2},${comp.position.y - 12} ${comp.position.x - 5},${comp.position.y - 8} ${comp.position.x},${comp.position.y - 18}`} fill="#000" pointerEvents="none" />
              <text x={comp.position.x} y={comp.position.y + 30} textAnchor="middle" fontSize="10" fontWeight="bold" pointerEvents="none">
                Motor
              </text>
              <circle
                cx={comp.position.x - 20}
                cy={comp.position.y}
                r={6}
                fill="#666"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onConnectionDraw(comp.id, e as any);
                }}
                style={{ cursor: 'crosshair' }}
              />
            </g>
          );

        case 'accumulator':
          // Accumulator: sphere
          return (
            <g key={comp.id}>
              <circle
                cx={comp.position.x}
                cy={comp.position.y}
                r={22}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.8}
                onMouseDown={() => onComponentClick(comp.id)}
                style={{ cursor: 'grab' }}
              />
              <text x={comp.position.x} y={comp.position.y + 5} textAnchor="middle" fontSize="11" fontWeight="bold" pointerEvents="none">
                ACC
              </text>
              <text x={comp.position.x} y={comp.position.y + 30} textAnchor="middle" fontSize="9" pointerEvents="none">
                {`${comp.parameters.volume}L`}
              </text>
              <circle
                cx={comp.position.x}
                cy={comp.position.y - 22}
                r={6}
                fill="#666"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onConnectionDraw(comp.id, e as any);
                }}
                style={{ cursor: 'crosshair' }}
              />
            </g>
          );

        case 'pipe':
          // Pipe: line (handled by connections, but can be visual component)
          return (
            <g key={comp.id}>
              <rect
                x={comp.position.x - 30}
                y={comp.position.y - 5}
                width={60}
                height={10}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.8}
                onMouseDown={() => onComponentClick(comp.id)}
                style={{ cursor: 'grab' }}
              />
              <text x={comp.position.x} y={comp.position.y + 20} textAnchor="middle" fontSize="9" pointerEvents="none">
                Pipe
              </text>
            </g>
          );

        case 'valve':
          // Directional control valve: diamond/rotated square
          return (
            <g key={comp.id}>
              <polygon
                points={`${comp.position.x},${comp.position.y - 25} ${comp.position.x + 25},${comp.position.y} ${comp.position.x},${comp.position.y + 25} ${comp.position.x - 25},${comp.position.y}`}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.8}
                onMouseDown={() => onComponentClick(comp.id)}
                style={{ cursor: 'grab' }}
              />
              <text x={comp.position.x} y={comp.position.y + 5} textAnchor="middle" fontSize="10" fontWeight="bold" pointerEvents="none">
                V
              </text>
              <text x={comp.position.x} y={comp.position.y + 35} textAnchor="middle" fontSize="9" pointerEvents="none">
                Valve
              </text>
              <circle cx={comp.position.x - 25} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
              <circle cx={comp.position.x + 25} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        case 'cylinder':
          // Cylinder: rectangle with rod
          return (
            <g key={comp.id}>
              <rect
                x={comp.position.x - 30}
                y={comp.position.y - 15}
                width={60}
                height={30}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                rx={3}
                opacity={0.8}
                onMouseDown={() => onComponentClick(comp.id)}
                style={{ cursor: 'grab' }}
              />
              <line x1={comp.position.x + 30} y1={comp.position.y} x2={comp.position.x + 45} y2={comp.position.y} stroke="#000" strokeWidth="3" pointerEvents="none" />
              <text x={comp.position.x} y={comp.position.y + 5} textAnchor="middle" fontSize="10" fontWeight="bold" pointerEvents="none">
                CYL
              </text>
              <circle cx={comp.position.x - 30} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
              <circle cx={comp.position.x + 30} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        case 'filter':
          // Filter: funnel shape
          return (
            <g key={comp.id}>
              <polygon points={`${comp.position.x - 20},${comp.position.y - 15} ${comp.position.x + 20},${comp.position.y - 15} ${comp.position.x + 5},${comp.position.y + 15} ${comp.position.x - 5},${comp.position.y + 15}`}
                fill={color} stroke={strokeColor} strokeWidth={strokeWidth} opacity={0.8} onMouseDown={() => onComponentClick(comp.id)} style={{ cursor: 'grab' }} />
              <text x={comp.position.x} y={comp.position.y + 30} textAnchor="middle" fontSize="9" pointerEvents="none">
                Filter
              </text>
              <circle cx={comp.position.x - 20} cy={comp.position.y - 15} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
              <circle cx={comp.position.x} cy={comp.position.y + 15} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        case 'tank':
          // Tank: rectangle
          return (
            <g key={comp.id}>
              <rect
                x={comp.position.x - 40}
                y={comp.position.y - 30}
                width={80}
                height={60}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.8}
                onMouseDown={() => onComponentClick(comp.id)}
                style={{ cursor: 'grab' }}
              />
              <text x={comp.position.x} y={comp.position.y + 5} textAnchor="middle" fontSize="12" fontWeight="bold" pointerEvents="none">
                Tank
              </text>
              <circle cx={comp.position.x - 40} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        case 'check-valve':
          // Check valve: circle with one-way arrow
          return (
            <g key={comp.id}>
              <circle cx={comp.position.x} cy={comp.position.y} r={18} fill={color} stroke={strokeColor} strokeWidth={strokeWidth} opacity={0.8} onMouseDown={() => onComponentClick(comp.id)} style={{ cursor: 'grab' }} />
              <polygon points={`${comp.position.x + 5},${comp.position.y} ${comp.position.x - 5},${comp.position.y - 8} ${comp.position.x - 5},${comp.position.y + 8}`} fill="#000" pointerEvents="none" />
              <text x={comp.position.x} y={comp.position.y + 28} textAnchor="middle" fontSize="9" pointerEvents="none">
                Check
              </text>
              <circle cx={comp.position.x - 18} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
              <circle cx={comp.position.x + 18} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        case 'relief-valve':
          // Relief valve: circle with pressure symbol
          return (
            <g key={comp.id}>
              <circle cx={comp.position.x} cy={comp.position.y} r={18} fill={color} stroke={strokeColor} strokeWidth={strokeWidth} opacity={0.8} onMouseDown={() => onComponentClick(comp.id)} style={{ cursor: 'grab' }} />
              <text x={comp.position.x} y={comp.position.y + 3} textAnchor="middle" fontSize="14" fontWeight="bold" pointerEvents="none">
                P
              </text>
              <text x={comp.position.x} y={comp.position.y + 28} textAnchor="middle" fontSize="8" pointerEvents="none">
                Relief
              </text>
              <circle cx={comp.position.x - 18} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
              <circle cx={comp.position.x + 18} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        case 'pressure-source':
          return (
            <g key={comp.id}>
              <rect x={comp.position.x - 25} y={comp.position.y - 15} width={50} height={30} fill={color} stroke={strokeColor} strokeWidth={strokeWidth} rx={5} opacity={0.8} onMouseDown={() => onComponentClick(comp.id)} style={{ cursor: 'grab' }} />
              <text x={comp.position.x} y={comp.position.y + 5} textAnchor="middle" fontSize="9" pointerEvents="none">
                {comp.parameters.pressure} bar
              </text>
              <circle cx={comp.position.x + 25} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        case 'flow-source':
          return (
            <g key={comp.id}>
              <rect x={comp.position.x - 25} y={comp.position.y - 15} width={50} height={30} fill={color} stroke={strokeColor} strokeWidth={strokeWidth} rx={5} opacity={0.8} onMouseDown={() => onComponentClick(comp.id)} style={{ cursor: 'grab' }} />
              <text x={comp.position.x} y={comp.position.y + 5} textAnchor="middle" fontSize="9" pointerEvents="none">
                {comp.parameters.flow} L/m
              </text>
              <circle cx={comp.position.x + 25} cy={comp.position.y} r={6} fill="#666" onMouseDown={(e) => { e.stopPropagation(); onConnectionDraw(comp.id, e as any); }} style={{ cursor: 'crosshair' }} />
            </g>
          );

        default:
          return null;
      }
    };

    const renderConnections = (): React.ReactNode[] => {
      return connections.map((conn) => {
        const fromComp = components.find((c) => c.id === conn.from);
        const toComp = components.find((c) => c.id === conn.to);

        if (!fromComp || !toComp) return null;

        const fromX = fromComp.position.x + 30;
        const fromY = fromComp.position.y;
        const toX = toComp.position.x - 30;
        const toY = toComp.position.y;

        const arrowSize = 8;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowPoints = [
          [toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6)],
          [toX, toY],
          [toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6)],
        ];

        return (
          <g key={conn.id}>
            <line
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke="#333"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
            <polygon points={arrowPoints.map((p) => p.join(',')).join(' ')} fill="#333" />
          </g>
        );
      });
    };

    return (
      <div className={styles.canvas}>
        <svg
          ref={(el) => {
            if (ref && typeof ref === 'object') ref.current = el;
            svgRef.current = el;
          }}
          className={styles.svgCanvas}
          onMouseDown={onCanvasMouseDown}
          onWheel={(e) => {
            e.preventDefault();
          }}
          style={{
            cursor: drawingConnection ? 'crosshair' : 'default',
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#333" />
            </marker>
          </defs>

          {/* Grid background */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#eee" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Pan/Zoom transform */}
          <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
            {/* Connections */}
            {renderConnections()}

            {/* Components */}
            {components.map((comp) => getComponentShape(comp))}
          </g>
        </svg>

        {/* Zoom controls */}
        <div className={styles.zoomControls}>
          <button title="Zoom in">+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button title="Zoom out">−</button>
          <button title="Reset zoom">Reset</button>
        </div>
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
