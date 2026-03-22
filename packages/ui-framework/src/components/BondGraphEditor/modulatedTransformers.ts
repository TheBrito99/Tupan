/**
 * Modulated Transformer Support for Bond Graph Editor
 *
 * Enables time-varying transformer ratios that change based on:
 * - Control signals
 * - Time-dependent functions
 * - State-dependent relationships
 * - Load conditions
 */

/**
 * Types of modulation for transformer ratio
 */
export type ModulationType =
  | 'constant'           // Fixed ratio (default TF)
  | 'step_function'      // Discrete steps (gear shifts)
  | 'sine_wave'          // Sinusoidal variation
  | 'square_wave'        // Pulse/PWM signal
  | 'sawtooth'           // Ramp up/down
  | 'triangular'         // Triangle wave
  | 'exponential'        // Exponential growth/decay
  | 'control_signal'     // Driven by another bond variable
  | 'state_dependent'    // Depends on element state
  | 'lookup_table'       // Interpolated from table
  | 'custom_function'    // User-defined expression
  ;

/**
 * Parameters for step function (gear shifts)
 *
 * Example: Manual transmission with discrete gears
 *   Gear 1: ratio = 3.5
 *   Gear 2: ratio = 2.1
 *   Gear 3: ratio = 1.5
 *   Overdrive: ratio = 0.8
 */
export interface StepFunctionParams {
  type: 'step_function';
  steps: Array<{
    time: number;      // Time at which to switch (seconds)
    ratio: number;     // Ratio at this step
    label?: string;    // e.g., "1st Gear", "2nd Gear"
  }>;
  interpolation: 'immediate' | 'smooth';  // Step change or ramp transition
}

/**
 * Parameters for sinusoidal modulation
 *
 * Example: Rotating mechanical system (e.g., vibration)
 *   ratio(t) = amplitude × sin(2π × frequency × t + phase) + offset
 */
export interface SineWaveParams {
  type: 'sine_wave';
  amplitude: number;    // Peak variation from center
  frequency: number;    // Hz (cycles per second)
  phase: number;       // Initial phase (radians)
  offset: number;      // Center value (DC component)
  min_ratio: number;   // Clamp to minimum
  max_ratio: number;   // Clamp to maximum
}

/**
 * Parameters for square wave (PWM - Pulse Width Modulation)
 *
 * Example: Digital control signal, switched systems
 *   High for duty_cycle × period
 *   Low for (1 - duty_cycle) × period
 */
export interface SquareWaveParams {
  type: 'square_wave';
  frequency: number;      // Hz (cycles per second)
  duty_cycle: number;     // 0 to 1 (fraction of period that is high)
  value_high: number;     // Ratio when high
  value_low: number;      // Ratio when low
  phase: number;         // Initial phase (radians)
}

/**
 * Parameters for sawtooth wave
 *
 * Example: Ramp control (e.g., motor speed ramp)
 *   Rises from min to max over period, then resets
 */
export interface SawtoothParams {
  type: 'sawtooth';
  frequency: number;    // Hz
  min_ratio: number;    // Minimum value
  max_ratio: number;    // Maximum value
  phase: number;       // Initial phase (radians)
}

/**
 * Parameters for triangular wave
 *
 * Example: Back-and-forth variation
 *   Linear rise, then linear fall
 */
export interface TriangularParams {
  type: 'triangular';
  frequency: number;    // Hz
  min_ratio: number;    // Minimum value
  max_ratio: number;    // Maximum value
  phase: number;       // Initial phase (radians)
  rise_fraction: number; // 0 to 1: fraction of period for rise vs fall
}

/**
 * Parameters for exponential modulation
 *
 * Example: RC charging/discharging
 *   ratio(t) = final × (1 - exp(-t/τ)) + initial × exp(-t/τ)
 */
export interface ExponentialParams {
  type: 'exponential';
  initial_ratio: number;  // Starting ratio at t=0
  final_ratio: number;    // Final ratio as t → ∞
  time_constant: number;  // τ in seconds (63% of change in one τ)
  direction: 'growth' | 'decay';
}

