/**
 * Net Manager - Net naming, organization, and visualization
 *
 * Features:
 * - Auto net naming (GND, VCC, net_1, etc.)
 * - Net display and hiding
 * - Net statistics
 * - Net-based selection
 */

import { Wire, PlacedSymbol } from './types';
import { assignNetName, findWiresOnNet, findWiresForSymbol } from './wireRouter';

/**
 * Net information
 */
export interface NetInfo {
  name: string;
  wireIds: string[];
  connectionCount: number;
  symbolIds: Set<string>;
  voltage?: number;
  current?: number;
  highlighted: boolean;
}

/**
 * Net color scheme
 */
const NET_COLORS: Record<string, string> = {
  'GND': '#000000',         // Black for ground
  'VSS': '#000000',
  'VCC': '#FF0000',         // Red for power
  'VDD': '#FF0000',
  'VSS': '#000000',
  'VEE': '#0000FF',         // Blue for negative
  'VBB': '#0000FF',
};

/**
 * Net manager for electrical network operations
 */
export class NetManager {
  private nets: Map<string, NetInfo> = new Map();
  private autoNetCounter: number = 1;
  private highlightedNets: Set<string> = new Set();

  /**
   * Update nets from wires
   */
  updateNets(wires: Wire[], symbols: PlacedSymbol[]): void {
    this.nets.clear();
    this.autoNetCounter = 1;

    // Track which nets we've created
    const netNames = new Set<string>();

    for (const wire of wires) {
      let netName = wire.properties.name;

      // Auto-generate net name if not set
      if (!netName) {
        do {
          netName = `net_${this.autoNetCounter++}`;
        } while (netNames.has(netName));
      }

      netNames.add(netName);

      if (!this.nets.has(netName)) {
        this.nets.set(netName, {
          name: netName,
          wireIds: [],
          connectionCount: 0,
          symbolIds: new Set(),
          highlighted: this.highlightedNets.has(netName),
        });
      }

      const netInfo = this.nets.get(netName)!;
      netInfo.wireIds.push(wire.id);

      // Track connected symbols
      netInfo.symbolIds.add(wire.fromSymbol);
      netInfo.symbolIds.add(wire.toSymbol);
      netInfo.connectionCount = netInfo.symbolIds.size;
    }
  }

  /**
   * Auto-name all unnamed nets
   */
  autoNameNets(wires: Wire[]): Wire[] {
    let counter = 1;
    const namedWires = [...wires];

    for (let i = 0; i < namedWires.length; i++) {
      if (!namedWires[i].properties.name) {
        const netName = `net_${counter++}`;
        namedWires[i] = assignNetName(namedWires[i], netName);
      }
    }

    return namedWires;
  }

  /**
   * Get all nets
   */
  getAllNets(): NetInfo[] {
    return Array.from(this.nets.values());
  }

  /**
   * Get net by name
   */
  getNet(name: string): NetInfo | undefined {
    return this.nets.get(name);
  }

  /**
   * Rename net
   */
  renameNet(oldName: string, newName: string, wires: Wire[]): Wire[] {
    const oldNet = this.nets.get(oldName);
    if (!oldNet) return wires;

    // Check if new name already exists
    if (this.nets.has(newName) && newName !== oldName) {
      return wires; // Can't use existing name
    }

    // Rename wires
    const renamedWires = wires.map(w => {
      if (w.properties.name === oldName) {
        return assignNetName(w, newName);
      }
      return w;
    });

    // Update net map
    this.nets.delete(oldName);
    const netInfo = oldNet;
    netInfo.name = newName;
    this.nets.set(newName, netInfo);

    return renamedWires;
  }

  /**
   * Merge nets
   */
  mergeNets(
    sourceNet: string,
    targetNet: string,
    wires: Wire[]
  ): Wire[] {
    const source = this.nets.get(sourceNet);
    const target = this.nets.get(targetNet);

    if (!source || !target) return wires;

    // Reassign all wires from source to target
    const mergedWires = wires.map(w => {
      if (w.properties.name === sourceNet) {
        return assignNetName(w, targetNet);
      }
      return w;
    });

    // Update net map
    target.wireIds.push(...source.wireIds);
    source.wireIds.forEach(id => {
      target.symbolIds.add(id);
    });
    target.connectionCount = target.symbolIds.size;

    this.nets.delete(sourceNet);

    return mergedWires;
  }

