/**
 * Tupan Core TypeScript Library
 *
 * Provides TypeScript interfaces and classes for the Tupan simulation system,
 * including graph abstractions and WASM bridge functionality.
 */

// Graph types and classes
export * from './graph/types';
export { Graph, Node, Port, Edge } from './graph/Graph';

// WASM bridge
export { GraphBridge } from './wasm-bridge/GraphBridge';

export const VERSION = '0.1.0';
