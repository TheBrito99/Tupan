//! Phase 28 Task 1b: Reward Function
//! Reward computation for multi-robot coordination training

use crate::clifford_algebra::spatialization::Point3D;

/// Reward configuration
#[derive(Debug, Clone)]
pub struct RewardConfig {
    pub formation_weight: f64,       // Weight for formation error penalty
    pub collision_weight: f64,       // Weight for collision penalty
    pub goal_weight: f64,            // Weight for goal achievement reward
    pub energy_weight: f64,          // Weight for energy efficiency penalty
    pub collision_threshold: f64,    // Distance below which collision occurs
    pub goal_threshold: f64,         // Distance within which goal is reached
}

impl RewardConfig {
    pub fn default_formation() -> Self {
        Self {
            formation_weight: 1.0,
            collision_weight: 10.0,
            goal_weight: 5.0,
            energy_weight: 0.1,
            collision_threshold: 0.5,
            goal_threshold: 0.2,
        }
    }

    pub fn heavy_collision_penalty() -> Self {
        Self {
            collision_weight: 50.0,
            ..Self::default_formation()
        }
    }

    pub fn goal_oriented() -> Self {
        Self {
            goal_weight: 10.0,
            formation_weight: 0.5,
            ..Self::default_formation()
        }
    }
}

/// Formation reward computation
pub struct FormationReward {
    pub desired_positions: Vec<Point3D>,
    pub tolerance: f64,
}

impl FormationReward {
    pub fn new(desired_positions: Vec<Point3D>, tolerance: f64) -> Self {
        Self {
            desired_positions,
            tolerance,
        }
    }

    /// Compute formation error (0 if perfect, increases with distance)
    pub fn compute_formation_error(&self, current_positions: &[Point3D]) -> f64 {
        if current_positions.len() != self.desired_positions.len() {
            return 1000.0; // Large penalty for size mismatch
        }

        let mut total_error = 0.0;

        for (current, desired) in current_positions.iter().zip(self.desired_positions.iter()) {
            let dx = current.x - desired.x;
            let dy = current.y - desired.y;
            let dz = current.z - desired.z;
            let distance = (dx * dx + dy * dy + dz * dz).sqrt();

            // Smooth penalty: 0 near tolerance, increases smoothly away from it
            if distance > self.tolerance {
                total_error += (distance - self.tolerance).powi(2);
            }
        }

        total_error / current_positions.len() as f64
    }

    /// Check if formation is maintained
    pub fn is_formation_valid(&self, current_positions: &[Point3D]) -> bool {
        if current_positions.len() != self.desired_positions.len() {
            return false;
        }

        current_positions
            .iter()
            .zip(self.desired_positions.iter())
            .all(|(current, desired)| {
                let dx = current.x - desired.x;
                let dy = current.y - desired.y;
                let dz = current.z - desired.z;
                let distance = (dx * dx + dy * dy + dz * dz).sqrt();
                distance <= self.tolerance
            })
    }
}

/// General reward function for multi-robot coordination
pub struct RewardFunction {
    pub config: RewardConfig,
    pub formation_reward: Option<FormationReward>,
    pub goal: Option<Point3D>,
}

impl RewardFunction {
    pub fn new(config: RewardConfig) -> Self {
        Self {
            config,
            formation_reward: None,
            goal: None,
        }
    }

    pub fn with_formation(mut self, formation: FormationReward) -> Self {
        self.formation_reward = Some(formation);
        self
    }

    pub fn with_goal(mut self, goal: Point3D) -> Self {
        self.goal = Some(goal);
        self
    }

    /// Compute formation error penalty
    pub fn formation_penalty(&self, positions: &[Point3D]) -> f64 {
        if let Some(ref formation) = self.formation_reward {
            let error = formation.compute_formation_error(positions);
            -self.config.formation_weight * error
        } else {
            0.0
        }
    }

    /// Compute collision penalty
    pub fn collision_penalty(&self, positions: &[Point3D]) -> f64 {
        let mut penalty = 0.0;
        let threshold = self.config.collision_threshold;

        for i in 0..positions.len() {
            for j in (i + 1)..positions.len() {
                let dx = positions[i].x - positions[j].x;
                let dy = positions[i].y - positions[j].y;
                let dz = positions[i].z - positions[j].z;
                let distance = (dx * dx + dy * dy + dz * dz).sqrt();

                if distance < threshold {
                    // Strong penalty for collisions, exponential as distance decreases
                    let collision_severity = (threshold - distance).powi(2);
                    penalty -= self.config.collision_weight * collision_severity;
                }
            }
        }

        penalty
    }

