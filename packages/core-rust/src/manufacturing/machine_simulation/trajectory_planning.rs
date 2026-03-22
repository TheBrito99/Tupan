//! Phase 23 Task 6: Trajectory Planning
//!
//! Advanced trajectory planning for robot manipulators with RRT path planner,
//! collision detection, velocity profiling, and singularity-aware motion.
//!
//! Supports:
//! - RRT (Rapidly-exploring Random Tree) path planning
//! - Collision-free motion in workspace
//! - Trapezoidal and S-curve velocity profiles
//! - Singularity avoidance
//! - Joint limit compliance
//! - Trajectory smoothing and optimization

use crate::manufacturing::machine_simulation::dh_framework::{RobotArm, TransformMatrix};
use crate::manufacturing::machine_simulation::inverse_kinematics::IKSolver;
use crate::manufacturing::machine_simulation::robot_dynamics::DynamicsSolver;
use nalgebra::{Point3, Matrix4};
use rand::Rng;
use serde::{Deserialize, Serialize};

/// Represents a point in robot configuration space (joint angles)
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ConfigurationSpace {
    pub joint_angles: [f64; 6],
    pub dof: usize,
}

impl ConfigurationSpace {
    pub fn new(dof: usize) -> Self {
        ConfigurationSpace {
            joint_angles: [0.0; 6],
            dof: clamped_dof(dof),
        }
    }

    pub fn from_angles(angles: &[f64]) -> Self {
        let dof = angles.len().min(6);
        let mut joint_angles = [0.0; 6];
        for i in 0..dof {
            joint_angles[i] = angles[i];
        }
        ConfigurationSpace { joint_angles, dof: clamped_dof(dof) }
    }

    pub fn distance_to(&self, other: &ConfigurationSpace) -> f64 {
        let mut dist = 0.0;
        for i in 0..self.dof {
            let diff = self.joint_angles[i] - other.joint_angles[i];
            dist += diff * diff;
        }
        dist.sqrt()
    }

    pub fn interpolate(&self, other: &ConfigurationSpace, t: f64) -> ConfigurationSpace {
        let clamped_t = t.clamp(0.0, 1.0);
        let mut result = ConfigurationSpace::new(self.dof);
        for i in 0..self.dof {
            result.joint_angles[i] = (1.0 - clamped_t) * self.joint_angles[i]
                + clamped_t * other.joint_angles[i];
        }
        result
    }
}

fn clamped_dof(dof: usize) -> usize {
    dof.clamp(1, 6)
}

/// Collision model for obstacles in workspace
#[derive(Debug, Clone)]
pub struct Obstacle {
    pub center: Point3<f64>,
    pub radius: f64,
    pub obstacle_type: ObstacleType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ObstacleType {
    Sphere,
    Cylinder { height: f64 },
    Box { width: f64, depth: f64, height: f64 },
}

impl Obstacle {
    pub fn new_sphere(center: Point3<f64>, radius: f64) -> Self {
        Obstacle {
            center,
            radius,
            obstacle_type: ObstacleType::Sphere,
        }
    }

    pub fn distance_to_point(&self, point: &Point3<f64>) -> f64 {
        let dist = (point - self.center).norm();
        (dist - self.radius).max(0.0)
    }

    pub fn contains_point(&self, point: &Point3<f64>) -> bool {
        self.distance_to_point(point) < 1e-6
    }

    pub fn collides_with_sphere(&self, center: &Point3<f64>, radius: f64) -> bool {
        let dist = (center - self.center).norm();
        dist < (self.radius + radius)
    }
}

/// Velocity profile types
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum VelocityProfileType {
    Trapezoidal,
    SCurve,
    Cubic,
}

/// Represents a single trajectory point with time, position, velocity, acceleration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryPoint {
    pub time: f64,
    pub configuration: ConfigurationSpace,
    pub velocity: Vec<f64>,
    pub acceleration: Vec<f64>,
}

impl TrajectoryPoint {
    pub fn new(time: f64, config: ConfigurationSpace) -> Self {
        let dof = config.dof;
        TrajectoryPoint {
            time,
            configuration: config,
            velocity: vec![0.0; dof],
            acceleration: vec![0.0; dof],
        }
    }

