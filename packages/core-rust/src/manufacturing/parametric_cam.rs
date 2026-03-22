//! Parametric CAM System
//!
//! Links CAD features to CAM operations. When CAD changes, dependent toolpaths
//! automatically regenerate. Enables tight integration between design and manufacturing.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use crate::manufacturing::feature_recognition::{FeatureId, MachinableFeature};

/// Unique operation identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct OperationId(pub u32);

/// CAM operation linked to CAD feature(s)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParametricOperation {
    pub id: OperationId,
    pub feature_ids: HashSet<FeatureId>,    // Source CAD features
    pub operation_type: OperationType,
    pub tool_diameter_mm: f64,
    pub cutting_speed_m_min: f64,
    pub feed_rate_mm_min: f64,
    pub spindle_speed_rpm: f64,
    pub coolant_enabled: bool,
    pub estimated_time_minutes: f64,
    pub valid: bool,                        // False if source features changed
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OperationType {
    Drilling,
    Tapping,
    Milling,
    Profiling,
    Roughing,
    Finishing,
    FaceMilling,
    SlotMilling,
    CavityMilling,
}

impl OperationType {
    pub fn suggested_for_feature(feature_type: &str) -> Vec<Self> {
        match feature_type {
            "Hole" => vec![
                Self::Drilling,
                Self::Tapping,
            ],
            "Pocket" => vec![Self::Roughing, Self::Finishing, Self::CavityMilling],
            "Slot" => vec![Self::SlotMilling, Self::Roughing, Self::Finishing],
            "Surface" => vec![Self::FaceMilling, Self::Profiling],
            "Boss" => vec![Self::Roughing, Self::Finishing],
            "Thread" => vec![Self::Tapping],
            _ => vec![],
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            Self::Drilling => "Drilling - High-speed hole creation",
            Self::Tapping => "Tapping - Thread cutting",
            Self::Milling => "Milling - General purpose cutting",
            Self::Profiling => "Profiling - Edge and contour cutting",
            Self::Roughing => "Roughing - High material removal",
            Self::Finishing => "Finishing - Surface quality",
            Self::FaceMilling => "Face Milling - Flat surface creation",
            Self::SlotMilling => "Slot Milling - Elongated pocket",
            Self::CavityMilling => "Cavity Milling - Complex pocket",
        }
    }

    pub fn typical_tool_diameter_range(&self) -> (f64, f64) {
        // (min, max) in mm
        match self {
            Self::Drilling => (0.5, 25.0),
            Self::Tapping => (1.0, 20.0),
            Self::Milling => (2.0, 12.0),
            Self::Profiling => (3.0, 10.0),
            Self::Roughing => (6.0, 16.0),
            Self::Finishing => (2.0, 8.0),
            Self::FaceMilling => (10.0, 40.0),
            Self::SlotMilling => (2.0, 10.0),
            Self::CavityMilling => (4.0, 12.0),
        }
    }
}

/// Parametric CAM session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParametricCamSession {
    pub operations: HashMap<OperationId, ParametricOperation>,
    pub feature_to_operations: HashMap<FeatureId, Vec<OperationId>>,
    pub next_operation_id: u32,
    pub total_estimated_time: f64,
}

impl ParametricCamSession {
    pub fn new() -> Self {
        ParametricCamSession {
            operations: HashMap::new(),
            feature_to_operations: HashMap::new(),
            next_operation_id: 1,
            total_estimated_time: 0.0,
        }
    }

    /// Generate next operation ID
    fn next_op_id(&mut self) -> OperationId {
        let id = OperationId(self.next_operation_id);
        self.next_operation_id += 1;
        id
    }

