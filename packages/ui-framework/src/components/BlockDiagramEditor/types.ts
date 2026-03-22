/**
 * Block Diagram Editor Types
 *
 * Defines types for block diagram components including:
 * - Transfer functions (integrators, differentiators, first/second order)
 * - Control blocks (PID, lead-lag filters)
 * - Signal sources (step, ramp, sine wave)
 * - Nonlinear blocks (saturation, deadzone, hysteresis)
 * - Math operations (gain, sum, product)
 * - Signal routing (multiplexer, demultiplexer)
 */

export type BlockDiagramComponentType =
  | 'transfer-function'
  | 'integrator'
  | 'differentiator'
  | 'gain'
  | 'sum'
  | 'product'
  | 'pid-controller'
  | 'lead-lag-filter'
  | 'low-pass-filter'
  | 'high-pass-filter'
  | 'step-source'
  | 'ramp-source'
  | 'sine-source'
  | 'saturation'
  | 'deadzone'
  | 'hysteresis'
  | 'multiplexer'
  | 'demultiplexer'
  | 'scope';

export interface Position {
  x: number;
  y: number;
}

export interface Parameters {
  [key: string]: number | string | boolean;
}

export interface Port {
  id: string;
  label: string;
  type: 'input' | 'output';
  dataType: 'scalar' | 'vector';
}

export interface BlockDiagramComponent {
  id: string;
  type: BlockDiagramComponentType;
  name: string;
  position: Position;
  parameters: Parameters;
  ports: Port[];
}

export interface BlockDiagramConnection {
  id: string;
  from: string; // source component ID
  to: string; // destination component ID
  fromPort: string; // source port ID
  toPort: string; // destination port ID
}

export interface SimulationResult {
  time: number[];
  signals: { [componentId: string]: number[] };
  finalState: Parameters;
}

export interface EditorState {
  components: BlockDiagramComponent[];
  connections: BlockDiagramConnection[];
  selectedComponentId: string | null;
  draggingComponentId: string | null;
  drawingConnection: { from: string; fromPort: string } | null;
  panX: number;
  panY: number;
  zoom: number;
  simulationRunning: boolean;
  simulationResult: SimulationResult | null;
}

export interface ComponentProperties {
  label: string;
  description: string;
  color: string;
  icon: string;
  defaultParameters: Parameters;
  ports: Port[];
}

export const DEFAULT_PARAMETERS: { [key in BlockDiagramComponentType]: Parameters } = {
  'transfer-function': {
    numerator: '1',
    denominator: '1 0.1',
  },
  'integrator': {
    initialCondition: 0,
  },
  'differentiator': {
    filterCoefficient: 0.1,
  },
  'gain': {
    gain: 1,
  },
  'sum': {
    operation: '+',
  },
  'product': {
    operation: '*',
  },
  'pid-controller': {
    kp: 1.0,
    ki: 0.1,
    kd: 0.01,
    integralLimit: 10,
  },
  'lead-lag-filter': {
    zero: 1.0,
    pole: 10.0,
  },
  'low-pass-filter': {
    cutoffFrequency: 1.0,
  },
  'high-pass-filter': {
    cutoffFrequency: 0.1,
  },
  'step-source': {
    stepTime: 0,
    stepValue: 1,
    initialValue: 0,
  },
  'ramp-source': {
    startTime: 0,
    slope: 1,
    initialValue: 0,
  },
  'sine-source': {
    amplitude: 1,
    frequency: 1,
    phase: 0,
    offset: 0,
  },
  'saturation': {
    minValue: -10,
    maxValue: 10,
  },
  'deadzone': {
    lowerThreshold: -0.1,
    upperThreshold: 0.1,
  },
  'hysteresis': {
    risingThreshold: 0.5,
    fallingThreshold: -0.5,
  },
  'multiplexer': {
    numberOfInputs: 2,
  },
  'demultiplexer': {
    numberOfOutputs: 2,
  },
  'scope': {
    bufferSize: 1000,
  },
};

