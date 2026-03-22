/**
 * Feeds and Speeds Calculator
 * Calculates optimal cutting parameters based on material and tool
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::tools::Tool;

/// Material properties for machining
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialProperties {
    pub name: String,
    pub density: f64,              // kg/m³
    pub hardness: u16,             // HV
    pub machinability_index: u16,  // relative (steel = 100)
    pub cutting_speed_range: (f64, f64), // (min, max) m/min
}

impl MaterialProperties {
    pub fn new(
        name: String,
        density: f64,
        hardness: u16,
        machinability_index: u16,
    ) -> Self {
        let cutting_speed_range = match name.as_str() {
            "Aluminum" => (100.0, 400.0),
            "Brass" => (80.0, 200.0),
            "Steel" => (30.0, 100.0),
            "Stainless Steel" => (15.0, 50.0),
            "Cast Iron" => (20.0, 60.0),
            "Titanium" => (10.0, 40.0),
            _ => (50.0, 150.0),
        };

        MaterialProperties {
            name,
            density,
            hardness,
            machinability_index,
            cutting_speed_range,
        }
    }
}

/// Cutting conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingParameters {
    pub spindle_speed: f64,    // RPM
    pub feedrate: f64,         // mm/min
    pub depth_of_cut: f64,     // mm
    pub width_of_cut: f64,     // mm
    pub cutting_speed: f64,    // m/min
    pub chip_load: f64,        // mm/tooth
    pub material_removal_rate: f64, // mm³/min
    pub estimated_power: f64,  // kW
    pub estimated_temp: f64,   // °C (approximate)
}

/// Feeds and Speeds Calculator
pub struct FeedsSpeedsCalculator;

impl FeedsSpeedsCalculator {
    /// Calculate optimal feeds and speeds
    pub fn calculate(
        tool: &Tool,
        material: &MaterialProperties,
        depth_of_cut: f64,
        width_of_cut: f64,
    ) -> Result<CuttingParameters, String> {
        // Validate inputs
        if depth_of_cut <= 0.0 {
            return Err("Depth of cut must be positive".to_string());
        }
        if tool.diameter <= 0.0 {
            return Err("Tool diameter must be positive".to_string());
        }

        // Select cutting speed (m/min)
        let cutting_speed = Self::select_cutting_speed(tool, material);

        // Calculate spindle speed (RPM)
        let spindle_speed = Self::calculate_spindle_speed(tool.diameter, cutting_speed);

        // Calculate chip load per tooth (mm/tooth)
        let chip_load = Self::calculate_chip_load(tool, material, cutting_speed);

        // Calculate feedrate (mm/min)
        let feedrate = chip_load * tool.num_flutes as f64 * spindle_speed;

        // Material removal rate (mm³/min)
        let mrr = feedrate * depth_of_cut * width_of_cut / 1000.0;

        // Estimate power consumption
        let estimated_power = Self::estimate_power(material, mrr, cutting_speed);

        // Estimate temperature
        let estimated_temp = Self::estimate_temperature(material, cutting_speed, chip_load);

        Ok(CuttingParameters {
            spindle_speed,
            feedrate,
            depth_of_cut,
            width_of_cut,
            cutting_speed,
            chip_load,
            material_removal_rate: mrr,
            estimated_power,
            estimated_temp,
        })
    }

    /// Select optimal cutting speed based on tool and material
    fn select_cutting_speed(tool: &Tool, material: &MaterialProperties) -> f64 {
        let (min_speed, max_speed) = material.cutting_speed_range;
        let mid_speed = (min_speed + max_speed) / 2.0;

        // Adjust based on tool material
        let speed = match tool.material.as_str() {
            "HSS" => mid_speed * 0.7,
            "Carbide" => mid_speed * 1.2,
            "Ceramic" => mid_speed * 1.5,
            _ => mid_speed,
        };

        // Adjust for coated tools
        let speed = if tool.coating.is_some() {
            speed * 1.1
        } else {
            speed
        };

        // Clamp to material range
        speed.max(min_speed).min(max_speed)
    }

    /// Calculate spindle speed from cutting speed and diameter
    fn calculate_spindle_speed(diameter: f64, cutting_speed: f64) -> f64 {
        // n = (Vc * 1000) / (π * D)
        let rpm = (cutting_speed * 1000.0) / (std::f64::consts::PI * diameter);
        rpm.round()
    }

    /// Calculate chip load per tooth
    fn calculate_chip_load(
        tool: &Tool,
        material: &MaterialProperties,
        cutting_speed: f64,
    ) -> f64 {
        // Base chip loads (mm/tooth) by material type
        let base_load = match material.name.as_str() {
            "Aluminum" => 0.05,
            "Brass" => 0.04,
            "Steel" => 0.08,
            "Stainless Steel" => 0.06,
            "Cast Iron" => 0.05,
            "Titanium" => 0.03,
            _ => 0.05,
        };

        // Adjust by tool diameter
        let diameter_factor = (tool.diameter / 2.0).min(1.0).max(0.5);

        // Adjust by cutting speed (higher speed = lower chip load)
        let speed_factor = 100.0 / cutting_speed.max(10.0);

        // Adjust by flute count
        let flute_factor = 1.0 / (tool.num_flutes as f64 * 0.3).max(1.0);

        base_load * diameter_factor * speed_factor * flute_factor
    }

    /// Estimate power consumption
    fn estimate_power(material: &MaterialProperties, mrr: f64, cutting_speed: f64) -> f64 {
        // Specific power (kW per mm³/min) by material
        let specific_power = match material.name.as_str() {
            "Aluminum" => 0.4,
            "Brass" => 0.5,
            "Steel" => 1.2,
            "Stainless Steel" => 1.5,
            "Cast Iron" => 0.8,
            "Titanium" => 2.0,
            _ => 1.0,
        };

        // Power = (Specific Power * MRR) / 60
        let power = (specific_power * mrr) / 60.0;

        // Temperature effect (higher temp = more power)
        let temp_factor = 1.0 + (cutting_speed / 100.0) * 0.1;

        power * temp_factor
    }

    /// Estimate cutting temperature
    fn estimate_temperature(
        material: &MaterialProperties,
        cutting_speed: f64,
        chip_load: f64,
    ) -> f64 {
        // Base temperature by material (°C)
        let base_temp = match material.name.as_str() {
            "Aluminum" => 300.0,
            "Brass" => 400.0,
            "Steel" => 500.0,
            "Stainless Steel" => 600.0,
            "Cast Iron" => 450.0,
            "Titanium" => 800.0,
            _ => 500.0,
        };

        // Increase with cutting speed
        let speed_factor = 1.0 + (cutting_speed / 50.0) * 0.2;

        // Increase with chip load
        let load_factor = 1.0 + (chip_load / 0.1) * 0.3;

        base_temp * speed_factor * load_factor
    }

    /// Adjust parameters for machine limits
    pub fn apply_machine_limits(
        params: &mut CuttingParameters,
        max_spindle: f64,
        max_feedrate: f64,
        max_power: f64,
    ) {
        // Limit spindle speed
        if params.spindle_speed > max_spindle {
            params.spindle_speed = max_spindle;
        }

        // Limit feedrate
        if params.feedrate > max_feedrate {
            params.feedrate = max_feedrate;
        }

        // Reduce depth of cut if power exceeds limit
        if params.estimated_power > max_power {
            let power_ratio = max_power / params.estimated_power.max(0.01);
            params.depth_of_cut *= power_ratio;
            params.material_removal_rate *= power_ratio;
            params.estimated_power = max_power;
        }
    }

    /// Generate feedrate acceleration profile
    pub fn acceleration_profile(
        start_feedrate: f64,
        end_feedrate: f64,
        distance: f64,
        max_acceleration: f64,
    ) -> Vec<(f64, f64)> {
        // Generate feedrate vs distance points
        let mut profile = Vec::new();
        let num_points = 20;

        for i in 0..=num_points {
            let t = i as f64 / num_points as f64;
            // Ease-in-ease-out profile
            let eased_t = t * t * (3.0 - 2.0 * t);
            let feedrate = start_feedrate + (end_feedrate - start_feedrate) * eased_t;
            let dist = distance * t;
            profile.push((dist, feedrate));
        }

        profile
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_spindle_speed() {
        // For 4mm tool at 100 m/min
        let rpm = FeedsSpeedsCalculator::calculate_spindle_speed(4.0, 100.0);
        assert!(rpm > 7000.0 && rpm < 8000.0);
    }

    #[test]
    fn test_material_properties() {
        let steel = MaterialProperties::new(
            "Steel".to_string(),
            7850.0,
            250,
            100,
        );
        assert_eq!(steel.name, "Steel");
        assert_eq!(steel.density, 7850.0);
        assert!(steel.cutting_speed_range.0 > 0.0);
    }

    #[test]
    fn test_feeds_speeds_calculation() {
        let tool = crate::manufacturing::tools::Tool::flat_endmill(
            "test".to_string(),
            "Test".to_string(),
            2.0,
            6.0,
            2,
        );
        let material = MaterialProperties::new(
            "Aluminum".to_string(),
            2700.0,
            40,
            300,
        );

        let params = FeedsSpeedsCalculator::calculate(&tool, &material, 2.0, 5.0)
            .expect("Failed to calculate parameters");

        assert!(params.spindle_speed > 0.0);
        assert!(params.feedrate > 0.0);
        assert!(params.chip_load > 0.0);
        assert!(params.material_removal_rate > 0.0);
    }

    #[test]
    fn test_machine_limits() {
        let tool = crate::manufacturing::tools::Tool::flat_endmill(
            "test".to_string(),
            "Test".to_string(),
            2.0,
            6.0,
            2,
        );
        let material = MaterialProperties::new(
            "Steel".to_string(),
            7850.0,
            250,
            100,
        );

        let mut params = FeedsSpeedsCalculator::calculate(&tool, &material, 2.0, 5.0)
            .expect("Failed to calculate");

        let original_power = params.estimated_power;
        FeedsSpeedsCalculator::apply_machine_limits(
            &mut params,
            5000.0,
            2000.0,
            2.0,
        );

        assert!(params.spindle_speed <= 5000.0);
        assert!(params.feedrate <= 2000.0);
        assert!(params.estimated_power <= 2.1);
    }

    #[test]
    fn test_acceleration_profile() {
        let profile = FeedsSpeedsCalculator::acceleration_profile(0.0, 100.0, 50.0, 10.0);
        assert!(profile.len() > 0);
        assert!(profile[0].1 < profile[profile.len() - 1].1); // Should increase
    }
}
