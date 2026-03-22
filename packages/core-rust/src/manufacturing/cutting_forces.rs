/**
 * Cutting Forces - Cutting Force Prediction
 * Phase 19 Task 5: Manufacturing Simulation
 *
 * Calculates cutting forces based on:
 * - Material properties (hardness, ductility)
 * - Cutting parameters (speed, feed, depth)
 * - Tool geometry (flute count, rake angle)
 */

use serde::{Deserialize, Serialize};

/// Cutting force model
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CuttingForceModel {
    Linear,           // Simple linear: F = Kf * A
    Orthogonal,       // Orthogonal cutting model
    Kienzle,          // Kienzle equation: Pc = Ks * A * v^(-m)
    Merchant,         // Merchant model with friction
}

/// Cutting force results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingForceResult {
    pub tangential_force: f64,    // Ft (N) - primary cutting force
    pub feed_force: f64,          // Ff (N) - feed direction force
    pub radial_force: f64,        // Fr (N) - radial force
    pub total_force: f64,         // Total resultant force
    pub cutting_power: f64,       // Pc (W) - power consumed
    pub force_validity: f64,      // 0.0-1.0 confidence score
}

/// Material-specific cutting force coefficients
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct MaterialCuttingCoefficients {
    pub material: &'static str,
    pub ks: f64,                  // Specific cutting force (N/mm²)
    pub ks0: f64,                 // Edge force component
    pub feed_force_ratio: f64,    // Ff / Ft ratio (typical: 0.2-0.4)
    pub radial_force_ratio: f64,  // Fr / Ft ratio (typical: 0.3-0.6)
    pub cutting_speed_exponent: f64, // Power law exponent (-0.2 to -0.4)
    pub feed_exponent: f64,       // Feed exponent (0.7-1.0)
    pub depth_exponent: f64,      // Depth exponent (0.85-1.0)
}

impl MaterialCuttingCoefficients {
    /// Get cutting coefficients for material
    pub fn for_material(material: &str) -> Option<MaterialCuttingCoefficients> {
        match material {
            "Aluminum" => Some(MaterialCuttingCoefficients {
                material: "Aluminum",
                ks: 600.0,
                ks0: 20.0,
                feed_force_ratio: 0.25,
                radial_force_ratio: 0.35,
                cutting_speed_exponent: -0.25,
                feed_exponent: 0.75,
                depth_exponent: 0.90,
            }),
            "Steel" => Some(MaterialCuttingCoefficients {
                material: "Steel",
                ks: 1800.0,
                ks0: 80.0,
                feed_force_ratio: 0.35,
                radial_force_ratio: 0.50,
                cutting_speed_exponent: -0.30,
                feed_exponent: 0.85,
                depth_exponent: 0.95,
            }),
            "Titanium" => Some(MaterialCuttingCoefficients {
                material: "Titanium",
                ks: 2200.0,
                ks0: 100.0,
                feed_force_ratio: 0.40,
                radial_force_ratio: 0.55,
                cutting_speed_exponent: -0.35,
                feed_exponent: 0.80,
                depth_exponent: 0.92,
            }),
            "Cast Iron" => Some(MaterialCuttingCoefficients {
                material: "Cast Iron",
                ks: 1400.0,
                ks0: 60.0,
                feed_force_ratio: 0.30,
                radial_force_ratio: 0.45,
                cutting_speed_exponent: -0.28,
                feed_exponent: 0.78,
                depth_exponent: 0.88,
            }),
            "Stainless Steel" => Some(MaterialCuttingCoefficients {
                material: "Stainless Steel",
                ks: 2100.0,
                ks0: 90.0,
                feed_force_ratio: 0.38,
                radial_force_ratio: 0.52,
                cutting_speed_exponent: -0.32,
                feed_exponent: 0.82,
                depth_exponent: 0.93,
            }),
            _ => None,
        }
    }
}

/// Cutting force calculator
pub struct CuttingForceCalculator;

impl CuttingForceCalculator {
    /// Calculate cutting forces using Kienzle equation
    /// F = Ks * A * v^m where A = feed * depth
    pub fn calculate_kienzle(
        material: &str,
        feed_mm_per_tooth: f64,  // mm/tooth
        depth_of_cut: f64,        // mm
        cutting_speed: f64,       // m/min
        flute_count: u32,         // number of cutting edges
    ) -> Result<CuttingForceResult, String> {
        let coeff = MaterialCuttingCoefficients::for_material(material)
            .ok_or_else(|| format!("Unknown material: {}", material))?;

        // Chip load area
        let chip_area = feed_mm_per_tooth * depth_of_cut; // mm²

        // Edge force component (edge engagement area)
        let edge_force_area = feed_mm_per_tooth;

        // Apply cutting speed factor (Kienzle)
        let speed_factor = cutting_speed.max(1.0).powf(coeff.cutting_speed_exponent);

        // Tangential force calculation
        let specific_force = coeff.ks * speed_factor; // N/mm²
        let tangential_force = specific_force * chip_area + coeff.ks0 * edge_force_area;

        // Feed and radial forces
        let feed_force = tangential_force * coeff.feed_force_ratio;
        let radial_force = tangential_force * coeff.radial_force_ratio;

        // Total force
        let total_force = (tangential_force.powi(2) + feed_force.powi(2) + radial_force.powi(2)).sqrt();

        // Cutting power (Pc = Ft * v)
        let cutting_power = tangential_force * cutting_speed / 1000.0; // W

        // Validity check (confidence)
        let validity = if tangential_force > 0.0 && tangential_force < 50000.0 {
            0.95
        } else if tangential_force > 0.0 {
            0.70
        } else {
            0.0
        };

        Ok(CuttingForceResult {
            tangential_force,
            feed_force,
            radial_force,
            total_force,
            cutting_power,
            force_validity: validity,
        })
    }

