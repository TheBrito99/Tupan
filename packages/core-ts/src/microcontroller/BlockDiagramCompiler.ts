/**
 * Block Diagram Compiler
 *
 * Converts visual block diagrams into Abstract Syntax Tree (AST)
 * for C++ code generation. Performs topological sorting, type checking,
 * cycle detection, and validation.
 *
 * Supported block types:
 * - PID controller (proportional-integral-derivative)
 * - Low-pass filter
 * - Math operations (add, subtract, multiply, divide, square, sqrt, abs, negate, max, min)
 * - ADC input (analog-to-digital converter)
 * - PWM output (pulse-width modulation)
 * - Saturation (value clamping)
 * - Delay (time-based buffering)
 * - Const (constant value)
 */

import { NodeId, EdgeId, PortId, PortDirection } from '../graph/types';
import { Graph, Node, Edge } from '../graph/Graph';

/**
 * Port data type
 */
export enum DataType {
  Number = 'number',
  Boolean = 'boolean',
  Array = 'array',
}

/**
 * Port definition in block diagram
 */
export interface BlockPort {
  id: PortId;
  name: string;
  direction: PortDirection;
  dataType: DataType;
}

/**
 * Block node definition
 */
export interface BlockNode {
  id: NodeId;
  blockType:
    | 'pid'
    | 'filter'
    | 'math'
    | 'adc'
    | 'pwm'
    | 'saturation'
    | 'delay'
    | 'const';
  name: string;
  parameters: Record<string, number | string>;
  inputs: BlockPort[];
  outputs: BlockPort[];
}

/**
 * Code generation variable
 */
export interface Variable {
  name: string;
  type: 'float' | 'int' | 'bool' | 'uint8_t' | 'uint16_t' | 'uint32_t';
  initialValue?: string;
  isArray?: boolean;
  arraySize?: number;
}

/**
 * Code generation statement
 */
export interface Statement {
  code: string;
  indent: number;
}

/**
 * Function definition for generated code
 */
export interface FunctionDef {
  name: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  body: Statement[];
}

/**
 * Compiled AST ready for code generation
 */
export interface CompiledAst {
  globalVariables: Variable[];
  setupStatements: Statement[];
  loopStatements: Statement[];
  functions: FunctionDef[];
  includes: string[];
  defines: Record<string, string>;
}

/**
 * Block diagram compiler
 */
export class BlockDiagramCompiler {
  /**
   * Compile block diagram to AST
   */
  compile(graph: Graph, target: string = 'arduino'): CompiledAst {
    // Step 1: Validate graph structure
    this.validateGraph(graph);

    // Step 2: Check for cycles
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      throw new Error(
        `Cyclic dependency detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`
      );
    }

    // Step 3: Topological sort for execution order
    const sortedNodeIds = this.topologicalSort(graph);

    // Step 4: Type inference and checking
    this.inferTypes(graph, sortedNodeIds);

    // Step 5: Generate AST
    const ast = this.generateAst(graph, sortedNodeIds, target);

