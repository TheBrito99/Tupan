/**
 * Petri Net Analysis Panel
 *
 * Display Petri net analysis results and simulation state
 */

import React from 'react';
import {
  PetriNetEditorData,
  SimulationState,
  AnalysisResult,
} from './types';
import styles from './PetriNetEditor.module.css';

export interface AnalysisPanelProps {
  data: PetriNetEditorData;
  analysisResults?: AnalysisResult;
  simulationState: SimulationState;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  data,
  analysisResults,
  simulationState,
}) => {
  return (
    <div className={styles.analysisPanel}>
      <div className={styles.panelHeader}>Analysis & Simulation</div>

      <div className={styles.panelContent}>
        {/* Simulation State Section */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Simulation State</h4>
          <div className={styles.stateGrid}>
            <div className={styles.stateItem}>
              <label>Time:</label>
              <span>{simulationState.time.toFixed(3)}s</span>
            </div>
            <div className={styles.stateItem}>
              <label>Fired Transitions:</label>
              <span>{simulationState.firedTransitions.length}</span>
            </div>
            <div className={styles.stateItem}>
              <label>Deadlock:</label>
              <span className={simulationState.isDeadlock ? styles.deadlock : styles.ok}>
                {simulationState.isDeadlock ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* Current Marking */}
          <div className={styles.markingTable}>
            <h5>Current Marking</h5>
            <table>
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.places.map(place => (
                  <tr key={place.id}>
                    <td>{place.name}</td>
                    <td>{simulationState.marking[place.id] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Enabled Transitions */}
          <div className={styles.enabledTransitions}>
            <h5>Enabled Transitions</h5>
            {simulationState.enabledTransitions.length > 0 ? (
              <ul>
                {simulationState.enabledTransitions.map(tId => {
                  const trans = data.transitions.find(t => t.id === tId);
                  return <li key={tId}>{trans?.name}</li>;
                })}
              </ul>
            ) : (
              <p className={styles.noData}>None</p>
            )}
          </div>
        </div>

        {/* Analysis Results Section */}
        {analysisResults && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Petri Net Analysis</h4>

            <div className={styles.analysisGrid}>
              <div className={styles.analysisItem}>
                <label>Boundedness:</label>
                <span className={analysisResults.boundedness === 'bounded' ? styles.ok : styles.warning}>
                  {analysisResults.boundedness}
                </span>
              </div>
              <div className={styles.analysisItem}>
                <label>Safe:</label>
                <span className={analysisResults.safeness ? styles.ok : styles.warning}>
                  {analysisResults.safeness ? 'Yes' : 'No'}
                </span>
              </div>
              <div className={styles.analysisItem}>
                <label>Liveness:</label>
                <span className={analysisResults.livenessLevel === 'live' ? styles.ok : styles.warning}>
                  {analysisResults.livenessLevel}
                </span>
              </div>
              <div className={styles.analysisItem}>
                <label>Conservative:</label>
                <span className={analysisResults.conservativeness ? styles.ok : styles.warning}>
                  {analysisResults.conservativeness ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Reachability Graph */}
            {analysisResults.reachabilityGraph && (
              <div className={styles.reachabilitySection}>
                <h5>Reachability Graph</h5>
                <p>States: {analysisResults.reachabilityGraph.states.length}</p>
                <p>Transitions: {analysisResults.reachabilityGraph.edges.length}</p>
              </div>
            )}
          </div>
        )}

        {!analysisResults && (
          <div className={styles.section}>
            <p style={{ color: '#999', fontSize: '12px' }}>
              Run analysis to see Petri net properties (boundedness, liveness, etc.)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
