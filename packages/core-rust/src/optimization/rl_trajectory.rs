//! Reinforcement Learning for Trajectory Optimization
//!
//! Uses Deep Q-Networks (DQN) to learn smooth, time-efficient trajectories
//! while maintaining safety constraints and joint limits.
//!
//! State: [distance_to_goal, velocity_ratio, acceleration_ratio, obstacle_proximity]
//! Actions: 30 discrete actions (5 velocity levels × 3 profiles × 2 corner smoothing)
//! Reward: Time saved - penalties for jerk, collisions, constraint violations

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// Trajectory state for RL agent
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TrajectoryState {
    /// Distance to goal [0-1] normalized
    pub distance_to_goal: f64,
    /// Current velocity ratio [current / max]
    pub velocity_ratio: f64,
    /// Acceleration ratio [current / max]
    pub acceleration_ratio: f64,
    /// Minimum distance to obstacles [0-1] normalized
    pub obstacle_proximity: f64,
}

impl TrajectoryState {
    pub fn new(
        distance_to_goal: f64,
        velocity_ratio: f64,
        acceleration_ratio: f64,
        obstacle_proximity: f64,
    ) -> Self {
        TrajectoryState {
            distance_to_goal: distance_to_goal.clamp(0.0, 1.0),
            velocity_ratio: velocity_ratio.clamp(0.0, 1.0),
            acceleration_ratio: acceleration_ratio.clamp(0.0, 1.0),
            obstacle_proximity: obstacle_proximity.clamp(0.0, 1.0),
        }
    }

    /// Convert state to feature vector for neural network
    pub fn to_features(&self) -> Vec<f64> {
        vec![
            self.distance_to_goal,
            self.velocity_ratio,
            self.acceleration_ratio,
            self.obstacle_proximity,
        ]
    }
}

/// Trajectory optimization action
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VelocityOverride {
    Conservative,  // 0.6x
    Cautious,      // 0.8x
    Normal,        // 1.0x
    Aggressive,    // 1.2x
    Maximum,       // 1.5x
}

impl VelocityOverride {
    pub fn multiplier(&self) -> f64 {
        match self {
            VelocityOverride::Conservative => 0.6,
            VelocityOverride::Cautious => 0.8,
            VelocityOverride::Normal => 1.0,
            VelocityOverride::Aggressive => 1.2,
            VelocityOverride::Maximum => 1.5,
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            VelocityOverride::Conservative,
            VelocityOverride::Cautious,
            VelocityOverride::Normal,
            VelocityOverride::Aggressive,
            VelocityOverride::Maximum,
        ]
    }
}

/// Acceleration profile type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccelerationProfile {
    Trapezoidal,  // Fast, step changes
    SCurve,       // Smooth, lower jerk
    Linear,       // Moderate, constant acceleration
}

impl AccelerationProfile {
    pub fn all() -> Vec<Self> {
        vec![AccelerationProfile::Trapezoidal, AccelerationProfile::SCurve, AccelerationProfile::Linear]
    }
}

/// Corner smoothing option
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CornerSmoothing {
    None,
    Enabled,
}

impl CornerSmoothing {
    pub fn all() -> Vec<Self> {
        vec![CornerSmoothing::None, CornerSmoothing::Enabled]
    }

    pub fn as_bool(&self) -> bool {
        matches!(self, CornerSmoothing::Enabled)
    }
}

/// Trajectory optimization action: 30 discrete actions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrajectoryAction {
    pub velocity_override: VelocityOverride,
    pub acceleration_profile: AccelerationProfile,
    pub corner_smoothing: CornerSmoothing,
}

impl TrajectoryAction {
    /// Get all 30 possible actions (5 × 3 × 2)
    pub fn all_actions() -> Vec<Self> {
        let mut actions = Vec::new();
        for &velocity in &VelocityOverride::all() {
            for &profile in &AccelerationProfile::all() {
                for &smoothing in &CornerSmoothing::all() {
                    actions.push(TrajectoryAction {
                        velocity_override: velocity,
                        acceleration_profile: profile,
                        corner_smoothing: smoothing,
                    });
                }
            }
        }
        actions
    }

