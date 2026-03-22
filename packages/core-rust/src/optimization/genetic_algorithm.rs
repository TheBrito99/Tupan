//! Genetic Algorithm for Manufacturing Parameter Optimization
//!
//! Optimizes cutting parameters (spindle speed, feed rate, depth of cut)
//! to minimize cycle time, cost, or maximize quality.
//!
//! Algorithm:
//! 1. Create initial population of random parameter sets
//! 2. Evaluate fitness (simulation-based)
//! 3. Select best performers
//! 4. Crossover (blend parent parameters)
//! 5. Mutation (random perturbations)
//! 6. Repeat until convergence or max generations

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Cutting parameters being optimized
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CuttingParameters {
    /// Spindle speed [RPM]
    pub spindle_speed: f64,
    /// Feed rate [mm/min]
    pub feed_rate: f64,
    /// Depth of cut [mm]
    pub depth_of_cut: f64,
}

impl CuttingParameters {
    pub fn new(spindle_speed: f64, feed_rate: f64, depth_of_cut: f64) -> Self {
        CuttingParameters {
            spindle_speed,
            feed_rate,
            depth_of_cut,
        }
    }

    /// Clamp parameters to valid ranges
    pub fn clamp(&mut self, bounds: &ParameterBounds) {
        self.spindle_speed = self.spindle_speed
            .max(bounds.spindle_speed_min)
            .min(bounds.spindle_speed_max);
        self.feed_rate = self.feed_rate
            .max(bounds.feed_rate_min)
            .min(bounds.feed_rate_max);
        self.depth_of_cut = self.depth_of_cut
            .max(bounds.depth_of_cut_min)
            .min(bounds.depth_of_cut_max);
    }
}

/// Parameter bounds for optimization
#[derive(Debug, Clone)]
pub struct ParameterBounds {
    pub spindle_speed_min: f64,
    pub spindle_speed_max: f64,
    pub feed_rate_min: f64,
    pub feed_rate_max: f64,
    pub depth_of_cut_min: f64,
    pub depth_of_cut_max: f64,
}

impl ParameterBounds {
    /// Default bounds for aluminum milling
    pub fn aluminum() -> Self {
        ParameterBounds {
            spindle_speed_min: 500.0,
            spindle_speed_max: 10000.0,
            feed_rate_min: 50.0,
            feed_rate_max: 2000.0,
            depth_of_cut_min: 0.5,
            depth_of_cut_max: 5.0,
        }
    }

    /// Default bounds for steel milling
    pub fn steel() -> Self {
        ParameterBounds {
            spindle_speed_min: 200.0,
            spindle_speed_max: 5000.0,
            feed_rate_min: 30.0,
            feed_rate_max: 1000.0,
            depth_of_cut_min: 0.5,
            depth_of_cut_max: 3.0,
        }
    }

    /// Default bounds for titanium (high precision)
    pub fn titanium() -> Self {
        ParameterBounds {
            spindle_speed_min: 100.0,
            spindle_speed_max: 2000.0,
            feed_rate_min: 20.0,
            feed_rate_max: 400.0,
            depth_of_cut_min: 0.2,
            depth_of_cut_max: 1.5,
        }
    }
}

/// Optimization objective
#[derive(Debug, Clone, Copy)]
pub enum OptimizationObjective {
    /// Minimize cycle time [minutes]
    MinimizeTime,
    /// Minimize cost per part [$]
    MinimizeCost,
    /// Maximize surface quality [lower Ra is better]
    MaximizeQuality,
    /// Weighted combination (time_weight, cost_weight, quality_weight)
    Balanced(f64, f64, f64),
}

/// Fitness evaluation result
#[derive(Debug, Clone)]
pub struct FitnessEvaluation {
    pub cycle_time: f64,              // minutes
    pub estimated_cost: f64,          // $ per part
    pub surface_finish_ra: f64,       // micrometers
    pub spindle_power_required: f64,  // kW
    pub constraint_violations: u32,
    pub fitness_score: f64,           // Higher is better
}

impl FitnessEvaluation {
    /// Create fitness evaluation with computed score
    pub fn new(
        cycle_time: f64,
        estimated_cost: f64,
        surface_finish_ra: f64,
        spindle_power_required: f64,
        constraint_violations: u32,
        objective: OptimizationObjective,
    ) -> Self {
        // Compute fitness based on objective
        let fitness_score = match objective {
            OptimizationObjective::MinimizeTime => {
                // Shorter time = higher fitness (inverted score)
                1000.0 / (cycle_time.max(0.1) + 1.0)
            }
            OptimizationObjective::MinimizeCost => {
                // Lower cost = higher fitness
                1000.0 / (estimated_cost.max(0.1) + 1.0)
            }
            OptimizationObjective::MaximizeQuality => {
                // Lower Ra (better finish) = higher fitness
                1000.0 / (surface_finish_ra.max(0.1) + 1.0)
            }
            OptimizationObjective::Balanced(t_w, c_w, q_w) => {
                // Normalize weights (should sum to 1.0)
                let total_weight = t_w + c_w + q_w;
                let t_w_norm = t_w / total_weight;
                let c_w_norm = c_w / total_weight;
                let q_w_norm = q_w / total_weight;

                let time_score = 1000.0 / (cycle_time.max(0.1) + 1.0);
                let cost_score = 1000.0 / (estimated_cost.max(0.1) + 1.0);
                let quality_score = 1000.0 / (surface_finish_ra.max(0.1) + 1.0);

                t_w_norm * time_score + c_w_norm * cost_score + q_w_norm * quality_score
            }
        };

        // Penalize constraint violations heavily
        let penalized_fitness = fitness_score - (constraint_violations as f64 * 500.0);

        FitnessEvaluation {
            cycle_time,
            estimated_cost,
            surface_finish_ra,
            spindle_power_required,
            constraint_violations,
            fitness_score: penalized_fitness,
        }
    }
}

