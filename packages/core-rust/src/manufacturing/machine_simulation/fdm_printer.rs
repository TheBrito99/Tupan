//! FDM 3D Printer Simulation
//!
//! Models fused deposition modeling (FDM) with temperature effects,
//! layer adhesion, warping prediction, and extrusion dynamics.

use serde::{Deserialize, Serialize};

/// Filament material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilamentMaterial {
    /// Material name (PLA, ABS, PETG, TPU)
    pub name: String,

    /// Glass transition temperature [°C]
    pub tg_temperature: f64,

    /// Melting temperature [°C]
    pub melting_temp: f64,

    /// Recommended nozzle temperature [°C]
    pub nozzle_temp: f64,

    /// Recommended bed temperature [°C]
    pub bed_temp: f64,

    /// Material density [g/cm³]
    pub density: f64,

    /// Coefficient of thermal expansion [×10⁻⁵/°C]
    pub thermal_expansion: f64,

    /// Shrinkage after cooling [%]
    pub shrinkage_percent: f64,

    /// Support material compatibility (can supports be removed?)
    pub support_soluble: bool,
}

impl FilamentMaterial {
    /// PLA - Easy to print, biodegradable
    pub fn pla() -> Self {
        FilamentMaterial {
            name: "PLA".to_string(),
            tg_temperature: 65.0,
            melting_temp: 170.0,
            nozzle_temp: 200.0,
            bed_temp: 20.0,  // Room temperature okay
            density: 1.25,
            thermal_expansion: 80.0,
            shrinkage_percent: 0.5,
            support_soluble: false,
        }
    }

    /// ABS - Strong, engineering plastic
    pub fn abs() -> Self {
        FilamentMaterial {
            name: "ABS".to_string(),
            tg_temperature: 105.0,
            melting_temp: 220.0,
            nozzle_temp: 240.0,
            bed_temp: 80.0,  // Heated bed required
            density: 1.05,
            thermal_expansion: 100.0,
            shrinkage_percent: 2.5,  // Prone to warping
            support_soluble: false,
        }
    }

    /// PETG - Balance of strength and ease
    pub fn petg() -> Self {
        FilamentMaterial {
            name: "PETG".to_string(),
            tg_temperature: 88.0,
            melting_temp: 200.0,
            nozzle_temp: 230.0,
            bed_temp: 50.0,
            density: 1.30,
            thermal_expansion: 70.0,
            shrinkage_percent: 1.2,
            support_soluble: false,
        }
    }

    /// TPU - Flexible material
    pub fn tpu() -> Self {
        FilamentMaterial {
            name: "TPU".to_string(),
            tg_temperature: -30.0,
            melting_temp: 180.0,
            nozzle_temp: 200.0,
            bed_temp: 40.0,
            density: 1.12,
            thermal_expansion: 150.0,
            shrinkage_percent: 1.0,
            support_soluble: false,
        }
    }
}

impl Default for FilamentMaterial {
    fn default() -> Self {
        Self::pla()
    }
}

/// 3D printer nozzle configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NozzleConfig {
    /// Nozzle diameter [mm]
    pub diameter: f64,

    /// Nozzle temperature [°C]
    pub temperature: f64,

    /// Nozzle material (brass, ruby, hardened steel)
    pub material: NozzleMaterial,

    /// Current extrusion rate [mm³/s]
    pub extrusion_rate: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum NozzleMaterial {
    Brass,
    Ruby,
    HardenedSteel,
}

impl NozzleConfig {
    /// Standard 0.4mm brass nozzle
    pub fn standard() -> Self {
        NozzleConfig {
            diameter: 0.4,
            temperature: 200.0,
            material: NozzleMaterial::Brass,
            extrusion_rate: 0.0,
        }
    }

    /// 0.8mm coarse nozzle for faster printing
    pub fn coarse() -> Self {
        NozzleConfig {
            diameter: 0.8,
            temperature: 200.0,
            material: NozzleMaterial::Brass,
            extrusion_rate: 0.0,
        }
    }

