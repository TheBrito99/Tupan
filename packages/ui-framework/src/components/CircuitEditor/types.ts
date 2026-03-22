/**
 * Circuit Editor - Type Definitions
 *
 * Electrical circuit components, connections, and analysis types.
 * Supports DC/AC analysis with Modified Nodal Analysis (MNA) solver.
 */

/**
 * Electrical component types
 */
export type CircuitComponentType =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'voltage-source'
  | 'current-source'
  | 'ground'
  | 'wire'
  | 'op-amp'
  | 'switch'
  | 'diode'
  | 'transformer';

/**
 * Component parameter definitions
 */
export interface ComponentParameters {
  resistor: { resistance: number }; // Ohms
  capacitor: { capacitance: number }; // Farads
  inductor: { inductance: number }; // Henries
  'voltage-source': { voltage: number; frequency?: number }; // Volts, Hz
  'current-source': { current: number; frequency?: number }; // Amps, Hz
  'ground': {}; // No parameters
  'wire': {}; // No parameters
  'op-amp': { gain: number; inputImpedance: number; outputImpedance: number };
  'switch': { isOpen: boolean }; // true = open circuit, false = closed
  'diode': { forwardVoltage: number; saturationCurrent: number };
  'transformer': { ratio: number; inductance: number }; // turns ratio, primary inductance
}

export type Parameters = Partial<{
  resistance: number;
  capacitance: number;
  inductance: number;
  voltage: number;
  current: number;
  frequency: number;
  gain: number;
  inputImpedance: number;
  outputImpedance: number;
  isOpen: boolean;
  forwardVoltage: number;
  saturationCurrent: number;
  ratio: number;
}>;

/**
 * Position interface
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Port interface for component connections
 */
export interface Port {
  id: string;
  name: string;
  direction: 'input' | 'output' | 'both';
  dataType: 'voltage' | 'current' | 'mixed';
  voltage?: number;
  current?: number;
}

/**
 * Circuit component
 */
export interface CircuitComponent {
  id: string;
  type: CircuitComponentType;
  name: string;
  position: Position;
  parameters: Parameters;
  ports: Port[];
  node1: string; // First connection node (positive/anode)
  node2: string; // Second connection node (negative/cathode)
  rotation?: number; // Degrees: 0, 90, 180, 270
}

/**
 * Circuit connection between components
 */
export interface CircuitConnection {
  id: string;
  from: string; // Component ID
  fromPort: string; // Port ID
  to: string; // Component ID
  toPort: string; // Port ID
}

/**
 * Simulation result
 */
export interface SimulationResult {
  time: number[];
  voltages: { [nodeId: string]: number[] };
  currents: { [componentId: string]: number[] };
  power: { [componentId: string]: number[] };
  finalState: { [key: string]: number };
}

/**
 * Editor state
 */
