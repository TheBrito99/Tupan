//! Phase 28 Task 4: Digital Twin
//! Real-time prediction and closed-loop validation for multi-robot swarms

use crate::clifford_algebra::spatialization::Point3D;
use crate::ml::{Agent, AgentConfig, NeuralNetwork, RewardFunction, RewardConfig};
use std::collections::VecDeque;

/// Observation from physical system or simulation
#[derive(Debug, Clone)]
pub struct SystemObservation {
    pub timestamp: f64,
    pub robot_positions: Vec<Point3D>,
    pub robot_velocities: Vec<(f64, f64, f64)>,
    pub formation_error: f64,
    pub collision_count: usize,
    pub energy_used: f64,
}

impl SystemObservation {
    pub fn new(
        timestamp: f64,
        robot_positions: Vec<Point3D>,
        robot_velocities: Vec<(f64, f64, f64)>,
    ) -> Self {
        Self {
            timestamp,
            robot_positions,
            robot_velocities,
            formation_error: 0.0,
            collision_count: 0,
            energy_used: 0.0,
        }
    }

    /// Encode observation to state vector for neural network
    pub fn to_state_vector(&self) -> Vec<f64> {
        let mut state = Vec::new();

        // Position + velocity for each robot
        for i in 0..self.robot_positions.len() {
            state.push(self.robot_positions[i].x);
            state.push(self.robot_positions[i].y);
            state.push(self.robot_positions[i].z);
            if i < self.robot_velocities.len() {
                state.push(self.robot_velocities[i].0);
                state.push(self.robot_velocities[i].1);
                state.push(self.robot_velocities[i].2);
            }
        }

        // Formation error and collision info
        state.push(self.formation_error);
        state.push(self.collision_count as f64);
        state.push(self.energy_used);

        state
    }

    /// Compute metrics from observation
    pub fn compute_metrics(&mut self) {
        // Compute swarm centroid
        let n = self.robot_positions.len() as f64;
        let centroid_x: f64 = self.robot_positions.iter().map(|p| p.x).sum::<f64>() / n;
        let centroid_y: f64 = self.robot_positions.iter().map(|p| p.y).sum::<f64>() / n;
        let centroid_z: f64 = self.robot_positions.iter().map(|p| p.z).sum::<f64>() / n;

        // Formation error: variance from centroid
        self.formation_error = self
            .robot_positions
            .iter()
            .map(|p| {
                ((p.x - centroid_x).powi(2) + (p.y - centroid_y).powi(2) + (p.z - centroid_z).powi(2)).sqrt()
            })
            .sum::<f64>()
            / n;

        // Energy: sum of squared velocities
        self.energy_used = self
            .robot_velocities
            .iter()
            .map(|(vx, vy, vz)| vx * vx + vy * vy + vz * vz)
            .sum::<f64>();

        // Collision detection (robots within 0.5m)
        self.collision_count = 0;
        for i in 0..self.robot_positions.len() {
            for j in (i + 1)..self.robot_positions.len() {
                let dx = self.robot_positions[i].x - self.robot_positions[j].x;
                let dy = self.robot_positions[i].y - self.robot_positions[j].y;
                let dz = self.robot_positions[i].z - self.robot_positions[j].z;
                let dist = (dx * dx + dy * dy + dz * dz).sqrt();

                if dist < 0.5 {
                    self.collision_count += 1;
                }
            }
        }
    }
}

/// Prediction from neural network
#[derive(Debug, Clone)]
pub struct Prediction {
    pub timestamp: f64,
    pub predicted_positions: Vec<Point3D>,
    pub predicted_velocities: Vec<(f64, f64, f64)>,
    pub confidence: f64,
}

impl Prediction {
    pub fn new(timestamp: f64, predicted_positions: Vec<Point3D>, predicted_velocities: Vec<(f64, f64, f64)>) -> Self {
        Self {
            timestamp,
            predicted_positions,
            predicted_velocities,
            confidence: 1.0,
        }
    }

    /// Compute prediction error vs actual observation
    pub fn compute_error(&self, actual: &SystemObservation) -> f64 {
        let mut total_error = 0.0;

        // Position error
        for i in 0..self.predicted_positions.len().min(actual.robot_positions.len()) {
            let dx = self.predicted_positions[i].x - actual.robot_positions[i].x;
            let dy = self.predicted_positions[i].y - actual.robot_positions[i].y;
            let dz = self.predicted_positions[i].z - actual.robot_positions[i].z;
            total_error += (dx * dx + dy * dy + dz * dz).sqrt();
        }

        // Velocity error
        for i in 0..self.predicted_velocities.len().min(actual.robot_velocities.len()) {
            let dvx = self.predicted_velocities[i].0 - actual.robot_velocities[i].0;
            let dvy = self.predicted_velocities[i].1 - actual.robot_velocities[i].1;
            let dvz = self.predicted_velocities[i].2 - actual.robot_velocities[i].2;
            total_error += (dvx * dvx + dvy * dvy + dvz * dvz).sqrt();
        }

        total_error / (self.predicted_positions.len() as f64 + 1.0)
    }
}

