/**
 * Hydraulic System Editor - Type Definitions
 *
 * Supports hydraulic circuit analysis with components:
 * - Pumps, motors, accumulators, pipes, valves, cylinders
 */

export type HydraulicComponentType =
  | 'pump'
  | 'motor'
  | 'accumulator'
  | 'pipe'
  | 'valve'
  | 'cylinder'
  | 'filter'
  | 'pressure-source'
  | 'flow-source'
  | 'tank'
  | 'check-valve'
  | 'relief-valve';

export interface Position {
  x: number;
  y: number;
}

export interface Parameters {
  [key: string]: number | string;
}

export interface HydraulicComponent {
  id: string;
  type: HydraulicComponentType;
  name: string;
  position: Position;
  parameters: Parameters;
}

export interface HydraulicConnection {
  id: string;
  from: string;
  to: string;
  connection_type: 'pipe' | 'hose' | 'junction';
  length: number; // meters
  diameter: number; // mm
}

export interface EditorState {
  components: HydraulicComponent[];
  connections: HydraulicConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { from: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  mode: 'select' | 'pan' | 'connect';
}

export interface SimulationState {
  isRunning: boolean;
  currentTime: number;
  timeStep: number;
  simulationSpeed: number;
}

export interface SteadyState {
  pressures: Record<string, number>; // Pa
  flows: Record<string, number>; // L/min
  powerOutputs: Record<string, number>; // W
}

export interface TransientAnalysis {
  time: number[];
  pressures: Record<string, number[]>;
  flows: Record<string, number[]>;
  temperatures: Record<string, number[]>;
}

export interface EnergyAnalysis {
  inputPower: number; // W
  outputPower: number; // W
  heatDissipated: number; // W
  efficiency: number; // 0-1
  fluidTemperature: number; // K
}

export interface AnalysisData {
  steadyState: SteadyState;
  transient: TransientAnalysis;
  energyAnalysis: EnergyAnalysis;
  systemPressure: number; // Pa
  systemFlow: number; // L/min
  pumpDisplacement: number; // cm³/rev
  motorDisplacement: number; // cm³/rev
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ComponentProperties {
  label: string;
  description: string;
  color: string;
  icon?: string;
  defaultParameters: Parameters;
}

// Component properties configuration
export const COMPONENT_PROPERTIES: Record<HydraulicComponentType, ComponentProperties> = {
  pump: {
    label: 'Pump',
    description: 'Hydraulic pump (gear, piston, vane)',
    color: '#ff6b6b',
    defaultParameters: {
      displacement: 10, // cm³/rev
      speed: 1500, // rpm
      efficiency: 0.9,
    },
  },
  motor: {
    label: 'Motor',
    description: 'Hydraulic motor with load',
    color: '#4ecdc4',
    defaultParameters: {
      displacement: 5, // cm³/rev
      speed: 1000, // rpm
      load_torque: 100, // N·m
    },
  },
  accumulator: {
    label: 'Accumulator',
    description: 'Energy storage (bladder, piston)',
    color: '#95e1d3',
    defaultParameters: {
      volume: 1.0, // liters
      precharge: 5.0, // bar
      max_pressure: 250, // bar
    },
  },
  pipe: {
    label: 'Pipe',
    description: 'Hydraulic pipeline with friction losses',
    color: '#c7b3d4',
    defaultParameters: {
      length: 1.0, // meters
      diameter: 12.7, // mm (1/2 inch)
      roughness: 0.045, // mm
    },
  },
  valve: {
    label: 'Valve',
    description: 'Directional control valve',
    color: '#f7b731',
    defaultParameters: {
      spool_position: 0, // 0=neutral, ±1=max
      flow_capacity: 60, // L/min
      cracking_pressure: 20, // bar
    },
  },
  cylinder: {
    label: 'Cylinder',
    description: 'Hydraulic actuator (linear)',
    color: '#5f27cd',
    defaultParameters: {
      bore_diameter: 50, // mm
      rod_diameter: 32, // mm
      stroke: 500, // mm
      load: 5000, // N
    },
  },
  filter: {
    label: 'Filter',
    description: 'Contamination filter with pressure drop',
    color: '#ee5a6f',
    defaultParameters: {
      micron_rating: 10, // μm
      flow_capacity: 100, // L/min
      clogging_factor: 1.0,
    },
  },
  'pressure-source': {
    label: 'Pressure Source',
    description: 'Constant pressure boundary',
    color: '#fa8072',
    defaultParameters: {
      pressure: 210, // bar
    },
  },
  'flow-source': {
    label: 'Flow Source',
    description: 'Constant flow boundary',
    color: '#20b2aa',
    defaultParameters: {
      flow: 30, // L/min
    },
  },
  tank: {
    label: 'Tank',
    description: 'Fluid reservoir at atmospheric pressure',
    color: '#a9a9a9',
    defaultParameters: {
      volume: 100, // liters
      temperature: 313, // K (40°C)
    },
  },
  'check-valve': {
    label: 'Check Valve',
    description: 'One-way valve (no backflow)',
    color: '#daa520',
    defaultParameters: {
      cracking_pressure: 5, // bar
      flow_capacity: 60, // L/min
    },
  },
  'relief-valve': {
    label: 'Relief Valve',
    description: 'Pressure relief / overpressure protection',
    color: '#ff4500',
    defaultParameters: {
      set_pressure: 250, // bar
      flow_capacity: 100, // L/min
      hysteresis: 10, // bar
    },
  },
};

// Default parameters for new components
export const DEFAULT_PARAMETERS: Record<HydraulicComponentType, Parameters> = {
  pump: COMPONENT_PROPERTIES.pump.defaultParameters,
  motor: COMPONENT_PROPERTIES.motor.defaultParameters,
  accumulator: COMPONENT_PROPERTIES.accumulator.defaultParameters,
  pipe: COMPONENT_PROPERTIES.pipe.defaultParameters,
  valve: COMPONENT_PROPERTIES.valve.defaultParameters,
  cylinder: COMPONENT_PROPERTIES.cylinder.defaultParameters,
  filter: COMPONENT_PROPERTIES.filter.defaultParameters,
  'pressure-source': COMPONENT_PROPERTIES['pressure-source'].defaultParameters,
  'flow-source': COMPONENT_PROPERTIES['flow-source'].defaultParameters,
  tank: COMPONENT_PROPERTIES.tank.defaultParameters,
  'check-valve': COMPONENT_PROPERTIES['check-valve'].defaultParameters,
  'relief-valve': COMPONENT_PROPERTIES['relief-valve'].defaultParameters,
};

/**
 * Get bounding box for a component
 */
export function getComponentBounds(
  component: HydraulicComponent
): { x: number; y: number; width: number; height: number } {
  const bounds = { x: 0, y: 0, width: 70, height: 50 };

  if (component.type === 'pump' || component.type === 'motor') {
    bounds.width = 60;
    bounds.height = 60;
  } else if (component.type === 'tank') {
    bounds.width = 80;
    bounds.height = 60;
  }

  return {
    x: component.position.x - bounds.width / 2,
    y: component.position.y - bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * Check if point is inside component bounds
 */
export function pointInBounds(
  point: Position,
  component: HydraulicComponent
): boolean {
  const bounds = getComponentBounds(component);
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
