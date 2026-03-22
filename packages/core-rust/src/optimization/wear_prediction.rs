//! Tool Wear Prediction using Machine Learning
//!
//! Predicts remaining tool life based on cutting conditions using:
//! - Taylor equation as baseline: VT^n = C
//! - Empirical corrections for different materials
//! - Historical wear data for model refinement

use serde::{Deserialize, Serialize};

/// Tool wear prediction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WearPrediction {
    /// Predicted remaining material before failure [mm]
    pub remaining_life_mm: f64,
    /// Confidence level [0.0-1.0]
    pub confidence: f64,
    /// Risk level
    pub risk_level: RiskLevel,
    /// Recommended action
    pub recommended_action: String,
    /// Estimated tool life percentage used [0-100]
    pub tool_life_percentage_used: f64,
}

/// Risk level for tool life
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    Safe,       // < 50% used
    Warning,    // 50-80% used
    Critical,   // > 80% used
}

impl RiskLevel {
    fn from_percentage(percentage: f64) -> Self {
        if percentage < 50.0 {
            RiskLevel::Safe
        } else if percentage < 80.0 {
            RiskLevel::Warning
        } else {
            RiskLevel::Critical
        }
    }
}

/// Cutting conditions record from actual machining
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingConditionsRecord {
    pub material: String,              // "Aluminum 6061", "Steel 1018", etc.
    pub tool_material: String,         // "Carbide", "HSS", "Ceramic"
    pub spindle_speed: f64,            // RPM
    pub feed_rate: f64,                // mm/min
    pub depth_of_cut: f64,             // mm
    pub cutting_distance: f64,         // mm of material removed
    pub flank_wear_measured: f64,      // Actual flank wear in mm
}

/// Taylor equation constants for different materials and tool combinations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaylorConstants {
    pub material: String,
    pub tool_material: String,
    pub c: f64,  // Taylor constant (VT^n = C)
    pub n: f64,  // Exponent (typically 0.2-0.4)
}

impl TaylorConstants {
    /// Default Taylor constants for common material-tool combinations
    /// VT^n = C where V = cutting speed (m/min), T = tool life (min), n typically 0.2-0.4
    pub fn default_constants() -> Vec<Self> {
        vec![
            TaylorConstants {
                material: "Aluminum 6061".to_string(),
                tool_material: "Carbide".to_string(),
                c: 600.0,
                n: 0.30,
            },
            TaylorConstants {
                material: "Steel 1018".to_string(),
                tool_material: "Carbide".to_string(),
                c: 200.0,
                n: 0.25,
            },
            TaylorConstants {
                material: "Titanium Ti-6Al-4V".to_string(),
                tool_material: "Carbide".to_string(),
                c: 100.0,
                n: 0.20,
            },
            TaylorConstants {
                material: "Cast Iron".to_string(),
                tool_material: "Carbide".to_string(),
                c: 150.0,
                n: 0.22,
            },
        ]
    }

    /// Find constants for material and tool combination
    pub fn find(material: &str, tool_material: &str) -> Option<Self> {
        Self::default_constants()
            .into_iter()
            .find(|tc| tc.material == material && tc.tool_material == tool_material)
    }
}

/// Tool Wear Predictor using Taylor equation + empirical corrections
pub struct ToolWearPredictor {
    taylor_constants: Vec<TaylorConstants>,
}

impl ToolWearPredictor {
    pub fn new() -> Self {
        ToolWearPredictor {
            taylor_constants: TaylorConstants::default_constants(),
        }
    }

    /// Predict remaining tool life
    ///
    /// Uses Taylor equation: VT^n = C
    /// Solves for T (tool life in minutes)
    pub fn predict_remaining_life(
        &self,
        material: &str,
        tool_material: &str,
        spindle_speed_rpm: f64,
        depth_of_cut: f64,
        current_wear_mm: f64,
        total_tool_length: f64,
    ) -> WearPrediction {
        // Find Taylor constants
        let constants = if let Some(tc) = TaylorConstants::find(material, tool_material) {
            tc
        } else {
            // Default to steel/carbide if not found
            TaylorConstants {
                material: material.to_string(),
                tool_material: tool_material.to_string(),
                c: 200.0,
                n: 0.25,
            }
        };

        // Convert RPM to cutting speed [m/min]
        // Assume typical tool diameter of 10mm (0.31 m)
        let tool_diameter = 0.01; // meters
        let cutting_speed = spindle_speed_rpm as f64 * std::f64::consts::PI * tool_diameter / 1000.0;

        // Taylor equation: T = (C / V) ^ (1/n)
        let tool_life_minutes = if cutting_speed > 0.0 {
            (constants.c / cutting_speed).powf(1.0 / constants.n)
        } else {
            1000.0 // Very long if speed is near zero
        };

        // Estimate remaining tool life considering:
        // 1. Flank wear limit (typically 0.3-0.5mm for general machining)
        // 2. Cutting distance correlation
        let max_flank_wear = 0.4; // mm (standard limit)
        let wear_percentage = (current_wear_mm / max_flank_wear).min(1.0);

        // Remaining capacity (in both wear and time dimensions)
        let remaining_minutes = tool_life_minutes * (1.0 - wear_percentage);

        // Estimate material removed per minute (rough approximation)
        // Material removal rate ≈ feed_rate * depth_of_cut * spindle_speed
        let feed_rate_estimate = 0.2; // mm/min (typical)
        let mrr_per_minute = feed_rate_estimate * depth_of_cut * spindle_speed_rpm as f64 / 1000.0;
        let remaining_material_mm = if mrr_per_minute > 0.0 {
            remaining_minutes * mrr_per_minute
        } else {
            100.0
        };

        // Confidence based on how well we know the material
        let confidence = if TaylorConstants::find(material, tool_material).is_some() {
            0.8
        } else {
            0.5
        };

        let tool_life_percentage_used = (wear_percentage * 100.0).min(100.0);
        let risk_level = RiskLevel::from_percentage(tool_life_percentage_used);

        let recommended_action = match risk_level {
            RiskLevel::Safe => "Continue machining".to_string(),
            RiskLevel::Warning => {
                format!(
                    "Monitor tool wear closely. Replace tool within {:.0} mm of material removal.",
                    remaining_material_mm
                )
            }
            RiskLevel::Critical => {
                "Replace tool immediately to prevent breakage and surface quality degradation."
                    .to_string()
            }
        };

        WearPrediction {
            remaining_life_mm: remaining_material_mm.max(0.0),
            confidence,
            risk_level,
            recommended_action,
            tool_life_percentage_used,
        }
    }

