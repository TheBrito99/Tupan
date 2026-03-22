import { HydraulicComponent, HydraulicConnection, AnalysisData, SteadyState, EnergyAnalysis } from './types';

/**
 * Validate hydraulic network topology and parameters
 */
export function validateHydraulicNetwork(
  components: HydraulicComponent[],
  connections: HydraulicConnection[]
): string[] {
  const errors: string[] = [];

  // Check for at least one pump and tank
  const hasPump = components.some(c => c.type === 'pump' || c.type === 'pressure-source');
  const hasTank = components.some(c => c.type === 'tank' || c.type === 'pressure-source');

  if (!hasPump) {
    errors.push('Network must have at least one pump or pressure source');
  }
  if (!hasTank) {
    errors.push('Network must have at least one tank or pressure source');
  }

  // Check component parameters
  components.forEach(comp => {
    switch (comp.type) {
      case 'pump':
        if ((comp.parameters.displacement as number) <= 0) {
          errors.push(`Pump "${comp.name}": Displacement must be positive`);
        }
        if ((comp.parameters.efficiency as number) < 0 || (comp.parameters.efficiency as number) > 1) {
          errors.push(`Pump "${comp.name}": Efficiency must be between 0 and 1`);
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

      case 'pipe':
        if ((comp.parameters.length as number) <= 0) {
          errors.push(`Pipe "${comp.name}": Length must be positive`);
        }
        if ((comp.parameters.diameter as number) <= 0) {
          errors.push(`Pipe "${comp.name}": Diameter must be positive`);
        }
        break;

      case 'valve':
        if ((comp.parameters.flow_capacity as number) <= 0) {
          errors.push(`Valve "${comp.name}": Flow capacity must be positive`);
        }
        break;

      case 'cylinder':
        if ((comp.parameters.bore_diameter as number) <= 0) {
          errors.push(`Cylinder "${comp.name}": Bore diameter must be positive`);
        }
        if ((comp.parameters.stroke as number) <= 0) {
          errors.push(`Cylinder "${comp.name}": Stroke must be positive`);
        }
        break;

      case 'accumulator':
        if ((comp.parameters.volume as number) <= 0) {
          errors.push(`Accumulator "${comp.name}": Volume must be positive`);
        }
        if ((comp.parameters.precharge as number) <= 0) {
          errors.push(`Accumulator "${comp.name}": Precharge must be positive`);
        }
        break;
    }
  });

  // Check for isolated components (optional warning)
  const connectedComponents = new Set<string>();
  connections.forEach(conn => {
    connectedComponents.add(conn.from);
    connectedComponents.add(conn.to);
  });

  components.forEach(comp => {
    if (!connectedComponents.has(comp.id)) {
      errors.push(`Component "${comp.name}" (${comp.type}) is not connected`);
    }
  });

  return errors;
}

/**
 * Calculate pressure drop in a pipe using Darcy-Weisbach equation
 * ΔP = f * (L/D) * (ρ * v²) / 2
 */
function calculatePressureDrop(
  flow: number, // L/min
  length: number, // m
  diameter: number, // mm
  roughness: number // mm
): number {
  // Convert units
  const flowMs3 = flow / 60000; // L/min to m³/s
  const diameterM = diameter / 1000; // mm to m
  const roughnessM = roughness / 1000; // mm to m

  const velocity = (4 * flowMs3) / (Math.PI * diameterM * diameterM);
  const reynoldsNumber = (1000 * velocity * diameterM) / 0.001; // Assuming ISO VG 46 hydraulic fluid

  // Colebrook-White equation for friction factor (iterative, using approximation)
  let frictionFactor = 0.316 / Math.pow(reynoldsNumber, 0.25);
  if (reynoldsNumber > 4000) {
    // Turbulent: approximation
    const relativeRoughness = roughnessM / diameterM;
    frictionFactor = Math.pow(
      -2 * Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(reynoldsNumber, 0.9)),
      -2
    );
  }

  // Pressure drop in Pa
  const pressureDropPa = frictionFactor * (length / diameterM) * (1000 * velocity * velocity) / 2;
  const pressureDropBar = pressureDropPa / 1e5; // Pa to bar

  return Math.max(0, pressureDropBar);
}

/**
 * Analyze hydraulic network (steady-state)
 */
