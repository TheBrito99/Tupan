/**
 * Symbol Placer - Handles placement and manipulation of symbols in schematic
 *
 * Features:
 * - Drag and drop symbol placement
 * - Rotation and scaling
 * - Pin detection and snapping
 * - Reference designator assignment
 */

import { Point } from '../../types/geometry';
import { Symbol } from '../DrawingTools/types';
import { PlacedSymbol, PinConnection, SymbolParameters } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Auto-incremented reference designators for components
 */
const RefDesCounters: Record<string, number> = {
  R: 0,
  C: 0,
  L: 0,
  D: 0,
  Q: 0,
  U: 0,
  V: 0,
  I: 0,
  S: 0,
  RL: 0,
};

/**
 * Symbol category to reference designator mapping
 */
const CategoryToRefDes: Record<string, string> = {
  'resistor': 'R',
  'potentiometer': 'R',
  'capacitor': 'C',
  'inductor': 'L',
  'diode': 'D',
  'led': 'D',
  'transistor': 'Q',
  'opamp': 'U',
  'voltage_source': 'V',
  'current_source': 'I',
  'switch': 'S',
  'relay': 'RL',
  'junction': 'J',
  'ground': 'GND',
};

/**
 * Get next reference designator for a component type
 */
export function getNextRefDes(category: string): string {
  const prefix = CategoryToRefDes[category] || 'X';
  RefDesCounters[prefix] = (RefDesCounters[prefix] || 0) + 1;
  return `${prefix}${RefDesCounters[prefix]}`;
}

/**
 * Reset reference designator counters
 */
export function resetRefDesCounters(): void {
  Object.keys(RefDesCounters).forEach(key => {
    RefDesCounters[key] = 0;
  });
}

/**
 * Create pin connections for a symbol
 * Generates pin positions based on symbol bounds
 */
export function createPinsForSymbol(symbol: Symbol, position: Point): PinConnection[] {
  // Calculate symbol bounds
  const bounds = calculateSymbolBounds(symbol);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  const pins: PinConnection[] = [];

  // Standard pin positions: top, bottom, left, right
  const pinSpacing = Math.max(height / 3, 10);

  // Left side pins
  pins.push({
    id: '1',
    name: 'Pin1',
    position: { x: position.x + bounds.minX, y: position.y + bounds.minY + pinSpacing },
    type: 'inout',
    connected: false,
  });

  // Right side pins
  pins.push({
    id: '2',
    name: 'Pin2',
    position: { x: position.x + bounds.maxX, y: position.y + bounds.minY + pinSpacing },
    type: 'inout',
    connected: false,
  });

  // For larger components, add more pins
  if (height > 40) {
    pins.push({
      id: '3',
      name: 'Pin3',
      position: { x: position.x + bounds.minX, y: position.y + bounds.minY + pinSpacing * 2 },
      type: 'inout',
      connected: false,
    });

    pins.push({
      id: '4',
      name: 'Pin4',
      position: { x: position.x + bounds.maxX, y: position.y + bounds.minY + pinSpacing * 2 },
      type: 'inout',
      connected: false,
    });
  }

  return pins;
}

/**
 * Calculate bounding box of a symbol
 */
function calculateSymbolBounds(symbol: Symbol) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  symbol.entities.forEach(entity => {
    switch (entity.type) {
      case 'point':
        minX = Math.min(minX, entity.x);
        maxX = Math.max(maxX, entity.x);
        minY = Math.min(minY, entity.y);
        maxY = Math.max(maxY, entity.y);
        break;
      case 'line':
        minX = Math.min(minX, entity.start.x, entity.end.x);
        maxX = Math.max(maxX, entity.start.x, entity.end.x);
        minY = Math.min(minY, entity.start.y, entity.end.y);
        maxY = Math.max(maxY, entity.start.y, entity.end.y);
        break;
      case 'circle':
        minX = Math.min(minX, entity.center.x - entity.radius);
        maxX = Math.max(maxX, entity.center.x + entity.radius);
        minY = Math.min(minY, entity.center.y - entity.radius);
        maxY = Math.max(maxY, entity.center.y + entity.radius);
        break;
      case 'polygon':
        entity.points.forEach(p => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        });
        break;
    }
  });

  return {
    minX: minX === Infinity ? 0 : minX,
    maxX: maxX === -Infinity ? 0 : maxX,
    minY: minY === Infinity ? 0 : minY,
    maxY: maxY === -Infinity ? 0 : maxY,
  };
}

/**
 * Place a symbol at a position
 */
