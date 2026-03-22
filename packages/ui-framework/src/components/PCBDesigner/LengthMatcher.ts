/**
 * Length Matcher - Equalize trace lengths for timing synchronization
 *
 * Used for:
 * - Differential pair matching (skew reduction)
 * - Bus routing (DDR, PCIe, etc.)
 * - Clock distribution (CK/CK#)
 * - Synchronous parallel buses
 *
 * Techniques:
 * - Meander/serpentine traces
 * - Extra loop segments
 * - Layer transitions with matched via lengths
 */

import { Trace } from './types';

export interface LengthGroup {
  netName: string;
  length: number;           // mm
  targetLength: number;     // mm (desired final length)
  trace: Trace;
  meander?: MeanderSpec;
}

export interface MeanderSpec {
  width: number;            // mm (serpentine width)
  depth: number;            // mm (serpentine depth per cycle)
  startSegmentIndex: number; // Which segment to add meander
  cycles: number;           // Number of meander cycles
}

export interface MatchingResult {
  targetLength: number;     // mm (all nets matched to this length)
  groups: LengthGroup[];
  matchedSuccessfully: boolean;
  maxDeviation: number;     // mm (largest deviation from target)
  recommendations: string[];
}

export class LengthMatcher {
  private tolerance: number = 0.5; // mm (typical tolerance: ±0.5mm = ±13ps for FR-4)

  constructor(tolerance: number = 0.5) {
    this.tolerance = tolerance;
  }

  /**
   * Calculate current lengths
   */
  public calculateLengths(traces: Trace[]): { net: string; length: number }[] {
    return traces.map(trace => ({
      net: trace.netName,
      length: this.calculateTraceLength(trace),
    }));
  }

  /**
   * Calculate trace length from segments
   */
  private calculateTraceLength(trace: Trace): number {
    let length = 0;

    for (const segment of trace.segments) {
      length += Math.hypot(
        segment.end.x - segment.start.x,
        segment.end.y - segment.start.y
      );
    }

    return length;
  }

  /**
   * Match group of traces to common length
   */
  public matchGroup(traces: Trace[], targetLength?: number): MatchingResult {
    // Calculate current lengths
    const lengths = this.calculateLengths(traces);

    // Determine target length
    const maxLength = Math.max(...lengths.map(l => l.length));
    const finalTarget = targetLength || maxLength;

    // Create length groups
    const groups: LengthGroup[] = lengths.map((l, i) => ({
      netName: l.net,
      length: l.length,
      targetLength: finalTarget,
      trace: traces[i],
    }));

    // Calculate meander requirements
    const recommendations: string[] = [];
    let maxDeviation = 0;
    let allMatched = true;

    for (const group of groups) {
      const delta = finalTarget - group.length;
      maxDeviation = Math.max(maxDeviation, Math.abs(delta));

      if (Math.abs(delta) > this.tolerance) {
        allMatched = false;

        if (delta > 0) {
          // Need to add length via meander
          const meander = this.generateMeander(delta, group.trace);
          group.meander = meander;
          recommendations.push(
            `${group.netName}: Add ${delta.toFixed(2)}mm via meander (${meander.cycles} cycles)`
          );
        } else {
          recommendations.push(
            `${group.netName}: ${Math.abs(delta).toFixed(2)}mm too long (reduce meander or re-route)`
          );
        }
      }
    }

    return {
      targetLength: finalTarget,
      groups,
      matchedSuccessfully: allMatched,
      maxDeviation,
      recommendations,
    };
  }

  /**
   * Generate meander specification for adding length
   */
  private generateMeander(
    lengthToAdd: number,
    trace: Trace
  ): MeanderSpec {
    // Meander geometry: serpentine pattern
    const width = 2.0; // mm (standard 2mm wide serpentine)
    const depth = width; // Make square serpentines
    const cycleLength = width * 2 + depth; // Distance per cycle

    const cycles = Math.ceil(lengthToAdd / cycleLength);

    return {
      width,
      depth,
      startSegmentIndex: trace.segments.length - 1,
      cycles,
    };
  }

  /**
   * Apply meander to trace
   */
  public applyMeander(
    trace: Trace,
    meander: MeanderSpec
  ): Trace {
    if (!meander || meander.cycles === 0) {
      return trace;
    }

    // Start from end of trace
    const lastSegment = trace.segments[trace.segments.length - 1];
    let currentX = lastSegment.end.x;
    let currentY = lastSegment.end.y;

    const newSegments: typeof trace.segments = [...trace.segments];
    let direction = 1; // 1 = right, -1 = left

    // Generate meander segments
    for (let i = 0; i < meander.cycles; i++) {
      // Horizontal segment
      const nextX = currentX + meander.width * direction;
      newSegments.push({
        start: { x: currentX, y: currentY },
        end: { x: nextX, y: currentY },
      });

      // Vertical segment
      const nextY = currentY + meander.depth;
      newSegments.push({
        start: { x: nextX, y: currentY },
        end: { x: nextX, y: nextY },
      });

      currentX = nextX;
      currentY = nextY;
      direction *= -1;
    }

    // Return to endpoint horizontally if needed
    if (direction === -1) {
      // Need to go right to reach original endpoint
      newSegments.push({
        start: { x: currentX, y: currentY },
        end: { x: lastSegment.end.x, y: currentY },
      });
    }

    return {
      ...trace,
      segments: newSegments,
    };
  }

  /**
   * Match bus traces (multiple related signals)
   *
   * Example: DDR data bus D[0:7] should all be matched length
   */
  public matchBus(
    traces: Trace[],
    busName: string,
    tolerance?: number
  ): MatchingResult {
    if (tolerance) {
      this.tolerance = tolerance;
    }

    return this.matchGroup(traces);
  }

