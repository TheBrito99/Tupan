//! Domain Converters: Convert physical domains to unified bond graph representation
//!
//! Each converter transforms a domain-specific circuit/model into a bond graph
//! where all elements map to universal energy representations.

pub mod electrical;
pub mod thermal;

pub use electrical::ElectricalConverter;
pub use thermal::ThermalConverter;
