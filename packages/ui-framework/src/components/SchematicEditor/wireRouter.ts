/**
 * Wire Router - Handles wire drawing and routing
 *
 * Features:
 * - Manual wire routing with waypoints
 * - Orthogonal routing (Manhattan style)
 * - Wire crossing detection
 * - Net assignment and labeling
 */

import { Point } from '../../types/geometry';
import { Wire, LineSegment, WireProperties, PlacedSymbol } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new wire between two pins
 */
export function createWire(
  fromSymbol: string,
  fromPin: string,
  toSymbol: string,
  toPin: string,
  properties: Partial<WireProperties> = {}
): Wire {
  return {
    id: uuidv4(),
    segments: [],
    fromSymbol,
    fromPin,
    toSymbol,
    toPin,
    properties: {
      name: properties.name || '',
      width: properties.width || 1,
      color: properties.color || '#000',
      highCurrent: properties.highCurrent || false,
    },
  };
}

/**
 * Add waypoint to wire (for manual routing)
 */
export function addWireWaypoint(wire: Wire, point: Point, routed: boolean = true): Wire {
  if (wire.segments.length === 0) {
    // First segment
    return {
      ...wire,
      segments: [
        {
          start: point,
          end: point,
          routed,
        },
      ],
    };
  }

  // Add to existing path
  const lastSegment = wire.segments[wire.segments.length - 1];
  const newSegment: LineSegment = {
    start: lastSegment.end,
    end: point,
    routed,
  };

  return {
    ...wire,
    segments: [...wire.segments, newSegment],
  };
}

/**
 * Complete wire by connecting to target pin
 */
export function completeWire(wire: Wire, endPoint: Point): Wire {
  return addWireWaypoint(wire, endPoint, false);
}

/**
 * Auto-route wire with Manhattan (orthogonal) style
 * Tries to minimize crossings
 */
export function autoRouteWire(
  wire: Wire,
  symbols: PlacedSymbol[],
  gridSize: number = 10
): Wire {
  // Get start and end positions
  const fromSymbol = symbols.find(s => s.id === wire.fromSymbol);
  const toSymbol = symbols.find(s => s.id === wire.toSymbol);

  if (!fromSymbol || !toSymbol) return wire;

  const fromPin = fromSymbol.pins.find(p => p.id === wire.fromPin);
  const toPin = toSymbol.pins.find(p => p.id === wire.toPin);

  if (!fromPin || !toPin) return wire;

  const start = fromPin.position;
  const end = toPin.position;

  // Manhattan routing: go right first, then down
  const midX = (start.x + end.x) / 2;
  const waypoint1 = { x: midX, y: start.y };
  const waypoint2 = { x: midX, y: end.y };

  // Build segments with snapping to grid
  const segments: LineSegment[] = [
    {
      start: snapToGrid(start, gridSize),
      end: snapToGrid(waypoint1, gridSize),
      routed: true,
    },
    {
      start: snapToGrid(waypoint1, gridSize),
      end: snapToGrid(waypoint2, gridSize),
      routed: true,
    },
    {
      start: snapToGrid(waypoint2, gridSize),
      end: snapToGrid(end, gridSize),
      routed: false,
    },
  ];

  return {
    ...wire,
    segments,
  };
}

/**
 * Snap point to grid
 */
function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Detect if two wires cross
 */
export function doWiresCross(wire1: Wire, wire2: Wire): boolean {
  for (const seg1 of wire1.segments) {
    for (const seg2 of wire2.segments) {
      if (linesIntersect(seg1.start, seg1.end, seg2.start, seg2.end)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if two line segments intersect
 */
function linesIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (A: Point, B: Point, C: Point) => {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  };

  // Don't count touching at endpoints as crossing
  if (
    (p1.x === p3.x && p1.y === p3.y) ||
    (p1.x === p4.x && p1.y === p4.y) ||
    (p2.x === p3.x && p2.y === p3.y) ||
    (p2.x === p4.x && p2.y === p4.y)
  ) {
    return false;
  }

  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Get all segments of a wire path
 */
export function getWireSegments(wire: Wire): LineSegment[] {
  return wire.segments;
}

/**
 * Find wires connected to a symbol
 */
export function findWiresForSymbol(wires: Wire[], symbolId: string): Wire[] {
  return wires.filter(w => w.fromSymbol === symbolId || w.toSymbol === symbolId);
}

/**
 * Find wires on a net
 */
export function findWiresOnNet(wires: Wire[], netName: string): Wire[] {
  return wires.filter(w => w.properties.name === netName);
}

/**
 * Assign net name to wire
 */
export function assignNetName(wire: Wire, netName: string): Wire {
  return {
    ...wire,
    properties: {
      ...wire.properties,
      name: netName,
    },
  };
}

/**
 * Get wire length (sum of all segments)
 */
export function getWireLength(wire: Wire): number {
  return wire.segments.reduce((total, seg) => {
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    return total + Math.hypot(dx, dy);
  }, 0);
}

/**
 * Check if point is on wire (with tolerance)
 */
export function isPointOnWire(wire: Wire, point: Point, tolerance: number = 5): boolean {
  for (const segment of wire.segments) {
    const distance = pointToLineDistance(point, segment.start, segment.end);
    if (distance <= tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate distance from point to line
 */
function pointToLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));

  const closest = {
    x: a.x + t * dx,
    y: a.y + t * dy,
  };

  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

/**
 * Split wire at a point (for adding junction)
 */
export function splitWireAtPoint(wire: Wire, point: Point): Wire[] {
  const segments: LineSegment[] = [];
  let foundSplit = false;

  for (const segment of wire.segments) {
    if (!foundSplit && isPointOnLine(point, segment.start, segment.end, 1)) {
      // Split this segment
      segments.push({
        start: segment.start,
        end: point,
        routed: segment.routed,
      });
      segments.push({
        start: point,
        end: segment.end,
        routed: segment.routed,
      });
      foundSplit = true;
    } else {
      segments.push(segment);
    }
  }

  if (!foundSplit) return [wire]; // No split

  // Return two wires
  const midIndex = Math.floor(segments.length / 2);
  return [
    {
      ...wire,
      id: uuidv4(),
      segments: segments.slice(0, midIndex),
    },
    {
      ...wire,
      id: uuidv4(),
      segments: segments.slice(midIndex),
    },
  ];
}

/**
 * Check if point is on line segment
 */
function isPointOnLine(p: Point, a: Point, b: Point, tolerance: number): boolean {
  return pointToLineDistance(p, a, b) <= tolerance;
}

/**
 * Delete wire
 */
export function deleteWire(wires: Wire[], wireId: string): Wire[] {
  return wires.filter(w => w.id !== wireId);
}

/**
 * Get all nets in schematic
 */
export function getAllNets(wires: Wire[]): string[] {
  const nets = new Set<string>();
  wires.forEach(w => {
    if (w.properties.name) {
      nets.add(w.properties.name);
    }
  });
  return Array.from(nets).sort();
}

/**
 * Validate wire connections
 */
export function validateWireConnections(wire: Wire, symbols: PlacedSymbol[]): boolean {
  const fromSymbol = symbols.find(s => s.id === wire.fromSymbol);
  const toSymbol = symbols.find(s => s.id === wire.toSymbol);

  if (!fromSymbol || !toSymbol) return false;

  const fromPin = fromSymbol.pins.find(p => p.id === wire.fromPin);
  const toPin = toSymbol.pins.find(p => p.id === wire.toPin);

  return !!(fromPin && toPin);
}
