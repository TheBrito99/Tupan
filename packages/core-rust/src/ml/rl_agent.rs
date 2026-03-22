//! Phase 28 Task 1a: RL Agent Framework
//! Core agent infrastructure with state/action spaces and experience replay

use crate::clifford_algebra::spatialization::Point3D;
use std::collections::VecDeque;

/// Continuous action space for swarm robot control
#[derive(Debug, Clone)]
pub struct ActionSpace {
    pub dim: usize,                  // Dimensionality (velocity x/y/z, angular velocities)
    pub low_bounds: Vec<f64>,        // Min values per dimension
    pub high_bounds: Vec<f64>,       // Max values per dimension
}

impl ActionSpace {
    /// Create 3D velocity action space
    pub fn velocity_3d(max_speed: f64) -> Self {
        Self {
            dim: 3,
            low_bounds: vec![-max_speed; 3],
            high_bounds: vec![max_speed; 3],
        }
    }

    /// Create 6D velocity + angular velocity space
    pub fn velocity_6d(max_speed: f64, max_angular: f64) -> Self {
        Self {
            dim: 6,
            low_bounds: vec![-max_speed, -max_speed, -max_speed, -max_angular, -max_angular, -max_angular],
            high_bounds: vec![max_speed, max_speed, max_speed, max_angular, max_angular, max_angular],
        }
    }

    /// Clip action to bounds
    pub fn clip_action(&self, action: &mut [f64]) {
        for (i, a) in action.iter_mut().enumerate() {
            *a = a.clamp(self.low_bounds[i], self.high_bounds[i]);
        }
    }

    /// Check if action is valid
    pub fn is_valid(&self, action: &[f64]) -> bool {
        if action.len() != self.dim {
            return false;
        }
        action.iter().zip(self.low_bounds.iter().zip(self.high_bounds.iter()))
            .all(|(a, (lo, hi))| a >= lo && a <= hi)
    }
}

/// State space for multi-robot swarm observations
#[derive(Debug, Clone)]
pub struct StateSpace {
    pub dim: usize,                  // Dimensionality
    pub obs_per_robot: usize,        // Observations per robot (position, velocity, etc.)
}

impl StateSpace {
    /// Create state space for n robots with 3D position + velocity observations
    pub fn multi_robot_3d(num_robots: usize) -> Self {
        let obs_per_robot = 6; // x, y, z, vx, vy, vz
        Self {
            dim: num_robots * obs_per_robot,
            obs_per_robot,
        }
    }

    /// Extract robot observations as vector
    pub fn encode_observations(
        &self,
        positions: &[Point3D],
        velocities: &[(f64, f64, f64)],
    ) -> Vec<f64> {
        let mut obs = Vec::with_capacity(self.dim);

        for (pos, vel) in positions.iter().zip(velocities.iter()) {
            obs.push(pos.x);
            obs.push(pos.y);
            obs.push(pos.z);
            obs.push(vel.0);
            obs.push(vel.1);
            obs.push(vel.2);
        }

        obs
    }
}

/// Single experience: (state, action, reward, next_state, done)
#[derive(Debug, Clone)]
pub struct Experience {
    pub state: Vec<f64>,
    pub action: Vec<f64>,
    pub reward: f64,
    pub next_state: Vec<f64>,
    pub done: bool,
}

impl Experience {
    pub fn new(
        state: Vec<f64>,
        action: Vec<f64>,
        reward: f64,
        next_state: Vec<f64>,
        done: bool,
    ) -> Self {
        Self {
            state,
            action,
            reward,
            next_state,
            done,
        }
    }
}

/// Experience replay buffer for off-policy learning
pub struct ExperienceBuffer {
    buffer: VecDeque<Experience>,
    max_size: usize,
}

