/**
 * Drill File Generator - Generate NC (Excellon) drill files
 *
 * Excellon format is the standard for drill/routing information.
 * Generates drill data with:
 * - Tool definitions (sizes)
 * - Drill positions
 * - Plated vs non-plated holes
 *
 * Reference: Excellon CNC format specification
 */

import { PCBBoard, Via, PlacedComponent, Pad } from './types';

export interface DrillTool {
  code: string;        // T01, T02, etc.
  diameter: number;    // mm
  count: number;       // Number of holes using this tool
  plated: boolean;
}

export interface DrillFile {
  filename: string;
  content: string;
  tools: DrillTool[];
  holeCount: number;
}

export interface DrillConfig {
  units: 'mm' | 'inch';
  leadingZeros: boolean;           // Default: false
  trailingZeros: boolean;          // Default: true
  format: '2.4' | '2.5' | '3.3';   // Coordinate format
  drillTolerance: number;          // mm (default: ±0.1mm)
}

export class DrillFileGenerator {
  private config: DrillConfig;
  private tools: Map<number, DrillTool> = new Map();
  private toolCounter: number = 1;

  constructor(config?: Partial<DrillConfig>) {
    this.config = {
      units: 'mm',
      leadingZeros: false,
      trailingZeros: true,
      format: '2.4',
      drillTolerance: 0.1,
      ...config,
    };
  }

  /**
   * Generate Excellon drill file
   */
  public generateDrillFile(board: PCBBoard): DrillFile {
    const lines: string[] = [];
    const drills: Array<{ x: number; y: number; diameter: number; plated: boolean }> = [];

    // Collect all drill holes
    // Vias
    for (const via of board.vias) {
      drills.push({
        x: via.position.x,
        y: via.position.y,
        diameter: via.diameter - 0.3, // Drill size (subtract pad size)
        plated: true,
      });
    }

    // Through-hole pads
    for (const comp of board.components) {
      for (const pad of comp.footprint.pads) {
        if (pad.drill) {
          drills.push({
            x: comp.position.x + pad.position.x,
            y: comp.position.y + pad.position.y,
            diameter: pad.drill,
            plated: true,
          });
        }
      }
    }

    // Group drills by size (tool optimization)
    const toolMap = this.groupDrillsBySize(drills);

    // Write header
    lines.push('M48');            // Excellon header
    lines.push('INCH');           // Unit specification
    lines.push('ZS');             // Zero suppression (trailing)
    lines.push('.;,.0000');        // Format specification

    // Write tool definitions
    for (const [size, holes] of toolMap.entries()) {
      const toolCode = `T${this.padToolNumber(this.toolCounter)}`;
      lines.push(`${toolCode}${this.formatDiameter(size)}`);

      this.tools.set(this.toolCounter, {
        code: toolCode,
        diameter: size,
        count: holes.length,
        plated: true,
      });

      this.toolCounter++;
    }

    lines.push('%');              // Tool list end

    // Write drill positions
    this.toolCounter = 1;
    for (const [size, holes] of toolMap.entries()) {
      const toolCode = `T${this.padToolNumber(this.toolCounter)}`;
      lines.push(toolCode);

      for (const hole of holes) {
        const x = this.formatCoordinate(hole.x);
        const y = this.formatCoordinate(hole.y);
        lines.push(`X${x}Y${y}`);
      }

      this.toolCounter++;
    }

    // Write footer
    lines.push('M30');            // End of program
    lines.push('%');              // EOF marker

    return {
      filename: 'drill.xln',
      content: lines.join('\n'),
      tools: Array.from(this.tools.values()),
      holeCount: drills.length,
    };
  }

  /**
   * Generate drill report/summary
   */
  public generateDrillReport(file: DrillFile): string {
    const lines = [
      'DRILL FILE SUMMARY',
      '═══════════════════════════════════════',
      `Total Holes: ${file.holeCount}`,
      `Units: ${this.config.units}`,
      '',
      'DRILL TOOLS:',
    ];

    for (const tool of file.tools) {
      lines.push(`  ${tool.code}: Ø${tool.diameter.toFixed(3)}mm - ${tool.count} holes`);
    }

    // Calculate plating area
    const platingArea = file.tools.reduce(
      (sum, tool) => sum + Math.PI * Math.pow(tool.diameter / 2, 2) * tool.count,
      0
    );

    lines.push('', 'STATISTICS:');
    lines.push(`  Total Plating Area: ${platingArea.toFixed(2)} mm²`);
    lines.push(`  Copper Deposited: ~${(platingArea * 0.018).toFixed(2)}g (typical)`);
    lines.push(`  Estimated Drill Time: ${Math.ceil(file.holeCount / 500)} min`);

    return lines.join('\n');
  }

  /**
   * Group drills by diameter
   */
  private groupDrillsBySize(
    drills: Array<{ x: number; y: number; diameter: number; plated: boolean }>
  ): Map<number, typeof drills> {
    const grouped = new Map<number, typeof drills>();
    const tolerance = 0.01; // 10 microns

    for (const drill of drills) {
      let found = false;

      // Check if size already exists
      for (const [size] of grouped.entries()) {
        if (Math.abs(size - drill.diameter) < tolerance) {
          grouped.get(size)!.push(drill);
          found = true;
          break;
        }
      }

      // Create new tool if size not found
      if (!found) {
        grouped.set(drill.diameter, [drill]);
      }
    }

    return grouped;
  }

  /**
   * Format drill diameter for tool definition
   */
  private formatDiameter(diameter: number): string {
    if (this.config.units === 'inch') {
      const inches = diameter / 25.4;
      return ` ${inches.toFixed(4)}`;
    }
    return ` ${diameter.toFixed(3)}`;
  }

  /**
   * Format coordinate
   */
  private formatCoordinate(value: number): string {
    if (this.config.units === 'inch') {
      const inches = value / 25.4;
      return this.formatCoordinateValue(inches);
    }
    return this.formatCoordinateValue(value);
  }

  /**
   * Format coordinate value with specified precision
   */
  private formatCoordinateValue(value: number): string {
    const [integer, decimal] = value.toFixed(4).split('.');
    const intPart = integer.padStart(2, '0');
    const decPart = (decimal || '0000').padEnd(4, '0').slice(0, 4);

    return intPart + decPart;
  }

  /**
   * Pad tool number to 2 digits
   */
  private padToolNumber(num: number): string {
    return num.toString().padStart(2, '0');
  }

  /**
   * Generate consolidated drill file (all holes in one file)
   */
  public generateConsolidatedDrill(board: PCBBoard): DrillFile {
    return this.generateDrillFile(board);
  }

  /**
   * Generate separate files for plated and non-plated holes
   */
  public generateSeparateDrills(board: PCBBoard): { plated: DrillFile; nonPlated: DrillFile } {
    // Simplified: in production, would separate plated vs non-plated
    const platedFile = this.generateDrillFile(board);

    return {
      plated: platedFile,
      nonPlated: {
        filename: 'drill_npth.xln',
        content: 'M48\nINCH\nZS\n%\nM30\n%',
        tools: [],
        holeCount: 0,
      },
    };
  }
}
