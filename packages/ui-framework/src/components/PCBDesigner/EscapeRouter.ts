/**
 * Escape Router - Route signals from dense connectors (BGA, QFP, connector arrays)
 *
 * Challenges:
 * - Many pins in small area (BGA: 0.8mm pitch for 361 balls!)
 * - Traces cross other pins during escape
 * - Via placement critical (no shorts to power/ground)
 * - Layer transitions needed for escape
 *
 * Features:
 * - Automatic escape via placement
 * - Priority-based routing (power/ground first)
 * - Layer-by-layer escape sequencing
 * - Fanout area calculation
 */

import { PlacedComponent, Pad, PCBLayer, Via, Trace } from './types';
import { v4 as uuidv4 } from 'uuid';

export enum PinPriority {
  POWER = 0,     // VCC/VDD - highest priority
  GROUND = 1,    // GND - high priority
  SIGNAL = 2,    // Signal traces - normal priority
  NC = 3,        // No connect - lowest priority
}

export interface EscapePath {
  padId: string;
  vias: Via[];
  traces: Trace[];
  layer: PCBLayer;
  priority: PinPriority;
  escaped: boolean;
}

export interface EscapeRoute {
  componentId: string;
  fanoutArea: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  estimatedViaCount: number;
  estimatedTraceLength: number;
  paths: EscapePath[];
  layerStrategy: 'top_down' | 'via_stitch' | 'dogbone';
}

export class EscapeRouter {
  /**
   * Calculate escape routing strategy for component
   */
  public calculateEscapeRoute(component: PlacedComponent): EscapeRoute {
    const footprint = component.footprint;
    const bounds = footprint.bounds;

    // Calculate fanout area (buffer around component for vias)
    const fanoutBuffer = 2.0; // mm buffer around component
    const fanoutArea = {
      minX: component.position.x + bounds.minX - fanoutBuffer,
      maxX: component.position.x + bounds.maxX + fanoutBuffer,
      minY: component.position.y + bounds.minY - fanoutBuffer,
      maxY: component.position.y + bounds.maxY + fanoutBuffer,
      width: bounds.width + fanoutBuffer * 2,
      height: bounds.height + fanoutBuffer * 2,
    };

    // Assign priorities to pads
    const paths: EscapePath[] = footprint.pads.map(pad => ({
      padId: pad.id,
      vias: [],
      traces: [],
      layer: PCBLayer.SIGNAL_TOP,
      priority: this.getPadPriority(pad),
      escaped: false,
    }));

    // Sort by priority (power first, then ground, then signals)
    paths.sort((a, b) => a.priority - b.priority);

    // Estimate via and trace requirements
    const estimatedViaCount = Math.ceil(footprint.pads.length * 1.2);
    const estimatedTraceLength = footprint.pads.length * 5; // Rough estimate

    // Determine layer strategy based on component density
    const padDensity = footprint.pads.length / bounds.width / bounds.height;
    const layerStrategy = this.selectLayerStrategy(padDensity);

    return {
      componentId: component.id,
      fanoutArea,
      estimatedViaCount,
      estimatedTraceLength,
      paths,
      layerStrategy,
    };
  }

  /**
   * Determine pin priority based on name/function
   */
  private getPadPriority(pad: Pad): PinPriority {
    const name = pad.name.toUpperCase();

    if (name.includes('VCC') || name.includes('VDD') || name.includes('VBB')) {
      return PinPriority.POWER;
    } else if (
      name.includes('GND') ||
      name.includes('VSS') ||
      name.includes('VREF')
    ) {
      return PinPriority.GROUND;
    } else if (name.includes('NC') || name.includes('UNUSED')) {
      return PinPriority.NC;
    } else {
      return PinPriority.SIGNAL;
    }
  }

  /**
   * Select routing strategy based on pad density
   */
  private selectLayerStrategy(
    padDensity: number
  ): 'top_down' | 'via_stitch' | 'dogbone' {
    if (padDensity > 100) {
      // Very dense (BGA): Use dogbone via placement
      return 'dogbone';
    } else if (padDensity > 50) {
      // Dense (0.5mm pitch): Via stitching strategy
      return 'via_stitch';
    } else {
      // Less dense: Simple top-down routing
      return 'top_down';
    }
  }

  /**
   * Plan via placement for escape routing
   *
   * Dogbone style: Via placed just outside pad, connected with short trace
   */
  public planViaPlacement(
    route: EscapeRoute
  ): Via[] {
    const vias: Via[] = [];
    const viaSpacing = 0.6; // mm (minimum via-to-via spacing)
    const viaDiameter = 0.6; // mm
    const traceWidth = 0.254; // mm

    if (route.layerStrategy === 'dogbone') {
      // Place via just outside each pad
      for (const path of route.paths.filter(p => p.priority < PinPriority.NC)) {
        const padId = path.padId;

        // Find pad in component
        // This is simplified - would need actual pad position lookup
        const via: Via = {
          id: uuidv4(),
          position: {
            x: route.fanoutArea.minX + viaSpacing * vias.length,
            y: route.fanoutArea.maxY + 0.5,
          },
          diameter: viaDiameter,
          fromLayer: PCBLayer.SIGNAL_TOP,
          toLayer: PCBLayer.SIGNAL_BOTTOM,
        };

        vias.push(via);
        path.vias.push(via);
      }
    } else if (route.layerStrategy === 'via_stitch') {
      // Place vias in regular grid pattern around fanout area
      const gridSpacing = 1.5; // mm

      for (let x = route.fanoutArea.minX; x <= route.fanoutArea.maxX; x += gridSpacing) {
        for (let y = route.fanoutArea.minY; y <= route.fanoutArea.maxY; y += gridSpacing) {
          // Skip vias too close to component
          const distToComponent =
            Math.max(
              0,
              Math.max(
                route.fanoutArea.minX - x,
                x - route.fanoutArea.maxX
              )
            ) +
            Math.max(
              0,
              Math.max(
                route.fanoutArea.minY - y,
                y - route.fanoutArea.maxY
              )
            );

          if (distToComponent > 0.5) {
            const via: Via = {
              id: uuidv4(),
              position: { x, y },
              diameter: viaDiameter,
              fromLayer: PCBLayer.SIGNAL_TOP,
              toLayer: PCBLayer.SIGNAL_BOTTOM,
            };

            vias.push(via);
          }
        }
      }
    }

    return vias;
  }

