//! Specialty Cutting Tools
//!
//! Advanced tools for specific operations: threading, form cutting, undercuts, T-slots.

use serde::{Deserialize, Serialize};

/// Thread specifications for threading tools
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ThreadType {
    MetricCoarse,
    MetricFine,
    UNC,  // Unified National Coarse
    UNF,  // Unified National Fine
    NPT,  // National Pipe Thread
    BSPT, // British Standard Pipe Thread
    Acme,
    Square,
}

impl ThreadType {
    pub fn pitch_mm(&self, diameter_mm: f64) -> f64 {
        match self {
            Self::MetricCoarse => {
                if diameter_mm <= 1.6 {
                    0.2
                } else if diameter_mm <= 3.0 {
                    0.35
                } else if diameter_mm <= 6.0 {
                    0.5
                } else if diameter_mm <= 10.0 {
                    1.0
                } else if diameter_mm <= 18.0 {
                    1.5
                } else if diameter_mm <= 24.0 {
                    2.0
                } else if diameter_mm <= 30.0 {
                    3.0
                } else {
                    4.0
                }
            }
            Self::MetricFine => {
                if diameter_mm <= 8.0 {
                    0.75
                } else if diameter_mm <= 14.0 {
                    1.0
                } else if diameter_mm <= 20.0 {
                    1.5
                } else {
                    2.0
                }
            }
            Self::UNC => {
                // Approximation for UNC pitch
                25.4 / (if diameter_mm < 6.0 { 32 } else { 24 }) as f64
            }
            Self::UNF => {
                // Approximation for UNF pitch
                25.4 / (if diameter_mm < 6.0 { 48 } else { 36 }) as f64
            }
            Self::NPT => 1.814,  // ~1.814 mm for standard NPT
            Self::BSPT => 1.337, // ~1.337 mm for standard BSPT
            Self::Acme => 2.0,   // Typical Acme pitch
            Self::Square => 2.0, // Typical Square pitch
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            Self::MetricCoarse => "Metric Coarse Thread",
            Self::MetricFine => "Metric Fine Thread",
            Self::UNC => "Unified National Coarse",
            Self::UNF => "Unified National Fine",
            Self::NPT => "National Pipe Thread (Tapered)",
            Self::BSPT => "British Standard Pipe Thread (Tapered)",
            Self::Acme => "Acme (Power Transmission)",
            Self::Square => "Square Thread",
        }
    }
}

/// Form cutter profile type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FormType {
    Constant,       // Constant radius (convex or concave)
    Angular,        // V-shaped or angular form
    Complex,        // Multi-feature custom form
}

/// Threading tool configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadMill {
    pub tool_diameter: f64,        // mm
    pub thread_diameter: f64,      // mm
    pub thread_pitch: f64,         // mm
    pub thread_type: ThreadType,
    pub min_hole_diameter: f64,    // mm (minimum hole needed)
    pub flute_count: u32,
    pub shank_diameter: f64,       // mm
}

impl ThreadMill {
    pub fn new(thread_diameter: f64, thread_type: ThreadType) -> Self {
        let pitch = thread_type.pitch_mm(thread_diameter);

        ThreadMill {
            tool_diameter: thread_diameter + 0.5,  // Slightly larger than thread
            thread_diameter,
            thread_pitch: pitch,
            thread_type,
            min_hole_diameter: thread_diameter - pitch,
            flute_count: 2,
            shank_diameter: 6.0,
        }
    }

    pub fn validate_hole_diameter(&self, hole_diameter: f64) -> bool {
        hole_diameter >= self.min_hole_diameter && hole_diameter <= self.thread_diameter
    }

    pub fn thread_info(&self) -> String {
        format!(
            "{} - Ø{:.2}mm, Pitch {:.2}mm",
            self.thread_type.description(),
            self.thread_diameter,
            self.thread_pitch
        )
    }
}

/// Form cutter for specific profiles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormCutter {
    pub name: String,
    pub profile_type: FormType,
    pub radius_mm: f64,               // For constant radius forms
    pub corner_angle: Option<f64>,    // Degrees, for angular forms
    pub tool_diameter: f64,           // mm
    pub cutting_edge_radius: f64,     // mm
    pub shank_diameter: f64,          // mm
}

impl FormCutter {
    pub fn constant_radius(name: &str, radius: f64) -> Self {
        FormCutter {
            name: name.to_string(),
            profile_type: FormType::Constant,
            radius_mm: radius,
            corner_angle: None,
            tool_diameter: radius * 2.0,
            cutting_edge_radius: radius,
            shank_diameter: 6.0,
        }
    }

    pub fn angular_profile(name: &str, angle: f64) -> Self {
        FormCutter {
            name: name.to_string(),
            profile_type: FormType::Angular,
            radius_mm: 0.0,
            corner_angle: Some(angle),
            tool_diameter: 3.0,
            cutting_edge_radius: 0.0,
            shank_diameter: 6.0,
        }
    }

    pub fn description(&self) -> String {
        match self.profile_type {
            FormType::Constant => format!("{} - R{:.2}mm Constant Radius", self.name, self.radius_mm),
            FormType::Angular => format!(
                "{} - {}° Angular Form",
                self.name,
                self.corner_angle.unwrap_or(0.0)
            ),
            FormType::Complex => format!("{} - Complex Form", self.name),
        }
    }
}

