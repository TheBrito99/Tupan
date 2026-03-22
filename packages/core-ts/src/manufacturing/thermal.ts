/**
 * Thermal Analysis Bridge
 * Phase 19-20: Thermal Analysis with WASM Support
 */

import { ThermalResult, ThermalRisk, ThermalMaterial, ToolThermal } from './types';
import { type WasmSimulatorInstance } from './wasm-loader';

/**
 * Thermal Analysis calculation bridge
 * Uses WASM when available, falls back to mocks
 */
export class ThermalBridge {
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
      console.warn('Failed to initialize WASM simulator for thermal analysis:', error);
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
   * Analyze thermal conditions during machining
   */
  analyzeThermal(
    workpieceMaterial: string,
    toolMaterial: string,
    cuttingPower: number,
    chipArea: number,
    cuttingTimeSec: number,
    ambientTemp: number,
    coolantAvailable: boolean
  ): ThermalResult {
    // Try WASM first if available
    if (this.useWasm && this.wasmSimulator) {
      try {
        const request = JSON.stringify({
          workpiece_material: workpieceMaterial,
          tool_material: toolMaterial,
          cutting_power: cuttingPower,
          chip_area: chipArea,
          cutting_time_sec: cuttingTimeSec,
          ambient_temp: ambientTemp,
          coolant_available: coolantAvailable,
        });

        const resultJson = this.wasmSimulator.analyze_thermal(request);
        const result = JSON.parse(resultJson);

        return {
          chipTemperature: result.chip_temperature,
          toolTemperature: result.tool_temperature,
          workpieceTemperature: result.workpiece_temperature,
          toolLifeRatio: result.tool_life_ratio,
          thermalRisk: result.thermal_risk as ThermalRisk,
          heatGenerated: result.heat_generated,
        };
      } catch (error) {
        console.warn('WASM thermal analysis failed, falling back to mock:', error);
        this.useWasm = false;
      }
    }

    // Get material properties
    const workpieceMat = this.getThermalMaterial(workpieceMaterial);
    if (!workpieceMat) {
      throw new Error(`Unknown workpiece material: ${workpieceMaterial}`);
    }

    const toolThermal = this.getToolThermal(toolMaterial);

    // Calculate chip temperature
    const chipTemp = this.calculateChipTemperature(
      workpieceMaterial,
      cuttingPower,
      chipArea,
      ambientTemp
    );

    // Calculate tool temperature
    let toolTemp = this.calculateToolTemperature(
      chipTemp,
      toolThermal,
      chipArea,
      cuttingTimeSec,
      ambientTemp
    );

    // Apply coolant effect
    if (coolantAvailable) {
      toolTemp = (toolTemp + ambientTemp) / 2; // Roughly halves the temperature rise
    }

    // Calculate workpiece temperature
    const workpieceTemp = this.calculateWorkpieceTemperature(
      toolTemp,
      workpieceMaterial,
      chipArea * 0.5,
      cuttingTimeSec,
      ambientTemp
    );

    // Heat generated
    const heatGenerated = cuttingPower;

    // Tool life assessment (Arrhenius model)
    const maxToolTemp = this.getMaxToolTemp(toolMaterial);
    const toolLifeRatio = this.calculateToolLifeRatio(toolTemp, maxToolTemp);

    // Risk assessment
    const thermalRisk = this.assessThermalRisk(toolTemp, maxToolTemp);

    return {
      chipTemperature: chipTemp,
      toolTemperature: toolTemp,
      workpieceTemperature: workpieceTemp,
      heatGenerated,
      toolLifeRatio,
      thermalRisk,
    };
  }

  /**
   * Calculate chip temperature using Merchant's model
   */
  private calculateChipTemperature(
    material: string,
    cuttingPower: number,
    chipArea: number,
    ambientTemp: number
  ): number {
    const mat = this.getThermalMaterial(material);
    if (!mat) return ambientTemp;

    // Heat generated at shear plane (~80% goes to chip)
    const shearHeat = cuttingPower * 0.8;

    // Chip mass calculation
    const chipMass = (chipArea / 1000) * 1 * mat.density / 1000; // in kg

    // Temperature rise: ΔT = Q / (m * Cv)
    const tempRise =
      chipMass > 0.0001
        ? shearHeat / (chipMass * mat.specificHeat)
        : shearHeat / 100;

    // Cap at 95% of melting point
    return Math.min(ambientTemp + tempRise, mat.meltingPoint * 0.95);
  }

  /**
   * Calculate tool temperature from chip contact
   */
  private calculateToolTemperature(
    chipTemp: number,
    toolThermal: ToolThermal,
    contactArea: number,
    cuttingTimeSec: number,
    ambientTemp: number
  ): number {
    // Heat transfer coefficient at tool-chip interface
    const hContact = 5000; // W/(m²·K)

    // Contact area
    const contactAreaRatio = Math.min(contactArea / 20, 1.0);
    const contactAreaM2 = (toolThermal.insertArea * contactAreaRatio) / 1e6;

    // Transient heat: exponential approach to equilibrium
    const tau = 60; // Time constant (seconds)
    const timeFactor = 1 - Math.exp(-cuttingTimeSec / tau);

    // Temperature rise (50% of chip-tool difference)
    const tempRise = (chipTemp - ambientTemp) * 0.5 * timeFactor;

    return ambientTemp + tempRise;
  }

