//! Pneumatic System Components
//!
//! Components for pneumatic power transmission systems:
//! - Resistances (pipes, nozzles): R_p [Pa·s/m³]
//! - Accumulators (energy storage): V [m³]
//! - Compressors (power sources): Q [m³/s]
//! - Cylinders (actuators): A [m²]
//! - Valves (flow control): C_v [m³/s per √Pa]
//!
//! All map to MNA solver:
//! - Resistance → Conductance (G = 1/R_p)
//! - Tank Volume → Capacitance (C = V)
//! - Compressor → Flow source (Q = Y)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Pneumatic component types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PneumaticComponent {
    /// Pipe with pressure drop
    /// Length, diameter, roughness for Darcy-Weisbach
    Pipe {
        length: f64,           // [m]
        diameter: f64,         // [m]
        roughness: f64,        // [m] - absolute roughness
    },

    /// Nozzle with fixed flow restriction
    /// Modeled as fixed resistance: R_p = ΔP / Q
    Nozzle {
        resistance: f64,       // [Pa·s/m³]
    },

    /// Tank/Accumulator (energy storage device)
    /// Pressurized container for compressed gas
    Tank {
        volume: f64,           // [m³]
        precharge: f64,        // [Pa] - initial pressure (absolute)
    },

    /// Compressor (positive displacement or centrifugal)
    /// Delivers constant or variable flow
    Compressor {
        displacement: f64,     // [cm³/rev] for positive displacement
        flow_rate: f64,        // [m³/s] at nominal speed
    },

    /// Pneumatic motor (fluid powered rotational actuator)
    /// Converts pressure to rotational motion
    PneumaticMotor {
        displacement: f64,     // [cm³/rev]
        speed: f64,            // [rad/s]
    },

    /// Linear cylinder (actuator)
    /// Rod area: A_rod = A - A_annulus
    LinearCylinder {
        area: f64,             // [m²] - rod side area
        rod_area: f64,         // [m²] - rod cross-sectional
    },

    /// Pressure relief valve (safety)
    /// Cracks at set pressure: P_set
    PressureReliefValve {
        cracking_pressure: f64,    // [Pa]
        flow_capacity: f64,        // [m³/s]
    },

    /// Directional control valve (solenoid-operated)
    /// Routes flow: tank, compressor, or load
    DirectionalValve {
        cv_rating: f64,        // [m³/s per √Pa] - flow coefficient
        position: u8,          // 0=center, 1=extend, 2=retract
    },

    /// Flow control valve (throttle)
    /// Adjustable resistance
    FlowControlValve {
        cv_min: f64,           // Minimum C_v [m³/s per √Pa]
        cv_max: f64,           // Maximum C_v
    },

    /// Check valve (one-way flow)
    /// Allows flow in one direction, blocks reverse
    CheckValve {
        cracking_pressure: f64,    // [Pa] - opening threshold
        full_flow_pressure: f64,   // [Pa] - full opening
    },

    /// Silencer/Muffler (noise reduction with pressure drop)
    /// Sintered bronze filter element
    Silencer {
        resistance: f64,       // [Pa·s/m³] - flow restriction
    },

    /// Desiccant dryer (removes moisture with slight pressure drop)
    /// Important for pneumatic systems to prevent corrosion
    Dryer {
        resistance: f64,       // [Pa·s/m³] - minimal drop
    },

    /// Pressure source (compressor discharge)
    /// Maintains pressure: P [Pa]
    PressureSource {
        pressure: f64,         // [Pa]
    },

    /// Flow source (compressor)
    /// Maintains flow: Q [m³/s]
    FlowSource {
        flow_rate: f64,        // [m³/s]
    },

    /// Atmospheric vent (returns to atmosphere)
    /// Acts as ground in electrical analogy
    Vent,

    /// Coupling (connection with minimal loss)
    /// Quick-connect fitting
    Coupling {
        resistance: f64,       // [Pa·s/m³] - minimal
    },
}

