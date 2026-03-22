//! CAD-driven Machine Configuration
//!
//! Defines machine geometry, axes, limits, and capabilities
//! Can be imported from CAD models or configured programmatically

use serde::{Deserialize, Serialize};

/// Machine type classifications
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MachineType {
    /// CNC Milling machines
    CncMilling,

    /// Lathe/Turning machines
    Lathe,

    /// Laser cutting/engraving
    LaserCutter,

    /// 3D Printing (FDM)
    FdmPrinter,

    /// 3D Printing (Resin)
    ResinPrinter,

    /// Generic custom machine
    Custom,
}

/// Axis types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AxisType {
    /// Linear axis (X, Y, Z)
    Linear,

    /// Rotary axis (A, B, C)
    Rotary,

    /// Spindle rotation
    Spindle,
}

/// Single axis configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxisConfig {
    /// Axis name (X, Y, Z, A, B, C, etc.)
    pub name: String,

    /// Axis type
    pub axis_type: AxisType,

    /// Range minimum [mm or deg]
    pub min_limit: f64,

    /// Range maximum [mm or deg]
    pub max_limit: f64,

    /// Maximum velocity [mm/s or deg/s]
    pub max_velocity: f64,

    /// Maximum acceleration [mm/s² or deg/s²]
    pub max_acceleration: f64,

    /// Home position
    pub home_position: f64,

    /// Current position
    pub current_position: f64,

    /// Current velocity
    pub current_velocity: f64,
}

impl AxisConfig {
    /// Create new axis
    pub fn new(name: &str, axis_type: AxisType, min: f64, max: f64) -> Self {
        let max_vel = match axis_type {
            AxisType::Linear => 500.0,   // mm/s typical
            AxisType::Rotary => 360.0,   // deg/s typical
            AxisType::Spindle => 5000.0, // RPM typical
        };

        AxisConfig {
            name: name.to_string(),
            axis_type,
            min_limit: min,
            max_limit: max,
            max_velocity: max_vel,
            max_acceleration: 100.0,
            home_position: 0.0,
            current_position: 0.0,
            current_velocity: 0.0,
        }
    }

    /// Clamp position to valid range
    pub fn clamp_position(&self, position: f64) -> f64 {
        position.clamp(self.min_limit, self.max_limit)
    }

    /// Check if position is within limits
    pub fn is_in_limits(&self, position: f64) -> bool {
        position >= self.min_limit && position <= self.max_limit
    }

    /// Update axis position with velocity limit
    pub fn step(&mut self, target_velocity: f64, dt: f64) {
        // Clamp velocity to max
        let vel = target_velocity.clamp(-self.max_velocity, self.max_velocity);
        self.current_velocity = vel;

        // Update position
        let new_position = self.current_position + vel * dt;
        self.current_position = self.clamp_position(new_position);
    }
}

/// Complete machine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineConfig {
    /// Machine name
    pub name: String,

    /// Machine type
    pub machine_type: MachineType,

    /// Axes (indexed by name)
    pub axes: Vec<AxisConfig>,

    /// Work envelope dimensions [X, Y, Z]
    pub work_envelope: [f64; 3],

    /// Spindle speed range [RPM min, max]
    pub spindle_speed_range: [f64; 2],

    /// Tool changer capacity (0 if manual)
    pub tool_capacity: usize,

    /// Current tool index (-1 if none)
    pub current_tool: i32,

    /// Machine is powered on
    pub is_powered: bool,

    /// Machine is in emergency stop
    pub emergency_stop: bool,
}

impl MachineConfig {
    /// Create new machine configuration
    pub fn new(name: &str, machine_type: MachineType) -> Self {
        let axes = match machine_type {
            MachineType::CncMilling => vec![
                AxisConfig::new("X", AxisType::Linear, -250.0, 250.0),
                AxisConfig::new("Y", AxisType::Linear, -200.0, 200.0),
                AxisConfig::new("Z", AxisType::Linear, -100.0, 10.0),
            ],
            MachineType::Lathe => vec![
                AxisConfig::new("X", AxisType::Linear, 0.0, 100.0), // Radial
                AxisConfig::new("Z", AxisType::Linear, -300.0, 50.0), // Axial
            ],
            MachineType::LaserCutter => vec![
                AxisConfig::new("X", AxisType::Linear, 0.0, 600.0),
                AxisConfig::new("Y", AxisType::Linear, 0.0, 400.0),
            ],
            MachineType::FdmPrinter => vec![
                AxisConfig::new("X", AxisType::Linear, 0.0, 200.0),
                AxisConfig::new("Y", AxisType::Linear, 0.0, 200.0),
                AxisConfig::new("Z", AxisType::Linear, 0.0, 200.0),
            ],
            _ => vec![],
        };

        MachineConfig {
            name: name.to_string(),
            machine_type,
            axes,
            work_envelope: [500.0, 400.0, 200.0],
            spindle_speed_range: [0.0, 10000.0],
            tool_capacity: 8,
            current_tool: -1,
            is_powered: false,
            emergency_stop: false,
        }
    }

