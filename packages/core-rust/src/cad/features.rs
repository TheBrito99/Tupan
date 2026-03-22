/**
 * Feature Tree & Operations
 * Phase 17: 3D CAD Foundation
 *
 * 3D feature operations: Extrude, Revolve, Fillet, Hole, etc.
 */

use super::sketcher::Sketch;
use super::brep::BREPShell;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FeatureType {
    Extrude {
        sketch_id: String,
        length: f64,
        direction: ExtrudeDirection,
        is_solid: bool,
        draft_angle: Option<f64>,
    },
    Revolve {
        sketch_id: String,
        angle: f64,
        axis_type: AxisType,
        axis_id: Option<String>,
        reverse: bool,
    },
    Fillet {
        radius: f64,
        edge_ids: Vec<String>,
    },
    Hole {
        hole_type: HoleType,
        diameter: f64,
        depth: Option<f64>,
        sketch_point_id: String,
    },
    Pocket {
        sketch_id: String,
        depth: f64,
        direction: PocketDirection,
    },
    Pattern {
        feature_id: String,
        pattern_type: PatternType,
        count: usize,
        spacing: f64,
    },
    Shell {
        thickness: f64,
        open_faces: Vec<String>,
    },
    Mirror {
        feature_id: String,
        plane_type: MirrorPlane,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ExtrudeDirection {
    Normal,
    Reverse,
    Symmetric,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AxisType {
    SketchAxis,
    CustomAxis,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum HoleType {
    Blind,
    Through,
    CounterBore,
    CounterSink,
    Tapped,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PocketDirection {
    Normal,
    Reverse,
    Symmetric,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PatternType {
    Linear,
    Circular,
    Mirrored,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum MirrorPlane {
    XY,
    YZ,
    XZ,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feature {
    pub id: String,
    pub name: String,
    pub feature_type: FeatureType,
    pub depends_on: Vec<String>,
    pub is_active: bool,
    pub is_suppressed: bool,
    pub resulting_geometry: Option<String>,
}

impl Feature {
    pub fn new(name: String, feature_type: FeatureType) -> Self {
        Feature {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            feature_type,
            depends_on: Vec::new(),
            is_active: true,
            is_suppressed: false,
            resulting_geometry: None,
        }
    }

    pub fn with_dependency(mut self, dependency_id: String) -> Self {
        self.depends_on.push(dependency_id);
        self
    }

    pub fn compute(&self, sketches: &HashMap<String, Sketch>) -> Result<BREPShell, String> {
        match &self.feature_type {
            FeatureType::Extrude {
                sketch_id,
                length,
                direction,
                is_solid,
                draft_angle,
            } => {
                let sketch = sketches.get(sketch_id).ok_or("Sketch not found")?;
                Self::extrude(sketch, *length, *direction, *is_solid, *draft_angle)
            }
            FeatureType::Revolve {
                sketch_id,
                angle,
                axis_type,
                axis_id,
                reverse,
            } => {
                let sketch = sketches.get(sketch_id).ok_or("Sketch not found")?;
                Self::revolve(sketch, *angle, *axis_type, axis_id.clone(), *reverse)
            }
            FeatureType::Fillet { radius, edge_ids } => {
                Self::fillet(*radius, edge_ids.clone())
            }
            FeatureType::Hole {
                hole_type,
                diameter,
                depth,
                sketch_point_id,
            } => {
                Self::hole(*hole_type, *diameter, *depth, sketch_point_id.clone())
            }
            _ => Err("Feature type not yet implemented".to_string()),
        }
    }

    // ========================================================================
    // FEATURE IMPLEMENTATIONS
    // ========================================================================

    fn extrude(
        sketch: &Sketch,
        length: f64,
        direction: ExtrudeDirection,
        is_solid: bool,
        draft_angle: Option<f64>,
    ) -> Result<BREPShell, String> {
        // Simplified extrude: create a shell from the sketch profile
        let mut shell = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("Extrude ({}mm)", length),
        );

        // In a full implementation:
        // 1. Get sketch profile loops
        // 2. Create vertices from profile at z=0 and z=length
        // 3. Create edges and faces
        // 4. Handle draft angle if specified
        // 5. Close the shell

        // Placeholder: return valid empty shell
        Ok(shell)
    }

    fn revolve(
        sketch: &Sketch,
        angle: f64,
        axis_type: AxisType,
        axis_id: Option<String>,
        reverse: bool,
    ) -> Result<BREPShell, String> {
        // Simplified revolve: rotate sketch profile around axis
        let mut shell = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("Revolve ({}°)", angle),
        );

        // In a full implementation:
        // 1. Get sketch profile
        // 2. Determine rotation axis
        // 3. Create vertices by rotating profile
        // 4. Create edges and faces for revolution surface
        // 5. Handle partial revolutions and open profiles

        Ok(shell)
    }

    fn fillet(radius: f64, edge_ids: Vec<String>) -> Result<BREPShell, String> {
        let mut shell = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("Fillet (R{})", radius),
        );

        // In a full implementation:
        // 1. Get edges to fillet
        // 2. Create fillet surfaces (circular arcs)
        // 3. Remove original edges
        // 4. Connect fillet to adjacent faces

        Ok(shell)
    }

    fn hole(
        hole_type: HoleType,
        diameter: f64,
        depth: Option<f64>,
        sketch_point_id: String,
    ) -> Result<BREPShell, String> {
        let mut shell = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("Hole (Ø{:?})", hole_type),
        );

        // In a full implementation:
        // 1. Get hole center from sketch point
        // 2. Create cylindrical face for hole
        // 3. Handle depth (blind vs through)
        // 4. Handle special hole types (countersink, counterbore, tapped)

        Ok(shell)
    }
}

// ============================================================================
// FEATURE TREE MANAGER
// ========================================================================

pub struct FeatureTree {
    pub features: Vec<Feature>,
    pub current_feature_index: usize,
}

impl FeatureTree {
    pub fn new() -> Self {
        FeatureTree {
            features: Vec::new(),
            current_feature_index: 0,
        }
    }

    pub fn add_feature(&mut self, feature: Feature) -> Result<(), String> {
        // Validate dependencies
        for dep in &feature.depends_on {
            if !self.features.iter().any(|f| &f.id == dep) {
                return Err(format!("Dependency {} not found", dep));
            }
        }

        self.features.push(feature);
        Ok(())
    }

    pub fn remove_feature(&mut self, feature_id: &str) -> Result<(), String> {
        // Check if other features depend on this one
        for feature in &self.features {
            if feature.depends_on.iter().any(|dep| dep == feature_id) {
                return Err(format!("Cannot remove feature {} - other features depend on it", feature_id));
            }
        }

        self.features.retain(|f| &f.id != feature_id);
        Ok(())
    }

    pub fn reorder_feature(&mut self, feature_id: &str, new_index: usize) -> Result<(), String> {
        if let Some(pos) = self.features.iter().position(|f| &f.id == feature_id) {
            let feature = self.features.remove(pos);
            if new_index <= self.features.len() {
                self.features.insert(new_index, feature);
                Ok(())
            } else {
                Err("Invalid index".to_string())
            }
        } else {
            Err("Feature not found".to_string())
        }
    }

    pub fn suppress_feature(&mut self, feature_id: &str) -> Result<(), String> {
        if let Some(feature) = self.features.iter_mut().find(|f| &f.id == feature_id) {
            feature.is_suppressed = true;
            Ok(())
        } else {
            Err("Feature not found".to_string())
        }
    }

    pub fn unsuppress_feature(&mut self, feature_id: &str) -> Result<(), String> {
        if let Some(feature) = self.features.iter_mut().find(|f| &f.id == feature_id) {
            feature.is_suppressed = false;
            Ok(())
        } else {
            Err("Feature not found".to_string())
        }
    }

    pub fn get_feature(&self, feature_id: &str) -> Option<&Feature> {
        self.features.iter().find(|f| &f.id == feature_id)
    }

    pub fn get_active_features(&self) -> Vec<&Feature> {
        self.features
            .iter()
            .filter(|f| f.is_active && !f.is_suppressed)
            .collect()
    }

    pub fn validate_dependencies(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        for (i, feature) in self.features.iter().enumerate() {
            for dep in &feature.depends_on {
                if let Some(dep_index) = self.features.iter().position(|f| &f.id == dep) {
                    if dep_index >= i {
                        errors.push(format!(
                            "Feature {} (index {}) depends on feature {} (index {})",
                            feature.name, i, dep, dep_index
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feature_creation() {
        let feature = Feature::new(
            "Extrude1".to_string(),
            FeatureType::Extrude {
                sketch_id: "Sketch1".to_string(),
                length: 10.0,
                direction: ExtrudeDirection::Normal,
                is_solid: true,
                draft_angle: None,
            },
        );

        assert_eq!(feature.name, "Extrude1");
        assert!(!feature.is_suppressed);
        assert!(feature.is_active);
    }

    #[test]
    fn test_feature_tree() {
        let mut tree = FeatureTree::new();
        let feature1 = Feature::new("Sketch1".to_string(), FeatureType::Hole {
            hole_type: HoleType::Through,
            diameter: 5.0,
            depth: None,
            sketch_point_id: "Point1".to_string(),
        });

        tree.add_feature(feature1).unwrap();
        assert_eq!(tree.features.len(), 1);
    }

    #[test]
    fn test_suppress_feature() {
        let mut tree = FeatureTree::new();
        let feature = Feature::new("Test".to_string(), FeatureType::Hole {
            hole_type: HoleType::Through,
            diameter: 5.0,
            depth: None,
            sketch_point_id: "Point1".to_string(),
        });
        let feature_id = feature.id.clone();

        tree.add_feature(feature).unwrap();
        tree.suppress_feature(&feature_id).unwrap();

        assert!(tree.get_feature(&feature_id).unwrap().is_suppressed);
        assert_eq!(tree.get_active_features().len(), 0);
    }
}
