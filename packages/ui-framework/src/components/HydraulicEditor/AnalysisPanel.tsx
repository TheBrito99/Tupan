import React from 'react';
import { AnalysisData } from './types';
import styles from './HydraulicEditor.module.css';

interface AnalysisPanelProps {
  analysisData: AnalysisData | null;
  onRunAnalysis: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysisData, onRunAnalysis }) => {
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

  const { steadyState, energyAnalysis, systemPressure, systemFlow } = analysisData;

  return (
    <div className={styles.analysisPanel}>
      <div className={styles.analysisHeader}>
        <h3>Analysis Results</h3>
        <button className={styles.analyzeButton} onClick={onRunAnalysis}>
          Run Analysis
        </button>
      </div>

      {/* System Summary */}
      <div className={styles.analysisSectionGroup}>
        <h4>System Summary</h4>
        <table className={styles.resultsTable}>
          <tbody>
            <tr>
              <td>System Pressure:</td>
              <td className={styles.value}>{systemPressure.toFixed(2)} bar</td>
            </tr>
            <tr>
              <td>System Flow:</td>
              <td className={styles.value}>{systemFlow.toFixed(2)} L/min</td>
            </tr>
            <tr>
              <td>Pump Displacement:</td>
              <td className={styles.value}>{analysisData.pumpDisplacement.toFixed(2)} cm³/rev</td>
            </tr>
            <tr>
              <td>Motor Displacement:</td>
              <td className={styles.value}>{analysisData.motorDisplacement.toFixed(2)} cm³/rev</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pressures */}
      <div className={styles.analysisSectionGroup}>
        <h4>Component Pressures</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>Pressure (bar)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(steadyState.pressures).map(([componentId, pressure]) => (
              <tr key={componentId}>
                <td>{componentId.split('-')[0]}</td>
                <td className={styles.value}>{pressure.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Flows */}
      <div className={styles.analysisSectionGroup}>
        <h4>Component Flows</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>Flow (L/min)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(steadyState.flows).map(([componentId, flow]) => (
              <tr key={componentId}>
                <td>{componentId.split('-')[0]}</td>
                <td className={styles.value}>{flow.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Power Outputs */}
      <div className={styles.analysisSectionGroup}>
        <h4>Component Power</h4>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>Power (W)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(steadyState.powerOutputs).map(([componentId, power]) => (
              <tr key={componentId}>
                <td>{componentId.split('-')[0]}</td>
                <td className={styles.value}>{power.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Energy Analysis */}
      <div className={styles.analysisSectionGroup}>
        <h4>Energy Analysis</h4>
        <table className={styles.resultsTable}>
          <tbody>
            <tr>
              <td>Input Power:</td>
              <td className={styles.value}>{energyAnalysis.inputPower.toFixed(2)} W</td>
            </tr>
            <tr>
              <td>Output Power:</td>
              <td className={styles.value}>{energyAnalysis.outputPower.toFixed(2)} W</td>
            </tr>
            <tr>
              <td>Heat Dissipated:</td>
              <td className={styles.value}>{energyAnalysis.heatDissipated.toFixed(2)} W</td>
            </tr>
            <tr>
              <td>Efficiency:</td>
              <td className={styles.value}>{(energyAnalysis.efficiency * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Fluid Temperature:</td>
              <td className={styles.value}>{energyAnalysis.fluidTemperature.toFixed(1)} K</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Export Buttons */}
      <div className={styles.exportButtons}>
        <button className={styles.exportButton}>
          Export Results
        </button>
        <button className={styles.exportButton}>
          Export CSV
        </button>
      </div>
    </div>
  );
};
