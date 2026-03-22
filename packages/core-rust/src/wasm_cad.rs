/**
 * WASM CAD Bindings
 * Phase 17: 3D CAD Foundation
 *
 * Exposes CAD system to TypeScript via WASM
 */

use wasm_bindgen::prelude::*;
use crate::cad::{
    CADDocument, ParametricBody,
    brep::{BREPShell, Point3D, Vector3D},
    constraint_solver::{Constraint, ConstraintType},
    sketcher::{Sketch, SketchPlane},
    features::{Feature, FeatureType, ExtrudeDirection, AxisType, HoleType},
};
use serde_json::{json, Value};

// ============================================================================
// WASM BINDINGS
// ============================================================================

#[wasm_bindgen]
pub struct WasmCADDocument {
    document: CADDocument,
}

#[wasm_bindgen]
impl WasmCADDocument {
    /// Create a new CAD document
    #[wasm_bindgen(constructor)]
    pub fn new(name: String) -> WasmCADDocument {
        let document = CADDocument::new(name);
        WasmCADDocument { document }
    }

    /// Get document ID
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.document.id.clone()
    }

    /// Get document name
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.document.name.clone()
    }

    /// Get document as JSON
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string(&self.document).map_err(|e| e.to_string())
    }

    /// Set a parameter
    pub fn set_parameter(&mut self, name: String, value: f64) -> Result<(), String> {
        self.document.set_parameter(name, value)
    }

    /// Get a parameter
    pub fn get_parameter(&self, name: &str) -> Option<f64> {
        self.document.parameters.get(name).copied()
    }

    /// Create a new sketch
    pub fn create_sketch(&mut self, name: String, plane: &str) -> Result<String, String> {
        let sketch_plane = match plane {
            "XY" => SketchPlane::XY,
            "YZ" => SketchPlane::YZ,
            "XZ" => SketchPlane::XZ,
            _ => return Err("Invalid plane".to_string()),
        };

        let sketch = Sketch::new(name, sketch_plane);
        self.document.add_sketch(sketch)
    }

    /// Add a point to a sketch
    pub fn sketch_add_point(&mut self, sketch_id: &str, x: f64, y: f64, construction: bool) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            Ok(sketch.add_point(x, y, construction))
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Add a line to a sketch
    pub fn sketch_add_line(
        &mut self,
        sketch_id: &str,
        start_id: String,
        end_id: String,
        construction: bool,
    ) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            sketch.add_line(start_id, end_id, construction)
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Add a circle to a sketch
    pub fn sketch_add_circle(
        &mut self,
        sketch_id: &str,
        center_id: String,
        radius: f64,
        construction: bool,
    ) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            sketch.add_circle(center_id, radius, construction)
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Constrain horizontal on a sketch
    pub fn sketch_constrain_horizontal(&mut self, sketch_id: &str, line_id: &str) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            sketch.constrain_horizontal(line_id)
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Constrain vertical on a sketch
    pub fn sketch_constrain_vertical(&mut self, sketch_id: &str, line_id: &str) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            sketch.constrain_vertical(line_id)
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Constrain distance between two points
    pub fn sketch_constrain_distance(
        &mut self,
        sketch_id: &str,
        point1_id: &str,
        point2_id: &str,
        distance: f64,
    ) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            sketch.constrain_distance(point1_id, point2_id, distance)
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Constrain radius on a sketch
    pub fn sketch_constrain_radius(&mut self, sketch_id: &str, circle_id: &str, radius: f64) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            sketch.constrain_radius(circle_id, radius)
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Solve all constraints in a sketch
    pub fn sketch_solve(&mut self, sketch_id: &str) -> Result<(), String> {
        if let Some(sketch) = self.document.body.sketches.get_mut(sketch_id) {
            sketch.solve_constraints()
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Get sketch constraint status
    pub fn sketch_get_status(&self, sketch_id: &str) -> Result<String, String> {
        if let Some(sketch) = self.document.body.sketches.get(sketch_id) {
            Ok(sketch.check_constraint_status())
        } else {
            Err("Sketch not found".to_string())
        }
    }

    /// Create an extrude feature
    pub fn create_extrude(
        &mut self,
        name: String,
        sketch_id: String,
        length: f64,
    ) -> Result<String, String> {
        let feature = Feature::new(
            name,
            FeatureType::Extrude {
                sketch_id,
                length,
                direction: ExtrudeDirection::Normal,
                is_solid: true,
                draft_angle: None,
            },
        );

        self.document.add_feature(feature)
    }

    /// Create a hole feature
    pub fn create_hole(
        &mut self,
        name: String,
        diameter: f64,
        sketch_point_id: String,
        hole_type: &str,
    ) -> Result<String, String> {
        let ht = match hole_type {
            "Blind" => HoleType::Blind,
            "Through" => HoleType::Through,
            "CounterBore" => HoleType::CounterBore,
            "CounterSink" => HoleType::CounterSink,
            "Tapped" => HoleType::Tapped,
            _ => return Err("Invalid hole type".to_string()),
        };

        let feature = Feature::new(
            name,
            FeatureType::Hole {
                hole_type: ht,
                diameter,
                depth: None,
                sketch_point_id,
            },
        );

        self.document.add_feature(feature)
    }

    /// Recompute the model
    pub fn recompute(&mut self) -> Result<(), String> {
        self.document.recompute()
    }

    /// Export to STEP format
    pub fn export_step(&self) -> Result<String, String> {
        self.document.export_step()
    }

    /// Export to STL format
    pub fn export_stl(&self) -> Result<Vec<u8>, String> {
        self.document.export_stl()
    }

    /// Get all sketches as JSON
    pub fn get_sketches_json(&self) -> Result<String, String> {
        let sketches: Vec<_> = self.document.body.sketches.values().collect();
        serde_json::to_string(&sketches).map_err(|e| e.to_string())
    }

    /// Get all features as JSON
    pub fn get_features_json(&self) -> Result<String, String> {
        serde_json::to_string(&self.document.body.features).map_err(|e| e.to_string())
    }

    /// Get parameters as JSON
    pub fn get_parameters_json(&self) -> Result<String, String> {
        serde_json::to_string(&self.document.parameters).map_err(|e| e.to_string())
    }
}

// ============================================================================
// GEOMETRY UTILITIES
// ============================================================================

#[wasm_bindgen]
pub struct WasmPoint3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[wasm_bindgen]
impl WasmPoint3D {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, z: f64) -> WasmPoint3D {
        WasmPoint3D { x, y, z }
    }

    pub fn distance_to(&self, other: &WasmPoint3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
}

#[wasm_bindgen]
pub struct WasmBREPShell {
    shell: BREPShell,
}

#[wasm_bindgen]
impl WasmBREPShell {
    /// Create a new box geometry
    pub fn create_box(width: f64, height: f64, depth: f64) -> Result<WasmBREPShell, String> {
        let shell = crate::cad::brep::BREPOperations::create_box(
            Point3D::new(0.0, 0.0, 0.0),
            width,
            height,
            depth,
        )?;

        Ok(WasmBREPShell { shell })
    }

    /// Get shell as triangulated mesh (for rendering)
    pub fn triangulate(&self) -> Result<String, String> {
        let (vertices, indices) = self.shell.triangulate();

        let data = json!({
            "vertices": vertices.iter().map(|v| vec![v.x, v.y, v.z]).collect::<Vec<_>>(),
            "indices": indices,
            "vertex_count": vertices.len(),
            "triangle_count": indices.len() / 3,
        });

        Ok(data.to_string())
    }

    /// Get bounding box
    pub fn get_bounding_box(&self) -> Result<String, String> {
        let bb = &self.shell.bounding_box;
        let data = json!({
            "min": { "x": bb.min.x, "y": bb.min.y, "z": bb.min.z },
            "max": { "x": bb.max.x, "y": bb.max.y, "z": bb.max.z },
            "width": bb.width(),
            "height": bb.height(),
            "depth": bb.depth(),
        });

        Ok(data.to_string())
    }

    /// Get number of vertices
    pub fn vertex_count(&self) -> usize {
        self.shell.vertices.len()
    }

    /// Get number of edges
    pub fn edge_count(&self) -> usize {
        self.shell.edges.len()
    }

    /// Get number of faces
    pub fn face_count(&self) -> usize {
        self.shell.faces.len()
    }
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

#[wasm_bindgen]
pub fn init_cad() -> String {
    "CAD System initialized".to_string()
}
