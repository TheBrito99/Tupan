//! Phase 27 Task 1: Formation Control
//! Maintain geometric patterns while robots move in formation

use crate::clifford_algebra::spatialization::Point3D;

/// Formation types supported
#[derive(Debug, Clone, PartialEq)]
pub enum FormationType {
    Line { spacing: f64, axis: Axis },
    Triangle { side_length: f64 },
    Square { side_length: f64 },
    Circle { radius: f64 },
    Custom { offsets: Vec<Point3D> },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Axis {
    X,
    Y,
    Z,
}

/// Formation controller maintains geometric pattern
#[derive(Debug, Clone)]
pub struct FormationController {
    formation_type: FormationType,
    leader_index: usize,
    formation_gain: f64,
}

impl FormationController {
    pub fn new(formation_type: FormationType, leader_index: usize) -> Self {
        Self {
            formation_type,
            leader_index,
            formation_gain: 1.0,
        }
    }

    pub fn set_gain(&mut self, gain: f64) {
        self.formation_gain = gain;
    }

    /// Compute desired position for robot i in formation
    pub fn compute_desired_position(
        &self,
        robot_index: usize,
        leader_position: Point3D,
    ) -> Point3D {
        let offset = self.get_formation_offset(robot_index);
        Point3D {
            x: leader_position.x + offset.x,
            y: leader_position.y + offset.y,
            z: leader_position.z + offset.z,
        }
    }

    fn get_formation_offset(&self, robot_index: usize) -> Point3D {
        if robot_index == self.leader_index {
            return Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            };
        }

        match &self.formation_type {
            FormationType::Line { spacing, axis } => {
                let offset = (robot_index as f64 - self.leader_index as f64) * spacing;
                match axis {
                    Axis::X => Point3D {
                        x: offset,
                        y: 0.0,
                        z: 0.0,
                    },
                    Axis::Y => Point3D {
                        x: 0.0,
                        y: offset,
                        z: 0.0,
                    },
                    Axis::Z => Point3D {
                        x: 0.0,
                        y: 0.0,
                        z: offset,
                    },
                }
            }
            FormationType::Triangle { side_length } => {
                match robot_index {
                    0 => Point3D {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                    },
                    1 => Point3D {
                        x: *side_length,
                        y: 0.0,
                        z: 0.0,
                    },
                    2 => Point3D {
                        x: side_length / 2.0,
                        y: side_length * (3.0_f64.sqrt() / 2.0),
                        z: 0.0,
                    },
                    _ => Point3D {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                    },
                }
            }
            FormationType::Square { side_length } => {
                match robot_index {
                    0 => Point3D {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                    },
                    1 => Point3D {
                        x: *side_length,
                        y: 0.0,
                        z: 0.0,
                    },
                    2 => Point3D {
                        x: *side_length,
                        y: *side_length,
                        z: 0.0,
                    },
                    3 => Point3D {
                        x: 0.0,
                        y: *side_length,
                        z: 0.0,
                    },
                    _ => Point3D {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                    },
                }
            }
            FormationType::Circle { radius } => {
                let n = 8;
                let angle = 2.0 * std::f64::consts::PI * (robot_index as f64) / (n as f64);
                Point3D {
                    x: radius * angle.cos(),
                    y: radius * angle.sin(),
                    z: 0.0,
                }
            }
            FormationType::Custom { offsets } => {
                offsets
                    .get(robot_index)
                    .cloned()
                    .unwrap_or(Point3D {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                    })
            }
        }
    }

    /// Compute control input to maintain formation
    pub fn compute_formation_control(
        &self,
        robot_index: usize,
        current_position: Point3D,
        leader_position: Point3D,
    ) -> (f64, f64, f64) {
        let desired_position = self.compute_desired_position(robot_index, leader_position);

        let error_x = desired_position.x - current_position.x;
        let error_y = desired_position.y - current_position.y;
        let error_z = desired_position.z - current_position.z;

        (
            self.formation_gain * error_x,
            self.formation_gain * error_y,
            self.formation_gain * error_z,
        )
    }

    /// Check if formation is maintained within tolerance
    pub fn is_formation_valid(
        &self,
        robot_positions: &[Point3D],
        tolerance: f64,
    ) -> bool {
        if robot_positions.len() <= self.leader_index {
            return false;
        }

        let leader_position = robot_positions[self.leader_index];

        for (i, pos) in robot_positions.iter().enumerate() {
            if i == self.leader_index {
                continue;
            }

            let desired_pos = self.compute_desired_position(i, leader_position);
            let error = ((pos.x - desired_pos.x).powi(2)
                + (pos.y - desired_pos.y).powi(2)
                + (pos.z - desired_pos.z).powi(2))
            .sqrt();

            if error > tolerance {
                return false;
            }
        }

        true
    }

    /// Get formation offset for visualization/debugging
    pub fn get_offset(&self, robot_index: usize) -> Point3D {
        self.get_formation_offset(robot_index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_line_formation() {
        let controller =
            FormationController::new(FormationType::Line {
                spacing: 1.0,
                axis: Axis::X,
            }, 0);

        let leader_pos = Point3D {
            x: 10.0,
            y: 5.0,
            z: 0.0,
        };
        let robot1_desired = controller.compute_desired_position(1, leader_pos);

        assert!((robot1_desired.x - 11.0).abs() < 0.01);
        assert!((robot1_desired.y - 5.0).abs() < 0.01);
    }

    #[test]
    fn test_triangle_formation() {
        let controller = FormationController::new(FormationType::Triangle { side_length: 2.0 }, 0);

        let leader_pos = Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
        let robot2_desired = controller.compute_desired_position(2, leader_pos);

        assert!((robot2_desired.x - 1.0).abs() < 0.01);
        assert!((robot2_desired.y - 1.732).abs() < 0.02);
    }

    #[test]
    fn test_formation_control() {
        let controller =
            FormationController::new(FormationType::Line {
                spacing: 1.0,
                axis: Axis::X,
            }, 0);

        let current_pos = Point3D {
            x: 10.5,
            y: 5.0,
            z: 0.0,
        };
        let leader_pos = Point3D {
            x: 10.0,
            y: 5.0,
            z: 0.0,
        };

        let (vx, vy, _vz) = controller.compute_formation_control(1, current_pos, leader_pos);

        assert!((vx - 0.5).abs() < 0.01);
        assert!(vy.abs() < 0.01);
    }

    #[test]
    fn test_is_formation_valid() {
        let controller =
            FormationController::new(FormationType::Line {
                spacing: 1.0,
                axis: Axis::X,
            }, 0);

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

        assert!(controller.is_formation_valid(&positions, 0.1));

        let positions_bad = vec![
            Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 1.5,
                y: 0.0,
                z: 0.0,
            },
            Point3D {
                x: 2.0,
                y: 0.0,
                z: 0.0,
            },
        ];

        assert!(!controller.is_formation_valid(&positions_bad, 0.1));
    }
}
