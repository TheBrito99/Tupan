/**
 * WASM Bridge - TypeScript to Rust/WASM Interoperability
 *
 * This module provides TypeScript interfaces and helpers for communicating
 * with the Rust WASM computation engine.
 */

// Re-export bond graph analyzer and types
export { BondGraphAnalyzer } from './bond-graph';
export type {
  BondGraphElement,
  BondGraphElementType,
  BondGraphBond,
  BondGraphData,
  CausalityResult,
  CausalityType,
  ElementStats,
  SimulationParams,
  SimulationResult as BondGraphSimulationResult,
} from './bond-graph';

export interface SimulationState {
  timestamp: number;
  values: Record<string, number | number[]>;
  metadata?: Record<string, any>;
}

export interface SimulationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

/**
 * State Machine Bridge
 * Connects TypeScript state machine UI to WASM state machine simulator
 */
export class StateMachineBridge {
  private wasmModule: any = null;
  private analyzer: any = null;
  private name: string;

  constructor(name: string = "StateMachine") {
    this.name = name;
  }

  /**
   * Initialize WASM module
   */
  async initialize(wasmModule: any): Promise<void> {
    this.wasmModule = wasmModule;
    const { WasmStateMachineAnalyzer } = wasmModule;
    this.analyzer = new WasmStateMachineAnalyzer(this.name);
  }

  /**
   * Load state machine from editor data
   */
  async loadStateMachine(data: any): Promise<SimulationResult> {
    try {
      const json = JSON.stringify(data);
      const result = this.analyzer.load_state_machine(json);
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: "Failed to load state machine",
      };
    }
  }

  /**
   * Execute a transition
   */
  async executeTransition(
    fromState: string,
    toState: string
  ): Promise<SimulationResult> {
    try {
      const result = this.analyzer.execute_transition(fromState, toState);
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: "Failed to execute transition",
      };
    }
  }

  /**
   * Get current state
   */
  getCurrentState(): string {
    return this.analyzer.get_current_state();
  }

  /**
   * Simulate a trace of events
   */
  async simulateTrace(events: string[]): Promise<SimulationResult> {
    try {
      const eventsJson = JSON.stringify(events);
      const result = this.analyzer.simulate_trace(eventsJson);
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: "Failed to simulate trace",
      };
    }
  }

  /**
   * Convert simulation result to time-series data for plotting
   */
  convertToTimeSeriesData(
    trace: string[]
  ): { time: number[]; state: string[] } {
    return {
      time: trace.map((_, i) => i),
      state: trace,
    };
  }
}

/**
 * Petri Net Bridge
 * Connects TypeScript Petri net UI to WASM Petri net simulator
 */
export class PetriNetBridge {
  private wasmModule: any = null;
  private analyzer: any = null;
  private name: string;

  constructor(name: string = "PetriNet") {
    this.name = name;
  }

  /**
   * Initialize WASM module
   */
  async initialize(wasmModule: any): Promise<void> {
    this.wasmModule = wasmModule;
    const { WasmPetriNetAnalyzer } = wasmModule;
    this.analyzer = new WasmPetriNetAnalyzer(this.name);
  }

  /**
   * Load Petri net from editor data
   */
  async loadPetriNet(data: any): Promise<SimulationResult> {
    try {
      const json = JSON.stringify(data);
      const result = this.analyzer.load_petri_net(json);
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: "Failed to load Petri net",
      };
    }
  }

  /**
   * Fire a transition
   */
  async fireTransition(
    transitionName: string,
    inputPlaces: Array<{ place: string; tokens: number }>,
    outputPlaces: Array<{ place: string; tokens: number }>
  ): Promise<SimulationResult> {
    try {
      const inputs = JSON.stringify(inputPlaces.map((p) => [p.place, p.tokens]));
      const outputs = JSON.stringify(outputPlaces.map((p) => [p.place, p.tokens]));
      const result = this.analyzer.fire_transition(
        transitionName,
        inputs,
        outputs
      );
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: "Failed to fire transition",
      };
    }
  }

  /**
   * Get current markings
   */
  async getMarkings(): Promise<
    Array<{ place: string; tokens: number }> | null
  > {
    try {
      const result = this.analyzer.get_markings();
      return JSON.parse(result) as Array<{ place: string; tokens: number }>;
    } catch (error) {
      console.error("Failed to get markings:", error);
      return null;
    }
  }

  /**
   * Simulate steps
   */
  async simulateSteps(
    steps: Array<{
      transition: string;
      inputs: Array<[string, number]>;
      outputs: Array<[string, number]>;
    }>
  ): Promise<SimulationResult> {
    try {
      const stepsJson = JSON.stringify(
        steps.map((s) => ({
          transition: s.transition,
          inputs: JSON.stringify(s.inputs),
          outputs: JSON.stringify(s.outputs),
        }))
      );
      const result = this.analyzer.simulate_steps(stepsJson);
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: "Failed to simulate steps",
      };
    }
  }

  /**
   * Convert markings history to time-series data
   */
  convertToTimeSeriesData(
    history: Array<{ markings: Array<{ place: string; tokens: number }> }>
  ): { time: number[]; places: Record<string, number[]> } {
    const placeTokens: Record<string, number[]> = {};

    history.forEach((step, index) => {
      step.markings.forEach(({ place, tokens }) => {
        if (!placeTokens[place]) {
          placeTokens[place] = [];
        }
        placeTokens[place][index] = tokens;
      });
    });

    // Fill in missing time steps with previous values
    const time = history.map((_, i) => i);
    const places: Record<string, number[]> = {};

    for (const [place, values] of Object.entries(placeTokens)) {
      places[place] = [];
      let lastValue = 0;
      for (let i = 0; i < history.length; i++) {
        if (i < values.length && values[i] !== undefined) {
          lastValue = values[i];
        }
        places[place][i] = lastValue;
      }
    }

    return { time, places };
  }
}

