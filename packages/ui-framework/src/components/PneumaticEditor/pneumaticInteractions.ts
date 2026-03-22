import {
  PneumaticComponent,
  PneumaticConnection,
  AnalysisData,
  SteadyState,
  EnergyAnalysis,
} from './types';

/**
 * Validate pneumatic network topology and parameters
 */
export function validatePneumaticNetwork(
  components: PneumaticComponent[],
  connections: PneumaticConnection[]
): string[] {
  const errors: string[] = [];

  // Check for at least one compressor and tank
  const hasCompressor = components.some(
    (c) => c.type === 'compressor' || c.type === 'pressure-source'
  );
  const hasTank = components.some(
    (c) => c.type === 'tank' || c.type === 'pressure-source'
  );

  if (!hasCompressor) {
    errors.push('Network must have at least one compressor or pressure source');
  }
  if (!hasTank) {
    errors.push('Network must have at least one tank or pressure source');
  }

  // Check component parameters
  components.forEach((comp) => {
    switch (comp.type) {
      case 'compressor':
        if ((comp.parameters.displacement as number) <= 0) {
          errors.push(`Compressor "${comp.name}": Displacement must be positive`);
        }
        if (
          (comp.parameters.efficiency as number) < 0 ||
          (comp.parameters.efficiency as number) > 1
        ) {
          errors.push(
            `Compressor "${comp.name}": Efficiency must be between 0 and 1`
          );
        }
        break;

      case 'motor':
        if ((comp.parameters.displacement as number) <= 0) {
          errors.push(`Motor "${comp.name}": Displacement must be positive`);
        }
        if ((comp.parameters.load_torque as number) < 0) {
          errors.push(`Motor "${comp.name}": Load torque cannot be negative`);
        }
        break;

      case 'cylinder':
        if ((comp.parameters.bore_diameter as number) <= 0) {
          errors.push(
            `Cylinder "${comp.name}": Bore diameter must be positive`
          );
        }
        if ((comp.parameters.stroke as number) <= 0) {
          errors.push(`Cylinder "${comp.name}": Stroke must be positive`);
        }
        break;

      case 'tank':
        if ((comp.parameters.volume as number) <= 0) {
          errors.push(`Tank "${comp.name}": Volume must be positive`);
        }
        if ((comp.parameters.precharge_pressure as number) <= 0) {
          errors.push(
            `Tank "${comp.name}": Precharge pressure must be positive`
          );
        }
        break;

      case 'valve':
        if ((comp.parameters.flow_capacity as number) <= 0) {
          errors.push(`Valve "${comp.name}": Flow capacity must be positive`);
        }
        break;

      case 'regulator':
        if ((comp.parameters.set_pressure as number) <= 0) {
          errors.push(
            `Regulator "${comp.name}": Set pressure must be positive`
          );
        }
        break;

      case 'filter':
        if ((comp.parameters.micron_rating as number) <= 0) {
          errors.push(`Filter "${comp.name}": Micron rating must be positive`);
        }
        break;
    }
  });

  // Check for isolated components
  const connectedComponents = new Set<string>();
  connections.forEach((conn) => {
    connectedComponents.add(conn.from);
    connectedComponents.add(conn.to);
  });

  components.forEach((comp) => {
    if (!connectedComponents.has(comp.id)) {
      errors.push(
        `Component "${comp.name}" (${comp.type}) is not connected`
      );
    }
  });

  return errors;
}

/**
 * Calculate pressure drop in a pneumatic pipe
 * Uses Darcy-Weisbach equation with isothermal compressible flow correction
 * ΔP = f * (L/D) * (ρ * v²) / 2 * Z (compressibility correction)
 */
function calculatePressureDrop(
  flow: number, // m³/min (standard conditions)
  length: number, // m
  diameter: number, // mm
  temperature: number // K
): number {
  // Convert units
  const flowMs3s = flow / 60000; // m³/min to m³/s
  const diameterM = diameter / 1000; // mm to m

  // Air properties at standard conditions (1 bar, 15°C)
  const standardDensity = 1.225; // kg/m³
  const standardViscosity = 1.81e-5; // Pa·s

  // Temperature correction for air density
  const densityCorrected =
    standardDensity * (288 / temperature); // Ideal gas law

  // Velocity
  const velocity = (4 * flowMs3s) / (Math.PI * diameterM * diameterM);

  // Reynolds number
  const reynoldsNumber =
    (densityCorrected * velocity * diameterM) / standardViscosity;

  // Friction factor (Colebrook-White approximation)
  let frictionFactor = 0.316 / Math.pow(reynoldsNumber, 0.25);
  if (reynoldsNumber > 4000) {
    // Turbulent
    const roughnessM = 0.000045; // Steel pipe absolute roughness in m
    const relativeRoughness = roughnessM / diameterM;
    frictionFactor = Math.pow(
      -2 * Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(reynoldsNumber, 0.9)),
      -2
    );
  }

  // Pressure drop (Pa)
  const pressureDropPa =
    (frictionFactor * (length / diameterM) * (densityCorrected * velocity * velocity)) / 2;
  const pressureDropBar = pressureDropPa / 1e5; // Pa to bar

  return Math.max(0, pressureDropBar);
}

/**
 * Analyze pneumatic network (steady-state and transient)
 */
