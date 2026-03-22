/**
 * Analysis Results Visualization Component
 *
 * Displays electrical circuit analysis results with interactive plots:
 * - DC operating point (node voltages)
 * - Transient analysis (voltage waveforms over time)
 * - Circuit statistics and diagnostics
 * - Power dissipation calculations
 */

import React, { useState, useEffect } from 'react';
import styles from './AnalysisResults.module.css';

/**
 * DC Analysis Result
 */
export interface DcResult {
  analysisType: 'DC';
  nodeVoltages: number[];
  simulationTime: number;
}

/**
 * Transient Analysis Result
 */
export interface TransientResult {
  analysisType: 'TRANSIENT';
  duration: number;
  timeStep: number;
  timeVector: number[];
  nodeVoltages: number[][];
  stepCount: number;
}

/**
 * Circuit statistics
 */
export interface CircuitStats {
  totalNodes: number;
  floatingNodes: number;
  connectedNodes: number;
  totalResistors: number;
  totalCapacitors: number;
  totalInductors: number;
  totalSources: number;
}

export type AnalysisResult = DcResult | TransientResult;

export interface AnalysisResultsProps {
  result?: AnalysisResult;
  stats?: CircuitStats;
  loading?: boolean;
  error?: string;
  onClose?: () => void;
}

/**
 * Node Voltage Display Component
 */