/// Digital twin: parallel simulation and prediction
pub struct DigitalTwin {
    prediction_network: NeuralNetwork,
    agent_config: AgentConfig,
    reward_config: RewardConfig,
    history_buffer: VecDeque<SystemObservation>,
    prediction_buffer: VecDeque<Prediction>,
    max_history: usize,
    prediction_horizon: usize,  // Steps to predict ahead
}

impl DigitalTwin {
    pub fn new(
        prediction_network: NeuralNetwork,
        agent_config: AgentConfig,
        reward_config: RewardConfig,
        max_history: usize,
        prediction_horizon: usize,
    ) -> Self {
        Self {
            prediction_network,
            agent_config,
            reward_config,
            history_buffer: VecDeque::with_capacity(max_history),
            prediction_buffer: VecDeque::with_capacity(prediction_horizon),
            max_history,
            prediction_horizon,
        }
    }

    /// Add actual observation to digital twin
    pub fn observe(&mut self, mut observation: SystemObservation) {
        observation.compute_metrics();
        self.history_buffer.push_back(observation);

        if self.history_buffer.len() > self.max_history {
            self.history_buffer.pop_front();
        }
    }

    /// Predict future state using neural network
    pub fn predict_next_state(&mut self, current_observation: &SystemObservation) -> Prediction {
        let state_vector = current_observation.to_state_vector();

        // Use neural network to predict next state
        let predicted_state = self.prediction_network.forward(&state_vector);

        // Reconstruct positions and velocities from prediction
        let num_robots = current_observation.robot_positions.len();
        let mut predicted_positions = Vec::new();
        let mut predicted_velocities = Vec::new();

        for i in 0..num_robots {
            if i * 6 + 2 < predicted_state.len() {
                predicted_positions.push(Point3D {
                    x: predicted_state[i * 6],
                    y: predicted_state[i * 6 + 1],
                    z: predicted_state[i * 6 + 2],
                });

                if i * 6 + 5 < predicted_state.len() {
                    predicted_velocities.push((
                        predicted_state[i * 6 + 3],
                        predicted_state[i * 6 + 4],
                        predicted_state[i * 6 + 5],
                    ));
                }
            }
        }

        let mut prediction = Prediction::new(
            current_observation.timestamp + 1.0,
            predicted_positions,
            predicted_velocities,
        );

        // Compute confidence based on prediction horizon
        prediction.confidence = 1.0 / (1.0 + (self.prediction_horizon as f64) * 0.1);

        self.prediction_buffer.push_back(prediction.clone());

        prediction
    }

    /// Validate prediction against actual observation
    pub fn validate_prediction(&mut self, actual: &SystemObservation) -> ValidationResult {
        if let Some(last_prediction) = self.prediction_buffer.back() {
            let prediction_error = last_prediction.compute_error(actual);
            let confidence_decay = (prediction_error * 10.0).min(1.0);

            ValidationResult {
                prediction_error,
                confidence_decay,
                is_accurate: prediction_error < 0.1,
            }
        } else {
            ValidationResult {
                prediction_error: 0.0,
                confidence_decay: 0.0,
                is_accurate: false,
            }
        }
    }

    /// Generate correction signal for closed-loop control
    pub fn compute_correction(&self, actual: &SystemObservation, predicted: &Prediction) -> Vec<(f64, f64, f64)> {
        let mut corrections = Vec::new();

        for i in 0..actual.robot_velocities.len().min(predicted.predicted_velocities.len()) {
            let error_x = actual.robot_positions[i].x - predicted.predicted_positions[i].x;
            let error_y = actual.robot_positions[i].y - predicted.predicted_positions[i].y;
            let error_z = actual.robot_positions[i].z - predicted.predicted_positions[i].z;

            // P-controller gains
            let kp = 0.5;
            corrections.push((error_x * kp, error_y * kp, error_z * kp));
        }

        corrections
    }