  /**
   * Calculate workpiece temperature from tool contact
   */
  private calculateWorkpieceTemperature(
    toolTemp: number,
    material: string,
    contactArea: number,
    cuttingTimeSec: number,
    ambientTemp: number
  ): number {
    const mat = this.getThermalMaterial(material);
    if (!mat) return ambientTemp;

    // Thermal diffusivity
    const thermalDiffusivity =
      mat.thermalConductivity / (mat.density * mat.specificHeat);

    // Temperature at surface (30% of tool-workpiece difference)
    const surfaceTempRise = (toolTemp - ambientTemp) * 0.3;

    return Math.min(
      ambientTemp + surfaceTempRise,
      mat.meltingPoint * 0.95
    );
  }

  /**
   * Calculate tool life ratio (Arrhenius model)
   */
  private calculateToolLifeRatio(
    toolTemp: number,
    maxToolTemp: number
  ): number {
    if (toolTemp < maxToolTemp * 0.8) {
      return 0.1;
    } else if (toolTemp < maxToolTemp * 0.95) {
      return 0.3;
    } else if (toolTemp < maxToolTemp) {
      return 0.6;
    } else {
      return 1.0;
    }
  }

  /**
   * Assess thermal risk
   */
  private assessThermalRisk(
    toolTemp: number,
    maxToolTemp: number
  ): ThermalRisk {
    if (toolTemp > maxToolTemp) {
      return 'Failure';
    } else if (toolTemp > maxToolTemp * 0.95) {
      return 'Critical';
    } else if (toolTemp > maxToolTemp * 0.8) {
      return 'Caution';
    } else {
      return 'Safe';
    }
  }

  /**
   * Get maximum tool temperature for tool material
   */
  private getMaxToolTemp(toolMaterial: string): number {
    const temps: Record<string, number> = {
      HSS: 850,
      Carbide: 950,
      Ceramic: 1200,
    };
    return temps[toolMaterial] || 900;
  }

  /**
   * Get thermal material properties
   */
  private getThermalMaterial(material: string): ThermalMaterial | null {
    const materials: Record<string, ThermalMaterial> = {
      Aluminum: {
        name: 'Aluminum',
        thermalConductivity: 205,
        specificHeat: 900,
        density: 2700,
        meltingPoint: 660,
        maxToolTemp: 850,
      },
      Steel: {
        name: 'Steel',
        thermalConductivity: 50,
        specificHeat: 490,
        density: 7850,
        meltingPoint: 1540,
        maxToolTemp: 900,
      },
      Titanium: {
        name: 'Titanium',
        thermalConductivity: 7.4,
        specificHeat: 520,
        density: 4500,
        meltingPoint: 1660,
        maxToolTemp: 850,
      },
      'Cast Iron': {
        name: 'Cast Iron',
        thermalConductivity: 50,
        specificHeat: 460,
        density: 7250,
        meltingPoint: 1200,
        maxToolTemp: 950,
      },
    };

    return materials[material] || null;
  }

  /**
   * Get tool thermal properties
   */
  private getToolThermal(toolMaterial: string): ToolThermal {
    const tools: Record<string, ToolThermal> = {
      HSS: {
        toolMaterial: 'HSS',
        thermalConductivity: 30,
        specificHeat: 460,
        toolMass: 5,
        insertArea: 25,
      },
      Carbide: {
        toolMaterial: 'Carbide',
        thermalConductivity: 100,
        specificHeat: 420,
        toolMass: 3,
        insertArea: 20,
      },
      Ceramic: {
        toolMaterial: 'Ceramic',
        thermalConductivity: 25,
        specificHeat: 750,
        toolMass: 2,
        insertArea: 15,
      },
    };

    return tools[toolMaterial] || tools.Carbide;
  }

  /**
   * Get coolant recommendation
   */
  getCoolantRecommendation(material: string): string {
    const recommendations: Record<string, string> = {
      Aluminum: 'Light mineral oil (water-soluble)',
      Steel: 'Heavy mineral oil or synthetic',
      Titanium: 'Extreme pressure (EP) oil',
      'Cast Iron': 'Dry or light spray',
    };

    return recommendations[material] || 'General purpose coolant';
  }

  /**
   * Estimate thermal shock risk
   */
  estimateThermalShockRisk(
    toolTemp: number,
    ambientTemp: number,
    toolMaterial: string
  ): number {
    const tempDiff = toolTemp - ambientTemp;

    const materialFactor: Record<string, number> = {
      Ceramic: 2.0,
      Carbide: 1.5,
      HSS: 1.0,
    };

    const mFactor = materialFactor[toolMaterial] || 1.0;
    return (tempDiff / 500) * mFactor;
  }
}

export default ThermalBridge;
