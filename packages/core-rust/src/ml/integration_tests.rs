//! Phase 28 Task 6: Integration & Testing
//! End-to-end ML training pipeline tests combining all Phase 28 components
//! RL Agent + Behavior Cloning + Parameter Optimization + Digital Twin

#[cfg(test)]
mod tests {
    use crate::ml::{
        Agent, AgentConfig, ActionSpace, StateSpace, Experience,
        RewardConfig,
        NeuralNetwork, NetworkLayer, ActivationFunction,
        ExpertDemonstration, ExpertDataset, BehaviorCloner,
        HyperparameterSet, GeneticAlgorithm, ParticleSwarmOptimizer,
        DigitalTwin, SystemObservation,
    };
    use crate::clifford_algebra::spatialization::Point3D;

    // ========================================================================
    // Helper Functions
    // ========================================================================

    fn create_test_agent() -> Agent {
        let config = AgentConfig::default_swarm();
        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);
        Agent::new(config, action_space, state_space)
    }

    fn create_test_network() -> NeuralNetwork {
        let mut network = NeuralNetwork::new();
        network.add_layer(NetworkLayer::new(6, 16, ActivationFunction::ReLU));
        network.add_layer(NetworkLayer::new(16, 8, ActivationFunction::ReLU));
        network.add_layer(NetworkLayer::new(8, 3, ActivationFunction::Linear));
        network
    }

    fn create_test_observation() -> SystemObservation {
        let positions = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 1.0, z: 1.0 },
            Point3D { x: 2.0, y: 2.0, z: 2.0 },
        ];

        let velocities = vec![
            (0.1, 0.1, 0.1),
            (0.2, 0.2, 0.2),
            (0.3, 0.3, 0.3),
        ];

        let mut obs = SystemObservation::new(0.0, positions, velocities);
        obs.compute_metrics();
        obs
    }

    fn create_test_dataset() -> ExpertDataset {
        let mut dataset = ExpertDataset::new();

        for ep_id in 0..3 {
            let mut trajectory = Vec::new();
            for t in 0..5 {
                let state = vec![
                    (ep_id as f64 + t as f64) * 0.1,
                    (ep_id as f64 + t as f64) * 0.2,
                    (ep_id as f64 + t as f64) * 0.3,
                    0.1, 0.2, 0.3,
                ];

                let action = vec![0.5, 0.5, 0.0];
                let next_state = vec![
                    (ep_id as f64 + t as f64 + 1.0) * 0.1,
                    (ep_id as f64 + t as f64 + 1.0) * 0.2,
                    (ep_id as f64 + t as f64 + 1.0) * 0.3,
                    0.1, 0.2, 0.3,
                ];

                let exp = Experience::new(state, action, 1.0, next_state, t == 4);
                trajectory.push(exp);
            }

            let demo = ExpertDemonstration::new(ep_id, trajectory, true);
            dataset.add_demonstration(demo);
        }

        dataset
    }

    // ========================================================================
    // Task 1: RL Agent Integration Tests
    // ========================================================================

    #[test]
    fn test_rl_agent_training_episode() {
        let mut agent = create_test_agent();

        for step in 0..20 {
            let state = vec![0.05 * (step as f64); 30];
            let action = vec![0.3 + 0.01 * (step as f64), 0.0, 0.0];
            let reward = if step > 15 { 10.0 } else { 1.0 };
            let next_state = vec![0.05 * ((step + 1) as f64); 30];
            let done = step == 19;

            agent.remember(state, action, reward, next_state, done);
        }

        agent.end_episode();
        assert_eq!(agent.total_steps, 20);
        assert_eq!(agent.episode_count, 1);
    }

    #[test]
    fn test_rl_agent_epsilon_decay() {
        let mut agent = create_test_agent();

        let epsilon_before = agent.config.epsilon;
        agent.decay_epsilon();
        let epsilon_after = agent.config.epsilon;

        assert!(epsilon_after < epsilon_before);
        assert!(epsilon_after >= agent.config.min_epsilon);
    }

    // ========================================================================
    // Task 2: Behavior Cloning Integration Tests
    // ========================================================================

    #[test]
    fn test_behavior_cloning_training() {
        let dataset = create_test_dataset();
        let network = create_test_network();
        let mut cloner = BehaviorCloner::new(network, 0.001);

        let losses = cloner.train_epochs(&dataset, 2, 4);
        assert_eq!(losses.len(), 2);
        assert!(losses[0] >= 0.0);
    }

    #[test]
    fn test_expert_dataset_management() {
        let dataset = create_test_dataset();

        assert_eq!(dataset.all_demonstrations().len(), 3);

        let demo_0 = dataset.get_demonstration(0);
        assert!(demo_0.is_some());

        let transitions = dataset.get_all_transitions();
        assert_eq!(transitions.len(), 15); // 3 demos * 5 steps each
    }

    // ========================================================================
    // Task 3: Parameter Optimization Integration Tests
    // ========================================================================

    #[test]
    fn test_genetic_algorithm_creation() {
        let _ga = GeneticAlgorithm::new(20, 10, 0.8);
        // GA created successfully
    }

    #[test]
    fn test_particle_swarm_optimizer_creation() {
        let _pso = ParticleSwarmOptimizer::new(15, 8);
        // PSO created successfully
    }

    #[test]
    fn test_hyperparameter_set_conversion() {
        let hp = HyperparameterSet {
            learning_rate: 0.001,
            exploration_rate: 0.1,
            discount_factor: 0.95,
            epsilon_decay: 0.99,
            formation_weight: 1.0,
            collision_weight: 10.0,
            goal_weight: 5.0,
            energy_weight: 0.1,
        };

        let config = hp.to_agent_config(30, 6);
        assert!((config.learning_rate - 0.001).abs() < 0.0001);
        assert!((config.gamma - 0.95).abs() < 0.0001);
    }

    // ========================================================================
    // Task 4: Digital Twin Integration Tests
    // ========================================================================

    #[test]
    fn test_digital_twin_creation_and_prediction() {
        let network = create_test_network();
        let agent_config = AgentConfig::default_swarm();
        let reward_config = RewardConfig::default_formation();

        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        let obs = create_test_observation();
        let pred = twin.predict_next_state(&obs);

        assert_eq!(pred.predicted_positions.len(), 3);
        assert_eq!(pred.predicted_velocities.len(), 3);
    }

    #[test]
    fn test_digital_twin_observation_and_validation() {
        let network = create_test_network();
        let agent_config = AgentConfig::default_swarm();
        let reward_config = RewardConfig::default_formation();

        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        let obs1 = create_test_observation();
        twin.observe(obs1.clone());

        let pred = twin.predict_next_state(&obs1);
        let obs2 = SystemObservation::new(
            obs1.timestamp + 0.01,
            pred.predicted_positions.clone(),
            pred.predicted_velocities.clone(),
        );

        let validation = twin.validate_prediction(&obs2);
        assert!(validation.prediction_error >= 0.0);
    }

    #[test]
    fn test_digital_twin_accuracy_metrics() {
        let network = create_test_network();
        let agent_config = AgentConfig::default_swarm();
        let reward_config = RewardConfig::default_formation();

        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        for _ in 0..5 {
            let obs = create_test_observation();
            let _pred = twin.predict_next_state(&obs);
        }

        let metrics = twin.get_accuracy_metrics();
        assert_eq!(metrics.total_predictions, 5);
    }

    // ========================================================================
    // Multi-Component Integration Tests
    // ========================================================================

    #[test]
    fn test_rl_agent_with_behavior_cloning() {
        let mut agent = create_test_agent();
        let dataset = create_test_dataset();
        let network = create_test_network();
        let mut cloner = BehaviorCloner::new(network, 0.001);

        for step in 0..10 {
            let state = vec![0.1 * (step as f64); 30];
            let action = vec![0.5, 0.5, 0.0];
            let next_state = vec![0.1 * ((step + 1) as f64); 30];
            agent.remember(state, action, 1.0, next_state, false);
        }

        let _losses = cloner.train_epochs(&dataset, 1, 4);

        assert_eq!(agent.total_steps, 10);
        assert!(dataset.all_demonstrations().len() > 0);
    }

    #[test]
    fn test_parameter_optimization_with_agent_creation() {
        let hp = HyperparameterSet {
            learning_rate: 0.001,
            exploration_rate: 0.1,
            discount_factor: 0.95,
            epsilon_decay: 0.99,
            formation_weight: 1.0,
            collision_weight: 10.0,
            goal_weight: 5.0,
            energy_weight: 0.1,
        };

        let config = hp.to_agent_config(30, 6);

        let action_space = ActionSpace::velocity_3d(1.0);
        let state_space = StateSpace::multi_robot_3d(5);
        let agent = Agent::new(config, action_space, state_space);

        assert_eq!(agent.total_steps, 0);
        assert!((agent.config.gamma - 0.95).abs() < 0.0001);
    }

    #[test]
    fn test_all_components_integrated() {
        let mut agent = create_test_agent();
        let dataset = create_test_dataset();

        let agent_config = AgentConfig::default_swarm();
        let reward_config = RewardConfig::default_formation();

        // Test RL agent component
        for step in 0..5 {
            let state = vec![0.1 * (step as f64); 30];
            let action = vec![0.5, 0.5, 0.0];
            let next_state = vec![0.1 * ((step + 1) as f64); 30];
            agent.remember(state, action, 1.0, next_state, false);
        }

        // Test digital twin component
        let network = create_test_network();
        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        for _ in 0..5 {
            let obs = create_test_observation();
            let _pred = twin.predict_next_state(&obs);
        }

        // Test behavior cloning component
        let network2 = create_test_network();
        let mut cloner = BehaviorCloner::new(network2, 0.001);
        let _losses = cloner.train_epochs(&dataset, 1, 4);

        assert!(agent.total_steps > 0);
        assert!(twin.get_accuracy_metrics().total_predictions > 0);
    }

    // ========================================================================
    // Stress Tests
    // ========================================================================

    #[test]
    fn test_large_experience_buffer() {
        let mut agent = create_test_agent();

        for i in 0..500 {
            let state = vec![0.01 * (i as f64); 30];
            let action = vec![0.5, 0.5, 0.0];
            let next_state = vec![0.01 * ((i + 1) as f64); 30];
            agent.remember(state, action, 1.0, next_state, i % 100 == 99);
        }

        let (buffer_size, _, _, _) = agent.buffer_stats();
        assert_eq!(buffer_size, 500);
    }

    #[test]
    fn test_many_digital_twin_predictions() {
        let network = create_test_network();
        let agent_config = AgentConfig::default_swarm();
        let reward_config = RewardConfig::default_formation();

        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        for _ in 0..50 {
            let obs = create_test_observation();
            let _pred = twin.predict_next_state(&obs);
        }

        let metrics = twin.get_accuracy_metrics();
        assert_eq!(metrics.total_predictions, 50);
    }

    #[test]
    fn test_complete_training_pipeline() {
        let mut agent = create_test_agent();
        let dataset = create_test_dataset();
        let network = create_test_network();
        let network_cloner = create_test_network();
        let mut cloner = BehaviorCloner::new(network_cloner, 0.001);

        let agent_config = AgentConfig::default_swarm();
        let reward_config = RewardConfig::default_formation();
        let mut twin = DigitalTwin::new(network, agent_config, reward_config, 100, 10);

        let hp = HyperparameterSet {
            learning_rate: 0.001,
            exploration_rate: 0.1,
            discount_factor: 0.95,
            epsilon_decay: 0.99,
            formation_weight: 1.0,
            collision_weight: 10.0,
            goal_weight: 5.0,
            energy_weight: 0.1,
        };

        // Phase 1: RL Training
        for step in 0..20 {
            let state = vec![0.05 * (step as f64); 30];
            let action = vec![0.3, 0.3, 0.0];
            let reward = if step > 15 { 10.0 } else { 1.0 };
            let next_state = vec![0.05 * ((step + 1) as f64); 30];
            agent.remember(state, action, reward, next_state, step == 19);
        }
        agent.end_episode();

        // Phase 2: Behavior Cloning
        let _losses = cloner.train_epochs(&dataset, 2, 4);

        // Phase 3: Parameter Optimization
        let optimized_config = hp.to_agent_config(30, 6);
        assert!((optimized_config.learning_rate - 0.001).abs() < 0.0001);

        // Phase 4: Digital Twin Validation
        for _ in 0..10 {
            let obs = create_test_observation();
            let _pred = twin.predict_next_state(&obs);
        }

        assert_eq!(agent.episode_count, 1);
        assert_eq!(agent.total_steps, 20);
        assert!(twin.get_accuracy_metrics().total_predictions >= 10);
    }
}
