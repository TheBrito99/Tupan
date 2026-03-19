//! Tupan Core: Unified simulation engine for mechatronics
//!
//! This library provides the computational foundation for Tupan, a comprehensive
//! mechatronics engineering platform. It implements:
//!
//! - Unified graph-based abstraction for all simulator types
//! - Numerical solvers (ODE, DAE, steady-state)
//! - Bond graph modeling and causality assignment
//! - Physical domain implementations (electrical, thermal, mechanical, etc.)
//! - Symbolic mathematics engine
//!
//! All computation is exposed to JavaScript/TypeScript via wasm-bindgen.

pub mod graph;
pub mod solvers;
pub mod error;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

// Re-export main types for easier access
pub use graph::{Graph, Node, Edge, NodeId, PortId, Port};
pub use solvers::{Solver, OdeSolver, SolverConfig};
pub use error::{TupanError, Result};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn init_wasm() {
    // Any initialization code for WASM goes here
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }
}