/**
 * Parameters for control signal modulation
 *
 * Example: Motor speed controlled by voltage
 *   ratio(t) = f(control_variable)
 *   - Control variable comes from another bond
 *   - Typically electrical signal or mechanical quantity
 */
export interface ControlSignalParams {
  type: 'control_signal';
  source_element_id: string;    // Which element provides control signal
  control_variable: 'effort' | 'flow';  // Effort (V/T/F) or Flow (I/Q/v)
  scaling_factor: number;       // Multiplier applied to control signal
  offset: number;              // Added to scaled signal
  min_ratio: number;          // Lower saturation limit
  max_ratio: number;          // Upper saturation limit
  response_time: number;      // Low-pass filter time constant (seconds)
}

/**
 * Parameters for state-dependent modulation
 *
 * Example: Adaptive gear selection based on speed
 *   if v < 20 km/h: gear = 1 (ratio = 3.5)
 *   if 20 ≤ v < 40: gear = 2 (ratio = 2.1)
 *   if v ≥ 40: gear = 3 (ratio = 1.5)
 */
export interface StateDependentParams {
  type: 'state_dependent';
  state_variable: string;    // Name of state to monitor
  thresholds: Array<{
    condition: string;       // e.g., "speed < 20", "pressure > 100"
    ratio: number;          // Ratio to apply if condition is true
    hysteresis?: number;    // Optional hysteresis margin
  }>;
}

/**
 * Parameters for lookup table modulation
 *
 * Example: Engine torque map (real data)
 *   ratio(engine_rpm) = interpolate from measured torque curve
 */
export interface LookupTableParams {
  type: 'lookup_table';
  input_variable: string;    // Independent variable (e.g., "speed", "load")
  data_points: Array<[number, number]>;  // [[input1, ratio1], [input2, ratio2], ...]
  interpolation: 'linear' | 'cubic' | 'step';
  extrapolation: 'constant' | 'linear' | 'error';
}

/**
 * Parameters for custom function modulation
 *
 * Example: Mathematical expression
 *   ratio(t) = 1 + 0.5 × cos(2π × t) (oscillation)
 */
export interface CustomFunctionParams {
  type: 'custom_function';
  expression: string;      // Mathematical expression (e.g., "1 + 0.5*cos(2*pi*t)")
  variables: string[];     // Available variables: t, t0, effort, flow, etc.
  min_ratio: number;      // Safety limit
  max_ratio: number;      // Safety limit
}

/**
 * Union type for all modulation parameters
 */
export type ModulationParams =
  | StepFunctionParams
  | SineWaveParams
  | SquareWaveParams
  | SawtoothParams
  | TriangularParams
  | ExponentialParams
  | ControlSignalParams
  | StateDependentParams
  | LookupTableParams
  | CustomFunctionParams
  ;

/**
 * Modulated transformer definition
 */
export interface ModulatedTransformer {
  id: string;
  base_ratio: number;         // Reference ratio if modulation is off
  modulation_type: ModulationType;
  parameters: ModulationParams;
  enabled: boolean;
  description: string;
  physical_interpretation?: string;
}

/**
 * Common modulated transformer examples
 */
