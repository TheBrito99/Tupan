/**
 * Block Diagram Analysis Panel
 *
 * Display simulation results including time-domain waveforms and metrics
 */

import React, { useMemo } from 'react';
import { SimulationResult } from './types';
import styles from './BlockDiagramEditor.module.css';

interface AnalysisPanelProps {
  analysisData: SimulationResult | null;
  onRunAnalysis: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysisData, onRunAnalysis }) => {
  const statistics = useMemo(() => {
    if (!analysisData) return null;

    const stats: Record<string, { min: number; max: number; mean: number }> = {};

    Object.entries(analysisData.signals).forEach(([componentId, values]) => {
      const typedValues = values as number[];
      if (typedValues.length === 0) return;

      const min = Math.min(...typedValues);
      const max = Math.max(...typedValues);
      const mean = typedValues.reduce((a, b) => a + b, 0) / typedValues.length;

      stats[componentId] = { min, max, mean };
    });

    return stats;
  }, [analysisData]);

  if (!analysisData) {
    return (
      <div className={styles.analysisPanel}>
        <h3>Analysis Results</h3>
        <p className={styles.placeholder}>Run analysis to see results</p>
        <button className={styles.analyzeButton} onClick={onRunAnalysis}>
          Run Analysis
        </button>
      </div>
    );
  }

  return (
    <div className={styles.analysisPanel}>
      <div className={styles.analysisHeader}>
        <h3>Analysis Results</h3>
        <button className={styles.analyzeButton} onClick={onRunAnalysis}>
          Run Analysis
        </button>
      </div>

      {/* Simulation Summary */}
      <div className={styles.analysisSectionGroup}>
        <h4>Simulation Summary</h4>
        <table className={styles.resultsTable}>
          <tbody>
            <tr>
              <td>Duration:</td>
              <td className={styles.value}>
                {analysisData.time.length > 0
                  ? analysisData.time[analysisData.time.length - 1].toFixed(2)
                  : '0'}{' '}
                s
              </td>
            </tr>
            <tr>
              <td>Time Steps:</td>
              <td className={styles.value}>{analysisData.time.length}</td>
            </tr>
            <tr>
              <td>Signals:</td>
              <td className={styles.value}>{Object.keys(analysisData.signals).length}</td>
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
              {Object.entries(statistics).map(([signalId, stats]) => (
                <tr key={signalId}>
                  <td>{signalId.split('-')[0]}</td>
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
        <h4>Sample Output Values (First 5 Steps)</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Time (s)</th>
              {Object.keys(analysisData.signals)
                .slice(0, 3)
                .map((sig) => (
                  <th key={sig}>{sig.split('-')[0]}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {analysisData.time.slice(0, 5).map((t, timeIdx) => (
              <tr key={timeIdx}>
                <td className={styles.value}>{t.toFixed(2)}</td>
                {Object.entries(analysisData.signals)
                  .slice(0, 3)
                  .map(([sig, values]) => (
                    <td key={sig} className={styles.value}>
                      {(values[timeIdx] ?? 0).toFixed(4)}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export Options */}
      <div className={styles.exportButtons}>
        <button className={styles.exportButton}>Export Results</button>
        <button className={styles.exportButton}>Export CSV</button>
      </div>
    </div>
  );
};
