/**
 * Toolpath Generation and Management
 * Data structures for representing and manipulating tool paths
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::feeds_speeds::CuttingParameters;

/// Segment type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SegmentType {
    Rapid,        // G00 - rapid positioning
    Linear,       // G01 - linear interpolation
    ArcCW,        // G02 - arc clockwise
    ArcCCW,       // G03 - arc counter-clockwise
    Dwell,        // G04 - dwell/pause
    SpindleStart, // M03 - spindle on
    SpindleStop,  // M05 - spindle off
    ToolChange,   // T## - tool change
}

/// 3D Point with tool information
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Point3D { x, y, z }
    }

    pub fn origin() -> Self {
        Point3D {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }

    pub fn distance_to(&self, other: &Point3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
}

/// Cutting conditions for this segment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingConditions {
    pub spindle_speed: f64,    // RPM
    pub feedrate: f64,         // mm/min
    pub depth_of_cut: f64,     // mm
    pub tool_id: String,
}

/// Single toolpath segment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolpathSegment {
    pub segment_type: SegmentType,
    pub start: Point3D,
    pub end: Point3D,
    pub arc_center: Option<Point3D>,
    pub arc_radius: Option<f64>,
    pub cutting_conditions: CuttingConditions,
    pub duration: f64,  // seconds
    pub feedrate_override: Option<f64>,
}

impl ToolpathSegment {
    pub fn new(
        segment_type: SegmentType,
        start: Point3D,
        end: Point3D,
        conditions: CuttingConditions,
    ) -> Self {
        let distance = start.distance_to(&end);
        let duration = if conditions.feedrate > 0.0 {
            distance / conditions.feedrate * 60.0
        } else {
            0.0
        };

        ToolpathSegment {
            segment_type,
            start,
            end,
            arc_center: None,
            arc_radius: None,
            cutting_conditions: conditions,
            duration,
            feedrate_override: None,
        }
    }

    pub fn rapid(start: Point3D, end: Point3D, tool_id: String) -> Self {
        ToolpathSegment::new(
            SegmentType::Rapid,
            start,
            end,
            CuttingConditions {
                spindle_speed: 0.0,
                feedrate: 5000.0, // Default rapid feedrate
                depth_of_cut: 0.0,
                tool_id,
            },
        )
    }

    pub fn linear_cut(
        start: Point3D,
        end: Point3D,
        conditions: CuttingConditions,
    ) -> Self {
        ToolpathSegment::new(SegmentType::Linear, start, end, conditions)
    }

    pub fn arc(
        start: Point3D,
        end: Point3D,
        center: Point3D,
        cw: bool,
        conditions: CuttingConditions,
    ) -> Self {
        let radius = start.distance_to(&center);
        let mut segment = ToolpathSegment::new(
            if cw { SegmentType::ArcCW } else { SegmentType::ArcCCW },
            start,
            end,
            conditions,
        );
        segment.arc_center = Some(center);
        segment.arc_radius = Some(radius);
        segment
    }

    pub fn length(&self) -> f64 {
        self.start.distance_to(&self.end)
    }
}

/// Complete toolpath (collection of segments)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Toolpath {
    pub id: String,
    pub name: String,
    pub segments: Vec<ToolpathSegment>,
    pub total_distance: f64,
    pub total_time: f64,      // minutes
    pub rapid_distance: f64,
    pub cutting_distance: f64,
}

impl Toolpath {
    pub fn new(id: String, name: String) -> Self {
        Toolpath {
            id,
            name,
            segments: Vec::new(),
            total_distance: 0.0,
            total_time: 0.0,
            rapid_distance: 0.0,
            cutting_distance: 0.0,
        }
    }

    /// Add segment to toolpath
    pub fn add_segment(&mut self, segment: ToolpathSegment) {
        let length = segment.length();
        self.total_distance += length;
        self.total_time += segment.duration / 60.0;

        match segment.segment_type {
            SegmentType::Rapid => {
                self.rapid_distance += length;
            }
            SegmentType::Linear | SegmentType::ArcCW | SegmentType::ArcCCW => {
                self.cutting_distance += length;
            }
            _ => {}
        }

        self.segments.push(segment);
    }

    /// Get segment count
    pub fn segment_count(&self) -> usize {
        self.segments.len()
    }

    /// Optimize toolpath by combining collinear segments
    pub fn optimize(&mut self) -> usize {
        let original_count = self.segments.len();
        let mut optimized = Vec::new();

        for (i, segment) in self.segments.iter().enumerate() {
            if let Some(prev) = optimized.last_mut() {
                // Check if segments can be combined (same type, continuous)
                if can_combine(prev, segment) {
                    // Extend previous segment
                    prev.end = segment.end;
                    prev.duration += segment.duration;
                    continue;
                }
            }
            optimized.push(segment.clone());
        }

        let optimized_count = optimized.len();
        self.segments = optimized;

        // Recalculate metrics
        self.total_distance = 0.0;
        self.total_time = 0.0;
        self.rapid_distance = 0.0;
        self.cutting_distance = 0.0;

        for segment in &self.segments {
            let length = segment.length();
            self.total_distance += length;
            self.total_time += segment.duration / 60.0;

            match segment.segment_type {
                SegmentType::Rapid => self.rapid_distance += length,
                SegmentType::Linear | SegmentType::ArcCW | SegmentType::ArcCCW => {
                    self.cutting_distance += length
                }
                _ => {}
            }
        }

        original_count - optimized_count
    }

    /// Get average feedrate
    pub fn average_feedrate(&self) -> f64 {
        if self.total_time == 0.0 {
            return 0.0;
        }
        self.cutting_distance / self.total_time
    }

    /// Get cutting time percentage
    pub fn cutting_time_percentage(&self) -> f64 {
        if self.total_distance == 0.0 {
            return 0.0;
        }
        (self.cutting_distance / self.total_distance) * 100.0
    }
}

/// Helper function to check if two segments can be combined
fn can_combine(seg1: &ToolpathSegment, seg2: &ToolpathSegment) -> bool {
    // Must be same type
    if seg1.segment_type != seg2.segment_type {
        return false;
    }

    // Must be continuous
    let distance = seg1.end.distance_to(&seg2.start);
    if distance > 0.001 {
        return false;
    }

    // Must have same cutting conditions (approximately)
    let speed_diff = (seg1.cutting_conditions.spindle_speed
        - seg2.cutting_conditions.spindle_speed)
        .abs();
    let feedrate_diff =
        (seg1.cutting_conditions.feedrate - seg2.cutting_conditions.feedrate).abs();

    speed_diff < 100.0 && feedrate_diff < 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(3.0, 4.0, 0.0);
        assert!((p1.distance_to(&p2) - 5.0).abs() < 0.01);
    }

    #[test]
    fn test_segment_creation() {
        let start = Point3D::new(0.0, 0.0, 0.0);
        let end = Point3D::new(10.0, 0.0, 0.0);
        let conditions = CuttingConditions {
            spindle_speed: 1000.0,
            feedrate: 100.0,
            depth_of_cut: 2.0,
            tool_id: "tool_1".to_string(),
        };

        let segment = ToolpathSegment::linear_cut(start, end, conditions);
        assert_eq!(segment.segment_type, SegmentType::Linear);
        assert!((segment.length() - 10.0).abs() < 0.01);
    }

    #[test]
    fn test_rapid_move() {
        let start = Point3D::new(0.0, 0.0, 0.0);
        let end = Point3D::new(10.0, 10.0, 0.0);
        let segment = ToolpathSegment::rapid(start, end, "tool_1".to_string());

        assert_eq!(segment.segment_type, SegmentType::Rapid);
        assert!(segment.cutting_conditions.spindle_speed == 0.0);
    }

    #[test]
    fn test_toolpath_creation() {
        let mut toolpath = Toolpath::new("tp_1".to_string(), "Test Path".to_string());

        let start = Point3D::new(0.0, 0.0, 0.0);
        let end1 = Point3D::new(10.0, 0.0, 0.0);
        let end2 = Point3D::new(10.0, 10.0, 0.0);

        let conditions = CuttingConditions {
            spindle_speed: 1000.0,
            feedrate: 100.0,
            depth_of_cut: 2.0,
            tool_id: "tool_1".to_string(),
        };

        toolpath.add_segment(ToolpathSegment::linear_cut(start, end1, conditions.clone()));
        toolpath.add_segment(ToolpathSegment::linear_cut(end1, end2, conditions));

        assert_eq!(toolpath.segment_count(), 2);
        assert!(toolpath.total_distance > 0.0);
    }

    #[test]
    fn test_toolpath_metrics() {
        let mut toolpath = Toolpath::new("tp_1".to_string(), "Test".to_string());

        let conditions = CuttingConditions {
            spindle_speed: 1000.0,
            feedrate: 100.0,
            depth_of_cut: 2.0,
            tool_id: "tool_1".to_string(),
        };

        toolpath.add_segment(ToolpathSegment::linear_cut(
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(10.0, 0.0, 0.0),
            conditions.clone(),
        ));

        toolpath.add_segment(ToolpathSegment::rapid(
            Point3D::new(10.0, 0.0, 0.0),
            Point3D::new(0.0, 0.0, 0.0),
            "tool_1".to_string(),
        ));

        assert!(toolpath.cutting_time_percentage() > 0.0);
        assert!(toolpath.cutting_time_percentage() < 100.0);
    }
}
