//! Laser Cutting and Engraving Simulation
//!
//! Models laser-material interaction including power, cutting speed,
//! kerf width, and material ablation depth for CO2 and fiber lasers.

use serde::{Deserialize, Serialize};

/// Laser system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaserSystem {
    /// Laser type (CO2, Fiber, YAG)
    pub laser_type: LaserType,

    /// Output power [Watts]
    pub power_watts: f64,

    /// Wavelength [µm]
    pub wavelength: f64,

    /// Beam quality M² factor
    pub beam_quality: f64,

    /// Pulse frequency [kHz] for pulsed lasers
    pub pulse_frequency: f64,

    /// Pulse duration [µs]
    pub pulse_duration: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LaserType {
    CO2,         // 10.6 µm, good for organics
    Fiber,       // 1.064 µm, good for metals
    YAG,         // 1.064 µm, older fiber laser
    Excimer,     // UV, high-precision
}

impl LaserSystem {
    /// Create typical CO2 laser (100W)
    pub fn co2_100w() -> Self {
        LaserSystem {
            laser_type: LaserType::CO2,
            power_watts: 100.0,
            wavelength: 10.6,
            beam_quality: 1.5,
            pulse_frequency: 5.0,  // 5 kHz
            pulse_duration: 50.0,  // 50 µs
        }
    }

    /// Create typical fiber laser (40W)
    pub fn fiber_40w() -> Self {
        LaserSystem {
            laser_type: LaserType::Fiber,
            power_watts: 40.0,
            wavelength: 1.064,
            beam_quality: 1.2,
            pulse_frequency: 100.0,  // 100 kHz
            pulse_duration: 10.0,    // 10 µs
        }
    }

    /// Calculate beam diameter at focus [mm]
    ///
    /// d = 4·λ·f·M² / π·D
    /// where λ = wavelength [µm], f = focal length [mm], M² = beam quality
    /// Note: wavelength is converted from µm to mm
    pub fn beam_diameter(&self, focal_length: f64, lens_diameter: f64) -> f64 {
        let wavelength_mm = self.wavelength / 1000.0; // Convert from µm to mm
        (4.0 * wavelength_mm * focal_length * self.beam_quality)
            / (std::f64::consts::PI * lens_diameter)
    }

    /// Calculate peak power density [MW/cm²]
    ///
    /// P_density = Power / Beam_area
    pub fn power_density(&self, beam_diameter_mm: f64) -> f64 {
        let beam_area_cm2 = std::f64::consts::PI * (beam_diameter_mm / 20.0).powi(2);
        (self.power_watts / 1e6) / beam_area_cm2
    }
}

impl Default for LaserSystem {
    fn default() -> Self {
        Self::co2_100w()
    }
}

/// Material properties for laser cutting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaserMaterial {
    /// Material name
    pub name: String,

    /// Absorption coefficient (0-1, fraction absorbed)
    pub absorption: f64,

    /// Melting temperature [°C]
    pub melting_temp: f64,

    /// Boiling temperature [°C]
    pub boiling_temp: f64,

    /// Thermal conductivity [W/(mm·°C)]
    pub thermal_conductivity: f64,

    /// Heat capacity [J/(mg·°C)]
    pub heat_capacity: f64,

    /// Density [mg/mm³]
    pub density: f64,
}

impl LaserMaterial {
    /// CO2 laser: Acrylic (PMMA)
    pub fn acrylic() -> Self {
        LaserMaterial {
            name: "Acrylic (PMMA)".to_string(),
            absorption: 0.95,    // CO2 laser excellent absorption
            melting_temp: 105.0,
            boiling_temp: 240.0,
            thermal_conductivity: 0.0002,
            heat_capacity: 1.4,
            density: 0.0012,
        }
    }

    /// CO2 laser: Wood
    pub fn wood() -> Self {
        LaserMaterial {
            name: "Wood (Pine)".to_string(),
            absorption: 0.80,    // Good absorption, some charring
            melting_temp: 300.0,
            boiling_temp: 450.0,
            thermal_conductivity: 0.00015,
            heat_capacity: 1.7,
            density: 0.0006,
        }
    }

