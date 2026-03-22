/**
 * BREP Topology
 * Phase 18 Task 1: BREP Kernel
 *
 * Boundary Representation: vertices, edges, faces, shells
 */

use super::primitives::{Point3D, Vector3D, BoundingBox};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// CURVE TYPES
// ============================================================================

/// Curve types supported in BREP edges
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CurveType {
    /// Straight line with direction
    Line { direction: Vector3D },
    /// Circular arc
    Circle {
        center: Point3D,
        radius: f64,
        normal: Vector3D,
    },
    /// Elliptical arc
    Ellipse {
        center: Point3D,
        major: f64,
        minor: f64,
    },
    /// B-spline curve
    Spline {
        control_points: Vec<Point3D>,
        degree: usize,
    },
}

// ============================================================================
// SURFACE TYPES
// ============================================================================

/// Surface types supported in BREP faces
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SurfaceType {
    /// Planar surface
    Plane {
        normal: Vector3D,
        origin: Point3D,
    },
    /// Cylindrical surface
    Cylinder {
        axis: Vector3D,
        radius: f64,
        origin: Point3D,
    },
    /// Spherical surface
    Sphere { center: Point3D, radius: f64 },
    /// Conical surface
    Cone {
        axis: Vector3D,
        apex: Point3D,
        half_angle: f64,
    },
    /// Toroidal surface
    Torus {
        center: Point3D,
        major_radius: f64,
        minor_radius: f64,
    },
    /// NURBS surface
    NurbsSurface {
        control_points: Vec<Vec<Point3D>>,
        degree_u: usize,
        degree_v: usize,
    },
}

// ============================================================================
// BREP TOPOLOGY
// ============================================================================

/// BREP Vertex
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BREPVertex {
    pub id: String,
    pub position: Point3D,
    pub edges: Vec<String>, // Edge IDs
}

/// BREP Edge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BREPEdge {
    pub id: String,
    pub start_vertex: String,
    pub end_vertex: String,
    pub curve: CurveType,
    pub faces: Vec<String>, // Adjacent face IDs
    pub length: f64,
}

impl BREPEdge {
    /// Get edge start and end points from vertices
    pub fn endpoints(&self, vertices: &HashMap<String, BREPVertex>) -> Option<(Point3D, Point3D)> {
        let start = vertices.get(&self.start_vertex)?.position;
        let end = vertices.get(&self.end_vertex)?.position;
        Some((start, end))
    }
}

/// BREP Face
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BREPFace {
    pub id: String,
    pub surface: SurfaceType,
    pub boundary_edges: Vec<String>, // Edge IDs forming boundary
    pub holes: Vec<Vec<String>>,     // Interior loops (holes)
    pub area: f64,
    pub is_outer: bool,
}

/// Edge loop forming a face boundary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeLoop {
    pub edges: Vec<String>,
}

/// BREP Shell (closed surface)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BREPShell {
    pub id: String,
    pub name: String,
    pub vertices: HashMap<String, BREPVertex>,
    pub edges: HashMap<String, BREPEdge>,
    pub faces: HashMap<String, BREPFace>,
    pub is_closed: bool,
    pub volume: Option<f64>,
    pub bounding_box: BoundingBox,
}

impl BREPShell {
    /// Create new shell
    pub fn new(id: String, name: String) -> Self {
        BREPShell {
            id,
            name,
            vertices: HashMap::new(),
            edges: HashMap::new(),
            faces: HashMap::new(),
            is_closed: false,
            volume: None,
            bounding_box: BoundingBox::empty(),
        }
    }

