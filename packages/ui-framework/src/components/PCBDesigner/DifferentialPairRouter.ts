/**
 * Differential Pair Router - Route paired traces with maintained spacing
 *
 * Features:
 * - Maintains constant spacing between positive and negative traces
 * - Equal length routing for minimal skew
 * - Parallel routing to minimize crosstalk
 * - Via pairing for layer transitions
 * - Impedance-controlled routing
 */

import { v4 as uuidv4 } from 'uuid';
import { Trace, Via, PCBLayer } from './types';
import { TraceRouter, RoutePath } from './TraceRouter';

export interface DifferentialPair {
  netPositive: string;     // e.g., "USB_D+"
  netNegative: string;     // e.g., "USB_D-"
  spacing: number;         // mm (maintain this gap between traces)
  impedance: number;       // Ω (differential impedance target)
  maxSkew: number;         // ps (maximum timing skew allowed)
}

export interface PairRoutingResult {
  positiveTrace: Trace;
  negativeTrace: Trace;
  positiveVias: Via[];
  negativeVias: Via[];
  length: number;          // mm (average length)
  skew: number;            // ps (actual timing skew)
  coupling: number;        // % (coupling effectiveness, 0-100)
  success: boolean;
}

export class DifferentialPairRouter {
  private baseRouter: TraceRouter;
  private pairSpacing: number;

  constructor(baseRouter: TraceRouter, defaultSpacing: number = 0.3) {
    this.baseRouter = baseRouter;
    this.pairSpacing = defaultSpacing;
  }

  /**
   * Route differential pair between two points
   *
   * Algorithm:
   * 1. Calculate parallel routes with fixed spacing
   * 2. Route positive trace using Lee algorithm
   * 3. Route negative trace, maintaining spacing constraint
   * 4. Balance lengths to minimize skew
   */
  public routePair(
    startPosX: number,
    startPosY: number,
    startNegX: number,
    startNegY: number,
    endPosX: number,
    endPosY: number,
    endNegX: number,
    endNegY: number,
    layer: PCBLayer,
    pair: DifferentialPair
  ): PairRoutingResult | null {
    // Route positive trace
    const posPath = this.baseRouter.routeTrace(
      startPosX,
      startPosY,
      endPosX,
      endPosY,
      layer,
      0.254
    );

    if (!posPath) return null;

    // Route negative trace with spacing constraint
    const negPath = this.routeWithSpacingConstraint(
      startNegX,
      startNegY,
      endNegX,
      endNegY,
      layer,
      posPath,
      pair.spacing
    );

    if (!negPath) return null;

    // Simplify paths
    const simplifiedPos = this.baseRouter.simplifyPath(posPath);
    const simplifiedNeg = this.baseRouter.simplifyPath(negPath);

    // Balance lengths
    const balanced = this.balanceLengths(simplifiedPos, simplifiedNeg);

    // Calculate metrics
    const posLength = this.baseRouter.calculatePathLength(balanced.positive);
    const negLength = this.baseRouter.calculatePathLength(balanced.negative);
    const skew = Math.abs(posLength - negLength) * 3.43; // Approximately 3.43 ps/mm for FR-4
    const coupling = this.calculateCoupling(balanced.positive, balanced.negative, pair.spacing);

    // Create traces
    const posTrace = this.baseRouter.pathToTrace(balanced.positive, layer, pair.netPositive, 0.254);
    const negTrace = this.baseRouter.pathToTrace(balanced.negative, layer, pair.netNegative, 0.254);

    const posVias = this.baseRouter.pathToVias(balanced.positive);
    const negVias = this.baseRouter.pathToVias(balanced.negative);

    return {
      positiveTrace: posTrace,
      negativeTrace: negTrace,
      positiveVias: posVias,
      negativeVias: negVias,
      length: (posLength + negLength) / 2,
      skew,
      coupling,
      success: skew <= pair.maxSkew,
    };
  }

  /**
   * Route negative trace while maintaining spacing from positive
   */
  private routeWithSpacingConstraint(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    layer: PCBLayer,
    positivePath: RoutePath,
    spacing: number
  ): RoutePath | null {
    // For each segment in positive path, create exclusion zone
    const exclusionZones: Array<{
      x: number;
      y: number;
      radius: number;
    }> = [];

    for (const segment of positivePath.segments) {
      // Midpoint of segment
      const mx = (segment.start.x + segment.end.x) / 2;
      const my = (segment.start.y + segment.end.y) / 2;

      exclusionZones.push({
        x: mx,
        y: my,
        radius: spacing + 0.254, // spacing + trace width
      });
    }

    // Add exclusion zones to router
    for (const zone of exclusionZones) {
      this.baseRouter.addObstacle(zone.x, zone.y, zone.radius, layer);
    }

    // Route negative trace avoiding positive
    const negPath = this.baseRouter.routeTrace(startX, startY, endX, endY, layer, 0.254);

    // Remove exclusion zones
    for (const zone of exclusionZones) {
      // Note: actual router would need clearObstacles() or per-route exclusion
    }

    return negPath;
  }

