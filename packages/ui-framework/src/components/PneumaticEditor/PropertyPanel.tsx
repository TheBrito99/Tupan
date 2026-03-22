import React from 'react';
import { PneumaticComponent } from './types';
import styles from './PneumaticEditor.module.css';

interface PropertyPanelProps {
  selectedComponent: PneumaticComponent | null;
  onComponentUpdate: (id: string, updates: Partial<PneumaticComponent>) => void;
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
      {selectedComponent.type === 'compressor' && (
        <div className={styles.propertySection}>
          <h4>Compressor Parameters</h4>
          <div className={styles.propertyField}>
            <label>Displacement (m³/rev)</label>
            <input
              type="number"
              value={selectedComponent.parameters.displacement || 50}
              onChange={(e) => handleParameterChange('displacement', parseFloat(e.target.value))}
              min="1"
              step="5"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Speed (rpm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.speed || 1500}
              onChange={(e) => handleParameterChange('speed', parseFloat(e.target.value))}
              min="100"
              step="100"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Efficiency (0-1)</label>
            <input
              type="number"
              value={selectedComponent.parameters.efficiency || 0.85}
              onChange={(e) => handleParameterChange('efficiency', parseFloat(e.target.value))}
              min="0"
              max="1"
              step="0.05"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'tank' && (
        <div className={styles.propertySection}>
          <h4>Tank Parameters</h4>
          <div className={styles.propertyField}>
            <label>Volume (L)</label>
            <input
              type="number"
              value={selectedComponent.parameters.volume || 100}
              onChange={(e) => handleParameterChange('volume', parseFloat(e.target.value))}
              min="10"
              step="10"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Temperature (K)</label>
            <input
              type="number"
              value={selectedComponent.parameters.temperature || 288}
              onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
              min="273"
              step="1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'motor' && (
        <div className={styles.propertySection}>
          <h4>Motor Parameters</h4>
          <div className={styles.propertyField}>
            <label>Displacement (m³/rev)</label>
            <input
              type="number"
              value={selectedComponent.parameters.displacement || 10}
              onChange={(e) => handleParameterChange('displacement', parseFloat(e.target.value))}
              min="0.5"
              step="1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Load Torque (N·m)</label>
            <input
              type="number"
              value={selectedComponent.parameters.load_torque || 50}
              onChange={(e) => handleParameterChange('load_torque', parseFloat(e.target.value))}
              min="0"
              step="10"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'cylinder' && (
        <div className={styles.propertySection}>
          <h4>Cylinder Parameters</h4>
          <div className={styles.propertyField}>
            <label>Bore Diameter (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.bore_diameter || 32}
              onChange={(e) => handleParameterChange('bore_diameter', parseFloat(e.target.value))}
              min="10"
              step="1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Rod Diameter (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.rod_diameter || 16}
              onChange={(e) => handleParameterChange('rod_diameter', parseFloat(e.target.value))}
              min="3"
              step="1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Stroke (mm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.stroke || 100}
              onChange={(e) => handleParameterChange('stroke', parseFloat(e.target.value))}
              min="10"
              step="10"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Load (N)</label>
            <input
              type="number"
              value={selectedComponent.parameters.load || 1000}
              onChange={(e) => handleParameterChange('load', parseFloat(e.target.value))}
              min="0"
              step="100"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'valve' && (
        <div className={styles.propertySection}>
          <h4>Valve Parameters</h4>
          <div className={styles.propertyField}>
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
          <div className={styles.propertyField}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 100}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="10"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Cracking Pressure (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.cracking_pressure || 3}
              onChange={(e) => handleParameterChange('cracking_pressure', parseFloat(e.target.value))}
              min="0.5"
              step="0.5"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'filter' && (
        <div className={styles.propertySection}>
          <h4>Filter Parameters</h4>
          <div className={styles.propertyField}>
            <label>Micron Rating (μm)</label>
            <input
              type="number"
              value={selectedComponent.parameters.micron_rating || 10}
              onChange={(e) => handleParameterChange('micron_rating', parseFloat(e.target.value))}
              min="1"
              step="1"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 150}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="10"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Pressure Drop Factor</label>
            <input
              type="number"
              value={selectedComponent.parameters.pressure_drop_factor || 1.0}
              onChange={(e) => handleParameterChange('pressure_drop_factor', parseFloat(e.target.value))}
              min="0.5"
              max="3"
              step="0.1"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'regulator' && (
        <div className={styles.propertySection}>
          <h4>Regulator Parameters</h4>
          <div className={styles.propertyField}>
            <label>Set Pressure (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.set_pressure || 6}
              onChange={(e) => handleParameterChange('set_pressure', parseFloat(e.target.value))}
              min="0.5"
              step="0.5"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 200}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="10"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'muffler' && (
        <div className={styles.propertySection}>
          <h4>Muffler Parameters</h4>
          <div className={styles.propertyField}>
            <label>Flow Capacity (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow_capacity || 100}
              onChange={(e) => handleParameterChange('flow_capacity', parseFloat(e.target.value))}
              min="1"
              step="10"
            />
          </div>
          <div className={styles.propertyField}>
            <label>Noise Reduction (dB)</label>
            <input
              type="number"
              value={selectedComponent.parameters.noise_reduction || 20}
              onChange={(e) => handleParameterChange('noise_reduction', parseFloat(e.target.value))}
              min="0"
              step="5"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'pressure-source' && (
        <div className={styles.propertySection}>
          <h4>Pressure Source Parameters</h4>
          <div className={styles.propertyField}>
            <label>Pressure (bar)</label>
            <input
              type="number"
              value={selectedComponent.parameters.pressure || 6}
              onChange={(e) => handleParameterChange('pressure', parseFloat(e.target.value))}
              min="0.1"
              step="0.5"
            />
          </div>
        </div>
      )}

      {selectedComponent.type === 'flow-source' && (
        <div className={styles.propertySection}>
          <h4>Flow Source Parameters</h4>
          <div className={styles.propertyField}>
            <label>Flow (L/min)</label>
            <input
              type="number"
              value={selectedComponent.parameters.flow || 50}
              onChange={(e) => handleParameterChange('flow', parseFloat(e.target.value))}
              min="0.1"
              step="1"
            />
          </div>
        </div>
      )}
    </div>
  );
};
