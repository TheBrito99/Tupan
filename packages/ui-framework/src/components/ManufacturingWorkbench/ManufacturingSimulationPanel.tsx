/**
 * Manufacturing Simulation Panel - Real-time Analysis
 * Phase 19 Task 6: CAM UI & Integration
 *
 * Displays cutting forces, spindle load, and thermal analysis
 * Integrated with ManufacturingBridge for real calculations
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styles from './ManufacturingSimulationPanel.module.css';
import {
  initializeManufacturingBridge,
  ManufacturingBridge,
  type ManufacturingSimulationRequest,
} from '@tupan/core-ts';

export interface SimulationResult {
  cutting_forces: {
    tangential_force: number; // N
    feed_force: number; // N
    radial_force: number; // N
    total_force: number; // N
    cutting_power: number; // W
  };
  spindle_load: {
    load_percentage: number; // 0-100%
    spindle_torque: number; // N·m
    power_margin: number; // W
    thermal_load: number; // °C above ambient
  };
  thermal_analysis: {
    chip_temperature: number; // °C
    tool_temperature: number; // °C
    workpiece_temperature: number; // °C
    tool_life_ratio: number; // 0-1 (consumed)
    thermal_risk: 'Safe' | 'Caution' | 'Critical' | 'Failure';
  };
}

interface Props {
  activeJob?: any;
  onRunSimulation?: () => void;
}

export const ManufacturingSimulationPanel: React.FC<Props> = ({ activeJob, onRunSimulation }) => {
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'forces' | 'spindle' | 'thermal'>('forces');
  const [bridge, setBridge] = useState<ManufacturingBridge | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize manufacturing bridge on mount
  useEffect(() => {
    const init = async () => {
      try {
        const manufacturingBridge = await initializeManufacturingBridge();
        setBridge(manufacturingBridge);
      } catch (err) {
        console.warn('Failed to initialize manufacturing bridge:', err);
        // Bridge will still work with mock implementations
      }
    };

    init();
  }, []);

  const handleRunSimulation = useCallback(async () => {
    if (!activeJob || !bridge) return;

    setIsRunning(true);
    setError(null);

    try {
      // Extract parameters from activeJob
      const jobParams = activeJob.parameters || {};
      const geometry = activeJob.geometry || {};

      // Create simulation request
      const simulationRequest: ManufacturingSimulationRequest = {
        cuttingForces: {
          material: jobParams.material || 'Steel',
          feedPerTooth: jobParams.feedPerTooth || 0.1,
          depthOfCut: jobParams.depthOfCut || 2.0,
          cuttingSpeed: jobParams.cuttingSpeed || 150,
          fluteCount: jobParams.fluteCount || 2,
        },
        spindleLoad: {
          cuttingPower: jobParams.cuttingPower || 1000,
          spindleSpec: jobParams.spindleSpec || 'generic_3hp',
          spindleSpeed: jobParams.spindleSpeed || 3000,
        },
        thermal: {
          workpieceMaterial: jobParams.material || 'Steel',
          toolMaterial: jobParams.toolMaterial || 'Carbide',
          cuttingPower: jobParams.cuttingPower || 1000,
          chipArea: geometry.chipArea || 10.0,
          cuttingTimeSec: jobParams.cuttingTimeSec || 60,
          ambientTemp: jobParams.ambientTemp || 25,
          coolantAvailable: jobParams.coolantAvailable !== false,
        },
      };

      // Run simulation
      const result = bridge.simulateManufacturing(simulationRequest);

      // Convert bridge result to UI format
      const uiResult: SimulationResult = {
        cutting_forces: {
          tangential_force: result.cuttingForces?.force || 0,
          feed_force: result.cuttingForces?.feedForce || 0,
          radial_force: result.cuttingForces?.radialForce || 0,
          total_force: result.cuttingForces?.force || 0,
          cutting_power: result.cuttingForces?.cuttingPower || 0,
        },
        spindle_load: {
          load_percentage: result.spindleLoad?.loadPercentage || 0,
          spindle_torque: result.spindleLoad?.torque || 0,
          power_margin: result.spindleLoad?.powerMargin || 0,
          thermal_load: result.spindleLoad?.thermalLoad || 0,
        },
        thermal_analysis: {
          chip_temperature: result.thermal?.chipTemperature || 0,
          tool_temperature: result.thermal?.toolTemperature || 0,
          workpiece_temperature: result.thermal?.workpieceTemperature || 0,
          tool_life_ratio: result.thermal?.toolLifeRatio || 0,
          thermal_risk: (result.thermal?.thermalRisk as any) || 'Safe',
        },
      };

      setSimulation(uiResult);

      if (onRunSimulation) {
        onRunSimulation();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during simulation';
      setError(errorMsg);
      console.error('Simulation error:', err);
    } finally {
      setIsRunning(false);
    }
  }, [activeJob, bridge, onRunSimulation]);

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'Safe':
        return '#4caf50';
      case 'Caution':
        return '#ff9800';
      case 'Critical':
        return '#f44336';
      case 'Failure':
        return '#b71c1c';
      default:
        return '#666';
    }
  };

  const getLoadBarColor = (percentage: number): string => {
    if (percentage < 60) return '#4caf50';
    if (percentage < 80) return '#ff9800';
    return '#f44336';
  };

  const ProgressBar: React.FC<{ value: number; max: number; label: string }> = ({
    value,
    max,
    label,
  }) => {
    const percentage = (value / max) * 100;
    return (
      <div className={styles.progressGroup}>
        <div className={styles.progressLabel}>
          <span>{label}</span>
          <span className={styles.value}>{value.toFixed(1)}</span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: getLoadBarColor(percentage),
            }}
          />
        </div>
        <small>{percentage.toFixed(0)}% of max</small>
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <h2>Manufacturing Simulation</h2>

      {!activeJob && (
        <div className={styles.noJob}>
          <p>No active manufacturing job selected.</p>
          <p>Create a job from FDM or CNC tab to enable simulation.</p>
        </div>
      )}

      {activeJob && (
        <div className={styles.content}>
          {/* Simulation Control */}
          <section className={styles.controlSection}>
            <button
              className={`${styles.runBtn} ${isRunning ? styles.running : ''}`}
              onClick={handleRunSimulation}
              disabled={isRunning || !bridge}
            >
              {isRunning ? '⏳ Running Simulation...' : '▶ Run Simulation'}
            </button>
            <small>
              {bridge
                ? 'Analyzes cutting forces, spindle load, and thermal effects'
                : 'Initializing manufacturing bridge...'}
            </small>

            {error && (
              <div className={styles.errorBox} style={{ marginTop: '10px', padding: '10px', backgroundColor: '#ffebee', border: '1px solid #f44336', borderRadius: '4px', color: '#c62828' }}>
                <strong>Error:</strong> {error}
              </div>
            )}
          </section>

          {simulation && (
            <>
              {/* Tabs */}
              <div className={styles.tabBar}>
                <button
                  className={`${styles.tab} ${activeTab === 'forces' ? styles.active : ''}`}
                  onClick={() => setActiveTab('forces')}
                >
                  ⚡ Cutting Forces
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'spindle' ? styles.active : ''}`}
                  onClick={() => setActiveTab('spindle')}
                >
                  🔧 Spindle Load
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'thermal' ? styles.active : ''}`}
                  onClick={() => setActiveTab('thermal')}
                >
                  🌡️ Thermal Analysis
                </button>
              </div>

              {/* Cutting Forces Tab */}
              {activeTab === 'forces' && (
                <section className={styles.tabContent}>
                  <h3>Cutting Forces</h3>

                  <div className={styles.forceCard}>
                    <h4>Force Components</h4>
                    <ProgressBar
                      label="Tangential (Primary)"
                      value={simulation.cutting_forces.tangential_force}
                      max={1500}
                    />
                    <ProgressBar
                      label="Feed Force"
                      value={simulation.cutting_forces.feed_force}
                      max={500}
                    />
                    <ProgressBar
                      label="Radial Force"
                      value={simulation.cutting_forces.radial_force}
                      max={800}
                    />
                  </div>

                  <div className={styles.forceCard}>
                    <h4>Power & Performance</h4>
                    <div className={styles.statRow}>
                      <span className={styles.label}>Total Force:</span>
                      <span className={styles.stat}>{simulation.cutting_forces.total_force.toFixed(0)} N</span>
                    </div>
                    <div className={styles.statRow}>
                      <span className={styles.label}>Cutting Power:</span>
                      <span className={styles.stat}>{simulation.cutting_forces.cutting_power.toFixed(0)} W</span>
                    </div>
                  </div>

                  <div className={styles.infoBox}>
                    <p>
                      <strong>Interpretation:</strong> Cutting forces depend on material hardness, tool
                      geometry, and cutting parameters. Higher speeds typically reduce cutting force.
                    </p>
                    <p>
                      <strong>Optimization:</strong> Use feed rate and depth of cut sliders in CNC tab to
                      reduce forces if spindle load is high.
                    </p>
                  </div>
                </section>
              )}

              {/* Spindle Load Tab */}
              {activeTab === 'spindle' && (
                <section className={styles.tabContent}>
                  <h3>Spindle Load Analysis</h3>

                  <div className={styles.loadCard}>
                    <h4>Machine Load</h4>
                    <div className={styles.largeGauge}>
                      <div
                        className={styles.gaugeValue}
                        style={{
                          color: getLoadBarColor(simulation.spindle_load.load_percentage),
                        }}
                      >
                        {simulation.spindle_load.load_percentage.toFixed(0)}%
                      </div>
                      <div className={styles.gaugeSub}>Load of Spindle Capacity</div>
                    </div>

                    <ProgressBar
                      label="Spindle Load"
                      value={simulation.spindle_load.load_percentage}
                      max={100}
                    />
                  </div>

                  <div className={styles.loadCard}>
                    <h4>Machine Capacity</h4>
                    <div className={styles.statRow}>
                      <span className={styles.label}>Spindle Torque:</span>
                      <span className={styles.stat}>{simulation.spindle_load.spindle_torque.toFixed(1)} N·m</span>
                    </div>
                    <div className={styles.statRow}>
                      <span className={styles.label}>Power Margin:</span>
                      <span className={styles.stat}>{simulation.spindle_load.power_margin.toFixed(0)} W</span>
                    </div>
                    <div className={styles.statRow}>
                      <span className={styles.label}>Thermal Load:</span>
                      <span className={styles.stat}>{simulation.spindle_load.thermal_load.toFixed(0)}°C rise</span>
                    </div>
                  </div>

                  <div className={styles.recommendationBox}>
                    {simulation.spindle_load.load_percentage > 85 && (
                      <p style={{ color: '#f44336' }}>
                        ⚠️ <strong>HIGH LOAD:</strong> Consider reducing feed rate or increasing spindle speed
                        to stay within safe limits.
                      </p>
                    )}
                    {simulation.spindle_load.load_percentage <= 85 && (
                      <p style={{ color: '#4caf50' }}>
                        ✓ <strong>SAFE:</strong> Machine load is within safe operating limits with margin for
                        safety.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Thermal Analysis Tab */}
              {activeTab === 'thermal' && (
                <section className={styles.tabContent}>
                  <h3>Thermal Analysis</h3>

                  <div className={styles.thermalCard}>
                    <h4>Temperature Distribution</h4>
                    <div
                      className={styles.tempIndicator}
                      style={{ backgroundColor: '#ff6b6b' }}
                    >
                      <div className={styles.tempLabel}>Chip Temp</div>
                      <div className={styles.tempValue}>
                        {simulation.thermal_analysis.chip_temperature.toFixed(0)}°C
                      </div>
                    </div>
                    <div
                      className={styles.tempIndicator}
                      style={{ backgroundColor: '#ffa94d' }}
                    >
                      <div className={styles.tempLabel}>Tool Temp</div>
                      <div className={styles.tempValue}>
                        {simulation.thermal_analysis.tool_temperature.toFixed(0)}°C
                      </div>
                    </div>
                    <div
                      className={styles.tempIndicator}
                      style={{ backgroundColor: '#74c0fc' }}
                    >
                      <div className={styles.tempLabel}>Workpiece Temp</div>
                      <div className={styles.tempValue}>
                        {simulation.thermal_analysis.workpiece_temperature.toFixed(0)}°C
                      </div>
                    </div>
                  </div>

                  <div className={styles.thermalCard}>
                    <h4>Tool Life Assessment</h4>
                    <ProgressBar
                      label="Tool Life Consumed"
                      value={simulation.thermal_analysis.tool_life_ratio * 100}
                      max={100}
                    />
                    <div className={styles.riskIndicator}>
                      <div
                        className={styles.riskBadge}
                        style={{
                          backgroundColor: getRiskColor(simulation.thermal_analysis.thermal_risk),
                        }}
                      >
                        {simulation.thermal_analysis.thermal_risk}
                      </div>
                    </div>
                  </div>

                  <div className={styles.infoBox}>
                    <p>
                      <strong>Thermal Effects:</strong> Higher cutting speeds and depths generate more heat,
                      reducing tool life dramatically (Arrhenius model).
                    </p>
                    <p>
                      <strong>Coolant Strategy:</strong> Use flood coolant for steel/titanium, mist for
                      aluminum, or through-spindle for hardened materials.
                    </p>
                    {simulation.thermal_analysis.thermal_risk !== 'Safe' && (
                      <p style={{ color: '#f44336' }}>
                        ⚠️ <strong>Thermal Risk Detected:</strong> Consider using coolant or reducing cutting
                        speed to extend tool life.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {!simulation && !isRunning && (
            <div className={styles.emptyState}>
              <p>Click "Run Simulation" to analyze cutting forces, spindle load, and thermal effects.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManufacturingSimulationPanel;
