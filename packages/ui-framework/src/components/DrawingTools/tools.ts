/**
 * Drawing Tool Implementations
 *
 * Concrete implementations of drawing tools:
 * - Line tool
 * - Circle tool
 * - Arc tool
 * - Polygon tool
 * - Text tool
 */

import type { GeometricEntity, Point } from '@tupan/core-ts/cad/geometry';
import { geometryBridge } from '@tupan/core-ts/cad/geometry';
import type { IDrawingTool, DrawingToolState } from './types';

// ============ BASE TOOL CLASS ============

abstract class DrawingTool implements IDrawingTool {
  abstract name: string;
  abstract icon: string;
  abstract cursor: string;

  protected state: DrawingToolState = {
    isActive: false,
    startPoint: null,
    currentPoint: null,
    points: [],
    preview: null,
  };

  activate(): void {
    this.state.isActive = true;
    this.reset();
  }

  deactivate(): void {
    this.state.isActive = false;
    this.reset();
  }

  abstract onMouseDown(point: Point): void;
  abstract onMouseMove(point: Point): void;
  abstract onMouseUp(point: Point): void;
  abstract getPreview(): GeometricEntity | null;
  abstract getEntity(): GeometricEntity | null;

  reset(): void {
    this.state = {
      isActive: this.state.isActive,
      startPoint: null,
      currentPoint: null,
      points: [],
      preview: null,
    };
  }
}

// ============ LINE TOOL ============

export class LineTool extends DrawingTool {
  name = 'Line';
  icon = '─';
  cursor = 'crosshair';

  onMouseDown(point: Point): void {
    if (!this.state.startPoint) {
      this.state.startPoint = point;
      this.state.points = [point];
    } else {
      // Second click - finalize line
      this.state.currentPoint = point;
    }
  }

  onMouseMove(point: Point): void {
    this.state.currentPoint = point;
  }

  onMouseUp(_point: Point): void {
    // Line finalized on second click (onMouseDown)
  }

  getPreview(): GeometricEntity | null {
    if (!this.state.startPoint || !this.state.currentPoint) {
      return null;
    }

    return {
      type: 'line',
      start: this.state.startPoint,
      end: this.state.currentPoint,
    };
  }

  getEntity(): GeometricEntity | null {
    if (!this.state.startPoint || !this.state.currentPoint) {
      return null;
    }

    // Only return entity if second point is different from first
    if (this.state.startPoint === this.state.currentPoint) {
      return null;
    }

    return {
      type: 'line',
      start: this.state.startPoint,
      end: this.state.currentPoint,
    };
  }

  reset(): void {
    super.reset();
    this.state.startPoint = null;
    this.state.currentPoint = null;
  }
}

// ============ CIRCLE TOOL ============

export class CircleTool extends DrawingTool {
  name = 'Circle';
  icon = '◯';
  cursor = 'crosshair';

  onMouseDown(point: Point): void {
    if (!this.state.startPoint) {
      this.state.startPoint = point;
    }
  }

  onMouseMove(point: Point): void {
    this.state.currentPoint = point;
  }

  onMouseUp(point: Point): void {
    // Circle finalized on mouse up
    this.state.currentPoint = point;
  }

  getPreview(): GeometricEntity | null {
    if (!this.state.startPoint || !this.state.currentPoint) {
      return null;
    }

    const radius = geometryBridge.pointDistance(
      this.state.startPoint,
      this.state.currentPoint
    );

    return {
      type: 'circle',
      center: this.state.startPoint,
      radius,
    };
  }

  getEntity(): GeometricEntity | null {
    return this.getPreview();
  }

  reset(): void {
    super.reset();
    this.state.startPoint = null;
    this.state.currentPoint = null;
  }
}

// ============ ARC TOOL ============

export class ArcTool extends DrawingTool {
  name = 'Arc';
  icon = '⌢';
  cursor = 'crosshair';

  onMouseDown(point: Point): void {
    if (this.state.points.length === 0) {
      // First click - arc center
      this.state.points.push(point);
      this.state.startPoint = point;
    } else if (this.state.points.length === 1) {
      // Second click - radius
      this.state.points.push(point);
    } else if (this.state.points.length === 2) {
      // Third click - end point
      this.state.currentPoint = point;
    }
  }

  onMouseMove(point: Point): void {
    this.state.currentPoint = point;
  }