    /// Create an operation for a feature
    pub fn create_operation_for_feature(
        &mut self,
        feature: &MachinableFeature,
        operation_type: OperationType,
    ) -> OperationId {
        let tool_diameter = match operation_type {
            OperationType::Drilling => match feature {
                MachinableFeature::Hole { diameter, .. } => *diameter,
                _ => 5.0,
            },
            _ => 6.0,
        };

        let estimated_time = 5.0 + feature.machining_difficulty() * 15.0;

        let mut feature_ids = HashSet::new();
        feature_ids.insert(feature.id());

        let op_id = self.next_op_id();
        let operation = ParametricOperation {
            id: op_id,
            feature_ids,
            operation_type,
            tool_diameter_mm: tool_diameter,
            cutting_speed_m_min: 200.0,
            feed_rate_mm_min: 300.0,
            spindle_speed_rpm: 2000.0,
            coolant_enabled: true,
            estimated_time_minutes: estimated_time,
            valid: true,
        };

        // Link feature to operation
        self.feature_to_operations
            .entry(feature.id())
            .or_insert_with(Vec::new)
            .push(op_id);

        self.operations.insert(op_id, operation);
        self.update_total_time();

        op_id
    }

    /// Auto-generate operations for recognized features
    pub fn auto_generate_operations(
        &mut self,
        features: &[&MachinableFeature],
    ) -> Vec<OperationId> {
        let mut generated_ops = Vec::new();

        for feature in features {
            let suggested_ops = OperationType::suggested_for_feature(feature.feature_type());

            for op_type in suggested_ops.iter().take(1) {
                // Take the first (primary) suggested operation
                let op_id = self.create_operation_for_feature(feature, *op_type);
                generated_ops.push(op_id);
            }
        }

        generated_ops
    }

    /// Invalidate operations affected by feature change
    pub fn invalidate_affected_operations(&mut self, changed_feature: FeatureId) -> Vec<OperationId> {
        let affected: Vec<OperationId> = self
            .feature_to_operations
            .get(&changed_feature)
            .map(|ops| ops.clone())
            .unwrap_or_default();

        for op_id in &affected {
            if let Some(operation) = self.operations.get_mut(op_id) {
                operation.valid = false;
            }
        }

        affected
    }

    /// Mark operations as valid after regeneration
    pub fn validate_operations(&mut self, operation_ids: &[OperationId]) {
        for op_id in operation_ids {
            if let Some(operation) = self.operations.get_mut(op_id) {
                operation.valid = true;
            }
        }
    }

    /// Get all invalid operations that need regeneration
    pub fn get_invalid_operations(&self) -> Vec<&ParametricOperation> {
        self.operations
            .values()
            .filter(|op| !op.valid)
            .collect()
    }

    /// Update total machining time
    fn update_total_time(&mut self) {
        self.total_estimated_time = self.operations.values().map(|op| op.estimated_time_minutes).sum();
    }

    /// Get operation by ID
    pub fn get_operation(&self, id: OperationId) -> Option<&ParametricOperation> {
        self.operations.get(&id)
    }

    /// Get all operations for a feature
    pub fn get_operations_for_feature(&self, feature_id: FeatureId) -> Vec<&ParametricOperation> {
        self.feature_to_operations
            .get(&feature_id)
            .map(|op_ids| {
                op_ids
                    .iter()
                    .filter_map(|op_id| self.operations.get(op_id))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Suggest tool based on operation type
    pub fn suggest_tool_diameter(&self, operation_type: OperationType) -> (f64, f64) {
        operation_type.typical_tool_diameter_range()
    }
}

impl Default for ParametricCamSession {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manufacturing::feature_recognition::{FeatureRecognizer, HoleType};

    #[test]
    fn test_parametric_cam_session_creation() {
        let session = ParametricCamSession::new();
        assert_eq!(session.operations.len(), 0);
        assert_eq!(session.total_estimated_time, 0.0);
    }

    #[test]
    fn test_create_operation_for_hole() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let hole = recognizer.recognize_hole(10.0, 0.0, HoleType::Through);
        let op_id = session.create_operation_for_feature(&hole, OperationType::Drilling);

        assert!(session.operations.contains_key(&op_id));
        let operation = session.get_operation(op_id).unwrap();
        assert_eq!(operation.operation_type, OperationType::Drilling);
        assert_eq!(operation.tool_diameter_mm, 10.0);
        assert!(operation.valid);
    }

    #[test]
    fn test_create_operation_for_pocket() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let pocket = recognizer.recognize_pocket(10.0, vec![], 2.0);
        let op_id = session.create_operation_for_feature(&pocket, OperationType::CavityMilling);

        assert!(session.operations.contains_key(&op_id));
        assert!(session.total_estimated_time > 0.0);
    }

    #[test]
    fn test_auto_generate_operations() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let features = vec![
            recognizer.recognize_hole(5.0, 0.0, HoleType::Through),
            recognizer.recognize_hole(8.0, 0.0, HoleType::Through),
            recognizer.recognize_pocket(10.0, vec![], 2.0),
        ];

        let feature_refs: Vec<&MachinableFeature> = features.iter().collect();
        let generated = session.auto_generate_operations(&feature_refs);

        assert_eq!(generated.len(), 3);
        assert_eq!(session.operations.len(), 3);
    }