export function placeSymbol(
  symbol: Symbol,
  position: Point,
  parameters: Partial<SymbolParameters> = {}
): PlacedSymbol {
  const pins = createPinsForSymbol(symbol, position);
  const refdes = getNextRefDes(symbol.category);

  return {
    id: uuidv4(),
    symbolId: symbol.id,
    symbol,
    position,
    rotation: 0,
    scale: 1.0,
    parameters: {
      value: parameters.value || '',
      unit: parameters.unit || symbol.properties?.unit || '',
      tolerance: parameters.tolerance,
      package: parameters.package,
      footprint: parameters.footprint,
      description: symbol.description,
      custom: parameters.custom || {},
    },
    pins,
    locked: false,
  };
}

/**
 * Move a placed symbol
 */
export function moveSymbol(symbol: PlacedSymbol, newPosition: Point): PlacedSymbol {
  const delta = {
    x: newPosition.x - symbol.position.x,
    y: newPosition.y - symbol.position.y,
  };

  return {
    ...symbol,
    position: newPosition,
    pins: symbol.pins.map(pin => ({
      ...pin,
      position: {
        x: pin.position.x + delta.x,
        y: pin.position.y + delta.y,
      },
    })),
  };
}

/**
 * Rotate a symbol (0, 90, 180, 270 degrees)
 */
export function rotateSymbol(symbol: PlacedSymbol, degrees: number): PlacedSymbol {
  const newRotation = (symbol.rotation + degrees) % 360;

  // Rotate pins around symbol center
  const bounds = calculateSymbolBounds(symbol.symbol);
  const centerX = symbol.position.x + (bounds.maxX + bounds.minX) / 2;
  const centerY = symbol.position.y + (bounds.maxY + bounds.minY) / 2;

  const rotatedPins = symbol.pins.map(pin => {
    const dx = pin.position.x - centerX;
    const dy = pin.position.y - centerY;
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return {
      ...pin,
      position: {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
      },
    };
  });

  return {
    ...symbol,
    rotation: newRotation,
    pins: rotatedPins,
  };
}

/**
 * Scale a symbol
 */
export function scaleSymbol(symbol: PlacedSymbol, factor: number): PlacedSymbol {
  const clampedFactor = Math.max(0.5, Math.min(2.0, factor));
  const bounds = calculateSymbolBounds(symbol.symbol);
  const centerX = symbol.position.x + (bounds.maxX + bounds.minX) / 2;
  const centerY = symbol.position.y + (bounds.maxY + bounds.minY) / 2;

  const scaledPins = symbol.pins.map(pin => {
    const dx = (pin.position.x - centerX) * (clampedFactor / symbol.scale);
    const dy = (pin.position.y - centerY) * (clampedFactor / symbol.scale);

    return {
      ...pin,
      position: {
        x: centerX + dx,
        y: centerY + dy,
      },
    };
  });

  return {
    ...symbol,
    scale: clampedFactor,
    pins: scaledPins,
  };
}

/**
 * Find pin at a position (with tolerance)
 */
export function findPinAtPosition(
  symbols: PlacedSymbol[],
  position: Point,
  tolerance: number = 10
): { symbolId: string; pinId: string } | null {
  for (const symbol of symbols) {
    for (const pin of symbol.pins) {
      const distance = Math.hypot(pin.position.x - position.x, pin.position.y - position.y);
      if (distance <= tolerance) {
        return { symbolId: symbol.id, pinId: pin.id };
      }
    }
  }
  return null;
}

/**
 * Update symbol parameters
 */
export function updateSymbolParameters(
  symbol: PlacedSymbol,
  parameters: Partial<SymbolParameters>
): PlacedSymbol {
  return {
    ...symbol,
    parameters: {
      ...symbol.parameters,
      ...parameters,
    },
  };
}

/**
 * Clone a symbol
 */
export function cloneSymbol(symbol: PlacedSymbol, offset: Point = { x: 20, y: 20 }): PlacedSymbol {
  return {
    ...symbol,
    id: uuidv4(),
    position: {
      x: symbol.position.x + offset.x,
      y: symbol.position.y + offset.y,
    },
    pins: symbol.pins.map(pin => ({
      ...pin,
      id: uuidv4(),
      connected: false,
    })),
  };
}

/**
 * Delete symbol (cleanup)
 */
export function deleteSymbol(symbols: PlacedSymbol[], symbolId: string): PlacedSymbol[] {
  return symbols.filter(s => s.id !== symbolId);
}
