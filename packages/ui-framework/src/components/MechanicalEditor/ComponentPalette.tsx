import React from 'react';
import { MechanicalComponentType, COMPONENT_PROPERTIES } from './types';
import styles from './MechanicalEditor.module.css';

interface ComponentPaletteProps {
  onAddComponent: (type: MechanicalComponentType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onAddComponent }) => {
  const componentTypes: MechanicalComponentType[] = [
    'mass',
    'spring',
    'damper',
    'force-source',
    'velocity-source',
    'ground',
    'joint',
    'constraint',
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
        <h4>Mechanical Components</h4>
        <ul>
          <li>
            <strong>Mass:</strong> Inertial element (kg)
          </li>
          <li>
            <strong>Spring:</strong> Elastic element (stiffness N/m)
          </li>
          <li>
            <strong>Damper:</strong> Energy dissipation (damping N·s/m)
          </li>
          <li>
            <strong>Force Source:</strong> Applied force input (N)
          </li>
          <li>
            <strong>Velocity Source:</strong> Prescribed motion (m/s)
          </li>
          <li>
            <strong>Ground:</strong> Fixed reference point
          </li>
          <li>
            <strong>Joint:</strong> Revolute or prismatic connection
          </li>
          <li>
            <strong>Constraint:</strong> Kinematic constraint (distance, angle)
          </li>
        </ul>
      </div>
    </div>
  );
};
