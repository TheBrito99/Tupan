/**
 * Solver Selection Engine
 *
 * Automatically selects optimal solver based on system characteristics from Phase 54:
 * - Stiffness rating (from FeedbackPathAnalyzer)
 * - System size (number of equations)
 * - Time scale separation
 * - Numerical accuracy requirements
 *
 * Decision tree:
 * - Non-stiff → RK4 (fast, simple)
 * - Mildly-stiff → RK45 (adaptive, accurate)
 * - Stiff → BDF (implicit, stable)
 * - Very-stiff → IDA (DAE, highest accuracy)
 */

import type { SolverConfig } from './solver';
import type { StiffnessRating } from '../components/BondGraphEditor/feedbackPathAnalyzer';

/**
 * Solver recommendation with justification
 */
export interface SolverRecommendation {
  solverType: 'RK4' | 'RK45' | 'BDF' | 'IDA';
  config: SolverConfig;
  justification: string;
  expectedProperties: {
    stepsPerSecond: number;
    estimatedAccuracy: number;
    computeTimePerStep: number;
  };
}

/**
 * Solver selection based on system properties
 */
export class SolverSelector {
  /**
   * Select solver based on stiffness from Phase 54
   *
   * Input: StiffnessRating from FeedbackPathAnalyzer
   * Output: Optimal SolverConfig
   */
  selectByStiffness(
    stiffness: StiffnessRating,
    systemSize: number = 10
  ): SolverRecommendation {
    const classification = stiffness.classification;

    // Decision tree based on stiffness classification
    if (classification === 'non-stiff') {
      return this.recommendRK4(stiffness, systemSize);
    } else if (classification === 'mildly-stiff') {
      return this.recommendRK45(stiffness, systemSize);
    } else if (classification === 'stiff') {
      return this.recommendBDF(stiffness, systemSize);
    } else {
      // very-stiff
      return this.recommendIDA(stiffness, systemSize);
    }
  }

  /**
   * Recommend RK4 for non-stiff systems
   * - Fast (only 4 function evaluations per step)
   * - Fixed step size (predictable)
   * - No error estimation
   * - Good for well-behaved systems
   */
  private recommendRK4(
    stiffness: StiffnessRating,
    systemSize: number
  ): SolverRecommendation {
    return {
      solverType: 'RK4',
      config: {
        type: 'RK4',
        dt: this.estimateTimeStep(stiffness, 'non-stiff'),
        maxStep: 0.01,
      },
      justification:
        `RK4 selected for non-stiff system (stiffness ratio ${stiffness.ratio.toFixed(1)}:1). ` +
        `Fast explicit method suitable for smooth dynamics with similar time scales.`,
      expectedProperties: {
        stepsPerSecond: 1000 / this.estimateTimeStep(stiffness, 'non-stiff'),
        estimatedAccuracy: 1e-4,
        computeTimePerStep: 0.001 * systemSize, // Rough estimate in ms
      },
    };
  }

  /**
   * Recommend RK45 for mildly-stiff systems
   * - Adaptive step size (automatic dt adjustment)
   * - Error estimation (6 function evaluations)
   * - Good for time scale separation < 100
   * - Balances accuracy and speed
   */
  private recommendRK45(
    stiffness: StiffnessRating,
    systemSize: number
  ): SolverRecommendation {
    return {
      solverType: 'RK45',
      config: {
        type: 'RK45',
        dt: this.estimateTimeStep(stiffness, 'mildly-stiff'),
        tolerance: 1e-5,
        absoluteTolerance: 1e-8,
        maxStep: 0.01,
        minStep: 1e-6,
      },
      justification:
        `RK45 selected for mildly-stiff system (stiffness ratio ${stiffness.ratio.toFixed(1)}:1). ` +
        `Adaptive method automatically adjusts step size for accuracy and efficiency. ` +
        `Suitable for systems with feedback and time scale separation.`,
      expectedProperties: {
        stepsPerSecond: 500 / this.estimateTimeStep(stiffness, 'mildly-stiff'),
        estimatedAccuracy: 1e-5,
        computeTimePerStep: 0.006 * systemSize,
      },
    };
  }

