/**
 * Assembly Constraints System
 * Phase 17.5: Advanced Features
 *
 * Enables multi-body assembly modeling with positional relationships:
 * - Mate constraints (coincident, parallel, perpendicular, tangent, distance, angle)
 * - Assembly features (like/mirror/pattern)
 * - Constraint validation and resolution
 * - Exploded view generation
 */

// ============================================================================
// TYPES
// ============================================================================

export type ConstraintType =
  | 'Coincident'    // Align two faces/points
  | 'Parallel'      // Make faces/planes parallel
  | 'Perpendicular' // Make faces/planes perpendicular
  | 'Tangent'       // Make surfaces tangent
  | 'Distance'      // Set distance between entities
  | 'Angle'         // Set angle between faces
  | 'Fixed'         // Lock body position/orientation
  | 'Gear'          // Mechanical gear ratio
  | 'Belt'          // Belt drive relationship
  | 'Chain';        // Chain drive relationship

export type EntityType = 'Face' | 'Edge' | 'Vertex' | 'Plane' | 'Axis' | 'Origin';

export interface AssemblyEntity {
  bodyId: string;
  featureId: string;
  entityType: EntityType;
  entityId: string;
  name: string;
}

export interface AssemblyConstraint {
  id: string;
  name: string;
  type: ConstraintType;
  entity1: AssemblyEntity;
  entity2?: AssemblyEntity;
  value?: number;
  unit?: string;
  isDriver: boolean;
  isSupressed: boolean;
  createdAt: number;
}

export interface ConstraintStatus {
  isFullyConstrained: boolean;
  redundantConstraints: string[];
  conflictingConstraints: string[];
  overdefinedCount: number;
  undefinedDegreesOfFreedom: number;
}

export interface ExplodedView {
  id: string;
  name: string;
  bodyTransforms: Map<string, {
    tx: number; ty: number; tz: number;
    rx: number; ry: number; rz: number;
  }>;
  distance: number;
  direction: [number, number, number];
  timestamp: number;
}

// ============================================================================
// ASSEMBLY CONSTRAINT MANAGER
// ============================================================================

export class AssemblyConstraintManager {
  private constraints: Map<string, AssemblyConstraint> = new Map();
  private constraintIndex: number = 0;
  private bodies: Set<string> = new Set();

  /**
   * Create a new mate constraint
   */
  createConstraint(
    name: string,
    type: ConstraintType,
    entity1: AssemblyEntity,
    entity2?: AssemblyEntity,
    value?: number,
    unit?: string
  ): string {
    const constraint: AssemblyConstraint = {
      id: `constraint_${this.constraintIndex++}`,
      name,
      type,
      entity1,
      entity2,
      value,
      unit,
      isDriver: true,
      isSupressed: false,
      createdAt: Date.now(),
    };

    // Track bodies involved
    this.bodies.add(entity1.bodyId);
    if (entity2) {
      this.bodies.add(entity2.bodyId);
    }

    this.constraints.set(constraint.id, constraint);
    return constraint.id;
  }

  /**
   * Coincident constraint - align two faces, points, or planes
   * Removes 3 degrees of freedom (or up to 6 for faces)
   */
  createCoincidentConstraint(entity1: AssemblyEntity, entity2: AssemblyEntity): string {
    return this.createConstraint('Coincident', 'Coincident', entity1, entity2);
  }

  /**
   * Parallel constraint - make two faces or planes parallel
   * Removes 2 rotational degrees of freedom
   */
  createParallelConstraint(entity1: AssemblyEntity, entity2: AssemblyEntity): string {
    return this.createConstraint('Parallel', 'Parallel', entity1, entity2);
  }

  /**
   * Perpendicular constraint - make two faces or planes perpendicular
   * Removes 2 rotational degrees of freedom
   */
  createPerpendicularConstraint(entity1: AssemblyEntity, entity2: AssemblyEntity): string {
    return this.createConstraint('Perpendicular', 'Perpendicular', entity1, entity2);
  }

  /**
   * Tangent constraint - make two surfaces tangent
   * Removes 3 degrees of freedom
   */
  createTangentConstraint(entity1: AssemblyEntity, entity2: AssemblyEntity): string {
    return this.createConstraint('Tangent', 'Tangent', entity1, entity2);
  }

  /**
   * Distance constraint - set distance between two entities
   * Removes 1 translational degree of freedom
   */
  createDistanceConstraint(
    entity1: AssemblyEntity,
    entity2: AssemblyEntity,
    distance: number,
    unit: string = 'mm'
  ): string {
    return this.createConstraint(
      `Distance: ${distance}${unit}`,
      'Distance',
      entity1,
      entity2,
      distance,
      unit
    );
  }

  /**
   * Angle constraint - set angle between two faces or planes
   * Removes 1 rotational degree of freedom
   */
  createAngleConstraint(
    entity1: AssemblyEntity,
    entity2: AssemblyEntity,
    angle: number
  ): string {
    return this.createConstraint(
      `Angle: ${angle}°`,
      'Angle',
      entity1,
      entity2,
      angle,
      '°'
    );
  }

  /**
   * Fixed constraint - lock a body in place
   * Removes all 6 degrees of freedom
   */
  createFixedConstraint(entity: AssemblyEntity): string {
    return this.createConstraint('Fixed', 'Fixed', entity);
  }

  /**
   * Gear constraint - mechanical gear ratio
   * Couples rotation with specified ratio
   */
  createGearConstraint(entity1: AssemblyEntity, entity2: AssemblyEntity, ratio: number): string {
    return this.createConstraint(`Gear (${ratio}:1)`, 'Gear', entity1, entity2, ratio);
  }

  /**
   * Get constraint by ID
   */
  getConstraint(id: string): AssemblyConstraint | undefined {
    return this.constraints.get(id);
  }

