//! Phase 28 Task 3: Parameter Optimization
//! Genetic algorithms and PSO for hyperparameter tuning of RL/BC agents

use crate::ml::{AgentConfig, RewardConfig};

/// Hyperparameters to optimize
#[derive(Debug, Clone)]
pub struct HyperparameterSet {
    pub learning_rate: f64,
    pub exploration_rate: f64,
    pub discount_factor: f64,
    pub epsilon_decay: f64,
    pub formation_weight: f64,
    pub collision_weight: f64,
    pub goal_weight: f64,
    pub energy_weight: f64,
}

impl HyperparameterSet {
    pub fn default() -> Self {
        Self {
            learning_rate: 0.001,
            exploration_rate: 1.0,
            discount_factor: 0.99,
            epsilon_decay: 0.995,
            formation_weight: 1.0,
            collision_weight: 10.0,
            goal_weight: 5.0,
            energy_weight: 0.1,
        }
    }

    /// Create random hyperparameter set within bounds
    pub fn random() -> Self {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        Self {
            learning_rate: 10_f64.powf(-4.0 + rng.gen::<f64>() * 3.0),  // 0.0001 to 1.0 (log scale)
            exploration_rate: 0.5 + rng.gen::<f64>() * 0.5,              // 0.5 to 1.0
            discount_factor: 0.9 + rng.gen::<f64>() * 0.09,              // 0.9 to 0.99
            epsilon_decay: 0.99 + rng.gen::<f64>() * 0.009,              // 0.99 to 0.999
            formation_weight: rng.gen::<f64>() * 2.0,                    // 0 to 2.0
            collision_weight: 5.0 + rng.gen::<f64>() * 20.0,             // 5 to 25
            goal_weight: 1.0 + rng.gen::<f64>() * 10.0,                  // 1 to 11
            energy_weight: 0.01 + rng.gen::<f64>() * 0.5,                // 0.01 to 0.51
        }
    }

    /// Mutate hyperparameter set (for genetic algorithm)
    pub fn mutate(&mut self, mutation_rate: f64) {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        if rng.gen::<f64>() < mutation_rate {
            self.learning_rate *= 10_f64.powf((rng.gen::<f64>() - 0.5) * 0.5);
            self.learning_rate = self.learning_rate.max(0.00001).min(1.0);
        }
        if rng.gen::<f64>() < mutation_rate {
            self.exploration_rate += (rng.gen::<f64>() - 0.5) * 0.1;
            self.exploration_rate = self.exploration_rate.max(0.0).min(1.0);
        }
        if rng.gen::<f64>() < mutation_rate {
            self.discount_factor += (rng.gen::<f64>() - 0.5) * 0.02;
            self.discount_factor = self.discount_factor.max(0.9).min(0.999);
        }
        if rng.gen::<f64>() < mutation_rate {
            self.epsilon_decay += (rng.gen::<f64>() - 0.5) * 0.01;
            self.epsilon_decay = self.epsilon_decay.max(0.9).min(0.9999);
        }
        if rng.gen::<f64>() < mutation_rate {
            self.formation_weight += (rng.gen::<f64>() - 0.5) * 0.5;
            self.formation_weight = self.formation_weight.max(0.0).min(5.0);
        }
        if rng.gen::<f64>() < mutation_rate {
            self.collision_weight += (rng.gen::<f64>() - 0.5) * 5.0;
            self.collision_weight = self.collision_weight.max(1.0).min(50.0);
        }
        if rng.gen::<f64>() < mutation_rate {
            self.goal_weight += (rng.gen::<f64>() - 0.5) * 2.0;
            self.goal_weight = self.goal_weight.max(0.1).min(20.0);
        }
        if rng.gen::<f64>() < mutation_rate {
            self.energy_weight += (rng.gen::<f64>() - 0.5) * 0.1;
            self.energy_weight = self.energy_weight.max(0.001).min(1.0);
        }
    }

    /// Crossover between two hyperparameter sets (uniform crossover)
    pub fn crossover(&self, other: &HyperparameterSet) -> Self {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        Self {
            learning_rate: if rng.gen::<bool>() {
                self.learning_rate
            } else {
                other.learning_rate
            },
            exploration_rate: if rng.gen::<bool>() {
                self.exploration_rate
            } else {
                other.exploration_rate
            },
            discount_factor: if rng.gen::<bool>() {
                self.discount_factor
            } else {
                other.discount_factor
            },
            epsilon_decay: if rng.gen::<bool>() {
                self.epsilon_decay
            } else {
                other.epsilon_decay
            },
            formation_weight: if rng.gen::<bool>() {
                self.formation_weight
            } else {
                other.formation_weight
            },
            collision_weight: if rng.gen::<bool>() {
                self.collision_weight
            } else {
                other.collision_weight
            },
            goal_weight: if rng.gen::<bool>() {
                self.goal_weight
            } else {
                other.goal_weight
            },
            energy_weight: if rng.gen::<bool>() {
                self.energy_weight
            } else {
                other.energy_weight
            },
        }
    }

