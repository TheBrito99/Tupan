//! Design-for-Manufacturability (DFM) Checking
//!
//! Validates PCB and mechanical designs against manufacturability constraints
//! Checks hole sizes, wall thickness, trace widths, and other design rules
//! Provides cost optimization suggestions

use std::collections::HashMap;

/// Severity level for DFM violations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeverityLevel {
    Info,      // Just informational
    Warning,   // Should be addressed
    Critical,  // Must be fixed before manufacturing
}

/// Design-for-Manufacturability check result
#[derive(Debug, Clone)]
pub struct DFMResult {
    pub check_name: String,
    pub severity: SeverityLevel,
    pub message: String,
    pub cost_impact_pct: f64,  // % cost increase if not fixed
    pub recommendation: String,
}

/// PCB Design-for-Manufacturability Checker
#[derive(Debug, Clone)]
pub struct PCBDFMChecker {
    min_hole_diameter_mm: f64,
    min_trace_width_mm: f64,
    min_trace_clearance_mm: f64,
    min_wall_thickness_mm: f64,
    via_cost_per_unit: f64,
    drill_setup_cost: f64,
    high_density_multiplier: f64,  // Cost multiplier for tight designs
}

impl PCBDFMChecker {
    pub fn new() -> Self {
        PCBDFMChecker {
            min_hole_diameter_mm: 0.5,           // Minimum via/hole size
            min_trace_width_mm: 0.2,             // Minimum trace width
            min_trace_clearance_mm: 0.2,         // Minimum clearance
            min_wall_thickness_mm: 2.0,          // Minimum pad-to-edge
            via_cost_per_unit: 0.01,             // $ per via
            drill_setup_cost: 50.0,              // $ per unique hole size
            high_density_multiplier: 1.5,        // Cost multiplier if <10 mil spacing
        }
    }

    /// Check hole diameter constraints
    pub fn check_hole_diameter(&self, hole_diameter_mm: f64) -> Option<DFMResult> {
        if hole_diameter_mm < self.min_hole_diameter_mm {
            return Some(DFMResult {
                check_name: "Hole Diameter".to_string(),
                severity: SeverityLevel::Critical,
                message: format!(
                    "Hole diameter {:.2} mm below minimum {:.2} mm",
                    hole_diameter_mm, self.min_hole_diameter_mm
                ),
                cost_impact_pct: 50.0,
                recommendation: format!(
                    "Increase hole diameter to at least {:.2} mm",
                    self.min_hole_diameter_mm
                ),
            });
        }
        None
    }

    /// Check trace width constraints
    pub fn check_trace_width(&self, trace_width_mm: f64, current_distance_mm: f64) -> Option<DFMResult> {
        // Check minimum width
        if trace_width_mm < self.min_trace_width_mm {
            return Some(DFMResult {
                check_name: "Trace Width".to_string(),
                severity: SeverityLevel::Warning,
                message: format!(
                    "Trace width {:.2} mm below recommended {:.2} mm",
                    trace_width_mm, self.min_trace_width_mm
                ),
                cost_impact_pct: 20.0,
                recommendation: format!(
                    "Increase trace width to {:.2} mm for better yield",
                    self.min_trace_width_mm
                ),
            });
        }

        // Check clearance constraints
        if current_distance_mm < self.min_trace_clearance_mm {
            return Some(DFMResult {
                check_name: "Trace Clearance".to_string(),
                severity: SeverityLevel::Critical,
                message: format!(
                    "Trace clearance {:.2} mm below minimum {:.2} mm",
                    current_distance_mm, self.min_trace_clearance_mm
                ),
                cost_impact_pct: 30.0,
                recommendation: format!(
                    "Increase clearance to {:.2} mm",
                    self.min_trace_clearance_mm
                ),
            });
        }

        None
    }

    /// Check via density (too many vias = higher cost)
    pub fn check_via_density(
        &self,
        via_count: usize,
        board_area_mm2: f64,
    ) -> Option<DFMResult> {
        let via_density = via_count as f64 / board_area_mm2;

        if via_density > 10.0 {  // More than 10 vias per mm²
            let severity = if via_density > 20.0 {
                SeverityLevel::Critical
            } else {
                SeverityLevel::Warning
            };

            return Some(DFMResult {
                check_name: "Via Density".to_string(),
                severity,
                message: format!(
                    "High via density: {:.1} vias/mm² (cost multiplier: 2-3x)",
                    via_density
                ),
                cost_impact_pct: 100.0 + (via_density - 10.0) * 10.0,
                recommendation: "Reduce via count or increase board size".to_string(),
            });
        }

        None
    }

