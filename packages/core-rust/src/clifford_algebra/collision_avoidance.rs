//! Collision Avoidance: Potential Field Methods
//! Phase 26 Task 1 - Advanced Robot Control

use crate::clifford_algebra::spatialization::{Point3D, Sphere, BoundingBox};
use crate::clifford_algebra::robot_configuration::RobotArm;
use std::f64::consts::PI;

/// Obstacle representation in the workspace
#[derive(Debug, Clone)]
pub enum Obstacle {
    /// Spherical obstacle
    Sphere { center: Point3D, radius: f64 },
    /// Cylindrical obstacle (axis-aligned Z)
    Cylinder { center: Point3D, radius: f64, height: f64 },
    /// Box obstacle
    Box { center: Point3D, width: f64, height: f64, depth: f64 },
}

impl Obstacle {
    /// Compute distance from point to obstacle surface
    pub fn distance_to_point(&self, point: &Point3D) -> f64 {
        match self {
            Obstacle::Sphere { center, radius } => {
                let dist = center.distance_to(point);
                (dist - radius).max(0.0)
            }
            Obstacle::Cylinder { center, radius, height } => {
                let dx = point.x - center.x;
                let dy = point.y - center.y;
                let dz = (point.z - center.z).abs();

                let horiz_dist = (dx * dx + dy * dy).sqrt();
                let z_excess = (dz - height / 2.0).max(0.0);

                if horiz_dist <= *radius && dz <= height / 2.0 {
                    // Inside cylinder
                    (radius - horiz_dist).min(height / 2.0 - dz)
                } else if horiz_dist > *radius && dz <= height / 2.0 {
                    // Outside in radial direction
                    horiz_dist - radius
                } else if horiz_dist <= *radius && dz > height / 2.0 {
                    // Outside in vertical direction
                    z_excess
                } else {
                    // Outside corner
                    ((horiz_dist - radius).powi(2) + z_excess.powi(2)).sqrt()
                }
            }
            Obstacle::Box { center, width, height, depth } => {
                let dx = (point.x - center.x).abs() - width / 2.0;
                let dy = (point.y - center.y).abs() - height / 2.0;
                let dz = (point.z - center.z).abs() - depth / 2.0;

                let outside_x = dx.max(0.0);
                let outside_y = dy.max(0.0);
                let outside_z = dz.max(0.0);

                (outside_x.powi(2) + outside_y.powi(2) + outside_z.powi(2)).sqrt()
            }
        }
    }

    /// Get repulsive force direction from obstacle
    pub fn repulsive_force(&self, point: &Point3D, influence_radius: f64) -> (f64, f64, f64) {
        let dist = self.distance_to_point(point);

        if dist > influence_radius {
            return (0.0, 0.0, 0.0);
        }

        // Direction away from obstacle
        let direction = match self {
            Obstacle::Sphere { center, .. } => {
                let dx = point.x - center.x;
                let dy = point.y - center.y;
                let dz = point.z - center.z;
                let mag = (dx * dx + dy * dy + dz * dz).sqrt();
                if mag > 1e-6 {
                    (dx / mag, dy / mag, dz / mag)
                } else {
                    (1.0, 0.0, 0.0)
                }
            }
            Obstacle::Cylinder { center, .. } => {
                let dx = point.x - center.x;
                let dy = point.y - center.y;
                let horiz_mag = (dx * dx + dy * dy).sqrt();
                if horiz_mag > 1e-6 {
                    (dx / horiz_mag, dy / horiz_mag, 0.0)
                } else {
                    (1.0, 0.0, 0.0)
                }
            }
            Obstacle::Box { center, width, height, depth } => {
                let dx = point.x - center.x;
                let dy = point.y - center.y;
                let dz = point.z - center.z;
                let mag = (dx * dx + dy * dy + dz * dz).sqrt();
                if mag > 1e-6 {
                    (dx / mag, dy / mag, dz / mag)
                } else {
                    (1.0, 0.0, 0.0)
                }
            }
        };

        // Magnitude decreases with distance (inverse square)
        let magnitude = (1.0 - dist / influence_radius).powi(2);
        (
            direction.0 * magnitude,
            direction.1 * magnitude,
            direction.2 * magnitude,
        )
    }
}