    /// Calculate with feed per tooth adjustments
    pub fn calculate_with_adjustments(
        material: &str,
        feed_mm_min: f64,        // mm/min feedrate
        depth_of_cut: f64,
        cutting_speed: f64,
        flute_count: u32,
    ) -> Result<CuttingForceResult, String> {
        let feed_per_tooth = if flute_count > 0 {
            feed_mm_min / (flute_count as f64)
        } else {
            return Err("Flute count must be > 0".to_string());
        };

        Self::calculate_kienzle(
            material,
            feed_per_tooth.max(0.01),
            depth_of_cut.max(0.1),
            cutting_speed.max(1.0),
            flute_count,
        )
    }

    /// Estimate force reduction with coolant
    pub fn coolant_reduction_factor(coolant_type: &str) -> f64 {
        match coolant_type {
            "flood" => 0.85,          // 15% reduction
            "mist" => 0.90,           // 10% reduction
            "through_spindle" => 0.75, // 25% reduction
            "air" => 1.0,              // No reduction
            _ => 1.0,
        }
    }

    /// Predict tool wear based on cutting force
    pub fn predict_flank_wear(
        tangential_force: f64,
        cutting_distance: f64,      // mm
        tool_material: &str,
        coolant_available: bool,
    ) -> f64 {
        // Wear rate depends on force and sliding distance
        let base_wear_rate = 0.00001; // mm/mm at baseline
        let force_factor = (tangential_force / 1000.0).max(0.1); // Normalize by 1000N
        let coolant_factor = if coolant_available { 0.7 } else { 1.0 };
        let material_factor = match tool_material {
            "HSS" => 1.0,
            "Carbide" => 0.3,
            "Ceramic" => 0.2,
            _ => 1.0,
        };

        base_wear_rate * force_factor * cutting_distance * coolant_factor * material_factor
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aluminum_cutting_force() {
        let result = CuttingForceCalculator::calculate_kienzle("Aluminum", 0.1, 2.0, 200.0, 4);
        assert!(result.is_ok());
        let force = result.unwrap();
        assert!(force.tangential_force > 0.0);
        assert!(force.cutting_power > 0.0);
    }

    #[test]
    fn test_steel_cutting_force() {
        let result = CuttingForceCalculator::calculate_kienzle("Steel", 0.15, 3.0, 150.0, 3);
        assert!(result.is_ok());
        let force = result.unwrap();
        assert!(force.tangential_force > 100.0); // Steel generates significant force
    }

    #[test]
    fn test_force_increases_with_depth() {
        let shallow = CuttingForceCalculator::calculate_kienzle("Aluminum", 0.1, 1.0, 200.0, 4).unwrap();
        let deep = CuttingForceCalculator::calculate_kienzle("Aluminum", 0.1, 3.0, 200.0, 4).unwrap();
        assert!(deep.tangential_force > shallow.tangential_force);
    }

    #[test]
    fn test_force_decreases_with_speed() {
        let slow = CuttingForceCalculator::calculate_kienzle("Aluminum", 0.1, 2.0, 100.0, 4).unwrap();
        let fast = CuttingForceCalculator::calculate_kienzle("Aluminum", 0.1, 2.0, 300.0, 4).unwrap();
        // Higher speed reduces force (material softens)
        assert!(slow.tangential_force > fast.tangential_force);
    }

    #[test]
    fn test_feed_force_ratio() {
        let result = CuttingForceCalculator::calculate_kienzle("Aluminum", 0.1, 2.0, 200.0, 4).unwrap();
        let ratio = result.feed_force / result.tangential_force;
        assert!(ratio > 0.2 && ratio < 0.4);
    }

    #[test]
    fn test_invalid_material() {
        let result = CuttingForceCalculator::calculate_kienzle("Unknown", 0.1, 2.0, 200.0, 4);
        assert!(result.is_err());
    }

    #[test]
    fn test_coolant_reduction() {
        let flood = CuttingForceCalculator::coolant_reduction_factor("flood");
        let air = CuttingForceCalculator::coolant_reduction_factor("air");
        assert!(flood < air);
    }

    #[test]
    fn test_flank_wear_prediction() {
        let wear = CuttingForceCalculator::predict_flank_wear(1000.0, 1000.0, "Carbide", true);
        assert!(wear > 0.0);
        assert!(wear < 1.0); // Should be small
    }

    #[test]
    fn test_total_force_vector() {
        let result = CuttingForceCalculator::calculate_kienzle("Aluminum", 0.1, 2.0, 200.0, 4).unwrap();
        let expected_total = (
            result.tangential_force.powi(2) +
            result.feed_force.powi(2) +
            result.radial_force.powi(2)
        ).sqrt();
        assert!((result.total_force - expected_total).abs() < 0.1);
    }

    #[test]
    fn test_calculate_with_adjustments() {
        let result = CuttingForceCalculator::calculate_with_adjustments("Aluminum", 400.0, 2.0, 200.0, 4);
        assert!(result.is_ok());
    }
}
