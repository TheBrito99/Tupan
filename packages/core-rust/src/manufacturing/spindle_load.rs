/**
 * Spindle Load - Spindle Power and Torque Monitoring
 * Phase 19 Task 5: Manufacturing Simulation
 *
 * Monitors and predicts spindle power consumption and torque
 * during machining operations
 */

use serde::{Deserialize, Serialize};

/// Spindle load result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpindleLoadResult {
    pub cutting_power: f64,      // W - cutting power
    pub spindle_torque: f64,     // N·m - spindle torque
    pub spindle_speed: f64,      // RPM
    pub load_percentage: f64,    // 0-100% of spindle capacity
    pub power_margin: f64,       // W - remaining power available
    pub torque_margin: f64,      // N·m - remaining torque available
}

/// Machine spindle specifications
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SpindleSpec {
    pub max_power: f64,          // W - maximum spindle power
    pub max_torque: f64,         // N·m - maximum spindle torque
    pub max_speed: f64,          // RPM
    pub min_speed: f64,          // RPM
    pub efficiency: f64,         // 0.0-1.0 (typical: 0.85-0.95)
    pub mechanical_loss: f64,    // W - bearing friction, etc.
}

impl SpindleSpec {
    /// Generic spindle specs
    pub fn generic_3hp() -> Self {
        SpindleSpec {
            max_power: 2250.0,       // 3 HP in watts
            max_torque: 15.0,        // N·m
            max_speed: 6000.0,       // RPM
            min_speed: 50.0,
            efficiency: 0.90,
            mechanical_loss: 100.0,
        }
    }

    /// CNC vertical mill (typical)
    pub fn cnc_vertical_mill() -> Self {
        SpindleSpec {
            max_power: 5000.0,       // 5-7 kW
            max_torque: 25.0,
            max_speed: 10000.0,
            min_speed: 10.0,
            efficiency: 0.88,
            mechanical_loss: 150.0,
        }
    }

    /// High-speed spindle
    pub fn high_speed_spindle() -> Self {
        SpindleSpec {
            max_power: 3000.0,
            max_torque: 10.0,
            max_speed: 24000.0,
            min_speed: 100.0,
            efficiency: 0.92,
            mechanical_loss: 80.0,
        }
    }

    /// High-torque spindle (low speed)
    pub fn high_torque_spindle() -> Self {
        SpindleSpec {
            max_power: 4000.0,
            max_torque: 50.0,
            max_speed: 3000.0,
            min_speed: 10.0,
            efficiency: 0.85,
            mechanical_loss: 200.0,
        }
    }
}

/// Spindle load calculator
pub struct SpindleLoadCalculator;

impl SpindleLoadCalculator {
    /// Calculate spindle load from cutting power
    pub fn calculate_load(
        cutting_power: f64,      // W
        spindle_spec: &SpindleSpec,
        spindle_speed: f64,      // RPM
    ) -> Result<SpindleLoadResult, String> {
        // Validate spindle speed
        if spindle_speed < spindle_spec.min_speed || spindle_speed > spindle_spec.max_speed {
            return Err(format!(
                "Spindle speed {} outside range {}-{}",
                spindle_speed, spindle_spec.min_speed, spindle_spec.max_speed
            ));
        }

        // Total power including mechanical losses
        let total_power = cutting_power + spindle_spec.mechanical_loss;

        // Actual electrical input power (accounting for efficiency)
        let electrical_power = total_power / spindle_spec.efficiency;

        // Spindle torque: T = P * 60000 / (2π * RPM)
        let spindle_torque = if spindle_speed > 0.0 {
            (cutting_power * 60000.0) / (2.0 * std::f64::consts::PI * spindle_speed)
        } else {
            0.0
        };

        // Load percentages
        let power_load = (electrical_power / spindle_spec.max_power * 100.0).min(100.0);
        let torque_load = (spindle_torque / spindle_spec.max_torque * 100.0).min(100.0);
        let load_percentage = power_load.max(torque_load); // Use the higher one

        // Margins
        let power_margin = (spindle_spec.max_power * spindle_spec.efficiency - total_power).max(0.0);
        let torque_margin = (spindle_spec.max_torque - spindle_torque).max(0.0);

        Ok(SpindleLoadResult {
            cutting_power,
            spindle_torque,
            spindle_speed,
            load_percentage,
            power_margin,
            torque_margin,
        })
    }

