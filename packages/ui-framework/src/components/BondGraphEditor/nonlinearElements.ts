/**
 * Nonlinear Element Support for Bond Graph Editor
 *
 * Extends basic linear elements (R, C, I, TF, GY) with nonlinear behavior
 * Covers saturation, hysteresis, diodes, and nonlinear springs/dampers
 */

/**
 * Nonlinear behavior types
 */
export type NonlinearBehavior =
  | 'saturation'           // Output limited to max/min values
  | 'hysteresis'           // Path-dependent behavior
  | 'diode'                // One-way conduction with forward drop
  | 'power_law'            // Output ∝ Input^n (e.g., air drag ∝ v²)
  | 'coulomb_friction'     // Dry friction with static/kinetic regions
  | 'backlash'             // Dead zone in mechanical transmission
  | 'deadband'             // Zero output below threshold
  | 'relay'                // Discrete on/off switching
  | 'polynomial'           // User-defined polynomial response
  | 'custom_lookup'        // User-provided lookup table
  ;

/**
 * Parameters for saturation (limits output)
 *
 * Example: Motor with maximum torque
 *   f_out = sign(f_in) × min(|f_in × ratio|, max_output)
 */
export interface SaturationParams {
  type: 'saturation';
  max_positive: number;    // Upper limit on positive output
  max_negative: number;    // Lower limit on negative output (usually -max_positive)
  linear_range: number;    // Range before saturation occurs
}

/**
 * Parameters for power law (nonlinear dissipation)
 *
 * Example: Air drag force
 *   f = sign(v) × c × |v|^n
 *   where n = 2 for turbulent, n = 1 for laminar
 */
export interface PowerLawParams {
  type: 'power_law';
  coefficient: number;     // Proportionality constant (c)
  exponent: number;        // Power exponent (n)
  breakpoint?: number;     // Transition velocity (optional)
}

/**
 * Parameters for diode behavior
 *
 * Example: Check valve in hydraulic line
 *   Conducts when effort_in > effort_out + forward_drop
 *   Blocks backward flow
 */
export interface DiodeParams {
  type: 'diode';
  forward_drop: number;    // Voltage/pressure drop when conducting (V, Pa)
  reverse_resistance: number;  // Very high resistance when reverse biased
  forward_resistance: number;  // Low resistance when forward biased
  temperature_coeff?: number;  // Temperature coefficient (V/K for Si diode ≈ -2mV/K)
}

/**
 * Parameters for Coulomb (dry) friction
 *
 * Example: Sliding bearing
 *   Static friction: f_s = μ_s × N (holds load)
 *   Kinetic friction: f_k = μ_k × N (opposes motion)
 */
export interface CoulombFrictionParams {
  type: 'coulomb_friction';
  static_coefficient: number;    // μ_s (usually > μ_k)
  kinetic_coefficient: number;   // μ_k
  normal_force: number;          // N (applied load)
  breakaway_velocity?: number;   // Velocity at which static → kinetic
}

/**
 * Parameters for backlash (dead zone in transmission)
 *
 * Example: Gear mesh with play
 *   No output motion until input exceeds backlash gap
 */
export interface BacklashParams {
  type: 'backlash';
  gap: number;                  // Physical gap (degrees or mm)
  stiffness_engaged: number;    // Spring constant when engaged
  damping_engaged: number;      // Damping when engaged
  direction: 'last_direction';  // Remember last direction of motion
}

/**
 * Parameters for deadband (zero sensitivity below threshold)
 *
 * Example: Control system with hysteresis
 *   output = 0 if |input| < threshold
 *   output = gain × (input - threshold) if |input| ≥ threshold
 */
export interface DeadbandParams {
  type: 'deadband';
  lower_threshold: number;  // Threshold below which output = 0
  upper_threshold: number;  // Can differ from lower for hysteresis
  gain_inside: number;      // Gain in deadband (usually 0)
  gain_outside: number;     // Gain outside deadband (usually 1)
}

/**
 * Parameters for relay switching
 *
 * Example: Hysteresis comparator
 *   output = +output_high if input > high_threshold
 *   output = -output_low if input < low_threshold
 *   output unchanged if between thresholds (hysteresis)
 */
export interface RelayParams {
  type: 'relay';
  high_threshold: number;   // Threshold to turn on
  low_threshold: number;    // Threshold to turn off (usually < high_threshold)
  output_high: number;      // Output when on
  output_low: number;       // Output when off
  hysteresis: number;       // Optional: (high_threshold - low_threshold) / 2
}

/**
 * Parameters for polynomial response
 *
 * Example: Nonlinear spring
 *   f = a₀ + a₁×x + a₂×x² + a₃×x³ + ...
 */
