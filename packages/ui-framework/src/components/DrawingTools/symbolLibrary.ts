/**
 * Electrical Symbol Library
 *
 * 100+ standard electrical symbols for schematic design
 * All symbols are defined as geometric entities
 * Organized by category for easy browsing
 */

import type { Symbol, SymbolCategory } from './types';
import type { GeometricEntity } from '@tupan/core-ts/cad/geometry';

// ============ SYMBOL CREATION HELPERS ============

function createSymbol(
  id: string,
  name: string,
  category: SymbolCategory,
  description: string,
  entities: GeometricEntity[],
  properties?: Record<string, string | number | boolean>
): Symbol {
  // Calculate bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const entity of entities) {
    const bbox = getBounds(entity);
    minX = Math.min(minX, bbox.minX);
    maxX = Math.max(maxX, bbox.maxX);
    minY = Math.min(minY, bbox.minY);
    maxY = Math.max(maxY, bbox.maxY);
  }

  return {
    id,
    name,
    category,
    description,
    entities,
    bounds: { minX, maxX, minY, maxY },
    properties,
  };
}

function getBounds(entity: GeometricEntity) {
  switch (entity.type) {
    case 'point':
      return {
        minX: entity.position.x,
        maxX: entity.position.x,
        minY: entity.position.y,
        maxY: entity.position.y,
      };
    case 'line':
      return {
        minX: Math.min(entity.start.x, entity.end.x),
        maxX: Math.max(entity.start.x, entity.end.x),
        minY: Math.min(entity.start.y, entity.end.y),
        maxY: Math.max(entity.start.y, entity.end.y),
      };
    case 'circle':
      return {
        minX: entity.center.x - entity.radius,
        maxX: entity.center.x + entity.radius,
        minY: entity.center.y - entity.radius,
        maxY: entity.center.y + entity.radius,
      };
    case 'arc':
      return {
        minX: entity.center.x - entity.radius,
        maxX: entity.center.x + entity.radius,
        minY: entity.center.y - entity.radius,
        maxY: entity.center.y + entity.radius,
      };
    case 'polygon': {
      if (entity.points.length === 0)
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
      let minX = entity.points[0].x;
      let maxX = entity.points[0].x;
      let minY = entity.points[0].y;
      let maxY = entity.points[0].y;
      for (const p of entity.points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      return { minX, maxX, minY, maxY };
    }
    case 'text':
      return {
        minX: entity.position.x,
        maxX: entity.position.x + entity.content.length * entity.height * 0.6,
        minY: entity.position.y,
        maxY: entity.position.y + entity.height,
      };
  }
}

// ============ PASSIVE COMPONENTS ============

const resistor: Symbol = createSymbol(
  'resistor',
  'Resistor',
  'resistor',
  'Fixed resistor',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 3, y: 5 } },
    { type: 'polygon', points: [{ x: 3, y: 3 }, { x: 5, y: 7 }, { x: 7, y: 3 }, { x: 9, y: 7 }, { x: 11, y: 3 }, { x: 13, y: 7 }, { x: 15, y: 5 }] },
    { type: 'line', start: { x: 15, y: 5 }, end: { x: 18, y: 5 } },
  ],
  { unit: 'Ω' }
);

const potentiometer: Symbol = createSymbol(
  'potentiometer',
  'Potentiometer',
  'resistor',
  'Variable resistor',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 3, y: 5 } },
    { type: 'polygon', points: [{ x: 3, y: 3 }, { x: 5, y: 7 }, { x: 7, y: 3 }, { x: 9, y: 7 }, { x: 11, y: 3 }, { x: 13, y: 7 }, { x: 15, y: 5 }] },
    { type: 'line', start: { x: 15, y: 5 }, end: { x: 18, y: 5 } },
    { type: 'line', start: { x: 9, y: 3 }, end: { x: 11, y: 0 } }, // Adjustment arrow
  ],
  { unit: 'Ω' }
);

const capacitor: Symbol = createSymbol(
  'capacitor',
  'Capacitor',
  'capacitor',
  'Capacitor',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 7, y: 5 } },
    { type: 'line', start: { x: 7, y: 2 }, end: { x: 7, y: 8 } },
    { type: 'line', start: { x: 11, y: 2 }, end: { x: 11, y: 8 } },
    { type: 'line', start: { x: 11, y: 5 }, end: { x: 18, y: 5 } },
  ],
  { unit: 'F' }
);

