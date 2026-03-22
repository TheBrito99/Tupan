/**
 * Element Palette Component
 *
 * Shows available bond graph elements that can be added to the canvas
 */

import React from 'react';
import type { BondGraphElementType } from '@tupan/core-ts/wasm-bridge';
import type { PaletteItem } from './types';
import styles from './BondGraphEditor.module.css';

interface ElementPaletteProps {
  onSelectElement?: (type: BondGraphElementType) => void;
  disabled?: boolean;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'Se',
    label: 'Effort Source',
    icon: '◉',
    description: 'Voltage, Temperature, Force source',
    color: '#FF6B6B',
  },
  {
    type: 'Sf',
    label: 'Flow Source',
    icon: '◉',
    description: 'Current, Heat flow, Velocity source',
    color: '#4ECDC4',
  },
  {
    type: 'C',
    label: 'Capacitor',
    icon: '▭',
    description: 'Electrical C, Thermal C_th, Spring 1/k',
    color: '#FFE66D',
  },
  {
    type: 'I',
    label: 'Inductor',
    icon: '▭',
    description: 'Electrical L, Inertance m',
    color: '#95E1D3',
  },
  {
    type: 'R',
    label: 'Resistor',
    icon: '∿',
    description: 'Resistance, Thermal R_th, Damping b',
    color: '#F38181',
  },
  {
    type: 'TF',
    label: 'Transformer',
    icon: '▭',
    description: 'Power-conserving coupling',
    color: '#AA96DA',
  },
  {
    type: 'GY',
    label: 'Gyrator',
    icon: '▭',
    description: 'Cross-domain coupling',
    color: '#FCBAD3',
  },
  {
    type: 'Junction0',
    label: '0-Junction',
    icon: '●',
    description: 'Equal effort (Kirchhoff voltage law)',
    color: '#A8E6CF',
  },
  {
    type: 'Junction1',
    label: '1-Junction',
    icon: '●',
    description: 'Equal flow (Kirchhoff current law)',
    color: '#FFD3B6',
  },
];

export const ElementPalette: React.FC<ElementPaletteProps> = ({
  onSelectElement,
  disabled = false,
}) => {
  return (
    <div className={styles.elementPalette}>
      <div className={styles.paletteHeader}>
        <h3>Elements</h3>
      </div>
      <div className={styles.paletteGrid}>
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.type}
            className={styles.paletteItem}
            onClick={() => onSelectElement?.(item.type)}
            disabled={disabled}
            title={item.description}
            style={{ borderColor: item.color }}
          >
            <div className={styles.paletteItemIcon} style={{ color: item.color }}>
              {item.icon}
            </div>
            <div className={styles.paletteItemLabel}>{item.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ElementPalette;