  /**
   * Recommend BDF for stiff systems
   * - Implicit (stable for stiff equations)
   * - Backward differentiation (up to 5th order)
   * - Newton iteration (requires Jacobian or numerical approximation)
   * - Good for stiffness ratio 100-1000
   *
   * Note: Currently placeholder, will be implemented via WASM
   */
  private recommendBDF(
    stiffness: StiffnessRating,
    systemSize: number
  ): SolverRecommendation {
    return {
      solverType: 'BDF',
      config: {
        type: 'BDF',
        dt: this.estimateTimeStep(stiffness, 'stiff'),
        tolerance: 1e-6,
        absoluteTolerance: 1e-9,
        maxStep: 0.01,
        minStep: 1e-6,
        maxIterations: 10,
      },
      justification:
        `BDF selected for stiff system (stiffness ratio ${stiffness.ratio.toFixed(1)}:1). ` +
        `Implicit method stable for large time scale separation. ` +
        `Recommended for systems with multiple time constants and feedback loops. ` +
        `[Currently implemented via RK45 fallback - WASM integration planned]`,
      expectedProperties: {
        stepsPerSecond: 100 / this.estimateTimeStep(stiffness, 'stiff'),
        estimatedAccuracy: 1e-6,
        computeTimePerStep: 0.02 * systemSize, // Implicit methods slower but larger steps
      },
    };
  }

  /**
   * Recommend IDA for very-stiff systems
   * - DAE solver (handles both differential and algebraic equations)
   * - Implicit, variable-order (up to 5th)
   * - Newton iteration with sparse Jacobian
   * - Best for stiffness ratio > 1000 and very fast transients
   *
   * Note: Currently placeholder, will be implemented via WASM
   */
  private recommendIDA(
    stiffness: StiffnessRating,
    systemSize: number
  ): SolverRecommendation {
    return {
      solverType: 'IDA',
      config: {
        type: 'IDA',
        dt: this.estimateTimeStep(stiffness, 'very-stiff'),
        tolerance: 1e-8,
        absoluteTolerance: 1e-10,
        maxStep: 0.01,
        minStep: 1e-7,
        maxIterations: 20,
      },
      justification:
        `IDA selected for very-stiff system (stiffness ratio ${stiffness.ratio.toFixed(1)}:1). ` +
        `DAE solver with variable-order implicit methods handles severe stiffness and ` +
        `algebraic constraints. Recommended for bond graphs with critical feedback ` +
        `(${stiffness.feedbackContribution > 0.5 ? 'unstable' : 'stable'} feedback detected). ` +
        `[Currently implemented via RK45 fallback - WASM integration planned]`,
      expectedProperties: {
        stepsPerSecond: 50 / this.estimateTimeStep(stiffness, 'very-stiff'),
        estimatedAccuracy: 1e-8,
        computeTimePerStep: 0.05 * systemSize, // Implicit DAE methods slower but robust
      },
    };
  }

  /**
   * Estimate appropriate time step for real-time simulation
   *
   * Target: 60 FPS (16.67 ms per frame)
   * Strategy: Use 8-10 solver steps per display frame
   * Constraint: dt must be << fastest time constant
   */
  estimateTimeStep(
    stiffness: StiffnessRating,
    classification?: string
  ): number {
    const targetFPS = 60;
    const frameTime = 1 / targetFPS; // ~16.67 ms
    const stepsPerFrame = 8;
    const dt = frameTime / stepsPerFrame; // ~2.08 ms

    // Further constrain based on stiffness
    const effectiveClassification = classification || stiffness.classification;

    let maxSafeDt = dt;

    if (effectiveClassification === 'non-stiff') {
      // Can use larger steps for non-stiff systems
      maxSafeDt = dt * 2;
    } else if (effectiveClassification === 'mildly-stiff') {
      maxSafeDt = dt;
    } else if (effectiveClassification === 'stiff') {
      // Reduce steps for stiff systems
      maxSafeDt = dt / 2;
    } else {
      // very-stiff: very small steps
      maxSafeDt = dt / 5;
    }

    return maxSafeDt;
  }

