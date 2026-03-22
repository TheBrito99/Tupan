//! Feature Recognition from CAD Models
//!
//! Automatically recognizes machinable features from BREP solid models.
//! Identifies pockets, holes, bosses, slots, and other features that can be
//! programmed with CAM operations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unique feature identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FeatureId(pub u32);

/// Recognized machinable feature
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MachinableFeature {
    /// Pocket: depression in face with vertical or slanted walls
    Pocket {
        id: FeatureId,
        depth: f64,                        // mm
        bottom_contour: Vec<(f64, f64)>,  // X, Y coordinates
        corner_radius: f64,                // mm, fillet radius
        floor_type: FloorType,
    },

    /// Hole: cylindrical or tapered hole
    Hole {
        id: FeatureId,
        diameter: f64,                     // mm
        depth: f64,                        // mm (0 for through)
        hole_type: HoleType,
    },

    /// Boss: raised feature on surface
    Boss {
        id: FeatureId,
        height: f64,                       // mm
        profile: Vec<(f64, f64)>,         // X, Y coordinates
        base_diameter: f64,                // mm
    },

    /// Slot: elongated pocket
    Slot {
        id: FeatureId,
        width: f64,                        // mm
        length: f64,                       // mm
        depth: f64,                        // mm
        corner_radius: f64,                // mm
    },

    /// Surface: flat machined surface
    Surface {
        id: FeatureId,
        area_mm2: f64,
        surface_finish_requirement: f64,   // Ra in micrometers
    },

    /// Thread: internal or external thread
    Thread {
        id: FeatureId,
        diameter: f64,                     // mm
        depth: f64,                        // mm
        pitch: f64,                        // mm
        thread_type: String,               // "M10x1.5", "1/4-20 UNC", etc.
    },

    /// Chamfer or fillet edge
    EdgeModification {
        id: FeatureId,
        edge_length: f64,                  // mm
        mod_type: EdgeModType,
        mod_size: f64,                     // mm (radius or chamfer angle)
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FloorType {
    Flat,
    Slanted,
    Curved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HoleType {
    Through,
    Blind,
    Counterbore,
    Countersink,
    Spotface,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeModType {
    Fillet,
    Chamfer,
    Radius,
}

impl MachinableFeature {
    pub fn id(&self) -> FeatureId {
        match self {
            Self::Pocket { id, .. }
            | Self::Hole { id, .. }
            | Self::Boss { id, .. }
            | Self::Slot { id, .. }
            | Self::Surface { id, .. }
            | Self::Thread { id, .. }
            | Self::EdgeModification { id, .. } => *id,
        }
    }

    pub fn feature_type(&self) -> &'static str {
        match self {
            Self::Pocket { .. } => "Pocket",
            Self::Hole { .. } => "Hole",
            Self::Boss { .. } => "Boss",
            Self::Slot { .. } => "Slot",
            Self::Surface { .. } => "Surface",
            Self::Thread { .. } => "Thread",
            Self::EdgeModification { .. } => "EdgeModification",
        }
    }

    pub fn machining_difficulty(&self) -> f64 {
        // 0.0 = very simple, 1.0 = very complex
        match self {
            Self::Surface { .. } => 0.1,
            Self::Hole { hole_type: HoleType::Through, .. } => 0.2,
            Self::Hole { hole_type: HoleType::Blind, .. } => 0.3,
            Self::Hole { hole_type: HoleType::Counterbore, .. } => 0.35,
            Self::Hole { hole_type: HoleType::Countersink, .. } => 0.35,
            Self::Hole { hole_type: HoleType::Spotface, .. } => 0.25,
            Self::Pocket {
                corner_radius,
                depth,
                ..
            } => {
                let radius_factor = if *corner_radius > 0.0 { 0.3 } else { 0.0 };
                let depth_factor = (depth / 50.0).min(0.5);
                0.4 + radius_factor + depth_factor
            }
            Self::Slot { .. } => 0.5,
            Self::Boss { .. } => 0.6,
            Self::Thread { .. } => 0.8,
            Self::EdgeModification { .. } => 0.3,
        }
    }
}

/// Feature recognizer for BREP models
#[derive(Debug, Clone)]
pub struct FeatureRecognizer {
    features: HashMap<FeatureId, MachinableFeature>,
    next_id: u32,
}

impl FeatureRecognizer {
    pub fn new() -> Self {
        FeatureRecognizer {
            features: HashMap::new(),
            next_id: 1,
        }
    }

    /// Generate a new feature ID
    fn next_feature_id(&mut self) -> FeatureId {
        let id = FeatureId(self.next_id);
        self.next_id += 1;
        id
    }

    /// Recognize a pocket feature
    pub fn recognize_pocket(
        &mut self,
        depth: f64,
        bottom_contour: Vec<(f64, f64)>,
        corner_radius: f64,
    ) -> MachinableFeature {
        let feature = MachinableFeature::Pocket {
            id: self.next_feature_id(),
            depth,
            bottom_contour,
            corner_radius,
            floor_type: FloorType::Flat,
        };
        self.features.insert(feature.id(), feature.clone());
        feature
    }

    /// Recognize a hole feature
    pub fn recognize_hole(
        &mut self,
        diameter: f64,
        depth: f64,
        hole_type: HoleType,
    ) -> MachinableFeature {
        let feature = MachinableFeature::Hole {
            id: self.next_feature_id(),
            diameter,
            depth,
            hole_type,
        };
        self.features.insert(feature.id(), feature.clone());
        feature
    }

    /// Recognize a slot feature
    pub fn recognize_slot(
        &mut self,
        width: f64,
        length: f64,
        depth: f64,
        corner_radius: f64,
    ) -> MachinableFeature {
        let feature = MachinableFeature::Slot {
            id: self.next_feature_id(),
            width,
            length,
            depth,
            corner_radius,
        };
        self.features.insert(feature.id(), feature.clone());
        feature
    }

    /// Recognize a boss feature
    pub fn recognize_boss(
        &mut self,
        height: f64,
        profile: Vec<(f64, f64)>,
        base_diameter: f64,
    ) -> MachinableFeature {
        let feature = MachinableFeature::Boss {
            id: self.next_feature_id(),
            height,
            profile,
            base_diameter,
        };
        self.features.insert(feature.id(), feature.clone());
        feature
    }

    /// Get all recognized features
    pub fn features(&self) -> Vec<&MachinableFeature> {
        self.features.values().collect()
    }

    /// Get feature by ID
    pub fn get_feature(&self, id: FeatureId) -> Option<&MachinableFeature> {
        self.features.get(&id)
    }

    /// Get features by type
    pub fn features_by_type(&self, feature_type: &str) -> Vec<&MachinableFeature> {
        self.features
            .values()
            .filter(|f| f.feature_type() == feature_type)
            .collect()
    }

    /// Get number of recognized features
    pub fn feature_count(&self) -> usize {
        self.features.len()
    }

    /// Estimate total machining time for all features
    pub fn estimate_total_machining_time(&self) -> f64 {
        // Simplified estimate: 10-30 minutes per feature depending on complexity
        self.features
            .values()
            .map(|f| {
                let base_time = 15.0; // minutes
                let difficulty_factor = f.machining_difficulty();
                base_time * (1.0 + difficulty_factor)
            })
            .sum()
    }
}

impl Default for FeatureRecognizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feature_recognizer_creation() {
        let recognizer = FeatureRecognizer::new();
        assert_eq!(recognizer.feature_count(), 0);
    }

    #[test]
    fn test_recognize_pocket() {
        let mut recognizer = FeatureRecognizer::new();
        let pocket = recognizer.recognize_pocket(
            10.0,
            vec![(0.0, 0.0), (20.0, 0.0), (20.0, 30.0), (0.0, 30.0)],
            2.0,
        );

        assert_eq!(pocket.feature_type(), "Pocket");
        assert_eq!(recognizer.feature_count(), 1);

        if let MachinableFeature::Pocket { depth, .. } = pocket {
            assert_eq!(depth, 10.0);
        } else {
            panic!("Expected pocket feature");
        }
    }

    #[test]
    fn test_recognize_hole() {
        let mut recognizer = FeatureRecognizer::new();
        let hole = recognizer.recognize_hole(10.0, 0.0, HoleType::Through);

        assert_eq!(hole.feature_type(), "Hole");
        assert_eq!(recognizer.feature_count(), 1);
    }

    #[test]
    fn test_recognize_slot() {
        let mut recognizer = FeatureRecognizer::new();
        let slot = recognizer.recognize_slot(5.0, 30.0, 8.0, 2.0);

        assert_eq!(slot.feature_type(), "Slot");
        assert_eq!(recognizer.feature_count(), 1);
    }

    #[test]
    fn test_recognize_boss() {
        let mut recognizer = FeatureRecognizer::new();
        let boss = recognizer.recognize_boss(5.0, vec![(0.0, 0.0), (15.0, 0.0)], 15.0);

        assert_eq!(boss.feature_type(), "Boss");
        assert_eq!(recognizer.feature_count(), 1);
    }

    #[test]
    fn test_multiple_features() {
        let mut recognizer = FeatureRecognizer::new();

        recognizer.recognize_pocket(10.0, vec![], 2.0);
        recognizer.recognize_hole(5.0, 0.0, HoleType::Through);
        recognizer.recognize_hole(8.0, 0.0, HoleType::Through);
        recognizer.recognize_slot(3.0, 20.0, 5.0, 1.0);

        assert_eq!(recognizer.feature_count(), 4);

        let holes = recognizer.features_by_type("Hole");
        assert_eq!(holes.len(), 2);

        let pockets = recognizer.features_by_type("Pocket");
        assert_eq!(pockets.len(), 1);
    }

    #[test]
    fn test_feature_difficulty() {
        let mut recognizer = FeatureRecognizer::new();

        // Create surface feature for testing
        let surface_feature = MachinableFeature::Surface {
            id: FeatureId(1),
            area_mm2: 100.0,
            surface_finish_requirement: 1.6,
        };
        let surface = surface_feature.machining_difficulty();
        // Surface is simple
        assert!(surface < 0.2);

        let pocket = recognizer.recognize_pocket(10.0, vec![], 2.0);
        let pocket_difficulty = pocket.machining_difficulty();
        // Pocket is moderate-to-high complexity (0.4 base + 0.3 radius + 0.2 depth = 0.9)
        assert!(pocket_difficulty > 0.3 && pocket_difficulty <= 1.0);

        let thread = MachinableFeature::Thread {
            id: FeatureId(100),
            diameter: 10.0,
            depth: 15.0,
            pitch: 1.5,
            thread_type: "M10x1.5".to_string(),
        };
        let thread_difficulty = thread.machining_difficulty();
        // Thread is complex
        assert!(thread_difficulty > 0.7);
    }

    #[test]
    fn test_machining_time_estimate() {
        let mut recognizer = FeatureRecognizer::new();

        recognizer.recognize_pocket(10.0, vec![], 2.0);
        recognizer.recognize_hole(5.0, 0.0, HoleType::Through);

        let time = recognizer.estimate_total_machining_time();
        assert!(time > 20.0); // Should be reasonable estimate
    }

    #[test]
    fn test_feature_id_uniqueness() {
        let mut recognizer = FeatureRecognizer::new();

        let pocket1 = recognizer.recognize_pocket(10.0, vec![], 2.0);
        let pocket2 = recognizer.recognize_pocket(10.0, vec![], 2.0);
        let hole = recognizer.recognize_hole(5.0, 0.0, HoleType::Through);

        assert_ne!(pocket1.id(), pocket2.id());
        assert_ne!(pocket1.id(), hole.id());
        assert_ne!(pocket2.id(), hole.id());
    }

    #[test]
    fn test_get_feature_by_id() {
        let mut recognizer = FeatureRecognizer::new();
        let pocket = recognizer.recognize_pocket(10.0, vec![], 2.0);
        let hole = recognizer.recognize_hole(5.0, 0.0, HoleType::Through);

        let retrieved_pocket = recognizer.get_feature(pocket.id());
        assert!(retrieved_pocket.is_some());
        assert_eq!(retrieved_pocket.unwrap().feature_type(), "Pocket");

        let retrieved_hole = recognizer.get_feature(hole.id());
        assert!(retrieved_hole.is_some());
        assert_eq!(retrieved_hole.unwrap().feature_type(), "Hole");

        let nonexistent = recognizer.get_feature(FeatureId(999));
        assert!(nonexistent.is_none());
    }
}
