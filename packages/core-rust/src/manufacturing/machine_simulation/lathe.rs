//! Lathe/Turning Simulation
//!
//! Simulates single-point turning, threading, and surface finishes
//! on lathe machines with CSS (Constant Surface Speed) control.

use serde::{Deserialize, Serialize};

/// Lathe spindle configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatheSpindle {
    /// Spindle speed [RPM]
    pub spindle_speed: f64,

    /// Spindle CSS mode (constant surface speed)
    pub css_enabled: bool,

    /// Target surface speed [m/min] for CSS
    pub target_surface_speed: f64,

    /// Current cutting diameter [mm]
    pub workpiece_diameter: f64,

    /// Spindle power [kW]
    pub spindle_power: f64,

    /// Spindle torque [N·m]
    pub spindle_torque: f64,
}

impl LatheSpindle {
    /// Create new lathe spindle
    pub fn new() -> Self {
        LatheSpindle {
            spindle_speed: 0.0,
            css_enabled: true,
            target_surface_speed: 100.0,      // m/min
            workpiece_diameter: 50.0,          // mm
            spindle_power: 5.0,                // kW
            spindle_torque: 0.0,
        }
    }

    /// Update spindle speed for CSS control
    ///
    /// Constant Surface Speed (CSS) maintains constant cutting velocity
    /// as diameter decreases, requiring RPM increase
    pub fn update_css(&mut self) {
        if self.css_enabled && self.workpiece_diameter > 1.0 {
            // V = π·D·N / 1000 (V in m/min, D in mm, N in RPM)
            // N = V·1000 / (π·D)
            let target_rpm = (self.target_surface_speed * 1000.0)
                / (std::f64::consts::PI * self.workpiece_diameter);

            self.spindle_speed = target_rpm.min(5000.0); // Max 5000 RPM limit
        }
    }

    /// Calculate cutting velocity
    pub fn cutting_velocity(&self) -> f64 {
        // V = π·D·N / 1000 [m/min]
        (std::f64::consts::PI * self.workpiece_diameter * self.spindle_speed) / 1000.0
    }

    /// Calculate spindle power required
    pub fn calculate_power(&self, cutting_force_n: f64) -> f64 {
        // Power = Torque × ω = (F × r) × (2πN/60)
        // P [kW] = F [N] × V [m/min] / 60000
        (cutting_force_n * self.cutting_velocity()) / 60000.0
    }
}

impl Default for LatheSpindle {
    fn default() -> Self {
        Self::new()
    }
}

/// Single-point tool geometry for turning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurningTool {
    /// Tool nose radius [mm]
    pub nose_radius: f64,

    /// Back rake angle [degrees]
    pub back_rake: f64,

    /// Side rake angle [degrees]
    pub side_rake: f64,

    /// Relief angle [degrees]
    pub relief_angle: f64,

    /// Tool material (HSS, Carbide, CBN)
    pub material: ToolMaterial,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ToolMaterial {
    HSS,      // High-speed steel
    Carbide,  // Tungsten carbide
    CBN,      // Cubic boron nitride
}

impl TurningTool {
    /// Create HSS turning tool
    pub fn hss_roughing() -> Self {
        TurningTool {
            nose_radius: 0.8,
            back_rake: 8.0,
            side_rake: 8.0,
            relief_angle: 6.0,
            material: ToolMaterial::HSS,
        }
    }

    /// Create carbide finishing tool
    pub fn carbide_finishing() -> Self {
        TurningTool {
            nose_radius: 0.4,
            back_rake: 0.0,    // Neutral for stability
            side_rake: 5.0,
            relief_angle: 6.0,
            material: ToolMaterial::Carbide,
        }
    }

    /// Create threading tool
    pub fn threading() -> Self {
        TurningTool {
            nose_radius: 0.0,   // Sharp for threading
            back_rake: 0.0,
            side_rake: 0.0,
            relief_angle: 6.0,
            material: ToolMaterial::Carbide,
        }
    }
}

impl Default for TurningTool {
    fn default() -> Self {
        Self::hss_roughing()
    }
}

/// Threading specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadSpec {
    /// Thread pitch [mm]
    pub pitch: f64,

    /// Thread type (Metric, UN, etc.)
    pub thread_type: ThreadType,

    /// Number of passes
    pub num_passes: u32,

    /// Thread depth [mm]
    pub depth: f64,

    /// Lead taper [mm]
    pub lead_taper: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ThreadType {
    MetricCoarse,
    MetricFine,
    UNC,  // Unified National Coarse
    UNF,  // Unified National Fine
    ACME,
}

impl ThreadSpec {
    /// Create M10 × 1.5 metric thread
    pub fn m10_coarse() -> Self {
        ThreadSpec {
            pitch: 1.5,
            thread_type: ThreadType::MetricCoarse,
            num_passes: 5,
            depth: 0.75,
            lead_taper: 2.0,
        }
    }

