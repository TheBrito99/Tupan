/**
 * PCB Board Manager - Manages component placement and electrical connectivity
 *
 * Responsibilities:
 * - Component placement and positioning
 * - Netlist management and unrouted net tracking
 * - Layer management
 * - Net connectivity checking
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PCBBoard,
  PlacedComponent,
  Trace,
  Via,
  DesignRule,
  DRCViolation,
  PCBLayer,
} from './types';
import { Footprint } from './FootprintLibrary';

export interface UnroutedNet {
  netName: string;
  connectedPins: Array<{ componentId: string; padNumber: string }>;
  isRouted: boolean;
}

export interface NetlistImport {
  title: string;
  components: Array<{
    refdes: string;
    footprint: string;
    value?: string;
  }>;
  nets: Array<{
    netName: string;
    nodes: Array<{ refdes: string; pin: string }>;
  }>;
}

export class PCBBoardManager {
  private board: PCBBoard;
  private unroutedNets: Map<string, UnroutedNet> = new Map();
  private componentPositions: Map<string, { x: number; y: number }> = new Map();

  constructor(width: number = 100, height: number = 100) {
    this.board = {
      id: uuidv4(),
      title: 'PCB Board',
      width,
      height,
      thickness: 1.6,
      layers: [
        PCBLayer.SIGNAL_TOP,
        PCBLayer.GROUND,
        PCBLayer.POWER,
        PCBLayer.SIGNAL_BOTTOM,
      ],
      components: [],
      traces: [],
      vias: [],
      zones: [],
      designRules: this.getDefaultDesignRules(),
    };
  }

  /**
   * Import netlist from schematic
   */
  public importNetlist(netlist: NetlistImport): void {
    // Clear existing state
    this.unroutedNets.clear();
    this.componentPositions.clear();

    // Create unrouted nets
    for (const net of netlist.nets) {
      const unroutedNet: UnroutedNet = {
        netName: net.netName,
        connectedPins: net.nodes.map(node => ({
          componentId: node.refdes,
          padNumber: node.pin,
        })),
        isRouted: false,
      };
      this.unroutedNets.set(net.netName, unroutedNet);
    }
  }

  /**
   * Place component on board
   */
  public placeComponent(
    refdes: string,
    footprint: Footprint,
    x: number,
    y: number,
    rotation: number = 0,
    side: 'top' | 'bottom' = 'top'
  ): PlacedComponent {
    const component: PlacedComponent = {
      id: uuidv4(),
      refdes,
      footprint,
      position: { x, y },
      rotation,
      side,
      placed: true,
    };

    this.board.components.push(component);
    this.componentPositions.set(refdes, { x, y });

    return component;
  }

  /**
   * Move component
   */
  public moveComponent(componentId: string, x: number, y: number): void {
    const component = this.board.components.find(c => c.id === componentId);
    if (component) {
      component.position = { x, y };
      this.componentPositions.set(component.refdes, { x, y });
    }
  }

  /**
   * Rotate component (0, 90, 180, 270 degrees)
   */
  public rotateComponent(componentId: string, rotation: number): void {
    const component = this.board.components.find(c => c.id === componentId);
    if (component) {
      component.rotation = ((rotation % 360) + 360) % 360;
    }
  }

  /**
   * Flip component to other side
   */
  public flipComponent(componentId: string): void {
    const component = this.board.components.find(c => c.id === componentId);
    if (component) {
      component.side = component.side === 'top' ? 'bottom' : 'top';
    }
  }

  /**
   * Get all unrouted nets
   */
  public getUnroutedNets(): UnroutedNet[] {
    return Array.from(this.unroutedNets.values()).filter(net => !net.isRouted);
  }

  /**
   * Get net connectivity
   */
  public getNetConnectivity(netName: string): Array<{ componentId: string; padNumber: string }> {
    const net = this.unroutedNets.get(netName);
    return net ? net.connectedPins : [];
  }

  /**
   * Mark net as routed
   */
  public markNetRouted(netName: string): void {
    const net = this.unroutedNets.get(netName);
    if (net) {
      net.isRouted = true;
    }
  }

  /**
   * Get component position
   */
  public getComponentPosition(refdes: string): { x: number; y: number } | undefined {
    return this.componentPositions.get(refdes);
  }

  /**
   * Get all components
   */
  public getComponents(): PlacedComponent[] {
    return [...this.board.components];
  }

  /**
   * Get board info
   */
  public getBoard(): PCBBoard {
    return { ...this.board };
  }

  /**
   * Get placement stats
   */
  public getPlacementStats(): {
    totalComponents: number;
    placedComponents: number;
    unreroetedNets: number;
    routedNets: number;
    completeness: number;
  } {
    const placed = this.board.components.filter(c => c.placed).length;
    const routed = Array.from(this.unroutedNets.values()).filter(n => n.isRouted).length;
    const total = this.unroutedNets.size;

    return {
      totalComponents: this.board.components.length,
      placedComponents: placed,
      unreroetedNets: total - routed,
      routedNets: routed,
      completeness: total > 0 ? (routed / total) * 100 : 0,
    };
  }

  /**
   * Default design rules (IPC-2221)
   */
  private getDefaultDesignRules(): DesignRule[] {
    return [
      {
        id: uuidv4(),
        name: 'Trace Width',
        minValue: 0.15,
        maxValue: 10,
        defaultValue: 0.254,
        unit: 'mm',
        description: 'Minimum trace width for 1A current',
      },
      {
        id: uuidv4(),
        name: 'Trace Spacing',
        minValue: 0.15,
        maxValue: 10,
        defaultValue: 0.254,
        unit: 'mm',
        description: 'Minimum clearance between traces',
      },
      {
        id: uuidv4(),
        name: 'Via Size',
        minValue: 0.3,
        maxValue: 5,
        defaultValue: 0.6,
        unit: 'mm',
        description: 'Via diameter (pad + drill)',
      },
      {
        id: uuidv4(),
        name: 'Via Spacing',
        minValue: 0.3,
        maxValue: 10,
        defaultValue: 0.6,
        unit: 'mm',
        description: 'Minimum via-to-via clearance',
      },
      {
        id: uuidv4(),
        name: 'Pad Clearance',
        minValue: 0.1,
        maxValue: 10,
        defaultValue: 0.254,
        unit: 'mm',
        description: 'Clearance between pad and trace',
      },
      {
        id: uuidv4(),
        name: 'Via To Pad',
        minValue: 0.1,
        maxValue: 10,
        defaultValue: 0.254,
        unit: 'mm',
        description: 'Clearance between via and pad',
      },
    ];
  }

  /**
   * Get design rules
   */
  public getDesignRules(): DesignRule[] {
    return [...this.board.designRules];
  }

  /**
   * Update design rule
   */
  public updateDesignRule(ruleId: string, newValue: number): void {
    const rule = this.board.designRules.find(r => r.id === ruleId);
    if (rule) {
      rule.defaultValue = Math.max(rule.minValue, Math.min(rule.maxValue, newValue));
    }
  }

  /**
   * Export board to JSON
   */
  public exportBoard(): string {
    return JSON.stringify(this.board, null, 2);
  }

  /**
   * Import board from JSON
   */
  public importBoard(json: string): void {
    try {
      const imported = JSON.parse(json) as PCBBoard;
      this.board = imported;
      this.componentPositions.clear();
      for (const comp of this.board.components) {
        this.componentPositions.set(comp.refdes, comp.position);
      }
    } catch (error) {
      throw new Error(`Failed to import board: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
