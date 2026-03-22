import React from 'react';
import { MechanicalComponent } from './types';
import styles from './MechanicalEditor.module.css';

interface PropertyPanelProps {
  selectedComponent: MechanicalComponent | null;
  onComponentUpdate: (id: string, updates: Partial<MechanicalComponent>) => void;
  onComponentDelete: (id: string) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedComponent,
  onComponentUpdate,
  onComponentDelete,
}) => {
  if (!selectedComponent) {
    return (
      <div className={styles.propertyPanel}>
        <h3>Properties</h3>
        <p className={styles.placeholder}>Select a component to view properties</p>
      </div>
    );
  }

  const handleNameChange = (name: string) => {
    onComponentUpdate(selectedComponent.id, { name });
  };

  const handleParameterChange = (key: string, value: number | string) => {
    onComponentUpdate(selectedComponent.id, {
      parameters: {
        ...selectedComponent.parameters,
        [key]: value,
      },
    });
  };

  const handlePositionChange = (coord: 'x' | 'y', value: number) => {
    onComponentUpdate(selectedComponent.id, {
      position: {
        ...selectedComponent.position,
        [coord]: value,
      },
    });
  };

  const handleDelete = () => {
    onComponentDelete(selectedComponent.id);
  };

  return (
    <div className={styles.propertyPanel}>
      <div className={styles.propertyHeader}>
        <h3>Properties</h3>
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          title="Delete component"
        >
          ✕
        </button>
      </div>

      {/* Basic properties */}
      <div className={styles.propertyGroup}>
        <label>Name</label>
        <input
          type="text"
          value={selectedComponent.name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      <div className={styles.propertyGroup}>
        <label>Type</label>
        <input
          type="text"
          value={selectedComponent.type}
          disabled
          style={{ opacity: 0.6 }}
        />
      </div>

      <div className={styles.propertyGroup}>
        <label>ID</label>
        <input
          type="text"
          value={selectedComponent.id}
          disabled
          style={{ opacity: 0.6, fontSize: '11px' }}
        />
      </div>

      {/* Position */}
      <div className={styles.propertyGroup}>
        <label>Position (pixels)</label>
        <div className={styles.positionInputs}>
          <div>
            <label style={{ fontSize: '12px' }}>X</label>
            <input
              type="number"
              value={Math.round(selectedComponent.position.x)}
              onChange={(e) => handlePositionChange('x', parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px' }}>Y</label>
            <input
              type="number"
              value={Math.round(selectedComponent.position.y)}
              onChange={(e) => handlePositionChange('y', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Component-specific parameters */}
      {selectedComponent.type === 'mass' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Mass (kg)</label>
            <input
              type="number"
              value={selectedComponent.parameters.mass || 1.0}
              onChange={(e) => handleParameterChange('mass', parseFloat(e.target.value))}
              min="0.01"
              step="0.1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Inertia (kg·m²)</label>
            <input
              type="number"
              value={selectedComponent.parameters.inertia || 0.1}
              onChange={(e) => handleParameterChange('inertia', parseFloat(e.target.value))}
              min="0"
              step="0.01"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'spring' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Stiffness (N/m)</label>
            <input
              type="number"
              value={selectedComponent.parameters.stiffness || 100}
              onChange={(e) => handleParameterChange('stiffness', parseFloat(e.target.value))}
              min="0.1"
              step="10"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Natural Length (m)</label>
            <input
              type="number"
              value={selectedComponent.parameters.natural_length || 0.1}
              onChange={(e) => handleParameterChange('natural_length', parseFloat(e.target.value))}
              min="0"
              step="0.01"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'damper' && (
        <div className={styles.propertyGroup}>
          <label>Damping (N·s/m)</label>
          <input
            type="number"
            value={selectedComponent.parameters.damping || 1.0}
            onChange={(e) => handleParameterChange('damping', parseFloat(e.target.value))}
            min="0"
            step="0.1"
          />
        </div>
      )}

      {selectedComponent.type === 'force-source' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Force (N)</label>
            <input
              type="number"
              value={selectedComponent.parameters.force || 0}
              onChange={(e) => handleParameterChange('force', parseFloat(e.target.value))}
              step="1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Direction (degrees)</label>
            <input
              type="number"
              value={selectedComponent.parameters.direction || 0}
              onChange={(e) => handleParameterChange('direction', parseFloat(e.target.value))}
              min="0"
              max="360"
              step="15"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'velocity-source' && (
        <div className={styles.propertyGroup}>
          <label>Velocity (m/s)</label>
          <input
            type="number"
            value={selectedComponent.parameters.velocity || 0}
            onChange={(e) => handleParameterChange('velocity', parseFloat(e.target.value))}
            step="0.1"
          />
        </div>
      )}

      {selectedComponent.type === 'joint' && (
        <div className={styles.propertyGroup}>
          <label>Joint Type</label>
          <select
            value={selectedComponent.parameters.joint_type || 'revolute'}
            onChange={(e) => handleParameterChange('joint_type', e.target.value)}
          >
            <option value="revolute">Revolute (Hinge)</option>
            <option value="prismatic">Prismatic (Slide)</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
      )}

      {selectedComponent.type === 'constraint' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Constraint Type</label>
            <select
              value={selectedComponent.parameters.constraint_type || 'distance'}
              onChange={(e) => handleParameterChange('constraint_type', e.target.value)}
            >
              <option value="distance">Distance</option>
              <option value="angle">Angle</option>
              <option value="parallel">Parallel</option>
              <option value="perpendicular">Perpendicular</option>
            </select>
          </div>
          <div className={styles.propertyGroup}>
            <label>Value</label>
            <input
              type="number"
              value={selectedComponent.parameters.constraint_value || 0}
              onChange={(e) => handleParameterChange('constraint_value', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
        </div>
      )}
    </div>
  );
};