export interface PolynomialParams {
  type: 'polynomial';
  coefficients: number[];   // [a0, a1, a2, ...] for polynomial order
  valid_range: [number, number];  // [min_input, max_input]
}

/**
 * Parameters for lookup table (interpolated)
 *
 * Example: Real pump curve, motor torque map, etc.
 *   Store measured data points
 *   Linearly interpolate between points
 */
export interface LookupTableParams {
  type: 'custom_lookup';
  data_points: Array<[number, number]>;  // [[input1, output1], [input2, output2], ...]
  interpolation: 'linear' | 'cubic' | 'step';
  extrapolation: 'constant' | 'linear' | 'error';  // Behavior outside data range
}

/**
 * Parameters for hysteresis
 *
 * Example: Magnetic material magnetization curve
 *   Traces different path depending on direction
 */
export interface HysteresisParams {
  type: 'hysteresis';
  loop_area: number;        // Energy loss per cycle (determines loop width)
  saturation_positive: number;  // Upper saturation point
  saturation_negative: number;  // Lower saturation point
  remanence: number;        // Residual magnetization
  coercivity: number;       // Field needed to reduce magnetization to zero
}

/**
 * Union type for all nonlinear parameters
 */
export type NonlinearParams =
  | SaturationParams
  | PowerLawParams
  | DiodeParams
  | CoulombFrictionParams
  | BacklashParams
  | DeadbandParams
  | RelayParams
  | PolynomialParams
  | LookupTableParams
  | HysteresisParams;

/**
 * Nonlinear element definition
 * Can be applied to R, C, I, TF, or GY elements
 */
export interface NonlinearElement {
  id: string;
  base_element_type: 'R' | 'C' | 'I' | 'TF' | 'GY';  // Which element this modifies
  behavior: NonlinearBehavior;
  parameters: NonlinearParams;
  enabled: boolean;
  description: string;
  physical_interpretation?: string;
}

/**
 * Common nonlinear element library
 */
