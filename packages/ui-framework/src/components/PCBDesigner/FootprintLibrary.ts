/**
 * Footprint Library - Standard PCB footprints
 *
 * Includes common package types:
 * - SMD resistors/capacitors (0603, 0805, 1206)
 * - SOICs (8, 14, 16 pin)
 * - QFPs (44, 64, 100 pin)
 * - Through-hole (DIP8, DIP14, DIP16)
 * - Connectors (0.1" headers)
 */

import { Footprint, Pad, PadShape, PadConnectionType, PCBLayer } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a circular pad
 */
function createCircularPad(
  number: string,
  x: number,
  y: number,
  diameter: number,
  drill?: number
): Pad {
  return {
    id: uuidv4(),
    number,
    name: `Pin${number}`,
    shape: PadShape.CIRCLE,
    position: { x, y },
    width: diameter,
    height: diameter,
    rotation: 0,
    drill,
    layers: drill ? [PCBLayer.SIGNAL_TOP, PCBLayer.SIGNAL_BOTTOM] : [PCBLayer.SIGNAL_TOP],
    connectionType: drill ? PadConnectionType.THROUGH_HOLE : PadConnectionType.SMD,
  };
}

/**
 * Create a rectangular pad
 */
function createRectangularPad(
  number: string,
  x: number,
  y: number,
  width: number,
  height: number,
  drill?: number
): Pad {
  return {
    id: uuidv4(),
    number,
    name: `Pin${number}`,
    shape: PadShape.RECTANGLE,
    position: { x, y },
    width,
    height,
    rotation: 0,
    drill,
    layers: drill ? [PCBLayer.SIGNAL_TOP, PCBLayer.SIGNAL_BOTTOM] : [PCBLayer.SIGNAL_TOP],
    connectionType: drill ? PadConnectionType.THROUGH_HOLE : PadConnectionType.SMD,
  };
}

/**
 * SMD Resistor 0603
 */
export function createFootprintR0603(): Footprint {
  const w = 1.6;  // mm
  const h = 0.8;
  const py = h / 2;

  return {
    id: uuidv4(),
    name: '0603',
    description: 'SMD Resistor 0603 (1.6 x 0.8 mm)',
    package: 'R0603',
    pads: [
      createRectangularPad('1', -w / 4, 0, 0.9, 0.95),
      createRectangularPad('2', w / 4, 0, 0.9, 0.95),
    ],
    bounds: { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2, width: w, height: h },
  };
}

/**
 * SMD Resistor 0805
 */
export function createFootprintR0805(): Footprint {
  const w = 2.0;
  const h = 1.25;

  return {
    id: uuidv4(),
    name: '0805',
    description: 'SMD Resistor 0805 (2.0 x 1.25 mm)',
    package: 'R0805',
    pads: [
      createRectangularPad('1', -w / 4, 0, 1.0, 1.3),
      createRectangularPad('2', w / 4, 0, 1.0, 1.3),
    ],
    bounds: { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2, width: w, height: h },
  };
}

/**
 * SMD Capacitor 0603
 */
export function createFootprintC0603(): Footprint {
  return createFootprintR0603();
}

/**
 * SMD Capacitor 1206
 */
export function createFootprintC1206(): Footprint {
  const w = 3.2;
  const h = 1.6;

  return {
    id: uuidv4(),
    name: '1206',
    description: 'SMD Capacitor 1206 (3.2 x 1.6 mm)',
    package: 'C1206',
    pads: [
      createRectangularPad('1', -w / 4, 0, 1.2, 1.7),
      createRectangularPad('2', w / 4, 0, 1.2, 1.7),
    ],
    bounds: { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2, width: w, height: h },
  };
}

/**
 * SOIC-8 (Small Outline 8-pin IC)
 */
export function createFootprintSOIC8(): Footprint {
  const w = 3.9;
  const h = 4.9;
  const py = 2.0;  // Pitch

  return {
    id: uuidv4(),
    name: 'SOIC-8',
    description: 'SOIC 8-pin (3.9 x 4.9 mm)',
    package: 'SOIC8',
    pads: [
      createRectangularPad('1', -w / 2, -py, 1.5, 0.6),
      createRectangularPad('2', -w / 2, -py / 2, 1.5, 0.6),
      createRectangularPad('3', -w / 2, py / 2, 1.5, 0.6),
      createRectangularPad('4', -w / 2, py, 1.5, 0.6),
      createRectangularPad('5', w / 2, py, 1.5, 0.6),
      createRectangularPad('6', w / 2, py / 2, 1.5, 0.6),
      createRectangularPad('7', w / 2, -py / 2, 1.5, 0.6),
      createRectangularPad('8', w / 2, -py, 1.5, 0.6),
    ],
    bounds: { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2, width: w, height: h },
  };
}

/**
 * DIP-8 (Dual In-line 8-pin through-hole)
 */
