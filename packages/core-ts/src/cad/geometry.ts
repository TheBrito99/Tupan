/**
 * 2D CAD Geometry Bridge - TypeScript Wrapper for Rust Core
 *
 * Provides type-safe abstractions for:
 * - Geometric primitives (points, lines, circles, polygons)
 * - Transformations (translate, rotate, scale)
 * - Geometric operations (intersection, containment)
 * - Constraint solving (snap-to-grid, snap-to-geometry)
 * - DXF import/export
 */

// ============ TYPE DEFINITIONS ============

export interface Point {
  x: number;
  y: number;
}

export type GeometricEntity =
  | { type: 'point'; position: Point }
  | { type: 'line'; start: Point; end: Point }
  | {
      type: 'arc';
      center: Point;
      radius: number;
      startAngle: number;
      endAngle: number;
    }
  | { type: 'circle'; center: Point; radius: number }
  | { type: 'polygon'; points: Point[] }
  | { type: 'text'; position: Point; content: string; height: number };

export interface BoundingBox {
  min: Point;
  max: Point;
}

export interface Transform2D {
  tx: number; // Translation X
  ty: number; // Translation Y
  scale: number; // Uniform scale
  rotation: number; // Radians
}

export interface Layer {
  name: string;
  visible: boolean;
  locked: boolean;
  color: [number, number, number];
  lineWidth: number;
  transparency: number;
}

export interface DxfDrawing {
  entities: Array<[string, GeometricEntity]>; // [layer, entity]
  layers: Layer[];
}

// ============ GEOMETRY BRIDGE ============

export class GeometryBridge {
  private initialized = false;

  async initialize(): Promise<void> {
    // WASM initialization will happen here
    // For now, this is a placeholder for future WASM binding
    this.initialized = true;
  }

  // ============ POINT OPERATIONS ============

  /**
   * Calculate distance between two points
   */
  pointDistance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate angle from p1 to p2 (in radians)
   */
  pointAngle(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.atan2(dy, dx);
  }

  /**
   * Transform a point using transformation matrix
   */
  transformPoint(point: Point, transform: Transform2D): Point {
    // Translate
    let x = point.x + transform.tx;
    let y = point.y + transform.ty;

    // Rotate
    const cos_r = Math.cos(transform.rotation);
    const sin_r = Math.sin(transform.rotation);
    const rx = x * cos_r - y * sin_r;
    const ry = x * sin_r + y * cos_r;
    x = rx;
    y = ry;

    // Scale
    x *= transform.scale;
    y *= transform.scale;

    return { x, y };
  }

  // ============ ENTITY OPERATIONS ============