    /// Calculate PCB cost impact
    pub fn estimate_cost_impact(&self, design_metrics: &DesignMetrics) -> f64 {
        let mut cost_multiplier = 1.0;

        // Via cost
        cost_multiplier += (design_metrics.via_count as f64) * self.via_cost_per_unit;

        // Unique hole sizes (each adds setup cost)
        let unique_holes = design_metrics.unique_hole_sizes.len() as f64;
        cost_multiplier += (unique_holes * self.drill_setup_cost) / 100.0;

        // High-density penalty
        if design_metrics.min_trace_clearance_mm < 0.254 {
            cost_multiplier *= self.high_density_multiplier;
        }

        // Aspect ratio penalty for thin walls
        if design_metrics.min_wall_thickness_mm < self.min_wall_thickness_mm {
            cost_multiplier *= 1.2;
        }

        cost_multiplier
    }

    /// Run all PCB DFM checks
    pub fn check_pcb_design(&self, metrics: &DesignMetrics) -> Vec<DFMResult> {
        let mut results = Vec::new();

        // Check each hole diameter
        for &hole_diameter in &metrics.hole_diameters {
            if let Some(result) = self.check_hole_diameter(hole_diameter) {
                results.push(result);
            }
        }

        // Check trace widths
        for &trace_width in &metrics.trace_widths {
            if let Some(result) = self.check_trace_width(trace_width, metrics.min_trace_clearance_mm) {
                results.push(result);
            }
        }

        // Check via density
        if let Some(result) = self.check_via_density(metrics.via_count, metrics.board_area_mm2) {
            results.push(result);
        }

        // Check wall thickness
        if metrics.min_wall_thickness_mm < self.min_wall_thickness_mm {
            results.push(DFMResult {
                check_name: "Wall Thickness".to_string(),
                severity: SeverityLevel::Warning,
                message: format!(
                    "Minimum wall thickness {:.2} mm below {:.2} mm",
                    metrics.min_wall_thickness_mm, self.min_wall_thickness_mm
                ),
                cost_impact_pct: 15.0,
                recommendation: format!(
                    "Increase wall thickness to {:.2} mm for better reliability",
                    self.min_wall_thickness_mm
                ),
            });
        }

        // Check aspect ratio (via hole diameter vs depth)
        if metrics.via_depth_mm > 0.0 {
            let aspect_ratio = metrics.via_depth_mm / metrics.min_hole_diameter.max(0.5);
            if aspect_ratio > 8.0 {
                results.push(DFMResult {
                    check_name: "Via Aspect Ratio".to_string(),
                    severity: SeverityLevel::Critical,
                    message: format!(
                        "Via aspect ratio {:.1} exceeds 8:1 limit (risk of incomplete plating)",
                        aspect_ratio
                    ),
                    cost_impact_pct: 40.0,
                    recommendation: "Reduce board thickness or increase via diameter".to_string(),
                });
            }
        }

        results
    }
}

/// Design metrics for DFM analysis
#[derive(Debug, Clone)]
pub struct DesignMetrics {
    pub hole_diameters: Vec<f64>,
    pub trace_widths: Vec<f64>,
    pub min_trace_clearance_mm: f64,
    pub min_wall_thickness_mm: f64,
    pub via_count: usize,
    pub board_area_mm2: f64,
    pub via_depth_mm: f64,
    pub unique_hole_sizes: Vec<f64>,
    pub min_hole_diameter: f64,
}

/// Mechanical Design-for-Manufacturability Checker
#[derive(Debug, Clone)]
pub struct MechanicalDFMChecker {
    min_wall_thickness_mm: f64,
    min_feature_size_mm: f64,
    max_aspect_ratio: f64,
    min_fillet_radius_mm: f64,
    draft_angle_degrees: f64,
}

impl MechanicalDFMChecker {
    pub fn new() -> Self {
        MechanicalDFMChecker {
            min_wall_thickness_mm: 1.5,
            min_feature_size_mm: 1.0,
            max_aspect_ratio: 8.0,
            min_fillet_radius_mm: 0.5,
            draft_angle_degrees: 2.0,
        }
    }

