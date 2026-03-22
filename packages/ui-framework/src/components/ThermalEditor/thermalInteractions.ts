/**
 * Thermal Network Analysis and Interaction Functions
 *
 * Provides utilities for analyzing thermal networks, computing steady-state
 * temperatures, and simulating transient responses.
 */

import type { ThermalComponent, ThermalConnection, AnalysisData } from './types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate thermal network structure and parameters
 */
export function validateThermalNetwork(
  components: ThermalComponent[],
  connections: ThermalConnection[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for at least one source
  const hasSources = components.some(c => c.type === 'heat-source' || c.type === 'temperature-source')
  if (!hasSources) {
    errors.push('Network must have at least one heat or temperature source')
  }

  // Check for at least one sink/ambient
  const hasSinks = components.some(c => c.type === 'ambient')
  if (!hasSinks) {
    warnings.push('Network should have ambient reference for proper analysis')
  }

  // Check component parameters
  for (const comp of components) {
    switch (comp.type) {
      case 'thermal-resistance':
        if ((comp.parameters.resistance || 0) <= 0) {
          errors.push(`Thermal resistance must be positive: ${comp.name}`)
        }
        break
      case 'thermal-capacitance':
        if ((comp.parameters.capacity || 0) <= 0) {
          errors.push(`Thermal capacitance must be positive: ${comp.name}`)
        }
        break
      case 'heat-source':
        if ((comp.parameters.power || 0) < 0) {
          warnings.push(`Heat source power is negative: ${comp.name}`)
        }
        break
    }
  }

  // Check for isolated components
  const connectedComponents = new Set<string>()
  for (const conn of connections) {
    connectedComponents.add(conn.from)
    connectedComponents.add(conn.to)
  }

  for (const comp of components) {
    if (!connectedComponents.has(comp.id)) {
      warnings.push(`Unconnected component: ${comp.name}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Analyze thermal network using steady-state analysis
 * Solves the thermal network to find equilibrium temperatures and heat flows
 */
export function analyzeNetwork(components: ThermalComponent[], connections: ThermalConnection[]): AnalysisData {
  // Build adjacency matrix for thermal network
  const componentMap = new Map(components.map(c => [c.id, c]))
  const n = components.length
  const indices = new Map(components.map((c, i) => [c.id, i]))

  // Conductance matrix (1/R for thermal resistances)
  const G: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0))

  // Current vector (power for heat sources)
  const I: number[] = Array(n).fill(0)

  // Process components
  let ambientIndex = -1
  for (let i = 0; i < n; i++) {
    const comp = components[i]
    if (comp.type === 'ambient') {
      ambientIndex = i
      I[i] = (comp.parameters.temperature || 300) * 100 // Ambient reference
    } else if (comp.type === 'heat-source') {
      I[i] = comp.parameters.power || 0
    }
  }

  // Process connections (thermal resistances)
  for (const conn of connections) {
    const fromIdx = indices.get(conn.from)
    const toIdx = indices.get(conn.to)

    if (fromIdx === undefined || toIdx === undefined) continue

    const fromComp = componentMap.get(conn.from)
    if (!fromComp) continue

    let conductance = 1.0 // Default conductance
    if (fromComp.type === 'thermal-resistance') {
      const R = fromComp.parameters.resistance || 0.1
      conductance = 1 / R
    }

    // Fill conductance matrix
    G[fromIdx][fromIdx] += conductance
    G[fromIdx][toIdx] -= conductance
    G[toIdx][fromIdx] -= conductance
    G[toIdx][toIdx] += conductance
  }

  // Solve linear system: G * T = I using Gaussian elimination
  const T = gaussianElimination(G, I)

  // Compute heat flows through connections
  const temperatures: Record<string, number> = {}
  const heatFlows: Record<string, number> = {}

  for (let i = 0; i < n; i++) {
    const id = components[i].id
    temperatures[id] = Math.max(0, T[i] || 300) // Clamp to positive
  }

  for (const conn of connections) {
    const fromIdx = indices.get(conn.from)
    const toIdx = indices.get(conn.to)

    if (fromIdx === undefined || toIdx === undefined) continue

    const fromComp = componentMap.get(conn.from)
    if (!fromComp) continue

    let conductance = 1.0
    if (fromComp.type === 'thermal-resistance') {
      const R = fromComp.parameters.resistance || 0.1
      conductance = 1 / R
    }

    const deltaT = (T[fromIdx] || 300) - (T[toIdx] || 300)
    const flow = Math.abs(conductance * deltaT)
    heatFlows[conn.id] = flow
  }

  // Compute thermal path resistance (total from source to ambient)
  let thermalPathResistance = 0
  let totalPower = 0

  for (const comp of components) {
    if (comp.type === 'heat-source') {
      totalPower += comp.parameters.power || 0
    }
  }

  if (totalPower > 0 && ambientIndex >= 0) {
    const ambientTemp = components[ambientIndex].parameters.temperature || 300
    const maxTemp = Math.max(...Object.values(temperatures))
    thermalPathResistance = Math.max(0, (maxTemp - ambientTemp) / totalPower)
  }

  return {
    steadyState: {
      temperatures,
      heatFlows,
    },
    transient: {
      time: [0],
      temperatures: Object.fromEntries(Object.entries(temperatures).map(([id, temp]) => [id, [temp]])),
      heatFlows: Object.fromEntries(Object.entries(heatFlows).map(([id, flow]) => [id, [flow]])),
    },
    thermalPathResistance,
    totalPowerDissipation: totalPower,
  }
}

/**
 * Gaussian elimination solver for linear system Ax=b
 */
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length
  const aug: number[][] = A.map((row, i) => [...row, b[i]])

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k
      }
    }

    // Swap rows
    ;[aug[i], aug[maxRow]] = [aug[maxRow], aug[i]]

    // Check for singular matrix
    if (Math.abs(aug[i][i]) < 1e-10) {
      continue
    }

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = aug[k][i] / aug[i][i]
      for (let j = i; j <= n; j++) {
        aug[k][j] -= factor * aug[i][j]
      }
    }
  }

  // Back substitution
  const x: number[] = Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j]
    }
    if (Math.abs(aug[i][i]) > 1e-10) {
      x[i] /= aug[i][i]
    }
  }

  return x
}

/**
 * Export thermal network as JSON
 */
export function exportThermalNetwork(components: ThermalComponent[], connections: ThermalConnection[]): string {
  return JSON.stringify(
    {
      components,
      connections,
      timestamp: new Date().toISOString(),
    },
    null,
    2
  )
}

/**
 * Import thermal network from JSON
 */
export function importThermalNetwork(
  json: string
): { components: ThermalComponent[]; connections: ThermalConnection[] } | null {
  try {
    const data = JSON.parse(json)
    return {
      components: data.components || [],
      connections: data.connections || [],
    }
  } catch (error) {
    console.error('Failed to import thermal network:', error)
    return null
  }
}
