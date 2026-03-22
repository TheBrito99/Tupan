/**
 * Assembly Constraints Tests
 * Phase 17.6: Testing
 *
 * Tests for constraint creation, validation, and analysis
 */

import { AssemblyConstraintManager, ExplodedViewManager, MeasurementCalculator } from '../assembly-constraints';
import type { AssemblyEntity } from '../assembly-constraints';

describe('AssemblyConstraintManager', () => {
  let manager: AssemblyConstraintManager;

  const mockEntity1: AssemblyEntity = {
    bodyId: 'body_0',
    featureId: 'feature_0',
    entityType: 'Face',
    entityId: 'face_0',
    name: 'Face 1',
  };

  const mockEntity2: AssemblyEntity = {
    bodyId: 'body_1',
    featureId: 'feature_1',
    entityType: 'Face',
    entityId: 'face_1',
    name: 'Face 2',
  };

  beforeEach(() => {
    manager = new AssemblyConstraintManager();
  });

  // =========================================================================
  // CONSTRAINT CREATION
  // =========================================================================

  describe('Constraint Creation', () => {
    test('should create coincident constraint', () => {
      const id = manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      const constraint = manager.getConstraint(id);

      expect(constraint).toBeDefined();
      expect(constraint?.type).toBe('Coincident');
      expect(constraint?.entity1).toEqual(mockEntity1);
      expect(constraint?.entity2).toEqual(mockEntity2);
    });

    test('should create parallel constraint', () => {
      const id = manager.createParallelConstraint(mockEntity1, mockEntity2);
      const constraint = manager.getConstraint(id);

      expect(constraint?.type).toBe('Parallel');
      expect(constraint?.isDriver).toBe(true);
    });

    test('should create perpendicular constraint', () => {
      const id = manager.createPerpendicularConstraint(mockEntity1, mockEntity2);
      const constraint = manager.getConstraint(id);

      expect(constraint?.type).toBe('Perpendicular');
    });

    test('should create distance constraint with value', () => {
      const id = manager.createDistanceConstraint(mockEntity1, mockEntity2, 10.5, 'mm');
      const constraint = manager.getConstraint(id);

      expect(constraint?.type).toBe('Distance');
      expect(constraint?.value).toBe(10.5);
      expect(constraint?.unit).toBe('mm');
    });

    test('should create angle constraint with value', () => {
      const id = manager.createAngleConstraint(mockEntity1, mockEntity2, 90);
      const constraint = manager.getConstraint(id);

      expect(constraint?.type).toBe('Angle');
      expect(constraint?.value).toBe(90);
      expect(constraint?.unit).toBe('°');
    });

    test('should create fixed constraint with single entity', () => {
      const id = manager.createFixedConstraint(mockEntity1);
      const constraint = manager.getConstraint(id);

      expect(constraint?.type).toBe('Fixed');
      expect(constraint?.entity2).toBeUndefined();
    });

    test('should create gear constraint with ratio', () => {
      const id = manager.createGearConstraint(mockEntity1, mockEntity2, 2.5);
      const constraint = manager.getConstraint(id);

      expect(constraint?.type).toBe('Gear');
      expect(constraint?.value).toBe(2.5);
    });
  });

  // =========================================================================
  // CONSTRAINT MANAGEMENT
  // =========================================================================

  describe('Constraint Management', () => {
    test('should get all constraints', () => {
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      manager.createParallelConstraint(mockEntity1, mockEntity2);
      manager.createDistanceConstraint(mockEntity1, mockEntity2, 5);

      const all = manager.getAllConstraints();
      expect(all.length).toBe(3);
    });

    test('should get constraints for specific body', () => {
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      manager.createParallelConstraint(mockEntity1, mockEntity2);
      manager.createFixedConstraint(mockEntity1);

      const bodyConstraints = manager.getBodyConstraints('body_0');
      expect(bodyConstraints.length).toBe(3);
    });

    test('should update constraint value', () => {
      const id = manager.createDistanceConstraint(mockEntity1, mockEntity2, 10);
      const success = manager.updateConstraintValue(id, 20);

      expect(success).toBe(true);
      expect(manager.getConstraint(id)?.value).toBe(20);
    });

    test('should not update non-numeric constraint value', () => {
      const id = manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      const success = manager.updateConstraintValue(id, 10);

      expect(success).toBe(false);
    });

    test('should delete constraint', () => {
      const id = manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      const deleted = manager.deleteConstraint(id);

      expect(deleted).toBe(true);
      expect(manager.getConstraint(id)).toBeUndefined();
    });

    test('should suppress and unsuppress constraint', () => {
      const id = manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      const constraint = manager.getConstraint(id);

      expect(constraint?.isSupressed).toBe(false);

      manager.suppressConstraint(id);
      expect(manager.getConstraint(id)?.isSupressed).toBe(true);

      manager.unsuppressConstraint(id);
      expect(manager.getConstraint(id)?.isSupressed).toBe(false);
    });

    test('should clear all constraints', () => {
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      manager.createParallelConstraint(mockEntity1, mockEntity2);

      manager.clear();
      expect(manager.getAllConstraints().length).toBe(0);
    });
  });

  // =========================================================================
  // CONSTRAINT ANALYSIS
  // =========================================================================

  describe('Constraint Analysis', () => {
    test('should analyze fully constrained assembly', () => {
      // Single body: fixed (6 DOF)
      manager.createFixedConstraint(mockEntity1);

      const status = manager.analyzeConstraints();
      expect(status.isFullyConstrained).toBe(true);
      expect(status.undefinedDegreesOfFreedom).toBe(0);
    });

    test('should detect under-constrained assembly', () => {
      // Two bodies: only 1 constraint (needs 11 DOF removed for full constraint)
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);

      const status = manager.analyzeConstraints();
      expect(status.isFullyConstrained).toBe(false);
      expect(status.undefinedDegreesOfFreedom).toBeGreaterThan(0);
    });

    test('should calculate degrees of freedom correctly', () => {
      // 2 bodies = 12 DOF total
      // Coincident = 6 DOF, Parallel = 2 DOF, Distance = 1 DOF = 9 DOF removed
      // Result: 12 - 9 = 3 DOF remaining
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      manager.createParallelConstraint(mockEntity1, mockEntity2);
      manager.createDistanceConstraint(mockEntity1, mockEntity2, 5);

      const status = manager.analyzeConstraints();
      expect(status.undefinedDegreesOfFreedom).toBe(3);
    });

    test('should return correct status message', () => {
      // Fully constrained
      manager.createFixedConstraint(mockEntity1);
      expect(manager.getStatusMessage()).toContain('Fully Constrained');

      // Under-constrained
      manager.clear();
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      const message = manager.getStatusMessage();
      expect(message).toContain('Under-Constrained');
      expect(message).toContain('DOF');
    });
  });

  // =========================================================================
  // SERIALIZATION
  // =========================================================================

  describe('Serialization', () => {
    test('should export to JSON', () => {
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      manager.createDistanceConstraint(mockEntity1, mockEntity2, 10);

      const json = manager.toJSON();
      const data = JSON.parse(json);

      expect(data.constraints).toHaveLength(2);
      expect(data.bodies).toContain('body_0');
      expect(data.bodies).toContain('body_1');
      expect(data.status).toBeDefined();
    });

    test('should import from JSON', () => {
      manager.createCoincidentConstraint(mockEntity1, mockEntity2);
      const exported = manager.toJSON();

      const newManager = new AssemblyConstraintManager();
      const success = newManager.fromJSON(exported);

      expect(success).toBe(true);
      expect(newManager.getAllConstraints().length).toBe(1);
    });

    test('should return false for invalid JSON', () => {
      const manager2 = new AssemblyConstraintManager();
      const success = manager2.fromJSON('invalid json');

      expect(success).toBe(false);
    });
  });
});

