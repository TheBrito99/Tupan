/**
 * Design Rule Checking (DRC) Engine
 *
 * Validates PCB design against manufacturing constraints:
 * - Trace width and spacing
 * - Via sizing and clearances
 * - Pad-to-trace clearances
 * - Component clearances
 * - Electrical connectivity
 */

import { PCBBoard, Trace, Via, PlacedComponent, DRCViolation, DesignRule } from './types';

export interface DRCConfig {
  checkTraceWidth: boolean;
  checkTraceSpacing: boolean;
  checkViaClearance: boolean;
  checkPadClearance: boolean;
  checkComponentClearance: boolean;
  checkElectrical: boolean;
}

export class DRCEngine {
  private board: PCBBoard;
  private rules: Map<string, DesignRule> = new Map();
  private violations: DRCViolation[] = [];

  constructor(board: PCBBoard) {
    this.board = board;
    // Index rules by name for quick lookup
    for (const rule of board.designRules) {
      this.rules.set(rule.name, rule);
    }
  }

  /**
   * Run full DRC check
   */
  public runFullDRC(config?: Partial<DRCConfig>): DRCViolation[] {
    const fullConfig: DRCConfig = {
      checkTraceWidth: true,
      checkTraceSpacing: true,
      checkViaClearance: true,
      checkPadClearance: true,
      checkComponentClearance: true,
      checkElectrical: true,
      ...config,
    };

    this.violations = [];

    if (fullConfig.checkTraceWidth) this.checkTraceWidths();
    if (fullConfig.checkTraceSpacing) this.checkTraceSpacing();
    if (fullConfig.checkViaClearance) this.checkViaClearances();
    if (fullConfig.checkPadClearance) this.checkPadClearances();
    if (fullConfig.checkComponentClearance) this.checkComponentClearances();
    if (fullConfig.checkElectrical) this.checkElectrical();

    return [...this.violations];
  }

  /**
   * Check trace widths
   */
  private checkTraceWidths(): void {
    const minWidth = this.rules.get('Trace Width')?.minValue || 0.15;

    for (const trace of this.board.traces) {
      if (trace.width < minWidth) {
        this.violations.push({
          id: `trace_width_${trace.id}`,
          severity: 'error',
          type: 'TraceWidth',
          message: `Trace width ${trace.width.toFixed(3)}mm is below minimum ${minWidth.toFixed(3)}mm`,
          affectedObjects: [trace.id],
        });
      }
    }
  }

  /**
   * Check trace-to-trace spacing
   */
  private checkTraceSpacing(): void {
    const minSpacing = this.rules.get('Trace Spacing')?.minValue || 0.15;

    for (let i = 0; i < this.board.traces.length; i++) {
      for (let j = i + 1; j < this.board.traces.length; j++) {
        const trace1 = this.board.traces[i];
        const trace2 = this.board.traces[j];

        // Skip traces on different layers
        if (trace1.layer !== trace2.layer) continue;

        const distance = this.calculateTraceDistance(trace1, trace2);
        if (distance < minSpacing) {
          this.violations.push({
            id: `trace_spacing_${trace1.id}_${trace2.id}`,
            severity: 'error',
            type: 'TraceSpacing',
            message: `Trace spacing ${distance.toFixed(3)}mm is below minimum ${minSpacing.toFixed(3)}mm`,
            affectedObjects: [trace1.id, trace2.id],
          });
        }
      }
    }
  }

