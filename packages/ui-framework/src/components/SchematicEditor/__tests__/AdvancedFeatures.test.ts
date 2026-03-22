/**
 * Advanced Schematic Features Tests
 *
 * Tests for undo/redo, multi-select, copy/paste, net management, symbol search
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Point } from '../../../types/geometry';
import { Symbol } from '../../DrawingTools/types';
import { PlacedSymbol } from '../types';
import { HistoryManager, createStateSnapshot, detectChanges } from '../historyManager';
import { SelectionManager, AlignmentOption, DistributionOption } from '../selectionManager';
import { ClipboardManager } from '../clipboardManager';
import { NetManager } from '../netManager';
import { SymbolSearch, fuzzyMatch } from '../symbolSearch';
import { placeSymbol } from '../symbolPlacer';
import { createWire, autoRouteWire } from '../wireRouter';

// Test fixtures
const mockSymbol: Symbol = {
  id: 'r-1k',
  name: 'Resistor 1k',
  category: 'resistor',
  description: '1k Resistor',
  entities: [],
  properties: { unit: 'Ω' },
};

const mockCapacitor: Symbol = {
  id: 'c-10u',
  name: 'Capacitor 10µF',
  category: 'capacitor',
  description: '10µF Capacitor',
  entities: [],
  properties: { unit: 'F' },
};

describe('History Manager', () => {
  let history: HistoryManager;

  beforeEach(() => {
    history = new HistoryManager(100);
  });

  it('should push and undo actions', () => {
    const before = { placedSymbols: [], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };
    const after = { placedSymbols: [placeSymbol(mockSymbol, { x: 0, y: 0 })], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };

    history.push('Add symbol', before, after);

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    const undone = history.undo();
    expect(undone).toEqual(before);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it('should redo actions', () => {
    const state1 = { placedSymbols: [], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };
    const state2 = { placedSymbols: [placeSymbol(mockSymbol, { x: 0, y: 0 })], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };

    history.push('Add symbol', state1, state2);
    history.undo();

    expect(history.canRedo()).toBe(true);
    const redone = history.redo();
    expect(redone?.placedSymbols.length).toBe(1);
  });

  it('should support batching', () => {
    const state1 = { placedSymbols: [], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };
    const state2 = { placedSymbols: [placeSymbol(mockSymbol, { x: 0, y: 0 })], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };
    const state3 = { placedSymbols: [placeSymbol(mockSymbol, { x: 0, y: 0 }), placeSymbol(mockCapacitor, { x: 50, y: 50 })], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };

    history.startBatch();
    history.push('Action 1', state1, state2);
    history.push('Action 2', state2, state3);
    history.endBatch('Batch operation', state1, state3);

    expect(history.canUndo()).toBe(true);
    const undone = history.undo();
    expect(undone?.placedSymbols.length).toBe(0); // Entire batch undone
  });

  it('should detect changes', () => {
    const before = { placedSymbols: [], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };
    const after = { placedSymbols: [placeSymbol(mockSymbol, { x: 0, y: 0 })], wires: [], dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } }, isDrawingWire: false, wirePath: [], history: [], historyIndex: -1 };

    const change = detectChanges(before, after);
    expect(change).toBe('Add symbol');
  });
});

describe('Selection Manager', () => {
  let selection: SelectionManager;
  let symbols: PlacedSymbol[];

  beforeEach(() => {
    selection = new SelectionManager();
    symbols = [
      placeSymbol(mockSymbol, { x: 0, y: 0 }),
      placeSymbol(mockCapacitor, { x: 100, y: 100 }),
    ];
  });

  it('should select single symbol', () => {
    selection.selectSymbol(symbols[0]);
    expect(selection.getSelectionCount()).toBe(1);
    expect(selection.isSymbolSelected(symbols[0].id)).toBe(true);
  });

  it('should toggle selection', () => {
    selection.toggleSymbol(symbols[0]);
    expect(selection.isSymbolSelected(symbols[0].id)).toBe(true);

    selection.toggleSymbol(symbols[0]);
    expect(selection.isSymbolSelected(symbols[0].id)).toBe(false);
  });

  it('should select multiple', () => {
    selection.addSymbol(symbols[0]);
    selection.addSymbol(symbols[1]);

    expect(selection.getSelectionCount()).toBe(2);
    expect(selection.getSelectedSymbols(symbols).length).toBe(2);
  });

  it('should select in box', () => {
    selection.selectInBox(symbols, { x: -50, y: -50 }, { x: 50, y: 50 });
    expect(selection.isSymbolSelected(symbols[0].id)).toBe(true);
    expect(selection.isSymbolSelected(symbols[1].id)).toBe(false);
  });

  it('should align symbols', () => {
    selection.addSymbol(symbols[0]);
    selection.addSymbol(symbols[1]);

    const aligned = selection.alignSymbols(symbols, AlignmentOption.LEFT);
    expect(aligned[0].position.x).toBe(aligned[1].position.x);
  });

  it('should get bounding box', () => {
    selection.addSymbol(symbols[0]);
    selection.addSymbol(symbols[1]);

    const bbox = selection.getBoundingBox(symbols);
    expect(bbox).not.toBeNull();
    expect(bbox?.width).toBeGreaterThan(0);
    expect(bbox?.height).toBeGreaterThan(0);
  });

  it('should invert selection', () => {
    selection.addSymbol(symbols[0]);
    selection.invertSelection(symbols);

    expect(selection.isSymbolSelected(symbols[0].id)).toBe(false);
    expect(selection.isSymbolSelected(symbols[1].id)).toBe(true);
  });
});

describe('Clipboard Manager', () => {
  let clipboard: ClipboardManager;
  let symbols: PlacedSymbol[];

  beforeEach(() => {
    clipboard = new ClipboardManager();
    symbols = [
      placeSymbol(mockSymbol, { x: 0, y: 0 }),
      placeSymbol(mockCapacitor, { x: 100, y: 100 }),
    ];
  });

  it('should copy symbols', () => {
    clipboard.copy(symbols, [], [symbols[0].id]);
    expect(clipboard.hasContent()).toBe(true);
    expect(clipboard.getSize()).toBe(1);
  });

  it('should paste symbols', () => {
    clipboard.copy(symbols, [], [symbols[0].id]);

    const result = clipboard.paste({ x: 200, y: 200 }, symbols, []);
    expect(result.symbols.length).toBe(3); // Original + pasted
  });

  it('should preserve wires during copy', () => {
    const wire = createWire(symbols[0].id, '1', symbols[1].id, '1');

    clipboard.copy(symbols, [wire], [symbols[0].id, symbols[1].id]);
    expect(clipboard.getContent()?.wires.length).toBe(1);
  });

  it('should duplicate symbols', () => {
    const result = clipboard.duplicate(symbols, [], [symbols[0].id], { x: 50, y: 50 });
    expect(result.symbols.length).toBe(3); // Original + duplicate
    expect(result.symbols[0].id).not.toBe(result.symbols[2].id); // Different IDs
  });

  it('should export/import clipboard', () => {
    clipboard.copy(symbols, [], [symbols[0].id]);
    const json = clipboard.exportToJSON();

    const clipboard2 = new ClipboardManager();
    const success = clipboard2.importFromJSON(json);

    expect(success).toBe(true);
    expect(clipboard2.hasContent()).toBe(true);
  });
});

describe('Net Manager', () => {
  let nets: NetManager;
  let symbols: PlacedSymbol[];
  let wires: any[];

  beforeEach(() => {
    nets = new NetManager();
    symbols = [
      placeSymbol(mockSymbol, { x: 0, y: 0 }),
      placeSymbol(mockCapacitor, { x: 100, y: 100 }),
    ];

    const w = createWire(symbols[0].id, '1', symbols[1].id, '1');
    wires = [w];
  });

  it('should update nets', () => {
    nets.updateNets(wires, symbols);
    const allNets = nets.getAllNets();
    expect(allNets.length).toBeGreaterThan(0);
  });

  it('should rename nets', () => {
    nets.updateNets(wires, symbols);
    const renamed = nets.renameNet('net_1', 'VCC', wires);

    expect(renamed[0].properties.name).toBe('VCC');
  });

  it('should highlight nets', () => {
    nets.updateNets(wires, symbols);
    nets.highlightNet('net_1');

    const highlighted = nets.getHighlightedNets();
    expect(highlighted).toContain('net_1');
  });

  it('should get net color', () => {
    const color1 = nets.getNetColor('GND');
    const color2 = nets.getNetColor('VCC');
    const color3 = nets.getNetColor('net_1');

    expect(color1).toBe('#000000'); // Ground is black
    expect(color2).toBe('#FF0000'); // Power is red
    expect(color3).toMatch(/hsl/); // Auto-generated color
  });

  it('should export net list', () => {
    nets.updateNets(wires, symbols);
    const json = nets.exportToJSON();

    expect(json).toBeTruthy();
    expect(JSON.parse(json)).toBeInstanceOf(Array);
  });
});

describe('Symbol Search', () => {
  let search: SymbolSearch;

  beforeEach(() => {
    search = new SymbolSearch([mockSymbol, mockCapacitor]);
  });

  it('should search by name', () => {
    const results = search.search('Resistor', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol.id).toBe('r-1k');
  });

  it('should search by category', () => {
    const results = search.searchByCategory('resistor', 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should prioritize exact matches', () => {
    const results = search.search('Resistor', 10);
    expect(results[0].matchType).toBe('name');
    expect(results[0].score).toBeGreaterThan(0.5);
  });

  it('should track recent symbols', () => {
    search.markAsUsed(mockSymbol);
    const recent = search.getRecent(5);

    expect(recent.length).toBeGreaterThan(0);
    expect(recent[0].symbol.id).toBe(mockSymbol.id);
  });

  it('should manage favorites', () => {
    const isFav = search.toggleFavorite(mockSymbol.id);
    expect(isFav).toBe(true);
    expect(search.isFavorite(mockSymbol.id)).toBe(true);

    search.toggleFavorite(mockSymbol.id);
    expect(search.isFavorite(mockSymbol.id)).toBe(false);
  });

  it('should get categories', () => {
    const categories = search.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toHaveProperty('name');
    expect(categories[0]).toHaveProperty('count');
  });

  it('should track search history', () => {
    search.search('resistor', 10);
    search.search('capacitor', 10);

    const history = search.getSearchHistory();
    expect(history.length).toBe(2);
    expect(history[0]).toBe('capacitor'); // Most recent first
  });

  it('should support fuzzy matching', () => {
    const score1 = fuzzyMatch('res', 'resistor');
    const score2 = fuzzyMatch('xyz', 'resistor');

    expect(score1).toBeGreaterThan(0);
    expect(score2).toBe(0);
  });

  it('should get statistics', () => {
    search.markAsUsed(mockSymbol);
    search.toggleFavorite(mockSymbol.id);

    const stats = search.getStats();
    expect(stats.totalSymbols).toBe(2);
    expect(stats.recentCount).toBe(1);
    expect(stats.favoriteCount).toBe(1);
  });
});

describe('Integration Tests', () => {
  it('should handle complete workflow: select → copy → paste → undo', () => {
    const history = new HistoryManager();
    const selection = new SelectionManager();
    const clipboard = new ClipboardManager();

    const symbols = [
      placeSymbol(mockSymbol, { x: 0, y: 0 }),
      placeSymbol(mockCapacitor, { x: 100, y: 100 }),
    ];

    // Select symbol
    selection.selectSymbol(symbols[0]);
    expect(selection.getSelectionCount()).toBe(1);

    // Copy
    clipboard.copy(symbols, [], [symbols[0].id]);
    expect(clipboard.hasContent()).toBe(true);

    // Paste
    const pasted = clipboard.paste({ x: 200, y: 200 }, symbols, []);
    expect(pasted.symbols.length).toBe(3);

    // Undo by selecting original
    selection.selectSymbol(symbols[0]);
    expect(selection.getSelectionCount()).toBe(1);
  });

  it('should handle multi-select + alignment + undo', () => {
    const history = new HistoryManager();
    const selection = new SelectionManager();

    const symbols = [
      placeSymbol(mockSymbol, { x: 0, y: 0 }),
      placeSymbol(mockCapacitor, { x: 100, y: 50 }),
      placeSymbol(mockSymbol, { x: 200, y: 100 }),
    ];

    // Multi-select
    selection.addSymbol(symbols[0]);
    selection.addSymbol(symbols[1]);
    selection.addSymbol(symbols[2]);

    expect(selection.getSelectionCount()).toBe(3);

    // Align
    const aligned = selection.alignSymbols(symbols, AlignmentOption.CENTER_H);
    expect(aligned[0].position.x).toBe(aligned[1].position.x);
    expect(aligned[1].position.x).toBe(aligned[2].position.x);
  });
});
