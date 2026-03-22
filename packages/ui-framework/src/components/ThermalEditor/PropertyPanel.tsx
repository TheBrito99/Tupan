import React from 'react';
import { ThermalComponent, COMPONENT_PROPERTIES } from './types';
import styles from './ThermalEditor.module.css';

interface PropertyPanelProps {
  selectedComponent: ThermalComponent | null;
  onComponentUpdate: (id: string, updates: Partial<ThermalComponent>) => void;
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
        <p className={styles.placeholder}>Select a component to edit</p>
      </div>
    );
  }

  const props = COMPONENT_PROPERTIES[selectedComponent.type as keyof typeof COMPONENT_PROPERTIES];

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onComponentUpdate(selectedComponent.id, { name: e.target.value });
  };

  const handleParameterChange = (key: string, value: number | string) => {
    onComponentUpdate(selectedComponent.id, {
      parameters: {
        ...selectedComponent.parameters,
        [key]: typeof value === 'string' ? parseFloat(value) || 0 : value,
      },
    });
  };

  return (
    <div className={styles.propertyPanel}>
      <h3>Properties</h3>

      {/* Component identification */}
      <div className={styles.propertySection}>
        <label>
          <strong>Name:</strong>
          <input
            type="text"
            value={selectedComponent.name}
            onChange={handleNameChange}
            className={styles.input}
          />
        </label>

        <label>
          <strong>Type:</strong>
          <span className={styles.readOnly}>{props.label}</span>
        </label>

        <label>
          <strong>ID:</strong>
          <span className={styles.readOnly} style={{ fontSize: '0.8em', fontFamily: 'monospace' }}>
            {selectedComponent.id.slice(0, 8)}
          </span>
        </label>
      </div>

      {/* Component-specific parameters */}
      <div className={styles.propertySection}>
        <strong>Parameters</strong>

        {selectedComponent.type === 'heat-source' && (
          <label>
            <span>Power (W):</span>
            <input
              type="number"
              value={selectedComponent.parameters.power || 0}
              onChange={(e) => handleParameterChange('power', e.target.value)}
              step="0.1"
              className={styles.input}
            />
          </label>
        )}

        {selectedComponent.type === 'temperature-source' && (
          <label>
            <span>Temperature (K):</span>
            <input
              type="number"
              value={selectedComponent.parameters.temperature || 300}
              onChange={(e) => handleParameterChange('temperature', e.target.value)}
              step="0.1"
              min="0"
              className={styles.input}
            />
          </label>
        )}

        {selectedComponent.type === 'thermal-resistance' && (
          <label>
            <span>Resistance (K/W):</span>
            <input
              type="number"
              value={selectedComponent.parameters.resistance || 0.1}
              onChange={(e) => handleParameterChange('resistance', e.target.value)}
              step="0.01"
              min="0.001"
              className={styles.input}
            />
            <span className={styles.unit}>Thermal resistance to heat flow</span>
          </label>
        )}

        {selectedComponent.type === 'thermal-capacitance' && (
          <label>
            <span>Capacitance (J/K):</span>
            <input
              type="number"
              value={selectedComponent.parameters.capacity || 1000}
              onChange={(e) => handleParameterChange('capacity', e.target.value)}
              step="1"
              min="1"
              className={styles.input}
            />
            <span className={styles.unit}>Thermal energy storage per degree</span>
          </label>
        )}

        {selectedComponent.type === 'ambient' && (
          <label>
            <span>Reference Temp (K):</span>
            <input
              type="number"
              value={selectedComponent.parameters.temperature || 300}
              onChange={(e) => handleParameterChange('temperature', e.target.value)}
              step="0.1"
              min="0"
              className={styles.input}
            />
            <span className={styles.unit}>Ambient environment temperature</span>
          </label>
        )}
      </div>

      {/* Position information */}
      <div className={styles.propertySection}>
        <strong>Position</strong>
        <label>
          <span>X:</span>
          <input
            type="number"
            value={Math.round(selectedComponent.position.x)}
            onChange={(e) =>
              onComponentUpdate(selectedComponent.id, {
                position: {
                  ...selectedComponent.position,
                  x: parseInt(e.target.value) || 0,
                },
              })
            }
            className={styles.input}
            step="10"
          />
          <span>px</span>
        </label>

        <label>
          <span>Y:</span>
          <input
            type="number"
            value={Math.round(selectedComponent.position.y)}
            onChange={(e) =>
              onComponentUpdate(selectedComponent.id, {
                position: {
                  ...selectedComponent.position,
                  y: parseInt(e.target.value) || 0,
                },
              })
            }
            className={styles.input}
            step="10"
          />
          <span>px</span>
        </label>
      </div>

      {/* Delete button */}
      <div className={styles.propertySection}>
        <button
          className={styles.deleteButton}
          onClick={() => onComponentDelete(selectedComponent.id)}
        >
          Delete Component
        </button>
      </div>
    </div>
  );
};
