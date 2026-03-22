/**
 * Unit Tests: PCB Component Geometry
 * Phase 15: 3D Visualization
 *
 * Tests for component geometry generation and batching
 */

import { PlacedComponent, Footprint } from '../../types';
import {
  buildComponentGeometry,
  buildAllComponentGeometry,
  ComponentColors,
} from '../componentGeometry';

describe('componentGeometry', () => {
  const mockFootprint: Footprint = {
    name: 'R0603',
    bounds: { width: 1.6, height: 0.8 },
    pads: [],
  };

  const mockComponent: PlacedComponent = {
    id: 'test-comp-1',
    refdes: 'R1',
    footprintId: 'R0603',
    position: { x: 50, y: 50 },
    rotation: 0,
    side: 'top',
  };

  describe('buildComponentGeometry', () => {
    it('should return mesh3d object', () => {
      const mesh = buildComponentGeometry(mockComponent, mockFootprint);
      expect(mesh.type).toBe('mesh3d');
      expect(mesh.x).toBeDefined();
      expect(mesh.y).toBeDefined();
      expect(mesh.z).toBeDefined();
    });

    it('should position component at correct location', () => {
      const mesh = buildComponentGeometry(mockComponent, mockFootprint);
      const xs = mesh.x as number[];
      const ys = mesh.y as number[];

      const xCenter = (Math.max(...xs) + Math.min(...xs)) / 2;
      const yCenter = (Math.max(...ys) + Math.min(...ys)) / 2;

      expect(xCenter).toBeCloseTo(mockComponent.position.x, 0);
      expect(yCenter).toBeCloseTo(mockComponent.position.y, 0);
    });

    it('should apply rotation correctly', () => {
      // 90 degree rotation
      const rotatedComp = { ...mockComponent, rotation: 90 };
      const mesh = buildComponentGeometry(rotatedComp, mockFootprint);

      const xs = mesh.x as number[];
      const ys = mesh.y as number[];

      // After 90° rotation, width and height should swap
      const xSpan = Math.max(...xs) - Math.min(...xs);
      const ySpan = Math.max(...ys) - Math.min(...ys);

      // Should be roughly swapped (allowing for rounding)
      expect(Math.abs(xSpan - mockFootprint.bounds.height)).toBeLessThan(0.5);
      expect(Math.abs(ySpan - mockFootprint.bounds.width)).toBeLessThan(0.5);
    });

    it('should handle top and bottom sides', () => {
      const topMesh = buildComponentGeometry(mockComponent, mockFootprint);
      const bottomComp = { ...mockComponent, side: 'bottom' as const };
      const bottomMesh = buildComponentGeometry(bottomComp, mockFootprint);

      const topZs = topMesh.z as number[];
      const bottomZs = bottomMesh.z as number[];

      // Top side should have positive Z, bottom negative
      expect(Math.max(...topZs)).toBeGreaterThan(0);
      expect(Math.min(...bottomZs)).toBeLessThan(0);
    });

    it('should use correct color for component type', () => {
      const resistor = { ...mockComponent, refdes: 'R1' };
      const rMesh = buildComponentGeometry(resistor, mockFootprint);
      expect(rMesh.color).toBe(ComponentColors.resistor);

      const capacitor = { ...mockComponent, refdes: 'C1' };
      const cMesh = buildComponentGeometry(capacitor, mockFootprint);
      expect(cMesh.color).toBe(ComponentColors.capacitor);

      const ic = { ...mockComponent, refdes: 'U1' };
      const uMesh = buildComponentGeometry(ic, mockFootprint);
      expect(uMesh.color).toBe(ComponentColors.ic);
    });

    it('should have 8 vertices for rectangular box', () => {
      const mesh = buildComponentGeometry(mockComponent, mockFootprint);
      const xs = mesh.x as number[];
      expect(xs.length).toBe(8);
    });

    it('should have valid triangle indices', () => {
      const mesh = buildComponentGeometry(mockComponent, mockFootprint);
      const is = mesh.i as number[];
      const js = mesh.j as number[];
      const ks = mesh.k as number[];

      for (let i = 0; i < is.length; i++) {
        expect(is[i]).toBeGreaterThanOrEqual(0);
        expect(is[i]).toBeLessThan(8);
        expect(js[i]).toBeGreaterThanOrEqual(0);
        expect(js[i]).toBeLessThan(8);
        expect(ks[i]).toBeGreaterThanOrEqual(0);
        expect(ks[i]).toBeLessThan(8);
      }
    });

    it('should handle missing footprint gracefully', () => {
      const mesh = buildComponentGeometry(mockComponent);
      expect(mesh.x).toBeDefined();
      expect((mesh.x as number[]).length).toBe(8);
    });

    it('should include refdes in hover text', () => {
      const mesh = buildComponentGeometry(mockComponent, mockFootprint);
      expect(mesh.hovertemplate).toContain('R1');
    });
  });

  describe('buildAllComponentGeometry', () => {
    it('should return array of meshes', () => {
      const components = [mockComponent];
      const meshes = buildAllComponentGeometry(components);
      expect(Array.isArray(meshes)).toBe(true);
    });

    it('should handle empty component list', () => {
      const meshes = buildAllComponentGeometry([]);
      expect(meshes.length).toBe(0);
    });

    it('should batch components when count > 20', () => {
      const components = Array.from({ length: 30 }, (_, i) => ({
        ...mockComponent,
        id: `comp-${i}`,
        refdes: `R${i}`,
        position: { x: 10 + i * 5, y: 10 + (i % 5) * 5 },
      }));

      const meshes = buildAllComponentGeometry(components);

      // With batching, should have fewer meshes than components
      expect(meshes.length).toBeLessThan(components.length);

      // Should still have at least 1 mesh
      expect(meshes.length).toBeGreaterThan(0);
    });

    it('should NOT batch components when count < 20', () => {
      const components = Array.from({ length: 10 }, (_, i) => ({
        ...mockComponent,
        id: `comp-${i}`,
        refdes: `R${i}`,
        position: { x: 10 + i * 5, y: 10 },
      }));

      const meshes = buildAllComponentGeometry(components);

      // Without batching, should have 1 mesh per component
      expect(meshes.length).toBe(components.length);
    });

    it('should not create NaN or Infinity values', () => {
      const components = [mockComponent];
      const meshes = buildAllComponentGeometry(components);

      meshes.forEach(mesh => {
        const xs = mesh.x as number[];
        const ys = mesh.y as number[];
        const zs = mesh.z as number[];

        [...xs, ...ys, ...zs].forEach(val => {
          expect(isFinite(val)).toBe(true);
        });
      });
    });

    it('should preserve component data in batches', () => {
      const components = Array.from({ length: 30 }, (_, i) => ({
        ...mockComponent,
        id: `comp-${i}`,
        refdes: i < 15 ? `R${i}` : `C${i - 15}`,
        position: { x: 10 + i * 5, y: 10 },
      }));

      const meshes = buildAllComponentGeometry(components);

      // Both resistors and capacitors should be represented
      const colors = meshes.map(m => m.color).filter(c => !!c);
      expect(colors.some(c => c === ComponentColors.resistor)).toBe(true);
      expect(colors.some(c => c === ComponentColors.capacitor)).toBe(true);
    });
  });

  describe('Component Colors', () => {
    it('should have distinct colors for each component type', () => {
      const colors = Object.values(ComponentColors);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('should define colors for all standard component prefixes', () => {
      const prefixes = ['R', 'C', 'L', 'D', 'Q', 'U', 'J', 'S'];
      prefixes.forEach(prefix => {
        const comp = { ...mockComponent, refdes: `${prefix}1` };
        const mesh = buildComponentGeometry(comp, mockFootprint);
        expect(mesh.color).toBeDefined();
        expect(mesh.color).not.toBe(ComponentColors.other);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0 degree rotation', () => {
      const mesh = buildComponentGeometry(mockComponent, mockFootprint);
      expect(mesh.x).toBeDefined();
      expect((mesh.x as number[]).length).toBe(8);
    });

    it('should handle 360 degree rotation', () => {
      const rotated = { ...mockComponent, rotation: 360 };
      const mesh = buildComponentGeometry(rotated, mockFootprint);
      expect(mesh.x).toBeDefined();
    });

    it('should handle negative rotation', () => {
      const rotated = { ...mockComponent, rotation: -90 };
      const mesh = buildComponentGeometry(rotated, mockFootprint);
      expect(mesh.x).toBeDefined();
    });

    it('should handle very large coordinates', () => {
      const largePos = { ...mockComponent, position: { x: 10000, y: 10000 } };
      const mesh = buildComponentGeometry(largePos, mockFootprint);

      const xs = mesh.x as number[];
      expect(Math.max(...xs)).toBeGreaterThan(9990);
    });

    it('should handle very small footprints', () => {
      const tiny: Footprint = {
        ...mockFootprint,
        bounds: { width: 0.1, height: 0.1 },
      };
      const mesh = buildComponentGeometry(mockComponent, tiny);
      expect(mesh.x).toBeDefined();
    });

    it('should handle very large footprints', () => {
      const huge: Footprint = {
        ...mockFootprint,
        bounds: { width: 100, height: 100 },
      };
      const mesh = buildComponentGeometry(mockComponent, huge);
      expect(mesh.x).toBeDefined();
    });
  });
});
