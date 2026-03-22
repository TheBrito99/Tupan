/**
 * Circuit diagram integration for LaTeX documents
 * Allows seamless insertion and reference to circuit schematics
 */

import React, { useState } from 'react';
import styles from './CircuitIntegration.module.css';

export interface CircuitDiagram {
  id: string;
  name: string;
  description: string;
  tikzCode?: string;
  svgCode?: string;
  category: 'basic' | 'rl' | 'rc' | 'rlc' | 'amplifier' | 'filter' | 'power' | 'custom';
}

/**
 * Pre-built circuit templates for quick insertion
 */
export const CIRCUIT_TEMPLATES: CircuitDiagram[] = [
  {
    id: 'simple-resistor',
    name: 'Simple Resistor',
    description: 'Basic series resistor circuit',
    category: 'basic',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (1,0) -- (1.5,0) node[resistor] {} -- (2.5,0) -- (3,0);
  \draw (0,0) to (0,-1) node[battery] {} -- (3,-1) -- (3,0);
\end{tikzpicture}
`,
    svgCode: `<svg viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg">
  <line x1="10" y1="50" x2="100" y2="50" stroke="black" stroke-width="2"/>
  <rect x="100" y="45" width="40" height="10" fill="none" stroke="black" stroke-width="2"/>
  <line x1="140" y1="50" x2="230" y2="50" stroke="black" stroke-width="2"/>
  <line x1="230" y1="50" x2="230" y2="70" stroke="black" stroke-width="2"/>
  <polygon points="230,70 225,65 235,65" fill="black"/>
  <line x1="10" y1="50" x2="10" y2="80" stroke="black" stroke-width="2"/>
  <line x1="10" y1="80" x2="230" y2="80" stroke="black" stroke-width="2"/>
  <circle cx="20" cy="80" r="8" fill="none" stroke="black" stroke-width="2"/>
  <line x1="20" y1="72" x2="20" y2="76" stroke="black" stroke-width="1.5"/>
</svg>`,
  },
  {
    id: 'rc-circuit',
    name: 'RC Circuit',
    description: 'Resistor-Capacitor series circuit',
    category: 'rc',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (2,0) node[resistor] (R) {} to (4,0);
  \draw (4,0) to (4,-1.5) node[capacitor] (C) {} to (4,-3);
  \draw (4,-3) to (0,-3) node[battery] (V) {} to (0,0);
\end{tikzpicture}
`,
  },
  {
    id: 'rl-circuit',
    name: 'RL Circuit',
    description: 'Resistor-Inductor series circuit',
    category: 'rl',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (2,0) node[resistor] (R) {} to (4,0);
  \draw (4,0) to (4,-1.5) node[inductor] (L) {} to (4,-3);
  \draw (4,-3) to (0,-3) node[battery] (V) {} to (0,0);
\end{tikzpicture}
`,
  },
  {
    id: 'voltage-divider',
    name: 'Voltage Divider',
    description: 'Resistive voltage divider circuit',
    category: 'basic',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (0,3);
  \draw (0,3) to (2,3) node[resistor] (R1) {} to (2,0);
  \draw (2,0) to (2,-1) node[resistor] (R2) {} to (2,-3);
  \draw (2,-3) to (0,-3);
  \draw (0,-3) to (0,-4) node[battery] {} to (0,-5);
  \draw (0,-5) to (2,-5) to (2,0);
  \draw[dashed] (2,-1) to (3,-1) node[right] {$V_{out}$};
\end{tikzpicture}
`,
  },
  {
    id: 'common-emitter',
    name: 'Common Emitter Amplifier',
    description: 'Basic BJT amplifier configuration',
    category: 'amplifier',
    tikzCode: String.raw`
\begin{tikzpicture}[scale=0.8]
  \draw (0,0) to (2,0) node[resistor] (Rc) {} to (2,2);
  \draw (2,2) to (2,3) node[battery, anchor=south] (Vcc) {$V_{cc}$} to (2,4);
  \draw (2,3) to (4,3) to (4,1.5);
  \draw (3,1) circle (0.5);
  \draw[fill] (3.5,1.5) circle (0.1);
  \draw[fill] (3.5,0.5) circle (0.1);
  \draw (3.5,0.5) to (3.5,-0.5) to (2,-0.5) node[resistor] (Re) {};
\end{tikzpicture}
`,
  },
  {
    id: 'lc-resonance',
    name: 'LC Resonant Circuit',
    description: 'Series LC resonance circuit',
    category: 'rlc',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (2,0) node[inductor] (L) {} to (4,0);
  \draw (4,0) to (4,-1.5) node[capacitor] (C) {} to (4,-3);
  \draw (4,-3) to (0,-3) node[battery] (V) {} to (0,0);
  \draw[dashed] (2,-1.5) node[right] {$f_0 = \frac{1}{2\pi\sqrt{LC}}$};
\end{tikzpicture}
`,
  },
  {
    id: 'low-pass-filter',
    name: 'RC Low-Pass Filter',
    description: 'RC low-pass filter with cutoff frequency',
    category: 'filter',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (1.5,0) node[resistor] (R) {} to (3,0);
  \draw (3,0) to (3,-1) node[capacitor] (C) {} to (3,-2);
  \draw (3,-2) to (0,-2) to (0,0);
  \draw[dashed] (3,0.5) node[right] {$f_c = \frac{1}{2\pi RC}$};
\end{tikzpicture}
`,
  },
  {
    id: 'high-pass-filter',
    name: 'RC High-Pass Filter',
    description: 'RC high-pass filter configuration',
    category: 'filter',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (1.5,0) node[capacitor] (C) {} to (3,0);
  \draw (3,0) to (3,-1) node[resistor] (R) {} to (3,-2);
  \draw (3,-2) to (0,-2) to (0,0);
  \draw[dashed] (3.5,0) node[right] {$f_c = \frac{1}{2\pi RC}$};
\end{tikzpicture}
`,
  },
  {
    id: 'parallel-rlc',
    name: 'Parallel RLC Circuit',
    description: 'Parallel resonance circuit',
    category: 'rlc',
    tikzCode: String.raw`
\begin{tikzpicture}
  \draw (0,0) to (3,0);
  \draw (3,0) to (4,0) to (4,-1) node[resistor] (R) {} to (4,-2) to (3,-2) to (0,-2);
  \draw (3,0) to (3,-1) node[inductor] (L) {} to (3,-2);
  \draw (3,0) to (2,-0.5) to (2,-1.5) node[capacitor] (C) {} to (3,-2);
\end{tikzpicture}
`,
  },
];

export interface CircuitIntegrationProps {
  onInsertCircuit: (diagram: CircuitDiagram, insertType: 'tikz' | 'figure' | 'reference') => void;
}

/**
 * Circuit insertion panel with templates and preview
 */
export const CircuitIntegration: React.FC<CircuitIntegrationProps> = ({ onInsertCircuit }) => {
  const [selectedCategory, setSelectedCategory] = useState<CircuitDiagram['category']>('basic');
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitDiagram>(CIRCUIT_TEMPLATES[0]);
  const [insertType, setInsertType] = useState<'tikz' | 'figure' | 'reference'>('figure');

  const filteredCircuits = CIRCUIT_TEMPLATES.filter((circuit) => circuit.category === selectedCategory);

  const categories = Array.from(new Set(CIRCUIT_TEMPLATES.map((c) => c.category)));

  return (
    <div className={styles.circuitPanel}>
      <h3>Circuit Diagrams</h3>

      <div className={styles.categoryTabs}>
        {categories.map((category) => (
          <button
            key={category}
            className={`${styles.categoryTab} ${selectedCategory === category ? styles.categoryTabActive : ''}`}
            onClick={() => {
              setSelectedCategory(category);
              setSelectedCircuit(
                filteredCircuits[0] || CIRCUIT_TEMPLATES.find((c) => c.category === category) || CIRCUIT_TEMPLATES[0]
              );
            }}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.circuitList}>
        {filteredCircuits.map((circuit) => (
          <button
            key={circuit.id}
            className={`${styles.circuitItem} ${selectedCircuit.id === circuit.id ? styles.circuitItemActive : ''}`}
            onClick={() => setSelectedCircuit(circuit)}
          >
            <span className={styles.circuitName}>{circuit.name}</span>
            <span className={styles.circuitDesc}>{circuit.description}</span>
          </button>
        ))}
      </div>

      <div className={styles.preview}>
        <h4>Preview</h4>
        {selectedCircuit.svgCode ? (
          <div
            className={styles.svgPreview}
            dangerouslySetInnerHTML={{ __html: selectedCircuit.svgCode }}
          />
        ) : (
          <div className={styles.noPreview}>SVG preview not available for this circuit</div>
        )}
      </div>

      <div className={styles.insertOptions}>
        <label className={styles.insertTypeLabel}>
          <input
            type="radio"
            value="figure"
            checked={insertType === 'figure'}
            onChange={(e) => setInsertType(e.target.value as 'tikz' | 'figure' | 'reference')}
          />
          Insert as figure
        </label>
        <label className={styles.insertTypeLabel}>
          <input
            type="radio"
            value="tikz"
            checked={insertType === 'tikz'}
            onChange={(e) => setInsertType(e.target.value as 'tikz' | 'figure' | 'reference')}
            disabled={!selectedCircuit.tikzCode}
          />
          Insert TikZ code
        </label>
        <label className={styles.insertTypeLabel}>
          <input
            type="radio"
            value="reference"
            checked={insertType === 'reference'}
            onChange={(e) => setInsertType(e.target.value as 'tikz' | 'figure' | 'reference')}
          />
          Insert reference
        </label>
      </div>

      <button
        className={styles.insertButton}
        onClick={() => onInsertCircuit(selectedCircuit, insertType)}
      >
        Insert Circuit
      </button>
    </div>
  );
};

/**
 * Generate LaTeX code for circuit insertion
 */
export function generateCircuitLatex(diagram: CircuitDiagram, insertType: 'tikz' | 'figure' | 'reference'): string {
  switch (insertType) {
    case 'tikz':
      return diagram.tikzCode || '';

    case 'figure':
      return String.raw`
\begin{figure}[h]
\centering
\caption{` + diagram.name + String.raw`}
` + (diagram.tikzCode || '') + String.raw`
\label{fig:` + diagram.id + String.raw`}
\end{figure}
`;

    case 'reference':
      return `See Figure~\\ref{fig:${diagram.id}} for the ${diagram.description}.`;

    default:
      return '';
  }
}