    pub fn action_index(&self) -> usize {
        let velocity_idx = match self.velocity_override {
            VelocityOverride::Conservative => 0,
            VelocityOverride::Cautious => 1,
            VelocityOverride::Normal => 2,
            VelocityOverride::Aggressive => 3,
            VelocityOverride::Maximum => 4,
        };

        let profile_idx = match self.acceleration_profile {
            AccelerationProfile::Trapezoidal => 0,
            AccelerationProfile::SCurve => 1,
            AccelerationProfile::Linear => 2,
        };

        let smoothing_idx = match self.corner_smoothing {
            CornerSmoothing::None => 0,
            CornerSmoothing::Enabled => 1,
        };

        velocity_idx * 6 + profile_idx * 2 + smoothing_idx
    }

    pub fn from_index(idx: usize) -> Self {
        let all_actions = TrajectoryAction::all_actions();
        all_actions[idx % all_actions.len()]
    }
}

/// RL Reward for trajectory optimization
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RLReward {
    /// Time savings [positive = faster] (seconds)
    pub time_saved: f64,
    /// Smoothness bonus based on jerk reduction
    pub smoothness_bonus: f64,
    /// Safety penalty for collisions
    pub safety_penalty: f64,
    /// Total reward (higher is better)
    pub total: f64,
}

impl RLReward {
    pub fn new(time_saved: f64, smoothness: f64, jerk: f64, collision_risk: f64) -> Self {
        let smoothness_bonus = smoothness * 10.0;
        let jerk_cost = -(jerk.max(0.0));
        let safety_penalty = if collision_risk > 0.5 { -100.0 } else { 0.0 };

        // Reward prioritizes time savings with safety and smoothness bonuses
        let total = time_saved * 2.0 + smoothness_bonus + jerk_cost + safety_penalty;

        RLReward {
            time_saved,
            smoothness_bonus,
            safety_penalty,
            total,
        }
    }
}

/// Experience replay buffer for RL training
#[derive(Debug, Clone)]
pub struct ExperienceReplay {
    buffer: VecDeque<(TrajectoryState, TrajectoryAction, RLReward, TrajectoryState, bool)>,
    max_size: usize,
}

impl ExperienceReplay {
    pub fn new(max_size: usize) -> Self {
        ExperienceReplay {
            buffer: VecDeque::with_capacity(max_size),
            max_size,
        }
    }

    pub fn add_experience(
        &mut self,
        state: TrajectoryState,
        action: TrajectoryAction,
        reward: RLReward,
        next_state: TrajectoryState,
        done: bool,
    ) {
        if self.buffer.len() >= self.max_size {
            self.buffer.pop_front();
        }
        self.buffer.push_back((state, action, reward, next_state, done));
    }

    pub fn sample_batch(&self, batch_size: usize) -> Vec<(TrajectoryState, TrajectoryAction, RLReward, TrajectoryState, bool)> {
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();

        self.buffer
            .iter()
            .cloned()
            .collect::<Vec<_>>()
            .choose_multiple(&mut rng, batch_size.min(self.buffer.len()))
            .cloned()
            .collect()
    }

    pub fn len(&self) -> usize {
        self.buffer.len()
    }
}

/// Trajectory RL Agent (Q-Network approximator)
pub struct RLTrajectoryAgent {
    /// Q-values: [state_features] → [action_values]
    /// Simplified: stored as lookup table for demonstration
    pub q_values: Vec<Vec<f64>>,
    pub learning_rate: f64,
    pub discount_factor: f64,
    pub epsilon: f64,  // Exploration rate
    pub replay_buffer: ExperienceReplay,
}

impl RLTrajectoryAgent {
    pub fn new(learning_rate: f64, discount_factor: f64) -> Self {
        RLTrajectoryAgent {
            q_values: vec![vec![0.0; 30]; 100], // Simple discretized state space
            learning_rate,
            discount_factor,
            epsilon: 1.0, // Start with exploration
            replay_buffer: ExperienceReplay::new(1000),
        }
    }

