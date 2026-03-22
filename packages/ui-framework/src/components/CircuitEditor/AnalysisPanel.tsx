/**
 * Circuit Editor Analysis Panel
 *
 * Display simulation results including DC operating point and transient waveforms
 */

import React, { useMemo } from 'react';
import { SimulationResult, AnalysisData } from './types';
import styles from './CircuitEditor.module.css';

interface AnalysisPanelProps {
  analysisData: AnalysisData | null;
  simulationResult: SimulationResult | null;
  onRunAnalysis: () => void;
  onRunSimulation: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysisData,
  simulationResult,
  onRunAnalysis,
  onRunSimulation,
}) => {
  const statistics = useMemo(() => {
    if (!simulationResult) return null;

    const stats: Record<string, { min: number; max: number; mean: number }> = {};

    Object.entries(simulationResult.voltages).forEach(([nodeId, values]) => {
      if (values.length === 0) return;

      const min = Math.min(...values);
      const max = Math.max(...values);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      stats[`V(${nodeId})`] = { min, max, mean };
    });

    Object.entries(simulationResult.currents).forEach(([compId, values]) => {
      if (values.length === 0) return;

      const min = Math.min(...values);
      const max = Math.max(...values);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      stats[`I(${compId})`] = { min, max, mean };
    });

    return stats;
  }, [simulationResult]);

  if (!analysisData && !simulationResult) {
    return (
      <div className={styles.analysisPanel}>
        <h3>Analysis Results</h3>
        <p className={styles.placeholder}>Run analysis to see results</p>
        <div className={styles.exportButtons}>
          <button className={styles.analyzeButton} onClick={onRunAnalysis}>
            DC Analysis
          </button>
          <button className={styles.analyzeButton} onClick={onRunSimulation}>
            Transient
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.analysisPanel}>
      <div className={styles.analysisHeader}>
        <h3>Analysis Results</h3>
      </div>

      {/* DC Operating Point Results */}
      {analysisData && (
        <>
          <div className={styles.analysisSectionGroup}>
            <h4>DC Operating Point</h4>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>Node/Component</th>
                  <th>Voltage (V)</th>
                  <th>Current (A)</th>
                  <th>Power (W)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analysisData.nodeVoltages).slice(0, 10).map(([nodeId, voltage]) => (
                  <tr key={nodeId}>
                    <td>{nodeId}</td>
                    <td className={styles.value}>{voltage.toFixed(3)}</td>
                    <td className={styles.value}>-</td>
                    <td className={styles.value}>-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.analysisSectionGroup}>
            <h4>Component Currents & Power</h4>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Current (A)</th>
                  <th>Power (W)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analysisData.componentCurrents).slice(0, 10).map(([compId, current]) => (
                  <tr key={compId}>
                    <td>{compId.split('-')[0]}</td>
                    <td className={styles.value}>{current.toFixed(6)}</td>
                    <td className={styles.value}>{(analysisData.power[compId] || 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.analysisSectionGroup}>
            <h4>Total Power Dissipation</h4>
            <table className={styles.resultsTable}>
              <tbody>
                <tr>
                  <td>Total Power:</td>
                  <td className={styles.value}>{analysisData.totalPower.toFixed(4)} W</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Transient Simulation Results */}
      {simulationResult && (
        <>
          <div className={styles.analysisSectionGroup}>
            <h4>Simulation Summary</h4>
            <table className={styles.resultsTable}>
              <tbody>
                <tr>
                  <td>Duration:</td>
                  <td className={styles.value}>
                    {simulationResult.time.length > 0
                      ? simulationResult.time[simulationResult.time.length - 1].toFixed(3)
                      : '0'}{' '}
                    s
                  </td>
                </tr>
                <tr>
                  <td>Time Steps:</td>
                  <td className={styles.value}>{simulationResult.time.length}</td>
                </tr>
                <tr>
                  <td>Voltages:</td>
                  <td className={styles.value}>{Object.keys(simulationResult.voltages).length}</td>
                </tr>
                <tr>
                  <td>Currents:</td>
                  <td className={styles.value}>{Object.keys(simulationResult.currents).length}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signal Statistics */}
          {statistics && (
            <div className={styles.analysisSectionGroup}>
              <h4>Signal Statistics</h4>
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Mean</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statistics).slice(0, 8).map(([signalId, stats]) => (
                    <tr key={signalId}>
                      <td>{signalId}</td>
                      <td className={styles.value}>{stats.min.toFixed(4)}</td>
                      <td className={styles.value}>{stats.max.toFixed(4)}</td>
                      <td className={styles.value}>{stats.mean.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sample Values */}
          <div className={styles.analysisSectionGroup}>
            <h4>Sample Voltages (First 5 Steps)</h4>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>Time (s)</th>
                  {Object.keys(simulationResult.voltages)
                    .slice(0, 3)
                    .map((node) => (
                      <th key={node}>V({node})</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {simulationResult.time.slice(0, 5).map((t, timeIdx) => (
                  <tr key={timeIdx}>
                    <td className={styles.value}>{t.toFixed(4)}</td>
                    {Object.entries(simulationResult.voltages)
                      .slice(0, 3)
                      .map(([node, values]) => (
                        <td key={node} className={styles.value}>
                          {(values[timeIdx] ?? 0).toFixed(3)}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Control Buttons */}
      <div className={styles.exportButtons}>
        <button className={styles.analyzeButton} onClick={onRunAnalysis}>
          DC Analysis
        </button>
        <button className={styles.analyzeButton} onClick={onRunSimulation}>
          Transient Sim
        </button>
      </div>
    </div>
  );
};

export default AnalysisPanel;
