/**
 * CAD Module - 3D Parametric Modeling System
 * Phase 17: 3D CAD Foundation
 *
 * Unified 3D CAD system combining:
 * - BREP (Boundary Representation) kernel for solids
 * - Constraint solver for parametric sketches
 * - Feature tree for parametric modeling
 * - Advanced 3D operations (extrude, revolve, loft, sweep)
 */

pub mod brep;
pub mod constraint_solver;
pub mod sketcher;
pub mod features;
pub mod geometry;

pub use brep::{BREPShell, BREPVertex, BREPEdge, BREPFace};
pub use geometry::{Point3D, Vector3D, Matrix3x3, BoundingBox};
pub use geometry::brep::{CurveType, SurfaceType};
pub use constraint_solver::{ConstraintSolver, Constraint, ConstraintType, SketchEntity};
pub use sketcher::Sketch;
pub use features::{Feature, FeatureTree};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// CAD DOCUMENT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CADDocument {
    pub id: String,
    pub name: String,
    pub version: String,
    pub body: ParametricBody,
    pub parameters: HashMap<String, f64>,
    pub is_modified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParametricBody {
    pub id: String,
    pub name: String,
    pub features: Vec<Feature>,
    pub sketches: HashMap<String, Sketch>,
    pub current_feature_index: usize,
    pub bounding_box: BoundingBox,
}

impl CADDocument {
    pub fn new(name: String) -> Self {
        CADDocument {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            version: "1.0".to_string(),
            body: ParametricBody {
                id: uuid::Uuid::new_v4().to_string(),
                name: "Body".to_string(),
                features: Vec::new(),
                sketches: HashMap::new(),
                current_feature_index: 0,
                bounding_box: BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(0.0, 0.0, 0.0)),
            },
            parameters: HashMap::new(),
            is_modified: true,
        }
    }

    /// Add a sketch to the body
    pub fn add_sketch(&mut self, sketch: Sketch) -> Result<String, String> {
        let id = sketch.id.clone();
        self.body.sketches.insert(id.clone(), sketch);
        self.is_modified = true;
        Ok(id)
    }

    /// Add a feature to the feature tree
    pub fn add_feature(&mut self, feature: Feature) -> Result<String, String> {
        let id = feature.id.clone();
        self.body.features.push(feature);
        self.is_modified = true;
        Ok(id)
    }

    /// Set a parameter value
    pub fn set_parameter(&mut self, name: String, value: f64) -> Result<(), String> {
        self.parameters.insert(name, value);
        self.is_modified = true;
        Ok(())
    }

    /// Recompute the model (rebuild feature tree)
    pub fn recompute(&mut self) -> Result<(), String> {
        // Iterate through features and apply each in sequence
        for feature in &self.body.features {
            feature.compute(&self.body.sketches)?;
        }
        self.is_modified = false;
        Ok(())
    }

    /// Export as STEP file (simplified)
    pub fn export_step(&self) -> Result<String, String> {
        // In production, would use actual STEP format
        Ok(format!(
            "STEP file for document: {} (ID: {})",
            self.name, self.id
        ))
    }

    /// Export as STL file (simplified)
    pub fn export_stl(&self) -> Result<Vec<u8>, String> {
        // In production, would generate actual STL binary
        Ok(vec![])
    }
}

// ============================================================================
// CAD OPERATIONS & UTILITIES
// ============================================================================

pub struct CADOperations;

impl CADOperations {
    /// Create a new CAD document with a base sketch
    pub fn create_document(name: String) -> CADDocument {
        CADDocument::new(name)
    }

    /// Validate a feature tree for circular dependencies
    pub fn validate_feature_tree(features: &[Feature]) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        for (i, feature) in features.iter().enumerate() {
            // Check if feature depends on features that come after it
            for dep in &feature.depends_on {
                if let Some(dep_index) = features.iter().position(|f| &f.id == dep) {
                    if dep_index > i {
                        errors.push(format!(
                            "Feature {} depends on feature {} which comes after it",
                            feature.id, dep
                        ));
                    }
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Estimate volume of a solid
    pub fn estimate_volume(shell: &BREPShell) -> f64 {
        shell.volume.unwrap_or(0.0)
    }

    /// Calculate surface area of a shell
    pub fn calculate_surface_area(shell: &BREPShell) -> f64 {
        shell.faces.values().map(|face| face.area).sum()
    }

    /// Check if two shells intersect
    pub fn check_intersection(shell1: &BREPShell, shell2: &BREPShell) -> bool {
        shell1.bounding_box.intersects(&shell2.bounding_box)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cad_document_creation() {
        let doc = CADDocument::new("Test Part".to_string());
        assert_eq!(doc.name, "Test Part");
        assert!(doc.is_modified);
    }

    #[test]
    fn test_set_parameter() {
        let mut doc = CADDocument::new("Test".to_string());
        assert!(doc.set_parameter("width".to_string(), 100.0).is_ok());
        assert_eq!(doc.parameters.get("width"), Some(&100.0));
    }

    #[test]
    fn test_feature_tree_validation() {
        // Create features with valid dependency order
        let features = vec![];
        assert!(CADOperations::validate_feature_tree(&features).is_ok());
    }
}
