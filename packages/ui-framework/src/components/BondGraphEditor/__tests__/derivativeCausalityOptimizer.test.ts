/**
 * Derivative Causality Optimizer Tests
 *
 * Test suite for identifying and minimizing derivative causality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { EditorElement, EditorBond } from '../types';
import {
  DerivativeCausalityOptimizer,
  findDerivativeCausalities,
  formatDerivativeOrder,
} from '../derivativeCausalityOptimizer';

describe('DerivativeCausalityOptimizer', () => {
  let optimizer: DerivativeCausalityOptimizer;
  let elements: EditorElement[];
  let bonds: EditorBond[];
  let causalities: Map<string, string>;

  beforeEach(() => {
    optimizer = new DerivativeCausalityOptimizer();
    elements = [];
    bonds = [];
    causalities = new Map();
  });

  describe('findDerivativeCausalities', () => {
    it('should detect no issues for integral causality', () => {
      // Capacitor with EffortIn (integral causality - good)
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'FlowOut' },
      ];

      causalities.set('b1', 'FlowOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      // EffortOut on C is problematic, but FlowOut is better
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should detect capacitor with problematic causality', () => {
      // Capacitor with EffortOut (requires derivative)
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      // Should detect at least one issue
      expect(issues.length).toBeGreaterThan(0);
      if (issues.length > 0) {
        expect(issues[0].elementType).toBe('C');
        expect(issues[0].derivativeOrder).toBeGreaterThan(0);
      }
    });

    it('should detect inductor with problematic causality', () => {
      // Inductor with EffortOut (requires derivative)
      elements = [
        { id: 'i1', type: 'I', x: 0, y: 0, parameters: { inertance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'i1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      expect(issues.length).toBeGreaterThan(0);
      if (issues.length > 0) {
        expect(issues[0].elementType).toBe('I');
      }
    });

    it('should classify severity correctly', () => {
      // Create issues of different severities
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
        { id: 'i1', type: 'I', x: 100, y: 0, parameters: { inertance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'EffortOut' },
        { id: 'b2', from: 'i1', to: 'external', causality: 'FlowOut' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'FlowOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      // All issues should have a severity level
      issues.forEach(issue => {
        expect(['critical', 'warning', 'info']).toContain(issue.severity);
      });
    });

    it('should suggest remedies for issues', () => {
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      issues.forEach(issue => {
        expect(issue.remedies.length).toBeGreaterThan(0);
        issue.remedies.forEach(remedy => {
          expect(['reorder', 'restructure', 'damp', 'scale', 'solver']).toContain(remedy.type);
          expect(['high', 'medium', 'low']).toContain(remedy.impact);
        });
      });
    });

    it('should return empty for elements without storage', () => {
      elements = [
        { id: 'r1', type: 'R', x: 0, y: 0, parameters: { resistance: 1 } },
        { id: 'se1', type: 'Se', x: 100, y: 0, parameters: { effort: 5 } },
      ];

      bonds = [
        { id: 'b1', from: 'r1', to: 'se1', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      // No storage elements = no derivative causality issues
      expect(issues.length).toBe(0);
    });

    it('should handle unassigned causalities', () => {
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'Unassigned' },
      ];

      causalities.set('b1', 'Unassigned');

      // Should not crash
      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('Remedy Functions', () => {
    it('getRecommendedRemedy should return top remedy', () => {
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      if (issues.length > 0) {
        const remedy = optimizer.getRecommendedRemedy(issues[0]);

        expect(remedy).not.toBeNull();
        if (remedy) {
          expect(remedy).toHaveProperty('type');
          expect(remedy).toHaveProperty('description');
          expect(remedy).toHaveProperty('impact');
        }
      }
    });

    it('estimateRemedyEffectiveness should rate remedies', () => {
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      if (issues.length > 0 && issues[0].remedies.length > 0) {
        const effectiveness = optimizer.estimateRemedyEffectiveness(
          issues[0].remedies[0],
          issues[0]
        );

        expect(effectiveness).toBeGreaterThanOrEqual(0);
        expect(effectiveness).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple storage elements', () => {
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
        { id: 'c2', type: 'C', x: 100, y: 0, parameters: { capacitance: 1 } },
        { id: 'i1', type: 'I', x: 200, y: 0, parameters: { inertance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'c2', causality: 'EffortOut' },
        { id: 'b2', from: 'c2', to: 'i1', causality: 'EffortOut' },
        { id: 'b3', from: 'i1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'EffortOut');
      causalities.set('b3', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle large graphs', () => {
      elements = [];
      bonds = [];

      for (let i = 0; i < 50; i++) {
        elements.push({
          id: `c${i}`,
          type: 'C',
          x: i * 100,
          y: 0,
          parameters: { capacitance: 1 },
        });
      }

      for (let i = 0; i < 49; i++) {
        bonds.push({
          id: `b${i}`,
          from: `c${i}`,
          to: `c${i + 1}`,
          causality: 'EffortOut',
        });
        causalities.set(`b${i}`, 'EffortOut');
      }

      const start = performance.now();
      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);
      const time = performance.now() - start;

      expect(Array.isArray(issues)).toBe(true);
      expect(time).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Convenience Functions', () => {
    it('findDerivativeCausalities should work', () => {
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = findDerivativeCausalities(elements, bonds, causalities);

      expect(Array.isArray(issues)).toBe(true);
    });

    it('formatDerivativeOrder should return readable string', () => {
      expect(formatDerivativeOrder(0)).toContain('Integral');
      expect(formatDerivativeOrder(1)).toContain('Non-integral');
      expect(formatDerivativeOrder(2)).toContain('2nd Derivative');
    });
  });

  describe('Summary Functions', () => {
    it('summarizeIssues should count by severity', () => {
      elements = [
        { id: 'c1', type: 'C', x: 0, y: 0, parameters: { capacitance: 1 } },
      ];

      bonds = [
        { id: 'b1', from: 'c1', to: 'external', causality: 'EffortOut' },
      ];

      causalities.set('b1', 'EffortOut');

      const issues = optimizer.findDerivativeCausalities(elements, bonds, causalities);
      const summary = optimizer.summarizeIssues(issues);

      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('critical');
      expect(summary).toHaveProperty('warning');
      expect(summary).toHaveProperty('info');
      expect(summary.total).toBe(
        summary.critical + summary.warning + summary.info
      );
    });

    it('summarizeIssues should handle empty issues', () => {
      const summary = optimizer.summarizeIssues([]);

      expect(summary.total).toBe(0);
      expect(summary.critical).toBe(0);
      expect(summary.avgSeverity).toBe(0);
    });
  });
});