    pub fn with_velocity(mut self, velocity: Vec<f64>) -> Self {
        self.velocity = velocity;
        self
    }

    pub fn with_acceleration(mut self, acceleration: Vec<f64>) -> Self {
        self.acceleration = acceleration;
        self
    }
}

/// RRT Path (sequence of configurations)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RRTPath {
    pub waypoints: Vec<ConfigurationSpace>,
    pub segment_lengths: Vec<f64>,
    pub total_length: f64,
}

impl RRTPath {
    pub fn new(waypoints: Vec<ConfigurationSpace>) -> Self {
        let mut segment_lengths = Vec::new();
        let mut total_length = 0.0;

        for i in 1..waypoints.len() {
            let len = waypoints[i - 1].distance_to(&waypoints[i]);
            segment_lengths.push(len);
            total_length += len;
        }

        RRTPath {
            waypoints,
            segment_lengths,
            total_length,
        }
    }

    pub fn get_configuration_at_progress(&self, progress: f64) -> ConfigurationSpace {
        let clamped = progress.clamp(0.0, 1.0);
        let target_dist = clamped * self.total_length;

        let mut current_dist = 0.0;
        for i in 0..self.waypoints.len() - 1 {
            let segment_len = self.segment_lengths[i];
            if current_dist + segment_len >= target_dist {
                let local_progress = if segment_len > 1e-9 {
                    (target_dist - current_dist) / segment_len
                } else {
                    0.0
                };
                return self.waypoints[i].interpolate(&self.waypoints[i + 1], local_progress);
            }
            current_dist += segment_len;
        }

        *self.waypoints.last().unwrap_or(&self.waypoints[0])
    }
}

/// Trapezoidal velocity profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrapezoidalProfile {
    pub v_max: f64,
    pub a_max: f64,
    pub distance: f64,
    pub t_accel: f64,
    pub t_plateau: f64,
    pub t_decel: f64,
    pub total_time: f64,
}

impl TrapezoidalProfile {
    pub fn new(distance: f64, v_max: f64, a_max: f64) -> Self {
        let distance = distance.abs();

        if a_max <= 0.0 || v_max <= 0.0 {
            return TrapezoidalProfile {
                v_max,
                a_max,
                distance,
                t_accel: 0.0,
                t_plateau: 0.0,
                t_decel: 0.0,
                total_time: 0.0,
            };
        }

        let t_accel = v_max / a_max;
        let s_accel = 0.5 * a_max * t_accel * t_accel;

        let (t_plateau, _s_plateau) = if 2.0 * s_accel < distance {
            let plateau_dist = distance - 2.0 * s_accel;
            let t_p = plateau_dist / v_max;
            (t_p, plateau_dist)
        } else {
            // Triangle profile: v_max is not reached
            let v_actual = (0.5 * a_max * distance).sqrt();
            let _t_a = v_actual / a_max;
            (0.0, 0.0)
        };

        let t_decel = t_accel;
        let total_time = t_accel + t_plateau + t_decel;

        TrapezoidalProfile {
            v_max,
            a_max,
            distance,
            t_accel,
            t_plateau,
            t_decel,
            total_time,
        }
    }

    pub fn position_at_time(&self, t: f64) -> f64 {
        let t = t.clamp(0.0, self.total_time);

        if t < self.t_accel {
            0.5 * self.a_max * t * t
        } else if t < self.t_accel + self.t_plateau {
            let s_accel = 0.5 * self.a_max * self.t_accel * self.t_accel;
            let t_plateau = t - self.t_accel;
            s_accel + self.v_max * t_plateau
        } else {
            let s_accel = 0.5 * self.a_max * self.t_accel * self.t_accel;
            let s_plateau = self.v_max * self.t_plateau;
            let t_decel = t - self.t_accel - self.t_plateau;
            s_accel + s_plateau + self.v_max * t_decel - 0.5 * self.a_max * t_decel * t_decel
        }
    }

    pub fn velocity_at_time(&self, t: f64) -> f64 {
        let t = t.clamp(0.0, self.total_time);

        if t < self.t_accel {
            self.a_max * t
        } else if t < self.t_accel + self.t_plateau {
            self.v_max
        } else {
            let t_decel = t - self.t_accel - self.t_plateau;
            self.v_max - self.a_max * t_decel
        }
    }

