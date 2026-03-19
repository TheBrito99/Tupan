//! Error types for Tupan core

use thiserror::Error;

/// Result type for Tupan operations
pub type Result<T> = std::result::Result<T, TupanError>;

/// Main error type for Tupan
#[derive(Error, Debug)]
pub enum TupanError {
    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Edge not found: {0}")]
    EdgeNotFound(String),

    #[error("Invalid connection: {0}")]
    InvalidConnection(String),

    #[error("Cycle detected in graph")]
    CycleDetected,

    #[error("Causality conflict in bond graph")]
    CausalityConflict,

    #[error("Solver failed to converge")]
    SolverDiverged,

    #[error("Invalid solver configuration: {0}")]
    InvalidSolverConfig(String),

    #[error("Numerical error: {0}")]
    NumericalError(String),

    #[error("Port mismatch: expected {expected} ports, got {actual}")]
    PortMismatch { expected: usize, actual: usize },

    #[error("Invalid state: {0}")]
    InvalidState(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

// Convert serde_json errors
impl From<serde_json::Error> for TupanError {
    fn from(err: serde_json::Error) -> Self {
        TupanError::SerializationError(err.to_string())
    }
}
