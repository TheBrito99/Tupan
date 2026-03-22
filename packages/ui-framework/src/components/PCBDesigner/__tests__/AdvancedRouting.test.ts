/**
 * Advanced Routing Tests - Phase 13
 *
 * Tests for:
 * - Impedance calculation (microstrip, stripline, differential)
 * - Differential pair routing (spacing, length matching, coupling)
 * - Length matching algorithms
 * - Escape routing for BGAs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImpedanceCalculator, TraceGeometry, PCBStackup } from '../ImpedanceCalculator';
import { LengthMatcher } from '../LengthMatcher';
import { EscapeRouter } from '../EscapeRouter';
import { DifferentialPairRouter } from '../DifferentialPairRouter';
import { TraceRouter } from '../TraceRouter';
import { PCBLayer, Trace } from '../types';

// Test fixtures
const FR4_STACKUP: PCBStackup = {
  thickness: 1.6,
  copperWeight: 1,
  dielectricConstant: 4.4,
  dielectricLossAngle: 0.02,
  layers: [
    { name: 'Top Silk', thickness: 0.02, type: 'copper', isSignalLayer: true },
    { name: 'Signal Top', thickness: 0.035, type: 'copper', isSignalLayer: true },
    { name: 'Dielectric', thickness: 0.5, type: 'dielectric' },
    { name: 'Ground', thickness: 0.035, type: 'copper', isGroundPlane: true },
    { name: 'Dielectric', thickness: 0.5, type: 'dielectric' },
    { name: 'Signal Bottom', thickness: 0.035, type: 'copper', isSignalLayer: true },
    { name: 'Soldermask', thickness: 0.02, type: 'copper' },
  ],
};

describe('ImpedanceCalculator', () => {
  let calc: ImpedanceCalculator;

  beforeEach(() => {
    calc = new ImpedanceCalculator(FR4_STACKUP);
  });

  describe('Microstrip Impedance', () => {
    it('should calculate microstrip impedance (~50Ω)', () => {
      const result = calc.calculateImpedance({
        width: 0.254,      // 10mil
        thickness: 0.035,  // 1oz copper
        height: 0.2,       // to ground plane
        geometry: TraceGeometry.MICROSTRIP,
        length: 100,
        frequency: 100,
        temperature: 25,
      });

      expect(result.singleEndedZ0).toBeGreaterThan(40);
      expect(result.singleEndedZ0).toBeLessThan(60);
    });

    it('should calculate propagation delay', () => {
      const result = calc.calculateImpedance({
        width: 0.254,
        thickness: 0.035,
        height: 0.2,
        geometry: TraceGeometry.MICROSTRIP,
        length: 100,
        frequency: 100,
        temperature: 25,
      });

      // FR-4 delay ≈ 3.43 ps/mm
      expect(result.delayPerUnit).toBeGreaterThan(3.0);
      expect(result.delayPerUnit).toBeLessThan(4.0);
    });

    it('should calculate attenuation at frequency', () => {
      const result = calc.calculateImpedance({
        width: 0.254,
        thickness: 0.035,
        height: 0.2,
        geometry: TraceGeometry.MICROSTRIP,
        length: 100,
        frequency: 1000, // 1 GHz
        temperature: 25,
      });

      expect(result.attenuation).toBeGreaterThan(0);
    });
  });

  describe('Stripline Impedance', () => {
    it('should calculate stripline impedance', () => {
      const result = calc.calculateImpedance({
        width: 0.254,
        thickness: 0.035,
        height: 0.5, // Between ground planes
        geometry: TraceGeometry.STRIPLINE,
        length: 100,
        frequency: 100,
        temperature: 25,
      });

      expect(result.singleEndedZ0).toBeGreaterThan(40);
      expect(result.singleEndedZ0).toBeLessThan(60);
    });
  });

  describe('Differential Impedance', () => {
    it('should calculate differential microstrip impedance (~100Ω)', () => {
      const result = calc.calculateImpedance({
        width: 0.254,
        thickness: 0.035,
        height: 0.2,
        spacing: 0.3,      // 12mil spacing
        geometry: TraceGeometry.DIFFERENTIAL_MICROSTRIP,
        length: 100,
        frequency: 100,
        temperature: 25,
      });

      expect(result.differentialZ0).toBeGreaterThan(90);
      expect(result.differentialZ0).toBeLessThan(110);
    });

    it('should have common-mode impedance ~2x single-ended', () => {
      const result = calc.calculateImpedance({
        width: 0.254,
        thickness: 0.035,
        height: 0.2,
        spacing: 0.3,
        geometry: TraceGeometry.DIFFERENTIAL_MICROSTRIP,
        length: 100,
        frequency: 100,
        temperature: 25,
      });

      const singleEnded = result.singleEndedZ0;
      expect(result.commonModeZ0).toBeCloseTo(singleEnded * 2, 0);
    });
  });

  describe('Compliance Checking', () => {
    it('should pass compliance for target impedance', () => {
      const result = calc.calculateImpedance({
        width: 0.254,
        thickness: 0.035,
        height: 0.2,
        geometry: TraceGeometry.MICROSTRIP,
        length: 100,
        frequency: 100,
        temperature: 25,
      });

      const compliance = calc.checkCompliance(result, 50, 10);
      expect(compliance.compliant).toBe(true);
      expect(compliance.margin).toBeGreaterThan(0);
    });

    it('should flag non-compliant impedance', () => {
      const result = calc.calculateImpedance({
        width: 0.1,        // Very thin = very high Z0
        thickness: 0.035,
        height: 0.2,
        geometry: TraceGeometry.MICROSTRIP,
        length: 100,
        frequency: 100,
        temperature: 25,
      });

      const compliance = calc.checkCompliance(result, 50, 10);
      expect(compliance.compliant).toBe(false);
    });
  });

  describe('Trace Width Calculation', () => {
    it('should find trace width for target impedance', () => {
      const width = calc.getTraceWidthForImpedance(50, TraceGeometry.MICROSTRIP, 0.2);

      expect(width).toBeGreaterThan(0.1);
      expect(width).toBeLessThan(2.0);
    });

    it('should find different width for stripline vs microstrip', () => {
      const widthMicro = calc.getTraceWidthForImpedance(50, TraceGeometry.MICROSTRIP, 0.2);
      const widthStrip = calc.getTraceWidthForImpedance(50, TraceGeometry.STRIPLINE, 0.5);

      // Stripline requires wider trace for same impedance
      expect(widthStrip).toBeGreaterThan(widthMicro * 0.8);
    });
  });
});

describe('LengthMatcher', () => {
  let matcher: LengthMatcher;

  beforeEach(() => {
    matcher = new LengthMatcher(0.5); // 0.5mm tolerance
  });

  describe('Length Calculation', () => {
    it('should calculate trace lengths correctly', () => {
      const traces: Trace[] = [
        {
          id: 'trace1',
          netName: 'net1',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan',
          segments: [
            { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
          ],
        },
      ];

      const lengths = matcher.calculateLengths(traces);
      expect(lengths[0].length).toBeCloseTo(20, 0);
    });
  });

  describe('Length Matching', () => {
    it('should match group of traces', () => {
      const traces: Trace[] = [
        {
          id: 'trace1',
          netName: 'D0',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan',
          segments: [
            { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            { start: { x: 10, y: 0 }, end: { x: 10, y: 5 } },
          ],
        },
        {
          id: 'trace2',
          netName: 'D1',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan',
          segments: [
            { start: { x: 0, y: 0 }, end: { x: 15, y: 0 } },
          ],
        },
      ];

      const result = matcher.matchGroup(traces);

      expect(result.matchedSuccessfully).toBe(false); // Different lengths
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should identify already-matched traces', () => {
      const traces: Trace[] = [
        {
          id: 'trace1',
          netName: 'net1',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan',
          segments: [{ start: { x: 0, y: 0 }, end: { x: 20, y: 0 } }],
        },
        {
          id: 'trace2',
          netName: 'net2',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan',
          segments: [{ start: { x: 0, y: 0 }, end: { x: 20, y: 0 } }],
        },
      ];

      const check = matcher.checkMatch(traces);
      expect(check.matched).toBe(true);
      expect(check.deviation).toBeCloseTo(0, 1);
    });
  });

  describe('Meander Generation', () => {
    it('should estimate meander length correctly', () => {
      const meander = {
        width: 2.0,
        depth: 2.0,
        startSegmentIndex: 0,
        cycles: 5,
      };

      const length = matcher.estimateMeanderLength(meander);

      // Each cycle: 2×width + depth = 2×2 + 2 = 6mm
      expect(length).toBeCloseTo(30, 0); // 5 cycles × 6mm
    });

    it('should check meander spacing for DRC', () => {
      const meander = {
        width: 2.0,
        depth: 2.0,
        startSegmentIndex: 0,
        cycles: 3,
      };

      const check = matcher.checkMeanderSpacing(meander, 0.254);
      expect(check.valid).toBe(true);
    });
  });

  describe('Bus Matching', () => {
    it('should match entire bus', () => {
      const traces: Trace[] = Array.from({ length: 8 }, (_, i) => ({
        id: `trace${i}`,
        netName: `D[${i}]`,
        layer: PCBLayer.SIGNAL_TOP,
        width: 0.254,
        style: 'manhattan' as const,
        segments: [
          {
            start: { x: 0, y: i * 0.5 },
            end: { x: 20 + i * 0.2, y: i * 0.5 }, // Slightly different lengths
          },
        ],
      }));

      const result = matcher.matchBus(traces, 'DDR_DATA');
      expect(result.groups).toHaveLength(8);
    });
  });
});

describe('EscapeRouter', () => {
  let router: EscapeRouter;

  beforeEach(() => {
    router = new EscapeRouter();
  });

  describe('Escape Route Calculation', () => {
    it('should calculate escape route for BGA', () => {
      const footprint = {
        id: 'fp1',
        name: 'BGA121',
        description: 'BGA 121 balls',
        package: 'BGA121',
        pads: Array.from({ length: 121 }, (_, i) => ({
          id: `pad${i}`,
          number: `${i + 1}`,
          name: `Pin${i + 1}`,
          shape: 'CIRCLE' as const,
          position: { x: 0, y: 0 },
          width: 0.3,
          height: 0.3,
          rotation: 0,
          layers: [PCBLayer.SIGNAL_TOP],
          connectionType: 'SMD' as const,
        })),
        bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5, width: 10, height: 10 },
      };

      const component = {
        id: 'comp1',
        refdes: 'U1',
        footprint,
        position: { x: 50, y: 50 },
        rotation: 0,
        side: 'top' as const,
        placed: true,
      };

      const route = router.calculateEscapeRoute(component);

      expect(route.componentId).toBe('comp1');
      expect(route.paths).toHaveLength(121);
      expect(route.layerStrategy).toBe('via_stitch'); // High density
    });

    it('should assign pin priorities', () => {
      const footprint = {
        id: 'fp1',
        name: 'LQFP100',
        description: 'LQFP 100-pin',
        package: 'LQFP100',
        pads: [
          {
            id: 'p1',
            number: '1',
            name: 'VCC',
            shape: 'RECTANGLE' as const,
            position: { x: 0, y: 0 },
            width: 0.2,
            height: 0.4,
            rotation: 0,
            layers: [PCBLayer.SIGNAL_TOP],
            connectionType: 'SMD' as const,
          },
          {
            id: 'p2',
            number: '2',
            name: 'GND',
            shape: 'RECTANGLE' as const,
            position: { x: 0.5, y: 0 },
            width: 0.2,
            height: 0.4,
            rotation: 0,
            layers: [PCBLayer.SIGNAL_TOP],
            connectionType: 'SMD' as const,
          },
          {
            id: 'p3',
            number: '3',
            name: 'PA0',
            shape: 'RECTANGLE' as const,
            position: { x: 1.0, y: 0 },
            width: 0.2,
            height: 0.4,
            rotation: 0,
            layers: [PCBLayer.SIGNAL_TOP],
            connectionType: 'SMD' as const,
          },
        ],
        bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2, width: 4, height: 4 },
      };

      const component = {
        id: 'comp1',
        refdes: 'U1',
        footprint,
        position: { x: 50, y: 50 },
        rotation: 0,
        side: 'top' as const,
        placed: true,
      };

      const route = router.calculateEscapeRoute(component);

      // VCC should come first (priority 0)
      expect(route.paths[0].priority).toBe(0);
      // GND should come second (priority 1)
      expect(route.paths[1].priority).toBe(1);
      // Signal last (priority 2)
      expect(route.paths[2].priority).toBe(2);
    });
  });

  describe('Via Placement', () => {
    it('should plan via placement for dogbone style', () => {
      const footprint = {
        id: 'fp1',
        name: 'BGA25',
        description: 'Small BGA',
        package: 'BGA25',
        pads: Array.from({ length: 25 }, (_, i) => ({
          id: `pad${i}`,
          number: `${i + 1}`,
          name: `Pin${i + 1}`,
          shape: 'CIRCLE' as const,
          position: { x: 0, y: 0 },
          width: 0.3,
          height: 0.3,
          rotation: 0,
          layers: [PCBLayer.SIGNAL_TOP],
          connectionType: 'SMD' as const,
        })),
        bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2, width: 4, height: 4 },
      };

      const component = {
        id: 'comp1',
        refdes: 'U1',
        footprint,
        position: { x: 50, y: 50 },
        rotation: 0,
        side: 'top' as const,
        placed: true,
      };

      const route = router.calculateEscapeRoute(component);
      const vias = router.planViaPlacement(route);

      expect(vias.length).toBeGreaterThan(0);
      expect(vias[0].diameter).toBe(0.6);
    });
  });

  describe('Feasibility Checking', () => {
    it('should validate routing feasibility', () => {
      const footprint = {
        id: 'fp1',
        name: 'BGA100',
        description: 'BGA 100-ball',
        package: 'BGA100',
        pads: Array.from({ length: 100 }, (_, i) => ({
          id: `pad${i}`,
          number: `${i + 1}`,
          name: `Pin${i + 1}`,
          shape: 'CIRCLE' as const,
          position: { x: 0, y: 0 },
          width: 0.3,
          height: 0.3,
          rotation: 0,
          layers: [PCBLayer.SIGNAL_TOP],
          connectionType: 'SMD' as const,
        })),
        bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5, width: 10, height: 10 },
      };

      const component = {
        id: 'comp1',
        refdes: 'U1',
        footprint,
        position: { x: 50, y: 50 },
        rotation: 0,
        side: 'top' as const,
        placed: true,
      };

      const route = router.calculateEscapeRoute(component);
      const { feasible, warnings } = router.checkFeasibility(route);

      expect(typeof feasible).toBe('boolean');
      expect(Array.isArray(warnings)).toBe(true);
    });
  });
});

describe('DifferentialPairRouter', () => {
  let baseRouter: TraceRouter;
  let pairRouter: DifferentialPairRouter;

  beforeEach(() => {
    baseRouter = new TraceRouter(100, 100);
    pairRouter = new DifferentialPairRouter(baseRouter, 0.3);
  });

  describe('Via Pairing', () => {
    it('should create paired vias', () => {
      const { viaPos, viaNeg } = pairRouter.createViaPair(
        50,
        50,
        PCBLayer.SIGNAL_TOP,
        PCBLayer.SIGNAL_BOTTOM,
        0.6
      );

      expect(viaPos.position.x).toBeLessThan(viaNeg.position.x);
      expect(Math.abs(viaNeg.position.x - viaPos.position.x)).toBeCloseTo(0.6, 1);
    });
  });

  describe('Pair Statistics', () => {
    it('should calculate routing statistics', () => {
      const result = {
        positiveTrace: {
          id: 'trace1',
          netName: 'USB_D+',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan' as const,
          segments: [
            { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
          ],
        },
        negativeTrace: {
          id: 'trace2',
          netName: 'USB_D-',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan' as const,
          segments: [
            { start: { x: 0.3, y: 0 }, end: { x: 10.3, y: 0 } },
            { start: { x: 10.3, y: 0 }, end: { x: 10.3, y: 10 } },
          ],
        },
        positiveVias: [],
        negativeVias: [],
        length: 20,
        skew: 0.5,
        coupling: 85,
        success: true,
      };

      const stats = pairRouter.getStatistics(result);

      expect(stats.lengthPos).toBeGreaterThan(19);
      expect(stats.lengthPos).toBeLessThan(21);
      expect(stats.coupling).toBeCloseTo(85, 0);
    });
  });

  describe('Pair Validation', () => {
    it('should validate pair routing constraints', () => {
      const result = {
        positiveTrace: {
          id: 't1',
          netName: 'n+',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan' as const,
          segments: [{ start: { x: 0, y: 0 }, end: { x: 20, y: 0 } }],
        },
        negativeTrace: {
          id: 't2',
          netName: 'n-',
          layer: PCBLayer.SIGNAL_TOP,
          width: 0.254,
          style: 'manhattan' as const,
          segments: [{ start: { x: 0.3, y: 0 }, end: { x: 20.3, y: 0 } }],
        },
        positiveVias: [],
        negativeVias: [],
        length: 20,
        skew: 30,
        coupling: 85,
        success: true,
      };

      const pair = {
        netPositive: 'n+',
        netNegative: 'n-',
        spacing: 0.3,
        impedance: 100,
        maxSkew: 50,
      };

      const { valid, issues } = pairRouter.validatePair(result, pair);

      expect(valid).toBe(true);
      expect(issues.length).toBe(0);
    });
  });
});
