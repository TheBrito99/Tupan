//! Optimization: Trajectory and Parameter Optimization
//! Phase 25 Task 5 - Advanced Optimization

use std::f64::consts::PI;

/// Objective function for optimization
pub trait ObjectiveFunction {
    fn evaluate(&self, x: &[f64]) -> f64;
    fn gradient(&self, x: &[f64]) -> Vec<f64>;
}

/// Simple quadratic objective: f(x) = ||x - target||²
#[derive(Clone)]
pub struct QuadraticObjective {
    pub target: Vec<f64>,
}

impl ObjectiveFunction for QuadraticObjective {
    fn evaluate(&self, x: &[f64]) -> f64 {
        x.iter()
            .zip(self.target.iter())
            .map(|(xi, ti)| (xi - ti).powi(2))
            .sum()
    }

    fn gradient(&self, x: &[f64]) -> Vec<f64> {
        x.iter()
            .zip(self.target.iter())
            .map(|(xi, ti)| 2.0 * (xi - ti))
            .collect()
    }
}

/// Rosenbrock function for testing optimization: f(x) = sum((1-xi)² + 100*(xi+1 - xi²)²)
#[derive(Clone)]
pub struct RosenbrockObjective;

impl ObjectiveFunction for RosenbrockObjective {
    fn evaluate(&self, x: &[f64]) -> f64 {
        let mut sum = 0.0;
        for i in 0..x.len() - 1 {
            sum += (1.0 - x[i]).powi(2) + 100.0 * (x[i + 1] - x[i].powi(2)).powi(2);
        }
        sum
    }

    fn gradient(&self, x: &[f64]) -> Vec<f64> {
        let mut grad = vec![0.0; x.len()];
        for i in 0..x.len() - 1 {
            grad[i] += -2.0 * (1.0 - x[i]) - 400.0 * x[i] * (x[i + 1] - x[i].powi(2));
            grad[i + 1] += 200.0 * (x[i + 1] - x[i].powi(2));
        }
        grad
    }
}

/// Gradient descent optimizer
pub struct GradientDescent {
    pub learning_rate: f64,
    pub max_iterations: usize,
    pub tolerance: f64,
}

impl GradientDescent {
    pub fn new(learning_rate: f64, max_iterations: usize, tolerance: f64) -> Self {
        GradientDescent {
            learning_rate,
            max_iterations,
            tolerance,
        }
    }

    /// Optimize parameters using gradient descent
    pub fn optimize<F: ObjectiveFunction>(
        &self,
        objective: &F,
        mut x: Vec<f64>,
    ) -> OptimizationResult {
        let mut best_x = x.clone();
        let mut best_value = objective.evaluate(&x);
        let mut iteration = 0;

        for iter in 0..self.max_iterations {
            let grad = objective.gradient(&x);
            let grad_norm = (grad.iter().map(|g| g * g).sum::<f64>()).sqrt();

            if grad_norm < self.tolerance {
                iteration = iter;
                break;
            }

            for i in 0..x.len() {
                x[i] -= self.learning_rate * grad[i];
            }

            let value = objective.evaluate(&x);
            if value < best_value {
                best_value = value;
                best_x = x.clone();
            }

            iteration = iter;
        }

        OptimizationResult {
            x: best_x,
            value: best_value,
            iterations: iteration,
            converged: best_value < self.tolerance,
        }
    }
}

/// Particle Swarm Optimization
pub struct ParticleSwarmOptimizer {
    pub num_particles: usize,
    pub max_iterations: usize,
    pub cognitive_weight: f64,
    pub social_weight: f64,
    pub inertia: f64,
}

impl ParticleSwarmOptimizer {
    pub fn new(num_particles: usize, max_iterations: usize) -> Self {
        ParticleSwarmOptimizer {
            num_particles,
            max_iterations,
            cognitive_weight: 2.0,
            social_weight: 2.0,
            inertia: 0.7,
        }
    }

