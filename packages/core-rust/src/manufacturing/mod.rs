/**
 * Manufacturing Module - CAM System
 * Phase 19: CAM Core Engine & G-Code Generation
 *
 * Comprehensive manufacturing simulation and G-code generation
 * Task 1: Core Engine
 * - Tool library and management
 * - Cutting parameter calculations (feeds/speeds)
 * - Toolpath generation and optimization
 * - Cutting strategies (adaptive, face, pencil finishing)
 * - Collision detection and avoidance
 *
 * Task 2: G-Code Post-Processors
 * - Multi-format G-code generation (Fanuc, Heidenhain, Siemens)
 * - Canned cycles (drilling, tapping, boring)
 * - Tool change optimization
 * - Machine-specific dialect support
 *
 * Task 3: FDM 3D Printer Slicer
 * - Mesh slicing into layers
 * - Multiple infill patterns (linear, grid, honeycomb, gyroid, cubic, Voronoi)
 * - Support structure generation (linear, grid, tree)
 * - Layer optimization and analysis
 *
 * Task 4: Laser Cutting & 2D Nesting
 * - 2D nesting optimization for sheet materials
 * - Kerf compensation for accurate cutting
 * - Material utilization analysis
 *
 * Task 5: Manufacturing Simulation
 * - Cutting force prediction (Kienzle equation)
 * - Spindle power and torque monitoring
 * - Thermal analysis (chip, tool, workpiece temps)
 */

pub mod tools;
pub mod feeds_speeds;
pub mod toolpath;
pub mod strategies;
pub mod collision;
pub mod postprocessor;
pub mod canned_cycles;
pub mod tool_changer;
pub mod dialects;
pub mod slicer;
pub mod supports;
pub mod infill;
pub mod nesting;
pub mod laser;
pub mod cutting_forces;
pub mod spindle_load;
pub mod thermal;
pub mod multi_axis;
pub mod multiaxis_gcode;
pub mod vendor_catalog;
pub mod specialty_tools;
pub mod tool_life;
pub mod feature_recognition;
pub mod parametric_cam;
pub mod machine_simulation;

// Re-export key types
pub use tools::{Tool, ToolType, ToolLibrary, BallEndMill, FlatEndMill};
pub use feeds_speeds::{FeedsSpeedsCalculator, CuttingParameters, MaterialProperties};
pub use toolpath::{Toolpath, ToolpathSegment, SegmentType, CuttingConditions};
pub use strategies::{CuttingStrategy, StrategyType, AdaptiveStrategy, FaceStrategy};
pub use collision::{CollisionDetector, CollisionResult, CollisionType, MultiAxisCollisionDetector, MultiAxisCollisionResult, MultiAxisToolGeometry};
pub use postprocessor::{PostProcessor, PostProcessorConfig, GCodeProgram, GCodeBlock, GCodeDialect};
pub use canned_cycles::{HoleParameters, CannedCycleType, TappingParameters, ThreadSpec};
pub use tool_changer::{ToolMagazine, ToolChangeOptimizer, MagazineType, ToolStation};
pub use dialects::{FanucDialect, HeidenhainDialect, SiemensDialect, MazakDialect, MazakMachineType, DialectCapabilities};
pub use slicer::{SlicedModel, Layer, Contour, SlicingConfig, InfillPattern, MeshSlicer};
pub use supports::{SupportStructure, SupportGenerator, SupportAnalyzer, SupportStructureType};
pub use infill::{InfillGenerator, InfillAnalyzer};
pub use nesting::{NestingOptimizer, NestingResult, Part2D, PlacedPart, Sheet};
pub use laser::{LaserParameters, KerfCompensator, MaterialSpec, LaserCutOperation, AssistGas};
pub use cutting_forces::{CuttingForceCalculator, CuttingForceResult, MaterialCuttingCoefficients, CuttingForceModel};
pub use spindle_load::{SpindleLoadCalculator, SpindleLoadResult, SpindleSpec};
pub use thermal::{ThermalCalculator, ThermalResult, ThermalRisk, ThermalMaterial, ToolThermal};
pub use multi_axis::{Point6D, ToolOrientation, InverseKinematics, MachineType, IKError};
pub use multiaxis_gcode::{MultiAxisGCodeGenerator, MultiAxisConfig, TCPCMode};
pub use vendor_catalog::{VendorTool, VendorCatalog, ToolVendor, Coating, Availability};
pub use specialty_tools::{ThreadMill, FormCutter, UndercutTool, TSlotTool, ThreadType};
pub use tool_life::{ToolLifeTracker, UsageRecord, TaylorConstants, UsageStatistics};
pub use feature_recognition::{FeatureRecognizer, MachinableFeature, FeatureId, HoleType};
pub use parametric_cam::{ParametricCamSession, ParametricOperation, OperationId, OperationType};