export function createFootprintDIP8(): Footprint {
  const w = 7.62;   // 300 mil
  const h = 9.53;   // 375 mil
  const pitch = 2.54; // 100 mil
  const drillSize = 0.89; // 35 mil

  const pads: Pad[] = [];
  for (let i = 1; i <= 4; i++) {
    pads.push(createCircularPad(i.toString(), -w / 2, (i - 2.5) * pitch, 1.5, drillSize));
  }
  for (let i = 5; i <= 8; i++) {
    pads.push(createCircularPad(i.toString(), w / 2, (8.5 - i) * pitch, 1.5, drillSize));
  }

  return {
    id: uuidv4(),
    name: 'DIP-8',
    description: 'Through-hole DIP 8-pin (7.62 x 9.53 mm)',
    package: 'DIP8',
    pads,
    bounds: { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2, width: w, height: h },
  };
}

/**
 * 0.1" Header 2x1
 */
export function createFootprintHeader2x1(): Footprint {
  const spacing = 2.54; // 100 mil

  return {
    id: uuidv4(),
    name: 'Header_2x1',
    description: '0.1" Header 2x1 pin',
    package: 'HEADER2X1',
    pads: [
      createCircularPad('1', 0, 0, 1.5, 0.89),
      createCircularPad('2', spacing, 0, 1.5, 0.89),
    ],
    bounds: {
      minX: -1,
      maxX: spacing + 1,
      minY: -1,
      maxY: 1,
      width: spacing + 2,
      height: 2,
    },
  };
}

/**
 * USB Type-C Connector
 */
export function createFootprintUSBC(): Footprint {
  // Simplified USB-C footprint
  const w = 9.0;
  const h = 7.5;

  return {
    id: uuidv4(),
    name: 'USB_C',
    description: 'USB Type-C Connector',
    package: 'USBC',
    pads: [
      // Main pins
      createRectangularPad('1', -3, -2, 0.5, 1.0),
      createRectangularPad('2', -2, -2, 0.5, 1.0),
      createRectangularPad('3', -1, -2, 0.5, 1.0),
      createRectangularPad('4', 0, -2, 0.5, 1.0),
      createRectangularPad('5', 1, -2, 0.5, 1.0),
      createRectangularPad('6', 2, -2, 0.5, 1.0),
      createRectangularPad('7', 3, -2, 0.5, 1.0),
      // Shield pads
      createRectangularPad('S1', -4.5, 0, 1.0, 3.0),
      createRectangularPad('S2', 4.5, 0, 1.0, 3.0),
    ],
    bounds: { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2, width: w, height: h },
  };
}

/**
 * Footprint Library Manager
 */
export class FootprintLibrary {
  private footprints: Map<string, Footprint> = new Map();

  constructor() {
    this.registerStandardFootprints();
  }

  /**
   * Register standard footprints
   */
  private registerStandardFootprints(): void {
    const standards = [
      // Resistors
      { key: 'R0603', fn: createFootprintR0603 },
      { key: 'R0805', fn: createFootprintR0805 },

      // Capacitors
      { key: 'C0603', fn: createFootprintC0603 },
      { key: 'C1206', fn: createFootprintC1206 },

      // ICs
      { key: 'SOIC-8', fn: createFootprintSOIC8 },
      { key: 'DIP-8', fn: createFootprintDIP8 },

      // Connectors
      { key: 'Header_2x1', fn: createFootprintHeader2x1 },
      { key: 'USB_C', fn: createFootprintUSBC },
    ];

    for (const { key, fn } of standards) {
      const fp = fn();
      this.footprints.set(key, fp);
    }
  }

  /**
   * Get footprint by name
   */
  getFootprint(name: string): Footprint | undefined {
    return this.footprints.get(name);
  }

  /**
   * Get all footprints
   */
  getAllFootprints(): Footprint[] {
    return Array.from(this.footprints.values());
  }

  /**
   * Register custom footprint
   */
  registerFootprint(footprint: Footprint): void {
    this.footprints.set(footprint.name, footprint);
  }

  /**
   * Search footprints
   */
  search(query: string): Footprint[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.footprints.values()).filter(fp =>
      fp.name.toLowerCase().includes(lowerQuery) ||
      fp.description.toLowerCase().includes(lowerQuery) ||
      fp.package.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get footprints by category
   */
  getByCategory(category: 'resistor' | 'capacitor' | 'ic' | 'connector' | 'other'): Footprint[] {
    const categoryMap: Record<string, (name: string) => boolean> = {
      resistor: name => /^R/.test(name),
      capacitor: name => /^C/.test(name),
      ic: name => /^(SOIC|DIP|QFP|BGA)/.test(name),
      connector: name => /^(Header|USB|CONN)/.test(name),
      other: () => true,
    };

    const predicate = categoryMap[category];
    return Array.from(this.footprints.values()).filter(fp =>
      predicate(fp.name)
    );
  }
}

// Export singleton
export const footprintLibrary = new FootprintLibrary();
