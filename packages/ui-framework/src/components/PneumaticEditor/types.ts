/**
 * Pneumatic Editor Types
 *
 * Defines data structures for pneumatic system modeling and simulation.
 * Includes component definitions, system state, and analysis results.
 */

/**
 * Available pneumatic component types
 */
export type PneumaticComponentType =
  | 'compressor'
  | 'tank'
  | 'valve'
  | 'motor'
  | 'cylinder'
  | 'filter'
  | 'regulator'
  | 'muffler'
  | 'pressure-source'
  | 'flow-source';

/**
 * Position interface for component placement
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Parameters for pneumatic components
 */
export interface Parameters {
  [key: string]: number | string | boolean;
}

/**
 * A pneumatic component in the system
 */
export interface PneumaticComponent {
  id: string;
  type: PneumaticComponentType;
  name: string;
  position: Position;
  parameters: Parameters;
}

/**
 * A connection between pneumatic components
 */
export interface PneumaticConnection {
  id: string;
  from: string;
  to: string;
  connection_type: 'pipe' | 'hose' | 'junction';
  length: number; // meters
  diameter: number; // mm
}

/**
 * Editor state for undo/redo management
 */
export interface EditorState {
  components: PneumaticComponent[];
  connections: PneumaticConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { from: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  mode: 'select' | 'pan' | 'connect';
  analysisData?: AnalysisData;
}

/**
 * Steady-state pneumatic analysis results
 */
export interface SteadyState {
  pressures: Record<string, number>; // bar
  flows: Record<string, number>; // m³/min (standard conditions)
  powerOutputs: Record<string, number>; // W
  temperatures: Record<string, number>; // K
}

/**
 * Transient pneumatic analysis results
 */
export interface Transient {
  time: number[]; // seconds
  pressures: Record<string, number[]>;
  flows: Record<string, number[]>;
  temperatures: Record<string, number[]>;
}

/**
 * Energy analysis for pneumatic systems
 */
export interface EnergyAnalysis {
  inputPower: number; // W (compressor input)
  outputPower: number; // W (useful work in motors/cylinders)
  lossesHeat: number; // W (heat losses in expansion, friction)
  lossesNoise: number; // W (energy dissipated as noise)
  efficiency: number; // 0-1 (output / input)
  airTemperature: number; // K
  airDensity: number; // kg/m³
}

/**
 * Complete analysis results for pneumatic system
 */
export interface AnalysisData {
  steadyState: SteadyState;
  transient: Transient;
  energyAnalysis: EnergyAnalysis;
  systemPressure: number; // bar
  systemFlow: number; // m³/min
  compressorDisplacement: number; // m³/rev
  motorDisplacement: number; // m³/rev
}

/**
 * Component properties (display and default values)
 */
interface ComponentProperty {
  label: string;
  description: string;
  color: string;
  defaultParameters: Parameters;
}

/**
 * Default parameters for each component type
 */
export const DEFAULT_PARAMETERS: Record<PneumaticComponentType, Parameters> = {
  compressor: {
    displacement: 50, // m³/rev
    speed: 1500, // rpm
    efficiency: 0.85,
    intake_pressure: 1.0, // bar (atmospheric)
  },
  tank: {
    volume: 100, // liters
    precharge_pressure: 1.0, // bar
    max_pressure: 8.0, // bar
    temperature: 293, // K (20°C)
  },
  valve: {
    spool_position: 0.0, // -1 to +1
    flow_capacity: 300, // m³/min (standard)
    cracking_pressure: 0.5, // bar
    response_time: 0.05, // seconds
  },
  motor: {
    displacement: 50, // m³/rev
    speed: 0, // rpm (output)
    load_torque: 50, // N·m
    efficiency: 0.9,
  },
  cylinder: {
    bore_diameter: 50, // mm
    rod_diameter: 20, // mm
    stroke: 200, // mm
    load: 5000, // N
  },
  filter: {
    micron_rating: 5, // μm
    flow_capacity: 500, // m³/min
    clogging_factor: 0.0, // 0-1
    pressure_drop_clean: 0.1, // bar
  },
  regulator: {
    set_pressure: 6.0, // bar
    flow_capacity: 300, // m³/min
    response_time: 0.1, // seconds
    hysteresis: 0.2, // bar
  },
  muffler: {
    volume: 2, // liters
    flow_capacity: 500, // m³/min
    noise_reduction: 15, // dB
    exhaust_back_pressure: 0.5, // bar
  },
  'pressure-source': {
    pressure: 6.0, // bar
    temperature: 293, // K
  },
  'flow-source': {
    flow: 100, // m³/min (standard)
    temperature: 293, // K
  },
};

/**
 * Component display properties (for UI)
 */
export const COMPONENT_PROPERTIES: Record<PneumaticComponentType, ComponentProperty> = {
  compressor: {
    label: 'Compressor',
    description: 'Air generation (displacement, speed, efficiency)',
    color: '#e74c3c',
    defaultParameters: DEFAULT_PARAMETERS.compressor,
  },
  tank: {
    label: 'Tank',
    description: 'Air storage (volume, precharge, max pressure)',
    color: '#3498db',
    defaultParameters: DEFAULT_PARAMETERS.tank,
  },
  valve: {
    label: 'Valve',
    description: 'Directional control (spool, flow capacity, cracking pressure)',
    color: '#f39c12',
    defaultParameters: DEFAULT_PARAMETERS.valve,
  },
  motor: {
    label: 'Motor',
    description: 'Pneumatic actuator (displacement, speed, torque)',
    color: '#9b59b6',
    defaultParameters: DEFAULT_PARAMETERS.motor,
  },
  cylinder: {
    label: 'Cylinder',
    description: 'Linear actuator (bore, rod, stroke, load)',
    color: '#1abc9c',
    defaultParameters: DEFAULT_PARAMETERS.cylinder,
  },
  filter: {
    label: 'Filter',
    description: 'Contamination removal (micron rating, flow capacity)',
    color: '#95a5a6',
    defaultParameters: DEFAULT_PARAMETERS.filter,
  },
  regulator: {
    label: 'Regulator',
    description: 'Pressure control (set pressure, hysteresis)',
    color: '#34495e',
    defaultParameters: DEFAULT_PARAMETERS.regulator,
  },
  muffler: {
    label: 'Muffler',
    description: 'Exhaust silencing (volume, noise reduction)',
    color: '#7f8c8d',
    defaultParameters: DEFAULT_PARAMETERS.muffler,
  },
  'pressure-source': {
    label: 'Pressure Source',
    description: 'Constant pressure boundary condition',
    color: '#c0392b',
    defaultParameters: DEFAULT_PARAMETERS['pressure-source'],
  },
  'flow-source': {
    label: 'Flow Source',
    description: 'Constant flow boundary condition',
    color: '#16a085',
    defaultParameters: DEFAULT_PARAMETERS['flow-source'],
  },
};