    /// Check if machining operation is within spindle limits
    pub fn is_within_limits(
        cutting_power: f64,
        spindle_spec: &SpindleSpec,
        spindle_speed: f64,
        safety_margin_percent: f64, // Typically 10-20%
    ) -> Result<bool, String> {
        let result = Self::calculate_load(cutting_power, spindle_spec, spindle_speed)?;
        let max_safe_load = 100.0 - safety_margin_percent;
        Ok(result.load_percentage <= max_safe_load)
    }

    /// Estimate spindle thermal load
    /// Higher load → higher temperature
    pub fn thermal_load_estimate(
        cutting_power: f64,
        continuous_duration_min: f64, // Minutes
        ambient_temp: f64,             // °C
    ) -> f64 {
        // Spindle temperature rise ~ power * time
        // Rough model: ΔT = (power / heat_dissipation_coeff) * (1 - exp(-time/tau))
        let heat_dissipation = 50.0; // W/°C (depends on spindle cooling)
        let time_constant = 30.0;    // Minutes (thermal time constant)

        let power_factor = cutting_power / 1000.0; // Normalize by 1kW
        let time_factor = 1.0 - (-continuous_duration_min / time_constant).exp();
        let temp_rise = power_factor * time_factor * heat_dissipation / 10.0;

        ambient_temp + temp_rise
    }

    /// Predict spindle bearing life based on load
    pub fn bearing_life_hours(
        load_percentage: f64,
        spindle_speed: f64,
        operating_hours: f64, // Already accumulated
    ) -> f64 {
        // L₁₀ life = (C/P)³ * 10⁶ revolutions
        // Simplified: Higher load reduces life exponentially
        let base_life = 10000.0; // hours at low load

        // Load exponent (typical bearing: -3)
        let load_factor = if load_percentage > 80.0 {
            0.3 // 70% load reduction for high loads
        } else if load_percentage > 60.0 {
            0.6
        } else {
            1.0
        };

        // Speed factor (higher speed = shorter life)
        let speed_factor = 5000.0 / (spindle_speed.max(1.0));

        let remaining_life = base_life * load_factor * speed_factor;
        (remaining_life - operating_hours).max(0.0)
    }

    /// Estimate when spindle maintenance is needed
    pub fn maintenance_interval(
        load_percentage: f64,
        spindle_speed: f64,
        base_interval: f64, // Hours
    ) -> f64 {
        // High load → more frequent maintenance
        let load_factor = if load_percentage > 80.0 {
            0.5
        } else if load_percentage > 60.0 {
            0.75
        } else {
            1.0
        };

        base_interval * load_factor
    }

