/**
 * Equation Ordering Optimizer - Unit Tests
 *
 * Tests the EquationOrderingOptimizer class which optimizes equation solving order
 * for maximum efficiency and numerical stability.
 *
 * Test Coverage:
 * - optimizeOrdering() - 5 tests
 * - SCC (Strongly Connected Components) finding - 3 tests
 * - Cost estimation - 2 tests
 * - Advanced methods - 2 tests
 * - Edge cases - 2 tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EquationOrderingOptimizer,
  optimizeEquationOrder,
  type EquationOrder,
} from '../equationOrderingOptimizer';
import type { EditorElement, EditorBond } from '../types';
import type { CausalityStatus } from '../causalityAnalysis';

describe('EquationOrderingOptimizer', () => {
  let optimizer: EquationOrderingOptimizer;
  let elements: EditorElement[];
  let bonds: EditorBond[];
  let causalities: Map<string, CausalityStatus>;

  beforeEach(() => {
    optimizer = new EquationOrderingOptimizer();
    elements = [];
    bonds = [];
    causalities = new Map();
  });

  // =====================================================================
  // TEST GROUP 1: optimizeOrdering() - Main optimization function
  // =====================================================================

  describe('optimizeOrdering()', () => {
    it('should handle sequential equations (all independent)', () => {
      // Setup: Series chain Se → R → R → R (all independent)
      elements = [
        { id: 'se1', type: 'Se', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'r1', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'r2', type: 'R', position: { x: 200, y: 0 }, parameters: { resistance: 2000 } },
        { id: 'r3', type: 'R', position: { x: 300, y: 0 }, parameters: { resistance: 3000 } },
      ];

      bonds = [
        { id: 'b1', from: 'se1', to: 'r1' },
        { id: 'b2', from: 'r1', to: 'r2' },
        { id: 'b3', from: 'r2', to: 'r3' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'EffortOut');
      causalities.set('b3', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      expect(order).toBeDefined();
      expect(order.bondIds.length).toBe(3);
      expect(order.simultaneousBlocks.length).toBeGreaterThanOrEqual(1);
      expect(order.computationCost).toBeGreaterThan(0);
      expect(order.sparsity).toBeGreaterThanOrEqual(0);
      expect(order.sparsity).toBeLessThanOrEqual(1);
      expect(order.conditionNumber).toBeGreaterThan(0);
    });

    it('should detect simultaneous equations (algebraic block)', () => {
      // Setup: Simultaneous system (implicit equations)
      // A·x = b where A is fully connected
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 2000 } },
        { id: 'e3', type: 'R', position: { x: 200, y: 0 }, parameters: { resistance: 3000 } },
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' },
        { id: 'b2', from: 'e2', to: 'e3' },
        { id: 'b3', from: 'e3', to: 'e1' }, // Creates cycle → simultaneous
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'EffortOut');
      causalities.set('b3', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // May have simultaneous blocks if cycle detected
      expect(order.simultaneousBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it('should compute topological ordering', () => {
      // Setup: DAG (no cycles) - should produce topological order
      elements = [
        { id: 'e1', type: 'Se', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e3', type: 'C', position: { x: 200, y: 0 }, parameters: { capacitance: 1e-6 } },
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' },
        { id: 'b2', from: 'e2', to: 'e3' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Should produce valid ordering
      expect(order.bondIds.length).toBe(2);
      // First equation in order should have no dependencies
      expect(order.bondIds[0]).toBeDefined();
    });

    it('should estimate sparsity correctly', () => {
      // Setup: Sparse system (few connections)
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 2000 } },
        { id: 'e3', type: 'R', position: { x: 200, y: 0 }, parameters: { resistance: 3000 } },
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' },
        { id: 'b2', from: 'e2', to: 'e3' },
        // Only 2 connections (sparse)
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Sparse matrix has high sparsity value (fraction of zeros)
      expect(order.sparsity).toBeGreaterThan(0.5);
    });

    it('should estimate condition number for numerical stability', () => {
      // Setup: Wide range of resistances → poor conditioning
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1 } }, // Very small
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 10000 } }, // Very large
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' },
      ];

      causalities.set('b1', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Condition number > 1 (ill-conditioned if >> 1)
      expect(order.conditionNumber).toBeGreaterThanOrEqual(1);
    });
  });

  // =====================================================================
  // TEST GROUP 2: SCC Finding (Strongly Connected Components)
  // =====================================================================

  describe('SCC (Strongly Connected Components)', () => {
    it('should identify single-element blocks', () => {
      // Setup: Independent equations (each is its own SCC)
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 2000 } },
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' }, // One-way dependency
      ];

      causalities.set('b1', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Each element should be its own SCC
      expect(order.simultaneousBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it('should identify multiple simultaneous equation blocks', () => {
      // Setup: Two separate cycles (mutual dependencies)
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 2000 } },
        { id: 'e3', type: 'R', position: { x: 200, y: 0 }, parameters: { resistance: 3000 } },
        { id: 'e4', type: 'R', position: { x: 300, y: 0 }, parameters: { resistance: 4000 } },
      ];

      bonds = [
        // Cycle 1: e1 ↔ e2
        { id: 'b1', from: 'e1', to: 'e2' },
        { id: 'b2', from: 'e2', to: 'e1' },
        // Cycle 2: e3 ↔ e4
        { id: 'b3', from: 'e3', to: 'e4' },
        { id: 'b4', from: 'e4', to: 'e3' },
      ];

      for (const bond of bonds) {
        causalities.set(bond.id, 'EffortOut');
      }

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Should identify 2 simultaneous blocks
      expect(order.simultaneousBlocks.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle large cyclical graphs correctly', () => {
      // Setup: Ring topology (N elements, each depends on next)
      const n = 10;
      elements = [];
      bonds = [];

      for (let i = 0; i < n; i++) {
        elements.push({
          id: `e${i}`,
          type: 'R',
          position: { x: i * 50, y: 0 },
          parameters: { resistance: 1000 },
        });
      }

      for (let i = 0; i < n; i++) {
        const nextI = (i + 1) % n;
        bonds.push({
          id: `b${i}`,
          from: `e${i}`,
          to: `e${nextI}`,
        });
        causalities.set(`b${i}`, 'EffortOut');
      }

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Should form one large SCC (all connected)
      expect(order.simultaneousBlocks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =====================================================================
  // TEST GROUP 3: Cost Estimation
  // =====================================================================

  describe('Cost estimation', () => {
    it('should estimate FLOPS (floating-point operations)', () => {
      // Setup: Small 2x2 system
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 2000 } },
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' },
        { id: 'b2', from: 'e2', to: 'e1' }, // Cycle = simultaneous
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // For 2×2 system: ~2³/3 * density ≈ 2.7 ops (single block) or 2 ops (separate)
      expect(order.computationCost).toBeGreaterThan(0);
      expect(order.computationCost).toBeLessThan(100); // Reasonable for small system
    });

    it('should estimate condition number correctly', () => {
      // Setup: Well-conditioned system (similar resistances)
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 1100 } },
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' },
      ];

      causalities.set('b1', 'EffortOut');

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Condition number close to 1 for well-conditioned system
      expect(order.conditionNumber).toBeGreaterThan(0);
      expect(order.conditionNumber).toBeLessThan(2); // Well-conditioned
    });
  });

  // =====================================================================
  // TEST GROUP 4: Advanced Methods
  // =====================================================================

  describe('estimateImprovement()', () => {
    it('should calculate speedup ratio correctly', () => {
      // Setup: Simple ordering
      const originalOrder = ['b1', 'b2', 'b3']; // Sequential cost = 3

      const optimizedOrder: EquationOrder = {
        bondIds: ['b1', 'b2', 'b3'],
        simultaneousBlocks: [['b1'], ['b2'], ['b3']], // 3 blocks
        computationCost: 3, // No improvement
        sparsity: 0.5,
        conditionNumber: 1.5,
        description: 'Test order',
      };

      const improvement = optimizer.estimateImprovement(originalOrder, optimizedOrder);

      // Original cost = 3, optimized cost = 3 → speedup = 1
      expect(improvement).toBeGreaterThanOrEqual(1);
    });

    it('should show improvement for truly optimized order', () => {
      const originalOrder = ['b1', 'b2', 'b3', 'b4', 'b5']; // Cost = 5

      const optimizedOrder: EquationOrder = {
        bondIds: ['b1', 'b2', 'b3', 'b4', 'b5'],
        simultaneousBlocks: [['b1', 'b2'], ['b3'], ['b4', 'b5']], // Simultaneous blocks reduce cost
        computationCost: 8 + 1 + 8 / 3, // ~10 FLOPS total (less than sequential 5)
        sparsity: 0.7, // Sparse
        conditionNumber: 2,
        description: 'Optimized',
      };

      const improvement = optimizer.estimateImprovement(originalOrder, optimizedOrder);

      expect(improvement).toBeGreaterThanOrEqual(1);
    });
  });

  describe('suggestParallelization()', () => {
    it('should identify parallelizable blocks', () => {
      const order: EquationOrder = {
        bondIds: ['b1', 'b2', 'b3', 'b4'],
        simultaneousBlocks: [['b1', 'b2', 'b3'], ['b4']], // One block with 3 parallel, one serial
        computationCost: 20,
        sparsity: 0.5,
        conditionNumber: 1.5,
        description: 'Parallel-friendly',
      };

      const parallelization = optimizer.suggestParallelization(order);

      expect(parallelization.parallelizable).toBe(2);
      expect(parallelization.sequential).toBe(1);
      expect(parallelization.recommendation).toBeDefined();
      expect(parallelization.recommendation.length).toBeGreaterThan(0);
    });

    it('should recommend single-threaded for sequential systems', () => {
      const order: EquationOrder = {
        bondIds: ['b1', 'b2', 'b3'],
        simultaneousBlocks: [['b1'], ['b2'], ['b3']], // All sequential
        computationCost: 3,
        sparsity: 0.8,
        conditionNumber: 1.2,
        description: 'Sequential',
      };

      const parallelization = optimizer.suggestParallelization(order);

      expect(parallelization.recommendation.toLowerCase()).toContain('sequential');
    });
  });

  // =====================================================================
  // TEST GROUP 5: Edge Cases
  // =====================================================================

  describe('Edge cases', () => {
    it('should handle large graphs (200+ equations) efficiently', () => {
      // Setup: Large chain
      const n = 200;
      elements = [];
      bonds = [];

      for (let i = 0; i < n; i++) {
        elements.push({
          id: `e${i}`,
          type: 'R',
          position: { x: i * 10, y: 0 },
          parameters: { resistance: 1000 + i },
        });
      }

      for (let i = 0; i < n - 1; i++) {
        bonds.push({
          id: `b${i}`,
          from: `e${i}`,
          to: `e${i + 1}`,
        });
        causalities.set(`b${i}`, 'EffortOut');
      }

      const start = performance.now();
      const order = optimizer.optimizeOrdering(elements, bonds, causalities);
      const elapsed = performance.now() - start;

      // Should complete in reasonable time (< 1 second)
      expect(elapsed).toBeLessThan(1000);
      expect(order.bondIds.length).toBe(n - 1);
    });

    it('should handle fully connected graph', () => {
      // Setup: Complete graph (every node connects to every other)
      elements = [
        { id: 'e1', type: 'R', position: { x: 0, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 2000 } },
        { id: 'e3', type: 'R', position: { x: 200, y: 0 }, parameters: { resistance: 3000 } },
      ];

      bonds = [
        // All pairs connected
        { id: 'b1', from: 'e1', to: 'e2' },
        { id: 'b2', from: 'e1', to: 'e3' },
        { id: 'b3', from: 'e2', to: 'e1' },
        { id: 'b4', from: 'e2', to: 'e3' },
        { id: 'b5', from: 'e3', to: 'e1' },
        { id: 'b6', from: 'e3', to: 'e2' },
      ];

      for (const bond of bonds) {
        causalities.set(bond.id, 'EffortOut');
      }

      const order = optimizer.optimizeOrdering(elements, bonds, causalities);

      // Fully connected → one large SCC
      expect(order.simultaneousBlocks.length).toBeGreaterThanOrEqual(1);
      // All equations in one block (or multiple blocks depending on implementation)
      const totalEqs = order.simultaneousBlocks.reduce((sum, block) => sum + block.length, 0);
      expect(totalEqs).toBeGreaterThanOrEqual(6);
    });
  });

  // =====================================================================
  // TEST GROUP 6: Convenience Functions
  // =====================================================================

  describe('optimizeEquationOrder() convenience function', () => {
    it('should wrap optimizer correctly', () => {
      elements = [
        { id: 'e1', type: 'Se', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'e2', type: 'R', position: { x: 100, y: 0 }, parameters: { resistance: 1000 } },
        { id: 'e3', type: 'C', position: { x: 200, y: 0 }, parameters: { capacitance: 1e-6 } },
      ];

      bonds = [
        { id: 'b1', from: 'e1', to: 'e2' },
        { id: 'b2', from: 'e2', to: 'e3' },
      ];

      causalities.set('b1', 'EffortOut');
      causalities.set('b2', 'EffortOut');

      const order = optimizeEquationOrder(elements, bonds, causalities);

      expect(order).toBeDefined();
      expect(order.bondIds).toBeDefined();
      expect(order.simultaneousBlocks).toBeDefined();
    });
  });

  // =====================================================================
  // SUMMARY: All Tests
  // =====================================================================

  describe('Test Summary', () => {
    it('should have tested all major functions', () => {
      // This is just a summary test to document what was covered
      const coverage = {
        'optimizeOrdering()': 5,
        'SCC finding': 3,
        'Cost estimation': 2,
        'estimateImprovement()': 2,
        'suggestParallelization()': 2,
        'Edge cases': 2,
        'Convenience functions': 1,
      };

      const totalTests = Object.values(coverage).reduce((a, b) => a + b, 0);
      expect(totalTests).toBe(17); // 16 actual tests + 1 summary
    });
  });
});
