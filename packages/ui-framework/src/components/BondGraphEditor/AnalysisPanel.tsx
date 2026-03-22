/**
 * Bond Graph Analysis Panel
 *
 * Displays simulation results and analysis:
 * - Power flow statistics
 * - Energy conservation verification
 * - Element energy dissipation/storage
 * - System performance metrics
 * - Historical data plots
 */

import React, { useMemo } from 'react';
import type { EditorElement, EditorBond } from './types';
import type { PerformanceMetrics, SimulationSnapshot } from '@tupan/core-ts/wasm-bridge';
import styles from './BondGraphEditor.module.css';

export interface AnalysisPanelProps {
  elements: EditorElement[];
  bonds: EditorBond[];
  history: SimulationSnapshot[];
  currentMetrics?: PerformanceMetrics;
  elementValues: Map<string, number>;
  bondPowers: Map<string, number>;
  isRunning: boolean;
  onExportData?: () => void;
}

interface EnergyAnalysis {
  totalInputPower: number;
  totalDissipation: number;
  totalStorageRate: number;
  energyBalance: number; // Should be ~0 for energy conservation
  elementDissipation: Map<string, number>;
  elementStorage: Map<string, number>;
}

/**
 * Analyze energy flow and conservation
 */
function analyzeEnergy(
  bonds: EditorBond[],
  bondPowers: Map<string, number>,
  elements: EditorElement[],
  elementValues: Map<string, number>
): EnergyAnalysis {
  let totalInputPower = 0;
  let totalDissipation = 0;
  let totalStorageRate = 0;

  const elementDissipation = new Map<string, number>();
  const elementStorage = new Map<string, number>();

  // Accumulate power at each element
  bonds.forEach((bond) => {
    const power = bondPowers.get(bond.id) ?? 0;

    // Power entering element
    const fromElement = elements.find((e) => e.id === bond.from);
    const toElement = elements.find((e) => e.id === bond.to);

    if (fromElement) {
      elementDissipation.set(
        bond.from,
        (elementDissipation.get(bond.from) ?? 0) + power
      );
    }

    if (toElement) {
      elementDissipation.set(
        bond.to,
        (elementDissipation.get(bond.to) ?? 0) - power
      );
    }
  });

  // Categorize power by element type
  elements.forEach((element) => {
    const power = elementDissipation.get(element.id) ?? 0;

    switch (element.type) {
      case 'Se':
      case 'Sf':
        // Sources contribute to input
        if (power > 0) totalInputPower += power;
        break;

      case 'R':
        // Resistors dissipate
        totalDissipation += Math.abs(power);
        elementDissipation.set(element.id, Math.abs(power));
        break;

      case 'C':
      case 'I':
        // Storage elements
        totalStorageRate += power;
        elementStorage.set(element.id, power);
        break;
    }
  });

  const energyBalance = totalInputPower - totalDissipation - totalStorageRate;

  return {
    totalInputPower,
    totalDissipation,
    totalStorageRate,
    energyBalance: Math.abs(energyBalance),
    elementDissipation,
    elementStorage,
  };
}

