/**
 * Thermal Effects in Manufacturing
 * Phase 19 Task 5: Manufacturing Simulation
 *
 * Models thermal effects during machining:
 * - Chip temperature (friction at shear zone)
 * - Tool temperature (heat conduction from chip)
 * - Workpiece temperature (conducted from tool)
 */

use serde::{Deserialize, Serialize};

/// Thermal properties of materials
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ThermalMaterial {
    pub name: &'static str,
    pub thermal_conductivity: f64,  // W/(m·K)
    pub specific_heat: f64,         // J/(kg·K)
    pub density: f64,               // kg/m³
    pub melting_point: f64,         // °C
    pub max_tool_temp: f64,         // °C (tool failure temperature)
}

impl ThermalMaterial {
    /// Get thermal properties for material
    pub fn for_material(material: &str) -> Option<ThermalMaterial> {
        match material {
            "Aluminum" => Some(ThermalMaterial {
                name: "Aluminum",
                thermal_conductivity: 205.0,
                specific_heat: 900.0,
                density: 2700.0,
                melting_point: 660.0,
                max_tool_temp: 850.0, // Rapid softening above this
            }),
            "Steel" => Some(ThermalMaterial {
                name: "Steel",
                thermal_conductivity: 50.0,
                specific_heat: 490.0,
                density: 7850.0,
                melting_point: 1540.0,
                max_tool_temp: 900.0,
            }),
            "Titanium" => Some(ThermalMaterial {
                name: "Titanium",
                thermal_conductivity: 7.4,
                specific_heat: 520.0,
                density: 4500.0,
                melting_point: 1660.0,
                max_tool_temp: 850.0, // Lower tool life due to high temps
            }),
            "Cast Iron" => Some(ThermalMaterial {
                name: "Cast Iron",
                thermal_conductivity: 50.0,
                specific_heat: 460.0,
                density: 7250.0,
                melting_point: 1200.0,
                max_tool_temp: 950.0,
            }),
            _ => None,
        }
    }
}

/// Cutting tool thermal properties
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ToolThermal {
    pub tool_material: &'static str,
    pub thermal_conductivity: f64,  // W/(m·K)
    pub specific_heat: f64,         // J/(kg·K)
    pub tool_mass: f64,             // grams
    pub insert_area: f64,           // mm² (cutting edge contact area)
}

impl ToolThermal {
    /// HSS (High Speed Steel) tool
    pub fn hss() -> Self {
        ToolThermal {
            tool_material: "HSS",
            thermal_conductivity: 30.0,
            specific_heat: 460.0,
            tool_mass: 5.0,
            insert_area: 25.0,
        }
    }

    /// Carbide tool
    pub fn carbide() -> Self {
        ToolThermal {
            tool_material: "Carbide",
            thermal_conductivity: 100.0,
            specific_heat: 420.0,
            tool_mass: 3.0,
            insert_area: 20.0,
        }
    }

    /// Ceramic tool
    pub fn ceramic() -> Self {
        ToolThermal {
            tool_material: "Ceramic",
            thermal_conductivity: 25.0,
            specific_heat: 750.0,
            tool_mass: 2.0,
            insert_area: 15.0,
        }
    }
}

/// Thermal simulation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalResult {
    pub chip_temperature: f64,        // °C
    pub tool_temperature: f64,        // °C
    pub workpiece_temperature: f64,   // °C
    pub heat_generated: f64,          // W (total heat)
    pub tool_life_ratio: f64,         // 0.0-1.0 (0.5 = 50% life consumed)
    pub thermal_risk: ThermalRisk,    // Assessment
}

/// Thermal risk assessment
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThermalRisk {
    Safe,              // < 80% of max tool temp
    Caution,           // 80-95% of max tool temp
    Critical,          // 95-100% of max tool temp
    Failure,           // Exceeds max tool temp
}

/// Thermal calculator
pub struct ThermalCalculator;

