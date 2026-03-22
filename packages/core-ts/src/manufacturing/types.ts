/**
 * Manufacturing Simulation Types
 * Phase 19: CAM System TypeScript Bridge
 */

// Cutting Forces
export interface CuttingForceResult {
  tangentialForce: number; // N
  feedForce: number; // N
  radialForce: number; // N
  totalForce: number; // N
  cuttingPower: number; // W
  forceValidity: number; // 0-1 confidence
}

export interface MaterialCuttingCoefficients {
  material: string;
  ks: number; // Specific cutting force (N/mm²)
  ks0: number; // Edge force component
  feedForceRatio: number;
  radialForceRatio: number;
  cuttingSpeedExponent: number;
  feedExponent: number;
  depthExponent: number;
}

// Spindle Load
export interface SpindleLoadResult {
  cuttingPower: number; // W
  spindleTorque: number; // N·m
  spindleSpeed: number; // RPM
  loadPercentage: number; // 0-100%
  powerMargin: number; // W
  torqueMargin: number; // N·m
}

export interface SpindleSpec {
  maxPower: number; // W
  maxTorque: number; // N·m
  maxSpeed: number; // RPM
  minSpeed: number; // RPM
  efficiency: number; // 0-1
  mechanicalLoss: number; // W
}

// Thermal Analysis
export type ThermalRisk = 'Safe' | 'Caution' | 'Critical' | 'Failure';

export interface ThermalResult {
  chipTemperature: number; // °C
  toolTemperature: number; // °C
  workpieceTemperature: number; // °C
  heatGenerated: number; // W
  toolLifeRatio: number; // 0-1
  thermalRisk: ThermalRisk;
}

export interface ThermalMaterial {
  name: string;
  thermalConductivity: number; // W/(m·K)
  specificHeat: number; // J/(kg·K)
  density: number; // kg/m³
  meltingPoint: number; // °C
  maxToolTemp: number; // °C
}

export interface ToolThermal {
  toolMaterial: string;
  thermalConductivity: number;
  specificHeat: number;
  toolMass: number; // grams
  insertArea: number; // mm²
}

// Manufacturing Job
export interface ManufacturingJobData {
  id: string;
  name: string;
  type: 'fdm-print' | 'cnc-mill' | 'laser-cut';
  material: string;
  estimatedTime: number; // minutes
  estimatedCost: number; // USD
}

// Simulation Request
export interface SimulationRequest {
  material: string; // workpiece material
  feedRate: number; // mm/min
  depthOfCut: number; // mm
  cuttingSpeed: number; // m/min or mm/min
  fluteCount: number;
  cuttingTime: number; // seconds
  ambientTemp: number; // °C
  spindleSpeed: number; // RPM
  coolantAvailable: boolean;
}

// Unified Simulation Result
export interface ManufacturingSimulation {
  cuttingForces: CuttingForceResult;
  spindleLoad: SpindleLoadResult;
  thermal: ThermalResult;
  timestamp: Date;
}
