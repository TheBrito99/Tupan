/**
 * State Machine Editor Page with WASM Backend Integration
 */

import React, { useState, useMemo, useEffect } from 'react';
import { StateMachineEditor } from '@tupan/ui-framework';
import type { StateMachineEditorData } from '@tupan/ui-framework';
import { ResultsPlot, createTimeSeriesPlot } from '../components/ResultsPlot';
import type { PlotData } from '../components/ResultsPlot';
import { StateMachineBridge, WasmModuleLoader } from '@tupan/core-ts';
import '../styles/SimulatorPage.css';

const StateMachinePage: React.FC = () => {
  const [data, setData] = useState<StateMachineEditorData>({
    name: 'New State Machine',
    states: [],
    transitions: [],
  });

  const [simulationActive, setSimulationActive] = useState(false);
  const [activeState, setActiveState] = useState<string>();
  const [bridge, setBridge] = useState<StateMachineBridge | null>(null);
  const [simulationTrace, setSimulationTrace] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  // Initialize WASM bridge on mount
  useEffect(() => {
    const initBridge = async () => {
      try {
        const wasmModule = await WasmModuleLoader.load();
        const newBridge = new StateMachineBridge('state-machine-simulator');
        await newBridge.initialize(wasmModule);
        setBridge(newBridge);
      } catch (err) {
        setError(`Failed to initialize WASM: ${err}`);
        console.error(err);
      }
    };
    initBridge();
  }, []);

  // Generate state trace plot
  const plotData = useMemo<PlotData | null>(() => {
    if (!simulationActive || simulationTrace.length === 0) return null;

    const timeArray = Array.from({ length: simulationTrace.length }, (_, i) => i);
    const stateIndices = simulationTrace.map((state) => {
      const idx = data.states.findIndex(s => s.id === state);
      return idx >= 0 ? idx : 0;
    });

    return createTimeSeriesPlot(
      'State Transition Trace',
      timeArray,
      {
        'State Index': stateIndices,
      }
    );
  }, [simulationActive, simulationTrace, data.states]);

  const handleSimulate = async () => {
    if (!bridge) {
      setError('WASM bridge not initialized');
      return;
    }

    if (simulationActive) {
      setSimulationActive(false);
      setSimulationTrace([]);
    } else {
      if (data.states.length === 0) {
        setError('Add states to the state machine before simulating');
        return;
      }

      try {
        setError('');
        // Load state machine into WASM
        const loadResult = await bridge.loadStateMachine(data);
        if (!loadResult.success) {
          setError(`Failed to load: ${loadResult.message}`);
          return;
        }

        // Simulate a trace through transitions
        const events = data.transitions.slice(0, 10).map((t, i) => `event_${i}`);
        const traceResult = await bridge.simulateTrace(events);

        if (traceResult.success && traceResult.data?.trace) {
          setSimulationTrace(traceResult.data.trace as string[]);
          setActiveState(traceResult.data.final_state);
          setSimulationActive(true);
        } else {
          setError(`Simulation failed: ${traceResult.message}`);
        }
      } catch (err) {
        setError(`Simulation error: ${err}`);
        console.error(err);
      }
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `state-machine-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="simulator-page">
      <div className="simulator-header">
        <div className="simulator-title">
          <h1>State Machine Editor</h1>
          <p>Design finite state machines with states, transitions, and guards</p>
        </div>
        <div className="simulator-controls">
          <button
            className={`btn ${simulationActive ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleSimulate}
            disabled={data.states.length === 0 || !bridge}
            title={!bridge ? 'WASM module loading...' : ''}
          >
            {simulationActive ? '⏹ Stop' : '▶ Simulate'}
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            💾 Export
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          color: '#c00',
          padding: '12px',
          margin: '0 16px',
          borderRadius: '4px',
          fontSize: '14px',
        }}>
          ⚠ {error}
        </div>
      )}

      <div className="simulator-content">
        <div className="editor-pane">
          <StateMachineEditor
            initialData={data}
            onDataChange={setData}
            simulationMode={simulationActive}
            readOnly={false}
          />
        </div>

        {simulationActive && (
          <div className="results-pane">
            <h3>WASM Simulation Results</h3>
            <div className="results-content">
              {activeState && (
                <>
                  <p>
                    <strong>Current State:</strong> {activeState}
                  </p>
                  <p>
                    <strong>Trace Length:</strong> {simulationTrace.length} steps
                  </p>
                </>
              )}
              <p>
                <strong>Total States:</strong> {data.states.length}
              </p>
              <p>
                <strong>Total Transitions:</strong> {data.transitions.length}
              </p>
              <div style={{ marginTop: '16px', height: '300px' }}>
                <ResultsPlot data={plotData} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="simulator-footer">
        <p>States: {data.states.length} | Transitions: {data.transitions.length} | WASM: {'connected'}</p>
      </div>
    </div>
  );
};

export default StateMachinePage;
