/**
 * Block Diagram Editor - Visual Firmware Design Tool
 *
 * Allows users to create firmware by dragging and dropping blocks,
 * connecting them with wires, and configuring parameters.
 *
 * Supports 8 block types:
 * - PID: Proportional-Integral-Derivative controller
 * - Filter: Low-pass filter
 * - Math: Addition, multiplication, etc.
 * - ADC: Analog-to-Digital input
 * - PWM: Pulse-Width Modulation output
 * - Saturation: Output clamping
 * - Delay: Time delay
 * - Const: Constant value
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import styles from './BlockDiagramEditor.module.css';
import { BlockDiagramCompiler, BlockNode, CompiledAst, DataType, PortDirection } from '../../microcontroller/BlockDiagramCompiler';
import { CodeGenerator, GeneratedCode, McuTarget } from '../../microcontroller/CodeGenerator';
import { Graph, Node, NodeId, Edge, EdgeId, PortId } from '../../graph/types';

// ========== Type Definitions ==========

interface BlockDefinition {
  type: string;
  name: string;
  category: 'Inputs' | 'Processing' | 'Outputs' | 'Utilities';
  icon: string;
  color: string;
  width: number;
  height: number;
  defaultParameters: Record<string, any>;
}

interface BlockPosition {
  x: number;
  y: number;
}

interface ConnectionState {
  fromNodeId: NodeId | null;
  fromPortId: PortId | null;
  toNodeId: NodeId | null;
  toPortId: PortId | null;
  previewLine: { x1: number; y1: number; x2: number; y2: number } | null;
}

interface EditorState {
  graph: Graph;
  selectedNodeId: NodeId | null;
  selectedEdgeId: EdgeId | null;
  isDraggingBlock: boolean;
  dragStartPos: { x: number; y: number } | null;
  blockPositions: Map<string, BlockPosition>;
  connectionState: ConnectionState;
  compilationResult: CompiledAst | null;
  generatedCode: GeneratedCode | null;
  selectedTarget: McuTarget;
  projectName: string;
}

// ========== Block Definitions ==========

const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: 'adc',
    name: 'ADC Input',
    category: 'Inputs',
    icon: '📊',
    color: '#E8F4F8',
    width: 100,
    height: 80,
    defaultParameters: { channel: 0, samples: 10, vref: 5.0 },
  },
  {
    type: 'const',
    name: 'Constant',
    category: 'Inputs',
    icon: '🔢',
    color: '#F0F0F0',
    width: 80,
    height: 60,
    defaultParameters: { value: 1.0 },
  },
  {
    type: 'pid',
    name: 'PID Controller',
    category: 'Processing',
    icon: '⚙️',
    color: '#FFF4E6',
    width: 110,
    height: 100,
    defaultParameters: { kp: 1.0, ki: 0.0, kd: 0.0 },
  },
  {
    type: 'filter',
    name: 'Low-Pass Filter',
    category: 'Processing',
    icon: '〰️',
    color: '#F3E5F5',
    width: 110,
    height: 80,
    defaultParameters: { cutoff: 10.0 },
  },
  {
    type: 'math',
    name: 'Math Operation',
    category: 'Processing',
    icon: '➕',
    color: '#E8F5E9',
    width: 100,
    height: 80,
    defaultParameters: { operation: 'add' },
  },
  {
    type: 'saturation',
    name: 'Saturation',
    category: 'Processing',
    icon: '🔒',
    color: '#FCE4EC',
    width: 100,
    height: 80,
    defaultParameters: { min: 0, max: 255 },
  },
  {
    type: 'pwm',
    name: 'PWM Output',
    category: 'Outputs',
    icon: '📤',
    color: '#E0F2F1',
    width: 100,
    height: 80,
    defaultParameters: { pin: 3, frequency: 1000 },
  },
  {
    type: 'delay',
    name: 'Delay',
    category: 'Utilities',
    icon: '⏱️',
    color: '#F1F8E9',
    width: 80,
    height: 60,
    defaultParameters: { delay_ms: 100 },
  },
];

// ========== Block Palette Component ==========

const BlockPalette: React.FC<{
  onBlockDragStart: (definition: BlockDefinition, e: React.DragEvent) => void;
}> = ({ onBlockDragStart }) => {
  const categories = ['Inputs', 'Processing', 'Outputs', 'Utilities'] as const;

  return (
    <div className={styles.palette}>
      <h3>Block Palette</h3>
      {categories.map((category) => (
        <div key={category} className={styles.category}>
          <h4>{category}</h4>
          <div className={styles.blocks}>
            {BLOCK_DEFINITIONS.filter((b) => b.category === category).map((def) => (
              <div
                key={def.type}
                className={styles.paletteBlock}
                draggable
                onDragStart={(e) => onBlockDragStart(def, e)}
                style={{ backgroundColor: def.color }}
              >
                <div className={styles.blockIcon}>{def.icon}</div>
                <div className={styles.blockLabel}>{def.name}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ========== Block Canvas Component ==========

interface BlockCanvasProps {
  graph: Graph;
  selectedNodeId: NodeId | null;
  blockPositions: Map<string, BlockPosition>;
  connectionState: ConnectionState;
  onCanvasDrop: (e: React.DragEvent) => void;
  onBlockClick: (nodeId: NodeId) => void;
  onPortMouseDown: (nodeId: NodeId, portId: PortId, isInput: boolean, e: React.MouseEvent) => void;
  onPortMouseEnter: (nodeId: NodeId, portId: PortId, isInput: boolean) => void;
  onPortMouseLeave: () => void;
  onCanvasMouseMove: (e: React.MouseEvent) => void;
  onCanvasMouseUp: () => void;
  onEdgeClick: (edgeId: EdgeId) => void;
}

const BlockCanvas = React.forwardRef<SVGSVGElement, BlockCanvasProps>(
  (
    {
      graph,
      selectedNodeId,
      blockPositions,
      connectionState,
      onCanvasDrop,
      onBlockClick,
      onPortMouseDown,
      onPortMouseEnter,
      onPortMouseLeave,
      onCanvasMouseMove,
      onCanvasMouseUp,
      onEdgeClick,
    },
    canvasRef
  ) => {

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const getPortPosition = (nodeId: NodeId, portId: PortId, isInput: boolean): { x: number; y: number } | null => {
    const pos = blockPositions.get(nodeId.toString());
    if (!pos) return null;

    const blockDef = BLOCK_DEFINITIONS.find((b) => b.type === graph.getNode(nodeId)?.node_type);
    if (!blockDef) return null;

    const portOffset = isInput ? 0 : blockDef.width;
    const portIndexInside = isInput
      ? graph.getNode(nodeId)?.inputs?.findIndex((p) => p.id.equals(portId)) ?? 0
      : graph.getNode(nodeId)?.outputs?.findIndex((p) => p.id.equals(portId)) ?? 0;

    return {
      x: pos.x + portOffset,
      y: pos.y + 25 + portIndexInside * 25,
    };
  };

  const drawWire = (x1: number, y1: number, x2: number, y2: number, isActive: boolean = false) => {
    // Cubic Bézier curve for nice wire routing
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    return (
      <path
        d={d}
        stroke={isActive ? '#2196F3' : '#999'}
        strokeWidth={isActive ? 3 : 2}
        fill="none"
      />
    );
  };

  return (
    <div className={styles.canvasContainer}>
      <svg
        ref={canvasRef}
        className={styles.canvas}
        onDragOver={handleDragOver}
        onDrop={onCanvasDrop}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
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
            <polygon points="0 0, 10 3, 0 6" fill="#999" />
          </marker>
          <marker id="arrowhead-active" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#2196F3" />
          </marker>
        </defs>

        {/* Draw edges/wires */}
        {graph.getEdges().map((edge) => {
          const sourceNode = graph.getNode(edge.source[0]);
          const targetNode = graph.getNode(edge.target[0]);
          if (!sourceNode || !targetNode) return null;

          const sourcePos = getPortPosition(edge.source[0], edge.source[1], false);
          const targetPos = getPortPosition(edge.target[0], edge.target[1], true);
          if (!sourcePos || !targetPos) return null;

          const isActive = selectedNodeId?.equals(edge.source[0]) || selectedNodeId?.equals(edge.target[0]);

          return (
            <g key={edge.id.toString()}>
              {drawWire(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, isActive)}
              <line
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={targetPos.x}
                y2={targetPos.y}
                stroke="transparent"
                strokeWidth="8"
                onClick={() => onEdgeClick(edge.id)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          );
        })}

        {/* Draw preview line while connecting */}
        {connectionState.previewLine && (
          drawWire(
            connectionState.previewLine.x1,
            connectionState.previewLine.y1,
            connectionState.previewLine.x2,
            connectionState.previewLine.y2,
            true
          )
        )}

        {/* Draw blocks as rectangles */}
        {graph.getNodes().map((node) => {
          const blockDef = BLOCK_DEFINITIONS.find((b) => b.type === node.node_type);
          if (!blockDef) return null;

          const pos = blockPositions.get(node.id.toString());
          if (!pos) return null;

          const { x, y } = pos;
          const isSelected = node.id.equals(selectedNodeId);

          return (
            <g key={node.id.toString()} onMouseLeave={onPortMouseLeave}>
              {/* Block rectangle */}
              <rect
                x={x}
                y={y}
                width={blockDef.width}
                height={blockDef.height}
                rx="5"
                fill={blockDef.color}
                stroke={isSelected ? '#2196F3' : '#999'}
                strokeWidth={isSelected ? 3 : 1}
                onClick={() => onBlockClick(node.id)}
                style={{ cursor: 'pointer' }}
              />

              {/* Block icon */}
              <text
                x={x + blockDef.width / 2}
                y={y + 25}
                textAnchor="middle"
                className={styles.blockTitle}
              >
                {blockDef.icon}
              </text>

              {/* Block name */}
              <text
                x={x + blockDef.width / 2}
                y={y + 50}
                textAnchor="middle"
                fontSize="12"
                className={styles.blockName}
              >
                {node.name || blockDef.name}
              </text>

              {/* Input ports */}
              {node.inputs?.map((port, idx) => {
                const portX = x;
                const portY = y + 25 + idx * 25;
                return (
                  <g key={`${node.id.toString()}-in-${idx}`}>
                    <circle
                      cx={portX}
                      cy={portY}
                      r="4"
                      fill="#4CAF50"
                      onMouseDown={(e) => onPortMouseDown(node.id, port.id, true, e)}
                      onMouseEnter={() => onPortMouseEnter(node.id, port.id, true)}
                      onMouseLeave={onPortMouseLeave}
                      style={{ cursor: 'crosshair' }}
                    />
                    <title>{port.name} (Input)</title>
                  </g>
                );
              })}

              {/* Output ports */}
              {node.outputs?.map((port, idx) => {
                const portX = x + blockDef.width;
                const portY = y + 25 + idx * 25;
                return (
                  <g key={`${node.id.toString()}-out-${idx}`}>
                    <circle
                      cx={portX}
                      cy={portY}
                      r="4"
                      fill="#FF9800"
                      onMouseDown={(e) => onPortMouseDown(node.id, port.id, false, e)}
                      onMouseEnter={() => onPortMouseEnter(node.id, port.id, false)}
                      onMouseLeave={onPortMouseLeave}
                      style={{ cursor: 'crosshair' }}
                    />
                    <title>{port.name} (Output)</title>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
  }
);

BlockCanvas.displayName = 'BlockCanvas';

// ========== Property Panel Component ==========

const PropertyPanel: React.FC<{
  node: Node | null;
  onParameterChange: (paramName: string, value: any) => void;
  onDeleteBlock?: () => void;
}> = ({ node, onParameterChange, onDeleteBlock }) => {
  if (!node) {
    return <div className={styles.properties}>Select a block to edit properties</div>;
  }

  const blockDef = BLOCK_DEFINITIONS.find((b) => b.type === node.node_type);
  if (!blockDef) return null;

  const getMathOperationOptions = () => [
    { value: 'add', label: 'Add (+)' },
    { value: 'subtract', label: 'Subtract (-)' },
    { value: 'multiply', label: 'Multiply (×)' },
    { value: 'divide', label: 'Divide (÷)' },
    { value: 'power', label: 'Power (^)' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
  ];

  const getPortCountForBlock = (type: string) => {
    if (type === 'const' || type === 'pwm') return 1;
    return 1; // Most blocks have 1 input/output
  };

  const renderParameterControl = (key: string, value: any) => {
    // Special handling for specific parameters
    if (node.node_type === 'math' && key === 'operation') {
      return (
        <select
          value={value}
          onChange={(e) => onParameterChange(key, e.target.value)}
          className={styles.selectInput}
        >
          {getMathOperationOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (key === 'channel' || key === 'pin') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onParameterChange(key, parseInt(e.target.value))}
          className={styles.propertyInput}
          min="0"
          max="15"
        />
      );
    }

    if (typeof value === 'number') {
      return (
        <div className={styles.numberInputContainer}>
          <input
            type="range"
            value={value}
            onChange={(e) => onParameterChange(key, parseFloat(e.target.value))}
            className={styles.rangeInput}
            min={key.includes('frequency') ? '10' : '0'}
            max={key.includes('frequency') ? '50000' : key.includes('max') ? '255' : key.includes('delay') ? '10000' : '100'}
            step="1"
          />
          <input
            type="number"
            value={value}
            onChange={(e) => onParameterChange(key, parseFloat(e.target.value))}
            className={styles.propertyInput}
            step="0.1"
          />
        </div>
      );
    }

    if (typeof value === 'string') {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onParameterChange(key, e.target.value)}
          className={styles.propertyInput}
        />
      );
    }

    return (
      <input
        type="text"
        value={String(value)}
        onChange={(e) => onParameterChange(key, e.target.value)}
        className={styles.propertyInput}
      />
    );
  };

  const inputCount = node.inputs?.length ?? 0;
  const outputCount = node.outputs?.length ?? 0;

  return (
    <div className={styles.properties}>
      <div className={styles.propertyHeader}>
        <h3>{blockDef.name}</h3>
        {onDeleteBlock && (
          <button onClick={onDeleteBlock} className={styles.deleteButton} title="Delete block">
            🗑
          </button>
        )}
      </div>

      <div className={styles.propertySection}>
        <label>Block Name:</label>
        <input
          type="text"
          value={node.name}
          onChange={(e) => onParameterChange('_name', e.target.value)}
          className={styles.propertyInput}
        />
      </div>

      {/* Port information */}
      <div className={styles.portInfo}>
        <div className={styles.portDetail}>
          <span className={styles.portLabel} style={{ color: '#4CAF50' }}>
            📥 Inputs:
          </span>
          <span>{inputCount}</span>
        </div>
        <div className={styles.portDetail}>
          <span className={styles.portLabel} style={{ color: '#FF9800' }}>
            📤 Outputs:
          </span>
          <span>{outputCount}</span>
        </div>
      </div>

      {/* Parameters */}
      <div className={styles.parametersSection}>
        <h4>Parameters</h4>
        {Object.entries(node.parameters).length === 0 ? (
          <p className={styles.noParameters}>No parameters</p>
        ) : (
          Object.entries(node.parameters).map(([key, value]) => (
            <div key={key} className={styles.propertySection}>
              <label>{key}:</label>
              {renderParameterControl(key, value)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ========== Code Preview Component ==========

const CodePreview: React.FC<{
  generatedCode: GeneratedCode | null;
  compilationError: string | null;
}> = ({ generatedCode, compilationError }) => {
  const [activeTab, setActiveTab] = useState<'main' | 'platformio' | 'readme'>('main');

  if (compilationError) {
    return (
      <div className={styles.codePreview}>
        <div className={styles.errorMessage}>
          <strong>Compilation Error:</strong>
          <pre>{compilationError}</pre>
        </div>
      </div>
    );
  }

  if (!generatedCode) {
    return <div className={styles.codePreview}>Compile your diagram to see generated code</div>;
  }

  const code = {
    main: generatedCode.files['src/main.cpp'] || '',
    platformio: generatedCode.files['platformio.ini'] || '',
    readme: generatedCode.files['README.md'] || '',
  };

  return (
    <div className={styles.codePreview}>
      <div className={styles.tabs}>
        <button
          className={activeTab === 'main' ? styles.activeTab : ''}
          onClick={() => setActiveTab('main')}
        >
          main.cpp
        </button>
        <button
          className={activeTab === 'platformio' ? styles.activeTab : ''}
          onClick={() => setActiveTab('platformio')}
        >
          platformio.ini
        </button>
        <button
          className={activeTab === 'readme' ? styles.activeTab : ''}
          onClick={() => setActiveTab('readme')}
        >
          README.md
        </button>
      </div>
      <pre className={styles.codeContent}>
        {activeTab === 'main'
          ? code.main.substring(0, 2000) + (code.main.length > 2000 ? '\n... (truncated)' : '')
          : activeTab === 'platformio'
            ? code.platformio
            : code.readme.substring(0, 1500) + (code.readme.length > 1500 ? '\n... (truncated)' : '')}
      </pre>
    </div>
  );
};

// ========== Main Editor Component ==========

export const BlockDiagramEditor: React.FC<{
  targetBoard?: McuTarget;
  onCompile?: (code: GeneratedCode) => void;
}> = ({ targetBoard = McuTarget.Arduino, onCompile }) => {
  const [editorState, setEditorState] = useState<EditorState>({
    graph: new Graph(),
    selectedNodeId: null,
    selectedEdgeId: null,
    isDraggingBlock: false,
    dragStartPos: null,
    blockPositions: new Map(),
    connectionState: {
      fromNodeId: null,
      fromPortId: null,
      toNodeId: null,
      toPortId: null,
      previewLine: null,
    },
    compilationResult: null,
    generatedCode: null,
    selectedTarget: targetBoard,
    projectName: 'my_firmware',
  });

  const [compilationError, setCompilationError] = useState<string | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

  // Initialize block positions when graph changes
  useMemo(() => {
    const positions = new Map(editorState.blockPositions);
    let idx = 0;
    editorState.graph.getNodes().forEach((node) => {
      if (!positions.has(node.id.toString())) {
        const x = (idx % 4) * 200 + 40;
        const y = Math.floor(idx / 4) * 180 + 40;
        positions.set(node.id.toString(), { x, y });
        idx++;
      }
    });
    return positions;
  }, [editorState.graph.getNodes().length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Block drag start from palette
  const handleBlockPaletteStart = useCallback((definition: BlockDefinition, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('blockType', definition.type);
  }, []);

  // Block drop on canvas
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('blockType');
    const blockDef = BLOCK_DEFINITIONS.find((b) => b.type === blockType);

    if (!blockDef) return;

    // Create new block node
    const newNodeId = NodeId.new();
    const newNode: Node & BlockNode = {
      id: newNodeId,
      node_type: blockType,
      blockType: blockType,
      name: blockDef.name,
      parameters: { ...blockDef.defaultParameters },
      inputs: blockType !== 'const' ? [
        {
          id: PortId.new(),
          name: 'input',
          direction: PortDirection.Input,
          dataType: DataType.Number,
        },
      ] : [],
      outputs: blockType !== 'pwm' ? [
        {
          id: PortId.new(),
          name: 'output',
          direction: PortDirection.Output,
          dataType: DataType.Number,
        },
      ] : [],
      state: [],
    } as any;

    const newGraph = editorState.graph.clone();
    newGraph.addNode(newNode);

    // Set position from drop coordinates
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = Math.max(40, e.clientX - rect.left - 50);
      const y = Math.max(40, e.clientY - rect.top - 40);
      const newPositions = new Map(editorState.blockPositions);
      newPositions.set(newNodeId.toString(), { x, y });

      setEditorState((prev) => ({
        ...prev,
        graph: newGraph,
        selectedNodeId: newNodeId,
        blockPositions: newPositions,
      }));
    } else {
      setEditorState((prev) => ({
        ...prev,
        graph: newGraph,
        selectedNodeId: newNodeId,
      }));
    }
  }, [editorState.graph, editorState.blockPositions]);

  // Handle block selection
  const handleBlockClick = useCallback((nodeId: NodeId) => {
    setEditorState((prev) => ({
      ...prev,
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      connectionState: {
        fromNodeId: null,
        fromPortId: null,
        toNodeId: null,
        toPortId: null,
        previewLine: null,
      },
    }));
  }, []);

  // Port mouse down - start connection
  const handlePortMouseDown = useCallback(
    (nodeId: NodeId, portId: PortId, isInput: boolean, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditorState((prev) => ({
        ...prev,
        connectionState: {
          fromNodeId: nodeId,
          fromPortId: portId,
          toNodeId: null,
          toPortId: null,
          previewLine: null,
        },
      }));
    },
    []
  );

  // Port mouse enter - potential connection target
  const handlePortMouseEnter = useCallback(
    (nodeId: NodeId, portId: PortId, isInput: boolean) => {
      if (editorState.connectionState.fromNodeId && editorState.connectionState.fromPortId) {
        // Can only connect output to input
        const fromNode = editorState.graph.getNode(editorState.connectionState.fromNodeId);
        const toNode = editorState.graph.getNode(nodeId);
        if (fromNode && toNode && isInput) {
          setEditorState((prev) => ({
            ...prev,
            connectionState: {
              ...prev.connectionState,
              toNodeId: nodeId,
              toPortId: portId,
            },
          }));
        }
      }
    },
    [editorState.connectionState, editorState.graph]
  );

  // Port mouse leave
  const handlePortMouseLeave = useCallback(() => {
    setEditorState((prev) => ({
      ...prev,
      connectionState: {
        ...prev.connectionState,
        toNodeId: null,
        toPortId: null,
      },
    }));
  }, []);

  // Canvas mouse move - draw preview line
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (editorState.connectionState.fromNodeId && editorState.connectionState.fromPortId) {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const x2 = e.clientX - rect.left;
        const y2 = e.clientY - rect.top;

        // Calculate start position
        const fromNode = editorState.graph.getNode(editorState.connectionState.fromNodeId);
        const blockDef = BLOCK_DEFINITIONS.find((b) => b.type === fromNode?.node_type);
        const pos = editorState.blockPositions.get(editorState.connectionState.fromNodeId.toString());

        if (pos && blockDef && fromNode) {
          const portIndex = fromNode.outputs?.findIndex((p) => p.id.equals(editorState.connectionState.fromPortId!)) ?? 0;
          const x1 = pos.x + blockDef.width;
          const y1 = pos.y + 25 + portIndex * 25;

          setEditorState((prev) => ({
            ...prev,
            connectionState: {
              ...prev.connectionState,
              previewLine: { x1, y1, x2, y2 },
            },
          }));
        }
      }
    },
    [editorState.connectionState, editorState.graph, editorState.blockPositions]
  );

  // Canvas mouse up - complete or cancel connection
  const handleCanvasMouseUp = useCallback(() => {
    if (
      editorState.connectionState.fromNodeId &&
      editorState.connectionState.fromPortId &&
      editorState.connectionState.toNodeId &&
      editorState.connectionState.toPortId
    ) {
      // Create edge
      const newGraph = editorState.graph.clone();
      const newEdgeId = EdgeId.new();
      const newEdge = {
        id: newEdgeId,
        source: [editorState.connectionState.fromNodeId, editorState.connectionState.fromPortId],
        target: [editorState.connectionState.toNodeId, editorState.connectionState.toPortId],
        properties: {},
      };
      newGraph.addEdge(newEdge);

      setEditorState((prev) => ({
        ...prev,
        graph: newGraph,
        connectionState: {
          fromNodeId: null,
          fromPortId: null,
          toNodeId: null,
          toPortId: null,
          previewLine: null,
        },
      }));
    } else {
      // Cancel connection
      setEditorState((prev) => ({
        ...prev,
        connectionState: {
          fromNodeId: null,
          fromPortId: null,
          toNodeId: null,
          toPortId: null,
          previewLine: null,
        },
      }));
    }
  }, [editorState.connectionState, editorState.graph]);

  // Handle parameter changes
  const handleParameterChange = useCallback((paramName: string, value: any) => {
    if (!editorState.selectedNodeId) return;

    const newGraph = editorState.graph.clone();
    const node = newGraph.getNode(editorState.selectedNodeId);

    if (!node) return;

    if (paramName === '_name') {
      node.name = value;
    } else {
      node.parameters[paramName] = value;
    }

    setEditorState((prev) => ({
      ...prev,
      graph: newGraph,
    }));
  }, [editorState.selectedNodeId, editorState.graph]);

  // Delete selected block
  const handleDeleteBlock = useCallback(() => {
    if (!editorState.selectedNodeId) return;

    const newGraph = editorState.graph.clone();
    newGraph.removeNode(editorState.selectedNodeId);

    const newPositions = new Map(editorState.blockPositions);
    newPositions.delete(editorState.selectedNodeId.toString());

    setEditorState((prev) => ({
      ...prev,
      graph: newGraph,
      selectedNodeId: null,
      blockPositions: newPositions,
    }));
  }, [editorState.selectedNodeId, editorState.graph, editorState.blockPositions]);

  // Handle edge click
  const handleEdgeClick = useCallback((edgeId: EdgeId) => {
    setEditorState((prev) => ({
      ...prev,
      selectedEdgeId: edgeId,
      selectedNodeId: null,
    }));
  }, []);

  // Compile diagram
  const handleCompile = useCallback(() => {
    try {
      setCompilationError(null);

      const compiler = new BlockDiagramCompiler();
      const ast = compiler.compile(editorState.graph, editorState.selectedTarget);

      const generator = new CodeGenerator();
      const generated = generator.generate(ast, editorState.selectedTarget, editorState.projectName);

      setEditorState((prev) => ({
        ...prev,
        compilationResult: ast,
        generatedCode: generated,
      }));

      onCompile?.(generated);
    } catch (error) {
      setCompilationError(error instanceof Error ? error.message : String(error));
    }
  }, [editorState.graph, editorState.selectedTarget, editorState.projectName, onCompile]);

  // Export generated code
  const handleExport = useCallback(() => {
    if (!editorState.generatedCode) return;

    const projectData = {
      name: editorState.projectName,
      target: editorState.selectedTarget,
      code: editorState.generatedCode.files,
    };

    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editorState.projectName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editorState.generatedCode, editorState.projectName, editorState.selectedTarget]);

  // Delete selected edge
  const handleDeleteEdge = useCallback(() => {
    if (!editorState.selectedEdgeId) return;

    const newGraph = editorState.graph.clone();
    newGraph.removeEdge(editorState.selectedEdgeId);

    setEditorState((prev) => ({
      ...prev,
      graph: newGraph,
      selectedEdgeId: null,
    }));
  }, [editorState.selectedEdgeId, editorState.graph]);

  const selectedNode = editorState.selectedNodeId
    ? editorState.graph.getNode(editorState.selectedNodeId)
    : null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editorState.selectedNodeId) {
          handleDeleteBlock();
        } else if (editorState.selectedEdgeId) {
          handleDeleteEdge();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [editorState.selectedNodeId, editorState.selectedEdgeId, handleDeleteBlock, handleDeleteEdge]);

  const blockCount = editorState.graph.getNodes().length;
  const edgeCount = editorState.graph.getEdges().length;

  return (
    <div className={styles.editor}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarSection}>
          <label>Project Name:</label>
          <input
            type="text"
            value={editorState.projectName}
            onChange={(e) => setEditorState((prev) => ({ ...prev, projectName: e.target.value }))}
            className={styles.projectNameInput}
          />
        </div>

        <div className={styles.toolbarSection}>
          <label>Target Board:</label>
          <select
            value={editorState.selectedTarget}
            onChange={(e) => setEditorState((prev) => ({ ...prev, selectedTarget: e.target.value as McuTarget }))}
            className={styles.selectInput}
          >
            <option value={McuTarget.Arduino}>Arduino Uno</option>
            <option value={McuTarget.ArduinoMega}>Arduino Mega</option>
            <option value={McuTarget.STM32F103}>STM32F103 (Blue Pill)</option>
            <option value={McuTarget.STM32F401}>STM32F401 (Discovery)</option>
            <option value={McuTarget.STM32L476}>STM32L476 (Nucleo)</option>
            <option value={McuTarget.ESP32}>ESP32 DevKit</option>
          </select>
        </div>

        <div className={styles.toolbarSection}>
          <button onClick={handleCompile} className={styles.compileButton} title="Compile diagram to firmware">
            ▶ Compile
          </button>
          <button
            onClick={handleExport}
            className={styles.exportButton}
            disabled={!editorState.generatedCode}
            title="Export generated files as JSON"
          >
            ⬇ Export
          </button>
        </div>

        <div className={styles.toolbarStats}>
          <span>Blocks: {blockCount}</span>
          <span>Connections: {edgeCount}</span>
        </div>
      </div>

      {/* Main editor layout */}
      <div className={styles.editorLayout}>
        {/* Left: Block palette */}
        <BlockPalette onBlockDragStart={handleBlockPaletteStart} />

        {/* Center: Canvas */}
        <BlockCanvas
          ref={canvasRef}
          graph={editorState.graph}
          selectedNodeId={editorState.selectedNodeId}
          blockPositions={editorState.blockPositions}
          connectionState={editorState.connectionState}
          onCanvasDrop={handleCanvasDrop}
          onBlockClick={handleBlockClick}
          onPortMouseDown={handlePortMouseDown}
          onPortMouseEnter={handlePortMouseEnter}
          onPortMouseLeave={handlePortMouseLeave}
          onCanvasMouseMove={handleCanvasMouseMove}
          onCanvasMouseUp={handleCanvasMouseUp}
          onEdgeClick={handleEdgeClick}
        />

        {/* Right: Properties and code preview */}
        <div className={styles.rightPanel}>
          <PropertyPanel
            node={selectedNode || null}
            onParameterChange={handleParameterChange}
            onDeleteBlock={editorState.selectedNodeId ? handleDeleteBlock : undefined}
          />
          {editorState.selectedEdgeId && (
            <div className={styles.edgePanel}>
              <h4>Connection Selected</h4>
              <button onClick={handleDeleteEdge} className={styles.deleteButton}>
                🗑 Delete Connection
              </button>
            </div>
          )}
          <CodePreview
            generatedCode={editorState.generatedCode}
            compilationError={compilationError}
          />
        </div>
      </div>
    </div>
  );
};

export default BlockDiagramEditor;