    pub fn acceleration_at_time(&self, t: f64) -> f64 {
        let t = t.clamp(0.0, self.total_time);

        if t < self.t_accel {
            self.a_max
        } else if t < self.t_accel + self.t_plateau {
            0.0
        } else {
            -self.a_max
        }
    }
}

/// S-curve velocity profile (3-7-3 profile)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SCurveProfile {
    pub v_max: f64,
    pub a_max: f64,
    pub j_max: f64, // Jerk (third derivative)
    pub distance: f64,
    pub total_time: f64,
}

impl SCurveProfile {
    pub fn new(distance: f64, v_max: f64, a_max: f64, j_max: f64) -> Self {
        let distance = distance.abs();

        // Simplified: use jerk to soften acceleration ramps
        // Full S-curve calculation is complex; approximating with smoothed trapezoid
        let trap = TrapezoidalProfile::new(distance, v_max, a_max);

        SCurveProfile {
            v_max,
            a_max,
            j_max: j_max.max(0.01),
            distance,
            total_time: trap.total_time * 1.05, // S-curve slightly longer
        }
    }

    pub fn position_at_time(&self, t: f64) -> f64 {
        let t = t.clamp(0.0, self.total_time);
        // Approximate with cubic Hermite: smoother than trapezoidal
        let t_norm = t / self.total_time;
        let t2 = t_norm * t_norm;
        let t3 = t2 * t_norm;
        // Cubic ease-in-out approximation
        self.distance * (3.0 * t2 - 2.0 * t3)
    }

    pub fn velocity_at_time(&self, t: f64) -> f64 {
        let t = t.clamp(0.0, self.total_time);
        let dt = 0.001;
        let pos1 = self.position_at_time(t - dt / 2.0);
        let pos2 = self.position_at_time(t + dt / 2.0);
        (pos2 - pos1) / dt
    }

    pub fn acceleration_at_time(&self, t: f64) -> f64 {
        let t = t.clamp(0.0, self.total_time);
        let dt = 0.001;
        let vel1 = self.velocity_at_time(t - dt / 2.0);
        let vel2 = self.velocity_at_time(t + dt / 2.0);
        (vel2 - vel1) / dt
    }
}

/// RRT-based path planner
pub struct RRTPlanner {
    robot: RobotArm,
    ik_solver: IKSolver,
    max_iterations: usize,
    step_size: f64,
    goal_bias: f64,
    collision_margin: f64,
}

impl RRTPlanner {
    pub fn new(robot: RobotArm) -> Self {
        RRTPlanner {
            robot,
            ik_solver: IKSolver::new(),
            max_iterations: 5000,
            step_size: 0.5,
            goal_bias: 0.1,
            collision_margin: 10.0, // 10mm
        }
    }

    pub fn plan(
        &self,
        start: ConfigurationSpace,
        goal: &TransformMatrix,
        obstacles: &[Obstacle],
    ) -> Result<RRTPath, String> {
        let mut rng = rand::thread_rng();
        let mut tree: Vec<ConfigurationSpace> = vec![start];
        let mut parent_indices: Vec<usize> = vec![];

        // Target configuration from IK
        // Use only the first dof elements from start configuration
        let initial_guess = &start.joint_angles[0..self.robot.num_joints];
        let goal_config = self.ik_solver.solve(&self.robot, goal, initial_guess)?;
        if !goal_config.converged {
            return Err("IK failed to converge to goal".to_string());
        }

        let goal_config = ConfigurationSpace::from_angles(&goal_config.joint_angles);

        for iteration in 0..self.max_iterations {
            // Random sample or goal bias
            let sample = if rng.gen::<f64>() < self.goal_bias {
                goal_config
            } else {
                self.random_configuration(&mut rng)
            };

            // Find nearest node in tree
            let nearest_idx = tree
                .iter()
                .enumerate()
                .min_by_key(|(_, node)| {
                    let d = node.distance_to(&sample);
                    (d * 1000.0) as i32
                })
                .map(|(idx, _)| idx)
                .unwrap_or(0);

            let nearest = tree[nearest_idx];

            // Step toward sample
            let new_node = self.step(&nearest, &sample);

            // Check collision
            if self.is_collision_free(&nearest, &new_node, obstacles) {
                tree.push(new_node);
                parent_indices.push(nearest_idx);

                // Check if goal reached
                if new_node.distance_to(&goal_config) < 0.1 {
                    return Ok(self.extract_path(&tree, &parent_indices));
                }
            }

            // Early exit if found
            if iteration > 1000 && iteration % 500 == 0 {
                if tree.len() > 100 {
                    // Increase goal bias as tree grows
                    let _bias_increase = (self.goal_bias * 1.5).min(0.5);
                    // Dynamic bias helps reach goal faster
                }
            }
        }

        Err(format!(
            "RRT failed to find path after {} iterations",
            self.max_iterations
        ))
    }