    /// Get prediction accuracy metrics
    pub fn get_accuracy_metrics(&self) -> AccuracyMetrics {
        if self.history_buffer.is_empty() {
            return AccuracyMetrics {
                total_predictions: 0,
                accurate_predictions: 0,
                average_error: 0.0,
                confidence_trend: 0.0,
            };
        }

        let total = self.prediction_buffer.len();
        let accurate = self
            .prediction_buffer
            .iter()
            .filter(|p| p.confidence > 0.8)
            .count();

        let average_error: f64 = if total > 0 {
            self.history_buffer
                .iter()
                .enumerate()
                .filter_map(|(i, obs)| {
                    self.prediction_buffer.get(i).map(|pred| pred.compute_error(obs))
                })
                .sum::<f64>()
                / total as f64
        } else {
            0.0
        };

        let confidence_trend = if self.prediction_buffer.len() > 1 {
            let last = self.prediction_buffer.back().unwrap().confidence;
            let first = self.prediction_buffer.front().unwrap().confidence;
            last - first
        } else {
            0.0
        };

        AccuracyMetrics {
            total_predictions: total,
            accurate_predictions: accurate,
            average_error,
            confidence_trend,
        }
    }

    /// Get current state history
    pub fn get_history(&self) -> Vec<SystemObservation> {
        self.history_buffer.iter().cloned().collect()
    }

    /// Get predictions
    pub fn get_predictions(&self) -> Vec<Prediction> {
        self.prediction_buffer.iter().cloned().collect()
    }

    /// Clear buffers for new session
    pub fn reset(&mut self) {
        self.history_buffer.clear();
        self.prediction_buffer.clear();
    }
}

/// Validation result from comparing prediction vs actual
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub prediction_error: f64,
    pub confidence_decay: f64,
    pub is_accurate: bool,
}

/// Accuracy metrics for digital twin predictions
#[derive(Debug, Clone)]
pub struct AccuracyMetrics {
    pub total_predictions: usize,
    pub accurate_predictions: usize,
    pub average_error: f64,
    pub confidence_trend: f64,
}

impl AccuracyMetrics {
    pub fn accuracy_percentage(&self) -> f64 {
        if self.total_predictions == 0 {
            0.0
        } else {
            (self.accurate_predictions as f64 / self.total_predictions as f64) * 100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_observation() -> SystemObservation {
        let positions = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
            Point3D { x: 0.5, y: 0.866, z: 0.0 },
        ];

        let velocities = vec![(0.1, 0.0, 0.0), (0.1, 0.0, 0.0), (0.1, 0.0, 0.0)];

        SystemObservation::new(0.0, positions, velocities)
    }

    #[test]
    fn test_observation_creation() {
        let obs = create_test_observation();
        assert_eq!(obs.robot_positions.len(), 3);
        assert_eq!(obs.robot_velocities.len(), 3);
    }

    #[test]
    fn test_observation_to_state_vector() {
        let obs = create_test_observation();
        let state = obs.to_state_vector();
        // 3 robots * 6 dimensions + 3 metrics = 21
        assert_eq!(state.len(), 21);
    }

    #[test]
    fn test_observation_metrics() {
        let mut obs = create_test_observation();
        obs.compute_metrics();

        assert!(obs.formation_error > 0.0);
        assert!(obs.energy_used > 0.0);
        assert_eq!(obs.collision_count, 0);
    }

    #[test]
    fn test_observation_collision_detection() {
        let positions = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 0.2, y: 0.0, z: 0.0 }, // Close to first
        ];

        let velocities = vec![(0.0, 0.0, 0.0); 2];
        let mut obs = SystemObservation::new(0.0, positions, velocities);
        obs.compute_metrics();