  /**
   * Plan layer assignment for signal distribution
   */
  public planLayerAssignment(route: EscapeRoute): Map<number, PCBLayer> {
    const assignment = new Map<number, PCBLayer>();

    const layers = [
      PCBLayer.SIGNAL_TOP,
      PCBLayer.SIGNAL_BOTTOM,
      PCBLayer.SIGNAL_INNER,
    ];

    // Assign layers in round-robin fashion
    route.paths.forEach((path, index) => {
      const layerIndex = index % layers.length;
      assignment.set(index, layers[layerIndex]);
    });

    return assignment;
  }

  /**
   * Estimate routable area (area available for trace escape)
   */
  public estimateRoutableArea(route: EscapeRoute): number {
    // Area of fanout region minus component area
    const fanoutAreaSize = route.fanoutArea.width * route.fanoutArea.height;

    // Rough estimate: 70% of fanout area is routable
    return fanoutAreaSize * 0.7;
  }

  /**
   * Check for escape routing feasibility
   */
  public checkFeasibility(route: EscapeRoute): {
    feasible: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check if fanout area is large enough
    const minFanoutArea = route.estimatedViaCount * 0.5; // mm²
    const actualFanoutArea = this.estimateRoutableArea(route);

    if (actualFanoutArea < minFanoutArea) {
      warnings.push(
        `Fanout area ${actualFanoutArea.toFixed(1)}mm² may be too small for ${route.estimatedViaCount} vias`
      );
    }

    // Check for high pad density
    const padCount = route.paths.length;
    const density = padCount / (route.fanoutArea.width * route.fanoutArea.height);

    if (density > 100) {
      warnings.push(
        `Very high pad density (${density.toFixed(0)}/mm²) - BGA-class routing required`
      );
    } else if (density > 50) {
      warnings.push(
        `High pad density (${density.toFixed(0)}/mm²) - may require advanced techniques`
      );
    }

    // Check layer availability
    if (route.paths.length > 3) {
      warnings.push(
        `${route.paths.length} signals may require more than 2 signal layers`
      );
    }

    return {
      feasible: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Generate escape routing report
   */
  public generateEscapeReport(route: EscapeRoute): string {
    const lines: string[] = [
      '═══════════════════════════════════════',
      'ESCAPE ROUTING REPORT',
      '═══════════════════════════════════════',
      '',
      `Component: ${route.componentId}`,
      `Fanout Area: ${route.fanoutArea.width.toFixed(2)} × ${route.fanoutArea.height.toFixed(2)} mm`,
      `Layer Strategy: ${route.layerStrategy}`,
      '',
      'PAD SUMMARY:',
      `  Total Pads: ${route.paths.length}`,
      `  Power Pins: ${route.paths.filter(p => p.priority === PinPriority.POWER).length}`,
      `  Ground Pins: ${route.paths.filter(p => p.priority === PinPriority.GROUND).length}`,
      `  Signal Pins: ${route.paths.filter(p => p.priority === PinPriority.SIGNAL).length}`,
      `  No-Connect: ${route.paths.filter(p => p.priority === PinPriority.NC).length}`,
      '',
      'ROUTING ESTIMATE:',
      `  Via Count: ${route.estimatedViaCount}`,
      `  Trace Length: ${route.estimatedTraceLength.toFixed(1)} mm`,
      '',
    ];

    const { feasible, warnings } = this.checkFeasibility(route);

    if (feasible) {
      lines.push('✓ ROUTING FEASIBLE');
    } else {
      lines.push('✗ ROUTING CHALLENGES:');
      warnings.forEach(w => lines.push(`  ⚠ ${w}`));
    }

    lines.push('', '═══════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Suggest escape area expansion
   */
  public suggestFanoutExpansion(route: EscapeRoute): {
    minExpansion: number;
    recommendedExpansion: number;
  } {
    const { feasible, warnings } = this.checkFeasibility(route);

    if (feasible) {
      return { minExpansion: 0, recommendedExpansion: 0 };
    }

    // Calculate minimum expansion needed
    const routableArea = this.estimateRoutableArea(route);
    const minRequired = route.estimatedViaCount * 0.5;
    const minExpansion = Math.max(0, (minRequired - routableArea) / 100);

    return {
      minExpansion,
      recommendedExpansion: minExpansion * 1.5, // 50% larger for safety
    };
  }
}
