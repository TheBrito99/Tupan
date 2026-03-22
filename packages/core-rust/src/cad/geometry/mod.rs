/**
 * BREP Geometry Module
 * Phase 18 Task 1: BREP Kernel & Geometric Primitives
 *
 * Core geometric primitives and operations for 3D modeling
 */

pub mod primitives;
pub mod brep;
pub mod operations;
pub mod validation;
pub mod triangulation;

// Re-export key types
pub use primitives::{Point3D, Vector3D, BoundingBox, Matrix3x3};
pub use brep::{BREPVertex, BREPEdge, BREPFace, BREPShell, CurveType, SurfaceType};
pub use operations::{BooleanOperation, ExtrudeOp, RevolveOp};
pub use validation::{ManifoldValidator, ValidationError};
pub use triangulation::{Triangulator, TriangulationResult};
