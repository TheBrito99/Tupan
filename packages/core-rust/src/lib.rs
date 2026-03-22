/**
 * Tupan Core Library
 *
 * Rust-based computation engine for mechatronics engineering
 * Compiled to WASM for browser execution
 *
 * Modules:
 * - cad: 3D CAD system with BREP kernel (Phase 18)
 * - geometry: 2D CAD primitives and operations
 * - dxf: DXF file format support
 * - bond_graph: Bond graph simulation
 * - manufacturing: CAM, toolpath generation, G-code (Phase 19)
 */

pub mod cad;
pub mod geometry;
pub mod dxf;
pub mod bond_graph;
pub mod manufacturing;
pub mod microcontroller;
pub mod optimization;
pub mod clifford_algebra;
pub mod ml;

#[cfg(feature = "wasm")]
pub mod wasm;

// 3D CAD exports
pub use cad::geometry::{Point3D, Vector3D, Matrix3x3, BoundingBox};
pub use cad::{BREPShell, CADDocument, CADOperations};

// 2D geometry exports
pub use geometry::{
    Point, GeometricEntity, BoundingBox as BoundingBox2D, Transform2D, ConstraintSolver,
};
pub use dxf::{DxfDrawing, DxfImporter, DxfExporter};

// Manufacturing exports
pub use manufacturing::{
    CAMEngine, Tool, ToolType, ToolLibrary, FeedsSpeedsCalculator, CuttingParameters,
    Toolpath, ToolpathSegment, CuttingStrategy, CollisionDetector,
    CuttingForceCalculator, SpindleLoadCalculator, ThermalCalculator,
};

// Microcontroller exports (Phase 22)
pub use microcontroller::{
    ArmCpuEmulator, Instruction, InstructionSet, ArmThumb2,
    CpuRegisters, RegisterId, CpuMemory, CpuState, ExecutionState,
};

// Machine Learning exports (Phase 28)
pub use ml::{
    Agent, AgentConfig, ActionSpace, StateSpace, Experience, ExperienceBuffer,
    RewardFunction, RewardConfig, FormationReward, RewardBreakdown,
    NeuralNetwork, NetworkLayer, ActivationFunction,
};

// WASM exports (conditional)
#[cfg(feature = "wasm")]
pub use wasm::{
    WasmManufacturingSimulator, WasmCuttingForceRequest, WasmSpindleLoadRequest,
    WasmThermalRequest, WasmManufacturingResult,
    WasmOptimizationSimulator, WasmOptimizationRequest, WasmOptimizationResult,
    WasmDFMRequest, WasmDFMResult, WasmDFMViolation,
};