/// Genetic Algorithm Optimizer
pub struct GeneticOptimizer {
    pub population_size: usize,
    pub generations: usize,
    pub mutation_rate: f64,
    pub crossover_rate: f64,
    pub elitism_rate: f64,
}

impl GeneticOptimizer {
    /// Create new GA optimizer
    pub fn new(
        population_size: usize,
        generations: usize,
        mutation_rate: f64,
        crossover_rate: f64,
    ) -> Self {
        GeneticOptimizer {
            population_size,
            generations,
            mutation_rate,
            crossover_rate,
            elitism_rate: 0.1, // Keep top 10%
        }
    }

    /// Run optimization
    pub fn optimize(
        &self,
        initial_population: Vec<CuttingParameters>,
        bounds: &ParameterBounds,
        objective: OptimizationObjective,
        fitness_fn: &dyn Fn(&CuttingParameters) -> FitnessEvaluation,
    ) -> OptimizationResult {
        let mut population = initial_population;

        // Ensure population size
        while population.len() < self.population_size {
            population.push(self.random_parameters(bounds));
        }
        population.truncate(self.population_size);

        let mut best_fitness = f64::NEG_INFINITY;
        let mut best_parameters = population[0];
        let mut generation_fitnesses = Vec::new();

        for generation in 0..self.generations {
            // Evaluate fitness
            let mut fitness_scores: Vec<(CuttingParameters, FitnessEvaluation)> = population
                .iter()
                .map(|p| (*p, fitness_fn(p)))
                .collect();

            // Sort by fitness (highest first)
            fitness_scores.sort_by(|a, b| {
                b.1.fitness_score
                    .partial_cmp(&a.1.fitness_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            // Track best
            if fitness_scores[0].1.fitness_score > best_fitness {
                best_fitness = fitness_scores[0].1.fitness_score;
                best_parameters = fitness_scores[0].0;
            }

            generation_fitnesses.push(best_fitness);

            // Elitism: keep top performers
            let elite_count = (self.population_size as f64 * self.elitism_rate).ceil() as usize;
            let mut new_population: Vec<CuttingParameters> = fitness_scores
                .iter()
                .take(elite_count)
                .map(|(p, _)| *p)
                .collect();

            // Fill rest with crossover + mutation
            while new_population.len() < self.population_size {
                // Select parents (tournament selection)
                let parent1 = self.tournament_select(&fitness_scores);
                let parent2 = self.tournament_select(&fitness_scores);

                // Crossover
                let mut child = if rand::random::<f64>() < self.crossover_rate {
                    self.crossover(&parent1, &parent2)
                } else {
                    parent1
                };

                // Mutation
                if rand::random::<f64>() < self.mutation_rate {
                    self.mutate(&mut child, bounds);
                }

                // Clamp to bounds
                child.clamp(bounds);
                new_population.push(child);
            }

            population = new_population.into_iter().take(self.population_size).collect();
        }

        let final_fitness = fitness_fn(&best_parameters);

        OptimizationResult {
            best_parameters,
            best_fitness,
            final_fitness,
            generation_fitnesses,
            converged: true,
        }
    }

    /// Generate random parameters within bounds
    fn random_parameters(&self, bounds: &ParameterBounds) -> CuttingParameters {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        CuttingParameters {
            spindle_speed: rng.gen_range(bounds.spindle_speed_min..=bounds.spindle_speed_max),
            feed_rate: rng.gen_range(bounds.feed_rate_min..=bounds.feed_rate_max),
            depth_of_cut: rng.gen_range(bounds.depth_of_cut_min..=bounds.depth_of_cut_max),
        }
    }

    /// Tournament selection (select best of random subset)
    fn tournament_select(
        &self,
        fitness_scores: &[(CuttingParameters, FitnessEvaluation)],
    ) -> CuttingParameters {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        let tournament_size = (fitness_scores.len() / 4).max(2);
        let mut best = None;
        let mut best_fitness = f64::NEG_INFINITY;

        for _ in 0..tournament_size {
            let idx = rng.gen_range(0..fitness_scores.len());
            if fitness_scores[idx].1.fitness_score > best_fitness {
                best_fitness = fitness_scores[idx].1.fitness_score;
                best = Some(fitness_scores[idx].0);
            }
        }

        best.unwrap_or(fitness_scores[0].0)
    }

    /// Crossover: blend parent parameters
    fn crossover(
        &self,
        parent1: &CuttingParameters,
        parent2: &CuttingParameters,
    ) -> CuttingParameters {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        // Uniform crossover: each parameter from random parent
        CuttingParameters {
            spindle_speed: if rng.gen_bool(0.5) {
                parent1.spindle_speed
            } else {
                parent2.spindle_speed
            },
            feed_rate: if rng.gen_bool(0.5) {
                parent1.feed_rate
            } else {
                parent2.feed_rate
            },
            depth_of_cut: if rng.gen_bool(0.5) {
                parent1.depth_of_cut
            } else {
                parent2.depth_of_cut
            },
        }
    }

    /// Mutation: random parameter perturbation
    fn mutate(&self, child: &mut CuttingParameters, bounds: &ParameterBounds) {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        // Mutate each parameter with 20% probability
        if rng.gen_bool(0.2) {
            let perturbation = rng.gen_range(-0.2..=0.2);
            let range = bounds.spindle_speed_max - bounds.spindle_speed_min;
            child.spindle_speed += perturbation * range;
        }

        if rng.gen_bool(0.2) {
            let perturbation = rng.gen_range(-0.2..=0.2);
            let range = bounds.feed_rate_max - bounds.feed_rate_min;
            child.feed_rate += perturbation * range;
        }

        if rng.gen_bool(0.2) {
            let perturbation = rng.gen_range(-0.2..=0.2);
            let range = bounds.depth_of_cut_max - bounds.depth_of_cut_min;
            child.depth_of_cut += perturbation * range;
        }
    }
}

/// Optimization result
#[derive(Debug, Clone)]
pub struct OptimizationResult {
    pub best_parameters: CuttingParameters,
    pub best_fitness: f64,
    pub final_fitness: FitnessEvaluation,
    pub generation_fitnesses: Vec<f64>,
    pub converged: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cutting_parameters_creation() {
        let params = CuttingParameters::new(5000.0, 500.0, 2.0);
        assert_eq!(params.spindle_speed, 5000.0);
        assert_eq!(params.feed_rate, 500.0);
        assert_eq!(params.depth_of_cut, 2.0);
    }

    #[test]
    fn test_parameter_bounds_aluminum() {
        let bounds = ParameterBounds::aluminum();
        assert!(bounds.spindle_speed_min > 0.0);
        assert!(bounds.spindle_speed_max > bounds.spindle_speed_min);
    }

    #[test]
    fn test_parameter_clamping() {
        let bounds = ParameterBounds::aluminum();
        let mut params = CuttingParameters::new(20000.0, 5000.0, 10.0); // Out of bounds
        params.clamp(&bounds);

        assert!(params.spindle_speed <= bounds.spindle_speed_max);
        assert!(params.feed_rate <= bounds.feed_rate_max);
        assert!(params.depth_of_cut <= bounds.depth_of_cut_max);
    }

    #[test]
    fn test_fitness_evaluation_minimize_time() {
        let eval = FitnessEvaluation::new(
            2.0,  // cycle time
            10.0, // cost
            1.6,  // surface finish
            5.0,  // power
            0,    // violations
            OptimizationObjective::MinimizeTime,
        );

        assert!(eval.fitness_score > 0.0);
    }

    #[test]
    fn test_fitness_evaluation_constraint_violation() {
        let eval1 = FitnessEvaluation::new(
            2.0, 10.0, 1.6, 5.0, 0,
            OptimizationObjective::MinimizeTime,
        );

        let eval2 = FitnessEvaluation::new(
            2.0, 10.0, 1.6, 5.0, 1, // One violation
            OptimizationObjective::MinimizeTime,
        );

        // Violation should significantly reduce fitness
        assert!(eval1.fitness_score > eval2.fitness_score);
    }

    #[test]
    fn test_genetic_optimizer_creation() {
        let optimizer = GeneticOptimizer::new(100, 50, 0.1, 0.7);
        assert_eq!(optimizer.population_size, 100);
        assert_eq!(optimizer.generations, 50);
    }

    #[test]
    fn test_simple_optimization() {
        let optimizer = GeneticOptimizer::new(20, 10, 0.1, 0.7);
        let bounds = ParameterBounds::aluminum();

        // Simple fitness function: prefer balanced parameters
        let fitness_fn = |params: &CuttingParameters| {
            let time_estimate = 100.0 / (params.spindle_speed / 1000.0);
            let cost_estimate = params.depth_of_cut * 2.0;
            FitnessEvaluation::new(time_estimate, cost_estimate, 1.6, 3.0, 0, OptimizationObjective::MinimizeTime)
        };

        let initial = vec![CuttingParameters::new(1000.0, 100.0, 1.0)];
        let result = optimizer.optimize(initial, &bounds, OptimizationObjective::MinimizeTime, &fitness_fn);

        assert!(result.converged);
        assert!(result.best_fitness > f64::NEG_INFINITY);
        assert!(!result.generation_fitnesses.is_empty());
    }
}
