import React from 'react';
import { HydraulicComponentType, COMPONENT_PROPERTIES } from './types';
import styles from './HydraulicEditor.module.css';

interface ComponentPaletteProps {
  onAddComponent: (type: HydraulicComponentType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onAddComponent }) => {
  const componentTypes: HydraulicComponentType[] = [
    'pump',
    'motor',
    'accumulator',
    'pipe',
    'valve',
    'cylinder',
    'filter',
    'pressure-source',
    'flow-source',
    'tank',
    'check-valve',
    'relief-valve',
  ];

  return (
    <div className={styles.palette}>
      <h3>Components</h3>
      <div className={styles.paletteGrid}>
        {componentTypes.map((type) => {
          const props = COMPONENT_PROPERTIES[type];
          return (
            <button
              key={type}
              className={styles.paletteButton}
              onClick={() => onAddComponent(type)}
              title={props.description}
              style={{ borderColor: props.color }}
            >
              <div
                className={styles.paletteIcon}
                style={{ backgroundColor: props.color }}
              />
              <span>{props.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.paletteInfo}>
        <h4>Hydraulic Components</h4>
        <ul>
          <li>
            <strong>Pump:</strong> Flow generation (displacement, speed, efficiency)
          </li>
          <li>
            <strong>Motor:</strong> Energy conversion (displacement, speed, load torque)
          </li>
          <li>
            <strong>Accumulator:</strong> Energy storage (volume, precharge, max pressure)
          </li>
          <li>
            <strong>Pipe:</strong> Flow conduit with pressure drop (length, diameter, roughness)
          </li>
          <li>
            <strong>Valve:</strong> Directional control (spool, flow capacity, cracking pressure)
          </li>
          <li>
            <strong>Cylinder:</strong> Linear actuation (bore, rod diameter, stroke, load)
          </li>
          <li>
            <strong>Filter:</strong> Contamination removal (micron rating, flow capacity)
          </li>
          <li>
            <strong>Pressure Source:</strong> Constant pressure boundary
          </li>
          <li>
            <strong>Flow Source:</strong> Constant flow boundary
          </li>
          <li>
            <strong>Tank:</strong> Fluid reservoir at atmospheric pressure
          </li>
          <li>
            <strong>Check Valve:</strong> One-way valve (cracking pressure)
          </li>
          <li>
            <strong>Relief Valve:</strong> Overpressure protection (set pressure, hysteresis)
          </li>
        </ul>
      </div>
    </div>
  );
};