export const NONLINEAR_LIBRARY: Record<string, NonlinearElement> = {
  // Resistive nonlinearities
  'air_drag': {
    id: 'air_drag',
    base_element_type: 'R',
    behavior: 'power_law',
    parameters: {
      type: 'power_law',
      coefficient: 0.5,  // kg/m
      exponent: 2.0,     // Turbulent drag (F = 0.5 × ρ × Cd × A × v²)
    },
    enabled: true,
    description: 'Aerodynamic drag proportional to velocity squared',
    physical_interpretation: 'Air resistance: F_drag = ½ × ρ × Cd × A × v²',
  },

  'viscous_damping': {
    id: 'viscous_damping',
    base_element_type: 'R',
    behavior: 'power_law',
    parameters: {
      type: 'power_law',
      coefficient: 0.1,  // N⋅s/m
      exponent: 1.0,     // Linear (Stokes drag)
    },
    enabled: true,
    description: 'Viscous friction proportional to velocity (laminar flow)',
    physical_interpretation: 'Stokes drag: F = μ × v (low Reynolds number)',
  },

  'coulomb_friction': {
    id: 'coulomb_friction',
    base_element_type: 'R',
    behavior: 'coulomb_friction',
    parameters: {
      type: 'coulomb_friction',
      static_coefficient: 0.3,   // μ_s
      kinetic_coefficient: 0.25, // μ_k
      normal_force: 100,         // N
      breakaway_velocity: 0.01,  // m/s
    },
    enabled: true,
    description: 'Dry friction with static and kinetic components',
    physical_interpretation: 'Sliding bearing: f = μ_k × N (kinetic), μ_s × N (static)',
  },

  // Capacitive nonlinearities
  'nonlinear_spring': {
    id: 'nonlinear_spring',
    base_element_type: 'C',
    behavior: 'polynomial',
    parameters: {
      type: 'polynomial',
      coefficients: [0, 1000, 50, 10],  // f = 1000x + 50x² + 10x³
      valid_range: [-0.1, 0.1],
    },
    enabled: true,
    description: 'Spring with hardening/softening stiffness',
    physical_interpretation: 'Nonlinear spring: F = k₁x + k₂x² + k₃x³',
  },

  // Inductive nonlinearities
  'saturating_inductor': {
    id: 'saturating_inductor',
    base_element_type: 'I',
    behavior: 'saturation',
    parameters: {
      type: 'saturation',
      max_positive: 1.0,   // Maximum flux linkage (Wb)
      max_negative: -1.0,  // Minimum flux linkage
      linear_range: 0.5,   // Linear up to ±0.5 Wb
    },
    enabled: true,
    description: 'Iron-core inductor with saturation',
    physical_interpretation: 'Inductance decreases as current increases due to core saturation',
  },

  // Transformer nonlinearities
  'saturating_transformer': {
    id: 'saturating_transformer',
    base_element_type: 'TF',
    behavior: 'saturation',
    parameters: {
      type: 'saturation',
      max_positive: 10,
      max_negative: -10,
      linear_range: 5,
    },
    enabled: true,
    description: 'Power transformer with core saturation',
    physical_interpretation: 'Secondary voltage limited by core magnetization',
  },

  // Gyrator nonlinearities
  'motor_saturation': {
    id: 'motor_saturation',
    base_element_type: 'GY',
    behavior: 'saturation',
    parameters: {
      type: 'saturation',
      max_positive: 5.0,    // Maximum torque (N⋅m)
      max_negative: -5.0,   // Maximum negative torque
      linear_range: 2.5,    // Linear torque up to ±2.5 A
    },
    enabled: true,
    description: 'Electric motor with torque saturation',
    physical_interpretation: 'Maximum motor torque limited by magnetic saturation',
  },

  // Hydraulic check valve
  'check_valve': {
    id: 'check_valve',
    base_element_type: 'R',
    behavior: 'diode',
    parameters: {
      type: 'diode',
      forward_drop: 100000,        // 1 bar opening pressure (Pa)
      reverse_resistance: 1e10,    // Very high backward resistance
      forward_resistance: 100,     // Low forward resistance (Pa⋅s/m³)
    },
    enabled: true,
    description: 'Hydraulic check valve (one-way flow)',
    physical_interpretation: 'Allows flow in one direction only above cracking pressure',
  },

  // Relay switching
  'on_off_valve': {
    id: 'on_off_valve',
    base_element_type: 'R',
    behavior: 'relay',
    parameters: {
      type: 'relay',
      high_threshold: 0.5,   // 0.5 V to turn on
      low_threshold: 0.3,    // 0.3 V to turn off (hysteresis)
      output_high: 0.1,      // Low resistance when on (m³⋅s/Pa)
      output_low: 1000,      // High resistance when off
      hysteresis: 0.1,
    },
    enabled: true,
    description: 'Solenoid valve with hysteresis',
    physical_interpretation: 'Discrete switching between fully open and fully closed',
  },

  // Deadband with hysteresis
  'deadband_control': {
    id: 'deadband_control',
    base_element_type: 'R',
    behavior: 'deadband',
    parameters: {
      type: 'deadband',
      lower_threshold: -0.1,
      upper_threshold: 0.1,
      gain_inside: 0.0,      // No output in deadband
      gain_outside: 1.0,     // Full gain outside
    },
    enabled: true,
    description: 'Control system with deadband (insensitive zone)',
    physical_interpretation: 'No response until input exceeds threshold',
  },

  // Backlash in gears
  'gear_backlash': {
    id: 'gear_backlash',
    base_element_type: 'TF',
    behavior: 'backlash',
    parameters: {
      type: 'backlash',
      gap: 0.01,              // 0.01 radians gap (≈0.57°)
      stiffness_engaged: 1000, // N⋅m/rad
      damping_engaged: 1.0,    // N⋅m⋅s/rad
    },
    enabled: true,
    description: 'Gear mesh with mechanical play',
    physical_interpretation: 'Dead zone before teeth mesh, then rigid coupling',
  },

  // Lookup table example: Real pump performance curve
  'pump_performance': {
    id: 'pump_performance',
    base_element_type: 'GY',
    behavior: 'custom_lookup',
    parameters: {
      type: 'custom_lookup',
      data_points: [
        [0, 0],           // No speed → no flow
        [100, 0.001],     // 100 rpm → 1 cc/rev
        [500, 0.001],     // Constant displacement
        [1000, 0.0009],   // Slight decrease at high speed (leakage)
        [1500, 0.00085],  // More leakage
      ],
      interpolation: 'linear',
      extrapolation: 'constant',
    },
    enabled: true,
    description: 'Positive displacement pump with real performance curve',
    physical_interpretation: 'Flow = f(speed) with internal leakage at high speeds',
  },
};

/**
 * Compute nonlinear element response
 *
 * Given input value and nonlinear parameters, compute output
 */
