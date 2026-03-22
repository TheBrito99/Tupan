/**
 * Cutting Strategies
 * Different machining strategies and toolpath generation approaches
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::toolpath::{Point3D, ToolpathSegment, Toolpath, SegmentType, CuttingConditions};
use crate::manufacturing::multi_axis::{Point6D, ToolOrientation};

/// Strategy type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StrategyType {
    Facing,         // 2D face milling
    Adaptive,       // Adaptive clearing with constant load
    Pencil,         // Final finishing pass
    Spiral,         // Spiral interpolation
    Ramping,        // Helical ramp entry
    Pocketing,      // Pocket clearance
    Profiling,      // Profile/contour cutting
    Drilling,       // Hole drilling
}

/// Facing strategy (2D rectangular milling)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceStrategy {
    pub stepover: f64,  // mm (distance between parallel passes)
    pub direction: StrategyDirection,
    pub pattern: StrategyPattern,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StrategyDirection {
    XPositive,
    YPositive,
    Diagonal,
    Circular,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StrategyPattern {
    Linear,     // Parallel lines
    Zigzag,     // Back-and-forth
    Spiral,     // Spiral outward/inward
    Offset,     // Offset contour
}

impl FaceStrategy {
    pub fn new(stepover: f64) -> Self {
        FaceStrategy {
            stepover,
            direction: StrategyDirection::XPositive,
            pattern: StrategyPattern::Zigzag,
        }
    }

    /// Generate facing toolpath for rectangular area
    pub fn generate(
        &self,
        min_x: f64,
        max_x: f64,
        min_y: f64,
        max_y: f64,
        tool_id: String,
    ) -> Toolpath {
        let mut toolpath = Toolpath::new(
            uuid::Uuid::new_v4().to_string(),
            "Facing Pass".to_string(),
        );

        let width = max_x - min_x;
        let height = max_y - min_y;
        let num_passes = ((height / self.stepover).ceil() as usize).max(1);

        let conditions = CuttingConditions {
            spindle_speed: 1000.0,
            feedrate: 500.0,
            depth_of_cut: 2.0,
            tool_id: tool_id.clone(),
        };

        match self.direction {
            StrategyDirection::XPositive => {
                self.generate_x_passes(&mut toolpath, min_x, max_x, min_y, num_passes, &conditions);
            }
            StrategyDirection::YPositive => {
                self.generate_y_passes(&mut toolpath, min_y, max_y, min_x, num_passes, &conditions);
            }
            StrategyDirection::Diagonal => {
                self.generate_diagonal(&mut toolpath, min_x, max_x, min_y, max_y, &conditions);
            }
            StrategyDirection::Circular => {
                self.generate_circular(&mut toolpath, min_x, max_x, min_y, max_y, &conditions);
            }
        }

        toolpath
    }

    fn generate_x_passes(
        &self,
        toolpath: &mut Toolpath,
        min_x: f64,
        max_x: f64,
        min_y: f64,
        num_passes: usize,
        conditions: &CuttingConditions,
    ) {
        for i in 0..num_passes {
            let y = min_y + (i as f64) * self.stepover;
            let start = Point3D::new(min_x, y, 0.0);
            let end = if i % 2 == 0 {
                Point3D::new(max_x, y, 0.0)
            } else {
                Point3D::new(min_x, y, 0.0)
            };

            toolpath.add_segment(ToolpathSegment::linear_cut(start, end, conditions.clone()));
        }
    }

    fn generate_y_passes(
        &self,
        toolpath: &mut Toolpath,
        min_y: f64,
        max_y: f64,
        min_x: f64,
        num_passes: usize,
        conditions: &CuttingConditions,
    ) {
        for i in 0..num_passes {
            let x = min_x + (i as f64) * self.stepover;
            let start = Point3D::new(x, min_y, 0.0);
            let end = if i % 2 == 0 {
                Point3D::new(x, max_y, 0.0)
            } else {
                Point3D::new(x, min_y, 0.0)
            };

            toolpath.add_segment(ToolpathSegment::linear_cut(start, end, conditions.clone()));
        }
    }

    fn generate_diagonal(
        &self,
        toolpath: &mut Toolpath,
        min_x: f64,
        max_x: f64,
        min_y: f64,
        max_y: f64,
        conditions: &CuttingConditions,
    ) {
        let width = max_x - min_x;
        let height = max_y - min_y;
        let num_passes = ((width.hypot(height) / self.stepover).ceil() as usize).max(1);

        for i in 0..num_passes {
            let offset = (i as f64) * self.stepover;
            let start = Point3D::new(min_x + offset, min_y, 0.0);
            let end = Point3D::new(min_x + offset + height, min_y + height, 0.0);
            toolpath.add_segment(ToolpathSegment::linear_cut(start, end, conditions.clone()));
        }
    }

    fn generate_circular(
        &self,
        toolpath: &mut Toolpath,
        min_x: f64,
        max_x: f64,
        min_y: f64,
        max_y: f64,
        conditions: &CuttingConditions,
    ) {
        let center_x = (min_x + max_x) / 2.0;
        let center_y = (min_y + max_y) / 2.0;
        let max_radius = ((max_x - min_x) / 2.0).max((max_y - min_y) / 2.0);

        let num_circles = ((max_radius / self.stepover).ceil() as usize).max(1);

        for i in 0..num_circles {
            let radius = max_radius - (i as f64) * self.stepover;
            let num_points = ((2.0 * std::f64::consts::PI * radius / self.stepover).ceil() as usize)
                .max(8);

            for j in 0..num_points {
                let angle = 2.0 * std::f64::consts::PI * (j as f64) / (num_points as f64);
                let x = center_x + radius * angle.cos();
                let y = center_y + radius * angle.sin();

                let point = Point3D::new(x, y, 0.0);
                if j == 0 {
                    // Move to start position
                    if !toolpath.segments.is_empty() {
                        let last = &toolpath.segments[toolpath.segments.len() - 1];
                        toolpath.add_segment(ToolpathSegment::rapid(last.end, point, conditions.tool_id.clone()));
                    }
                } else {
                    let prev_angle = 2.0 * std::f64::consts::PI * ((j - 1) as f64) / (num_points as f64);
                    let prev_x = center_x + radius * prev_angle.cos();
                    let prev_y = center_y + radius * prev_angle.sin();
                    let prev = Point3D::new(prev_x, prev_y, 0.0);
                    toolpath.add_segment(ToolpathSegment::linear_cut(prev, point, conditions.clone()));
                }
            }
        }
    }
}

/// Adaptive clearing strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveStrategy {
    pub target_load: f64,        // Target chip load (mm/tooth)
    pub min_stepover: f64,       // Minimum stepover (mm)
    pub max_stepover: f64,       // Maximum stepover (mm)
    pub keep_engagement: bool,   // Try to maintain constant load
}

impl AdaptiveStrategy {
    pub fn new(target_load: f64) -> Self {
        AdaptiveStrategy {
            target_load,
            min_stepover: 0.5,
            max_stepover: 5.0,
            keep_engagement: true,
        }
    }

    /// Calculate adaptive stepover based on current load
    pub fn calculate_stepover(&self, current_load: f64) -> f64 {
        if current_load <= 0.0 {
            return self.max_stepover;
        }

        let ratio = self.target_load / current_load;
        let stepover = self.target_load * ratio;

        stepover
            .max(self.min_stepover)
            .min(self.max_stepover)
    }

    /// Generate adaptive clearing pass
    pub fn generate(
        &self,
        start: Point3D,
        end: Point3D,
        conditions: CuttingConditions,
    ) -> Toolpath {
        let mut toolpath = Toolpath::new(
            uuid::Uuid::new_v4().to_string(),
            "Adaptive Clear".to_string(),
        );

        toolpath.add_segment(ToolpathSegment::linear_cut(start, end, conditions));
        toolpath
    }
}

/// Pencil finishing strategy (small diameter, shallow depth)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PencilStrategy {
    pub pass_depth: f64,      // depth per pass (mm)
    pub parallel_spacing: f64, // spacing between parallel passes (mm)
}

impl PencilStrategy {
    pub fn new(pass_depth: f64) -> Self {
        PencilStrategy {
            pass_depth,
            parallel_spacing: 0.5,
        }
    }

    /// Generate finishing pass
    pub fn generate(&self, depth: f64, conditions: CuttingConditions) -> Toolpath {
        let mut toolpath = Toolpath::new(
            uuid::Uuid::new_v4().to_string(),
            "Pencil Finish".to_string(),
        );

        let num_passes = ((depth / self.pass_depth).ceil() as usize).max(1);
        let mut current_depth = -self.pass_depth;

        for _ in 0..num_passes {
            let z = current_depth;
            let start = Point3D::new(0.0, 0.0, z);
            let end = Point3D::new(10.0, 0.0, z);

            toolpath.add_segment(ToolpathSegment::linear_cut(start, end, conditions.clone()));
            current_depth -= self.pass_depth;
        }

        toolpath
    }
}

/// Generic cutting strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingStrategy {
    pub strategy_type: StrategyType,
    pub stepover: f64,
    pub depth_per_pass: f64,
    pub ramp_angle: Option<f64>, // Helical ramp angle (degrees)
}

impl CuttingStrategy {
    pub fn new(strategy_type: StrategyType, stepover: f64, depth_per_pass: f64) -> Self {
        CuttingStrategy {
            strategy_type,
            stepover,
            depth_per_pass,
            ramp_angle: None,
        }
    }

    /// Set helical ramp angle for ramping entry
    pub fn with_ramp(mut self, angle: f64) -> Self {
        self.ramp_angle = Some(angle);
        self
    }
}

// ============================================================================
// Multi-Axis Strategies (4-axis and 5-axis machining)
// ============================================================================

/// Trait for cutting strategies used in multi-axis machining
pub trait MultiAxisCuttingStrategy {
    /// Get the strategy name
    fn name(&self) -> &str;

    /// Get the strategy description
    fn description(&self) -> &str;

    /// Check if strategy supports tool tilt
    fn supports_tool_tilt(&self) -> bool;

    /// Check if strategy supports simultaneous multi-axis
    fn supports_simultaneous_axes(&self) -> bool;
}

/// Indexed 4-Axis Machining Strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Indexed4AxisStrategy {
    /// Discrete rotation angles (degrees)
    pub index_angles: Vec<f64>,
    /// 3-axis toolpath for each index position
    pub base_toolpath: Toolpath,
    /// Approach strategy for each index
    pub approach_type: ApproachType,
    /// Rapid move height between operations
    pub rapid_height: f64,
    /// Tool axis for this strategy
    pub tool_axis: (f64, f64, f64),
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ApproachType {
    Radial,
    Axial,
    Plunge,
}

impl Indexed4AxisStrategy {
    /// Create a new indexed 4-axis strategy
    pub fn new(
        index_angles: Vec<f64>,
        base_toolpath: Toolpath,
        approach_type: ApproachType,
        rapid_height: f64,
    ) -> Self {
        Indexed4AxisStrategy {
            index_angles,
            base_toolpath,
            approach_type,
            rapid_height,
            tool_axis: (0.0, 0.0, -1.0),
        }
    }

    /// Standard 90-degree indexed strategy
    pub fn standard_4axis(base_toolpath: Toolpath) -> Self {
        Indexed4AxisStrategy::new(
            vec![0.0, 90.0, 180.0, 270.0],
            base_toolpath,
            ApproachType::Radial,
            10.0,
        )
    }

    /// 180-degree indexed strategy
    pub fn two_sided_indexing(base_toolpath: Toolpath) -> Self {
        Indexed4AxisStrategy::new(
            vec![0.0, 180.0],
            base_toolpath,
            ApproachType::Axial,
            10.0,
        )
    }

    /// Custom indexed angles
    pub fn with_custom_angles(
        angles: Vec<f64>,
        base_toolpath: Toolpath,
        approach_type: ApproachType,
    ) -> Self {
        Indexed4AxisStrategy::new(angles, base_toolpath, approach_type, 10.0)
    }

    /// Get the total number of index positions
    pub fn num_indices(&self) -> usize {
        self.index_angles.len()
    }

    /// Validate that all index angles are within reasonable range
    pub fn validate_index_angles(&self) -> Result<(), String> {
        for angle in &self.index_angles {
            if angle.is_nan() || angle.is_infinite() {
                return Err(format!("Invalid index angle: {}", angle));
            }
        }

        let mut angles_sorted = self.index_angles.clone();
        angles_sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        for i in 1..angles_sorted.len() {
            if (angles_sorted[i] - angles_sorted[i - 1]).abs() < 1e-6 {
                return Err("Duplicate index angles detected".to_string());
            }
        }

        Ok(())
    }

    /// Estimate machine time
    pub fn estimate_machine_time(&self) -> f64 {
        let mut total_time = 0.0;

        for _ in &self.index_angles {
            for seg in &self.base_toolpath.segments {
                let distance = seg.start.distance_to(&seg.end);
                let feedrate = seg.cutting_conditions.feedrate;

                if feedrate > 0.0 {
                    total_time += distance / feedrate * 60.0;
                }
            }

            total_time += 5.0 / 60.0;
        }

        total_time
    }
}

impl MultiAxisCuttingStrategy for Indexed4AxisStrategy {
    fn name(&self) -> &str {
        "Indexed 4-Axis"
    }

    fn description(&self) -> &str {
        "Indexed 4-axis machining with discrete workpiece rotation angles"
    }

    fn supports_tool_tilt(&self) -> bool {
        false
    }

    fn supports_simultaneous_axes(&self) -> bool {
        false
    }
}

/// Swarf Milling Strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarfMillingStrategy {
    /// Tool tilt angle (degrees)
    pub lead_angle: f64,
    /// Side tilt angle
    pub tilt_angle: f64,
    /// Contact strategy
    pub contact_strategy: ContactStrategy,
    /// Step over distance (mm)
    pub step_over: f64,
    /// Maximum tool tilt from vertical
    pub tilt_limit: f64,
    /// Tool axis direction
    pub tool_axis: (f64, f64, f64),
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ContactStrategy {
    PointContact,
    LineContact,
    SurfaceContact,
}

impl SwarfMillingStrategy {
    /// Create a new swarf milling strategy
    pub fn new(
        lead_angle: f64,
        tilt_angle: f64,
        contact_strategy: ContactStrategy,
        step_over: f64,
        tilt_limit: f64,
    ) -> Self {
        SwarfMillingStrategy {
            lead_angle,
            tilt_angle,
            contact_strategy,
            step_over,
            tilt_limit,
            tool_axis: (0.0, 0.0, -1.0),
        }
    }

    /// Standard flank milling
    pub fn standard_flank(step_over: f64) -> Self {
        SwarfMillingStrategy::new(
            15.0,
            0.0,
            ContactStrategy::LineContact,
            step_over,
            30.0,
        )
    }

    /// Blade milling
    pub fn blade_milling(step_over: f64) -> Self {
        SwarfMillingStrategy::new(
            20.0,
            0.0,
            ContactStrategy::SurfaceContact,
            step_over,
            45.0,
        )
    }

    /// Validate parameters
    pub fn validate_parameters(&self) -> Result<(), String> {
        if self.lead_angle.is_nan() || self.lead_angle.is_infinite() {
            return Err(format!("Invalid lead angle: {}", self.lead_angle));
        }

        if self.step_over <= 0.0 {
            return Err(format!("Step over must be positive, got {}", self.step_over));
        }

        Ok(())
    }

    /// Get contact offset
    pub fn get_contact_offset(&self) -> f64 {
        match self.contact_strategy {
            ContactStrategy::PointContact => 0.0,
            ContactStrategy::LineContact => 2.5,
            ContactStrategy::SurfaceContact => 5.0,
        }
    }

    /// Estimate machine time
    pub fn estimate_machine_time(&self, surface_length: f64, step_count: usize) -> f64 {
        let total_distance = surface_length * step_count as f64;
        let average_feedrate = match self.contact_strategy {
            ContactStrategy::PointContact => 150.0,
            ContactStrategy::LineContact => 200.0,
            ContactStrategy::SurfaceContact => 250.0,
        };

        (total_distance / average_feedrate) * 1.1 * 60.0
    }
}

impl MultiAxisCuttingStrategy for SwarfMillingStrategy {
    fn name(&self) -> &str {
        "Swarf Milling"
    }

    fn description(&self) -> &str {
        "Side/flank milling with constant tool orientation for ruled surfaces"
    }

    fn supports_tool_tilt(&self) -> bool {
        true
    }

    fn supports_simultaneous_axes(&self) -> bool {
        true
    }
}

/// 5-Axis Contouring Strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiveAxisContouringStrategy {
    /// Step over distance (mm)
    pub step_over: f64,
    /// Maximum allowable tool tilt
    pub tilt_limit: f64,
    /// Lead and tilt mode
    pub lead_tilt_mode: LeadTiltMode,
    /// Minimum contact angle
    pub min_contact_angle: f64,
    /// Optimize orientation
    pub optimize_orientation: bool,
    /// Tool flute length
    pub tool_flute_length: f64,
    /// Engagement angle
    pub engagement_angle: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LeadTiltMode {
    LeadOnly,
    TiltOnly,
    Combined,
    Optimized,
}

impl FiveAxisContouringStrategy {
    /// Create a new 5-axis contouring strategy
    pub fn new(
        step_over: f64,
        tilt_limit: f64,
        lead_tilt_mode: LeadTiltMode,
    ) -> Self {
        FiveAxisContouringStrategy {
            step_over,
            tilt_limit,
            lead_tilt_mode,
            min_contact_angle: 5.0,
            optimize_orientation: true,
            tool_flute_length: 10.0,
            engagement_angle: 45.0,
        }
    }

    /// Standard sculpted surface strategy
    pub fn standard_sculpted(step_over: f64) -> Self {
        FiveAxisContouringStrategy::new(step_over, 30.0, LeadTiltMode::Combined)
    }

    /// Aerospace finish
    pub fn aerospace_finish(step_over: f64) -> Self {
        let mut strategy = FiveAxisContouringStrategy::new(step_over, 20.0, LeadTiltMode::Optimized);
        strategy.min_contact_angle = 10.0;
        strategy
    }

    /// Aggressive removal
    pub fn aggressive_removal(step_over: f64) -> Self {
        FiveAxisContouringStrategy::new(step_over, 45.0, LeadTiltMode::LeadOnly)
    }

    /// Validate parameters
    pub fn validate_parameters(&self) -> Result<(), String> {
        if self.step_over <= 0.0 {
            return Err(format!("Step over must be positive, got {}", self.step_over));
        }

        if self.tilt_limit < 0.0 || self.tilt_limit > 90.0 {
            return Err(format!("Tilt limit must be 0-90°, got {}", self.tilt_limit));
        }

        Ok(())
    }

    /// Estimate machine time
    pub fn estimate_machine_time(
        &self,
        surface_length: f64,
        passes: usize,
        average_feedrate: f64,
    ) -> f64 {
        let total_distance = surface_length * passes as f64;
        (total_distance / average_feedrate) * 1.15 * 60.0
    }
}

impl MultiAxisCuttingStrategy for FiveAxisContouringStrategy {
    fn name(&self) -> &str {
        "5-Axis Contouring"
    }

    fn description(&self) -> &str {
        "Simultaneous 5-axis machining for complex sculptured surfaces"
    }

    fn supports_tool_tilt(&self) -> bool {
        true
    }

    fn supports_simultaneous_axes(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_face_strategy_creation() {
        let strategy = FaceStrategy::new(2.0);
        assert_eq!(strategy.stepover, 2.0);
    }

    #[test]
    fn test_face_strategy_x_direction() {
        let strategy = FaceStrategy::new(2.0);
        let toolpath = strategy.generate(0.0, 10.0, 0.0, 10.0, "tool_1".to_string());
        assert!(toolpath.segment_count() > 0);
    }

    #[test]
    fn test_adaptive_strategy() {
        let strategy = AdaptiveStrategy::new(0.1);
        let stepover = strategy.calculate_stepover(0.05);
        assert!(stepover > 0.0);
        assert!(stepover <= strategy.max_stepover);
    }

    #[test]
    fn test_pencil_strategy() {
        let strategy = PencilStrategy::new(0.5);
        let conditions = CuttingConditions {
            spindle_speed: 5000.0,
            feedrate: 300.0,
            depth_of_cut: 0.5,
            tool_id: "tool_1".to_string(),
        };
        let toolpath = strategy.generate(2.0, conditions);
        assert!(toolpath.segment_count() > 0);
    }

    #[test]
    fn test_cutting_strategy() {
        let strategy = CuttingStrategy::new(StrategyType::Facing, 2.0, 1.5)
            .with_ramp(5.0);
        assert_eq!(strategy.stepover, 2.0);
        assert!(strategy.ramp_angle.is_some());
    }

    // Multi-axis strategy tests

    #[test]
    fn test_indexed_4axis_standard() {
        let toolpath = Toolpath::new("test".to_string(), "test".to_string());
        let strategy = Indexed4AxisStrategy::standard_4axis(toolpath);
        assert_eq!(strategy.index_angles.len(), 4);
        assert_eq!(strategy.index_angles[0], 0.0);
        assert_eq!(strategy.index_angles[1], 90.0);
        assert_eq!(strategy.num_indices(), 4);
    }

    #[test]
    fn test_indexed_4axis_two_sided() {
        let toolpath = Toolpath::new("test".to_string(), "test".to_string());
        let strategy = Indexed4AxisStrategy::two_sided_indexing(toolpath);
        assert_eq!(strategy.index_angles.len(), 2);
        assert_eq!(strategy.index_angles[0], 0.0);
        assert_eq!(strategy.index_angles[1], 180.0);
    }

    #[test]
    fn test_indexed_4axis_validate() {
        let toolpath = Toolpath::new("test".to_string(), "test".to_string());
        let strategy = Indexed4AxisStrategy::standard_4axis(toolpath);
        assert!(strategy.validate_index_angles().is_ok());
    }

    #[test]
    fn test_indexed_4axis_validate_duplicate() {
        let toolpath = Toolpath::new("test".to_string(), "test".to_string());
        let mut strategy = Indexed4AxisStrategy::standard_4axis(toolpath);
        strategy.index_angles = vec![0.0, 90.0, 90.0, 180.0];
        assert!(strategy.validate_index_angles().is_err());
    }

    #[test]
    fn test_swarf_milling_standard() {
        let strategy = SwarfMillingStrategy::standard_flank(5.0);
        assert_eq!(strategy.lead_angle, 15.0);
        assert_eq!(strategy.step_over, 5.0);
        assert_eq!(strategy.contact_strategy, ContactStrategy::LineContact);
    }

    #[test]
    fn test_swarf_milling_blade() {
        let strategy = SwarfMillingStrategy::blade_milling(3.0);
        assert_eq!(strategy.lead_angle, 20.0);
        assert_eq!(strategy.contact_strategy, ContactStrategy::SurfaceContact);
    }

    #[test]
    fn test_swarf_milling_validate() {
        let strategy = SwarfMillingStrategy::standard_flank(5.0);
        assert!(strategy.validate_parameters().is_ok());
    }

    #[test]
    fn test_swarf_milling_contact_offset() {
        let s1 = SwarfMillingStrategy::new(15.0, 0.0, ContactStrategy::PointContact, 5.0, 30.0);
        assert_eq!(s1.get_contact_offset(), 0.0);

        let s2 = SwarfMillingStrategy::new(15.0, 0.0, ContactStrategy::LineContact, 5.0, 30.0);
        assert_eq!(s2.get_contact_offset(), 2.5);

        let s3 = SwarfMillingStrategy::new(15.0, 0.0, ContactStrategy::SurfaceContact, 5.0, 30.0);
        assert_eq!(s3.get_contact_offset(), 5.0);
    }

    #[test]
    fn test_five_axis_standard() {
        let strategy = FiveAxisContouringStrategy::standard_sculpted(3.0);
        assert_eq!(strategy.step_over, 3.0);
        assert_eq!(strategy.tilt_limit, 30.0);
        assert_eq!(strategy.lead_tilt_mode, LeadTiltMode::Combined);
    }

    #[test]
    fn test_five_axis_aerospace() {
        let strategy = FiveAxisContouringStrategy::aerospace_finish(2.0);
        assert_eq!(strategy.tilt_limit, 20.0);
        assert_eq!(strategy.lead_tilt_mode, LeadTiltMode::Optimized);
    }

    #[test]
    fn test_five_axis_aggressive() {
        let strategy = FiveAxisContouringStrategy::aggressive_removal(5.0);
        assert_eq!(strategy.tilt_limit, 45.0);
        assert_eq!(strategy.lead_tilt_mode, LeadTiltMode::LeadOnly);
    }

    #[test]
    fn test_five_axis_validate() {
        let strategy = FiveAxisContouringStrategy::standard_sculpted(3.0);
        assert!(strategy.validate_parameters().is_ok());
    }

    #[test]
    fn test_five_axis_validate_invalid() {
        let strategy = FiveAxisContouringStrategy::new(0.0, 30.0, LeadTiltMode::Combined);
        assert!(strategy.validate_parameters().is_err());
    }

    #[test]
    fn test_multiaxis_traits() {
        let indexed = Indexed4AxisStrategy::standard_4axis(
            Toolpath::new("test".to_string(), "test".to_string())
        );
        assert_eq!(indexed.name(), "Indexed 4-Axis");
        assert!(!indexed.supports_tool_tilt());

        let swarf = SwarfMillingStrategy::standard_flank(5.0);
        assert_eq!(swarf.name(), "Swarf Milling");
        assert!(swarf.supports_tool_tilt());

        let five_axis = FiveAxisContouringStrategy::standard_sculpted(3.0);
        assert_eq!(five_axis.name(), "5-Axis Contouring");
        assert!(five_axis.supports_simultaneous_axes());
    }
}