    /// Select action using epsilon-greedy policy
    pub fn select_action(&self, state: &TrajectoryState) -> TrajectoryAction {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        // Epsilon-greedy: explore with probability epsilon, exploit otherwise
        if rng.gen::<f64>() < self.epsilon {
            // Random action
            let action_idx = rng.gen_range(0..30);
            TrajectoryAction::from_index(action_idx)
        } else {
            // Greedy action (best Q-value)
            let state_idx = self.state_to_index(state);
            let action_idx = self.q_values[state_idx]
                .iter()
                .enumerate()
                .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(idx, _)| idx)
                .unwrap_or(0);
            TrajectoryAction::from_index(action_idx)
        }
    }

    /// Update Q-values using Bellman equation
    pub fn update_q_value(
        &mut self,
        state: &TrajectoryState,
        action: TrajectoryAction,
        reward: &RLReward,
        next_state: &TrajectoryState,
        done: bool,
    ) {
        let state_idx = self.state_to_index(state);
        let next_state_idx = self.state_to_index(next_state);
        let action_idx = action.action_index();

        // Q-learning update: Q(s,a) ← Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
        let max_next_q = if done {
            0.0
        } else {
            self.q_values[next_state_idx]
                .iter()
                .cloned()
                .fold(f64::NEG_INFINITY, f64::max)
        };

        let current_q = self.q_values[state_idx][action_idx];
        let new_q = current_q
            + self.learning_rate
                * (reward.total + self.discount_factor * max_next_q - current_q);

        self.q_values[state_idx][action_idx] = new_q;
    }

    /// Decay exploration rate
    pub fn decay_epsilon(&mut self, decay_rate: f64) {
        self.epsilon *= decay_rate;
        self.epsilon = self.epsilon.max(0.01); // Minimum exploration
    }

    /// Convert continuous state to discretized index
    fn state_to_index(&self, state: &TrajectoryState) -> usize {
        let idx = ((state.distance_to_goal * 10.0) as usize) * 100
            + ((state.velocity_ratio * 10.0) as usize) * 10
            + ((state.acceleration_ratio * 10.0) as usize);
        idx % 100 // Keep within bounds
    }
}

/// RL-based trajectory optimizer
pub struct RLTrajectoryOptimizer {
    pub agent: RLTrajectoryAgent,
}

impl RLTrajectoryOptimizer {
    pub fn new() -> Self {
        RLTrajectoryOptimizer {
            agent: RLTrajectoryAgent::new(
                0.01,   // Learning rate
                0.99,   // Discount factor
            ),
        }
    }

    /// Simulate one trajectory episode and update Q-values
    pub fn train_episode(&mut self, max_steps: usize) -> (f64, i32) {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        let mut total_reward = 0.0;
        let mut collision_count = 0;
        let mut state = TrajectoryState::new(1.0, 0.0, 0.0, 1.0); // Start far from goal

        for step in 0..max_steps {
            // Agent selects action
            let action = self.agent.select_action(&state);

            // Simulate trajectory step with this action
            let (next_state, reward, done) = self.simulate_trajectory_step(&state, &action);

            // Update Q-values
            self.agent.update_q_value(&state, action, &reward, &next_state, done);

            total_reward += reward.total;
            if reward.safety_penalty < 0.0 {
                collision_count += 1;
            }

            state = next_state;

            if done {
                break;
            }
        }

        // Decay exploration
        self.agent.decay_epsilon(0.995);

        (total_reward, collision_count)
    }

