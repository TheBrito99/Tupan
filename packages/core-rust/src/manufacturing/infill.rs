/**
 * Infill Pattern Generation
 * Creates various fill patterns for FDM printing
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::slicer::{Point2D, Line2D, BoundingBox2D};

/// Infill pattern generator
pub struct InfillGenerator {
    density: f64,                  // 0.0-1.0
    line_width: f64,              // mm
}

impl InfillGenerator {
    pub fn new(density: f64, line_width: f64) -> Self {
        InfillGenerator { density, line_width }
    }

    /// Generate linear infill (simplest, fastest)
    pub fn linear(&self, bbox: &BoundingBox2D) -> Vec<Line2D> {
        let mut lines = Vec::new();
        let spacing = self.line_width / self.density;

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

    /// Generate grid infill (perpendicular lines)
    pub fn grid(&self, bbox: &BoundingBox2D) -> Vec<Line2D> {
        let mut lines = self.linear(bbox);
        let spacing = self.line_width / self.density;

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

    /// Generate honeycomb infill (60-degree hexagonal pattern)
    pub fn honeycomb(&self, bbox: &BoundingBox2D) -> Vec<Line2D> {
        let mut lines = Vec::new();
        let spacing = self.line_width / self.density;
        let angle_60 = std::f64::consts::PI / 3.0; // 60 degrees
        let offset = spacing * angle_60.cos();

        // Horizontal lines
        let mut y = bbox.min_y;
        while y < bbox.max_y {
            lines.push(Line2D::new(
                Point2D::new(bbox.min_x, y),
                Point2D::new(bbox.max_x, y),
            ));
            y += spacing * angle_60.sin();
        }

        // Diagonal lines at 60 degrees
        let mut x = bbox.min_x;
        while x < bbox.max_x {
            let x1 = x;
            let y1 = bbox.min_y;
            let x2 = x + (bbox.max_y - bbox.min_y) / angle_60.tan();
            let y2 = bbox.max_y;

            if x2 >= bbox.min_x {
                lines.push(Line2D::new(
                    Point2D::new(x1.max(bbox.min_x), y1),
                    Point2D::new(x2.min(bbox.max_x), y2),
                ));
            }

            x += offset;
        }

        // Diagonal lines at -60 degrees
        let mut x = bbox.max_x;
        while x > bbox.min_x {
            let x1 = x;
            let y1 = bbox.min_y;
            let x2 = x - (bbox.max_y - bbox.min_y) / angle_60.tan();
            let y2 = bbox.max_y;

            if x2 <= bbox.max_x {
                lines.push(Line2D::new(
                    Point2D::new(x1.min(bbox.max_x), y1),
                    Point2D::new(x2.max(bbox.min_x), y2),
                ));
            }

            x -= offset;
        }

        lines
    }

    /// Generate gyroid infill (smooth organic pattern - approximated)
    pub fn gyroid(&self, bbox: &BoundingBox2D) -> Vec<Line2D> {
        // Gyroid uses smooth curves, approximate with curved line segments
        let mut lines = Vec::new();
        let spacing = self.line_width / self.density;
        let segments = 20;

        let mut y = bbox.min_y;
        while y < bbox.max_y {
            let mut x = bbox.min_x;
            let mut points = Vec::new();

            while x < bbox.max_x {
                let wave_offset = (x / 10.0).sin() * 2.0;
                points.push(Point2D::new(x, y + wave_offset));
                x += (bbox.max_x - bbox.min_x) / segments as f64;
            }

            // Create line segments from points
            for i in 0..points.len().saturating_sub(1) {
                lines.push(Line2D::new(points[i], points[i + 1]));
            }

            y += spacing;
        }

        lines
    }

    /// Generate cubic infill (3D lattice approximation)
    pub fn cubic(&self, bbox: &BoundingBox2D) -> Vec<Line2D> {
        let mut lines = Vec::new();
        let spacing = self.line_width / (self.density * 0.5); // Sparser for cubic

        // Grid pattern
        let mut x = bbox.min_x;
        while x < bbox.max_x {
            let mut y = bbox.min_y;
            while y < bbox.max_y {
                // Create small square at each lattice point
                lines.push(Line2D::new(
                    Point2D::new(x, y),
                    Point2D::new(x + spacing * 0.3, y),
                ));
                lines.push(Line2D::new(
                    Point2D::new(x + spacing * 0.3, y),
                    Point2D::new(x + spacing * 0.3, y + spacing * 0.3),
                ));
                lines.push(Line2D::new(
                    Point2D::new(x + spacing * 0.3, y + spacing * 0.3),
                    Point2D::new(x, y + spacing * 0.3),
                ));
                lines.push(Line2D::new(
                    Point2D::new(x, y + spacing * 0.3),
                    Point2D::new(x, y),
                ));

                y += spacing;
            }
            x += spacing;
        }

        lines
    }

    /// Generate Voronoi infill (cellular pattern)
    pub fn voronoi(&self, bbox: &BoundingBox2D) -> Vec<Line2D> {
        // Simplified Voronoi: create grid of circles
        let mut lines = Vec::new();
        let spacing = self.line_width / self.density;
        let radius = spacing * 0.4;

        let mut x = bbox.min_x + spacing / 2.0;
        while x < bbox.max_x {
            let mut y = bbox.min_y + spacing / 2.0;
            while y < bbox.max_y {
                // Draw circle as approximation
                let segments = 12;
                for i in 0..segments {
                    let angle1 = 2.0 * std::f64::consts::PI * (i as f64) / (segments as f64);
                    let angle2 =
                        2.0 * std::f64::consts::PI * ((i + 1) as f64) / (segments as f64);

                    let x1 = x + radius * angle1.cos();
                    let y1 = y + radius * angle1.sin();
                    let x2 = x + radius * angle2.cos();
                    let y2 = y + radius * angle2.sin();

                    lines.push(Line2D::new(
                        Point2D::new(x1, y1),
                        Point2D::new(x2, y2),
                    ));
                }

                y += spacing;
            }
            x += spacing;
        }

        lines
    }
}

/// Infill density analyzer
pub struct InfillAnalyzer;

impl InfillAnalyzer {
    /// Calculate material usage for infill
    pub fn material_usage(
        layer_area: f64,        // mm²
        infill_density: f64,    // 0.0-1.0
        layer_height: f64,      // mm
        filament_density: f64,  // g/cm³
    ) -> f64 {
        // Volume = area * height * density
        let volume = layer_area * layer_height * infill_density;
        // Mass = volume * density (in mm³ to g conversion: /1000)
        (volume / 1000.0) * filament_density
    }

    /// Get recommended density for model type
    pub fn recommended_density(model_type: &str) -> f64 {
        match model_type {
            "decoration" => 0.0,   // Hollow
            "miniature" => 0.1,
            "functional" => 0.2,
            "structural" => 0.5,
            "solid" => 1.0,
            _ => 0.2,
        }
    }

    /// Calculate print time for infill
    pub fn print_time_minutes(
        total_infill_length: f64, // mm
        feedrate: f64,            // mm/min
    ) -> f64 {
        total_infill_length / feedrate
    }

    /// Strength rating for different patterns
    pub fn strength_rating(pattern: &str) -> f64 {
        match pattern {
            "linear" => 0.3,
            "grid" => 0.7,
            "honeycomb" => 0.9,
            "gyroid" => 0.95,
            "cubic" => 0.85,
            "voronoi" => 0.8,
            _ => 0.5,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infill_generator_creation() {
        let gen = InfillGenerator::new(0.2, 1.2);
        assert_eq!(gen.density, 0.2);
    }

    #[test]
    fn test_linear_infill() {
        let gen = InfillGenerator::new(0.2, 1.2);
        let bbox = BoundingBox2D {
            min_x: 0.0,
            max_x: 10.0,
            min_y: 0.0,
            max_y: 10.0,
        };

        let lines = gen.linear(&bbox);
        assert!(lines.len() > 0);
    }

    #[test]
    fn test_grid_infill() {
        let gen = InfillGenerator::new(0.2, 1.2);
        let bbox = BoundingBox2D {
            min_x: 0.0,
            max_x: 10.0,
            min_y: 0.0,
            max_y: 10.0,
        };

        let lines = gen.grid(&bbox);
        assert!(lines.len() > 10); // Grid should have more lines than linear
    }

    #[test]
    fn test_honeycomb_infill() {
        let gen = InfillGenerator::new(0.2, 1.2);
        let bbox = BoundingBox2D {
            min_x: 0.0,
            max_x: 10.0,
            min_y: 0.0,
            max_y: 10.0,
        };

        let lines = gen.honeycomb(&bbox);
        assert!(lines.len() > 0);
    }

    #[test]
    fn test_gyroid_infill() {
        let gen = InfillGenerator::new(0.2, 1.2);
        let bbox = BoundingBox2D {
            min_x: 0.0,
            max_x: 10.0,
            min_y: 0.0,
            max_y: 10.0,
        };

        let lines = gen.gyroid(&bbox);
        assert!(lines.len() > 0);
    }

    #[test]
    fn test_cubic_infill() {
        let gen = InfillGenerator::new(0.2, 1.2);
        let bbox = BoundingBox2D {
            min_x: 0.0,
            max_x: 10.0,
            min_y: 0.0,
            max_y: 10.0,
        };

        let lines = gen.cubic(&bbox);
        assert!(lines.len() > 0);
    }

    #[test]
    fn test_voronoi_infill() {
        let gen = InfillGenerator::new(0.2, 1.2);
        let bbox = BoundingBox2D {
            min_x: 0.0,
            max_x: 10.0,
            min_y: 0.0,
            max_y: 10.0,
        };

        let lines = gen.voronoi(&bbox);
        assert!(lines.len() > 0);
    }

    #[test]
    fn test_material_usage() {
        let usage = InfillAnalyzer::material_usage(100.0, 0.2, 0.2, 1.25);
        assert!(usage > 0.0);
    }

    #[test]
    fn test_recommended_density() {
        let deco = InfillAnalyzer::recommended_density("decoration");
        let struct_density = InfillAnalyzer::recommended_density("structural");
        assert!(deco < struct_density);
    }

    #[test]
    fn test_strength_rating() {
        let linear = InfillAnalyzer::strength_rating("linear");
        let grid = InfillAnalyzer::strength_rating("grid");
        assert!(grid > linear);
    }

    #[test]
    fn test_print_time() {
        let time = InfillAnalyzer::print_time_minutes(100.0, 50.0);
        assert_eq!(time, 2.0);
    }
}