    /// Fiber laser: Steel
    pub fn steel() -> Self {
        LaserMaterial {
            name: "Steel (ASTM A36)".to_string(),
            absorption: 0.65,    // Fiber laser good for metals
            melting_temp: 1510.0,
            boiling_temp: 2750.0,
            thermal_conductivity: 0.05,
            heat_capacity: 0.48,
            density: 0.0079,
        }
    }

    /// CO2 laser: Paper/Cardboard
    pub fn paper() -> Self {
        LaserMaterial {
            name: "Paper (20lb)".to_string(),
            absorption: 0.92,
            melting_temp: 200.0,
            boiling_temp: 350.0,
            thermal_conductivity: 0.00001,
            heat_capacity: 1.2,
            density: 0.00007,
        }
    }
}

impl Default for LaserMaterial {
    fn default() -> Self {
        Self::acrylic()
    }
}

/// Laser cutting operation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaserCutOperation {
    /// Laser system
    pub laser: LaserSystem,

    /// Target material
    pub material: LaserMaterial,

    /// Cutting speed [mm/min]
    pub cut_speed: f64,

    /// Material thickness [mm]
    pub thickness: f64,

    /// Focus offset [mm] (0 = surface, negative = inside material)
    pub focus_offset: f64,

    /// Number of passes
    pub num_passes: u32,

    /// Assist gas pressure [bar]
    pub assist_gas_pressure: f64,
}

impl LaserCutOperation {
    /// Create acrylic cutting operation (100W CO2)
    pub fn acrylic_cutting() -> Self {
        LaserCutOperation {
            laser: LaserSystem::co2_100w(),
            material: LaserMaterial::acrylic(),
            cut_speed: 1000.0,     // mm/min
            thickness: 3.0,        // mm
            focus_offset: 0.0,
            num_passes: 1,
            assist_gas_pressure: 0.0,  // No assist gas for acrylic
        }
    }

    /// Create steel cutting operation (fiber laser with assist gas)
    pub fn steel_cutting() -> Self {
        LaserCutOperation {
            laser: LaserSystem::fiber_40w(),
            material: LaserMaterial::steel(),
            cut_speed: 500.0,      // Slower for metal
            thickness: 1.0,        // mm
            focus_offset: 0.0,
            num_passes: 3,         // Multiple passes for metal
            assist_gas_pressure: 3.0,  // Oxygen assist gas
        }
    }

    /// Calculate kerf width (cut width)
    ///
    /// Kerf ≈ beam_diameter + 0.5 × thickness
    pub fn kerf_width(&self) -> f64 {
        let beam_diameter = self.laser.beam_diameter(100.0, 20.0); // Typical lens
        beam_diameter + (self.thickness * 0.1) // Slight taper
    }

    /// Calculate ablation depth per pass [mm]
    ///
    /// Depth ≈ (Power × absorption) / (speed × material_density × heat_capacity)
    pub fn ablation_depth_per_pass(&self) -> f64 {
        let power_absorbed = self.laser.power_watts * self.material.absorption;

        // Depth = absorbed_power / (speed × mass_rate × heat_capacity_per_mass)
        // Approximation: depth ∝ power / speed
        (power_absorbed * 0.0001) / (self.cut_speed.max(10.0) / 1000.0)
    }

    /// Calculate heat-affected zone (HAZ) depth [mm]
    ///
    /// HAZ = sqrt(thermal_diffusivity × time) where time ∝ beam_width / speed
    pub fn haz_depth(&self) -> f64 {
        let beam_diameter = self.laser.beam_diameter(100.0, 20.0);

        // Thermal diffusivity ≈ conductivity / (density × heat_capacity)
        let thermal_diffusivity = self.material.thermal_conductivity
            / (self.material.density * self.material.heat_capacity);

        // Interaction time ∝ beam width / speed
        let interaction_time_ms = (beam_diameter / (self.cut_speed / 60000.0)) / 1000.0;

        // HAZ depth ≈ sqrt(thermal_diffusivity × time)
        (thermal_diffusivity * interaction_time_ms).sqrt().max(0.01)
    }