export const MODULATED_TRANSFORMER_LIBRARY: Record<string, ModulatedTransformer> = {
  // Manual transmission (step function)
  'manual_transmission': {
    id: 'manual_transmission',
    base_ratio: 3.5,
    modulation_type: 'step_function',
    parameters: {
      type: 'step_function',
      steps: [
        { time: 0, ratio: 3.5, label: '1st Gear' },
        { time: 5, ratio: 2.1, label: '2nd Gear' },
        { time: 10, ratio: 1.5, label: '3rd Gear' },
        { time: 15, ratio: 0.8, label: 'Overdrive' },
      ],
      interpolation: 'smooth',
    },
    enabled: true,
    description: 'Manual transmission with discrete gear shifts',
    physical_interpretation: 'Input shaft (engine) to output shaft (wheels) ratio changes',
  },

  // Continuously variable transmission (CVT)
  'cvt_transmission': {
    id: 'cvt_transmission',
    base_ratio: 3.5,
    modulation_type: 'sine_wave',
    parameters: {
      type: 'sine_wave',
      amplitude: 1.0,       // Varies from 2.5 to 4.5
      frequency: 0.1,       // Change ratio every 10 seconds
      phase: 0,
      offset: 3.5,          // Center at 3.5
      min_ratio: 0.5,       // Never below 0.5
      max_ratio: 5.0,       // Never above 5.0
    },
    enabled: true,
    description: 'Continuously variable transmission (smooth ratio change)',
    physical_interpretation: 'Pulley-based system smoothly adjusts input/output ratio',
  },

  // PWM duty cycle modulation (power electronic)
  'pwm_controller': {
    id: 'pwm_controller',
    base_ratio: 1.0,
    modulation_type: 'square_wave',
    parameters: {
      type: 'square_wave',
      frequency: 1000,      // 1 kHz switching
      duty_cycle: 0.5,      // 50% on, 50% off
      value_high: 1.0,      // Full voltage when on
      value_low: 0.0,       // No voltage when off
      phase: 0,
    },
    enabled: true,
    description: 'PWM power control (switch-mode converter)',
    physical_interpretation: 'Digital control: ratio toggles between full and zero',
  },

  // Motor speed ramp (sawtooth)
  'speed_ramp': {
    id: 'speed_ramp',
    base_ratio: 0,
    modulation_type: 'sawtooth',
    parameters: {
      type: 'sawtooth',
      frequency: 0.1,       // One ramp per 10 seconds
      min_ratio: 0,         // Start from rest
      max_ratio: 1.0,       // Accelerate to full speed
      phase: 0,
    },
    enabled: true,
    description: 'Acceleration ramp for smooth motor startup',
    physical_interpretation: 'Control signal ramped to prevent sudden load changes',
  },

  // Oscillating load (triangular)
  'oscillating_mechanism': {
    id: 'oscillating_mechanism',
    base_ratio: 1.0,
    modulation_type: 'triangular',
    parameters: {
      type: 'triangular',
      frequency: 1.0,       // 1 Hz oscillation
      min_ratio: 0.8,       // Minimum mechanical advantage
      max_ratio: 1.2,       // Maximum mechanical advantage
      phase: 0,
      rise_fraction: 0.5,   // Equal rise and fall
    },
    enabled: true,
    description: 'Mechanical system with oscillating transmission ratio',
    physical_interpretation: 'Cam or linkage system with periodic ratio variation',
  },

  // Exponential charging (RC circuit)
  'rc_charging': {
    id: 'rc_charging',
    base_ratio: 0,
    modulation_type: 'exponential',
    parameters: {
      type: 'exponential',
      initial_ratio: 0,
      final_ratio: 1.0,
      time_constant: 1.0,   // Reach 63% of final in 1 second
      direction: 'growth',
    },
    enabled: true,
    description: 'Exponential charging response (capacitor, thermal mass)',
    physical_interpretation: 'Output rises exponentially toward steady state',
  },

  // Adaptive control (control signal driven)
  'adaptive_controller': {
    id: 'adaptive_controller',
    base_ratio: 1.0,
    modulation_type: 'control_signal',
    parameters: {
      type: 'control_signal',
      source_element_id: 'sensor_input',
      control_variable: 'flow',      // Controlled by input current/flow
      scaling_factor: 1.0,           // Direct 1:1 mapping
      offset: 0.5,                   // Add 0.5 baseline
      min_ratio: 0.1,               // Safety limits
      max_ratio: 2.0,
      response_time: 0.1,           // 100 ms response time
    },
    enabled: true,
    description: 'Ratio controlled by external signal (feedback control)',
    physical_interpretation: 'Sensor drives transformer ratio (adaptive system)',
  },

  // State-dependent gear selection
  'auto_transmission': {
    id: 'auto_transmission',
    base_ratio: 3.5,
    modulation_type: 'state_dependent',
    parameters: {
      type: 'state_dependent',
      state_variable: 'velocity',
      thresholds: [
        { condition: 'velocity < 15', ratio: 3.5, hysteresis: 1 },
        { condition: '15 <= velocity < 30', ratio: 2.1, hysteresis: 1 },
        { condition: '30 <= velocity < 50', ratio: 1.5, hysteresis: 1 },
        { condition: 'velocity >= 50', ratio: 0.8, hysteresis: 1 },
      ],
    },
    enabled: true,
    description: 'Automatic transmission with speed-based gear selection',
    physical_interpretation: 'Switches gears automatically based on vehicle speed',
  },

  // Engine torque map (lookup table)
  'engine_torque_map': {
    id: 'engine_torque_map',
    base_ratio: 1.0,
    modulation_type: 'lookup_table',
    parameters: {
      type: 'lookup_table',
      input_variable: 'engine_rpm',
      data_points: [
        [1000, 80],      // 80 Nm at 1000 rpm
        [2000, 120],     // 120 Nm at 2000 rpm
        [3000, 140],     // Peak torque 140 Nm at 3000 rpm
        [4000, 130],     // Torque falls at high rpm
        [5000, 100],
        [6000, 60],      // Limited at redline
      ],
      interpolation: 'cubic',
      extrapolation: 'constant',
    },
    enabled: true,
    description: 'Real engine torque curve (measured data)',
    physical_interpretation: 'Engine output varies with speed (bell curve)',
  },

  // Modulated mechanical advantage (custom expression)
  'cam_profile': {
    id: 'cam_profile',
    base_ratio: 1.0,
    modulation_type: 'custom_function',
    parameters: {
      type: 'custom_function',
      expression: '1.0 + 0.3 * sin(2 * pi * t)',  // ratio = 1 ± 0.3 oscillation
      variables: ['t'],
      min_ratio: 0.5,
      max_ratio: 1.5,
    },
    enabled: true,
    description: 'Cam-driven mechanical advantage (sinusoidal profile)',
    physical_interpretation: 'Cam lobe creates periodic load variation',
  },
};

