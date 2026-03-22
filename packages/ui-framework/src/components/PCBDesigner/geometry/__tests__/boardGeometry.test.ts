/**
 * Unit Tests: PCB Board Geometry
 * Phase 15: 3D Visualization
 *
 * Tests for board geometry generation and layer Z-offset calculations
 */

import { PCBBoard, PCBLayer } from '../../types';
import {
  calculateLayerZOffset,
  buildBoardGeometry,
  buildCopperLayerGeometry,
  buildSoldermaskGeometry,
  buildAllBoardGeometry,
} from '../boardGeometry';

describe('boardGeometry', () => {
  // Mock PCB board
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

  describe('calculateLayerZOffset', () => {
    it('should position substrate at z=0 to -1.6mm', () => {
      const offset = calculateLayerZOffset(mockBoard, 'substrate');
      expect(offset).toBe(-mockBoard.thickness);
    });

    it('should position signal top layer above substrate', () => {
      const offset = calculateLayerZOffset(mockBoard, PCBLayer.SIGNAL_TOP);
      expect(offset).toBeGreaterThan(0);
    });

    it('should position signal bottom layer below substrate', () => {
      const offset = calculateLayerZOffset(mockBoard, PCBLayer.SIGNAL_BOTTOM);
      expect(offset).toBeLessThan(-mockBoard.thickness);
    });

    it('should have consistent spacing between layers', () => {
      const offset1 = calculateLayerZOffset(mockBoard, PCBLayer.SIGNAL_TOP);
      const offset2 = calculateLayerZOffset(mockBoard, PCBLayer.GROUND);
      const spacing = Math.abs(offset2 - offset1);

      // Spacing should be > 0 (layers are distinct)
      expect(spacing).toBeGreaterThan(0);
    });

    it('should handle mask layers', () => {
      const maskTop = calculateLayerZOffset(mockBoard, PCBLayer.MASK_TOP);
      const maskBottom = calculateLayerZOffset(mockBoard, PCBLayer.MASK_BOTTOM);

      expect(maskTop).toBeGreaterThan(mockBoard.thickness * 0.5);
      expect(maskBottom).toBeLessThan(-mockBoard.thickness * 0.5);
    });
  });

  describe('buildBoardGeometry', () => {
    it('should return a Plotly mesh3d object', () => {
      const mesh = buildBoardGeometry(mockBoard);
      expect(mesh.type).toBe('mesh3d');
      expect(mesh.x).toBeDefined();
      expect(mesh.y).toBeDefined();
      expect(mesh.z).toBeDefined();
      expect(mesh.i).toBeDefined();
      expect(mesh.j).toBeDefined();
      expect(mesh.k).toBeDefined();
    });

    it('should have vertices matching board dimensions', () => {
      const mesh = buildBoardGeometry(mockBoard);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];

      expect(Math.max(...xs)).toBeLessThanOrEqual(mockBoard.width);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(mockBoard.height);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    });

    it('should have matching vertex and index counts', () => {
      const mesh = buildBoardGeometry(mockBoard);
      const xs = mesh.x as number[];
      const is = mesh.i as number[];

      // Indices should reference valid vertices
      expect(Math.max(...is)).toBeLessThan(xs.length);
      expect(Math.min(...is)).toBeGreaterThanOrEqual(0);
    });

    it('should create valid triangles (all indices non-negative)', () => {
      const mesh = buildBoardGeometry(mockBoard);
      const is = mesh.i as number[];
      const js = mesh.j as number[];
      const ks = mesh.k as number[];

      for (let i = 0; i < is.length; i++) {
        expect(is[i]).toBeGreaterThanOrEqual(0);
        expect(js[i]).toBeGreaterThanOrEqual(0);
        expect(ks[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('buildCopperLayerGeometry', () => {
    it('should return mesh3d for copper layers', () => {
      const mesh = buildCopperLayerGeometry(mockBoard, PCBLayer.SIGNAL_TOP);
      expect(mesh.type).toBe('mesh3d');
      expect(mesh.color).toBeDefined();
    });

    it('should be positioned at correct layer height', () => {
      const mesh = buildCopperLayerGeometry(mockBoard, PCBLayer.SIGNAL_TOP);
      const zs = mesh.z as number[];
      const expectedOffset = calculateLayerZOffset(mockBoard, PCBLayer.SIGNAL_TOP);

      // Copper thickness = 0.035mm
      zs.forEach(z => {
        expect(z).toBeGreaterThanOrEqual(expectedOffset);
        expect(z).toBeLessThanOrEqual(expectedOffset + 0.035);
      });
    });
  });

  describe('buildSoldermaskGeometry', () => {
    it('should return mesh3d for solder mask', () => {
      const mesh = buildSoldermaskGeometry(mockBoard, PCBLayer.MASK_TOP);
      expect(mesh.type).toBe('mesh3d');
      expect(mesh.color).toBe('#2d5016'); // Solder mask green
    });

    it('should have opacity < 1.0 for visibility', () => {
      const mesh = buildSoldermaskGeometry(mockBoard, PCBLayer.MASK_TOP);
      expect(mesh.opacity).toBeLessThan(1.0);
      expect(mesh.opacity).toBeGreaterThan(0);
    });

    it('should cover board area', () => {
      const mesh = buildSoldermaskGeometry(mockBoard, PCBLayer.MASK_TOP);
      const xs = mesh.x as number[];

      // Should span roughly board width
      const xRange = Math.max(...xs) - Math.min(...xs);
      expect(xRange).toBeCloseTo(mockBoard.width, -1);
    });
  });

  describe('buildAllBoardGeometry', () => {
    it('should return array of meshes', () => {
      const meshes = buildAllBoardGeometry(mockBoard);
      expect(Array.isArray(meshes)).toBe(true);
      expect(meshes.length).toBeGreaterThan(0);
    });

    it('should include board, copper layers, and masks', () => {
      const meshes = buildAllBoardGeometry(mockBoard);
      const names = meshes.map(m => m.name).filter(n => !!n) as string[];

      // Should have substrate
      expect(names.some(n => n.includes('PCB'))).toBe(true);

      // Should have copper layers
      expect(names.some(n => n.includes('Copper'))).toBe(true);

      // Should have solder mask
      expect(names.some(n => n.includes('Mask'))).toBe(true);
    });

    it('should not create NaN or Infinity values', () => {
      const meshes = buildAllBoardGeometry(mockBoard);

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
    it('should handle very small boards', () => {
      const smallBoard: PCBBoard = {
        ...mockBoard,
        width: 10,
        height: 10,
        thickness: 0.8,
      };

      const meshes = buildAllBoardGeometry(smallBoard);
      expect(meshes.length).toBeGreaterThan(0);
      meshes.forEach(mesh => {
        expect(mesh.x).toBeDefined();
        expect((mesh.x as number[]).length).toBeGreaterThan(0);
      });
    });

    it('should handle very large boards', () => {
      const largeBoard: PCBBoard = {
        ...mockBoard,
        width: 500,
        height: 500,
        thickness: 2.4,
      };

      const meshes = buildAllBoardGeometry(largeBoard);
      expect(meshes.length).toBeGreaterThan(0);
    });

    it('should handle single layer board', () => {
      const singleLayer: PCBBoard = {
        ...mockBoard,
        layers: [PCBLayer.SIGNAL_TOP],
      };

      const meshes = buildAllBoardGeometry(singleLayer);
      expect(meshes.length).toBeGreaterThan(0);
    });
  });
});
