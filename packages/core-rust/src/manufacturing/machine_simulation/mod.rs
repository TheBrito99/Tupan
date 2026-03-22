//! Phase 23: Advanced Machine Simulation
//!
//! Complete machine simulation suite enabling realistic CNC, lathe, laser, and 3D printer
//! modeling with physics-based dynamics, tool simulation, and process verification.
//!
//! Machines Supported:
//! - CNC Milling (3-axis, 4-axis, 5-axis)
//! - Lathe/Turning
//! - Laser Cutting/Engraving
//! - 3D Printing (FDM/Resin)
//! - Custom machines (extensible framework)

pub mod cad_machine;
pub mod dynamics;
pub mod kinematics;
pub mod process;
pub mod lathe;
pub mod laser;
pub mod fdm_printer;
pub mod dh_framework;
pub mod inverse_kinematics;
pub mod robot_dynamics;
pub mod trajectory_planning;

#[cfg(test)]
mod integration_tests;

pub use cad_machine::{MachineConfig, MachineType, AxisConfig};
pub use dynamics::{MachineState, DynamicsModel};
pub use kinematics::{ForwardKinematics, InverseKinematics};
pub use process::{ProcessModel, CuttingConditions};
pub use lathe::{LatheSimulator, TurningTool, LatheSpindle, ThreadSpec};
pub use laser::{LaserCutOperation, LaserSystem, LaserMaterial};
pub use fdm_printer::{FDMPrinter, FilamentMaterial, NozzleConfig, BuildPlatform};
pub use dh_framework::{RobotArm, RobotJoint, DHParameterOriginal, TransformMatrix};
pub use inverse_kinematics::{IKSolver, IKSolverConfig, IKResult, WorkspaceAnalysis, SingularityAnalysis, analyze_workspace, analyze_singularity};
pub use robot_dynamics::{DynamicsSolver, DynamicsState, LinkInertia};
pub use trajectory_planning::{
    ConfigurationSpace, Obstacle, ObstacleType, VelocityProfileType, TrajectoryPoint, RRTPath,
    TrapezoidalProfile, SCurveProfile, RRTPlanner, TrajectoryPlanner,
};