    /// Thread lead (pitch for single start)
    pub fn thread_lead(&self) -> f64 {
        self.pitch
    }
}

impl Default for ThreadSpec {
    fn default() -> Self {
        Self::m10_coarse()
    }
}

/// Lathe cutting conditions for turning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurningConditions {
    /// Depth of cut [mm]
    pub depth_of_cut: f64,

    /// Feed rate [mm/rev]
    pub feed_per_rev: f64,

    /// Workpiece material (Aluminum, Steel, Cast Iron, etc.)
    pub workpiece_material: WorkpieceMaterial,

    /// Specific cutting pressure [MPa]
    pub specific_cutting_pressure: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum WorkpieceMaterial {
    Aluminum,
    Steel,
    StainlessSteel,
    CastIron,
    Brass,
    Titanium,
}

impl TurningConditions {
    /// Create typical turning conditions
    pub fn aluminum_roughing() -> Self {
        TurningConditions {
            depth_of_cut: 3.0,
            feed_per_rev: 0.3,
            workpiece_material: WorkpieceMaterial::Aluminum,
            specific_cutting_pressure: 800.0,  // MPa
        }
    }

    /// Create finishing conditions
    pub fn steel_finishing() -> Self {
        TurningConditions {
            depth_of_cut: 0.5,
            feed_per_rev: 0.1,
            workpiece_material: WorkpieceMaterial::Steel,
            specific_cutting_pressure: 1800.0,  // MPa
        }
    }

    /// Get specific cutting pressure for material
    pub fn scp_for_material(material: WorkpieceMaterial, tool_material: ToolMaterial) -> f64 {
        match (material, tool_material) {
            (WorkpieceMaterial::Aluminum, ToolMaterial::HSS) => 600.0,
            (WorkpieceMaterial::Aluminum, ToolMaterial::Carbide) => 400.0,
            (WorkpieceMaterial::Steel, ToolMaterial::HSS) => 1800.0,
            (WorkpieceMaterial::Steel, ToolMaterial::Carbide) => 1200.0,
            (WorkpieceMaterial::CastIron, ToolMaterial::HSS) => 1400.0,
            (WorkpieceMaterial::CastIron, ToolMaterial::Carbide) => 800.0,
            (WorkpieceMaterial::StainlessSteel, ToolMaterial::Carbide) => 1500.0,
            _ => 1000.0,  // Default
        }
    }
}

impl Default for TurningConditions {
    fn default() -> Self {
        Self::aluminum_roughing()
    }
}

/// Lathe turning simulator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatheSimulator {
    pub spindle: LatheSpindle,
    pub tool: TurningTool,
    pub conditions: TurningConditions,
    pub time_minutes: f64,
    pub distance_traveled: f64,  // mm
}

impl LatheSimulator {
    /// Create new lathe simulator
    pub fn new() -> Self {
        LatheSimulator {
            spindle: LatheSpindle::new(),
            tool: TurningTool::default(),
            conditions: TurningConditions::default(),
            time_minutes: 0.0,
            distance_traveled: 0.0,
        }
    }

    /// Calculate cutting force using Kienzle equation
    ///
    /// F_c = k_c × h × f × z
    /// where: h = depth of cut, f = feed per tooth, z = number of teeth/edges
    pub fn cutting_force(&self) -> f64 {
        let kc = TurningConditions::scp_for_material(
            self.conditions.workpiece_material,
            self.tool.material,
        );

        // For single-point tool (z=1):
        // F_c = k_c × depth × feed
        kc * self.conditions.depth_of_cut * self.conditions.feed_per_rev
    }

    /// Calculate surface finish (Ra) based on feed and nose radius
    ///
    /// Ra ≈ f² / (8 × R)
    /// where f = feed per revolution, R = tool nose radius
    pub fn surface_finish_ra(&self) -> f64 {
        if self.tool.nose_radius > 0.01 {
            (self.conditions.feed_per_rev.powi(2)) / (8.0 * self.tool.nose_radius)
        } else {
            self.conditions.feed_per_rev * 10.0  // Sharp tool
        }
    }

    /// Simulate one turning pass
    ///
    /// Returns distance traveled (mm) and time spent (minutes)
    pub fn simulate_pass(&mut self, pass_length: f64) -> (f64, f64) {
        self.spindle.update_css();

        let velocity = self.spindle.cutting_velocity(); // m/min
        if velocity < 1.0 {
            return (0.0, 0.0);
        }

        // Distance = pass_length (axial travel)
        // Feed per minute = velocity [m/min] × feed_per_rev [mm/rev]
        let feed_per_min = velocity * 1000.0 * self.conditions.feed_per_rev
            / (self.spindle.spindle_speed.max(1.0));

        let time_minutes = pass_length / feed_per_min;

        self.distance_traveled += pass_length;
        self.time_minutes += time_minutes;

        (pass_length, time_minutes)
    }