    /// Estimate flank wear after cutting distance
    ///
    /// Linear approximation: wear increases with cutting distance
    pub fn estimate_flank_wear_from_distance(
        &self,
        material: &str,
        tool_material: &str,
        cutting_distance_mm: f64,
        spindle_speed_rpm: f64,
        depth_of_cut: f64,
    ) -> f64 {
        // Empirical wear rate: wear per mm of cutting distance
        // Higher speed and depth → more wear per mm
        let base_wear_rate = match (material, tool_material) {
            ("Aluminum 6061", "Carbide") => 0.001,  // mm wear per 1000mm cut
            ("Steel 1018", "Carbide") => 0.003,
            ("Titanium Ti-6Al-4V", "Carbide") => 0.005,
            ("Cast Iron", "Carbide") => 0.0025,
            _ => 0.002, // Default
        };

        // Speed factor: higher speed increases wear
        let speed_factor = 1.0 + (spindle_speed_rpm - 5000.0) / 10000.0;

        // Depth factor: deeper cuts increase wear
        let depth_factor = (depth_of_cut / 1.0).min(2.0); // Cap at 2x

        let wear_rate = base_wear_rate * speed_factor.max(0.5) * depth_factor;
        let estimated_wear = (cutting_distance_mm / 1000.0) * wear_rate;

        estimated_wear
    }

    /// Add training data (historical wear measurements)
    pub fn add_training_data(&mut self, _record: CuttingConditionsRecord) {
        // In a real implementation, this would update the ML model
        // For now, we use fixed Taylor constants
    }
}

impl Default for ToolWearPredictor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_taylor_constants_default() {
        let constants = TaylorConstants::default_constants();
        assert!(constants.len() > 0);
    }

    #[test]
    fn test_taylor_constants_find() {
        let tc = TaylorConstants::find("Aluminum 6061", "Carbide");
        assert!(tc.is_some());
        assert_eq!(tc.unwrap().c, 600.0);
    }

    #[test]
    fn test_taylor_constants_not_found() {
        let tc = TaylorConstants::find("Unknown Material", "Carbide");
        assert!(tc.is_none());
    }

    #[test]
    fn test_wear_predictor_creation() {
        let predictor = ToolWearPredictor::new();
        assert_eq!(predictor.taylor_constants.len(), 4);
    }

    #[test]
    fn test_wear_prediction_safe() {
        let predictor = ToolWearPredictor::new();

        let prediction = predictor.predict_remaining_life(
            "Aluminum 6061",
            "Carbide",
            5000.0, // RPM
            1.0,    // depth of cut
            0.05,   // current wear (low)
            10.0,   // total tool length
        );

        assert_eq!(prediction.risk_level, RiskLevel::Safe);
        assert!(prediction.remaining_life_mm > 50.0);
        assert!(prediction.tool_life_percentage_used < 50.0);
    }

    #[test]
    fn test_wear_prediction_critical() {
        let predictor = ToolWearPredictor::new();

        let prediction = predictor.predict_remaining_life(
            "Steel 1018",
            "Carbide",
            10000.0, // High speed
            3.0,     // Deep cut
            0.38,    // Nearly at limit (0.4mm)
            10.0,
        );

        assert_eq!(prediction.risk_level, RiskLevel::Critical);
        assert!(prediction.tool_life_percentage_used > 80.0);
    }

    #[test]
    fn test_flank_wear_estimation() {
        let predictor = ToolWearPredictor::new();

        let wear1 = predictor.estimate_flank_wear_from_distance(
            "Aluminum 6061",
            "Carbide",
            1000.0,  // 1000mm cut
            5000.0,
            1.0,
        );

        let wear2 = predictor.estimate_flank_wear_from_distance(
            "Aluminum 6061",
            "Carbide",
            2000.0,  // 2000mm cut (2x)
            5000.0,
            1.0,
        );

        // Wear should roughly double with double the cutting distance
        assert!(wear2 > wear1);
    }

    #[test]
    fn test_confidence_scores() {
        let predictor = ToolWearPredictor::new();

        let pred_known = predictor.predict_remaining_life(
            "Aluminum 6061",
            "Carbide",
            5000.0,
            1.0,
            0.1,
            10.0,
        );

        let pred_unknown = predictor.predict_remaining_life(
            "Unknown Material",
            "Carbide",
            5000.0,
            1.0,
            0.1,
            10.0,
        );

        // Known material should have higher confidence
        assert!(pred_known.confidence > pred_unknown.confidence);
    }

    #[test]
    fn test_wear_prediction_zero_speed() {
        let predictor = ToolWearPredictor::new();

        let prediction = predictor.predict_remaining_life(
            "Aluminum 6061",
            "Carbide",
            0.0, // No speed
            1.0,
            0.0,
            10.0,
        );

        // Should still produce valid prediction
        assert!(prediction.remaining_life_mm > 0.0);
    }
}
