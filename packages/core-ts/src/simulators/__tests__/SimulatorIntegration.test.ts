/**
 * Circuit Simulator Integration Tests
 *
 * Tests for netlist parsing, simulation execution, and result handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NetlistParser, ParsedComponent, ParsedNetlist } from '../NetlistParser';
import { SimulationBridge, SimulationConfig } from '../SimulationBridge';
import { CircuitSimulator } from '../CircuitSimulator';

describe('Netlist Parser', () => {
  let parser: NetlistParser;

  beforeEach(() => {
    parser = new NetlistParser();
  });

  describe('parseNetlist', () => {
    it('should parse simple RC circuit', () => {
      const netlist = `
        RC Circuit
        R1 1 2 1k
        C1 2 0 1u
        V1 1 0 DC 5
      `;

      const result = parser.parseNetlist(netlist);

      expect(result.title).toBe('RC Circuit');
      expect(result.components.length).toBe(3);
      expect(result.groundNode).toBe('0');
      expect(result.nodes.size).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('should parse resistor correctly', () => {
      const netlist = 'R1 1 2 1k';
      const result = parser.parseNetlist(netlist);

      expect(result.components[0]).toEqual(expect.objectContaining({
        refdes: 'R1',
        type: 'R',
        nodes: ['1', '2'],
        value: '1k',
      }));
    });

    it('should parse voltage source', () => {
      const netlist = 'V1 1 0 DC 5';
      const result = parser.parseNetlist(netlist);

      expect(result.components[0].type).toBe('V');
      expect(result.components[0].value).toBe('DC');
    });

    it('should parse capacitor with units', () => {
      const netlist = 'C1 1 0 10u';
      const result = parser.parseNetlist(netlist);

      expect(result.components[0]).toEqual(expect.objectContaining({
        type: 'C',
        value: '10u',
      }));
    });

    it('should handle comments', () => {
      const netlist = `
        * This is a comment
        R1 1 2 1k
        * Another comment
      `;

      const result = parser.parseNetlist(netlist);
      expect(result.components.length).toBe(1);
    });

    it('should detect GND node', () => {
      const netlist = `
        R1 1 GND 1k
        V1 1 GND DC 5
      `;

      const result = parser.parseNetlist(netlist);
      expect(result.groundNode).toMatch(/^(GND|0)$/);
    });
  });

  describe('parseValue', () => {
    it('should parse ohms', () => {
      expect(parser.parseValue('1k')).toBe(1000);
      expect(parser.parseValue('10k')).toBe(10000);
      expect(parser.parseValue('1.5k')).toBe(1500);
    });

    it('should parse farads', () => {
      expect(parser.parseValue('1u')).toBeCloseTo(1e-6);
      expect(parser.parseValue('10n')).toBeCloseTo(1e-8);
      expect(parser.parseValue('1p')).toBeCloseTo(1e-12);
    });

    it('should parse various units', () => {
      expect(parser.parseValue('1m')).toBeCloseTo(0.001);
      expect(parser.parseValue('1M')).toBeCloseTo(1e6);
      expect(parser.parseValue('1G')).toBeCloseTo(1e9);
    });

    it('should handle plain numbers', () => {
      expect(parser.parseValue('100')).toBe(100);
      expect(parser.parseValue('5.5')).toBe(5.5);
    });
  });

  describe('formatValue', () => {
    it('should format small values with m prefix', () => {
      const result = parser.formatValue(0.001, 'A');
      expect(result).toContain('mA');
    });

    it('should format large values with k prefix', () => {
      const result = parser.formatValue(1000, 'Ω');
      expect(result).toContain('kΩ');
    });

    it('should format micro values with u prefix', () => {
      const result = parser.formatValue(1e-6, 'F');
      expect(result).toContain('uF');
    });
  });

  describe('validateNetlist', () => {
    it('should accept valid RC circuit', () => {
      const netlist = `
        R1 1 2 1k
        C1 2 0 1u
        V1 1 0 DC 5
      `;

      const parsed = parser.parseNetlist(netlist);
      const errors = parser.validateNetlist(parsed);

      expect(errors.filter(e => e.startsWith('Error')).length).toBe(0);
    });

    it('should warn on missing voltage source', () => {
      const netlist = `
        R1 1 0 1k
      `;

      const parsed = parser.parseNetlist(netlist);
      const errors = parser.validateNetlist(parsed);

      expect(errors.some(e => e.includes('voltage source'))).toBe(true);
    });

    it('should warn on missing ground', () => {
      const netlist = `
        R1 1 2 1k
        V1 2 3 DC 5
      `;

      const parsed = parser.parseNetlist(netlist);
      const errors = parser.validateNetlist(parsed);

      expect(errors.some(e => e.includes('ground'))).toBe(true);
    });
  });

  describe('generateNetlist', () => {
    it('should generate valid SPICE netlist', () => {
      const components: ParsedComponent[] = [
        { refdes: 'R1', type: 'R', nodes: ['1', '2'], value: '1k' },
        { refdes: 'V1', type: 'V', nodes: ['1', '0'], value: 'DC 5' },
      ];

      const netlist = parser.generateNetlist(components, 'Test');

      expect(netlist).toContain('R1 1 2 1k');
      expect(netlist).toContain('V1 1 0 DC 5');
      expect(netlist).toContain('.end');
    });
  });
});

describe('Simulation Bridge', () => {
  let bridge: SimulationBridge;

  beforeEach(() => {
    bridge = new SimulationBridge();
  });

  describe('measurements', () => {
    it('should add voltage measurement', () => {
      const id = bridge.addMeasurement('voltage', 'node', 'node1', 'V');

      expect(id).toBeDefined();
      expect(bridge.getMeasurements().length).toBe(1);
    });

    it('should add current measurement', () => {
      const id = bridge.addMeasurement('current', 'component', 'R1', 'A');

      expect(bridge.getMeasurements()).toHaveLength(1);
    });

    it('should remove measurement', () => {
      const id = bridge.addMeasurement('voltage', 'node', 'node1', 'V');
      bridge.removeMeasurement(id);

      expect(bridge.getMeasurements().length).toBe(0);
    });

    it('should update measurement values from result', () => {
      const id = bridge.addMeasurement('voltage', 'node', 'node1', 'V');

      bridge.setResult({
        success: true,
        duration: 100,
        nodeVoltages: { node1: 5.0 },
        componentCurrents: {},
        componentPowers: {},
        timestamp: Date.now(),
        simulationTime: 1.0,
      });

      const measurements = bridge.getMeasurements();
      expect(measurements[0].value).toBe(5.0);
    });
  });

  describe('probes', () => {
    it('should add voltage probe', () => {
      const id = bridge.addProbe('voltage', 'node1');

      expect(bridge.getProbes().length).toBe(1);
      expect(bridge.getProbes()[0].type).toBe('voltage');
    });

    it('should add current probe', () => {
      const id = bridge.addProbe('current', 'R1');

      expect(bridge.getProbes()).toHaveLength(1);
    });

    it('should update probe values', () => {
      bridge.addProbe('voltage', 'node1');

      bridge.setResult({
        success: true,
        duration: 100,
        nodeVoltages: { node1: 3.3 },
        componentCurrents: {},
        componentPowers: {},
        timestamp: Date.now(),
        simulationTime: 1.0,
      });

      const probes = bridge.getProbes();
      expect(probes[0].value).toBe(3.3);
    });

    it('should track probe history', () => {
      const id = bridge.addProbe('voltage', 'node1');

      // Simulate multiple updates
      for (let i = 1; i <= 5; i++) {
        bridge.setResult({
          success: true,
          duration: 100,
          nodeVoltages: { node1: i },
          componentCurrents: {},
          componentPowers: {},
          timestamp: Date.now(),
          simulationTime: 1.0,
        });
      }

      const history = bridge.getProbeHistory(id);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('results', () => {
    it('should store simulation result', () => {
      const result = {
        success: true,
        duration: 100,
        nodeVoltages: { '1': 5.0, '2': 0 },
        componentCurrents: { R1: 0.005 },
        componentPowers: { R1: 0.025 },
        timestamp: Date.now(),
        simulationTime: 1.0,
      };

      bridge.setResult(result);

      expect(bridge.getResult()).toEqual(result);
    });

    it('should calculate total power', () => {
      bridge.setResult({
        success: true,
        duration: 100,
        nodeVoltages: {},
        componentCurrents: {},
        componentPowers: { R1: 1.0, R2: 2.0, V1: -3.0 },
        timestamp: Date.now(),
        simulationTime: 1.0,
      });

      expect(bridge.getTotalPower()).toBeCloseTo(0);
    });

    it('should calculate efficiency', () => {
      bridge.setResult({
        success: true,
        duration: 100,
        nodeVoltages: {},
        componentCurrents: {},
        componentPowers: {
          V1: -10.0, // Input (negative for source)
          R1: 8.0,   // Dissipated
          R2: 2.0,   // Dissipated
        },
        timestamp: Date.now(),
        simulationTime: 1.0,
      });

      const efficiency = bridge.getCircuitEfficiency();
      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThanOrEqual(100);
    });
  });

  describe('queries', () => {
    beforeEach(() => {
      bridge.setResult({
        success: true,
        duration: 100,
        nodeVoltages: { node1: 5.0, node2: 2.0 },
        componentCurrents: { R1: 0.001, R2: 0.002 },
        componentPowers: { R1: 0.005, R2: 0.004 },
        timestamp: Date.now(),
        simulationTime: 1.0,
      });
    });

    it('should get node voltage', () => {
      expect(bridge.getNodeVoltage('node1')).toBe(5.0);
      expect(bridge.getNodeVoltage('node2')).toBe(2.0);
    });

    it('should get component current', () => {
      expect(bridge.getComponentCurrent('R1')).toBe(0.001);
    });

    it('should get component power', () => {
      expect(bridge.getComponentPower('R1')).toBe(0.005);
    });

    it('should find nodes above threshold', () => {
      const nodes = bridge.findNodesAboveThreshold(3.0);
      expect(nodes).toContain('node1');
      expect(nodes).not.toContain('node2');
    });

    it('should find high power components', () => {
      const comps = bridge.findHighPowerComponents(0.004);
      expect(comps).toHaveLength(2); // Both R1 and R2
    });
  });

  describe('export', () => {
    it('should export results as JSON', () => {
      bridge.setResult({
        success: true,
        duration: 100,
        nodeVoltages: { node1: 5.0 },
        componentCurrents: { R1: 0.001 },
        componentPowers: { R1: 0.005 },
        timestamp: Date.now(),
        simulationTime: 1.0,
      });

      const json = bridge.exportResults();
      const parsed = JSON.parse(json);

      expect(parsed.result.success).toBe(true);
      expect(parsed.result.nodeVoltages.node1).toBe(5.0);
    });

    it('should export probe data', () => {
      bridge.addProbe('voltage', 'node1');

      bridge.setResult({
        success: true,
        duration: 100,
        nodeVoltages: { node1: 5.0 },
        componentCurrents: {},
        componentPowers: {},
        timestamp: Date.now(),
        simulationTime: 1.0,
      });

      const data = bridge.exportProbeData();
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('history');
    });
  });
});

describe('Circuit Simulator', () => {
  let simulator: CircuitSimulator;

  beforeEach(() => {
    simulator = new CircuitSimulator();
  });

  it('should simulate SPICE netlist', async () => {
    const netlist = `
      Simple RC
      R1 1 2 1k
      C1 2 0 1u
      V1 1 0 DC 5
    `;

    const result = await simulator.simulateNetlist(netlist);

    expect(result.success).toBe(true);
    expect(result.nodeVoltages).toBeDefined();
    expect(result.componentCurrents).toBeDefined();
  });

  it('should add and manage measurements', async () => {
    simulator.addVoltageMeasurement('node1');
    simulator.addCurrentMeasurement('R1');
    simulator.addPowerMeasurement('R1');

    const measurements = simulator.getMeasurements();
    expect(measurements.length).toBe(3);
  });

  it('should add and manage probes', async () => {
    const probeId1 = simulator.addVoltageProbe('node1');
    const probeId2 = simulator.addCurrentProbe('R1');

    expect(simulator.getProbes().length).toBe(2);

    simulator.removeProbe(probeId1);
    expect(simulator.getProbes().length).toBe(1);
  });

  it('should provide summary', async () => {
    const netlist = `
      R1 1 0 1k
      V1 1 0 DC 5
    `;

    await simulator.simulateNetlist(netlist);
    const summary = simulator.getSummary();

    expect(summary).toBeDefined();
    expect(summary?.totalPower).toBeDefined();
  });

  it('should export results', async () => {
    const netlist = 'R1 1 0 1k\nV1 1 0 DC 5';
    await simulator.simulateNetlist(netlist);

    const json = simulator.export();
    expect(json).toBeTruthy();
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('Integration Tests', () => {
  it('should handle complete simulation workflow', async () => {
    const parser = new NetlistParser();
    const simulator = new CircuitSimulator();

    // Parse circuit
    const netlist = `
      Test Circuit
      R1 1 2 1k
      C1 2 0 1u
      V1 1 0 DC 5
    `;

    const parsed = parser.parseNetlist(netlist);
    expect(parsed.components.length).toBe(3);

    // Simulate
    const result = await simulator.simulateNetlist(netlist);
    expect(result.success).toBe(true);

    // Add measurements
    simulator.addVoltageMeasurement('1');
    simulator.addVoltageMeasurement('2');

    // Get results
    const measurements = simulator.getMeasurements();
    expect(measurements.length).toBeGreaterThan(0);
  });
});
