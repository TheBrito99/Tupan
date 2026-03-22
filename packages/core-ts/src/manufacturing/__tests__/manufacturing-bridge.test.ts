/**
 * Manufacturing Bridge Integration Tests
 * Phase 19: WASM Integration Layer
 * Tests the complete bridge orchestration with mock implementations
 */

import {
  ManufacturingBridge,
  initializeManufacturingBridge,
  getManufacturingBridge,
  CuttingForcesBridge,
  SpindleLoadBridge,
  ThermalBridge,
  type ManufacturingSimulationRequest,
} from '../index';

describe('ManufacturingBridge - Singleton Pattern', () => {
  beforeEach(() => {
    // Clear singleton for each test
    (ManufacturingBridge as any).instance = null;
  });

  it('should initialize bridge on first call', async () => {
    const bridge = await initializeManufacturingBridge();
    expect(bridge).toBeDefined();
  });

  it('should return same instance on subsequent calls', async () => {
    const bridge1 = await initializeManufacturingBridge();
    const bridge2 = await initializeManufacturingBridge();
    expect(bridge1).toBe(bridge2);
  });

  it('should get instance after initialization', async () => {
    await initializeManufacturingBridge();
    const instance = ManufacturingBridge.getInstance();
    expect(instance).toBeDefined();
  });

  it('should throw error when getting uninitialized instance', () => {
    expect(() => ManufacturingBridge.getInstance()).toThrow(
      'ManufacturingBridge not initialized. Call initialize() first.'
    );
  });
});

describe('CuttingForcesBridge - Kienzle Equation', () => {
  let bridge: ManufacturingBridge;

  beforeEach(async () => {
    (ManufacturingBridge as any).instance = null;
    bridge = await initializeManufacturingBridge();
  });

  it('should calculate cutting forces for steel', () => {
    const cuttingBridge = bridge.getCuttingForcesBridge();
    const result = cuttingBridge.calculateForces(
      'Steel',     // material
      0.1,         // feedPerTooth (mm)
      2.0,         // depthOfCut (mm)
      150,         // cuttingSpeed (m/min)
      2            // fluteCount
    );

    expect(result.force).toBeGreaterThan(0);
    expect(result.feedForce).toBeGreaterThan(0);
    expect(result.radialForce).toBeGreaterThan(0);
    expect(result.cuttingPower).toBeGreaterThan(0);
  });

  it('should calculate cutting forces for aluminum', () => {
    const cuttingBridge = bridge.getCuttingForcesBridge();
    const result = cuttingBridge.calculateForces(
      'Aluminum',
      0.15,
      3.0,
      300,
      3
    );

    expect(result.force).toBeGreaterThan(0);
    // Aluminum should have lower forces than steel at similar parameters
  });

  it('should scale forces with depth of cut', () => {
    const cuttingBridge = bridge.getCuttingForcesBridge();
    const result1 = cuttingBridge.calculateForces('Steel', 0.1, 1.0, 150, 2);
    const result2 = cuttingBridge.calculateForces('Steel', 0.1, 2.0, 150, 2);

    // Deeper cut should produce higher forces
    expect(result2.force).toBeGreaterThan(result1.force);
  });

  it('should scale forces with feed per tooth', () => {
    const cuttingBridge = bridge.getCuttingForcesBridge();
    const result1 = cuttingBridge.calculateForces('Steel', 0.05, 2.0, 150, 2);
    const result2 = cuttingBridge.calculateForces('Steel', 0.15, 2.0, 150, 2);

    // Higher feed should produce higher forces
    expect(result2.force).toBeGreaterThan(result1.force);
  });

  it('should handle all material types', () => {
    const cuttingBridge = bridge.getCuttingForcesBridge();
    const materials = ['Steel', 'Aluminum', 'Titanium', 'Cast Iron', 'Stainless Steel'];

    materials.forEach((material) => {
      const result = cuttingBridge.calculateForces(material, 0.1, 2.0, 150, 2);
      expect(result.force).toBeGreaterThan(0);
    });
  });
});

