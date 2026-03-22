/**
 * Optimization Panel Component
 *
 * Displays all causality optimization suggestions with before/after analysis.
 * Allows user to apply optimizations selectively or all at once.
 */

import React, { useState, useEffect } from 'react';
import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';
import {
  AdvancedLoopEliminator,
  type AlgebraicLoop,
  type BreakPoint,
} from './advancedLoopElimination';
import {
  DerivativeCausalityOptimizer,
  type DerivativeCausalityIssue,
  formatDerivativeOrder,
} from './derivativeCausalityOptimizer';
import {
  FeedbackPathAnalyzer,
  type FeedbackPath,
  type StiffnessRating,
} from './feedbackPathAnalyzer';
import { EquationOrderingOptimizer, type EquationOrder } from './equationOrderingOptimizer';
import styles from './BondGraphEditor.module.css';

interface OptimizationPanelProps {
  elements: EditorElement[];
  bonds: EditorBond[];
  causalities: Map<string, CausalityStatus>;
  onApplyOptimization?: (optimizedCausalities: Map<string, CausalityStatus>) => void;
  onOptimizationChange?: (summary: OptimizationSummary) => void;
}

export interface OptimizationSummary {
  loops: AlgebraicLoop[];
  derivatives: DerivativeCausalityIssue[];
  feedbackPaths: FeedbackPath[];
  stiffness: StiffnessRating;
  equationOrder: EquationOrder;
  totalIssues: number;
  criticalIssues: number;
}

type TabType = 'loops' | 'derivatives' | 'feedback' | 'equations' | 'summary';

const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  elements,
  bonds,
  causalities,
  onApplyOptimization,
  onOptimizationChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [summary, setSummary] = useState<OptimizationSummary | null>(null);
  const [selectedOptimizations, setSelectedOptimizations] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);
  const [expandedLoop, setExpandedLoop] = useState<string | null>(null);

  // Run optimization analysis
  useEffect(() => {
    setLoading(true);

    try {
      // Run all optimizers
      const loopEliminator = new AdvancedLoopEliminator();
      const loops = loopEliminator.findLoops(elements, bonds, causalities);

      const derivativeOptimizer = new DerivativeCausalityOptimizer();
      const derivatives = derivativeOptimizer.findDerivativeCausalities(
        elements,
        bonds,
        causalities
      );

      const feedbackAnalyzer = new FeedbackPathAnalyzer();
      const feedbackPaths = feedbackAnalyzer.findFeedbackPaths(
        elements,
        bonds,
        causalities
      );
      const stiffness = feedbackAnalyzer.rateStiffness(feedbackPaths);

      const equationOptimizer = new EquationOrderingOptimizer();
      const equationOrder = equationOptimizer.optimizeOrdering(
        elements,
        bonds,
        causalities
      );

      // Calculate summary
      const totalIssues = loops.length + derivatives.length;
      const criticalIssues =
        loops.filter(l => l.severity === 'critical').length +
        derivatives.filter(d => d.severity === 'critical').length;

      const newSummary: OptimizationSummary = {
        loops,
        derivatives,
        feedbackPaths,
        stiffness,
        equationOrder,
        totalIssues,
        criticalIssues,
      };

      setSummary(newSummary);
      onOptimizationChange?.(newSummary);

      // Auto-select all critical issues
      const autoSelect = new Set<string>();
      loops.forEach(l => {
        if (l.severity === 'critical') {
          autoSelect.add(`loop_${loops.indexOf(l)}`);
        }
      });
      derivatives.forEach(d => {
        if (d.severity === 'critical') {
          autoSelect.add(`deriv_${derivatives.indexOf(d)}`);
        }
      });
      setSelectedOptimizations(autoSelect);
    } catch (error) {
      console.error('Error running optimization analysis:', error);
    } finally {
      setLoading(false);
    }
  }, [elements, bonds, causalities, onOptimizationChange]);

  /**
   * Apply selected optimizations
   */
  const handleApplyOptimizations = () => {
    if (!summary) return;

    let optimized = new Map(causalities);
    const eliminator = new AdvancedLoopEliminator();

    // Apply loop break points
    for (let i = 0; i < summary.loops.length; i++) {
      const key = `loop_${i}`;
      if (selectedOptimizations.has(key) && summary.loops[i].breakPoints.length > 0) {
        const bestBreakPoint = summary.loops[i].breakPoints[0];
        optimized = eliminator.applyBreakPoint(
          summary.loops[i],
          bestBreakPoint,
          optimized
        );
      }
    }

    onApplyOptimization?.(optimized);
  };

  /**
   * Toggle optimization selection
   */
  const toggleOptimization = (id: string) => {
    const newSelected = new Set(selectedOptimizations);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOptimizations(newSelected);
  };

  if (!summary || loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
        {loading ? 'Analyzing causality...' : 'No optimization data'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab buttons */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '8px' }}>
        {(['summary', 'loops', 'derivatives', 'feedback', 'equations'] as TabType[]).map(
          tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeTab === tab ? '#e3f2fd' : 'transparent',
                cursor: 'pointer',
                fontSize: '12px',
                textTransform: 'capitalize',
                borderBottom: activeTab === tab ? '2px solid #2196f3' : 'none',
              }}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {activeTab === 'summary' && <SummaryTab summary={summary} />}
        {activeTab === 'loops' && (
          <LoopsTab
            loops={summary.loops}
            expandedLoop={expandedLoop}
            setExpandedLoop={setExpandedLoop}
            selectedOptimizations={selectedOptimizations}
            toggleOptimization={toggleOptimization}
          />
        )}
        {activeTab === 'derivatives' && (
          <DerivativesTab
            derivatives={summary.derivatives}
            selectedOptimizations={selectedOptimizations}
            toggleOptimization={toggleOptimization}
          />
        )}
        {activeTab === 'feedback' && (
          <FeedbackTab
            feedbackPaths={summary.feedbackPaths}
            stiffness={summary.stiffness}
          />
        )}
        {activeTab === 'equations' && (
          <EquationsTab equationOrder={summary.equationOrder} />
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '12px', borderTop: '1px solid #ddd' }}>
        <button
          onClick={handleApplyOptimizations}
          style={{
            width: '100%',
            padding: '8px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          Apply Selected Optimizations ({selectedOptimizations.size})
        </button>
      </div>
    </div>
  );
};

