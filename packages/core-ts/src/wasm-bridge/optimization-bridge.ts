/**
 * TypeScript Bridge for Phase 24 Optimization Systems
 *
 * Provides type-safe access to WASM optimization simulators:
 * - ML Cutting Force Predictor
 * - Design-for-Manufacturability Checker
 * - Cost Estimator
 */

import type {
  WasmOptimizationSimulator,
  WasmOptimizationRequest,
  WasmOptimizationResult,
  WasmDFMRequest,
  WasmDFMResult,
  WasmDFMViolation,
} from '../wasm-module';

/**
 * Type-safe request for cutting force prediction
 */
export interface OptimizationRequest {
  spindle_speed: number; // RPM
  feed_rate: number; // mm/min
  depth_of_cut: number; // mm
  material_code: number; // 0=Steel, 1=Aluminum, 2=Titanium, 3=CastIron
}

/**
 * Type-safe result from cutting force prediction
 */
export interface OptimizationResult {
  feed_force: number; // N
  radial_force: number; // N
  axial_force: number; // N
  success: boolean;
  message: string;
}

/**
 * Type-safe DFM request
 */
export interface DFMRequest {
  hole_diameters: number[]; // mm
  trace_widths: number[]; // mm
  min_trace_clearance_mm: number;
  min_wall_thickness_mm: number;
  via_count: number;
  board_area_mm2: number;
}

/**
 * Type-safe DFM violation
 */
export interface DFMViolation {
  check_name: string;
  severity: 'Info' | 'Warning' | 'Critical';
  message: string;
  cost_impact_pct: number;
  recommendation: string;
}

/**
 * Type-safe DFM result
 */
export interface DFMResult {
  violations: DFMViolation[];
  cost_multiplier: number;
  total_severity_level: string;
}

/**
 * Optimization Report combining forces and DFM
 */
export interface OptimizationReport {
  cutting_forces: OptimizationResult;
  dfm_analysis: DFMResult;
  timestamp: number;
}

/**
 * Bridge to WASM Optimization Systems
 * Handles all communication between TypeScript and Rust WASM
 */
export class OptimizationBridge {
  private wasmModule: WasmOptimizationSimulator | null = null;
  private isInitialized = false;