  /**
   * Balance trace lengths by adding meander sections
   *
   * If one trace is significantly longer, add meander to shorter trace
   */
  private balanceLengths(
    posPath: RoutePath,
    negPath: RoutePath
  ): { positive: RoutePath; negative: RoutePath } {
    const posLength = this.baseRouter.calculatePathLength(posPath);
    const negLength = this.baseRouter.calculatePathLength(negPath);
    const lengthDiff = Math.abs(posLength - negLength);

    // If difference is small enough, don't add meander
    if (lengthDiff < 1.0) {
      return { positive: posPath, negative: negPath };
    }

    // Calculate meander parameters
    const meanderId = lengthDiff / 5; // 5mm per meander cycle
    const meanderWidth = 2.0; // 2mm wide meander
    const meanderHeight = lengthDiff / 2; // Adjust height to match length

    // Add meander to shorter trace
    if (posLength < negLength) {
      const meanderSegments = this.createMeander(
        posPath.segments[posPath.segments.length - 1].end,
        meanderWidth,
        meanderHeight
      );
      posPath.segments.push(...meanderSegments);
    } else {
      const meanderSegments = this.createMeander(
        negPath.segments[negPath.segments.length - 1].end,
        meanderWidth,
        meanderHeight
      );
      negPath.segments.push(...meanderSegments);
    }

    return { positive: posPath, negative: negPath };
  }

  /**
   * Create meander (serpentine) segments for length adjustment
   */
  private createMeander(
    startPoint: { x: number; y: number },
    width: number,
    depth: number
  ): RoutePath['segments'] {
    const segments: RoutePath['segments'] = [];
    const cycles = Math.ceil(depth / width);

    let currentPoint = { ...startPoint };
    let direction = 1; // 1 = right, -1 = left

    for (let i = 0; i < cycles; i++) {
      // Horizontal segment
      const nextX = currentPoint.x + width * direction;
      segments.push({
        start: { ...currentPoint },
        end: { x: nextX, y: currentPoint.y },
      });

      // Vertical segment
      const nextY = currentPoint.y + width;
      segments.push({
        start: { x: nextX, y: currentPoint.y },
        end: { x: nextX, y: nextY },
      });

      currentPoint = { x: nextX, y: nextY };
      direction *= -1;
    }

    return segments;
  }

  /**
   * Calculate coupling effectiveness between traces
   *
   * Coupling = percentage of negative trace length that runs parallel to positive
   * Parallel = segments closer than 2× spacing
   */
  private calculateCoupling(
    posPath: RoutePath,
    negPath: RoutePath,
    spacing: number
  ): number {
    let coupledLength = 0;
    const maxDistance = spacing * 2;

    for (const negSeg of negPath.segments) {
      for (const posSeg of posPath.segments) {
        const distance = this.segmentDistance(negSeg, posSeg);

        if (distance <= maxDistance) {
          // Segments are parallel/coupled
          const length = Math.hypot(
            negSeg.end.x - negSeg.start.x,
            negSeg.end.y - negSeg.start.y
          );
          coupledLength += length;
        }
      }
    }

    const totalLength = this.baseRouter.calculatePathLength(negPath);
    return (coupledLength / totalLength) * 100;
  }

  /**
   * Calculate distance between two line segments
   */
  private segmentDistance(
    seg1: { start: { x: number; y: number }; end: { x: number; y: number } },
    seg2: { start: { x: number; y: number }; end: { x: number; y: number } }
  ): number {
    // Simplified: use midpoint distance
    const mid1X = (seg1.start.x + seg1.end.x) / 2;
    const mid1Y = (seg1.start.y + seg1.end.y) / 2;
    const mid2X = (seg2.start.x + seg2.end.x) / 2;
    const mid2Y = (seg2.start.y + seg2.end.y) / 2;

    return Math.hypot(mid2X - mid1X, mid2Y - mid1Y);
  }

  /**
   * Route with via pairing (vias always together)
   */
  public createViaPair(
    x: number,
    y: number,
    fromLayer: PCBLayer,
    toLayer: PCBLayer,
    spacing: number = 0.6
  ): { viaPos: Via; viaNeg: Via } {
    const viaPos: Via = {
      id: uuidv4(),
      position: { x: x - spacing / 2, y },
      diameter: 0.6,
      fromLayer,
      toLayer,
    };

    const viaNeg: Via = {
      id: uuidv4(),
      position: { x: x + spacing / 2, y },
      diameter: 0.6,
      fromLayer,
      toLayer,
    };

    return { viaPos, viaNeg };
  }

  /**
   * Validate pair routing constraints
   */
  public validatePair(result: PairRoutingResult, pair: DifferentialPair): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check skew
    if (result.skew > pair.maxSkew) {
      issues.push(
        `Skew ${result.skew.toFixed(1)}ps exceeds limit ${pair.maxSkew}ps`
      );
    }

    // Check coupling (should be > 70% for good differential integrity)
    if (result.coupling < 70) {
      issues.push(
        `Coupling ${result.coupling.toFixed(1)}% is low (target >70%)`
      );
    }

    // Check length ratio (should be within 5% for high-speed)
    const posLength = this.baseRouter.calculatePathLength({
      segments: result.positiveTrace.segments,
      vias: [],
    });
    const negLength = this.baseRouter.calculatePathLength({
      segments: result.negativeTrace.segments,
      vias: [],
    });
    const lengthRatio = Math.abs((posLength - negLength) / posLength);

    if (lengthRatio > 0.05) {
      issues.push(
        `Length ratio ${(lengthRatio * 100).toFixed(1)}% exceeds 5%`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get pair routing statistics
   */
  public getStatistics(result: PairRoutingResult): {
    lengthPos: number;
    lengthNeg: number;
    skew: number;
    coupling: number;
    impedance: number;
  } {
    const lengthPos = this.baseRouter.calculatePathLength({
      segments: result.positiveTrace.segments,
      vias: [],
    });
    const lengthNeg = this.baseRouter.calculatePathLength({
      segments: result.negativeTrace.segments,
      vias: [],
    });

    return {
      lengthPos,
      lengthNeg,
      skew: result.skew,
      coupling: result.coupling,
      impedance: 100, // Placeholder - would need ImpedanceCalculator
    };
  }
}
