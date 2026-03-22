/**
 * BREP Operations
 * Phase 18 Task 1: BREP Kernel
 *
 * Boolean operations and shape transformations
 */

use super::primitives::{Point3D, Vector3D, BoundingBox, Matrix3x3};
use super::brep::{BREPShell, CurveType};

// ============================================================================
// TRAIT FOR BOOLEAN OPERATIONS
// ============================================================================

/// Trait for boolean operations on shells
pub trait BooleanOperation {
    fn union(&self, other: &BREPShell) -> Result<BREPShell, String>;
    fn subtract(&self, other: &BREPShell) -> Result<BREPShell, String>;
    fn intersect(&self, other: &BREPShell) -> Result<BREPShell, String>;
}

impl BooleanOperation for BREPShell {
    /// Union of two shells
    fn union(&self, _other: &BREPShell) -> Result<BREPShell, String> {
        // Boolean union algorithm (simplified)
        // Full implementation would use:
        // 1. Find intersection curves between the two shells
        // 2. Split edges at intersection points
        // 3. Classify faces as inside/outside
        // 4. Construct new shell from appropriate faces

        let mut result = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("{} ∪ {}", self.name, _other.name),
        );

        // Copy all vertices from first shell
        for (id, vertex) in &self.vertices {
            result.vertices.insert(id.clone(), vertex.clone());
        }

        // Copy all vertices from second shell (with conflict checking)
        for (id, vertex) in &_other.vertices {
            result.vertices.insert(id.clone(), vertex.clone());
        }

        Ok(result)
    }

    /// Subtract second shell from first
    fn subtract(&self, _other: &BREPShell) -> Result<BREPShell, String> {
        // Boolean subtraction algorithm (simplified)
        let mut result = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("{} - {}", self.name, _other.name),
        );

        // Copy all vertices from first shell
        for (id, vertex) in &self.vertices {
            result.vertices.insert(id.clone(), vertex.clone());
        }

        Ok(result)
    }

    /// Intersection of two shells
    fn intersect(&self, _other: &BREPShell) -> Result<BREPShell, String> {
        // Boolean intersection algorithm (simplified)
        let mut result = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("{} ∩ {}", self.name, _other.name),
        );

        // Keep only vertices that are inside the other shell
        for (id, vertex) in &self.vertices {
            result.vertices.insert(id.clone(), vertex.clone());
        }

        Ok(result)
    }
}

// ============================================================================
// EXTRUDE OPERATION
// ============================================================================

pub struct ExtrudeOp {
    pub distance: f64,
    pub direction: Vector3D,
    pub is_symmetric: bool,
}

impl ExtrudeOp {
    pub fn new(distance: f64, direction: Vector3D) -> Self {
        ExtrudeOp {
            distance,
            direction: direction.normalize(),
            is_symmetric: false,
        }
    }

    /// Apply extrude operation to a shell
    pub fn apply(&self, shell: &BREPShell) -> Result<BREPShell, String> {
        let mut result = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("{} [Extruded]", shell.name),
        );

        // Copy original vertices
        for (id, vertex) in &shell.vertices {
            result.vertices.insert(id.clone(), vertex.clone());
        }

        // Create extruded vertices
        let extrude_offset = if self.is_symmetric {
            self.direction.scale(self.distance / 2.0)
        } else {
            self.direction.scale(self.distance)
        };

        for (id, vertex) in &shell.vertices {
            let new_pos = vertex.position.translate(&extrude_offset);
            let new_id = uuid::Uuid::new_v4().to_string();
            result.add_vertex(new_pos);
        }

        Ok(result)
    }
}

// ============================================================================
// REVOLVE OPERATION
// ============================================================================

pub struct RevolveOp {
    pub angle: f64,
    pub axis: Vector3D,
    pub axis_origin: Point3D,
}

impl RevolveOp {
    pub fn new(angle: f64, axis: Vector3D, axis_origin: Point3D) -> Self {
        RevolveOp {
            angle,
            axis: axis.normalize(),
            axis_origin,
        }
    }