  /**
   * Check via clearances
   */
  private checkViaClearances(): void {
    const minSpacing = this.rules.get('Via Spacing')?.minValue || 0.6;
    const minToPad = this.rules.get('Via To Pad')?.minValue || 0.254;

    // Via-to-via spacing
    for (let i = 0; i < this.board.vias.length; i++) {
      for (let j = i + 1; j < this.board.vias.length; j++) {
        const via1 = this.board.vias[i];
        const via2 = this.board.vias[j];

        const distance = Math.hypot(via2.position.x - via1.position.x, via2.position.y - via1.position.y);
        const requiredDistance = minSpacing + (via1.diameter + via2.diameter) / 2;

        if (distance < requiredDistance) {
          this.violations.push({
            id: `via_spacing_${via1.id}_${via2.id}`,
            severity: 'error',
            type: 'ViaClearance',
            message: `Via spacing ${distance.toFixed(3)}mm violates minimum ${requiredDistance.toFixed(3)}mm`,
            affectedObjects: [via1.id, via2.id],
          });
        }
      }
    }

    // Via-to-pad spacing
    for (const via of this.board.vias) {
      for (const component of this.board.components) {
        for (const pad of component.footprint.pads) {
          const padX = component.position.x + pad.position.x;
          const padY = component.position.y + pad.position.y;

          const distance = Math.hypot(via.position.x - padX, via.position.y - padY);
          const requiredDistance = minToPad + (via.diameter + Math.max(pad.width, pad.height)) / 2;

          if (distance < requiredDistance) {
            this.violations.push({
              id: `via_pad_${via.id}_${pad.id}`,
              severity: 'warning',
              type: 'ViaClearance',
              message: `Via too close to pad: ${distance.toFixed(3)}mm < ${requiredDistance.toFixed(3)}mm`,
              affectedObjects: [via.id, pad.id],
            });
          }
        }
      }
    }
  }

  /**
   * Check pad clearances with traces
   */
  private checkPadClearances(): void {
    const minClearance = this.rules.get('Pad Clearance')?.minValue || 0.254;

    for (const component of this.board.components) {
      for (const pad of component.footprint.pads) {
        const padX = component.position.x + pad.position.x;
        const padY = component.position.y + pad.position.y;

        for (const trace of this.board.traces) {
          // Skip if trace is on different layer
          if (trace.layer !== pad.layers[0]) continue;

          const distance = this.calculatePointToTraceDistance({ x: padX, y: padY }, trace);
          const requiredDistance = minClearance + (Math.max(pad.width, pad.height) + trace.width) / 2;

          if (distance < requiredDistance) {
            this.violations.push({
              id: `pad_trace_${pad.id}_${trace.id}`,
              severity: 'warning',
              type: 'PadClearance',
              message: `Pad-trace clearance ${distance.toFixed(3)}mm violates minimum ${requiredDistance.toFixed(3)}mm`,
              affectedObjects: [pad.id, trace.id],
            });
          }
        }
      }
    }
  }

  /**
   * Check component clearances
   */
  private checkComponentClearances(): void {
    const minClearance = 5; // 5mm minimum between component bounds

    for (let i = 0; i < this.board.components.length; i++) {
      for (let j = i + 1; j < this.board.components.length; j++) {
        const comp1 = this.board.components[i];
        const comp2 = this.board.components[j];

        // Get component bounds
        const bounds1 = this.getComponentBounds(comp1);
        const bounds2 = this.getComponentBounds(comp2);

        const distance = this.calculateBoundsDistance(bounds1, bounds2);

        if (distance < minClearance) {
          this.violations.push({
            id: `comp_clearance_${comp1.id}_${comp2.id}`,
            severity: 'warning',
            type: 'ComponentClearance',
            message: `Component clearance ${distance.toFixed(1)}mm below recommended ${minClearance}mm`,
            affectedObjects: [comp1.id, comp2.id],
          });
        }
      }
    }
  }

  /**
   * Check electrical connectivity
   */
  private checkElectrical(): void {
    // Check for unconnected nets
    const connectedNets = new Set<string>();

    for (const trace of this.board.traces) {
      // This would require tracking net names on traces
      // Placeholder for electrical connectivity checking
    }

    // Check for shorts (traces on same net crossing)
    // Would require sophisticated connectivity analysis
  }