export function analyzeHydraulicNetwork(
  components: HydraulicComponent[],
  connections: HydraulicConnection[]
): AnalysisData {
  // Initialize system variables
  const pressures: Record<string, number> = {};
  const flows: Record<string, number> = {};
  const powerOutputs: Record<string, number> = {};

  // Find source and load components
  const pumps = components.filter(c => c.type === 'pump' || c.type === 'pressure-source');
  const motors = components.filter(c => c.type === 'motor');
  const cylinders = components.filter(c => c.type === 'cylinder');
  const tanks = components.filter(c => c.type === 'tank');

  // Initialize pressures
  components.forEach(comp => {
    pressures[comp.id] = comp.type === 'tank' ? 1 : 50; // bar
    flows[comp.id] = 0; // L/min
  });

  // Calculate pump output
  let totalSystemFlow = 0;
  pumps.forEach(pump => {
    if (pump.type === 'pump') {
      const displacement = pump.parameters.displacement as number; // cm³/rev
      const speed = pump.parameters.speed as number; // rpm
      const efficiency = pump.parameters.efficiency as number;
      flows[pump.id] = (displacement * speed) / 1000 * efficiency; // L/min
      totalSystemFlow += flows[pump.id];
    } else if (pump.type === 'pressure-source') {
      pressures[pump.id] = pump.parameters.pressure as number; // bar
      flows[pump.id] = 30; // Default flow for pressure source
      totalSystemFlow += flows[pump.id];
    }
  });

  // Distribute flow through system (simplified: equal distribution to motors/cylinders)
  const loads = [...motors, ...cylinders];
  if (loads.length > 0) {
    const flowPerLoad = totalSystemFlow / loads.length;
    loads.forEach(load => {
      flows[load.id] = flowPerLoad;
    });
  }

  // Calculate system pressure based on load
  let systemPressure = 50; // bar (baseline)
  cylinders.forEach(cyl => {
    const boreArea = Math.PI * Math.pow((cyl.parameters.bore_diameter as number) / 2, 2) / 100; // mm² to cm²
    const load = cyl.parameters.load as number; // N
    const pressureNeeded = (load / boreArea) * 10; // Convert to bar
    systemPressure = Math.max(systemPressure, pressureNeeded);
  });

  motors.forEach(motor => {
    const load = motor.parameters.load_torque as number; // N·m
    const displacement = motor.parameters.displacement as number; // cm³/rev
    const pressureNeeded = (load * 10) / displacement;
    systemPressure = Math.max(systemPressure, pressureNeeded);
  });

  // Calculate pressure drops in pipes
  connections.forEach(conn => {
    const flow = flows[conn.from] || 0;
    const pressureDrop = calculatePressureDrop(
      flow,
      conn.length,
      conn.diameter,
      0.045 // typical roughness for steel pipe
    );
    pressures[conn.to] = Math.max(1, (pressures[conn.from] || systemPressure) - pressureDrop);
  });

  // Calculate power outputs
  pumps.forEach(pump => {
    powerOutputs[pump.id] = (systemPressure * flows[pump.id]) / 600; // W
  });

  motors.forEach(motor => {
    const flow = flows[motor.id];
    const pressure = pressures[motor.id] || systemPressure;
    powerOutputs[motor.id] = (pressure * flow) / 600; // W
  });

  cylinders.forEach(cyl => {
    const flow = flows[cyl.id];
    const pressure = pressures[cyl.id] || systemPressure;
    powerOutputs[cyl.id] = (pressure * flow) / 600; // W
  });

  // Energy analysis
  const totalInputPower = pumps.reduce((sum, pump) => sum + (powerOutputs[pump.id] || 0), 0);
  const totalOutputPower = [...motors, ...cylinders].reduce((sum, load) => sum + (powerOutputs[load.id] || 0), 0);
  const heatDissipated = Math.max(0, totalInputPower - totalOutputPower);
  const efficiency = totalInputPower > 0 ? totalOutputPower / totalInputPower : 0;

  // Temperature rise calculation (simplified)
  const fluidVolume = 50; // L (assumed)
  const specificHeat = 1.8; // kJ/(L·K)
  const temperatureRise = heatDissipated / (fluidVolume * specificHeat * 1000);
  const baseTemperature = 313; // K (40°C)
  const fluidTemperature = baseTemperature + temperatureRise;

  const steadyState: SteadyState = {
    pressures,
    flows,
    powerOutputs,
  };

  const energyAnalysis: EnergyAnalysis = {
    inputPower: totalInputPower,
    outputPower: totalOutputPower,
    heatDissipated,
    efficiency,
    fluidTemperature,
  };

  return {
    steadyState,
    transient: { time: [0], pressures: {}, flows: {}, temperatures: {} },
    energyAnalysis,
    systemPressure,
    systemFlow: totalSystemFlow,
    pumpDisplacement: pumps.reduce((sum, p) => sum + ((p.parameters.displacement as number) || 0), 0),
    motorDisplacement: motors.reduce((sum, m) => sum + ((m.parameters.displacement as number) || 0), 0),
  };
}
