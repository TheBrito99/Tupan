//! Phase 27 Task 2: Swarm Coordination
//! Multi-robot coordination with formation, flocking, and hybrid modes

use crate::clifford_algebra::{
    formation_control::{FormationController, FormationType},
    flocking_behaviors::{FlockingController, FlockingParameters},
    robot_configuration::RobotArm,
    spatialization::Point3D,
};

/// Swarm of robots with coordinated control
pub struct SwarmCoordinator {
    robots: Vec<RobotArm>,
    formation_controller: Option<FormationController>,
    flocking_controller: Option<FlockingController>,
    control_mode: SwarmControlMode,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SwarmControlMode {
    Formation,      // Maintain geometric formation
    Flocking,       // Natural flocking behavior
    Hybrid,         // Formation + flocking combined
    Independent,    // No coordination
}

impl SwarmCoordinator {
    pub fn new(robots: Vec<RobotArm>, control_mode: SwarmControlMode) -> Self {
        Self {
            robots,
            formation_controller: None,
            flocking_controller: None,
            control_mode,
        }
    }

    pub fn set_formation(&mut self, formation_type: FormationType, leader_index: usize) {
        self.formation_controller = Some(FormationController::new(formation_type, leader_index));
    }

    pub fn set_flocking_params(&mut self, params: FlockingParameters, _world_bounds: f64) {
        self.flocking_controller = Some(FlockingController::new(params));
    }

    pub fn robot_count(&self) -> usize {
        self.robots.len()
    }

    pub fn get_robot(&self, index: usize) -> Option<&RobotArm> {
        self.robots.get(index)
    }

    pub fn control_mode(&self) -> &SwarmControlMode {
        &self.control_mode
    }

    pub fn set_control_mode(&mut self, mode: SwarmControlMode) {
        self.control_mode = mode;
    }

    pub fn robots(&self) -> &[RobotArm] {
        &self.robots
    }

    pub fn formation_controller(&self) -> Option<&FormationController> {
        self.formation_controller.as_ref()
    }

    /// Compute coordinated velocity commands for all robots
    pub fn compute_swarm_velocities(
        &self,
        positions: &[Point3D],
        velocities: &[(f64, f64, f64)],
        goal: Option<Point3D>,
    ) -> Vec<(f64, f64, f64)> {
        match self.control_mode {
            SwarmControlMode::Formation => {
                self.compute_formation_velocities(positions, goal)
            }
            SwarmControlMode::Flocking => {
                self.compute_flocking_velocities(positions, velocities)
            }
            SwarmControlMode::Hybrid => {
                self.compute_hybrid_velocities(positions, velocities, goal)
            }
            SwarmControlMode::Independent => {
                velocities.to_vec() // No coordination
            }
        }
    }

    fn compute_formation_velocities(
        &self,
        positions: &[Point3D],
        goal: Option<Point3D>,
    ) -> Vec<(f64, f64, f64)> {
        let formation = self
            .formation_controller
            .as_ref()
            .expect("Formation controller not set");

        let leader_position = goal.unwrap_or(positions[0]);

        positions
            .iter()
            .enumerate()
            .map(|(i, pos)| formation.compute_formation_control(i, *pos, leader_position))
            .collect()
    }

    fn compute_flocking_velocities(
        &self,
        positions: &[Point3D],
        velocities: &[(f64, f64, f64)],
    ) -> Vec<(f64, f64, f64)> {
        let flocking = self
            .flocking_controller
            .as_ref()
            .expect("Flocking controller not set");

        positions
            .iter()
            .enumerate()
            .map(|(i, pos)| {
                flocking.compute_flocking_velocity(i, *pos, velocities[i], positions, velocities)
            })
            .collect()
    }

    fn compute_hybrid_velocities(
        &self,
        positions: &[Point3D],
        velocities: &[(f64, f64, f64)],
        goal: Option<Point3D>,
    ) -> Vec<(f64, f64, f64)> {
        let formation_vels = self.compute_formation_velocities(positions, goal);
        let flocking_vels = self.compute_flocking_velocities(positions, velocities);

        // Weighted average (50% formation, 50% flocking)
        formation_vels
            .iter()
            .zip(flocking_vels.iter())
            .map(|(fv, flv)| {
                (
                    0.5 * fv.0 + 0.5 * flv.0,
                    0.5 * fv.1 + 0.5 * flv.1,
                    0.5 * fv.2 + 0.5 * flv.2,
                )
            })
            .collect()
    }

    /// Check if any robots are in collision
    pub fn check_inter_robot_collisions(
        &self,
        positions: &[Point3D],
        safety_radius: f64,
    ) -> Vec<(usize, usize)> {
        let mut collisions = Vec::new();

        for i in 0..positions.len() {
            for j in (i + 1)..positions.len() {
                let dist = ((positions[i].x - positions[j].x).powi(2)
                    + (positions[i].y - positions[j].y).powi(2)
                    + (positions[i].z - positions[j].z).powi(2))
                .sqrt();

                if dist < safety_radius {
                    collisions.push((i, j));
                }
            }
        }

        collisions
    }