    /// Optimize using particle swarm
    pub fn optimize<F: ObjectiveFunction>(
        &self,
        objective: &F,
        bounds: (&[f64], &[f64]),
    ) -> OptimizationResult {
        let dim = bounds.0.len();
        let mut particles: Vec<Vec<f64>> = (0..self.num_particles)
            .map(|_| {
                (0..dim)
                    .map(|i| bounds.0[i] + (bounds.1[i] - bounds.0[i]) * 0.5)
                    .collect()
            })
            .collect();

        let mut velocities: Vec<Vec<f64>> = (0..self.num_particles)
            .map(|_| vec![0.0; dim])
            .collect();

        let mut best_positions: Vec<Vec<f64>> = particles.clone();
        let mut best_values: Vec<f64> = particles.iter().map(|p| objective.evaluate(p)).collect();

        let mut global_best_idx = best_values
            .iter()
            .enumerate()
            .min_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap()
            .0;
        let mut global_best_value = best_values[global_best_idx];

        for iter in 0..self.max_iterations {
            for i in 0..self.num_particles {
                for j in 0..dim {
                    let r1 = 0.5; // Simplified: use constant instead of random
                    let r2 = 0.5;

                    velocities[i][j] = self.inertia * velocities[i][j]
                        + self.cognitive_weight * r1 * (best_positions[i][j] - particles[i][j])
                        + self.social_weight * r2 * (particles[global_best_idx][j] - particles[i][j]);

                    particles[i][j] += velocities[i][j];
                    particles[i][j] = particles[i][j].max(bounds.0[j]).min(bounds.1[j]);
                }

                let value = objective.evaluate(&particles[i]);
                if value < best_values[i] {
                    best_values[i] = value;
                    best_positions[i] = particles[i].clone();

                    if value < global_best_value {
                        global_best_value = value;
                        global_best_idx = i;
                    }
                }
            }

            if global_best_value < 1e-10 {
                return OptimizationResult {
                    x: particles[global_best_idx].clone(),
                    value: global_best_value,
                    iterations: iter,
                    converged: true,
                };
            }
        }

        OptimizationResult {
            x: particles[global_best_idx].clone(),
            value: global_best_value,
            iterations: self.max_iterations,
            converged: false,
        }
    }
}

/// Optimization result
#[derive(Clone)]
pub struct OptimizationResult {
    pub x: Vec<f64>,
    pub value: f64,
    pub iterations: usize,
    pub converged: bool,
}

/// Trajectory time optimization
pub struct TrajectoryOptimizer {
    pub max_velocity: f64,
    pub max_acceleration: f64,
}

impl TrajectoryOptimizer {
    pub fn new(max_velocity: f64, max_acceleration: f64) -> Self {
        TrajectoryOptimizer {
            max_velocity,
            max_acceleration,
        }
    }

    /// Optimal time for point-to-point motion
    pub fn compute_optimal_time(&self, distance: f64) -> f64 {
        let t_accel = self.max_velocity / self.max_acceleration;
        let s_accel = 0.5 * self.max_acceleration * t_accel * t_accel;

        if distance <= 2.0 * s_accel {
            // Acceleration only
            2.0 * (distance / self.max_acceleration).sqrt()
        } else {
            // Acceleration + constant velocity + deceleration
            2.0 * t_accel + (distance - 2.0 * s_accel) / self.max_velocity
        }
    }

    /// Energy cost of trajectory
    pub fn trajectory_energy(&self, distance: f64, time: f64) -> f64 {
        // Energy ∝ acceleration² × time
        let avg_accel = (2.0 * distance) / (time * time);
        avg_accel.powi(2) * time
    }

    /// Minimize energy subject to time constraint
    pub fn energy_optimal_time(&self, distance: f64, max_time: f64) -> f64 {
        let t_min = self.compute_optimal_time(distance);
        t_min.max(max_time)
    }
}

/// Cost function for motion: energy + smoothness + acceleration
#[derive(Clone)]
pub struct MotionCostFunction {
    pub target_position: Vec<f64>,
    pub weight_position: f64,
    pub weight_energy: f64,
    pub weight_smoothness: f64,
}

impl ObjectiveFunction for MotionCostFunction {
    fn evaluate(&self, x: &[f64]) -> f64 {
        // Position error
        let position_error = x
            .iter()
            .zip(self.target_position.iter())
            .map(|(xi, ti)| (xi - ti).powi(2))
            .sum::<f64>();

        // Energy (velocity magnitude)
        let mut energy = 0.0;
        for i in 1..x.len() {
            energy += (x[i] - x[i - 1]).powi(2);
        }

        // Smoothness (acceleration magnitude)
        let mut smoothness = 0.0;
        for i in 1..x.len() - 1 {
            let accel = (x[i + 1] - 2.0 * x[i] + x[i - 1]).powi(2);
            smoothness += accel;
        }

        self.weight_position * position_error
            + self.weight_energy * energy
            + self.weight_smoothness * smoothness
    }

