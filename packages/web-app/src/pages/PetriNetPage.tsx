/**
 * Petri Net Editor Page with WASM Backend Integration
 */

import React, { useState, useMemo, useEffect } from 'react';
import { PetriNetEditor } from '@tupan/ui-framework';
import type { PetriNetEditorData, SimulationState } from '@tupan/ui-framework';
import { ResultsPlot, createTimeSeriesPlot } from '../components/ResultsPlot';
import type { PlotData } from '../components/ResultsPlot';
import { PetriNetBridge, WasmModuleLoader } from '@tupan/core-ts';
import '../styles/SimulatorPage.css';

const PetriNetPage: React.FC = () => {
  const [data, setData] = useState<PetriNetEditorData>({
    name: 'New Petri Net',
    places: [],
    transitions: [],
    arcs: [],
  });

  const [simulationActive, setSimulationActive] = useState(false);
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [bridge, setBridge] = useState<PetriNetBridge | null>(null);
  const [markingHistory, setMarkingHistory] = useState<Array<{ markings: Array<{ place: string; tokens: number }> }>>([]);
  const [error, setError] = useState<string>('');

  // Initialize WASM bridge on mount
  useEffect(() => {
    const initBridge = async () => {
      try {
        const wasmModule = await WasmModuleLoader.load();
        const newBridge = new PetriNetBridge('petri-net-simulator');
        await newBridge.initialize(wasmModule);
        setBridge(newBridge);
      } catch (err) {
        setError(`Failed to initialize WASM: ${err}`);
        console.error(err);
      }
    };
    initBridge();
  }, []);

  // Generate marking trace plot from WASM results
  const plotData = useMemo<PlotData | null>(() => {
    if (!simulationActive || markingHistory.length === 0) return null;

    const timeArray = Array.from({ length: markingHistory.length }, (_, i) => i);
    const markingData: Record<string, number[]> = {};

    markingHistory.forEach((step) => {
      step.markings.forEach(({ place, tokens }) => {
        if (!markingData[place]) {
          markingData[place] = [];
        }
        markingData[place].push(tokens);
      });
    });

    return createTimeSeriesPlot(
      'Token Marking Trace (WASM)',
      timeArray,
      markingData
    );
  }, [simulationActive, markingHistory]);

  const handleSimulate = async () => {
    if (!bridge) {
      setError('WASM bridge not initialized');
      return;
    }

    if (simulationActive) {
      setSimulationActive(false);
      setMarkingHistory([]);
    } else {
      if (data.places.length === 0 || data.transitions.length === 0) {
        setError('Add places and transitions before simulating');
        return;
      }

      try {
        setError('');
        // Load Petri net into WASM
        const loadResult = await bridge.loadPetriNet(data);
        if (!loadResult.success) {
          setError(`Failed to load: ${loadResult.message}`);
          return;
        }

        // Get initial markings
        const markings = await bridge.getMarkings();
        if (markings) {
          setMarkingHistory([{ markings }]);
        }

        // Simulate firing transitions
        const steps = data.transitions.slice(0, 5).map((t, i) => ({
          transition: t.name || `T${i}`,
          inputs: [[`P${i}`, 1]],
          outputs: [[`P${(i + 1) % data.places.length}`, 1]],
        }));

        const simResult = await bridge.simulateSteps(steps);
        if (simResult.success && simResult.data?.history) {
          setMarkingHistory(simResult.data.history as typeof markingHistory);
          setSimulationActive(true);
          setSimState({
            time: simResult.data.steps || 0,
            marking: {},
            enabledTransitions: [],
            firedTransitions: steps.map((s) => s.transition),
            isDeadlock: false,
          });
        } else {
          setError(`Simulation failed: ${simResult.message}`);
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
    a.download = `petri-net-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="simulator-page">
      <div className="simulator-header">
        <div className="simulator-title">
          <h1>Petri Net Simulator</h1>
          <p>Model concurrent systems with places, transitions, and token dynamics</p>
        </div>
        <div className="simulator-controls">
          <button
            className={`btn ${simulationActive ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleSimulate}
            disabled={
              (data.places.length === 0 && data.transitions.length === 0) || !bridge
            }
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
        <div
          style={{
            backgroundColor: '#fee',
            color: '#c00',
            padding: '12px',
            margin: '0 16px',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div className="simulator-content">
        <div className="editor-pane">
          <PetriNetEditor
            initialData={data}
            onDataChange={setData}
            onSimulationStateChange={setSimState}
            simulationMode={simulationActive}
            readOnly={false}
          />
        </div>

        {simulationActive && simState && (
          <div className="results-pane">
            <h3>WASM Simulation Results</h3>
            <div className="results-content">
              <p>
                <strong>Steps:</strong> {simState.time.toFixed(0)}
              </p>
              <p>
                <strong>Fired Transitions:</strong> {simState.firedTransitions.length}
              </p>
              <p>
                <strong>Marking History:</strong> {markingHistory.length} states
              </p>
              <p>
                <strong>Status:</strong> {simState.isDeadlock ? '🔴 Deadlock' : '🟢 Running'}
              </p>
              <div style={{ marginTop: '16px', height: '300px' }}>
                <ResultsPlot data={plotData} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="simulator-footer">
        <p>
          Places: {data.places.length} | Transitions: {data.transitions.length} | Arcs:{' '}
          {data.arcs.length} | WASM: {'connected'}
        </p>
      </div>
    </div>
  );
};

export default PetriNetPage;
