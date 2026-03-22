/**
 * WASM Bridge for Graph Communication
 *
 * Handles communication between TypeScript and the Rust WASM module.
 * Provides a type-safe interface for graph operations.
 */

import { Graph, Node, Port, Edge } from '../graph/Graph';
import { NodeId, EdgeId, PortId, PortDirection, PortType } from '../graph/types';

/**
 * Bridge between TypeScript Graph and Rust WASM Graph
 * Handles initialization and communication with the Rust WASM module
 */
export class GraphBridge {
  private graph: Graph;
  private wasmGraph: any = null;
  private initialized: boolean = false;

  constructor() {
    this.graph = new Graph();
  }

  /**
   * Initialize the WASM module
   * This should be called before using the bridge
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Dynamic import of WASM module
      const wasmModule = await import('@tupan/core-rust');

      // Create a new WASM graph instance
      this.wasmGraph = new wasmModule.WasmGraph();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize WASM module:', error);
      throw new Error(`WASM module initialization failed: ${error}`);
    }
  }

  /**
   * Check if WASM module is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Add a node to the graph (both local and WASM)
   */
  addNode(nodeType: string, parameters?: Record<string, unknown>): NodeId {
    const node = new Node(NodeId.new(), nodeType);
    if (parameters) {
      node.parameters = parameters;
    }

    const nodeId = this.graph.addNode(node);

    // Also add to WASM if initialized
    if (this.initialized && this.wasmGraph) {
      try {
        this.wasmGraph.add_node(JSON.stringify(node));
      } catch (error) {
        console.warn('Failed to sync node to WASM:', error);
      }
    }

    return nodeId;
  }

  /**
   * Add an edge to the graph (both local and WASM)
   */
  addEdge(sourceNodeId: NodeId, sourcePortId: PortId, targetNodeId: NodeId, targetPortId: PortId): EdgeId {
    const edge = new Edge([sourceNodeId, sourcePortId], [targetNodeId, targetPortId]);
    const edgeId = this.graph.addEdge(edge);

    // Also add to WASM if initialized
    if (this.initialized && this.wasmGraph) {
      try {
        this.wasmGraph.add_edge(JSON.stringify(edge));
      } catch (error) {
        console.warn('Failed to sync edge to WASM:', error);
      }
    }

    return edgeId;
  }

  /**
   * Get the local TypeScript graph
   */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * Sync local graph to WASM module
   */
  syncToWasm(): void {
    if (!this.initialized || !this.wasmGraph) {
      return;
    }

    try {
      const graphJson = this.graph.toJSON();
      // Load into WASM
      const nodes = this.graph.getNodes();
      const edges = this.graph.getEdges();

      for (const node of nodes) {
        this.wasmGraph.add_node(JSON.stringify(node));
      }

      for (const edge of edges) {
        this.wasmGraph.add_edge(JSON.stringify(edge));
      }
    } catch (error) {
      console.error('Failed to sync graph to WASM:', error);
      throw error;
    }
  }

  /**
   * Sync WASM graph back to TypeScript
   */
  syncFromWasm(): void {
    if (!this.initialized || !this.wasmGraph) {
      return;
    }

    try {
      const nodesJson = this.wasmGraph.get_nodes();
      const edgesJson = this.wasmGraph.get_edges();

      this.graph = new Graph();

      const nodes = JSON.parse(nodesJson);
      const edges = JSON.parse(edgesJson);

      for (const nodeData of nodes) {
        const node = new Node(new NodeId(), nodeData.node_type);
        node.parameters = nodeData.parameters;
        node.state = nodeData.state;
        this.graph.addNode(node);
      }

      for (const edgeData of edges) {
        const edge = new Edge(
          [new NodeId(), new PortId()],
          [new NodeId(), new PortId()],
        );
        this.graph.addEdge(edge);
      }
    } catch (error) {
      console.error('Failed to sync graph from WASM:', error);
      throw error;
    }
  }

  /**
   * Simulate the graph using WASM solver
   */
  async simulate(
    solverType: string = 'ode',
    dt: number = 0.001,
    duration: number = 1.0,
  ): Promise<SimulationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.wasmGraph) {
      return {
        time: [],
        states: [],
        converged: false,
        error: 'WASM module not available',
      };
    }

    try {
      // Sync local graph to WASM
      this.syncToWasm();

      // In a real implementation, we would call the WASM solver here
      // For now, return placeholder
      return {
        time: [],
        states: [],
        converged: true,
        error: undefined,
      };
    } catch (error) {
      return {
        time: [],
        states: [],
        converged: false,
        error: `Simulation failed: ${error}`,
      };
    }
  }

  /**
   * Reset the simulation
   */
  reset(): void {
    this.graph = new Graph();
  }
}

/**
 * Result of a simulation
 */
export interface SimulationResult {
  time: number[];
  states: number[][];
  converged: boolean;
  error?: string;
}