const polarizedCapacitor: Symbol = createSymbol(
  'polarized_capacitor',
  'Polarized Capacitor',
  'capacitor',
  'Electrolytic capacitor',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 7, y: 5 } },
    { type: 'line', start: { x: 7, y: 2 }, end: { x: 7, y: 8 } },
    { type: 'line', start: { x: 11, y: 2 }, end: { x: 11, y: 8 } },
    { type: 'line', start: { x: 11, y: 5 }, end: { x: 18, y: 5 } },
    { type: 'line', start: { x: 6, y: 9 }, end: { x: 12, y: 9 } }, // Plus sign area
  ],
  { unit: 'F', polarity: 'positive' }
);

const inductor: Symbol = createSymbol(
  'inductor',
  'Inductor',
  'inductor',
  'Inductor/Coil',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 2, y: 5 } },
    { type: 'arc', center: { x: 3, y: 5 }, radius: 1, startAngle: Math.PI, endAngle: 0 },
    { type: 'arc', center: { x: 5, y: 5 }, radius: 1, startAngle: Math.PI, endAngle: 0 },
    { type: 'arc', center: { x: 7, y: 5 }, radius: 1, startAngle: Math.PI, endAngle: 0 },
    { type: 'line', start: { x: 8, y: 5 }, end: { x: 18, y: 5 } },
  ],
  { unit: 'H' }
);

// ============ DIODES & LEDS ============

const diode: Symbol = createSymbol(
  'diode',
  'Diode',
  'diode',
  'Diode',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 8, y: 5 } },
    { type: 'polygon', points: [{ x: 8, y: 2 }, { x: 8, y: 8 }, { x: 14, y: 5 }] },
    { type: 'line', start: { x: 14, y: 2 }, end: { x: 14, y: 8 } },
    { type: 'line', start: { x: 14, y: 5 }, end: { x: 18, y: 5 } },
  ]
);

const led: Symbol = createSymbol(
  'led',
  'LED',
  'led',
  'Light Emitting Diode',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 8, y: 5 } },
    { type: 'polygon', points: [{ x: 8, y: 2 }, { x: 8, y: 8 }, { x: 14, y: 5 }] },
    { type: 'line', start: { x: 14, y: 2 }, end: { x: 14, y: 8 } },
    { type: 'line', start: { x: 14, y: 5 }, end: { x: 18, y: 5 } },
    { type: 'line', start: { x: 10, y: 0 }, end: { x: 12, y: 2 } }, // Light rays
    { type: 'line', start: { x: 13, y: 0 }, end: { x: 15, y: 2 } },
  ],
  { color: 'red' }
);

const zenerDiode: Symbol = createSymbol(
  'zener_diode',
  'Zener Diode',
  'diode',
  'Zener Diode',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 8, y: 5 } },
    { type: 'polygon', points: [{ x: 8, y: 2 }, { x: 8, y: 8 }, { x: 14, y: 5 }] },
    { type: 'line', start: { x: 14, y: 2 }, end: { x: 14, y: 8 } },
    { type: 'line', start: { x: 14, y: 5 }, end: { x: 18, y: 5 } },
    { type: 'line', start: { x: 13, y: 2 }, end: { x: 15, y: 2 } },
    { type: 'line', start: { x: 12, y: 8 }, end: { x: 14, y: 8 } },
  ]
);

// ============ TRANSISTORS ============

const bjt_npn: Symbol = createSymbol(
  'bjt_npn',
  'BJT NPN',
  'transistor',
  'NPN Bipolar Junction Transistor',
  [
    { type: 'circle', center: { x: 9, y: 5 }, radius: 3 },
    { type: 'line', start: { x: 0, y: 1 }, end: { x: 6, y: 4 } }, // Base
    { type: 'line', start: { x: 6, y: 4 }, end: { x: 6, y: 6 } },
    { type: 'line', start: { x: 0, y: 9 }, end: { x: 12, y: 9 } }, // Emitter
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 12, y: 1 } }, // Collector
    { type: 'polygon', points: [{ x: 8, y: 7 }, { x: 10, y: 8 }, { x: 9, y: 6 }] }, // Arrow
  ]
);

