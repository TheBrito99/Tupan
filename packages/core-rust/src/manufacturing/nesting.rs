/**
 * 2D Nesting Optimizer
 * Arranges 2D parts on a sheet to minimize material waste
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 2D Part for nesting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part2D {
    pub id: String,
    pub name: String,
    pub vertices: Vec<Point2D>,
    pub width: f64,
    pub height: f64,
    pub area: f64,
    pub quantity: u32,
    pub rotation_allowed: bool,
}

/// 2D Point
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

/// Placed part instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacedPart {
    pub part_id: String,
    pub position: Point2D,
    pub rotation: f64,           // degrees
    pub width: f64,
    pub height: f64,
}

impl PlacedPart {
    pub fn new(part_id: String, position: Point2D, rotation: f64, width: f64, height: f64) -> Self {
        PlacedPart {
            part_id,
            position,
            rotation,
            width,
            height,
        }
    }

    /// Get bounding box of placed part
    pub fn bounding_box(&self) -> BoundingBox2D {
        BoundingBox2D {
            min_x: self.position.x,
            max_x: self.position.x + self.width,
            min_y: self.position.y,
            max_y: self.position.y + self.height,
        }
    }

    /// Check collision with another placed part
    pub fn collides_with(&self, other: &PlacedPart) -> bool {
        let box1 = self.bounding_box();
        let box2 = other.bounding_box();

        !(box1.max_x < box2.min_x
            || box1.min_x > box2.max_x
            || box1.max_y < box2.min_y
            || box1.min_y > box2.max_y)
    }
}

/// Sheet material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sheet {
    pub width: f64,              // mm
    pub height: f64,             // mm
    pub material: String,
    pub cost_per_sheet: f64,
    pub thickness: f64,          // mm
}

impl Sheet {
    pub fn new(width: f64, height: f64, material: String, cost: f64) -> Self {
        Sheet {
            width,
            height,
            material,
            cost_per_sheet: cost,
            thickness: 3.0,
        }
    }

    pub fn area(&self) -> f64 {
        self.width * self.height
    }

    /// Check if part fits in sheet
    pub fn can_fit(&self, part: &Part2D) -> bool {
        part.width <= self.width && part.height <= self.height
    }
}

/// Bounding box
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

    pub fn contains_point(&self, point: &Point2D) -> bool {
        point.x >= self.min_x && point.x <= self.max_x && point.y >= self.min_y && point.y <= self.max_y
    }

    pub fn intersects(&self, other: &BoundingBox2D) -> bool {
        !(self.max_x < other.min_x
            || self.min_x > other.max_x
            || self.max_y < other.min_y
            || self.min_y > other.max_y)
    }
}

/// Nesting result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NestingResult {
    pub sheets: Vec<Vec<PlacedPart>>,
    pub sheet_count: usize,
    pub total_material_area: f64,
    pub total_parts_area: f64,
    pub utilization: f64,         // percentage
    pub waste: f64,               // percentage
    pub total_cost: f64,
    pub cutting_time: f64,        // minutes
}

impl NestingResult {
    pub fn new() -> Self {
        NestingResult {
            sheets: Vec::new(),
            sheet_count: 0,
            total_material_area: 0.0,
            total_parts_area: 0.0,
            utilization: 0.0,
            waste: 0.0,
            total_cost: 0.0,
            cutting_time: 0.0,
        }
    }

    /// Calculate efficiency metrics
    pub fn calculate_metrics(&mut self, sheet: &Sheet, parts: &[Part2D]) {
        self.sheet_count = self.sheets.len();
        self.total_material_area = self.sheet_count as f64 * sheet.area();

        self.total_parts_area = parts.iter().map(|p| p.area).sum();

        if self.total_material_area > 0.0 {
            self.utilization = (self.total_parts_area / self.total_material_area) * 100.0;
            self.waste = 100.0 - self.utilization;
        }

        self.total_cost = self.sheet_count as f64 * sheet.cost_per_sheet;
    }
}

/// 2D Nesting optimizer
pub struct NestingOptimizer;

impl NestingOptimizer {
    /// Simple left-bottom nesting algorithm
    pub fn pack_simple(
        parts: Vec<Part2D>,
        sheet: &Sheet,
    ) -> Result<NestingResult, String> {
        let mut result = NestingResult::new();
        let mut current_sheet: Vec<PlacedPart> = Vec::new();
        let mut remaining_parts = parts.clone();

        for part in remaining_parts {
            // Try to place on current sheet
            if let Some(pos) = Self::find_position(&current_sheet, &part, sheet) {
                current_sheet.push(PlacedPart::new(
                    part.id.clone(),
                    pos,
                    0.0,
                    part.width,
                    part.height,
                ));
            } else {
                // Start new sheet
                if !current_sheet.is_empty() {
                    result.sheets.push(current_sheet);
                    current_sheet = Vec::new();
                }

                let pos = Point2D::new(0.0, 0.0);
                current_sheet.push(PlacedPart::new(
                    part.id.clone(),
                    pos,
                    0.0,
                    part.width,
                    part.height,
                ));
            }
        }

        if !current_sheet.is_empty() {
            result.sheets.push(current_sheet);
        }

        result.calculate_metrics(sheet, &parts);
        Ok(result)
    }

    /// Find position for part using bottom-left heuristic
    fn find_position(
        placed_parts: &[PlacedPart],
        part: &Part2D,
        sheet: &Sheet,
    ) -> Option<Point2D> {
        // Try to place at (0,0) first
        if part.width <= sheet.width && part.height <= sheet.height {
            let candidate = Point2D::new(0.0, 0.0);
            let candidate_part = PlacedPart::new(
                "candidate".to_string(),
                candidate,
                0.0,
                part.width,
                part.height,
            );

            let mut valid = true;
            for placed in placed_parts {
                if candidate_part.collides_with(placed) {
                    valid = false;
                    break;
                }
            }

            if valid {
                let candidate_box = candidate_part.bounding_box();
                if candidate_box.max_x <= sheet.width && candidate_box.max_y <= sheet.height {
                    return Some(candidate);
                }
            }
        }

        // Try positions along right and top of placed parts
        for placed in placed_parts {
            let candidates = vec![
                Point2D::new(placed.position.x + placed.width, placed.position.y), // Right
                Point2D::new(placed.position.x, placed.position.y + placed.height), // Top
            ];

            for candidate in candidates {
                if Self::can_place_at(placed_parts, part, &candidate, sheet) {
                    return Some(candidate);
                }
            }
        }

        None
    }

    /// Check if part can be placed at position
    fn can_place_at(
        placed_parts: &[PlacedPart],
        part: &Part2D,
        pos: &Point2D,
        sheet: &Sheet,
    ) -> bool {
        let candidate = PlacedPart::new("check".to_string(), *pos, 0.0, part.width, part.height);
        let bbox = candidate.bounding_box();

        // Check sheet bounds
        if bbox.max_x > sheet.width || bbox.max_y > sheet.height {
            return false;
        }

        // Check collisions
        for placed in placed_parts {
            if candidate.collides_with(placed) {
                return false;
            }
        }

        true
    }

    /// Calculate cutting time for parts
    pub fn estimate_cutting_time(parts: &[Part2D], speed: f64) -> f64 {
        let total_length: f64 = parts.iter().map(|p| {
            let perimeter = 2.0 * (p.width + p.height);
            perimeter * (p.quantity as f64)
        }).sum();

        total_length / speed * 60.0 // Convert to minutes
    }

    /// Calculate material waste
    pub fn calculate_waste(parts_area: f64, sheet_area: f64, num_sheets: usize) -> f64 {
        let total_material = sheet_area * (num_sheets as f64);
        if total_material == 0.0 {
            return 0.0;
        }
        ((total_material - parts_area) / total_material) * 100.0
    }

    /// Get recommended sheet size
    pub fn recommend_sheet_size(
        parts: &[Part2D],
        max_length: f64,
    ) -> (f64, f64) {
        let total_area: f64 = parts.iter().map(|p| p.area).sum();
        let estimated_side = total_area.sqrt() * 1.2; // Add 20% margin

        let width = estimated_side.min(max_length);
        let height = estimated_side.min(max_length);

        (width, height)
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
    fn test_placed_part_collision() {
        let part1 = PlacedPart::new("p1".to_string(), Point2D::new(0.0, 0.0), 0.0, 10.0, 10.0);
        let part2 = PlacedPart::new("p2".to_string(), Point2D::new(5.0, 5.0), 0.0, 10.0, 10.0);
        assert!(part1.collides_with(&part2));
    }

    #[test]
    fn test_no_collision() {
        let part1 = PlacedPart::new("p1".to_string(), Point2D::new(0.0, 0.0), 0.0, 10.0, 10.0);
        let part2 = PlacedPart::new("p2".to_string(), Point2D::new(20.0, 20.0), 0.0, 10.0, 10.0);
        assert!(!part1.collides_with(&part2));
    }

    #[test]
    fn test_sheet_creation() {
        let sheet = Sheet::new(1000.0, 500.0, "Plywood".to_string(), 50.0);
        assert_eq!(sheet.area(), 500000.0);
    }

    #[test]
    fn test_part_fits_in_sheet() {
        let sheet = Sheet::new(1000.0, 500.0, "Plywood".to_string(), 50.0);
        let part = Part2D {
            id: "p1".to_string(),
            name: "Box".to_string(),
            vertices: vec![],
            width: 100.0,
            height: 50.0,
            area: 5000.0,
            quantity: 1,
            rotation_allowed: true,
        };
        assert!(sheet.can_fit(&part));
    }

    #[test]
    fn test_bounding_box_intersection() {
        let bbox1 = BoundingBox2D {
            min_x: 0.0,
            max_x: 10.0,
            min_y: 0.0,
            max_y: 10.0,
        };
        let bbox2 = BoundingBox2D {
            min_x: 5.0,
            max_x: 15.0,
            min_y: 5.0,
            max_y: 15.0,
        };
        assert!(bbox1.intersects(&bbox2));
    }

    #[test]
    fn test_nesting_simple() {
        let sheet = Sheet::new(1000.0, 500.0, "Plywood".to_string(), 50.0);
        let parts = vec![
            Part2D {
                id: "p1".to_string(),
                name: "Box1".to_string(),
                vertices: vec![],
                width: 100.0,
                height: 100.0,
                area: 10000.0,
                quantity: 1,
                rotation_allowed: true,
            },
            Part2D {
                id: "p2".to_string(),
                name: "Box2".to_string(),
                vertices: vec![],
                width: 100.0,
                height: 100.0,
                area: 10000.0,
                quantity: 1,
                rotation_allowed: true,
            },
        ];

        let result = NestingOptimizer::pack_simple(parts, &sheet);
        assert!(result.is_ok());
    }

    #[test]
    fn test_cutting_time_estimate() {
        let parts = vec![Part2D {
            id: "p1".to_string(),
            name: "Box".to_string(),
            vertices: vec![],
            width: 100.0,
            height: 100.0,
            area: 10000.0,
            quantity: 1,
            rotation_allowed: true,
        }];

        let time = NestingOptimizer::estimate_cutting_time(&parts, 500.0);
        assert!(time > 0.0);
    }

    #[test]
    fn test_waste_calculation() {
        let waste = NestingOptimizer::calculate_waste(50000.0, 500000.0, 1);
        assert!(waste > 0.0 && waste < 100.0);
    }
}
