import React from 'react';
import { AnalysisData, MechanicalComponent } from './types';
import styles from './MechanicalEditor.module.css';

interface AnalysisPanelProps {
  analysisData: AnalysisData | null;
  components: MechanicalComponent[];
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysisData,
  components,
  isAnalyzing,
  onRunAnalysis,
}) => {
  if (!analysisData) {
    return (
      <div className={styles.analysisPanel}>
        <h3>Analysis Results</h3>
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing || components.length === 0}
          className={styles.analysisButton}
        >
          {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
        <p className={styles.placeholder}>
          {components.length === 0 ? 'Add components to run analysis' : 'Click "Run Analysis" to compute mechanical response'}
        </p>
      </div>
    );
  }

  const getComponentName = (id: string): string => {
    return components.find((c) => c.id === id)?.name || `Component ${id.slice(0, 8)}`;
  };

  return (
    <div className={styles.analysisPanel}>
      <div className={styles.analysisHeader}>
        <h3>Analysis Results</h3>
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing || components.length === 0}
          className={styles.analysisButton}
        >
          {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {/* Dynamic Response Metrics */}
      <div className={styles.analysisSection}>
        <h4>Dynamic Response</h4>
        <table className={styles.metricsTable}>
          <tbody>
            <tr>
              <td>Resonance Frequency:</td>
              <td className={styles.value}>
                {analysisData.energyAnalysis.resonanceFrequency.toFixed(3)} rad/s
              </td>
            </tr>
            <tr>
              <td>Damping Ratio:</td>
              <td className={styles.value}>
                {analysisData.energyAnalysis.dampingRatio.toFixed(3)} (ζ)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Steady-State Displacements */}
      <div className={styles.analysisSection}>
        <h4>Steady-State Displacements (m)</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>Displacement</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(analysisData.steadyState.displacements).map(([compId, disp]) => (
              <tr key={compId}>
                <td>{getComponentName(compId)}</td>
                <td className={styles.value}>{(disp as number).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Velocities */}
      <div className={styles.analysisSection}>
        <h4>Velocities (m/s)</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>Velocity</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(analysisData.steadyState.velocities).map(([compId, vel]) => (
              <tr key={compId}>
                <td>{getComponentName(compId)}</td>
                <td className={styles.value}>{(vel as number).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Accelerations */}
      <div className={styles.analysisSection}>
        <h4>Accelerations (m/s²)</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>Acceleration</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(analysisData.steadyState.accelerations).map(([compId, accel]) => (
              <tr key={compId}>
                <td>{getComponentName(compId)}</td>
                <td className={styles.value}>{(accel as number).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Energy Analysis */}
      <div className={styles.analysisSection}>
        <h4>Energy Analysis (J)</h4>
        <table className={styles.metricsTable}>
          <tbody>
            <tr>
              <td>Kinetic Energy:</td>
              <td className={styles.value}>
                {analysisData.energyAnalysis.kineticEnergy.toFixed(6)} J
              </td>
            </tr>
            <tr>
              <td>Potential Energy:</td>
              <td className={styles.value}>
                {analysisData.energyAnalysis.potentialEnergy.toFixed(6)} J
              </td>
            </tr>
            <tr>
              <td>Dissipated Energy:</td>
              <td className={styles.value}>
                {analysisData.energyAnalysis.dissipatedEnergy.toFixed(6)} J
              </td>
            </tr>
            <tr style={{ fontWeight: 'bold' }}>
              <td>Total Energy:</td>
              <td className={styles.value}>
                {analysisData.energyAnalysis.totalEnergy.toFixed(6)} J
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Transient data summary */}
      {analysisData.transient.time.length > 0 && (
        <div className={styles.analysisSection}>
          <h4>Transient Summary</h4>
          <p className={styles.placeholder}>
            Transient data available: {analysisData.transient.time.length} time points
          </p>
        </div>
      )}

      {/* Export options */}
      <div className={styles.analysisSection}>
        <button className={styles.exportButton}>Export Results</button>
        <button className={styles.exportButton}>Export CSV</button>
      </div>
    </div>
  );
};