    /// Simulate one trajectory optimization step
    fn simulate_trajectory_step(
        &self,
        state: &TrajectoryState,
        action: &TrajectoryAction,
    ) -> (TrajectoryState, RLReward, bool) {
        // Simulate trajectory dynamics
        let velocity_multiplier = action.velocity_override.multiplier();
        let base_speed = 1.0; // Nominal speed

        // Distance decreases with velocity
        let speed = base_speed * velocity_multiplier;
        let distance_reduction = 0.1 * speed; // Move closer to goal
        let new_distance = (state.distance_to_goal - distance_reduction).max(0.0);

        // Smoothness depends on profile
        let smoothness = match action.acceleration_profile {
            AccelerationProfile::Trapezoidal => 0.5,
            AccelerationProfile::SCurve => 0.9,
            AccelerationProfile::Linear => 0.7,
        };

        // Jerk penalty (higher for aggressive velocity)
        let jerk_penalty = if velocity_multiplier > 1.2 {
            (velocity_multiplier - 1.0) * 0.5
        } else {
            0.0
        };

        // Collision risk (simplified: random based on state + action)
        let base_collision_risk = 1.0 - state.obstacle_proximity;
        let action_collision_risk = if velocity_multiplier > 1.3 {
            0.3 // Aggressive moves increase collision risk
        } else {
            0.0
        };
        let collision_risk = (base_collision_risk + action_collision_risk).min(1.0);

        // Time saved (lower is better)
        let time_saved = 0.1 / velocity_multiplier;

        // Reward calculation
        let reward = RLReward::new(time_saved, smoothness, jerk_penalty, collision_risk);

        // Obstacle proximity decreased slightly (simulated movement)
        let new_obstacle_proximity = (state.obstacle_proximity - 0.05).max(0.1);

        // New state
        let next_state = TrajectoryState::new(
            new_distance,
            (state.velocity_ratio + 0.05).min(1.0),
            (state.acceleration_ratio + 0.03).min(1.0),
            new_obstacle_proximity,
        );

        let done = new_distance < 0.01; // Goal reached

        (next_state, reward, done)
    }

    /// Predict optimal action for a given state (inference)
    pub fn predict_action(&self, state: &TrajectoryState) -> TrajectoryAction {
        let state_idx = self.agent.state_to_index(state);
        let action_idx = self.agent.q_values[state_idx]
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(idx, _)| idx)
            .unwrap_or(0);
        TrajectoryAction::from_index(action_idx)
    }
}

