/**
 * Spindle Load Bridge
 * Phase 19-20: Spindle Load with WASM Support
 */

import { SpindleLoadResult, SpindleSpec } from './types';
import { type WasmSimulatorInstance } from './wasm-loader';

/**
 * Spindle Load calculation bridge
 * Uses WASM when available, falls back to mocks
 */
export class SpindleLoadBridge {
  private wasmModule: any;
  private wasmSimulator: WasmSimulatorInstance | null = null;
  private useWasm = false;

  constructor(wasmModule?: any) {
    this.wasmModule = wasmModule;
    if (wasmModule) {
      this.tryInitializeWasm();
    }
  }

  /**
   * Try to initialize WASM simulator
   */
  private tryInitializeWasm(): void {
    try {
      if (this.wasmModule && this.wasmModule.WasmManufacturingSimulator) {
        this.wasmSimulator = new this.wasmModule.WasmManufacturingSimulator();
        this.useWasm = true;
      }
    } catch (error) {
      console.warn('Failed to initialize WASM simulator for spindle load:', error);
      this.useWasm = false;
    }
  }

  setWasmModule(module: any) {
    this.wasmModule = module;
    if (module) {
      this.tryInitializeWasm();
    }
  }

  /**
   * Calculate spindle load from cutting power
   */
  calculateLoad(
    cuttingPower: number,
    spindleSpec: SpindleSpec,
    spindleSpeed: number
  ): SpindleLoadResult {
    // Try WASM first if available
    if (this.useWasm && this.wasmSimulator) {
      try {
        const request = JSON.stringify({
          cutting_power: cuttingPower,
          spindle_spec: spindleSpec.id || 'generic_3hp',
          spindle_speed: spindleSpeed,
        });

        const resultJson = this.wasmSimulator.calculate_spindle_load(request);
        const result = JSON.parse(resultJson);

        return {
          loadPercentage: result.load_percentage,
          torque: result.torque,
          powerMargin: result.power_margin,
          thermalLoad: result.thermal_load,
          riskStatus: result.risk_status,
          isWithinLimits: result.is_within_limits,
        };
      } catch (error) {
        console.warn('WASM spindle load calculation failed, falling back to mock:', error);
        this.useWasm = false;
      }
    }

    // Validate spindle speed
    if (spindleSpeed < spindleSpec.minSpeed || spindleSpeed > spindleSpec.maxSpeed) {
      throw new Error(
        `Spindle speed ${spindleSpeed} outside range ${spindleSpec.minSpeed}-${spindleSpec.maxSpeed}`
      );
    }

    // Total power including mechanical losses
    const totalPower = cuttingPower + spindleSpec.mechanicalLoss;

    // Actual electrical input power
    const electricalPower = totalPower / spindleSpec.efficiency;

    // Spindle torque: T = P * 60000 / (2π * RPM)
    const spindle Torque =
      spindleSpeed > 0
        ? (cuttingPower * 60000) / (2 * Math.PI * spindleSpeed)
        : 0;

    // Load percentages
    const powerLoad = Math.min((electricalPower / spindleSpec.maxPower) * 100, 100);
    const torqueLoad = Math.min((spindleTorque / spindleSpec.maxTorque) * 100, 100);
    const loadPercentage = Math.max(powerLoad, torqueLoad);

    // Margins
    const powerMargin = Math.max(
      spindleSpec.maxPower * spindleSpec.efficiency - totalPower,
      0
    );
    const torqueMargin = Math.max(spindleSpec.maxTorque - spindleTorque, 0);

    return {
      cuttingPower,
      spindleTorque,
      spindleSpeed,
      loadPercentage,
      powerMargin,
      torqueMargin,
    };
  }

  /**
   * Check if operation is within spindle limits
   */
  isWithinLimits(
    cuttingPower: number,
    spindleSpec: SpindleSpec,
    spindleSpeed: number,
    safetyMarginPercent: number = 10
  ): boolean {
    const result = this.calculateLoad(cuttingPower, spindleSpec, spindleSpeed);
    const maxSafeLoad = 100 - safetyMarginPercent;
    return result.loadPercentage <= maxSafeLoad;
  }

  /**
   * Estimate spindle thermal load
   */
  estimateThermalLoad(
    cuttingPower: number,
    continuousDurationMin: number,
    ambientTemp: number
  ): number {
    const heatDissipation = 50; // W/°C
    const timeConstant = 30; // Minutes

    const powerFactor = cuttingPower / 1000;
    const timeFactor = 1 - Math.exp(-continuousDurationMin / timeConstant);
    const tempRise = (powerFactor * timeFactor * heatDissipation) / 10;

    return ambientTemp + tempRise;
  }

  /**
   * Predict spindle bearing life
   */
  predictBearingLife(
    loadPercentage: number,
    spindleSpeed: number,
    operatingHours: number = 0
  ): number {
    const baseLife = 10000; // hours at low load

    // Load factor
    const loadFactor =
      loadPercentage > 80 ? 0.3 : loadPercentage > 60 ? 0.6 : 1.0;

    // Speed factor
    const speedFactor = 5000 / Math.max(spindleSpeed, 1);

    const remainingLife = baseLife * loadFactor * speedFactor;
    return Math.max(remainingLife - operatingHours, 0);
  }

  /**
   * Get maintenance interval
   */
  getMaintenanceInterval(
    loadPercentage: number,
    spindleSpeed: number,
    baseInterval: number
  ): number {
    const loadFactor =
      loadPercentage > 80 ? 0.5 : loadPercentage > 60 ? 0.75 : 1.0;

    return baseInterval * loadFactor;
  }

  /**
   * Get predefined spindle specs
   */
  getSpindleSpec(type: string): SpindleSpec {
    const specs: Record<string, SpindleSpec> = {
      generic_3hp: {
        maxPower: 2250,
        maxTorque: 15,
        maxSpeed: 6000,
        minSpeed: 50,
        efficiency: 0.9,
        mechanicalLoss: 100,
      },
      cnc_vertical_mill: {
        maxPower: 5000,
        maxTorque: 25,
        maxSpeed: 10000,
        minSpeed: 10,
        efficiency: 0.88,
        mechanicalLoss: 150,
      },
      high_speed_spindle: {
        maxPower: 3000,
        maxTorque: 10,
        maxSpeed: 24000,
        minSpeed: 100,
        efficiency: 0.92,
        mechanicalLoss: 80,
      },
      high_torque_spindle: {
        maxPower: 4000,
        maxTorque: 50,
        maxSpeed: 3000,
        minSpeed: 10,
        efficiency: 0.85,
        mechanicalLoss: 200,
      },
    };

    if (!specs[type]) {
      throw new Error(`Unknown spindle type: ${type}`);
    }

    return specs[type];
  }
}

export default SpindleLoadBridge;