    /// 0.2mm fine detail nozzle (ruby for durability)
    pub fn fine() -> Self {
        NozzleConfig {
            diameter: 0.2,
            temperature: 200.0,
            material: NozzleMaterial::Ruby,
            extrusion_rate: 0.0,
        }
    }

    /// Calculate extrusion line width [mm]
    ///
    /// Line width ≈ nozzle_diameter × layer_height / ideal_height
    pub fn line_width(&self, layer_height: f64) -> f64 {
        let ideal_height = self.diameter * 0.75; // 75% of nozzle diameter
        if ideal_height > 0.001 {
            self.diameter * layer_height / ideal_height
        } else {
            self.diameter
        }
    }
}

impl Default for NozzleConfig {
    fn default() -> Self {
        Self::standard()
    }
}

/// Build platform (bed) adhesion model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildPlatform {
    /// Platform temperature [°C]
    pub temperature: f64,

    /// Platform material (glass, aluminum, BuildTak, etc.)
    pub surface: PlatformSurface,

    /// Adhesion strength [0-100%] with material
    pub adhesion_strength: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PlatformSurface {
    Glass,
    Aluminum,
    BuildTak,
    PEI,
    Textured,
}

impl BuildPlatform {
    /// Glass bed for PLA
    pub fn glass_pla() -> Self {
        BuildPlatform {
            temperature: 20.0,
            surface: PlatformSurface::Glass,
            adhesion_strength: 70.0,
        }
    }

    /// Aluminum bed for ABS (heated)
    pub fn aluminum_abs() -> Self {
        BuildPlatform {
            temperature: 80.0,
            surface: PlatformSurface::Aluminum,
            adhesion_strength: 85.0,
        }
    }

    /// PEI surface (best all-around)
    pub fn pei_universal() -> Self {
        BuildPlatform {
            temperature: 50.0,
            surface: PlatformSurface::PEI,
            adhesion_strength: 90.0,
        }
    }
}

impl Default for BuildPlatform {
    fn default() -> Self {
        Self::glass_pla()
    }
}

/// Layer in print
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintLayer {
    /// Layer number (0 = first layer)
    pub layer_number: u32,

    /// Layer height [mm]
    pub height: f64,

    /// Average temperature during extrusion [°C]
    pub extrusion_temp: f64,

    /// Time to print layer [seconds]
    pub print_time: f64,

    /// Adhesion to previous layer [0-100%]
    pub adhesion_percent: f64,

    /// Predicted warping [mm] from edges
    pub warping_amount: f64,
}

impl PrintLayer {
    /// Create first layer (critical for adhesion)
    pub fn first_layer(height: f64, nozzle_temp: f64, bed_temp: f64) -> Self {
        PrintLayer {
            layer_number: 0,
            height,
            extrusion_temp: nozzle_temp,
            print_time: 0.0,
            // First layer adhesion depends heavily on bed temperature
            adhesion_percent: (bed_temp / 100.0 * 100.0).clamp(50.0, 100.0),
            warping_amount: 0.0,
        }
    }

    /// Create normal layer
    pub fn normal_layer(layer_num: u32, height: f64, nozzle_temp: f64) -> Self {
        PrintLayer {
            layer_number: layer_num,
            height,
            extrusion_temp: nozzle_temp,
            print_time: 0.0,
            // Layers on top of other layers have excellent adhesion
            adhesion_percent: 95.0,
            warping_amount: 0.0,
        }
    }
}

impl Default for PrintLayer {
    fn default() -> Self {
        Self::normal_layer(0, 0.2, 200.0)
    }
}