impl PneumaticComponent {
    /// Get component name
    pub fn name(&self) -> &'static str {
        match self {
            Self::Pipe { .. } => "Pipe",
            Self::Nozzle { .. } => "Nozzle",
            Self::Tank { .. } => "Tank",
            Self::Compressor { .. } => "Compressor",
            Self::PneumaticMotor { .. } => "Pneumatic Motor",
            Self::LinearCylinder { .. } => "Linear Cylinder",
            Self::PressureReliefValve { .. } => "Pressure Relief Valve",
            Self::DirectionalValve { .. } => "Directional Valve",
            Self::FlowControlValve { .. } => "Flow Control Valve",
            Self::CheckValve { .. } => "Check Valve",
            Self::Silencer { .. } => "Silencer",
            Self::Dryer { .. } => "Dryer",
            Self::PressureSource { .. } => "Pressure Source",
            Self::FlowSource { .. } => "Flow Source",
            Self::Vent => "Vent",
            Self::Coupling { .. } => "Coupling",
        }
    }

    /// Get pneumatic resistance [Pa·s/m³]
    /// For use with MNA: G = 1/R_p
    pub fn get_resistance(&self) -> Option<f64> {
        match self {
            Self::Pipe { length, diameter, roughness: _ } => {
                // Darcy-Weisbach: ΔP = f × (L/D) × (ρ × Q² / 2)
                // Simplified resistance: R_p = f × (L/D) × (ρ / (2 × A²))
                let area = PI * diameter * diameter / 4.0;
                let f_friction = 0.025;  // typical for compressed air pipes
                let r_p = f_friction * (length / diameter) / (area * area * 1000.0);
                Some(r_p)
            }
            Self::Nozzle { resistance } => Some(*resistance),
            Self::Silencer { resistance } => Some(*resistance),
            Self::Dryer { resistance } => Some(*resistance),
            Self::Coupling { resistance } => Some(*resistance),
            _ => None,
        }
    }

    /// Get tank capacitance [m³]
    /// For use with MNA: C = V (tank volume)
    pub fn get_capacitance(&self) -> Option<f64> {
        match self {
            Self::Tank { volume, .. } => Some(*volume),
            Self::LinearCylinder { area, .. } => Some(*area),
            _ => None,
        }
    }

    /// Get flow generation [m³/s]
    pub fn get_flow(&self) -> Option<f64> {
        match self {
            Self::Compressor { flow_rate, .. } => Some(*flow_rate),
            Self::FlowSource { flow_rate } => Some(*flow_rate),
            _ => None,
        }
    }

    /// Get pressure reference [Pa]
    pub fn get_pressure(&self) -> Option<f64> {
        match self {
            Self::PressureSource { pressure } => Some(*pressure),
            _ => None,
        }
    }

    /// Validate component parameters
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::Pipe { length, diameter, roughness } => {
                if *length <= 0.0 {
                    return Err("Pipe length must be positive".to_string());
                }
                if *diameter <= 0.0 {
                    return Err("Pipe diameter must be positive".to_string());
                }
                if *roughness < 0.0 {
                    return Err("Pipe roughness must be non-negative".to_string());
                }
                Ok(())
            }
            Self::Nozzle { resistance } => {
                if *resistance < 0.0 {
                    return Err("Nozzle resistance must be non-negative".to_string());
                }
                Ok(())
            }
            Self::Tank { volume, precharge } => {
                if *volume <= 0.0 {
                    return Err("Tank volume must be positive".to_string());
                }
                if *precharge < 0.0 {
                    return Err("Precharge pressure must be non-negative".to_string());
                }
                if *precharge > 1e8 {
                    return Err("Precharge pressure suspiciously high".to_string());
                }
                Ok(())
            }
            Self::Compressor { displacement, flow_rate } => {
                if *displacement <= 0.0 {
                    return Err("Compressor displacement must be positive".to_string());
                }
                if *flow_rate < 0.0 {
                    return Err("Flow rate cannot be negative".to_string());
                }
                Ok(())
            }
            Self::LinearCylinder { area, rod_area } => {
                if *area <= 0.0 {
                    return Err("Cylinder area must be positive".to_string());
                }
                if *rod_area < 0.0 || *rod_area >= *area {
                    return Err("Rod area must be less than piston area".to_string());
                }
                Ok(())
            }
            Self::PressureReliefValve { cracking_pressure, .. } => {
                if *cracking_pressure <= 0.0 {
                    return Err("Relief valve setting must be positive".to_string());
                }
                if *cracking_pressure > 1e7 {
                    return Err("Relief pressure suspiciously high (> 10 MPa)".to_string());
                }
                Ok(())
            }
            Self::FlowControlValve { cv_min, cv_max } => {
                if *cv_min < 0.0 || *cv_max < 0.0 {
                    return Err("Flow coefficients must be non-negative".to_string());
                }
                if *cv_min > *cv_max {
                    return Err("Minimum flow coefficient exceeds maximum".to_string());
                }
                Ok(())
            }
            Self::CheckValve { cracking_pressure, full_flow_pressure } => {
                if *cracking_pressure < 0.0 {
                    return Err("Cracking pressure must be non-negative".to_string());
                }
                if *full_flow_pressure < *cracking_pressure {
                    return Err("Full flow pressure must exceed cracking pressure".to_string());
                }
                Ok(())
            }
            Self::FlowSource { flow_rate } => {
                if *flow_rate < 0.0 {
                    return Err("Flow rate cannot be negative".to_string());
                }
                Ok(())
            }
            _ => Ok(()),
        }
    }
}

/// Pneumatic analysis helpers
pub mod analysis {
    use super::*;

    /// Calculate pressure drop in pipe using Darcy-Weisbach
    /// ΔP = f × (L/D) × (ρ × Q² / (2 × A²))
    pub fn pipe_pressure_drop(
        length: f64,
        diameter: f64,
        flow_rate: f64,
        density: f64,
    ) -> Result<f64, String> {
        if diameter <= 0.0 {
            return Err("Diameter must be positive".to_string());
        }
        let area = PI * diameter * diameter / 4.0;
        let velocity = flow_rate / area;
        let friction_factor = 0.025;  // simplified
        let dp = friction_factor * (length / diameter) * (density * velocity * velocity / 2.0);
        Ok(dp)
    }