/// Undercut tool for creating undercuts below shoulders
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndercutTool {
    pub tool_diameter: f64,        // mm
    pub undercut_depth: f64,       // mm (depth below shoulder)
    pub undercut_angle: f64,       // degrees (typically 45° or 90°)
    pub cutting_length: f64,       // mm
    pub shank_diameter: f64,       // mm
}

impl UndercutTool {
    pub fn new(diameter: f64, depth: f64, angle: f64) -> Self {
        UndercutTool {
            tool_diameter: diameter,
            undercut_depth: depth,
            undercut_angle: angle,
            cutting_length: depth + 2.0,
            shank_diameter: 6.0,
        }
    }

    pub fn verify_geometry(&self, shoulder_diameter: f64) -> bool {
        // Tool must be smaller than shoulder to fit underneath
        self.tool_diameter < shoulder_diameter
    }
}

/// T-slot cutting tool for T-nut slots
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TSlotTool {
    pub slot_width: f64,           // mm
    pub slot_height: f64,          // mm (depth of T-slot head)
    pub slot_depth: f64,           // Total depth including vertical slot
    pub cutter_diameter: f64,      // mm (horizontal cutter)
    pub shank_diameter: f64,       // mm
}

impl TSlotTool {
    pub fn new(width: f64, height: f64, depth: f64) -> Self {
        TSlotTool {
            slot_width: width,
            slot_height: height,
            slot_depth: depth,
            cutter_diameter: width + 0.5,
            shank_diameter: 6.0,
        }
    }

    pub fn verify_slot_dimensions(&self, workpiece_width: f64, available_depth: f64) -> bool {
        // Slot must fit within workpiece
        workpiece_width >= self.slot_width && available_depth >= self.slot_depth
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metric_thread_pitch() {
        assert_eq!(ThreadType::MetricCoarse.pitch_mm(5.0), 0.5);
        assert_eq!(ThreadType::MetricCoarse.pitch_mm(10.0), 1.0);
        assert_eq!(ThreadType::MetricCoarse.pitch_mm(20.0), 2.0);
    }

    #[test]
    fn test_metric_fine_thread_pitch() {
        assert_eq!(ThreadType::MetricFine.pitch_mm(8.0), 0.75);
        assert_eq!(ThreadType::MetricFine.pitch_mm(10.0), 1.0);
    }

    #[test]
    fn test_thread_mill_creation() {
        let mill = ThreadMill::new(10.0, ThreadType::MetricCoarse);
        assert_eq!(mill.thread_diameter, 10.0);
        assert_eq!(mill.thread_pitch, 1.0);
        assert!(mill.min_hole_diameter < mill.thread_diameter);
    }

    #[test]
    fn test_thread_mill_hole_validation() {
        let mill = ThreadMill::new(10.0, ThreadType::MetricCoarse);
        assert!(mill.validate_hole_diameter(9.0));    // Valid (9.0mm hole)
        assert!(!mill.validate_hole_diameter(8.0));   // Too small
        assert!(!mill.validate_hole_diameter(10.1));  // Too large
    }

    #[test]
    fn test_form_cutter_constant_radius() {
        let cutter = FormCutter::constant_radius("Radius Cutter", 2.5);
        assert_eq!(cutter.profile_type, FormType::Constant);
        assert_eq!(cutter.radius_mm, 2.5);
        assert_eq!(cutter.tool_diameter, 5.0);
    }

    #[test]
    fn test_form_cutter_angular() {
        let cutter = FormCutter::angular_profile("Angular Cutter", 45.0);
        assert_eq!(cutter.profile_type, FormType::Angular);
        assert_eq!(cutter.corner_angle, Some(45.0));
    }

    #[test]
    fn test_undercut_tool_creation() {
        let tool = UndercutTool::new(3.0, 2.0, 45.0);
        assert_eq!(tool.tool_diameter, 3.0);
        assert_eq!(tool.undercut_depth, 2.0);
        assert_eq!(tool.undercut_angle, 45.0);
    }

    #[test]
    fn test_undercut_verification() {
        let tool = UndercutTool::new(3.0, 2.0, 45.0);
        assert!(tool.verify_geometry(5.0));   // Shoulder larger than tool
        assert!(!tool.verify_geometry(2.0));  // Shoulder smaller than tool
    }

    #[test]
    fn test_tslot_tool_creation() {
        let tool = TSlotTool::new(10.0, 5.0, 15.0);
        assert_eq!(tool.slot_width, 10.0);
        assert_eq!(tool.slot_height, 5.0);
        assert_eq!(tool.slot_depth, 15.0);
    }

    #[test]
    fn test_tslot_verification() {
        let tool = TSlotTool::new(10.0, 5.0, 15.0);
        assert!(tool.verify_slot_dimensions(20.0, 20.0));   // Fits
        assert!(!tool.verify_slot_dimensions(8.0, 20.0));   // Width too small
        assert!(!tool.verify_slot_dimensions(20.0, 10.0));  // Depth too small
    }

    #[test]
    fn test_thread_types_description() {
        assert_eq!(
            ThreadType::MetricCoarse.description(),
            "Metric Coarse Thread"
        );
        assert_eq!(
            ThreadType::UNC.description(),
            "Unified National Coarse"
        );
        assert_eq!(
            ThreadType::NPT.description(),
            "National Pipe Thread (Tapered)"
        );
    }
}