/// Potential field collision avoidance
pub struct PotentialFieldController {
    obstacles: Vec<Obstacle>,
    attractive_gain: f64,          // Weight for goal attraction
    repulsive_gain: f64,            // Weight for obstacle repulsion
    influence_radius: f64,          // Radius of repulsive field effect
    safety_margin: f64,             // Minimum distance to maintain
}

impl PotentialFieldController {
    /// Create new potential field controller
    pub fn new(attractive_gain: f64, repulsive_gain: f64, influence_radius: f64) -> Self {
        PotentialFieldController {
            obstacles: vec![],
            attractive_gain,
            repulsive_gain,
            influence_radius,
            safety_margin: 0.05,  // 5cm default
        }
    }

    /// Add obstacle to workspace
    pub fn add_obstacle(&mut self, obstacle: Obstacle) {
        self.obstacles.push(obstacle);
    }

    /// Clear all obstacles
    pub fn clear_obstacles(&mut self) {
        self.obstacles.clear();
    }

    /// Compute artificial potential for given position
    pub fn compute_potential(&self, position: &Point3D, goal: &Point3D) -> f64 {
        // Attractive potential: grows with distance from goal
        let attractive = self.attractive_gain * position.distance_to(goal).powi(2) / 2.0;

        // Repulsive potential: grows as obstacles approach
        let mut repulsive = 0.0;
        for obstacle in &self.obstacles {
            let dist = obstacle.distance_to_point(position);
            if dist < self.influence_radius {
                let safe_dist = (dist - self.safety_margin).max(0.01);
                repulsive += self.repulsive_gain * (1.0 / safe_dist - 1.0 / self.influence_radius).powi(2) / 2.0;
            }
        }

        attractive + repulsive
    }

    /// Compute artificial force gradient at position
    pub fn compute_force(&self, position: &Point3D, goal: &Point3D) -> (f64, f64, f64) {
        // Attractive force: points toward goal
        let dx = goal.x - position.x;
        let dy = goal.y - position.y;
        let dz = goal.z - position.z;
        let dist_to_goal = (dx * dx + dy * dy + dz * dz).sqrt();

        let attractive_force = if dist_to_goal > 1e-6 {
            let unit_x = dx / dist_to_goal;
            let unit_y = dy / dist_to_goal;
            let unit_z = dz / dist_to_goal;
            (
                self.attractive_gain * unit_x,
                self.attractive_gain * unit_y,
                self.attractive_gain * unit_z,
            )
        } else {
            (0.0, 0.0, 0.0)
        };

        // Repulsive forces: point away from obstacles
        let mut repulsive_force = (0.0, 0.0, 0.0);
        for obstacle in &self.obstacles {
            let (fx, fy, fz) = obstacle.repulsive_force(position, self.influence_radius);
            repulsive_force.0 += self.repulsive_gain * fx;
            repulsive_force.1 += self.repulsive_gain * fy;
            repulsive_force.2 += self.repulsive_gain * fz;
        }

        (
            attractive_force.0 + repulsive_force.0,
            attractive_force.1 + repulsive_force.1,
            attractive_force.2 + repulsive_force.2,
        )
    }

    /// Check if configuration is collision-free
    pub fn is_collision_free(&self, position: &Point3D, robot_radius: f64) -> bool {
        for obstacle in &self.obstacles {
            let dist = obstacle.distance_to_point(position);
            if dist < robot_radius + self.safety_margin {
                return false;
            }
        }
        true
    }

    /// Check trajectory for collisions (check intermediate points)
    pub fn is_trajectory_collision_free(
        &self,
        start: &Point3D,
        goal: &Point3D,
        robot_radius: f64,
        num_samples: usize,
    ) -> bool {
        for i in 0..=num_samples {
            let t = i as f64 / num_samples as f64;
            let point = Point3D {
                x: start.x + t * (goal.x - start.x),
                y: start.y + t * (goal.y - start.y),
                z: start.z + t * (goal.z - start.z),
            };

            if !self.is_collision_free(&point, robot_radius) {
                return false;
            }
        }
        true
    }