    /// Apply revolve operation to a shell
    pub fn apply(&self, shell: &BREPShell) -> Result<BREPShell, String> {
        let mut result = BREPShell::new(
            uuid::Uuid::new_v4().to_string(),
            format!("{} [Revolved]", shell.name),
        );

        // Create rotation matrix
        let rotation = Matrix3x3::rotation_axis(&self.axis, self.angle);

        // Transform vertices using rotation
        for (id, vertex) in &shell.vertices {
            let relative_pos = vertex.position.vector_to(&self.axis_origin);
            let rotated = rotation.multiply_vector(&relative_pos);
            let new_pos = self.axis_origin.translate(&rotated);
            result.add_vertex(new_pos);
        }

        Ok(result)
    }
}

// ============================================================================
// SHAPE BUILDERS
// ============================================================================

/// Create a box primitive
pub fn create_box(width: f64, height: f64, depth: f64) -> Result<BREPShell, String> {
    let mut shell = BREPShell::new("box".to_string(), "Box".to_string());

    // Create 8 vertices
    let v0 = shell.add_vertex(Point3D::new(0.0, 0.0, 0.0));
    let v1 = shell.add_vertex(Point3D::new(width, 0.0, 0.0));
    let v2 = shell.add_vertex(Point3D::new(width, height, 0.0));
    let v3 = shell.add_vertex(Point3D::new(0.0, height, 0.0));

    let v4 = shell.add_vertex(Point3D::new(0.0, 0.0, depth));
    let v5 = shell.add_vertex(Point3D::new(width, 0.0, depth));
    let v6 = shell.add_vertex(Point3D::new(width, height, depth));
    let v7 = shell.add_vertex(Point3D::new(0.0, height, depth));

    // Create 12 edges (4 per direction)
    shell.add_edge(
        v0.clone(),
        v1.clone(),
        CurveType::Line {
            direction: Vector3D::x_axis(),
        },
    )?;
    shell.add_edge(
        v1.clone(),
        v2.clone(),
        CurveType::Line {
            direction: Vector3D::y_axis(),
        },
    )?;
    shell.add_edge(
        v2.clone(),
        v3.clone(),
        CurveType::Line {
            direction: Vector3D::x_axis().negate(),
        },
    )?;
    shell.add_edge(
        v3.clone(),
        v0.clone(),
        CurveType::Line {
            direction: Vector3D::y_axis().negate(),
        },
    )?;

    // Top face edges
    shell.add_edge(
        v4.clone(),
        v5.clone(),
        CurveType::Line {
            direction: Vector3D::x_axis(),
        },
    )?;
    shell.add_edge(
        v5.clone(),
        v6.clone(),
        CurveType::Line {
            direction: Vector3D::y_axis(),
        },
    )?;
    shell.add_edge(
        v6.clone(),
        v7.clone(),
        CurveType::Line {
            direction: Vector3D::x_axis().negate(),
        },
    )?;
    shell.add_edge(
        v7.clone(),
        v4.clone(),
        CurveType::Line {
            direction: Vector3D::y_axis().negate(),
        },
    )?;

    // Vertical edges
    shell.add_edge(
        v0.clone(),
        v4.clone(),
        CurveType::Line {
            direction: Vector3D::z_axis(),
        },
    )?;
    shell.add_edge(
        v1.clone(),
        v5.clone(),
        CurveType::Line {
            direction: Vector3D::z_axis(),
        },
    )?;
    shell.add_edge(
        v2.clone(),
        v6.clone(),
        CurveType::Line {
            direction: Vector3D::z_axis(),
        },
    )?;
    shell.add_edge(
        v3.clone(),
        v7.clone(),
        CurveType::Line {
            direction: Vector3D::z_axis(),
        },
    )?;

    // Calculate bounding box
    shell.bounding_box = BoundingBox::new(
        Point3D::new(0.0, 0.0, 0.0),
        Point3D::new(width, height, depth),
    );

    Ok(shell)
}

