/**
 * Triangulation Module
 * Phase 18 Task 1: BREP Kernel
 */

use super::brep::BREPShell;
use super::primitives::{Point3D, Vector3D, BoundingBox};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a single triangle in 3D space
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Triangle {
    pub p1: Point3D,
    pub p2: Point3D,
    pub p3: Point3D,
    pub normal: Vector3D,
}

impl Triangle {
    pub fn new(p1: Point3D, p2: Point3D, p3: Point3D) -> Self {
        let v1 = p1.vector_to(&p2);
        let v2 = p1.vector_to(&p3);
        let normal = v1.cross(&v2);
        let normal = if let Some(n) = normal.try_normalize() {
            n
        } else {
            Vector3D::z_axis()
        };
        Triangle { p1, p2, p3, normal }
    }

    pub fn area(&self) -> f64 {
        let v1 = self.p1.vector_to(&self.p2);
        let v2 = self.p1.vector_to(&self.p3);
        let cross = v1.cross(&v2);
        cross.magnitude() / 2.0
    }

    pub fn centroid(&self) -> Point3D {
        Point3D {
            x: (self.p1.x + self.p2.x + self.p3.x) / 3.0,
            y: (self.p1.y + self.p2.y + self.p3.y) / 3.0,
            z: (self.p1.z + self.p2.z + self.p3.z) / 3.0,
        }
    }

    pub fn bounding_box(&self) -> BoundingBox {
        let mut bbox = BoundingBox::from_point(self.p1);
        bbox.expand(&self.p2);
        bbox.expand(&self.p3);
        bbox
    }
}

/// Triangle mesh representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriangleMesh {
    pub triangles: Vec<Triangle>,
    pub vertices: Vec<Point3D>,
    vertex_map: HashMap<String, usize>,
}

impl TriangleMesh {
    pub fn new() -> Self {
        TriangleMesh {
            triangles: Vec::new(),
            vertices: Vec::new(),
            vertex_map: HashMap::new(),
        }
    }

    pub fn add_triangle(&mut self, triangle: Triangle) {
        self.triangles.push(triangle);
    }

    pub fn total_area(&self) -> f64 {
        self.triangles.iter().map(|t| t.area()).sum()
    }

    pub fn bounding_box(&self) -> BoundingBox {
        if self.triangles.is_empty() {
            return BoundingBox::empty();
        }
        let mut bbox = self.triangles[0].bounding_box();
        for triangle in &self.triangles[1..] {
            bbox.expand_box(&triangle.bounding_box());
        }
        bbox
    }

    pub fn triangle_count(&self) -> usize {
        self.triangles.len()
    }

    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }
}

impl Default for TriangleMesh {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of triangulation operation
#[derive(Debug)]
pub struct TriangulationResult {
    pub mesh: TriangleMesh,
    pub triangle_count: usize,
    pub total_area: f64,
}

/// Converts BREP shells to triangle meshes
pub struct Triangulator;

impl Triangulator {
    pub fn triangulate_shell(shell: &BREPShell) -> Result<TriangulationResult, String> {
        let mut mesh = TriangleMesh::new();

        for (face_id, face) in &shell.faces {
            let vertices = Self::extract_face_vertices(shell, face_id)?;
            if vertices.len() < 3 {
                return Err(format!("Face {} has less than 3 vertices", face_id));
            }

            let first_vertex = vertices[0];
            for i in 1..vertices.len() - 1 {
                let second_vertex = vertices[i];
                let third_vertex = vertices[i + 1];
                let triangle = Triangle::new(first_vertex, second_vertex, third_vertex);
                mesh.add_triangle(triangle);
            }
        }

        if mesh.triangles.is_empty() {
            return Err("No triangles generated from shell".to_string());
        }

        let triangle_count = mesh.triangles.len();
        let total_area = mesh.total_area();

        Ok(TriangulationResult {
            mesh,
            triangle_count,
            total_area,
        })
    }

    fn extract_face_vertices(shell: &BREPShell, face_id: &str) -> Result<Vec<Point3D>, String> {
        let face = shell.faces.get(face_id)
            .ok_or_else(|| format!("Face not found: {}", face_id))?;

        let mut vertices = Vec::new();
        let mut visited_edges = std::collections::HashSet::new();

        if face.boundary_edges.is_empty() {
            return Err(format!("Face {} has no boundary edges", face_id));
        }

        let mut current_edge_id = face.boundary_edges[0].clone();
        let mut current_vertex_id = {
            let edge = shell.edges.get(&current_edge_id)
                .ok_or_else(|| format!("Edge not found: {}", current_edge_id))?;
            edge.start_vertex.clone()
        };

        loop {
            visited_edges.insert(current_edge_id.clone());

            let vertex = shell.vertices.get(&current_vertex_id)
                .ok_or_else(|| format!("Vertex not found: {}", current_vertex_id))?;
            vertices.push(vertex.position);

            let edge = shell.edges.get(&current_edge_id)
                .ok_or_else(|| format!("Edge not found: {}", current_edge_id))?;

            let next_vertex_id = edge.end_vertex.clone();

            let mut found_next = false;
            for edge_id in &face.boundary_edges {
                if visited_edges.contains(edge_id) {
                    continue;
                }
                let next_edge = shell.edges.get(edge_id)
                    .ok_or_else(|| format!("Edge not found: {}", edge_id))?;
                if next_edge.start_vertex == next_vertex_id {
                    current_edge_id = edge_id.clone();
                    current_vertex_id = next_vertex_id;
                    found_next = true;
                    break;
                }
            }

            if !found_next {
                break;
            }

            if visited_edges.len() == face.boundary_edges.len() {
                break;
            }
        }

        Ok(vertices)
    }

    pub fn create_test_mesh() -> TriangleMesh {
        let mut mesh = TriangleMesh::new();

        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(1.0, 0.0, 0.0);
        let p3 = Point3D::new(0.5, 1.0, 0.0);
        let p4 = Point3D::new(0.5, 0.5, 1.0);

        mesh.add_triangle(Triangle::new(p1, p2, p3));
        mesh.add_triangle(Triangle::new(p1, p2, p4));
        mesh.add_triangle(Triangle::new(p2, p3, p4));
        mesh.add_triangle(Triangle::new(p1, p3, p4));

        mesh
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_triangle_creation() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(1.0, 0.0, 0.0);
        let p3 = Point3D::new(0.0, 1.0, 0.0);
        let t = Triangle::new(p1, p2, p3);
        assert_eq!(t.p1, p1);
    }

    #[test]
    fn test_triangle_area() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(1.0, 0.0, 0.0);
        let p3 = Point3D::new(0.0, 1.0, 0.0);
        let t = Triangle::new(p1, p2, p3);
        assert!((t.area() - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_triangle_mesh_creation() {
        let mut mesh = TriangleMesh::new();
        assert_eq!(mesh.triangle_count(), 0);
    }

    #[test]
    fn test_test_mesh_creation() {
        let mesh = Triangulator::create_test_mesh();
        assert_eq!(mesh.triangle_count(), 4);
    }
}