export interface EditorState {
  components: CircuitComponent[];
  connections: CircuitConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { fromId: string; fromPort: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  simulationRunning: boolean;
  simulationResult: SimulationResult | null;
}

/**
 * Analysis data (DC operating point)
 */
export interface AnalysisData {
  nodeVoltages: { [nodeId: string]: number };
  componentCurrents: { [componentId: string]: number };
  power: { [componentId: string]: number };
  totalPower: number;
}

/**
 * Component properties for display
 */
export interface ComponentProperties {
  label: string;
  icon: string;
  color: string;
  description: string;
  ports: Port[];
  defaultValue: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiresGround: boolean;
}

/**
 * Component properties mapping
 */
export const COMPONENT_PROPERTIES: Record<CircuitComponentType, ComponentProperties> = {
  resistor: {
    label: 'Resistor',
    icon: '⊣⊢',
    color: '#e74c3c',
    description: 'Resistive element (V = I × R)',
    ports: [
      { id: 'p1', name: 'Positive', direction: 'both', dataType: 'voltage' },
      { id: 'p2', name: 'Negative', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 1000, // 1kΩ
  },
  capacitor: {
    label: 'Capacitor',
    icon: '||',
    color: '#3498db',
    description: 'Capacitive element (I = C × dV/dt)',
    ports: [
      { id: 'p1', name: 'Positive', direction: 'both', dataType: 'voltage' },
      { id: 'p2', name: 'Negative', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 1e-6, // 1µF
  },
  inductor: {
    label: 'Inductor',
    icon: '⊙⊙',
    color: '#2ecc71',
    description: 'Inductive element (V = L × dI/dt)',
    ports: [
      { id: 'p1', name: 'Positive', direction: 'both', dataType: 'voltage' },
      { id: 'p2', name: 'Negative', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 1e-3, // 1mH
  },
  'voltage-source': {
    label: 'Voltage Source',
    icon: '⊕',
    color: '#e67e22',
    description: 'Fixed voltage source (DC or AC)',
    ports: [
      { id: 'p1', name: 'Positive', direction: 'output', dataType: 'voltage' },
      { id: 'p2', name: 'Negative', direction: 'output', dataType: 'voltage' },
    ],
    defaultValue: 5, // 5V
  },
  'current-source': {
    label: 'Current Source',
    icon: '→',
    color: '#f39c12',
    description: 'Fixed current source (DC or AC)',
    ports: [
      { id: 'p1', name: 'Positive', direction: 'output', dataType: 'current' },
      { id: 'p2', name: 'Negative', direction: 'output', dataType: 'current' },
    ],
    defaultValue: 1e-3, // 1mA
  },
  ground: {
    label: 'Ground',
    icon: '⏚',
    color: '#34495e',
    description: 'Ground reference (0V)',
    ports: [
      { id: 'p1', name: 'Ground', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 0,
  },
  wire: {
    label: 'Wire',
    icon: '—',
    color: '#7f8c8d',
    description: 'Perfect conductor (0Ω, 0V drop)',
    ports: [
      { id: 'p1', name: 'Node1', direction: 'both', dataType: 'voltage' },
      { id: 'p2', name: 'Node2', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 0,
  },
  'op-amp': {
    label: 'Op-Amp',
    icon: '▷',
    color: '#9b59b6',
    description: 'Operational amplifier (high-gain voltage amplifier)',
    ports: [
      { id: 'in_p', name: 'Non-inverting', direction: 'input', dataType: 'voltage' },
      { id: 'in_n', name: 'Inverting', direction: 'input', dataType: 'voltage' },
      { id: 'out', name: 'Output', direction: 'output', dataType: 'voltage' },
      { id: 'vcc', name: 'V+', direction: 'input', dataType: 'voltage' },
      { id: 'vee', name: 'V-', direction: 'input', dataType: 'voltage' },
    ],
    defaultValue: 100000, // 100k gain
  },
  switch: {
    label: 'Switch',
    icon: '⊗',
    color: '#95a5a6',
    description: 'Controllable switch (open/closed)',
    ports: [
      { id: 'p1', name: 'Positive', direction: 'both', dataType: 'voltage' },
      { id: 'p2', name: 'Negative', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 0,
  },
  diode: {
    label: 'Diode',
    icon: '▷|',
    color: '#c0392b',
    description: 'Semiconductor diode (one-way conductor)',
    ports: [
      { id: 'anode', name: 'Anode', direction: 'both', dataType: 'voltage' },
      { id: 'cathode', name: 'Cathode', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 0.7, // Forward voltage drop
  },
  transformer: {
    label: 'Transformer',
    icon: '⌀',
    color: '#1abc9c',
    description: 'AC transformer (voltage/current coupling)',
    ports: [
      { id: 'p1', name: 'Primary 1', direction: 'both', dataType: 'voltage' },
      { id: 'p2', name: 'Primary 2', direction: 'both', dataType: 'voltage' },
      { id: 's1', name: 'Secondary 1', direction: 'both', dataType: 'voltage' },
      { id: 's2', name: 'Secondary 2', direction: 'both', dataType: 'voltage' },
    ],
    defaultValue: 1, // 1:1 turns ratio
  },
};

/**
 * Default component parameters
 */
export const DEFAULT_PARAMETERS: Record<CircuitComponentType, Parameters> = {
  resistor: { resistance: 1000 },
  capacitor: { capacitance: 1e-6 },
  inductor: { inductance: 1e-3 },
  'voltage-source': { voltage: 5, frequency: 0 },
  'current-source': { current: 1e-3, frequency: 0 },
  ground: {},
  wire: {},
  'op-amp': { gain: 100000, inputImpedance: 1e6, outputImpedance: 75 },
  switch: { isOpen: false },
  diode: { forwardVoltage: 0.7, saturationCurrent: 1e-12 },
  transformer: { ratio: 1, inductance: 1e-3 },
};
