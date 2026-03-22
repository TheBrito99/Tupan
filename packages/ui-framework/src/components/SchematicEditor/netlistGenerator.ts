/**
 * Netlist Generator - Converts schematic to netlist formats
 *
 * Supports:
 * - SPICE netlist format (for ngspice, LTspice)
 * - JSON netlist
 * - Component list (BOM)
 */

import { PlacedSymbol, Wire, Netlist, NetlistEntry, NetConnection, ComponentEntry } from './types';

/**
 * Generate SPICE netlist from schematic
 *
 * Example output:
 * ```
 * RC Circuit Example
 * * Generated netlist
 * R1 1 2 1k
 * C1 2 0 1u
 * V1 1 0 DC 5
 * .end
 * ```
 */
export function generateSpiceNetlist(
  symbols: PlacedSymbol[],
  wires: Wire[],
  title: string = 'Schematic'
): string {
  const lines: string[] = [];

  // Header
  lines.push(title);
  lines.push(`* Generated netlist - ${new Date().toISOString()}`);
  lines.push('');

  // Build node mapping from wires
  const nodeMap = buildNodeMap(symbols, wires);

  // Generate component lines
  for (const symbol of symbols) {
    const spiceLine = generateSpiceComponentLine(symbol, nodeMap);
    if (spiceLine) {
      lines.push(spiceLine);
    }
  }

  lines.push('');
  lines.push('.end');

  return lines.join('\n');
}

/**
 * Generate SPICE component line for a symbol
 */
function generateSpiceComponentLine(symbol: PlacedSymbol, nodeMap: Map<string, number>): string | null {
  const refdes = getSymbolRefDes(symbol);
  if (!refdes) return null;

  const value = symbol.parameters.value || '1';
  const pins = symbol.pins;

  // Get connected nodes
  const nodes: string[] = [];
  for (const pin of pins) {
    const nodeNum = getNodeForPin(symbol.id, pin.id, nodeMap) || '0';
    nodes.push(nodeNum);
  }

  // Component type determines line format
  const category = symbol.symbol.category?.toLowerCase() || '';

  switch (category) {
    case 'resistor':
    case 'potentiometer':
      return `${refdes} ${nodes.slice(0, 2).join(' ')} ${value}`;

    case 'capacitor':
    case 'inductor':
      return `${refdes} ${nodes.slice(0, 2).join(' ')} ${value}`;

    case 'diode':
    case 'led':
    case 'zener':
      return `${refdes} ${nodes.slice(0, 2).join(' ')} DMODEL`;

    case 'voltage_source':
    case 'battery':
      return `${refdes} ${nodes.slice(0, 2).join(' ')} DC ${value}`;

    case 'current_source':
      return `${refdes} ${nodes.slice(0, 2).join(' ')} DC ${value}`;

    case 'opamp':
      if (nodes.length >= 5) {
        return `${refdes} ${nodes.slice(0, 5).join(' ')} OPAMP_MODEL`;
      }
      break;

    case 'transistor':
      if (nodes.length >= 3) {
        const type = symbol.parameters.custom?.type || 'NPN';
        return `${refdes} ${nodes.slice(0, 3).join(' ')} ${type}`;
      }
      break;

    case 'switch':
      return `${refdes} ${nodes.slice(0, 2).join(' ')} SWITCH`;

    case 'ground':
    case 'junction':
      return null; // Virtual components

    default:
      if (nodes.length >= 2) {
        return `${refdes} ${nodes.slice(0, 2).join(' ')} ${value}`;
      }
  }

  return null;
}

/**
 * Build node-to-number mapping from wires
 */
function buildNodeMap(symbols: PlacedSymbol[], wires: Wire[]): Map<string, number> {
  const nodeMap = new Map<string, number>();
  let nodeNum = 1;

  // Assign ground (node 0)
  for (const symbol of symbols) {
    if (symbol.symbol.category?.toLowerCase() === 'ground') {
      for (const pin of symbol.pins) {
        nodeMap.set(`${symbol.id}:${pin.id}`, 0);
      }
    }
  }

  // Assign nodes for connected pins
  const connectedPins = new Set<string>();
  for (const wire of wires) {
    const fromKey = `${wire.fromSymbol}:${wire.fromPin}`;
    const toKey = `${wire.toSymbol}:${wire.toPin}`;

    if (!connectedPins.has(fromKey)) {
      const node = nodeNum++;
      nodeMap.set(fromKey, node);
      connectedPins.add(fromKey);
    }

    if (!connectedPins.has(toKey)) {
      if (!nodeMap.has(fromKey)) {
        const node = nodeNum++;
        nodeMap.set(toKey, node);
      } else {
        nodeMap.set(toKey, nodeMap.get(fromKey)!);
      }
      connectedPins.add(toKey);
    }
  }

  // Assign nodes for unconnected pins
  for (const symbol of symbols) {
    for (const pin of symbol.pins) {
      const key = `${symbol.id}:${pin.id}`;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, nodeNum++);
      }
    }
  }

  return nodeMap;
}

/**
 * Get node number for a pin
 */
function getNodeForPin(symbolId: string, pinId: string, nodeMap: Map<string, number>): number | null {
  return nodeMap.get(`${symbolId}:${pinId}`) || null;
}

/**
 * Get reference designator from symbol
 */