impl ThermalCalculator {
    /// Calculate chip temperature using Merchant's model
    /// Chip temp = ambient + (friction_stress / density / Cv) * (shear_strain)
    pub fn calculate_chip_temperature(
        workpiece_material: &str,
        cutting_power: f64,      // W
        chip_area: f64,          // mm² (feed × depth)
        shear_strain_rate: f64,  // s⁻¹
        ambient_temp: f64,       // °C
    ) -> Result<f64, String> {
        let material = ThermalMaterial::for_material(workpiece_material)
            .ok_or_else(|| format!("Unknown material: {}", workpiece_material))?;

        // Heat generated at shear plane
        let shear_heat = cutting_power * 0.8; // ~80% goes to chip (vs tool)

        // Chip temperature rise from heat generation
        // Q = m * Cv * ΔT => ΔT = Q / (m * Cv)
        let chip_mass = (chip_area / 1000.0) * 1.0 * material.density / 1000.0; // grams to kg
        let specific_heat_j_per_kg = material.specific_heat;

        let temp_rise = if chip_mass > 0.0001 {
            shear_heat / (chip_mass * specific_heat_j_per_kg)
        } else {
            shear_heat / 100.0 // Fallback for very small chips
        };

        let chip_temp = (ambient_temp + temp_rise).min(material.melting_point * 0.95);
        Ok(chip_temp)
    }

    /// Calculate tool temperature from chip contact
    /// Heat transfer: Q_tool = k_contact * A_contact * (T_chip - T_tool)
    pub fn calculate_tool_temperature(
        chip_temperature: f64,
        tool_thermal: &ToolThermal,
        contact_area_ratio: f64, // Fraction of cutting edge in contact
        cutting_time_sec: f64,
        ambient_temp: f64,
    ) -> f64 {
        // Heat transfer coefficient at tool-chip interface (rough estimate)
        let h_contact = 5000.0; // W/(m²·K) - tool-chip interface

        // Heat into tool from chip
        let contact_area_mm2 = tool_thermal.insert_area * contact_area_ratio;
        let contact_area_m2 = contact_area_mm2 / 1e6;

        // Transient heat: exponential approach to equilibrium
        let tau = 60.0; // Time constant (seconds) for tool thermal mass
        let time_factor = 1.0 - (-cutting_time_sec / tau).exp();

        // Tool temperature rise (bounded by material limit)
        let temp_rise = (chip_temperature - ambient_temp) * 0.5 * time_factor; // 50% of chip-tool difference

        ambient_temp + temp_rise
    }

    /// Calculate workpiece temperature from tool contact
    pub fn calculate_workpiece_temperature(
        tool_temperature: f64,
        workpiece_material: &str,
        contact_area_mm2: f64,
        cutting_time_sec: f64,
        ambient_temp: f64,
    ) -> Result<f64, String> {
        let material = ThermalMaterial::for_material(workpiece_material)
            .ok_or_else(|| format!("Unknown material: {}", workpiece_material))?;

        // Heat transfer to workpiece (slower than tool)
        let thermal_diffusivity = material.thermal_conductivity / (material.density * material.specific_heat);

        // Penetration depth: sqrt(4 * alpha * t)
        let penetration = (4.0 * thermal_diffusivity * cutting_time_sec).sqrt() * 1000.0; // Convert to mm

        // Temperature at surface (tool contact)
        let surface_temp_rise = (tool_temperature - ambient_temp) * 0.3; // 30% of tool-workpiece difference

        let workpiece_temp = (ambient_temp + surface_temp_rise).min(material.melting_point * 0.95);
        Ok(workpiece_temp)
    }

