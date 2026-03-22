/**
 * Circuit Editor Property Panel
 *
 * Edit component parameters including resistance, capacitance, voltage, etc.
 */

import React from 'react';
import { CircuitComponent } from './types';
import styles from './CircuitEditor.module.css';

interface PropertyPanelProps {
  component: CircuitComponent | undefined;
  onComponentUpdate: (component: CircuitComponent) => void;
  onComponentDelete: (componentId: string) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  component,
  onComponentUpdate,
  onComponentDelete,
}) => {
  if (!component) {
    return (
      <div className={styles.propertyPanel}>
        <h3>Properties</h3>
        <p className={styles.placeholder}>Select a component to view properties</p>
      </div>
    );
  }

  const handleNameChange = (name: string) => {
    onComponentUpdate({ ...component, name });
  };

  const handleParameterChange = (key: string, value: number | string | boolean) => {
    onComponentUpdate({
      ...component,
      parameters: {
        ...component.parameters,
        [key]: value,
      },
    });
  };

  const handleNodeChange = (node: 'node1' | 'node2', value: string) => {
    onComponentUpdate({
      ...component,
      [node]: value,
    });
  };

  const handleDelete = () => {
    onComponentDelete(component.id);
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
      <div className={styles.propertySection}>
        <h4>General</h4>
        <div className={styles.propertyField}>
          <label>Name</label>
          <input
            type="text"
            value={component.name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        <div className={styles.propertyField}>
          <label>Type</label>
          <input
            type="text"
            value={component.type}
            disabled
            style={{ opacity: 0.6 }}
          />
        </div>

        <div className={styles.propertyField}>
          <label>ID</label>
          <input
            type="text"
            value={component.id}
            disabled
            style={{ opacity: 0.6, fontSize: '11px' }}
          />
        </div>
      </div>

      {/* Nodes */}
      <div className={styles.propertySection}>
        <h4>Connections</h4>
        <div className={styles.propertyField}>
          <label>Node 1 (Positive)</label>
          <input
            type="text"
            value={component.node1}
            onChange={(e) => handleNodeChange('node1', e.target.value)}
          />
        </div>

        <div className={styles.propertyField}>
          <label>Node 2 (Negative)</label>
          <input
            type="text"
            value={component.node2}
            onChange={(e) => handleNodeChange('node2', e.target.value)}
          />
        </div>
      </div>

      {/* Resistor */}
      {component.type === 'resistor' && (
        <div className={styles.propertySection}>
          <h4>Resistor Parameters</h4>
          <div className={styles.propertyField}>
            <label>Resistance (Ω)</label>
            <input
              type="number"
              value={component.parameters.resistance || 1000}
              onChange={(e) => handleParameterChange('resistance', parseFloat(e.target.value))}
              step="100"
              min="0"
            />
          </div>
        </div>
      )}

      {/* Capacitor */}
      {component.type === 'capacitor' && (
        <div className={styles.propertySection}>
          <h4>Capacitor Parameters</h4>
          <div className={styles.propertyField}>
            <label>Capacitance (F)</label>
            <input
              type="number"
              value={component.parameters.capacitance || 1e-6}
              onChange={(e) => handleParameterChange('capacitance', parseFloat(e.target.value))}
              step="1e-6"
              min="0"
            />
          </div>
        </div>
      )}

      {/* Inductor */}
      {component.type === 'inductor' && (
        <div className={styles.propertySection}>
          <h4>Inductor Parameters</h4>
          <div className={styles.propertyField}>
            <label>Inductance (H)</label>
            <input
              type="number"
              value={component.parameters.inductance || 0.001}
              onChange={(e) => handleParameterChange('inductance', parseFloat(e.target.value))}
              step="0.001"
              min="0"
            />
          </div>
        </div>
      )}

      {/* Voltage Source */}
      {component.type === 'voltage-source' && (
        <div className={styles.propertySection}>
          <h4>Voltage Source Parameters</h4>
          <div className={styles.propertyField}>
            <label>Voltage (V)</label>
            <input
              type="number"
              value={component.parameters.voltage || 5.0}
              onChange={(e) => handleParameterChange('voltage', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
        </div>
      )}

      {/* Current Source */}
      {component.type === 'current-source' && (
        <div className={styles.propertySection}>
          <h4>Current Source Parameters</h4>
          <div className={styles.propertyField}>
            <label>Current (A)</label>
            <input
              type="number"
              value={component.parameters.current || 0.001}
              onChange={(e) => handleParameterChange('current', parseFloat(e.target.value))}
              step="0.001"
            />
          </div>
        </div>
      )}

      {/* Op-Amp */}
      {component.type === 'op-amp' && (
        <div className={styles.propertySection}>
          <h4>Op-Amp Parameters</h4>
          <div className={styles.propertyField}>
            <label>Open-Loop Gain</label>
            <input
              type="number"
              value={component.parameters.gain || 100000}
              onChange={(e) => handleParameterChange('gain', parseFloat(e.target.value))}
              step="1000"
              min="0"
            />
          </div>
        </div>
      )}

      {/* Switch */}
      {component.type === 'switch' && (
        <div className={styles.propertySection}>
          <h4>Switch Parameters</h4>
          <div className={styles.propertyField}>
            <label>
              <input
                type="checkbox"
                checked={component.parameters.isOpen || false}
                onChange={(e) => handleParameterChange('isOpen', e.target.checked)}
              />
              {' '}Open Circuit
            </label>
          </div>
        </div>
      )}

      {/* Diode */}
      {component.type === 'diode' && (
        <div className={styles.propertySection}>
          <h4>Diode Parameters</h4>
          <div className={styles.propertyField}>
            <label>Forward Voltage (V)</label>
            <input
              type="number"
              value={component.parameters.forwardVoltage || 0.7}
              onChange={(e) => handleParameterChange('forwardVoltage', parseFloat(e.target.value))}
              step="0.1"
              min="0"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Saturation Current (A)</label>
            <input
              type="number"
              value={component.parameters.saturationCurrent || 1e-12}
              onChange={(e) => handleParameterChange('saturationCurrent', parseFloat(e.target.value))}
              step="1e-12"
              min="0"
            />
          </div>
        </div>
      )}

      {/* Transformer */}
      {component.type === 'transformer' && (
        <div className={styles.propertySection}>
          <h4>Transformer Parameters</h4>
          <div className={styles.propertyField}>
            <label>Turns Ratio (Secondary/Primary)</label>
            <input
              type="number"
              value={component.parameters.ratio || 1.0}
              onChange={(e) => handleParameterChange('ratio', parseFloat(e.target.value))}
              step="0.1"
              min="0.01"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyPanel;
