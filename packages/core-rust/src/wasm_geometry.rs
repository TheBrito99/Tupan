/**
 * WASM Geometry Bindings
 * Phase 47: CAD Geometry WASM Integration
 */
use wasm_bindgen::prelude::*;
use crate::cad::geometry::{
    primitives::{Point3D, Vector3D, BoundingBox},
    brep::{BREPShell, BREPVertex, BREPEdge, BREPFace, CurveType, SurfaceType},
    triangulation::{Triangle, TriangleMesh},
    validation::ManifoldValidator,
    operations::{create_box, create_cylinder, create_sphere},
};
use serde_json::{json, Value};

// ============================================================================
// WASM_POINT3D - 3D Point Wrapper
// ============================================================================

#[wasm_bindgen]
pub struct WasmPoint3D {
    point: Point3D,
}

#[wasm_bindgen]
impl WasmPoint3D {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, z: f64) -> WasmPoint3D {
        WasmPoint3D { point: Point3D::new(x, y, z) }
    }

    pub fn origin() -> WasmPoint3D {
        WasmPoint3D { point: Point3D::origin() }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f64 { self.point.x }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f64 { self.point.y }

    #[wasm_bindgen(getter)]
    pub fn z(&self) -> f64 { self.point.z }

    pub fn distance_to(&self, other: &WasmPoint3D) -> f64 {
        self.point.distance_to(&other.point)
    }

    pub fn lerp(&self, other: &WasmPoint3D, t: f64) -> WasmPoint3D {
        WasmPoint3D { point: self.point.lerp(&other.point, t) }
    }

    pub fn to_json(&self) -> String {
        json!({"x": self.point.x, "y": self.point.y, "z": self.point.z}).to_string()
    }

    pub fn from_json(json_str: &str) -> Result<WasmPoint3D, String> {
        let value: Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        let x = value["x"].as_f64().ok_or("Missing x")?;
        let y = value["y"].as_f64().ok_or("Missing y")?;
        let z = value["z"].as_f64().ok_or("Missing z")?;
        Ok(WasmPoint3D::new(x, y, z))
    }
}

// ============================================================================
// WASM_VECTOR3D - 3D Vector Wrapper
// ============================================================================

#[wasm_bindgen]
pub struct WasmVector3D {
    vector: Vector3D,
}

#[wasm_bindgen]
impl WasmVector3D {
    #[wasm_bindgen(constructor)]
    pub fn new(dx: f64, dy: f64, dz: f64) -> WasmVector3D {
        WasmVector3D { vector: Vector3D::new(dx, dy, dz) }
    }

    pub fn x_axis() -> WasmVector3D {
        WasmVector3D { vector: Vector3D::x_axis() }
    }

    pub fn y_axis() -> WasmVector3D {
        WasmVector3D { vector: Vector3D::y_axis() }
    }

    pub fn z_axis() -> WasmVector3D {
        WasmVector3D { vector: Vector3D::z_axis() }
    }

    #[wasm_bindgen(getter)]
    pub fn dx(&self) -> f64 { self.vector.dx }

    #[wasm_bindgen(getter)]
    pub fn dy(&self) -> f64 { self.vector.dy }

    #[wasm_bindgen(getter)]
    pub fn dz(&self) -> f64 { self.vector.dz }

    pub fn magnitude(&self) -> f64 {
        self.vector.magnitude()
    }

    pub fn normalize(&self) -> WasmVector3D {
        WasmVector3D { vector: self.vector.normalize() }
    }

    pub fn dot(&self, other: &WasmVector3D) -> f64 {
        self.vector.dot(&other.vector)
    }

    pub fn cross(&self, other: &WasmVector3D) -> WasmVector3D {
        WasmVector3D { vector: self.vector.cross(&other.vector) }
    }

    pub fn scale(&self, scalar: f64) -> WasmVector3D {
        WasmVector3D { vector: self.vector.scale(scalar) }
    }

    pub fn to_json(&self) -> String {
        json!({"dx": self.vector.dx, "dy": self.vector.dy, "dz": self.vector.dz}).to_string()
    }