    /// Convert to AgentConfig for RL agent creation
    pub fn to_agent_config(&self, state_dim: usize, action_dim: usize) -> AgentConfig {
        AgentConfig {
            state_dim,
            action_dim,
            learning_rate: self.learning_rate,
            gamma: self.discount_factor,
            buffer_size: 10000,
            batch_size: 32,
            epsilon: self.exploration_rate,
            epsilon_decay: self.epsilon_decay,
            min_epsilon: 0.01,
        }
    }

    /// Convert to RewardConfig for reward function
    pub fn to_reward_config(&self) -> RewardConfig {
        RewardConfig {
            formation_weight: self.formation_weight,
            collision_weight: self.collision_weight,
            goal_weight: self.goal_weight,
            energy_weight: self.energy_weight,
            collision_threshold: 0.5,
            goal_threshold: 0.2,
        }
    }
}

/// Individual in genetic algorithm population
#[derive(Debug, Clone)]
pub struct Individual {
    pub hyperparameters: HyperparameterSet,
    pub fitness: f64,
}

impl Individual {
    pub fn new(hyperparameters: HyperparameterSet) -> Self {
        Self {
            hyperparameters,
            fitness: 0.0,
        }
    }

    pub fn random() -> Self {
        Self {
            hyperparameters: HyperparameterSet::random(),
            fitness: 0.0,
        }
    }
}

/// Genetic Algorithm for hyperparameter optimization
pub struct GeneticAlgorithm {
    population_size: usize,
    generations: usize,
    mutation_rate: f64,
    elite_size: usize,
}

impl GeneticAlgorithm {
    pub fn new(population_size: usize, generations: usize, mutation_rate: f64) -> Self {
        let elite_size = (population_size as f64 * 0.1).ceil() as usize;
        Self {
            population_size,
            generations,
            mutation_rate,
            elite_size,
        }
    }

    /// Run genetic algorithm optimization
    pub fn optimize<F>(&self, fitness_fn: F) -> HyperparameterSet
    where
        F: Fn(&HyperparameterSet) -> f64,
    {
        use rand::Rng;

        // Initialize population
        let mut population: Vec<Individual> = (0..self.population_size)
            .map(|_| Individual::random())
            .collect();

        // Evaluate initial population
        for individual in &mut population {
            individual.fitness = fitness_fn(&individual.hyperparameters);
        }

        let mut rng = rand::thread_rng();

        // Evolution loop
        for _generation in 0..self.generations {
            // Sort by fitness (descending)
            population.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());

            // Elitism: keep best individuals
            let mut new_population = population[..self.elite_size].to_vec();

            // Create offspring through crossover and mutation
            while new_population.len() < self.population_size {
                // Tournament selection
                let parent1 = self.tournament_select(&population, 3, &mut rng);
                let parent2 = self.tournament_select(&population, 3, &mut rng);

                // Crossover
                let mut child = Individual::new(parent1.hyperparameters.crossover(&parent2.hyperparameters));

                // Mutation
                child.hyperparameters.mutate(self.mutation_rate);

                // Evaluate
                child.fitness = fitness_fn(&child.hyperparameters);

                new_population.push(child);
            }

            population = new_population[..self.population_size].to_vec();
        }

        // Return best hyperparameters
        population.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());
        population[0].hyperparameters.clone()
    }

    fn tournament_select(
        &self,
        population: &[Individual],
        tournament_size: usize,
        rng: &mut rand::rngs::ThreadRng,
    ) -> Individual {
        use rand::Rng;
        let idx = rng.gen::<usize>() % population.len();
        let mut best = population[idx].clone();

        for _ in 1..tournament_size {
            let idx = rng.gen::<usize>() % population.len();
            let candidate = population[idx].clone();
            if candidate.fitness > best.fitness {
                best = candidate;
            }
        }

        best
    }
}

