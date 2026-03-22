import React from 'react';
import { HydraulicComponent } from './types';
import styles from './HydraulicEditor.module.css';

interface PropertyPanelProps {
  selectedComponent: HydraulicComponent | null;
  onComponentUpdate: (id: string, updates: Partial<HydraulicComponent>) => void;
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
      {selectedComponent.type === 'pump' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Displacement (cm³/rev)</label>
            <input
              type="number"
              value={selectedComponent.parameters.displacement || 10}
              onChange={(e) => handleParameterChange('displacement', parseFloat(e.target.value))}
              min="0.1"
              step="1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Speed (rpm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.speed || 1500}
              onChange={(e) => handleParameterChange('speed', parseFloat(e.target.value))}
              min="100"
              step="100"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Efficiency (0-1)</label>
            <input
              type="number"
              value={selectedComponent.parameters.efficiency || 0.9}
              onChange={(e) => handleParameterChange('efficiency', parseFloat(e.target.value))}
              min="0"
              max="1"
              step="0.05"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'motor' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Displacement (cm³/rev)</label>
            <input
              type="number"
              value={selectedComponent.parameters.displacement || 5}
              onChange={(e) => handleParameterChange('displacement', parseFloat(e.target.value))}
              min="0.1"
              step="0.5"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Speed (rpm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.speed || 1000}
              onChange={(e) => handleParameterChange('speed', parseFloat(e.target.value))}
              min="100"
              step="100"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Load Torque (N·m)</label>
            <input
              type="number"
              value={selectedComponent.parameters.load_torque || 100}
              onChange={(e) => handleParameterChange('load_torque', parseFloat(e.target.value))}
              min="0"
              step="10"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'accumulator' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Volume (L)</label>
            <input
              type="number"
              value={selectedComponent.parameters.volume || 1.0}
              onChange={(e) => handleParameterChange('volume', parseFloat(e.target.value))}
              min="0.1"
              step="0.1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Precharge (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.precharge || 5.0}
              onChange={(e) => handleParameterChange('precharge', parseFloat(e.target.value))}
              min="0.1"
              step="0.5"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Max Pressure (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.max_pressure || 250}
              onChange={(e) => handleParameterChange('max_pressure', parseFloat(e.target.value))}
              min="10"
              step="10"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'pipe' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Length (m)</label>
            <input
              type="number"
              value={selectedComponent.parameters.length || 1.0}
              onChange={(e) => handleParameterChange('length', parseFloat(e.target.value))}
              min="0.1"
              step="0.1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Diameter (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.diameter || 12.7}
              onChange={(e) => handleParameterChange('diameter', parseFloat(e.target.value))}
              min="1"
              step="1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Roughness (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.roughness || 0.045}
              onChange={(e) => handleParameterChange('roughness', parseFloat(e.target.value))}
              min="0.01"
              step="0.01"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'valve' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Spool Position (-1 to +1)</label>
            <input
              type="number"
              value={selectedComponent.parameters.spool_position || 0}
              onChange={(e) => handleParameterChange('spool_position', parseFloat(e.target.value))}
              min="-1"
              max="1"
              step="0.1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 60}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="5"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Cracking Pressure (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.cracking_pressure || 20}
              onChange={(e) => handleParameterChange('cracking_pressure', parseFloat(e.target.value))}
              min="1"
              step="1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'cylinder' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Bore Diameter (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.bore_diameter || 50}
              onChange={(e) => handleParameterChange('bore_diameter', parseFloat(e.target.value))}
              min="5"
              step="1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Rod Diameter (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.rod_diameter || 32}
              onChange={(e) => handleParameterChange('rod_diameter', parseFloat(e.target.value))}
              min="3"
              step="1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Stroke (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.stroke || 500}
              onChange={(e) => handleParameterChange('stroke', parseFloat(e.target.value))}
              min="10"
              step="10"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Load (N)</label>
            <input
              type="number"
              value={selectedComponent.parameters.load || 5000}
              onChange={(e) => handleParameterChange('load', parseFloat(e.target.value))}
              min="0"
              step="100"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'filter' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Micron Rating (μm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.micron_rating || 10}
              onChange={(e) => handleParameterChange('micron_rating', parseFloat(e.target.value))}
              min="1"
              step="1"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 100}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="5"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Clogging Factor</label>
            <input
              type="number"
              value={selectedComponent.parameters.clogging_factor || 1.0}
              onChange={(e) => handleParameterChange('clogging_factor', parseFloat(e.target.value))}
              min="0.5"
              max="2"
              step="0.1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'pressure-source' && (
        <div className={styles.propertyGroup}>
          <label>Pressure (bar)</label>
          <input
            type="number"
            value={selectedComponent.parameters.pressure || 210}
            onChange={(e) => handleParameterChange('pressure', parseFloat(e.target.value))}
            min="1"
            step="10"
          />
        </div>
      )}

      {selectedComponent.type === 'flow-source' && (
        <div className={styles.propertyGroup}>
          <label>Flow (L/min)</label>
          <input
            type="number"
            value={selectedComponent.parameters.flow || 30}
            onChange={(e) => handleParameterChange('flow', parseFloat(e.target.value))}
            min="0.1"
            step="1"
          />
        </div>
      )}

      {selectedComponent.type === 'tank' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Volume (L)</label>
            <input
              type="number"
              value={selectedComponent.parameters.volume || 100}
              onChange={(e) => handleParameterChange('volume', parseFloat(e.target.value))}
              min="10"
              step="10"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Temperature (K)</label>
            <input
              type="number"
              value={selectedComponent.parameters.temperature || 313}
              onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
              min="273"
              step="1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'check-valve' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Cracking Pressure (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.cracking_pressure || 5}
              onChange={(e) => handleParameterChange('cracking_pressure', parseFloat(e.target.value))}
              min="0.1"
              step="0.5"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 60}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="5"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'relief-valve' && (
        <div>
          <div className={styles.propertyGroup}>
            <label>Set Pressure (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.set_pressure || 250}
              onChange={(e) => handleParameterChange('set_pressure', parseFloat(e.target.value))}
              min="10"
              step="10"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 100}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="5"
            />
          </div>
          <div className={styles.propertyGroup}>
            <label>Hysteresis (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.hysteresis || 10}
              onChange={(e) => handleParameterChange('hysteresis', parseFloat(e.target.value))}
              min="1"
              step="1"
            />
          </div>
        </div>
      )}
    </div>
  );
};