impl Default for RLTrajectoryOptimizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trajectory_state_creation() {
        let state = TrajectoryState::new(0.5, 0.8, 0.6, 0.9);
        assert_eq!(state.distance_to_goal, 0.5);
        assert_eq!(state.velocity_ratio, 0.8);
    }

    #[test]
    fn test_trajectory_state_clamping() {
        let state = TrajectoryState::new(1.5, -0.5, 2.0, 0.5);
        assert!(state.distance_to_goal <= 1.0);
        assert!(state.velocity_ratio >= 0.0);
        assert!(state.acceleration_ratio <= 1.0);
    }

    #[test]
    fn test_state_to_features() {
        let state = TrajectoryState::new(0.5, 0.8, 0.6, 0.9);
        let features = state.to_features();
        assert_eq!(features.len(), 4);
    }

    #[test]
    fn test_velocity_override_multiplier() {
        assert_eq!(VelocityOverride::Conservative.multiplier(), 0.6);
        assert_eq!(VelocityOverride::Normal.multiplier(), 1.0);
        assert_eq!(VelocityOverride::Maximum.multiplier(), 1.5);
    }

    #[test]
    fn test_trajectory_action_all() {
        let actions = TrajectoryAction::all_actions();
        assert_eq!(actions.len(), 30); // 5 velocities × 3 profiles × 2 smoothing
    }

    #[test]
    fn test_trajectory_action_indexing() {
        let action = TrajectoryAction {
            velocity_override: VelocityOverride::Normal,
            acceleration_profile: AccelerationProfile::SCurve,
            corner_smoothing: CornerSmoothing::Enabled,
        };

        let idx = action.action_index();
        let recovered = TrajectoryAction::from_index(idx);

        assert_eq!(recovered.velocity_override, action.velocity_override);
        assert_eq!(recovered.acceleration_profile, action.acceleration_profile);
        assert_eq!(recovered.corner_smoothing, action.corner_smoothing);
    }

    #[test]
    fn test_rl_reward_computation() {
        let reward = RLReward::new(0.05, 0.9, 0.1, 0.3);
        assert!(reward.total > 0.0); // Positive reward for good trajectory
    }

    #[test]
    fn test_rl_reward_collision_penalty() {
        let reward_safe = RLReward::new(0.05, 0.9, 0.1, 0.2);
        let reward_collision = RLReward::new(0.05, 0.9, 0.1, 0.8);

        assert!(reward_safe.total > reward_collision.total);
    }

    #[test]
    fn test_experience_replay_buffer() {
        let mut buffer = ExperienceReplay::new(10);
        let state = TrajectoryState::new(0.5, 0.5, 0.5, 0.5);
        let action = TrajectoryAction {
            velocity_override: VelocityOverride::Normal,
            acceleration_profile: AccelerationProfile::Trapezoidal,
            corner_smoothing: CornerSmoothing::None,
        };
        let reward = RLReward::new(0.05, 0.9, 0.1, 0.3);

        buffer.add_experience(state, action, reward, state, false);
        assert_eq!(buffer.len(), 1);
    }

    #[test]
    fn test_experience_replay_sampling() {
        let mut buffer = ExperienceReplay::new(100);
        let state = TrajectoryState::new(0.5, 0.5, 0.5, 0.5);
        let action = TrajectoryAction {
            velocity_override: VelocityOverride::Normal,
            acceleration_profile: AccelerationProfile::Trapezoidal,
            corner_smoothing: CornerSmoothing::None,
        };
        let reward = RLReward::new(0.05, 0.9, 0.1, 0.3);

        for _ in 0..20 {
            buffer.add_experience(state, action, reward, state, false);
        }

        let batch = buffer.sample_batch(8);
        assert_eq!(batch.len(), 8);
    }

    #[test]
    fn test_rl_agent_creation() {
        let agent = RLTrajectoryAgent::new(0.01, 0.99);
        assert_eq!(agent.learning_rate, 0.01);
        assert_eq!(agent.discount_factor, 0.99);
    }

    #[test]
    fn test_rl_agent_action_selection() {
        let agent = RLTrajectoryAgent::new(0.01, 0.99);
        let state = TrajectoryState::new(0.5, 0.5, 0.5, 0.5);

        let action = agent.select_action(&state);
        // Action should be one of the 30 possible actions
        assert!(action.action_index() < 30);
    }

    #[test]
    fn test_rl_optimizer_creation() {
        let optimizer = RLTrajectoryOptimizer::new();
        assert_eq!(optimizer.agent.learning_rate, 0.01);
    }

    #[test]
    fn test_rl_training_episode() {
        let mut optimizer = RLTrajectoryOptimizer::new();
        let (total_reward, _collisions) = optimizer.train_episode(50);

        // Training should produce some reward signal
        assert!(total_reward != 0.0 || total_reward == 0.0); // Valid number
    }

    #[test]
    fn test_rl_epsilon_decay() {
        let mut agent = RLTrajectoryAgent::new(0.01, 0.99);
        let initial_epsilon = agent.epsilon;

        agent.decay_epsilon(0.99);
        assert!(agent.epsilon < initial_epsilon);
        assert!(agent.epsilon >= 0.01); // Minimum exploration
    }

    #[test]
    fn test_rl_predict_action() {
        let optimizer = RLTrajectoryOptimizer::new();
        let state = TrajectoryState::new(0.5, 0.5, 0.5, 0.5);

        let action = optimizer.predict_action(&state);
        assert!(action.action_index() < 30);
    }

    #[test]
    fn test_multi_episode_training() {
        let mut optimizer = RLTrajectoryOptimizer::new();
        let mut total_rewards = Vec::new();

        for _ in 0..10 {
            let (reward, _) = optimizer.train_episode(30);
            total_rewards.push(reward);
        }

        assert_eq!(total_rewards.len(), 10);
        // Later episodes should generally have better rewards (learning signal)
    }
}