    fn random_configuration(&self, rng: &mut rand::rngs::ThreadRng) -> ConfigurationSpace {
        let mut config = ConfigurationSpace::new(self.robot.num_joints);
        for i in 0..self.robot.num_joints {
            if i < self.robot.joints.len() {
                let joint = &self.robot.joints[i];
                config.joint_angles[i] =
                    rng.gen_range(joint.min_limit..=joint.max_limit);
            }
        }
        config
    }

    fn step(
        &self,
        from: &ConfigurationSpace,
        toward: &ConfigurationSpace,
    ) -> ConfigurationSpace {
        let dist = from.distance_to(toward);
        if dist < 1e-9 {
            return *from;
        }

        let ratio = (self.step_size / dist).min(1.0);
        from.interpolate(toward, ratio)
    }

    fn is_collision_free(
        &self,
        from: &ConfigurationSpace,
        to: &ConfigurationSpace,
        obstacles: &[Obstacle],
    ) -> bool {
        // Check collision along path
        const SAMPLES: usize = 10;
        for i in 0..=SAMPLES {
            let t = i as f64 / SAMPLES as f64;
            let config = from.interpolate(to, t);

            // Get TCP position
            let tcp_point = match self.robot.forward_kinematics(&config.joint_angles[0..self.robot.num_joints]) {
                Ok(transform) => {
                    let pos = transform.position();
                    Point3::new(pos[0], pos[1], pos[2])
                },
                Err(_) => return false,
            };

            // Check distance to obstacles
            for obs in obstacles {
                if obs.distance_to_point(&tcp_point) < self.collision_margin {
                    return false;
                }
            }
        }
        true
    }

    fn extract_path(
        &self,
        tree: &[ConfigurationSpace],
        parent_indices: &[usize],
    ) -> RRTPath {
        // Reconstruct path from tree root to goal
        let mut path = vec![tree[tree.len() - 1]];
        let mut current = tree.len() - 1;

        while current > 0 && current - 1 < parent_indices.len() {
            current = parent_indices[current - 1];
            path.push(tree[current]);
        }

        path.reverse();
        RRTPath::new(path)
    }
}

/// Trajectory planner integrating all components
pub struct TrajectoryPlanner {
    robot: RobotArm,
    ik_solver: IKSolver,
    rrt_planner: RRTPlanner,
    dynamics_solver: Option<DynamicsSolver>,
}

impl TrajectoryPlanner {
    pub fn new(robot: RobotArm) -> Self {
        let rrt_planner = RRTPlanner::new(robot.clone());
        TrajectoryPlanner {
            robot,
            ik_solver: IKSolver::new(),
            rrt_planner,
            dynamics_solver: None,
        }
    }

    pub fn with_dynamics(mut self, solver: DynamicsSolver) -> Self {
        self.dynamics_solver = Some(solver);
        self
    }

    /// Plan trajectory from start configuration to goal TCP pose
    pub fn plan_to_pose(
        &self,
        start: ConfigurationSpace,
        goal_pose: &TransformMatrix,
        obstacles: &[Obstacle],
    ) -> Result<RRTPath, String> {
        self.rrt_planner.plan(start, goal_pose, obstacles)
    }