        assert!(obs.collision_count > 0);
    }

    #[test]
    fn test_prediction_creation() {
        let positions = vec![Point3D { x: 0.1, y: 0.0, z: 0.0 }];
        let velocities = vec![(0.1, 0.0, 0.0)];
        let pred = Prediction::new(1.0, positions, velocities);

        assert_eq!(pred.timestamp, 1.0);
        assert_eq!(pred.confidence, 1.0);
    }

    #[test]
    fn test_prediction_error() {
        let actual_pos = vec![Point3D { x: 1.0, y: 0.0, z: 0.0 }];
        let actual_vel = vec![(0.5, 0.0, 0.0)];
        let actual = SystemObservation::new(0.0, actual_pos, actual_vel);

        let pred_pos = vec![Point3D { x: 0.9, y: 0.0, z: 0.0 }];
        let pred_vel = vec![(0.4, 0.0, 0.0)];
        let pred = Prediction::new(1.0, pred_pos, pred_vel);

        let error = pred.compute_error(&actual);
        assert!(error > 0.0);
        assert!(error < 1.0);
    }

    #[test]
    fn test_digital_twin_creation() {
        let mut network = NeuralNetwork::new();
        let agent_config = AgentConfig {
            state_dim: 21,
            action_dim: 9,
            learning_rate: 0.001,
            gamma: 0.99,
            buffer_size: 10000,
            batch_size: 32,
            epsilon: 1.0,
            epsilon_decay: 0.995,
            min_epsilon: 0.01,
        };
        let reward_config = RewardConfig::default_formation();

        let _twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);
    }

    #[test]
    fn test_digital_twin_observe() {
        let mut network = NeuralNetwork::new();
        let agent_config = AgentConfig {
            state_dim: 21,
            action_dim: 9,
            learning_rate: 0.001,
            gamma: 0.99,
            buffer_size: 10000,
            batch_size: 32,
            epsilon: 1.0,
            epsilon_decay: 0.995,
            min_epsilon: 0.01,
        };
        let reward_config = RewardConfig::default_formation();

        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        let obs = create_test_observation();
        twin.observe(obs);

        assert_eq!(twin.get_history().len(), 1);
    }

    #[test]
    fn test_digital_twin_history_limit() {
        let mut network = NeuralNetwork::new();
        let agent_config = AgentConfig {
            state_dim: 21,
            action_dim: 9,
            learning_rate: 0.001,
            gamma: 0.99,
            buffer_size: 10000,
            batch_size: 32,
            epsilon: 1.0,
            epsilon_decay: 0.995,
            min_epsilon: 0.01,
        };
        let reward_config = RewardConfig::default_formation();

        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 5, 10);

        for i in 0..10 {
            let mut obs = create_test_observation();
            obs.timestamp = i as f64;
            twin.observe(obs);
        }

        assert_eq!(twin.get_history().len(), 5);
    }

    #[test]
    fn test_validation_result() {
        let result = ValidationResult {
            prediction_error: 0.05,
            confidence_decay: 0.1,
            is_accurate: true,
        };

        assert!(result.is_accurate);
        assert!(result.prediction_error < 0.1);
    }

    #[test]
    fn test_accuracy_metrics() {
        let metrics = AccuracyMetrics {
            total_predictions: 10,
            accurate_predictions: 8,
            average_error: 0.05,
            confidence_trend: 0.05,
        };

        assert_eq!(metrics.accuracy_percentage(), 80.0);
    }

    #[test]
    fn test_accuracy_metrics_empty() {
        let metrics = AccuracyMetrics {
            total_predictions: 0,
            accurate_predictions: 0,
            average_error: 0.0,
            confidence_trend: 0.0,
        };

        assert_eq!(metrics.accuracy_percentage(), 0.0);
    }

    #[test]
    fn test_compute_correction() {
        let mut network = NeuralNetwork::new();
        let agent_config = AgentConfig {
            state_dim: 21,
            action_dim: 9,
            learning_rate: 0.001,
            gamma: 0.99,
            buffer_size: 10000,
            batch_size: 32,
            epsilon: 1.0,
            epsilon_decay: 0.995,
            min_epsilon: 0.01,
        };
        let reward_config = RewardConfig::default_formation();

        let twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        let actual = create_test_observation();

        let pred_pos = vec![
            Point3D { x: -0.1, y: 0.0, z: 0.0 },
            Point3D { x: 0.9, y: 0.0, z: 0.0 },
            Point3D { x: 0.4, y: 0.866, z: 0.0 },
        ];
        let pred_vel = actual.robot_velocities.clone();
        let pred = Prediction::new(1.0, pred_pos, pred_vel);

        let corrections = twin.compute_correction(&actual, &pred);
        assert_eq!(corrections.len(), 3);
        assert!(corrections[0].0 > 0.0); // Should correct positive x
    }

    #[test]
    fn test_digital_twin_reset() {
        let mut network = NeuralNetwork::new();
        let agent_config = AgentConfig {
            state_dim: 21,
            action_dim: 9,
            learning_rate: 0.001,
            gamma: 0.99,
            buffer_size: 10000,
            batch_size: 32,
            epsilon: 1.0,
            epsilon_decay: 0.995,
            min_epsilon: 0.01,
        };
        let reward_config = RewardConfig::default_formation();

        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        let obs = create_test_observation();
        twin.observe(obs);
        assert_eq!(twin.get_history().len(), 1);

        twin.reset();
        assert_eq!(twin.get_history().len(), 0);
    }
}
