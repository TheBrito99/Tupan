//! Multi-Axis Machining Support
//!
//! Provides structures and algorithms for 4-axis and 5-axis machining.
//! Includes:
//! - 6-axis coordinates (X, Y, Z, A, B, C)
//! - Tool orientation vectors
//! - Inverse kinematics solvers for various machine configurations
//!
//! # Examples
//!
//! ```
//! use tupan_core::manufacturing::multi_axis::{Point6D, ToolOrientation, InverseKinematics, MachineType};
//!
//! // Create a 4-axis machine
//! let ik = InverseKinematics::new(MachineType::FourAxisHorizontal);
//!
//! // Define tool position and orientation
//! let tcp = Point6D::linear(50.0, 0.0, 10.0);
//! let orientation = ToolOrientation::tilted(15.0, 0.0);
//!
//! // Solve for rotary axis positions
//! let result = ik.solve(&tcp, &orientation).unwrap();
//! println!("Machine position: {}", result);
//! ```

pub mod point6d;
pub mod tool_orientation;
pub mod inverse_kinematics;

pub use self::point6d::Point6D;
pub use self::tool_orientation::ToolOrientation;
pub use self::inverse_kinematics::{InverseKinematics, MachineType, IKError};
