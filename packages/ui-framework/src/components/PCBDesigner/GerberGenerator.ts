/**
 * Gerber Generator - Generate manufacturing files for PCB fabrication
 *
 * Gerber format (RS-274X) is the industry standard for PCB data.
 * Generates separate files for each layer:
 * - Signal layers (top, bottom, inner)
 * - Power/ground planes
 * - Silkscreen, solder mask, paste mask
 *
 * Reference: IPC-2581B, RS-274X specification
 */

import { PCBBoard, Trace, Via, PlacedComponent, PCBLayer, Pad, Zone } from './types';

export interface GerberFile {
  filename: string;
  layer: PCBLayer;
  content: string;
  units: 'mm' | 'inch';
}

export interface GerberConfig {
  units: 'mm' | 'inch';           // Default: mm
  coordinatePrecision: number;     // Decimal places (default: 4)
  apertureSize: number;            // mm (default: 0.254)
  format: 'RS274X';                // Gerber X format
  polarity: 'positive' | 'negative'; // Default: positive
}

export class GerberGenerator {
  private config: GerberConfig;

  constructor(config?: Partial<GerberConfig>) {
    this.config = {
      units: 'mm',
      coordinatePrecision: 4,
      apertureSize: 0.254,
      format: 'RS274X',
      polarity: 'positive',
      ...config,
    };
  }

