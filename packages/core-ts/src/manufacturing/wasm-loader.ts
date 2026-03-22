/**
 * WASM Module Loader
 * Phase 20: Rust WASM Integration
 * Handles loading and initialization of Rust manufacturing module
 */

/**
 * WASM Manufacturing Module Type
 * Defines the expected interface from the compiled Rust WASM module
 */
export interface WasmManufacturingModule {
  WasmManufacturingSimulator: {
    new(): WasmSimulatorInstance;
  };
  get_supported_materials(): string;
  get_tool_materials(): string;
  get_spindle_specs(): string;
  memory?: WebAssembly.Memory;
}

/**
 * WASM Simulator Instance
 * Methods exposed by the Rust simulator
 */
export interface WasmSimulatorInstance {
  calculate_cutting_forces(request: string): string;
  calculate_spindle_load(request: string): string;
  analyze_thermal(request: string): string;
  simulate_manufacturing(
    cutting_forces: string | null,
    spindle_load: string | null,
    thermal: string | null
  ): string;
  version(): string;
  free?(): void;
}

class WasmModuleLoader {
  private static instance: WasmModuleLoader | null = null;
  private wasmModule: WasmManufacturingModule | null = null;
  private simulator: WasmSimulatorInstance | null = null;
  private isInitialized = false;
  private initPromise: Promise<WasmManufacturingModule | null> | null = null;

  private constructor() {}

  static getInstance(): WasmModuleLoader {
    if (!WasmModuleLoader.instance) {
      WasmModuleLoader.instance = new WasmModuleLoader();
    }
    return WasmModuleLoader.instance;
  }

  /**
   * Load WASM module from specified path
   * @param wasmPath Path to the .wasm file (default: '/tupan_core.wasm' from public directory)
   * @returns Promise resolving to the WASM module or null if loading fails
   */
  async loadWasm(wasmPath: string = '/tupan_core.wasm'): Promise<WasmManufacturingModule | null> {
    // Return cached module if already loaded
    if (this.isInitialized && this.wasmModule) {
      return this.wasmModule;
    }

    // Return existing promise if load is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create new load promise
    this.initPromise = this.performLoad(wasmPath);
    return this.initPromise;
  }

  /**
   * Perform actual WASM loading
   */
  private async performLoad(wasmPath: string): Promise<WasmManufacturingModule | null> {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        console.warn('WASM loading not available in non-browser environment');
        return null;
      }

      // Fetch the WASM binary
      const response = await fetch(wasmPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // Instantiate the WASM module
      const wasmModule = await WebAssembly.instantiate(buffer) as any;
      const exports = wasmModule.instance.exports as WasmManufacturingModule;

      // Verify required exports exist
      if (!exports.WasmManufacturingSimulator) {
        throw new Error('WASM module missing WasmManufacturingSimulator export');
      }

      // Create simulator instance
      this.simulator = new exports.WasmManufacturingSimulator();
      this.wasmModule = exports;
      this.isInitialized = true;

      console.log(`✅ WASM module loaded successfully (${exports.WasmManufacturingSimulator.constructor.name})`);
      return exports;
    } catch (error) {
      console.warn('⚠️ Failed to load WASM module:', error);
      this.isInitialized = false;
      this.wasmModule = null;
      this.simulator = null;
      return null;
    }
  }

  /**
   * Get the WASM simulator instance
   */
  getSimulator(): WasmSimulatorInstance | null {
    return this.simulator;
  }

  /**
   * Check if WASM module is loaded
   */
  isLoaded(): boolean {
    return this.isInitialized && this.simulator !== null;
  }

  /**
   * Get supported materials from WASM module
   */
  getSupportedMaterials(): string[] {
    if (!this.wasmModule) return [];
    try {
      const materialsJson = this.wasmModule.get_supported_materials();
      return JSON.parse(materialsJson);
    } catch (error) {
      console.error('Error getting materials:', error);
      return [];
    }
  }

  /**
   * Get tool materials from WASM module
   */
  getToolMaterials(): string[] {
    if (!this.wasmModule) return [];
    try {
      const materialsJson = this.wasmModule.get_tool_materials();
      return JSON.parse(materialsJson);
    } catch (error) {
      console.error('Error getting tool materials:', error);
      return [];
    }
  }

  /**
   * Get spindle specs from WASM module
   */
  getSpindleSpecs(): string[] {
    if (!this.wasmModule) return [];
    try {
      const specsJson = this.wasmModule.get_spindle_specs();
      return JSON.parse(specsJson);
    } catch (error) {
      console.error('Error getting spindle specs:', error);
      return [];
    }
  }

  /**
   * Clean up WASM resources
   */
  cleanup(): void {
    if (this.simulator && typeof (this.simulator as any).free === 'function') {
      (this.simulator as any).free();
    }
    this.simulator = null;
    this.wasmModule = null;
    this.isInitialized = false;
  }
}

export { WasmModuleLoader };
export default WasmModuleLoader.getInstance();