/**
 * Compute modulated transformer ratio at a given time
 */
export function computeModulatedRatio(
  time: number,
  parameters: ModulationParams,
  context?: {
    effort?: number;
    flow?: number;
    state?: Record<string, number>;
  }
): number {
  switch (parameters.type) {
    case 'constant':
      return parameters.base_ratio || 1.0;

    case 'step_function':
      // Find appropriate step based on time
      let currentRatio = parameters.steps[0]?.ratio || 1.0;
      for (const step of parameters.steps) {
        if (time >= step.time) {
          currentRatio = step.ratio;
        }
      }
      return currentRatio;

    case 'sine_wave':
      return (
        parameters.amplitude * Math.sin(2 * Math.PI * parameters.frequency * time + parameters.phase) +
        parameters.offset
      );

    case 'square_wave':
      const period = 1 / parameters.frequency;
      const timeInPeriod = (time + (parameters.phase / (2 * Math.PI)) * period) % period;
      const threshold = parameters.duty_cycle * period;
      return timeInPeriod < threshold ? parameters.value_high : parameters.value_low;

    case 'sawtooth':
      const sawPeriod = 1 / parameters.frequency;
      const sawTime = (time + (parameters.phase / (2 * Math.PI)) * sawPeriod) % sawPeriod;
      const fraction = sawTime / sawPeriod;
      return parameters.min_ratio + (parameters.max_ratio - parameters.min_ratio) * fraction;

    case 'triangular':
      const triPeriod = 1 / parameters.frequency;
      const triTime = (time + (parameters.phase / (2 * Math.PI)) * triPeriod) % triPeriod;
      const triFraction = triTime / triPeriod;
      const riseTime = parameters.rise_fraction;
      if (triFraction < riseTime) {
        // Rising phase
        return parameters.min_ratio +
               ((triFraction / riseTime) * (parameters.max_ratio - parameters.min_ratio));
      } else {
        // Falling phase
        const fallFraction = (triFraction - riseTime) / (1 - riseTime);
        return parameters.max_ratio -
               (fallFraction * (parameters.max_ratio - parameters.min_ratio));
      }

    case 'exponential':
      if (parameters.direction === 'growth') {
        return parameters.initial_ratio +
               (parameters.final_ratio - parameters.initial_ratio) *
               (1 - Math.exp(-time / parameters.time_constant));
      } else {
        return parameters.final_ratio +
               (parameters.initial_ratio - parameters.final_ratio) *
               Math.exp(-time / parameters.time_constant);
      }

    case 'control_signal':
      if (!context?.flow) return 1.0;
      const controlled = context.flow * parameters.scaling_factor + parameters.offset;
      return Math.max(parameters.min_ratio,
                      Math.min(parameters.max_ratio, controlled));

    case 'state_dependent':
      // Simplified: just return middle value
      // Real implementation would evaluate conditions
      return (parameters.thresholds[0]?.ratio || 1.0);

    case 'lookup_table':
      return interpolateLookupTable(time, parameters.data_points);

    case 'custom_function':
      // Would require expression parser (not implemented here)
      return 1.0;

    default:
      return 1.0;
  }
}

