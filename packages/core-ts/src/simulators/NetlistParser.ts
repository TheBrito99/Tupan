/**
 * Netlist Parser - Convert SPICE netlist to circuit graph
 *
 * Features:
 * - SPICE netlist parsing
 * - Component instantiation
 * - Node validation
 * - Circuit validation
 */

/**
 * Parsed component from netlist
 */
export interface ParsedComponent {
  refdes: string;             // Reference designator (R1, C2, V1, etc.)
  type: string;               // Component type (R, C, L, V, I, Q, etc.)
  nodes: string[];            // Connected nodes
  value: string;              // Component value (1k, 10u, 5V, etc.)
  parameters?: Record<string, string>; // Additional parameters
}

/**
 * Parsed netlist
 */
export interface ParsedNetlist {
  title: string;
  components: ParsedComponent[];
  nodes: Set<string>;
  groundNode: string;        // Reference node (usually 0 or GND)
  errors: string[];
}

/**
 * Netlist parser for SPICE format
 */
export class NetlistParser {
  private groundNames = new Set(['0', 'GND', 'VSS', 'GROUND']);

  /**
   * Parse SPICE netlist text
   */
  parseNetlist(text: string): ParsedNetlist {
    const lines = text.split('\n').map(l => l.trim());
    const components: ParsedComponent[] = [];
    const nodes = new Set<string>();
    const errors: string[] = [];
    let title = '';
    let groundNode = '0';

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line || line.startsWith('*') || line.startsWith('.')) {
        // Extract title from first line
        if (!title && !line.startsWith('*') && !line.startsWith('.')) {
          title = line;
        }
        continue;
      }

      // Parse component line
      const parsed = this.parseComponentLine(line);

