/**
 * Property Panel Component
 *
 * Displays and allows editing of selected element parameters
 */

import React, { useState, useEffect } from 'react';
import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';
import GyratorInfo from './GyratorInfo';
import NonlinearInfo from './NonlinearInfo';
import ModulatedTransformerInfo from './ModulatedTransformerInfo';
import CausalityVisualizationInfo from './CausalityVisualizationInfo';
import InteractiveCausalityDebugger from './InteractiveCausalityDebugger';
import OptimizationPanel from './OptimizationPanel';
import styles from './BondGraphEditor.module.css';

interface PropertyPanelProps {
  selectedElement: EditorElement | null;
  onParameterChange?: (elementId: string, parameters: Record<string, number>) => void;
  disabled?: boolean;
  elements?: EditorElement[];
  bonds?: EditorBond[];
  causalities?: Map<string, CausalityStatus>;
  onOptimizationApplied?: (optimizedCausalities: Map<string, CausalityStatus>) => void;
}

const PARAMETER_CONFIGS: Record<string, Array<{ key: string; label: string; unit: string; min: number; max: number }>> = {
  'Se': [
    { key: 'effort', label: 'Effort', unit: 'V/K/N', min: -1000, max: 1000 },
  ],
  'Sf': [
    { key: 'flow', label: 'Flow', unit: 'A/W/m/s', min: -1000, max: 1000 },
  ],
  'R': [
    { key: 'resistance', label: 'Resistance', unit: 'Ω/K-W/N-s-m', min: 0.001, max: 1e6 },
  ],
  'C': [
    { key: 'capacitance', label: 'Capacitance', unit: 'F/J-K/m-N', min: 0.001, max: 1000 },
    { key: 'initial_charge', label: 'Initial Charge', unit: 'C/J/m-N', min: 0, max: 1000 },
  ],
  'I': [
    { key: 'inertance', label: 'Inertance', unit: 'H/kg', min: 0.001, max: 1000 },
    { key: 'initial_momentum', label: 'Initial Momentum', unit: 'Wb/kg-m-s', min: 0, max: 1000 },
  ],
  'TF': [
    { key: 'ratio', label: 'Transformer Ratio', unit: 'unitless', min: 0.001, max: 1000 },
  ],
  'GY': [
    { key: 'ratio', label: 'Gyration Ratio', unit: 'unitless', min: 0.001, max: 1000 },
  ],
};

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElement,
  onParameterChange,
  disabled = false,
  elements = [],
  bonds = [],
  causalities = new Map(),
  onOptimizationApplied,
}) => {
  const [parameters, setParameters] = useState<Record<string, number>>({});
  const [causalityViewMode, setCausalityViewMode] = useState<'analysis' | 'debugger' | 'optimization'>('analysis');

  useEffect(() => {
    if (selectedElement?.parameters) {
      setParameters(selectedElement.parameters as Record<string, number>);
    } else {
      setParameters({});
    }
  }, [selectedElement]);

  const handleParameterChange = (key: string, value: number) => {
    const newParams = { ...parameters, [key]: value };
    setParameters(newParams);

    if (selectedElement) {
      onParameterChange?.(selectedElement.id, newParams);
    }
  };

  if (!selectedElement) {
    return (
      <div className={styles.propertyPanel}>
        <div className={styles.propertyHeader}>
          <h3>Properties</h3>
        </div>
        <div className={styles.propertyContent}>
          <p style={{ color: '#999', textAlign: 'center' }}>Select an element to view properties</p>
        </div>
      </div>
    );
  }

  const configs = PARAMETER_CONFIGS[selectedElement.type] || [];

  return (
    <div className={styles.propertyPanel}>
      <div className={styles.propertyHeader}>
        <h3>Properties</h3>
      </div>
      <div className={styles.propertyContent}>
        <div className={styles.propertyField}>
          <label>Type</label>
          <input
            type="text"
            value={selectedElement.type}
            readOnly
            className={styles.propertyInput}
            disabled={true}
          />
        </div>

        <div className={styles.propertyField}>
          <label>ID</label>
          <input
            type="text"
            value={selectedElement.id}
            readOnly
            className={styles.propertyInput}
            disabled={true}
          />
        </div>

        <div className={styles.propertyField}>
          <label>Name</label>
          <input
            type="text"
            value={selectedElement.name || ''}
            className={styles.propertyInput}
            disabled={disabled}
          />
        </div>

        <div className={styles.propertyDivider} />

        <div className={styles.propertyLabel}>
          <strong>Parameters</strong>
        </div>

        {configs.length === 0 ? (
          <p style={{ color: '#999', fontSize: '12px' }}>No parameters for this element type</p>
        ) : (
          configs.map((config) => (
            <div key={config.key} className={styles.propertyField}>
              <label>{config.label}</label>
              <div className={styles.propertyInputWithUnit}>
                <input
                  type="number"
                  value={parameters[config.key] ?? 0}
                  onChange={(e) => handleParameterChange(config.key, parseFloat(e.target.value))}
                  min={config.min}
                  max={config.max}
                  step="any"
                  className={styles.propertyInput}
                  disabled={disabled}
                />
                <span className={styles.propertyUnit}>{config.unit}</span>
              </div>
            </div>
          ))
        )}

        <div className={styles.propertyDivider} />

        <div className={styles.propertyField}>
          <label>Position</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: '#666' }}>X</label>
              <input
                type="number"
                value={selectedElement.x.toFixed(1)}
                readOnly
                className={styles.propertyInput}
                disabled={true}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: '#666' }}>Y</label>
              <input
                type="number"
                value={selectedElement.y.toFixed(1)}
                readOnly
                className={styles.propertyInput}
                disabled={true}
              />
            </div>
          </div>
        </div>

        {/* Gyrator-specific information */}
        {selectedElement.type === 'GY' && (
          <GyratorInfo
            element={selectedElement}
            onDomainChange={(source, target) => {
              // Can be extended to handle domain tracking
              console.log(`Gyrator coupling: ${source} ↔ ${target}`);
            }}
          />
        )}

        {/* Nonlinear behavior (available for R, C, I, TF, GY) */}
        {['R', 'C', 'I', 'TF', 'GY'].includes(selectedElement.type) && (
          <NonlinearInfo
            element={selectedElement}
            onAddNonlinearity={(nonlinear) => {
              console.log(`Added nonlinearity: ${nonlinear.behavior}`);
              // Can be extended to track nonlinearities in state
            }}
            onRemoveNonlinearity={(behavior) => {
              console.log(`Removed nonlinearity: ${behavior}`);
            }}
          />
        )}

        {/* Modulated transformer (available for TF elements) */}
        {selectedElement.type === 'TF' && (
          <ModulatedTransformerInfo
            element={selectedElement}
            onAddModulation={(modulated) => {
              console.log(`Added modulation: ${modulated.modulation_type}`);
              // Can be extended to track modulations in state
            }}
            onRemoveModulation={() => {
              console.log('Removed modulation');
            }}
          />
        )}

        <div className={styles.propertyDivider} />

        {/* Causality analysis and debugger (available for all elements if bonds exist) */}
        {(elements?.length ?? 0) > 0 && (bonds?.length ?? 0) > 0 && (
          <div>
            {/* Tab toggles */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '12px',
                borderBottom: '1px solid #ddd',
              }}
            >
              <button
                onClick={() => setCausalityViewMode('analysis')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: causalityViewMode === 'analysis' ? '#2196F3' : 'transparent',
                  color: causalityViewMode === 'analysis' ? '#fff' : '#666',
                  border: 'none',
                  borderBottom:
                    causalityViewMode === 'analysis' ? '2px solid #2196F3' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                📊 Analysis
              </button>
              <button
                onClick={() => setCausalityViewMode('debugger')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: causalityViewMode === 'debugger' ? '#2196F3' : 'transparent',
                  color: causalityViewMode === 'debugger' ? '#fff' : '#666',
                  border: 'none',
                  borderBottom:
                    causalityViewMode === 'debugger' ? '2px solid #2196F3' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                🔍 Debugger
              </button>
              <button
                onClick={() => setCausalityViewMode('optimization')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: causalityViewMode === 'optimization' ? '#2196F3' : 'transparent',
                  color: causalityViewMode === 'optimization' ? '#fff' : '#666',
                  border: 'none',
                  borderBottom:
                    causalityViewMode === 'optimization' ? '2px solid #2196F3' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                ⚡ Optimize
              </button>
            </div>

            {/* Content */}
            {causalityViewMode === 'analysis' ? (
              <CausalityVisualizationInfo
                element={selectedElement}
                elements={elements || []}
                bonds={bonds || []}
                onCausalityAnalyzed={(result) => {
                  console.log('Causality analysis complete:', result);
                }}
              />
            ) : causalityViewMode === 'debugger' ? (
              <InteractiveCausalityDebugger
                elements={elements || []}
                bonds={bonds || []}
                onCausalityComplete={(causalities) => {
                  console.log('Causality assignment complete:', causalities);
                }}
                onDebuggerStateChange={(state) => {
                  console.log('Debugger state:', state);
                }}
              />
            ) : (
              <OptimizationPanel
                elements={elements || []}
                bonds={bonds || []}
                causalities={causalities}
                onApplyOptimization={onOptimizationApplied}
                onOptimizationChange={(summary) => {
                  console.log('Optimization analysis complete:', summary);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyPanel;
