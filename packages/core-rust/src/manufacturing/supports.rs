/**
 * Support Structure Generation
 * Generates material supports for FDM printing
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::slicer::{Point2D, Line2D, Contour, ContourType};

/// Support structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupportStructure {
    pub support_type: SupportStructureType,
    pub lines: Vec<Line2D>,
    pub volume: f64,               // mm³
    pub material_used: f64,        // grams
    pub print_time: f64,           // seconds
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SupportStructureType {
    Linear,      // Simple vertical lines
    Grid,        // Rectangular grid
    Tree,        // Optimized tree structure
}

/// Support generator
pub struct SupportGenerator {
    z_distance: f64,               // mm above model
    line_width: f64,               // mm
    structure_type: SupportStructureType,
}

impl SupportGenerator {
    pub fn new(
        z_distance: f64,
        line_width: f64,
        structure_type: SupportStructureType,
    ) -> Self {
        SupportGenerator {
            z_distance,
            line_width,
            structure_type,
        }
    }

    /// Check if point needs support (overhang detection)
    pub fn needs_support(
        &self,
        current_layer: &Contour,
        previous_layer: Option<&Contour>,
        overhang_angle: f64, // degrees
    ) -> bool {
        if let Some(prev) = previous_layer {
            let overhang_threshold = overhang_angle.to_radians().tan();

            // Simple check: if contour is significantly larger, it needs support
            self.contour_expansion(prev, current_layer) > overhang_threshold
        } else {
            false
        }
    }

    /// Calculate overhang amount
    fn contour_expansion(&self, previous: &Contour, current: &Contour) -> f64 {
        let prev_bbox = self.get_bounding_box(&previous.points);
        let curr_bbox = self.get_bounding_box(&current.points);

        let prev_area = prev_bbox.width() * prev_bbox.height();
        let curr_area = curr_bbox.width() * curr_bbox.height();

        if prev_area == 0.0 {
            0.0
        } else {
            (curr_area - prev_area).max(0.0) / prev_area
        }
    }

    /// Generate linear support structure
    pub fn generate_linear_supports(
        &self,
        base_layer: &Contour,
        overhang_region: &Contour,
    ) -> SupportStructure {
        let mut lines = Vec::new();

        let bbox = self.get_bounding_box(&overhang_region.points);
        let spacing = 5.0; // Support pillar spacing (mm)

        let mut x = bbox.min_x;
        while x < bbox.max_x {
            let mut y = bbox.min_y;
            while y < bbox.max_y {
                lines.push(Line2D::new(
                    Point2D::new(x, y),
                    Point2D::new(x, y + 0.2), // Very thin support line
                ));
                y += spacing;
            }
            x += spacing;
        }

        let volume = self.calculate_volume(&lines);
        SupportStructure {
            support_type: SupportStructureType::Linear,
            lines,
            volume,
            material_used: volume / 1000.0 * 1.25, // grams
            print_time: (volume / 1000.0) / 10.0 * 60.0, // seconds
        }
    }

    /// Generate grid support structure
    pub fn generate_grid_supports(
        &self,
        base_layer: &Contour,
        overhang_region: &Contour,
    ) -> SupportStructure {
        let mut lines = Vec::new();

        let bbox = self.get_bounding_box(&overhang_region.points);
        let spacing = 3.0; // Grid spacing (mm)

        // Horizontal lines
        let mut y = bbox.min_y;
        while y < bbox.max_y {
            lines.push(Line2D::new(
                Point2D::new(bbox.min_x, y),
                Point2D::new(bbox.max_x, y),
            ));
            y += spacing;
        }

        // Vertical lines
        let mut x = bbox.min_x;
        while x < bbox.max_x {
            lines.push(Line2D::new(
                Point2D::new(x, bbox.min_y),
                Point2D::new(x, bbox.max_y),
            ));
            x += spacing;
        }

        let volume = self.calculate_volume(&lines);
        SupportStructure {
            support_type: SupportStructureType::Grid,
            lines,
            volume,
            material_used: volume / 1000.0 * 1.25,
            print_time: (volume / 1000.0) / 10.0 * 60.0,
        }
    }

    /// Generate tree support structure (optimized)
    pub fn generate_tree_supports(
        &self,
        base_layer: &Contour,
        overhang_region: &Contour,
    ) -> SupportStructure {
        let mut lines = Vec::new();

        // Tree supports grow upward from base layer to support overhang
        let base_bbox = self.get_bounding_box(&base_layer.points);
        let over_bbox = self.get_bounding_box(&overhang_region.points);

        // Find optimal pillar locations (centers of overhang regions)
        let pillar_spacing = 5.0;
        let mut x = over_bbox.min_x;
        while x < over_bbox.max_x {
            let mut y = over_bbox.min_y;
            while y < over_bbox.max_y {
                // Draw line from base to overhang point
                let base_point = Point2D::new(
                    x.max(base_bbox.min_x).min(base_bbox.max_x),
                    y.max(base_bbox.min_y).min(base_bbox.max_y),
                );
                let over_point = Point2D::new(x, y);

                lines.push(Line2D::new(base_point, over_point));

                // Branch out slightly for better support
                if x < over_bbox.max_x - 2.0 {
                    lines.push(Line2D::new(
                        over_point,
                        Point2D::new(x + 1.0, y),
                    ));
                }

                y += pillar_spacing;
            }
            x += pillar_spacing;
        }

        let volume = self.calculate_volume(&lines);
        SupportStructure {
            support_type: SupportStructureType::Tree,
            lines,
            volume,
            material_used: volume / 1000.0 * 1.25,
            print_time: (volume / 1000.0) / 10.0 * 60.0,
        }
    }

    /// Calculate volume of support structure
    fn calculate_volume(&self, lines: &[Line2D]) -> f64 {
        let mut total = 0.0;
        for line in lines {
            // Volume = length * width * height (layer height)
            let line_length = line.start.distance_to(&line.end);
            total += line_length * self.line_width * 0.2; // 0.2mm layer height
        }
        total
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
}

/// Support analysis
pub struct SupportAnalyzer;

impl SupportAnalyzer {
    /// Calculate overhang percentage
    pub fn calculate_overhang_percentage(
        previous_layer: &Contour,
        current_layer: &Contour,
    ) -> f64 {
        let prev_area = Self::contour_area(previous_layer);
        let curr_area = Self::contour_area(current_layer);

        if prev_area == 0.0 {
            0.0
        } else {
            ((curr_area - prev_area).max(0.0) / prev_area) * 100.0
        }
    }

    fn contour_area(contour: &Contour) -> f64 {
        contour.area
    }

    /// Estimate support volume reduction
    pub fn estimate_support_reduction(
        linear_volume: f64,
        grid_volume: f64,
        tree_volume: f64,
    ) -> (f64, f64) {
        // Returns (grid_reduction_percent, tree_reduction_percent)
        let grid_reduction = ((linear_volume - grid_volume) / linear_volume) * 100.0;
        let tree_reduction = ((linear_volume - tree_volume) / linear_volume) * 100.0;
        (grid_reduction, tree_reduction)
    }

    /// Check if support is necessary at all
    pub fn support_necessary(overhang_angle: f64) -> bool {
        // Most FDM printers have ~45 degree overhang limit
        overhang_angle > 45.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_support_generator_creation() {
        let gen = SupportGenerator::new(0.2, 1.2, SupportStructureType::Linear);
        assert_eq!(gen.z_distance, 0.2);
    }

    #[test]
    fn test_linear_support_generation() {
        let gen = SupportGenerator::new(0.2, 1.2, SupportStructureType::Linear);

        let base = Contour {
            contour_type: ContourType::Outer,
            points: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(10.0, 0.0),
                Point2D::new(10.0, 10.0),
                Point2D::new(0.0, 10.0),
            ],
            area: 100.0,
        };

        let overhang = Contour {
            contour_type: ContourType::Support,
            points: vec![
                Point2D::new(2.0, 2.0),
                Point2D::new(8.0, 2.0),
                Point2D::new(8.0, 8.0),
                Point2D::new(2.0, 8.0),
            ],
            area: 36.0,
        };

        let supports = gen.generate_linear_supports(&base, &overhang);
        assert!(supports.lines.len() > 0);
        assert!(supports.volume > 0.0);
    }

    #[test]
    fn test_grid_support_generation() {
        let gen = SupportGenerator::new(0.2, 1.2, SupportStructureType::Grid);

        let base = Contour {
            contour_type: ContourType::Outer,
            points: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(10.0, 0.0),
                Point2D::new(10.0, 10.0),
                Point2D::new(0.0, 10.0),
            ],
            area: 100.0,
        };

        let overhang = Contour {
            contour_type: ContourType::Support,
            points: vec![
                Point2D::new(2.0, 2.0),
                Point2D::new(8.0, 2.0),
                Point2D::new(8.0, 8.0),
                Point2D::new(2.0, 8.0),
            ],
            area: 36.0,
        };

        let supports = gen.generate_grid_supports(&base, &overhang);
        assert!(supports.lines.len() > 10); // Grid should have many lines
    }

    #[test]
    fn test_tree_support_generation() {
        let gen = SupportGenerator::new(0.2, 1.2, SupportStructureType::Tree);

        let base = Contour {
            contour_type: ContourType::Outer,
            points: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(10.0, 0.0),
                Point2D::new(10.0, 10.0),
                Point2D::new(0.0, 10.0),
            ],
            area: 100.0,
        };

        let overhang = Contour {
            contour_type: ContourType::Support,
            points: vec![
                Point2D::new(2.0, 2.0),
                Point2D::new(8.0, 2.0),
                Point2D::new(8.0, 8.0),
                Point2D::new(2.0, 8.0),
            ],
            area: 36.0,
        };

        let supports = gen.generate_tree_supports(&base, &overhang);
        assert!(supports.lines.len() > 0);
    }

    #[test]
    fn test_support_necessary() {
        assert!(SupportAnalyzer::support_necessary(60.0));
        assert!(!SupportAnalyzer::support_necessary(30.0));
    }

    #[test]
    fn test_support_reduction() {
        let (grid_red, tree_red) = SupportAnalyzer::estimate_support_reduction(100.0, 60.0, 30.0);
        assert!(grid_red > 0.0);
        assert!(tree_red > grid_red);
    }
}