/**
 * Summary Tab: Overview of all issues and improvements
 */
const SummaryTab: React.FC<{ summary: OptimizationSummary }> = ({ summary }) => {
  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>
        Optimization Analysis
      </h4>

      {/* Issues Summary */}
      <div
        style={{
          background: '#f5f5f5',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
          Issues Found: {summary.totalIssues}
        </div>
        <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
          <div>
            🔴 Critical: {summary.criticalIssues} |{' '}
            ⚠️ Warnings: {summary.loops.filter(l => l.severity === 'warning').length +
              summary.derivatives.filter(d => d.severity === 'warning').length} |{' '}
            ℹ️ Info:{' '}
            {summary.loops.filter(l => l.severity === 'info').length +
              summary.derivatives.filter(d => d.severity === 'info').length}
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>Algebraic Loops</h5>
        <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
          {summary.loops.length === 0
            ? '✅ No algebraic loops detected'
            : `${summary.loops.length} loop${summary.loops.length > 1 ? 's' : ''} found`}
        </p>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>Derivative Causality</h5>
        <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
          {summary.derivatives.length === 0
            ? '✅ No problematic derivatives detected'
            : `${summary.derivatives.length} issue${summary.derivatives.length > 1 ? 's' : ''} found`}
        </p>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>System Stiffness</h5>
        <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
          <strong>Ratio:</strong> {summary.stiffness.ratio.toFixed(1)}:1<br/>
          <strong>Classification:</strong> {summary.stiffness.classification}
          <br/>
          <strong>Recommended Solver:</strong>{' '}
          {new FeedbackPathAnalyzer().suggestSolver(summary.stiffness)}
        </p>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>Equation Optimization</h5>
        <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
          <strong>Simultaneous Blocks:</strong> {summary.equationOrder.simultaneousBlocks.length}
          <br/>
          <strong>Sparsity:</strong> {(summary.equationOrder.sparsity * 100).toFixed(0)}%<br/>
          <strong>Estimated Cost:</strong> {summary.equationOrder.computationCost.toFixed(0)}{' '}
          FLOPS
        </p>
      </div>

      {/* Recommendation */}
      {summary.criticalIssues > 0 && (
        <div
          style={{
            background: '#fff3cd',
            padding: '12px',
            borderRadius: '4px',
            borderLeft: '4px solid #ffc107',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#856404' }}>
            ⚠️ Recommendation
          </div>
          <div style={{ fontSize: '11px', color: '#856404', marginTop: '4px' }}>
            Apply all critical optimizations before simulation. Switch to{' '}
            <strong>
              {new FeedbackPathAnalyzer().suggestSolver(summary.stiffness)}
            </strong>{' '}
            solver for better stability.
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Loops Tab: Algebraic loop details and break point suggestions
 */
const LoopsTab: React.FC<{
  loops: AlgebraicLoop[];
  expandedLoop: string | null;
  setExpandedLoop: (id: string | null) => void;
  selectedOptimizations: Set<string>;
  toggleOptimization: (id: string) => void;
}> = ({ loops, expandedLoop, setExpandedLoop, selectedOptimizations, toggleOptimization }) => {
  if (loops.length === 0) {
    return (
      <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
        ✅ No algebraic loops detected
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>
        Algebraic Loops ({loops.length})
      </h4>

      {loops.map((loop, idx) => {
        const key = `loop_${idx}`;
        const isExpanded = expandedLoop === key;

        return (
          <div
            key={key}
            style={{
              background: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '12px',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background:
                  loop.severity === 'critical'
                    ? '#ffebee'
                    : loop.severity === 'warning'
                      ? '#fff3e0'
                      : '#f5f5f5',
              }}
              onClick={() => setExpandedLoop(isExpanded ? null : key)}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                  {loop.severity === 'critical' && '🔴 '}
                  {loop.severity === 'warning' && '⚠️ '}
                  {loop.severity === 'info' && 'ℹ️ '}
                  Loop {idx + 1}: {loop.bondIds.length} bonds
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  {loop.bondIds.join(' → ')}
                </div>
              </div>

              <div>
                <input
                  type="checkbox"
                  checked={selectedOptimizations.has(key)}
                  onChange={() => toggleOptimization(key)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Details (expanded) */}
            {isExpanded && (
              <div style={{ padding: '12px', borderTop: '1px solid #ddd', fontSize: '12px' }}>
                <p style={{ margin: '0 0 8px 0', color: '#666' }}>
                  <strong>Reason:</strong> {loop.reason}
                </p>

                <div style={{ marginBottom: '12px' }}>
                  <strong>Break Points ({loop.breakPoints.length}):</strong>
                  {loop.breakPoints.slice(0, 3).map((bp, bIdx) => (
                    <div key={bIdx} style={{ margin: '8px 0 0 0', paddingLeft: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#333' }}>
                        {bIdx + 1}. Change {bp.currentCausality} → {bp.suggestedCausality}
                      </div>
                      <div style={{ fontSize: '10px', color: '#999' }}>
                        Impact: {bp.impact} | {bp.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Derivatives Tab: Derivative causality issues
 */
const DerivativesTab: React.FC<{
  derivatives: DerivativeCausalityIssue[];
  selectedOptimizations: Set<string>;
  toggleOptimization: (id: string) => void;
}> = ({ derivatives, selectedOptimizations, toggleOptimization }) => {
  if (derivatives.length === 0) {
    return (
      <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
        ✅ No problematic derivative causality detected
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>
        Derivative Causality Issues ({derivatives.length})
      </h4>

      {derivatives.map((deriv, idx) => {
        const key = `deriv_${idx}`;

        return (
          <div
            key={key}
            style={{
              background:
                deriv.severity === 'critical'
                  ? '#ffebee'
                  : deriv.severity === 'warning'
                    ? '#fff3e0'
                    : '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '12px',
              border: `1px solid ${
                deriv.severity === 'critical'
                  ? '#ef5350'
                  : deriv.severity === 'warning'
                    ? '#ff9800'
                    : '#bbb'
              }`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                  {deriv.elementType} (
                  {deriv.elementId}) - {formatDerivativeOrder(deriv.derivativeOrder)}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  {deriv.explanation}
                </div>
                <div style={{ fontSize: '10px', color: '#999', marginTop: '8px' }}>
                  <strong>Suggested Remedies:</strong>
                  {deriv.remedies.slice(0, 2).map((r, rIdx) => (
                    <div key={rIdx}>
                      • {r.description}
                    </div>
                  ))}
                </div>
              </div>

              <input
                type="checkbox"
                checked={selectedOptimizations.has(key)}
                onChange={() => toggleOptimization(key)}
                style={{ cursor: 'pointer', marginLeft: '8px' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Feedback Tab: Feedback loop analysis
 */
const FeedbackTab: React.FC<{
  feedbackPaths: FeedbackPath[];
  stiffness: StiffnessRating;
}> = ({ feedbackPaths, stiffness }) => {
  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>
        Feedback Path Analysis ({feedbackPaths.length} paths)
      </h4>

      {/* Stiffness Summary */}
      <div
        style={{
          background:
            stiffness.classification === 'very-stiff'
              ? '#ffebee'
              : stiffness.classification === 'stiff'
                ? '#fff3e0'
                : '#e8f5e9',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          System Stiffness: {stiffness.classification}
        </div>
        <p style={{ margin: '0', color: '#666', fontSize: '11px' }}>
          {stiffness.explanation}
        </p>
      </div>

      {/* Feedback Paths */}
      {feedbackPaths.length === 0 ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
          No feedback loops detected
        </div>
      ) : (
        feedbackPaths.map((path, idx) => (
          <div
            key={idx}
            style={{
              background: '#f9f9f9',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '12px',
              borderLeft:
                path.type === 'positive'
                  ? '4px solid #f44336'
                  : path.type === 'negative'
                    ? '4px solid #4CAF50'
                    : '4px solid #2196F3',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
              {path.type === 'positive' && '🔴 '}
              {path.type === 'negative' && '🟢 '}
              {path.type === 'structural' && '🔵 '}
              {path.type.toUpperCase()} Feedback (Gain: {path.loopGain.toFixed(2)})
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {path.description}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: '#999',
                marginTop: '4px',
                padding: '4px',
                background: '#fff',
                borderRadius: '2px',
              }}
            >
              Storage elements: {path.components.storageCount} | Time constant:{' '}
              {path.timeConstant.toFixed(3)}s | Stability: {path.stability}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

/**
 * Equations Tab: Equation ordering optimization
 */
const EquationsTab: React.FC<{ equationOrder: EquationOrder }> = ({ equationOrder }) => {
  const parallelization = new EquationOrderingOptimizer().suggestParallelization(equationOrder);

  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>
        Equation Ordering Optimization
      </h4>

      <div
        style={{
          background: '#e3f2fd',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1976d2' }}>
          {equationOrder.description}
        </p>
        <p style={{ margin: '0', fontSize: '11px', color: '#555', lineHeight: '1.6' }}>
          {parallelization.recommendation}
        </p>
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>Performance Metrics</h5>
        <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.8' }}>
          <div>
            <strong>Estimated Cost:</strong> {equationOrder.computationCost.toFixed(0)}{' '}
            FLOPS
          </div>
          <div>
            <strong>Sparsity:</strong> {(equationOrder.sparsity * 100).toFixed(0)}%
          </div>
          <div>
            <strong>Condition Number:</strong> {equationOrder.conditionNumber.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Simultaneous Blocks */}
      <div>
        <h5 style={{ margin: '0 0 8px 0', color: '#333' }}>
          Simultaneous Blocks ({equationOrder.simultaneousBlocks.length})
        </h5>
        {equationOrder.simultaneousBlocks.map((block, idx) => (
          <div
            key={idx}
            style={{
              background: '#f5f5f5',
              padding: '8px 12px',
              borderRadius: '4px',
              marginBottom: '8px',
              fontSize: '11px',
            }}
          >
            <div>
              <strong>Block {idx + 1}:</strong> {block.length} equation{block.length > 1 ? 's' : ''}
            </div>
            <div style={{ color: '#999', marginTop: '2px' }}>
              Equations: {block.slice(0, 3).join(', ')}
              {block.length > 3 && '...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OptimizationPanel;