    /// Simulate threading operation
    ///
    /// Thread feed rate is locked to spindle speed
    pub fn thread_pass(&mut self, thread: &ThreadSpec) -> (f64, f64) {
        // Threading feed = pitch (synchronized with spindle)
        // But must ramp in/out

        let pass_length = 50.0; // mm axial travel (example)
        let feed_per_rev = thread.pitch; // mm/rev

        self.spindle.update_css();
        let velocity = self.spindle.cutting_velocity();

        if velocity < 1.0 {
            return (0.0, 0.0);
        }

        let feed_per_min = velocity * 1000.0 * feed_per_rev
            / (self.spindle.spindle_speed.max(1.0));

        let time_minutes = pass_length / feed_per_min;

        self.distance_traveled += pass_length;
        self.time_minutes += time_minutes;

        (pass_length, time_minutes)
    }
}

impl Default for LatheSimulator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lathe_spindle_creation() {
        let spindle = LatheSpindle::new();
        assert_eq!(spindle.spindle_speed, 0.0);
        assert!(spindle.css_enabled);
        assert_eq!(spindle.target_surface_speed, 100.0);
    }

    #[test]
    fn test_css_calculation() {
        let mut spindle = LatheSpindle::new();
        spindle.workpiece_diameter = 50.0;
        spindle.target_surface_speed = 100.0; // m/min

        spindle.update_css();

        // N = V·1000 / (π·D) = 100·1000 / (π·50) ≈ 637 RPM
        assert!(spindle.spindle_speed > 600.0 && spindle.spindle_speed < 700.0);
    }

    #[test]
    fn test_cutting_velocity() {
        let mut spindle = LatheSpindle::new();
        spindle.spindle_speed = 500.0;
        spindle.workpiece_diameter = 50.0;

        let velocity = spindle.cutting_velocity();
        // V = π·D·N / 1000 = π·50·500 / 1000 ≈ 78.5 m/min
        assert!(velocity > 70.0 && velocity < 90.0);
    }

    #[test]
    fn test_turning_tool_creation() {
        let tool_hss = TurningTool::hss_roughing();
        assert_eq!(tool_hss.nose_radius, 0.8);

        let tool_carbide = TurningTool::carbide_finishing();
        assert_eq!(tool_carbide.material as u8, ToolMaterial::Carbide as u8);
    }

    #[test]
    fn test_thread_spec() {
        let thread = ThreadSpec::m10_coarse();
        assert_eq!(thread.pitch, 1.5);
        assert_eq!(thread.thread_lead(), 1.5);
    }

    #[test]
    fn test_turning_conditions() {
        let conditions = TurningConditions::aluminum_roughing();
        assert_eq!(conditions.depth_of_cut, 3.0);

        let scp = TurningConditions::scp_for_material(
            WorkpieceMaterial::Aluminum,
            ToolMaterial::Carbide,
        );
        assert_eq!(scp, 400.0);
    }

    #[test]
    fn test_lathe_simulator_creation() {
        let sim = LatheSimulator::new();
        assert_eq!(sim.time_minutes, 0.0);
        assert_eq!(sim.distance_traveled, 0.0);
    }

    #[test]
    fn test_cutting_force() {
        let sim = LatheSimulator::new(); // Aluminum roughing with HSS tool
        let force = sim.cutting_force();

        // F = k_c × depth × feed = 600 [aluminum+HSS] × 3.0 × 0.3 = 540 N
        assert!(force > 500.0 && force < 600.0);
    }

    #[test]
    fn test_surface_finish() {
        let sim = LatheSimulator::new();
        let ra = sim.surface_finish_ra();

        // Ra = f² / (8·R) = 0.3² / (8·0.8) ≈ 0.014 µm (very fine finish)
        assert!(ra > 0.01 && ra < 0.05);
    }

    #[test]
    fn test_simulate_pass() {
        let mut sim = LatheSimulator::new();
        sim.spindle.spindle_speed = 500.0;

        let (_dist, time) = sim.simulate_pass(100.0); // 100mm pass

        assert!(time > 0.0);
        assert_eq!(sim.distance_traveled, 100.0);
    }

    #[test]
    fn test_thread_pass() {
        let mut sim = LatheSimulator::new();
        sim.spindle.spindle_speed = 200.0; // Threading speed

        let thread = ThreadSpec::m10_coarse();
        let (_dist, time) = sim.thread_pass(&thread);

        assert!(time > 0.0);
    }
}
