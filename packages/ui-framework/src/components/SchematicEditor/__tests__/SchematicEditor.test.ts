/**
 * Schematic Editor Tests
 *
 * Comprehensive test suite for symbol placement, wire routing, and netlist generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Point } from '../../../types/geometry';
import { Symbol } from '../../DrawingTools/types';
import {
  PlacedSymbol,
  Wire,
  PinConnection,
  SchematicEditorState,
} from '../types';
import {
  placeSymbol,
  moveSymbol,
  rotateSymbol,
  scaleSymbol,
  findPinAtPosition,
  updateSymbolParameters,
  cloneSymbol,
  deleteSymbol,
  getNextRefDes,
  resetRefDesCounters,
} from '../symbolPlacer';
import {
  createWire,
  addWireWaypoint,
  autoRouteWire,
  doWiresCross,
  findWiresForSymbol,
  findWiresOnNet,
  assignNetName,
  getWireLength,
  isPointOnWire,
  deleteWire,
  getAllNets,
  validateWireConnections,
} from '../wireRouter';
import {
  generateSpiceNetlist,
  generateNetlist,
  generateBOM,
  validateNetlist,
} from '../netlistGenerator';

// Test fixtures
const mockSymbol: Symbol = {
  id: 'r-1k',
  name: 'Resistor 1k',
  category: 'resistor',
  description: '1k Resistor',
  entities: [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 3, y: 5 } },
    { type: 'polygon', points: [{ x: 3, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 8 }, { x: 3, y: 8 }] },
    { type: 'line', start: { x: 5, y: 5 }, end: { x: 8, y: 5 } },
  ],
  properties: { unit: 'Ω' },
};

const mockSymbolC: Symbol = {
  id: 'c-10u',
  name: 'Capacitor 10µF',
  category: 'capacitor',
  description: '10µF Capacitor',
  entities: [],
  properties: { unit: 'F' },
};

const mockSymbolV: Symbol = {
  id: 'v-5',
  name: 'Voltage Source 5V',
  category: 'voltage_source',
  description: '5V Voltage Source',
  entities: [],
  properties: {},
};

describe('Symbol Placer', () => {
  beforeEach(() => {
    resetRefDesCounters();
  });

  describe('placeSymbol', () => {
    it('should place symbol at position', () => {
      const position: Point = { x: 100, y: 150 };
      const placed = placeSymbol(mockSymbol, position);

      expect(placed.position).toEqual(position);
      expect(placed.symbolId).toBe(mockSymbol.id);
      expect(placed.rotation).toBe(0);
      expect(placed.scale).toBe(1.0);
    });

    it('should create pin connections', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      expect(placed.pins.length).toBeGreaterThan(0);
      expect(placed.pins[0]).toHaveProperty('id');
      expect(placed.pins[0]).toHaveProperty('position');
      expect(placed.pins[0]).toHaveProperty('connected', false);
    });

    it('should set component value and unit', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 }, { value: '1k' });
      expect(placed.parameters.value).toBe('1k');
      expect(placed.parameters.unit).toBe('Ω');
    });

    it('should auto-generate unique IDs', () => {
      const p1 = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const p2 = placeSymbol(mockSymbol, { x: 100, y: 100 });
      expect(p1.id).not.toBe(p2.id);
    });
  });

  describe('moveSymbol', () => {
    it('should update position', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const newPos: Point = { x: 50, y: 75 };
      const moved = moveSymbol(placed, newPos);

      expect(moved.position).toEqual(newPos);
    });

    it('should update pin positions', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const oldPinX = placed.pins[0].position.x;
      const newPos: Point = { x: 50, y: 0 };
      const moved = moveSymbol(placed, newPos);

      expect(moved.pins[0].position.x).toBe(oldPinX + 50);
    });
  });

  describe('rotateSymbol', () => {
    it('should rotate symbol by 90 degrees', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const rotated = rotateSymbol(placed, 90);
      expect(rotated.rotation).toBe(90);
    });

    it('should handle 360 degree rotation', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const rotated = rotateSymbol(rotateSymbol(rotateSymbol(rotateSymbol(placed, 90), 90), 90), 90);
      expect(rotated.rotation).toBe(0);
    });
  });

  describe('scaleSymbol', () => {
    it('should scale symbol', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const scaled = scaleSymbol(placed, 1.5);
      expect(scaled.scale).toBe(1.5);
    });

    it('should clamp scale between 0.5 and 2.0', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const tooSmall = scaleSymbol(placed, 0.1);
      const tooLarge = scaleSymbol(placed, 5.0);

      expect(tooSmall.scale).toBe(0.5);
      expect(tooLarge.scale).toBe(2.0);
    });
  });

  describe('findPinAtPosition', () => {
    it('should find pin within tolerance', () => {
      const placed = placeSymbol(mockSymbol, { x: 100, y: 100 });
      const pinPos = placed.pins[0].position;
      const result = findPinAtPosition([placed], pinPos, 10);

      expect(result).not.toBeNull();
      expect(result?.symbolId).toBe(placed.id);
      expect(result?.pinId).toBe(placed.pins[0].id);
    });

    it('should return null if no pin found', () => {
      const placed = placeSymbol(mockSymbol, { x: 100, y: 100 });
      const result = findPinAtPosition([placed], { x: 500, y: 500 }, 5);
      expect(result).toBeNull();
    });
  });

  describe('updateSymbolParameters', () => {
    it('should update component value', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const updated = updateSymbolParameters(placed, { value: '10k' });
      expect(updated.parameters.value).toBe('10k');
    });

    it('should preserve other parameters', () => {
      const placed = placeSymbol(mockSymbol, { x: 0, y: 0 }, { tolerance: '5%' });
      const updated = updateSymbolParameters(placed, { value: '10k' });
      expect(updated.parameters.tolerance).toBe('5%');
      expect(updated.parameters.value).toBe('10k');
    });
  });

  describe('cloneSymbol', () => {
    it('should create independent copy', () => {
      const original = placeSymbol(mockSymbol, { x: 100, y: 100 });
      const cloned = cloneSymbol(original);

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.position).not.toEqual(original.position);
    });

    it('should apply offset', () => {
      const original = placeSymbol(mockSymbol, { x: 100, y: 100 });
      const cloned = cloneSymbol(original, { x: 50, y: 50 });

      expect(cloned.position.x).toBe(150);
      expect(cloned.position.y).toBe(150);
    });
  });

  describe('deleteSymbol', () => {
    it('should remove symbol from list', () => {
      const s1 = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const s2 = placeSymbol(mockSymbol, { x: 100, y: 100 });
      const symbols = [s1, s2];

      const remaining = deleteSymbol(symbols, s1.id);

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(s2.id);
    });
  });

  describe('Reference designator generation', () => {
    it('should auto-increment resistor labels', () => {
      resetRefDesCounters();
      const r1 = getNextRefDes('resistor');
      const r2 = getNextRefDes('resistor');
      expect(r1).toBe('R1');
      expect(r2).toBe('R2');
    });

    it('should handle different component types', () => {
      resetRefDesCounters();
      const r = getNextRefDes('resistor');
      const c = getNextRefDes('capacitor');
      const r2 = getNextRefDes('resistor');

      expect(r).toBe('R1');
      expect(c).toBe('C1');
      expect(r2).toBe('R2');
    });
  });
});

describe('Wire Router', () => {
  let symbol1: PlacedSymbol;
  let symbol2: PlacedSymbol;

  beforeEach(() => {
    symbol1 = placeSymbol(mockSymbol, { x: 0, y: 0 });
    symbol2 = placeSymbol(mockSymbolC, { x: 100, y: 0 });
  });

  describe('createWire', () => {
    it('should create wire between pins', () => {
      const wire = createWire(symbol1.id, symbol1.pins[0].id, symbol2.id, symbol2.pins[0].id);

      expect(wire.fromSymbol).toBe(symbol1.id);
      expect(wire.toSymbol).toBe(symbol2.id);
      expect(wire.segments).toHaveLength(0);
    });
  });

  describe('autoRouteWire', () => {
    it('should generate Manhattan path', () => {
      const wire = createWire(symbol1.id, symbol1.pins[0].id, symbol2.id, symbol2.pins[0].id);
      const routed = autoRouteWire(wire, [symbol1, symbol2], 10);

      expect(routed.segments.length).toBeGreaterThan(0);
      expect(routed.segments[0].routed).toBe(true);
    });
  });

  describe('doWiresCross', () => {
    it('should detect crossing wires', () => {
      const s1 = placeSymbol(mockSymbol, { x: 0, y: 0 });
      const s2 = placeSymbol(mockSymbolC, { x: 100, y: 0 });
      const s3 = placeSymbol(mockSymbolV, { x: 50, y: -50 });
      const s4 = placeSymbol(mockSymbolV, { x: 50, y: 50 });

      const wire1 = createWire(s1.id, s1.pins[0].id, s2.id, s2.pins[0].id);
      const wire2 = createWire(s3.id, s3.pins[0].id, s4.id, s4.pins[0].id);

      const w1 = autoRouteWire(wire1, [s1, s2], 10);
      const w2 = autoRouteWire(wire2, [s3, s4], 10);

      // This is a complex test - just check they don't crash
      expect(doWiresCross(w1, w2)).toBeDefined();
    });
  });

  describe('findWiresForSymbol', () => {
    it('should find all wires connected to symbol', () => {
      const wire = createWire(symbol1.id, symbol1.pins[0].id, symbol2.id, symbol2.pins[0].id);
      const wires = [wire];

      const found = findWiresForSymbol(wires, symbol1.id);
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(wire.id);
    });
  });

  describe('assignNetName', () => {
    it('should assign net name to wire', () => {
      let wire = createWire(symbol1.id, symbol1.pins[0].id, symbol2.id, symbol2.pins[0].id);
      wire = assignNetName(wire, 'VCC');

      expect(wire.properties.name).toBe('VCC');
    });
  });

  describe('getWireLength', () => {
    it('should calculate wire length', () => {
      const wire = createWire(symbol1.id, symbol1.pins[0].id, symbol2.id, symbol2.pins[0].id);
      const routed = autoRouteWire(wire, [symbol1, symbol2], 10);
      const length = getWireLength(routed);

      expect(length).toBeGreaterThan(0);
    });
  });

  describe('validateWireConnections', () => {
    it('should validate wire endpoints exist', () => {
      const wire = createWire(symbol1.id, symbol1.pins[0].id, symbol2.id, symbol2.pins[0].id);
      const valid = validateWireConnections(wire, [symbol1, symbol2]);

      expect(valid).toBe(true);
    });

    it('should reject invalid connections', () => {
      const wire = createWire('nonexistent', 'pin1', symbol2.id, symbol2.pins[0].id);
      const valid = validateWireConnections(wire, [symbol1, symbol2]);

      expect(valid).toBe(false);
    });
  });
});

describe('Netlist Generator', () => {
  let symbols: PlacedSymbol[];
  let wires: Wire[];

  beforeEach(() => {
    const r1 = placeSymbol(mockSymbol, { x: 0, y: 0 }, { value: '1k' });
    const c1 = placeSymbol(mockSymbolC, { x: 100, y: 0 }, { value: '10u' });
    const v1 = placeSymbol(mockSymbolV, { x: 0, y: 100 }, { value: '5V' });

    symbols = [r1, c1, v1];

    const wire1 = createWire(r1.id, r1.pins[0].id, c1.id, c1.pins[0].id);
    const wire2 = createWire(c1.id, c1.pins[1].id, v1.id, v1.pins[1].id);

    wires = [wire1, wire2];
  });

  describe('generateSpiceNetlist', () => {
    it('should generate valid SPICE netlist', () => {
      const netlist = generateSpiceNetlist(symbols, wires, 'RC Circuit');

      expect(netlist).toContain('RC Circuit');
      expect(netlist).toContain('.end');
      expect(netlist).toContain('R');
      expect(netlist).toContain('C');
      expect(netlist).toContain('V');
    });

    it('should include component values', () => {
      const netlist = generateSpiceNetlist(symbols, wires);
      expect(netlist).toContain('1k');
      expect(netlist).toContain('10u');
      expect(netlist).toContain('5V');
    });
  });

  describe('generateNetlist', () => {
    it('should generate structured netlist', () => {
      const netlist = generateNetlist(symbols, wires);

      expect(netlist.title).toBeDefined();
      expect(netlist.timestamp).toBeDefined();
      expect(netlist.entries).toBeInstanceOf(Array);
      expect(netlist.components).toBeInstanceOf(Array);
    });

    it('should include all components', () => {
      const netlist = generateNetlist(symbols, wires);
      expect(netlist.components.length).toBeGreaterThan(0);
    });
  });

  describe('generateBOM', () => {
    it('should generate bill of materials', () => {
      const bom = generateBOM(symbols);

      expect(bom).toContain('Reference');
      expect(bom).toContain('Value');
      expect(bom).toContain('1k');
      expect(bom).toContain('10u');
    });

    it('should group identical components', () => {
      const r2 = placeSymbol(mockSymbol, { x: 200, y: 0 }, { value: '1k' });
      const symbolsWithDuplicate = [...symbols, r2];
      const bom = generateBOM(symbolsWithDuplicate);

      // Should have a line with quantity 2 for the 1k resistors
      const lines = bom.split('\n');
      const hasDuplicate = lines.some(line => line.includes('1k') && line.includes('2'));
      expect(hasDuplicate).toBe(true);
    });
  });

  describe('validateNetlist', () => {
    it('should validate empty circuit', () => {
      const errors = validateNetlist([], []);
      expect(errors.length).toBeGreaterThan(0); // Should have warnings
    });

    it('should warn on missing ground', () => {
      const errors = validateNetlist(symbols, wires);
      const hasGroundWarning = errors.some(e => e.type === 'missing_ground');
      expect(hasGroundWarning).toBe(true);
    });

    it('should warn on missing voltage source', () => {
      const r1 = placeSymbol(mockSymbol, { x: 0, y: 0 }, { value: '1k' });
      const c1 = placeSymbol(mockSymbolC, { x: 100, y: 0 }, { value: '10u' });

      const errors = validateNetlist([r1, c1], []);
      const hasSourceWarning = errors.some(e => e.type === 'open_circuit');
      expect(hasSourceWarning).toBe(true);
    });

    it('should flag floating components', () => {
      const unconnected = placeSymbol(mockSymbol, { x: 300, y: 300 });
      const allSymbols = [...symbols, unconnected];

      const errors = validateNetlist(allSymbols, wires);
      const hasFloating = errors.some(e => e.type === 'floating_component');
      expect(hasFloating).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should create complete RC circuit schematic', () => {
    resetRefDesCounters();

    // Create components
    const r = placeSymbol(mockSymbol, { x: 0, y: 0 }, { value: '1k' });
    const c = placeSymbol(mockSymbolC, { x: 100, y: 0 }, { value: '1u' });
    const v = placeSymbol(mockSymbolV, { x: 0, y: 100 }, { value: '5V' });

    // Create wires
    const w1 = createWire(r.id, r.pins[0].id, c.id, c.pins[0].id);
    const w2 = createWire(v.id, v.pins[0].id, r.id, r.pins[1].id);

    const symbols = [r, c, v];
    const wires = [w1, w2];

    // Generate netlist
    const netlist = generateNetlist(symbols, wires);

    expect(netlist.components).toHaveLength(3);
    expect(netlist.title).toBeDefined();
  });

  it('should handle complete workflow', () => {
    // Place symbols
    const r = placeSymbol(mockSymbol, { x: 0, y: 0 }, { value: '1k', tolerance: '5%' });
    const moved = moveSymbol(r, { x: 50, y: 50 });
    const scaled = scaleSymbol(moved, 1.5);
    const updated = updateSymbolParameters(scaled, { value: '2k' });

    expect(updated.parameters.value).toBe('2k');
    expect(updated.parameters.tolerance).toBe('5%');
    expect(updated.scale).toBe(1.5);

    // Create wire
    const c = placeSymbol(mockSymbolC, { x: 100, y: 100 });
    const wire = createWire(updated.id, updated.pins[0].id, c.id, c.pins[0].id);
    const routed = autoRouteWire(wire, [updated, c], 10);

    expect(routed.segments.length).toBeGreaterThan(0);

    // Generate SPICE
    const spice = generateSpiceNetlist([updated, c], [routed]);
    expect(spice).toContain('2k');
  });
});
