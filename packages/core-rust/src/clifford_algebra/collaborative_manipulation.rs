//! Phase 27 Task 3: Collaborative Manipulation
//! Multi-arm grasping and synchronized motion control

use crate::clifford_algebra::{
    force_control::ImpedanceController,
    spatialization::Point3D,
};

/// Dual-arm or multi-arm collaborative grasping
pub struct CollaborativeGrasp {
    grasp_points: Vec<Point3D>,  // Contact points on object
    force_distribution: Vec<f64>, // Force allocation per robot
    impedance_controllers: Vec<ImpedanceController>,
}

impl CollaborativeGrasp {
    pub fn new(
        num_robots: usize,
        grasp_points: Vec<Point3D>,
        total_force: f64,
    ) -> Self {
        assert_eq!(num_robots, grasp_points.len());

        let n = num_robots as f64;
        let force_per_robot = total_force / n; // Equal distribution initially
        let force_distribution = vec![force_per_robot; num_robots];

        // Create compliant impedance controllers
        let impedance_controllers = grasp_points
            .iter()
            .map(|p| {
                let params = crate::clifford_algebra::force_control::ImpedanceParameters::soft_contact();
                ImpedanceController::new(params, *p)
            })
            .collect();

        Self {
            grasp_points,
            force_distribution,
            impedance_controllers,
        }
    }

    pub fn robot_count(&self) -> usize {
        self.grasp_points.len()
    }

    /// Redistribute forces based on robot positions
    pub fn optimize_force_distribution(&mut self, object_center: Point3D) {
        let total_force: f64 = self.force_distribution.iter().sum();

        // Redistribute based on distance from object center
        let distances: Vec<f64> = self
            .grasp_points
            .iter()
            .map(|p| {
                ((p.x - object_center.x).powi(2)
                    + (p.y - object_center.y).powi(2)
                    + (p.z - object_center.z).powi(2))
                .sqrt()
            })
            .collect();

        let total_dist: f64 = distances.iter().sum();

        if total_dist > 0.001 {
            // Robots closer to center bear more load
            self.force_distribution = distances
                .iter()
                .map(|d| {
                    let weight = 1.0 - (d / total_dist);
                    total_force * weight / (self.robot_count() as f64)
                })
                .collect();
        }
    }

    /// Compute synchronized motion to move object
    pub fn compute_synchronized_motion(
        &self,
        object_goal: Point3D,
        current_object_pos: Point3D,
    ) -> Vec<Point3D> {
        // Each robot moves its grasp point by the same displacement
        let displacement = Point3D {
            x: object_goal.x - current_object_pos.x,
            y: object_goal.y - current_object_pos.y,
            z: object_goal.z - current_object_pos.z,
        };

        self.grasp_points
            .iter()
            .map(|p| Point3D {
                x: p.x + displacement.x,
                y: p.y + displacement.y,
                z: p.z + displacement.z,
            })
            .collect()
    }

    /// Check if internal forces are balanced (no crushing)
    pub fn check_force_balance(&self, measured_forces: &[(f64, f64, f64)]) -> bool {
        // Sum of all forces should be zero (internal forces cancel)
        let sum_fx: f64 = measured_forces.iter().map(|f| f.0).sum();
        let sum_fy: f64 = measured_forces.iter().map(|f| f.1).sum();
        let sum_fz: f64 = measured_forces.iter().map(|f| f.2).sum();

        let total_force = (sum_fx.powi(2) + sum_fy.powi(2) + sum_fz.powi(2)).sqrt();

        // Should be near zero for balanced grasp
        total_force < 1.0 // 1N tolerance
    }

    /// Get force allocation for robot i
    pub fn get_robot_force(&self, robot_index: usize) -> f64 {
        self.force_distribution.get(robot_index).cloned().unwrap_or(0.0)
    }

    /// Get grasp point for robot i
    pub fn get_grasp_point(&self, robot_index: usize) -> Option<Point3D> {
        self.grasp_points.get(robot_index).cloned()
    }

    /// Compute grasp stability metric (0.0 to 1.0)
    pub fn compute_grasp_quality(&self, object_center: Point3D) -> f64 {
        if self.grasp_points.is_empty() {
            return 0.0;
        }

        // Quality based on distance distribution around object center
        let distances: Vec<f64> = self
            .grasp_points
            .iter()
            .map(|p| {
                ((p.x - object_center.x).powi(2)
                    + (p.y - object_center.y).powi(2)
                    + (p.z - object_center.z).powi(2))
                .sqrt()
            })
            .collect();

        let avg_dist: f64 = distances.iter().sum::<f64>() / distances.len() as f64;
        let variance: f64 = distances
            .iter()
            .map(|d| (d - avg_dist).powi(2))
            .sum::<f64>()
            / distances.len() as f64;

        // Lower variance = more uniform distribution = better quality
        // Quality metric: 1 / (1 + variance)
        1.0 / (1.0 + variance)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dual_arm_grasp() {
        let grasp_points = vec![
            Point3D {
                x: -0.5,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 0.5,
                y: 0.0,
                z: 0.0,
            },
        ];

        let grasp = CollaborativeGrasp::new(2, grasp_points, 100.0);

        assert_eq!(grasp.robot_count(), 2);
        assert!((grasp.get_robot_force(0) - 50.0).abs() < 0.01);
        assert!((grasp.get_robot_force(1) - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_force_optimization() {
        let grasp_points = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },   // At center
            Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },   // Far from center
            Point3D {
                x: 0.5,
                y: 0.0,
                z: 0.0,
            },   // Medium distance
        ];

        let mut grasp = CollaborativeGrasp::new(3, grasp_points, 150.0);
        let object_center = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };

        grasp.optimize_force_distribution(object_center);

        // Robot 0 (closest) should bear most load
        // Robot 1 (farthest) should bear least load
        assert!(grasp.get_robot_force(0) > grasp.get_robot_force(2));
        assert!(grasp.get_robot_force(2) > grasp.get_robot_force(1));
    }

    #[test]
    fn test_synchronized_motion() {
        let grasp_points = vec![
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
        ];

        let grasp = CollaborativeGrasp::new(2, grasp_points, 100.0);

        let current_pos = Point3D {
            x: 0.5,
            y: 0.0,
            z: 0.0,
        };
        let goal_pos = Point3D {
            x: 0.5,
            y: 1.0,
            z: 0.0,
        };

        let new_grasp_points = grasp.compute_synchronized_motion(goal_pos, current_pos);

        // Both robots move by (0, 1, 0)
        assert!((new_grasp_points[0].y - 1.0).abs() < 0.01);
        assert!((new_grasp_points[1].y - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_force_balance() {
        let grasp_points = vec![
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
        ];

        let grasp = CollaborativeGrasp::new(2, grasp_points, 100.0);

        // Balanced forces (push/pull cancel)
        let forces_balanced = vec![(50.0, 0.0, 0.0), (-50.0, 0.0, 0.0)];
        assert!(grasp.check_force_balance(&forces_balanced));

        // Unbalanced forces (crushing object)
        let forces_unbalanced = vec![(50.0, 0.0, 0.0), (50.0, 0.0, 0.0)];
        assert!(!grasp.check_force_balance(&forces_unbalanced));
    }
}