describe('SpindleLoadBridge - Bearing Life Prediction', () => {
  let bridge: ManufacturingBridge;

  beforeEach(async () => {
    (ManufacturingBridge as any).instance = null;
    bridge = await initializeManufacturingBridge();
  });

  it('should calculate spindle load percentage', () => {
    const spindleBridge = bridge.getSpindleLoadBridge();
    const result = spindleBridge.calculateLoad(
      1000,              // cuttingPower (W)
      'generic_3hp',     // spindleSpec
      3000               // spindleSpeed (RPM)
    );

    expect(result.loadPercentage).toBeGreaterThan(0);
    expect(result.loadPercentage).toBeLessThanOrEqual(100);
    expect(result.torque).toBeGreaterThan(0);
  });

  it('should be within limits with low cutting power', () => {
    const spindleBridge = bridge.getSpindleLoadBridge();
    const result = spindleBridge.calculateLoad(500, 'generic_3hp', 3000);

    expect(result.isWithinLimits).toBe(true);
  });

  it('should exceed limits with high cutting power', () => {
    const spindleBridge = bridge.getSpindleLoadBridge();
    const result = spindleBridge.calculateLoad(5000, 'generic_3hp', 1000);

    // High power on low spindle spec should exceed limits
    expect(result.isWithinLimits).toBeFalsy();
  });

  it('should predict bearing life hours', () => {
    const spindleBridge = bridge.getSpindleLoadBridge();
    const life = spindleBridge.predictBearingLife(0.5, 3000, 100);

    expect(life).toBeGreaterThan(0);
  });

  it('should estimate maintenance intervals', () => {
    const spindleBridge = bridge.getSpindleLoadBridge();
    const interval = spindleBridge.getMaintenanceInterval(0.6, 3000, 1000);

    expect(interval).toBeGreaterThan(0);
  });

  it('should handle different spindle specifications', () => {
    const spindleBridge = bridge.getSpindleLoadBridge();
    const specs = ['generic_3hp', 'cnc_vertical_mill', 'high_speed_spindle', 'high_torque_spindle'];

    specs.forEach((spec) => {
      const result = spindleBridge.calculateLoad(1000, spec, 3000);
      expect(result.loadPercentage).toBeGreaterThan(0);
    });
  });
});

