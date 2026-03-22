/**
 * Simulation Overlay - Display voltage/current on schematic
 *
 * Shows:
 * - Node voltages above components
 * - Wire currents along connections
 * - Component power dissipation
 * - Simulation status and statistics
 */

import React, { useMemo } from 'react';
import { PlacedSymbol, Wire } from '../SchematicEditor/types';
import { Point } from '../../types/geometry';
import styles from './SimulationOverlay.module.css';

export interface SimulationOverlayProps {
  symbols: PlacedSymbol[];
  wires: Wire[];
  nodeVoltages: Record<string, number>;
  componentCurrents: Record<string, number>;
  componentPowers: Record<string, number>;
  visible: boolean;
  viewport?: {
    offsetX: number;
    offsetY: number;
    scale: number;
  };
}

/**
 * Format value with color intensity
 */
function getVoltageColor(voltage: number, maxVoltage: number = 12): string {
  // Clamp to range
  const normalized = Math.max(-1, Math.min(1, voltage / maxVoltage));

  if (normalized > 0) {
    // Positive voltage: green
    return `hsl(120, ${100 * normalized}%, ${50 - 20 * normalized}%)`;
  } else {
    // Negative voltage: blue
    return `hsl(240, ${100 * -normalized}%, ${50 - 20 * -normalized}%)`;
  }
}

/**
 * Format voltage for display
 */
function formatVoltage(voltage: number): string {
  if (Math.abs(voltage) < 0.001) return '0V';
  if (Math.abs(voltage) < 1) return `${(voltage * 1000).toFixed(0)}mV`;
  return `${voltage.toFixed(2)}V`;
}

/**
 * Format current for display
 */
function formatCurrent(current: number): string {
  if (Math.abs(current) < 0.001) return `${(current * 1e6).toFixed(1)}µA`;
  if (Math.abs(current) < 1) return `${(current * 1000).toFixed(2)}mA`;
  return `${current.toFixed(3)}A`;
}

/**
 * Format power for display
 */
function formatPower(power: number): string {
  if (Math.abs(power) < 0.001) return `${(power * 1e6).toFixed(1)}µW`;
  if (Math.abs(power) < 1) return `${(power * 1000).toFixed(2)}mW`;
  return `${power.toFixed(3)}W`;
}

/**
 * Simulation overlay component
 */
export const SimulationOverlay: React.FC<SimulationOverlayProps> = ({
  symbols,
  wires,
  nodeVoltages,
  componentCurrents,
  componentPowers,
  visible,
  viewport = { offsetX: 0, offsetY: 0, scale: 1 },
}) => {
  if (!visible) return null;

  // Calculate maximum values for normalization
  const voltages = Object.values(nodeVoltages) as number[];
  const currents = (Object.values(componentCurrents) as number[]).map(Math.abs);
  const powers = (Object.values(componentPowers) as number[]).map(Math.abs);

  const maxVoltage = Math.max(...voltages, 1);
  const maxCurrent = Math.max(...currents, 1);
  const maxPower = Math.max(...powers, 1);

  return (
    <div className={styles.overlay}>
      {/* Voltage labels on symbols */}
      {symbols.map(symbol => {
        // Get node names for symbol (first and second pins)
        const voltage = nodeVoltages[symbol.id] ?? 0;

        const x = symbol.position.x - viewport.offsetX;
        const y = symbol.position.y - viewport.offsetY - 25;

        return (
          <div
            key={`v_${symbol.id}`}
            className={styles.voltageLabel}
            style={{
              left: `${x * viewport.scale}px`,
              top: `${y * viewport.scale}px`,
              backgroundColor: getVoltageColor(voltage, maxVoltage),
              opacity: 0.8,
            }}
            title={`${symbol.parameters.value || symbol.symbol.name} voltage`}
          >
            {formatVoltage(voltage)}
          </div>
        );
      })}

      {/* Current labels on wires */}
      {wires.map((wire, index) => {
        if (wire.segments.length === 0) return null;

        const current = componentCurrents[wire.id] ?? 0;
        const isHighCurrent = Math.abs(current) > maxCurrent / 2;

        // Use midpoint of first segment for label position
        const segment = wire.segments[Math.floor(wire.segments.length / 2)];
        const x = (segment.start.x + segment.end.x) / 2 - viewport.offsetX;
        const y = (segment.start.y + segment.end.y) / 2 - viewport.offsetY - 12;

        return (
          <div
            key={`i_${wire.id}_${index}`}
            className={styles.currentLabel}
            style={{
              left: `${x * viewport.scale}px`,
              top: `${y * viewport.scale}px`,
              opacity: isHighCurrent ? 1 : 0.6,
              fontWeight: isHighCurrent ? 600 : 400,
            }}
            title={`Current: ${formatCurrent(current)}`}
          >
            {formatCurrent(current)}
          </div>
        );
      })}

      {/* Power dissipation indicators */}
      {symbols.map(symbol => {
        const power = componentPowers[symbol.id] ?? 0;

        if (Math.abs(power) < 0.0001) return null; // Skip very small power

        const x = symbol.position.x + 20 - viewport.offsetX;
        const y = symbol.position.y + 15 - viewport.offsetY;

        const intensity = Math.min(1, Math.abs(power) / maxPower);
        const backgroundColor = power > 0 ? 'rgba(255, 100, 100, 0.7)' : 'rgba(100, 150, 255, 0.7)';

        return (
          <div
            key={`p_${symbol.id}`}
            className={styles.powerIndicator}
            style={{
              left: `${x * viewport.scale}px`,
              top: `${y * viewport.scale}px`,
              width: `${12 + intensity * 8}px`,
              height: `${12 + intensity * 8}px`,
              backgroundColor,
              opacity: 0.6 + intensity * 0.4,
            }}
            title={`Power: ${formatPower(power)}`}
          />
        );
      })}
    </div>
  );
};