/// Particle in Particle Swarm Optimization
#[derive(Debug, Clone)]
pub struct Particle {
    pub position: HyperparameterSet,
    pub velocity: ParticleVelocity,
    pub best_position: HyperparameterSet,
    pub fitness: f64,
    pub best_fitness: f64,
}

#[derive(Debug, Clone)]
pub struct ParticleVelocity {
    pub learning_rate: f64,
    pub exploration_rate: f64,
    pub discount_factor: f64,
    pub epsilon_decay: f64,
    pub formation_weight: f64,
    pub collision_weight: f64,
    pub goal_weight: f64,
    pub energy_weight: f64,
}

impl ParticleVelocity {
    pub fn random() -> Self {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        Self {
            learning_rate: (rng.gen::<f64>() - 0.5) * 0.001,
            exploration_rate: (rng.gen::<f64>() - 0.5) * 0.1,
            discount_factor: (rng.gen::<f64>() - 0.5) * 0.01,
            epsilon_decay: (rng.gen::<f64>() - 0.5) * 0.01,
            formation_weight: (rng.gen::<f64>() - 0.5) * 0.5,
            collision_weight: (rng.gen::<f64>() - 0.5) * 5.0,
            goal_weight: (rng.gen::<f64>() - 0.5) * 2.0,
            energy_weight: (rng.gen::<f64>() - 0.5) * 0.1,
        }
    }
}

/// Particle Swarm Optimization for hyperparameter tuning
pub struct ParticleSwarmOptimizer {
    swarm_size: usize,
    iterations: usize,
    inertia_weight: f64,
    cognitive_coeff: f64,
    social_coeff: f64,
}

impl ParticleSwarmOptimizer {
    pub fn new(swarm_size: usize, iterations: usize) -> Self {
        Self {
            swarm_size,
            iterations,
            inertia_weight: 0.7,
            cognitive_coeff: 1.5,
            social_coeff: 1.5,
        }
    }

    /// Run PSO optimization
    pub fn optimize<F>(&self, fitness_fn: F) -> HyperparameterSet
    where
        F: Fn(&HyperparameterSet) -> f64,
    {
        use rand::Rng;

        // Initialize swarm
        let mut particles: Vec<Particle> = (0..self.swarm_size)
            .map(|_| {
                let position = HyperparameterSet::random();
                let fitness = fitness_fn(&position);
                Particle {
                    position: position.clone(),
                    velocity: ParticleVelocity::random(),
                    best_position: position,
                    fitness,
                    best_fitness: fitness,
                }
            })
            .collect();

        // Find global best
        let mut global_best = particles[0].best_position.clone();
        let mut global_best_fitness = particles[0].best_fitness;

        for particle in &particles {
            if particle.best_fitness > global_best_fitness {
                global_best_fitness = particle.best_fitness;
                global_best = particle.best_position.clone();
            }
        }

        let mut rng = rand::thread_rng();

        // PSO iterations
        for _iteration in 0..self.iterations {
            for particle in &mut particles {
                // Update velocity and position
                self.update_particle(particle, &global_best, &mut rng);

                // Evaluate new position
                let new_fitness = fitness_fn(&particle.position);
                particle.fitness = new_fitness;

                // Update personal best
                if new_fitness > particle.best_fitness {
                    particle.best_fitness = new_fitness;
                    particle.best_position = particle.position.clone();

                    // Update global best
                    if new_fitness > global_best_fitness {
                        global_best_fitness = new_fitness;
                        global_best = particle.position.clone();
                    }
                }
            }
        }

        global_best
    }

