/**
 * Selection Manager - Multi-select, Drag, and Alignment
 *
 * Features:
 * - Multi-select with Shift/Ctrl
 * - Bounding box selection
 * - Alignment and distribution
 * - Bulk operations
 */

import { Point } from '../../types/geometry';
import { PlacedSymbol, Wire } from './types';
import { moveSymbol } from './symbolPlacer';

/**
 * Selection mode
 */
export enum SelectionMode {
  SINGLE = 'single',          // Replace selection
  ADD = 'add',                // Add to selection
  TOGGLE = 'toggle',         // Toggle in selection
  BOX = 'box',                // Drag-select box
}

/**
 * Alignment option
 */
export enum AlignmentOption {
  LEFT = 'left',
  CENTER_H = 'center_h',
  RIGHT = 'right',
  TOP = 'top',
  CENTER_V = 'center_v',
  BOTTOM = 'bottom',
}

/**
 * Distribution option
 */
export enum DistributionOption {
  SPACE_H = 'space_h',         // Equal spacing horizontally
  SPACE_V = 'space_v',         // Equal spacing vertically
  CENTER_H = 'center_h',       // Center horizontally
  CENTER_V = 'center_v',       // Center vertically
}

/**
 * Selection context
 */
export interface SelectionContext {
  selectedSymbols: PlacedSymbol[];
  selectedWires: Wire[];
  selectionBox?: {
    start: Point;
    end: Point;
    width: number;
    height: number;
  };
  dragStartPos?: Point;
  dragOffset?: Point;
}

/**
 * Selection manager for multi-select operations
 */
export class SelectionManager {
  private selectedSymbolIds: Set<string> = new Set();
  private selectedWireIds: Set<string> = new Set();

  /**
   * Select single symbol (replace selection)
   */
  selectSymbol(symbol: PlacedSymbol | null): void {
    this.selectedSymbolIds.clear();
    this.selectedWireIds.clear();

    if (symbol) {
      this.selectedSymbolIds.add(symbol.id);
    }
  }

  /**
   * Toggle symbol selection
   */
  toggleSymbol(symbol: PlacedSymbol): void {
    if (this.selectedSymbolIds.has(symbol.id)) {
      this.selectedSymbolIds.delete(symbol.id);
    } else {
      this.selectedSymbolIds.add(symbol.id);
      this.selectedWireIds.clear(); // Can't mix symbols and wires
    }
  }

  /**
   * Add symbol to selection
   */
  addSymbol(symbol: PlacedSymbol): void {
    this.selectedSymbolIds.add(symbol.id);
    this.selectedWireIds.clear();
  }

  /**
   * Remove symbol from selection
   */
  removeSymbol(symbolId: string): void {
    this.selectedSymbolIds.delete(symbolId);
  }

  /**
   * Select multiple symbols in bounding box
   */
  selectInBox(symbols: PlacedSymbol[], boxStart: Point, boxEnd: Point): void {
    this.selectedSymbolIds.clear();
    this.selectedWireIds.clear();

    const minX = Math.min(boxStart.x, boxEnd.x);
    const maxX = Math.max(boxStart.x, boxEnd.x);
    const minY = Math.min(boxStart.y, boxEnd.y);
    const maxY = Math.max(boxStart.y, boxEnd.y);

    for (const symbol of symbols) {
      const symMinX = symbol.position.x;
      const symMaxX = symbol.position.x + 40; // Approximate symbol width
      const symMinY = symbol.position.y;
      const symMaxY = symbol.position.y + 30; // Approximate symbol height

      // Check if symbol is within box
      if (symMinX < maxX && symMaxX > minX && symMinY < maxY && symMaxY > minY) {
        this.selectedSymbolIds.add(symbol.id);
      }
    }
  }

