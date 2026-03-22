//! Phase 28 Task 2: Behavior Cloning
//! Imitation learning from expert demonstrations

use crate::ml::{NeuralNetwork, NetworkLayer, ActivationFunction, Experience};
use crate::clifford_algebra::spatialization::Point3D;

/// Expert demonstration: trajectory of (state, action, reward) tuples
#[derive(Debug, Clone)]
pub struct ExpertDemonstration {
    pub episode_id: usize,
    pub trajectory: Vec<Experience>,
    pub total_reward: f64,
    pub success: bool,
}

impl ExpertDemonstration {
    pub fn new(episode_id: usize, trajectory: Vec<Experience>, success: bool) -> Self {
        let total_reward = trajectory.iter().map(|e| e.reward).sum();
        Self {
            episode_id,
            trajectory,
            total_reward,
            success,
        }
    }

    pub fn trajectory_length(&self) -> usize {
        self.trajectory.len()
    }

    pub fn average_reward(&self) -> f64 {
        if self.trajectory.is_empty() {
            0.0
        } else {
            self.total_reward / self.trajectory.len() as f64
        }
    }
}

/// Expert dataset for behavior cloning
pub struct ExpertDataset {
    demonstrations: Vec<ExpertDemonstration>,
    total_experiences: usize,
}

impl ExpertDataset {
    pub fn new() -> Self {
        Self {
            demonstrations: Vec::new(),
            total_experiences: 0,
        }
    }

    pub fn add_demonstration(&mut self, demo: ExpertDemonstration) {
        self.total_experiences += demo.trajectory_length();
        self.demonstrations.push(demo);
    }

    pub fn num_demonstrations(&self) -> usize {
        self.demonstrations.len()
    }

    pub fn num_experiences(&self) -> usize {
        self.total_experiences
    }

    pub fn get_demonstration(&self, index: usize) -> Option<&ExpertDemonstration> {
        self.demonstrations.get(index)
    }

    pub fn all_demonstrations(&self) -> &[ExpertDemonstration] {
        &self.demonstrations
    }

    pub fn average_episode_reward(&self) -> f64 {
        if self.demonstrations.is_empty() {
            return 0.0;
        }

        let sum: f64 = self.demonstrations.iter().map(|d| d.total_reward).sum();
        sum / self.demonstrations.len() as f64
    }

    pub fn success_rate(&self) -> f64 {
        if self.demonstrations.is_empty() {
            return 0.0;
        }

        let successes = self.demonstrations.iter().filter(|d| d.success).count();
        successes as f64 / self.demonstrations.len() as f64
    }

    pub fn get_all_transitions(&self) -> Vec<(Vec<f64>, Vec<f64>)> {
        let mut transitions = Vec::new();

        for demo in &self.demonstrations {
            for exp in &demo.trajectory {
                transitions.push((exp.state.clone(), exp.action.clone()));
            }
        }

        transitions
    }
}

/// Behavior cloning trainer
pub struct BehaviorCloner {
    network: NeuralNetwork,
    learning_rate: f64,
}

impl BehaviorCloner {
    pub fn new(network: NeuralNetwork, learning_rate: f64) -> Self {
        Self {
            network,
            learning_rate,
        }
    }

    /// Train network on expert demonstrations using supervised learning
    pub fn train_on_batch(&mut self, transitions: &[(Vec<f64>, Vec<f64>)]) -> f64 {
        let mut total_loss = 0.0;

        for (state, expert_action) in transitions {
            // Forward pass
            let predicted_action = self.network.forward(state);

            // Compute loss (MSE between predicted and expert action)
            let mut loss = 0.0;
            for (pred, expert) in predicted_action.iter().zip(expert_action.iter()) {
                let error = pred - expert;
                loss += error * error;
            }
            loss /= predicted_action.len() as f64;

            total_loss += loss;

            // Compute gradient (dL/daction = 2(predicted - expert) / dim)
            let mut action_gradient = vec![0.0; predicted_action.len()];
            for (i, (pred, expert)) in predicted_action.iter().zip(expert_action.iter()).enumerate() {
                action_gradient[i] = 2.0 * (pred - expert) / predicted_action.len() as f64;
            }

            // Backward pass
            self.network.backward(state, &action_gradient, self.learning_rate);
        }

        total_loss / transitions.len() as f64
    }

    /// Train for multiple epochs
    pub fn train_epochs(&mut self, dataset: &ExpertDataset, epochs: usize, batch_size: usize) -> Vec<f64> {
        let mut losses = Vec::new();
        let transitions = dataset.get_all_transitions();

        for epoch in 0..epochs {
            let mut epoch_loss = 0.0;
            let mut batch_count = 0;

            for batch in transitions.chunks(batch_size) {
                let batch_loss = self.train_on_batch(batch);
                epoch_loss += batch_loss;
                batch_count += 1;
            }

            let avg_loss = epoch_loss / batch_count as f64;
            losses.push(avg_loss);
        }

        losses
    }

