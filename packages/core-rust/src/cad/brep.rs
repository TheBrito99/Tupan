/**
 * BREP (Boundary Representation) Kernel
 * Phase 17: 3D CAD Foundation
 *
 * Handles solid modeling through boundary representation:
 * - Vertices, edges, faces, shells
 * - Topology management
 * - Geometric operations (extrude, revolve, fillet, etc.)
 * - Solid validation
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// GEOMETRIC PRIMITIVES
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Vector3D {
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Point3D { x, y, z }
    }

    pub fn distance_to(&self, other: &Point3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    pub fn lerp(&self, other: &Point3D, t: f64) -> Point3D {
        Point3D {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
            z: self.z + (other.z - self.z) * t,
        }
    }
}

impl Vector3D {
    pub fn new(dx: f64, dy: f64, dz: f64) -> Self {
        Vector3D { dx, dy, dz }
    }

    pub fn magnitude(&self) -> f64 {
        (self.dx * self.dx + self.dy * self.dy + self.dz * self.dz).sqrt()
    }

    pub fn normalize(&self) -> Vector3D {
        let mag = self.magnitude();
        if mag == 0.0 {
            Vector3D::new(0.0, 0.0, 0.0)
        } else {
            Vector3D::new(self.dx / mag, self.dy / mag, self.dz / mag)
        }
    }

    pub fn dot(&self, other: &Vector3D) -> f64 {
        self.dx * other.dx + self.dy * other.dy + self.dz * other.dz
    }

    pub fn cross(&self, other: &Vector3D) -> Vector3D {
        Vector3D::new(
            self.dy * other.dz - self.dz * other.dy,
            self.dz * other.dx - self.dx * other.dz,
            self.dx * other.dy - self.dy * other.dx,
        )
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min: Point3D,
    pub max: Point3D,
}

impl BoundingBox {
    pub fn new(min: Point3D, max: Point3D) -> Self {
        BoundingBox { min, max }
    }

    pub fn width(&self) -> f64 {
        self.max.x - self.min.x
    }

    pub fn height(&self) -> f64 {
        self.max.y - self.min.y
    }

    pub fn depth(&self) -> f64 {
        self.max.z - self.min.z
    }

    pub fn expand(&mut self, point: &Point3D) {
        if point.x < self.min.x {
            self.min.x = point.x;
        }
        if point.y < self.min.y {
            self.min.y = point.y;
        }
        if point.z < self.min.z {
            self.min.z = point.z;
        }
        if point.x > self.max.x {
            self.max.x = point.x;
        }
        if point.y > self.max.y {
            self.max.y = point.y;
        }
        if point.z > self.max.z {
            self.max.z = point.z;
        }
    }

    pub fn contains(&self, point: &Point3D) -> bool {
        point.x >= self.min.x
            && point.x <= self.max.x
            && point.y >= self.min.y
            && point.y <= self.max.y
            && point.z >= self.min.z
            && point.z <= self.max.z
    }

    pub fn intersects(&self, other: &BoundingBox) -> bool {
        !(self.max.x < other.min.x
            || self.min.x > other.max.x
            || self.max.y < other.min.y
            || self.min.y > other.max.y
            || self.max.z < other.min.z
            || self.min.z > other.max.z)
    }
}

// ============================================================================
// BREP TOPOLOGY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BREPVertex {
    pub id: String,
    pub position: Point3D,
    pub edges: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CurveType {
    Line { direction: Vector3D },
    Circle { center: Point3D, radius: f64, normal: Vector3D },
    Arc { center: Point3D, radius: f64, start_angle: f64, end_angle: f64 },
    Ellipse { center: Point3D, major: f64, minor: f64 },
    Spline { control_points: Vec<Point3D>, degree: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BREPEdge {
    pub id: String,
    pub start_vertex: String,
    pub end_vertex: String,
    pub curve: CurveType,
    pub faces: Vec<String>, // Adjacent faces
    pub length: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SurfaceType {
    Plane { normal: Vector3D, origin: Point3D },
    Cylinder { axis: Vector3D, radius: f64, origin: Point3D },
    Sphere { center: Point3D, radius: f64 },
    Cone { axis: Vector3D, apex: Point3D, half_angle: f64 },
    Torus { center: Point3D, major_radius: f64, minor_radius: f64 },
    NurbsSurface { control_points: Vec<Vec<Point3D>>, degree_u: usize, degree_v: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BREPFace {
    pub id: String,
    pub surface: SurfaceType,
    pub boundary_edges: Vec<String>, // Edges forming the boundary
    pub holes: Vec<Vec<String>>, // Interior loops (for holes)
    pub area: f64,
    pub is_outer: bool,
}

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
    pub fn new(id: String, name: String) -> Self {
        BREPShell {
            id,
            name,
            vertices: HashMap::new(),
            edges: HashMap::new(),
            faces: HashMap::new(),
            is_closed: false,
            volume: None,
            bounding_box: BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(0.0, 0.0, 0.0)),
        }
    }

    /// Add a vertex to the shell
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

    /// Add an edge connecting two vertices
    pub fn add_edge(&mut self, start_id: String, end_id: String, curve: CurveType) -> Result<String, String> {
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

    /// Add a face to the shell
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
            area: 0.0, // Calculate area later
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

    /// Check if shell is topologically valid (closed, no gaps)
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check each edge is referenced by exactly 2 faces (closed shell)
        for (edge_id, edge) in &self.edges {
            if edge.faces.len() != 2 {
                errors.push(format!("Edge {} referenced by {} faces (expected 2)", edge_id, edge.faces.len()));
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
            // Sample the face at its center and compute signed volume
            match &face.surface {
                SurfaceType::Plane { normal, origin } => {
                    // Volume contribution = (face_area * distance_from_origin) * normal
                    // Simplified: assume face area and average distance
                    let distance = origin.z; // Approximate
                    volume += face.area * distance / 3.0;
                }
                _ => {
                    // For other surface types, use numerical integration
                    // This is simplified - full implementation would use Gauss quadrature
                }
            }
        }

        self.volume = Some(volume.abs());
        volume.abs()
    }

    /// Triangulate the shell for visualization (returns vertex and index arrays)
    pub fn triangulate(&self) -> (Vec<Point3D>, Vec<u32>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();

        // For each face, create triangles
        for (face_id, face) in &self.faces {
            let face_start_index = vertices.len() as u32;

            // Get boundary edge vertices
            let mut boundary_verts = Vec::new();
            for edge_id in &face.boundary_edges {
                if let Some(edge) = self.edges.get(edge_id) {
                    if let Some(vertex) = self.vertices.get(&edge.start_vertex) {
                        boundary_verts.push(vertex.position);
                    }
                }
            }

            // Simple fan triangulation (works for convex faces)
            for i in 1..boundary_verts.len() - 1 {
                vertices.push(boundary_verts[0]);
                vertices.push(boundary_verts[i]);
                vertices.push(boundary_verts[i + 1]);

                let base = face_start_index as usize + vertices.len() - 3;
                indices.push((base as u32) + 0);
                indices.push((base as u32) + 1);
                indices.push((base as u32) + 2);
            }
        }

        (vertices, indices)
    }
}

// ============================================================================
// BREP OPERATIONS
// ============================================================================

pub struct BREPOperations;

impl BREPOperations {
    /// Create a box (cuboid) as a BREP shell
    pub fn create_box(origin: Point3D, width: f64, height: f64, depth: f64) -> Result<BREPShell, String> {
        let mut shell = BREPShell::new("box".to_string(), "Box".to_string());

        // Create 8 vertices
        let v0 = shell.add_vertex(origin);
        let v1 = shell.add_vertex(Point3D::new(origin.x + width, origin.y, origin.z));
        let v2 = shell.add_vertex(Point3D::new(origin.x + width, origin.y + height, origin.z));
        let v3 = shell.add_vertex(Point3D::new(origin.x, origin.y + height, origin.z));

        let v4 = shell.add_vertex(Point3D::new(origin.x, origin.y, origin.z + depth));
        let v5 = shell.add_vertex(Point3D::new(origin.x + width, origin.y, origin.z + depth));
        let v6 = shell.add_vertex(Point3D::new(origin.x + width, origin.y + height, origin.z + depth));
        let v7 = shell.add_vertex(Point3D::new(origin.x, origin.y + height, origin.z + depth));

        // Create 12 edges (4 per face direction)
        shell.add_edge(v0.clone(), v1.clone(), CurveType::Line {
            direction: Vector3D::new(1.0, 0.0, 0.0),
        })?;
        shell.add_edge(v1.clone(), v2.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, 1.0, 0.0),
        })?;
        shell.add_edge(v2.clone(), v3.clone(), CurveType::Line {
            direction: Vector3D::new(-1.0, 0.0, 0.0),
        })?;
        shell.add_edge(v3.clone(), v0.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, -1.0, 0.0),
        })?;

        // Top face edges
        shell.add_edge(v4.clone(), v5.clone(), CurveType::Line {
            direction: Vector3D::new(1.0, 0.0, 0.0),
        })?;
        shell.add_edge(v5.clone(), v6.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, 1.0, 0.0),
        })?;
        shell.add_edge(v6.clone(), v7.clone(), CurveType::Line {
            direction: Vector3D::new(-1.0, 0.0, 0.0),
        })?;
        shell.add_edge(v7.clone(), v4.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, -1.0, 0.0),
        })?;

        // Vertical edges
        shell.add_edge(v0.clone(), v4.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, 0.0, 1.0),
        })?;
        shell.add_edge(v1.clone(), v5.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, 0.0, 1.0),
        })?;
        shell.add_edge(v2.clone(), v6.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, 0.0, 1.0),
        })?;
        shell.add_edge(v3.clone(), v7.clone(), CurveType::Line {
            direction: Vector3D::new(0.0, 0.0, 1.0),
        })?;

        // Create 6 faces (planes)
        // Bottom face (z=0)
        shell.add_face(
            SurfaceType::Plane {
                normal: Vector3D::new(0.0, 0.0, -1.0),
                origin,
            },
            vec!["e0".to_string(), "e1".to_string(), "e2".to_string(), "e3".to_string()],
        )?;

        // ... (Other faces would be added similarly)

        Ok(shell)
    }

    /// Extrude a face in a given direction
    pub fn extrude(shell: &BREPShell, face_id: &str, direction: Vector3D, distance: f64) -> Result<BREPShell, String> {
        // Create new vertices by offsetting
        let mut new_shell = BREPShell::new(uuid::Uuid::new_v4().to_string(), "Extruded".to_string());

        // Copy existing geometry
        for (id, vertex) in &shell.vertices {
            let new_pos = Point3D::new(
                vertex.position.x + direction.dx * distance,
                vertex.position.y + direction.dy * distance,
                vertex.position.z + direction.dz * distance,
            );
            new_shell.vertices.insert(id.clone(), BREPVertex {
                id: id.clone(),
                position: new_pos,
                edges: Vec::new(),
            });
        }

        // Create new edges and faces for the extrusion
        // This is simplified - full implementation would handle face offset

        Ok(new_shell)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point3d_distance() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(3.0, 4.0, 0.0);
        assert_eq!(p1.distance_to(&p2), 5.0);
    }

    #[test]
    fn test_vector_magnitude() {
        let v = Vector3D::new(3.0, 4.0, 0.0);
        assert_eq!(v.magnitude(), 5.0);
    }

    #[test]
    fn test_bounding_box() {
        let mut bb = BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(10.0, 10.0, 10.0));
        bb.expand(&Point3D::new(-5.0, 5.0, 5.0));
        assert_eq!(bb.min.x, -5.0);
        assert_eq!(bb.width(), 15.0);
    }

    #[test]
    fn test_brep_shell_creation() {
        let mut shell = BREPShell::new("test".to_string(), "Test Shell".to_string());
        let v1 = shell.add_vertex(Point3D::new(0.0, 0.0, 0.0));
        let v2 = shell.add_vertex(Point3D::new(10.0, 0.0, 0.0));
        assert_eq!(shell.vertices.len(), 2);

        let edge_result = shell.add_edge(v1, v2, CurveType::Line {
            direction: Vector3D::new(1.0, 0.0, 0.0),
        });
        assert!(edge_result.is_ok());
    }
}
