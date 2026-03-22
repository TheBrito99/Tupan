/**
 * Domain Mapping & Cross-Domain Coupling Utilities
 *
 * Supports multi-domain coupling via Gyratore elements
 * Maps physical domains and validates transformations
 */

export type PhysicalDomain =
  | 'electrical'
  | 'thermal'
  | 'mechanical'
  | 'hydraulic'
  | 'pneumatic'
  | 'magnetic';

export interface DomainInfo {
  name: PhysicalDomain;
  effortVariable: string;    // Voltage, Temperature, Force, Pressure, etc.
  effortUnit: string;        // V, K, N, Pa, etc.
  flowVariable: string;      // Current, Heat flow, Velocity, Flow rate, etc.
  flowUnit: string;          // A, W, m/s, m³/s, etc.
  color: string;             // Domain color for UI
  description: string;
}

/**
 * Domain definitions with effort/flow variables
 */
export const DOMAINS: Record<PhysicalDomain, DomainInfo> = {
  electrical: {
    name: 'electrical',
    effortVariable: 'Voltage (V)',
    effortUnit: 'V',
    flowVariable: 'Current (I)',
    flowUnit: 'A',
    color: '#FF6B6B',
    description: 'Electrical circuits (resistors, capacitors, inductors)',
  },
  thermal: {
    name: 'thermal',
    effortVariable: 'Temperature (T)',
    effortUnit: 'K',
    flowVariable: 'Heat Flow (Q̇)',
    flowUnit: 'W',
    color: '#FFB84D',
    description: 'Thermal systems (heat transfer, thermal resistance)',
  },
  mechanical: {
    name: 'mechanical',
    effortVariable: 'Force (F)',
    effortUnit: 'N',
    flowVariable: 'Velocity (v)',
    flowUnit: 'm/s',
    color: '#4ECDC4',
    description: 'Mechanical systems (springs, dampers, masses)',
  },
  hydraulic: {
    name: 'hydraulic',
    effortVariable: 'Pressure (P)',
    effortUnit: 'Pa',
    flowVariable: 'Flow Rate (Q)',
    flowUnit: 'm³/s',
    color: '#1E90FF',
    description: 'Hydraulic systems (pumps, cylinders, valves)',
  },
  pneumatic: {
    name: 'pneumatic',
    effortVariable: 'Pressure (P)',
    effortUnit: 'Pa',
    flowVariable: 'Flow Rate (Q)',
    flowUnit: 'm³/s',
    color: '#87CEEB',
    description: 'Pneumatic systems (compressors, motors, valves)',
  },
  magnetic: {
    name: 'magnetic',
    effortVariable: 'Magnetomotive Force (MMF)',
    effortUnit: 'A-turn',
    flowVariable: 'Magnetic Flux (Φ)',
    flowUnit: 'Wb',
    color: '#9370DB',
    description: 'Magnetic circuits (inductors, transformers)',
  },
};

/**
 * Gyrator coupling: transforms effort in one domain to flow in another
 *
 * Examples:
 * - Motor (electrical ↔ mechanical): V → ω (voltage to angular velocity)
 * - Pump (mechanical ↔ hydraulic): v → Q (velocity to flow)
 * - Solenoid (electrical ↔ magnetic): I → Φ (current to flux)
 * - Peltier (electrical ↔ thermal): I → Q̇ (current to heat flow)
 */
export interface GyratorCoupling {
  sourceElementId: string;
  targetElementId: string;
  sourceDomain: PhysicalDomain;
  targetDomain: PhysicalDomain;
  gyrationRatio: number;
  gyrationUnit: string;
  description: string;
  realWorldExample: string;
}

/**
 * Common gyrator couplings with standard ratios
 */