    /// Compute goal achievement reward
    pub fn goal_reward(&self, positions: &[Point3D]) -> f64 {
        if let Some(goal) = self.goal {
            // Compute centroid
            let n = positions.len() as f64;
            let centroid_x: f64 = positions.iter().map(|p| p.x).sum::<f64>() / n;
            let centroid_y: f64 = positions.iter().map(|p| p.y).sum::<f64>() / n;
            let centroid_z: f64 = positions.iter().map(|p| p.z).sum::<f64>() / n;

            let dx = centroid_x - goal.x;
            let dy = centroid_y - goal.y;
            let dz = centroid_z - goal.z;
            let distance = (dx * dx + dy * dy + dz * dz).sqrt();

            if distance < self.config.goal_threshold {
                // Goal reached!
                self.config.goal_weight * 10.0
            } else {
                // Reward based on proximity (inverse distance)
                let proximity_reward = -distance; // Negative distance as reward (closer = better)
                self.config.goal_weight * proximity_reward
            }
        } else {
            0.0
        }
    }

    /// Compute energy efficiency penalty
    pub fn energy_penalty(&self, velocities: &[(f64, f64, f64)]) -> f64 {
        let mut kinetic_energy = 0.0;

        for (vx, vy, vz) in velocities {
            let speed_squared = vx * vx + vy * vy + vz * vz;
            kinetic_energy += speed_squared;
        }

        // Penalize high-speed motion
        -self.config.energy_weight * kinetic_energy / velocities.len() as f64
    }

    /// Compute total reward
    pub fn compute_total_reward(
        &self,
        positions: &[Point3D],
        velocities: &[(f64, f64, f64)],
    ) -> f64 {
        let formation = self.formation_penalty(positions);
        let collision = self.collision_penalty(positions);
        let goal = self.goal_reward(positions);
        let energy = self.energy_penalty(velocities);

        formation + collision + goal + energy
    }

    /// Compute reward with breakdown
    pub fn compute_reward_breakdown(
        &self,
        positions: &[Point3D],
        velocities: &[(f64, f64, f64)],
    ) -> RewardBreakdown {
        let formation = self.formation_penalty(positions);
        let collision = self.collision_penalty(positions);
        let goal = self.goal_reward(positions);
        let energy = self.energy_penalty(velocities);

        RewardBreakdown {
            formation,
            collision,
            goal,
            energy,
            total: formation + collision + goal + energy,
        }
    }
}

/// Detailed reward breakdown for analysis
#[derive(Debug, Clone)]
pub struct RewardBreakdown {
    pub formation: f64,
    pub collision: f64,
    pub goal: f64,
    pub energy: f64,
    pub total: f64,
}

impl RewardBreakdown {
    pub fn max_component(&self) -> f64 {
        self.formation
            .max(self.collision)
            .max(self.goal)
            .max(self.energy)
    }

    pub fn min_component(&self) -> f64 {
        self.formation
            .min(self.collision)
            .min(self.goal)
            .min(self.energy)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reward_config_default() {
        let config = RewardConfig::default_formation();
        assert_eq!(config.formation_weight, 1.0);
        assert_eq!(config.collision_weight, 10.0);
    }

    #[test]
    fn test_reward_config_heavy_penalty() {
        let config = RewardConfig::heavy_collision_penalty();
        assert_eq!(config.collision_weight, 50.0);
    }

    #[test]
    fn test_formation_error_perfect() {
        let desired = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
        ];
        let formation = FormationReward::new(desired.clone(), 0.1);

        let current = desired.clone();
        let error = formation.compute_formation_error(&current);

        assert!((error - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_formation_error_offset() {
        let desired = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
        ];
        let formation = FormationReward::new(desired, 0.1);

        let current = vec![
            Point3D { x: 0.0, y: 0.5, z: 0.0 },
            Point3D { x: 1.0, y: 0.5, z: 0.0 },
        ];
        let error = formation.compute_formation_error(&current);

        // Both robots are 0.5m off, exceeds tolerance 0.1
        // Error = (0.5 - 0.1)^2 + (0.5 - 0.1)^2 / 2 = 0.32
        assert!(error > 0.0);
    }

    #[test]
    fn test_formation_valid() {
        let desired = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
        ];
        let formation = FormationReward::new(desired.clone(), 0.2);

        // Slightly offset (within tolerance)
        let current = vec![
            Point3D { x: 0.05, y: 0.0, z: 0.0 },
            Point3D { x: 1.05, y: 0.0, z: 0.0 },
        ];
        assert!(formation.is_formation_valid(&current));
    }

    #[test]
    fn test_formation_invalid() {
        let desired = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
        ];
        let formation = FormationReward::new(desired, 0.1);

        // Far offset (exceeds tolerance)
        let current = vec![
            Point3D { x: 0.5, y: 0.0, z: 0.0 },
            Point3D { x: 1.5, y: 0.0, z: 0.0 },
        ];
        assert!(!formation.is_formation_valid(&current));
    }

