/**
 * Simulation Control Panel
 *
 * User interface for controlling real-time simulations:
 * - Play/pause/stop/reset buttons
 * - Speed multiplier slider (0.1x to 10x)
 * - Simulation duration input
 * - Results export/save
 * - Recording toggle
 * - Real-time simulation time display
 *
 * Integration:
 * - Controls SimulationEngine (Task 5)
 * - Receives metrics from SimulationEngine
 * - Triggers visualization updates in Canvas (Task 6)
 */

import React, { useState, useCallback } from 'react';
import type { PerformanceMetrics } from '@tupan/core-ts/wasm-bridge';
import styles from './BondGraphEditor.module.css';

export interface SimulationControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  speedMultiplier: number;
  recordHistory: boolean;
  performanceMetrics?: PerformanceMetrics;

  // Control callbacks
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onDurationChange: (duration: number) => void;
  onRecordToggle: (enabled: boolean) => void;
  onExport: () => void;
}

export function SimulationControls({
  isRunning,
  isPaused,
  currentTime,
  duration,
  speedMultiplier,
  recordHistory,
  performanceMetrics,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onSpeedChange,
  onDurationChange,
  onRecordToggle,
  onExport,
}: SimulationControlsProps) {
  const [durationInput, setDurationInput] = useState(duration.toString());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle duration input changes
  const handleDurationChange = useCallback(
    (value: string) => {
      setDurationInput(value);
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) {
        onDurationChange(parsed);
      }
    },
    [onDurationChange]
  );

  // Format time for display
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs.toFixed(2)}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs.toFixed(2)}s`;
    } else {
      return `${secs.toFixed(2)}s`;
    }
  };

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Determine simulation status color
  const statusColor = isRunning && !isPaused ? '#4caf50' : isPaused ? '#ff9800' : '#999';

  return (
    <div className={styles.controlPanel}>
      {/* Status and Time Display */}
      <section className={styles.statusSection}>
        <div className={styles.statusBar}>
          <div
            className={styles.statusIndicatorControl}
            style={{ backgroundColor: statusColor }}
            title={isRunning && !isPaused ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
          />
          <span className={styles.statusText}>
            {isRunning && !isPaused ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
          </span>
        </div>

        {/* Time and Progress */}
        <div className={styles.timeDisplay}>
          <div className={styles.timeItem}>
            <label>Simulation Time</label>
            <span className={styles.timeValue}>{formatTime(currentTime)}</span>
          </div>

          <div className={styles.timeItem}>
            <label>Duration</label>
            <span className={styles.timeValue}>{formatTime(duration)}</span>
          </div>

          <div className={styles.timeItem}>
            <label>Progress</label>
            <span className={styles.timeValue}>{progress.toFixed(1)}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: `${progress}%`,
              backgroundColor: isRunning && !isPaused ? '#4caf50' : '#1976d2',
            }}
          />
        </div>
      </section>

      {/* Playback Controls */}
      <section className={styles.playbackSection}>
        <div className={styles.buttonGroup}>
          {!isRunning ? (
            <button
              onClick={onStart}
              className={`${styles.button} ${styles.primary}`}
              title="Start simulation"
            >
              ▶ Start
            </button>
          ) : isPaused ? (
            <button
              onClick={onResume}
              className={`${styles.button} ${styles.primary}`}
              title="Resume simulation"
            >
              ▶ Resume
            </button>
          ) : (
            <button
              onClick={onPause}
              className={`${styles.button}`}
              title="Pause simulation"
            >
              ⏸ Pause
            </button>
          )}

          <button
            onClick={onStop}
            className={`${styles.button} ${styles.danger}`}
            disabled={!isRunning}
            title="Stop simulation"
          >
            ⏹ Stop
          </button>

          <button
            onClick={onReset}
            className={`${styles.button}`}
            disabled={!isRunning && currentTime === 0}
            title="Reset to initial state"
          >
            ↻ Reset
          </button>
        </div>
      </section>

      {/* Speed Control */}
      <section className={styles.speedSection}>
        <div className={styles.speedControl}>
          <label htmlFor="speed-slider">Simulation Speed</label>

          <div className={styles.sliderContainer}>
            <span className={styles.sliderLabel}>0.1x</span>

            <input
              id="speed-slider"
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={speedMultiplier}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className={styles.slider}
              title={`${speedMultiplier}x speed`}
            />

            <span className={styles.sliderLabel}>10x</span>
          </div>

          <div className={styles.speedValue}>
            <strong>{speedMultiplier.toFixed(1)}x</strong> speed
          </div>
        </div>
      </section>

      {/* Duration Input */}
      <section className={styles.durationSection}>
        <label htmlFor="duration-input">Simulation Duration (seconds)</label>

        <div className={styles.durationInput}>
          <input
            id="duration-input"
            type="number"
            min="0.001"
            max="10000"
            step="0.1"
            value={durationInput}
            onChange={(e) => handleDurationChange(e.target.value)}
            disabled={isRunning}
            className={styles.propertyInput}
            title="Total simulation time"
          />
          <button
            onClick={() => onDurationChange(parseFloat(durationInput))}
            className={`${styles.button}`}
            disabled={isRunning}
            title="Apply duration"
          >
            Apply
          </button>
        </div>
      </section>

      {/* Recording Toggle */}
      <section className={styles.recordingSection}>
        <label htmlFor="record-toggle" className={styles.checkboxLabel}>
          <input
            id="record-toggle"
            type="checkbox"
            checked={recordHistory}
            onChange={(e) => onRecordToggle(e.target.checked)}
            disabled={isRunning}
            className={styles.checkbox}
          />
          <span>Record history for analysis</span>
        </label>

        <p className={styles.recordingHint}>
          {recordHistory
            ? '📊 Storing simulation data for plotting'
            : '⊘ Not recording (save memory for long simulations)'}
        </p>
      </section>

      {/* Advanced Options */}
      <section className={styles.advancedSection}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`${styles.button}`}
        >
          {showAdvanced ? '▼ Advanced ▼' : '▶ Advanced ▶'}
        </button>

        {showAdvanced && (
          <div className={styles.advancedOptions}>
            <div className={styles.advancedOption}>
              <label>Solver Step Size</label>
              <p className={styles.advancedHint}>
                Automatically selected based on system stiffness. Smaller steps = higher accuracy
                but slower speed.
              </p>
            </div>

            <div className={styles.advancedOption}>
              <label>Performance Target</label>
              <p className={styles.advancedHint}>
                System targets 60 FPS. If CPU usage is high, reduce speed multiplier or uncheck
                history recording.
              </p>
            </div>

            <div className={styles.advancedOption}>
              <label>History Memory</label>
              <p className={styles.advancedHint}>
                Enabled: Records every step (memory intensive). Disabled: Only computes, doesn't
                store.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Export Section */}
      <section className={styles.exportSection}>
        <button
          onClick={onExport}
          className={`${styles.button} ${styles.success}`}
          disabled={currentTime === 0}
          title="Export simulation results"
        >
          💾 Export Results
        </button>

        <p className={styles.exportHint}>
          {currentTime > 0
            ? `✓ Ready to export ${formatTime(currentTime)} of simulation data`
            : 'Run simulation to enable export'}
        </p>
      </section>

      {/* Performance Display */}
      {performanceMetrics && (
        <section className={styles.performanceSection}>
          <h4>Live Performance</h4>

          <div className={styles.metricRow}>
            <span>FPS:</span>
            <span
              className={
                performanceMetrics.fps > 55
                  ? styles.fpsGood
                  : performanceMetrics.fps > 30
                    ? styles.fpsFair
                    : styles.fpsPoor
              }
            >
              {performanceMetrics.fps.toFixed(1)}
            </span>
          </div>

          <div className={styles.metricRow}>
            <span>CPU:</span>
            <span
              className={
                performanceMetrics.cpuLoad < 50
                  ? styles.cpuLow
                  : performanceMetrics.cpuLoad < 80
                    ? styles.cpuMedium
                    : styles.cpuHigh
              }
            >
              {performanceMetrics.cpuLoad.toFixed(1)}%
            </span>
          </div>

          <div className={styles.metricRow}>
            <span>Steps/s:</span>
            <span>{performanceMetrics.stepsPerSecond.toFixed(0)}</span>
          </div>

          <div className={styles.metricRow}>
            <span>Speedup:</span>
            <span>{(performanceMetrics.simulationTime / (performanceMetrics.wallClockTime / 1000)).toFixed(1)}x</span>
          </div>
        </section>
      )}
    </div>
  );
}

export default SimulationControls;