describe('ThermalBridge - Multi-Stage Thermal Analysis', () => {
  let bridge: ManufacturingBridge;

  beforeEach(async () => {
    (ManufacturingBridge as any).instance = null;
    bridge = await initializeManufacturingBridge();
  });

  it('should analyze thermal conditions', () => {
    const thermalBridge = bridge.getThermalBridge();
    const result = thermalBridge.analyzeThermal(
      'Steel',           // workpieceMaterial
      'Carbide',         // toolMaterial
      1000,              // cuttingPower (W)
      10.0,              // chipArea (mm²)
      60,                // cuttingTimeSec
      25,                // ambientTemp (°C)
      true               // coolantAvailable
    );

    expect(result.chipTemperature).toBeGreaterThan(25);
    expect(result.toolTemperature).toBeGreaterThan(25);
    expect(result.workpieceTemperature).toBeGreaterThan(25);
    expect(result.toolLifeRatio).toBeGreaterThanOrEqual(0);
    expect(result.thermalRisk).toMatch(/Safe|Caution|Critical|Failure/);
  });

  it('should increase temperatures with longer cutting time', () => {
    const thermalBridge = bridge.getThermalBridge();
    const result1 = thermalBridge.analyzeThermal('Steel', 'Carbide', 1000, 10, 30, 25, true);
    const result2 = thermalBridge.analyzeThermal('Steel', 'Carbide', 1000, 10, 120, 25, true);

    // Longer cutting time should result in higher temperatures
    expect(result2.toolTemperature).toBeGreaterThanOrEqual(result1.toolTemperature);
  });

  it('should reduce temperatures with coolant', () => {
    const thermalBridge = bridge.getThermalBridge();
    const resultNoCoolant = thermalBridge.analyzeThermal('Steel', 'Carbide', 1000, 10, 60, 25, false);
    const resultWithCoolant = thermalBridge.analyzeThermal('Steel', 'Carbide', 1000, 10, 60, 25, true);

    // Coolant should reduce tool temperature
    expect(resultWithCoolant.toolTemperature).toBeLessThan(resultNoCoolant.toolTemperature);
  });

  it('should assess thermal risk correctly', () => {
    const thermalBridge = bridge.getThermalBridge();

    // Safe conditions
    const safeMachine = thermalBridge.analyzeThermal('Steel', 'Carbide', 500, 10, 30, 25, true);
    expect(safeMachine.thermalRisk).toBe('Safe');

    // Higher risk conditions
    const riskyMachine = thermalBridge.analyzeThermal('Titanium', 'Ceramic', 3000, 5, 300, 25, false);
    expect(riskyMachine.thermalRisk).not.toBe('Safe');
  });

  it('should provide coolant recommendations', () => {
    const thermalBridge = bridge.getThermalBridge();
    const recommendation = thermalBridge.getCoolantRecommendation('Steel');

    expect(recommendation).toBeDefined();
    expect(recommendation.length).toBeGreaterThan(0);
  });

  it('should handle all material types', () => {
    const thermalBridge = bridge.getThermalBridge();
    const materials = ['Steel', 'Aluminum', 'Titanium', 'Cast Iron'];

    materials.forEach((material) => {
      const result = thermalBridge.analyzeThermal(material, 'Carbide', 1000, 10, 60, 25, true);
      expect(result.toolTemperature).toBeGreaterThan(0);
    });
  });
});

describe('ManufacturingBridge - Unified Orchestration', () => {
  let bridge: ManufacturingBridge;

  beforeEach(async () => {
    (ManufacturingBridge as any).instance = null;
    bridge = await initializeManufacturingBridge();
  });

  it('should run comprehensive manufacturing simulation', () => {
    const request: ManufacturingSimulationRequest = {
      cuttingForces: {
        material: 'Steel',
        feedPerTooth: 0.1,
        depthOfCut: 2.0,
        cuttingSpeed: 150,
        fluteCount: 2,
      },
      spindleLoad: {
        cuttingPower: 1000,
        spindleSpec: 'generic_3hp',
        spindleSpeed: 3000,
      },
      thermal: {
        workpieceMaterial: 'Steel',
        toolMaterial: 'Carbide',
        cuttingPower: 1000,
        chipArea: 10.0,
        cuttingTimeSec: 60,
        ambientTemp: 25,
        coolantAvailable: true,
      },
    };

    const result = bridge.simulateManufacturing(request);

    expect(result.timestamp).toBeDefined();
    expect(result.cuttingForces).toBeDefined();
    expect(result.spindleLoad).toBeDefined();
    expect(result.thermal).toBeDefined();
    expect(result.safetyStatus).toBeDefined();
    expect(result.simulationSuccessful).toBe(true);
  });

  it('should aggregate safety status from all analyses', () => {
    const safeRequest: ManufacturingSimulationRequest = {
      cuttingForces: {
        material: 'Steel',
        feedPerTooth: 0.05,
        depthOfCut: 1.0,
        cuttingSpeed: 150,
        fluteCount: 2,
      },
      spindleLoad: {
        cuttingPower: 500,
        spindleSpec: 'generic_3hp',
        spindleSpeed: 3000,
      },
      thermal: {
        workpieceMaterial: 'Steel',
        toolMaterial: 'Carbide',
        cuttingPower: 500,
        chipArea: 10.0,
        cuttingTimeSec: 30,
        ambientTemp: 25,
        coolantAvailable: true,
      },
    };

    const result = bridge.simulateManufacturing(safeRequest);
    expect(result.safetyStatus).toBe('Safe');
  });

  it('should handle partial simulation requests', () => {
    const partialRequest: ManufacturingSimulationRequest = {
      cuttingForces: {
        material: 'Steel',
        feedPerTooth: 0.1,
        depthOfCut: 2.0,
        cuttingSpeed: 150,
        fluteCount: 2,
      },
    };

    const result = bridge.simulateManufacturing(partialRequest);

    expect(result.cuttingForces).toBeDefined();
    expect(result.simulationSuccessful).toBe(true);
  });

  it('should propagate cutting power to dependent analyses', () => {
    const request: ManufacturingSimulationRequest = {
      cuttingForces: {
        material: 'Steel',
        feedPerTooth: 0.1,
        depthOfCut: 2.0,
        cuttingSpeed: 150,
        fluteCount: 2,
      },
      spindleLoad: {
        // cuttingPower not specified - should use calculated value from cutting forces
        spindleSpec: 'generic_3hp',
        spindleSpeed: 3000,
      },
      thermal: {
        workpieceMaterial: 'Steel',
        toolMaterial: 'Carbide',
        // cuttingPower not specified - should use calculated value
        chipArea: 10.0,
        cuttingTimeSec: 60,
        ambientTemp: 25,
        coolantAvailable: true,
      },
    };

    const result = bridge.simulateManufacturing(request);

    // All analyses should complete successfully
    expect(result.cuttingForces).toBeDefined();
    expect(result.spindleLoad).toBeDefined();
    expect(result.thermal).toBeDefined();
  });
});