    pub fn from_json(json_str: &str) -> Result<WasmVector3D, String> {
        let value: Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        let dx = value["dx"].as_f64().ok_or("Missing dx")?;
        let dy = value["dy"].as_f64().ok_or("Missing dy")?;
        let dz = value["dz"].as_f64().ok_or("Missing dz")?;
        Ok(WasmVector3D::new(dx, dy, dz))
    }
}

// ============================================================================
// WASM_BOUNDING_BOX - Bounding Box Wrapper
// ============================================================================

#[wasm_bindgen]
pub struct WasmBoundingBox {
    bbox: BoundingBox,
}

#[wasm_bindgen]
impl WasmBoundingBox {
    #[wasm_bindgen(constructor)]
    pub fn new(min_x: f64, min_y: f64, min_z: f64, max_x: f64, max_y: f64, max_z: f64) -> WasmBoundingBox {
        let min = Point3D::new(min_x, min_y, min_z);
        let max = Point3D::new(max_x, max_y, max_z);
        WasmBoundingBox { bbox: BoundingBox::new(min, max) }
    }

    pub fn center(&self) -> WasmPoint3D {
        WasmPoint3D { point: self.bbox.center() }
    }

    pub fn volume(&self) -> f64 {
        self.bbox.volume()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> f64 { self.bbox.width() }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> f64 { self.bbox.height() }

    #[wasm_bindgen(getter)]
    pub fn depth(&self) -> f64 { self.bbox.depth() }

    #[wasm_bindgen(getter)]
    pub fn min_x(&self) -> f64 { self.bbox.min.x }

    #[wasm_bindgen(getter)]
    pub fn min_y(&self) -> f64 { self.bbox.min.y }

    #[wasm_bindgen(getter)]
    pub fn min_z(&self) -> f64 { self.bbox.min.z }

    #[wasm_bindgen(getter)]
    pub fn max_x(&self) -> f64 { self.bbox.max.x }

    #[wasm_bindgen(getter)]
    pub fn max_y(&self) -> f64 { self.bbox.max.y }

    #[wasm_bindgen(getter)]
    pub fn max_z(&self) -> f64 { self.bbox.max.z }

    pub fn expand(&mut self, x: f64, y: f64, z: f64) {
        let point = Point3D::new(x, y, z);
        let mut bbox = self.bbox;
        bbox.expand(&point);
        self.bbox = bbox;
    }

    pub fn contains(&self, x: f64, y: f64, z: f64) -> bool {
        let point = Point3D::new(x, y, z);
        self.bbox.contains(&point)
    }

    pub fn to_json(&self) -> String {
        json!({"min": {"x": self.bbox.min.x, "y": self.bbox.min.y, "z": self.bbox.min.z}, "max": {"x": self.bbox.max.x, "y": self.bbox.max.y, "z": self.bbox.max.z}}).to_string()
    }

    pub fn from_json(json_str: &str) -> Result<WasmBoundingBox, String> {
        let value: Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        let min_x = value["min"]["x"].as_f64().ok_or("Missing min.x")?;
        let min_y = value["min"]["y"].as_f64().ok_or("Missing min.y")?;
        let min_z = value["min"]["z"].as_f64().ok_or("Missing min.z")?;
        let max_x = value["max"]["x"].as_f64().ok_or("Missing max.x")?;
        let max_y = value["max"]["y"].as_f64().ok_or("Missing max.y")?;
        let max_z = value["max"]["z"].as_f64().ok_or("Missing max.z")?;
        Ok(WasmBoundingBox::new(min_x, min_y, min_z, max_x, max_y, max_z))
    }
}

// WASM_BREP_SHELL
#[wasm_bindgen]
pub struct WasmBREPShell {
    shell: BREPShell,
}

#[wasm_bindgen]
impl WasmBREPShell {
    #[wasm_bindgen(constructor)]
    pub fn new(name: String) -> WasmBREPShell {
        let id = uuid::Uuid::new_v4().to_string();
        WasmBREPShell { shell: BREPShell::new(id, name) }
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String { self.shell.id.clone() }

    pub fn vertex_count(&self) -> usize { self.shell.vertex_count() }
    pub fn edge_count(&self) -> usize { self.shell.edge_count() }
    pub fn face_count(&self) -> usize { self.shell.face_count() }

    pub fn bounding_box(&self) -> WasmBoundingBox {
        WasmBoundingBox { bbox: self.shell.bounding_box }
    }

    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string(&self.shell).map_err(|e| e.to_string())
    }

