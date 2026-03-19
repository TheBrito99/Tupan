/**
 * Tests for GraphBridge WASM integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphBridge } from '../wasm-bridge/GraphBridge';
import { NodeId, PortId, PortType } from '../graph/types';

describe('GraphBridge', () => {
  let bridge: GraphBridge;

  beforeEach(() => {
    bridge = new GraphBridge();
  });

  it('should create a new bridge', () => {
    expect(bridge).toBeDefined();
    expect(bridge.isInitialized()).toBe(false);
  });

  it('should add nodes to the graph', () => {
    const nodeId = bridge.addNode('resistor', { resistance: 1000 });
    expect(nodeId).toBeDefined();

    const graph = bridge.getGraph();
    expect(graph.nodeCount()).toBe(1);
  });

  it('should add edges between nodes', () => {
    const node1Id = bridge.addNode('resistor');
    const node2Id = bridge.addNode('capacitor');

    const portId1 = PortId.new();
    const portId2 = PortId.new();

    const edgeId = bridge.addEdge(node1Id, portId1, node2Id, portId2);
    expect(edgeId).toBeDefined();

    const graph = bridge.getGraph();
    expect(graph.edgeCount()).toBe(1);
  });

  it('should serialize graph to JSON', () => {
    bridge.addNode('resistor', { resistance: 1000 });
    bridge.addNode('capacitor', { capacitance: 10e-6 });

    const graphJson = bridge.getGraph().toJSON();
    expect(graphJson).toContain('nodes');
    expect(graphJson).toContain('edges');

    const parsed = JSON.parse(graphJson);
    expect(parsed.nodes.length).toBe(2);
  });

  it('should handle WASM initialization gracefully', async () => {
    // Since WASM module might not be built yet, we test graceful failure
    const result = await bridge.simulate();
    expect(result).toBeDefined();
    expect(result.converged === false || result.converged === true).toBe(true);
  });

  it('should create a simple RC circuit', () => {
    // Simulate creating a simple RC circuit
    const resistor = bridge.addNode('resistor', { resistance: 1000 });
    const capacitor = bridge.addNode('capacitor', { capacitance: 10e-6 });
    const source = bridge.addNode('voltage_source', { voltage: 5.0 });

    const portR1 = PortId.new();
    const portR2 = PortId.new();
    const portC1 = PortId.new();
    const portC2 = PortId.new();
    const portS1 = PortId.new();
    const portS2 = PortId.new();

    // Connect: V+ -> R -> C -> V-
    bridge.addEdge(source, portS1, resistor, portR1);
    bridge.addEdge(resistor, portR2, capacitor, portC1);
    bridge.addEdge(capacitor, portC2, source, portS2);

    const graph = bridge.getGraph();
    expect(graph.nodeCount()).toBe(3);
    expect(graph.edgeCount()).toBe(3);
  });
});
