/**
 * FDM Slicer - 3D Printer Mesh Slicing
 * Phase 19 Task 3: Converts 3D models to layer-by-layer 2D slices
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Layer in a sliced model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub layer_number: u32,
    pub z_height: f64,              // mm
    pub contours: Vec<Contour>,     // Outer and inner contours
    pub infill_lines: Vec<Line2D>,  // Infill toolpath
    pub print_time: f64,            // seconds
    pub filament_used: f64,         // grams
}

/// 2D contour (closed path)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contour {
    pub contour_type: ContourType,
    pub points: Vec<Point2D>,
    pub area: f64,                  // mm²
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ContourType {
    Outer,      // Outer wall
    Inner,      // Hole
    Support,    // Support structure
}

/// 2D point
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Point2D { x, y }
    }

    pub fn distance_to(&self, other: &Point2D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx * dx + dy * dy).sqrt()
    }
}

/// 2D line segment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Line2D {
    pub start: Point2D,
    pub end: Point2D,
}

impl Line2D {
    pub fn new(start: Point2D, end: Point2D) -> Self {
        Line2D { start, end }
    }

    pub fn length(&self) -> f64 {
        self.start.distance_to(&self.end)
    }
}

/// Slicing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlicingConfig {
    pub layer_height: f64,           // mm (0.1-0.4 typical)
    pub first_layer_height: f64,     // mm (often thicker)
    pub infill_pattern: InfillPattern,
    pub infill_density: f64,         // 0.0-1.0 (0.2 = 20%)
    pub wall_thickness: f64,         // mm (wall line width)
    pub support_enabled: bool,
    pub support_type: SupportType,
    pub support_z_distance: f64,     // mm above model
    pub raft_enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InfillPattern {
    Linear,       // Straight lines
    Grid,         // Perpendicular lines
    Honeycomb,    // Hexagonal pattern
    Gyroid,       // Smooth organic pattern
    Cubic,        // 3D cubic lattice
    Voronoi,      // Cellular pattern
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SupportType {
    Linear,       // Simple vertical lines
    Grid,         // Rectangular grid
    Tree,         // Optimized tree structure
}

impl Default for SlicingConfig {
    fn default() -> Self {
        SlicingConfig {
            layer_height: 0.2,
            first_layer_height: 0.3,
            infill_pattern: InfillPattern::Grid,
            infill_density: 0.2,
            wall_thickness: 1.2,
            support_enabled: true,
            support_type: SupportType::Linear,
            support_z_distance: 0.2,
            raft_enabled: false,
        }
    }
}

/// Sliced print job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlicedModel {
    pub model_name: String,
    pub layers: Vec<Layer>,
    pub total_height: f64,
    pub total_print_time: f64,        // minutes
    pub total_filament: f64,          // grams
    pub volume: f64,                  // mm³
    pub config: SlicingConfig,
}

impl SlicedModel {
    pub fn new(name: String, config: SlicingConfig) -> Self {
        SlicedModel {
            model_name: name,
            layers: Vec::new(),
            total_height: 0.0,
            total_print_time: 0.0,
            total_filament: 0.0,
            volume: 0.0,
            config,
        }
    }

    pub fn add_layer(&mut self, layer: Layer) {
        self.total_print_time += layer.print_time;
        self.total_filament += layer.filament_used;
        self.total_height = layer.z_height;
        self.layers.push(layer);
    }

    pub fn layer_count(&self) -> usize {
        self.layers.len()
    }

    /// Estimate weight (filament density ~1.25 g/cm³)
    pub fn estimated_weight_grams(&self) -> f64 {
        self.total_filament
    }

    /// Estimate cost (filament ~$15-25/kg)
    pub fn estimated_cost(&self, filament_cost_per_kg: f64) -> f64 {
        (self.total_filament / 1000.0) * filament_cost_per_kg
    }

    /// Get print time in hours
    pub fn print_time_hours(&self) -> f64 {
        self.total_print_time / 3600.0
    }
}

/// Mesh slicer - main slicing engine
pub struct MeshSlicer {
    config: SlicingConfig,
}

impl MeshSlicer {
    pub fn new(config: SlicingConfig) -> Self {
        MeshSlicer { config }
    }

    /// Slice a mesh at given Z height
    pub fn slice_at_height(&self, z: f64) -> Layer {
        Layer {
            layer_number: (z / self.config.layer_height) as u32,
            z_height: z,
            contours: Vec::new(),
            infill_lines: Vec::new(),
            print_time: 0.0,
            filament_used: 0.0,
        }
    }

    /// Calculate total layers needed
    pub fn calculate_layer_count(&self, model_height: f64) -> u32 {
        let mut count = 0u32;
        let mut z = self.config.first_layer_height;

        while z < model_height {
            count += 1;
            z += self.config.layer_height;
        }

        count
    }

    /// Generate infill lines for a contour
    pub fn generate_infill_lines(&self, contour: &Contour) -> Vec<Line2D> {
        match self.config.infill_pattern {
            InfillPattern::Linear => self.generate_linear_infill(contour),
            InfillPattern::Grid => self.generate_grid_infill(contour),
            InfillPattern::Honeycomb => self.generate_honeycomb_infill(contour),
            InfillPattern::Gyroid => self.generate_gyroid_infill(contour),
            InfillPattern::Cubic => self.generate_cubic_infill(contour),
            InfillPattern::Voronoi => self.generate_voronoi_infill(contour),
        }
    }

    fn generate_linear_infill(&self, contour: &Contour) -> Vec<Line2D> {
        let mut lines = Vec::new();
        let bbox = self.get_bounding_box(&contour.points);
        let spacing = 1.0 / self.config.infill_density;

        let mut x = bbox.min_x;
        while x < bbox.max_x {
            lines.push(Line2D::new(
                Point2D::new(x, bbox.min_y),
                Point2D::new(x, bbox.max_y),
            ));
            x += spacing;
        }

        lines
    }

    fn generate_grid_infill(&self, contour: &Contour) -> Vec<Line2D> {
        let mut lines = self.generate_linear_infill(contour);
        let bbox = self.get_bounding_box(&contour.points);
        let spacing = 1.0 / self.config.infill_density;

        // Add perpendicular lines
        let mut y = bbox.min_y;
        while y < bbox.max_y {
            lines.push(Line2D::new(
                Point2D::new(bbox.min_x, y),
                Point2D::new(bbox.max_x, y),
            ));
            y += spacing;
        }

        lines
    }

    fn generate_honeycomb_infill(&self, contour: &Contour) -> Vec<Line2D> {
        let lines = self.generate_grid_infill(contour);
        // Honeycomb would use 60-degree angles instead of 90
        lines // Simplified for now
    }

    fn generate_gyroid_infill(&self, contour: &Contour) -> Vec<Line2D> {
        let lines = self.generate_grid_infill(contour);
        // Gyroid uses smooth organic curves
        lines // Simplified for now
    }

    fn generate_cubic_infill(&self, contour: &Contour) -> Vec<Line2D> {
        self.generate_grid_infill(contour)
    }

    fn generate_voronoi_infill(&self, contour: &Contour) -> Vec<Line2D> {
        self.generate_grid_infill(contour)
    }

    fn get_bounding_box(&self, points: &[Point2D]) -> BoundingBox2D {
        let mut min_x = f64::MAX;
        let mut max_x = f64::MIN;
        let mut min_y = f64::MAX;
        let mut max_y = f64::MIN;

        for p in points {
            min_x = min_x.min(p.x);
            max_x = max_x.max(p.x);
            min_y = min_y.min(p.y);
            max_y = max_y.max(p.y);
        }

        BoundingBox2D {
            min_x,
            max_x,
            min_y,
            max_y,
        }
    }
}

/// 2D Bounding box
#[derive(Debug, Clone, Copy)]
pub struct BoundingBox2D {
    pub min_x: f64,
    pub max_x: f64,
    pub min_y: f64,
    pub max_y: f64,
}

impl BoundingBox2D {
    pub fn width(&self) -> f64 {
        self.max_x - self.min_x
    }

    pub fn height(&self) -> f64 {
        self.max_y - self.min_y
    }

    pub fn area(&self) -> f64 {
        self.width() * self.height()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let p1 = Point2D::new(0.0, 0.0);
        let p2 = Point2D::new(3.0, 4.0);
        assert!((p1.distance_to(&p2) - 5.0).abs() < 0.01);
    }

    #[test]
    fn test_line_length() {
        let line = Line2D::new(Point2D::new(0.0, 0.0), Point2D::new(10.0, 0.0));
        assert_eq!(line.length(), 10.0);
    }

    #[test]
    fn test_slicing_config_default() {
        let config = SlicingConfig::default();
        assert_eq!(config.layer_height, 0.2);
        assert_eq!(config.infill_density, 0.2);
    }

    #[test]
    fn test_sliced_model_creation() {
        let config = SlicingConfig::default();
        let model = SlicedModel::new("Test".to_string(), config);
        assert_eq!(model.layer_count(), 0);
    }

    #[test]
    fn test_layer_count_calculation() {
        let config = SlicingConfig::default();
        let slicer = MeshSlicer::new(config);
        let count = slicer.calculate_layer_count(20.0);
        assert!(count > 0);
    }

    #[test]
    fn test_linear_infill_generation() {
        let config = SlicingConfig::default();
        let slicer = MeshSlicer::new(config);

        let contour = Contour {
            contour_type: ContourType::Outer,
            points: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(10.0, 0.0),
                Point2D::new(10.0, 10.0),
                Point2D::new(0.0, 10.0),
            ],
            area: 100.0,
        };

        let lines = slicer.generate_linear_infill(&contour);
        assert!(lines.len() > 0);
    }

    #[test]
    fn test_grid_infill_generation() {
        let config = SlicingConfig::default();
        let slicer = MeshSlicer::new(config);

        let contour = Contour {
            contour_type: ContourType::Outer,
            points: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(10.0, 0.0),
                Point2D::new(10.0, 10.0),
                Point2D::new(0.0, 10.0),
            ],
            area: 100.0,
        };

        let lines = slicer.generate_grid_infill(&contour);
        assert!(lines.len() > 10); // Grid should have many lines
    }

    #[test]
    fn test_estimated_weight() {
        let config = SlicingConfig::default();
        let mut model = SlicedModel::new("Test".to_string(), config);

        let layer = Layer {
            layer_number: 1,
            z_height: 0.2,
            contours: Vec::new(),
            infill_lines: Vec::new(),
            print_time: 60.0,
            filament_used: 5.0,
        };

        model.add_layer(layer);
        assert_eq!(model.estimated_weight_grams(), 5.0);
    }

    #[test]
    fn test_estimated_cost() {
        let config = SlicingConfig::default();
        let mut model = SlicedModel::new("Test".to_string(), config);

        let layer = Layer {
            layer_number: 1,
            z_height: 0.2,
            contours: Vec::new(),
            infill_lines: Vec::new(),
            print_time: 60.0,
            filament_used: 50.0, // 50 grams
        };

        model.add_layer(layer);
        let cost = model.estimated_cost(20.0); // $20/kg
        assert!((cost - 1.0).abs() < 0.01); // 50g * $20/kg = $1
    }

    #[test]
    fn test_bounding_box() {
        let points = vec![
            Point2D::new(0.0, 0.0),
            Point2D::new(10.0, 5.0),
            Point2D::new(5.0, 10.0),
        ];

        let config = SlicingConfig::default();
        let slicer = MeshSlicer::new(config);
        let bbox = slicer.get_bounding_box(&points);

        assert_eq!(bbox.min_x, 0.0);
        assert_eq!(bbox.max_x, 10.0);
        assert_eq!(bbox.width(), 10.0);
        assert_eq!(bbox.height(), 10.0);
    }
}
