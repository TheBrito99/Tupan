/**
 * Block Diagram Property Panel
 *
 * Edit block parameters including transfer functions, gains, controller tuning
 */

import React from 'react';
import { BlockDiagramComponent } from './types';
import styles from './BlockDiagramEditor.module.css';

interface PropertyPanelProps {
  selectedComponent: BlockDiagramComponent | null;
  onComponentUpdate: (id: string, updates: Partial<BlockDiagramComponent>) => void;
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
        <p className={styles.placeholder}>Select a block to view properties</p>
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
          title="Delete block"
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
            value={selectedComponent.name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        <div className={styles.propertyField}>
          <label>Type</label>
          <input
            type="text"
            value={selectedComponent.type}
            disabled
            style={{ opacity: 0.6 }}
          />
        </div>

        <div className={styles.propertyField}>
          <label>ID</label>
          <input
            type="text"
            value={selectedComponent.id}
            disabled
            style={{ opacity: 0.6, fontSize: '11px' }}
          />
        </div>
      </div>

      {/* Position */}
      <div className={styles.propertySection}>
        <h4>Position (pixels)</h4>
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
      {selectedComponent.type === 'transfer-function' && (
        <div className={styles.propertySection}>
          <h4>Transfer Function</h4>
          <div className={styles.propertyField}>
            <label>Numerator</label>
            <input
              type="text"
              value={selectedComponent.parameters.numerator || '1'}
              onChange={(e) => handleParameterChange('numerator', e.target.value)}
              placeholder="e.g., 1 (constant or polynomial coefficients)"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Denominator</label>
            <input
              type="text"
              value={selectedComponent.parameters.denominator || '1 0.1'}
              onChange={(e) => handleParameterChange('denominator', e.target.value)}
              placeholder="e.g., 1 0.1 (highest degree first)"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'integrator' && (
        <div className={styles.propertySection}>
          <h4>Integrator Parameters</h4>
          <div className={styles.propertyField}>
            <label>Initial Condition</label>
            <input
              type="number"
              value={selectedComponent.parameters.initialCondition || 0}
              onChange={(e) => handleParameterChange('initialCondition', parseFloat(e.target.value))}
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'differentiator' && (
        <div className={styles.propertySection}>
          <h4>Differentiator Parameters</h4>
          <div className={styles.propertyField}>
            <label>Filter Coefficient</label>
            <input
              type="number"
              value={selectedComponent.parameters.filterCoefficient || 0.1}
              onChange={(e) => handleParameterChange('filterCoefficient', parseFloat(e.target.value))}
              min="0"
              max="1"
              step="0.1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'gain' && (
        <div className={styles.propertySection}>
          <h4>Gain Parameters</h4>
          <div className={styles.propertyField}>
            <label>Gain</label>
            <input
              type="number"
              value={selectedComponent.parameters.gain || 1}
              onChange={(e) => handleParameterChange('gain', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'pid-controller' && (
        <div className={styles.propertySection}>
          <h4>PID Parameters</h4>
          <div className={styles.propertyField}>
            <label>Proportional (Kp)</label>
            <input
              type="number"
              value={selectedComponent.parameters.kp || 1.0}
              onChange={(e) => handleParameterChange('kp', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Integral (Ki)</label>
            <input
              type="number"
              value={selectedComponent.parameters.ki || 0.1}
              onChange={(e) => handleParameterChange('ki', parseFloat(e.target.value))}
              step="0.01"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Derivative (Kd)</label>
            <input
              type="number"
              value={selectedComponent.parameters.kd || 0.01}
              onChange={(e) => handleParameterChange('kd', parseFloat(e.target.value))}
              step="0.01"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Integral Limit</label>
            <input
              type="number"
              value={selectedComponent.parameters.integralLimit || 10}
              onChange={(e) => handleParameterChange('integralLimit', parseFloat(e.target.value))}
              min="0"
              step="1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'saturation' && (
        <div className={styles.propertySection}>
          <h4>Saturation Parameters</h4>
          <div className={styles.propertyField}>
            <label>Min Value</label>
            <input
              type="number"
              value={selectedComponent.parameters.minValue || -10}
              onChange={(e) => handleParameterChange('minValue', parseFloat(e.target.value))}
              step="0.5"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Max Value</label>
            <input
              type="number"
              value={selectedComponent.parameters.maxValue || 10}
              onChange={(e) => handleParameterChange('maxValue', parseFloat(e.target.value))}
              step="0.5"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'deadzone' && (
        <div className={styles.propertySection}>
          <h4>Deadzone Parameters</h4>
          <div className={styles.propertyField}>
            <label>Lower Threshold</label>
            <input
              type="number"
              value={selectedComponent.parameters.lowerThreshold || -0.1}
              onChange={(e) => handleParameterChange('lowerThreshold', parseFloat(e.target.value))}
              step="0.01"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Upper Threshold</label>
            <input
              type="number"
              value={selectedComponent.parameters.upperThreshold || 0.1}
              onChange={(e) => handleParameterChange('upperThreshold', parseFloat(e.target.value))}
              step="0.01"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'sine-source' && (
        <div className={styles.propertySection}>
          <h4>Sine Wave Parameters</h4>
          <div className={styles.propertyField}>
            <label>Amplitude</label>
            <input
              type="number"
              value={selectedComponent.parameters.amplitude || 1}
              onChange={(e) => handleParameterChange('amplitude', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Frequency (Hz)</label>
            <input
              type="number"
              value={selectedComponent.parameters.frequency || 1}
              onChange={(e) => handleParameterChange('frequency', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Phase (rad)</label>
            <input
              type="number"
              value={selectedComponent.parameters.phase || 0}
              onChange={(e) => handleParameterChange('phase', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Offset</label>
            <input
              type="number"
              value={selectedComponent.parameters.offset || 0}
              onChange={(e) => handleParameterChange('offset', parseFloat(e.target.value))}
              step="0.1"
            />
          </div>
        </div>
      )}
    </div>
  );
};