    fn gradient(&self, x: &[f64]) -> Vec<f64> {
        let mut grad = vec![0.0; x.len()];

        // Position gradient
        for i in 0..x.len() {
            grad[i] += 2.0 * self.weight_position * (x[i] - self.target_position[i]);
        }

        // Energy gradient
        for i in 1..x.len() {
            let energy_contrib = 2.0 * (x[i] - x[i - 1]);
            grad[i] += self.weight_energy * energy_contrib;
            grad[i - 1] -= self.weight_energy * energy_contrib;
        }

        // Smoothness gradient
        for i in 1..x.len() - 1 {
            let accel = x[i + 1] - 2.0 * x[i] + x[i - 1];
            grad[i - 1] += 2.0 * self.weight_smoothness * accel;
            grad[i] -= 4.0 * self.weight_smoothness * accel;
            grad[i + 1] += 2.0 * self.weight_smoothness * accel;
        }

        grad
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quadratic_objective_creation() {
        let obj = QuadraticObjective {
            target: vec![1.0, 2.0, 3.0],
        };
        assert_eq!(obj.target.len(), 3);
    }

    #[test]
    fn test_quadratic_objective_evaluate() {
        let obj = QuadraticObjective {
            target: vec![1.0, 2.0],
        };
        let value = obj.evaluate(&vec![1.0, 2.0]);
        assert!((value - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_quadratic_objective_gradient() {
        let obj = QuadraticObjective {
            target: vec![1.0, 2.0],
        };
        let grad = obj.gradient(&vec![2.0, 3.0]);
        assert!((grad[0] - 2.0).abs() < 1e-10);
        assert!((grad[1] - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_rosenbrock_objective_evaluate() {
        let obj = RosenbrockObjective;
        let value = obj.evaluate(&vec![1.0, 1.0]);
        assert!((value - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_gradient_descent_creation() {
        let optimizer = GradientDescent::new(0.01, 100, 1e-6);
        assert!((optimizer.learning_rate - 0.01).abs() < 1e-10);
    }

    #[test]
    fn test_gradient_descent_optimize() {
        let obj = QuadraticObjective {
            target: vec![0.0, 0.0],
        };
        let optimizer = GradientDescent::new(0.1, 1000, 1e-10);
        let result = optimizer.optimize(&obj, vec![5.0, 5.0]);

        assert!(result.value < 1.0);
        assert!(result.iterations < 1000);
    }

    #[test]
    fn test_particle_swarm_creation() {
        let optimizer = ParticleSwarmOptimizer::new(20, 100);
        assert_eq!(optimizer.num_particles, 20);
    }

    #[test]
    fn test_particle_swarm_optimize() {
        let obj = QuadraticObjective {
            target: vec![1.0, 1.0],
        };
        let optimizer = ParticleSwarmOptimizer::new(10, 50);
        let lower = vec![0.0, 0.0];
        let upper = vec![2.0, 2.0];
        let bounds = (&lower[..], &upper[..]);
        let result = optimizer.optimize(&obj, bounds);

        assert!(result.value < 10.0);
    }

    #[test]
    fn test_trajectory_optimizer_creation() {
        let optimizer = TrajectoryOptimizer::new(1.0, 0.5);
        assert!((optimizer.max_velocity - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_compute_optimal_time() {
        let optimizer = TrajectoryOptimizer::new(1.0, 1.0);
        let time = optimizer.compute_optimal_time(2.0);
        assert!(time > 0.0);
    }

    #[test]
    fn test_trajectory_energy() {
        let optimizer = TrajectoryOptimizer::new(1.0, 1.0);
        let energy = optimizer.trajectory_energy(10.0, 5.0);
        assert!(energy > 0.0);
    }

    #[test]
    fn test_energy_optimal_time() {
        let optimizer = TrajectoryOptimizer::new(1.0, 1.0);
        let time = optimizer.energy_optimal_time(5.0, 10.0);
        assert!(time >= 10.0);
    }

    #[test]
    fn test_motion_cost_function_creation() {
        let cost = MotionCostFunction {
            target_position: vec![1.0, 1.0],
            weight_position: 1.0,
            weight_energy: 0.1,
            weight_smoothness: 0.01,
        };
        assert_eq!(cost.target_position.len(), 2);
    }

    #[test]
    fn test_motion_cost_function_evaluate() {
        let cost = MotionCostFunction {
            target_position: vec![1.0, 1.0],
            weight_position: 1.0,
            weight_energy: 0.0,
            weight_smoothness: 0.0,
        };
        let value = cost.evaluate(&vec![1.0, 1.0]);
        assert!((value - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_motion_cost_function_gradient() {
        let cost = MotionCostFunction {
            target_position: vec![0.0, 0.0],
            weight_position: 1.0,
            weight_energy: 0.0,
            weight_smoothness: 0.0,
        };
        let grad = cost.gradient(&vec![1.0, 1.0]);
        assert_eq!(grad.len(), 2);
    }

    #[test]
    fn test_optimization_result_creation() {
        let result = OptimizationResult {
            x: vec![1.0, 2.0],
            value: 0.5,
            iterations: 100,
            converged: true,
        };
        assert!(result.converged);
    }

    #[test]
    fn test_optimization_convergence() {
        let obj = QuadraticObjective {
            target: vec![0.0, 0.0, 0.0],
        };
        let optimizer = GradientDescent::new(0.1, 10000, 1e-12);
        let result = optimizer.optimize(&obj, vec![10.0, 10.0, 10.0]);

        assert!(result.converged);
    }
}