  /**
   * Initialize the WASM module
   */
  async initialize(wasmModule: any): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Import WASM module dynamically
      const WasmExports = wasmModule;
      this.wasmModule = new WasmExports.WasmOptimizationSimulator();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize WASM optimization module: ${error}`);
    }
  }

  /**
   * Predict cutting forces using ML
   * @param request Optimization request with cutting parameters
   * @returns Predicted cutting forces
   */
  async predictCuttingForces(request: OptimizationRequest): Promise<OptimizationResult> {
    if (!this.wasmModule || !this.isInitialized) {
      throw new Error('WASM module not initialized');
    }

    try {
      const requestJson = JSON.stringify(request);
      const resultJson = this.wasmModule.predict_cutting_forces(requestJson);
      const result: WasmOptimizationResult = JSON.parse(resultJson);

      return {
        feed_force: result.feed_force,
        radial_force: result.radial_force,
        axial_force: result.axial_force,
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      throw new Error(`Failed to predict cutting forces: ${error}`);
    }
  }

  /**
   * Check PCB Design-for-Manufacturability
   * @param request DFM request with PCB parameters
   * @returns DFM analysis result with violations and cost impact
   */
  async checkDFM(request: DFMRequest): Promise<DFMResult> {
    if (!this.wasmModule || !this.isInitialized) {
      throw new Error('WASM module not initialized');
    }

    try {
      const requestJson = JSON.stringify(request);
      const resultJson = this.wasmModule.check_dfm_pcb(requestJson);
      const result: WasmDFMResult = JSON.parse(resultJson);

      return {
        violations: result.violations.map(v => ({
          check_name: v.check_name,
          severity: (v.severity.replace(/"/g, '') as 'Info' | 'Warning' | 'Critical'),
          message: v.message,
          cost_impact_pct: v.cost_impact_pct,
          recommendation: v.recommendation,
        })),
        cost_multiplier: result.cost_multiplier,
        total_severity_level: result.total_severity_level,
      };
    } catch (error) {
      throw new Error(`Failed to check DFM: ${error}`);
    }
  }

  /**
   * Get comprehensive optimization report
   * @param forcesRequest Cutting forces request
   * @param dfmRequest DFM request
   * @returns Combined report with forces and DFM analysis
   */
  async getOptimizationReport(
    forcesRequest: OptimizationRequest,
    dfmRequest: DFMRequest
  ): Promise<OptimizationReport> {
    if (!this.wasmModule || !this.isInitialized) {
      throw new Error('WASM module not initialized');
    }

    try {
      const forcesJson = JSON.stringify(forcesRequest);
      const dfmJson = JSON.stringify(dfmRequest);
      const reportJson = this.wasmModule.get_optimization_report(forcesJson, dfmJson);
      const report = JSON.parse(reportJson);

      return {
        cutting_forces: report.cutting_forces,
        dfm_analysis: report.dfm_analysis,
        timestamp: report.timestamp,
      };
    } catch (error) {
      throw new Error(`Failed to get optimization report: ${error}`);
    }
  }

  /**
   * Batch predict cutting forces for multiple parameter sets
   * @param requests Array of optimization requests
   * @returns Array of prediction results
   */
  async predictBatch(requests: OptimizationRequest[]): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.predictCuttingForces(request);
        results.push(result);
      } catch (error) {
        console.error(`Error predicting forces for request:`, request, error);
        results.push({
          feed_force: 0,
          radial_force: 0,
          axial_force: 0,
          success: false,
          message: `Error: ${error}`,
        });
      }
    }

    return results;
  }

  /**
   * Calculate cost optimization
   * @param dfmResult DFM analysis result
   * @param base_cost_usd Base manufacturing cost
   * @returns Cost multiplier and estimated final cost
   */
  calculateCostOptimization(dfmResult: DFMResult, base_cost_usd: number) {
    return {
      cost_multiplier: dfmResult.cost_multiplier,
      estimated_cost: base_cost_usd * dfmResult.cost_multiplier,
      critical_violations: dfmResult.violations.filter(v => v.severity === 'Critical').length,
      warnings: dfmResult.violations.filter(v => v.severity === 'Warning').length,
      info_messages: dfmResult.violations.filter(v => v.severity === 'Info').length,
    };
  }

  /**
   * Get recommendations for cost reduction
   * @param dfmResult DFM analysis result
   * @returns Sorted list of recommendations by cost impact
   */
  getRecommendations(dfmResult: DFMResult): Array<{
    recommendation: string;
    potential_savings_pct: number;
    severity: string;
  }> {
    return dfmResult.violations
      .map(v => ({
        recommendation: v.recommendation,
        potential_savings_pct: v.cost_impact_pct,
        severity: v.severity,
      }))
      .sort((a, b) => b.potential_savings_pct - a.potential_savings_pct);
  }

  /**
   * Check if module is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.wasmModule !== null;
  }

  /**
   * Reset the bridge
   */
  reset(): void {
    this.wasmModule = null;
    this.isInitialized = false;
  }
}

/**
 * Singleton instance of the optimization bridge
 */
let optimizationBridgeInstance: OptimizationBridge | null = null;

/**
 * Get or create the optimization bridge instance
 */
export function getOptimizationBridge(): OptimizationBridge {
  if (!optimizationBridgeInstance) {
    optimizationBridgeInstance = new OptimizationBridge();
  }
  return optimizationBridgeInstance;
}

/**
 * Initialize the global optimization bridge
 */
export async function initializeOptimizationBridge(wasmModule: any): Promise<OptimizationBridge> {
  const bridge = getOptimizationBridge();
  await bridge.initialize(wasmModule);
  return bridge;
}
