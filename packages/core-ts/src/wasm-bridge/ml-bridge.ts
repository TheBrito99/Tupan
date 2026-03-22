/**
 * Phase 28 Task 5: ML Framework WASM Bridge
 * TypeScript bindings for Rust ML WASM exports
 * Provides type-safe access to RL, behavior cloning, parameter optimization, and digital twin
 */

import { WasmModule } from './wasm-module';

/**
 * ML Agent wrapper for TypeScript
 */
export class MLAgentBridge {
  private wasmModule: WasmModule | null = null;
  private wasmAgent: any = null;

  async initialize(stateDim: number, actionDim: number, learningRate: number) {
    this.wasmModule = WasmModule.getInstance();
    const mod = await this.wasmModule.loadWasm();

    if (mod && mod.WasmMLAgent) {
      this.wasmAgent = new mod.WasmMLAgent(stateDim, actionDim, learningRate);
    }
  }

  trainStep(state: number[], action: number[], reward: number): any {
    if (!this.wasmAgent) {
      throw new Error('MLAgentBridge not initialized');
    }

    const stateJson = JSON.stringify(state);
    const actionJson = JSON.stringify(action);
    const result = this.wasmAgent.train_step(stateJson, actionJson, reward);

    return JSON.parse(result);
  }

  selectAction(state: number[]): number[] {
    if (!this.wasmAgent) {
      throw new Error('MLAgentBridge not initialized');
    }

    const stateJson = JSON.stringify(state);
    const result = this.wasmAgent.select_action(stateJson);
    const parsed = JSON.parse(result);

    return parsed.action;
  }

  getConfig(): any {
    if (!this.wasmAgent) {
      throw new Error('MLAgentBridge not initialized');
    }

    const result = this.wasmAgent.get_config();
    return JSON.parse(result);
  }
}

/**
 * Behavior Cloner wrapper for TypeScript
 */
export class BehaviorClonerBridge {
  private wasmModule: WasmModule | null = null;
  private wasmCloner: any = null;

  async initialize() {
    this.wasmModule = WasmModule.getInstance();
    const mod = await this.wasmModule.loadWasm();

    if (mod && mod.WasmBehaviorCloner) {
      this.wasmCloner = new mod.WasmBehaviorCloner();
    }
  }

  addDemonstration(demo: {
    episode_id: number;
    trajectory: Array<{ state: number[]; action: number[] }>;
    success: boolean;
  }): any {
    if (!this.wasmCloner) {
      throw new Error('BehaviorClonerBridge not initialized');
    }

    const demoJson = JSON.stringify(demo);
    const result = this.wasmCloner.add_demonstration(demoJson);

    return JSON.parse(result);
  }

  trainBatch(
    transitions: Array<{ state: number[]; action: number[] }>,
    learningRate: number
  ): any {
    if (!this.wasmCloner) {
      throw new Error('BehaviorClonerBridge not initialized');
    }

    const transitionsJson = JSON.stringify(transitions);
    const result = this.wasmCloner.train_batch(transitionsJson, learningRate);

    return JSON.parse(result);
  }

  getStats(): any {
    if (!this.wasmCloner) {
      throw new Error('BehaviorClonerBridge not initialized');
    }

    const result = this.wasmCloner.get_stats();
    return JSON.parse(result);
  }
}

/**
 * Parameter Optimizer wrapper for TypeScript
 */
export class ParameterOptimizerBridge {
  private wasmModule: WasmModule | null = null;
  private wasmOptimizer: any = null;

  async initialize(strategy: 'GreedyNearest' | 'GeneticAlgorithm' | 'ParticleSwarm' | 'GridSearch') {
    this.wasmModule = WasmModule.getInstance();
    const mod = await this.wasmModule.loadWasm();

    if (mod && mod.WasmParameterOptimizer) {
      this.wasmOptimizer = new mod.WasmParameterOptimizer(strategy);
    }
  }

  optimize(populationSize: number, generations: number): any {
    if (!this.wasmOptimizer) {
      throw new Error('ParameterOptimizerBridge not initialized');
    }

    const result = this.wasmOptimizer.optimize(populationSize, generations);
    return JSON.parse(result);
  }

  static async getStrategies(): Promise<string[]> {
    const wasmModule = WasmModule.getInstance();
    const mod = await wasmModule.loadWasm();

    if (mod && mod.WasmParameterOptimizer) {
      const result = mod.WasmParameterOptimizer.get_strategies();
      return JSON.parse(result);
    }

    return [];
  }
}

/**
 * Digital Twin wrapper for TypeScript
 */
export class DigitalTwinBridge {
  private wasmModule: WasmModule | null = null;
  private wasmTwin: any = null;