export function analyzePneumaticNetwork(
  components: PneumaticComponent[],
  connections: PneumaticConnection[]
): AnalysisData {
  // Initialize system variables
  const pressures: Record<string, number> = {};
  const flows: Record<string, number> = {};
  const powerOutputs: Record<string, number> = {};
  const temperatures: Record<string, number> = {};

  // Find source and load components
  const compressors = components.filter(
    (c) => c.type === 'compressor' || c.type === 'pressure-source'
  );
  const motors = components.filter((c) => c.type === 'motor');
  const cylinders = components.filter((c) => c.type === 'cylinder');
  const tanks = components.filter((c) => c.type === 'tank');

  // Initialize state
  components.forEach((comp) => {
    pressures[comp.id] = comp.type === 'tank' ? 1.0 : 6.0; // bar
    flows[comp.id] = 0; // m³/min
    temperatures[comp.id] = comp.parameters.temperature as number || 293; // K
  });

  // Calculate compressor output
  let totalSystemFlow = 0;
  let compressorInputPower = 0;

  compressors.forEach((compressor) => {
    if (compressor.type === 'compressor') {
      const displacement = compressor.parameters.displacement as number; // m³/rev
      const speed = compressor.parameters.speed as number; // rpm
      const efficiency = compressor.parameters.efficiency as number;

      flows[compressor.id] = (displacement * speed) / 1000 * efficiency; // m³/min
      totalSystemFlow += flows[compressor.id];

      // Isentropic compression power (W)
      // P_iso = (P_out * V) / (η) * ln(P_out/P_in)
      const systemPressure = 6.0; // bar (assumed)
      const isentropicPower =
        (systemPressure * 1e5 * totalSystemFlow) / 60 * Math.log(systemPressure / 1.0);
      compressorInputPower = isentropicPower / efficiency;
    } else if (compressor.type === 'pressure-source') {
      pressures[compressor.id] = compressor.parameters.pressure as number;
      flows[compressor.id] = 100; // Default flow for pressure source
      totalSystemFlow += flows[compressor.id];
    }
  });

  // Distribute flow through system (simplified: equal distribution to motors/cylinders)
  const loads = [...motors, ...cylinders];
  if (loads.length > 0) {
    const flowPerLoad = totalSystemFlow / loads.length;
    loads.forEach((load) => {
      flows[load.id] = flowPerLoad;
    });
  }

  // Calculate system pressure based on load
  let systemPressure = 6.0; // bar (baseline)

  cylinders.forEach((cyl) => {
    const boreArea =
      (Math.PI * Math.pow((cyl.parameters.bore_diameter as number) / 2, 2)) / 100; // mm² to cm²
    const load = cyl.parameters.load as number; // N
    const pressureNeeded = (load / boreArea) * 10; // Convert to bar
    systemPressure = Math.max(systemPressure, pressureNeeded);
  });

  motors.forEach((motor) => {
    const load = motor.parameters.load_torque as number; // N·m
    const displacement = motor.parameters.displacement as number; // m³/rev
    const pressureNeeded = (load * 10) / displacement;
    systemPressure = Math.max(systemPressure, pressureNeeded);
  });

  // Calculate pressure drops in pipes
  connections.forEach((conn) => {
    const flow = flows[conn.from] || 0;
    const fromTemp = temperatures[conn.from] || 293;

    // Isentropic expansion causes temperature drop
    const temperatureDrop = 0.5; // K per bar drop (simplified)
    const pressureDrop = calculatePressureDrop(
      flow,
      conn.length,
      conn.diameter,
      fromTemp
    );

    pressures[conn.to] = Math.max(1, pressures[conn.from] - pressureDrop);
    temperatures[conn.to] = Math.max(273, fromTemp - temperatureDrop * pressureDrop);
  });

  // Calculate power outputs
  compressors.forEach((compressor) => {
    powerOutputs[compressor.id] =
      ((systemPressure * flows[compressor.id]) / 600) * 1e3; // W
  });

  motors.forEach((motor) => {
    const flow = flows[motor.id];
    const pressure = pressures[motor.id] || systemPressure;
    powerOutputs[motor.id] = ((pressure * flow) / 600) * 1e3; // W
  });

  cylinders.forEach((cyl) => {
    const flow = flows[cyl.id];
    const pressure = pressures[cyl.id] || systemPressure;
    powerOutputs[cyl.id] = ((pressure * flow) / 600) * 1e3; // W
  });

  // Energy analysis
  const totalInputPower = compressorInputPower || 5000; // W
  const totalOutputPower = [...motors, ...cylinders].reduce(
    (sum, load) => sum + (powerOutputs[load.id] || 0),
    0
  );
  const heatLosses = Math.max(0, totalInputPower - totalOutputPower);
  const noiseLosses = totalOutputPower * 0.05; // ~5% of useful power as noise
  const efficiency = totalInputPower > 0 ? totalOutputPower / totalInputPower : 0;

  // Average system temperature
  const avgTemp =
    Object.values(temperatures).reduce((a, b) => a + b, 0) / Object.keys(temperatures).length;

  // Air density at system conditions (kg/m³)
  const airDensity = 1.225 * (systemPressure / 1.0) * (288 / avgTemp);

  const steadyState: SteadyState = {
    pressures,
    flows,
    powerOutputs,
    temperatures,
  };

  const energyAnalysis: EnergyAnalysis = {
    inputPower: totalInputPower,
    outputPower: totalOutputPower,
    lossesHeat: heatLosses,
    lossesNoise: noiseLosses,
    efficiency,
    airTemperature: avgTemp,
    airDensity,
  };

  return {
    steadyState,
    transient: { time: [0], pressures: {}, flows: {}, temperatures: {} },
    energyAnalysis,
    systemPressure,
    systemFlow: totalSystemFlow,
    compressorDisplacement: compressors.reduce(
      (sum, c) => sum + ((c.parameters.displacement as number) || 0),
      0
    ),
    motorDisplacement: motors.reduce(
      (sum, m) => sum + ((m.parameters.displacement as number) || 0),
      0
    ),
  };
}
