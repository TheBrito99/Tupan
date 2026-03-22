import React, { useRef, useEffect } from 'react';
import { ThermalComponent, ThermalConnection, getComponentBounds, COMPONENT_PROPERTIES } from './types';
import styles from './ThermalEditor.module.css';

interface CanvasProps {
  components: ThermalComponent[];
  connections: ThermalConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { from: string; to?: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  onCanvasMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onCanvasMouseUp: (e: React.MouseEvent<SVGSVGElement>) => void;
  onComponentClick: (id: string) => void;
  onConnectionDraw: (fromId: string, e: React.MouseEvent<SVGCircleElement>) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
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
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    svg.addEventListener('mousemove', onCanvasMouseMove as any);
    svg.addEventListener('mouseup', onCanvasMouseUp as any);

    return () => {
      svg.removeEventListener('mousemove', onCanvasMouseMove as any);
      svg.removeEventListener('mouseup', onCanvasMouseUp as any);
    };
  }, [onCanvasMouseMove, onCanvasMouseUp]);

  const getComponentColor = (type: string): string => {
    const props = COMPONENT_PROPERTIES[type as keyof typeof COMPONENT_PROPERTIES];
    return props?.color || '#999999';
  };

  const getComponentShape = (comp: ThermalComponent): React.ReactNode => {
    const props = COMPONENT_PROPERTIES[comp.type as keyof typeof COMPONENT_PROPERTIES];
    const color = getComponentColor(comp.type);
    const isSelected = selectedComponentId === comp.id;
    const isDragging = draggingComponentId === comp.id;

    switch (comp.type) {
      case 'heat-source':
      case 'temperature-source':
        // Circle for sources
        return (
          <g key={comp.id}>
            <circle
              cx={comp.position.x}
              cy={comp.position.y}
              r={30}
              fill={color}
              stroke={isSelected ? '#ff0000' : isDragging ? '#00ff00' : '#000'}
              strokeWidth={isSelected ? 3 : isDragging ? 2 : 1}
              opacity={0.8}
              onMouseDown={() => onComponentClick(comp.id)}
              style={{ cursor: 'grab' }}
            />
            <text
              x={comp.position.x}
              y={comp.position.y + 5}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              pointerEvents="none"
            >
              {comp.name}
            </text>
            {/* Connection port */}
            <circle
              cx={comp.position.x + 30}
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

      case 'ambient':
        // Triangle for ambient
        return (
          <g key={comp.id}>
            <polygon
              points={`${comp.position.x},${comp.position.y - 30} ${comp.position.x + 30},${comp.position.y + 30} ${comp.position.x - 30},${comp.position.y + 30}`}
              fill={color}
              stroke={isSelected ? '#ff0000' : isDragging ? '#00ff00' : '#000'}
              strokeWidth={isSelected ? 3 : isDragging ? 2 : 1}
              opacity={0.8}
              onMouseDown={() => onComponentClick(comp.id)}
              style={{ cursor: 'grab' }}
            />
            <text
              x={comp.position.x}
              y={comp.position.y + 5}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              pointerEvents="none"
            >
              {comp.name}
            </text>
            <circle
              cx={comp.position.x - 30}
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

      default:
        // Rectangle for passive components (R, C)
        return (
          <g key={comp.id}>
            <rect
              x={comp.position.x - 35}
              y={comp.position.y - 25}
              width={70}
              height={50}
              fill={color}
              stroke={isSelected ? '#ff0000' : isDragging ? '#00ff00' : '#000'}
              strokeWidth={isSelected ? 3 : isDragging ? 2 : 1}
              rx={5}
              opacity={0.8}
              onMouseDown={() => onComponentClick(comp.id)}
              style={{ cursor: 'grab' }}
            />
            <text
              x={comp.position.x}
              y={comp.position.y - 5}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              pointerEvents="none"
            >
              {comp.name}
            </text>
            <text
              x={comp.position.x}
              y={comp.position.y + 10}
              textAnchor="middle"
              fontSize="9"
              pointerEvents="none"
            >
              {comp.type === 'thermal-resistance'
                ? `${(comp.parameters.resistance || 0).toFixed(2)} K/W`
                : `${(comp.parameters.capacity || 0).toFixed(2)} J/K`}
            </text>
            {/* Left connection port */}
            <circle
              cx={comp.position.x - 35}
              cy={comp.position.y}
              r={6}
              fill="#666"
              onMouseDown={(e) => {
                e.stopPropagation();
                onConnectionDraw(comp.id, e as any);
              }}
              style={{ cursor: 'crosshair' }}
            />
            {/* Right connection port */}
            <circle
              cx={comp.position.x + 35}
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
    }
  };

  const renderConnections = (): React.ReactNode[] => {
    return connections.map((conn) => {
      const fromComp = components.find((c) => c.id === conn.from);
      const toComp = components.find((c) => c.id === conn.to);

      if (!fromComp || !toComp) return null;

      // Get connection endpoints
      const fromX = fromComp.position.x + 30;
      const fromY = fromComp.position.y;
      const toX = toComp.position.x - 30;
      const toY = toComp.position.y;

      // Arrow properties
      const arrowSize = 8;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const arrowPoints = [
        [toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6)],
        [toX, toY],
        [toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6)],
      ];

      return (
        <g key={conn.id}>
          {/* Connection line */}
          <line
            x1={fromX}
            y1={fromY}
            x2={toX}
            y2={toY}
            stroke="#333"
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
          />
          {/* Arrow head */}
          <polygon
            points={arrowPoints.map((p) => p.join(',')).join(' ')}
            fill="#333"
          />
        </g>
      );
    });
  };

  const renderDrawingConnection = (): React.ReactNode => {
    if (!drawingConnection) return null;

    const fromComp = components.find((c) => c.id === drawingConnection.from);
    if (!fromComp) return null;

    return (
      <line
        x1={fromComp.position.x + 30}
        y1={fromComp.position.y}
        x2={drawingConnection.to ? 0 : (svgRef.current?.lastClientX || 0) - (svgRef.current?.getBoundingClientRect().left || 0)}
        y2={drawingConnection.to ? 0 : (svgRef.current?.lastClientY || 0) - (svgRef.current?.getBoundingClientRect().top || 0)}
        stroke="#ff6600"
        strokeWidth={2}
        strokeDasharray="5,5"
      />
    );
  };

  return (
    <div className={styles.canvas}>
      <svg
        ref={svgRef}
        className={styles.svgCanvas}
        onMouseDown={onCanvasMouseDown}
        onWheel={(e) => {
          e.preventDefault();
          // Zoom handling could be added here
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
          {/* Connections (drawn first so they appear behind components) */}
          {renderConnections()}

          {/* Drawing connection preview */}
          {renderDrawingConnection()}

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
};