  /**
   * Generate all Gerber files for board
   */
  public generateAllFiles(board: PCBBoard): GerberFile[] {
    const files: GerberFile[] = [];

    // Generate files for each layer
    for (const layer of board.layers) {
      const file = this.generateLayerFile(board, layer);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Generate Gerber file for specific layer
   */
  private generateLayerFile(board: PCBBoard, layer: PCBLayer): GerberFile | null {
    const lines: string[] = [];

    // Gerber header
    lines.push('%FSLAX45Y45*%');  // Format specification
    lines.push(`%MOIN*%`);         // Units (inch)
    lines.push('%ADD10C,0.254*%'); // Default aperture (circle, 10mil diameter)
    lines.push('D10*');            // Use aperture 10

    // Add layer comment
    lines.push(`G04 Layer: ${layer}*`);
    lines.push('G04 #@! TF.FileFunction,Copper,L1,Top*');

    // Filter traces and components for this layer
    const layerTraces = board.traces.filter(t => t.layer === layer);
    const layerComponents = this.filterComponentsForLayer(board.components, layer);

    // Draw traces
    for (const trace of layerTraces) {
      this.addTraceToGerber(trace, lines);
    }

    // Draw pad outlines
    for (const comp of layerComponents) {
      for (const pad of comp.footprint.pads) {
        if (pad.layers.includes(layer)) {
          this.addPadToGerber(pad, comp.position, lines);
        }
      }
    }

    // Draw zones (copper pour)
    for (const zone of board.zones) {
      if (zone.layer === layer) {
        this.addZoneToGerber(zone, lines);
      }
    }

    // Gerber footer
    lines.push('M02*'); // End of file

    return {
      filename: `${this.getLayerFilename(layer)}.gbr`,
      layer,
      content: lines.join('\n'),
      units: this.config.units,
    };
  }

  /**
   * Add trace to Gerber data
   */
  private addTraceToGerber(trace: Trace, lines: string[]): void {
    // Select aperture for trace width
    const apertureSize = this.mmToGerber(trace.width);
    lines.push(`%ADD11C,${apertureSize.toFixed(4)}*%`);
    lines.push('D11*');

    // Draw trace segments
    for (let i = 0; i < trace.segments.length; i++) {
      const segment = trace.segments[i];

      if (i === 0) {
        // Move to start of first segment
        const start = this.pointToGerber(segment.start);
        lines.push(`${start.x}${start.y}D02*`);
      }

      // Draw line to end of segment
      const end = this.pointToGerber(segment.end);
      lines.push(`${end.x}${end.y}D01*`);
    }
  }

  /**
   * Add pad to Gerber data
   */
  private addPadToGerber(pad: Pad, compPosition: { x: number; y: number }, lines: string[]): void {
    const x = compPosition.x + pad.position.x;
    const y = compPosition.y + pad.position.y;

    // Select aperture based on pad shape
    let apertureCode = '12';
    switch (pad.shape) {
      case 'CIRCLE':
        apertureCode = '12';
        const diameter = this.mmToGerber(pad.width);
        lines.push(`%ADD${apertureCode}C,${diameter.toFixed(4)}*%`);
        break;
      case 'RECTANGLE':
        apertureCode = '13';
        const width = this.mmToGerber(pad.width);
        const height = this.mmToGerber(pad.height);
        lines.push(`%ADD${apertureCode}R,${width.toFixed(4)}X${height.toFixed(4)}*%`);
        break;
      case 'OVAL':
        apertureCode = '14';
        const ovalW = this.mmToGerber(pad.width);
        const ovalH = this.mmToGerber(pad.height);
        lines.push(`%ADD${apertureCode}O,${ovalW.toFixed(4)}X${ovalH.toFixed(4)}*%`);
        break;
    }

    // Draw pad at position
    lines.push(`D${apertureCode}*`);
    const point = this.pointToGerber({ x, y });
    lines.push(`${point.x}${point.y}D02*`);
    lines.push(`${point.x}${point.y}D01*`);
  }

  /**
   * Add copper zone (pour area) to Gerber
   */
  private addZoneToGerber(zone: Zone, lines: string[]): void {
    // Zone as filled polygon
    lines.push('G36*'); // Begin region
    lines.push('G01*'); // Linear interpolation

    // Outline as rectangle (simplified)
    const corners = [
      { x: zone.bounds.minX, y: zone.bounds.minY },
      { x: zone.bounds.maxX, y: zone.bounds.minY },
      { x: zone.bounds.maxX, y: zone.bounds.maxY },
      { x: zone.bounds.minX, y: zone.bounds.maxY },
      { x: zone.bounds.minX, y: zone.bounds.minY },
    ];

    for (const corner of corners) {
      const point = this.pointToGerber(corner);
      lines.push(`${point.x}${point.y}D02*`);
    }

    lines.push('G37*'); // End region
  }

  /**
   * Convert millimeters to Gerber coordinates
   */
  private mmToGerber(mm: number): number {
    if (this.config.units === 'inch') {
      return mm / 25.4; // Convert mm to inches
    }
    return mm;
  }

  /**
   * Convert point to Gerber format
   */
  private pointToGerber(point: { x: number; y: number }): { x: string; y: string } {
    const xVal = this.mmToGerber(point.x);
    const yVal = this.mmToGerber(point.y);

    const xGerber = this.formatGerberCoord(xVal);
    const yGerber = this.formatGerberCoord(yVal);

    return { x: `X${xGerber}`, y: `Y${yGerber}` };
  }

  /**
   * Format coordinate for Gerber format
   */
  private formatGerberCoord(value: number): string {
    // Gerber coordinates: 2.4 format (2 integer, 4 decimal places)
    const scaled = Math.round(value * 10000);
    return scaled.toString().padStart(6, '0');
  }

  /**
   * Get standard Gerber filename for layer
   */
  private getLayerFilename(layer: PCBLayer): string {
    const filenames: Record<PCBLayer, string> = {
      [PCBLayer.SIGNAL_TOP]: 'F.Cu',        // Front copper
      [PCBLayer.SIGNAL_BOTTOM]: 'B.Cu',     // Back copper
      [PCBLayer.SIGNAL_INNER]: 'In1.Cu',    // Inner layer 1
      [PCBLayer.GROUND]: 'GND.Cu',          // Ground plane
      [PCBLayer.POWER]: 'PWR.Cu',           // Power plane
      [PCBLayer.SILK]: 'F.SilkS',           // Front silkscreen
      [PCBLayer.MASK]: 'F.Mask',            // Front solder mask
      [PCBLayer.PASTE]: 'F.Paste',          // Front paste mask
    };

    return filenames[layer] || `Layer_${layer}`;
  }

  /**
   * Filter components that have pads on specific layer
   */
  private filterComponentsForLayer(
    components: PlacedComponent[],
    layer: PCBLayer
  ): PlacedComponent[] {
    return components.filter(comp =>
      comp.footprint.pads.some(pad => pad.layers.includes(layer))
    );
  }

  /**
   * Generate summary of all Gerber files
   */
  public generateManifest(files: GerberFile[]): string {
    const lines = [
      'GERBER FILES MANIFEST',
      '═══════════════════════════════════════',
      `Format: ${this.config.format}`,
      `Units: ${this.config.units}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'FILES:',
    ];

    for (const file of files) {
      lines.push(`  • ${file.filename} (${file.layer})`);
    }

    lines.push('', 'NOTES:');
    lines.push('  • All coordinates in ' + this.config.units);
    lines.push('  • Apertures: Standard RS-274X');
    lines.push('  • Polarity: ' + this.config.polarity);

    return lines.join('\n');
  }
}