    return ast;
  }

  /**
   * Validate graph structure (no dangling wires, all required ports connected)
   */
  private validateGraph(graph: Graph): void {
    const nodes = graph.getNodes();

    for (const node of nodes) {
      const blockNode = node as any as BlockNode;

      // Check for dangling input ports
      for (const input of blockNode.inputs) {
        if (input.direction !== PortDirection.Input) continue;

        const incomingEdges = graph
          .getEdges()
          .filter(
            (e: any) =>
              e.target && e.target[0].equals(blockNode.id) && e.target[1].equals(input.id)
          );

        if (incomingEdges.length === 0) {
          throw new Error(
            `Dangling input port: ${blockNode.name}.${input.name} has no source`
          );
        }
      }
    }
  }

  /**
   * Detect cycles in graph using DFS
   */
  private detectCycles(graph: Graph): string[][] {
    const visited = new Map<string, 'white' | 'gray' | 'black'>();
    const cycles: string[][] = [];
    const recursionStack: string[] = [];

    const nodes = graph.getNodes();

    for (const node of nodes) {
      if (!visited.has(node.id.toString())) {
        this.dfs(node.id, graph, visited, cycles, recursionStack);
      }
    }

    return cycles;
  }

  /**
   * DFS for cycle detection
   */
  private dfs(
    nodeId: NodeId,
    graph: Graph,
    visited: Map<string, 'white' | 'gray' | 'black'>,
    cycles: string[][],
    stack: string[]
  ): void {
    const nodeIdStr = nodeId.toString();
    visited.set(nodeIdStr, 'gray');
    stack.push(nodeIdStr);

    const edges = graph.getEdges();
    const outgoing = edges.filter((e: any) => e.source && e.source[0].equals(nodeId));

    for (const edge of outgoing) {
      const targetId = (edge as any).target[0];
      const targetIdStr = targetId.toString();

      if (!visited.has(targetIdStr)) {
        this.dfs(targetId, graph, visited, cycles, stack);
      } else if (visited.get(targetIdStr) === 'gray') {
        // Found cycle
        const cycleStart = stack.indexOf(targetIdStr);
        cycles.push([...stack.slice(cycleStart), targetIdStr]);
      }
    }

    stack.pop();
    visited.set(nodeIdStr, 'black');
  }

  /**
   * Topological sort using Kahn's algorithm
   */
  private topologicalSort(graph: Graph): NodeId[] {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    // Calculate in-degree
    const inDegree = new Map<string, number>();
    for (const node of nodes) {
      inDegree.set(node.id.toString(), 0);
    }

    for (const edge of edges) {
      const targetId = (edge as any).target[0].toString();
      inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
    }

    // Queue of nodes with in-degree 0
    const queue: NodeId[] = [];
    for (const node of nodes) {
      if (inDegree.get(node.id.toString()) === 0) {
        queue.push(node.id);
      }
    }

    const sorted: NodeId[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      sorted.push(nodeId);

      // Find outgoing edges
      const outgoing = edges.filter((e: any) => e.source && e.source[0].equals(nodeId));

      for (const edge of outgoing) {
        const targetId = (edge as any).target[0];
        const targetIdStr = targetId.toString();
        const newDegree = (inDegree.get(targetIdStr) || 0) - 1;
        inDegree.set(targetIdStr, newDegree);

        if (newDegree === 0) {
          queue.push(targetId);
        }
      }
    }

    return sorted;
  }

  /**
   * Type inference and compatibility checking
   */
  private inferTypes(graph: Graph, sortedNodeIds: NodeId[]): void {
    const nodes = graph.getNodes();
    const nodeMap = new Map<string, Node>();

    for (const node of nodes) {
      nodeMap.set(node.id.toString(), node);
    }

    const edges = graph.getEdges();
    const typeMap = new Map<string, DataType>(); // portId -> dataType

    // First pass: infer input types from connections
    for (const edge of edges) {
      const sourcePortId = (edge as any).source[1].toString();
      const targetPortId = (edge as any).target[1].toString();
      const targetNodeId = (edge as any).target[0].toString();

      const targetNode = nodeMap.get(targetNodeId) as any as BlockNode;
      if (!targetNode) continue;

      // Find target port type
      const targetPort = targetNode.inputs.find((p: BlockPort) => p.id.toString() === targetPortId);

      if (targetPort) {
        // Check source port type
        const sourceNodeId = (edge as any).source[0].toString();
        const sourceNode = nodeMap.get(sourceNodeId) as any as BlockNode;

        if (sourceNode) {
          const sourcePort = sourceNode.outputs.find(
            (p: BlockPort) => p.id.toString() === sourcePortId
          );

          // Type compatibility check
          if (sourcePort && sourcePort.dataType !== targetPort.dataType) {
            // Allow implicit conversions (number -> bool, etc.)
            if (
              !(
                (sourcePort.dataType === DataType.Number && targetPort.dataType === DataType.Boolean) ||
                (sourcePort.dataType === DataType.Boolean && targetPort.dataType === DataType.Number)
              )
            ) {
              throw new Error(
                `Type mismatch: ${sourceNode.name}.${sourcePort.name} (${sourcePort.dataType}) ` +
                  `-> ${targetNode.name}.${targetPort.name} (${targetPort.dataType})`
              );
            }
          }
        }
      }
    }
  }

  /**
   * Generate AST from validated and sorted graph
   */
  private generateAst(graph: Graph, sortedNodeIds: NodeId[], target: string): CompiledAst {
    const nodes = graph.getNodes();
    const nodeMap = new Map<string, Node>();

    for (const node of nodes) {
      nodeMap.set(node.id.toString(), node);
    }

    const globalVariables: Variable[] = [];
    const setupStatements: Statement[] = [];
    const loopStatements: Statement[] = [];
    const functions: FunctionDef[] = [];
    const includes: string[] = [];
    const defines: Record<string, string> = {};

    // Add standard includes
    includes.push('#include <Arduino.h>');

    // Generate code for each block in topological order
    for (const nodeId of sortedNodeIds) {
      const node = nodeMap.get(nodeId.toString()) as any as BlockNode;
      if (!node) continue;

      switch (node.blockType) {
        case 'pid':
          this.generatePidBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements
          );
          break;

        case 'filter':
          this.generateFilterBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements
          );
          break;

        case 'math':
          this.generateMathBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements
          );
          break;

        case 'adc':
          this.generateAdcBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements,
            target
          );
          break;

        case 'pwm':
          this.generatePwmBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements,
            target
          );
          break;

        case 'saturation':
          this.generateSaturationBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements
          );
          break;

        case 'delay':
          this.generateDelayBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements
          );
          break;

        case 'const':
          this.generateConstBlock(
            node,
            globalVariables,
            setupStatements,
            loopStatements
          );
          break;
      }
    }

    return {
      globalVariables,
      setupStatements,
      loopStatements,
      functions,
      includes,
      defines,
    };
  }

  /**
   * Generate PID controller block code
   */
  private generatePidBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[]
  ): void {
    const kp = parseFloat(String(node.parameters.kp || 1.0));
    const ki = parseFloat(String(node.parameters.ki || 0.0));
    const kd = parseFloat(String(node.parameters.kd || 0.0));
    const varName = this.sanitizeVarName(node.name);

    // State variables
    globals.push(
      { name: `${varName}_integral`, type: 'float', initialValue: '0.0f' },
      { name: `${varName}_prev_error`, type: 'float', initialValue: '0.0f' }
    );

    // PID defines
    setup.push({ code: `float ${varName}_KP = ${kp.toFixed(4)}f;`, indent: 0 });
    setup.push({ code: `float ${varName}_KI = ${ki.toFixed(4)}f;`, indent: 0 });
    setup.push({ code: `float ${varName}_KD = ${kd.toFixed(4)}f;`, indent: 0 });

    // PID loop code (placeholder)
    loop.push({ code: `// PID block: ${node.name}`, indent: 0 });
  }

  /**
   * Generate low-pass filter block code
   */
  private generateFilterBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[]
  ): void {
    const cutoffFreq = parseFloat(String(node.parameters.cutoff || 1.0));
    const varName = this.sanitizeVarName(node.name);

    globals.push({ name: `${varName}_output`, type: 'float', initialValue: '0.0f' });

    const alpha = (2 * Math.PI * cutoffFreq) / (2 * Math.PI * cutoffFreq + 1);
    setup.push({ code: `float ${varName}_alpha = ${alpha.toFixed(4)}f;`, indent: 0 });

    loop.push({ code: `// Low-pass filter: ${node.name}`, indent: 0 });
  }

  /**
   * Generate math block code
   */
  private generateMathBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[]
  ): void {
    const operation = String(node.parameters.operation || 'add');
    const varName = this.sanitizeVarName(node.name);

    globals.push({ name: `${varName}_result`, type: 'float', initialValue: '0.0f' });

    loop.push({
      code: `// Math operation (${operation}): ${node.name}`,
      indent: 0,
    });
  }

  /**
   * Generate ADC input block code
   */
  private generateAdcBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[],
    target: string
  ): void {
    const channel = parseInt(String(node.parameters.channel || 0));
    const varName = this.sanitizeVarName(node.name);

    globals.push({ name: `${varName}_raw`, type: 'uint16_t', initialValue: '0' });
    globals.push({ name: `${varName}_voltage`, type: 'float', initialValue: '0.0f' });

    // Target-specific setup
    if (target === 'stm32f103' || target === 'stm32f401' || target === 'stm32l476') {
      setup.push({ code: `// STM32 ADC setup for channel ${channel}`, indent: 0 });
    } else if (target === 'esp32') {
      setup.push({ code: `// ESP32 ADC setup for pin A${channel}`, indent: 0 });
    } else {
      setup.push({ code: `// Arduino ADC setup`, indent: 0 });
    }

    loop.push({
      code: `${varName}_raw = analogRead(A${channel});`,
      indent: 1,
    });
    loop.push({
      code: `${varName}_voltage = ${varName}_raw * 5.0f / 1023.0f;`,
      indent: 1,
    });
  }

  /**
   * Generate PWM output block code
   */
  private generatePwmBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[],
    target: string
  ): void {
    const pin = parseInt(String(node.parameters.pin || 3));
    const frequency = parseInt(String(node.parameters.frequency || 1000));
    const varName = this.sanitizeVarName(node.name);

    globals.push({ name: `${varName}_duty`, type: 'uint8_t', initialValue: '0' });

    setup.push({
      code: `pinMode(${pin}, OUTPUT);`,
      indent: 1,
    });

    if (target === 'stm32f103' || target === 'stm32f401' || target === 'stm32l476') {
      setup.push({
        code: `// STM32 PWM frequency: ${frequency} Hz`,
        indent: 1,
      });
    }

    loop.push({
      code: `analogWrite(${pin}, ${varName}_duty);`,
      indent: 1,
    });
  }

  /**
   * Generate saturation (value clamping) block code
   */
  private generateSaturationBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[]
  ): void {
    const minVal = parseFloat(String(node.parameters.min || 0));
    const maxVal = parseFloat(String(node.parameters.max || 255));
    const varName = this.sanitizeVarName(node.name);

    globals.push({ name: `${varName}_output`, type: 'float', initialValue: '0.0f' });

    loop.push({
      code: `// Saturation: clamp to [${minVal}, ${maxVal}]`,
      indent: 0,
    });
  }

  /**
   * Generate delay block code
   */
  private generateDelayBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[]
  ): void {
    const delayMs = parseInt(String(node.parameters.delay_ms || 0));
    const varName = this.sanitizeVarName(node.name);

    globals.push({
      name: `${varName}_last_time`,
      type: 'uint32_t',
      initialValue: '0',
    });

    loop.push({ code: `// Delay: ${delayMs} ms`, indent: 0 });
  }

  /**
   * Generate constant value block code
   */
  private generateConstBlock(
    node: BlockNode,
    globals: Variable[],
    setup: Statement[],
    loop: Statement[]
  ): void {
    const value = parseFloat(String(node.parameters.value || 0));
    const varName = this.sanitizeVarName(node.name);

    globals.push({
      name: `${varName}_value`,
      type: 'float',
      initialValue: `${value.toFixed(4)}f`,
    });

    setup.push({
      code: `#define ${varName}_VALUE ${value.toFixed(4)}f`,
      indent: 0,
    });
  }

  /**
   * Sanitize variable name (alphanumeric + underscore only)
   */
  private sanitizeVarName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .substring(0, 30);
  }
}