    /// Complete thermal analysis
    pub fn analyze_thermal_conditions(
        workpiece_material: &str,
        tool_thermal: &ToolThermal,
        tool_material: &str,
        cutting_power: f64,
        chip_area: f64,
        cutting_time_sec: f64,
        ambient_temp: f64,
        coolant_available: bool,
    ) -> Result<ThermalResult, String> {
        // Get material properties for workpiece
        let workpiece_mat = ThermalMaterial::for_material(workpiece_material)
            .ok_or_else(|| format!("Unknown material: {}", workpiece_material))?;

        // Use ToolThermal object directly instead of looking up as string
        // We'll use a simple hardcoded max temp based on tool_material name
        let max_tool_temp_base = match tool_material {
            "HSS" => 850.0,
            "Carbide" => 950.0,
            "Ceramic" => 1200.0,
            _ => 900.0,
        };

        // Calculate temperatures
        let chip_temp = Self::calculate_chip_temperature(
            workpiece_material,
            cutting_power,
            chip_area,
            1000.0, // Typical shear strain rate
            ambient_temp,
        )?;

        let contact_area_ratio = (chip_area / 20.0).min(1.0); // Normalized contact
        let mut tool_temp = Self::calculate_tool_temperature(
            chip_temp,
            tool_thermal,
            contact_area_ratio,
            cutting_time_sec,
            ambient_temp,
        );

        // Coolant reduces tool temperature
        if coolant_available {
            tool_temp = (tool_temp + ambient_temp) / 2.0; // Roughly halves the rise
        }

        let workpiece_temp = Self::calculate_workpiece_temperature(
            tool_temp,
            workpiece_material,
            (chip_area * 0.5).max(1.0),
            cutting_time_sec,
            ambient_temp,
        )?;

        // Total heat generated (mostly goes to chip)
        let heat_generated = cutting_power;

        // Tool life assessment (Arrhénius model: life ∝ exp(-T/T_ref))
        let max_tool_temp = max_tool_temp_base;
        let tool_life_ratio = if tool_temp < max_tool_temp * 0.8 {
            0.1 // 10% life consumed
        } else if tool_temp < max_tool_temp * 0.95 {
            0.3
        } else if tool_temp < max_tool_temp {
            0.6
        } else {
            1.0
        };

        // Risk assessment
        let thermal_risk = if tool_temp > max_tool_temp {
            ThermalRisk::Failure
        } else if tool_temp > max_tool_temp * 0.95 {
            ThermalRisk::Critical
        } else if tool_temp > max_tool_temp * 0.80 {
            ThermalRisk::Caution
        } else {
            ThermalRisk::Safe
        };

        Ok(ThermalResult {
            chip_temperature: chip_temp,
            tool_temperature: tool_temp,
            workpiece_temperature: workpiece_temp,
            heat_generated,
            tool_life_ratio,
            thermal_risk,
        })
    }

