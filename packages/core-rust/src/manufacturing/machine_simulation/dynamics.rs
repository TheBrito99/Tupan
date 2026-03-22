//! Machine Dynamics Modeling
//!
//! Simulates realistic machine motion with:
//! - Acceleration/deceleration curves
//! - Velocity limits
//! - Load dynamics
//! - Thermal effects

use serde::{Deserialize, Serialize};
use super::MachineConfig;

/// Machine operational state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineState {
    /// Cycle number
    pub cycle_count: u64,

    /// Elapsed time [seconds]
    pub elapsed_time: f64,

    /// Spindle speed [RPM]
    pub spindle_speed: f64,

    /// Current load on machine [0-100%]
    pub load_percentage: f64,

    /// Spindle temperature [°C]
    pub spindle_temperature: f64,

    /// Bearing temperature [°C]
    pub bearing_temperature: f64,

    /// Vibration level [acceleration, m/s²]
    pub vibration_level: f64,

    /// Error flag
    pub has_error: bool,
}

impl MachineState {
    /// Create new machine state
    pub fn new() -> Self {
        MachineState {
            cycle_count: 0,
            elapsed_time: 0.0,
            spindle_speed: 0.0,
            load_percentage: 0.0,
            spindle_temperature: 20.0,    // Room temperature
            bearing_temperature: 20.0,
            vibration_level: 0.0,
            has_error: false,
        }
    }
}

impl Default for MachineState {
    fn default() -> Self {
        Self::new()
    }
}

/// Machine dynamics model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicsModel {
    /// Spindle inertia [kg·m²]
    pub spindle_inertia: f64,

    /// Spindle friction coefficient [N·m·s/rad]
    pub spindle_friction: f64,

    /// Motor constant [N·m/A]
    pub motor_constant: f64,

    /// Thermal time constant [seconds]
    pub thermal_time_constant: f64,

    /// Max spindle acceleration [RPM/s]
    pub max_spindle_accel: f64,

    /// Current spindle torque [N·m]
    pub spindle_torque: f64,

    /// Cutting load torque [N·m]
    pub load_torque: f64,
}

impl DynamicsModel {
    /// Create default dynamics model
    pub fn new() -> Self {
        DynamicsModel {
            spindle_inertia: 0.05,          // 50g at 10cm radius
            spindle_friction: 0.001,
            motor_constant: 0.1,
            thermal_time_constant: 60.0,
            max_spindle_accel: 1000.0,      // RPM/s
            spindle_torque: 0.0,
            load_torque: 0.0,
        }
    }

    /// Update spindle dynamics for one timestep
    pub fn step_spindle(
        &mut self,
        state: &mut MachineState,
        target_rpm: f64,
        dt: f64,
    ) {
        // Calculate spindle acceleration needed to reach target
        let current_rad_s = state.spindle_speed * 2.0 * std::f64::consts::PI / 60.0;
        let target_rad_s = target_rpm * 2.0 * std::f64::consts::PI / 60.0;

        // Motor torque = motor_constant * current
        // Friction torque = spindle_friction * angular_velocity
        // Load torque from cutting
        let net_torque = self.spindle_torque - self.spindle_friction * current_rad_s - self.load_torque;

        // Angular acceleration: α = τ / I
        let angular_accel = net_torque / self.spindle_inertia;

        // Update spindle speed with acceleration limit
        let max_accel_rad_s = self.max_spindle_accel * 2.0 * std::f64::consts::PI / 60.0;
        let limited_accel = angular_accel.clamp(-max_accel_rad_s, max_accel_rad_s);

        let new_rad_s = current_rad_s + limited_accel * dt;
        state.spindle_speed = new_rad_s * 60.0 / (2.0 * std::f64::consts::PI);
        state.spindle_speed = state.spindle_speed.max(0.0);

        // Update thermal model
        self.update_thermal(state, dt);

        state.cycle_count += 1;
        state.elapsed_time += dt;
    }

    /// Update thermal model (spindle heating)
    fn update_thermal(&mut self, state: &mut MachineState, dt: f64) {
        // Heat generation from friction and cutting
        let friction_power = self.spindle_friction * state.spindle_speed * state.spindle_speed;
        let cutting_power = self.load_torque * state.spindle_speed * 100.0; // Estimated

        // Thermal balance: dT/dt = (P - P_dissipated) / C_thermal
        let total_power = friction_power + cutting_power;
        let ambient_temp = 20.0;
        let temp_diff = state.spindle_temperature - ambient_temp;
        let cooling_power = temp_diff / self.thermal_time_constant;

        let net_power = (total_power - cooling_power).max(0.0);
        let temp_rise = net_power * dt / 100.0; // Scale factor

        state.spindle_temperature += temp_rise;
        state.spindle_temperature = state.spindle_temperature.min(100.0); // Max 100°C

        // Bearing temperature follows spindle with lag
        state.bearing_temperature =
            state.bearing_temperature * 0.9 + state.spindle_temperature * 0.1;
    }