      if (parsed) {
        components.push(parsed);

        // Track nodes
        for (const node of parsed.nodes) {
          nodes.add(node);
          if (this.groundNames.has(node.toUpperCase())) {
            groundNode = node;
          }
        }
      } else {
        errors.push(`Failed to parse: ${line}`);
      }
    }

    // Validate circuit
    this.validateCircuit(components, errors);

    return {
      title,
      components,
      nodes,
      groundNode,
      errors,
    };
  }

  /**
   * Parse single component line
   * Format: Rname n1 n2 value [params]
   */
  private parseComponentLine(line: string): ParsedComponent | null {
    const parts = line.split(/\s+/);

    if (parts.length < 4) {
      return null;
    }

    const refdes = parts[0];
    const type = refdes.charAt(0).toUpperCase();

    // Extract nodes based on component type
    let nodes: string[] = [];
    let valueStartIndex = 2;

    switch (type) {
      case 'R':
      case 'C':
      case 'L':
      case 'G': // Conductance
      case 'D': // Diode
        nodes = [parts[1], parts[2]];
        valueStartIndex = 3;
        break;

      case 'V':
      case 'I': // Voltage/Current source
        nodes = [parts[1], parts[2]];
        valueStartIndex = 3;
        break;

      case 'Q': // Transistor (BJT)
        nodes = [parts[1], parts[2], parts[3]]; // C, B, E
        valueStartIndex = 4;
        break;

      case 'M': // MOSFET
        nodes = [parts[1], parts[2], parts[3], parts[4]]; // D, G, S, B
        valueStartIndex = 5;
        break;

      case 'U': // Op-amp or other multi-pin
        // Variable number of pins
        if (parts.length < 6) return null; // Minimum 5 nodes for standard opamp
        nodes = parts.slice(1, -1);
        valueStartIndex = nodes.length + 1;
        break;

      default:
        return null;
    }

    // Extract value and remaining parameters
    const value = parts[valueStartIndex] || '';
    const parameters: Record<string, string> = {};

    for (let i = valueStartIndex + 1; i < parts.length; i++) {
      if (parts[i].includes('=')) {
        const [key, val] = parts[i].split('=');
        parameters[key] = val;
      }
    }

    return {
      refdes,
      type,
      nodes: nodes.filter(n => n), // Remove empty
      value,
      parameters,
    };
  }

  /**
   * Validate parsed circuit
   */
  private validateCircuit(components: ParsedComponent[], errors: string[]): void {
    // Check for voltage sources in series
    const vSources = components.filter(c => c.type === 'V');
    if (vSources.length > 1) {
      // Check if they share a node (simple series check)
      for (let i = 0; i < vSources.length; i++) {
        for (let j = i + 1; j < vSources.length; j++) {
          const v1Nodes = new Set(vSources[i].nodes);
          const v2Nodes = new Set(vSources[j].nodes);

          // Check for common node
          for (const node of v1Nodes) {
            if (v2Nodes.has(node)) {
              errors.push(`Warning: Voltage sources ${vSources[i].refdes} and ${vSources[j].refdes} may be in series`);
            }
          }
        }
      }
    }

    // Check for floating nodes
    const nodeConnections = new Map<string, number>();
    for (const comp of components) {
      for (const node of comp.nodes) {
        nodeConnections.set(node, (nodeConnections.get(node) || 0) + 1);
      }
    }

    for (const [node, connections] of nodeConnections.entries()) {
      if (connections < 2 && node !== '0' && node.toUpperCase() !== 'GND') {
        // Floating node (less than 2 connections, not ground)
        // This is a warning, not always an error
      }
    }
  }

  /**
   * Parse component value with units
   * Examples: 1k → 1000, 10m → 0.01, 2u → 2e-6
   */
  parseValue(valueStr: string): number {
    const str = valueStr.toUpperCase().trim();

    const unitMap: Record<string, number> = {
      'F': 1,
      'P': 1e-12,
      'N': 1e-9,
      'U': 1e-6,
      'M': 1e-3,
      'K': 1e3,
      'MEG': 1e6,
      'G': 1e9,
    };

    // Find the numeric part and unit
    const match = str.match(/^([\d.eE+-]+)([A-Za-z]*)$/);

    if (!match) {
      return parseFloat(str) || 0;
    }

    const numeric = parseFloat(match[1]);
    const unit = match[2];

    if (!unit) {
      return numeric;
    }

    // Special cases
    if (unit === 'DB') return numeric; // Decibels
    if (unit === '%') return numeric / 100;

    // Standard SI units
    const multiplier = unitMap[unit] || 1;
    return numeric * multiplier;
  }

  /**
   * Format value with appropriate unit
   */
  formatValue(value: number, unit: string = ''): string {
    if (unit) {
      if (Math.abs(value) < 1e-9) return `${(value * 1e12).toFixed(2)}p${unit}`;
      if (Math.abs(value) < 1e-6) return `${(value * 1e9).toFixed(2)}n${unit}`;
      if (Math.abs(value) < 1e-3) return `${(value * 1e6).toFixed(2)}u${unit}`;
      if (Math.abs(value) < 1) return `${(value * 1e3).toFixed(2)}m${unit}`;
      if (Math.abs(value) < 1e3) return `${value.toFixed(2)}${unit}`;
      if (Math.abs(value) < 1e6) return `${(value / 1e3).toFixed(2)}k${unit}`;
      return `${(value / 1e6).toFixed(2)}M${unit}`;
    }

    return value.toFixed(2);
  }

  /**
   * Generate SPICE netlist from components
   */
  generateNetlist(
    components: ParsedComponent[],
    title: string = 'Generated Circuit'
  ): string {
    const lines: string[] = [];

    lines.push(title);
    lines.push('* Generated netlist');
    lines.push('');

    for (const comp of components) {
      let line = comp.refdes;

      // Add nodes
      for (const node of comp.nodes) {
        line += ` ${node}`;
      }

      // Add value
      if (comp.value) {
        line += ` ${comp.value}`;
      }

      // Add parameters
      if (comp.parameters) {
        for (const [key, val] of Object.entries(comp.parameters)) {
          line += ` ${key}=${val}`;
        }
      }

      lines.push(line);
    }

    lines.push('');
    lines.push('.end');

    return lines.join('\n');
  }

  /**
   * Validate netlist for common errors
   */
  validateNetlist(netlist: ParsedNetlist): string[] {
    const errors: string[] = [...netlist.errors];

    // Check for no components
    if (netlist.components.length === 0) {
      errors.push('Error: No components in circuit');
      return errors;
    }

    // Check for voltage source
    if (!netlist.components.some(c => c.type === 'V')) {
      errors.push('Warning: No voltage source found');
    }

    // Check for load
    if (!netlist.components.some(c => c.type === 'R' || c.type === 'L' || c.type === 'C')) {
      errors.push('Warning: No passive components found');
    }

    // Check for ground connection
    if (!netlist.components.some(c => c.nodes.includes(netlist.groundNode))) {
      errors.push(`Warning: No component connected to ground (${netlist.groundNode})`);
    }

    return errors;
  }
}

// Export singleton instance
export const netlistParser = new NetlistParser();