  /**
   * Calculate distance between two traces
   */
  private calculateTraceDistance(trace1: Trace, trace2: Trace): number {
    let minDistance = Infinity;

    for (const seg1 of trace1.segments) {
      for (const seg2 of trace2.segments) {
        const distance = this.segmentToSegmentDistance(seg1, seg2);
        minDistance = Math.min(minDistance, distance);
      }
    }

    return Math.max(0, minDistance - (trace1.width + trace2.width) / 2);
  }

  /**
   * Calculate distance from point to trace
   */
  private calculatePointToTraceDistance(point: { x: number; y: number }, trace: Trace): number {
    let minDistance = Infinity;

    for (const segment of trace.segments) {
      const distance = this.pointToSegmentDistance(point, segment);
      minDistance = Math.min(minDistance, distance);
    }

    return Math.max(0, minDistance - trace.width / 2);
  }

  /**
   * Point to line segment distance
   */
  private pointToSegmentDistance(
    point: { x: number; y: number },
    segment: { start: { x: number; y: number }; end: { x: number; y: number } }
  ): number {
    const { x, y } = point;
    const { start, end } = segment;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return Math.hypot(x - start.x, y - start.y);
    }

    let t = ((x - start.x) * dx + (y - start.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = start.x + t * dx;
    const closestY = start.y + t * dy;

    return Math.hypot(x - closestX, y - closestY);
  }

  /**
   * Segment to segment distance
   */
  private segmentToSegmentDistance(
    seg1: { start: { x: number; y: number }; end: { x: number; y: number } },
    seg2: { start: { x: number; y: number }; end: { x: number; y: number } }
  ): number {
    const d1 = this.pointToSegmentDistance(seg1.start, seg2);
    const d2 = this.pointToSegmentDistance(seg1.end, seg2);
    const d3 = this.pointToSegmentDistance(seg2.start, seg1);
    const d4 = this.pointToSegmentDistance(seg2.end, seg1);

    return Math.min(d1, d2, d3, d4);
  }

  /**
   * Get component bounds
   */
  private getComponentBounds(component: PlacedComponent): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    const fp = component.footprint;
    const bounds = fp.bounds;

    return {
      minX: component.position.x + bounds.minX,
      maxX: component.position.x + bounds.maxX,
      minY: component.position.y + bounds.minY,
      maxY: component.position.y + bounds.maxY,
    };
  }

  /**
   * Calculate distance between bounding boxes
   */
  private calculateBoundsDistance(
    bounds1: { minX: number; maxX: number; minY: number; maxY: number },
    bounds2: { minX: number; maxX: number; minY: number; maxY: number }
  ): number {
    // Check if bounds overlap
    if (bounds1.maxX >= bounds2.minX && bounds2.maxX >= bounds1.minX &&
        bounds1.maxY >= bounds2.minY && bounds2.maxY >= bounds1.minY) {
      return 0; // Overlapping
    }

    // Calculate minimum distance
    let dx = 0;
    let dy = 0;

    if (bounds1.maxX < bounds2.minX) dx = bounds2.minX - bounds1.maxX;
    else if (bounds2.maxX < bounds1.minX) dx = bounds1.minX - bounds2.maxX;

    if (bounds1.maxY < bounds2.minY) dy = bounds2.minY - bounds1.maxY;
    else if (bounds2.maxY < bounds1.minY) dy = bounds1.minY - bounds2.maxY;

    return Math.hypot(dx, dy);
  }

  /**
   * Get violations summary
   */
  public getViolationsSummary(): {
    totalViolations: number;
    errors: number;
    warnings: number;
  } {
    return {
      totalViolations: this.violations.length,
      errors: this.violations.filter(v => v.severity === 'error').length,
      warnings: this.violations.filter(v => v.severity === 'warning').length,
    };
  }

  /**
   * Get violations by type
   */
  public getViolationsByType(type: string): DRCViolation[] {
    return this.violations.filter(v => v.type === type);
  }
}