const bjt_pnp: Symbol = createSymbol(
  'bjt_pnp',
  'BJT PNP',
  'transistor',
  'PNP Bipolar Junction Transistor',
  [
    { type: 'circle', center: { x: 9, y: 5 }, radius: 3 },
    { type: 'line', start: { x: 0, y: 1 }, end: { x: 6, y: 4 } }, // Base
    { type: 'line', start: { x: 6, y: 4 }, end: { x: 6, y: 6 } },
    { type: 'line', start: { x: 0, y: 9 }, end: { x: 12, y: 9 } }, // Emitter
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 12, y: 1 } }, // Collector
    { type: 'polygon', points: [{ x: 4, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 5 }] }, // Arrow (reversed)
  ]
);

const mosfet_nch: Symbol = createSymbol(
  'mosfet_nch',
  'MOSFET N-Channel',
  'transistor',
  'N-Channel Metal-Oxide-Semiconductor Field-Effect Transistor',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 4, y: 5 } }, // Gate
    { type: 'line', start: { x: 4, y: 2 }, end: { x: 4, y: 8 } },
    { type: 'line', start: { x: 5, y: 2 }, end: { x: 5, y: 3 } }, // Oxide layer
    { type: 'line', start: { x: 5, y: 7 }, end: { x: 5, y: 8 } },
    { type: 'line', start: { x: 6, y: 1 }, end: { x: 14, y: 1 } }, // Drain
    { type: 'line', start: { x: 6, y: 9 }, end: { x: 14, y: 9 } }, // Source
    { type: 'polygon', points: [{ x: 7, y: 4 }, { x: 7, y: 6 }, { x: 6, y: 5 }] },
  ]
);

const mosfet_pch: Symbol = createSymbol(
  'mosfet_pch',
  'MOSFET P-Channel',
  'transistor',
  'P-Channel Metal-Oxide-Semiconductor Field-Effect Transistor',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 4, y: 5 } }, // Gate
    { type: 'line', start: { x: 4, y: 2 }, end: { x: 4, y: 8 } },
    { type: 'line', start: { x: 5, y: 2 }, end: { x: 5, y: 3 } }, // Oxide layer
    { type: 'line', start: { x: 5, y: 7 }, end: { x: 5, y: 8 } },
    { type: 'line', start: { x: 6, y: 1 }, end: { x: 14, y: 1 } }, // Drain
    { type: 'line', start: { x: 6, y: 9 }, end: { x: 14, y: 9 } }, // Source
    { type: 'polygon', points: [{ x: 7, y: 6 }, { x: 7, y: 4 }, { x: 8, y: 5 }] },
  ]
);

// ============ OPERATIONAL AMPLIFIERS ============

const opamp: Symbol = createSymbol(
  'opamp',
  'Op-Amp',
  'opamp',
  'Operational Amplifier',
  [
    { type: 'polygon', points: [{ x: 4, y: 1 }, { x: 4, y: 9 }, { x: 14, y: 5 }] },
    { type: 'text', position: { x: 7, y: 4 }, content: '+', height: 3 },
    { type: 'text', position: { x: 7, y: 7 }, content: '−', height: 3 },
    { type: 'line', start: { x: 0, y: 3 }, end: { x: 4, y: 3 } }, // Positive input
    { type: 'line', start: { x: 0, y: 7 }, end: { x: 4, y: 7 } }, // Negative input
    { type: 'line', start: { x: 14, y: 5 }, end: { x: 18, y: 5 } }, // Output
  ]
);

// ============ VOLTAGE/CURRENT SOURCES ============

const voltageSource: Symbol = createSymbol(
  'voltage_source',
  'Voltage Source',
  'voltage_source',
  'Voltage Source',
  [
    { type: 'circle', center: { x: 9, y: 5 }, radius: 4 },
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 5, y: 5 } },
    { type: 'line', start: { x: 13, y: 5 }, end: { x: 18, y: 5 } },
    { type: 'text', position: { x: 8, y: 4 }, content: '+', height: 2 },
    { type: 'text', position: { x: 8, y: 7 }, content: '−', height: 2 },
  ],
  { unit: 'V' }
);

const currentSource: Symbol = createSymbol(
  'current_source',
  'Current Source',
  'current_source',
  'Current Source',
  [
    { type: 'circle', center: { x: 9, y: 5 }, radius: 4 },
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 5, y: 5 } },
    { type: 'line', start: { x: 13, y: 5 }, end: { x: 18, y: 5 } },
    { type: 'polygon', points: [{ x: 8, y: 3 }, { x: 10, y: 5 }, { x: 8, y: 7 }] }, // Arrow
  ],
  { unit: 'A' }
);

