//! Phase 27 Task 1: Flocking Behaviors
//! Reynolds flocking rules for swarm behavior

use crate::clifford_algebra::spatialization::Point3D;

/// Reynolds flocking parameters
#[derive(Debug, Clone)]
pub struct FlockingParameters {
    pub separation_distance: f64,   // Min distance to neighbors (m)
    pub separation_gain: f64,       // Repulsion strength
    pub alignment_gain: f64,        // Heading matching strength
    pub cohesion_gain: f64,         // Attraction strength
    pub perception_radius: f64,     // Sensor range (m)
    pub max_speed: f64,             // Speed limit (m/s)
}

impl FlockingParameters {
    pub fn default() -> Self {
        Self {
            separation_distance: 0.5,
            separation_gain: 1.5,
            alignment_gain: 1.0,
            cohesion_gain: 1.0,
            perception_radius: 2.0,
            max_speed: 1.0,
        }
    }

    pub fn tight_formation() -> Self {
        Self {
            separation_distance: 0.3,
            separation_gain: 2.0,
            alignment_gain: 1.5,
            cohesion_gain: 1.2,
            perception_radius: 1.5,
            max_speed: 0.5,
        }
    }

    pub fn loose_swarm() -> Self {
        Self {
            separation_distance: 1.0,
            separation_gain: 1.0,
            alignment_gain: 0.7,
            cohesion_gain: 0.8,
            perception_radius: 5.0,
            max_speed: 2.0,
        }
    }
}

/// Flocking controller implementing Reynolds rules
pub struct FlockingController {
    params: FlockingParameters,
}

impl FlockingController {
    pub fn new(params: FlockingParameters) -> Self {
        Self { params }
    }

    /// Compute flocking velocity for a robot
    pub fn compute_flocking_velocity(
        &self,
        robot_index: usize,
        robot_position: Point3D,
        robot_velocity: (f64, f64, f64),
        all_positions: &[Point3D],
        all_velocities: &[(f64, f64, f64)],
    ) -> (f64, f64, f64) {
        // Find neighbors within perception radius
        let neighbors = self.find_neighbors(robot_position, robot_index, all_positions);

        if neighbors.is_empty() {
            return robot_velocity; // No neighbors, maintain current velocity
        }

        // Rule 1: Separation (avoid crowding)
        let separation = self.compute_separation(robot_position, &neighbors, all_positions);

        // Rule 2: Alignment (match heading)
        let alignment = self.compute_alignment(&neighbors, all_velocities);

        // Rule 3: Cohesion (move toward center)
        let cohesion = self.compute_cohesion(robot_position, &neighbors, all_positions);

        // Combine rules
        let vx = separation.0 + alignment.0 + cohesion.0;
        let vy = separation.1 + alignment.1 + cohesion.1;
        let vz = separation.2 + alignment.2 + cohesion.2;

        // Limit speed
        self.limit_speed((vx, vy, vz))
    }

    fn find_neighbors(
        &self,
        position: Point3D,
        robot_index: usize,
        all_positions: &[Point3D],
    ) -> Vec<usize> {
        let mut neighbors = Vec::new();

        for (i, pos) in all_positions.iter().enumerate() {
            if i == robot_index {
                continue;
            }

            let dist = ((pos.x - position.x).powi(2)
                + (pos.y - position.y).powi(2)
                + (pos.z - position.z).powi(2))
            .sqrt();

            if dist < self.params.perception_radius && dist > 0.01 {
                neighbors.push(i);
            }
        }

        neighbors
    }

    fn compute_separation(
        &self,
        position: Point3D,
        neighbors: &[usize],
        all_positions: &[Point3D],
    ) -> (f64, f64, f64) {
        let mut sep_x = 0.0;
        let mut sep_y = 0.0;
        let mut sep_z = 0.0;

        for &i in neighbors {
            let neighbor_pos = all_positions[i];
            let dx = position.x - neighbor_pos.x;
            let dy = position.y - neighbor_pos.y;
            let dz = position.z - neighbor_pos.z;
            let dist = (dx * dx + dy * dy + dz * dz).sqrt();

            if dist < self.params.separation_distance && dist > 0.01 {
                // Repel proportional to inverse distance
                let repel = 1.0 / (dist + 0.01); // Avoid division by zero
                sep_x += dx * repel;
                sep_y += dy * repel;
                sep_z += dz * repel;
            }
        }

        (
            sep_x * self.params.separation_gain,
            sep_y * self.params.separation_gain,
            sep_z * self.params.separation_gain,
        )
    }