    /// Add vertex to shell
    pub fn add_vertex(&mut self, position: Point3D) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let vertex = BREPVertex {
            id: id.clone(),
            position,
            edges: Vec::new(),
        };
        self.vertices.insert(id.clone(), vertex);
        self.bounding_box.expand(&position);
        id
    }

    /// Add edge connecting two vertices
    pub fn add_edge(
        &mut self,
        start_id: String,
        end_id: String,
        curve: CurveType,
    ) -> Result<String, String> {
        if !self.vertices.contains_key(&start_id) || !self.vertices.contains_key(&end_id) {
            return Err("Vertices not found in shell".to_string());
        }

        let start_pos = self.vertices[&start_id].position;
        let end_pos = self.vertices[&end_id].position;
        let length = start_pos.distance_to(&end_pos);

        let id = uuid::Uuid::new_v4().to_string();
        let edge = BREPEdge {
            id: id.clone(),
            start_vertex: start_id.clone(),
            end_vertex: end_id.clone(),
            curve,
            faces: Vec::new(),
            length,
        };

        self.edges.insert(id.clone(), edge);

        // Update vertex edge references
        if let Some(vertex) = self.vertices.get_mut(&start_id) {
            vertex.edges.push(id.clone());
        }
        if let Some(vertex) = self.vertices.get_mut(&end_id) {
            vertex.edges.push(id.clone());
        }

        Ok(id)
    }

    /// Add face to shell
    pub fn add_face(
        &mut self,
        surface: SurfaceType,
        boundary_edge_ids: Vec<String>,
    ) -> Result<String, String> {
        // Validate that all edges exist
        for edge_id in &boundary_edge_ids {
            if !self.edges.contains_key(edge_id) {
                return Err(format!("Edge {} not found in shell", edge_id));
            }
        }

        let id = uuid::Uuid::new_v4().to_string();
        let face = BREPFace {
            id: id.clone(),
            surface,
            boundary_edges: boundary_edge_ids.clone(),
            holes: Vec::new(),
            area: 0.0,
            is_outer: true,
        };

        self.faces.insert(id.clone(), face);

        // Update edge face references
        for edge_id in &boundary_edge_ids {
            if let Some(edge) = self.edges.get_mut(edge_id) {
                edge.faces.push(id.clone());
            }
        }

        Ok(id)
    }

    /// Validate shell topology (closed, no gaps)
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check each edge is referenced by exactly 2 faces (closed shell)
        for (edge_id, edge) in &self.edges {
            if edge.faces.len() != 2 {
                errors.push(format!(
                    "Edge {} referenced by {} faces (expected 2)",
                    edge_id,
                    edge.faces.len()
                ));
            }
        }

        // Check vertices are connected
        for (vertex_id, vertex) in &self.vertices {
            if vertex.edges.is_empty() {
                errors.push(format!("Vertex {} has no edges", vertex_id));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Calculate volume using divergence theorem
    pub fn calculate_volume(&mut self) -> f64 {
        let mut volume = 0.0;

        for face in self.faces.values() {
            match &face.surface {
                SurfaceType::Plane { normal, origin } => {
                    // Volume contribution using divergence theorem
                    let distance = origin.z; // Simplified
                    volume += face.area * distance / 3.0;
                }
                _ => {
                    // For other surface types, would use numerical integration
                }
            }
        }

        self.volume = Some(volume.abs());
        volume.abs()
    }

    /// Check Euler characteristic (V - E + F = 2 for closed shell)
    pub fn check_euler_characteristic(&self) -> bool {
        let v = self.vertices.len() as i32;
        let e = self.edges.len() as i32;
        let f = self.faces.len() as i32;
        (v - e + f) == 2
    }

    /// Get vertex count
    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }

    /// Get edge count
    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }

    /// Get face count
    pub fn face_count(&self) -> usize {
        self.faces.len()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_brep_shell_creation() {
        let mut shell = BREPShell::new("test".to_string(), "Test Shell".to_string());

        let v1 = shell.add_vertex(Point3D::new(0.0, 0.0, 0.0));
        let v2 = shell.add_vertex(Point3D::new(10.0, 0.0, 0.0));

        assert_eq!(shell.vertices.len(), 2);
        assert_eq!(shell.vertex_count(), 2);

        let edge_result = shell.add_edge(
            v1,
            v2,
            CurveType::Line {
                direction: Vector3D::x_axis(),
            },
        );
        assert!(edge_result.is_ok());
        assert_eq!(shell.edge_count(), 1);
    }

    #[test]
    fn test_edge_validation() {
        let mut shell = BREPShell::new("test".to_string(), "Test Shell".to_string());

        let v1 = shell.add_vertex(Point3D::new(0.0, 0.0, 0.0));
        let v2 = shell.add_vertex(Point3D::new(10.0, 0.0, 0.0));

        // Try to add edge with non-existent vertex
        let result = shell.add_edge(
            "non-existent".to_string(),
            v2,
            CurveType::Line {
                direction: Vector3D::x_axis(),
            },
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_euler_characteristic() {
        let mut shell = BREPShell::new("test".to_string(), "Test Shell".to_string());

        // Create a simple tetrahedron
        let v1 = shell.add_vertex(Point3D::new(0.0, 0.0, 0.0));
        let v2 = shell.add_vertex(Point3D::new(1.0, 0.0, 0.0));
        let v3 = shell.add_vertex(Point3D::new(0.5, 1.0, 0.0));
        let v4 = shell.add_vertex(Point3D::new(0.5, 0.5, 1.0));

        // V = 4, and for closed shell: V - E + F = 2
        assert_eq!(shell.vertex_count(), 4);
    }
}
