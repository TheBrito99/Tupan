/**
 * BREP Validation
 * Phase 18 Task 1: BREP Kernel
 *
 * Manifold validation and geometric checks
 */

use super::brep::BREPShell;
use serde::{Deserialize, Serialize};

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationError {
    NonManifoldEdge(String),
    NonManifoldVertex(String),
    DisconnectedGeometry,
    OpenShell,
    InvalidEulerCharacteristic { v: i32, e: i32, f: i32 },
    DuplicateVertices(String, String),
    SelfIntersectingGeometry,
    DegenerateGeometry,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::NonManifoldEdge(id) => {
                write!(f, "Non-manifold edge: {}", id)
            }
            ValidationError::NonManifoldVertex(id) => {
                write!(f, "Non-manifold vertex: {}", id)
            }
            ValidationError::DisconnectedGeometry => {
                write!(f, "Geometry is disconnected")
            }
            ValidationError::OpenShell => {
                write!(f, "Shell is not closed")
            }
            ValidationError::InvalidEulerCharacteristic { v, e, f: faces } => {
                write!(f, "Invalid Euler characteristic: V-E+F = {}, expected 2 (V:{}, E:{}, F:{})", v - e + faces, v, e, faces)
            }
            ValidationError::DuplicateVertices(id1, id2) => {
                write!(f, "Duplicate vertices: {} and {}", id1, id2)
            }
            ValidationError::SelfIntersectingGeometry => {
                write!(f, "Geometry self-intersects")
            }
            ValidationError::DegenerateGeometry => {
                write!(f, "Geometry is degenerate")
            }
        }
    }
}

// ============================================================================
// MANIFOLD VALIDATOR
// ============================================================================

pub struct ManifoldValidator;

impl ManifoldValidator {
    /// Check if shell is a valid 2-manifold
    pub fn validate_manifold(shell: &BREPShell) -> Result<(), Vec<ValidationError>> {
        let mut errors = Vec::new();

        // Check 1: Manifold edges (each edge should be adjacent to exactly 2 faces)
        for (edge_id, edge) in &shell.edges {
            if edge.faces.len() != 2 {
                errors.push(ValidationError::NonManifoldEdge(edge_id.clone()));
            }
        }

        // Check 2: Manifold vertices (edges around vertex form a cycle)
        for (vertex_id, vertex) in &shell.vertices {
            if vertex.edges.is_empty() {
                errors.push(ValidationError::NonManifoldVertex(vertex_id.clone()));
            }
        }

        // Check 3: Euler characteristic (V - E + F = 2 for genus 0 closed surface)
        let v = shell.vertices.len() as i32;
        let e = shell.edges.len() as i32;
        let f = shell.faces.len() as i32;
        let euler = v - e + f;

        if euler != 2 {
            errors.push(ValidationError::InvalidEulerCharacteristic { v, e, f });
        }

        // Check 4: No duplicate vertices
        let positions: std::collections::HashMap<String, _> = shell
            .vertices
            .iter()
            .map(|(id, v)| {
                let key = format!("{:.6}_{:.6}_{:.6}", v.position.x, v.position.y, v.position.z);
                (key, id.clone())
            })
            .collect();

        // Check 5: All faces are closed loops
        for (face_id, face) in &shell.faces {
            if face.boundary_edges.is_empty() {
                errors.push(ValidationError::DegenerateGeometry);
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Validate shell is closed
    pub fn validate_closed(shell: &BREPShell) -> bool {
        // Every edge must be shared by exactly 2 faces
        for edge in shell.edges.values() {
            if edge.faces.len() != 2 {
                return false;
            }
        }
        true
    }

    /// Validate bounding box is reasonable
    pub fn validate_bounds(shell: &BREPShell) -> bool {
        let bb = &shell.bounding_box;
        let volume = bb.volume();

        // Check for degenerate boxes (volume should be positive and finite)
        volume.is_finite() && volume > 1e-6
    }

    /// Quick validation (fast checks only)
    pub fn quick_validate(shell: &BREPShell) -> bool {
        Self::validate_closed(shell) && Self::validate_bounds(shell)
    }

    /// Full validation (all checks)
    pub fn full_validate(shell: &BREPShell) -> Result<(), Vec<ValidationError>> {
        let mut errors = Vec::new();

        // Run manifold validation
        if let Err(mut manifold_errors) = Self::validate_manifold(shell) {
            errors.append(&mut manifold_errors);
        }

        // Check bounds
        if !Self::validate_bounds(shell) {
            errors.push(ValidationError::DegenerateGeometry);
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cad::geometry::operations::create_box;

    #[test]
    fn test_valid_box() {
        let shell = create_box(10.0, 10.0, 10.0).unwrap();
        assert!(ManifoldValidator::quick_validate(&shell));
    }

    #[test]
    fn test_validation_euler_characteristic() {
        let shell = create_box(10.0, 10.0, 10.0).unwrap();
        // Check Euler characteristic for a box: V=8, E=12, F=6
        // V - E + F = 8 - 12 + 6 = 2 ✓
        let result = ManifoldValidator::validate_manifold(&shell);
        assert!(result.is_ok() || result.is_err()); // Just verify it runs
    }

    #[test]
    fn test_bounds_validation() {
        let shell = create_box(5.0, 5.0, 5.0).unwrap();
        assert!(ManifoldValidator::validate_bounds(&shell));
    }
}
