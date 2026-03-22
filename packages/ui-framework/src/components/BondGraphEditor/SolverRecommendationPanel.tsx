/**
 * Solver Recommendation Panel
 *
 * Displays causality-driven solver selection recommendations with:
 * - Recommended solver type
 * - Stiffness analysis
 * - Algebraic loop detection
 * - Performance estimates
 * - Parameter suggestions
 */

import React, { useState, useEffect } from 'react';
import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';
import {
  CausalityDrivenSolver,
  type SolverRecommendation,
  type SolverType,
} from './causalityDrivenSolver';
import styles from './BondGraphEditor.module.css';

interface SolverRecommendationPanelProps {
  elements: EditorElement[];
  bonds: EditorBond[];
  causalities: Map<string, CausalityStatus>;
  onSolverSelected?: (solver: SolverType, timeStep: number) => void;
}

const SolverRecommendationPanel: React.FC<SolverRecommendationPanelProps> = ({
  elements,
  bonds,
  causalities,
  onSolverSelected,
}) => {
  const [recommendation, setRecommendation] = useState<SolverRecommendation | null>(null);
  const [selectedSolver, setSelectedSolver] = useState<SolverType | null>(null);
  const [simulationDuration, setSimulationDuration] = useState(1.0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recommendation']));

  useEffect(() => {
    const analyzer = new CausalityDrivenSolver(elements, bonds, causalities);
    const rec = analyzer.getRecommendation();
    setRecommendation(rec);
    setSelectedSolver(rec.recommendedSolver);
  }, [elements, bonds, causalities]);

  if (!recommendation) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #ddd',
        }}
      >
        <p style={{ color: '#666', textAlign: 'center' }}>Analyzing causality structure...</p>
      </div>
    );
  }

  const toggleSection = (sectionId: string) => {
    const newSections = new Set(expandedSections);
    if (newSections.has(sectionId)) {
      newSections.delete(sectionId);
    } else {
      newSections.add(sectionId);
    }
    setExpandedSections(newSections);
  };

  const getSolverColor = (solver: SolverType): string => {
    const colors: Record<SolverType, string> = {
      RK4: '#4CAF50',     // Green - simple
      RK45: '#2196F3',    // Blue - adaptive
      BDF: '#FF9800',     // Orange - stiff
      IDA: '#f44336',     // Red - DAE
      DOPRI: '#2196F3',   // Blue - adaptive
      RADAU: '#FF9800',   // Orange - implicit
    };
    return colors[solver] || '#999';
  };

  const getSolverDescription = (solver: SolverType): string => {
    const descriptions: Record<SolverType, string> = {
      RK4: 'Runge-Kutta 4th order - Simple, non-adaptive',
      RK45: 'Runge-Kutta 4/5 adaptive - Efficient for smooth systems',
      BDF: 'Backward differentiation formula - For stiff systems',
      IDA: 'Implicit DAE solver - Handles algebraic loops',
      DOPRI: 'DOPRI5 adaptive - Flexible, robust',
      RADAU: 'Radau implicit - Robust for stiff systems',
    };
    return descriptions[solver] || 'Unknown solver';
  };

  const analyzer = new CausalityDrivenSolver(elements, bonds, causalities);
  const estimatedRuntime = analyzer.estimateRuntime(simulationDuration, recommendation.timeStepSuggestion);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#fafafa',
        borderRadius: '4px',
        border: '1px solid #ddd',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0' }}>⚡ Solver Recommendation</h3>
          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
            Causality analysis suggests optimal numerical solver
          </p>
        </div>
      </div>

      {/* Main Recommendation */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#fff',
          borderRadius: '3px',
          borderLeft: `4px solid ${getSolverColor(recommendation.recommendedSolver)}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: getSolverColor(recommendation.recommendedSolver),
              color: '#fff',
              borderRadius: '3px',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            {recommendation.recommendedSolver}
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#333' }}>
              {getSolverDescription(recommendation.recommendedSolver)}
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              Speed: {recommendation.estimatedSpeed} | Memory: {recommendation.estimatedMemory.toFixed(1)} MB
            </div>
          </div>
        </div>

        {/* Parameters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            padding: '8px',
            backgroundColor: '#f9f9f9',
            borderRadius: '3px',
            fontSize: '11px',
          }}
        >
          <div>
            <span style={{ color: '#666' }}>Suggested Time Step:</span>
            <div style={{ fontWeight: 'bold', color: '#2196F3', marginTop: '4px' }}>
              {recommendation.timeStepSuggestion.toExponential(2)} s
            </div>
          </div>
          <div>
            <span style={{ color: '#666' }}>Est. Runtime (1s sim):</span>
            <div style={{ fontWeight: 'bold', color: '#f44336', marginTop: '4px' }}>
              {(estimatedRuntime * 1000).toFixed(0)} ms
            </div>
          </div>
        </div>

        {/* Alternatives */}
        {recommendation.alternatives.length > 0 && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
              Alternative solvers:
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {recommendation.alternatives.map((solver) => (
                <button
                  key={solver}
                  onClick={() => {
                    setSelectedSolver(solver);
                    onSolverSelected?.(solver, recommendation.timeStepSuggestion);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor:
                      selectedSolver === solver ? getSolverColor(solver) : '#eee',
                    color: selectedSolver === solver ? '#fff' : '#333',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  {solver}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stiffness Analysis */}
      <div
        style={{
          padding: '12px',
          backgroundColor: recommendation.stiffnessAnalysis.isStiff ? '#fff3e0' : '#f1f8e9',
          borderRadius: '3px',
          borderLeft: `4px solid ${recommendation.stiffnessAnalysis.isStiff ? '#FF9800' : '#4CAF50'}`,
          cursor: 'pointer',
        }}
        onClick={() => toggleSection('stiffness')}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 'bold',
            color: recommendation.stiffnessAnalysis.isStiff ? '#E65100' : '#2e7d32',
          }}
        >
          {expandedSections.has('stiffness') ? '▼' : '▶'}
          {recommendation.stiffnessAnalysis.isStiff ? '⚠️ Stiff System' : '✓ Non-Stiff System'}
          <span style={{ fontSize: '11px', marginLeft: 'auto', color: '#666', fontWeight: 'normal' }}>
            Ratio: {recommendation.stiffnessAnalysis.stiffnessRatio.toFixed(1)}
          </span>
        </div>

        {expandedSections.has('stiffness') && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#666' }}>
              {recommendation.stiffnessAnalysis.reason}
            </p>

            <div style={{ fontSize: '11px', color: '#333' }}>
              <div style={{ marginBottom: '6px' }}>
                <strong>Indicators:</strong>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  paddingLeft: '8px',
                }}
              >
                {Object.entries(recommendation.stiffnessAnalysis.indicators).map(([key, value]) => (
                  <div key={key}>
                    <span style={{ color: value ? '#f44336' : '#4CAF50' }}>
                      {value ? '●' : '○'}
                    </span>
                    <span style={{ marginLeft: '4px' }}>
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
                Confidence: {(recommendation.stiffnessAnalysis.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Algebraic Loops */}
      {recommendation.algebraicLoops.length > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#ffebee',
            borderRadius: '3px',
            borderLeft: '4px solid #f44336',
            cursor: 'pointer',
          }}
          onClick={() => toggleSection('loops')}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              color: '#c62828',
            }}
          >
            {expandedSections.has('loops') ? '▼' : '▶'}
            ⚠️ Algebraic Loops ({recommendation.algebraicLoops.length})
          </div>

          {expandedSections.has('loops') && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              {recommendation.algebraicLoops.map((loop, idx) => (
                <div key={idx} style={{ marginBottom: '8px', fontSize: '11px' }}>
                  <div style={{ fontWeight: 'bold', color: '#c62828' }}>Loop {idx + 1}:</div>
                  <div style={{ color: '#666', margin: '4px 0' }}>
                    <strong>Reason:</strong> {loop.reason}
                  </div>
                  <div style={{ color: '#666', margin: '4px 0' }}>
                    <strong>Suggestion:</strong> {loop.suggestion}
                  </div>
                  <div style={{ color: '#999', fontSize: '10px' }}>
                    Elements: {loop.elementIds.slice(0, 3).join(', ')}
                    {loop.elementIds.length > 3 && `, +${loop.elementIds.length - 3} more`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {recommendation.warnings.length > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fff3e0',
            borderRadius: '3px',
            borderLeft: '4px solid #FF9800',
            fontSize: '11px',
            color: '#E65100',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>⚠️ Warnings:</div>
          {recommendation.warnings.map((warning, idx) => (
            <div key={idx} style={{ marginBottom: '4px', paddingLeft: '8px' }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Optimization Opportunities */}
      {recommendation.optimizationOpportunities.length > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#e3f2fd',
            borderRadius: '3px',
            borderLeft: '4px solid #2196F3',
            cursor: 'pointer',
          }}
          onClick={() => toggleSection('optimization')}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              color: '#1565c0',
            }}
          >
            {expandedSections.has('optimization') ? '▼' : '▶'}
            💡 Optimization Opportunities
          </div>

          {expandedSections.has('optimization') && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              {recommendation.optimizationOpportunities.map((opportunity, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: '6px',
                    fontSize: '11px',
                    color: '#1565c0',
                    paddingLeft: '8px',
                  }}
                >
                  {opportunity}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Simulation Parameters */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#fff',
          borderRadius: '3px',
          borderLeft: '4px solid #666',
          cursor: 'pointer',
        }}
        onClick={() => toggleSection('parameters')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          {expandedSections.has('parameters') ? '▼' : '▶'}
          ⚙️ Simulation Parameters
        </div>

        {expandedSections.has('parameters') && (
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#666' }}>
                Simulation Duration (seconds):
              </label>
              <input
                type="number"
                value={simulationDuration}
                onChange={(e) => setSimulationDuration(parseFloat(e.target.value))}
                min="0.001"
                step="0.1"
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: '3px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '8px',
                backgroundColor: '#f9f9f9',
                borderRadius: '3px',
                fontSize: '11px',
              }}
            >
              <div>
                <span style={{ color: '#666' }}>Time Step:</span>
                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>
                  {recommendation.timeStepSuggestion.toExponential(2)} s
                </div>
              </div>
              <div>
                <span style={{ color: '#666' }}>Est. Runtime:</span>
                <div style={{ fontWeight: 'bold', marginTop: '4px', color: '#f44336' }}>
                  {estimatedRuntime.toFixed(0)} ms
                </div>
              </div>
              <div>
                <span style={{ color: '#666' }}>Total Steps:</span>
                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>
                  {(simulationDuration / recommendation.timeStepSuggestion).toFixed(0)}
                </div>
              </div>
              <div>
                <span style={{ color: '#666' }}>Solver:</span>
                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>
                  {selectedSolver}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onSolverSelected?.(selectedSolver!, recommendation.timeStepSuggestion);
              }}
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '10px',
                backgroundColor: '#2196F3',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
            >
              ✓ Start Simulation
            </button>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div
        style={{
          padding: '10px',
          backgroundColor: '#e3f2fd',
          borderRadius: '3px',
          fontSize: '11px',
          color: '#1565c0',
          borderLeft: '3px solid #2196F3',
        }}
      >
        <strong>ℹ️ How this works:</strong> Bond graph causality reveals system structure. Algebraic loops
        require implicit solvers. Stiff systems benefit from special algorithms. Use these recommendations
        as a starting point—adjust if simulation diverges.
      </div>
    </div>
  );
};

export default SolverRecommendationPanel;