/// FDM printer simulator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FDMPrinter {
    /// Filament material
    pub material: FilamentMaterial,

    /// Nozzle configuration
    pub nozzle: NozzleConfig,

    /// Build platform
    pub platform: BuildPlatform,

    /// Total layers to print
    pub total_layers: u32,

    /// Current layer
    pub current_layer: u32,

    /// Total print time [hours]
    pub total_print_time: f64,

    /// Filament used [grams]
    pub filament_used: f64,

    /// Maximum warping detected [mm]
    pub max_warping: f64,

    /// Print success probability [0-100%]
    pub success_probability: f64,
}

impl FDMPrinter {
    /// Create new printer with PLA on glass
    pub fn new() -> Self {
        FDMPrinter {
            material: FilamentMaterial::pla(),
            nozzle: NozzleConfig::standard(),
            platform: BuildPlatform::glass_pla(),
            total_layers: 100,
            current_layer: 0,
            total_print_time: 0.0,
            filament_used: 0.0,
            max_warping: 0.0,
            success_probability: 100.0,
        }
    }

    /// Simulate printing one layer
    ///
    /// Returns layer with updated temperatures and adhesion
    pub fn print_layer(
        &mut self,
        layer_height: f64,
        perimeter_length: f64,
        infill_area: f64,
    ) -> PrintLayer {
        let mut layer = if self.current_layer == 0 {
            PrintLayer::first_layer(
                layer_height,
                self.nozzle.temperature,
                self.platform.temperature,
            )
        } else {
            PrintLayer::normal_layer(
                self.current_layer,
                layer_height,
                self.nozzle.temperature,
            )
        };

        // Calculate extrusion volume [mm³]
        let line_width = self.nozzle.line_width(layer_height);
        let perimeter_volume = perimeter_length * line_width * layer_height;
        let infill_volume = infill_area * layer_height;
        let total_volume = perimeter_volume + infill_volume;

        // Print time [minutes] = volume / extrusion_rate
        let extrusion_rate_mm3_s = self.nozzle.diameter * 3.0; // Rough estimate
        layer.print_time = (total_volume / extrusion_rate_mm3_s) / 60.0;

        // Filament mass [g] = volume × density
        let volume_cm3 = total_volume / 1000.0;
        let mass_g = volume_cm3 * self.material.density;
        self.filament_used += mass_g;

        // Warping prediction [mm]
        // Worst for high shrinkage (ABS) on cold beds
        let shrink_factor = self.material.shrinkage_percent / 100.0;
        let bed_temp_factor = if self.platform.temperature < 30.0 {
            1.5  // Cold bed → more warping
        } else if self.platform.temperature > 70.0 {
            0.5  // Hot bed → less warping
        } else {
            1.0
        };

        layer.warping_amount = shrink_factor * self.current_layer as f64 * 0.01 * bed_temp_factor;
        self.max_warping = self.max_warping.max(layer.warping_amount);

        // Update adhesion based on warping
        if layer.warping_amount > 0.5 {
            layer.adhesion_percent = (layer.adhesion_percent - layer.warping_amount * 50.0)
                .clamp(0.0, 100.0);
        }

        self.total_print_time += layer.print_time;
        self.current_layer += 1;

        // Failure risk increases with warping and failed adhesion
        if layer.adhesion_percent < 70.0 || self.max_warping > 2.0 {
            self.success_probability = (self.success_probability - 5.0).max(0.0);
        }

        layer
    }

    /// Estimate total print time [hours]
    ///
    /// Based on layer count and average layer height
    pub fn estimate_print_time(&self, avg_layer_height: f64) -> f64 {
        let avg_extrusion_time_min = 2.0; // Average 2 minutes per layer
        (self.total_layers as f64 * avg_extrusion_time_min) / 60.0
    }

    /// Estimate filament weight [grams]
    ///
    /// For a part of given volume
    pub fn estimate_filament(model_volume_cm3: f64, infill_percent: f64) -> f64 {
        let effective_volume = model_volume_cm3 * (infill_percent / 100.0);
        let pla_density = 1.25; // g/cm³
        effective_volume * pla_density
    }
}

