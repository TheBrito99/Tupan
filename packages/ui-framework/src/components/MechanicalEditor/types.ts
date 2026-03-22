/**
 * Mechanical System Editor Type Definitions
 *
 * Supports mass-spring-damper systems, rigid bodies, and mechanical linkages.
 * Components can be combined into complex mechanical networks for simulation.
 */

export type MechanicalComponentType =
  | 'mass'
  | 'spring'
  | 'damper'
  | 'force-source'
  | 'velocity-source'
  | 'ground'
  | 'joint'
  | 'constraint';

export interface Position {
  x: number;
  y: number;
}

export interface Parameters {
  // Mass parameters
  mass?: number; // kg
  inertia?: number; // kg·m²

  // Spring parameters
  stiffness?: number; // N/m
  natural_length?: number; // m

  // Damper parameters
  damping?: number; // N·s/m (viscous damping coefficient)

  // Force source parameters
  force?: number; // N
  direction?: number; // degrees (0 = right, 90 = up, 180 = left, 270 = down)

  // Velocity source parameters
  velocity?: number; // m/s

  // Joint parameters
  joint_type?: 'revolute' | 'prismatic' | 'fixed';
  joint_position?: Position;

  // Constraint parameters
  constraint_type?: 'distance' | 'angle' | 'parallel' | 'perpendicular';
  constraint_value?: number;
}

export interface MechanicalComponent {
  id: string;
  type: MechanicalComponentType;
  name: string;
  position: Position;
  parameters: Parameters;
}

export interface MechanicalConnection {
  id: string;
  from: string; // Component ID
  to: string; // Component ID
  connection_type: 'rigid' | 'spring' | 'damper' | 'flexible';
  length?: number; // Distance between components (m)
}

export interface EditorState {
  components: MechanicalComponent[];
  connections: MechanicalConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { from: string; to?: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  mode: 'select' | 'pan' | 'connect';
}

export interface SimulationState {
  isRunning: boolean;
  currentTime: number;
  timeStep: number;
  simulationSpeed: number; // 1.0 = real-time
}

export interface AnalysisData {
  steadyState: {
    displacements: Record<string, number>; // Position of each mass (m)
    velocities: Record<string, number>; // Velocity of each mass (m/s)
    accelerations: Record<string, number>; // Acceleration (m/s²)
    forces: Record<string, number>; // Applied forces (N)
  };
  transient: {
    time: number[]; // Time points
    positions: Record<string, number[]>; // Position history
    velocities: Record<string, number[]>; // Velocity history
    energies: Record<string, number[]>; // Energy history
  };
  energyAnalysis: {
    totalKineticEnergy: number; // J
    totalPotentialEnergy: number; // J (stored in springs)
    totalDissipatedEnergy: number; // J (lost in dampers)
    totalEnergy: number; // J
  };
  resonanceFrequency?: number; // Hz (natural frequency)
  dampingRatio?: number; // Unitless (0 = undamped, 1 = critically damped)
}

export interface ComponentProperties {
  label: string;
  description: string;
  color: string;
  icon: string;
  defaultParameters: Parameters;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Component properties definition
export const COMPONENT_PROPERTIES: Record<MechanicalComponentType, ComponentProperties> = {
  mass: {
    label: 'Mass',
    description: 'A point mass or rigid body',
    color: '#ff6b6b',
    icon: '●',
    defaultParameters: { mass: 1.0 },
  },
  spring: {
    label: 'Spring',
    description: 'Linear spring element (Hooke\'s law)',
    color: '#4c6ef5',
    icon: '∿',
    defaultParameters: { stiffness: 100, natural_length: 0.1 },
  },
  damper: {
    label: 'Damper',
    description: 'Viscous damping element',
    color: '#ffd43b',
    icon: '⊣',
    defaultParameters: { damping: 10 },
  },
  'force-source': {
    label: 'Force Source',
    description: 'Applied force input',
    color: '#51cf66',
    icon: '→',
    defaultParameters: { force: 10, direction: 0 },
  },
  'velocity-source': {
    label: 'Velocity Source',
    description: 'Prescribed velocity input',
    color: '#a78bfa',
    icon: '⇒',
    defaultParameters: { velocity: 1.0 },
  },
  ground: {
    label: 'Ground',
    description: 'Fixed reference point',
    color: '#666666',
    icon: '⊥',
    defaultParameters: {},
  },
  joint: {
    label: 'Joint',
    description: 'Connection between components',
    color: '#20c997',
    icon: '◯',
    defaultParameters: { joint_type: 'revolute' },
  },
  constraint: {
    label: 'Constraint',
    description: 'Kinematic constraint',
    color: '#ff8787',
    icon: '⊗',
    defaultParameters: { constraint_type: 'distance' },
  },
};

// Default parameters for new components
export const DEFAULT_PARAMETERS: Record<MechanicalComponentType, Parameters> = {
  mass: { mass: 1.0, inertia: 0.1 },
  spring: { stiffness: 100, natural_length: 0.1 },
  damper: { damping: 10 },
  'force-source': { force: 10, direction: 0 },
  'velocity-source': { velocity: 1.0 },
  ground: {},
  joint: { joint_type: 'revolute' },
  constraint: { constraint_type: 'distance', constraint_value: 1.0 },
};

/**
 * Utility: Get component bounds for collision detection
 */
export function getComponentBounds(
  component: MechanicalComponent,
  size: number = 40
): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: component.position.x - size / 2,
    maxX: component.position.x + size / 2,
    minY: component.position.y - size / 2,
    maxY: component.position.y + size / 2,
  };
}

/**
 * Utility: Check if point is within component bounds
 */
export function pointInBounds(
  point: Position,
  bounds: ReturnType<typeof getComponentBounds>
): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

/**
 * Utility: Calculate distance between two points
 */
export function distance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