impl ExperienceBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(max_size),
            max_size,
        }
    }

    /// Add experience to buffer
    pub fn add(&mut self, experience: Experience) {
        if self.buffer.len() >= self.max_size {
            self.buffer.pop_front();
        }
        self.buffer.push_back(experience);
    }

    /// Get buffer size
    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    /// Check if buffer is full
    pub fn is_full(&self) -> bool {
        self.buffer.len() >= self.max_size
    }

    /// Sample random batch for training
    pub fn sample_batch(&self, batch_size: usize) -> Vec<Experience> {
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();

        let buffer_slice: Vec<_> = self.buffer.iter().collect();
        buffer_slice
            .choose_multiple(&mut rng, batch_size.min(self.buffer.len()))
            .map(|e| (*e).clone())
            .collect()
    }

    /// Clear buffer
    pub fn clear(&mut self) {
        self.buffer.clear();
    }

    /// Get all experiences
    pub fn all(&self) -> Vec<Experience> {
        self.buffer.iter().cloned().collect()
    }
}

/// Agent configuration
#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub state_dim: usize,
    pub action_dim: usize,
    pub learning_rate: f64,
    pub gamma: f64,                 // Discount factor
    pub buffer_size: usize,
    pub batch_size: usize,
    pub epsilon: f64,               // Exploration rate (ε-greedy)
    pub epsilon_decay: f64,
    pub min_epsilon: f64,
}

impl AgentConfig {
    pub fn default_swarm() -> Self {
        Self {
            state_dim: 30,             // 5 robots × 6 obs each
            action_dim: 3,             // 3D velocity
            learning_rate: 0.001,
            gamma: 0.99,
            buffer_size: 10000,
            batch_size: 32,
            epsilon: 1.0,
            epsilon_decay: 0.995,
            min_epsilon: 0.01,
        }
    }
}

/// Reinforcement learning agent with policy and value networks
pub struct Agent {
    pub config: AgentConfig,
    pub action_space: ActionSpace,
    pub state_space: StateSpace,
    pub experience_buffer: ExperienceBuffer,
    pub total_steps: u64,
    pub episode_count: u32,
}

impl Agent {
    pub fn new(config: AgentConfig, action_space: ActionSpace, state_space: StateSpace) -> Self {
        Self {
            config: config.clone(),
            action_space,
            state_space,
            experience_buffer: ExperienceBuffer::new(config.buffer_size),
            total_steps: 0,
            episode_count: 0,
        }
    }

    /// Store experience in replay buffer
    pub fn remember(
        &mut self,
        state: Vec<f64>,
        action: Vec<f64>,
        reward: f64,
        next_state: Vec<f64>,
        done: bool,
    ) {
        let experience = Experience::new(state, action, reward, next_state, done);
        self.experience_buffer.add(experience);
        self.total_steps += 1;
    }

    /// Decay exploration rate
    pub fn decay_epsilon(&mut self) {
        let new_epsilon = (self.config.epsilon * self.config.epsilon_decay).max(self.config.min_epsilon);
        self.config.epsilon = new_epsilon;
    }

    /// Complete one episode
    pub fn end_episode(&mut self) {
        self.episode_count += 1;
        self.decay_epsilon();
    }

    /// Get sample batch for training
    pub fn get_training_batch(&self) -> Vec<Experience> {
        self.experience_buffer.sample_batch(self.config.batch_size)
    }

    /// Check if ready to train
    pub fn is_ready_to_train(&self) -> bool {
        self.experience_buffer.len() >= self.config.batch_size
    }

    /// Reset for new training session
    pub fn reset(&mut self) {
        self.experience_buffer.clear();
        self.total_steps = 0;
        self.episode_count = 0;
        self.config.epsilon = 1.0;
    }