    /// Check wall thickness for injection molding
    pub fn check_wall_thickness(&self, thickness_mm: f64) -> Option<DFMResult> {
        if thickness_mm < self.min_wall_thickness_mm {
            return Some(DFMResult {
                check_name: "Wall Thickness (Mold)".to_string(),
                severity: SeverityLevel::Warning,
                message: format!(
                    "Wall thickness {:.2} mm below recommended {:.2} mm",
                    thickness_mm, self.min_wall_thickness_mm
                ),
                cost_impact_pct: 25.0,
                recommendation: format!(
                    "Increase thickness to {:.2} mm for uniform cooling",
                    self.min_wall_thickness_mm
                ),
            });
        }

        if thickness_mm > self.min_wall_thickness_mm * 4.0 {
            return Some(DFMResult {
                check_name: "Wall Thickness Variation".to_string(),
                severity: SeverityLevel::Warning,
                message: format!(
                    "Wall thickness {:.2} mm too thick relative to minimum (ratio > 4:1)",
                    thickness_mm
                ),
                cost_impact_pct: 20.0,
                recommendation: "Reduce thickness or add ribs for stiffness".to_string(),
            });
        }

        None
    }

    /// Check aspect ratio (depth to diameter)
    pub fn check_aspect_ratio(&self, depth_mm: f64, width_mm: f64) -> Option<DFMResult> {
        let aspect_ratio = depth_mm / width_mm.max(0.1);

        if aspect_ratio > self.max_aspect_ratio {
            return Some(DFMResult {
                check_name: "Aspect Ratio".to_string(),
                severity: SeverityLevel::Warning,
                message: format!(
                    "Aspect ratio {:.1} exceeds {:.1} limit",
                    aspect_ratio, self.max_aspect_ratio
                ),
                cost_impact_pct: 30.0,
                recommendation: format!(
                    "Reduce depth or increase width to improve manufacturability"
                ),
            });
        }

        None
    }

    /// Check for sharp edges (should have fillets)
    pub fn check_fillet_radius(&self, radius_mm: f64) -> Option<DFMResult> {
        if radius_mm < self.min_fillet_radius_mm && radius_mm > 0.0 {
            return Some(DFMResult {
                check_name: "Fillet Radius".to_string(),
                severity: SeverityLevel::Info,
                message: format!(
                    "Small fillet radius {:.2} mm (minimum recommended {:.2} mm)",
                    radius_mm, self.min_fillet_radius_mm
                ),
                cost_impact_pct: 10.0,
                recommendation: format!(
                    "Use radius {:.2} mm for easier tool changes and better surface finish",
                    self.min_fillet_radius_mm
                ),
            });
        }

        None
    }

    /// Check draft angle for molding
    pub fn check_draft_angle(&self, angle_degrees: f64) -> Option<DFMResult> {
        if angle_degrees < self.draft_angle_degrees && angle_degrees > 0.0 {
            return Some(DFMResult {
                check_name: "Draft Angle".to_string(),
                severity: SeverityLevel::Info,
                message: format!(
                    "Small draft angle {:.1}° (recommended {:.1}° minimum)",
                    angle_degrees, self.draft_angle_degrees
                ),
                cost_impact_pct: 15.0,
                recommendation: format!(
                    "Increase draft angle to {:.1}° for easier mold release",
                    self.draft_angle_degrees
                ),
            });
        }

        None
    }

    /// Run all mechanical DFM checks
    pub fn check_mechanical_design(&self, metrics: &MechanicalMetrics) -> Vec<DFMResult> {
        let mut results = Vec::new();

        // Check wall thickness
        if let Some(result) = self.check_wall_thickness(metrics.wall_thickness_mm) {
            results.push(result);
        }

        // Check aspect ratios
        for &(depth, width) in &metrics.aspect_ratios {
            if let Some(result) = self.check_aspect_ratio(depth, width) {
                results.push(result);
            }
        }

        // Check fillet radii
        for &radius in &metrics.fillet_radii_mm {
            if let Some(result) = self.check_fillet_radius(radius) {
                results.push(result);
            }
        }

        // Check draft angles
        for &angle in &metrics.draft_angles_degrees {
            if let Some(result) = self.check_draft_angle(angle) {
                results.push(result);
            }
        }

        results
    }
}

/// Mechanical design metrics for DFM analysis
#[derive(Debug, Clone)]
pub struct MechanicalMetrics {
    pub wall_thickness_mm: f64,
    pub aspect_ratios: Vec<(f64, f64)>,  // (depth, width) pairs
    pub fillet_radii_mm: Vec<f64>,
    pub draft_angles_degrees: Vec<f64>,
}