use std::collections::HashMap;

/// CAM Engine - Main orchestrator for manufacturing operations
pub struct CAMEngine {
    tools: ToolLibrary,
    materials: HashMap<String, MaterialProperties>,
    machine_limits: MachineLimits,
}

/// Machine capabilities and constraints
#[derive(Debug, Clone)]
pub struct MachineLimits {
    pub max_spindle_speed: f64,      // RPM
    pub max_feedrate: f64,            // mm/min
    pub max_rapid_speed: f64,        // mm/min
    pub max_torque: f64,             // N·m
    pub max_power: f64,              // kW
    pub max_acceleration: f64,       // mm/s²
    pub coolant_available: bool,
}

impl CAMEngine {
    /// Create a new CAM engine with default machine limits
    pub fn new() -> Self {
        CAMEngine {
            tools: ToolLibrary::new(),
            materials: HashMap::new(),
            machine_limits: MachineLimits {
                max_spindle_speed: 10000.0,
                max_feedrate: 5000.0,
                max_rapid_speed: 10000.0,
                max_torque: 50.0,
                max_power: 5.0,
                max_acceleration: 1000.0,
                coolant_available: true,
            },
        }
    }

    /// Register a material with its properties
    pub fn register_material(&mut self, name: String, properties: MaterialProperties) {
        self.materials.insert(name, properties);
    }

    /// Get registered material properties
    pub fn get_material(&self, name: &str) -> Option<&MaterialProperties> {
        self.materials.get(name)
    }

    /// Set machine limits
    pub fn set_machine_limits(&mut self, limits: MachineLimits) {
        self.machine_limits = limits;
    }

    /// Get machine limits
    pub fn machine_limits(&self) -> &MachineLimits {
        &self.machine_limits
    }

    /// Get tool library
    pub fn tools(&self) -> &ToolLibrary {
        &self.tools
    }

    /// Get mutable tool library
    pub fn tools_mut(&mut self) -> &mut ToolLibrary {
        &mut self.tools
    }
}

impl Default for CAMEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cam_engine_creation() {
        let engine = CAMEngine::new();
        assert_eq!(engine.machine_limits.max_spindle_speed, 10000.0);
        assert_eq!(engine.machine_limits.max_feedrate, 5000.0);
        assert!(engine.machine_limits.coolant_available);
    }

    #[test]
    fn test_register_material() {
        let mut engine = CAMEngine::new();
        let steel = MaterialProperties {
            name: "Steel".to_string(),
            density: 7850.0,
            hardness: 250,
            machinability_index: 100,
            cutting_speed_range: (50.0, 150.0),
        };
        engine.register_material("Steel".to_string(), steel.clone());
        assert_eq!(engine.get_material("Steel").unwrap().density, 7850.0);
    }

    #[test]
    fn test_machine_limits_customization() {
        let mut engine = CAMEngine::new();
        let new_limits = MachineLimits {
            max_spindle_speed: 15000.0,
            max_feedrate: 8000.0,
            max_rapid_speed: 15000.0,
            max_torque: 75.0,
            max_power: 7.5,
            max_acceleration: 1500.0,
            coolant_available: true,
        };
        engine.set_machine_limits(new_limits);
        assert_eq!(engine.machine_limits().max_spindle_speed, 15000.0);
    }
}