    /// Get buffer statistics
    pub fn buffer_stats(&self) -> (usize, f64, f64, f64) {
        let buffer = &self.experience_buffer.buffer;
        let n = buffer.len();

        if n == 0 {
            return (0, 0.0, 0.0, 0.0);
        }

        let sum_reward: f64 = buffer.iter().map(|e| e.reward).sum();
        let avg_reward = sum_reward / n as f64;
        let min_reward = buffer.iter().map(|e| e.reward).fold(f64::INFINITY, f64::min);
        let max_reward = buffer.iter().map(|e| e.reward).fold(f64::NEG_INFINITY, f64::max);

        (n, avg_reward, min_reward, max_reward)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_action_space_velocity_3d() {
        let action_space = ActionSpace::velocity_3d(1.0);
        assert_eq!(action_space.dim, 3);
        assert_eq!(action_space.low_bounds, vec![-1.0, -1.0, -1.0]);
        assert_eq!(action_space.high_bounds, vec![1.0, 1.0, 1.0]);
    }

    #[test]
    fn test_action_space_velocity_6d() {
        let action_space = ActionSpace::velocity_6d(1.0, 2.0);
        assert_eq!(action_space.dim, 6);
        assert_eq!(action_space.low_bounds[0], -1.0); // linear velocity x
        assert_eq!(action_space.low_bounds[3], -2.0); // angular velocity x
    }

    #[test]
    fn test_action_clipping() {
        let action_space = ActionSpace::velocity_3d(1.0);
        let mut action = vec![2.0, -2.0, 0.5];
        action_space.clip_action(&mut action);

        assert_eq!(action[0], 1.0);   // clipped from 2.0
        assert_eq!(action[1], -1.0);  // clipped from -2.0
        assert_eq!(action[2], 0.5);   // unchanged
    }

    #[test]
    fn test_action_validation() {
        let action_space = ActionSpace::velocity_3d(1.0);
        assert!(action_space.is_valid(&vec![0.5, -0.5, 0.0]));
        assert!(!action_space.is_valid(&vec![2.0, 0.0, 0.0])); // exceeds bounds
        assert!(!action_space.is_valid(&vec![0.0, 0.0]));      // wrong dimension
    }

    #[test]
    fn test_state_space_multi_robot() {
        let state_space = StateSpace::multi_robot_3d(5);
        assert_eq!(state_space.dim, 30);
        assert_eq!(state_space.obs_per_robot, 6);
    }

    #[test]
    fn test_state_encoding() {
        let state_space = StateSpace::multi_robot_3d(2);
        let positions = vec![
            Point3D { x: 1.0, y: 2.0, z: 3.0 },
            Point3D { x: 4.0, y: 5.0, z: 6.0 },
        ];
        let velocities = vec![(0.1, 0.2, 0.3), (0.4, 0.5, 0.6)];

        let obs = state_space.encode_observations(&positions, &velocities);
        assert_eq!(obs.len(), 12);
        assert_eq!(obs[0], 1.0);  // robot 0, x
        assert_eq!(obs[3], 0.1);  // robot 0, vx
        assert_eq!(obs[6], 4.0);  // robot 1, x
    }

    #[test]
    fn test_experience_creation() {
        let exp = Experience::new(
            vec![1.0, 2.0],
            vec![0.5],
            10.0,
            vec![1.1, 2.1],
            false,
        );

        assert_eq!(exp.reward, 10.0);
        assert!(!exp.done);
    }

    #[test]
    fn test_experience_buffer_add() {
        let mut buffer = ExperienceBuffer::new(5);
        assert_eq!(buffer.len(), 0);

        let exp = Experience::new(vec![1.0], vec![0.5], 1.0, vec![1.1], false);
        buffer.add(exp);

        assert_eq!(buffer.len(), 1);
    }

    #[test]
    fn test_experience_buffer_max_size() {
        let mut buffer = ExperienceBuffer::new(3);

        for i in 0..5 {
            let exp = Experience::new(
                vec![i as f64],
                vec![0.5],
                i as f64,
                vec![i as f64 + 0.1],
                false,
            );
            buffer.add(exp);
        }

        // Should keep only last 3
        assert_eq!(buffer.len(), 3);
    }

    #[test]
    fn test_experience_buffer_sampling() {
        let mut buffer = ExperienceBuffer::new(10);

        for i in 0..10 {
            let exp = Experience::new(
                vec![i as f64],
                vec![0.5],
                i as f64,
                vec![i as f64 + 0.1],
                false,
            );
            buffer.add(exp);
        }

        let batch = buffer.sample_batch(4);
        assert_eq!(batch.len(), 4);
    }

    #[test]
    fn test_experience_buffer_clear() {
        let mut buffer = ExperienceBuffer::new(10);
        let exp = Experience::new(vec![1.0], vec![0.5], 1.0, vec![1.1], false);

        buffer.add(exp);
        assert_eq!(buffer.len(), 1);

        buffer.clear();
        assert_eq!(buffer.len(), 0);
    }

    #[test]
    fn test_agent_config_default() {
        let config = AgentConfig::default_swarm();
        assert_eq!(config.state_dim, 30);
        assert_eq!(config.action_dim, 3);
        assert!(config.gamma > 0.9);
    }

    #[test]
    fn test_agent_creation() {
        let config = AgentConfig::default_swarm();
        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);

        let agent = Agent::new(config, action_space, state_space);
        assert_eq!(agent.total_steps, 0);
        assert_eq!(agent.episode_count, 0);
    }