export const GYRATOR_EXAMPLES: Record<string, GyratorCoupling> = {
  motor: {
    sourceElementId: 'Se_electrical',
    targetElementId: 'Sf_mechanical',
    sourceDomain: 'electrical',
    targetDomain: 'mechanical',
    gyrationRatio: 0.1,  // Motor constant: Nm/A or V⋅s/rad
    gyrationUnit: 'Nm/A (torque per amp)',
    description: 'Electric Motor: Electrical power ↔ Mechanical power',
    realWorldExample: 'DC motor driving a load',
  },

  pump: {
    sourceElementId: 'Sf_mechanical',
    targetElementId: 'Sf_hydraulic',
    sourceDomain: 'mechanical',
    targetDomain: 'hydraulic',
    gyrationRatio: 0.001,  // Displacement: m³/rad
    gyrationUnit: 'm³/rad (displacement)',
    description: 'Hydraulic Pump: Mechanical power ↔ Hydraulic power',
    realWorldExample: 'Pump driven by motor delivering flow',
  },

  solenoid: {
    sourceElementId: 'Sf_electrical',
    targetElementId: 'Sf_magnetic',
    sourceDomain: 'electrical',
    targetDomain: 'magnetic',
    gyrationRatio: 500,  // Ampere turns per ampere
    gyrationUnit: 'A-turn/A (turns)',
    description: 'Solenoid: Electrical current ↔ Magnetic flux',
    realWorldExample: 'Electromagnet or relay coil',
  },

  peltierEffect: {
    sourceElementId: 'Sf_electrical',
    targetElementId: 'Sf_thermal',
    sourceDomain: 'electrical',
    targetDomain: 'thermal',
    gyrationRatio: 0.5,  // Peltier coefficient: W/A
    gyrationUnit: 'W/A (heat per amp)',
    description: 'Peltier Module: Current ↔ Heat flow',
    realWorldExample: 'Thermoelectric cooler/heater',
  },
};

/**
 * Determine domain for element type
 */
export function inferElementDomain(elementType: string): PhysicalDomain {
  // Heuristics based on element type and context
  if (elementType === 'Se' || elementType === 'Sf') return 'electrical';
  if (elementType === 'R') return 'electrical';  // Default to electrical
  if (elementType === 'C' || elementType === 'I') return 'electrical';  // Default
  if (elementType === 'TF' || elementType === 'GY') return 'electrical';  // Default
  if (elementType.includes('Junction')) return 'electrical';  // Default
  return 'electrical';
}

/**
 * Validate gyrator coupling is physically meaningful
 */
export function validateGyratorCoupling(
  sourceDomain: PhysicalDomain,
  targetDomain: PhysicalDomain
): { valid: boolean; reason?: string } {
  // Prevent self-coupling
  if (sourceDomain === targetDomain) {
    return {
      valid: false,
      reason: 'Gyrator must couple different physical domains',
    };
  }

  // Known valid couplings
  const validCouplings = new Set([
    'electrical-mechanical',
    'mechanical-electrical',
    'mechanical-hydraulic',
    'hydraulic-mechanical',
    'electrical-magnetic',
    'magnetic-electrical',
    'electrical-thermal',
    'thermal-electrical',
  ]);

  const coupling = `${sourceDomain}-${targetDomain}`;
  const reverseCoupling = `${targetDomain}-${sourceDomain}`;

  if (!validCouplings.has(coupling) && !validCouplings.has(reverseCoupling)) {
    return {
      valid: false,
      reason: `Coupling ${coupling} is uncommon or physically invalid`,
    };
  }

  return { valid: true };
}

/**
 * Get coupling description for UI
 */
export function describeCoupling(
  sourceDomain: PhysicalDomain,
  targetDomain: PhysicalDomain
): string {
  const source = DOMAINS[sourceDomain];
  const target = DOMAINS[targetDomain];

  return `${source.name} (${source.flowVariable}) ↔ ${target.name} (${target.flowVariable})`;
}

/**
 * Get gyrator ratio unit based on domain coupling
 */
export function getGyratorUnit(
  sourceDomain: PhysicalDomain,
  targetDomain: PhysicalDomain
): string {
  const couplings: Record<string, string> = {
    'electrical-mechanical': 'Nm/A (motor constant)',
    'mechanical-electrical': 'V/(rad/s) (back-EMF)',
    'mechanical-hydraulic': 'm³/rad (displacement)',
    'hydraulic-mechanical': 'Nm/Pa (force)',
    'electrical-magnetic': 'A-turn/A (turns)',
    'magnetic-electrical': 'V/(Wb/s) (flux linkage)',
    'electrical-thermal': 'W/A (Peltier coeff)',
    'thermal-electrical': 'A/W (Seebeck coeff)',
  };

  const key = `${sourceDomain}-${targetDomain}`;
  return couplings[key] || 'ratio';
}