// ============================================================================
// EXPLODED VIEW TESTS
// ============================================================================

describe('ExplodedViewManager', () => {
  let manager: ExplodedViewManager;

  beforeEach(() => {
    manager = new ExplodedViewManager();
  });

  test('should create exploded view', () => {
    const id = manager.createView('Assembly Exploded');
    const view = manager.getView(id);

    expect(view).toBeDefined();
    expect(view?.name).toBe('Assembly Exploded');
  });

  test('should set body transform', () => {
    const viewId = manager.createView();
    const success = manager.setBodyTransform(viewId, 'body_0', 10, 20, 30, 45, 0, 0);

    expect(success).toBe(true);

    const view = manager.getView(viewId);
    const transform = view?.bodyTransforms.get('body_0');

    expect(transform).toBeDefined();
    expect(transform?.tx).toBe(10);
    expect(transform?.ty).toBe(20);
    expect(transform?.tz).toBe(30);
    expect(transform?.rx).toBe(45);
  });

  test('should get all views', () => {
    manager.createView('View 1');
    manager.createView('View 2');
    manager.createView('View 3');

    const views = manager.getAllViews();
    expect(views.length).toBe(3);
  });

  test('should delete view', () => {
    const id = manager.createView();
    const deleted = manager.deleteView(id);

    expect(deleted).toBe(true);
    expect(manager.getView(id)).toBeUndefined();
  });

  test('should clear all views', () => {
    manager.createView();
    manager.createView();

    manager.clear();
    expect(manager.getAllViews().length).toBe(0);
  });
});
