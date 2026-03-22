/**
 * useCircuitSimulation Hook
 *
 * Integrates circuit simulator with schematic editor
 * Provides real-time voltage/current display and measurements
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { PlacedSymbol, Wire } from '../components/SchematicEditor/types';
import { Measurement, Probe } from '../../../core-ts/src/simulators/SimulationBridge';

/**
 * Simulation state
 */
export interface SimulationState {
  isRunning: boolean;
  isValid: boolean;
  nodeVoltages: Record<string, number>;
  componentCurrents: Record<string, number>;
  componentPowers: Record<string, number>;
  measurements: Measurement[];
  probes: Probe[];
  error?: string;
  summary?: {
    totalPower: number;
    maxVoltage: number;
    maxCurrent: number;
    efficiency: number;
  };
}

/**
 * Simulation configuration
 */
export interface UseCircuitSimulationConfig {
  autoSimulate?: boolean;           // Simulate on circuit changes
  updateInterval?: number;          // Probe update interval (ms)
  enableProbes?: boolean;           // Enable probe tracking
  enableMeasurements?: boolean;     // Enable measurements
}

/**
 * Hook for circuit simulation
 */
export function useCircuitSimulation(config: UseCircuitSimulationConfig = {}) {
  const {
    autoSimulate = true,
    updateInterval = 100,
    enableProbes = true,
    enableMeasurements = true,
  } = config;

  // Lazy import simulator to avoid circular dependencies
  const simulatorRef = useRef<any>(null);
  const [state, setState] = useState<SimulationState>({
    isRunning: false,
    isValid: false,
    nodeVoltages: {},
    componentCurrents: {},
    componentPowers: {},
    measurements: [],
    probes: [],
  });

  const [autoRun, setAutoRun] = useState(autoSimulate);
  const simulationTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Initialize simulator on first use
   */
  const getSimulator = useCallback(async () => {
    if (!simulatorRef.current) {
      // Dynamic import to avoid circular dependencies
      const { circuitSimulator } = await import(
        '../../../core-ts/src/simulators/CircuitSimulator'
      );
      simulatorRef.current = circuitSimulator;
    }
    return simulatorRef.current;
  }, []);

  /**
   * Run simulation on circuit
   */
  const simulate = useCallback(
    async (symbols: PlacedSymbol[], wires: Wire[]) => {
      if (state.isRunning) return;

      try {
        setState(prev => ({ ...prev, isRunning: true }));

        const simulator = await getSimulator();
        const result = await simulator.simulateSchematic(symbols, wires);

        if (result.success) {
          const bridge = simulator.getBridge();

          setState(prev => ({
            ...prev,
            isRunning: false,
            isValid: true,
            nodeVoltages: result.nodeVoltages,
            componentCurrents: result.componentCurrents,
            componentPowers: result.componentPowers,
            measurements: enableMeasurements ? bridge.getMeasurements() : [],
            probes: enableProbes ? bridge.getProbes() : [],
            summary: bridge.getSummary() || undefined,
          }));
        } else {
          setState(prev => ({
            ...prev,
            isRunning: false,
            isValid: false,
            error: result.error,
          }));
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isRunning: false,
          isValid: false,
          error: `Simulation failed: ${error}`,
        }));
      }
    },
    [state.isRunning, getSimulator, enableMeasurements, enableProbes]
  );

  /**
   * Add voltage measurement
   */
  const addVoltageMeasurement = useCallback(
    async (nodeName: string) => {
      const simulator = await getSimulator();
      simulator.addVoltageMeasurement(nodeName);

      const bridge = simulator.getBridge();
      setState(prev => ({
        ...prev,
        measurements: bridge.getMeasurements(),
      }));
    },
    [getSimulator]
  );

  /**
   * Add current measurement
   */
  const addCurrentMeasurement = useCallback(
    async (componentRef: string) => {
      const simulator = await getSimulator();
      simulator.addCurrentMeasurement(componentRef);

      const bridge = simulator.getBridge();
      setState(prev => ({
        ...prev,
        measurements: bridge.getMeasurements(),
      }));
    },
    [getSimulator]
  );

  /**
   * Add voltage probe
   */
  const addVoltageProbe = useCallback(
    async (nodeName: string) => {
      const simulator = await getSimulator();
      const probeId = simulator.addVoltageProbe(nodeName);

      const bridge = simulator.getBridge();
      setState(prev => ({
        ...prev,
        probes: bridge.getProbes(),
      }));

      return probeId;
    },
    [getSimulator]
  );

  /**
   * Add current probe
   */
  const addCurrentProbe = useCallback(
    async (componentRef: string) => {
      const simulator = await getSimulator();
      const probeId = simulator.addCurrentProbe(componentRef);

      const bridge = simulator.getBridge();
      setState(prev => ({
        ...prev,
        probes: bridge.getProbes(),
      }));

      return probeId;
    },
    [getSimulator]
  );

  /**
   * Remove measurement
   */
  const removeMeasurement = useCallback(
    async (id: string) => {
      const simulator = await getSimulator();
      simulator.removeMeasurement(id);

      const bridge = simulator.getBridge();
      setState(prev => ({
        ...prev,
        measurements: bridge.getMeasurements(),
      }));
    },
    [getSimulator]
  );

  /**
   * Remove probe
   */
  const removeProbe = useCallback(
    async (id: string) => {
      const simulator = await getSimulator();
      simulator.removeProbe(id);

      const bridge = simulator.getBridge();
      setState(prev => ({
        ...prev,
        probes: bridge.getProbes(),
      }));
    },
    [getSimulator]
  );

  /**
   * Get voltage at node
   */
  const getNodeVoltage = useCallback(
    (nodeName: string): number => {
      return state.nodeVoltages[nodeName] || 0;
    },
    [state.nodeVoltages]
  );

  /**
   * Get current through component
   */
  const getComponentCurrent = useCallback(
    (componentRef: string): number => {
      return state.componentCurrents[componentRef] || 0;
    },
    [state.componentCurrents]
  );

  /**
   * Get power in component
   */
  const getComponentPower = useCallback(
    (componentRef: string): number => {
      return state.componentPowers[componentRef] || 0;
    },
    [state.componentPowers]
  );

  /**
   * Clear simulation
   */
  const clear = useCallback(async () => {
    const simulator = await getSimulator();
    simulator.clear();

    setState({
      isRunning: false,
      isValid: false,
      nodeVoltages: {},
      componentCurrents: {},
      componentPowers: {},
      measurements: [],
      probes: [],
    });
  }, [getSimulator]);

  /**
   * Export results
   */
  const exportResults = useCallback(async () => {
    const simulator = await getSimulator();
    return simulator.export();
  }, [getSimulator]);

  return {
    // State
    ...state,
    autoRun,
    setAutoRun,

    // Actions
    simulate,
    clear,
    exportResults,

    // Measurements
    addVoltageMeasurement,
    addCurrentMeasurement,
    removeMeasurement,

    // Probes
    addVoltageProbe,
    addCurrentProbe,
    removeProbe,

    // Queries
    getNodeVoltage,
    getComponentCurrent,
    getComponentPower,
  };
}