  /**
   * Select all symbols
   */
  selectAll(symbols: PlacedSymbol[]): void {
    this.selectedSymbolIds.clear();
    this.selectedWireIds.clear();

    for (const symbol of symbols) {
      this.selectedSymbolIds.add(symbol.id);
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedSymbolIds.clear();
    this.selectedWireIds.clear();
  }

  /**
   * Get selected symbols from list
   */
  getSelectedSymbols(symbols: PlacedSymbol[]): PlacedSymbol[] {
    return symbols.filter(s => this.selectedSymbolIds.has(s.id));
  }

  /**
   * Get selected wires from list
   */
  getSelectedWires(wires: Wire[]): Wire[] {
    return wires.filter(w => this.selectedWireIds.has(w.id));
  }

  /**
   * Check if symbol is selected
   */
  isSymbolSelected(symbolId: string): boolean {
    return this.selectedSymbolIds.has(symbolId);
  }

  /**
   * Get selection count
   */
  getSelectionCount(): number {
    return this.selectedSymbolIds.size + this.selectedWireIds.size;
  }

  /**
   * Get selected symbol IDs
   */
  getSelectedSymbolIds(): string[] {
    return Array.from(this.selectedSymbolIds);
  }

  /**
   * Align selected symbols
   */
  alignSymbols(
    symbols: PlacedSymbol[],
    option: AlignmentOption
  ): PlacedSymbol[] {
    const selected = this.getSelectedSymbols(symbols);
    if (selected.length < 2) return symbols;

    // Calculate alignment target
    let target = 0;

    switch (option) {
      case AlignmentOption.LEFT:
        target = Math.min(...selected.map(s => s.position.x));
        break;
      case AlignmentOption.CENTER_H:
        target =
          selected.reduce((sum, s) => sum + s.position.x, 0) / selected.length;
        break;
      case AlignmentOption.RIGHT:
        target = Math.max(...selected.map(s => s.position.x));
        break;
      case AlignmentOption.TOP:
        target = Math.min(...selected.map(s => s.position.y));
        break;
      case AlignmentOption.CENTER_V:
        target =
          selected.reduce((sum, s) => sum + s.position.y, 0) / selected.length;
        break;
      case AlignmentOption.BOTTOM:
        target = Math.max(...selected.map(s => s.position.y));
        break;
    }

    // Apply alignment
    return symbols.map(s => {
      if (!this.selectedSymbolIds.has(s.id)) return s;

      const isHorizontal = [
        AlignmentOption.LEFT,
        AlignmentOption.CENTER_H,
        AlignmentOption.RIGHT,
      ].includes(option);

      const newPos = isHorizontal
        ? { x: target, y: s.position.y }
        : { x: s.position.x, y: target };

      return moveSymbol(s, newPos);
    });
  }

  /**
   * Distribute symbols evenly
   */
  distributeSymbols(
    symbols: PlacedSymbol[],
    option: DistributionOption,
    spacing: number = 10
  ): PlacedSymbol[] {
    const selected = this.getSelectedSymbols(symbols);
    if (selected.length < 3) return symbols;

    const sorted = [...selected];
    const isHorizontal = [
      DistributionOption.SPACE_H,
      DistributionOption.CENTER_H,
    ].includes(option);

    if (isHorizontal) {
      sorted.sort((a, b) => a.position.x - b.position.x);
    } else {
      sorted.sort((a, b) => a.position.y - b.position.y);
    }

    // Calculate spacing
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalSpacing = isHorizontal
      ? last.position.x - first.position.x
      : last.position.y - first.position.y;

    const gap = totalSpacing / (sorted.length - 1);

    return symbols.map(s => {
      const index = sorted.findIndex(sel => sel.id === s.id);
      if (index === -1) return s;

      if (isHorizontal) {
        const newX = first.position.x + gap * index;
        return moveSymbol(s, { x: newX, y: s.position.y });
      } else {
        const newY = first.position.y + gap * index;
        return moveSymbol(s, { x: s.position.x, y: newY });
      }
    });
  }

  /**
   * Move selected symbols by offset
   */
  moveSelected(
    symbols: PlacedSymbol[],
    offset: Point
  ): PlacedSymbol[] {
    return symbols.map(s => {
      if (!this.selectedSymbolIds.has(s.id)) return s;

      const newPos = {
        x: s.position.x + offset.x,
        y: s.position.y + offset.y,
      };

      return moveSymbol(s, newPos);
    });
  }

  /**
   * Delete selected symbols
   */
  deleteSelected(
    symbols: PlacedSymbol[],
    wires: Wire[]
  ): { symbols: PlacedSymbol[]; wires: Wire[] } {
    const remainingSymbols = symbols.filter(s => !this.selectedSymbolIds.has(s.id));

    // Also delete wires connected to deleted symbols
    const remainingWires = wires.filter(w => {
      const fromExists = symbols.some(s => s.id === w.fromSymbol);
      const toExists = symbols.some(s => s.id === w.toSymbol);
      return fromExists && toExists;
    });

    this.clearSelection();

    return {
      symbols: remainingSymbols,
      wires: remainingWires,
    };
  }

  /**
   * Get bounding box of selection
   */
  getBoundingBox(symbols: PlacedSymbol[]): { min: Point; max: Point; width: number; height: number } | null {
    const selected = this.getSelectedSymbols(symbols);
    if (selected.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const symbol of selected) {
      minX = Math.min(minX, symbol.position.x);
      maxX = Math.max(maxX, symbol.position.x + 40); // Approx width
      minY = Math.min(minY, symbol.position.y);
      maxY = Math.max(maxY, symbol.position.y + 30); // Approx height
    }

    return {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY },
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Invert selection
   */
  invertSelection(symbols: PlacedSymbol[]): void {
    const newSelection = new Set<string>();

    for (const symbol of symbols) {
      if (!this.selectedSymbolIds.has(symbol.id)) {
        newSelection.add(symbol.id);
      }
    }

    this.selectedSymbolIds = newSelection;
    this.selectedWireIds.clear();
  }
}

/**
 * Helper function to check if point is in symbol bounds
 */
export function isPointInSymbol(
  point: Point,
  symbol: PlacedSymbol,
  width: number = 40,
  height: number = 30
): boolean {
  return (
    point.x >= symbol.position.x &&
    point.x <= symbol.position.x + width &&
    point.y >= symbol.position.y &&
    point.y <= symbol.position.y + height
  );
}

/**
 * Helper function to check if point is in box
 */
export function isPointInBox(point: Point, boxStart: Point, boxEnd: Point): boolean {
  const minX = Math.min(boxStart.x, boxEnd.x);
  const maxX = Math.max(boxStart.x, boxEnd.x);
  const minY = Math.min(boxStart.y, boxEnd.y);
  const maxY = Math.max(boxStart.y, boxEnd.y);

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}
