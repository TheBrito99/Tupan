/**
 * Clipboard Manager - Copy, Cut, Paste, Duplicate
 *
 * Features:
 * - Copy/cut/paste symbols
 * - Preserve wire connections during copy
 * - Smart paste (paste offset)
 * - Clipboard history
 * - Duplicate selection
 */

import { PlacedSymbol, Wire } from './types';
import { cloneSymbol } from './symbolPlacer';
import { createWire } from './wireRouter';
import { Point } from '../../types/geometry';
import { v4 as uuidv4 } from 'uuid';

/**
 * Clipboard entry
 */
export interface ClipboardEntry {
  id: string;
  timestamp: number;
  symbols: PlacedSymbol[];
  wires: Wire[];
  sourceBounds?: { min: Point; max: Point };
}

/**
 * Clipboard manager
 */
export class ClipboardManager {
  private clipboard: ClipboardEntry | null = null;
  private history: ClipboardEntry[] = [];
  private maxHistorySize: number = 20;
  private pasteOffset: Point = { x: 20, y: 20 };

  /**
   * Copy selected symbols (with their connecting wires)
   */
  copy(
    symbols: PlacedSymbol[],
    wires: Wire[],
    selectedSymbolIds: string[]
  ): void {
    // Get selected symbols
    const selectedSymbols = symbols.filter(s => selectedSymbolIds.includes(s.id));

    if (selectedSymbols.length === 0) return;

    // Get wires between selected symbols
    const selectedWires = wires.filter(
      w =>
        selectedSymbolIds.includes(w.fromSymbol) &&
        selectedSymbolIds.includes(w.toSymbol)
    );

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const symbol of selectedSymbols) {
      minX = Math.min(minX, symbol.position.x);
      maxX = Math.max(maxX, symbol.position.x + 40);
      minY = Math.min(minY, symbol.position.y);
      maxY = Math.max(maxY, symbol.position.y + 30);
    }