  async initialize() {
    this.wasmModule = WasmModule.getInstance();
    const mod = await this.wasmModule.loadWasm();

    if (mod && mod.WasmDigitalTwin) {
      this.wasmTwin = new mod.WasmDigitalTwin();
    }
  }

  observe(observation: {
    timestamp: number;
    robot_positions: number[][];
    robot_velocities: number[][];
  }): any {
    if (!this.wasmTwin) {
      throw new Error('DigitalTwinBridge not initialized');
    }

    const obsJson = JSON.stringify(observation);
    const result = this.wasmTwin.observe(obsJson);

    return JSON.parse(result);
  }

  predictNextState(state: {
    positions: number[][];
    velocities: number[][];
  }): any {
    if (!this.wasmTwin) {
      throw new Error('DigitalTwinBridge not initialized');
    }

    const stateJson = JSON.stringify(state);
    const result = this.wasmTwin.predict_next_state(stateJson);

    return JSON.parse(result);
  }

  validatePrediction(actual: {
    positions: number[][];
    velocities: number[][];
  }): any {
    if (!this.wasmTwin) {
      throw new Error('DigitalTwinBridge not initialized');
    }

    const actualJson = JSON.stringify(actual);
    const result = this.wasmTwin.validate_prediction(actualJson);

    return JSON.parse(result);
  }

  getAccuracyMetrics(): any {
    if (!this.wasmTwin) {
      throw new Error('DigitalTwinBridge not initialized');
    }

    const result = this.wasmTwin.get_accuracy_metrics();
    return JSON.parse(result);
  }
}

/**
 * Complete ML Framework bridge combining all components
 */
export class MLFrameworkBridge {
  agent: MLAgentBridge;
  behaviorCloner: BehaviorClonerBridge;
  optimizer: ParameterOptimizerBridge;
  digitalTwin: DigitalTwinBridge;

  constructor() {
    this.agent = new MLAgentBridge();
    this.behaviorCloner = new BehaviorClonerBridge();
    this.optimizer = new ParameterOptimizerBridge();
    this.digitalTwin = new DigitalTwinBridge();
  }

  async initialize(config: {
    stateDim: number;
    actionDim: number;
    learningRate: number;
    optimizationStrategy?: 'GreedyNearest' | 'GeneticAlgorithm' | 'ParticleSwarm' | 'GridSearch';
  }) {
    await this.agent.initialize(config.stateDim, config.actionDim, config.learningRate);
    await this.behaviorCloner.initialize();
    await this.optimizer.initialize(config.optimizationStrategy || 'GeneticAlgorithm');
    await this.digitalTwin.initialize();
  }

  /**
   * Complete training workflow: RL → Behavior Cloning → Parameter Optimization → Validation
   */
  async completeTrainingWorkflow(episodes: number): Promise<any> {
    const results = [];

    for (let ep = 0; ep < episodes; ep++) {
      // 1. Agent acts and learns
      const state = Array(6).fill(Math.random()); // 6D state
      const action = this.agent.selectAction(state);
      const reward = Math.random() * 2 - 1;

      const agentResult = this.agent.trainStep(state, action, reward);
      results.push({
        episode: ep,
        agent: agentResult,
      });

      // 2. Behavior cloning learns from expert
      if (ep % 5 === 0) {
        const transitions = Array(10).fill(null).map((_, i) => ({
          state: Array(6).fill(Math.random()),
          action: Array(3).fill(Math.random() * 2 - 1),
        }));

        const bcResult = this.behaviorCloner.trainBatch(transitions, 0.01);
        results[results.length - 1].behaviorCloning = bcResult;
      }

      // 3. Digital twin validates
      if (ep % 10 === 0) {
        const observation = {
          timestamp: ep * 0.1,
          robot_positions: [[1.0, 2.0, 3.0]],
          robot_velocities: [[0.1, 0.2, 0.3]],
        };

        const obsResult = this.digitalTwin.observe(observation);
        const predResult = this.digitalTwin.predictNextState({
          positions: [[1.0, 2.0, 3.0]],
          velocities: [[0.1, 0.2, 0.3]],
        });

        results[results.length - 1].validation = {
          observe: obsResult,
          predict: predResult,
        };
      }
    }

    // Get final metrics
    const agentConfig = this.agent.getConfig();
    const bcStats = this.behaviorCloner.getStats();
    const metrics = this.digitalTwin.getAccuracyMetrics();

    return {
      episodes,
      results,
      finalConfig: agentConfig,
      bcStats,
      metrics,
    };
  }
}

export default MLFrameworkBridge;