export function computeNonlinearResponse(
  input: number,
  params: NonlinearParams
): number {
  switch (params.type) {
    case 'saturation':
      return Math.max(params.max_negative, Math.min(params.max_positive, input));

    case 'power_law':
      return Math.sign(input) * params.coefficient * Math.pow(Math.abs(input), params.exponent);

    case 'diode':
      // Forward conduction if effort_in > effort_out + forward_drop
      // For simplification, model as nonlinear resistance
      if (input > params.forward_drop) {
        return input / params.forward_resistance;
      } else {
        return input / params.reverse_resistance;
      }

    case 'coulomb_friction':
      if (Math.abs(input) < 1e-6) return 0; // Static case
      return Math.sign(input) * params.kinetic_coefficient * params.normal_force;

    case 'deadband':
      if (Math.abs(input) < params.lower_threshold) {
        return input * params.gain_inside;
      } else {
        return input * params.gain_outside;
      }

    case 'relay':
      if (input > params.high_threshold) return params.output_high;
      if (input < params.low_threshold) return params.output_low;
      return 0; // Undefined (should track state)

    case 'polynomial':
      let result = 0;
      for (let i = 0; i < params.coefficients.length; i++) {
        result += params.coefficients[i] * Math.pow(input, i);
      }
      return result;

    case 'custom_lookup':
      return interpolateLookupTable(input, params.data_points, params.interpolation);

    case 'hysteresis':
      // Simplified: depends on history (not stateless)
      return input * 0.9; // Placeholder: actual implementation requires state tracking

    case 'backlash':
      // Requires state tracking (current position vs. input)
      return 0; // Placeholder: actual implementation requires state

    default:
      return input; // Unknown type, return input unchanged
  }
}

/**
 * Interpolate lookup table
 */
function interpolateLookupTable(
  input: number,
  dataPoints: Array<[number, number]>,
  interpolation: 'linear' | 'cubic' | 'step'
): number {
  // Find surrounding points
  let idx = 0;
  while (idx < dataPoints.length && dataPoints[idx][0] < input) {
    idx++;
  }

  if (idx === 0) {
    // Before first point
    return dataPoints[0][1];
  }
  if (idx >= dataPoints.length) {
    // After last point
    return dataPoints[dataPoints.length - 1][1];
  }

  const [x0, y0] = dataPoints[idx - 1];
  const [x1, y1] = dataPoints[idx];

  if (interpolation === 'step') {
    return input < (x0 + x1) / 2 ? y0 : y1;
  }

  // Linear interpolation (default)
  return y0 + ((input - x0) / (x1 - x0)) * (y1 - y0);
}

/**
 * Validate nonlinear parameters
 */
export function validateNonlinearParams(params: NonlinearParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  switch (params.type) {
    case 'saturation':
      if (params.max_positive <= 0) errors.push('max_positive must be > 0');
      if (params.max_negative >= 0) errors.push('max_negative must be < 0');
      if (params.max_negative > params.max_positive) errors.push('max_negative must be ≤ max_positive');
      break;

    case 'power_law':
      if (params.exponent <= 0) errors.push('exponent must be > 0');
      if (params.coefficient < 0) errors.push('coefficient must be ≥ 0');
      break;

    case 'diode':
      if (params.forward_drop < 0) errors.push('forward_drop must be ≥ 0');
      if (params.forward_resistance <= 0) errors.push('forward_resistance must be > 0');
      if (params.reverse_resistance <= 0) errors.push('reverse_resistance must be > 0');
      if (params.forward_resistance >= params.reverse_resistance) {
        errors.push('forward_resistance must be < reverse_resistance');
      }
      break;

    case 'coulomb_friction':
      if (params.static_coefficient < 0) errors.push('static_coefficient must be ≥ 0');
      if (params.kinetic_coefficient < 0) errors.push('kinetic_coefficient must be ≥ 0');
      if (params.normal_force <= 0) errors.push('normal_force must be > 0');
      break;

    case 'custom_lookup':
      if (params.data_points.length < 2) errors.push('Must have at least 2 data points');
      const xValues = params.data_points.map(p => p[0]);
      if (xValues.some((x, i) => i > 0 && x <= xValues[i - 1])) {
        errors.push('X values must be strictly increasing');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get description of nonlinear behavior for UI
 */
export function describeNonlinearBehavior(behavior: NonlinearBehavior): string {
  const descriptions: Record<NonlinearBehavior, string> = {
    saturation: 'Output clipped to max/min values',
    hysteresis: 'Path-dependent behavior with loop area',
    diode: 'One-way conduction with forward drop',
    power_law: 'Output proportional to input^n',
    coulomb_friction: 'Dry friction with static/kinetic components',
    backlash: 'Dead zone in mechanical transmission',
    deadband: 'Zero output below threshold',
    relay: 'Discrete on/off switching',
    polynomial: 'User-defined polynomial response',
    custom_lookup: 'Interpolated from lookup table',
  };

  return descriptions[behavior] || 'Unknown nonlinear behavior';
}
