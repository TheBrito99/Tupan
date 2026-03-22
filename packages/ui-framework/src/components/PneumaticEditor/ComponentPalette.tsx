import React from 'react';
import { PneumaticComponentType, COMPONENT_PROPERTIES } from './types';
import styles from './PneumaticEditor.module.css';

interface ComponentPaletteProps {
  onComponentSelect: (type: PneumaticComponentType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onComponentSelect }) => {
  const componentTypes: PneumaticComponentType[] = [
    'compressor',
    'tank',
    'valve',
    'motor',
    'cylinder',
    'filter',
    'regulator',
    'muffler',
    'pressure-source',
    'flow-source',
  ];

  return (
    <div className={styles.palette}>
      <h3>Pneumatic Components</h3>

      <div className={styles.paletteGrid}>
        {componentTypes.map((type) => {
          const props = COMPONENT_PROPERTIES[type];
          return (
            <button
              key={type}
              className={styles.paletteButton}
              onClick={() => onComponentSelect(type)}
              title={props.description}
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
        <h4>Component Info</h4>
        <ul>
          <li>
            <strong>Compressor:</strong> Air source for pneumatic system
          </li>
          <li>
            <strong>Tank:</strong> Pressurized air storage
          </li>
          <li>
            <strong>Valve:</strong> Flow direction and pressure control
          </li>
          <li>
            <strong>Motor:</strong> Converts air pressure to rotational motion
          </li>
          <li>
            <strong>Cylinder:</strong> Linear actuator with bore and rod
          </li>
          <li>
            <strong>Filter:</strong> Removes contaminants from air
          </li>
          <li>
            <strong>Regulator:</strong> Controls system pressure
          </li>
          <li>
            <strong>Muffler:</strong> Reduces exhaust noise
          </li>
          <li>
            <strong>Pressure Source:</strong> Ideal pressure (ideal pump)
          </li>
          <li>
            <strong>Flow Source:</strong> Ideal flow (ideal pump)
          </li>
        </ul>
      </div>
    </div>
  );
};
