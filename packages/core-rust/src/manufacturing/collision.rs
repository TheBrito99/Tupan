/**
 * Collision Detection and Avoidance
 * Detect tool-workpiece and tool-fixture collisions
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::toolpath::Point3D;
use crate::manufacturing::multi_axis::{Point6D, ToolOrientation};

/// Collision type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CollisionType {
    ToolWorkpiece,    // Tool hitting workpiece
    ToolFixture,      // Tool hitting fixture/clamp
    ToolHolderWorkpiece, // Tool holder hitting workpiece
    None,             // No collision
}

/// Collision result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollisionResult {
    pub collision_type: CollisionType,
    pub point: Point3D,
    pub distance: f64, // Distance to nearest collision (mm)
    pub severity: CollisionSeverity,
}

/// Collision severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum CollisionSeverity {
    None = 0,      // No collision
    Warning = 1,   // Close to collision
    Critical = 2,  // Collision detected
}

/// Geometric shape for collision detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Shape {
    Sphere {
        center: Point3D,
        radius: f64,
    },
    Cylinder {
        center: Point3D,
        radius: f64,
        height: f64,
        axis: Axis,
    },
    Box {
        min: Point3D,
        max: Point3D,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Axis {
    X,
    Y,
    Z,
}

impl Shape {
    /// Check if point is inside shape
    pub fn contains(&self, point: &Point3D) -> bool {
        match self {
            Shape::Sphere { center, radius } => {
                let dx = point.x - center.x;
                let dy = point.y - center.y;
                let dz = point.z - center.z;
                (dx * dx + dy * dy + dz * dz) <= radius * radius
            }
            Shape::Cylinder {
                center,
                radius,
                height,
                axis,
            } => {
                let in_cylinder = match axis {
                    Axis::X => {
                        let dy = point.y - center.y;
                        let dz = point.z - center.z;
                        (dy * dy + dz * dz) <= radius * radius
                            && (point.x - center.x).abs() <= height / 2.0
                    }
                    Axis::Y => {
                        let dx = point.x - center.x;
                        let dz = point.z - center.z;
                        (dx * dx + dz * dz) <= radius * radius
                            && (point.y - center.y).abs() <= height / 2.0
                    }
                    Axis::Z => {
                        let dx = point.x - center.x;
                        let dy = point.y - center.y;
                        (dx * dx + dy * dy) <= radius * radius
                            && (point.z - center.z).abs() <= height / 2.0
                    }
                };
                in_cylinder
            }
            Shape::Box { min, max } => {
                point.x >= min.x
                    && point.x <= max.x
                    && point.y >= min.y
                    && point.y <= max.y
                    && point.z >= min.z
                    && point.z <= max.z
            }
        }
    }

    /// Get distance from point to shape surface
    pub fn distance_to(&self, point: &Point3D) -> f64 {
        match self {
            Shape::Sphere { center, radius } => {
                let dx = point.x - center.x;
                let dy = point.y - center.y;
                let dz = point.z - center.z;
                let dist = (dx * dx + dy * dy + dz * dz).sqrt();
                (dist - radius).max(0.0)
            }
            Shape::Cylinder {
                center,
                radius,
                height,
                axis,
            } => {
                match axis {
                    Axis::X => {
                        let dy = point.y - center.y;
                        let dz = point.z - center.z;
                        let radial_dist = (dy * dy + dz * dz).sqrt();
                        let axial_dist = (point.x - center.x).abs() - height / 2.0;
                        let radial_diff = (radial_dist - radius).max(0.0);
                        ((radial_diff * radial_diff) + (axial_dist.max(0.0) * axial_dist.max(0.0)))
                            .sqrt()
                    }
                    Axis::Y => {
                        let dx = point.x - center.x;
                        let dz = point.z - center.z;
                        let radial_dist = (dx * dx + dz * dz).sqrt();
                        let axial_dist = (point.y - center.y).abs() - height / 2.0;
                        let radial_diff = (radial_dist - radius).max(0.0);
                        ((radial_diff * radial_diff) + (axial_dist.max(0.0) * axial_dist.max(0.0)))
                            .sqrt()
                    }
                    Axis::Z => {
                        let dx = point.x - center.x;
                        let dy = point.y - center.y;
                        let radial_dist = (dx * dx + dy * dy).sqrt();
                        let axial_dist = (point.z - center.z).abs() - height / 2.0;
                        let radial_diff = (radial_dist - radius).max(0.0);
                        ((radial_diff * radial_diff) + (axial_dist.max(0.0) * axial_dist.max(0.0)))
                            .sqrt()
                    }
                }
            }
            Shape::Box { min, max } => {
                let dx = (point.x - max.x).max(0.0).max(min.x - point.x);
                let dy = (point.y - max.y).max(0.0).max(min.y - point.y);
                let dz = (point.z - max.z).max(0.0).max(min.z - point.z);
                (dx * dx + dy * dy + dz * dz).sqrt()
            }
        }
    }
}

/// Tool geometry for collision detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolGeometry {
    pub id: String,
    pub diameter: f64,          // mm
    pub length: f64,            // mm
    pub flute_length: f64,      // mm
    pub holder_diameter: f64,   // mm
    pub holder_length: f64,     // mm
}

impl ToolGeometry {
    pub fn new(id: String, diameter: f64, length: f64, flute_length: f64) -> Self {
        ToolGeometry {
            id,
            diameter,
            length,
            flute_length,
            holder_diameter: diameter + 5.0,
            holder_length: length * 0.4,
        }
    }

    /// Get tool as cylinder shape at given position and orientation
    pub fn as_cylinder(&self, position: &Point3D) -> Shape {
        Shape::Cylinder {
            center: *position,
            radius: self.diameter / 2.0,
            height: self.flute_length,
            axis: Axis::Z,
        }
    }

    /// Get tool holder as cylinder
    pub fn holder_as_cylinder(&self, position: &Point3D) -> Shape {
        Shape::Cylinder {
            center: *position,
            radius: self.holder_diameter / 2.0,
            height: self.holder_length,
            axis: Axis::Z,
        }
    }
}

/// Collision detector
pub struct CollisionDetector {
    workpiece_shapes: Vec<Shape>,
    fixture_shapes: Vec<Shape>,
    safe_distance: f64, // mm - warning distance
}

impl CollisionDetector {
    pub fn new(safe_distance: f64) -> Self {
        CollisionDetector {
            workpiece_shapes: Vec::new(),
            fixture_shapes: Vec::new(),
            safe_distance,
        }
    }

    /// Add workpiece shape
    pub fn add_workpiece_shape(&mut self, shape: Shape) {
        self.workpiece_shapes.push(shape);
    }

    /// Add fixture shape
    pub fn add_fixture_shape(&mut self, shape: Shape) {
        self.fixture_shapes.push(shape);
    }

    /// Check for collision at position
    pub fn check_collision(
        &self,
        tool: &ToolGeometry,
        position: &Point3D,
    ) -> CollisionResult {
        let tool_cylinder = tool.as_cylinder(position);
        let holder_cylinder = tool.holder_as_cylinder(position);

        // Check workpiece collision
        for shape in &self.workpiece_shapes {
            if shape.contains(position) {
                return CollisionResult {
                    collision_type: CollisionType::ToolWorkpiece,
                    point: *position,
                    distance: 0.0,
                    severity: CollisionSeverity::Critical,
                };
            }

            let dist = shape.distance_to(position);
            if dist < self.safe_distance {
                return CollisionResult {
                    collision_type: CollisionType::ToolWorkpiece,
                    point: *position,
                    distance: dist,
                    severity: if dist < self.safe_distance / 2.0 {
                        CollisionSeverity::Critical
                    } else {
                        CollisionSeverity::Warning
                    },
                };
            }
        }

        // Check fixture collision
        for shape in &self.fixture_shapes {
            if shape.contains(position) {
                return CollisionResult {
                    collision_type: CollisionType::ToolFixture,
                    point: *position,
                    distance: 0.0,
                    severity: CollisionSeverity::Critical,
                };
            }

            let dist = shape.distance_to(position);
            if dist < self.safe_distance {
                return CollisionResult {
                    collision_type: CollisionType::ToolFixture,
                    point: *position,
                    distance: dist,
                    severity: if dist < self.safe_distance / 2.0 {
                        CollisionSeverity::Critical
                    } else {
                        CollisionSeverity::Warning
                    },
                };
            }
        }

        // No collision
        CollisionResult {
            collision_type: CollisionType::None,
            point: *position,
            distance: self.safe_distance,
            severity: CollisionSeverity::None,
        }
    }

    /// Check collision along line segment
    pub fn check_segment_collision(
        &self,
        tool: &ToolGeometry,
        start: &Point3D,
        end: &Point3D,
        resolution: f64,
    ) -> Option<(f64, CollisionResult)> {
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let dz = end.z - start.z;
        let length = (dx * dx + dy * dy + dz * dz).sqrt();

        if length == 0.0 {
            return None;
        }

        let steps = ((length / resolution).ceil() as usize).max(2);
        let mut closest_collision = None;
        let mut closest_distance = f64::MAX;

        for i in 0..=steps {
            let t = i as f64 / steps as f64;
            let pos = Point3D::new(
                start.x + dx * t,
                start.y + dy * t,
                start.z + dz * t,
            );

            let collision = self.check_collision(tool, &pos);
            if collision.collision_type != CollisionType::None {
                if collision.distance < closest_distance {
                    closest_distance = collision.distance;
                    closest_collision = Some((t * length, collision));
                }
            }
        }

        closest_collision
    }

    /// Clear all shapes
    pub fn clear(&mut self) {
        self.workpiece_shapes.clear();
        self.fixture_shapes.clear();
    }
}

// ============================================================================
// Multi-Axis (6DOF) Collision Detection
// ============================================================================

/// Extended collision result for multi-axis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiAxisCollisionResult {
    pub collision_detected: bool,
    pub collision_type: CollisionType,
    pub distance: f64,
    pub severity: CollisionSeverity,
    pub gouging_detected: bool,
    pub gouge_depth: f64,
    pub position: Point6D,
    pub tool_orientation: ToolOrientation,
}

impl MultiAxisCollisionResult {
    /// Create a no-collision result
    pub fn no_collision(position: Point6D, orientation: ToolOrientation) -> Self {
        MultiAxisCollisionResult {
            collision_detected: false,
            collision_type: CollisionType::None,
            distance: 1000.0,
            severity: CollisionSeverity::None,
            gouging_detected: false,
            gouge_depth: 0.0,
            position,
            tool_orientation: orientation,
        }
    }

    /// Create a collision result
    pub fn collision(
        collision_type: CollisionType,
        distance: f64,
        severity: CollisionSeverity,
        position: Point6D,
        orientation: ToolOrientation,
    ) -> Self {
        MultiAxisCollisionResult {
            collision_detected: true,
            collision_type,
            distance,
            severity,
            gouging_detected: false,
            gouge_depth: 0.0,
            position,
            tool_orientation: orientation,
        }
    }

    /// Create a gouging detection result
    pub fn gouging(
        gouge_depth: f64,
        position: Point6D,
        orientation: ToolOrientation,
    ) -> Self {
        MultiAxisCollisionResult {
            collision_detected: false,
            collision_type: CollisionType::None,
            distance: 0.0,
            severity: CollisionSeverity::Critical,
            gouging_detected: true,
            gouge_depth,
            position,
            tool_orientation: orientation,
        }
    }
}

/// Extended tool geometry for multi-axis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiAxisToolGeometry {
    pub id: String,
    pub diameter: f64,
    pub length: f64,
    pub flute_length: f64,
    pub holder_diameter: f64,
    pub holder_length: f64,
    pub corner_radius: f64,     // For ball endmills and radius tools
    pub tool_type: String,      // Flat, Ball, Tapered, etc.
}

impl MultiAxisToolGeometry {
    /// Create from standard ToolGeometry
    pub fn from_tool_geometry(tool: &ToolGeometry) -> Self {
        MultiAxisToolGeometry {
            id: tool.id.clone(),
            diameter: tool.diameter,
            length: tool.length,
            flute_length: tool.flute_length,
            holder_diameter: tool.holder_diameter,
            holder_length: tool.holder_length,
            corner_radius: tool.diameter / 2.0,
            tool_type: "Flat".to_string(),
        }
    }

    /// Check if position is within safe distance from surface
    pub fn check_surface_distance(
        &self,
        tool_tip: &Point3D,
        tool_direction: (f64, f64, f64),
        surface_point: &Point3D,
        surface_normal: (f64, f64, f64),
    ) -> f64 {
        // Vector from surface to tool tip
        let to_tool = (
            tool_tip.x - surface_point.x,
            tool_tip.y - surface_point.y,
            tool_tip.z - surface_point.z,
        );

        // Distance along surface normal (should be positive for safe clearance)
        let dot = to_tool.0 * surface_normal.0
            + to_tool.1 * surface_normal.1
            + to_tool.2 * surface_normal.2;

        dot
    }
}

/// Multi-axis collision detector supporting 6DOF
pub struct MultiAxisCollisionDetector {
    workpiece_shapes: Vec<Shape>,
    fixture_shapes: Vec<Shape>,
    machine_geometry: Vec<Shape>,  // Spindle head, table, guards
    safe_distance: f64,
    gouge_threshold: f64,          // Threshold for gouge detection (mm)
}

impl MultiAxisCollisionDetector {
    /// Create a new multi-axis collision detector
    pub fn new(safe_distance: f64) -> Self {
        MultiAxisCollisionDetector {
            workpiece_shapes: Vec::new(),
            fixture_shapes: Vec::new(),
            machine_geometry: Vec::new(),
            safe_distance,
            gouge_threshold: 0.5,  // Default 0.5mm gouge threshold
        }
    }

    /// Set gouge detection threshold
    pub fn set_gouge_threshold(&mut self, threshold: f64) {
        self.gouge_threshold = threshold;
    }

    /// Add workpiece shape
    pub fn add_workpiece_shape(&mut self, shape: Shape) {
        self.workpiece_shapes.push(shape);
    }

    /// Add fixture shape
    pub fn add_fixture_shape(&mut self, shape: Shape) {
        self.fixture_shapes.push(shape);
    }

    /// Add machine geometry (spindle, table, etc.)
    pub fn add_machine_geometry(&mut self, shape: Shape) {
        self.machine_geometry.push(shape);
    }

    /// Check collision at 6DOF position with tool orientation
    pub fn check_collision_6dof(
        &self,
        tool: &MultiAxisToolGeometry,
        position: &Point6D,
        orientation: &ToolOrientation,
    ) -> MultiAxisCollisionResult {
        // Convert Point6D to Point3D for checking
        let tcp_point = Point3D::new(position.x, position.y, position.z);
        let tool_direction = orientation.direction;

        // Check workpiece collision
        for shape in &self.workpiece_shapes {
            if shape.contains(&tcp_point) {
                return MultiAxisCollisionResult::collision(
                    CollisionType::ToolWorkpiece,
                    0.0,
                    CollisionSeverity::Critical,
                    *position,
                    *orientation,
                );
            }

            let dist = shape.distance_to(&tcp_point);
            if dist < self.safe_distance {
                let severity = if dist < self.safe_distance / 2.0 {
                    CollisionSeverity::Critical
                } else {
                    CollisionSeverity::Warning
                };

                return MultiAxisCollisionResult::collision(
                    CollisionType::ToolWorkpiece,
                    dist,
                    severity,
                    *position,
                    *orientation,
                );
            }
        }

        // Check fixture collision
        for shape in &self.fixture_shapes {
            if shape.contains(&tcp_point) {
                return MultiAxisCollisionResult::collision(
                    CollisionType::ToolFixture,
                    0.0,
                    CollisionSeverity::Critical,
                    *position,
                    *orientation,
                );
            }

            let dist = shape.distance_to(&tcp_point);
            if dist < self.safe_distance {
                let severity = if dist < self.safe_distance / 2.0 {
                    CollisionSeverity::Critical
                } else {
                    CollisionSeverity::Warning
                };

                return MultiAxisCollisionResult::collision(
                    CollisionType::ToolFixture,
                    dist,
                    severity,
                    *position,
                    *orientation,
                );
            }
        }

        // Check machine geometry collision
        for shape in &self.machine_geometry {
            if shape.contains(&tcp_point) {
                return MultiAxisCollisionResult::collision(
                    CollisionType::ToolHolderWorkpiece,
                    0.0,
                    CollisionSeverity::Critical,
                    *position,
                    *orientation,
                );
            }

            let dist = shape.distance_to(&tcp_point);
            if dist < self.safe_distance {
                return MultiAxisCollisionResult::collision(
                    CollisionType::ToolHolderWorkpiece,
                    dist,
                    CollisionSeverity::Warning,
                    *position,
                    *orientation,
                );
            }
        }

        // No collision detected
        MultiAxisCollisionResult::no_collision(*position, *orientation)
    }

    /// Check for gouging (tool flank hitting workpiece)
    pub fn check_gouging(
        &self,
        tool: &MultiAxisToolGeometry,
        position: &Point6D,
        orientation: &ToolOrientation,
        surface_normal: (f64, f64, f64),
    ) -> MultiAxisCollisionResult {
        let tcp_point = Point3D::new(position.x, position.y, position.z);

        // Check distance along surface normal
        // Positive means tool is above surface (safe)
        // Negative means tool is below surface (gouging)
        for shape in &self.workpiece_shapes {
            if let Shape::Box { min, max } = shape {
                // Get approximate surface point
                let surface_point = Point3D::new(
                    tcp_point.x.max(min.x).min(max.x),
                    tcp_point.y.max(min.y).min(max.y),
                    tcp_point.z.max(min.z).min(max.z),
                );

                // Calculate distance along normal
                let to_tcp = (
                    tcp_point.x - surface_point.x,
                    tcp_point.y - surface_point.y,
                    tcp_point.z - surface_point.z,
                );

                let normal_distance = to_tcp.0 * surface_normal.0
                    + to_tcp.1 * surface_normal.1
                    + to_tcp.2 * surface_normal.2;

                // If normal distance is negative and beyond threshold, gouging detected
                if normal_distance < -self.gouge_threshold {
                    return MultiAxisCollisionResult::gouging(
                        -normal_distance,
                        *position,
                        *orientation,
                    );
                }
            }
        }

        MultiAxisCollisionResult::no_collision(*position, *orientation)
    }

    /// Check collision along a 6DOF toolpath segment
    pub fn check_segment_collision_6dof(
        &self,
        tool: &MultiAxisToolGeometry,
        start: &Point6D,
        end: &Point6D,
        start_orientation: &ToolOrientation,
        end_orientation: &ToolOrientation,
        resolution: f64,
    ) -> Option<(f64, MultiAxisCollisionResult)> {
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let dz = end.z - start.z;
        let length = (dx * dx + dy * dy + dz * dz).sqrt();

        if length == 0.0 {
            return None;
        }

        let steps = ((length / resolution).ceil() as usize).max(1);

        for i in 0..=steps {
            let t = i as f64 / steps as f64;

            let intermediate_pos = Point6D::full(
                start.x + t * dx,
                start.y + t * dy,
                start.z + t * dz,
                start.a + t * (end.a - start.a),
                start.b + t * (end.b - start.b),
                start.c + t * (end.c - start.c),
            );

            // Interpolate orientation
            let lead = start_orientation.lead_angle
                + t * (end_orientation.lead_angle - start_orientation.lead_angle);
            let tilt = start_orientation.tilt_angle
                + t * (end_orientation.tilt_angle - start_orientation.tilt_angle);
            let intermediate_orientation = ToolOrientation::tilted(lead, tilt);

            let result = self.check_collision_6dof(tool, &intermediate_pos, &intermediate_orientation);

            if result.collision_detected || result.gouging_detected {
                return Some((t, result));
            }
        }

        None
    }

    /// Clear all shapes
    pub fn clear(&mut self) {
        self.workpiece_shapes.clear();
        self.fixture_shapes.clear();
        self.machine_geometry.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sphere_contains() {
        let shape = Shape::Sphere {
            center: Point3D::new(0.0, 0.0, 0.0),
            radius: 5.0,
        };
        let inside = Point3D::new(2.0, 2.0, 2.0);
        let outside = Point3D::new(10.0, 10.0, 10.0);

        assert!(shape.contains(&inside));
        assert!(!shape.contains(&outside));
    }

    #[test]
    fn test_box_distance() {
        let shape = Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(10.0, 10.0, 10.0),
        };
        let point = Point3D::new(15.0, 5.0, 5.0);
        let dist = shape.distance_to(&point);
        assert!(dist > 0.0);
    }

    #[test]
    fn test_tool_geometry() {
        let tool = ToolGeometry::new(
            "tool_1".to_string(),
            4.0,
            50.0,
            10.0,
        );
        assert_eq!(tool.diameter, 4.0);
        assert!(tool.holder_diameter > tool.diameter);
    }

    #[test]
    fn test_collision_detector() {
        let mut detector = CollisionDetector::new(2.0);

        // Add a workpiece box
        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(100.0, 100.0, 50.0),
        });

        let tool = ToolGeometry::new("tool".to_string(), 2.0, 40.0, 20.0);

        // Check collision above workpiece (above max Z)
        let result = detector.check_collision(&tool, &Point3D::new(50.0, 50.0, 60.0));
        assert!(result.collision_type == CollisionType::None);

        // Check collision inside workpiece
        let result = detector.check_collision(&tool, &Point3D::new(50.0, 50.0, 25.0));
        assert!(result.collision_type == CollisionType::ToolWorkpiece);
    }

    #[test]
    fn test_segment_collision() {
        let mut detector = CollisionDetector::new(2.0);
        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(100.0, 100.0, 50.0),
        });

        let tool = ToolGeometry::new("tool".to_string(), 2.0, 40.0, 20.0);

        let start = Point3D::new(50.0, 50.0, 60.0);
        let end = Point3D::new(50.0, 50.0, 10.0);

        let collision = detector.check_segment_collision(&tool, &start, &end, 5.0);
        assert!(collision.is_some());
    }

    // Multi-axis collision detection tests

    #[test]
    fn test_multiaxis_tool_geometry() {
        let tool = ToolGeometry::new("tool_1".to_string(), 8.0, 75.0, 20.0);
        let ma_tool = MultiAxisToolGeometry::from_tool_geometry(&tool);

        assert_eq!(ma_tool.id, "tool_1");
        assert_eq!(ma_tool.diameter, 8.0);
        assert_eq!(ma_tool.flute_length, 20.0);
        assert_eq!(ma_tool.tool_type, "Flat");
    }

    #[test]
    fn test_multiaxis_collision_result_no_collision() {
        let pos = Point6D::linear(10.0, 20.0, 5.0);
        let orient = ToolOrientation::vertical();
        let result = MultiAxisCollisionResult::no_collision(pos, orient);

        assert!(!result.collision_detected);
        assert!(!result.gouging_detected);
        assert_eq!(result.collision_type, CollisionType::None);
        assert_eq!(result.severity, CollisionSeverity::None);
    }

    #[test]
    fn test_multiaxis_collision_result_collision() {
        let pos = Point6D::linear(0.0, 0.0, 0.0);
        let orient = ToolOrientation::vertical();
        let result = MultiAxisCollisionResult::collision(
            CollisionType::ToolWorkpiece,
            0.5,
            CollisionSeverity::Critical,
            pos,
            orient,
        );

        assert!(result.collision_detected);
        assert_eq!(result.collision_type, CollisionType::ToolWorkpiece);
        assert_eq!(result.severity, CollisionSeverity::Critical);
        assert_eq!(result.distance, 0.5);
    }

    #[test]
    fn test_multiaxis_collision_result_gouging() {
        let pos = Point6D::linear(5.0, 5.0, -2.0);
        let orient = ToolOrientation::vertical();
        let result = MultiAxisCollisionResult::gouging(1.5, pos, orient);

        assert!(!result.collision_detected);
        assert!(result.gouging_detected);
        assert_eq!(result.gouge_depth, 1.5);
        assert_eq!(result.severity, CollisionSeverity::Critical);
    }

    #[test]
    fn test_multiaxis_detector_no_collision_6dof() {
        let mut detector = MultiAxisCollisionDetector::new(2.0);

        // Add a workpiece box
        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(50.0, 50.0, 10.0),
        });

        let tool = MultiAxisToolGeometry::from_tool_geometry(
            &ToolGeometry::new("tool_1".to_string(), 10.0, 50.0, 20.0)
        );
        let pos = Point6D::linear(25.0, 25.0, 20.0);
        let orient = ToolOrientation::vertical();

        let result = detector.check_collision_6dof(&tool, &pos, &orient);

        assert!(!result.collision_detected);
        assert_eq!(result.collision_type, CollisionType::None);
    }

    #[test]
    fn test_multiaxis_detector_collision_6dof() {
        let mut detector = MultiAxisCollisionDetector::new(2.0);

        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(50.0, 50.0, 10.0),
        });

        let tool = MultiAxisToolGeometry::from_tool_geometry(
            &ToolGeometry::new("tool_1".to_string(), 10.0, 50.0, 20.0)
        );

        // Position tool below workpiece (inside it)
        let pos = Point6D::linear(25.0, 25.0, 5.0);
        let orient = ToolOrientation::vertical();

        let result = detector.check_collision_6dof(&tool, &pos, &orient);

        assert!(result.collision_detected);
        assert_eq!(result.collision_type, CollisionType::ToolWorkpiece);
        assert_eq!(result.severity, CollisionSeverity::Critical);
    }

    #[test]
    fn test_multiaxis_detector_tilted_tool() {
        let mut detector = MultiAxisCollisionDetector::new(2.0);

        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(50.0, 50.0, 10.0),
        });

        let tool = MultiAxisToolGeometry::from_tool_geometry(
            &ToolGeometry::new("tool_1".to_string(), 10.0, 50.0, 20.0)
        );

        let pos = Point6D::linear(25.0, 25.0, 20.0);
        let orient = ToolOrientation::tilted(15.0, 0.0);  // Tilted tool

        let result = detector.check_collision_6dof(&tool, &pos, &orient);

        assert!(!result.collision_detected);
        // Orientation should be preserved in result
        assert_eq!(result.tool_orientation.lead_angle, 15.0);
    }

    #[test]
    fn test_multiaxis_detector_gouge_check() {
        let mut detector = MultiAxisCollisionDetector::new(2.0);

        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(50.0, 50.0, 10.0),
        });

        let tool = MultiAxisToolGeometry::from_tool_geometry(
            &ToolGeometry::new("tool_1".to_string(), 10.0, 50.0, 20.0)
        );

        let pos = Point6D::linear(25.0, 25.0, 8.0);
        let orient = ToolOrientation::vertical();
        let surface_normal = (0.0, 0.0, 1.0);  // Upward normal

        let result = detector.check_gouging(&tool, &pos, &orient, surface_normal);

        // Tool is near surface, should not gouge (positive distance)
        assert!(!result.gouging_detected);
    }

    #[test]
    fn test_multiaxis_segment_collision() {
        let mut detector = MultiAxisCollisionDetector::new(2.0);

        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(50.0, 50.0, 10.0),
        });

        let tool = MultiAxisToolGeometry::from_tool_geometry(
            &ToolGeometry::new("tool_1".to_string(), 10.0, 50.0, 20.0)
        );

        let start = Point6D::linear(25.0, 25.0, 20.0);
        let end = Point6D::linear(25.0, 25.0, 5.0);  // Move into workpiece

        let start_orient = ToolOrientation::vertical();
        let end_orient = ToolOrientation::vertical();

        let result = detector.check_segment_collision_6dof(
            &tool,
            &start,
            &end,
            &start_orient,
            &end_orient,
            1.0
        );

        // Should detect collision somewhere along the path
        assert!(result.is_some());
        let (t, collision_result) = result.unwrap();
        assert!(t > 0.0 && t <= 1.0);
        assert!(collision_result.collision_detected);
    }

    #[test]
    fn test_multiaxis_detector_machine_geometry() {
        let mut detector = MultiAxisCollisionDetector::new(2.0);

        // Add machine geometry (e.g., spindle head)
        detector.add_machine_geometry(Shape::Cylinder {
            center: Point3D::new(25.0, 25.0, 30.0),
            radius: 15.0,
            height: 50.0,
            axis: Axis::Z,
        });

        let tool = MultiAxisToolGeometry::from_tool_geometry(
            &ToolGeometry::new("tool_1".to_string(), 10.0, 50.0, 20.0)
        );

        let pos = Point6D::linear(25.0, 25.0, 25.0);  // Near spindle
        let orient = ToolOrientation::vertical();

        let result = detector.check_collision_6dof(&tool, &pos, &orient);

        assert!(result.collision_detected);
        assert_eq!(result.collision_type, CollisionType::ToolHolderWorkpiece);
    }

    #[test]
    fn test_multiaxis_detector_clear() {
        let mut detector = MultiAxisCollisionDetector::new(2.0);

        detector.add_workpiece_shape(Shape::Box {
            min: Point3D::new(0.0, 0.0, 0.0),
            max: Point3D::new(50.0, 50.0, 10.0),
        });

        detector.add_fixture_shape(Shape::Sphere {
            center: Point3D::new(0.0, 0.0, 0.0),
            radius: 5.0,
        });

        detector.clear();

        // After clear, should be no collision
        let tool = MultiAxisToolGeometry::from_tool_geometry(
            &ToolGeometry::new("tool_1".to_string(), 10.0, 50.0, 20.0)
        );

        let pos = Point6D::linear(0.0, 0.0, 0.0);
        let orient = ToolOrientation::vertical();

        let result = detector.check_collision_6dof(&tool, &pos, &orient);
        assert!(!result.collision_detected);
    }
}