    /// Find collision-free direction from current position toward goal
    pub fn compute_collision_free_direction(
        &self,
        position: &Point3D,
        goal: &Point3D,
        robot_radius: f64,
        max_iterations: usize,
    ) -> Result<(f64, f64, f64), String> {
        let mut current = position.clone();

        for _ in 0..max_iterations {
            if current.distance_to(goal) < 0.01 {
                return Ok((0.0, 0.0, 0.0)); // At goal
            }

            let (force_x, force_y, force_z) = self.compute_force(&current, goal);
            let force_mag = (force_x * force_x + force_y * force_y + force_z * force_z).sqrt();

            if force_mag < 1e-6 {
                return Ok((0.0, 0.0, 0.0)); // No force (local minimum)
            }

            // Normalize force
            let unit_x = force_x / force_mag;
            let unit_y = force_y / force_mag;
            let unit_z = force_z / force_mag;

            // Take small step in force direction
            let step_size = 0.01;
            let next_x = current.x + unit_x * step_size;
            let next_y = current.y + unit_y * step_size;
            let next_z = current.z + unit_z * step_size;

            let next_point = Point3D { x: next_x, y: next_y, z: next_z };

            if self.is_collision_free(&next_point, robot_radius) {
                current = next_point;
            } else {
                // Obstacle in the way - try perpendicular direction
                break;
            }
        }

        Ok((
            (goal.x - current.x) / current.distance_to(goal).max(1e-6),
            (goal.y - current.y) / current.distance_to(goal).max(1e-6),
            (goal.z - current.z) / current.distance_to(goal).max(1e-6),
        ))
    }
}

/// Collision predictor for trajectory
pub struct CollisionPredictor {
    robot_radius: f64,
}

impl CollisionPredictor {
    /// Create new collision predictor
    pub fn new(robot_radius: f64) -> Self {
        CollisionPredictor { robot_radius }
    }

    /// Predict collision time along trajectory
    pub fn predict_collision_time(
        &self,
        start: &Point3D,
        goal: &Point3D,
        velocity: f64,
        obstacles: &[Obstacle],
    ) -> Option<f64> {
        let distance = start.distance_to(goal);
        let num_samples = (distance / 0.01).ceil() as usize;

        for i in 0..num_samples {
            let t = i as f64 / num_samples as f64;
            let point = Point3D {
                x: start.x + t * (goal.x - start.x),
                y: start.y + t * (goal.y - start.y),
                z: start.z + t * (goal.z - start.z),
            };

            for obstacle in obstacles {
                let dist = obstacle.distance_to_point(&point);
                if dist < self.robot_radius {
                    let collision_distance = t * distance;
                    return Some(collision_distance / velocity.max(0.001));
                }
            }
        }

        None
    }

