/**
 * Parametric Sketcher
 * Phase 17: 3D CAD Foundation
 *
 * 2D sketcher with full constraint solver integration
 */

use super::constraint_solver::{Constraint, ConstraintType, SketchEntity, ConstraintSolver, Point2D, Line2D, Circle2D};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point2DData {
    pub x: f64,
    pub y: f64,
    pub construction: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Line2DData {
    pub start_id: String,
    pub end_id: String,
    pub construction: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Circle2DData {
    pub center_id: String,
    pub radius: f64,
    pub construction: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SketchElementType {
    Point(Point2DData),
    Line(Line2DData),
    Circle(Circle2DData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SketchElement {
    pub id: String,
    pub element_type: SketchElementType,
    pub is_fixed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sketch {
    pub id: String,
    pub name: String,
    pub plane: SketchPlane,
    pub elements: HashMap<String, SketchElement>,
    pub constraints: HashMap<String, Constraint>,
    pub is_profiled: bool,
    pub profile_loops: Vec<Vec<String>>, // Profile for extrude/revolve
    pub solver: Option<ConstraintSolver>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SketchPlane {
    XY,
    YZ,
    XZ,
}

impl Sketch {
    pub fn new(name: String, plane: SketchPlane) -> Self {
        Sketch {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            plane,
            elements: HashMap::new(),
            constraints: HashMap::new(),
            is_profiled: false,
            profile_loops: Vec::new(),
            solver: None,
        }
    }

    pub fn add_point(&mut self, x: f64, y: f64, construction: bool) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        self.elements.insert(
            id.clone(),
            SketchElement {
                id: id.clone(),
                element_type: SketchElementType::Point(Point2DData {
                    x,
                    y,
                    construction,
                }),
                is_fixed: false,
            },
        );
        id
    }

    pub fn add_line(&mut self, start_id: String, end_id: String, construction: bool) -> Result<String, String> {
        if !self.elements.contains_key(&start_id) || !self.elements.contains_key(&end_id) {
            return Err("Start or end point not found".to_string());
        }

        let id = uuid::Uuid::new_v4().to_string();
        self.elements.insert(
            id.clone(),
            SketchElement {
                id: id.clone(),
                element_type: SketchElementType::Line(Line2DData {
                    start_id,
                    end_id,
                    construction,
                }),
                is_fixed: false,
            },
        );
        Ok(id)
    }

    pub fn add_circle(&mut self, center_id: String, radius: f64, construction: bool) -> Result<String, String> {
        if !self.elements.contains_key(&center_id) {
            return Err("Center point not found".to_string());
        }

        let id = uuid::Uuid::new_v4().to_string();
        self.elements.insert(
            id.clone(),
            SketchElement {
                id: id.clone(),
                element_type: SketchElementType::Circle(Circle2DData {
                    center_id,
                    radius,
                    construction,
                }),
                is_fixed: false,
            },
        );
        Ok(id)
    }

    pub fn add_constraint(&mut self, constraint: Constraint) -> Result<String, String> {
        // Validate constraint references valid elements
        for entity_id in &constraint.entity_ids {
            if !self.elements.contains_key(entity_id) {
                return Err(format!("Entity {} not found in sketch", entity_id));
            }
        }

        let id = constraint.id.clone();
        self.constraints.insert(id.clone(), constraint);
        Ok(id)
    }

    /// Apply horizontal constraint to a line
    pub fn constrain_horizontal(&mut self, line_id: &str) -> Result<String, String> {
        if !self.elements.contains_key(line_id) {
            return Err("Line not found".to_string());
        }

        let constraint = Constraint {
            id: uuid::Uuid::new_v4().to_string(),
            constraint_type: ConstraintType::Horizontal,
            entity_ids: vec![line_id.to_string()],
            value: None,
            is_driving: true,
        };

        let id = constraint.id.clone();
        self.constraints.insert(id.clone(), constraint);
        Ok(id)
    }

    /// Apply vertical constraint to a line
    pub fn constrain_vertical(&mut self, line_id: &str) -> Result<String, String> {
        if !self.elements.contains_key(line_id) {
            return Err("Line not found".to_string());
        }

        let constraint = Constraint {
            id: uuid::Uuid::new_v4().to_string(),
            constraint_type: ConstraintType::Vertical,
            entity_ids: vec![line_id.to_string()],
            value: None,
            is_driving: true,
        };

        let id = constraint.id.clone();
        self.constraints.insert(id.clone(), constraint);
        Ok(id)
    }

    /// Apply distance constraint between two points
    pub fn constrain_distance(&mut self, point1_id: &str, point2_id: &str, distance: f64) -> Result<String, String> {
        if !self.elements.contains_key(point1_id) || !self.elements.contains_key(point2_id) {
            return Err("One or both points not found".to_string());
        }

        let constraint = Constraint {
            id: uuid::Uuid::new_v4().to_string(),
            constraint_type: ConstraintType::Distance,
            entity_ids: vec![point1_id.to_string(), point2_id.to_string()],
            value: Some(distance),
            is_driving: true,
        };

        let id = constraint.id.clone();
        self.constraints.insert(id.clone(), constraint);
        Ok(id)
    }

    /// Apply radius constraint to a circle
    pub fn constrain_radius(&mut self, circle_id: &str, radius: f64) -> Result<String, String> {
        if !self.elements.contains_key(circle_id) {
            return Err("Circle not found".to_string());
        }

        let constraint = Constraint {
            id: uuid::Uuid::new_v4().to_string(),
            constraint_type: ConstraintType::Radius,
            entity_ids: vec![circle_id.to_string()],
            value: Some(radius),
            is_driving: true,
        };

        let id = constraint.id.clone();
        self.constraints.insert(id.clone(), constraint);
        Ok(id)
    }

    /// Apply coincident constraint (points/elements at same location)
    pub fn constrain_coincident(&mut self, entity1_id: &str, entity2_id: &str) -> Result<String, String> {
        if !self.elements.contains_key(entity1_id) || !self.elements.contains_key(entity2_id) {
            return Err("One or both entities not found".to_string());
        }

        let constraint = Constraint {
            id: uuid::Uuid::new_v4().to_string(),
            constraint_type: ConstraintType::Coincident,
            entity_ids: vec![entity1_id.to_string(), entity2_id.to_string()],
            value: None,
            is_driving: true,
        };

        let id = constraint.id.clone();
        self.constraints.insert(id.clone(), constraint);
        Ok(id)
    }

    /// Solve all constraints
    pub fn solve_constraints(&mut self) -> Result<(), String> {
        let mut solver = ConstraintSolver::new();

        // Add all elements to solver
        for (id, element) in &self.elements {
            match &element.element_type {
                SketchElementType::Point(p) => {
                    solver.add_entity(id.clone(), SketchEntity::Point(Point2D::new(p.x, p.y)));
                }
                SketchElementType::Line(l) => {
                    // Get start and end points
                    if let (
                        Some(SketchElement {
                            element_type: SketchElementType::Point(start),
                            ..
                        }),
                        Some(SketchElement {
                            element_type: SketchElementType::Point(end),
                            ..
                        }),
                    ) = (self.elements.get(&l.start_id), self.elements.get(&l.end_id))
                    {
                        solver.add_entity(
                            id.clone(),
                            SketchEntity::Line(Line2D {
                                start: Point2D::new(start.x, start.y),
                                end: Point2D::new(end.x, end.y),
                            }),
                        );
                    }
                }
                SketchElementType::Circle(c) => {
                    if let Some(SketchElement {
                        element_type: SketchElementType::Point(center),
                        ..
                    }) = self.elements.get(&c.center_id)
                    {
                        solver.add_entity(
                            id.clone(),
                            SketchEntity::Circle(Circle2D {
                                center: Point2D::new(center.x, center.y),
                                radius: c.radius,
                            }),
                        );
                    }
                }
            }
        }

        // Add all constraints to solver
        for constraint in self.constraints.values() {
            solver.add_constraint(constraint.clone())?;
        }

        // Solve
        solver.solve().map_err(|e| format!("{:?}", e))?;

        self.solver = Some(solver);
        Ok(())
    }

    /// Check constraint status
    pub fn check_constraint_status(&self) -> String {
        if let Some(solver) = &self.solver {
            let status = solver.check_constraint_count();
            format!("{:?}", status)
        } else {
            "No solver initialized".to_string()
        }
    }

    /// Get all driving constraints
    pub fn get_driving_constraints(&self) -> Vec<&Constraint> {
        self.constraints.values().filter(|c| c.is_driving).collect()
    }

    /// Get all reference constraints
    pub fn get_reference_constraints(&self) -> Vec<&Constraint> {
        self.constraints.values().filter(|c| !c.is_driving).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sketch_creation() {
        let sketch = Sketch::new("Rectangle".to_string(), SketchPlane::XY);
        assert_eq!(sketch.name, "Rectangle");
        assert!(sketch.elements.is_empty());
    }

    #[test]
    fn test_add_point() {
        let mut sketch = Sketch::new("Test".to_string(), SketchPlane::XY);
        let p1 = sketch.add_point(0.0, 0.0, false);
        let p2 = sketch.add_point(10.0, 10.0, false);
        assert_eq!(sketch.elements.len(), 2);
    }

    #[test]
    fn test_add_line() {
        let mut sketch = Sketch::new("Test".to_string(), SketchPlane::XY);
        let p1 = sketch.add_point(0.0, 0.0, false);
        let p2 = sketch.add_point(10.0, 0.0, false);
        assert!(sketch.add_line(p1, p2, false).is_ok());
    }

    #[test]
    fn test_add_circle() {
        let mut sketch = Sketch::new("Test".to_string(), SketchPlane::XY);
        let center = sketch.add_point(5.0, 5.0, false);
        assert!(sketch.add_circle(center, 2.5, false).is_ok());
    }

    #[test]
    fn test_constrain_horizontal() {
        let mut sketch = Sketch::new("Test".to_string(), SketchPlane::XY);
        let p1 = sketch.add_point(0.0, 0.0, false);
        let p2 = sketch.add_point(10.0, 0.0, false);
        let line = sketch.add_line(p1, p2, false).unwrap();
        assert!(sketch.constrain_horizontal(&line).is_ok());
    }

    #[test]
    fn test_constrain_distance() {
        let mut sketch = Sketch::new("Test".to_string(), SketchPlane::XY);
        let p1 = sketch.add_point(0.0, 0.0, false);
        let p2 = sketch.add_point(5.0, 0.0, false);
        assert!(sketch.constrain_distance(&p1, &p2, 5.0).is_ok());
    }
}