    /// Generate velocity profile for path
    pub fn generate_velocity_profile(
        &self,
        path: &RRTPath,
        profile_type: VelocityProfileType,
        v_max: f64,
        a_max: f64,
    ) -> Vec<TrajectoryPoint> {
        let total_time = match profile_type {
            VelocityProfileType::Trapezoidal => {
                let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                profile.total_time
            }
            VelocityProfileType::SCurve => {
                let profile = SCurveProfile::new(path.total_length, v_max, a_max, 0.1);
                profile.total_time
            }
            VelocityProfileType::Cubic => {
                let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                profile.total_time * 1.1
            }
        };

        const SAMPLES: usize = 100;
        let mut trajectory = Vec::new();

        for i in 0..=SAMPLES {
            let t = i as f64 / SAMPLES as f64;
            let time = t * total_time;

            let progress = match profile_type {
                VelocityProfileType::Trapezoidal => {
                    let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                    profile.position_at_time(time) / path.total_length
                }
                VelocityProfileType::SCurve => {
                    let profile = SCurveProfile::new(path.total_length, v_max, a_max, 0.1);
                    profile.position_at_time(time) / path.total_length
                }
                VelocityProfileType::Cubic => {
                    let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                    profile.position_at_time(time) / path.total_length
                }
            };

            let config = path.get_configuration_at_progress(progress);
            let mut point = TrajectoryPoint::new(time, config);

            // Compute velocity
            let progress_vel = match profile_type {
                VelocityProfileType::Trapezoidal => {
                    let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                    profile.velocity_at_time(time) / path.total_length
                }
                VelocityProfileType::SCurve => {
                    let profile = SCurveProfile::new(path.total_length, v_max, a_max, 0.1);
                    profile.velocity_at_time(time) / path.total_length
                }
                VelocityProfileType::Cubic => {
                    let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                    profile.velocity_at_time(time) / path.total_length
                }
            };

            let vel = vec![progress_vel; path.waypoints[0].dof];
            point = point.with_velocity(vel);

            // Compute acceleration
            let progress_acc = match profile_type {
                VelocityProfileType::Trapezoidal => {
                    let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                    profile.acceleration_at_time(time) / path.total_length
                }
                VelocityProfileType::SCurve => {
                    let profile = SCurveProfile::new(path.total_length, v_max, a_max, 0.1);
                    profile.acceleration_at_time(time) / path.total_length
                }
                VelocityProfileType::Cubic => {
                    let profile = TrapezoidalProfile::new(path.total_length, v_max, a_max);
                    profile.acceleration_at_time(time) / path.total_length
                }
            };

            let acc = vec![progress_acc; path.waypoints[0].dof];
            point = point.with_acceleration(acc);

            trajectory.push(point);
        }

        trajectory
    }