  /**
   * Estimate maximum time step for stability
   *
   * For explicit methods: dt < 2/λ where λ is largest eigenvalue
   * For stiff systems, even smaller steps may be needed
   */
  estimateMaxTimeStep(
    stiffness: StiffnessRating,
    fastestTimeConstant: number
  ): number {
    // Conservative: dt should be << fastest time constant
    // General rule: dt < τ / 10 where τ is fastest time constant

    const conservativeFactor = 10;
    let maxDt = fastestTimeConstant / conservativeFactor;

    // For very stiff systems, use even smaller steps
    if (stiffness.classification === 'very-stiff') {
      maxDt = fastestTimeConstant / 100;
    } else if (stiffness.classification === 'stiff') {
      maxDt = fastestTimeConstant / 50;
    }

    return Math.max(1e-6, maxDt); // Ensure non-zero minimum
  }

  /**
   * Check if solver is suitable for given stiffness
   */
  isSuitableForStiffness(
    solverType: 'RK4' | 'RK45' | 'BDF' | 'IDA',
    stiffness: StiffnessRating
  ): boolean {
    const ratio = stiffness.ratio;

    switch (solverType) {
      case 'RK4':
        return ratio < 10; // Only for non-stiff
      case 'RK45':
        return ratio < 100; // Non-stiff and mildly-stiff
      case 'BDF':
        return ratio < 10000; // Stiff systems
      case 'IDA':
        return true; // Works for all stiffness levels
    }
  }

  /**
   * Estimate computation time per step
   *
   * Rough estimates based on system size and solver type:
   * - RK4: 4 function evals
   * - RK45: 6 function evals
   * - BDF: 1-2 function evals + Newton iterations
   * - IDA: 1-2 function evals + Newton iterations
   */
  estimateStepTime(
    solverType: 'RK4' | 'RK45' | 'BDF' | 'IDA',
    systemSize: number,
    stiffness?: StiffnessRating
  ): {
    explicit: number; // Time to compute RHS in ms
    total: number; // Including overhead
  } {
    const timePerEval = 0.001 * systemSize; // ~1 ms per 1000 elements

    let evals = 4; // Base for RK4
    let overhead = 0.2; // ms

    switch (solverType) {
      case 'RK4':
        evals = 4;
        overhead = 0.1;
        break;
      case 'RK45':
        evals = 6;
        overhead = 0.2;
        break;
      case 'BDF':
        evals = 2 + (stiffness?.classification === 'stiff' ? 5 : 3); // Newton iterations
        overhead = 0.5;
        break;
      case 'IDA':
        evals = 2 + (stiffness?.classification === 'very-stiff' ? 10 : 5);
        overhead = 1.0;
        break;
    }

    return {
      explicit: evals * timePerEval,
      total: evals * timePerEval + overhead,
    };
  }

  /**
   * Generate recommendation summary for display
   */
  summarizeRecommendation(recommendation: SolverRecommendation): string {
    return (
      `${recommendation.solverType} Solver\n` +
      `${recommendation.justification}\n\n` +
      `Expected Performance:\n` +
      `  • Steps/sec: ${recommendation.expectedProperties.stepsPerSecond.toFixed(0)}\n` +
      `  • Accuracy: ~10⁻${Math.round(-Math.log10(recommendation.expectedProperties.estimatedAccuracy))}\n` +
      `  • Time/step: ~${recommendation.expectedProperties.computeTimePerStep.toFixed(2)} ms`
    );
  }
}

/**
 * Convenience function: Select solver by stiffness
 */
export function selectSolverForStiffness(
  stiffness: StiffnessRating,
  systemSize?: number
): SolverRecommendation {
  const selector = new SolverSelector();
  return selector.selectByStiffness(stiffness, systemSize);
}

/**
 * Convenience function: Estimate time step
 */
export function estimateOptimalTimeStep(
  stiffness: StiffnessRating,
  classification?: string
): number {
  const selector = new SolverSelector();
  return selector.estimateTimeStep(stiffness, classification);
}