    #[test]
    fn test_invalidate_operations() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let hole = recognizer.recognize_hole(5.0, 0.0, HoleType::Through);
        let op_id = session.create_operation_for_feature(&hole, OperationType::Drilling);

        // Verify operation is valid
        assert!(session.get_operation(op_id).unwrap().valid);

        // Invalidate operations for the hole feature
        let affected = session.invalidate_affected_operations(hole.id());
        assert_eq!(affected.len(), 1);
        assert!(!session.get_operation(op_id).unwrap().valid);
    }

    #[test]
    fn test_validate_operations() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let hole = recognizer.recognize_hole(5.0, 0.0, HoleType::Through);
        let op_id = session.create_operation_for_feature(&hole, OperationType::Drilling);

        session.invalidate_affected_operations(hole.id());
        assert!(!session.get_operation(op_id).unwrap().valid);

        session.validate_operations(&[op_id]);
        assert!(session.get_operation(op_id).unwrap().valid);
    }

    #[test]
    fn test_get_invalid_operations() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let hole1 = recognizer.recognize_hole(5.0, 0.0, HoleType::Through);
        let hole2 = recognizer.recognize_hole(8.0, 0.0, HoleType::Through);

        let op1 = session.create_operation_for_feature(&hole1, OperationType::Drilling);
        let op2 = session.create_operation_for_feature(&hole2, OperationType::Drilling);

        session.invalidate_affected_operations(hole1.id());

        let invalid = session.get_invalid_operations();
        assert_eq!(invalid.len(), 1);
        assert_eq!(invalid[0].id, op1);
    }

    #[test]
    fn test_operation_type_suggestions() {
        let hole_ops = OperationType::suggested_for_feature("Hole");
        assert!(hole_ops.contains(&OperationType::Drilling));

        let pocket_ops = OperationType::suggested_for_feature("Pocket");
        assert!(pocket_ops.contains(&OperationType::Roughing) || pocket_ops.contains(&OperationType::CavityMilling));

        let surface_ops = OperationType::suggested_for_feature("Surface");
        assert!(surface_ops.contains(&OperationType::FaceMilling));
    }

    #[test]
    fn test_total_time_calculation() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let hole = recognizer.recognize_hole(5.0, 0.0, HoleType::Through);
        let pocket = recognizer.recognize_pocket(10.0, vec![], 2.0);

        session.create_operation_for_feature(&hole, OperationType::Drilling);
        session.create_operation_for_feature(&pocket, OperationType::CavityMilling);

        assert!(session.total_estimated_time > 10.0);
        assert_eq!(session.operations.len(), 2);
    }

    #[test]
    fn test_get_operations_for_feature() {
        let mut session = ParametricCamSession::new();
        let mut recognizer = FeatureRecognizer::new();

        let hole = recognizer.recognize_hole(5.0, 0.0, HoleType::Through);
        let op_id = session.create_operation_for_feature(&hole, OperationType::Drilling);

        let ops_for_hole = session.get_operations_for_feature(hole.id());
        assert_eq!(ops_for_hole.len(), 1);
        assert_eq!(ops_for_hole[0].id, op_id);
    }

    #[test]
    fn test_suggest_tool_diameter() {
        let session = ParametricCamSession::new();

        let (min, max) = session.suggest_tool_diameter(OperationType::Drilling);
        assert_eq!(min, 0.5);
        assert_eq!(max, 25.0);

        let (min, max) = session.suggest_tool_diameter(OperationType::FaceMilling);
        assert_eq!(min, 10.0);
        assert_eq!(max, 40.0);
    }
}