  /**
   * Split net at wire
   */
  splitNetAtWire(netName: string, wireId: string): string | null {
    const netInfo = this.nets.get(netName);
    if (!netInfo) return null;

    const wireIndex = netInfo.wireIds.indexOf(wireId);
    if (wireIndex === -1) return null;

    // Create new net
    const newNetName = `${netName}_1`;
    const newWireIds = netInfo.wireIds.splice(wireIndex, 1);

    const newNetInfo: NetInfo = {
      name: newNetName,
      wireIds: newWireIds,
      connectionCount: 2, // Minimum for a net
      symbolIds: new Set(),
      highlighted: false,
    };

    this.nets.set(newNetName, newNetInfo);

    return newNetName;
  }

  /**
   * Highlight net (for visualization)
   */
  highlightNet(netName: string): void {
    this.highlightedNets.add(netName);

    const netInfo = this.nets.get(netName);
    if (netInfo) {
      netInfo.highlighted = true;
    }
  }

  /**
   * Unhighlight net
   */
  unhighlightNet(netName: string): void {
    this.highlightedNets.delete(netName);

    const netInfo = this.nets.get(netName);
    if (netInfo) {
      netInfo.highlighted = false;
    }
  }

  /**
   * Clear all highlighting
   */
  clearHighlighting(): void {
    this.highlightedNets.clear();

    for (const netInfo of this.nets.values()) {
      netInfo.highlighted = false;
    }
  }

  /**
   * Get highlighted nets
   */
  getHighlightedNets(): string[] {
    return Array.from(this.highlightedNets);
  }

  /**
   * Get color for net
   */
  getNetColor(netName: string): string {
    // Check predefined colors
    if (NET_COLORS[netName]) {
      return NET_COLORS[netName];
    }

    // Generate deterministic color from name
    let hash = 0;
    for (let i = 0; i < netName.length; i++) {
      hash = (hash << 5) - hash + netName.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Find nets with open connections
   */
  findOpenNets(symbols: PlacedSymbol[]): string[] {
    const openNets: string[] = [];

    for (const [netName, netInfo] of this.nets) {
      if (netInfo.connectionCount < 2) {
        openNets.push(netName);
      }
    }

    return openNets;
  }

  /**
   * Find short circuits (nets that should be separate)
   */
  findPotentialShorts(): string[] {
    // This is a simplified check - look for nets that might be shorted
    // In a real implementation, this would check for conflicting voltage sources
    return [];
  }

  /**
   * Get net statistics
   */
  getNetStats(netName: string): {
    name: string;
    wires: number;
    symbols: number;
    connections: number;
  } | null {
    const netInfo = this.nets.get(netName);
    if (!netInfo) return null;

    return {
      name: netName,
      wires: netInfo.wireIds.length,
      symbols: netInfo.symbolIds.size,
      connections: netInfo.connectionCount,
    };
  }

  /**
   * Get all net statistics
   */
  getAllNetStats(): Array<{
    name: string;
    wires: number;
    symbols: number;
    connections: number;
  }> {
    return Array.from(this.nets.values()).map(netInfo => ({
      name: netInfo.name,
      wires: netInfo.wireIds.length,
      symbols: netInfo.symbolIds.size,
      connections: netInfo.connectionCount,
    }));
  }

  /**
   * Find net by wire
   */
  findNetByWireId(wireId: string): string | null {
    for (const [netName, netInfo] of this.nets) {
      if (netInfo.wireIds.includes(wireId)) {
        return netName;
      }
    }
    return null;
  }

  /**
   * Find nets connected to symbol
   */
  findNetsForSymbol(symbolId: string): string[] {
    const nets: string[] = [];

    for (const [netName, netInfo] of this.nets) {
      if (netInfo.symbolIds.has(symbolId)) {
        nets.push(netName);
      }
    }

    return nets;
  }

  /**
   * Export net list as JSON
   */
  exportToJSON(): string {
    const netArray = Array.from(this.nets.entries()).map(([name, info]) => ({
      name,
      wireCount: info.wireIds.length,
      symbolCount: info.symbolIds.size,
      connectionCount: info.connectionCount,
    }));

    return JSON.stringify(netArray, null, 2);
  }

  /**
   * Get net assignment summary
   */
  getSummary(): {
    totalNets: number;
    namedNets: number;
    powerNets: number;
    signalNets: number;
    groundNets: number;
  } {
    const stats = {
      totalNets: this.nets.size,
      namedNets: 0,
      powerNets: 0,
      signalNets: 0,
      groundNets: 0,
    };

    for (const [name] of this.nets) {
      if (name.startsWith('net_')) continue; // Skip auto-named
      stats.namedNets++;

      if (name.toUpperCase().includes('GND') || name.toUpperCase().includes('VSS')) {
        stats.groundNets++;
      } else if (
        name.toUpperCase().includes('VCC') ||
        name.toUpperCase().includes('VDD') ||
        name.toUpperCase().includes('VBB')
      ) {
        stats.powerNets++;
      } else {
        stats.signalNets++;
      }
    }

    return stats;
  }
}