/**
 * WASM Module Loader
 * Loads and caches the compiled WASM module with fallback to mock implementations
 */
export class WasmModuleLoader {
  private static instance: any = null;
  private static loading: Promise<any> | null = null;

  /**
   * Load WASM module (cached) with mock fallback
   */
  static async load(): Promise<any> {
    if (WasmModuleLoader.instance) {
      return WasmModuleLoader.instance;
    }

    if (WasmModuleLoader.loading) {
      return WasmModuleLoader.loading;
    }

    WasmModuleLoader.loading = (async () => {
      try {
        // Try to load from @tupan/core-rust package
        const wasmModule = await import("@tupan/core-rust");
        console.log("Successfully loaded WASM module");
        WasmModuleLoader.instance = wasmModule;
        return wasmModule;
      } catch (error) {
        console.warn("WASM module not available, using mock implementations:", error);
        // Return mock WASM module with stub implementations
        WasmModuleLoader.instance = WasmModuleLoader.createMockWasmModule();
        return WasmModuleLoader.instance;
      }
    })();

    return WasmModuleLoader.loading;
  }

  /**
   * Create mock WASM module for development/fallback
   */
  private static createMockWasmModule(): any {
    return {
      WasmStateMachineAnalyzer: class MockStateMachineAnalyzer {
        name: string;

        constructor(name: string) {
          this.name = name;
        }

        load_state_machine(json: string) {
          return JSON.stringify({
            success: true,
            message: "Mock: State machine loaded",
            name: this.name,
          });
        }

        execute_transition(from: string, to: string) {
          return JSON.stringify({
            success: true,
            from,
            to,
            current: to,
          });
        }

        get_current_state() {
          return "initial";
        }

        simulate_trace(eventsJson: string) {
          const events = JSON.parse(eventsJson);
          const trace = ["initial", ...events.slice(0, 5)];
          return JSON.stringify({
            success: true,
            data: {
              trace,
              final_state: trace[trace.length - 1],
            },
          });
        }
      },

      WasmPetriNetAnalyzer: class MockPetriNetAnalyzer {
        name: string;
        markings: Array<{ place: string; tokens: number }> = [];

        constructor(name: string) {
          this.name = name;
        }

        load_petri_net(json: string) {
          const data = JSON.parse(json);
          this.markings = data.places?.map((p: any) => ({
            place: p.name || `P${Math.random()}`,
            tokens: p.tokens || 0,
          })) || [];
          return JSON.stringify({
            success: true,
            message: "Mock: Petri net loaded",
            name: this.name,
            places: this.markings.length,
          });
        }

        fire_transition(transitionName: string, inputsJson: string, outputsJson: string) {
          const inputs = JSON.parse(inputsJson);
          const outputs = JSON.parse(outputsJson);

          inputs.forEach(([place, count]: [string, number]) => {
            const m = this.markings.find((m) => m.place === place);
            if (m) m.tokens = Math.max(0, m.tokens - count);
          });

          outputs.forEach(([place, count]: [string, number]) => {
            let m = this.markings.find((m) => m.place === place);
            if (!m) {
              m = { place, tokens: 0 };
              this.markings.push(m);
            }
            m.tokens += count;
          });

          return JSON.stringify({
            success: true,
            transition: transitionName,
            markings: this.markings,
          });
        }

        get_markings() {
          return JSON.stringify(this.markings);
        }

        simulate_steps(stepsJson: string) {
          const steps = JSON.parse(stepsJson);
          const history = [{ markings: JSON.parse(JSON.stringify(this.markings)) }];

          steps.forEach((step: any) => {
            this.fire_transition(
              step.transition,
              step.inputs,
              step.outputs
            );
            history.push({ markings: JSON.parse(JSON.stringify(this.markings)) });
          });

          return JSON.stringify({
            success: true,
            steps: history.length - 1,
            data: { history },
          });
        }
      },
    };
  }

  /**
   * Clear cached module
   */
  static clear(): void {
    WasmModuleLoader.instance = null;
    WasmModuleLoader.loading = null;
  }
}