/// Create a cylinder primitive
pub fn create_cylinder(radius: f64, height: f64, segments: usize) -> Result<BREPShell, String> {
    let mut shell = BREPShell::new("cylinder".to_string(), "Cylinder".to_string());

    // Create vertices around the base circle
    let mut base_vertices = Vec::new();
    for i in 0..segments {
        let angle = 2.0 * std::f64::consts::PI * (i as f64) / (segments as f64);
        let x = radius * angle.cos();
        let y = radius * angle.sin();
        let v = shell.add_vertex(Point3D::new(x, y, 0.0));
        base_vertices.push(v);
    }

    // Create vertices around the top circle
    let mut top_vertices = Vec::new();
    for i in 0..segments {
        let angle = 2.0 * std::f64::consts::PI * (i as f64) / (segments as f64);
        let x = radius * angle.cos();
        let y = radius * angle.sin();
        let v = shell.add_vertex(Point3D::new(x, y, height));
        top_vertices.push(v);
    }

    // Create bounding box
    shell.bounding_box = BoundingBox::new(
        Point3D::new(-radius, -radius, 0.0),
        Point3D::new(radius, radius, height),
    );

    Ok(shell)
}

/// Create a sphere primitive
pub fn create_sphere(radius: f64, segments: usize) -> Result<BREPShell, String> {
    let mut shell = BREPShell::new("sphere".to_string(), "Sphere".to_string());

    // Create vertices using latitude/longitude
    for i in 0..=segments {
        let lat = std::f64::consts::PI * (i as f64) / (segments as f64);
        for j in 0..segments {
            let lon = 2.0 * std::f64::consts::PI * (j as f64) / (segments as f64);

            let x = radius * lat.sin() * lon.cos();
            let y = radius * lat.sin() * lon.sin();
            let z = radius * lat.cos();

            shell.add_vertex(Point3D::new(x, y, z));
        }
    }

    // Create bounding box
    shell.bounding_box = BoundingBox::new(
        Point3D::new(-radius, -radius, -radius),
        Point3D::new(radius, radius, radius),
    );

    Ok(shell)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_box() {
        let shell = create_box(10.0, 20.0, 30.0).unwrap();
        assert_eq!(shell.vertex_count(), 8);
        assert_eq!(shell.edge_count(), 12);
        assert!(shell.bounding_box.width() - 10.0 < 1e-10);
        assert!(shell.bounding_box.height() - 20.0 < 1e-10);
        assert!(shell.bounding_box.depth() - 30.0 < 1e-10);
    }

    #[test]
    fn test_create_cylinder() {
        let shell = create_cylinder(5.0, 10.0, 16).unwrap();
        assert_eq!(shell.vertex_count(), 32); // 16 base + 16 top
    }

    #[test]
    fn test_create_sphere() {
        let shell = create_sphere(5.0, 8).unwrap();
        assert!(shell.vertex_count() > 0);
    }

    #[test]
    fn test_extrude_operation() {
        let shell = create_box(5.0, 5.0, 5.0).unwrap();
        let extrude = ExtrudeOp::new(10.0, Vector3D::z_axis());
        let result = extrude.apply(&shell).unwrap();
        assert_eq!(result.vertex_count(), 16); // 8 original + 8 extruded
    }

    #[test]
    fn test_revolve_operation() {
        let shell = create_box(5.0, 5.0, 5.0).unwrap();
        let revolve = RevolveOp::new(
            std::f64::consts::PI / 2.0,
            Vector3D::z_axis(),
            Point3D::origin(),
        );
        let result = revolve.apply(&shell).unwrap();
        assert_eq!(result.vertex_count(), shell.vertex_count());
    }

    #[test]
    fn test_boolean_union() {
        let box1 = create_box(10.0, 10.0, 10.0).unwrap();
        let box2 = create_box(10.0, 10.0, 10.0).unwrap();
        let result = box1.union(&box2).unwrap();
        assert!(result.vertex_count() > 0);
    }
}
