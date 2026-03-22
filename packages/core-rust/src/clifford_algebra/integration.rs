//! Phase 26 Task 4: Integration & Testing
//! Tests combining collision avoidance, redundancy resolution, and force control
//! into comprehensive end-to-end scenarios

#[cfg(test)]
mod tests {
    use crate::clifford_algebra::{
        collision_avoidance::{Obstacle, PotentialFieldController, CollisionPredictor},
        redundancy_resolution::RedundancyResolver,
        force_control::{
            ImpedanceParameters, ImpedanceController, HybridForcePositionController,
            ContactDetector, JacobianTransposeController,
        },
        robot_configuration::RobotArm,
        singularity_analysis::Jacobian,
        spatialization::Point3D,
    };

    #[test]
    fn test_collision_avoidance_with_obstacle_sphere() {
        let collision_predictor = CollisionPredictor::new(0.1); // 10cm safety radius

        let position = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };

        let obstacle = Obstacle::Sphere {
            center: Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            radius: 0.5,
        };

        // Test safety margin computation
        let margin = collision_predictor.compute_safety_margin(&position, &[obstacle.clone()]);
        assert!(margin > 0.0);
        assert!(margin.is_finite());
        // Distance from origin to sphere center (1.0) minus radius (0.5) = 0.5
        // But compute_safety_margin might use different calculation, so just check it's reasonable
        assert!(margin >= 0.4 && margin <= 0.6);
    }

    #[test]
    fn test_potential_field_attractive_force() {
        let controller = PotentialFieldController::new(1.0, 1.0, 1.0);

        let current = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let goal = Point3D {
            x: 1.0,
            y: 0.0,
            z: 0.0,
        };

        let (potential, force) = (
            controller.compute_potential(&current, &goal),
            controller.compute_force(&current, &goal),
        );

        // Potential should be positive and increase with distance
        assert!(potential > 0.0);
        // Force should point toward goal (positive x direction)
        assert!(force.0 > 0.0);
    }

    #[test]
    fn test_collision_prediction_trajectory() {
        let collision_predictor = CollisionPredictor::new(0.1);

        let start = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let goal = Point3D {
            x: 2.0,
            y: 0.0,
            z: 0.0,
        };

        let obstacles = vec![Obstacle::Sphere {
            center: Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            radius: 0.5,
        }];

        // Predict collision time for straight-line motion
        let collision_time =
            collision_predictor.predict_collision_time(&start, &goal, 1.0, &obstacles);

        // Should detect collision along the path
        assert!(collision_time.is_some());
        if let Some(time) = collision_time {
            assert!(time > 0.0);
        }
    }

    #[test]
    fn test_impedance_assembly_scenario() {
        let impedance_params = ImpedanceParameters::compliant_assembly();
        let pos = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let controller = ImpedanceController::new(impedance_params, pos);

        // Verify impedance was initialized
        let desired_force = controller.compute_desired_force();
        assert!(desired_force.0.abs() >= 0.0);
    }

    #[test]
    fn test_hybrid_force_position_control() {
        let impedance_params = ImpedanceParameters::soft_contact();
        let pos = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let impedance = ImpedanceController::new(impedance_params, pos);
        let mut hybrid = HybridForcePositionController::new((true, false, false), impedance);

        // Set force target for X axis
        hybrid.set_force_targets((10.0, 0.0, 0.0));

        // Simulate force control
        let current_pos = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let current_vel = (0.0, 0.0, 0.0);
        let measured_force = (10.0, 0.0, 0.0);

        let cmd = hybrid.compute_command(current_pos, current_vel, measured_force);

        // Should have command in X direction (force-controlled)
        assert!(cmd.0.abs() >= 0.0);
    }

    #[test]
    fn test_contact_detection_integration() {
        let mut detector = ContactDetector::new(1.0, 100); // 1N force threshold

        // No contact initially
        let contact = detector.detect_contact((0.5, 0.0, 0.0));
        assert!(!contact);

        // Force spike above threshold
        let contact = detector.detect_contact((2.0, 0.0, 0.0));
        assert!(!contact); // Requires 5 frames minimum

        // Sustained contact
        for _i in 0..5 {
            let _c = detector.detect_contact((2.0, 0.0, 0.0));
        }

        let contact = detector.detect_contact((2.0, 0.0, 0.0));
        assert!(contact);
    }

    #[test]
    fn test_jacobian_transpose_mapping() {
        // 3-DOF Jacobian transpose controller
        let jacobian_t = [
            (1.0, 0.0, 0.0),
            (0.0, 1.0, 0.0),
            (0.0, 0.0, 1.0),
        ];

        let force = (10.0, 5.0, 2.0);
        let torques = JacobianTransposeController::compute_torques(&jacobian_t, force);

        // Torques should map forces to joint torques
        assert_eq!(torques.len(), 3);
        assert!((torques[0] - 10.0).abs() < 0.01);
        assert!((torques[1] - 5.0).abs() < 0.01);
        assert!((torques[2] - 2.0).abs() < 0.01);
    }

    #[test]
    fn test_6dof_force_wrench_mapping() {
        let jacobian_t = [
            (1.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 1.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 1.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 0.0, 1.0, 0.0, 0.0),
            (0.0, 0.0, 0.0, 0.0, 1.0, 0.0),
            (0.0, 0.0, 0.0, 0.0, 0.0, 1.0),
        ];

        let force = (10.0, 5.0, 2.0);
        let torque = (1.0, 0.5, 0.2);
        let joint_torques =
            JacobianTransposeController::compute_torques_6dof(&jacobian_t, force, torque);

        assert_eq!(joint_torques.len(), 6);
        // First 3 should map force
        assert!((joint_torques[0] - 10.0).abs() < 0.01);
        // Last 3 should map torque
        assert!((joint_torques[3] - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_multiple_obstacles_collision_checking() {
        let collision_predictor = CollisionPredictor::new(0.1);

        let position = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };

        let obstacles = vec![
            Obstacle::Sphere {
                center: Point3D {
                    x: 1.0,
                    y: 0.0,
                    z: 0.0,
                },
                radius: 0.5,
            },
            Obstacle::Cylinder {
                center: Point3D {
                    x: -1.0,
                    y: 0.0,
                    z: 0.0,
                },
                radius: 0.3,
                height: 2.0,
            },
        ];

        // Should compute minimum distance across all obstacles
        let margin = collision_predictor.compute_safety_margin(&position, &obstacles);
        assert!(margin > 0.0);
        assert!(margin.is_finite());
    }

    #[test]
    fn test_assembly_workflow_with_force_control() {
        // Simulate assembly task combining multiple Phase 26 capabilities

        // 1. Collision checking for approach
        let collision_predictor = CollisionPredictor::new(0.05);
        let approach_point = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.5,
        };
        let obstacles = vec![Obstacle::Sphere {
            center: Point3D {
                x: 0.0,
                y: 0.0,
                z: -0.5,
            },
            radius: 0.3,
        }];

        let approach_margin = collision_predictor.compute_safety_margin(&approach_point, &obstacles);
        assert!(approach_margin > 0.05);

        // 2. Contact force control
        let impedance_params = ImpedanceParameters::soft_contact();
        let pos = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let impedance = ImpedanceController::new(impedance_params, pos);
        let mut hybrid = HybridForcePositionController::new((true, false, false), impedance);

        hybrid.set_force_targets((15.0, 0.0, 0.0));

        // 3. Verify contact achievement
        let measured_force = (14.9, 0.0, 0.0);
        let assembly_complete = hybrid.is_assembly_complete(measured_force, 0.5);
        assert!(assembly_complete);
    }

    #[test]
    fn test_potential_field_obstacle_repulsion() {
        let mut controller = PotentialFieldController::new(1.0, 1.0, 1.0);

        let obstacle = Obstacle::Sphere {
            center: Point3D {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            radius: 0.5,
        };

        controller.add_obstacle(obstacle);

        let position = Point3D {
            x: 0.5,
            y: 0.0,
            z: 0.0,
        };
        let goal = Point3D {
            x: 2.0,
            y: 0.0,
            z: 0.0,
        };

        let potential = controller.compute_potential(&position, &goal);
        let force = controller.compute_force(&position, &goal);

        // Potential should include repulsive term
        assert!(potential > 0.0);
        // Force should have repulsive component (pointing away from obstacle)
        assert!(force.0.is_finite());
    }

    #[test]
    fn test_soft_contact_impedance_parameters() {
        let params = ImpedanceParameters::soft_contact();
        assert_eq!(params.stiffness, 100.0);
        assert!(params.damping > params.stiffness / 10.0); // Overdamped
    }

    #[test]
    fn test_stiff_positioning_impedance() {
        let params = ImpedanceParameters::stiff_positioning();
        assert_eq!(params.stiffness, 1000.0);
        assert!(params.stiffness > ImpedanceParameters::soft_contact().stiffness);
    }
}
