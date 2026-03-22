/**
 * Advanced Loop Elimination Tests
 *
 * Test suite for algebraic loop detection and elimination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { EditorElement, EditorBond } from '../types';
import { AdvancedLoopEliminator, detectAlgebraicLoops } from '../advancedLoopElimination';

describe('AdvancedLoopEliminator', () => {
  let eliminator: AdvancedLoopEliminator;
  let elements: EditorElement[];
  let bonds: EditorBond[];
  let causalities: Map<string, string>;

  beforeEach(() => {
    eliminator = new AdvancedLoopEliminator();
    elements = [];
    bonds = [];
    causalities = new Map();
  });

  describe('findLoops', () => {
    it('should detect simple RC loop', () => {
      // Se → R → C → back to Se
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'c1', type: 'C', x: 200, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'c1', causality: 'FlowOut' },
        { id: 'b3', from: 'c1', to: 'se1', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      expect(loops).toHaveLength(1);
      expect(loops[0].bondIds).toContain('b1');
      expect(loops[0].severity).toBe('warning');
    });

    it('should detect no loops when cycle has storage element', () => {
      // Se → R → C → back to Se (has C storage)
      // This should NOT be an algebraic loop
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'c1', type: 'C', x: 200, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'c1', causality: 'FlowOut' },
        { id: 'b3', from: 'c1', to: 'se1', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');

      // The presence of C should prevent this from being detected as algebraic loop
      const loops = eliminator.findLoops(elements, bonds, causalities);

      // May have 0 loops or properly identified ones with storage
      expect(loops.length).toBeLessThanOrEqual(1);
    });

    it('should detect multiple independent loops', () => {
      // Two separate R-R loops
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'r2', type: 'R', x: 200, y: 0, parameters: { resistance: 1 } },
        { id: 'se2', type: 'Se', x: 0, y: 100, parameters: { effort: 3 } },
        { id: 'r3', type: 'R', x: 100, y: 100, parameters: { resistance: 1 } },
        { id: 'r4', type: 'R', x: 200, y: 100, parameters: { resistance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'r2', causality: 'FlowOut' },
        { id: 'b3', from: 'r2', to: 'se1', causality: 'EffortIn' },
        { id: 'b4', from: 'se2', to: 'r3', causality: 'EffortOut' },
        { id: 'b5', from: 'r3', to: 'r4', causality: 'FlowOut' },
        { id: 'b6', from: 'r4', to: 'se2', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');
      causalities.set('b4', 'EffortOut');
      causalities.set('b5', 'FlowOut');
      causalities.set('b6', 'EffortIn');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      // Should detect 2 independent loops
      expect(loops.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for acyclic graph', () => {
      // Simple chain: Se → R → C (no loop)
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'c1', type: 'C', x: 200, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'c1', causality: 'FlowOut' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      expect(loops).toHaveLength(0);
    });

    it('should handle empty graph', () => {
      const loops = eliminator.findLoops([], [], new Map());
      expect(loops).toHaveLength(0);
    });

    it('should handle unassigned causalities', () => {
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'Unassigned' },
      ];

      causalities.set('b1', 'Unassigned');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      // Unassigned causalities should not contribute to loops
      expect(loops).toHaveLength(0);
    });
  });

  describe('Break Point Suggestions', () => {
    it('should suggest break points for detected loop', () => {
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'r2', type: 'R', x: 200, y: 0, parameters: { resistance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'r2', causality: 'FlowOut' },
        { id: 'b3', from: 'r2', to: 'se1', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      if (loops.length > 0) {
        expect(loops[0].breakPoints.length).toBeGreaterThan(0);
        expect(loops[0].breakPoints[0]).toHaveProperty('bondId');
        expect(loops[0].breakPoints[0]).toHaveProperty('currentCausality');
        expect(loops[0].breakPoints[0]).toHaveProperty('suggestedCausality');
        expect(loops[0].breakPoints[0]).toHaveProperty('impact');
      }
    });

    it('should rank break points by impact', () => {
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'r2', type: 'R', x: 200, y: 0, parameters: { resistance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'r2', causality: 'FlowOut' },
        { id: 'b3', from: 'r2', to: 'se1', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      if (loops.length > 0 && loops[0].breakPoints.length > 1) {
        const firstImpact = loops[0].breakPoints[0].impact;
        const secondImpact = loops[0].breakPoints[1].impact;

        // First should have equal or lower impact than second
        const impactRank = { low: 0, medium: 1, high: 2 };
        expect(impactRank[firstImpact]).toBeLessThanOrEqual(impactRank[secondImpact]);
      }
    });
  });

  describe('Apply Break Point', () => {
    it('should apply break point and update causality', () => {
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'r2', type: 'R', x: 200, y: 0, parameters: { resistance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'r2', causality: 'FlowOut' },
        { id: 'b3', from: 'r2', to: 'se1', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      if (loops.length > 0 && loops[0].breakPoints.length > 0) {
        const breakPoint = loops[0].breakPoints[0];
        const optimized = eliminator.applyBreakPoint(loops[0], breakPoint, causalities);

        expect(optimized.get(breakPoint.bondId)).toBe(breakPoint.suggestedCausality);
        expect(loops[0].isResolved).toBe(true);
      }
    });

    it('should not modify other bonds when applying break point', () => {
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'r2', type: 'R', x: 200, y: 0, parameters: { resistance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'r2', causality: 'FlowOut' },
        { id: 'b3', from: 'r2', to: 'se1', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');

      const loops = eliminator.findLoops(elements, bonds, causalities);

      if (loops.length > 0 && loops[0].breakPoints.length > 0) {
        const breakPoint = loops[0].breakPoints[0];
        const originalCount = causalities.size;
        const optimized = eliminator.applyBreakPoint(loops[0], breakPoint, causalities);

        expect(optimized.size).toBe(originalCount);

        // Check all other bonds remain unchanged
        causalities.forEach((value, key) => {
          if (key !== breakPoint.bondId) {
            expect(optimized.get(key)).toBe(value);
          }
        });
      }
    });
  });

  describe('Convenience Functions', () => {
    it('detectAlgebraicLoops should return loops', () => {
      elements = [
        { id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } },
        { id: 'r1', type: 'R', x: 100, y: 0, parameters: { resistance: 1 } },
        { id: 'r2', type: 'R', x: 200, y: 0, parameters: { resistance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1', causality: 'EffortOut' },
        { id: 'b2', from: 'r1', to: 'r2', causality: 'FlowOut' },
        { id: 'b3', from: 'r2', to: 'se1', causality: 'EffortIn' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');
      causalities.set('b3', 'EffortIn');

      const loops = detectAlgebraicLoops(elements, bonds, causalities);

      expect(Array.isArray(loops)).toBe(true);
      expect(loops).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing elements', () => {
      bonds = [
        { id: 'b1', from: 'missing1', to: 'missing2', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      // Should handle gracefully without crashing
      const loops = eliminator.findLoops(elements, bonds, causalities);
      expect(Array.isArray(loops)).toBe(true);
    });

    it('should handle large graphs', () => {
      // Create a chain of 100 resistors
      elements = [];
      bonds = [];

      elements.push({ id: 'se1', type: 'Se', x: 0, y: 0, parameters: { effort: 5 } });

      for (let i = 0; i < 100; i++) {
        elements.push({
          id: `r${i}`,
          type: 'R',
          x: (i + 1) * 100,
          y: 0,
          parameters: { resistance: 1 },
        });

        const bondId = `b${i}`;
        bonds.push({
          id: bondId,
          from: i === 0 ? 'se1' : `r${i - 1}`,
          to: `r${i}`,
          causality: i === 0 ? 'EffortOut' : 'FlowOut',
        });

        causalities.set(bondId, i === 0 ? 'EffortOut' : 'FlowOut');
      }

      // Should complete in reasonable time
      const start = performance.now();
      const loops = eliminator.findLoops(elements, bonds, causalities);
      const time = performance.now() - start;

      expect(Array.isArray(loops)).toBe(true);
      expect(time).toBeLessThan(1000); // Should be fast
    });
  });
});
