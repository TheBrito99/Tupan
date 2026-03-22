/**
 * Assembly Constraints Panel
 * Phase 17.5: Advanced Features
 *
 * UI for managing assembly constraints and relationships
 */

import React, { useState } from 'react';
import type { AssemblyConstraint, ConstraintType, AssemblyEntity } from '../../cad/assembly-constraints';
import { AssemblyConstraintManager } from '../../cad/assembly-constraints';
import styles from './AssemblyConstraintsPanel.module.css';

// ============================================================================
// TYPES
// ============================================================================

interface AssemblyConstraintsPanelProps {
  constraintManager: AssemblyConstraintManager;
  onConstraintAdded?: (constraintId: string) => void;
  onConstraintDeleted?: (constraintId: string) => void;
  readOnly?: boolean;
}

interface ConstraintFormState {
  name: string;
  type: ConstraintType;
  value?: number;
  unit: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AssemblyConstraintsPanel: React.FC<AssemblyConstraintsPanelProps> = ({
  constraintManager,
  onConstraintAdded,
  onConstraintDeleted,
  readOnly = false,
}) => {
  const [constraints, setConstraints] = useState<AssemblyConstraint[]>(
    constraintManager.getAllConstraints()
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<ConstraintFormState>({
    name: 'New Constraint',
    type: 'Coincident',
    value: 0,
    unit: 'mm',
  });

  const status = constraintManager.analyzeConstraints();

  const handleEdit = (constraintId: string) => {
    const constraint = constraintManager.getConstraint(constraintId);
    if (constraint && constraint.value !== undefined) {
      setEditingId(constraintId);
      setEditValue(constraint.value.toString());
    }
  };

  const handleSaveEdit = (constraintId: string) => {
    const newValue = parseFloat(editValue);
    if (!isNaN(newValue)) {
      constraintManager.updateConstraintValue(constraintId, newValue);
      setConstraints(constraintManager.getAllConstraints());
    }
    setEditingId(null);
  };

  const handleDelete = (constraintId: string) => {
    constraintManager.deleteConstraint(constraintId);
    setConstraints(constraintManager.getAllConstraints());
    onConstraintDeleted?.(constraintId);
  };

  const handleSuppressToggle = (constraintId: string) => {
    const constraint = constraintManager.getConstraint(constraintId);
    if (!constraint) return;

    if (constraint.isSupressed) {
      constraintManager.unsuppressConstraint(constraintId);
    } else {
      constraintManager.suppressConstraint(constraintId);
    }
    setConstraints(constraintManager.getAllConstraints());
  };

  const handleAddConstraint = () => {
    // Placeholder - would need proper entity selection UI
    const entity1: AssemblyEntity = {
      bodyId: 'body_0',
      featureId: 'feature_0',
      entityType: 'Face',
      entityId: 'face_0',
      name: 'Face 1',
    };

    const constraintId = constraintManager.createConstraint(
      formState.name,
      formState.type,
      entity1,
      undefined,
      formState.value,
      formState.unit
    );

    setConstraints(constraintManager.getAllConstraints());
    onConstraintAdded?.(constraintId);
    setShowForm(false);
    setFormState({
      name: 'New Constraint',
      type: 'Coincident',
      value: 0,
      unit: 'mm',
    });
  };

  const constraintTypeIcons: Record<ConstraintType, string> = {
    Coincident: '📌',
    Parallel: '↔️',
    Perpendicular: '⟂',
    Tangent: '⌘',
    Distance: '📏',
    Angle: '∠',
    Fixed: '🔒',
    Gear: '⚙️',
    Belt: '🔗',
    Chain: '⛓️',
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Assembly Constraints</h3>
        <div className={styles.status} title={`Assembly status: ${status.undefinedDegreesOfFreedom} DOF remaining`}>
          <span className={status.isFullyConstrained ? styles.statusOk : styles.statusWarning}>
            {constraintManager.getStatusMessage()}
          </span>
        </div>
      </div>

      {/* Constraint Status */}
      <div className={styles.statusBox}>
        <div className={styles.statusItem}>
          <span>Bodies:</span>
          <strong>{Array.from(new Set(constraints.map((c) => c.entity1.bodyId))).length}</strong>
        </div>
        <div className={styles.statusItem}>
          <span>Constraints:</span>
          <strong>{constraints.length}</strong>
        </div>
        <div className={styles.statusItem}>
          <span>Degrees of Freedom:</span>
          <strong>{status.undefinedDegreesOfFreedom}</strong>
        </div>
      </div>

      {/* Constraints List */}
      <div className={styles.constraintsList}>
        {constraints.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No constraints yet</p>
            <small>Add constraints to define assembly relationships</small>
          </div>
        ) : (
          constraints.map((constraint) => (
            <div
              key={constraint.id}
              className={`${styles.constraintItem} ${constraint.isSupressed ? styles.suppressed : ''}`}
            >
              <div className={styles.constraintHeader}>
                <span className={styles.constraintIcon}>
                  {constraintTypeIcons[constraint.type]}
                </span>
                <div className={styles.constraintInfo}>
                  <div className={styles.constraintName}>{constraint.name}</div>
                  <div className={styles.constraintType}>{constraint.type}</div>
                </div>
                <div className={styles.constraintActions}>
                  {constraint.isSupressed && (
                    <span className={styles.suppressedBadge}>Suppressed</span>
                  )}
                </div>
              </div>

              {constraint.value !== undefined && (
                <div className={styles.constraintValue}>
                  {editingId === constraint.id ? (
                    <div className={styles.editInput}>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        step="0.1"
                      />
                      <span>{constraint.unit}</span>
                      <button
                        className={styles.saveButton}
                        onClick={() => handleSaveEdit(constraint.id)}
                      >
                        ✓
                      </button>
                      <button
                        className={styles.cancelButton}
                        onClick={() => setEditingId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      className={styles.valueDisplay}
                      onClick={() => handleEdit(constraint.id)}
                    >
                      {constraint.value.toFixed(2)} {constraint.unit}
                    </span>
                  )}
                </div>
              )}

              <div className={styles.constraintFooter}>
                <button
                  className={styles.suppressButton}
                  onClick={() => handleSuppressToggle(constraint.id)}
                  title={constraint.isSupressed ? 'Unsuppress constraint' : 'Suppress constraint'}
                >
                  {constraint.isSupressed ? '👁️' : '👁️'}
                </button>
                {!readOnly && (
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDelete(constraint.id)}
                    title="Delete constraint"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Constraint Form */}
      {!readOnly && (
        <div className={styles.footer}>
          {!showForm ? (
            <button className={styles.addButton} onClick={() => setShowForm(true)}>
              ➕ Add Constraint
            </button>
          ) : (
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Type:</label>
                <select
                  value={formState.type}
                  onChange={(e) => setFormState({ ...formState, type: e.target.value as ConstraintType })}
                >
                  <option value="Coincident">Coincident</option>
                  <option value="Parallel">Parallel</option>
                  <option value="Perpendicular">Perpendicular</option>
                  <option value="Tangent">Tangent</option>
                  <option value="Distance">Distance</option>
                  <option value="Angle">Angle</option>
                  <option value="Fixed">Fixed</option>
                  <option value="Gear">Gear</option>
                </select>
              </div>

              {(formState.type === 'Distance' || formState.type === 'Angle' || formState.type === 'Gear') && (
                <div className={styles.formGroup}>
                  <label>Value:</label>
                  <div className={styles.valueInput}>
                    <input
                      type="number"
                      value={formState.value || 0}
                      onChange={(e) => setFormState({ ...formState, value: parseFloat(e.target.value) })}
                      step="0.1"
                    />
                    {formState.type === 'Angle' ? '°' : formState.unit}
                  </div>
                </div>
              )}

              <div className={styles.formActions}>
                <button className={styles.cancelButton} onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button className={styles.createButton} onClick={handleAddConstraint}>
                  Create
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssemblyConstraintsPanel;
