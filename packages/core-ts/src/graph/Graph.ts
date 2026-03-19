/**
 * Graph implementation in TypeScript
 * Mirrors the Rust graph structure for unified data representation
 */

import {
  NodeId,
  EdgeId,
  PortId,
  PortDirection,
  PortType,
  INode,
  IEdge,
  IEdgeProperties,
  IPort,
} from './types';

export class Node implements INode {
  id: NodeId;
  node_type: string;
  inputs: IPort[] = [];
  outputs: IPort[] = [];
  parameters: Record<string, unknown> = {};
  state: number[] = [];

  constructor(id: NodeId, node_type: string) {
    this.id = id;
    this.node_type = node_type;
  }

  addInput(port: IPort): void {
    this.inputs.push(port);
  }

  addOutput(port: IPort): void {
    this.outputs.push(port);
  }

  setParameter(name: string, value: unknown): void {
    this.parameters[name] = value;
  }

  getParameter(name: string): unknown {
    return this.parameters[name];
  }
}

export class Port implements IPort {
  id: PortId;
  name: string;
  direction: PortDirection;
  port_type: PortType;
  value: number[] = [0];
  unit?: string;

  constructor(
    name: string,
    direction: PortDirection,
    port_type: PortType,
  ) {
    this.id = PortId.new();
    this.name = name;
    this.direction = direction;
    this.port_type = port_type;
  }

  static input(name: string, port_type: PortType): Port {
    return new Port(name, PortDirection.Input, port_type);
  }

  static output(name: string, port_type: PortType): Port {
    return new Port(name, PortDirection.Output, port_type);
  }

  setValue(value: number[]): void {
    this.value = value;
  }

  getValue(): number[] {
    return this.value;
  }

  withUnit(unit: string): Port {
    this.unit = unit;
    return this;
  }
}

export class Edge implements IEdge {
  id: EdgeId;
  source: [NodeId, PortId];
  target: [NodeId, PortId];
  properties: IEdgeProperties = {};

  constructor(source: [NodeId, PortId], target: [NodeId, PortId]) {
    this.id = EdgeId.new();
    this.source = source;
    this.target = target;
  }
}

/** Main graph data structure */
export class Graph {
  private nodes: Map<string, Node> = new Map();
  private edges: Map<string, Edge> = new Map();
  private adjacency: Map<string, string[]> = new Map();

  /** Add a node to the graph */
  addNode(node: Node): NodeId {
    const key = node.id.toString();
    this.nodes.set(key, node);
    this.adjacency.set(key, []);
    return node.id;
  }

  /** Get a node by ID */
  getNode(id: NodeId): Node | undefined {
    return this.nodes.get(id.toString());
  }

  /** Remove a node and all connected edges */
  removeNode(id: NodeId): void {
    const key = id.toString();
    if (!this.nodes.has(key)) {
      throw new Error(`Node not found: ${key}`);
    }

    // Remove connected edges
    if (this.adjacency.has(key)) {
      const edgeIds = this.adjacency.get(key) || [];
      for (const edgeId of edgeIds) {
        this.edges.delete(edgeId);
      }
    }

    // Clean up adjacency lists
    for (const edges of this.adjacency.values()) {
      const idx = edges.findIndex((eid) => {
        const edge = this.edges.get(eid);
        return edge && (edge.source[0].equals(id) || edge.target[0].equals(id));
      });
      if (idx !== -1) {
        edges.splice(idx, 1);
      }
    }

    this.nodes.delete(key);
    this.adjacency.delete(key);
  }

  /** Add an edge to the graph */
  addEdge(edge: Edge): EdgeId {
    const sourceKey = edge.source[0].toString();
    const targetKey = edge.target[0].toString();

    if (!this.nodes.has(sourceKey)) {
      throw new Error(`Source node not found: ${sourceKey}`);
    }
    if (!this.nodes.has(targetKey)) {
      throw new Error(`Target node not found: ${targetKey}`);
    }

    const edgeKey = edge.id.toString();
    this.edges.set(edgeKey, edge);

    // Update adjacency
    const sourceAdj = this.adjacency.get(sourceKey) || [];
    sourceAdj.push(edgeKey);
    this.adjacency.set(sourceKey, sourceAdj);

    const targetAdj = this.adjacency.get(targetKey) || [];
    targetAdj.push(edgeKey);
    this.adjacency.set(targetKey, targetAdj);

    return edge.id;
  }