  /**
   * Get all constraints
   */
  getAllConstraints(): AssemblyConstraint[] {
    return Array.from(this.constraints.values());
  }

  /**
   * Get constraints involving a body
   */
  getBodyConstraints(bodyId: string): AssemblyConstraint[] {
    return Array.from(this.constraints.values()).filter(
      (c) => c.entity1.bodyId === bodyId || c.entity2?.bodyId === bodyId
    );
  }

  /**
   * Update constraint value (for distance/angle constraints)
   */
  updateConstraintValue(id: string, value: number): boolean {
    const constraint = this.constraints.get(id);
    if (!constraint) return false;

    if (constraint.type === 'Distance' || constraint.type === 'Angle' || constraint.type === 'Gear') {
      constraint.value = value;
      return true;
    }
    return false;
  }

  /**
   * Delete a constraint
   */
  deleteConstraint(id: string): boolean {
    return this.constraints.delete(id);
  }

  /**
   * Suppress a constraint (disable without deleting)
   */
  suppressConstraint(id: string): boolean {
    const constraint = this.constraints.get(id);
    if (!constraint) return false;
    constraint.isSupressed = true;
    return true;
  }

  /**
   * Unsuppress a constraint
   */
  unsuppressConstraint(id: string): boolean {
    const constraint = this.constraints.get(id);
    if (!constraint) return false;
    constraint.isSupressed = false;
    return true;
  }

  /**
   * Analyze constraint status
   * Returns information about over/under-constrained assembly
   */
  analyzeConstraints(): ConstraintStatus {
    const activeConstraints = Array.from(this.constraints.values()).filter(
      (c) => !c.isSupressed
    );

    // Count degrees of freedom removed
    let dofsRemoved = 0;
    const dofPerConstraint: Record<ConstraintType, number> = {
      Coincident: 6,    // Fully constrain position
      Parallel: 2,
      Perpendicular: 2,
      Tangent: 3,
      Distance: 1,
      Angle: 1,
      Fixed: 6,
      Gear: 1,
      Belt: 1,
      Chain: 1,
    };

    activeConstraints.forEach((c) => {
      dofsRemoved += dofPerConstraint[c.type] || 0;
    });

    // Each body has 6 DOFs
    const totalDofs = this.bodies.size * 6;
    const degreesOfFreedom = Math.max(0, totalDofs - dofsRemoved);

    // Detect redundant constraints (simplified)
    // In real implementation, would use constraint graph analysis
    const redundantConstraints: string[] = [];
    const conflictingConstraints: string[] = [];

    return {
      isFullyConstrained: degreesOfFreedom === 0,
      redundantConstraints,
      conflictingConstraints,
      overdefinedCount: Math.max(0, dofsRemoved - totalDofs),
      undefinedDegreesOfFreedom: degreesOfFreedom,
    };
  }

  /**
   * Get constraint status message
   */
  getStatusMessage(): string {
    const status = this.analyzeConstraints();

    if (status.isFullyConstrained) {
      return '✓ Fully Constrained';
    } else if (status.undefinedDegreesOfFreedom > 0) {
      return `⚠ Under-Constrained (${status.undefinedDegreesOfFreedom} DOF)`;
    } else if (status.overdefinedCount > 0) {
      return `✕ Over-Constrained (${status.overdefinedCount} redundant constraints)`;
    }
    return 'OK';
  }

  /**
   * Clear all constraints
   */
  clear(): void {
    this.constraints.clear();
    this.bodies.clear();
    this.constraintIndex = 0;
  }

  /**
   * Export constraints as JSON
   */
  toJSON(): string {
    return JSON.stringify({
      constraints: Array.from(this.constraints.values()),
      bodies: Array.from(this.bodies),
      status: this.analyzeConstraints(),
    });
  }

  /**
   * Import constraints from JSON
   */
  fromJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.clear();

      if (data.constraints && Array.isArray(data.constraints)) {
        data.constraints.forEach((c: AssemblyConstraint) => {
          this.constraints.set(c.id, c);
        });
      }

      if (data.bodies && Array.isArray(data.bodies)) {
        data.bodies.forEach((b: string) => {
          this.bodies.add(b);
        });
      }

      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// EXPLODED VIEW MANAGER
// ============================================================================

export class ExplodedViewManager {
  private views: Map<string, ExplodedView> = new Map();
  private viewIndex: number = 0;

  /**
   * Create an exploded view
   */
  createView(name: string = 'Exploded View'): string {
    const view: ExplodedView = {
      id: `exploded_${this.viewIndex++}`,
      name,
      bodyTransforms: new Map(),
      distance: 50,
      direction: [1, 1, 1],
      timestamp: Date.now(),
    };

    this.views.set(view.id, view);
    return view.id;
  }

  /**
   * Set explode distance for a body in a view
   */
  setBodyTransform(
    viewId: string,
    bodyId: string,
    tx: number,
    ty: number,
    tz: number,
    rx: number = 0,
    ry: number = 0,
    rz: number = 0
  ): boolean {
    const view = this.views.get(viewId);
    if (!view) return false;

    view.bodyTransforms.set(bodyId, { tx, ty, tz, rx, ry, rz });
    return true;
  }

  /**
   * Get exploded view
   */
  getView(id: string): ExplodedView | undefined {
    return this.views.get(id);
  }

  /**
   * Get all exploded views
   */
  getAllViews(): ExplodedView[] {
    return Array.from(this.views.values());
  }

  /**
   * Delete exploded view
   */
  deleteView(id: string): boolean {
    return this.views.delete(id);
  }

  /**
   * Clear all views
   */
  clear(): void {
    this.views.clear();
    this.viewIndex = 0;
  }
}
