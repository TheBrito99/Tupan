/**
 * Cutting Forces Bridge
 * Phase 19-20: Kienzle Equation with WASM Support
 * Calculates cutting forces with real Rust engine or mock fallback
 */

import { CuttingForceResult, MaterialCuttingCoefficients } from './types';
import WasmModuleLoader, { type WasmSimulatorInstance } from './wasm-loader';

/**
 * Cutting Forces calculation bridge
 * Uses WASM when available, falls back to mocks
 */
export class CuttingForcesBridge {
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
        console.log('✅ WASM simulator initialized for cutting forces');
      }
    } catch (error) {
      console.warn('Failed to initialize WASM simulator:', error);
      this.useWasm = false;
    }
  }

  /**
   * Set WASM module (called after WASM initialization)
   */
  setWasmModule(module: any) {
    this.wasmModule = module;
    if (module) {
      this.tryInitializeWasm();
    }
  }

  /**
   * Calculate cutting forces using Kienzle equation
   */
  calculateForces(
    material: string,
    feedPerTooth: number,
    depthOfCut: number,
    cuttingSpeed: number,
    fluteCount: number
  ): CuttingForceResult {
    // Try WASM first if available
    if (this.useWasm && this.wasmSimulator) {
      try {
        const request = JSON.stringify({
          material,
          feed_per_tooth: feedPerTooth,
          depth_of_cut: depthOfCut,
          cutting_speed: cuttingSpeed,
          flute_count: fluteCount,
        });

        const resultJson = this.wasmSimulator.calculate_cutting_forces(request);
        const result = JSON.parse(resultJson);

        return {
          force: result.force,
          feedForce: result.feed_force,
          radialForce: result.radial_force,
          cuttingPower: result.cutting_power,
        };
      } catch (error) {
        console.warn('WASM calculation failed, falling back to mock:', error);
        this.useWasm = false;
      }
    }

    // Fallback: Mock implementation for development
    return this.calculateForcesMock(
      material,
      feedPerTooth,
      depthOfCut,
      cuttingSpeed,
      fluteCount
    );
  }

  /**
   * Mock implementation for development
   * Implements Kienzle equation: F = Ks * A * v^m
   */
  private calculateForcesMock(
    material: string,
    feedPerTooth: number,
    depthOfCut: number,
    cuttingSpeed: number,
    fluteCount: number
  ): CuttingForceResult {
    const coefficients = this.getMaterialCoefficients(material);
    if (!coefficients) {
      throw new Error(`Unknown material: ${material}`);
    }

    // Chip load area
    const chipArea = feedPerTooth * depthOfCut;

    // Speed factor
    const speedFactor = Math.pow(cuttingSpeed, coefficients.cuttingSpeedExponent);

    // Specific cutting force
    const specificForce = coefficients.ks * speedFactor;

    // Tangential force
    const tangentialForce = specificForce * chipArea + coefficients.ks0 * feedPerTooth;

    // Other forces
    const feedForce = tangentialForce * coefficients.feedForceRatio;
    const radialForce = tangentialForce * coefficients.radialForceRatio;

    // Total force
    const totalForce = Math.sqrt(
      tangentialForce ** 2 + feedForce ** 2 + radialForce ** 2
    );

    // Cutting power: Pc = Ft * v
    const cuttingPower = (tangentialForce * cuttingSpeed) / 1000; // Convert to W

    // Validity check
    const forceValidity =
      tangentialForce > 0 && tangentialForce < 50000
        ? 0.95
        : tangentialForce > 0
          ? 0.7
          : 0;

    return {
      tangentialForce,
      feedForce,
      radialForce,
      totalForce,
      cuttingPower,
      forceValidity,
    };
  }

  /**
   * Get material cutting coefficients
   */
  private getMaterialCoefficients(material: string): MaterialCuttingCoefficients | null {
    const coefficients: Record<string, MaterialCuttingCoefficients> = {
      Aluminum: {
        material: 'Aluminum',
        ks: 600,
        ks0: 20,
        feedForceRatio: 0.25,
        radialForceRatio: 0.35,
        cuttingSpeedExponent: -0.25,
        feedExponent: 0.75,
        depthExponent: 0.9,
      },
      Steel: {
        material: 'Steel',
        ks: 1800,
        ks0: 80,
        feedForceRatio: 0.35,
        radialForceRatio: 0.5,
        cuttingSpeedExponent: -0.3,
        feedExponent: 0.85,
        depthExponent: 0.95,
      },
      Titanium: {
        material: 'Titanium',
        ks: 2200,
        ks0: 100,
        feedForceRatio: 0.4,
        radialForceRatio: 0.55,
        cuttingSpeedExponent: -0.35,
        feedExponent: 0.8,
        depthExponent: 0.92,
      },
      'Cast Iron': {
        material: 'Cast Iron',
        ks: 1400,
        ks0: 60,
        feedForceRatio: 0.3,
        radialForceRatio: 0.45,
        cuttingSpeedExponent: -0.28,
        feedExponent: 0.78,
        depthExponent: 0.88,
      },
      'Stainless Steel': {
        material: 'Stainless Steel',
        ks: 2100,
        ks0: 90,
        feedForceRatio: 0.38,
        radialForceRatio: 0.52,
        cuttingSpeedExponent: -0.32,
        feedExponent: 0.82,
        depthExponent: 0.93,
      },
    };

    return coefficients[material] || null;
  }

  /**
   * Estimate tool wear based on cutting force
   */
  estimateToolWear(
    tangentialForce: number,
    cuttingDistance: number,
    toolMaterial: string,
    coolantAvailable: boolean
  ): number {
    // Base wear rate
    const baseWearRate = 0.00001;
    const forceFactor = Math.max(tangentialForce / 1000, 0.1);
    const coolantFactor = coolantAvailable ? 0.7 : 1.0;
    const materialFactor: Record<string, number> = {
      HSS: 1.0,
      Carbide: 0.3,
      Ceramic: 0.2,
    };

    const mFactor = materialFactor[toolMaterial] || 1.0;
    return baseWearRate * forceF actor * cuttingDistance * coolantFactor * mFactor;
  }

  /**
   * Get supported materials
   */
  getSupportedMaterials(): string[] {
    return ['Aluminum', 'Steel', 'Titanium', 'Cast Iron', 'Stainless Steel'];
  }
}

export default CuttingForcesBridge;