function getSymbolRefDes(symbol: PlacedSymbol): string | null {
  const category = symbol.symbol.category?.toLowerCase() || '';
  const prefixes: Record<string, string> = {
    'resistor': 'R',
    'potentiometer': 'R',
    'capacitor': 'C',
    'inductor': 'L',
    'diode': 'D',
    'led': 'D',
    'transistor': 'Q',
    'opamp': 'U',
    'voltage_source': 'V',
    'current_source': 'I',
    'battery': 'V',
    'switch': 'S',
    'relay': 'RL',
  };

  if (!prefixes[category]) return null;

  // Extract number from symbol ID or use index
  return `${prefixes[category]}1`;
}

/**
 * Generate structured netlist object
 */
export function generateNetlist(
  symbols: PlacedSymbol[],
  wires: Wire[],
  title: string = 'Schematic'
): Netlist {
  const nodeMap = buildNodeMap(symbols, wires);
  const entries: NetlistEntry[] = [];
  const components: ComponentEntry[] = [];

  // Build entries from wires
  const netMap = new Map<number, NetlistEntry>();

  for (const wire of wires) {
    const fromNode = getNodeForPin(wire.fromSymbol, wire.fromPin, nodeMap);
    const toNode = getNodeForPin(wire.toSymbol, wire.toPin, nodeMap);

    if (fromNode !== null && toNode !== null) {
      const netName = wire.properties.name || `net_${Math.min(fromNode, toNode)}`;

      // Get symbol info
      const fromSymbol = symbols.find(s => s.id === wire.fromSymbol);
      const toSymbol = symbols.find(s => s.id === wire.toSymbol);

      if (fromSymbol && toSymbol) {
        const connection: NetConnection = {
          symbolId: fromSymbol.id,
          symbolName: getSymbolRefDes(fromSymbol) || 'X',
          symbolValue: fromSymbol.parameters.value || '',
          pinId: wire.fromPin,
          pinName: wire.fromPin,
        };

        if (!netMap.has(fromNode)) {
          netMap.set(fromNode, {
            netName,
            connections: [connection],
          });
        } else {
          netMap.get(fromNode)!.connections.push(connection);
        }
      }
    }
  }

  entries.push(...netMap.values());

  // Build component entries
  for (const symbol of symbols) {
    const refdes = getSymbolRefDes(symbol);
    if (refdes) {
      components.push({
        refdes,
        value: symbol.parameters.value || '',
        footprint: symbol.parameters.footprint,
        nets: getSymbolNets(symbol, nodeMap),
      });
    }
  }

  return {
    title,
    timestamp: new Date().toISOString(),
    entries,
    components,
  };
}

/**
 * Get all net names connected to a symbol
 */
function getSymbolNets(symbol: PlacedSymbol, nodeMap: Map<string, number>): string[] {
  const nets = new Set<string>();
  for (const pin of symbol.pins) {
    const node = getNodeForPin(symbol.id, pin.id, nodeMap);
    if (node !== null) {
      nets.add(`net_${node}`);
    }
  }
  return Array.from(nets);
}

/**
 * Generate bill of materials (BOM)
 */
export function generateBOM(symbols: PlacedSymbol[]): string {
  const lines: string[] = [];

  // Group by value
  const groups = new Map<string, PlacedSymbol[]>();

  for (const symbol of symbols) {
    const key = `${symbol.symbol.category}:${symbol.parameters.value}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(symbol);
  }

  // Header
  lines.push('Reference,Value,Footprint,Quantity');

  // Sort and output
  const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, syms] of sorted) {
    const first = syms[0];
    const refdes = syms.map(s => getSymbolRefDes(s) || 'X').join(', ');
    const quantity = syms.length;

    lines.push(`"${refdes}","${first.parameters.value}","${first.parameters.footprint || ''}",${quantity}`);
  }

  return lines.join('\n');
}

/**
 * Export netlist as JSON
 */
export function exportNetlistJSON(
  symbols: PlacedSymbol[],
  wires: Wire[],
  title: string = 'Schematic'
): string {
  const netlist = generateNetlist(symbols, wires, title);
  return JSON.stringify(netlist, null, 2);
}

/**
 * Validate netlist for errors
 */
export interface ValidationError {
  type: 'floating_component' | 'duplicate_net' | 'missing_ground' | 'open_circuit';
  message: string;
  severity: 'error' | 'warning';
}

export function validateNetlist(
  symbols: PlacedSymbol[],
  wires: Wire[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for floating components (unconnected pins)
  for (const symbol of symbols) {
    const connectedPins = wires.filter(
      w => (w.fromSymbol === symbol.id && w.fromPin) || (w.toSymbol === symbol.id && w.toPin)
    );

    if (connectedPins.length === 0 && symbol.symbol.category !== 'junction') {
      errors.push({
        type: 'floating_component',
        message: `Symbol ${symbol.id} has no connections`,
        severity: 'error',
      });
    }
  }

  // Check for ground node
  const hasGround = symbols.some(s => s.symbol.category?.toLowerCase() === 'ground');
  if (!hasGround) {
    errors.push({
      type: 'missing_ground',
      message: 'Schematic should have at least one ground reference',
      severity: 'warning',
    });
  }

  // Check for voltage sources
  const hasSources = symbols.some(s =>
    s.symbol.category?.toLowerCase().includes('source') ||
    s.symbol.category?.toLowerCase() === 'battery'
  );

  if (!hasSources) {
    errors.push({
      type: 'open_circuit',
      message: 'Schematic should have at least one voltage source',
      severity: 'warning',
    });
  }

  return errors;
}
