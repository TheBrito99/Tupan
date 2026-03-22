//! Example Implementations of Microcontroller-Circuit Integration
//!
//! Practical demonstrations of closed-loop embedded control using the coupled
//! microcontroller-circuit simulator.

pub mod led_blink;
pub mod motor_speed_control;
pub mod integration_test;

pub use led_blink::{LedCircuitModel};
pub use motor_speed_control::{DcMotorModel, EncoderSimulator, PidController};
