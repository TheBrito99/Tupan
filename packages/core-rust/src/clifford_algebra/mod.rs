//! Clifford Algebra Module - Phase 25 Task 1
//!
//! Geometric algebra for:
//! - Unified representation of rotations, reflections, and scaling
//! - Multi-dimensional vector operations
//! - Physics applications (electromagnetic fields, mechanics)
//! - 3D graphics without gimbal lock

pub mod basis;
pub mod multivector;
pub mod operations;
pub mod inversions;
pub mod rotations;
pub mod applications_2d;
pub mod applications_3d;

pub use basis::{BasisBlade, Signature, BasisBladeIter};
pub use multivector::Multivector;
pub use operations::{reverse, magnitude, normalize};
pub use rotations::Rotor;

// Phase 25 Task 2: Advanced Kinematics
pub mod inverse_kinematics;
pub mod robot_configuration;
pub mod singularity_analysis;
pub mod constraint_solving;
pub mod motion_planning;

// Phase 25 Task 3: Spatialization
pub mod spatialization;

// Phase 25 Task 4: Physics Integration
pub mod physics_integration;

// Phase 25 Task 5: Optimization
pub mod optimization;

// Phase 26 Task 1: Collision Avoidance
pub mod collision_avoidance;

// Phase 26 Task 2: Redundancy Resolution
pub mod redundancy_resolution;

// Phase 26 Task 3: Force/Torque Control
pub mod force_control;

// Phase 26 Task 4: Integration & Testing
pub mod integration;

// Phase 27 Task 1: Formation Control
pub mod formation_control;

// Phase 27 Task 1: Flocking Behaviors
pub mod flocking_behaviors;

// Phase 27 Task 2: Swarm Coordination
pub mod swarm_coordinator;

// Phase 27 Task 3: Collaborative Manipulation
pub mod collaborative_manipulation;

// Phase 27 Task 4: Task Allocation
pub mod task_allocation;

// Phase 27 Task 4: Multi-Robot Integration
pub mod multi_robot_integration;

pub use inverse_kinematics::{InverseKinematicsSolver, IkSolution};
pub use robot_configuration::{RobotArm, RobotJoint, DHParameter, JointType};
pub use singularity_analysis::{Jacobian, SingularityAnalyzer, SingularityInfo, SingularityType};
pub use constraint_solving::{ConstraintSolver, TaskConstraint, ConstraintResult};
pub use motion_planning::{TrajectoryGenerator, LinearMotionPlanner, AccelerationProfile, TrajectoryPoint};
pub use spatialization::{Point3D, Sphere, BoundingBox, OctreeNode, GeometricQueryEngine};
pub use physics_integration::{ElectromagneticField, ElectromagneticWave, RotationalState, ElectromechanicalCoupling};
pub use optimization::{ObjectiveFunction, QuadraticObjective, RosenbrockObjective, GradientDescent, ParticleSwarmOptimizer, OptimizationResult, TrajectoryOptimizer, MotionCostFunction};
pub use collision_avoidance::{Obstacle, PotentialFieldController, CollisionPredictor};
pub use redundancy_resolution::RedundancyResolver;
pub use force_control::{ImpedanceParameters, ImpedanceController, HybridForcePositionController, JacobianTransposeController, ContactDetector};

// Phase 27 exports
pub use formation_control::{FormationController, FormationType, Axis};
pub use flocking_behaviors::{FlockingController, FlockingParameters};
pub use swarm_coordinator::{SwarmCoordinator, SwarmControlMode};
pub use collaborative_manipulation::CollaborativeGrasp;
pub use task_allocation::{TaskAllocator, AllocationStrategy, Task, RobotCapability};