  /**
   * Delay-based length matching
   *
   * Instead of matching lengths, match propagation delays
   * Accounts for different dielectric constants on different layers
   */
  public matchDelays(
    traces: Array<{
      net: string;
      trace: Trace;
      layer: string;
      delayPerMm: number; // ps/mm
    }>
  ): MatchingResult {
    // Calculate delays instead of physical lengths
    const delays = traces.map(t => ({
      net: t.net,
      delay: this.calculateTraceLength(t.trace) * t.delayPerMm,
      length: this.calculateTraceLength(t.trace),
    }));

    // Find max delay
    const maxDelay = Math.max(...delays.map(d => d.delay));

    // Convert back to lengths for different layers
    const groups: LengthGroup[] = traces.map((t, i) => {
      const targetDelay = maxDelay;
      const targetLength = targetDelay / t.delayPerMm;
      const currentLength = this.calculateTraceLength(t.trace);

      return {
        netName: t.net,
        length: currentLength,
        targetLength,
        trace: t.trace,
      };
    });

    return {
      targetLength: maxDelay,
      groups,
      matchedSuccessfully: true,
      maxDeviation: 0,
      recommendations: [],
    };
  }

  /**
   * Check if traces are already matched
   */
  public checkMatch(traces: Trace[]): {
    matched: boolean;
    deviation: number;
    details: Array<{ net: string; length: number }>;
  } {
    const lengths = this.calculateLengths(traces);
    const maxLength = Math.max(...lengths.map(l => l.length));
    const minLength = Math.min(...lengths.map(l => l.length));
    const deviation = maxLength - minLength;

    return {
      matched: deviation <= this.tolerance,
      deviation,
      details: lengths,
    };
  }

  /**
   * Estimate meander length
   */
  public estimateMeanderLength(meander: MeanderSpec): number {
    // Meander consists of horizontal and vertical segments
    const horizontalPerCycle = meander.width * 2;
    const verticalPerCycle = meander.depth;
    const lengthPerCycle = horizontalPerCycle + verticalPerCycle;

    return lengthPerCycle * meander.cycles;
  }

  /**
   * Check for meander spacing violations (DRC)
   */
  public checkMeanderSpacing(
    meander: MeanderSpec,
    minSpacing: number = 0.254 // mm
  ): { valid: boolean; issue?: string } {
    // Meander segments should be spaced at least minSpacing apart
    if (meander.width / 2 < minSpacing) {
      return {
        valid: false,
        issue: `Meander width ${meander.width}mm is too narrow for ${minSpacing}mm spacing`,
      };
    }

    return { valid: true };
  }

  /**
   * Optimize meander placement (minimize disruption)
   */
  public optimizeMeanderPlacement(
    trace: Trace,
    availableArea: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }
  ): { bestLocation: { x: number; y: number }; score: number } | null {
    if (trace.segments.length === 0) return null;

    // Find endpoint
    const endpoint = trace.segments[trace.segments.length - 1].end;

    // Check if endpoint has room for meander
    const distToRightEdge = availableArea.maxX - endpoint.x;
    const distToLeftEdge = endpoint.x - availableArea.minX;
    const distToBottomEdge = availableArea.maxY - endpoint.y;

    // Prefer right side, then left, then bottom
    let bestLocation = { ...endpoint };
    let score = 0;

    if (distToRightEdge > 3) {
      bestLocation = { x: endpoint.x + 0.5, y: endpoint.y };
      score = distToRightEdge;
    } else if (distToLeftEdge > 3) {
      bestLocation = { x: endpoint.x - 0.5, y: endpoint.y };
      score = distToLeftEdge;
    } else if (distToBottomEdge > 3) {
      bestLocation = { x: endpoint.x, y: endpoint.y + 0.5 };
      score = distToBottomEdge;
    } else {
      return null; // No room for meander
    }

    return { bestLocation, score };
  }

  /**
   * Generate length-matching report
   */
  public generateReport(result: MatchingResult): string {
    const lines: string[] = [
      '═══════════════════════════════════════',
      'LENGTH MATCHING REPORT',
      '═══════════════════════════════════════',
      '',
      `Target Length: ${result.targetLength.toFixed(2)} mm`,
      `Maximum Deviation: ${result.maxDeviation.toFixed(2)} mm`,
      `Match Status: ${result.matchedSuccessfully ? '✓ MATCHED' : '✗ NOT MATCHED'}`,
      `Tolerance: ±${this.tolerance.toFixed(2)} mm`,
      '',
      'TRACE DETAILS:',
    ];

    for (const group of result.groups) {
      const delta = group.targetLength - group.length;
      const status = Math.abs(delta) <= this.tolerance ? '✓' : '✗';
      const meanderInfo = group.meander
        ? ` [Meander: ${group.meander.cycles} cycles, +${this.estimateMeanderLength(group.meander).toFixed(2)}mm]`
        : '';

      lines.push(
        `  ${status} ${group.netName.padEnd(15)} ${group.length.toFixed(2)}mm → ${group.targetLength.toFixed(2)}mm (Δ${delta.toFixed(2)}mm)${meanderInfo}`
      );
    }

    if (result.recommendations.length > 0) {
      lines.push('', 'RECOMMENDATIONS:');
      result.recommendations.forEach(rec => {
        lines.push(`  • ${rec}`);
      });
    }

    lines.push('', '═══════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Set tolerance
   */
  public setTolerance(tolerance: number): void {
    this.tolerance = tolerance;
  }

  /**
   * Get tolerance
   */
  public getTolerance(): number {
    return this.tolerance;
  }
}