  /**
   * Calculate bounding box for entity
   */
  boundingBox(entity: GeometricEntity): BoundingBox {
    switch (entity.type) {
      case 'point': {
        const { position } = entity;
        return {
          min: position,
          max: position,
        };
      }

      case 'line': {
        const { start, end } = entity;
        return {
          min: {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
          },
          max: {
            x: Math.max(start.x, end.x),
            y: Math.max(start.y, end.y),
          },
        };
      }

      case 'circle': {
        const { center, radius } = entity;
        return {
          min: {
            x: center.x - radius,
            y: center.y - radius,
          },
          max: {
            x: center.x + radius,
            y: center.y + radius,
          },
        };
      }

      case 'polygon': {
        const { points } = entity;
        if (points.length === 0) {
          return {
            min: { x: 0, y: 0 },
            max: { x: 0, y: 0 },
          };
        }

        let minX = points[0].x;
        let maxX = points[0].x;
        let minY = points[0].y;
        let maxY = points[0].y;

        for (const p of points) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }

        return {
          min: { x: minX, y: minY },
          max: { x: maxX, y: maxY },
        };
      }

      case 'text': {
        const { position, height, content } = entity;
        const width = content.length * height * 0.6;
        return {
          min: position,
          max: {
            x: position.x + width,
            y: position.y + height,
          },
        };
      }

      case 'arc': {
        const { center, radius } = entity;
        return {
          min: {
            x: center.x - radius,
            y: center.y - radius,
          },
          max: {
            x: center.x + radius,
            y: center.y + radius,
          },
        };
      }

      default:
        return {
          min: { x: 0, y: 0 },
          max: { x: 0, y: 0 },
        };
    }
  }

  /**
   * Check if entity contains point (within tolerance)
   */
  entityContainsPoint(entity: GeometricEntity, point: Point, tolerance: number = 0.1): boolean {
    const bbox = this.boundingBox(entity);
    if (
      point.x < bbox.min.x - tolerance ||
      point.x > bbox.max.x + tolerance ||
      point.y < bbox.min.y - tolerance ||
      point.y > bbox.max.y + tolerance
    ) {
      return false;
    }

    switch (entity.type) {
      case 'point':
        return this.pointDistance(entity.position, point) <= tolerance;

      case 'line': {
        const dist = this.linePointDistance(entity.start, entity.end, point);
        return dist <= tolerance;
      }

      case 'circle': {
        const dist = this.pointDistance(entity.center, point);
        return Math.abs(dist - entity.radius) <= tolerance;
      }

      case 'polygon': {
        // Check edges
        const { points } = entity;
        for (let i = 0; i < points.length; i++) {
          const p1 = points[i];
          const p2 = points[(i + 1) % points.length];
          const dist = this.linePointDistance(p1, p2, point);
          if (dist <= tolerance) {
            return true;
          }
        }
        // Check if inside
        return this.pointInPolygon(point, points);
      }

      default:
        return false;
    }
  }

  /**
   * Transform entity using transformation
   */
  transformEntity(entity: GeometricEntity, transform: Transform2D): GeometricEntity {
    switch (entity.type) {
      case 'point':
        return {
          type: 'point',
          position: this.transformPoint(entity.position, transform),
        };

      case 'line':
        return {
          type: 'line',
          start: this.transformPoint(entity.start, transform),
          end: this.transformPoint(entity.end, transform),
        };

      case 'circle':
        return {
          type: 'circle',
          center: this.transformPoint(entity.center, transform),
          radius: entity.radius * transform.scale,
        };

      case 'arc':
        return {
          type: 'arc',
          center: this.transformPoint(entity.center, transform),
          radius: entity.radius * transform.scale,
          startAngle: entity.startAngle + transform.rotation,
          endAngle: entity.endAngle + transform.rotation,
        };

      case 'polygon':
        return {
          type: 'polygon',
          points: entity.points.map((p) => this.transformPoint(p, transform)),
        };

      case 'text':
        return {
          type: 'text',
          position: this.transformPoint(entity.position, transform),
          content: entity.content,
          height: entity.height * transform.scale,
        };

      default:
        return entity;
    }
  }

  // ============ INTERSECTION OPERATIONS ============

  /**
   * Find intersection points between two entities
   */
  intersect(e1: GeometricEntity, e2: GeometricEntity, tolerance: number = 0.001): Point[] {
    // Line-Line
    if (e1.type === 'line' && e2.type === 'line') {
      return this.lineLineIntersection(e1.start, e1.end, e2.start, e2.end, tolerance);
    }

    // Line-Circle
    if (e1.type === 'line' && e2.type === 'circle') {
      return this.lineCircleIntersection(e1.start, e1.end, e2.center, e2.radius, tolerance);
    }
    if (e1.type === 'circle' && e2.type === 'line') {
      return this.lineCircleIntersection(e2.start, e2.end, e1.center, e1.radius, tolerance);
    }

    // Circle-Circle
    if (e1.type === 'circle' && e2.type === 'circle') {
      return this.circleCircleIntersection(
        e1.center,
        e1.radius,
        e2.center,
        e2.radius,
        tolerance
      );
    }

    return [];
  }

  private linePointDistance(start: Point, end: Point, point: Point): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return this.pointDistance(start, point);
    }

    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closest = {
      x: start.x + t * dx,
      y: start.y + t * dy,
    };

    return this.pointDistance(point, closest);
  }

  private lineLineIntersection(
    s1: Point,
    e1: Point,
    s2: Point,
    e2: Point,
    tolerance: number
  ): Point[] {
    const x1 = s1.x;
    const y1 = s1.y;
    const x2 = e1.x;
    const y2 = e1.y;
    const x3 = s2.x;
    const y3 = s2.y;
    const x4 = e2.x;
    const y4 = e2.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denom) < tolerance) {
      return []; // Parallel
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return [{ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }];
    }

    return [];
  }

  private lineCircleIntersection(
    s: Point,
    e: Point,
    center: Point,
    radius: number,
    _tolerance: number
  ): Point[] {
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const fx = s.x - center.x;
    const fy = s.y - center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      return [];
    }

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    const intersections: Point[] = [];

    for (const t of [t1, t2]) {
      if (t >= 0 && t <= 1) {
        intersections.push({
          x: s.x + t * dx,
          y: s.y + t * dy,
        });
      }
    }

    return intersections;
  }

  private circleCircleIntersection(
    c1: Point,
    r1: number,
    c2: Point,
    r2: number,
    tolerance: number
  ): Point[] {
    const d = this.pointDistance(c1, c2);

    if (d > r1 + r2 + tolerance || d < Math.abs(r1 - r2) - tolerance || d < tolerance) {
      return [];
    }

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(r1 * r1 - a * a);

    const px = c1.x + (a * (c2.x - c1.x)) / d;
    const py = c1.y + (a * (c2.y - c1.y)) / d;

    const ix1 = px + (h * (c2.y - c1.y)) / d;
    const iy1 = py - (h * (c2.x - c1.x)) / d;

    const ix2 = px - (h * (c2.y - c1.y)) / d;
    const iy2 = py + (h * (c2.x - c1.x)) / d;

    return [
      { x: ix1, y: iy1 },
      { x: ix2, y: iy2 },
    ];
  }

  private pointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];

      if (
        (p1.y > point.y) !== (p2.y > point.y) &&
        point.x < ((p2.x - p1.x) * (point.y - p1.y)) / (p2.y - p1.y) + p1.x
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  // ============ CONSTRAINT SOLVER ============

  /**
   * Snap point to grid
   */
  snapToGrid(point: Point, gridSize: number): Point {
    const x = Math.round(point.x / gridSize) * gridSize;
    const y = Math.round(point.y / gridSize) * gridSize;
    return { x, y };
  }

  /**
   * Find snap candidates near a point
   */
  findSnapCandidates(
    point: Point,
    entities: GeometricEntity[],
    snapDistance: number = 10
  ): Point[] {
    const candidates: Point[] = [];

    // Add nearby endpoints
    for (const entity of entities) {
      switch (entity.type) {
        case 'line': {
          if (this.pointDistance(entity.start, point) <= snapDistance) {
            candidates.push(entity.start);
          }
          if (this.pointDistance(entity.end, point) <= snapDistance) {
            candidates.push(entity.end);
          }
          break;
        }
        case 'circle':
        case 'arc': {
          if (this.pointDistance(entity.center, point) <= snapDistance) {
            candidates.push(entity.center);
          }
          break;
        }
      }
    }

    // Sort by distance
    candidates.sort((a, b) => this.pointDistance(point, a) - this.pointDistance(point, b));

    // Remove duplicates
    const unique: Point[] = [];
    for (const c of candidates) {
      if (unique.length === 0 || this.pointDistance(c, unique[unique.length - 1]) > 0.01) {
        unique.push(c);
      }
    }

    return unique;
  }

  // ============ DXF SUPPORT ============

  /**
   * Export entities to DXF string
   */
  entitiesToDxf(entities: Array<[string, GeometricEntity]>, layers: Layer[]): string {
    let output = '';

    // Header
    output += '0\nSECTION\n2\nHEADER\n';
    output += '9\n$ACADVER\n1\nAC1021\n';
    output += '0\nENDSEC\n';

    // Layers
    output += '0\nSECTION\n2\nLAYERS\n';
    for (const layer of layers) {
      output += '0\nLAYER\n';
      output += `2\n${layer.name}\n`;
      output += '62\n1\n';
      output += '370\n0\n';
    }
    output += '0\nENDSEC\n';

    // Entities
    output += '0\nSECTION\n2\nENTITIES\n';

    for (const [layerName, entity] of entities) {
      output += this.entityToDxf(entity, layerName);
    }

    output += '0\nENDSEC\n';
    output += '0\nEOF\n';

    return output;
  }

  private entityToDxf(entity: GeometricEntity, layer: string): string {
    let output = '';

    switch (entity.type) {
      case 'line':
        output += '0\nLINE\n';
        output += `8\n${layer}\n`;
        output += `10\n${entity.start.x}\n`;
        output += `20\n${entity.start.y}\n`;
        output += `11\n${entity.end.x}\n`;
        output += `21\n${entity.end.y}\n`;
        break;

      case 'circle':
        output += '0\nCIRCLE\n';
        output += `8\n${layer}\n`;
        output += `10\n${entity.center.x}\n`;
        output += `20\n${entity.center.y}\n`;
        output += `40\n${entity.radius}\n`;
        break;

      case 'polygon':
        output += '0\nLWPOLYLINE\n';
        output += `8\n${layer}\n`;
        output += `90\n${entity.points.length}\n`;
        for (const p of entity.points) {
          output += `10\n${p.x}\n`;
          output += `20\n${p.y}\n`;
        }
        break;

      case 'text':
        output += '0\nTEXT\n';
        output += `8\n${layer}\n`;
        output += `10\n${entity.position.x}\n`;
        output += `20\n${entity.position.y}\n`;
        output += `40\n${entity.height}\n`;
        output += `1\n${entity.content}\n`;
        break;
    }

    return output;
  }
}

// ============ EXPORTS ============

export const geometryBridge = new GeometryBridge();