    fn compute_alignment(
        &self,
        neighbors: &[usize],
        all_velocities: &[(f64, f64, f64)],
    ) -> (f64, f64, f64) {
        if neighbors.is_empty() {
            return (0.0, 0.0, 0.0);
        }

        let mut avg_vx = 0.0;
        let mut avg_vy = 0.0;
        let mut avg_vz = 0.0;

        for &i in neighbors {
            let vel = all_velocities[i];
            avg_vx += vel.0;
            avg_vy += vel.1;
            avg_vz += vel.2;
        }

        let n = neighbors.len() as f64;
        (
            (avg_vx / n) * self.params.alignment_gain,
            (avg_vy / n) * self.params.alignment_gain,
            (avg_vz / n) * self.params.alignment_gain,
        )
    }

    fn compute_cohesion(
        &self,
        position: Point3D,
        neighbors: &[usize],
        all_positions: &[Point3D],
    ) -> (f64, f64, f64) {
        if neighbors.is_empty() {
            return (0.0, 0.0, 0.0);
        }

        let mut avg_x = 0.0;
        let mut avg_y = 0.0;
        let mut avg_z = 0.0;

        for &i in neighbors {
            let pos = all_positions[i];
            avg_x += pos.x;
            avg_y += pos.y;
            avg_z += pos.z;
        }

        let n = neighbors.len() as f64;
        let center_x = avg_x / n;
        let center_y = avg_y / n;
        let center_z = avg_z / n;

        // Move toward center of neighbors
        (
            (center_x - position.x) * self.params.cohesion_gain,
            (center_y - position.y) * self.params.cohesion_gain,
            (center_z - position.z) * self.params.cohesion_gain,
        )
    }

    fn limit_speed(&self, velocity: (f64, f64, f64)) -> (f64, f64, f64) {
        let speed =
            (velocity.0 * velocity.0 + velocity.1 * velocity.1 + velocity.2 * velocity.2).sqrt();

        if speed > self.params.max_speed && speed > 0.001 {
            let scale = self.params.max_speed / speed;
            (velocity.0 * scale, velocity.1 * scale, velocity.2 * scale)
        } else {
            velocity
        }
    }

    /// Get perception radius
    pub fn perception_radius(&self) -> f64 {
        self.params.perception_radius
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_separation() {
        let params = FlockingParameters::default();
        let controller = FlockingController::new(params);

        let position = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let all_positions = vec![
            position,
            Point3D {
                x: 0.2,
                y: 0.0,
                z: 0.0,
            }, // Too close
        ];

        let neighbors = vec![1];
        let (sep_x, _sep_y, _sep_z) =
            controller.compute_separation(position, &neighbors, &all_positions);

        // Should repel in -x direction
        assert!(sep_x < 0.0);
    }

    #[test]
    fn test_alignment() {
        let params = FlockingParameters::default();
        let controller = FlockingController::new(params);

        let all_velocities = vec![
            (0.0, 0.0, 0.0),
            (1.0, 0.0, 0.0),
            (1.0, 0.0, 0.0),
        ];

        let neighbors = vec![1, 2];
        let (align_x, _align_y, _align_z) = controller.compute_alignment(&neighbors, &all_velocities);

        // Average velocity is (1.0, 0.0, 0.0)
        assert!((align_x - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_cohesion() {
        let params = FlockingParameters::default();
        let controller = FlockingController::new(params);

        let position = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let all_positions = vec![
            position,
            Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 1.0,
                y: 1.0,
                z: 0.0,
            },
        ];

        let neighbors = vec![1, 2];
        let (coh_x, coh_y, _coh_z) = controller.compute_cohesion(position, &neighbors, &all_positions);

        // Center of neighbors at (1.0, 0.5, 0.0)
        assert!(coh_x > 0.0); // Attract toward +x
        assert!(coh_y > 0.0); // Attract toward +y
    }

    #[test]
    fn test_speed_limiting() {
        let params = FlockingParameters {
            max_speed: 1.0,
            ..FlockingParameters::default()
        };
        let controller = FlockingController::new(params);

        let velocity = (2.0, 0.0, 0.0); // Exceeds max_speed
        let limited = controller.limit_speed(velocity);

        let speed = (limited.0 * limited.0 + limited.1 * limited.1 + limited.2 * limited.2).sqrt();
        assert!((speed - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_flocking_parameters() {
        let tight = FlockingParameters::tight_formation();
        let loose = FlockingParameters::loose_swarm();

        // Tight formation should be more restrictive
        assert!(tight.separation_distance < loose.separation_distance);
        assert!(tight.max_speed < loose.max_speed);
    }
}
