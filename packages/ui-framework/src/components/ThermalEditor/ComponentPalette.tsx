import React from 'react';
import { ThermalComponentType, COMPONENT_PROPERTIES } from './types';
import styles from './ThermalEditor.module.css';

interface ComponentPaletteProps {
  onAddComponent: (type: ThermalComponentType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onAddComponent }) => {
  const componentTypes: ThermalComponentType[] = [
    'heat-source',
    'temperature-source',
    'thermal-resistance',
    'thermal-capacitance',
    'ambient',
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
        <h4>Thermal Components</h4>
        <ul>
          <li>
            <strong>Heat Source:</strong> Fixed power input (W)
          </li>
          <li>
            <strong>Temperature Source:</strong> Fixed temperature boundary (K)
          </li>
          <li>
            <strong>Thermal Resistance:</strong> Heat flow resistance (K/W)
          </li>
          <li>
            <strong>Thermal Capacitance:</strong> Transient energy storage (J/K)
          </li>
          <li>
            <strong>Ambient:</strong> Reference temperature (typically 300K)
          </li>
        </ul>
      </div>
    </div>
  );
};