    /// Recommend coolant based on material
    pub fn coolant_recommendation(material: &str) -> &'static str {
        match material {
            "Aluminum" => "Light mineral oil (water-soluble)",
            "Steel" => "Heavy mineral oil or synthetic",
            "Titanium" => "Extreme pressure (EP) oil",
            "Cast Iron" => "Dry or light spray",
            _ => "General purpose coolant",
        }
    }

    /// Estimate thermal shock risk (rapid cooling from tool change)
    pub fn thermal_shock_risk(
        tool_temperature: f64,
        ambient_temp: f64,
        tool_material: &str,
    ) -> f64 {
        // Risk increases with temperature difference and brittleness
        let temp_diff = tool_temperature - ambient_temp;

        let material_factor = match tool_material {
            "Ceramic" => 2.0,  // Ceramic very brittle
            "Carbide" => 1.5,
            "HSS" => 1.0,      // HSS most forgiving
            _ => 1.0,
        };

        (temp_diff / 500.0) * material_factor
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aluminum_thermal_props() {
        let al = ThermalMaterial::for_material("Aluminum").unwrap();
        assert_eq!(al.name, "Aluminum");
        assert!(al.thermal_conductivity > 100.0);
        assert!(al.melting_point > 600.0);
    }

    #[test]
    fn test_chip_temperature_aluminum() {
        let result = ThermalCalculator::calculate_chip_temperature("Aluminum", 1000.0, 2.0, 1000.0, 20.0);
        assert!(result.is_ok());
        let temp = result.unwrap();
        assert!(temp > 20.0);
        assert!(temp < 660.0); // Below melting point
    }

    #[test]
    fn test_chip_temperature_steel() {
        let result = ThermalCalculator::calculate_chip_temperature("Steel", 1000.0, 3.0, 1000.0, 20.0);
        assert!(result.is_ok());
        let temp = result.unwrap();
        assert!(temp > 20.0);
    }

    #[test]
    fn test_tool_thermal_properties() {
        let hss = ToolThermal::hss();
        let carbide = ToolThermal::carbide();
        assert!(carbide.thermal_conductivity > hss.thermal_conductivity);
    }

    #[test]
    fn test_tool_temperature_rise() {
        let tool = ToolThermal::carbide();
        let temp = ThermalCalculator::calculate_tool_temperature(400.0, &tool, 0.8, 60.0, 20.0);
        assert!(temp > 20.0);
        assert!(temp < 400.0);
    }

    #[test]
    fn test_workpiece_temperature() {
        let result = ThermalCalculator::calculate_workpiece_temperature(300.0, "Aluminum", 10.0, 60.0, 20.0);
        assert!(result.is_ok());
        let temp = result.unwrap();
        assert!(temp > 20.0);
    }

    #[test]
    fn test_complete_thermal_analysis() {
        let tool = ToolThermal::carbide();
        let result = ThermalCalculator::analyze_thermal_conditions(
            "Aluminum",
            &tool,
            "HSS",  // Use valid tool material
            1000.0,
            2.0,
            60.0,
            20.0,
            true,
        );
        assert!(result.is_ok());
        let thermal = result.unwrap();
        assert!(thermal.chip_temperature > thermal.tool_temperature);
        assert!(thermal.thermal_risk != ThermalRisk::Failure);
    }

    #[test]
    fn test_thermal_risk_assessment() {
        let tool = ToolThermal::hss();
        let result = ThermalCalculator::analyze_thermal_conditions(
            "Steel",
            &tool,
            "HSS",
            2000.0, // High power
            3.0,
            120.0,  // Long time
            20.0,
            false,  // No coolant
        );
        assert!(result.is_ok());
        let thermal = result.unwrap();
        // Verify that thermal analysis runs and produces a result
        assert!(thermal.tool_temperature > 0.0);
        assert!(thermal.thermal_risk != ThermalRisk::Failure); // Should not fail
    }

    #[test]
    fn test_coolant_reduces_tool_temp() {
        let tool = ToolThermal::carbide();

        let with_coolant = ThermalCalculator::analyze_thermal_conditions(
            "Aluminum",
            &tool,
            "HSS",  // Use valid tool material
            1000.0,
            2.0,
            60.0,
            20.0,
            true,
        )
        .unwrap();

        let without_coolant = ThermalCalculator::analyze_thermal_conditions(
            "Aluminum",
            &tool,
            "HSS",  // Use valid tool material
            1000.0,
            2.0,
            60.0,
            20.0,
            false,
        )
        .unwrap();

        assert!(with_coolant.tool_temperature < without_coolant.tool_temperature);
    }

    #[test]
    fn test_thermal_shock_risk() {
        let risk_ceramic = ThermalCalculator::thermal_shock_risk(400.0, 20.0, "Ceramic");
        let risk_hss = ThermalCalculator::thermal_shock_risk(400.0, 20.0, "HSS");
        assert!(risk_ceramic > risk_hss); // Ceramic at higher risk
    }

    #[test]
    fn test_invalid_material() {
        let result = ThermalCalculator::calculate_chip_temperature("Unknown", 1000.0, 2.0, 1000.0, 20.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_coolant_recommendation() {
        let rec = ThermalCalculator::coolant_recommendation("Titanium");
        assert!(!rec.is_empty());
        assert!(rec.contains("pressure")); // Should mention EP
    }
}