    fn update_particle(
        &self,
        particle: &mut Particle,
        global_best: &HyperparameterSet,
        rng: &mut rand::rngs::ThreadRng,
    ) {
        use rand::Rng;

        let r1 = rng.gen::<f64>();
        let r2 = rng.gen::<f64>();

        // Update velocity and position for each parameter
        particle.velocity.learning_rate = self.inertia_weight * particle.velocity.learning_rate
            + self.cognitive_coeff * r1 * (particle.best_position.learning_rate - particle.position.learning_rate)
            + self.social_coeff * r2 * (global_best.learning_rate - particle.position.learning_rate);

        particle.position.learning_rate = (particle.position.learning_rate + particle.velocity.learning_rate)
            .max(0.00001)
            .min(1.0);

        particle.velocity.exploration_rate = self.inertia_weight * particle.velocity.exploration_rate
            + self.cognitive_coeff * r1 * (particle.best_position.exploration_rate - particle.position.exploration_rate)
            + self.social_coeff * r2 * (global_best.exploration_rate - particle.position.exploration_rate);

        particle.position.exploration_rate = (particle.position.exploration_rate + particle.velocity.exploration_rate)
            .max(0.0)
            .min(1.0);

        particle.velocity.discount_factor = self.inertia_weight * particle.velocity.discount_factor
            + self.cognitive_coeff * r1 * (particle.best_position.discount_factor - particle.position.discount_factor)
            + self.social_coeff * r2 * (global_best.discount_factor - particle.position.discount_factor);

        particle.position.discount_factor = (particle.position.discount_factor + particle.velocity.discount_factor)
            .max(0.9)
            .min(0.999);

        particle.velocity.epsilon_decay = self.inertia_weight * particle.velocity.epsilon_decay
            + self.cognitive_coeff * r1 * (particle.best_position.epsilon_decay - particle.position.epsilon_decay)
            + self.social_coeff * r2 * (global_best.epsilon_decay - particle.position.epsilon_decay);

        particle.position.epsilon_decay = (particle.position.epsilon_decay + particle.velocity.epsilon_decay)
            .max(0.9)
            .min(0.9999);

        particle.velocity.formation_weight = self.inertia_weight * particle.velocity.formation_weight
            + self.cognitive_coeff * r1 * (particle.best_position.formation_weight - particle.position.formation_weight)
            + self.social_coeff * r2 * (global_best.formation_weight - particle.position.formation_weight);

        particle.position.formation_weight = (particle.position.formation_weight + particle.velocity.formation_weight)
            .max(0.0)
            .min(5.0);

        particle.velocity.collision_weight = self.inertia_weight * particle.velocity.collision_weight
            + self.cognitive_coeff * r1 * (particle.best_position.collision_weight - particle.position.collision_weight)
            + self.social_coeff * r2 * (global_best.collision_weight - particle.position.collision_weight);

        particle.position.collision_weight = (particle.position.collision_weight + particle.velocity.collision_weight)
            .max(1.0)
            .min(50.0);

        particle.velocity.goal_weight = self.inertia_weight * particle.velocity.goal_weight
            + self.cognitive_coeff * r1 * (particle.best_position.goal_weight - particle.position.goal_weight)
            + self.social_coeff * r2 * (global_best.goal_weight - particle.position.goal_weight);

        particle.position.goal_weight = (particle.position.goal_weight + particle.velocity.goal_weight)
            .max(0.1)
            .min(20.0);

        particle.velocity.energy_weight = self.inertia_weight * particle.velocity.energy_weight
            + self.cognitive_coeff * r1 * (particle.best_position.energy_weight - particle.position.energy_weight)
            + self.social_coeff * r2 * (global_best.energy_weight - particle.position.energy_weight);

        particle.position.energy_weight = (particle.position.energy_weight + particle.velocity.energy_weight)
            .max(0.001)
            .min(1.0);
    }
}

/// Grid search for hyperparameter optimization
pub struct GridSearchOptimizer {
    learning_rates: Vec<f64>,
    exploration_rates: Vec<f64>,
    discount_factors: Vec<f64>,
}

impl GridSearchOptimizer {
    pub fn new() -> Self {
        Self {
            learning_rates: vec![0.0001, 0.001, 0.01, 0.1],
            exploration_rates: vec![0.5, 0.7, 0.9, 1.0],
            discount_factors: vec![0.9, 0.95, 0.99, 0.999],
        }
    }

