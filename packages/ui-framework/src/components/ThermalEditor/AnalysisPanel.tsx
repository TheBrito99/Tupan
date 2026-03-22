import React from 'react';
import { AnalysisData, ThermalComponent } from './types';
import styles from './ThermalEditor.module.css';

interface AnalysisPanelProps {
  analysisData: AnalysisData | null;
  components: ThermalComponent[];
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
          {components.length === 0 ? 'Add components to run analysis' : 'Click "Run Analysis" to compute thermal network'}
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

      {/* Overall metrics */}
      <div className={styles.analysisSection}>
        <h4>Overall Metrics</h4>
        <table className={styles.metricsTable}>
          <tbody>
            <tr>
              <td>Total Power Dissipation:</td>
              <td className={styles.value}>
                {analysisData.totalPowerDissipation.toFixed(2)} W
              </td>
            </tr>
            <tr>
              <td>Thermal Path Resistance:</td>
              <td className={styles.value}>
                {analysisData.thermalPathResistance.toFixed(4)} K/W
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Steady-state temperatures */}
      <div className={styles.analysisSection}>
        <h4>Steady-State Temperatures</h4>
        <div className={styles.temperaturesGrid}>
          {Object.entries(analysisData.steadyState.temperatures).map(([compId, temp]) => {
            const tempNum = temp as number;
            return (
            <div key={compId} className={styles.temperatureCard}>
              <div className={styles.tempComponentName}>{getComponentName(compId)}</div>
              <div className={styles.tempValue}>
                {tempNum.toFixed(2)} K
                <span className={styles.tempCelsius}>({(tempNum - 273.15).toFixed(2)} °C)</span>
              </div>
              {/* Temperature bar visualization */}
              <div className={styles.tempBar}>
                <div
                  className={styles.tempBarFill}
                  style={{
                    width: `${Math.min(100, (tempNum / 400) * 100)}%`,
                    backgroundColor:
                      tempNum < 310
                        ? '#0066ff'
                        : tempNum < 340
                        ? '#00ff00'
                        : tempNum < 370
                        ? '#ffff00'
                        : tempNum < 400
                        ? '#ff9900'
                        : '#ff0000',
                  }}
                />
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Heat flows */}
      <div className={styles.analysisSection}>
        <h4>Heat Flows (W)</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Connection</th>
              <th>Flow</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(analysisData.steadyState.heatFlows).map(([connId, flow]) => (
              <tr key={connId}>
                <td>{connId.slice(0, 12)}...</td>
                <td className={styles.value}>{flow.toFixed(4)} W</td>
              </tr>
            ))}
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