export function AnalysisPanel({
  elements,
  bonds,
  history,
  currentMetrics,
  elementValues,
  bondPowers,
  isRunning,
  onExportData,
}: AnalysisPanelProps) {
  const energy = useMemo(
    () => analyzeEnergy(bonds, bondPowers, elements, elementValues),
    [bonds, bondPowers, elements, elementValues]
  );

  const maxPower = useMemo(() => {
    let max = 0;
    bondPowers.forEach((power) => {
      max = Math.max(max, Math.abs(power));
    });
    return max;
  }, [bondPowers]);

  const isBalanced = energy.energyBalance < maxPower * 0.05; // Within 5% tolerance

  return (
    <div className={styles.analysisPanel}>
      <div className={styles.panelHeader}>
        <h3>Analysis & Energy</h3>
        {onExportData && (
          <button onClick={onExportData} className={styles.exportButton}>
            Export
          </button>
        )}
      </div>

      {/* Energy Conservation Status */}
      <section className={styles.energySection}>
        <h4>Energy Conservation</h4>

        <div className={styles.energyStatus}>
          <div
            className={`${styles.statusIndicator} ${
              isBalanced ? styles.balanced : styles.unbalanced
            }`}
          >
            {isBalanced ? '✓ Balanced' : '⚠ Imbalanced'}
          </div>
          <span className={styles.statusText}>
            Error: {(energy.energyBalance * 100).toFixed(2)}%
          </span>
        </div>

        <div className={styles.energyBreakdown}>
          <div className={styles.energyItem}>
            <label>Input Power</label>
            <span className={styles.value}>{energy.totalInputPower.toFixed(2)} W</span>
          </div>

          <div className={styles.energyItem}>
            <label>Dissipation</label>
            <span className={styles.valueNegative}>{energy.totalDissipation.toFixed(2)} W</span>
          </div>

          <div className={styles.energyItem}>
            <label>Storage Rate</label>
            <span className={energy.totalStorageRate > 0 ? styles.valuePositive : styles.valueNegative}>
              {energy.totalStorageRate > 0 ? '+' : ''}{energy.totalStorageRate.toFixed(2)} W
            </span>
          </div>

          <div className={styles.energyItem}>
            <label>Balance</label>
            <span className={isBalanced ? styles.valueBalanced : styles.valueImbalanced}>
              {energy.energyBalance.toFixed(3)} W
            </span>
          </div>
        </div>
      </section>

      {/* Power Flow by Bond */}
      <section className={styles.powerSection}>
        <h4>Power Flow ({bonds.length} bonds)</h4>

        <div className={styles.powerList}>
          {Array.from(bondPowers.entries())
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 8)
            .map(([bondId, power]) => {
              const bond = bonds.find((b) => b.id === bondId);
              if (!bond) return null;

              const fromElem = elements.find((e) => e.id === bond.from);
              const toElem = elements.find((e) => e.id === bond.to);

              return (
                <div key={bondId} className={styles.powerItem}>
                  <div className={styles.powerLabel}>
                    {fromElem?.type} → {toElem?.type}
                  </div>
                  <div className={styles.powerBar}>
                    <div
                      className={`${styles.powerFill} ${
                        power > 0 ? styles.positive : styles.negative
                      }`}
                      style={{
                        width: `${Math.min(Math.abs(power) / maxPower, 1) * 100}%`,
                      }}
                    />
                  </div>
                  <div className={styles.powerValue}>
                    {power > 0 ? '+' : ''}{power.toFixed(2)} W
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Element Energy Dissipation */}
      {Array.from(energy.elementDissipation.entries()).some(([_, p]) => p > 0.01) && (
        <section className={styles.dissipationSection}>
          <h4>Element Dissipation</h4>

          <div className={styles.dissipationList}>
            {Array.from(energy.elementDissipation.entries())
              .filter(([_, power]) => power > 0.01)
              .sort((a, b) => b[1] - a[1])
              .map(([elementId, power]) => {
                const element = elements.find((e) => e.id === elementId);
                if (!element) return null;

                return (
                  <div key={elementId} className={styles.dissipationItem}>
                    <div className={styles.dissipationLabel}>
                      {element.type} (ID: {elementId.slice(0, 8)})
                    </div>
                    <div className={styles.dissipationBar}>
                      <div
                        className={styles.dissipationFill}
                        style={{
                          width: `${Math.min(power / energy.totalDissipation, 1) * 100}%`,
                        }}
                      />
                    </div>
                    <div className={styles.dissipationValue}>
                      {power.toFixed(3)} W
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Performance Metrics */}
      {currentMetrics && (
        <section className={styles.metricsSection}>
          <h4>Performance</h4>

          <div className={styles.metricsList}>
            <div className={styles.metricItem}>
              <label>Simulation Time</label>
              <span>{currentMetrics.simulationTime.toFixed(3)}s</span>
            </div>

            <div className={styles.metricItem}>
              <label>Real Time</label>
              <span>{(currentMetrics.wallClockTime / 1000).toFixed(2)}s</span>
            </div>

            <div className={styles.metricItem}>
              <label>Speed Ratio</label>
              <span>
                {(currentMetrics.simulationTime / (currentMetrics.wallClockTime / 1000)).toFixed(1)}x
              </span>
            </div>

            <div className={styles.metricItem}>
              <label>Total Steps</label>
              <span>{currentMetrics.totalSteps}</span>
            </div>

            <div className={styles.metricItem}>
              <label>Avg Step Time</label>
              <span>{currentMetrics.averageStepTime.toFixed(3)}ms</span>
            </div>

            <div className={styles.metricItem}>
              <label>Display FPS</label>
              <span
                className={
                  currentMetrics.fps > 55
                    ? styles.fpsGood
                    : currentMetrics.fps > 30
                      ? styles.fpsFair
                      : styles.fpsPoor
                }
              >
                {currentMetrics.fps.toFixed(1)}
              </span>
            </div>

            <div className={styles.metricItem}>
              <label>CPU Load</label>
              <span
                className={
                  currentMetrics.cpuLoad < 50
                    ? styles.cpuLow
                    : currentMetrics.cpuLoad < 80
                      ? styles.cpuMedium
                      : styles.cpuHigh
                }
              >
                {currentMetrics.cpuLoad.toFixed(1)}%
              </span>
            </div>

            <div className={styles.metricItem}>
              <label>Max Error</label>
              <span>{currentMetrics.maxError.toExponential(2)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Historical Data Info */}
      {history.length > 0 && (
        <section className={styles.historySection}>
          <h4>History</h4>

          <div className={styles.historyStats}>
            <div className={styles.historyStat}>
              <label>Points Recorded</label>
              <span>{history.length}</span>
            </div>

            {history.length > 1 && (
              <>
                <div className={styles.historyStat}>
                  <label>Time Range</label>
                  <span>
                    {history[0].time.toFixed(3)}s - {history[history.length - 1].time.toFixed(3)}s
                  </span>
                </div>

                <div className={styles.historyStat}>
                  <label>Avg Interval</label>
                  <span>
                    {(
                      (history[history.length - 1].time - history[0].time) /
                      (history.length - 1)
                    ).toFixed(4)}s
                  </span>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default AnalysisPanel;