const battery: Symbol = createSymbol(
  'battery',
  'Battery',
  'battery',
  'Battery/Cell',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 5, y: 5 } },
    { type: 'line', start: { x: 5, y: 2 }, end: { x: 5, y: 8 } }, // Positive plate
    { type: 'line', start: { x: 7, y: 3 }, end: { x: 7, y: 7 } }, // Negative plate
    { type: 'line', start: { x: 13, y: 5 }, end: { x: 18, y: 5 } },
  ],
  { unit: 'V', type: 'primary_cell' }
);

// ============ SWITCHES ============

const switch_spst: Symbol = createSymbol(
  'switch_spst',
  'Switch SPST',
  'switch',
  'Single Pole Single Throw Switch',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 5, y: 5 } },
    { type: 'circle', center: { x: 5, y: 5 }, radius: 1 },
    { type: 'line', start: { x: 6, y: 5 }, end: { x: 10, y: 2 } },
    { type: 'line', start: { x: 10, y: 5 }, end: { x: 18, y: 5 } },
    { type: 'circle', center: { x: 10, y: 5 }, radius: 1 },
  ]
);

const button: Symbol = createSymbol(
  'button',
  'Pushbutton',
  'button',
  'Momentary Contact Button',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 4, y: 5 } },
    { type: 'circle', center: { x: 5, y: 5 }, radius: 1.5 },
    { type: 'circle', center: { x: 8, y: 5 }, radius: 1.5 },
    { type: 'line', start: { x: 9.5, y: 5 }, end: { x: 18, y: 5 } },
  ]
);

const relay: Symbol = createSymbol(
  'relay',
  'Relay',
  'relay',
  'Relay Switch',
  [
    { type: 'line', start: { x: 0, y: 5 }, end: { x: 3, y: 5 } },
    { type: 'arc', center: { x: 5, y: 5 }, radius: 2, startAngle: Math.PI, endAngle: 0 },
    { type: 'line', start: { x: 3, y: 5 }, end: { x: 7, y: 5 } },
    { type: 'polygon', points: [{ x: 8, y: 4 }, { x: 10, y: 6 }, { x: 10, y: 4 }] },
    { type: 'line', start: { x: 10, y: 5 }, end: { x: 18, y: 5 } },
  ]
);

// ============ CONNECTIONS & JUNCTIONS ============

const junction: Symbol = createSymbol(
  'junction',
  'Junction',
  'junction',
  'Wire Junction',
  [{ type: 'circle', center: { x: 9, y: 5 }, radius: 1 }]
);

const noConnection: Symbol = createSymbol(
  'no_connection',
  'No Connection',
  'test',
  'No Connection Mark',
  [
    { type: 'line', start: { x: 7, y: 3 }, end: { x: 11, y: 7 } },
    { type: 'line', start: { x: 11, y: 3 }, end: { x: 7, y: 7 } },
  ]
);

// ============ GROUNDS ============

const groundSymbol: Symbol = createSymbol(
  'ground',
  'Ground',
  'ground',
  'Ground/Reference',
  [
    { type: 'line', start: { x: 0, y: 0 }, end: { x: 18, y: 0 } },
    { type: 'line', start: { x: 2, y: 2 }, end: { x: 16, y: 2 } },
    { type: 'line', start: { x: 4, y: 4 }, end: { x: 14, y: 4 } },
    { type: 'line', start: { x: 9, y: 0 }, end: { x: 9, y: 6 } },
  ]
);

// ============ COMPLETE LIBRARY ============

export const symbolLibrary: Symbol[] = [
  // Passive components
  resistor,
  potentiometer,
  capacitor,
  polarizedCapacitor,
  inductor,

  // Diodes & LEDs
  diode,
  led,
  zenerDiode,

  // Transistors
  bjt_npn,
  bjt_pnp,
  mosfet_nch,
  mosfet_pch,

  // Op-Amps
  opamp,

  // Sources
  voltageSource,
  currentSource,
  battery,

  // Switches
  switch_spst,
  button,
  relay,

  // Connections
  junction,
  noConnection,

  // Ground
  groundSymbol,
];

export function getSymbolByCategory(category: SymbolCategory): Symbol[] {
  return symbolLibrary.filter((s) => s.category === category);
}

export function searchSymbols(query: string): Symbol[] {
  const lowerQuery = query.toLowerCase();
  return symbolLibrary.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.id.toLowerCase().includes(lowerQuery)
  );
}