/**
 * Simulation Statistics Panel
 */
export interface SimulationStatsPanelProps {
  visible: boolean;
  nodeVoltages: Record<string, number>;
  componentCurrents: Record<string, number>;
  componentPowers: Record<string, number>;
}

export const SimulationStatsPanel: React.FC<SimulationStatsPanelProps> = ({
  visible,
  nodeVoltages,
  componentCurrents,
  componentPowers,
}) => {
  const stats = useMemo(() => {
    const voltages = Object.values(nodeVoltages) as number[];
    const currents = (Object.values(componentCurrents) as number[]).map(Math.abs);
    const powers = Object.values(componentPowers) as number[];

    const totalPower = powers.reduce((sum, p) => sum + (p as number), 0);
    const dissipatedPower = powers.filter(p => (p as number) > 0).reduce((sum, p) => sum + (p as number), 0);

    return {
      nodes: voltages.length,
      components: currents.length,
      maxVoltage: Math.max(...voltages, 0),
      minVoltage: Math.min(...voltages, 0),
      maxCurrent: Math.max(...currents, 0),
      totalPower,
      dissipatedPower,
      efficiency: totalPower > 0 ? (dissipatedPower / Math.abs(totalPower)) * 100 : 0,
    };
  }, [nodeVoltages, componentCurrents, componentPowers]);

  if (!visible) return null;

  return (
    <div className={styles.statsPanel}>
      <h3>Simulation Results</h3>

      <div className={styles.statsGroup}>
        <div className={styles.statItem}>
          <span className={styles.label}>Nodes:</span>
          <span className={styles.value}>{stats.nodes}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>Components:</span>
          <span className={styles.value}>{stats.components}</span>
        </div>
      </div>

      <div className={styles.statsGroup}>
        <div className={styles.statItem}>
          <span className={styles.label}>Max Voltage:</span>
          <span className={styles.value}>{formatVoltage(stats.maxVoltage)}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>Min Voltage:</span>
          <span className={styles.value}>{formatVoltage(stats.minVoltage)}</span>
        </div>
      </div>

      <div className={styles.statsGroup}>
        <div className={styles.statItem}>
          <span className={styles.label}>Max Current:</span>
          <span className={styles.value}>{formatCurrent(stats.maxCurrent)}</span>
        </div>
      </div>

      <div className={styles.statsGroup}>
        <div className={styles.statItem}>
          <span className={styles.label}>Total Power:</span>
          <span className={styles.value}>{formatPower(stats.totalPower)}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>Dissipated:</span>
          <span className={styles.value}>{formatPower(stats.dissipatedPower)}</span>
        </div>
      </div>

      <div className={styles.statsGroup}>
        <div className={styles.statItem}>
          <span className={styles.label}>Efficiency:</span>
          <span className={styles.value}>{stats.efficiency.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default SimulationOverlay;