/// Cost estimation model
#[derive(Debug, Clone)]
pub struct CostEstimator {
    base_cost_usd: f64,
    material_cost_per_gram: f64,
    labor_cost_per_hour: f64,
}

impl CostEstimator {
    pub fn new() -> Self {
        CostEstimator {
            base_cost_usd: 10.0,
            material_cost_per_gram: 0.02,  // $0.02 per gram for typical plastic
            labor_cost_per_hour: 50.0,
        }
    }

    /// Estimate manufacturing cost
    pub fn estimate_cost(
        &self,
        weight_grams: f64,
        machining_hours: f64,
        dfm_multiplier: f64,
    ) -> f64 {
        let material_cost = weight_grams * self.material_cost_per_gram;
        let labor_cost = machining_hours * self.labor_cost_per_hour;
        (self.base_cost_usd + material_cost + labor_cost) * dfm_multiplier
    }

    /// Compare cost with and without DFM improvements
    pub fn estimate_savings(
        &self,
        original_cost: f64,
        improved_cost: f64,
    ) -> f64 {
        original_cost - improved_cost
    }
}

impl Default for PCBDFMChecker {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for MechanicalDFMChecker {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for CostEstimator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pcb_dfm_checker_creation() {
        let checker = PCBDFMChecker::new();
        assert_eq!(checker.min_hole_diameter_mm, 0.5);
        assert_eq!(checker.min_trace_width_mm, 0.2);
    }

    #[test]
    fn test_hole_diameter_check_valid() {
        let checker = PCBDFMChecker::new();
        let result = checker.check_hole_diameter(1.0);
        assert!(result.is_none());
    }

    #[test]
    fn test_hole_diameter_check_invalid() {
        let checker = PCBDFMChecker::new();
        let result = checker.check_hole_diameter(0.3);
        assert!(result.is_some());
        assert_eq!(result.unwrap().severity, SeverityLevel::Critical);
    }

    #[test]
    fn test_trace_width_check() {
        let checker = PCBDFMChecker::new();
        let result = checker.check_trace_width(0.1, 0.2);
        assert!(result.is_some());
        assert_eq!(result.unwrap().severity, SeverityLevel::Warning);
    }

    #[test]
    fn test_via_density_check_low() {
        let checker = PCBDFMChecker::new();
        let result = checker.check_via_density(10, 10.0);  // 1 via/mm²
        assert!(result.is_none());
    }

    #[test]
    fn test_via_density_check_high() {
        let checker = PCBDFMChecker::new();
        let result = checker.check_via_density(101, 5.0);  // 20.2 vias/mm² (> 20)
        assert!(result.is_some());
        assert_eq!(result.unwrap().severity, SeverityLevel::Critical);
    }

    #[test]
    fn test_mechanical_dfm_checker_creation() {
        let checker = MechanicalDFMChecker::new();
        assert_eq!(checker.min_wall_thickness_mm, 1.5);
        assert_eq!(checker.max_aspect_ratio, 8.0);
    }

    #[test]
    fn test_wall_thickness_check_valid() {
        let checker = MechanicalDFMChecker::new();
        let result = checker.check_wall_thickness(2.0);
        assert!(result.is_none());
    }

    #[test]
    fn test_wall_thickness_check_too_thin() {
        let checker = MechanicalDFMChecker::new();
        let result = checker.check_wall_thickness(1.0);
        assert!(result.is_some());
        assert_eq!(result.unwrap().severity, SeverityLevel::Warning);
    }

    #[test]
    fn test_aspect_ratio_check() {
        let checker = MechanicalDFMChecker::new();
        let result = checker.check_aspect_ratio(10.0, 1.0);  // 10:1
        assert!(result.is_some());
        assert_eq!(result.unwrap().severity, SeverityLevel::Warning);
    }

    #[test]
    fn test_cost_estimator() {
        let estimator = CostEstimator::new();
        let cost = estimator.estimate_cost(100.0, 1.0, 1.0);
        assert!(cost > 0.0);
        assert!(cost > 10.0);  // Should be > base cost
    }

    #[test]
    fn test_cost_savings_calculation() {
        let estimator = CostEstimator::new();
        let savings = estimator.estimate_savings(100.0, 80.0);
        assert_eq!(savings, 20.0);
    }
}