/**
 * Interpolate lookup table
 */
function interpolateLookupTable(
  input: number,
  dataPoints: Array<[number, number]>
): number {
  if (dataPoints.length === 0) return 1.0;
  if (input <= dataPoints[0][0]) return dataPoints[0][1];
  if (input >= dataPoints[dataPoints.length - 1][0]) return dataPoints[dataPoints.length - 1][1];

  for (let i = 1; i < dataPoints.length; i++) {
    if (input <= dataPoints[i][0]) {
      const [x0, y0] = dataPoints[i - 1];
      const [x1, y1] = dataPoints[i];
      return y0 + ((input - x0) / (x1 - x0)) * (y1 - y0);
    }
  }

  return dataPoints[dataPoints.length - 1][1];
}

/**
 * Validate modulation parameters
 */
export function validateModulationParams(params: ModulationParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  switch (params.type) {
    case 'sine_wave':
      if (params.frequency <= 0) errors.push('Frequency must be > 0');
      if (params.amplitude < 0) errors.push('Amplitude must be ≥ 0');
      break;

    case 'square_wave':
      if (params.frequency <= 0) errors.push('Frequency must be > 0');
      if (params.duty_cycle < 0 || params.duty_cycle > 1) {
        errors.push('Duty cycle must be between 0 and 1');
      }
      break;

    case 'control_signal':
      if (params.min_ratio >= params.max_ratio) {
        errors.push('min_ratio must be < max_ratio');
      }
      break;

    case 'lookup_table':
      if (params.data_points.length < 2) {
        errors.push('Must have at least 2 data points');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get description of modulation type for UI
 */
export function describeModulationType(type: ModulationType): string {
  const descriptions: Record<ModulationType, string> = {
    constant: 'Fixed ratio (no modulation)',
    step_function: 'Discrete steps (gear shifts, switches)',
    sine_wave: 'Sinusoidal variation (oscillation)',
    square_wave: 'Pulse/PWM signal (on-off switching)',
    sawtooth: 'Ramp up then reset (sawtooth wave)',
    triangular: 'Triangle wave (symmetric ramp)',
    exponential: 'Exponential growth/decay (charging/discharging)',
    control_signal: 'Driven by external control signal (feedback)',
    state_dependent: 'Changes based on system state (adaptive)',
    lookup_table: 'Interpolated from measured data (real curves)',
    custom_function: 'User-defined mathematical expression',
  };

  return descriptions[type] || 'Unknown modulation type';
}
