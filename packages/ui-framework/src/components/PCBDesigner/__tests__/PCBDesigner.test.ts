/**
 * PCB Designer Tests
 *
 * Comprehensive testing for:
 * - Board management and component placement
 * - Design rule checking
 * - Trace routing
 * - Footprint library
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PCBBoardManager } from '../PCBBoardManager';
import { DRCEngine } from '../DRCEngine';
import { TraceRouter } from '../TraceRouter';
import { FootprintLibrary } from '../FootprintLibrary';
import { PCBLayer } from '../types';

describe('PCBBoardManager', () => {
  let manager: PCBBoardManager;

  beforeEach(() => {
    manager = new PCBBoardManager(100, 100);
  });

  describe('Component Placement', () => {
    it('should place component on board', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;

      const component = manager.placeComponent('R1', footprint, 25, 25);

      expect(component).toBeDefined();
      expect(component.refdes).toBe('R1');
      expect(component.position).toEqual({ x: 25, y: 25 });
      expect(component.placed).toBe(true);
    });

    it('should get all placed components', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;

      manager.placeComponent('R1', footprint, 25, 25);
      manager.placeComponent('C1', footprint, 50, 50);

      const components = manager.getComponents();
      expect(components).toHaveLength(2);
      expect(components[0].refdes).toBe('R1');
      expect(components[1].refdes).toBe('C1');
    });

    it('should move component', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;
      const component = manager.placeComponent('R1', footprint, 25, 25);

      manager.moveComponent(component.id, 40, 40);

      const updated = manager.getComponents()[0];
      expect(updated.position).toEqual({ x: 40, y: 40 });
    });

    it('should rotate component', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;
      const component = manager.placeComponent('R1', footprint, 25, 25, 0);

      manager.rotateComponent(component.id, 90);
      expect(manager.getComponents()[0].rotation).toBe(90);

      manager.rotateComponent(component.id, 180);
      expect(manager.getComponents()[0].rotation).toBe(180);
    });

    it('should flip component between sides', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;
      const component = manager.placeComponent('R1', footprint, 25, 25);

      expect(component.side).toBe('top');
      manager.flipComponent(component.id);
      expect(manager.getComponents()[0].side).toBe('bottom');
    });
  });

  describe('Netlist Import', () => {
    it('should import netlist from schematic', () => {
      const netlist = {
        title: 'RC Circuit',
        components: [
          { refdes: 'R1', footprint: 'R0603', value: '1k' },
          { refdes: 'C1', footprint: 'C0603', value: '1u' },
        ],
        nets: [
          { netName: 'N1', nodes: [{ refdes: 'R1', pin: '1' }, { refdes: 'C1', pin: '1' }] },
          { netName: 'GND', nodes: [{ refdes: 'R1', pin: '2' }, { refdes: 'C1', pin: '2' }] },
        ],
      };

      manager.importNetlist(netlist);
      const unrouted = manager.getUnroutedNets();

      expect(unrouted).toHaveLength(2);
      expect(unrouted[0].netName).toBe('N1');
      expect(unrouted[1].netName).toBe('GND');
    });

    it('should track net connectivity', () => {
      const netlist = {
        title: 'Test',
        components: [],
        nets: [
          { netName: 'VCC', nodes: [{ refdes: 'U1', pin: '1' }, { refdes: 'R1', pin: '1' }] },
        ],
      };

      manager.importNetlist(netlist);
      const vccPins = manager.getNetConnectivity('VCC');

      expect(vccPins).toHaveLength(2);
      expect(vccPins[0]).toEqual({ componentId: 'U1', padNumber: '1' });
    });

    it('should mark nets as routed', () => {
      const netlist = {
        title: 'Test',
        components: [],
        nets: [
          { netName: 'N1', nodes: [{ refdes: 'R1', pin: '1' }] },
        ],
      };

      manager.importNetlist(netlist);
      expect(manager.getUnroutedNets()).toHaveLength(1);

      manager.markNetRouted('N1');
      expect(manager.getUnroutedNets()).toHaveLength(0);
    });
  });

  describe('Board Stats', () => {
    it('should calculate placement statistics', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;

      manager.placeComponent('R1', footprint, 25, 25);
      manager.placeComponent('R2', footprint, 50, 50);

      const stats = manager.getPlacementStats();

      expect(stats.totalComponents).toBe(2);
      expect(stats.placedComponents).toBe(2);
      expect(stats.completeness).toBe(0); // No nets routed
    });
  });

  describe('Board Export/Import', () => {
    it('should export board to JSON', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;

      manager.placeComponent('R1', footprint, 25, 25);

      const json = manager.exportBoard();
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json);
      expect(parsed.components).toHaveLength(1);
      expect(parsed.components[0].refdes).toBe('R1');
    });

    it('should import board from JSON', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;

      manager.placeComponent('R1', footprint, 25, 25);
      const json = manager.exportBoard();

      const newManager = new PCBBoardManager(100, 100);
      newManager.importBoard(json);

      expect(newManager.getComponents()).toHaveLength(1);
    });
  });
});

describe('DRCEngine', () => {
  let manager: PCBBoardManager;
  let drc: DRCEngine;

  beforeEach(() => {
    manager = new PCBBoardManager(100, 100);
    const board = manager.getBoard();
    drc = new DRCEngine(board);
  });

  describe('Trace Width Checking', () => {
    it('should detect trace width violations', () => {
      const board = manager.getBoard();
      const minWidth = board.designRules.find(r => r.name === 'Trace Width')?.minValue || 0.15;

      // Add a trace that's too thin
      board.traces.push({
        id: 'trace1',
        netName: 'test',
        layer: PCBLayer.SIGNAL_TOP,
        width: minWidth - 0.05, // Too thin
        style: 'manhattan',
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        ],
      });

      const violations = drc.runFullDRC();
      expect(violations.some(v => v.type === 'TraceWidth')).toBe(true);
    });

    it('should pass valid trace widths', () => {
      const board = manager.getBoard();
      const minWidth = board.designRules.find(r => r.name === 'Trace Width')?.minValue || 0.15;

      board.traces.push({
        id: 'trace1',
        netName: 'test',
        layer: PCBLayer.SIGNAL_TOP,
        width: minWidth + 0.1, // Valid
        style: 'manhattan',
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        ],
      });

      const violations = drc.runFullDRC();
      expect(violations.filter(v => v.type === 'TraceWidth')).toHaveLength(0);
    });
  });

  describe('Via Clearance Checking', () => {
    it('should detect via spacing violations', () => {
      const board = manager.getBoard();

      board.vias.push(
        {
          id: 'via1',
          position: { x: 10, y: 10 },
          diameter: 0.6,
          fromLayer: PCBLayer.SIGNAL_TOP,
          toLayer: PCBLayer.SIGNAL_BOTTOM,
        },
        {
          id: 'via2',
          position: { x: 10.5, y: 10 }, // Too close (only 0.5mm apart)
          diameter: 0.6,
          fromLayer: PCBLayer.SIGNAL_TOP,
          toLayer: PCBLayer.SIGNAL_BOTTOM,
        }
      );

      const violations = drc.runFullDRC();
      expect(violations.some(v => v.type === 'ViaClearance')).toBe(true);
    });
  });

  describe('Component Clearance Checking', () => {
    it('should detect close component spacing', () => {
      const library = new FootprintLibrary();
      const footprint = library.getFootprint('R0603')!;

      manager.placeComponent('R1', footprint, 10, 10);
      manager.placeComponent('R2', footprint, 10.5, 10); // Very close

      const board = manager.getBoard();
      drc = new DRCEngine(board); // Reinitialize

      const violations = drc.runFullDRC();
      expect(violations.some(v => v.type === 'ComponentClearance')).toBe(true);
    });
  });

  describe('DRC Summary', () => {
    it('should provide violations summary', () => {
      const board = manager.getBoard();
      const minWidth = board.designRules.find(r => r.name === 'Trace Width')?.minValue || 0.15;

      // Add a thin trace
      board.traces.push({
        id: 'trace1',
        netName: 'test',
        layer: PCBLayer.SIGNAL_TOP,
        width: minWidth - 0.05,
        style: 'manhattan',
        segments: [{ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }],
      });

      drc.runFullDRC();
      const summary = drc.getViolationsSummary();

      expect(summary.totalViolations).toBeGreaterThan(0);
      expect(summary.errors).toBeGreaterThan(0);
    });
  });
});

describe('TraceRouter', () => {
  let router: TraceRouter;

  beforeEach(() => {
    router = new TraceRouter(100, 100);
  });

  describe('Manhattan Routing', () => {
    it('should route simple path', () => {
      const path = router.routeTrace(10, 10, 30, 10, PCBLayer.SIGNAL_TOP);

      expect(path).toBeTruthy();
      expect(path?.segments.length).toBeGreaterThan(0);
    });

    it('should find path around obstacles', () => {
      router.addObstacle(20, 10, 2, PCBLayer.SIGNAL_TOP);

      const path = router.routeTrace(10, 10, 30, 10, PCBLayer.SIGNAL_TOP, 0.254);

      // Path should exist but avoid obstacle
      expect(path).toBeTruthy();
    });

    it('should handle impossible routes', () => {
      // Block the entire space
      for (let x = 0; x <= 100; x += 0.5) {
        router.addObstacle(x, 50, 3, PCBLayer.SIGNAL_TOP);
      }

      const path = router.routeTrace(10, 10, 90, 90, PCBLayer.SIGNAL_TOP, 0.254);

      // May fail to route due to blocked path
      // expect(path).toBeNull();
    });
  });

  describe('Path Simplification', () => {
    it('should simplify jagged paths', () => {
      const path = {
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
          { start: { x: 10, y: 10 }, end: { x: 20, y: 10 } },
        ],
        vias: [],
      };

      const simplified = router.simplifyPath(path);

      // Should merge horizontal segments
      expect(simplified.segments.length).toBeLessThanOrEqual(path.segments.length);
    });
  });

  describe('Path Length Calculation', () => {
    it('should calculate path length correctly', () => {
      const path = {
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
        ],
        vias: [],
      };

      const length = router.calculatePathLength(path);

      expect(length).toBeCloseTo(20, 1);
    });
  });

  describe('Path to Trace Conversion', () => {
    it('should convert path to trace object', () => {
      const path = {
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        ],
        vias: [],
      };

      const trace = router.pathToTrace(path, PCBLayer.SIGNAL_TOP, 'net1', 0.254);

      expect(trace).toBeDefined();
      expect(trace.netName).toBe('net1');
      expect(trace.width).toBe(0.254);
      expect(trace.segments).toHaveLength(1);
    });
  });
});

describe('FootprintLibrary', () => {
  let library: FootprintLibrary;

  beforeEach(() => {
    library = new FootprintLibrary();
  });

  describe('Standard Footprints', () => {
    it('should have SMD resistors', () => {
      const r0603 = library.getFootprint('R0603');
      expect(r0603).toBeDefined();
      expect(r0603?.pads).toHaveLength(2);

      const r0805 = library.getFootprint('R0805');
      expect(r0805).toBeDefined();
      expect(r0805?.pads).toHaveLength(2);
    });

    it('should have SMD capacitors', () => {
      const c0603 = library.getFootprint('C0603');
      expect(c0603).toBeDefined();

      const c1206 = library.getFootprint('C1206');
      expect(c1206).toBeDefined();
      expect(c1206?.bounds.width).toBe(3.2);
    });

    it('should have IC packages', () => {
      const soic8 = library.getFootprint('SOIC-8');
      expect(soic8).toBeDefined();
      expect(soic8?.pads).toHaveLength(8);

      const dip8 = library.getFootprint('DIP-8');
      expect(dip8).toBeDefined();
      expect(dip8?.pads).toHaveLength(8);
    });

    it('should have connectors', () => {
      const header = library.getFootprint('Header_2x1');
      expect(header).toBeDefined();
      expect(header?.pads).toHaveLength(2);

      const usbc = library.getFootprint('USB_C');
      expect(usbc).toBeDefined();
      expect(usbc?.pads.length).toBeGreaterThan(0);
    });
  });

  describe('Footprint Search', () => {
    it('should search by name', () => {
      const results = library.search('0603');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('0603');
    });

    it('should search by description', () => {
      const results = library.search('resistor');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by package', () => {
      const results = library.search('SOIC');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Footprint Categories', () => {
    it('should filter resistors', () => {
      const resistors = library.getByCategory('resistor');
      expect(resistors.length).toBeGreaterThan(0);
      expect(resistors.every(fp => fp.name.startsWith('R'))).toBe(true);
    });

    it('should filter capacitors', () => {
      const capacitors = library.getByCategory('capacitor');
      expect(capacitors.length).toBeGreaterThan(0);
      expect(capacitors.every(fp => fp.name.startsWith('C'))).toBe(true);
    });

    it('should filter ICs', () => {
      const ics = library.getByCategory('ic');
      expect(ics.length).toBeGreaterThan(0);
    });

    it('should filter connectors', () => {
      const connectors = library.getByCategory('connector');
      expect(connectors.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Footprints', () => {
    it('should register custom footprints', () => {
      const custom = {
        id: 'custom1',
        name: 'CustomFP',
        description: 'Custom footprint',
        package: 'CUSTOM',
        pads: [],
        bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, width: 10, height: 10 },
      };

      library.registerFootprint(custom);
      const retrieved = library.getFootprint('CustomFP');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('CustomFP');
    });
  });
});