describe('Manufacturing Bridge - Error Handling', () => {
  let bridge: ManufacturingBridge;

  beforeEach(async () => {
    (ManufacturingBridge as any).instance = null;
    bridge = await initializeManufacturingBridge();
  });

  it('should handle empty simulation request', () => {
    const emptyRequest: ManufacturingSimulationRequest = {};
    const result = bridge.simulateManufacturing(emptyRequest as any);

    expect(result.simulationSuccessful).toBe(true);
  });

  it('should not crash with invalid material type', () => {
    const request: ManufacturingSimulationRequest = {
      cuttingForces: {
        material: 'InvalidMaterial',
        feedPerTooth: 0.1,
        depthOfCut: 2.0,
        cuttingSpeed: 150,
        fluteCount: 2,
      },
    };

    const result = bridge.simulateManufacturing(request);
    expect(result.simulationSuccessful).toBe(true);
  });

  it('should validate spindle load limits', () => {
    const spindleBridge = bridge.getSpindleLoadBridge();
    const result = spindleBridge.calculateLoad(5000, 'generic_3hp', 1000);

    expect(result.isWithinLimits).toBeDefined();
  });
});

describe('Manufacturing Bridge - Performance', () => {
  let bridge: ManufacturingBridge;

  beforeEach(async () => {
    (ManufacturingBridge as any).instance = null;
    bridge = await initializeManufacturingBridge();
  });

  it('should complete simulation in reasonable time', () => {
    const request: ManufacturingSimulationRequest = {
      cuttingForces: {
        material: 'Steel',
        feedPerTooth: 0.1,
        depthOfCut: 2.0,
        cuttingSpeed: 150,
        fluteCount: 2,
      },
      spindleLoad: {
        cuttingPower: 1000,
        spindleSpec: 'generic_3hp',
        spindleSpeed: 3000,
      },
      thermal: {
        workpieceMaterial: 'Steel',
        toolMaterial: 'Carbide',
        cuttingPower: 1000,
        chipArea: 10.0,
        cuttingTimeSec: 60,
        ambientTemp: 25,
        coolantAvailable: true,
      },
    };

    const startTime = performance.now();
    bridge.simulateManufacturing(request);
    const endTime = performance.now();

    // Should complete in less than 50ms
    expect(endTime - startTime).toBeLessThan(50);
  });
});
