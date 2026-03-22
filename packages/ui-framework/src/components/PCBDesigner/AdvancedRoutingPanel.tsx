/**
 * Advanced Routing Panel - UI for Phase 13 advanced routing features
 *
 * Provides:
 * - Differential pair routing controls
 * - Length matching interface
 * - Impedance calculator
 * - Escape routing for BGAs
 */

import React, { useState, useCallback } from 'react';
import { Trace, PlacedComponent } from './types';
import { ImpedanceCalculator, PCBStackup } from './ImpedanceCalculator';
import { LengthMatcher } from './LengthMatcher';
import { EscapeRouter } from './EscapeRouter';
import { DifferentialPairRouter } from './DifferentialPairRouter';
import styles from './AdvancedRoutingPanel.module.css';

interface AdvancedRoutingPanelProps {
  traces: Trace[];
  components: PlacedComponent[];
  onApplyMatching?: (traces: Trace[]) => void;
  stackup?: PCBStackup;
}

type RoutingTab = 'impedance' | 'length-match' | 'differential' | 'escape';

interface ImpedanceInput {
  targetZ0: number;
  frequency: number;
  temperature: number;
  geometry: 'microstrip' | 'stripline' | 'differential';
}

export const AdvancedRoutingPanel: React.FC<AdvancedRoutingPanelProps> = ({
  traces,
  components,
  onApplyMatching,
  stackup,
}) => {
  const [activeTab, setActiveTab] = useState<RoutingTab>('impedance');
  const [impedanceInput, setImpedanceInput] = useState<ImpedanceInput>({
    targetZ0: 50,
    frequency: 100,
    temperature: 25,
    geometry: 'microstrip',
  });

  const [lengthTolerance, setLengthTolerance] = useState(0.5);
  const [selectedTraces, setSelectedTraces] = useState<Set<string>>(new Set());
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [results, setResults] = useState<string>('');

  /**
   * Handle impedance calculation
   */
  const handleCalculateImpedance = useCallback(() => {
    if (!stackup) {
      setResults('No stackup information available');
      return;
    }

    const calc = new ImpedanceCalculator(stackup);

    // Get first trace for demonstration
    if (traces.length === 0) {
      setResults('No traces to analyze');
      return;
    }

    const trace = traces[0];
    const length = Math.hypot(
      trace.segments[trace.segments.length - 1].end.x - trace.segments[0].start.x,
      trace.segments[trace.segments.length - 1].end.y - trace.segments[0].start.y
    );

    const result = calc.calculateImpedance({
      width: trace.width,
      thickness: 0.035, // 1oz copper
      height: 0.2, // Distance to ground plane
      frequency: impedanceInput.frequency,
      temperature: impedanceInput.temperature,
      length,
      geometry: impedanceInput.geometry as any,
    });

    const compliance = calc.checkCompliance(result, impedanceInput.targetZ0, 10);

    const output = [
      'IMPEDANCE ANALYSIS',
      '═══════════════════════════════════════',
      `Target Z0: ${impedanceInput.targetZ0}Ω`,
      `Calculated Z0: ${result.singleEndedZ0.toFixed(1)}Ω`,
      compliance.message,
      `Propagation Delay: ${result.delayPerUnit.toFixed(2)} ps/mm`,
      `Attenuation @ ${impedanceInput.frequency}MHz: ${result.attenuation.toFixed(2)} dB/inch`,
      `Trace Length: ${length.toFixed(1)} mm`,
    ];

    if (result.differentialZ0) {
      output.push(`Differential Z0: ${result.differentialZ0.toFixed(1)}Ω`);
      output.push(`Common Mode Z0: ${result.commonModeZ0?.toFixed(1)}Ω`);
      output.push(`Skew: ${result.skewPerLength.toFixed(2)} ps/mm`);
    }

    setResults(output.join('\n'));
  }, [traces, impedanceInput, stackup]);

  /**
   * Handle length matching
   */
  const handleMatchLengths = useCallback(() => {
    if (selectedTraces.size === 0) {
      setResults('Please select at least 2 traces to match');
      return;
    }

    const matcher = new LengthMatcher(lengthTolerance);
    const tracesToMatch = traces.filter(t => selectedTraces.has(t.id));

    const result = matcher.matchGroup(tracesToMatch);
    const report = matcher.generateReport(result);

    setResults(report);
  }, [traces, selectedTraces, lengthTolerance]);

  /**
   * Handle escape routing
   */
  const handleEscapeRoute = useCallback(() => {
    if (!selectedComponent) {
      setResults('Please select a component');
      return;
    }

    const component = components.find(c => c.id === selectedComponent);
    if (!component) {
      setResults('Component not found');
      return;
    }

    const escapeRouter = new EscapeRouter();
    const route = escapeRouter.calculateEscapeRoute(component);
    const vias = escapeRouter.planViaPlacement(route);
    const report = escapeRouter.generateEscapeReport(route);

    const output = [
      report,
      '',
      'PLANNED VIAS:',
      `  Count: ${vias.length}`,
      ...vias.slice(0, 5).map((v, i) => `  Via ${i + 1}: (${v.position.x.toFixed(1)}, ${v.position.y.toFixed(1)}) mm`),
      vias.length > 5 ? `  ... and ${vias.length - 5} more` : '',
    ];

    setResults(output.join('\n'));
  }, [selectedComponent, components]);

  /**
   * Toggle trace selection
   */
  const handleToggleTrace = useCallback(
    (traceId: string) => {
      const newSelected = new Set(selectedTraces);
      if (newSelected.has(traceId)) {
        newSelected.delete(traceId);
      } else {
        newSelected.add(traceId);
      }
      setSelectedTraces(newSelected);
    },
    [selectedTraces]
  );

  return (
    <div className={styles.container}>
      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'impedance' ? styles.active : ''}`}
          onClick={() => setActiveTab('impedance')}
        >
          Impedance
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'length-match' ? styles.active : ''}`}
          onClick={() => setActiveTab('length-match')}
        >
          Length Match
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'differential' ? styles.active : ''}`}
          onClick={() => setActiveTab('differential')}
        >
          Differential
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'escape' ? styles.active : ''}`}
          onClick={() => setActiveTab('escape')}
        >
          Escape
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {/* Impedance Tab */}
        {activeTab === 'impedance' && (
          <div className={styles.tabContent}>
            <h3>Impedance Control</h3>
            <div className={styles.controls}>
              <label>
                Target Z0 (Ω):
                <input
                  type="number"
                  value={impedanceInput.targetZ0}
                  onChange={e => setImpedanceInput({ ...impedanceInput, targetZ0: parseFloat(e.target.value) })}
                  min="10"
                  max="120"
                  step="5"
                />
              </label>

              <label>
                Frequency (MHz):
                <input
                  type="number"
                  value={impedanceInput.frequency}
                  onChange={e => setImpedanceInput({ ...impedanceInput, frequency: parseFloat(e.target.value) })}
                  min="1"
                  max="5000"
                  step="10"
                />
              </label>

              <label>
                Temperature (°C):
                <input
                  type="number"
                  value={impedanceInput.temperature}
                  onChange={e => setImpedanceInput({ ...impedanceInput, temperature: parseFloat(e.target.value) })}
                  min="-40"
                  max="125"
                  step="5"
                />
              </label>

              <label>
                Geometry:
                <select
                  value={impedanceInput.geometry}
                  onChange={e =>
                    setImpedanceInput({
                      ...impedanceInput,
                      geometry: e.target.value as 'microstrip' | 'stripline' | 'differential',
                    })
                  }
                >
                  <option value="microstrip">Microstrip (outer layer)</option>
                  <option value="stripline">Stripline (inner layer)</option>
                  <option value="differential">Differential</option>
                </select>
              </label>

              <button onClick={handleCalculateImpedance} className={styles.button}>
                Calculate Impedance
              </button>
            </div>
          </div>
        )}

        {/* Length Matching Tab */}
        {activeTab === 'length-match' && (
          <div className={styles.tabContent}>
            <h3>Length Matching</h3>
            <div className={styles.controls}>
              <label>
                Tolerance (mm):
                <input
                  type="number"
                  value={lengthTolerance}
                  onChange={e => setLengthTolerance(parseFloat(e.target.value))}
                  min="0.1"
                  max="5"
                  step="0.1"
                />
              </label>

              <div className={styles.traceList}>
                <label>Select traces to match:</label>
                {traces.slice(0, 10).map(trace => (
                  <label key={trace.id} className={styles.traceItem}>
                    <input
                      type="checkbox"
                      checked={selectedTraces.has(trace.id)}
                      onChange={() => handleToggleTrace(trace.id)}
                    />
                    {trace.netName} ({trace.width.toFixed(2)}mm)
                  </label>
                ))}
                {traces.length > 10 && (
                  <div className={styles.moreTraces}>
                    ... and {traces.length - 10} more traces
                  </div>
                )}
              </div>

              <button onClick={handleMatchLengths} className={styles.button}>
                Match Selected Traces
              </button>
            </div>
          </div>
        )}

        {/* Differential Tab */}
        {activeTab === 'differential' && (
          <div className={styles.tabContent}>
            <h3>Differential Pair Routing</h3>
            <div className={styles.info}>
              <p>Differential pair routing ensures:</p>
              <ul>
                <li>Constant spacing between traces</li>
                <li>Equal length for minimum skew</li>
                <li>Parallel routing for tight coupling</li>
                <li>Impedance-controlled geometry</li>
              </ul>
              <p>Select differential pair nets from the netlist and configure spacing constraints.</p>
            </div>
            <div className={styles.controls}>
              <label>
                Differential Spacing (mm):
                <input type="number" defaultValue="0.3" min="0.2" max="2" step="0.1" />
              </label>

              <label>
                Max Skew (ps):
                <input type="number" defaultValue="50" min="10" max="500" step="10" />
              </label>

              <label>
                Target Impedance (Ω):
                <input type="number" defaultValue="100" min="80" max="140" step="5" />
              </label>

              <button className={styles.button}>Route Differential Pair</button>
            </div>
          </div>
        )}

        {/* Escape Tab */}
        {activeTab === 'escape' && (
          <div className={styles.tabContent}>
            <h3>Escape Routing (BGA/QFP)</h3>
            <div className={styles.controls}>
              <label>
                Select Component:
                <select
                  value={selectedComponent || ''}
                  onChange={e => setSelectedComponent(e.target.value || null)}
                >
                  <option value="">-- Select --</option>
                  {components.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.refdes} ({comp.footprint.name})
                    </option>
                  ))}
                </select>
              </label>

              <button onClick={handleEscapeRoute} className={styles.button}>
                Plan Escape Route
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Display */}
      <div className={styles.results}>
        <pre>{results}</pre>
      </div>
    </div>
  );
};

export default AdvancedRoutingPanel;
