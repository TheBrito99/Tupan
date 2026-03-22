/**
 * Property Panel Component
 * Phase 17.4: CAD Editor - Property Management
 *
 * Displays and allows editing of:
 * - Feature properties
 * - Sketch constraints
 * - Parameters
 * - Measurements
 */

import React, { useState } from 'react';
import type { Sketch, Feature, Constraint } from '../../cad/types';
import styles from './PropertyPanel.module.css';

interface PropertyPanelProps {
  activeSketch?: Sketch;
  selectedFeature?: Feature;
  parameters?: Record<string, number>;
  onParameterChange?: (name: string, value: number) => void;
  onConstraintEdit?: (constraintId: string, value: number) => void;
}

/**
 * Right panel for editing properties
 */
export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  activeSketch,
  selectedFeature,
  parameters = {},
  onParameterChange,
  onConstraintEdit,
}) => {
  const [editingConstraint, setEditingConstraint] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleConstraintEdit = (constraintId: string, currentValue?: number) => {
    setEditingConstraint(constraintId);
    setEditValue(currentValue?.toString() ?? '');
  };

  const handleConstraintSave = (constraintId: string) => {
    const value = parseFloat(editValue);
    if (!isNaN(value) && onConstraintEdit) {
      onConstraintEdit(constraintId, value);
    }
    setEditingConstraint(null);
  };

  const handleParameterEdit = (name: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && onParameterChange) {
      onParameterChange(name, numValue);
    }
  };

  return (
    <div className={styles.container}>
      {activeSketch ? (
        <>
          {/* Sketch Information */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Sketch Info</h4>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.label}>Name:</span>
                <span className={styles.value}>{activeSketch.name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Plane:</span>
                <span className={styles.value}>{activeSketch.plane}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Elements:</span>
                <span className={styles.value}>{activeSketch.elements.size}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Constraints:</span>
                <span className={styles.value}>{activeSketch.constraints.size}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Status:</span>
                <span className={styles.value}>
                  {activeSketch.is_profiled ? (
                    <span className={styles.statusOk}>✓ Closed</span>
                  ) : (
                    <span className={styles.statusWarn}>⚠ Open</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Constraints */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Constraints</h4>
            <div className={styles.constraintsList}>
              {Array.from(activeSketch.constraints.values()).map((constraint) => (
                <div key={constraint.id} className={styles.constraintItem}>
                  <div className={styles.constraintHeader}>
                    <span className={styles.constraintType}>{constraint.type}</span>
                    {constraint.is_driving ? (
                      <span className={styles.drivingBadge}>Driving</span>
                    ) : (
                      <span className={styles.referenceBadge}>Reference</span>
                    )}
                  </div>
                  {constraint.value !== undefined && (
                    <div className={styles.constraintValue}>
                      {editingConstraint === constraint.id ? (
                        <input
                          type="number"
                          className={styles.editInput}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleConstraintSave(constraint.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConstraintSave(constraint.id);
                            if (e.key === 'Escape') setEditingConstraint(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={styles.valueDisplay}
                          onClick={() =>
                            handleConstraintEdit(constraint.id, constraint.value)
                          }
                        >
                          = {constraint.value.toFixed(3)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : selectedFeature ? (
        <>
          {/* Feature Information */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Feature Info</h4>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.label}>Name:</span>
                <span className={styles.value}>{selectedFeature.name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Type:</span>
                <span className={styles.value}>{selectedFeature.feature_type?.type || 'Unknown'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Status:</span>
                <span className={styles.value}>
                  {selectedFeature.is_active ? (
                    <span className={styles.statusOk}>✓ Active</span>
                  ) : (
                    <span className={styles.statusWarn}>✕ Inactive</span>
                  )}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Suppressed:</span>
                <span className={styles.value}>
                  {selectedFeature.is_suppressed ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Feature Parameters */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Parameters</h4>
            <div className={styles.parametersList}>
              {Object.entries(parameters).map(([name, value]) => (
                <div key={name} className={styles.parameterItem}>
                  <label className={styles.paramLabel}>{name}</label>
                  <input
                    type="number"
                    className={styles.paramInput}
                    value={value}
                    onChange={(e) => handleParameterEdit(name, e.target.value)}
                    step="0.1"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>Select a sketch or feature to view properties</p>
        </div>
      )}
    </div>
  );
};

export default PropertyPanel;