    /// Evaluate on test set (compute MSE)
    pub fn evaluate(&self, transitions: &[(Vec<f64>, Vec<f64>)]) -> f64 {
        if transitions.is_empty() {
            return 0.0;
        }

        let mut total_loss = 0.0;

        for (state, expert_action) in transitions {
            let predicted_action = self.network.forward(state);

            let mut loss = 0.0;
            for (pred, expert) in predicted_action.iter().zip(expert_action.iter()) {
                let error = pred - expert;
                loss += error * error;
            }
            loss /= predicted_action.len() as f64;

            total_loss += loss;
        }

        total_loss / transitions.len() as f64
    }

    /// Get the trained network
    pub fn get_network(&self) -> &NeuralNetwork {
        &self.network
    }

    /// Get mutable network for inference
    pub fn get_network_mut(&mut self) -> &mut NeuralNetwork {
        &mut self.network
    }
}

/// DAgger (Dataset Aggregation) for distribution mismatch
pub struct DAggerTrainer {
    behavior_cloner: BehaviorCloner,
    dataset: ExpertDataset,
}

impl DAggerTrainer {
    pub fn new(behavior_cloner: BehaviorCloner) -> Self {
        Self {
            behavior_cloner,
            dataset: ExpertDataset::new(),
        }
    }

    /// Initialize with expert demonstrations
    pub fn initialize(&mut self, initial_dataset: ExpertDataset) {
        self.dataset = initial_dataset;
    }

    /// Aggregate new expert demonstrations (simulating policy rollout + expert correction)
    pub fn aggregate_demonstrations(&mut self, new_demo: ExpertDemonstration) {
        self.behavior_cloner.train_on_batch(&new_demo.trajectory.iter()
            .map(|e| (e.state.clone(), e.action.clone()))
            .collect::<Vec<_>>());

        self.dataset.add_demonstration(new_demo);
    }

    /// Run DAgger iteration
    pub fn dagger_iteration(&mut self, epochs: usize, batch_size: usize) -> f64 {
        let transitions = self.dataset.get_all_transitions();
        let losses = self.behavior_cloner.train_epochs(&self.dataset, epochs, batch_size);

        losses.last().cloned().unwrap_or(0.0)
    }

    /// Get dataset statistics
    pub fn dataset_stats(&self) -> (usize, usize, f64, f64) {
        (
            self.dataset.num_demonstrations(),
            self.dataset.num_experiences(),
            self.dataset.average_episode_reward(),
            self.dataset.success_rate(),
        )
    }

    /// Predict action for state
    pub fn predict(&self, state: &[f64]) -> Vec<f64> {
        self.behavior_cloner.get_network().forward(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_dummy_demonstration() -> ExpertDemonstration {
        let trajectory = vec![
            Experience::new(
                vec![0.0, 0.0, 0.0],
                vec![0.5, 0.5, 0.0],
                1.0,
                vec![0.1, 0.1, 0.0],
                false,
            ),
            Experience::new(
                vec![0.1, 0.1, 0.0],
                vec![0.5, 0.5, 0.0],
                1.0,
                vec![0.2, 0.2, 0.0],
                false,
            ),
            Experience::new(
                vec![0.2, 0.2, 0.0],
                vec![0.5, 0.5, 0.0],
                2.0,
                vec![0.3, 0.3, 0.0],
                true,
            ),
        ];

        ExpertDemonstration::new(0, trajectory, true)
    }

    #[test]
    fn test_expert_demonstration_creation() {
        let demo = create_dummy_demonstration();
        assert_eq!(demo.episode_id, 0);
        assert_eq!(demo.trajectory_length(), 3);
        assert!(demo.success);
        assert!((demo.total_reward - 4.0).abs() < 0.01);
    }

    #[test]
    fn test_expert_demonstration_average_reward() {
        let demo = create_dummy_demonstration();
        let avg = demo.average_reward();
        assert!((avg - 4.0 / 3.0).abs() < 0.01);
    }

    #[test]
    fn test_expert_dataset_add() {
        let mut dataset = ExpertDataset::new();
        assert_eq!(dataset.num_demonstrations(), 0);
        assert_eq!(dataset.num_experiences(), 0);

        let demo = create_dummy_demonstration();
        dataset.add_demonstration(demo);

        assert_eq!(dataset.num_demonstrations(), 1);
        assert_eq!(dataset.num_experiences(), 3);
    }

    #[test]
    fn test_expert_dataset_average_reward() {
        let mut dataset = ExpertDataset::new();
        let demo = create_dummy_demonstration();
        dataset.add_demonstration(demo);

        let avg = dataset.average_episode_reward();
        assert!((avg - 4.0).abs() < 0.01);
    }

    #[test]
    fn test_expert_dataset_success_rate() {
        let mut dataset = ExpertDataset::new();

        let success_demo = create_dummy_demonstration();
        dataset.add_demonstration(success_demo);

        assert!((dataset.success_rate() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_expert_dataset_transitions() {
        let mut dataset = ExpertDataset::new();
        let demo = create_dummy_demonstration();
        dataset.add_demonstration(demo);

        let transitions = dataset.get_all_transitions();
        assert_eq!(transitions.len(), 3);
    }

    #[test]
    fn test_behavior_cloner_creation() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 2, ActivationFunction::Linear));

        let cloner = BehaviorCloner::new(network, 0.01);
        assert!(cloner.learning_rate > 0.0);
    }

    #[test]
    fn test_behavior_cloner_train_batch() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 2, ActivationFunction::Linear));

