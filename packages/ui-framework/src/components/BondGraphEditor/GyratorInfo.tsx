/**
 * Gyrator Cross-Domain Coupling Visualization Component
 *
 * Displays information about domain couplings when a Gyrator element is selected
 */

import React from 'react';
import type { EditorElement } from './types';
import {
  DOMAINS,
  GYRATOR_EXAMPLES,
  validateGyratorCoupling,
  describeCoupling,
  getGyratorUnit,
  PhysicalDomain,
} from './domainMapping';
import styles from './BondGraphEditor.module.css';

interface GyratorInfoProps {
  element: EditorElement;
  onDomainChange?: (sourceDomain: PhysicalDomain, targetDomain: PhysicalDomain) => void;
}

/**
 * Display detailed Gyrator coupling information with domain indicators
 */
export const GyratorInfo: React.FC<GyratorInfoProps> = ({ element, onDomainChange }) => {
  const [sourceDomain, setSourceDomain] = React.useState<PhysicalDomain>('electrical');
  const [targetDomain, setTargetDomain] = React.useState<PhysicalDomain>('mechanical');
  const [showExamples, setShowExamples] = React.useState(true);

  const validation = validateGyratorCoupling(sourceDomain, targetDomain);
  const coupling = describeCoupling(sourceDomain, targetDomain);
  const unit = getGyratorUnit(sourceDomain, targetDomain);
  const sourceDomainInfo = DOMAINS[sourceDomain];
  const targetDomainInfo = DOMAINS[targetDomain];

  const handleSourceDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSource = e.target.value as PhysicalDomain;
    setSourceDomain(newSource);
    if (onDomainChange) {
      onDomainChange(newSource, targetDomain);
    }
  };

  const handleTargetDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value as PhysicalDomain;
    setTargetDomain(newTarget);
    if (onDomainChange) {
      onDomainChange(sourceDomain, newTarget);
    }
  };

  return (
    <div className={styles.gyratorInfo} style={{ marginTop: '16px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>🔄 Gyrator Cross-Domain Coupling</h4>

      {/* Domain Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', marginBottom: '12px' }}>
        {/* Source Domain */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#555' }}>
            Source Domain
          </label>
          <select
            value={sourceDomain}
            onChange={handleSourceDomainChange}
            style={{
              width: '100%',
              padding: '6px',
              border: `2px solid ${sourceDomainInfo.color}`,
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            {Object.entries(DOMAINS).map(([key, info]) => (
              <option key={key} value={key}>
                {info.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', padding: '4px', backgroundColor: '#f5f5f5', borderRadius: '2px' }}>
            <strong>{sourceDomainInfo.flowVariable}</strong>
            <br />
            {sourceDomainInfo.flowUnit}
          </div>
        </div>

        {/* Coupling Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#666' }}>
          ⇄
        </div>

        {/* Target Domain */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#555' }}>
            Target Domain
          </label>
          <select
            value={targetDomain}
            onChange={handleTargetDomainChange}
            style={{
              width: '100%',
              padding: '6px',
              border: `2px solid ${targetDomainInfo.color}`,
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            {Object.entries(DOMAINS).map(([key, info]) => (
              <option key={key} value={key}>
                {info.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', padding: '4px', backgroundColor: '#f5f5f5', borderRadius: '2px' }}>
            <strong>{targetDomainInfo.flowVariable}</strong>
            <br />
            {targetDomainInfo.flowUnit}
          </div>
        </div>
      </div>

      {/* Validation Status */}
      <div
        style={{
          padding: '8px',
          marginBottom: '12px',
          borderRadius: '4px',
          backgroundColor: validation.valid ? '#e8f5e9' : '#ffebee',
          color: validation.valid ? '#2e7d32' : '#c62828',
          fontSize: '12px',
          fontWeight: '600',
        }}
      >
        {validation.valid ? (
          <>✓ Valid coupling: {coupling}</>
        ) : (
          <>✗ {validation.reason}</>
        )}
      </div>

      {/* Gyration Ratio Information */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '8px', borderRadius: '4px', marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#555' }}>
          Gyration Ratio
        </label>
        <div style={{ fontSize: '12px', color: '#333' }}>
          Current: <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>{element.parameters?.ratio || 1.0}</code>
          <br />
          Unit: <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>{unit}</code>
        </div>
      </div>

      {/* Domain Effort/Flow Information */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px', fontSize: '11px' }}>
        <div style={{ backgroundColor: '#f0f0f0', padding: '8px', borderRadius: '4px' }}>
          <strong style={{ color: sourceDomainInfo.color }}>Source Effort:</strong>
          <br />
          {sourceDomainInfo.effortVariable} ({sourceDomainInfo.effortUnit})
        </div>
        <div style={{ backgroundColor: '#f0f0f0', padding: '8px', borderRadius: '4px' }}>
          <strong style={{ color: targetDomainInfo.color }}>Target Effort:</strong>
          <br />
          {targetDomainInfo.effortVariable} ({targetDomainInfo.effortUnit})
        </div>
      </div>

      {/* Examples Toggle */}
      <button
        onClick={() => setShowExamples(!showExamples)}
        style={{
          width: '100%',
          padding: '8px',
          marginBottom: '12px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          color: '#333',
        }}
      >
        {showExamples ? '▼' : '▶'} Real-World Examples
      </button>

      {/* Examples */}
      {showExamples && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {Object.entries(GYRATOR_EXAMPLES).map(([key, example]) => (
            <div
              key={key}
              style={{
                padding: '8px',
                backgroundColor: '#f9f9f9',
                border: `1px solid ${DOMAINS[example.sourceDomain].color}`,
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              <strong style={{ color: '#333' }}>{example.description}</strong>
              <br />
              <span style={{ color: '#666' }}>
                {example.realWorldExample}
              </span>
              <br />
              <code style={{ backgroundColor: '#fff', padding: '2px 4px', fontSize: '10px', color: '#999' }}>
                Ratio: {example.gyrationRatio} {example.gyrationUnit}
              </code>
            </div>
          ))}
        </div>
      )}

      {/* Physics Explanation */}
      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '12px', lineHeight: '1.6' }}>
        <strong style={{ color: '#1565c0' }}>⚙️ How Gyratos Work:</strong>
        <p style={{ margin: '6px 0 0 0', color: '#333' }}>
          A gyrator couples two different physical domains by transforming effort in one domain to flow in another:
          <br />
          <code style={{ display: 'block', marginTop: '4px', padding: '4px', backgroundColor: '#fff', borderRadius: '2px', color: '#d32f2f' }}>
            effort₁ ↔ ratio × flow₂
          </code>
        </p>
        <ul style={{ margin: '6px 0 0 16px', color: '#333' }}>
          <li><strong>Motor:</strong> Electrical voltage → Mechanical torque</li>
          <li><strong>Pump:</strong> Mechanical speed → Hydraulic flow</li>
          <li><strong>Solenoid:</strong> Electrical current → Magnetic flux</li>
          <li><strong>Peltier:</strong> Electrical current → Heat flow</li>
        </ul>
      </div>
    </div>
  );
};

export default GyratorInfo;
