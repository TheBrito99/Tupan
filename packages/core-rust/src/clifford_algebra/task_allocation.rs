//! Phase 27 Task 4: Task Allocation
//! Assign tasks to robots using various optimization strategies

use crate::clifford_algebra::spatialization::Point3D;

/// Task to be assigned to robots
#[derive(Debug, Clone)]
pub struct Task {
    pub id: usize,
    pub location: Point3D,
    pub priority: f64,       // Higher = more important
    pub duration: f64,       // Estimated time (seconds)
    pub required_force: f64, // Force requirement (N)
}

/// Robot capabilities for task allocation
#[derive(Debug, Clone)]
pub struct RobotCapability {
    pub id: usize,
    pub position: Point3D,
    pub max_speed: f64,
    pub max_force: f64,
    pub battery_level: f64, // 0.0 to 1.0
}

/// Task allocation engine
pub struct TaskAllocator {
    strategy: AllocationStrategy,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AllocationStrategy {
    GreedyNearest,      // Assign to nearest available robot
    AuctionBased,       // Robots bid based on cost
    Hungarian,          // Optimal assignment (O(n³))
    ParticleSwarm,      // PSO optimization
}

impl TaskAllocator {
    pub fn new(strategy: AllocationStrategy) -> Self {
        Self { strategy }
    }

    /// Allocate tasks to robots
    pub fn allocate(
        &self,
        tasks: &[Task],
        robots: &[RobotCapability],
    ) -> Vec<Option<usize>> {
        match self.strategy {
            AllocationStrategy::GreedyNearest => self.allocate_greedy(tasks, robots),
            AllocationStrategy::AuctionBased => self.allocate_auction(tasks, robots),
            AllocationStrategy::Hungarian => self.allocate_hungarian(tasks, robots),
            AllocationStrategy::ParticleSwarm => self.allocate_pso(tasks, robots),
        }
    }