impl Default for FDMPrinter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filament_pla() {
        let material = FilamentMaterial::pla();
        assert_eq!(material.nozzle_temp, 200.0);
        assert_eq!(material.bed_temp, 20.0);
    }

    #[test]
    fn test_filament_abs() {
        let material = FilamentMaterial::abs();
        let pla = FilamentMaterial::pla();
        assert!(material.shrinkage_percent > pla.shrinkage_percent);
    }

    #[test]
    fn test_nozzle_standard() {
        let nozzle = NozzleConfig::standard();
        assert_eq!(nozzle.diameter, 0.4);
    }

    #[test]
    fn test_nozzle_line_width() {
        let nozzle = NozzleConfig::standard();
        let width = nozzle.line_width(0.2);
        assert!(width > 0.0 && width < 1.0);
    }

    #[test]
    fn test_build_platform_glass() {
        let platform = BuildPlatform::glass_pla();
        assert_eq!(platform.temperature, 20.0);
        assert!(platform.adhesion_strength > 50.0);
    }

    #[test]
    fn test_build_platform_pei() {
        let platform = BuildPlatform::pei_universal();
        assert_eq!(platform.adhesion_strength, 90.0);
    }

    #[test]
    fn test_print_layer_first() {
        let layer = PrintLayer::first_layer(0.2, 200.0, 60.0);
        assert_eq!(layer.layer_number, 0);
        assert!(layer.adhesion_percent > 50.0);
    }

    #[test]
    fn test_print_layer_normal() {
        let layer = PrintLayer::normal_layer(5, 0.2, 200.0);
        assert_eq!(layer.layer_number, 5);
        assert_eq!(layer.adhesion_percent, 95.0);
    }

    #[test]
    fn test_fdm_printer_creation() {
        let printer = FDMPrinter::new();
        assert_eq!(printer.current_layer, 0);
        assert_eq!(printer.success_probability, 100.0);
    }

    #[test]
    fn test_print_layer_simulation() {
        let mut printer = FDMPrinter::new();
        let layer = printer.print_layer(0.2, 100.0, 50.0); // 100mm perimeter, 50mm² infill

        assert!(layer.print_time > 0.0);
        assert!(printer.filament_used > 0.0);
        assert_eq!(printer.current_layer, 1);
    }

    #[test]
    fn test_warping_prediction() {
        let mut printer_hot = FDMPrinter::new();
        printer_hot.platform.temperature = 60.0;

        let mut printer_cold = FDMPrinter::new();
        printer_cold.platform.temperature = 20.0;

        let layer_hot = printer_hot.print_layer(0.2, 100.0, 50.0);
        let layer_cold = printer_cold.print_layer(0.2, 100.0, 50.0);

        // Cold bed should have more warping
        assert!(layer_cold.warping_amount >= layer_hot.warping_amount);
    }

    #[test]
    fn test_abs_warping() {
        let mut printer = FDMPrinter::new();
        printer.material = FilamentMaterial::abs();
        printer.platform.temperature = 20.0;

        // Print several layers
        for _ in 0..10 {
            printer.print_layer(0.2, 100.0, 50.0);
        }

        // ABS should warp (even if small amount due to low temp)
        assert!(printer.max_warping > 0.0);
        // Should detect it's worse than PLA due to higher shrinkage
        assert!(printer.success_probability < 100.0);
    }

    #[test]
    fn test_estimate_print_time() {
        let printer = FDMPrinter::new();
        let time = printer.estimate_print_time(0.2);
        assert!(time > 0.0);
    }

    #[test]
    fn test_estimate_filament() {
        let weight = FDMPrinter::estimate_filament(10.0, 100.0); // 10cm³ part, 100% fill

        // 10cm³ × 1.25 g/cm³ = 12.5g
        assert!(weight > 10.0 && weight < 15.0);
    }
}
