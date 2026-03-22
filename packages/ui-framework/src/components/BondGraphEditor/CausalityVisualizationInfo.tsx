/**
 * Causality Visualization Information Panel
 *
 * Displays detailed causality analysis using SCAP algorithm:
 * - Step-by-step causality assignment with visual progress
 * - Conflict detection and resolution suggestions
 * - Critical path highlighting
 * - Derivative causality warnings
 * - Bond-by-bond status visualization
 */

import React, { useState } from 'react';
import type { EditorElement, EditorBond } from './types';
import {
  type CausalityAnalysisResult,
  type BondCausalityInfo,
  type CausalityStatus,
  analyzeCausality,
  getCausalityVisualizationColors,
  explainCausality,
} from './causalityAnalysis';
import styles from './BondGraphEditor.module.css';

interface CausalityVisualizationInfoProps {
  element: EditorElement;
  elements: EditorElement[];
  bonds: EditorBond[];
  onCausalityAnalyzed?: (result: CausalityAnalysisResult) => void;
}

const CausalityVisualizationInfo: React.FC<CausalityVisualizationInfoProps> = ({
  element,
  elements,
  bonds,
  onCausalityAnalyzed,
}) => {
  const [analysisResult, setAnalysisResult] = useState<CausalityAnalysisResult | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [expandedConflict, setExpandedConflict] = useState<number | null>(null);
  const [showBondDetails, setShowBondDetails] = useState(false);

  const handleAnalyzeCausality = () => {
    const result = analyzeCausality(elements, bonds);
    setAnalysisResult(result);
    onCausalityAnalyzed?.(result);
  };

  const colors = getCausalityVisualizationColors();

  const getStatusBadgeStyle = (status: CausalityStatus): React.CSSProperties => ({
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: colors[status] || '#999',
    marginLeft: '8px',
  });

  const getProgressBarStyle = (): React.CSSProperties => ({
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  });

  const getProgressFillStyle = (current: number, total: number): React.CSSProperties => ({
    height: '100%',
    width: `${total > 0 ? (current / total) * 100 : 0}%`,
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease',
  });

  if (!analysisResult) {
    return (
      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #ddd',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong>Causality Analysis</strong>
            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
              Analyze bond causality using SCAP algorithm
            </p>
          </div>
          <button
            onClick={handleAnalyzeCausality}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            Analyze
          </button>
        </div>
      </div>
    );
  }

  // Render analysis results
  const hasConflicts = analysisResult.conflicts.length > 0;
  const hasDerivatives = analysisResult.derivativeBonds > 0;

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: analysisResult.isValid ? '#f0f8f0' : '#fef0f0',
        borderRadius: '4px',
        border: `1px solid ${analysisResult.isValid ? '#4CAF50' : '#f44336'}`,
      }}
    >
      {/* Header with status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <strong>Causality Analysis</strong>
          <span style={getStatusBadgeStyle(analysisResult.isValid ? 'EffortOut' : 'Conflict')}>
            {analysisResult.isValid ? '✓ Valid' : '✗ Issues Found'}
          </span>
        </div>
        <button
          onClick={handleAnalyzeCausality}
          style={{
            padding: '4px 8px',
            backgroundColor: '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div
        style={{
          marginTop: '10px',
          padding: '8px',
          backgroundColor: '#fff',
          borderRadius: '3px',
          fontSize: '12px',
          color: '#333',
          borderLeft: `3px solid ${analysisResult.isValid ? '#4CAF50' : '#f44336'}`,
        }}
      >
        {analysisResult.summary}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
          Progress: {analysisResult.assignedBonds}/{analysisResult.totalBonds} bonds assigned
        </div>
        <div style={getProgressBarStyle()}>
          <div style={getProgressFillStyle(analysisResult.assignedBonds, analysisResult.totalBonds)} />
        </div>
      </div>

      {/* Statistics */}
      <div
        style={{
          marginTop: '12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        <div style={{ padding: '6px', backgroundColor: '#fff', borderRadius: '3px', fontSize: '11px' }}>
          <span style={{ color: '#666' }}>Assigned:</span>
          <span style={{ marginLeft: '4px', fontWeight: 'bold', color: '#4CAF50' }}>
            {analysisResult.assignedBonds}
          </span>
        </div>
        <div style={{ padding: '6px', backgroundColor: '#fff', borderRadius: '3px', fontSize: '11px' }}>
          <span style={{ color: '#666' }}>Unassigned:</span>
          <span style={{ marginLeft: '4px', fontWeight: 'bold', color: '#FFC107' }}>
            {analysisResult.unassignedBonds}
          </span>
        </div>
        <div style={{ padding: '6px', backgroundColor: '#fff', borderRadius: '3px', fontSize: '11px' }}>
          <span style={{ color: '#666' }}>Conflicts:</span>
          <span style={{ marginLeft: '4px', fontWeight: 'bold', color: '#f44336' }}>
            {analysisResult.conflictingBonds}
          </span>
        </div>
        <div style={{ padding: '6px', backgroundColor: '#fff', borderRadius: '3px', fontSize: '11px' }}>
          <span style={{ color: '#666' }}>Derivatives:</span>
          <span style={{ marginLeft: '4px', fontWeight: 'bold', color: '#FF9800' }}>
            {analysisResult.derivativeBonds}
          </span>
        </div>
      </div>

      {/* SCAP Steps */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #ddd',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', cursor: 'pointer' }} onClick={() => setExpandedStep(expandedStep === -1 ? null : -1)}>
          {expandedStep === -1 ? '▼' : '▶'} SCAP Algorithm Steps ({analysisResult.steps.length})
        </div>

        {expandedStep === -1 && (
          <div style={{ fontSize: '11px', color: '#333' }}>
            {analysisResult.steps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  padding: '6px',
                  backgroundColor: '#fff',
                  borderRadius: '3px',
                  marginBottom: '4px',
                  borderLeft: `3px solid ${step.status === 'complete' ? '#4CAF50' : '#FFC107'}`,
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>
                    {expandedStep === idx ? '▼' : '▶'} Step {step.step}: {step.name}
                  </span>
                  <span style={{ fontSize: '10px', color: '#999' }}>({step.bonds_assigned} bonds)</span>
                </div>

                {expandedStep === idx && (
                  <div style={{ marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid #e0e0e0' }}>
                    <p style={{ margin: '4px 0', color: '#666' }}>{step.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conflicts */}
      {hasConflicts && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #ddd',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '8px',
              cursor: 'pointer',
              color: '#f44336',
            }}
            onClick={() => setExpandedConflict(expandedConflict === -1 ? null : -1)}
          >
            {expandedConflict === -1 ? '▼' : '▶'} Issues Found ({analysisResult.conflicts.length})
          </div>

          {expandedConflict === -1 && (
            <div style={{ fontSize: '11px', color: '#333' }}>
              {analysisResult.conflicts.map((conflict, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px',
                    backgroundColor: '#fff',
                    borderRadius: '3px',
                    marginBottom: '6px',
                    borderLeft: `3px solid ${conflict.severity === 'error' ? '#f44336' : '#FF9800'}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedConflict(expandedConflict === idx ? null : idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', marginRight: '8px' }}>
                      {expandedConflict === idx ? '▼' : '▶'}
                    </span>
                    <span style={{ color: conflict.severity === 'error' ? '#f44336' : '#FF9800' }}>
                      {conflict.reason}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#999' }}>Bond {conflict.bond_id.slice(0, 8)}</span>
                  </div>

                  {expandedConflict === idx && (
                    <div style={{ marginTop: '6px', paddingLeft: '24px', borderLeft: '2px solid #e0e0e0' }}>
                      <p style={{ margin: '4px 0', color: '#666', fontSize: '10px' }}>{conflict.suggestion}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Derivative Warnings */}
      {hasDerivatives && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: '#fff3e0',
            borderRadius: '3px',
            borderLeft: '3px solid #FF9800',
            fontSize: '11px',
            color: '#666',
          }}
        >
          <span style={{ fontWeight: 'bold', color: '#FF9800' }}>⚠ Warning:</span> {analysisResult.derivativeBonds} bond(s) require
          derivatives (non-integral causality). Consider redesigning the system for integral causality.
        </div>
      )}

      {/* Bond Details */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #ddd',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '8px',
            cursor: 'pointer',
          }}
          onClick={() => setShowBondDetails(!showBondDetails)}
        >
          {showBondDetails ? '▼' : '▶'} Bond Details ({analysisResult.bondDetails.length})
        </div>

        {showBondDetails && (
          <div style={{ fontSize: '10px', color: '#333' }}>
            {analysisResult.bondDetails.slice(0, 10).map((bond) => (
              <div
                key={bond.bondId}
                style={{
                  padding: '6px',
                  backgroundColor: '#fff',
                  borderRadius: '3px',
                  marginBottom: '3px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 60px',
                  gap: '6px',
                  alignItems: 'center',
                  borderLeft: `3px solid ${colors[bond.status] || '#999'}`,
                }}
              >
                <span style={{ color: '#666' }}>
                  {bond.fromElementType} → {bond.toElementType}
                </span>
                <span
                  style={{
                    padding: '2px 4px',
                    backgroundColor: colors[bond.status] || '#999',
                    color: '#fff',
                    borderRadius: '2px',
                    textAlign: 'center',
                  }}
                >
                  {bond.status}
                </span>
                <span style={{ color: '#999', fontSize: '9px' }}>Step {bond.step}</span>
              </div>
            ))}
            {analysisResult.bondDetails.length > 10 && (
              <div style={{ padding: '6px', color: '#999', textAlign: 'center', fontSize: '11px' }}>
                ... and {analysisResult.bondDetails.length - 10} more bonds
              </div>
            )}
          </div>
        )}
      </div>

      {/* Physics Explanation */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #ddd',
          padding: '8px',
          backgroundColor: '#e3f2fd',
          borderRadius: '3px',
          fontSize: '11px',
          color: '#1565c0',
        }}
      >
        <strong>💡 Physics Note:</strong> Bond graph causality ensures correct model structure and determines which
        variables are independent. "Effort out" (EffortOut) means the element drives effort; "Flow out" (FlowOut) means it drives
        flow. Proper causality assignment is essential for valid simulation.
      </div>
    </div>
  );
};

export default CausalityVisualizationInfo;