    /// Calculate flow through nozzle
    /// Q = C_d × A × √(2 × ΔP / ρ)
    pub fn nozzle_flow(
        area: f64,
        pressure_drop: f64,
        density: f64,
    ) -> Result<f64, String> {
        if area <= 0.0 {
            return Err("Area must be positive".to_string());
        }
        if pressure_drop < 0.0 {
            return Err("Pressure drop must be non-negative".to_string());
        }
        if density <= 0.0 {
            return Err("Density must be positive".to_string());
        }
        let cd = 0.61;  // discharge coefficient
        let velocity = (2.0 * pressure_drop / density).sqrt();
        let flow = cd * area * velocity;
        Ok(flow)
    }

    /// Calculate tank charge time
    pub fn tank_charge_time(
        volume: f64,
        flow_rate: f64,
        initial_pressure: f64,
        target_pressure: f64,
    ) -> Result<f64, String> {
        if volume <= 0.0 {
            return Err("Volume must be positive".to_string());
        }
        if flow_rate <= 0.0 {
            return Err("Flow rate must be positive".to_string());
        }
        if target_pressure < initial_pressure {
            return Err("Target pressure must be >= initial pressure".to_string());
        }
        // Simplified: assumes isothermal compression
        let pressure_ratio = target_pressure / initial_pressure.max(1.0);
        let time = volume * pressure_ratio.ln() / flow_rate;
        Ok(time)
    }

    /// Calculate cylinder force output
    /// F = P × A
    pub fn cylinder_force(pressure: f64, area: f64) -> f64 {
        pressure * area
    }

    /// Calculate motor torque output
    /// T = P × D / (2π)
    pub fn motor_torque(pressure: f64, displacement: f64) -> f64 {
        let displacement_m3_per_rad = displacement / 1e6 * 2.0 * PI;
        pressure * displacement_m3_per_rad
    }

    /// Calculate system response time
    /// τ = Volume / Flow_Rate
    pub fn system_time_constant(volume: f64, flow_rate: f64) -> Result<f64, String> {
        if volume < 0.0 {
            return Err("Volume must be non-negative".to_string());
        }
        if flow_rate <= 0.0 {
            return Err("Flow rate must be positive".to_string());
        }
        Ok(volume / flow_rate)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pipe_component() {
        let pipe = PneumaticComponent::Pipe {
            length: 5.0,
            diameter: 0.01,
            roughness: 1e-5,
        };
        assert_eq!(pipe.name(), "Pipe");
        assert!(pipe.get_resistance().is_some());
        assert!(pipe.validate().is_ok());
    }

    #[test]
    fn test_nozzle_component() {
        let nozzle = PneumaticComponent::Nozzle { resistance: 5e6 };
        assert_eq!(nozzle.name(), "Nozzle");
        assert_eq!(nozzle.get_resistance(), Some(5e6));
        assert!(nozzle.validate().is_ok());
    }

    #[test]
    fn test_tank_component() {
        let tank = PneumaticComponent::Tank {
            volume: 0.05,
            precharge: 101325.0,
        };
        assert_eq!(tank.name(), "Tank");
        assert_eq!(tank.get_capacitance(), Some(0.05));
        assert!(tank.validate().is_ok());
    }

    #[test]
    fn test_compressor_component() {
        let compressor = PneumaticComponent::Compressor {
            displacement: 100.0,
            flow_rate: 0.01,
        };
        assert_eq!(compressor.name(), "Compressor");
        assert_eq!(compressor.get_flow(), Some(0.01));
        assert!(compressor.validate().is_ok());
    }

    #[test]
    fn test_cylinder_force() {
        let force = analysis::cylinder_force(5e5, 0.01);  // 0.5 MPa, 100 cm²
        assert!((force - 5000.0).abs() < 1.0);  // 5000 N
    }

    #[test]
    fn test_motor_torque() {
        let torque = analysis::motor_torque(5e5, 100.0);
        assert!(torque > 0.0);
    }

    #[test]
    fn test_tank_charge_time() {
        let time = analysis::tank_charge_time(0.05, 0.002, 101325.0, 5e5).unwrap();
        assert!(time > 0.0);
    }

    #[test]
    fn test_nozzle_flow() {
        let area = 1e-4;
        let pressure_drop = 1e5;
        let density = 1.204;
        let flow = analysis::nozzle_flow(area, pressure_drop, density).unwrap();
        assert!(flow > 0.0);
    }

    #[test]
    fn test_invalid_pipe() {
        let pipe = PneumaticComponent::Pipe {
            length: -1.0,
            diameter: 0.01,
            roughness: 0.0,
        };
        assert!(pipe.validate().is_err());
    }

    #[test]
    fn test_system_time_constant() {
        let tau = analysis::system_time_constant(0.05, 0.002).unwrap();
        assert_eq!(tau, 25.0);
    }
}