    /// Safety margin to obstacle
    pub fn compute_safety_margin(
        &self,
        position: &Point3D,
        obstacles: &[Obstacle],
    ) -> f64 {
        let mut min_dist = f64::INFINITY;
        for obstacle in obstacles {
            let dist = obstacle.distance_to_point(position);
            min_dist = min_dist.min(dist);
        }
        (min_dist - self.robot_radius).max(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sphere_obstacle_distance() {
        let sphere = Obstacle::Sphere {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            radius: 1.0,
        };

        let point = Point3D { x: 2.0, y: 0.0, z: 0.0 };
        assert!((sphere.distance_to_point(&point) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_sphere_obstacle_inside() {
        let sphere = Obstacle::Sphere {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            radius: 1.0,
        };

        let point = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        assert!(sphere.distance_to_point(&point) < 1e-10);
    }

    #[test]
    fn test_cylinder_obstacle_distance() {
        let cylinder = Obstacle::Cylinder {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            radius: 1.0,
            height: 2.0,
        };

        let point = Point3D { x: 2.0, y: 0.0, z: 0.0 };
        assert!((cylinder.distance_to_point(&point) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_box_obstacle_distance() {
        let bbox = Obstacle::Box {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            width: 2.0,
            height: 2.0,
            depth: 2.0,
        };

        let point = Point3D { x: 2.0, y: 0.0, z: 0.0 };
        assert!((bbox.distance_to_point(&point) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_potential_field_controller_creation() {
        let controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        assert_eq!(controller.obstacles.len(), 0);
    }

    #[test]
    fn test_add_obstacle() {
        let mut controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        controller.add_obstacle(Obstacle::Sphere {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            radius: 0.5,
        });
        assert_eq!(controller.obstacles.len(), 1);
    }

    #[test]
    fn test_clear_obstacles() {
        let mut controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        controller.add_obstacle(Obstacle::Sphere {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            radius: 0.5,
        });
        controller.clear_obstacles();
        assert_eq!(controller.obstacles.len(), 0);
    }

    #[test]
    fn test_compute_potential_at_goal() {
        let controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        let position = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let goal = Point3D { x: 0.0, y: 0.0, z: 0.0 };

        let potential = controller.compute_potential(&position, &goal);
        assert!(potential < 1e-6);
    }

    #[test]
    fn test_compute_potential_away_from_goal() {
        let controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        let position = Point3D { x: 1.0, y: 0.0, z: 0.0 };
        let goal = Point3D { x: 0.0, y: 0.0, z: 0.0 };

        let potential = controller.compute_potential(&position, &goal);
        assert!(potential > 0.0);
    }

    #[test]
    fn test_compute_force_toward_goal() {
        let controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        let position = Point3D { x: 1.0, y: 0.0, z: 0.0 };
        let goal = Point3D { x: 0.0, y: 0.0, z: 0.0 };

        let (fx, fy, fz) = controller.compute_force(&position, &goal);
        assert!(fx < 0.0); // Force points toward goal (negative x)
        assert!(fy.abs() < 1e-10);
        assert!(fz.abs() < 1e-10);
    }

    #[test]
    fn test_is_collision_free_empty_space() {
        let controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        let position = Point3D { x: 0.0, y: 0.0, z: 0.0 };

        assert!(controller.is_collision_free(&position, 0.1));
    }

    #[test]
    fn test_is_collision_free_with_obstacle() {
        let mut controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        controller.add_obstacle(Obstacle::Sphere {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            radius: 0.5,
        });

        let position = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        assert!(!controller.is_collision_free(&position, 0.1));
    }

    #[test]
    fn test_is_trajectory_collision_free() {
        let controller = PotentialFieldController::new(1.0, 10.0, 1.0);
        let start = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let goal = Point3D { x: 1.0, y: 0.0, z: 0.0 };

        assert!(controller.is_trajectory_collision_free(&start, &goal, 0.05, 10));
    }

    #[test]
    fn test_collision_predictor_creation() {
        let predictor = CollisionPredictor::new(0.1);
        assert!((predictor.robot_radius - 0.1).abs() < 1e-10);
    }

    #[test]
    fn test_compute_safety_margin_empty() {
        let predictor = CollisionPredictor::new(0.1);
        let position = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let obstacles = vec![];

        let margin = predictor.compute_safety_margin(&position, &obstacles);
        assert!(margin > 1000.0); // Very large (no obstacles)
    }

    #[test]
    fn test_compute_safety_margin_with_obstacle() {
        let predictor = CollisionPredictor::new(0.1);
        let position = Point3D { x: 2.0, y: 0.0, z: 0.0 };
        let obstacles = vec![Obstacle::Sphere {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            radius: 1.0,
        }];

        let margin = predictor.compute_safety_margin(&position, &obstacles);
        assert!(margin > 0.0);
        assert!(margin < 1.0);
    }

    #[test]
    fn test_collision_predictor_predict_no_collision() {
        let predictor = CollisionPredictor::new(0.1);
        let start = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let goal = Point3D { x: 1.0, y: 0.0, z: 0.0 };
        let obstacles = vec![];

        let collision_time = predictor.predict_collision_time(&start, &goal, 1.0, &obstacles);
        assert!(collision_time.is_none());
    }

    #[test]
    fn test_collision_predictor_predict_collision() {
        let predictor = CollisionPredictor::new(0.1);
        let start = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let goal = Point3D { x: 1.0, y: 0.0, z: 0.0 };
        let obstacles = vec![Obstacle::Sphere {
            center: Point3D { x: 0.5, y: 0.0, z: 0.0 },
            radius: 0.3,
        }];

        let collision_time = predictor.predict_collision_time(&start, &goal, 1.0, &obstacles);
        assert!(collision_time.is_some());
    }
}