    /// Get axis by name
    pub fn get_axis(&self, name: &str) -> Option<&AxisConfig> {
        self.axes.iter().find(|a| a.name == name)
    }

    /// Get mutable axis by name
    pub fn get_axis_mut(&mut self, name: &str) -> Option<&mut AxisConfig> {
        self.axes.iter_mut().find(|a| a.name == name)
    }

    /// Get all current positions as vector
    pub fn get_positions(&self) -> Vec<f64> {
        self.axes.iter().map(|a| a.current_position).collect()
    }

    /// Update all axes with target velocities
    pub fn step_axes(&mut self, velocities: &[f64], dt: f64) -> Result<(), String> {
        if velocities.len() != self.axes.len() {
            return Err(format!(
                "Velocity count {} != axis count {}",
                velocities.len(),
                self.axes.len()
            ));
        }

        for (axis, &vel) in self.axes.iter_mut().zip(velocities.iter()) {
            axis.step(vel, dt);
        }

        Ok(())
    }

    /// Power on the machine
    pub fn power_on(&mut self) {
        self.is_powered = true;
        self.emergency_stop = false;
    }

    /// Power off the machine
    pub fn power_off(&mut self) {
        self.is_powered = false;
    }

    /// Trigger emergency stop
    pub fn trigger_estop(&mut self) {
        self.emergency_stop = true;
        // Stop all axes
        for axis in &mut self.axes {
            axis.current_velocity = 0.0;
        }
    }

    /// Clear emergency stop
    pub fn clear_estop(&mut self) {
        self.emergency_stop = false;
    }

    /// Home all axes
    pub fn home_all_axes(&mut self) {
        for axis in &mut self.axes {
            axis.current_position = axis.home_position;
            axis.current_velocity = 0.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_axis_creation() {
        let axis = AxisConfig::new("X", AxisType::Linear, -250.0, 250.0);
        assert_eq!(axis.name, "X");
        assert_eq!(axis.min_limit, -250.0);
        assert_eq!(axis.max_limit, 250.0);
    }

    #[test]
    fn test_axis_clamping() {
        let axis = AxisConfig::new("X", AxisType::Linear, -250.0, 250.0);
        assert_eq!(axis.clamp_position(-500.0), -250.0);
        assert_eq!(axis.clamp_position(500.0), 250.0);
        assert_eq!(axis.clamp_position(0.0), 0.0);
    }

    #[test]
    fn test_machine_creation() {
        let machine = MachineConfig::new("Small CNC", MachineType::CncMilling);
        assert_eq!(machine.name, "Small CNC");
        assert_eq!(machine.axes.len(), 3); // X, Y, Z
    }

    #[test]
    fn test_machine_power() {
        let mut machine = MachineConfig::new("Test", MachineType::CncMilling);
        assert!(!machine.is_powered);

        machine.power_on();
        assert!(machine.is_powered);

        machine.power_off();
        assert!(!machine.is_powered);
    }

    #[test]
    fn test_machine_estop() {
        let mut machine = MachineConfig::new("Test", MachineType::CncMilling);
        machine.power_on();

        machine.trigger_estop();
        assert!(machine.emergency_stop);

        // All velocities should be zero
        for axis in &machine.axes {
            assert_eq!(axis.current_velocity, 0.0);
        }

        machine.clear_estop();
        assert!(!machine.emergency_stop);
    }

    #[test]
    fn test_home_axes() {
        let mut machine = MachineConfig::new("Test", MachineType::CncMilling);

        // Move axes away from home
        if let Some(x_axis) = machine.get_axis_mut("X") {
            x_axis.current_position = 100.0;
        }

        // Home all
        machine.home_all_axes();

        // Should be back at home
        for axis in &machine.axes {
            assert_eq!(axis.current_position, axis.home_position);
        }
    }

    #[test]
    fn test_lathe_configuration() {
        let machine = MachineConfig::new("Lathe", MachineType::Lathe);
        assert_eq!(machine.axes.len(), 2); // X (radial), Z (axial)
        assert_eq!(machine.axes[0].name, "X");
        assert_eq!(machine.axes[1].name, "Z");
    }

    #[test]
    fn test_laser_cutter_configuration() {
        let machine = MachineConfig::new("Laser", MachineType::LaserCutter);
        assert_eq!(machine.axes.len(), 2); // X, Y only
    }
}