    #[test]
    fn test_collision_penalty_safe() {
        let config = RewardConfig::default_formation();
        let reward_fn = RewardFunction::new(config);

        let positions = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 2.0, y: 0.0, z: 0.0 }, // 2m apart, safe
        ];

        let penalty = reward_fn.collision_penalty(&positions);
        assert_eq!(penalty, 0.0); // No collision
    }

    #[test]
    fn test_collision_penalty_colliding() {
        let config = RewardConfig::default_formation();
        let reward_fn = RewardFunction::new(config);

        let positions = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 0.2, y: 0.0, z: 0.0 }, // 0.2m apart, collision!
        ];

        let penalty = reward_fn.collision_penalty(&positions);
        assert!(penalty < 0.0); // Negative reward (penalty)
    }

    #[test]
    fn test_goal_reward_at_goal() {
        let config = RewardConfig::default_formation();
        let goal = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let reward_fn = RewardFunction::new(config).with_goal(goal);

        let positions = vec![
            Point3D { x: 0.1, y: 0.0, z: 0.0 },
            Point3D { x: -0.1, y: 0.0, z: 0.0 }, // Centroid near goal
        ];

        let reward = reward_fn.goal_reward(&positions);
        assert!(reward > 0.0); // Goal achievement bonus
    }

    #[test]
    fn test_goal_reward_far_from_goal() {
        let config = RewardConfig::default_formation();
        let goal = Point3D { x: 10.0, y: 10.0, z: 10.0 };
        let reward_fn = RewardFunction::new(config).with_goal(goal);

        let positions = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
        ];

        let reward = reward_fn.goal_reward(&positions);
        assert!(reward < 0.0); // Penalty for being far from goal
    }

    #[test]
    fn test_energy_penalty_high_speed() {
        let config = RewardConfig::default_formation();
        let reward_fn = RewardFunction::new(config);

        let velocities = vec![(1.0, 1.0, 1.0), (1.0, 1.0, 1.0)];
        let penalty = reward_fn.energy_penalty(&velocities);

        assert!(penalty < 0.0); // Penalty for high energy
    }

    #[test]
    fn test_energy_penalty_low_speed() {
        let config = RewardConfig::default_formation();
        let reward_fn = RewardFunction::new(config);

        let velocities = vec![(0.1, 0.1, 0.1), (0.1, 0.1, 0.1)];
        let penalty = reward_fn.energy_penalty(&velocities);

        let high_penalty = reward_fn.energy_penalty(&vec![(1.0, 1.0, 1.0), (1.0, 1.0, 1.0)]);

        // Low-speed penalty should be higher (less negative)
        assert!(penalty > high_penalty);
    }

    #[test]
    fn test_reward_breakdown() {
        let config = RewardConfig::default_formation();
        let desired = vec![Point3D { x: 0.0, y: 0.0, z: 0.0 }];
        let formation = FormationReward::new(desired, 0.1);
        let reward_fn = RewardFunction::new(config)
            .with_formation(formation)
            .with_goal(Point3D { x: 0.0, y: 0.0, z: 0.0 });

        let positions = vec![Point3D { x: 0.05, y: 0.0, z: 0.0 }];
        let velocities = vec![(0.1, 0.0, 0.0)];

        let breakdown = reward_fn.compute_reward_breakdown(&positions, &velocities);

        assert_eq!(breakdown.formation + breakdown.collision + breakdown.goal + breakdown.energy, breakdown.total);
        assert!(breakdown.total > f64::NEG_INFINITY);
    }

    #[test]
    fn test_total_reward_computation() {
        let config = RewardConfig::default_formation();
        let reward_fn = RewardFunction::new(config);

        let positions = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
        ];
        let velocities = vec![(0.5, 0.0, 0.0), (0.5, 0.0, 0.0)];

        let total = reward_fn.compute_total_reward(&positions, &velocities);
        assert!(total < f64::INFINITY);
    }

    #[test]
    fn test_reward_breakdown_max_min() {
        let config = RewardConfig::default_formation();
        let reward_fn = RewardFunction::new(config);

        let positions = vec![Point3D { x: 0.0, y: 0.0, z: 0.0 }];
        let velocities = vec![(0.1, 0.0, 0.0)];

        let breakdown = reward_fn.compute_reward_breakdown(&positions, &velocities);

        let max = breakdown.max_component();
        let min = breakdown.min_component();

        assert!(max >= breakdown.formation);
        assert!(max >= breakdown.collision);
        assert!(min <= breakdown.formation);
        assert!(min <= breakdown.collision);
    }
}