    /// Calculate cutting time for a given length [minutes]
    pub fn cutting_time(&self, cut_length: f64) -> f64 {
        (cut_length / self.cut_speed) * self.num_passes as f64
    }

    /// Estimate cutting quality (0-100%)
    ///
    /// Quality depends on:
    /// - Multiple passes (higher = better)
    /// - Assist gas (for metals)
    /// - Cutting speed (faster = lower quality)
    pub fn cut_quality_percent(&self) -> f64 {
        let mut quality = 50.0; // Base quality

        // Multiple passes improve quality
        quality += (self.num_passes as f64 - 1.0) * 15.0;

        // Assist gas improves metal cutting
        if self.assist_gas_pressure > 0.5 {
            quality += 20.0;
        }

        // Speed affects quality (slower = better finish)
        if self.cut_speed < 300.0 {
            quality += 20.0;
        } else if self.cut_speed > 1500.0 {
            quality -= 15.0;
        }

        quality.clamp(0.0, 100.0)
    }
}

impl Default for LaserCutOperation {
    fn default() -> Self {
        Self::acrylic_cutting()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_laser_system_creation() {
        let laser = LaserSystem::co2_100w();
        assert_eq!(laser.power_watts, 100.0);
        assert_eq!(laser.wavelength, 10.6);
    }

    #[test]
    fn test_fiber_laser() {
        let laser = LaserSystem::fiber_40w();
        assert_eq!(laser.power_watts, 40.0);
        assert_eq!(laser.laser_type as u8, LaserType::Fiber as u8);
    }

    #[test]
    fn test_laser_material_acrylic() {
        let material = LaserMaterial::acrylic();
        assert_eq!(material.absorption, 0.95);
        assert!(material.melting_temp < material.boiling_temp);
    }

    #[test]
    fn test_laser_material_steel() {
        let material = LaserMaterial::steel();
        assert_eq!(material.absorption, 0.65);
        assert!(material.melting_temp > 1000.0);
    }

    #[test]
    fn test_laser_cut_operation_acrylic() {
        let op = LaserCutOperation::acrylic_cutting();
        assert_eq!(op.thickness, 3.0);
        assert!(op.kerf_width() > 0.0);
    }

    #[test]
    fn test_laser_cut_operation_steel() {
        let op = LaserCutOperation::steel_cutting();
        assert_eq!(op.num_passes, 3);
        assert!(op.assist_gas_pressure > 0.0);
    }

    #[test]
    fn test_kerf_calculation() {
        let op = LaserCutOperation::acrylic_cutting();
        let kerf = op.kerf_width();
        assert!(kerf > 0.0 && kerf < 1.0);
    }

    #[test]
    fn test_ablation_depth() {
        let op = LaserCutOperation::acrylic_cutting();
        let depth = op.ablation_depth_per_pass();
        assert!(depth > 0.0 && depth < 10.0); // Reasonable range
    }

    #[test]
    fn test_haz_depth() {
        let op = LaserCutOperation::acrylic_cutting();
        let haz = op.haz_depth();
        assert!(haz > 0.0 && haz < 5.0);
    }

    #[test]
    fn test_cutting_time() {
        let op = LaserCutOperation::acrylic_cutting();
        let time = op.cutting_time(1000.0); // 1000mm cut

        // 1000mm ÷ 1000mm/min = 1 minute per pass
        assert!(time > 0.5 && time < 2.0);
    }

    #[test]
    fn test_cut_quality() {
        let op = LaserCutOperation::acrylic_cutting();
        let quality = op.cut_quality_percent();
        assert!(quality > 30.0 && quality < 100.0);
    }

    #[test]
    fn test_power_density() {
        let laser = LaserSystem::co2_100w();
        let density = laser.power_density(0.2); // 0.2mm beam
        assert!(density > 0.0);
    }
}
