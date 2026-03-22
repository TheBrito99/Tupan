//! Manufacturing Process Modeling
//!
//! Cutting forces, tool wear, and process dynamics

use serde::{Deserialize, Serialize};

/// Cutting conditions for a machining operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingConditions {
    /// Spindle speed [RPM]
    pub spindle_speed: f64,

    /// Feed rate [mm/min]
    pub feed_rate: f64,

    /// Depth of cut [mm]
    pub depth_of_cut: f64,

    /// Tool diameter [mm]
    pub tool_diameter: f64,

    /// Workpiece material (hardness indicator)
    pub material_hardness: f64, // HRC equivalent
}

impl CuttingConditions {
    /// Create new cutting conditions
    pub fn new(speed: f64, feed: f64, depth: f64, diameter: f64) -> Self {
        CuttingConditions {
            spindle_speed: speed,
            feed_rate: feed,
            depth_of_cut: depth,
            tool_diameter: diameter,
            material_hardness: 200.0, // Steel: ~200 HV
        }
    }

    /// Calculate cutting velocity [m/min]
    pub fn cutting_velocity(&self) -> f64 {
        std::f64::consts::PI * self.tool_diameter * self.spindle_speed / 1000.0
    }

    /// Calculate tool engagement angle [degrees]
    pub fn engagement_angle(&self) -> f64 {
        // Simplified: depends on depth and diameter
        let ratio = (self.depth_of_cut / self.tool_diameter).min(1.0);
        180.0 * ratio.asin() / std::f64::consts::PI
    }
}

impl Default for CuttingConditions {
    fn default() -> Self {
        CuttingConditions::new(1000.0, 100.0, 1.0, 10.0)
    }
}

/// Tool wear model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolWear {
    /// Flank wear [mm]
    pub flank_wear: f64,

    /// Crater wear depth [mm]
    pub crater_wear: f64,

    /// Total cutting time [minutes]
    pub cutting_time: f64,

    /// Tool life limit [minutes]
    pub tool_life_limit: f64,
}

impl ToolWear {
    /// Create new tool wear model
    pub fn new(tool_life_minutes: f64) -> Self {
        ToolWear {
            flank_wear: 0.0,
            crater_wear: 0.0,
            cutting_time: 0.0,
            tool_life_limit: tool_life_minutes,
        }
    }

    /// Update tool wear based on cutting conditions
    pub fn update(&mut self, conditions: &CuttingConditions, dt: f64) {
        // dt in minutes
        self.cutting_time += dt;

        // Taylor's law: VT^n = C
        // For steel: n ≈ 0.25
        let v = conditions.cutting_velocity();
        let t_taylor = 1.0 / (v.powf(0.25) * conditions.material_hardness / 1000.0).max(0.001);

        // Wear rate proportional to cutting velocity and depth
        let velocity_factor = v / 100.0; // Normalized to 100 m/min
        let depth_factor = conditions.depth_of_cut / 1.0; // Normalized to 1mm

        let flank_wear_rate = 0.001 * velocity_factor * depth_factor; // mm/min
        let crater_wear_rate = 0.0005 * velocity_factor * depth_factor;

        self.flank_wear += flank_wear_rate * dt;
        self.crater_wear += crater_wear_rate * dt;
    }

    /// Get tool wear percentage
    pub fn wear_percentage(&self) -> f64 {
        (self.cutting_time / self.tool_life_limit * 100.0).min(100.0)
    }

    /// Check if tool needs replacement
    pub fn needs_replacement(&self) -> bool {
        self.flank_wear > 0.3 || self.crater_wear > 0.5 || self.cutting_time > self.tool_life_limit
    }

    /// Reset tool (simulate tool change)
    pub fn reset(&mut self) {
        self.flank_wear = 0.0;
        self.crater_wear = 0.0;
        self.cutting_time = 0.0;
    }
}

impl Default for ToolWear {
    fn default() -> Self {
        Self::new(60.0) // 60 minute tool life
    }
}

/// Cutting force model (Kienzle equation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingForces {
    /// Cutting force [N] - primary direction
    pub cutting_force: f64,

    /// Feed force [N] - perpendicular to cutting
    pub feed_force: f64,

    /// Passive force [N] - radial
    pub passive_force: f64,

    /// Power consumed [kW]
    pub power: f64,
}

