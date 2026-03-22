//! Phase 24: AI/ML Parameter Optimization
//!
//! Intelligent manufacturing parameter optimization using:
//! - Genetic algorithms for parameter search
//! - Neural networks for wear prediction
//! - Reinforcement learning for trajectory smoothing
//! - Design-for-Manufacturability analysis

pub mod genetic_algorithm;
pub mod wear_prediction;
pub mod rl_trajectory;
pub mod ml_cutting_forces;
pub mod dfm_checker;

pub use genetic_algorithm::{
    CuttingParameters, ParameterBounds, OptimizationObjective, FitnessEvaluation,
    GeneticOptimizer, OptimizationResult,
};
pub use wear_prediction::{
    WearPrediction, RiskLevel, CuttingConditionsRecord, TaylorConstants, ToolWearPredictor,
};
pub use rl_trajectory::{
    TrajectoryState, VelocityOverride, AccelerationProfile, CornerSmoothing,
    TrajectoryAction, RLReward, ExperienceReplay, RLTrajectoryAgent, RLTrajectoryOptimizer,
};
pub use ml_cutting_forces::{
    NeuralNetwork, ActivationType, CuttingForcePredictor,
};
pub use dfm_checker::{
    SeverityLevel, DFMResult, PCBDFMChecker, MechanicalDFMChecker,
    DesignMetrics, MechanicalMetrics, CostEstimator,
};
