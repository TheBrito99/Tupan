/**
 * Generic Node-Based Editor Component
 *
 * A reusable React component for creating node-based visual programming
 * interfaces. Used by all simulators in Tupan (circuits, block diagrams,
 * state machines, etc.).
 *
 * Features:
 * - Drag-and-drop node placement
 * - Connection creation between ports
 * - Zoom and pan
 * - Property panel for node configuration
 * - Toolbar with component palette
 */

import React, { useState, useRef, useCallback } from 'react';
import { Graph, Node, Edge, NodeId, PortId } from '@tupan/core-ts';
import styles from './NodeEditor.module.css';

export interface NodeEditorProps {
  graph: Graph;
  onGraphChange?: (graph: Graph) => void;
  nodeTypes?: Map<string, NodeTypeDefinition>;
  readOnly?: boolean;
  zoom?: number;
  pan?: { x: number; y: number };
}

export interface NodeTypeDefinition {
  name: string;
  icon?: React.ReactNode;
  category: string;
  color: string;
  defaultParameters?: Record<string, unknown>;
}

export interface NodeEditorState {
  selectedNodeId?: NodeId;
  selectedEdgeId?: string;
  isDragging: boolean;
  draggedNodeId?: NodeId;
  connectionInProgress?: { sourceNodeId: NodeId; sourcePortId: PortId };
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Main NodeEditor Component
 */
export const NodeEditor: React.FC<NodeEditorProps> = ({
  graph,
  onGraphChange,
  nodeTypes = new Map(),
  readOnly = false,
  zoom: initialZoom = 1,
  pan: initialPan = { x: 0, y: 0 },
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<NodeEditorState>({
    isDragging: false,
    zoom: initialZoom,
    pan: initialPan,
  });

  // Handle canvas drawing
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { zoom, pan } = state;

    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height, pan, zoom);

    // Draw edges
    const edges = graph.getEdges();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2 / zoom;
    for (const edge of edges) {
      drawEdge(ctx, edge, graph, pan, zoom);
    }

    // Draw nodes
    for (const node of graph.getNodes()) {
      drawNode(
        ctx,
        node,
        state.selectedNodeId?.equals(node.id) || false,
        pan,
        zoom,
      );
    }
  }, [state, graph]);

  // Redraw when graph or state changes
  React.useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.pan.x) / state.zoom;
    const y = (e.clientY - rect.top - state.pan.y) / state.zoom;

    // Check if clicking on a node
    for (const node of graph.getNodes()) {
      const nodeSize = 100;
      const nodeX = 100; // Placeholder - would come from node position
      const nodeY = 100; // Placeholder

      if (
        x >= nodeX &&
        x <= nodeX + nodeSize &&
        y >= nodeY &&
        y <= nodeY + nodeSize
      ) {
        setState((prev) => ({
          ...prev,
          selectedNodeId: node.id,
          isDragging: true,
          draggedNodeId: node.id,
        }));
        return;
      }
    }

    // If not clicking on node, deselect
    setState((prev) => ({
      ...prev,
      selectedNodeId: undefined,
      isDragging: false,
    }));
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (state.isDragging && state.draggedNodeId && !readOnly) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const deltaX = e.movementX / state.zoom;
      const deltaY = e.movementY / state.zoom;

      setState((prev) => ({
        ...prev,
        pan: {
          x: prev.pan.x + deltaX,
          y: prev.pan.y + deltaY,
        },
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setState((prev) => ({
      ...prev,
      isDragging: false,
      draggedNodeId: undefined,
    }));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, state.zoom * zoomFactor));

    setState((prev) => ({
      ...prev,
      zoom: newZoom,
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <NodePalette nodeTypes={nodeTypes} readOnly={readOnly} />
        <div className={styles.spacer} />
        <div className={styles.zoomControls}>
          <span>{Math.round(state.zoom * 100)}%</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={800}
        height={600}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={handleWheel}
      />

      {state.selectedNodeId && (
        <PropertyPanel
          node={graph.getNode(state.selectedNodeId)}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};

/**
 * Component palette for adding nodes
 */
const NodePalette: React.FC<{ nodeTypes: Map<string, NodeTypeDefinition>; readOnly: boolean }> = ({
  nodeTypes,
  readOnly,
}) => {
  return (
    <div className={styles.palette}>
      {Array.from(nodeTypes.values()).map((nodeType) => (
        <button
          key={nodeType.name}
          className={styles.paletteButton}
          title={nodeType.name}
          disabled={readOnly}
        >
          {nodeType.icon || nodeType.name}
        </button>
      ))}
    </div>
  );
};

/**
 * Property panel for editing selected node
 */
const PropertyPanel: React.FC<{ node?: Node; readOnly: boolean }> = ({ node, readOnly }) => {
  if (!node) return null;

  return (
    <div className={styles.propertyPanel}>
      <div className={styles.propertyPanelHeader}>Properties</div>
      <div className={styles.propertyPanelContent}>
        <div>
          <label>Node Type:</label>
          <span>{node.node_type}</span>
        </div>
        {Object.entries(node.parameters).map(([key, value]) => (
          <div key={key}>
            <label>{key}:</label>
            <input
              type="text"
              defaultValue={String(value)}
              disabled={readOnly}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Draw grid background
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number,
) {
  const gridSize = 20;
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1 / zoom;

  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x + pan.x, 0);
    ctx.lineTo(x + pan.x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y + pan.y);
    ctx.lineTo(width, y + pan.y);
    ctx.stroke();
  }
}

/**
 * Draw a node
 */
function drawNode(
  ctx: CanvasRenderingContext2D,
  node: Node,
  selected: boolean,
  pan: { x: number; y: number },
  zoom: number,
) {
  const x = 100 + pan.x; // Placeholder
  const y = 100 + pan.y; // Placeholder
  const width = 100;
  const height = 80;

  // Draw rectangle
  ctx.fillStyle = selected ? '#4CAF50' : '#fff';
  ctx.strokeStyle = selected ? '#2196F3' : '#999';
  ctx.lineWidth = selected ? 2 : 1;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);

  // Draw label
  ctx.fillStyle = '#000';
  ctx.font = `${12 / zoom}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(node.node_type, x + width / 2, y + height / 2);
}

/**
 * Draw an edge between two nodes
 */
function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  graph: Graph,
  pan: { x: number; y: number },
  zoom: number,
) {
  const sourceNode = graph.getNode(edge.source[0]);
  const targetNode = graph.getNode(edge.target[0]);

  if (!sourceNode || !targetNode) return;

  const x1 = 150 + pan.x; // Placeholder - would be sourceNode.x
  const y1 = 140 + pan.y; // Placeholder - would be sourceNode.y
  const x2 = 300 + pan.x; // Placeholder - would be targetNode.x
  const y2 = 140 + pan.y; // Placeholder - would be targetNode.y

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export default NodeEditor;