    const entry: ClipboardEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      symbols: selectedSymbols.map(s => this.deepCloneSymbol(s)),
      wires: selectedWires.map(w => this.deepCloneWire(w)),
      sourceBounds: {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
      },
    };

    this.clipboard = entry;

    // Add to history
    this.history.push(entry);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Cut selected symbols (copy + delete flag)
   */
  cut(
    symbols: PlacedSymbol[],
    wires: Wire[],
    selectedSymbolIds: string[]
  ): void {
    this.copy(symbols, wires, selectedSymbolIds);
    // Deletion is handled by caller
  }

  /**
   * Paste clipboard at position
   */
  paste(
    position: Point,
    symbols: PlacedSymbol[],
    wires: Wire[]
  ): { symbols: PlacedSymbol[]; wires: Wire[] } {
    if (!this.clipboard) {
      return { symbols, wires };
    }

    // Create new IDs for pasted symbols
    const idMap = new Map<string, string>();
    const pastedSymbols: PlacedSymbol[] = [];

    for (const symbol of this.clipboard.symbols) {
      const oldId = symbol.id;
      const newSymbol = cloneSymbol(symbol, { x: 0, y: 0 });

      // Calculate offset from clipboard bounds
      const offsetX = (symbol.position.x - (this.clipboard.sourceBounds?.min.x || 0)) +
        (position.x - (this.clipboard.sourceBounds?.min.x || 0));
      const offsetY = (symbol.position.y - (this.clipboard.sourceBounds?.min.y || 0)) +
        (position.y - (this.clipboard.sourceBounds?.min.y || 0));

      newSymbol.position = { x: offsetX, y: offsetY };

      // Update pin positions
      for (const pin of newSymbol.pins) {
        pin.position.x = offsetX + (pin.position.x - symbol.position.x);
        pin.position.y = offsetY + (pin.position.y - symbol.position.y);
      }

      idMap.set(oldId, newSymbol.id);
      pastedSymbols.push(newSymbol);
    }

    // Create wires with new IDs
    const pastedWires: Wire[] = [];
    for (const wire of this.clipboard.wires) {
      const newFromSymbol = idMap.get(wire.fromSymbol);
      const newToSymbol = idMap.get(wire.toSymbol);

      if (newFromSymbol && newToSymbol) {
        const newWire = createWire(
          newFromSymbol,
          wire.fromPin,
          newToSymbol,
          wire.toPin,
          wire.properties
        );

        // Copy segments if any
        newWire.segments = wire.segments.map(seg => ({
          ...seg,
          start: { ...seg.start },
          end: { ...seg.end },
        }));

        pastedWires.push(newWire);
      }
    }

    // Update paste offset for next paste
    this.pasteOffset.x += this.pasteOffset.x === 20 ? 20 : 0;
    this.pasteOffset.y += this.pasteOffset.y === 20 ? 20 : 0;

    return {
      symbols: [...symbols, ...pastedSymbols],
      wires: [...wires, ...pastedWires],
    };
  }

  /**
   * Duplicate selected symbols inline
   */
  duplicate(
    symbols: PlacedSymbol[],
    wires: Wire[],
    selectedSymbolIds: string[],
    offset: Point = { x: 50, y: 50 }
  ): { symbols: PlacedSymbol[]; wires: Wire[] } {
    const selectedSymbols = symbols.filter(s => selectedSymbolIds.includes(s.id));

    if (selectedSymbols.length === 0) {
      return { symbols, wires };
    }

    // Clone symbols with offset
    const idMap = new Map<string, string>();
    const clonedSymbols: PlacedSymbol[] = [];

    for (const symbol of selectedSymbols) {
      const cloned = cloneSymbol(symbol, offset);
      idMap.set(symbol.id, cloned.id);
      clonedSymbols.push(cloned);
    }

    // Clone connecting wires
    const selectedWires = wires.filter(
      w =>
        selectedSymbolIds.includes(w.fromSymbol) &&
        selectedSymbolIds.includes(w.toSymbol)
    );

    const clonedWires: Wire[] = [];
    for (const wire of selectedWires) {
      const newFromId = idMap.get(wire.fromSymbol);
      const newToId = idMap.get(wire.toSymbol);

      if (newFromId && newToId) {
        const clonedWire = createWire(
          newFromId,
          wire.fromPin,
          newToId,
          wire.toPin,
          wire.properties
        );

        clonedWire.segments = wire.segments.map(seg => ({
          ...seg,
          start: { ...seg.start },
          end: { ...seg.end },
        }));

        clonedWires.push(clonedWire);
      }
    }

    return {
      symbols: [...symbols, ...clonedSymbols],
      wires: [...wires, ...clonedWires],
    };
  }

  /**
   * Clear clipboard
   */
  clear(): void {
    this.clipboard = null;
  }

  /**
   * Check if clipboard has content
   */
  hasContent(): boolean {
    return this.clipboard !== null && this.clipboard.symbols.length > 0;
  }

  /**
   * Get clipboard content
   */
  getContent(): ClipboardEntry | null {
    return this.clipboard;
  }

  /**
   * Get clipboard history
   */
  getHistory(): ClipboardEntry[] {
    return [...this.history];
  }

  /**
   * Restore from history
   */
  restoreFromHistory(id: string): void {
    const entry = this.history.find(e => e.id === id);
    if (entry) {
      this.clipboard = entry;
    }
  }

  /**
   * Get clipboard size (number of items)
   */
  getSize(): number {
    return this.clipboard ? this.clipboard.symbols.length : 0;
  }

  /**
   * Deep clone symbol (for clipboard)
   */
  private deepCloneSymbol(symbol: PlacedSymbol): PlacedSymbol {
    return {
      ...symbol,
      id: uuidv4(),
      pins: symbol.pins.map(p => ({
        ...p,
        id: uuidv4(),
        position: { ...p.position },
      })),
      parameters: {
        ...symbol.parameters,
        custom: symbol.parameters.custom ? { ...symbol.parameters.custom } : undefined,
      },
      position: { ...symbol.position },
    };
  }

  /**
   * Deep clone wire (for clipboard)
   */
  private deepCloneWire(wire: Wire): Wire {
    return {
      ...wire,
      id: uuidv4(),
      segments: wire.segments.map(seg => ({
        start: { ...seg.start },
        end: { ...seg.end },
        routed: seg.routed,
      })),
      properties: { ...wire.properties },
    };
  }

  /**
   * Export clipboard as JSON (for file save)
   */
  exportToJSON(): string {
    if (!this.clipboard) return '{}';

    return JSON.stringify(this.clipboard, null, 2);
  }

  /**
   * Import clipboard from JSON (for file load)
   */
  importFromJSON(json: string): boolean {
    try {
      const entry = JSON.parse(json) as ClipboardEntry;

      if (entry.symbols && Array.isArray(entry.symbols)) {
        this.clipboard = entry;
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get statistics about clipboard
   */
  getStats(): {
    symbols: number;
    wires: number;
    age: number;
    timestamp: number;
  } | null {
    if (!this.clipboard) return null;

    return {
      symbols: this.clipboard.symbols.length,
      wires: this.clipboard.wires.length,
      age: Date.now() - this.clipboard.timestamp,
      timestamp: this.clipboard.timestamp,
    };
  }
}