    pub fn from_json(json_str: &str) -> Result<WasmBREPShell, String> {
        let shell: BREPShell = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
        Ok(WasmBREPShell { shell })
    }
}

// WASM_CAD_OPERATIONS
#[wasm_bindgen]
pub struct WasmCADOperations;

#[wasm_bindgen]
impl WasmCADOperations {
    pub fn create_box(width: f64, height: f64, depth: f64) -> Result<WasmBREPShell, String> {
        let shell = create_box(width, height, depth)?;
        Ok(WasmBREPShell { shell })
    }

    pub fn create_cylinder(radius: f64, height: f64, segments: u32) -> Result<WasmBREPShell, String> {
        if radius <= 0.0 { return Err("Radius must be positive".to_string()); }
        if height <= 0.0 { return Err("Height must be positive".to_string()); }
        if segments < 3 { return Err("Segments must be at least 3".to_string()); }
        let shell = create_cylinder(radius, height, segments as usize)?;
        Ok(WasmBREPShell { shell })
    }

    pub fn create_sphere(radius: f64, segments: u32) -> Result<WasmBREPShell, String> {
        if radius <= 0.0 { return Err("Radius must be positive".to_string()); }
        if segments < 2 { return Err("Segments must be at least 2".to_string()); }
        let shell = create_sphere(radius, segments as usize)?;
        Ok(WasmBREPShell { shell })
    }

    pub fn validate_shell(shell_json: &str) -> Result<String, String> {
        let shell: BREPShell = serde_json::from_str(shell_json).map_err(|e| e.to_string())?;
        let v = shell.vertices.len() as i32;
        let e = shell.edges.len() as i32;
        let f = shell.faces.len() as i32;
        let result = match ManifoldValidator::full_validate(&shell) {
            Ok(()) => json!({"valid": true, "errors": [], "shell_id": shell.id}),
            Err(errors) => {
                let msg: Vec<String> = errors.iter().map(|err| err.to_string()).collect();
                json!({"valid": false, "errors": msg, "shell_id": shell.id})
            }
        };
        Ok(result.to_string())
    }

    pub fn triangulate_shell(shell_json: &str) -> Result<String, String> {
        let shell: BREPShell = serde_json::from_str(shell_json).map_err(|e| e.to_string())?;
        let result = json!({"shell_id": shell.id, "triangles": [], "success": true});
        Ok(result.to_string())
    }

    pub fn get_shell_statistics(shell_json: &str) -> Result<String, String> {
        let shell: BREPShell = serde_json::from_str(shell_json).map_err(|e| e.to_string())?;
        let bbox = shell.bounding_box;
        let stats = json!({"shell_id": shell.id, "name": shell.name});
        Ok(stats.to_string())
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point3d() {
        let p = WasmPoint3D::new(1.0, 2.0, 3.0);
        assert_eq!(p.x(), 1.0);
    }

    #[test]
    fn test_vector3d() {
        let v = WasmVector3D::new(3.0, 4.0, 0.0);
        assert!((v.magnitude() - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_bbox() {
        let bbox = WasmBoundingBox::new(0.0, 0.0, 0.0, 10.0, 10.0, 10.0);
        assert_eq!(bbox.volume(), 1000.0);
    }

    #[test]
    fn test_create_box() {
        let result = WasmCADOperations::create_box(10.0, 20.0, 30.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_cylinder() {
        let result = WasmCADOperations::create_cylinder(5.0, 10.0, 16);
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_sphere() {
        let result = WasmCADOperations::create_sphere(5.0, 8);
        assert!(result.is_ok());
    }

    #[test]
    fn test_json_serialization() {
        let p = WasmPoint3D::new(1.5, 2.5, 3.5);
        let json = p.to_json();
        let p2 = WasmPoint3D::from_json(&json).unwrap();
        assert_eq!(p2.x(), 1.5);
    }
}
