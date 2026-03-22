/**
 * Unit Tests: PCB Trace Geometry
 * Phase 15: 3D Visualization
 *
 * Tests for trace geometry generation and layer batching
 */

import { Trace, PCBLayer, PCBBoard } from '../../types';
import {
  buildTraceGeometry,
  batchTraceGeometry,
  buildAllTraceGeometry,
} from '../traceGeometry';

describe('traceGeometry', () => {
  const mockBoard: PCBBoard = {
    name: 'Test Board',
    width: 100,
    height: 80,
    thickness: 1.6,
    layers: [PCBLayer.SIGNAL_TOP, PCBLayer.SIGNAL_BOTTOM],
    components: [],
    traces: [],
    vias: [],
    zones: [],
  };

  const mockTrace: Trace = {
    id: 'trace-1',
    netName: 'GND',
    layer: PCBLayer.SIGNAL_TOP,
    width: 0.254, // 10mil
    segments: [
      { start: { x: 10, y: 10 }, end: { x: 50, y: 10 } },
      { start: { x: 50, y: 10 }, end: { x: 50, y: 50 } },
    ],
  };

  describe('buildTraceGeometry', () => {
    it('should return mesh3d object', () => {
      const mesh = buildTraceGeometry(mockTrace, mockBoard);
      expect(mesh.type).toBe('mesh3d');
      expect(mesh.x).toBeDefined();
      expect(mesh.y).toBeDefined();
      expect(mesh.z).toBeDefined();
    });

    it('should have vertices and indices', () => {
      const mesh = buildTraceGeometry(mockTrace, mockBoard);
      const xs = mesh.x as number[];
      const is = mesh.i as number[];

      expect(xs.length).toBeGreaterThan(0);
      expect(is.length).toBeGreaterThan(0);
    });

    it('should position trace at correct layer', () => {
      const mesh = buildTraceGeometry(mockTrace, mockBoard);
      const zs = mesh.z as number[];

      // Should all be at signal top layer (positive Z)
      zs.forEach(z => {
        expect(z).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include trace net name', () => {
      const mesh = buildTraceGeometry(mockTrace, mockBoard);
      expect(mesh.name).toContain('GND');
    });

    it('should have width matching trace width', () => {
      const mesh = buildTraceGeometry(mockTrace, mockBoard);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];

      // Get bounding box perpendicular to trace direction
      const xRange = Math.max(...xs) - Math.min(...xs);
      const yRange = Math.max(...ys) - Math.min(...ys);

      // One direction should be dominated by trace length, other by width
      const length = Math.max(xRange, yRange);
      const width = Math.min(xRange, yRange);

      // Width should be approximately trace width (allowing for geometry approximation)
      expect(width).toBeGreaterThan(mockTrace.width * 0.5);
      expect(width).toBeLessThan(mockTrace.width * 2);
    });

    it('should handle single segment trace', () => {
      const singleSegment: Trace = {
        ...mockTrace,
        segments: [{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }],
      };

      const mesh = buildTraceGeometry(singleSegment, mockBoard);
      expect(mesh.x).toBeDefined();
      expect((mesh.x as number[]).length).toBeGreaterThan(0);
    });

    it('should handle multi-segment trace', () => {
      const multiSegment: Trace = {
        ...mockTrace,
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
          { start: { x: 20, y: 0 }, end: { x: 20, y: 20 } },
          { start: { x: 20, y: 20 }, end: { x: 40, y: 20 } },
        ],
      };

      const mesh = buildTraceGeometry(multiSegment, mockBoard);
      const xs = mesh.x as number[];
      const is = mesh.i as number[];

      // More segments = more vertices
      expect(xs.length).toBeGreaterThan(20);
      expect(is.length).toBeGreaterThan(30);
    });

    it('should have valid triangle indices', () => {
      const mesh = buildTraceGeometry(mockTrace, mockBoard);
      const xs = mesh.x as number[];
      const is = mesh.i as number[];
      const js = mesh.j as number[];
      const ks = mesh.k as number[];

      const maxIndex = xs.length - 1;

      for (let idx = 0; idx < is.length; idx++) {
        expect(is[idx]).toBeGreaterThanOrEqual(0);
        expect(is[idx]).toBeLessThanOrEqual(maxIndex);
        expect(js[idx]).toBeGreaterThanOrEqual(0);
        expect(js[idx]).toBeLessThanOrEqual(maxIndex);
        expect(ks[idx]).toBeGreaterThanOrEqual(0);
        expect(ks[idx]).toBeLessThanOrEqual(maxIndex);
      }
    });

    it('should not create NaN or Infinity values', () => {
      const mesh = buildTraceGeometry(mockTrace, mockBoard);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];
      const zs = mesh.z as number[];

      [...xs, ...ys, ...zs].forEach(val => {
        expect(isFinite(val)).toBe(true);
      });
    });
  });

  describe('batchTraceGeometry', () => {
    it('should return single mesh for layer batch', () => {
      const traces = [
        mockTrace,
        { ...mockTrace, id: 'trace-2', netName: 'VCC', width: 0.3 },
      ];

      const mesh = batchTraceGeometry(traces, mockBoard, PCBLayer.SIGNAL_TOP);
      expect(mesh).toBeDefined();
      expect(mesh?.type).toBe('mesh3d');
    });

    it('should return null for empty layer', () => {
      const traces = [{ ...mockTrace, layer: PCBLayer.SIGNAL_BOTTOM }];
      const mesh = batchTraceGeometry(traces, mockBoard, PCBLayer.SIGNAL_TOP);
      expect(mesh).toBeNull();
    });

    it('should combine multiple traces into one mesh', () => {
      const traces = [
        mockTrace,
        {
          ...mockTrace,
          id: 'trace-2',
          netName: 'VCC',
          width: 0.5,
          segments: [{ start: { x: 60, y: 10 }, end: { x: 90, y: 40 } }],
        },
        {
          ...mockTrace,
          id: 'trace-3',
          netName: 'GND2',
          width: 0.254,
          segments: [{ start: { x: 70, y: 50 }, end: { x: 70, y: 80 } }],
        },
      ];

      const mesh = batchTraceGeometry(traces, mockBoard, PCBLayer.SIGNAL_TOP);
      expect(mesh).toBeDefined();
      expect(mesh?.name).toContain('Traces (SIGNAL_TOP)');
    });

    it('should not combine traces from different layers', () => {
      const traces = [
        mockTrace,
        { ...mockTrace, id: 'trace-2', layer: PCBLayer.SIGNAL_BOTTOM },
      ];

      const topMesh = batchTraceGeometry(traces, mockBoard, PCBLayer.SIGNAL_TOP);
      const bottomMesh = batchTraceGeometry(traces, mockBoard, PCBLayer.SIGNAL_BOTTOM);

      expect(topMesh).toBeDefined();
      expect(bottomMesh).toBeDefined();

      // Should be different meshes (different vertex counts)
      const topXs = (topMesh?.x as number[]).length;
      const bottomXs = (bottomMesh?.x as number[]).length;

      // Different traces → different vertex counts
      expect(topXs).not.toBe(bottomXs);
    });

    it('should preserve net information in hover text', () => {
      const traces = [mockTrace];
      const mesh = batchTraceGeometry(traces, mockBoard, PCBLayer.SIGNAL_TOP);
      expect(mesh?.hovertemplate).toBeDefined();
    });
  });

  describe('buildAllTraceGeometry', () => {
    it('should return array of meshes', () => {
      const traces = [mockTrace];
      const meshes = buildAllTraceGeometry(traces, mockBoard);
      expect(Array.isArray(meshes)).toBe(true);
    });

    it('should handle empty trace list', () => {
      const meshes = buildAllTraceGeometry([], mockBoard);
      expect(meshes.length).toBe(0);
    });

    it('should batch by layer', () => {
      const traces = [
        mockTrace,
        { ...mockTrace, id: 'trace-2', netName: 'VCC', width: 0.3 },
        { ...mockTrace, id: 'trace-3', layer: PCBLayer.SIGNAL_BOTTOM, netName: 'GND2' },
      ];

      const meshes = buildAllTraceGeometry(traces, mockBoard);

      // Should have at least 2 meshes (one for each layer)
      expect(meshes.length).toBeGreaterThanOrEqual(2);

      // Verify layer separation
      const layerNames = meshes.map(m => m.name);
      expect(layerNames.some(n => n?.includes('SIGNAL_TOP'))).toBe(true);
      expect(layerNames.some(n => n?.includes('SIGNAL_BOTTOM'))).toBe(true);
    });

    it('should not create NaN or Infinity values', () => {
      const traces = [mockTrace];
      const meshes = buildAllTraceGeometry(traces, mockBoard);

      meshes.forEach(mesh => {
        const xs = mesh.x as number[];
        const ys = mesh.y as number[];
        const zs = mesh.z as number[];

        [...xs, ...ys, ...zs].forEach(val => {
          expect(isFinite(val)).toBe(true);
        });
      });
    });

    it('should reduce mesh count through batching', () => {
      const traces = Array.from({ length: 50 }, (_, i) => ({
        ...mockTrace,
        id: `trace-${i}`,
        netName: `NET${i}`,
        segments: [{ start: { x: i * 2, y: 10 }, end: { x: i * 2 + 10, y: 10 } }],
      }));

      const meshes = buildAllTraceGeometry(traces, mockBoard);

      // With batching, should have much fewer meshes than traces
      expect(meshes.length).toBeLessThan(traces.length / 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very thin traces (0.1mm)', () => {
      const thin: Trace = {
        ...mockTrace,
        width: 0.1,
      };

      const mesh = buildTraceGeometry(thin, mockBoard);
      expect(mesh.x).toBeDefined();
      expect((mesh.x as number[]).length).toBeGreaterThan(0);
    });

    it('should handle very wide traces (5mm)', () => {
      const wide: Trace = {
        ...mockTrace,
        width: 5.0,
      };

      const mesh = buildTraceGeometry(wide, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle very long traces', () => {
      const long: Trace = {
        ...mockTrace,
        segments: [{ start: { x: 0, y: 0 }, end: { x: 500, y: 500 } }],
      };

      const mesh = buildTraceGeometry(long, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle degenerate segment (zero length)', () => {
      const degenerate: Trace = {
        ...mockTrace,
        segments: [{ start: { x: 10, y: 10 }, end: { x: 10, y: 10 } }],
      };

      const mesh = buildTraceGeometry(degenerate, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle diagonal traces', () => {
      const diagonal: Trace = {
        ...mockTrace,
        segments: [{ start: { x: 0, y: 0 }, end: { x: 100, y: 100 } }],
      };

      const mesh = buildTraceGeometry(diagonal, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle complex serpentine traces', () => {
      const serpentine: Trace = {
        ...mockTrace,
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
          { start: { x: 20, y: 0 }, end: { x: 20, y: 5 } },
          { start: { x: 20, y: 5 }, end: { x: 0, y: 5 } },
          { start: { x: 0, y: 5 }, end: { x: 0, y: 10 } },
          { start: { x: 0, y: 10 }, end: { x: 20, y: 10 } },
          { start: { x: 20, y: 10 }, end: { x: 20, y: 15 } },
        ],
      };

      const mesh = buildTraceGeometry(serpentine, mockBoard);
      expect(mesh.x).toBeDefined();
      expect((mesh.x as number[]).length).toBeGreaterThan(50);
    });
  });
});
