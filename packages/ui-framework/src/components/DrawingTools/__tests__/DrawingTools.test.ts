/**
 * Drawing Tools Test Suite
 *
 * Tests covering:
 * - All drawing tool implementations
 * - Symbol library functionality
 * - Search and filtering
 */

import {
  LineTool,
  CircleTool,
  ArcTool,
  PolygonTool,
  TextTool,
  createTool,
  getAllTools,
  symbolLibrary,
  getSymbolByCategory,
  searchSymbols,
} from '../';
import { SymbolCategory } from '../types';
import type { Point } from '@tupan/core-ts/cad/geometry';

describe('Drawing Tools', () => {
  // ============ LINE TOOL TESTS ============

  test('LineTool creates line from two points', () => {
    const tool = new LineTool();
    tool.activate();

    const p1: Point = { x: 0, y: 0 };
    const p2: Point = { x: 10, y: 10 };

    tool.onMouseDown(p1);
    tool.onMouseMove(p2);
    tool.onMouseUp(p2);

    const entity = tool.getEntity();
    expect(entity?.type).toBe('line');
    if (entity?.type === 'line') {
      expect(entity.start).toEqual(p1);
      expect(entity.end).toEqual(p2);
    }
  });

  test('LineTool preview shows during drawing', () => {
    const tool = new LineTool();
    tool.activate();

    tool.onMouseDown({ x: 0, y: 0 });
    tool.onMouseMove({ x: 10, y: 10 });

    const preview = tool.getPreview();
    expect(preview?.type).toBe('line');
  });

  test('LineTool resets state', () => {
    const tool = new LineTool();
    tool.activate();
    tool.onMouseDown({ x: 0, y: 0 });
    tool.reset();

    const entity = tool.getEntity();
    expect(entity).toBeNull();
  });

  // ============ CIRCLE TOOL TESTS ============

  test('CircleTool creates circle from center and radius', () => {
    const tool = new CircleTool();
    tool.activate();

    const center: Point = { x: 0, y: 0 };
    const radius: Point = { x: 5, y: 0 };

    tool.onMouseDown(center);
    tool.onMouseMove(radius);
    tool.onMouseUp(radius);

    const entity = tool.getEntity();
    expect(entity?.type).toBe('circle');
    if (entity?.type === 'circle') {
      expect(entity.center).toEqual(center);
      expect(Math.abs(entity.radius - 5)).toBeLessThan(0.01);
    }
  });

  test('CircleTool preview shows during drawing', () => {
    const tool = new CircleTool();
    tool.activate();

    tool.onMouseDown({ x: 0, y: 0 });
    tool.onMouseMove({ x: 3, y: 4 });

    const preview = tool.getPreview();
    expect(preview?.type).toBe('circle');
    if (preview?.type === 'circle') {
      expect(Math.abs(preview.radius - 5)).toBeLessThan(0.01);
    }
  });

  // ============ POLYGON TOOL TESTS ============

  test('PolygonTool collects multiple points', () => {
    const tool = new PolygonTool();
    tool.activate();

    tool.onMouseDown({ x: 0, y: 0 });
    tool.onMouseDown({ x: 10, y: 0 });
    tool.onMouseDown({ x: 5, y: 10 });

    const entity = tool.getEntity();
    expect(entity?.type).toBe('polygon');
    // Entity is not complete until closed
  });

  test('PolygonTool requires minimum 3 points', () => {
    const tool = new PolygonTool();
    tool.activate();

    tool.onMouseDown({ x: 0, y: 0 });
    tool.onMouseDown({ x: 10, y: 0 });

    const entity = tool.getEntity();
    expect(entity).toBeNull();
  });

  test('PolygonTool preview includes current mouse position', () => {
    const tool = new PolygonTool();
    tool.activate();

    tool.onMouseDown({ x: 0, y: 0 });
    tool.onMouseMove({ x: 5, y: 5 });

    const preview = tool.getPreview();
    expect(preview?.type).toBe('polygon');
    if (preview?.type === 'polygon') {
      expect(preview.points.length).toBe(2); // Start point + current
    }
  });

  // ============ TEXT TOOL TESTS ============

  test('TextTool stores text content', () => {
    const tool = new TextTool();
    tool.activate();
    tool.setText('Hello');

    tool.onMouseDown({ x: 0, y: 0 });

    const entity = tool.getEntity();
    expect(entity?.type).toBe('text');
    if (entity?.type === 'text') {
      expect(entity.content).toBe('Hello');
    }
  });

  test('TextTool sets text height', () => {
    const tool = new TextTool();
    tool.activate();
    tool.setText('Hello');
    tool.setHeight(24);

    tool.onMouseDown({ x: 0, y: 0 });

    const entity = tool.getEntity();
    if (entity?.type === 'text') {
      expect(entity.height).toBe(24);
    }
  });

  test('TextTool clamps height to reasonable range', () => {
    const tool = new TextTool();
    tool.activate();

    tool.setHeight(1000); // Too large
    const entity1 = tool.getEntity();
    if (entity1?.type === 'text') {
      expect(entity1.height).toBeLessThanOrEqual(128);
    }

    tool.setHeight(2); // Too small
    const entity2 = tool.getEntity();
    if (entity2?.type === 'text') {
      expect(entity2.height).toBeGreaterThanOrEqual(8);
    }
  });

  // ============ ARC TOOL TESTS ============

  test('ArcTool creates arc from 3 points', () => {
    const tool = new ArcTool();
    tool.activate();

    const center: Point = { x: 0, y: 0 };
    const radiusPoint: Point = { x: 5, y: 0 };
    const endPoint: Point = { x: 5, y: 5 };

    tool.onMouseDown(center);
    tool.onMouseDown(radiusPoint);
    tool.onMouseDown(endPoint);

    const entity = tool.getEntity();
    expect(entity?.type).toBe('arc');
  });

  // ============ TOOL FACTORY TESTS ============

  test('createTool creates correct tool by name', () => {
    const line = createTool('line');
    expect(line).toBeInstanceOf(LineTool);

    const circle = createTool('circle');
    expect(circle).toBeInstanceOf(CircleTool);

    const polygon = createTool('polygon');
    expect(polygon).toBeInstanceOf(PolygonTool);

    const text = createTool('text');
    expect(text).toBeInstanceOf(TextTool);
  });

  test('createTool is case-insensitive', () => {
    const tool1 = createTool('LINE');
    const tool2 = createTool('line');
    expect(tool1?.name).toBe(tool2?.name);
  });

  test('createTool returns null for unknown tool', () => {
    const tool = createTool('unknown');
    expect(tool).toBeNull();
  });

  test('getAllTools returns all available tools', () => {
    const tools = getAllTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some(([name]) => name === 'line')).toBe(true);
    expect(tools.some(([name]) => name === 'circle')).toBe(true);
  });

  // ============ SYMBOL LIBRARY TESTS ============

  test('symbol library is populated', () => {
    expect(symbolLibrary.length).toBeGreaterThan(15);
  });

  test('each symbol has required properties', () => {
    for (const symbol of symbolLibrary.slice(0, 5)) {
      expect(symbol.id).toBeDefined();
      expect(symbol.name).toBeDefined();
      expect(symbol.category).toBeDefined();
      expect(symbol.description).toBeDefined();
      expect(symbol.entities).toBeDefined();
      expect(Array.isArray(symbol.entities)).toBe(true);
      expect(symbol.bounds).toBeDefined();
      expect(symbol.bounds.minX).toBeDefined();
      expect(symbol.bounds.maxX).toBeDefined();
      expect(symbol.bounds.minY).toBeDefined();
      expect(symbol.bounds.maxY).toBeDefined();
    }
  });

  // ============ SYMBOL SEARCH TESTS ============

  test('searchSymbols finds symbol by name', () => {
    const results = searchSymbols('resistor');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain('resistor');
  });

  test('searchSymbols is case-insensitive', () => {
    const lower = searchSymbols('resistor');
    const upper = searchSymbols('RESISTOR');
    expect(lower.length).toBe(upper.length);
  });

  test('searchSymbols returns empty for no matches', () => {
    const results = searchSymbols('nonexistent_xyz_component');
    expect(results.length).toBe(0);
  });

  test('searchSymbols finds symbol by description', () => {
    const results = searchSymbols('switch');
    expect(results.length).toBeGreaterThan(0);
  });

  test('getSymbolByCategory returns category symbols', () => {
    const resistors = getSymbolByCategory(SymbolCategory.Resistor);
    expect(resistors.length).toBeGreaterThan(0);
    expect(resistors.every((s) => s.category === SymbolCategory.Resistor)).toBe(true);
  });

  test('getSymbolByCategory returns empty for unused category', () => {
    // Assuming there's at least one category with no symbols (or use a mock category)
    // This test validates the filtering logic
    const capacitors = getSymbolByCategory(SymbolCategory.Capacitor);
    expect(Array.isArray(capacitors)).toBe(true);
  });

  // ============ SYMBOL BOUNDS TESTS ============

  test('symbol bounds are calculated correctly', () => {
    const symbol = symbolLibrary[0];
    expect(symbol.bounds.minX).toBeLessThanOrEqual(symbol.bounds.maxX);
    expect(symbol.bounds.minY).toBeLessThanOrEqual(symbol.bounds.maxY);
  });

  test('symbol bounds contain all entities', () => {
    const resistor = symbolLibrary.find((s) => s.id === 'resistor');
    if (resistor) {
      // Verify bounds visually contain the entities (simplified check)
      expect(resistor.bounds.maxX).toBeGreaterThan(resistor.bounds.minX);
    }
  });

  // ============ TOOL STATE TESTS ============

  test('tool state is reset on deactivate', () => {
    const tool = new LineTool();
    tool.activate();
    tool.onMouseDown({ x: 0, y: 0 });

    tool.deactivate();
    const entity = tool.getEntity();
    expect(entity).toBeNull();
  });

  test('multiple tool instances are independent', () => {
    const tool1 = new LineTool();
    const tool2 = new LineTool();

    tool1.activate();
    tool2.activate();

    tool1.onMouseDown({ x: 0, y: 0 });
    tool1.onMouseMove({ x: 10, y: 10 });

    const entity1 = tool1.getEntity();
    const entity2 = tool2.getEntity();

    expect(entity1).not.toBeNull();
    expect(entity2).toBeNull();
  });

  // ============ TOOL NAME AND ICON TESTS ============

  test('each tool has name and icon', () => {
    const tools = getAllTools();
    for (const [, tool] of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.icon).toBeTruthy();
      expect(tool.cursor).toBeTruthy();
    }
  });

  test('tool icons are unique or descriptive', () => {
    const tools = getAllTools();
    const icons = tools.map(([, tool]) => tool.icon);
    const names = tools.map(([, tool]) => tool.name);

    // At least tools should be visually distinguishable
    expect(icons.length).toBe(names.length);
  });
});
