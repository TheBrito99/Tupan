/**
 * Interactive Causality Debugger UI Component
 *
 * Provides a comprehensive interface for step-by-step SCAP algorithm execution:
 * - Visual step walkthrough with detailed explanations
 * - Manual causality assignment for educational exploration
 * - Undo/redo history tracking
 * - Conflict resolution with suggestions
 * - Real-time validation and feedback
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';
import {
  CausalityDebugger,
  type DebuggerStep,
  type CausalityDebuggerState,
} from './causalityDebugger';
import styles from './BondGraphEditor.module.css';

interface InteractiveCausalityDebuggerProps {
  elements: EditorElement[];
  bonds: EditorBond[];
  onCausalityComplete?: (causalities: Map<string, CausalityStatus>) => void;
  onDebuggerStateChange?: (state: CausalityDebuggerState) => void;
}

const InteractiveCausalityDebugger: React.FC<InteractiveCausalityDebuggerProps> = ({
  elements,
  bonds,
  onCausalityComplete,
  onDebuggerStateChange,
}) => {
  const [causalityDebugger, setCausalityDebugger] = useState<CausalityDebugger | null>(null);
  const [debuggerState, setDebuggerState] = useState<CausalityDebuggerState | null>(null);
  const [selectedBondForManual, setSelectedBondForManual] = useState<string | null>(null);
  const [manualCausalityChoice, setManualCausalityChoice] = useState<CausalityStatus | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [autoPlay, setAutoPlay] = useState(false);
  const [showEducationMode, setShowEducationMode] = useState(true);

  // Initialize causalityDebugger
  useEffect(() => {
    const newDebugger = new CausalityDebugger(elements, bonds);
    setCausalityDebugger(newDebugger);
  }, [elements, bonds]);

  // Update state when causalityDebugger changes
  const updateDebuggerState = useCallback(() => {
    if (!causalityDebugger) return;
    const state = causalityDebugger.getState();
    setDebuggerState(state);
    onDebuggerStateChange?.(state);
  }, [causalityDebugger, onDebuggerStateChange]);

  // Start causalityDebugger
  const handleStart = useCallback(() => {
    if (!causalityDebugger) return;
    causalityDebugger.start();
    updateDebuggerState();
  }, [causalityDebugger, updateDebuggerState]);

  // Next step
  const handleNextStep = useCallback(() => {
    if (!causalityDebugger) return;
    const success = causalityDebugger.nextStep();
    updateDebuggerState();

    if (success && autoPlay) {
      setTimeout(() => handleNextStep(), 1500);
    }

    if (!success) {
      onCausalityComplete?.(causalityDebugger.getAllCausalities());
    }
  }, [causalityDebugger, updateDebuggerState, autoPlay, onCausalityComplete]);

  // Manual assignment
  const handleManualAssign = useCallback(() => {
    if (!causalityDebugger || !selectedBondForManual || !manualCausalityChoice) return;

    const success = causalityDebugger.manualAssign(selectedBondForManual, manualCausalityChoice, manualReason);
    updateDebuggerState();

    if (success) {
      setSelectedBondForManual(null);
      setManualCausalityChoice(null);
      setManualReason('');
    }
  }, [causalityDebugger, selectedBondForManual, manualCausalityChoice, manualReason, updateDebuggerState]);

  // Apply suggested fix
  const handleApplySuggestedFix = useCallback(
    (bondId: string) => {
      if (!causalityDebugger) return;

      const suggestion = causalityDebugger.getSuggestedFix(bondId);
      if (suggestion) {
        const success = causalityDebugger.manualAssign(
          bondId,
          suggestion.causality,
          `Suggested: ${suggestion.reason}`
        );
        updateDebuggerState();
      }
    },
    [causalityDebugger, updateDebuggerState]
  );

  // Undo
  const handleUndo = useCallback(() => {
    if (!causalityDebugger) return;
    causalityDebugger.undo();
    updateDebuggerState();
  }, [causalityDebugger, updateDebuggerState]);

  // Redo
  const handleRedo = useCallback(() => {
    if (!causalityDebugger) return;
    causalityDebugger.redo();
    updateDebuggerState();
  }, [causalityDebugger, updateDebuggerState]);

  // Reset
  const handleReset = useCallback(() => {
    if (!causalityDebugger) return;
    causalityDebugger.reset();
    setAutoPlay(false);
    updateDebuggerState();
  }, [causalityDebugger, updateDebuggerState]);

  if (!causalityDebugger || !causalityDebuggerState) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #ddd',
        }}
      >
        <p style={{ color: '#666', textAlign: 'center' }}>Initializing causalityDebugger...</p>
      </div>
    );
  }

  const currentStep = causalityDebugger.getCurrentStep();
  const allSteps = causalityDebugger.getAllSteps();
  const progress = (debuggerState.currentStepIndex / debuggerState.totalSteps) * 100;
  const canUndo = causalityDebugger.canUndo();
  const canRedo = causalityDebugger.canRedo();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
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
          <h3 style={{ margin: '0 0 4px 0' }}>🔍 Interactive Causality Debugger</h3>
          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
            Step through the SCAP algorithm or manually assign causality
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowEducationMode(!showEducationMode)}
            style={{
              padding: '4px 8px',
              backgroundColor: showEducationMode ? '#2196F3' : '#ddd',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {showEducationMode ? '📚 On' : '📚 Off'}
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px',
          backgroundColor: '#fff',
          borderRadius: '3px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {debuggerState.state === 'idle' ? (
          <button
            onClick={handleStart}
            style={{
              padding: '6px 12px',
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ▶ Start
          </button>
        ) : (
          <>
            <button
              onClick={handleNextStep}
              disabled={debuggerState.state === 'completed'}
              style={{
                padding: '6px 12px',
                backgroundColor: debuggerState.state === 'completed' ? '#ccc' : '#2196F3',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: debuggerState.state === 'completed' ? 'default' : 'pointer',
              }}
            >
              ⏭ Next Step
            </button>
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              style={{
                padding: '6px 12px',
                backgroundColor: autoPlay ? '#FF9800' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              {autoPlay ? '⏸ Pause' : '▶ Auto'}
            </button>
          </>
        )}

        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo"
            style={{
              padding: '6px 10px',
              backgroundColor: canUndo ? '#666' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: canUndo ? 'pointer' : 'default',
              fontSize: '12px',
            }}
          >
            ↶
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo"
            style={{
              padding: '6px 10px',
              backgroundColor: canRedo ? '#666' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: canRedo ? 'pointer' : 'default',
              fontSize: '12px',
            }}
          >
            ↷
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 10px',
              backgroundColor: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#666',
            marginBottom: '4px',
          }}
        >
          <span>
            Step {debuggerState.currentStepIndex} / {debuggerState.totalSteps}
          </span>
          <span>
            {debuggerState.bondCausalities.size} / {bonds.length} bonds assigned
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: '#4CAF50',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Current Step Display */}
      {currentStep && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fff',
            borderRadius: '3px',
            borderLeft: '4px solid #2196F3',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 8px',
                backgroundColor: '#2196F3',
                color: '#fff',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              Step {currentStep.stepNumber}: {currentStep.phaseName}
            </span>
          </div>

          <p style={{ margin: '8px 0', fontSize: '13px', fontWeight: 'bold' }}>
            {currentStep.description}
          </p>

          {showEducationMode && (
            <div
              style={{
                padding: '8px',
                backgroundColor: '#e3f2fd',
                borderRadius: '3px',
                fontSize: '11px',
                color: '#1565c0',
                marginBottom: '8px',
                borderLeft: '3px solid #1565c0',
              }}
            >
              <strong>💡 Reasoning:</strong> {currentStep.reasoning}
            </div>
          )}

          {/* Assignments in this step */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '6px' }}>
              Causalities to Assign ({currentStep.bondAssignments.length}):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {currentStep.bondAssignments.map((assignment) => (
                <div
                  key={assignment.bondId}
                  style={{
                    padding: '6px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '2px',
                    fontSize: '10px',
                    borderLeft: `3px solid ${getCausalityColor(assignment.assignedCausality)}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '60px' }}>
                      {getElementName(assignment.fromElementId)} → {getElementName(assignment.toElementId)}
                    </span>
                    <span
                      style={{
                        padding: '2px 6px',
                        backgroundColor: getCausalityColor(assignment.assignedCausality),
                        color: '#fff',
                        borderRadius: '2px',
                        fontSize: '9px',
                      }}
                    >
                      {assignment.assignedCausality}
                    </span>
                  </div>
                  <div style={{ color: '#666', marginTop: '2px' }}>{assignment.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Assignment Section */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#fff9e6',
          borderRadius: '3px',
          borderLeft: '4px solid #FF9800',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#E65100' }}>
          ✏️ Manual Causality Assignment
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#666' }}>Select Bond:</label>
            <select
              value={selectedBondForManual || ''}
              onChange={(e) => setSelectedBondForManual(e.target.value)}
              style={{
                width: '100%',
                padding: '4px',
                borderRadius: '2px',
                border: '1px solid #ccc',
                fontSize: '10px',
              }}
            >
              <option value="">-- Choose bond --</option>
              {bonds
                .filter((b) => !causalityDebuggerState.bondCausalities.has(b.id))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {getElementName(b.from)} → {getElementName(b.to)}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#666' }}>Causality:</label>
            <select
              value={manualCausalityChoice || ''}
              onChange={(e) => setManualCausalityChoice(e.target.value as CausalityStatus)}
              style={{
                width: '100%',
                padding: '4px',
                borderRadius: '2px',
                border: '1px solid #ccc',
                fontSize: '10px',
              }}
            >
              <option value="">-- Choose --</option>
              <option value="EffortOut">EffortOut</option>
              <option value="FlowOut">FlowOut</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ marginBottom: '4px', color: '#666', fontSize: '11px' }}>Reason:</label>
            <input
              type="text"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Why?"
              style={{
                padding: '4px',
                borderRadius: '2px',
                border: '1px solid #ccc',
                fontSize: '10px',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleManualAssign}
          disabled={!selectedBondForManual || !manualCausalityChoice}
          style={{
            marginTop: '8px',
            padding: '6px 12px',
            backgroundColor:
              selectedBondForManual && manualCausalityChoice ? '#FF9800' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: selectedBondForManual && manualCausalityChoice ? 'pointer' : 'default',
            fontSize: '11px',
            fontWeight: 'bold',
          }}
        >
          ✓ Apply Assignment
        </button>
      </div>

      {/* Conflicts */}
      {debuggerState.conflicts.length > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#ffebee',
            borderRadius: '3px',
            borderLeft: '4px solid #f44336',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#c62828' }}>
            ⚠️ Conflicts ({debuggerState.conflicts.length})
          </div>

          {debuggerState.conflicts.map((conflict, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px',
                backgroundColor: '#fff',
                borderRadius: '2px',
                marginBottom: '6px',
                fontSize: '11px',
                borderLeft: `3px solid ${conflict.severity === 'error' ? '#f44336' : '#FF9800'}`,
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#c62828' }}>
                {conflict.reason}
              </div>
              <div style={{ color: '#666', margin: '4px 0' }}>
                <strong>Suggestion:</strong> {conflict.suggestion}
              </div>
              <button
                onClick={() => handleApplySuggestedFix(conflict.bondId)}
                style={{
                  padding: '3px 6px',
                  backgroundColor: '#FF9800',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Apply Fix
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unassigned Bonds */}
      {debuggerState.unassignedBonds.size > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fff3e0',
            borderRadius: '3px',
            borderLeft: '4px solid #FF9800',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#E65100' }}>
            ⏳ Unassigned Bonds ({debuggerState.unassignedBonds.size})
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {Array.from(debuggerState.unassignedBonds).map((bondId) => {
              const bond = bonds.find((b) => b.id === bondId);
              if (!bond) return null;

              return (
                <span
                  key={bondId}
                  style={{
                    padding: '4px 6px',
                    backgroundColor: '#fff',
                    borderRadius: '2px',
                    border: '1px solid #FF9800',
                    fontSize: '10px',
                  }}
                >
                  {getElementName(bond.from)} → {getElementName(bond.to)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Completion Message */}
      {debuggerState.state === 'completed' && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f1f8e9',
            borderRadius: '3px',
            borderLeft: '4px solid #4CAF50',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2e7d32' }}>
            ✓ Causality Assignment Complete!
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#558b2f' }}>
            {debuggerState.bondCausalities.size} bonds assigned
            {debuggerState.conflicts.length > 0 && ` • ${debuggerState.conflicts.length} conflicts`}
          </p>
        </div>
      )}
    </div>
  );
};

// Helper functions
function getCausalityColor(status: CausalityStatus | string): string {
  const colors: Record<string, string> = {
    EffortOut: '#2196F3',
    FlowOut: '#4CAF50',
    EffortIn: '#2196F3',
    FlowIn: '#4CAF50',
    Unassigned: '#999999',
    Conflict: '#f44336',
    Derivative: '#FF9800',
  };
  return colors[status] || '#999999';
}

function getElementName(elementId: string): string {
  return elementId.slice(0, 8);
}

export default InteractiveCausalityDebugger;