/**
 * Hook for auto-simulation on circuit changes
 */
export function useAutoSimulation(
  symbols: PlacedSymbol[],
  wires: Wire[],
  enabled: boolean = true,
  delay: number = 500
) {
  const {
    simulate,
    isRunning,
    nodeVoltages,
    componentCurrents,
  } = useCircuitSimulation({ autoSimulate: true });

  const debounceRef = useRef<NodeJS.Timeout>();
  const lastHashRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;

    // Create circuit hash to detect changes
    const hash = JSON.stringify({ symbols, wires }).substring(0, 50);

    if (hash !== lastHashRef.current) {
      lastHashRef.current = hash;

      // Debounce simulation
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        simulate(symbols, wires);
      }, delay);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [symbols, wires, enabled, delay, simulate]);

  return {
    isSimulating: isRunning,
    nodeVoltages,
    componentCurrents,
  };
}

/**
 * Hook for probe data visualization
 */
export function useProbeData() {
  const { probes, getSimulator } = useCircuitSimulation({ enableProbes: true });
  const [historyData, setHistoryData] = useState<Array<{
    probeId: string;
    label: string;
    values: number[];
  }>>([]);

  useEffect(() => {
    const updateHistory = async () => {
      const simulator = await getSimulator();
      const data = simulator.getBridge().exportProbeData();

      setHistoryData(
        data.map(item => ({
          probeId: item.probeId,
          label: `${item.type} @ ${item.location}`,
          values: item.history,
        }))
      );
    };

    const interval = setInterval(updateHistory, 100);

    return () => clearInterval(interval);
  }, [probes, getSimulator]);

  return historyData;
}