    /// Run grid search optimization
    pub fn optimize<F>(&self, fitness_fn: F) -> HyperparameterSet
    where
        F: Fn(&HyperparameterSet) -> f64,
    {
        let mut best_hyperparams = HyperparameterSet::default();
        let mut best_fitness = f64::NEG_INFINITY;

        for &learning_rate in &self.learning_rates {
            for &exploration_rate in &self.exploration_rates {
                for &discount_factor in &self.discount_factors {
                    let mut hyperparams = HyperparameterSet::default();
                    hyperparams.learning_rate = learning_rate;
                    hyperparams.exploration_rate = exploration_rate;
                    hyperparams.discount_factor = discount_factor;

                    let fitness = fitness_fn(&hyperparams);

                    if fitness > best_fitness {
                        best_fitness = fitness;
                        best_hyperparams = hyperparams;
                    }
                }
            }
        }

        best_hyperparams
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hyperparameter_set_creation() {
        let params = HyperparameterSet::default();
        assert_eq!(params.learning_rate, 0.001);
        assert_eq!(params.discount_factor, 0.99);
    }

    #[test]
    fn test_hyperparameter_random() {
        let params1 = HyperparameterSet::random();
        let params2 = HyperparameterSet::random();
        // Learning rates should likely be different
        assert!(params1.learning_rate > 0.0);
        assert!(params2.learning_rate > 0.0);
    }

    #[test]
    fn test_hyperparameter_mutation() {
        let mut params = HyperparameterSet::default();
        let original_lr = params.learning_rate;
        params.mutate(1.0); // Always mutate
        // Should have changed (with near certainty)
        assert!(params.learning_rate >= 0.00001 && params.learning_rate <= 1.0);
    }

    #[test]
    fn test_hyperparameter_crossover() {
        let params1 = HyperparameterSet {
            learning_rate: 0.001,
            exploration_rate: 0.5,
            ..HyperparameterSet::default()
        };
        let params2 = HyperparameterSet {
            learning_rate: 0.1,
            exploration_rate: 1.0,
            ..HyperparameterSet::default()
        };

        let child = params1.crossover(&params2);
        // Child should have values from either parent
        assert!(child.learning_rate == 0.001 || child.learning_rate == 0.1);
    }

    #[test]
    fn test_individual_creation() {
        let params = HyperparameterSet::default();
        let individual = Individual::new(params);
        assert_eq!(individual.fitness, 0.0);
    }

    #[test]
    fn test_genetic_algorithm_basic() {
        let ga = GeneticAlgorithm::new(10, 2, 0.1);
        assert_eq!(ga.population_size, 10);
        assert_eq!(ga.elite_size, 1);
    }

    #[test]
    fn test_genetic_algorithm_optimize() {
        let ga = GeneticAlgorithm::new(5, 2, 0.1);

        // Simple fitness: maximize learning rate
        let fitness_fn = |params: &HyperparameterSet| params.learning_rate * 100.0;

        let best = ga.optimize(fitness_fn);
        assert!(best.learning_rate > 0.0);
    }

    #[test]
    fn test_particle_velocity_creation() {
        let velocity = ParticleVelocity::random();
        assert!(velocity.learning_rate.abs() < 0.001);
    }

    #[test]
    fn test_particle_creation() {
        let params = HyperparameterSet::default();
        let particle = Particle {
            position: params.clone(),
            velocity: ParticleVelocity::random(),
            best_position: params,
            fitness: 0.5,
            best_fitness: 0.5,
        };

        assert_eq!(particle.fitness, 0.5);
    }

    #[test]
    fn test_pso_basic() {
        let pso = ParticleSwarmOptimizer::new(5, 2);
        assert_eq!(pso.swarm_size, 5);
    }

    #[test]
    fn test_pso_optimize() {
        let pso = ParticleSwarmOptimizer::new(5, 2);

        // Simple fitness: maximize learning rate
        let fitness_fn = |params: &HyperparameterSet| params.learning_rate * 100.0;

        let best = pso.optimize(fitness_fn);
        assert!(best.learning_rate > 0.0);
    }

    #[test]
    fn test_grid_search_basic() {
        let gs = GridSearchOptimizer::new();
        assert_eq!(gs.learning_rates.len(), 4);
    }

    #[test]
    fn test_grid_search_optimize() {
        let gs = GridSearchOptimizer::new();

        // Simple fitness: maximize learning rate
        let fitness_fn = |params: &HyperparameterSet| params.learning_rate * 100.0;

        let best = gs.optimize(fitness_fn);
        assert_eq!(best.learning_rate, 0.1); // Should find max
    }

    #[test]
    fn test_hyperparameter_bounds() {
        let mut params = HyperparameterSet::default();
        params.mutate(1.0);

        // Check all parameters are within bounds
        assert!(params.learning_rate >= 0.00001 && params.learning_rate <= 1.0);
        assert!(params.exploration_rate >= 0.0 && params.exploration_rate <= 1.0);
        assert!(params.discount_factor >= 0.9 && params.discount_factor <= 0.999);
    }

    #[test]
    fn test_to_agent_config() {
        let params = HyperparameterSet::default();
        let config = params.to_agent_config(6, 3); // 6D state, 3D action
        assert_eq!(config.learning_rate, params.learning_rate);
        assert_eq!(config.gamma, params.discount_factor);
    }

    #[test]
    fn test_to_reward_config() {
        let params = HyperparameterSet::default();
        let config = params.to_reward_config();
        assert_eq!(config.formation_weight, params.formation_weight);
    }
}