export const COMPONENT_PROPERTIES: { [key in BlockDiagramComponentType]: ComponentProperties } = {
  'transfer-function': {
    label: 'Transfer Function',
    description: 'Linear transfer function block',
    color: '#3498db',
    icon: 'H(s)',
    defaultParameters: DEFAULT_PARAMETERS['transfer-function'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'integrator': {
    label: 'Integrator',
    description: '∫ u dt block',
    color: '#2ecc71',
    icon: '∫',
    defaultParameters: DEFAULT_PARAMETERS['integrator'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'differentiator': {
    label: 'Differentiator',
    description: 'du/dt block',
    color: '#e74c3c',
    icon: 'd/dt',
    defaultParameters: DEFAULT_PARAMETERS['differentiator'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'gain': {
    label: 'Gain',
    description: 'K × u block',
    color: '#f39c12',
    icon: 'K',
    defaultParameters: DEFAULT_PARAMETERS['gain'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'sum': {
    label: 'Sum',
    description: 'Addition/subtraction block',
    color: '#9b59b6',
    icon: 'Σ',
    defaultParameters: DEFAULT_PARAMETERS['sum'],
    ports: [
      { id: 'in1', label: 'In1', type: 'input', dataType: 'scalar' },
      { id: 'in2', label: 'In2', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'product': {
    label: 'Product',
    description: 'Multiplication block',
    color: '#1abc9c',
    icon: '×',
    defaultParameters: DEFAULT_PARAMETERS['product'],
    ports: [
      { id: 'in1', label: 'In1', type: 'input', dataType: 'scalar' },
      { id: 'in2', label: 'In2', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'pid-controller': {
    label: 'PID Controller',
    description: 'Proportional-Integral-Derivative controller',
    color: '#34495e',
    icon: 'PID',
    defaultParameters: DEFAULT_PARAMETERS['pid-controller'],
    ports: [
      { id: 'error', label: 'Error', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Control', type: 'output', dataType: 'scalar' },
    ],
  },
  'lead-lag-filter': {
    label: 'Lead-Lag Filter',
    description: 'First-order lead-lag compensator',
    color: '#16a085',
    icon: 'Lead-Lag',
    defaultParameters: DEFAULT_PARAMETERS['lead-lag-filter'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'low-pass-filter': {
    label: 'Low-Pass Filter',
    description: 'First-order low-pass filter',
    color: '#8e44ad',
    icon: 'LPF',
    defaultParameters: DEFAULT_PARAMETERS['low-pass-filter'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'high-pass-filter': {
    label: 'High-Pass Filter',
    description: 'First-order high-pass filter',
    color: '#c0392b',
    icon: 'HPF',
    defaultParameters: DEFAULT_PARAMETERS['high-pass-filter'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'step-source': {
    label: 'Step Source',
    description: 'Step signal generator',
    color: '#27ae60',
    icon: 'Step',
    defaultParameters: DEFAULT_PARAMETERS['step-source'],
    ports: [
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'ramp-source': {
    label: 'Ramp Source',
    description: 'Ramp signal generator',
    color: '#229954',
    icon: 'Ramp',
    defaultParameters: DEFAULT_PARAMETERS['ramp-source'],
    ports: [
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'sine-source': {
    label: 'Sine Source',
    description: 'Sinusoidal signal generator',
    color: '#0984e3',
    icon: 'Sin',
    defaultParameters: DEFAULT_PARAMETERS['sine-source'],
    ports: [
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'saturation': {
    label: 'Saturation',
    description: 'Saturating nonlinearity',
    color: '#d35400',
    icon: 'Sat',
    defaultParameters: DEFAULT_PARAMETERS['saturation'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'deadzone': {
    label: 'Deadzone',
    description: 'Deadzone nonlinearity',
    color: '#e67e22',
    icon: 'DZ',
    defaultParameters: DEFAULT_PARAMETERS['deadzone'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'hysteresis': {
    label: 'Hysteresis',
    description: 'Hysteresis nonlinearity',
    color: '#d63031',
    icon: 'Hyst',
    defaultParameters: DEFAULT_PARAMETERS['hysteresis'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'scalar' },
    ],
  },
  'multiplexer': {
    label: 'Multiplexer',
    description: 'Combine multiple signals',
    color: '#00b894',
    icon: 'Mux',
    defaultParameters: DEFAULT_PARAMETERS['multiplexer'],
    ports: [
      { id: 'in1', label: 'In1', type: 'input', dataType: 'scalar' },
      { id: 'in2', label: 'In2', type: 'input', dataType: 'scalar' },
      { id: 'out', label: 'Output', type: 'output', dataType: 'vector' },
    ],
  },
  'demultiplexer': {
    label: 'Demultiplexer',
    description: 'Separate signals',
    color: '#74b9ff',
    icon: 'Demux',
    defaultParameters: DEFAULT_PARAMETERS['demultiplexer'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'vector' },
      { id: 'out1', label: 'Out1', type: 'output', dataType: 'scalar' },
      { id: 'out2', label: 'Out2', type: 'output', dataType: 'scalar' },
    ],
  },
  'scope': {
    label: 'Scope',
    description: 'Data logging and visualization',
    color: '#636e72',
    icon: '📊',
    defaultParameters: DEFAULT_PARAMETERS['scope'],
    ports: [
      { id: 'in', label: 'Input', type: 'input', dataType: 'scalar' },
    ],
  },
};