    fn allocate_greedy(
        &self,
        tasks: &[Task],
        robots: &[RobotCapability],
    ) -> Vec<Option<usize>> {
        let mut assignments = vec![None; tasks.len()];
        let mut assigned_robots = vec![false; robots.len()];

        // Sort tasks by priority (highest first)
        let mut sorted_indices: Vec<usize> = (0..tasks.len()).collect();
        sorted_indices.sort_by(|&a, &b| {
            tasks[b]
                .priority
                .partial_cmp(&tasks[a].priority)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        for &task_idx in &sorted_indices {
            let task = &tasks[task_idx];

            // Find nearest unassigned robot
            let mut best_robot = None;
            let mut best_distance = f64::MAX;

            for (robot_idx, robot) in robots.iter().enumerate() {
                if assigned_robots[robot_idx] {
                    continue;
                }

                if robot.max_force < task.required_force {
                    continue; // Can't handle task
                }

                let dist = ((task.location.x - robot.position.x).powi(2)
                    + (task.location.y - robot.position.y).powi(2)
                    + (task.location.z - robot.position.z).powi(2))
                .sqrt();

                if dist < best_distance {
                    best_distance = dist;
                    best_robot = Some(robot_idx);
                }
            }

            if let Some(robot_idx) = best_robot {
                assignments[task_idx] = Some(robot_idx);
                assigned_robots[robot_idx] = true;
            }
        }

        assignments
    }

    fn allocate_auction(
        &self,
        tasks: &[Task],
        robots: &[RobotCapability],
    ) -> Vec<Option<usize>> {
        let mut assignments = vec![None; tasks.len()];

        // Each robot bids on tasks based on cost (distance + priority)
        for (task_idx, task) in tasks.iter().enumerate() {
            let mut best_robot = None;
            let mut best_bid = f64::MAX;

            for (robot_idx, robot) in robots.iter().enumerate() {
                if robot.max_force < task.required_force {
                    continue;
                }

                let dist = ((task.location.x - robot.position.x).powi(2)
                    + (task.location.y - robot.position.y).powi(2)
                    + (task.location.z - robot.position.z).powi(2))
                .sqrt();

                let travel_time = dist / robot.max_speed.max(0.01);
                let cost = travel_time / task.priority.max(0.01); // Lower = better

                if cost < best_bid {
                    best_bid = cost;
                    best_robot = Some(robot_idx);
                }
            }

            assignments[task_idx] = best_robot;
        }

        assignments
    }

    fn allocate_hungarian(
        &self,
        tasks: &[Task],
        robots: &[RobotCapability],
    ) -> Vec<Option<usize>> {
        // Simplified Hungarian algorithm (optimal assignment)
        // Full implementation would use Hungarian method
        // For now, use greedy as placeholder
        self.allocate_greedy(tasks, robots)
    }

    fn allocate_pso(
        &self,
        tasks: &[Task],
        robots: &[RobotCapability],
    ) -> Vec<Option<usize>> {
        // Use particle swarm optimization for assignment
        // Placeholder: use greedy for now
        self.allocate_greedy(tasks, robots)
    }

    /// Compute total cost of assignment
    pub fn compute_assignment_cost(
        &self,
        tasks: &[Task],
        robots: &[RobotCapability],
        assignments: &[Option<usize>],
    ) -> f64 {
        let mut total_cost = 0.0;

        for (task_idx, task) in tasks.iter().enumerate() {
            if let Some(robot_idx) = assignments[task_idx] {
                if robot_idx < robots.len() {
                    let robot = &robots[robot_idx];
                    let dist = ((task.location.x - robot.position.x).powi(2)
                        + (task.location.y - robot.position.y).powi(2)
                        + (task.location.z - robot.position.z).powi(2))
                    .sqrt();

                    let travel_time = dist / robot.max_speed.max(0.01);
                    total_cost += travel_time;
                }
            } else {
                total_cost += 1000.0; // Penalty for unassigned task
            }
        }

        total_cost
    }

    /// Check if all tasks can be assigned
    pub fn is_feasible(
        &self,
        tasks: &[Task],
        robots: &[RobotCapability],
    ) -> bool {
        let assignments = self.allocate(tasks, robots);
        assignments.iter().all(|a| a.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greedy_allocation() {
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
                    x: 5.0,
                    y: 0.0,
                    z: 0.0,
                },
                priority: 2.0,
                duration: 15.0,
                required_force: 20.0,
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

        // Task 1 (higher priority) should be assigned to robot 1 (closer)
        // Task 0 should be assigned to robot 0
        assert_eq!(assignments[1], Some(1));
        assert_eq!(assignments[0], Some(0));
    }

    #[test]
    fn test_auction_allocation() {
        let tasks = vec![Task {
            id: 0,
            location: Point3D {
                x: 5.0,
                y: 0.0,
                z: 0.0,
            },
            priority: 1.0,
            duration: 10.0,
            required_force: 10.0,
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
                max_force: 50.0,
                battery_level: 1.0,
            },
            RobotCapability {
                id: 1,
                position: Point3D {
                    x: 4.0,
                    y: 0.0,
                    z: 0.0,
                },
                max_speed: 2.0, // Faster robot
                max_force: 50.0,
                battery_level: 1.0,
            },
        ];

        let allocator = TaskAllocator::new(AllocationStrategy::AuctionBased);
        let assignments = allocator.allocate(&tasks, &robots);

        // Robot 1 should win (closer + faster)
        assert_eq!(assignments[0], Some(1));
    }

    #[test]
    fn test_assignment_cost() {
        let tasks = vec![Task {
            id: 0,
            location: Point3D {
                x: 10.0,
                y: 0.0,
                z: 0.0,
            },
            priority: 1.0,
            duration: 10.0,
            required_force: 10.0,
        }];

        let robots = vec![RobotCapability {
            id: 0,
            position: Point3D {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            max_speed: 1.0,
            max_force: 50.0,
            battery_level: 1.0,
        }];

        let assignments = vec![Some(0)];

        let allocator = TaskAllocator::new(AllocationStrategy::GreedyNearest);
        let cost = allocator.compute_assignment_cost(&tasks, &robots, &assignments);

        // Distance = 10m, speed = 1 m/s, cost = 10s
        assert!((cost - 10.0).abs() < 0.01);
    }
}
