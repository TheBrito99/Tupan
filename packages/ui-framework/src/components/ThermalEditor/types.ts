/**
 * Thermal Editor Type Definitions
 *
 * Defines types for thermal circuit modeling with resistances, capacitances,
 * heat sources, and convection elements.
 */

export type ThermalComponentType =
  | 'heat-source'        // Constant power source
  | 'temperature-source'  // Constant temperature source
  | 'thermal-resistance'  // Conduction/convection resistance
  | 'thermal-capacitance' // Thermal mass/capacitance
  | 'ambient'            // Ambient environment reference

export type CausalityType = 'effort-out' | 'flow-out' | 'unassigned'

export interface Position {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ThermalComponent {
  id: string
  type: ThermalComponentType
  name: string
  position: Position
  parameters: Record<string, number> // e.g., { resistance: 0.5, capacity: 1000 }
}

export interface ThermalConnection {
  id: string
  from: string           // Component ID
  to: string             // Component ID
  causality: CausalityType
  effort?: number        // Temperature (K)
  flow?: number          // Heat flow (W)
}

export interface EditorState {
  selectedComponent: string | null
  selectedConnection: string | null
  draggingComponent: string | null
  drawingConnection: { fromId: string; toId: string | null } | null
  panX: number
  panY: number
  zoom: number
  mode: 'select' | 'draw' | 'pan'
}

export interface PropertyPanelState {
  expandedSections: Record<string, boolean>
}

export interface SimulationState {
  isRunning: boolean
  isPaused: boolean
  simulationTime: number
  timestep: number
  temperature: Record<string, number> // Component ID -> temperature
  heatFlow: Record<string, number>    // Connection ID -> heat flow
}

export interface AnalysisData {
  steadyState: {
    temperatures: Record<string, number>
    heatFlows: Record<string, number>
  }
  transient: {
    time: number[]
    temperatures: Record<string, number[]>
    heatFlows: Record<string, number[]>
  }
  thermalPathResistance: number
  totalPowerDissipation: number
}

export interface ThermalVisualizationData {
  componentColors: Record<string, string> // ID -> color based on temperature
  connectionWidths: Record<string, number> // ID -> width based on heat flow
  heatmapIntensity: Record<string, number> // ID -> normalized intensity (0-1)
}

// Helper functions for bounds checking
export function pointInBounds(point: Position, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

export function getComponentBounds(component: ThermalComponent): Bounds {
  const size = 60
  return {
    x: component.position.x - size / 2,
    y: component.position.y - size / 2,
    width: size,
    height: size,
  }
}

export function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

// Default component parameters
export const DEFAULT_PARAMETERS: Record<ThermalComponentType, Record<string, number>> = {
  'heat-source': { power: 100 }, // Watts
  'temperature-source': { temperature: 300 }, // Kelvin
  'thermal-resistance': { resistance: 0.1 }, // K/W
  'thermal-capacitance': { capacity: 1000 }, // J/K
  'ambient': { temperature: 300 }, // Kelvin (typically fixed)
}

// Component display properties
export const COMPONENT_PROPERTIES: Record<ThermalComponentType, { label: string; color: string; symbol: string }> = {
  'heat-source': {
    label: 'Heat Source',
    color: '#ff6b6b',
    symbol: '✨',
  },
  'temperature-source': {
    label: 'Temperature Source',
    color: '#ee5a6f',
    symbol: '🌡️',
  },
  'thermal-resistance': {
    label: 'Thermal Resistance',
    color: '#4ecdc4',
    symbol: 'R_th',
  },
  'thermal-capacitance': {
    label: 'Thermal Capacitance',
    color: '#45b7d1',
    symbol: 'C_th',
  },
  'ambient': {
    label: 'Ambient',
    color: '#95a5a6',
    symbol: '🌍',
  },
}
