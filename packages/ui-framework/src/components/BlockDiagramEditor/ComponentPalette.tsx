/**
 * Block Diagram Component Palette
 *
 * Displays available block types organized by category
 */

import React from 'react';
import { BlockDiagramComponentType, COMPONENT_PROPERTIES } from './types';
import styles from './BlockDiagramEditor.module.css';

interface ComponentPaletteProps {
  onComponentSelect: (type: BlockDiagramComponentType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onComponentSelect }) => {
  const blockTypes: BlockDiagramComponentType[] = [
    'transfer-function',
    'integrator',
    'differentiator',
    'gain',
    'sum',
    'product',
    'pid-controller',
    'lead-lag-filter',
    'low-pass-filter',
    'high-pass-filter',
    'step-source',
    'ramp-source',
    'sine-source',
    'saturation',
    'deadzone',
    'hysteresis',
    'multiplexer',
    'demultiplexer',
    'scope',
  ];

  // Group by category
  const categories = {
    'Transfer Functions': ['transfer-function', 'integrator', 'differentiator'],
    'Math Operations': ['gain', 'sum', 'product'],
    'Control': ['pid-controller', 'lead-lag-filter'],
    Filters: ['low-pass-filter', 'high-pass-filter'],
    Sources: ['step-source', 'ramp-source', 'sine-source'],
    Nonlinear: ['saturation', 'deadzone', 'hysteresis'],
    Routing: ['multiplexer', 'demultiplexer'],
    Visualization: ['scope'],
  };

  return (
    <div className={styles.palette}>
      <h3>Block Library</h3>

      <div className={styles.paletteGrid}>
        {blockTypes.map((type) => {
          const props = COMPONENT_PROPERTIES[type];
          return (
            <button
              key={type}
              className={styles.paletteButton}
              onClick={() => onComponentSelect(type)}
              title={props.description}
              style={{ borderLeftColor: props.color }}
            >
              <div
                className={styles.paletteIcon}
                style={{ backgroundColor: props.color }}
              >
                {props.icon}
              </div>
              <span>{props.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.paletteInfo}>
        <h4>Block Categories</h4>
        <ul>
          {Object.entries(categories).map(([category, blocks]) => (
            <li key={category}>
              <strong>{category}:</strong> {blocks.map((b) => COMPONENT_PROPERTIES[b as BlockDiagramComponentType].label).join(', ')}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.paletteHelp}>
        <p>
          <strong>Drag blocks</strong> onto the canvas. <strong>Right-click</strong> connections to draw wires.
        </p>
      </div>
    </div>
  );
};
