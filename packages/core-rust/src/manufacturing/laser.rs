/**
 * Laser Cutting - Kerf Compensation & Parameters
 * Handles laser cutting specifics for different materials
 */

use serde::{Deserialize, Serialize};

/// Laser cutting parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaserParameters {
    pub material: String,
    pub thickness: f64,              // mm
    pub cutting_speed: f64,          // mm/min
    pub power: f64,                  // Watts (0-100%)
    pub frequency: f64,              // Hz (for pulsed lasers)
    pub assist_gas: Option<AssistGas>,
    pub kerf_width: f64,             // mm (beam width)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AssistGas {
    None,
    Air,
    Nitrogen,
    Oxygen,
}

impl LaserParameters {
    pub fn new(material: String, thickness: f64) -> Self {
        let (cutting_speed, power, kerf) = Self::get_defaults(&material, thickness);

        LaserParameters {
            material,
            thickness,
            cutting_speed,
            power,
            frequency: 20.0,
            assist_gas: Some(AssistGas::Air),
            kerf_width: kerf,
        }
    }

    /// Get default parameters for material
    fn get_defaults(material: &str, thickness: f64) -> (f64, f64, f64) {
        match material {
            "Plywood" => {
                if thickness <= 3.0 {
                    (1000.0, 80.0, 0.2)
                } else if thickness <= 6.0 {
                    (600.0, 90.0, 0.25)
                } else {
                    (300.0, 95.0, 0.3)
                }
            }
            "Acrylic" => {
                if thickness <= 3.0 {
                    (1200.0, 60.0, 0.15)
                } else if thickness <= 6.0 {
                    (800.0, 75.0, 0.2)
                } else {
                    (400.0, 90.0, 0.25)
                }
            }
            "MDF" => {
                if thickness <= 3.0 {
                    (800.0, 75.0, 0.2)
                } else {
                    (400.0, 85.0, 0.25)
                }
            }
            "Cardboard" => (1500.0, 50.0, 0.15),
            "Fabric" => (2000.0, 30.0, 0.1),
            "Rubber" => (400.0, 80.0, 0.3),
            _ => (500.0, 70.0, 0.2),
        }
    }
}

/// Kerf compensation
pub struct KerfCompensator;

impl KerfCompensator {
    /// Apply inside kerf compensation (shrink hole/pocket)
    pub fn compensate_inside(
        dimension: f64,
        kerf_width: f64,
        cuts_sides: u32, // How many sides are cut (1, 2, 3, 4)
    ) -> f64 {
        let compensation = (kerf_width / 2.0) * (cuts_sides as f64);
        (dimension - compensation).max(0.1) // Ensure minimum dimension
    }

    /// Apply outside kerf compensation (enlarge profile)
    pub fn compensate_outside(dimension: f64, kerf_width: f64, cuts_sides: u32) -> f64 {
        let compensation = (kerf_width / 2.0) * (cuts_sides as f64);
        dimension + compensation
    }

    /// Calculate actual dimension after cutting
    pub fn actual_dimension(
        design_dimension: f64,
        kerf_width: f64,
        is_inside: bool,
    ) -> f64 {
        if is_inside {
            design_dimension - kerf_width
        } else {
            design_dimension + kerf_width
        }
    }

    /// Generate kerf offset path (parallel path)
    pub fn offset_path(
        original_width: f64,
        original_height: f64,
        kerf_offset: f64,
        is_inside: bool,
    ) -> (f64, f64) {
        if is_inside {
            (
                original_width - 2.0 * kerf_offset,
                original_height - 2.0 * kerf_offset,
            )
        } else {
            (
                original_width + 2.0 * kerf_offset,
                original_height + 2.0 * kerf_offset,
            )
        }
    }
}

/// Material database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialSpec {
    pub name: String,
    pub min_thickness: f64,
    pub max_thickness: f64,
    pub max_power: f64,
    pub min_speed: f64,
    pub max_speed: f64,
    pub typical_kerf: f64,
    pub notes: String,
}

impl MaterialSpec {
    pub fn database() -> Vec<MaterialSpec> {
        vec![
            MaterialSpec {
                name: "Plywood".to_string(),
                min_thickness: 1.5,
                max_thickness: 12.0,
                max_power: 100.0,
                min_speed: 200.0,
                max_speed: 1500.0,
                typical_kerf: 0.2,
                notes: "Multiple passes for thick material".to_string(),
            },
            MaterialSpec {
                name: "Acrylic".to_string(),
                min_thickness: 1.0,
                max_thickness: 10.0,
                max_power: 80.0,
                min_speed: 400.0,
                max_speed: 1800.0,
                typical_kerf: 0.15,
                notes: "Prone to melting, watch edges".to_string(),
            },
            MaterialSpec {
                name: "MDF".to_string(),
                min_thickness: 1.5,
                max_thickness: 12.0,
                max_power: 95.0,
                min_speed: 300.0,
                max_speed: 1200.0,
                typical_kerf: 0.2,
                notes: "Produces clean edges".to_string(),
            },
            MaterialSpec {
                name: "Cardboard".to_string(),
                min_thickness: 1.0,
                max_thickness: 5.0,
                max_power: 60.0,
                min_speed: 800.0,
                max_speed: 2000.0,
                typical_kerf: 0.15,
                notes: "Fast cutting, watch for charring".to_string(),
            },
            MaterialSpec {
                name: "Fabric".to_string(),
                min_thickness: 0.5,
                max_thickness: 3.0,
                max_power: 40.0,
                min_speed: 1000.0,
                max_speed: 2500.0,
                typical_kerf: 0.1,
                notes: "Delicate, low power".to_string(),
            },
        ]
    }

