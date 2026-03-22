//! Multi-Domain Coupling Examples
//!
//! Demonstrates how different physical domains interact through bond graph transformers.
//!
//! Each coupling example shows:
//! - How to combine two domain-specific bond graphs
//! - How to use Transformers/Gyrators to couple domains
//! - How to verify energy conservation across domains
//!
//! # Coupling Patterns
//!
//! **Transformer-based coupling** (linear, conservative):
//! - Electrical ↔ Thermal: Power dissipation (Joule heating)
//! - Electrical ↔ Mechanical: Motor/Generator (V·I ↔ τ·ω)
//! - Hydraulic ↔ Mechanical: Actuator (P·Q ↔ F·v)
//!
//! **Gyrator-based coupling** (cross-domain transduction):
//! - Mechanical ↔ Electrical: Motor (different energy transduction)
//!

pub mod electro_thermal;
pub mod electro_mechanical;
pub mod hydraulic_mechanical;
pub mod thermal_mechanical;
pub mod motor_pump_thermal;

pub use electro_thermal::{create_electro_thermal_coupling, ElectroThermalSystem};
pub use electro_mechanical::{create_electro_mechanical_coupling, ElectroMechanicalSystem};
pub use hydraulic_mechanical::{create_hydraulic_mechanical_coupling, HydraulicMechanicalSystem};
pub use thermal_mechanical::{create_thermal_mechanical_coupling, ThermalMechanicalSystem};
pub use motor_pump_thermal::{create_motor_pump_thermal, MotorPumpThermalSystem};
