/**
 * Manufacturing Bridge - Unified Export
 * Phase 19: WASM Integration Layer
 * Orchestrates cutting force, spindle load, and thermal analysis
 */

export * from './types';
export { CuttingForcesBridge } from './cutting-forces';
export { SpindleLoadBridge } from './spindle-load';
export { ThermalBridge } from './thermal';

import { CuttingForcesBridge } from './cutting-forces';
import { SpindleLoadBridge } from './spindle-load';
import { ThermalBridge } from './thermal';
import type { ManufacturingSimulation, ManufacturingSimulationRequest } from './types';

/**
 * Unified Manufacturing Bridge
 * Orchestrates cutting force, spindle load, and thermal analysis
 * Provides WASM integration with fallback mock implementations
 */
export class ManufacturingBridge {
  private static instance: ManufacturingBridge | null = null;
  private static wasmModule: any = null;

  private cuttingForcesBridge: CuttingForcesBridge;
  private spindleLoadBridge: SpindleLoadBridge;
  private thermalBridge: ThermalBridge;

  private constructor(wasmModule?: any) {
    this.cuttingForcesBridge = new CuttingForcesBridge(wasmModule);
    this.spindleLoadBridge = new SpindleLoadBridge(wasmModule);
    this.thermalBridge = new ThermalBridge(wasmModule);

    if (wasmModule) {
      ManufacturingBridge.wasmModule = wasmModule;
    }
  }

  /**
   * Initialize the manufacturing bridge
   * @param wasmPath Optional path to WASM module (e.g., 'tupan_core.wasm')
   */
  static async initialize(wasmPath?: string): Promise<ManufacturingBridge> {
    if (ManufacturingBridge.instance) {
      return ManufacturingBridge.instance;
    }

    let wasmModule: any = undefined;

    if (wasmPath) {
      try {
        // Attempt to load WASM module
        const wasmUrl = typeof wasmPath === 'string' ? wasmPath : 'tupan_core.wasm';

        if (typeof window !== 'undefined') {
          // Browser environment
          const response = await fetch(wasmUrl);
          const buffer = await response.arrayBuffer();
          const { memory, ...exports } = await WebAssembly.instantiate(buffer);
          wasmModule = exports;
        }
      } catch (error) {
        console.warn('Failed to load WASM module, using mock implementations:', error);
        // Fall back to mock implementations
      }
    }

    ManufacturingBridge.instance = new ManufacturingBridge(wasmModule);
    return ManufacturingBridge.instance;
  }

  /**
   * Set WASM module for lazy loading
   */
  static setWasmModule(module: any): void {
    ManufacturingBridge.wasmModule = module;
    if (ManufacturingBridge.instance) {
      ManufacturingBridge.instance.cuttingForcesBridge.setWasmModule(module);
      ManufacturingBridge.instance.spindleLoadBridge.setWasmModule(module);
      ManufacturingBridge.instance.thermalBridge.setWasmModule(module);
    }
  }

  /**
   * Get singleton instance (must call initialize first)
   */
  static getInstance(): ManufacturingBridge {
    if (!ManufacturingBridge.instance) {
      throw new Error('ManufacturingBridge not initialized. Call initialize() first.');
    }
    return ManufacturingBridge.instance;
  }

  /**
   * Run comprehensive manufacturing simulation
   */
  simulateManufacturing(request: ManufacturingSimulationRequest): ManufacturingSimulation {
    const { cuttingForces, spindleLoad, thermal } = request;

    // Calculate cutting forces
    const cuttingForceResult = cuttingForces ? this.cuttingForcesBridge.calculateForces(
      cuttingForces.material,
      cuttingForces.feedPerTooth,
      cuttingForces.depthOfCut,
      cuttingForces.cuttingSpeed,
      cuttingForces.fluteCount
    ) : undefined;

    // Calculate spindle load
    const spindleLoadResult = spindleLoad ? this.spindleLoadBridge.calculateLoad(
      spindleLoad.cuttingPower || cuttingForceResult?.cuttingPower || 0,
      spindleLoad.spindleSpec,
      spindleLoad.spindleSpeed
    ) : undefined;

    // Analyze thermal
    const thermalResult = thermal ? this.thermalBridge.analyzeThermal(
      thermal.workpieceMaterial,
      thermal.toolMaterial,
      thermal.cuttingPower || cuttingForceResult?.cuttingPower || 0,
      thermal.chipArea,
      thermal.cuttingTimeSec,
      thermal.ambientTemp,
      thermal.coolantAvailable
    ) : undefined;

    // Determine overall safety status
    const safetyStatus = this.determineSafetyStatus(
      cuttingForceResult?.force || 0,
      spindleLoadResult?.riskStatus || 'Safe',
      thermalResult?.thermalRisk || 'Safe'
    );

    return {
      timestamp: new Date(),
      cuttingForces: cuttingForceResult,
      spindleLoad: spindleLoadResult,
      thermal: thermalResult,
      safetyStatus,
      simulationSuccessful: true,
    };
  }

  /**
   * Determine overall safety status from all three analyses
   */
  private determineSafetyStatus(
    force: number,
    spindleRisk: string,
    thermalRisk: string
  ): 'Safe' | 'Caution' | 'Critical' | 'Failure' {
    // Map risks to numeric levels
    const riskLevels: Record<string, number> = {
      'Safe': 0,
      'Caution': 1,
      'Critical': 2,
      'Failure': 3,
    };

    const maxRisk = Math.max(
      riskLevels[spindleRisk] || 0,
      riskLevels[thermalRisk] || 0,
      force > 5000 ? 2 : force > 3000 ? 1 : 0
    );

    const statusMap = ['Safe', 'Caution', 'Critical', 'Failure'];
    return statusMap[maxRisk] as any;
  }

  /**
   * Get cutting forces bridge
   */
  getCuttingForcesBridge(): CuttingForcesBridge {
    return this.cuttingForcesBridge;
  }

  /**
   * Get spindle load bridge
   */
  getSpindleLoadBridge(): SpindleLoadBridge {
    return this.spindleLoadBridge;
  }

  /**
   * Get thermal bridge
   */
  getThermalBridge(): ThermalBridge {
    return this.thermalBridge;
  }
}

/**
 * Global helper: Get or initialize manufacturing bridge
 */
export async function getManufacturingBridge(): Promise<ManufacturingBridge> {
  if (ManufacturingBridge.instance) {
    return ManufacturingBridge.instance;
  }
  return await ManufacturingBridge.initialize();
}

/**
 * Initialize manufacturing bridge with optional WASM path
 * Call this once in your application startup
 *
 * Usage:
 *   import { initializeManufacturingBridge } from '@tupan/core-ts';
 *   await initializeManufacturingBridge('tupan_core.wasm');
 */
export async function initializeManufacturingBridge(wasmPath?: string): Promise<ManufacturingBridge> {
  return await ManufacturingBridge.initialize(wasmPath);
}

export default ManufacturingBridge;