    /// Optimal spindle speed for given cutting power limit
    pub fn optimal_speed_for_power(
        cutting_power: f64,
        desired_torque: f64,
        spindle_spec: &SpindleSpec,
    ) -> Result<f64, String> {
        // Power = Torque * Angular velocity
        // RPM = (Power * 60000) / (2π * Torque)
        if desired_torque <= 0.0 {
            return Err("Desired torque must be > 0".to_string());
        }

        let rpm = (cutting_power * 60000.0) / (2.0 * std::f64::consts::PI * desired_torque);

        // Clamp to spindle limits
        let optimal_rpm = rpm
            .max(spindle_spec.min_speed)
            .min(spindle_spec.max_speed);

        Ok(optimal_rpm)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spindle_spec_generic() {
        let spec = SpindleSpec::generic_3hp();
        assert_eq!(spec.max_power, 2250.0);
        assert!(spec.efficiency > 0.8 && spec.efficiency < 1.0);
    }

    #[test]
    fn test_calculate_spindle_load() {
        let spec = SpindleSpec::generic_3hp();
        let result = SpindleLoadCalculator::calculate_load(1000.0, &spec, 1000.0);
        assert!(result.is_ok());
        let load = result.unwrap();
        assert!(load.load_percentage > 0.0 && load.load_percentage <= 100.0);
    }

    #[test]
    fn test_torque_calculation() {
        let spec = SpindleSpec::generic_3hp();
        let result = SpindleLoadCalculator::calculate_load(500.0, &spec, 1000.0).unwrap();
        // Verify: Torque = Power * 60000 / (2π * RPM)
        let expected_torque = (500.0 * 60000.0) / (2.0 * std::f64::consts::PI * 1000.0);
        assert!((result.spindle_torque - expected_torque).abs() < 0.01);
    }

    #[test]
    fn test_exceeds_spindle_limits() {
        let spec = SpindleSpec::generic_3hp();
        let result = SpindleLoadCalculator::is_within_limits(3000.0, &spec, 1000.0, 10.0);
        assert!(result.is_ok());
        assert!(!result.unwrap()); // Exceeds limits
    }

    #[test]
    fn test_within_spindle_limits() {
        let spec = SpindleSpec::generic_3hp();
        let result = SpindleLoadCalculator::is_within_limits(100.0, &spec, 1000.0, 10.0);
        assert!(result.is_ok());
        assert!(result.unwrap()); // Within limits
    }

    #[test]
    fn test_spindle_speed_validation() {
        let spec = SpindleSpec::generic_3hp();
        let result = SpindleLoadCalculator::calculate_load(500.0, &spec, 10000.0);
        assert!(result.is_err()); // Speed exceeds max
    }

    #[test]
    fn test_thermal_load_estimate() {
        let temp_30min = SpindleLoadCalculator::thermal_load_estimate(1000.0, 30.0, 20.0);
        let temp_60min = SpindleLoadCalculator::thermal_load_estimate(1000.0, 60.0, 20.0);
        assert!(temp_60min > temp_30min); // Longer operation = more heat
    }

    #[test]
    fn test_bearing_life_high_load() {
        let life_high = SpindleLoadCalculator::bearing_life_hours(85.0, 5000.0, 0.0);
        let life_low = SpindleLoadCalculator::bearing_life_hours(30.0, 5000.0, 0.0);
        assert!(life_low > life_high); // Higher load = shorter life
    }

    #[test]
    fn test_maintenance_interval() {
        let interval_high = SpindleLoadCalculator::maintenance_interval(85.0, 5000.0, 500.0);
        let interval_low = SpindleLoadCalculator::maintenance_interval(30.0, 5000.0, 500.0);
        assert!(interval_low > interval_high); // High load = more frequent maintenance
    }

    #[test]
    fn test_optimal_speed_for_power() {
        let spec = SpindleSpec::generic_3hp();
        let result = SpindleLoadCalculator::optimal_speed_for_power(1000.0, 10.0, &spec);
        assert!(result.is_ok());
        let rpm = result.unwrap();
        assert!(rpm >= spec.min_speed && rpm <= spec.max_speed);
    }

    #[test]
    fn test_cnc_mill_spec() {
        let spec = SpindleSpec::cnc_vertical_mill();
        assert!(spec.max_power > SpindleSpec::generic_3hp().max_power);
    }

    #[test]
    fn test_high_speed_spindle_spec() {
        let spec = SpindleSpec::high_speed_spindle();
        assert!(spec.max_speed > SpindleSpec::generic_3hp().max_speed);
        assert!(spec.max_torque < SpindleSpec::generic_3hp().max_torque); // Trade-off
    }
}