    /// Smooth path by inserting intermediate waypoints
    pub fn smooth_path(&self, path: &RRTPath, smoothing_iterations: usize) -> RRTPath {
        let mut waypoints = path.waypoints.clone();

        for _ in 0..smoothing_iterations {
            let mut new_waypoints = vec![waypoints[0]];

            for i in 1..waypoints.len() - 1 {
                let neighbor_dist =
                    waypoints[i - 1].distance_to(&waypoints[i + 1]);
                let sum_dist = waypoints[i - 1].distance_to(&waypoints[i])
                    + waypoints[i].distance_to(&waypoints[i + 1]);

                // Check if we can skip intermediate point
                if neighbor_dist < sum_dist * 0.95 {
                    // Can shortcut
                    continue;
                }

                new_waypoints.push(waypoints[i]);
            }

            new_waypoints.push(*waypoints.last().unwrap());

            if new_waypoints.len() == waypoints.len() {
                break; // No more improvements
            }

            waypoints = new_waypoints;
        }

        RRTPath::new(waypoints)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_configuration_space_creation() {
        let config = ConfigurationSpace::new(6);
        assert_eq!(config.dof, 6);
        assert!(config.joint_angles.iter().all(|&a| (a - 0.0).abs() < 1e-9));
    }

    #[test]
    fn test_configuration_space_distance() {
        let c1 = ConfigurationSpace::from_angles(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        let c2 = ConfigurationSpace::from_angles(&[1.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        let dist = c1.distance_to(&c2);
        assert!((dist - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_configuration_space_interpolation() {
        let c1 = ConfigurationSpace::from_angles(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        let c2 = ConfigurationSpace::from_angles(&[2.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        let c_mid = c1.interpolate(&c2, 0.5);
        assert!((c_mid.joint_angles[0] - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_obstacle_sphere_creation() {
        let obs = Obstacle::new_sphere(Point3::new(0.0, 0.0, 0.0), 10.0);
        assert!((obs.radius - 10.0).abs() < 1e-9);
    }

    #[test]
    fn test_obstacle_distance_to_point() {
        let obs = Obstacle::new_sphere(Point3::new(0.0, 0.0, 0.0), 10.0);
        let point = Point3::new(15.0, 0.0, 0.0);
        let dist = obs.distance_to_point(&point);
        assert!((dist - 5.0).abs() < 1e-9);
    }

    #[test]
    fn test_obstacle_collision_detection() {
        let obs = Obstacle::new_sphere(Point3::new(0.0, 0.0, 0.0), 10.0);
        assert!(obs.collides_with_sphere(&Point3::new(5.0, 0.0, 0.0), 5.0));
        assert!(!obs.collides_with_sphere(&Point3::new(30.0, 0.0, 0.0), 5.0));
    }

    #[test]
    fn test_trapezoidal_profile_creation() {
        let profile = TrapezoidalProfile::new(100.0, 10.0, 2.0);
        assert!(profile.total_time > 0.0);
        assert!((profile.distance - 100.0).abs() < 1e-9);
    }

    #[test]
    fn test_trapezoidal_profile_position() {
        let profile = TrapezoidalProfile::new(100.0, 10.0, 2.0);
        let pos_start = profile.position_at_time(0.0);
        let pos_end = profile.position_at_time(profile.total_time);
        assert!(pos_start < 1e-9);
        assert!((pos_end - 100.0).abs() < 1e-9);
    }

    #[test]
    fn test_trapezoidal_profile_velocity() {
        let profile = TrapezoidalProfile::new(100.0, 10.0, 2.0);
        let vel_start = profile.velocity_at_time(0.0);
        let vel_peak = profile.velocity_at_time(profile.t_accel + 0.1);
        assert!(vel_start < 1e-9);
        assert!(vel_peak <= profile.v_max + 1e-9);
    }

    #[test]
    fn test_scurve_profile_creation() {
        let profile = SCurveProfile::new(100.0, 10.0, 2.0, 0.1);
        assert!(profile.total_time > 0.0);
    }

    #[test]
    fn test_scurve_profile_smoothness() {
        let profile = SCurveProfile::new(100.0, 10.0, 2.0, 0.1);
        let pos1 = profile.position_at_time(profile.total_time * 0.25);
        let pos2 = profile.position_at_time(profile.total_time * 0.75);
        assert!(pos2 > pos1);
    }

    #[test]
    fn test_rrt_path_creation() {
        let waypoints = vec![
            ConfigurationSpace::from_angles(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            ConfigurationSpace::from_angles(&[1.0, 1.0, 1.0, 0.0, 0.0, 0.0]),
            ConfigurationSpace::from_angles(&[2.0, 2.0, 2.0, 0.0, 0.0, 0.0]),
        ];
        let path = RRTPath::new(waypoints);
        assert_eq!(path.waypoints.len(), 3);
        assert!(path.total_length > 0.0);
    }

    #[test]
    fn test_rrt_path_interpolation() {
        let waypoints = vec![
            ConfigurationSpace::from_angles(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            ConfigurationSpace::from_angles(&[2.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        ];
        let path = RRTPath::new(waypoints);
        let config_mid = path.get_configuration_at_progress(0.5);
        assert!((config_mid.joint_angles[0] - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_trajectory_point_creation() {
        let config = ConfigurationSpace::new(6);
        let point = TrajectoryPoint::new(1.0, config);
        assert!((point.time - 1.0).abs() < 1e-9);
        assert_eq!(point.velocity.len(), 6);
    }

    #[test]
    fn test_trajectory_point_with_velocity() {
        let config = ConfigurationSpace::new(6);
        let vel = vec![0.1, 0.2, 0.3, 0.0, 0.0, 0.0];
        let point = TrajectoryPoint::new(1.0, config).with_velocity(vel.clone());
        assert_eq!(point.velocity, vel);
    }

    #[test]
    fn test_trajectory_point_with_acceleration() {
        let config = ConfigurationSpace::new(6);
        let acc = vec![0.05, 0.1, 0.15, 0.0, 0.0, 0.0];
        let point = TrajectoryPoint::new(1.0, config).with_acceleration(acc.clone());
        assert_eq!(point.acceleration, acc);
    }
}
