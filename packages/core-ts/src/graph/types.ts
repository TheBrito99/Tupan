/**
 * Core graph types mirroring Rust implementations
 * These interfaces provide type-safe access to graph data in TypeScript
 */

import { v4 as uuidv4 } from 'uuid';

/** Unique identifier for nodes */
export class NodeId {
  private readonly value: string;

  constructor(value?: string) {
    this.value = value || uuidv4();
  }

  static new(): NodeId {
    return new NodeId();
  }

  toString(): string {
    return this.value;
  }

  equals(other: NodeId): boolean {
    return this.value === other.value;
  }
}

/** Unique identifier for edges */
export class EdgeId {
  private readonly value: string;

  constructor(value?: string) {
    this.value = value || uuidv4();
  }

  static new(): EdgeId {
    return new EdgeId();
  }

  toString(): string {
    return this.value;
  }

  equals(other: EdgeId): boolean {
    return this.value === other.value;
  }
}

/** Unique identifier for ports */
export class PortId {
  private readonly value: string;

  constructor(value?: string) {
    this.value = value || uuidv4();
  }

  static new(): PortId {
    return new PortId();
  }

  toString(): string {
    return this.value;
  }

  equals(other: PortId): boolean {
    return this.value === other.value;
  }
}

/** Port direction */
export enum PortDirection {
  Input = 'input',
  Output = 'output',
}

/** Port type */
export enum PortType {
  Electrical = 'electrical',
  Thermal = 'thermal',
  Mechanical = 'mechanical',
  Hydraulic = 'hydraulic',
  Pneumatic = 'pneumatic',
  Signal = 'signal',
}

/** Port definition */
export interface IPort {
  id: PortId;
  name: string;
  direction: PortDirection;
  port_type: PortType;
  value: number[];
  unit?: string;
}

/** Node interface */
export interface INode {
  id: NodeId;
  node_type: string;
  inputs: IPort[];
  outputs: IPort[];
  parameters: Record<string, unknown>;
  state: number[];
}

/** Edge interface */
export interface IEdge {
  id: EdgeId;
  source: [NodeId, PortId];
  target: [NodeId, PortId];
  properties: IEdgeProperties;
}

/** Edge properties */
export interface IEdgeProperties {
  label?: string;
  gain?: number;
  delay?: number;
  metadata?: Record<string, unknown>;
}
