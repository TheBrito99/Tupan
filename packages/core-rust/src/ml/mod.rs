//! Phase 28: Machine Learning Framework for Multi-Robot Swarm Learning
//! Task 1: Reinforcement Learning Agent Framework
//! Task 2: Behavior Cloning (Imitation Learning)
//! Task 3: Parameter Optimization (Genetic Algorithms + PSO)
//! Task 4: Digital Twin (Real-time Prediction & Validation)

pub mod rl_agent;
pub mod reward;
pub mod neural_network;
pub mod behavior_cloning;
pub mod parameter_optimization;
pub mod digital_twin;

pub use rl_agent::{Agent, AgentConfig, ActionSpace, StateSpace, Experience, ExperienceBuffer};
pub use reward::{RewardFunction, RewardConfig, FormationReward, RewardBreakdown};
pub use neural_network::{NeuralNetwork, NetworkLayer, ActivationFunction};
pub use behavior_cloning::{ExpertDemonstration, ExpertDataset, BehaviorCloner, DAggerTrainer};
pub use parameter_optimization::{
    HyperparameterSet, Individual, GeneticAlgorithm, Particle, ParticleSwarmOptimizer,
    GridSearchOptimizer, ParticleVelocity,
};
pub use digital_twin::{
    SystemObservation, Prediction, DigitalTwin, ValidationResult, AccuracyMetrics,
};

#[cfg(test)]
mod integration_tests;