/**
 * Multi-domain coupling example: Motor-Pump-Thermal system
 *
 * Physical System:
 * - Electrical: 24V DC supply, motor resistance 10Ω
 * - Mechanical: Motor with inertia, pump displacement
 * - Hydraulic: Pump, load, heat generation
 * - Thermal: Resistor heating, pump heat, cooling path
 *
 * Bond Graph Structure:
 * ```
 *   Electrical        Mechanical         Hydraulic          Thermal
 *   ──────────        ──────────         ──────────        ──────────
 *   Se (24V)
 *   │
 *   R (10Ω)
 *   │
 *   1-J ──GY(motor)──→ 1-J ──GY(pump)──→ 1-J
 *   │        │         │       │         │
 *   L(0.1H)  I(0.01)    I(0.01)  R(fric)  R(load)
 *   │        │         │       │         │
 *   ↓        ↓         ↓       ↓         ↓
 * I_motor  ω_motor   ω_pump  Q_pump   P_load
 *                                       │
 *                                       Sf (heat)────→ Thermal circuit
 * ```
 */
export const MOTOR_PUMP_THERMAL_EXAMPLE = {
  description: 'Multi-domain system: Motor-Pump with thermal coupling',
  domains: ['electrical', 'mechanical', 'hydraulic', 'thermal'] as PhysicalDomain[],
  elements: [
    // Electrical domain
    { id: 'Se_volt', type: 'Se', domain: 'electrical', label: 'Voltage (24V)' },
    { id: 'R_resist', type: 'R', domain: 'electrical', label: 'Motor R (10Ω)' },
    { id: 'L_induct', type: 'I', domain: 'electrical', label: 'Motor L (0.1H)' },

    // Mechanical domain
    { id: 'I_motor', type: 'I', domain: 'mechanical', label: 'Motor inertia (0.01)' },
    { id: 'R_friction', type: 'R', domain: 'mechanical', label: 'Friction (0.1)' },
    { id: 'I_pump', type: 'I', domain: 'mechanical', label: 'Pump inertia (0.005)' },

    // Hydraulic domain
    { id: 'R_load', type: 'R', domain: 'hydraulic', label: 'Load resistance' },
    { id: 'C_fluid', type: 'C', domain: 'hydraulic', label: 'Fluid mass (thermal)' },

    // Thermal domain
    { id: 'Sf_resistor', type: 'Sf', domain: 'thermal', label: 'Resistor heat (I²R)' },
    { id: 'Sf_friction', type: 'Sf', domain: 'thermal', label: 'Friction heat' },
    { id: 'Sf_pump', type: 'Sf', domain: 'thermal', label: 'Pump heat' },
    { id: 'R_cooling', type: 'R', domain: 'thermal', label: 'Cooling path' },
    { id: 'C_heatsink', type: 'C', domain: 'thermal', label: 'Heatsink (1000J/K)' },
  ],

  couplings: [
    { type: 'GY', from: 'electrical', to: 'mechanical', ratio: 0.5, label: 'Motor constant' },
    { type: 'GY', from: 'mechanical', to: 'hydraulic', ratio: 0.001, label: 'Pump displacement' },
    { type: 'TF', from: 'hydraulic', to: 'thermal', ratio: 1.0, label: 'Pressure-heat conversion' },
  ],

  expectedResults: {
    motorAcceleration: 'Motor accelerates from 0 to steady-state',
    currentDecay: 'Current decreases as back-EMF increases',
    flowRamp: 'Hydraulic flow ramps up with motor speed',
    temperatureRise: 'Temperature rises, then plateaus at equilibrium',
    energyConservation: 'Total energy input ≈ heat dissipation + stored energy',
  },
};