const NodeVoltageTable: React.FC<{ voltages: number[] }> = ({ voltages }) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className={styles.voltageTable}>
      <div className={styles.tableHeader}>
        <h3>Node Voltages</h3>
        <span className={styles.nodeCount}>{voltages.length} nodes</span>
      </div>

      <div className={styles.tableContent}>
        {voltages.map((voltage, idx) => (
          <div
            key={idx}
            className={`${styles.tableRow} ${expandedRows.has(idx) ? styles.expanded : ''}`}
            onClick={() => toggleRow(idx)}
          >
            <div className={styles.nodeLabel}>
              <span className={styles.nodeId}>Node {idx}</span>
            </div>
            <div className={styles.nodeValue}>
              <span className={styles.voltage}>{voltage.toFixed(6)}</span>
              <span className={styles.unit}>V</span>
            </div>
            <div className={styles.voltageBar}>
              <div
                className={styles.bar}
                style={{
                  width: `${Math.abs(voltage) > 0 ? (voltage / Math.max(...voltages.map(Math.abs))) * 100 : 0}%`,
                  backgroundColor: voltage >= 0 ? '#4caf50' : '#f44336',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.statistics}>
        <div className={styles.stat}>
          <span className={styles.label}>Max:</span>
          <span className={styles.value}>{Math.max(...voltages).toFixed(3)} V</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Min:</span>
          <span className={styles.value}>{Math.min(...voltages).toFixed(3)} V</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Avg:</span>
          <span className={styles.value}>
            {(voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(3)} V
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Transient Waveform Plot Component
 * Uses simple SVG rendering for waveforms (can be extended with Plotly)
 */
const WaveformPlot: React.FC<{ timeVector: number[]; voltages: number[][]; nodeIndex?: number }> = ({
  timeVector,
  voltages,
  nodeIndex = 0,
}) => {
  const padding = 40;
  const width = 600;
  const height = 300;
  const plotWidth = width - 2 * padding;
  const plotHeight = height - 2 * padding;

  if (!voltages.length || !voltages[0]) {
    return <div className={styles.noData}>No waveform data available</div>;
  }

  const nodeVoltages = voltages.map((v) => (Array.isArray(v) ? v[nodeIndex] ?? 0 : v[nodeIndex] ?? 0));
  const maxVoltage = Math.max(...nodeVoltages.map(Math.abs), 1);
  const minVoltage = -maxVoltage;

  // Scale functions
  const scaleX = (time: number) => (time / Math.max(...timeVector)) * plotWidth + padding;
  const scaleY = (voltage: number) => height - ((voltage - minVoltage) / (maxVoltage - minVoltage)) * plotHeight - padding;

  // Generate path data for waveform
  const pathData = nodeVoltages
    .map((v, i) => {
      const x = scaleX(timeVector[i]);
      const y = scaleY(v);
      return `${x},${y}`;
    })
    .join(' L ');

  return (
    <div className={styles.waveformPlot}>
      <div className={styles.plotHeader}>
        <h3>Voltage Waveform (Node {nodeIndex})</h3>
        <span className={styles.timeInfo}>{timeVector[timeVector.length - 1].toFixed(3)}s duration</span>
      </div>

      <svg width={width} height={height} className={styles.plotSvg}>
        {/* Grid background */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={padding} y={padding} width={plotWidth} height={plotHeight} fill="url(#grid)" />

        {/* Axes */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#333" strokeWidth="2" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#333" strokeWidth="2" />

        {/* Waveform line */}
        <polyline points={pathData} fill="none" stroke="#2196f3" strokeWidth="2" />

        {/* Zero line */}
        <line
          x1={padding}
          y1={scaleY(0)}
          x2={width - padding}
          y2={scaleY(0)}
          stroke="#999"
          strokeWidth="1"
          strokeDasharray="5,5"
        />

        {/* Axis labels */}
        <text x={width - padding + 10} y={height - padding + 5} fontSize="12" fill="#666">
          Time (s)
        </text>
        <text x={padding - 30} y={padding - 10} fontSize="12" fill="#666">
          Voltage (V)
        </text>
      </svg>

      <div className={styles.plotStats}>
        <div className={styles.stat}>
          <span className={styles.label}>Peak:</span>
          <span className={styles.value}>{Math.max(...nodeVoltages).toFixed(3)} V</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Trough:</span>
          <span className={styles.value}>{Math.min(...nodeVoltages).toFixed(3)} V</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Final:</span>
          <span className={styles.value}>{nodeVoltages[nodeVoltages.length - 1].toFixed(3)} V</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Circuit Statistics Component
 */
const CircuitStatistics: React.FC<{ stats: CircuitStats }> = ({ stats }) => {
  return (
    <div className={styles.statisticsPanel}>
      <h3>Circuit Analysis Summary</h3>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🔴</div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Total Nodes</div>
            <div className={styles.statValue}>{stats.totalNodes}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>⚡</div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Connected Nodes</div>
            <div className={styles.statValue}>{stats.connectedNodes}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>⚠️</div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Floating Nodes</div>
            <div className={styles.statValue}>{stats.floatingNodes}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>🔌</div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Resistors</div>
            <div className={styles.statValue}>{stats.totalResistors}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>⚡</div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Capacitors</div>
            <div className={styles.statValue}>{stats.totalCapacitors}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>🌀</div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Inductors</div>
            <div className={styles.statValue}>{stats.totalInductors}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>🔋</div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Sources</div>
            <div className={styles.statValue}>{stats.totalSources}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Analysis Results Component
 */
export const AnalysisResults: React.FC<AnalysisResultsProps> = ({
  result,
  stats,
  loading = false,
  error,
  onClose,
}) => {
  const [selectedNode, setSelectedNode] = useState(0);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Running analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h3>Analysis Error</h3>
          <p>{error}</p>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>No analysis results to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Analysis Results - {result.analysisType}</h2>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.content}>
        {/* DC Analysis Results */}
        {result.analysisType === 'DC' && (
          <div className={styles.dcResults}>
            <NodeVoltageTable voltages={(result as DcResult).nodeVoltages} />
          </div>
        )}

        {/* Transient Analysis Results */}
        {result.analysisType === 'TRANSIENT' && (
          <div className={styles.transientResults}>
            <div className={styles.waveformSection}>
              <WaveformPlot
                timeVector={(result as TransientResult).timeVector}
                voltages={(result as TransientResult).nodeVoltages}
                nodeIndex={selectedNode}
              />

              {(result as TransientResult).nodeVoltages.length > 0 && (
                <div className={styles.nodeSelector}>
                  <label>Select Node:</label>
                  <select
                    value={selectedNode}
                    onChange={(e) => setSelectedNode(parseInt(e.target.value))}
                    className={styles.select}
                  >
                    {(result as TransientResult).nodeVoltages[0].map((_, idx) => (
                      <option key={idx} value={idx}>
                        Node {idx}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.voltageDataSection}>
              <NodeVoltageTable voltages={(result as TransientResult).nodeVoltages.map((v) => v[selectedNode])} />
            </div>
          </div>
        )}

        {/* Circuit Statistics */}
        {stats && <CircuitStatistics stats={stats} />}
      </div>
    </div>
  );
};

export default AnalysisResults;
