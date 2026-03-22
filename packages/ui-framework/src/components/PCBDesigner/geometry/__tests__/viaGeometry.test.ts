/**
 * Unit Tests: PCB Via Geometry
 * Phase 15: 3D Visualization
 *
 * Tests for via geometry generation and layer batching
 */

import { Via, PCBLayer, PCBBoard } from '../../types';
import {
  buildViaGeometry,
  buildViaDrillGeometry,
  buildAllViaGeometry,
} from '../viaGeometry';

describe('viaGeometry', () => {
  const mockBoard: PCBBoard = {
    name: 'Test Board',
    width: 100,
    height: 80,
    thickness: 1.6,
    layers: [
      PCBLayer.SIGNAL_TOP,
      PCBLayer.GROUND,
      PCBLayer.POWER,
      PCBLayer.SIGNAL_BOTTOM,
    ],
    components: [],
    traces: [],
    vias: [],
    zones: [],
  };

  const mockVia: Via = {
    id: 'via-1',
    position: { x: 50, y: 50 },
    diameterOuter: 0.8, // 31mil
    diameterInner: 0.3, // 12mil drill
    fromLayer: PCBLayer.SIGNAL_TOP,
    toLayer: PCBLayer.SIGNAL_BOTTOM,
  };

  describe('buildViaGeometry', () => {
    it('should return mesh3d object', () => {
      const mesh = buildViaGeometry(mockVia, mockBoard);
      expect(mesh.type).toBe('mesh3d');
      expect(mesh.x).toBeDefined();
      expect(mesh.y).toBeDefined();
      expect(mesh.z).toBeDefined();
    });

    it('should position via at correct location', () => {
      const mesh = buildViaGeometry(mockVia, mockBoard);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];

      const xCenter = (Math.max(...xs) + Math.min(...xs)) / 2;
      const yCenter = (Math.max(...ys) + Math.min(...ys)) / 2;

      expect(xCenter).toBeCloseTo(mockVia.position.x, 0);
      expect(yCenter).toBeCloseTo(mockVia.position.y, 0);
    });

    it('should create cylindrical shape (8-sided)', () => {
      const mesh = buildViaGeometry(mockVia, mockBoard);
      const xs = mesh.x as number[];

      // 8-sided cylinder: 8 vertices per end × 2 ends + 2 center vertices = 18 vertices
      expect(xs.length).toBe(18);
    });

    it('should span from top to bottom layer', () => {
      const mesh = buildViaGeometry(mockVia, mockBoard);
      const zs = mesh.z as number[];

      // Via should span from one layer to another
      const zMin = Math.min(...zs);
      const zMax = Math.max(...zs);

      expect(zMax - zMin).toBeGreaterThan(mockBoard.thickness * 0.5);
    });

    it('should have outer diameter matching via', () => {
      const mesh = buildViaGeometry(mockVia, mockBoard);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];

      // Get radius from position
      const viaX = mockVia.position.x;
      const viaY = mockVia.position.y;
      const radius = mockVia.diameterOuter / 2;

      xs.forEach((x, i) => {
        const y = (mesh.y as number[])[i];
        const dx = x - viaX;
        const dy = y - viaY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Should be approximately at via radius
        expect(Math.abs(dist - radius)).toBeLessThan(0.1);
      });
    });

    it('should include via ID in name', () => {
      const mesh = buildViaGeometry(mockVia, mockBoard);
      expect(mesh.name).toContain('via-1');
    });

    it('should have valid triangle indices', () => {
      const mesh = buildViaGeometry(mockVia, mockBoard);
      const is = mesh.i as number[];
      const js = mesh.j as number[];
      const ks = mesh.k as number[];
      const maxIndex = 17; // 18 vertices = indices 0-17

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
      const mesh = buildViaGeometry(mockVia, mockBoard);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];
      const zs = mesh.z as number[];

      [...xs, ...ys, ...zs].forEach(val => {
        expect(isFinite(val)).toBe(true);
      });
    });
  });

  describe('buildViaDrillGeometry', () => {
    it('should return mesh3d for drill hole', () => {
      const mesh = buildViaDrillGeometry(mockVia, mockBoard);
      expect(mesh.type).toBe('mesh3d');
      expect(mesh.color).toBe('#1a1a1a'); // Black
    });

    it('should be positioned at same location as via', () => {
      const viaMesh = buildViaGeometry(mockVia, mockBoard);
      const drillMesh = buildViaDrillGeometry(mockVia, mockBoard);

      const viaXs = viaMesh.x as number[];
      const drillXs = drillMesh.x as number[];

      const viaXCenter = (Math.max(...viaXs) + Math.min(...viaXs)) / 2;
      const drillXCenter = (Math.max(...drillXs) + Math.min(...drillXs)) / 2;

      expect(drillXCenter).toBeCloseTo(viaXCenter, 0);
    });

    it('should have inner diameter matching via drill', () => {
      const mesh = buildViaDrillGeometry(mockVia, mockBoard);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];

      const viaX = mockVia.position.x;
      const viaY = mockVia.position.y;
      const radius = mockVia.diameterInner / 2;

      xs.forEach((x, i) => {
        const y = (mesh.y as number[])[i];
        const dx = x - viaX;
        const dy = y - viaY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Should be approximately at drill radius
        expect(Math.abs(dist - radius)).toBeLessThan(0.05);
      });
    });

    it('should have semi-transparent opacity', () => {
      const mesh = buildViaDrillGeometry(mockVia, mockBoard);
      expect(mesh.opacity).toBeLessThan(0.5);
      expect(mesh.opacity).toBeGreaterThan(0);
    });

    it('should span same Z range as via', () => {
      const viaMesh = buildViaGeometry(mockVia, mockBoard);
      const drillMesh = buildViaDrillGeometry(mockVia, mockBoard);

      const viaZs = viaMesh.z as number[];
      const drillZs = drillMesh.z as number[];

      const viaZMin = Math.min(...viaZs);
      const viaZMax = Math.max(...viaZs);
      const drillZMin = Math.min(...drillZs);
      const drillZMax = Math.max(...drillZs);

      expect(drillZMin).toBeCloseTo(viaZMin, -1);
      expect(drillZMax).toBeCloseTo(viaZMax, -1);
    });
  });

  describe('buildAllViaGeometry', () => {
    it('should return array of meshes', () => {
      const vias = [mockVia];
      const meshes = buildAllViaGeometry(vias, mockBoard);
      expect(Array.isArray(meshes)).toBe(true);
    });

    it('should handle empty via list', () => {
      const meshes = buildAllViaGeometry([], mockBoard);
      expect(meshes.length).toBe(0);
    });

    it('should create batched meshes for multiple vias', () => {
      const vias = [
        mockVia,
        {
          ...mockVia,
          id: 'via-2',
          position: { x: 60, y: 60 },
        },
        {
          ...mockVia,
          id: 'via-3',
          position: { x: 40, y: 40 },
        },
      ];

      const meshes = buildAllViaGeometry(vias, mockBoard);

      // With batching: 2 meshes per layer-span (outer + drill)
      // All vias are same layer-span, so should have 2 meshes
      expect(meshes.length).toBe(2);
    });

    it('should batch vias on same layer-span together', () => {
      const vias = Array.from({ length: 10 }, (_, i) => ({
        ...mockVia,
        id: `via-${i}`,
        position: { x: 20 + i * 5, y: 50 },
      }));

      const meshes = buildAllViaGeometry(vias, mockBoard);

      // All same layer-span: 2 meshes (outer + drill)
      expect(meshes.length).toBe(2);

      // Meshes should have many vertices (10 vias combined)
      const outerMesh = meshes.find(m => m.name?.includes('Vias'));
      expect((outerMesh?.x as number[]).length).toBeGreaterThan(80); // 8+ vertices per via
    });

    it('should create separate meshes for different layer-spans', () => {
      const vias = [
        mockVia,
        {
          ...mockVia,
          id: 'via-2',
          position: { x: 60, y: 60 },
          fromLayer: PCBLayer.SIGNAL_TOP,
          toLayer: PCBLayer.GROUND,
        },
      ];

      const meshes = buildAllViaGeometry(vias, mockBoard);

      // Different layer-spans: 4 meshes (2 per span)
      expect(meshes.length).toBe(4);
    });

    it('should reduce mesh count through batching', () => {
      const vias = Array.from({ length: 50 }, (_, i) => ({
        ...mockVia,
        id: `via-${i}`,
        position: { x: 10 + (i % 10) * 10, y: 10 + Math.floor(i / 10) * 10 },
      }));

      const meshes = buildAllViaGeometry(vias, mockBoard);

      // Without batching: 100 meshes (2 per via)
      // With batching on same layer: 2 meshes
      expect(meshes.length).toBeLessThan(10);
    });

    it('should not create NaN or Infinity values', () => {
      const vias = [mockVia];
      const meshes = buildAllViaGeometry(vias, mockBoard);

      meshes.forEach(mesh => {
        const xs = mesh.x as number[];
        const ys = mesh.y as number[];
        const zs = mesh.z as number[];

        [...xs, ...ys, ...zs].forEach(val => {
          expect(isFinite(val)).toBe(true);
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small vias (0.3mm outer)', () => {
      const small: Via = {
        ...mockVia,
        diameterOuter: 0.3,
        diameterInner: 0.1,
      };

      const mesh = buildViaGeometry(small, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle very large vias (5mm outer)', () => {
      const large: Via = {
        ...mockVia,
        diameterOuter: 5.0,
        diameterInner: 2.0,
      };

      const mesh = buildViaGeometry(large, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle via at board corner', () => {
      const corner: Via = {
        ...mockVia,
        position: { x: 0, y: 0 },
      };

      const mesh = buildViaGeometry(corner, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle via at board edge', () => {
      const edge: Via = {
        ...mockVia,
        position: { x: 100, y: 40 },
      };

      const mesh = buildViaGeometry(edge, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle via spanning all layers', () => {
      const through: Via = {
        ...mockVia,
        fromLayer: PCBLayer.SIGNAL_TOP,
        toLayer: PCBLayer.SIGNAL_BOTTOM,
      };

      const mesh = buildViaGeometry(through, mockBoard);
      const zs = mesh.z as number[];

      // Should span entire board thickness
      const zRange = Math.max(...zs) - Math.min(...zs);
      expect(zRange).toBeGreaterThan(mockBoard.thickness * 0.8);
    });

    it('should handle blind via (partial layers)', () => {
      const blind: Via = {
        ...mockVia,
        fromLayer: PCBLayer.SIGNAL_TOP,
        toLayer: PCBLayer.GROUND,
      };

      const mesh = buildViaGeometry(blind, mockBoard);
      expect(mesh.x).toBeDefined();
    });

    it('should handle drill smaller than outer diameter', () => {
      const drillMesh = buildViaDrillGeometry(mockVia, mockBoard);
      const viaMesh = buildViaGeometry(mockVia, mockBoard);

      const drillXs = drillMesh.x as number[];
      const viaXs = viaMesh.x as number[];

      const drillRange = Math.max(...drillXs) - Math.min(...drillXs);
      const viaRange = Math.max(...viaXs) - Math.min(...viaXs);

      // Drill should be smaller than via
      expect(drillRange).toBeLessThan(viaRange);
    });
  });
});