    /// Get swarm centroid (geometric center)
    pub fn compute_swarm_centroid(&self, positions: &[Point3D]) -> Point3D {
        let n = positions.len() as f64;
        let sum_x: f64 = positions.iter().map(|p| p.x).sum();
        let sum_y: f64 = positions.iter().map(|p| p.y).sum();
        let sum_z: f64 = positions.iter().map(|p| p.z).sum();

        Point3D {
            x: sum_x / n,
            y: sum_y / n,
            z: sum_z / n,
        }
    }

    /// Compute swarm spread (max distance from centroid)
    pub fn compute_swarm_spread(&self, positions: &[Point3D]) -> f64 {
        let centroid = self.compute_swarm_centroid(positions);

        positions
            .iter()
            .map(|p| {
                ((p.x - centroid.x).powi(2)
                    + (p.y - centroid.y).powi(2)
                    + (p.z - centroid.z).powi(2))
                .sqrt()
            })
            .fold(0.0, f64::max)
    }

    /// Compute average inter-robot distance
    pub fn compute_average_spacing(&self, positions: &[Point3D]) -> f64 {
        if positions.len() < 2 {
            return 0.0;
        }

        let mut total_dist = 0.0;
        let mut count = 0;

        for i in 0..positions.len() {
            for j in (i + 1)..positions.len() {
                let dist = ((positions[i].x - positions[j].x).powi(2)
                    + (positions[i].y - positions[j].y).powi(2)
                    + (positions[i].z - positions[j].z).powi(2))
                .sqrt();
                total_dist += dist;
                count += 1;
            }
        }

        if count > 0 {
            total_dist / (count as f64)
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clifford_algebra::robot_configuration::{DHParameter, JointType, RobotJoint};

    fn create_test_robot() -> RobotArm {
        let mut arm = RobotArm::new("test_robot", 0.0, 0.0, 0.0);

        let joint1 = RobotJoint::new_revolute(
            0.0,  // theta
            0.0,  // d
            1.0,  // a
            0.0,  // alpha
            -std::f64::consts::PI,
            std::f64::consts::PI
        );

        let joint2 = RobotJoint::new_revolute(
            0.0,
            0.0,
            1.0,
            0.0,
            -std::f64::consts::PI,
            std::f64::consts::PI
        );

        arm.add_joint(joint1);
        arm.add_joint(joint2);

        arm
    }

    #[test]
    fn test_swarm_creation() {
        let robots = vec![create_test_robot(), create_test_robot(), create_test_robot()];
        let swarm = SwarmCoordinator::new(robots, SwarmControlMode::Formation);

        assert_eq!(swarm.robot_count(), 3);
        assert_eq!(*swarm.control_mode(), SwarmControlMode::Formation);
    }

    #[test]
    fn test_formation_mode() {
        let robots = vec![create_test_robot(); 3];
        let mut swarm = SwarmCoordinator::new(robots, SwarmControlMode::Formation);

        swarm.set_formation(FormationType::Line {
            spacing: 1.0,
            axis: crate::clifford_algebra::formation_control::Axis::X,
        }, 0);

        let positions = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 0.5,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 2.0,
                y: 0.0,
                z: 0.0,
            },
        ];

        let velocities = vec![(0.0, 0.0, 0.0); 3];
        let goal = Some(Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        });

        let cmds = swarm.compute_swarm_velocities(&positions, &velocities, goal);

        // Robot 1 should move toward x=1.0
        assert!(cmds[1].0 > 0.0);
    }

    #[test]
    fn test_inter_robot_collision() {
        let robots = vec![create_test_robot(); 2];
        let swarm = SwarmCoordinator::new(robots, SwarmControlMode::Independent);

        let positions = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 0.1,
                y: 0.0,
                z: 0.0,
            }, // Too close
        ];

        let collisions = swarm.check_inter_robot_collisions(&positions, 0.5);
        assert_eq!(collisions.len(), 1);
        assert_eq!(collisions[0], (0, 1));
    }

    #[test]
    fn test_swarm_centroid() {
        let robots = vec![create_test_robot(); 3];
        let swarm = SwarmCoordinator::new(robots, SwarmControlMode::Independent);

        let positions = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 3.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 0.0,
                y: 3.0,
                z: 0.0,
            },
        ];

        let centroid = swarm.compute_swarm_centroid(&positions);
        assert!((centroid.x - 1.0).abs() < 0.01);
        assert!((centroid.y - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_swarm_spread() {
        let robots = vec![create_test_robot(); 3];
        let swarm = SwarmCoordinator::new(robots, SwarmControlMode::Independent);

        let positions = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 0.0,
                y: 1.0,
                z: 0.0,
            },
        ];

        let spread = swarm.compute_swarm_spread(&positions);
        // Max distance from centroid (1/3, 1/3) to (1.0, 0.0) or (0.0, 1.0) = sqrt((2/3)^2 + (1/3)^2) = sqrt(5/9) ≈ 0.745
        assert!((spread - 0.745).abs() < 0.03);
    }

    #[test]
    fn test_average_spacing() {
        let robots = vec![create_test_robot(); 3];
        let swarm = SwarmCoordinator::new(robots, SwarmControlMode::Independent);

        let positions = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 2.0,
                y: 0.0,
                z: 0.0,
            },
        ];

        let spacing = swarm.compute_average_spacing(&positions);
        // Distances: 0-1=1.0, 1-2=1.0, 0-2=2.0, Average = 4.0/3 = 1.333
        assert!((spacing - 1.333).abs() < 0.01);
    }
}
