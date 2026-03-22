/**
 * Mechanical System Analysis & Validation
 *
 * Supports:
 * - Network validation (topology, parameter constraints)
 * - Static equilibrium analysis
 * - Frequency response (resonance detection)
 * - Energy analysis (kinetic, potential, dissipated)
 */

import { MechanicalComponent, MechanicalConnection, AnalysisData } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate mechanical network for correctness
 */
export function validateMechanicalNetwork(
  components: MechanicalComponent[],
  connections: MechanicalConnection[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required components
  const hasGround = components.some(c => c.type === 'ground');
  if (!hasGround) {
    errors.push('Network must have at least one ground (reference) component');
  }

  const hasForceOrVelocity = components.some(
    c => c.type === 'force-source' || c.type === 'velocity-source'
  );
  if (!hasForceOrVelocity) {
    warnings.push('Network has no input sources (force or velocity)');
  }

  // Validate component parameters
  for (const comp of components) {
    if (comp.type === 'mass') {
      const mass = comp.parameters.mass || 0;
      const inertia = comp.parameters.inertia || 0;
      if (mass <= 0) errors.push(`Mass component "${comp.name}" must have positive mass`);
      if (inertia < 0) errors.push(`Mass component "${comp.name}" must have non-negative inertia`);
    }

    if (comp.type === 'spring') {
      const stiffness = comp.parameters.stiffness || 0;
      const naturalLength = comp.parameters.natural_length || 0;
      if (stiffness <= 0) errors.push(`Spring component "${comp.name}" must have positive stiffness`);
      if (naturalLength < 0) errors.push(`Spring component "${comp.name}" must have non-negative natural length`);
    }

    if (comp.type === 'damper') {
      const damping = comp.parameters.damping || 0;
      if (damping < 0) errors.push(`Damper component "${comp.name}" must have non-negative damping`);
    }

    if (comp.type === 'force-source') {
      const force = comp.parameters.force || 0;
      if (Math.abs(force) > 1000000) {
        warnings.push(`Force source "${comp.name}" has very large value: ${force} N`);
      }
    }
  }

  // Validate connections
  for (const conn of connections) {
    const fromComp = components.find(c => c.id === conn.from);
    const toComp = components.find(c => c.id === conn.to);

    if (!fromComp) errors.push(`Connection references missing component: ${conn.from}`);
    if (!toComp) errors.push(`Connection references missing component: ${conn.to}`);

    if (conn.length && conn.length < 0) {
      errors.push(`Connection length must be non-negative: ${conn.length}`);
    }
  }

  // Check for isolated components
  const connectedIds = new Set<string>();
  for (const conn of connections) {
    connectedIds.add(conn.from);
    connectedIds.add(conn.to);
  }

  for (const comp of components) {
    if (!connectedIds.has(comp.id) && comp.type !== 'ground') {
      warnings.push(`Component "${comp.name}" is not connected to any other component`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Analyze mechanical network for steady-state and dynamic response
 */
export function analyzeNetwork(
  components: MechanicalComponent[],
  connections: MechanicalConnection[]
): AnalysisData {
  // Build system stiffness matrix and mass matrix
  const n = components.length;

  // Initialize matrices (simplified: assume diagonal structure)
  const K: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0)); // Stiffness matrix
  const M: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0)); // Mass matrix
  const C: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0)); // Damping matrix
  const F: number[] = Array(n).fill(0); // Force vector

  const componentIndexMap = new Map<string, number>();
  components.forEach((comp, idx) => {
    componentIndexMap.set(comp.id, idx);
  });

  // Populate matrices from components
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];

    if (comp.type === 'mass') {
      const mass = comp.parameters.mass || 1.0;
      M[i][i] = mass;
    }

    if (comp.type === 'force-source') {
      const force = comp.parameters.force || 0;
      F[i] = force;
    }
  }

  // Populate stiffness and damping from connections
  for (const conn of connections) {
    if (conn.connection_type === 'spring') {
      const fromIdx = componentIndexMap.get(conn.from);
      const toIdx = componentIndexMap.get(conn.to);

      if (fromIdx !== undefined && toIdx !== undefined) {
        const springComp = components.find(c => c.type === 'spring');
        const stiffness = springComp?.parameters.stiffness || 100;

        K[fromIdx][fromIdx] += stiffness;
        K[toIdx][toIdx] += stiffness;
        K[fromIdx][toIdx] -= stiffness;
        K[toIdx][fromIdx] -= stiffness;
      }
    }

    if (conn.connection_type === 'damping') {
      const fromIdx = componentIndexMap.get(conn.from);
      const toIdx = componentIndexMap.get(conn.to);

      if (fromIdx !== undefined && toIdx !== undefined) {
        const damperComp = components.find(c => c.type === 'damper');
        const damping = damperComp?.parameters.damping || 1.0;

        C[fromIdx][fromIdx] += damping;
        C[toIdx][toIdx] += damping;
        C[fromIdx][toIdx] -= damping;
        C[toIdx][fromIdx] -= damping;
      }
    }
  }

  // Solve K·x = F for static displacements
  const displacements = gaussianElimination(K, F);

  // Compute velocities (assume zero initial velocity)
  const velocities = Array(n).fill(0);

  // Compute accelerations: M·a = F - K·x - C·v
  const Kx = matrixVectorMultiply(K, displacements);
  const Cv = matrixVectorMultiply(C, velocities);
  const accelerations: number[] = [];

  for (let i = 0; i < n; i++) {
    const mass = M[i][i] || 1.0;
    if (mass > 0) {
      accelerations[i] = (F[i] - Kx[i] - Cv[i]) / mass;
    } else {
      accelerations[i] = 0;
    }
  }

  // Calculate resonance frequency and damping ratio
  let totalMass = 0;
  let totalStiffness = 0;
  for (let i = 0; i < n; i++) {
    totalMass += M[i][i] || 0;
    totalStiffness += K[i][i] || 0;
  }

  const resonanceFrequency =
    totalMass > 0 && totalStiffness > 0 ? Math.sqrt(totalStiffness / totalMass) : 0;
  let totalDamping = 0;
  for (let i = 0; i < n; i++) {
    totalDamping += C[i][i] || 0;
  }
  const criticalDamping = 2 * Math.sqrt(totalMass * totalStiffness);
  const dampingRatio = totalDamping / criticalDamping;

  // Compute energies
  let kineticEnergy = 0;
  let potentialEnergy = 0;
  let dissipatedEnergy = 0;

  for (let i = 0; i < n; i++) {
    const mass = M[i][i] || 0;
    const disp = displacements[i] || 0;
    const vel = velocities[i] || 0;

    kineticEnergy += 0.5 * mass * vel * vel;
    potentialEnergy += 0.5 * (K[i][i] || 0) * disp * disp;

    // Dissipation in dampers (simplified)
    const damping = C[i][i] || 0;
    dissipatedEnergy += damping * vel * vel;
  }

  const totalEnergy = kineticEnergy + potentialEnergy;

  // Compute heat flows (force × velocity)
  const heatFlows: Record<string, number> = {};
  for (const conn of connections) {
    const fromIdx = componentIndexMap.get(conn.from);
    const toIdx = componentIndexMap.get(conn.to);
    if (fromIdx !== undefined && toIdx !== undefined) {
      const force = Math.abs((displacements[fromIdx] || 0) - (displacements[toIdx] || 0));
      const velocity = Math.abs((velocities[fromIdx] || 0) - (velocities[toIdx] || 0));
      heatFlows[conn.id] = force * velocity;
    }
  }

  return {
    steadyState: {
      displacements: Object.fromEntries(
        components.map((comp, i) => [comp.id, displacements[i] || 0])
      ),
      velocities: Object.fromEntries(
        components.map((comp, i) => [comp.id, velocities[i] || 0])
      ),
      accelerations: Object.fromEntries(
        components.map((comp, i) => [comp.id, accelerations[i] || 0])
      ),
      forces: Object.fromEntries(
        components.map((comp, i) => [comp.id, F[i] || 0])
      ),
    },
    transient: {
      time: [],
      displacements: [],
      velocities: [],
      accelerations: [],
    },
    energyAnalysis: {
      kineticEnergy,
      potentialEnergy,
      dissipatedEnergy,
      totalEnergy,
      resonanceFrequency,
      dampingRatio,
      heatGenerated: dissipatedEnergy,
    },
  };
}

/**
 * Solve linear system Ax = b using Gaussian elimination
 */
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Check for singular matrix
    if (Math.abs(augmented[i][i]) < 1e-10) {
      return b.slice(); // Return unchanged if singular
    }

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= augmented[i][j] * x[j];
    }
    x[i] = Math.abs(augmented[i][i]) > 1e-10 ? sum / augmented[i][i] : 0;
  }

  return x;
}

/**
 * Matrix-vector multiplication: A × x = b
 */
function matrixVectorMultiply(A: number[][], x: number[]): number[] {
  return A.map(row => row.reduce((sum, val, i) => sum + val * (x[i] || 0), 0));
}

/**
 * Export network to JSON format
 */
export function exportMechanicalNetwork(
  components: MechanicalComponent[],
  connections: MechanicalConnection[]
): string {
  return JSON.stringify({ components, connections }, null, 2);
}

/**
 * Import network from JSON format
 */
export function importMechanicalNetwork(json: string): {
  components: MechanicalComponent[];
  connections: MechanicalConnection[];
} {
  return JSON.parse(json);
}