impl CuttingForces {
    /// Calculate cutting forces using Kienzle coefficients
    pub fn calculate(conditions: &CuttingConditions) -> Self {
        // Kienzle equation: Fc = k_c1.1 * (h^x) * (b)
        // where h = f/z (feed per tooth), b = depth

        // Coefficients for steel (DIN 6581)
        let k_c1_1 = 1700.0; // MPa for steel
        let x = -0.25; // Exponent for feed per tooth

        // Simplified: assume single tooth
        let feed_per_tooth = conditions.feed_rate / conditions.spindle_speed;
        let thickness = feed_per_tooth;

        // Main cutting force
        let fc = k_c1_1 * thickness.powf(x) * conditions.depth_of_cut;

        // Feed force typically 20-40% of cutting force
        let ff = fc * 0.3;

        // Passive force typically 10-20% of cutting force
        let fp = fc * 0.15;

        // Power: P = Fc * v / 1000 (convert to kW)
        let v = conditions.cutting_velocity();
        let p = (fc * v) / 60000.0; // kW

        CuttingForces {
            cutting_force: fc.max(0.0),
            feed_force: ff.max(0.0),
            passive_force: fp.max(0.0),
            power: p.max(0.0),
        }
    }
}

/// Complete process model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessModel {
    /// Cutting conditions
    pub conditions: CuttingConditions,

    /// Tool wear
    pub tool_wear: ToolWear,

    /// Current cutting forces
    pub forces: CuttingForces,

    /// Surface roughness [μm Ra]
    pub surface_roughness: f64,
}

impl ProcessModel {
    /// Create new process model
    pub fn new(conditions: CuttingConditions) -> Self {
        let forces = CuttingForces::calculate(&conditions);

        ProcessModel {
            conditions,
            tool_wear: ToolWear::default(),
            forces,
            surface_roughness: 1.0,
        }
    }

    /// Update process for one timestep
    pub fn step(&mut self, dt: f64) {
        // Update tool wear
        self.tool_wear.update(&self.conditions, dt);

        // Recalculate cutting forces
        self.forces = CuttingForces::calculate(&self.conditions);

        // Update surface roughness based on feed rate and tool wear
        let base_roughness = self.conditions.feed_rate / 1000.0;
        let wear_factor = 1.0 + self.tool_wear.flank_wear / 0.3;
        self.surface_roughness = (base_roughness * wear_factor).min(10.0); // Max 10 μm
    }

    /// Change cutting conditions
    pub fn set_conditions(&mut self, conditions: CuttingConditions) {
        self.conditions = conditions;
        self.forces = CuttingForces::calculate(&self.conditions);
    }

    /// Check if process is safe
    pub fn is_safe(&self) -> bool {
        self.forces.power < 10.0 // Max 10kW
            && !self.tool_wear.needs_replacement()
            && self.surface_roughness < 10.0
    }
}

impl Default for ProcessModel {
    fn default() -> Self {
        Self::new(CuttingConditions::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cutting_conditions_creation() {
        let cc = CuttingConditions::new(1000.0, 100.0, 1.0, 10.0);
        assert_eq!(cc.spindle_speed, 1000.0);
    }

    #[test]
    fn test_cutting_velocity() {
        let cc = CuttingConditions::new(1000.0, 100.0, 1.0, 10.0);
        let v = cc.cutting_velocity();
        assert!(v > 0.0);
        assert!(v < 1000.0);
    }

    #[test]
    fn test_engagement_angle() {
        let cc = CuttingConditions::new(1000.0, 100.0, 5.0, 10.0);
        let angle = cc.engagement_angle();
        assert!(angle >= 0.0 && angle <= 180.0);
    }

    #[test]
    fn test_tool_wear_creation() {
        let wear = ToolWear::new(60.0);
        assert_eq!(wear.cutting_time, 0.0);
        assert_eq!(wear.flank_wear, 0.0);
    }

    #[test]
    fn test_tool_wear_update() {
        let mut wear = ToolWear::new(60.0);
        let cc = CuttingConditions::default();

        wear.update(&cc, 1.0);

        assert!(wear.flank_wear > 0.0);
        assert!(wear.cutting_time == 1.0);
    }

    #[test]
    fn test_cutting_forces() {
        let cc = CuttingConditions::new(1000.0, 100.0, 1.0, 10.0);
        let forces = CuttingForces::calculate(&cc);

        assert!(forces.cutting_force > 0.0);
        assert!(forces.feed_force > 0.0);
        assert!(forces.power > 0.0);
    }

    #[test]
    fn test_process_model() {
        let cc = CuttingConditions::default();
        let model = ProcessModel::new(cc);

        assert!(model.is_safe());
    }

    #[test]
    fn test_process_model_step() {
        let mut model = ProcessModel::default();
        let initial_wear = model.tool_wear.flank_wear;

        model.step(1.0);

        assert!(model.tool_wear.flank_wear >= initial_wear);
    }
}