    /// Find material spec by name
    pub fn find(name: &str) -> Option<MaterialSpec> {
        Self::database().into_iter().find(|m| m.name == name)
    }

    /// Validate parameters for material
    pub fn validate(&self, thickness: f64, power: f64, speed: f64) -> Result<(), String> {
        if thickness < self.min_thickness || thickness > self.max_thickness {
            return Err(format!(
                "Thickness {} out of range {}-{}",
                thickness, self.min_thickness, self.max_thickness
            ));
        }
        if power > self.max_power {
            return Err(format!("Power {} exceeds maximum {}", power, self.max_power));
        }
        if speed < self.min_speed || speed > self.max_speed {
            return Err(format!(
                "Speed {} out of range {}-{}",
                speed, self.min_speed, self.max_speed
            ));
        }
        Ok(())
    }
}

/// Laser cutting operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaserCutOperation {
    pub part_id: String,
    pub parameters: LaserParameters,
    pub path_length: f64,          // mm
    pub estimated_time: f64,       // seconds
    pub material_cost: f64,        // USD
    pub power_cost: f64,           // USD
}

impl LaserCutOperation {
    pub fn new(part_id: String, parameters: LaserParameters, path_length: f64) -> Self {
        let estimated_time = (path_length / parameters.cutting_speed) * 60.0; // seconds
        let material_cost = 0.01 * path_length; // $0.01 per mm (rough estimate)
        let power_cost = (parameters.power / 100.0) * estimated_time * 0.0001; // Very rough

        LaserCutOperation {
            part_id,
            parameters,
            path_length,
            estimated_time,
            material_cost,
            power_cost,
        }
    }

    pub fn total_cost(&self) -> f64 {
        self.material_cost + self.power_cost
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_laser_parameters_creation() {
        let params = LaserParameters::new("Plywood".to_string(), 3.0);
        assert_eq!(params.material, "Plywood");
        assert_eq!(params.thickness, 3.0);
    }

    #[test]
    fn test_kerf_compensation_inside() {
        let compensated = KerfCompensator::compensate_inside(10.0, 0.2, 1);
        assert!(compensated < 10.0);
    }

    #[test]
    fn test_kerf_compensation_outside() {
        let compensated = KerfCompensator::compensate_outside(10.0, 0.2, 1);
        assert!(compensated > 10.0);
    }

    #[test]
    fn test_actual_dimension_inside() {
        let actual = KerfCompensator::actual_dimension(10.0, 0.2, true);
        assert_eq!(actual, 9.8);
    }

    #[test]
    fn test_actual_dimension_outside() {
        let actual = KerfCompensator::actual_dimension(10.0, 0.2, false);
        assert_eq!(actual, 10.2);
    }

    #[test]
    fn test_offset_path_inside() {
        let (w, h) = KerfCompensator::offset_path(100.0, 100.0, 0.1, true);
        assert!(w < 100.0);
        assert!(h < 100.0);
    }

    #[test]
    fn test_offset_path_outside() {
        let (w, h) = KerfCompensator::offset_path(100.0, 100.0, 0.1, false);
        assert!(w > 100.0);
        assert!(h > 100.0);
    }

    #[test]
    fn test_material_spec_database() {
        let db = MaterialSpec::database();
        assert!(db.len() > 0);
    }

    #[test]
    fn test_find_material() {
        let spec = MaterialSpec::find("Plywood");
        assert!(spec.is_some());
    }

    #[test]
    fn test_material_validation() {
        let spec = MaterialSpec::find("Plywood").unwrap();
        assert!(spec.validate(3.0, 80.0, 600.0).is_ok());
    }

    #[test]
    fn test_material_validation_fail() {
        let spec = MaterialSpec::find("Plywood").unwrap();
        assert!(spec.validate(20.0, 80.0, 600.0).is_err()); // Too thick
    }

    #[test]
    fn test_laser_cut_operation() {
        let params = LaserParameters::new("Plywood".to_string(), 3.0);
        let op = LaserCutOperation::new("part1".to_string(), params, 100.0);
        assert!(op.estimated_time > 0.0);
        assert!(op.total_cost() > 0.0);
    }
}