  /** Get an edge by ID */
  getEdge(id: EdgeId): Edge | undefined {
    return this.edges.get(id.toString());
  }

  /** Remove an edge */
  removeEdge(id: EdgeId): void {
    const key = id.toString();
    const edge = this.edges.get(key);

    if (!edge) {
      throw new Error(`Edge not found: ${key}`);
    }

    this.edges.delete(key);

    // Update adjacency
    const sourceKey = edge.source[0].toString();
    const targetKey = edge.target[0].toString();

    const sourceAdj = this.adjacency.get(sourceKey);
    if (sourceAdj) {
      const idx = sourceAdj.indexOf(key);
      if (idx !== -1) {
        sourceAdj.splice(idx, 1);
      }
    }

    const targetAdj = this.adjacency.get(targetKey);
    if (targetAdj) {
      const idx = targetAdj.indexOf(key);
      if (idx !== -1) {
        targetAdj.splice(idx, 1);
      }
    }
  }

  /** Get all nodes */
  getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /** Get all edges */
  getEdges(): Edge[] {
    return Array.from(this.edges.values());
  }

  /** Get node count */
  nodeCount(): number {
    return this.nodes.size;
  }

  /** Get edge count */
  edgeCount(): number {
    return this.edges.size;
  }

  /** Find cycles in the graph */
  findCycles(): NodeId[][] {
    const cycles: NodeId[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: NodeId[] = [];

    const dfs = (nodeId: NodeId) => {
      const key = nodeId.toString();
      visited.add(key);
      recStack.add(key);
      path.push(nodeId);

      const edgeIds = this.adjacency.get(key) || [];
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) continue;

        const nextId = edge.source[0].equals(nodeId) ? edge.target[0] : edge.source[0];
        const nextKey = nextId.toString();

        if (!visited.has(nextKey)) {
          dfs(nextId);
        } else if (recStack.has(nextKey)) {
          // Found cycle
          const idx = path.findIndex((n) => n.equals(nextId));
          if (idx !== -1) {
            cycles.push(path.slice(idx));
          }
        }
      }

      path.pop();
      recStack.delete(key);
    };

    for (const node of this.nodes.values()) {
      if (!visited.has(node.id.toString())) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /** Topological sort (returns error if cycle exists) */
  topologicalSort(): NodeId[] {
    if (this.findCycles().length > 0) {
      throw new Error('Cycle detected in graph');
    }

    const sorted: NodeId[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: NodeId) => {
      const key = nodeId.toString();
      visited.add(key);

      const edgeIds = this.adjacency.get(key) || [];
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) continue;

        const nextId = edge.source[0].equals(nodeId) ? edge.target[0] : edge.source[0];
        const nextKey = nextId.toString();

        if (!visited.has(nextKey)) {
          dfs(nextId);
        }
      }

      sorted.push(nodeId);
    };

    for (const node of this.nodes.values()) {
      if (!visited.has(node.id.toString())) {
        dfs(node.id);
      }
    }

    sorted.reverse();
    return sorted;
  }

  /** Serialize to JSON */
  toJSON(): string {
    return JSON.stringify({
      nodes: this.getNodes(),
      edges: this.getEdges(),
    });
  }

  /** Deserialize from JSON */
  static fromJSON(json: string): Graph {
    const graph = new Graph();
    const data = JSON.parse(json);

    // Deserialize nodes
    for (const nodeData of data.nodes) {
      const node = new Node(
        new NodeId(nodeData.id.value),
        nodeData.node_type,
      );
      node.parameters = nodeData.parameters;
      node.state = nodeData.state;
      graph.addNode(node);
    }

    // Deserialize edges
    for (const edgeData of data.edges) {
      const edge = new Edge(
        [new NodeId(edgeData.source[0].value), new PortId(edgeData.source[1].value)],
        [new NodeId(edgeData.target[0].value), new PortId(edgeData.target[1].value)],
      );
      edge.id = new EdgeId(edgeData.id.value);
      edge.properties = edgeData.properties;
      graph.addEdge(edge);
    }

    return graph;
  }
}