    #[test]
    fn test_agent_remember() {
        let config = AgentConfig::default_swarm();
        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);

        let mut agent = Agent::new(config, action_space, state_space);

        let state = vec![1.0; 30];
        let action = vec![0.5, -0.5, 0.0];
        let next_state = vec![1.1; 30];

        agent.remember(state, action, 10.0, next_state, false);
        assert_eq!(agent.total_steps, 1);
        assert_eq!(agent.experience_buffer.len(), 1);
    }

    #[test]
    fn test_agent_epsilon_decay() {
        let mut config = AgentConfig::default_swarm();
        config.epsilon = 1.0;
        config.epsilon_decay = 0.9;

        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);
        let mut agent = Agent::new(config, action_space, state_space);

        let epsilon_before = agent.config.epsilon;
        agent.decay_epsilon();
        let epsilon_after = agent.config.epsilon;

        assert!(epsilon_after < epsilon_before);
        assert!(epsilon_after >= agent.config.min_epsilon);
    }

    #[test]
    fn test_agent_ready_to_train() {
        let mut config = AgentConfig::default_swarm();
        config.buffer_size = 100;
        config.batch_size = 10;

        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);
        let mut agent = Agent::new(config, action_space, state_space);

        assert!(!agent.is_ready_to_train());

        for i in 0..15 {
            let state = vec![i as f64; 30];
            let action = vec![0.0; 3];
            let next_state = vec![i as f64 + 0.1; 30];
            agent.remember(state, action, 1.0, next_state, false);
        }

        assert!(agent.is_ready_to_train());
    }

    #[test]
    fn test_agent_buffer_stats() {
        let config = AgentConfig::default_swarm();
        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);
        let mut agent = Agent::new(config, action_space, state_space);

        let (count, avg, min, max) = agent.buffer_stats();
        assert_eq!(count, 0);

        for i in 0..5 {
            let state = vec![i as f64; 30];
            let action = vec![0.0; 3];
            let next_state = vec![i as f64 + 0.1; 30];
            let reward = (i + 1) as f64;
            agent.remember(state, action, reward, next_state, false);
        }

        let (count, avg, min, max) = agent.buffer_stats();
        assert_eq!(count, 5);
        assert!((avg - 3.0).abs() < 0.01);  // avg of 1,2,3,4,5
        assert_eq!(min, 1.0);
        assert_eq!(max, 5.0);
    }

    #[test]
    fn test_agent_reset() {
        let config = AgentConfig::default_swarm();
        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);
        let mut agent = Agent::new(config, action_space, state_space);

        agent.total_steps = 100;
        agent.episode_count = 10;
        agent.config.epsilon = 0.5;

        let state = vec![1.0; 30];
        let action = vec![0.0; 3];
        agent.remember(state, action, 1.0, vec![1.1; 30], false);

        assert!(agent.experience_buffer.len() > 0);

        agent.reset();
        assert_eq!(agent.total_steps, 0);
        assert_eq!(agent.episode_count, 0);
        assert_eq!(agent.config.epsilon, 1.0);
        assert_eq!(agent.experience_buffer.len(), 0);
    }
}
