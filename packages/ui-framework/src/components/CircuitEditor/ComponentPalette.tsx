/**
 * Circuit Editor Component Palette
 *
 * Displays available electrical components organized by category
 */

import React from 'react';
import { CircuitComponentType, COMPONENT_PROPERTIES } from './types';
import styles from './CircuitEditor.module.css';

interface ComponentPaletteProps {
  onComponentAdd: (type: CircuitComponentType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onComponentAdd }) => {
  const componentTypes: CircuitComponentType[] = [
    'resistor',
    'capacitor',
    'inductor',
    'voltage-source',
    'current-source',
    'ground',
    'wire',
    'op-amp',
    'switch',
    'diode',
    'transformer',
  ];

  // Group by category
  const categories = {
    'Passive': ['resistor', 'capacitor', 'inductor'],
    'Sources': ['voltage-source', 'current-source'],
    'Reference': ['ground', 'wire'],
    'Active': ['op-amp', 'switch', 'diode', 'transformer'],
  };

  return (
    <div className={styles.palette}>
      <h3>Component Library</h3>

      <div className={styles.paletteGrid}>
        {componentTypes.map((type) => {
          const props = COMPONENT_PROPERTIES[type];
          return (
            <button
              key={type}
              className={styles.paletteButton}
              onClick={() => onComponentAdd(type)}
              title={props.description}
              style={{ borderLeftColor: props.color }}
            >
              <div
                className={styles.paletteIcon}
                style={{ backgroundColor: props.color }}
              >
                {props.icon}
              </div>
              <span>{props.name}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.paletteInfo}>
        <h4>Component Categories</h4>
        <ul>
          {Object.entries(categories).map(([category, components]) => (
            <li key={category}>
              <strong>{category}:</strong> {components.map((c) => COMPONENT_PROPERTIES[c as CircuitComponentType].name).join(', ')}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.paletteHelp}>
        <p>
          <strong>Click a component</strong> to add it to the circuit. <strong>Connect</strong> components by wiring their terminals.
        </p>
      </div>
    </div>
  );
};

export default ComponentPalette;