  onMouseUp(_point: Point): void {
    // Arc finalized on third click
  }

  getPreview(): GeometricEntity | null {
    if (this.state.points.length < 2 || !this.state.currentPoint) {
      return null;
    }

    const center = this.state.points[0];
    const radiusPoint = this.state.points[1];
    const endPoint = this.state.currentPoint;

    const radius = geometryBridge.pointDistance(center, radiusPoint);
    const startAngle = geometryBridge.pointAngle(center, radiusPoint);
    const endAngle = geometryBridge.pointAngle(center, endPoint);

    return {
      type: 'arc',
      center,
      radius,
      startAngle,
      endAngle,
    };
  }

  getEntity(): GeometricEntity | null {
    if (this.state.points.length < 3) {
      return null;
    }
    return this.getPreview();
  }

  reset(): void {
    super.reset();
    this.state.points = [];
    this.state.startPoint = null;
    this.state.currentPoint = null;
  }
}

// ============ POLYGON TOOL ============

export class PolygonTool extends DrawingTool {
  name = 'Polygon';
  icon = '▬';
  cursor = 'crosshair';

  onMouseDown(point: Point): void {
    // Check if clicking near start point to close polygon
    if (
      this.state.points.length > 2 &&
      geometryBridge.pointDistance(this.state.points[0], point) < 10
    ) {
      // Close polygon
      this.state.currentPoint = this.state.points[0];
      return;
    }

    this.state.points.push(point);
  }

  onMouseMove(point: Point): void {
    this.state.currentPoint = point;
  }

  onMouseUp(_point: Point): void {
    // Polygon continues until user closes it
  }

  getPreview(): GeometricEntity | null {
    if (this.state.points.length === 0) {
      return null;
    }

    const points = [...this.state.points];
    if (this.state.currentPoint) {
      points.push(this.state.currentPoint);
    }

    return {
      type: 'polygon',
      points,
    };
  }

  getEntity(): GeometricEntity | null {
    if (this.state.points.length < 3) {
      return null;
    }

    // Check if polygon is closed
    if (
      this.state.currentPoint &&
      geometryBridge.pointDistance(this.state.points[0], this.state.currentPoint) < 10
    ) {
      return {
        type: 'polygon',
        points: this.state.points,
      };
    }

    return null;
  }

  reset(): void {
    super.reset();
    this.state.points = [];
    this.state.currentPoint = null;
  }
}

// ============ TEXT TOOL ============

export class TextTool extends DrawingTool {
  name = 'Text';
  icon = 'T';
  cursor = 'text';

  private textContent: string = '';
  private textHeight: number = 12;

  onMouseDown(point: Point): void {
    if (!this.state.startPoint) {
      this.state.startPoint = point;
      // In real implementation, would show text input dialog
    }
  }

  onMouseMove(_point: Point): void {
    // Text position doesn't change while moving
  }

  onMouseUp(_point: Point): void {
    // Text finalized on mouse up
  }

  getPreview(): GeometricEntity | null {
    if (!this.state.startPoint) {
      return null;
    }

    return {
      type: 'text',
      position: this.state.startPoint,
      content: this.textContent || 'Text',
      height: this.textHeight,
    };
  }

  getEntity(): GeometricEntity | null {
    if (!this.state.startPoint || !this.textContent) {
      return null;
    }

    return {
      type: 'text',
      position: this.state.startPoint,
      content: this.textContent,
      height: this.textHeight,
    };
  }

  setText(content: string): void {
    this.textContent = content;
  }

  setHeight(height: number): void {
    this.textHeight = Math.max(8, Math.min(128, height));
  }

  reset(): void {
    super.reset();
    this.state.startPoint = null;
    this.textContent = '';
    this.textHeight = 12;
  }
}

// ============ TOOL FACTORY ============

export function createTool(toolType: string): IDrawingTool | null {
  switch (toolType.toLowerCase()) {
    case 'line':
      return new LineTool();
    case 'circle':
      return new CircleTool();
    case 'arc':
      return new ArcTool();
    case 'polygon':
      return new PolygonTool();
    case 'text':
      return new TextTool();
    default:
      return null;
  }
}

export function getAllTools(): Array<[string, IDrawingTool]> {
  return [
    ['line', new LineTool()],
    ['circle', new CircleTool()],
    ['arc', new ArcTool()],
    ['polygon', new PolygonTool()],
    ['text', new TextTool()],
  ];
}