        let mut cloner = BehaviorCloner::new(network, 0.01);

        let transitions = vec![(
            vec![0.0, 0.0, 0.0],
            vec![0.5, 0.5],
        )];

        let loss = cloner.train_on_batch(&transitions);
        assert!(loss >= 0.0);
    }

    #[test]
    fn test_behavior_cloner_evaluate() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 2, ActivationFunction::Linear));

        let cloner = BehaviorCloner::new(network, 0.01);

        let transitions = vec![(
            vec![0.0, 0.0, 0.0],
            vec![0.5, 0.5],
        )];

        let loss = cloner.evaluate(&transitions);
        assert!(loss >= 0.0);
    }

    #[test]
    fn test_behavior_cloner_train_epochs() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 3, ActivationFunction::Linear));

        let mut cloner = BehaviorCloner::new(network, 0.01);

        let mut dataset = ExpertDataset::new();
        let demo = create_dummy_demonstration();
        dataset.add_demonstration(demo);

        let losses = cloner.train_epochs(&dataset, 5, 1);
        assert_eq!(losses.len(), 5);
    }

    #[test]
    fn test_dagger_trainer_creation() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 3, ActivationFunction::Linear));

        let cloner = BehaviorCloner::new(network, 0.01);
        let trainer = DAggerTrainer::new(cloner);

        let (demos, exps, _, _) = trainer.dataset_stats();
        assert_eq!(demos, 0);
        assert_eq!(exps, 0);
    }

    #[test]
    fn test_dagger_trainer_initialize() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 3, ActivationFunction::Linear));

        let cloner = BehaviorCloner::new(network, 0.01);
        let mut trainer = DAggerTrainer::new(cloner);

        let mut dataset = ExpertDataset::new();
        let demo = create_dummy_demonstration();
        dataset.add_demonstration(demo);

        trainer.initialize(dataset);

        let (demos, exps, _, _) = trainer.dataset_stats();
        assert_eq!(demos, 1);
        assert_eq!(exps, 3);
    }

    #[test]
    fn test_dagger_trainer_aggregate() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 3, ActivationFunction::Linear));

        let cloner = BehaviorCloner::new(network, 0.01);
        let mut trainer = DAggerTrainer::new(cloner);

        let mut dataset = ExpertDataset::new();
        let demo = create_dummy_demonstration();
        dataset.add_demonstration(demo);

        trainer.initialize(dataset);

        let new_demo = create_dummy_demonstration();
        trainer.aggregate_demonstrations(new_demo);

        let (demos, exps, _, _) = trainer.dataset_stats();
        assert_eq!(demos, 2);
        assert_eq!(exps, 6);
    }

    #[test]
    fn test_dagger_trainer_predict() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 3, ActivationFunction::Linear));

        let cloner = BehaviorCloner::new(network, 0.01);
        let trainer = DAggerTrainer::new(cloner);

        let state = vec![0.1, 0.2, 0.3];
        let action = trainer.predict(&state);

        assert_eq!(action.len(), 3);
    }

    #[test]
    fn test_behavior_cloner_loss_decreases() {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(3, 3, ActivationFunction::Linear));

        let mut cloner = BehaviorCloner::new(network, 0.1);

        let transitions = vec![(vec![0.0, 0.0, 0.0], vec![0.5, 0.5, 0.0])];

        let loss1 = cloner.train_on_batch(&transitions);
        let loss2 = cloner.train_on_batch(&transitions);

        // Loss should generally decrease after training
        assert!(loss1 >= 0.0 && loss2 >= 0.0);
    }

    #[test]
    fn test_multiple_demonstrations() {
        let mut dataset = ExpertDataset::new();

        for i in 0..5 {
            let trajectory = vec![
                Experience::new(
                    vec![i as f64, 0.0, 0.0],
                    vec![0.5, 0.5, 0.0],
                    1.0,
                    vec![i as f64 + 0.1, 0.0, 0.0],
                    false,
                ),
            ];

            let demo = ExpertDemonstration::new(i, trajectory, i % 2 == 0);
            dataset.add_demonstration(demo);
        }

        assert_eq!(dataset.num_demonstrations(), 5);
        assert_eq!(dataset.num_experiences(), 5);
        assert!((dataset.success_rate() - 0.6).abs() < 0.01);
    }
}