    /// Calculate vibration from load and speed
    pub fn calculate_vibration(&mut self, _machine: &MachineConfig, state: &mut MachineState) {
        // Vibration increases with load and spindle speed
        let speed_factor = state.spindle_speed / 5000.0; // Normalized to 5000 RPM
        let load_factor = state.load_percentage / 100.0;

        // Base vibration from out-of-balance
        let base_vibration = 0.1;

        // Resonance at ~3000 RPM
        let resonance_freq = 3000.0;
        let freq_ratio = state.spindle_speed / resonance_freq;
        let resonance_factor = if (freq_ratio - 1.0).abs() < 0.2 {
            10.0 // High at resonance
        } else {
            1.0
        };

        state.vibration_level =
            base_vibration * speed_factor * load_factor * resonance_factor;

        // High vibration indicates problem
        if state.vibration_level > 5.0 {
            state.has_error = true;
        }
    }

    /// Get spindle load as percentage
    pub fn get_load_percentage(&self, state: &MachineState) -> f64 {
        let _current_rpm = state.spindle_speed.max(1.0);
        let load_torque_nm = self.load_torque;

        // Normalize to typical cutting load (0.5 N·m at full speed)
        let normalized_load = (load_torque_nm / 0.5) * 100.0;
        normalized_load.clamp(0.0, 100.0)
    }
}

impl Default for DynamicsModel {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_machine_state_creation() {
        let state = MachineState::new();
        assert_eq!(state.cycle_count, 0);
        assert_eq!(state.spindle_speed, 0.0);
        assert_eq!(state.spindle_temperature, 20.0);
    }

    #[test]
    fn test_dynamics_model_creation() {
        let dynamics = DynamicsModel::new();
        assert!(dynamics.spindle_inertia > 0.0);
        assert_eq!(dynamics.spindle_torque, 0.0);
    }

    #[test]
    fn test_spindle_acceleration() {
        let mut dynamics = DynamicsModel::new();
        let mut state = MachineState::new();

        // Apply torque (larger torque for faster acceleration)
        dynamics.spindle_torque = 1.0; // 1.0 N·m

        // Step simulation
        for _ in 0..100 {
            dynamics.step_spindle(&mut state, 5000.0, 0.001);
        }

        // Should have accelerated to at least 5 RPM in 0.1 seconds
        assert!(state.spindle_speed > 5.0, "Spindle should accelerate to at least 5 RPM");
    }

    #[test]
    fn test_thermal_model() {
        let mut dynamics = DynamicsModel::new();
        let mut state = MachineState::new();

        dynamics.spindle_torque = 1.0;
        dynamics.load_torque = 0.5;

        // Run for 10 seconds at high speed
        for _ in 0..10000 {
            state.spindle_speed = 5000.0;
            dynamics.step_spindle(&mut state, 5000.0, 0.001);
        }

        // Should be warmer than ambient
        assert!(state.spindle_temperature > 20.0, "Spindle should heat up");
    }

    #[test]
    fn test_vibration_calculation() {
        let machine = MachineConfig::new("Test", super::super::MachineType::CncMilling);
        let mut dynamics = DynamicsModel::new();
        let mut state = MachineState::new();

        state.spindle_speed = 3000.0; // Resonance frequency
        state.load_percentage = 50.0;

        dynamics.calculate_vibration(&machine, &mut state);

        // Should have significant vibration at resonance
        assert!(state.vibration_level > 0.1);
    }

    #[test]
    fn test_spindle_speed_ramp() {
        let mut dynamics = DynamicsModel::new();
        let mut state = MachineState::new();

        dynamics.spindle_torque = 2.0; // Higher torque

        let mut max_speed: f64 = 0.0;
        for _ in 0..1000 {
            dynamics.step_spindle(&mut state, 5000.0, 0.01);
            max_speed = max_speed.max(state.spindle_speed);
        }

        // Should reach substantial speed (not full 5000 RPM due to friction and acceleration limit)
        assert!(max_speed > 500.0, "Should reach at least 500 RPM");
    }
}
