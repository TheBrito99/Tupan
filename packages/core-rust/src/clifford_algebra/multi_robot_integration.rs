//! Phase 27 Task 4: Multi-Robot Integration Tests
//! Tests combining formation control, flocking, collaboration, and task allocation

#[cfg(test)]
mod tests {
    use crate::clifford_algebra::{
        collaborative_manipulation::CollaborativeGrasp,
        formation_control::{Axis, FormationController, FormationType},
        flocking_behaviors::{FlockingController, FlockingParameters},
        robot_configuration::{DHParameter, JointType, RobotArm, RobotJoint},
        spatialization::Point3D,
        swarm_coordinator::{SwarmCoordinator, SwarmControlMode},
        task_allocation::{AllocationStrategy, RobotCapability, Task, TaskAllocator},
    };

    fn create_test_robot() -> RobotArm {
        let mut arm = RobotArm::new("test_robot", 0.0, 0.0, 0.0);

        for _ in 0..3 {
            let joint = RobotJoint::new_revolute(
                0.0,  // theta
                0.0,  // d
                1.0,  // a
                0.0,  // alpha
                -std::f64::consts::PI,
                std::f64::consts::PI
            );
            arm.add_joint(joint);
        }

        arm
    }

    #[test]
    fn test_formation_to_flocking_transition() {
        // Start in formation, transition to flocking
        let robots = vec![create_test_robot(); 4];
        let mut swarm = SwarmCoordinator::new(robots, SwarmControlMode::Formation);

        swarm.set_formation(FormationType::Square { side_length: 2.0 }, 0);

        let positions = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 2.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 2.0,
                y: 2.0,
                z: 0.0,
            },
            Point3D {
                x: 0.0,
                y: 2.0,
                z: 0.0,
            },
        ];

        let velocities = vec![(0.0, 0.0, 0.0); 4];

        // Formation mode
        let formation_cmds = swarm.compute_swarm_velocities(&positions, &velocities, None);
        assert!(formation_cmds.len() == 4);

        // Switch to flocking
        let robots_clone: Vec<RobotArm> = swarm.robots().to_vec();
        let mut swarm2 =
            SwarmCoordinator::new(robots_clone, SwarmControlMode::Flocking);
        swarm2.set_flocking_params(FlockingParameters::default(), 10.0);

        let flocking_cmds = swarm2.compute_swarm_velocities(&positions, &velocities, None);
        assert!(flocking_cmds.len() == 4);
    }

    #[test]
    fn test_collaborative_task_allocation() {
        // Allocate collaborative grasp tasks to robot pairs
        let tasks = vec![
            Task {
                id: 0,
                location: Point3D {
                    x: 2.0,
                    y: 0.0,
                    z: 0.0,
                },
                priority: 2.0,
                duration: 20.0,
                required_force: 50.0,
            },
            Task {
                id: 1,
                location: Point3D {
                    x: 5.0,
                    y: 0.0,
                    z: 0.0,
                },
                priority: 1.0,
                duration: 10.0,
                required_force: 30.0,
            },
        ];

        let robots = vec![
            RobotCapability {
                id: 0,
                position: Point3D {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 1.0,
                max_force: 50.0,
                battery_level: 1.0,
            },
            RobotCapability {
                id: 1,
                position: Point3D {
                    x: 1.0,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 1.0,
                max_force: 50.0,
                battery_level: 1.0,
            },
            RobotCapability {
                id: 2,
                position: Point3D {
                    x: 4.0,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 1.0,
                max_force: 50.0,
                battery_level: 1.0,
            },
        ];

        let allocator = TaskAllocator::new(AllocationStrategy::GreedyNearest);
        let assignments = allocator.allocate(&tasks, &robots);

        // Both tasks should be assigned
        assert!(assignments[0].is_some());
        assert!(assignments[1].is_some());
    }

    #[test]
    fn test_swarm_formation_maintenance() {
        // Swarm maintains formation while moving to goal
        let robots = vec![create_test_robot(); 3];
        let mut swarm = SwarmCoordinator::new(robots, SwarmControlMode::Formation);

        swarm.set_formation(FormationType::Triangle { side_length: 1.0 }, 0);

        let mut positions = vec![
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
                x: 0.5,
                y: 0.866,
                z: 0.0,
            },
        ];

        let goal = Point3D {
            x: 5.0,
            y: 5.0,
            z: 0.0,
        };

        // Simulate 10 time steps
        for _step in 0..10 {
            let velocities = vec![(0.0, 0.0, 0.0); 3];
            let cmds = swarm.compute_swarm_velocities(&positions, &velocities, Some(goal));

            // Update positions
            for (i, cmd) in cmds.iter().enumerate() {
                positions[i].x += cmd.0 * 0.1;
                positions[i].y += cmd.1 * 0.1;
                positions[i].z += cmd.2 * 0.1;
            }
        }

        // Formation should still be valid
        let formation = swarm.formation_controller().unwrap();
        assert!(formation.is_formation_valid(&positions, 0.2));
    }

    #[test]
    fn test_dual_arm_synchronized_assembly() {
        // Two arms collaboratively insert a part
        let grasp_points = vec![
            Point3D {
                x: -0.3,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 0.3,
                y: 0.0,
                z: 0.0,
            },
        ];

        let grasp = CollaborativeGrasp::new(2, grasp_points.clone(), 100.0);

        let current_object_pos = Point3D {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        let goal_object_pos = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }; // Insert downward

        let new_grasp_points = grasp.compute_synchronized_motion(goal_object_pos, current_object_pos);

        // Both grasp points should move down by 1.0
        assert!(
            ((new_grasp_points[0].z - grasp_points[0].z).abs() - 1.0).abs() < 0.01
        );
        assert!(
            ((new_grasp_points[1].z - grasp_points[1].z).abs() - 1.0).abs() < 0.01
        );
    }

    #[test]
    fn test_swarm_collision_avoidance() {
        // Swarm robots avoid inter-robot collisions
        let robots = vec![create_test_robot(); 5];
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
            }, // Collision with 0
            Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 1.1,
                y: 0.0,
                z: 0.0,
            }, // Collision with 2
            Point3D {
                x: 5.0,
                y: 0.0,
                z: 0.0,
            }, // Safe
        ];

        let collisions = swarm.check_inter_robot_collisions(&positions, 0.5);

        // Should detect 2 collision pairs
        assert_eq!(collisions.len(), 2);
    }

    #[test]
    fn test_task_reallocation_on_capability_mismatch() {
        // Don't assign task to robot that can't handle it
        let tasks = vec![Task {
            id: 0,
            location: Point3D {
                x: 3.0,
                y: 0.0,
                z: 0.0,
            },
            priority: 1.0,
            duration: 10.0,
            required_force: 100.0, // High force requirement
        }];

        let robots = vec![
            RobotCapability {
                id: 0,
                position: Point3D {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 1.0,
                max_force: 50.0, // Can't handle task
                battery_level: 1.0,
            },
            RobotCapability {
                id: 1,
                position: Point3D {
                    x: 2.0,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 1.0,
                max_force: 150.0, // Can handle
                battery_level: 1.0,
            },
        ];

        let allocator = TaskAllocator::new(AllocationStrategy::GreedyNearest);
        let assignments = allocator.allocate(&tasks, &robots);

        // Should assign to robot 1 only
        assert_eq!(assignments[0], Some(1));
    }

    #[test]
    fn test_hybrid_formation_flocking() {
        // Hybrid mode combines formation + flocking
        let robots = vec![create_test_robot(); 4];
        let mut swarm = SwarmCoordinator::new(robots, SwarmControlMode::Hybrid);

        swarm.set_formation(
            FormationType::Line {
                spacing: 1.0,
                axis: Axis::X,
            },
            0,
        );
        swarm.set_flocking_params(FlockingParameters::default(), 10.0);

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
            Point3D {
                x: 3.0,
                y: 0.0,
                z: 0.0,
            },
        ];

        let velocities = vec![(0.5, 0.0, 0.0); 4];

        let cmds = swarm.compute_swarm_velocities(&positions, &velocities, None);

        // Commands should exist for all robots
        assert_eq!(cmds.len(), 4);
    }

    #[test]
    fn test_multi_robot_spacing_analysis() {
        // Analyze spacing between robots in swarm
        let robots = vec![create_test_robot(); 4];
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
            Point3D {
                x: 3.0,
                y: 0.0,
                z: 0.0,
            },
        ];

        let spacing = swarm.compute_average_spacing(&positions);
        // Distances: 0-1=1.0, 0-2=2.0, 0-3=3.0, 1-2=1.0, 1-3=2.0, 2-3=1.0
        // Sum = 10.0, Count = 6, Average = 1.667
        assert!((spacing - 1.667).abs() < 0.02);
    }

    #[test]
    fn test_grasp_quality_metric() {
        // Compute quality of collaborative grasp
        let grasp_points = vec![
            Point3D {
                x: -1.0,
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

        let object_center = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };

        let quality = grasp.compute_grasp_quality(object_center);

        // Quality should be between 0.0 and 1.0
        assert!(quality > 0.0);
        assert!(quality <= 1.0);
    }

    #[test]
    fn test_task_allocation_feasibility() {
        // Check if all tasks can be allocated
        let tasks = vec![
            Task {
                id: 0,
                location: Point3D {
                    x: 1.0,
                    y: 0.0,
                    z: 0.0,
                },
                priority: 1.0,
                duration: 10.0,
                required_force: 10.0,
            },
            Task {
                id: 1,
                location: Point3D {
                    x: 2.0,
                    y: 0.0,
                    z: 0.0,
                },
                priority: 1.0,
                duration: 10.0,
                required_force: 10.0,
            },
        ];

        let robots = vec![
            RobotCapability {
                id: 0,
                position: Point3D {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 1.0,
                max_force: 50.0,
                battery_level: 1.0,
            },
            RobotCapability {
                id: 1,
                position: Point3D {
                    x: 1.5,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 1.0,
                max_force: 50.0,
                battery_level: 1.0,
            },
        ];

        let allocator = TaskAllocator::new(AllocationStrategy::GreedyNearest);
        assert!(allocator.is_feasible(&tasks, &robots));
    }

    #[test]
    fn test_swarm_centroid_and_spread() {
        // Verify swarm metrics
        let robots = vec![create_test_robot(); 4];
        let swarm = SwarmCoordinator::new(robots, SwarmControlMode::Independent);

        let positions = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 2.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 2.0,
                y: 2.0,
                z: 0.0,
            },
            Point3D {
                x: 0.0,
                y: 2.0,
                z: 0.0,
            },
        ];

        let centroid = swarm.compute_swarm_centroid(&positions);
        assert!((centroid.x - 1.0).abs() < 0.01);
        assert!((centroid.y - 1.0).abs() < 0.01);

        let spread = swarm.compute_swarm_spread(&positions);
        // Max distance from centroid to corner = sqrt(1^2 + 1^2) = 1.414
        assert!((spread - 1.414).abs() < 0.02);
    }
}
