//! Hydraulic System Components
//!
//! Components for hydraulic power transmission systems:
//! - Resistances (pipes, valves): R_h [Pa·s/m³]
//! - Accumulators (energy storage): A [m²]
//! - Pumps (power sources): Q [m³/s]
//! - Cylinders (actuators): A [m²]
//! - Valves (flow control): C_v [m³/s per √Pa]
//!
//! All map to generic MNA solver:
//! - Resistance → Conductance (G = 1/R_h)
//! - Accumulator → Capacitance (C = A)
//! - Pump → Flow source (Q = Y)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Hydraulic component types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HydraulicComponent {
    /// Pipe with pressure drop
    /// Length, diameter, friction factor for Darcy-Weisbach
    Pipe {
        length: f64,           // [m]
        diameter: f64,         // [m]
        roughness: f64,        // [m] - absolute roughness
    },

    /// Orifice with fixed flow restriction
    /// Modeled as fixed resistance: R_h = ΔP / Q
    Orifice {
        resistance: f64,       // [Pa·s/m³]
    },

    /// Accumulator (energy storage device)
    /// Pressurized container: P = ρ g h or P = K × compression
    Accumulator {
        volume: f64,           // [m³]
        precharge: f64,        // [Pa] - initial pressure
    },

    /// Pump (positive displacement or centrifugal)
    /// Delivers constant or variable flow
    Pump {
        displacement: f64,     // [cm³/rev] for positive displacement
        flow_rate: f64,        // [m³/s] steady-state
    },

    /// Motor (fluid powered actuator)
    /// Converts pressure to rotational motion
    RotaryMotor {
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
    /// Routes flow: tank, pump, or load
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

    /// Proportional valve (analog control)
    /// Flow proportional to electrical signal
    ProportionalValve {
        cv_nominal: f64,       // [m³/s per √Pa]
        response_time: f64,    // [ms]
    },

    /// Check valve (one-way flow)
    /// Allows flow in one direction, blocks reverse
    CheckValve {
        cracking_pressure: f64,    // [Pa] - opening threshold
        full_flow_pressure: f64,   // [Pa] - full opening
    },

    /// Pressure filter (combination of resistance and accumulation)
    /// Removes particles while maintaining minimum flow
    Filter {
        resistance: f64,       // [Pa·s/m³] - clean filter
        max_pressure_drop: f64,    // [Pa] - dirt accumulation
        bypass_setting: f64,   // [Pa] - bypass valve setting
    },

    /// Heat exchanger (cooling/heating)
    /// Transfers heat between hydraulic fluid and coolant
    HeatExchanger {
        capacity: f64,         // [W/K] - thermal capacity
        resistance: f64,       // [Pa·s/m³] - flow resistance
    },

    /// Reservoir/Tank (reference pressure)
    /// Return line collects fluid at atmospheric pressure
    Reservoir {
        volume: f64,           // [m³]
        pressure: f64,         // [Pa] - usually 1 atm
    },

    /// Pressure source (pump discharge)
    /// Maintains pressure: P [Pa]
    PressureSource {
        pressure: f64,         // [Pa]
    },

    /// Flow source (pump)
    /// Maintains flow: Q [m³/s]
    FlowSource {
        flow_rate: f64,        // [m³/s]
    },

    /// Pressure gauge (measurement - no pressure drop)
    /// Ideal pressure sensor
    PressureGauge,

    /// Flow meter (measurement - minimal pressure drop)
    /// Ideal flow sensor
    FlowMeter,

    /// Coupling (connection with minimal loss)
    /// Models hose/fitting pressure drop
    Coupling {
        resistance: f64,       // [Pa·s/m³] - minimal
    },
}

impl HydraulicComponent {
    /// Get component name
    pub fn name(&self) -> &'static str {
        match self {
            Self::Pipe { .. } => "Pipe",
            Self::Orifice { .. } => "Orifice",
            Self::Accumulator { .. } => "Accumulator",
            Self::Pump { .. } => "Pump",
            Self::RotaryMotor { .. } => "Rotary Motor",
            Self::LinearCylinder { .. } => "Linear Cylinder",
            Self::PressureReliefValve { .. } => "Pressure Relief Valve",
            Self::DirectionalValve { .. } => "Directional Valve",
            Self::FlowControlValve { .. } => "Flow Control Valve",
            Self::ProportionalValve { .. } => "Proportional Valve",
            Self::CheckValve { .. } => "Check Valve",
            Self::Filter { .. } => "Filter",
            Self::HeatExchanger { .. } => "Heat Exchanger",
            Self::Reservoir { .. } => "Reservoir",
            Self::PressureSource { .. } => "Pressure Source",
            Self::FlowSource { .. } => "Flow Source",
            Self::PressureGauge => "Pressure Gauge",
            Self::FlowMeter => "Flow Meter",
            Self::Coupling { .. } => "Coupling",
        }
    }

    /// Get hydraulic resistance [Pa·s/m³]
    /// For use with MNA: G = 1/R_h
    pub fn get_resistance(&self) -> Option<f64> {
        match self {
            Self::Pipe { length, diameter, roughness } => {
                // Darcy-Weisbach: ΔP = f × (L/D) × (ρ × Q² / 2)
                // Simplified resistance: R = f × (L/D) × (ρ / (2 × A²))
                // For now, estimate R_h ≈ 8 × f × L / (π² × D⁵)
                // Typical friction factor f ≈ 0.02-0.03 for turbulent
                let area = PI * diameter * diameter / 4.0;
                let f_friction = 0.025;  // typical for hydraulic pipes
                let r_h = f_friction * (length / diameter) / (area * area * 1000.0);
                Some(r_h)
            }
            Self::Orifice { resistance } => Some(*resistance),
            Self::Filter { resistance, .. } => Some(*resistance),
            Self::HeatExchanger { resistance, .. } => Some(*resistance),
            Self::Coupling { resistance } => Some(*resistance),
            _ => None,
        }
    }

    /// Get accumulator capacitance [m²]
    /// For use with MNA: C = A (accumulator area)
    pub fn get_capacitance(&self) -> Option<f64> {
        match self {
            Self::Accumulator { volume, .. } => {
                // Effective capacitance from compressibility
                // For hydraulic fluid: C_th ≈ Volume / Bulk_Modulus
                // For now, use volume as proxy
                Some(*volume)
            }
            Self::LinearCylinder { area, .. } => Some(*area),
            _ => None,
        }
    }

    /// Get flow generation [m³/s]
    pub fn get_flow(&self) -> Option<f64> {
        match self {
            Self::Pump { flow_rate, .. } => Some(*flow_rate),
            Self::FlowSource { flow_rate } => Some(*flow_rate),
            _ => None,
        }
    }

    /// Get pressure reference [Pa]
    pub fn get_pressure(&self) -> Option<f64> {
        match self {
            Self::PressureSource { pressure } => Some(*pressure),
            Self::Reservoir { pressure, .. } => Some(*pressure),
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
            Self::Orifice { resistance } => {
                if *resistance < 0.0 {
                    return Err("Orifice resistance must be non-negative".to_string());
                }
                if *resistance > 1e10 {
                    return Err("Orifice resistance suspiciously high".to_string());
                }
                Ok(())
            }
            Self::Accumulator { volume, precharge } => {
                if *volume <= 0.0 {
                    return Err("Accumulator volume must be positive".to_string());
                }
                if *precharge < 0.0 {
                    return Err("Precharge pressure must be non-negative".to_string());
                }
                if *precharge > 1e8 {
                    return Err("Precharge pressure suspiciously high".to_string());
                }
                Ok(())
            }
            Self::Pump { displacement, flow_rate } => {
                if *displacement <= 0.0 {
                    return Err("Pump displacement must be positive".to_string());
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
                if *cracking_pressure > 5e8 {
                    return Err("Relief pressure suspiciously high (> 500 MPa)".to_string());
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
            Self::Filter { resistance, max_pressure_drop, bypass_setting } => {
                if *resistance < 0.0 {
                    return Err("Filter resistance must be non-negative".to_string());
                }
                if *max_pressure_drop < 0.0 {
                    return Err("Max pressure drop must be non-negative".to_string());
                }
                if *bypass_setting <= 0.0 {
                    return Err("Bypass setting must be positive".to_string());
                }
                Ok(())
            }
            Self::HeatExchanger { capacity, resistance } => {
                if *capacity <= 0.0 {
                    return Err("Heat exchanger capacity must be positive".to_string());
                }
                if *resistance < 0.0 {
                    return Err("Resistance must be non-negative".to_string());
                }
                Ok(())
            }
            Self::Reservoir { volume, pressure } => {
                if *volume <= 0.0 {
                    return Err("Reservoir volume must be positive".to_string());
                }
                if *pressure < 0.0 {
                    return Err("Pressure must be non-negative".to_string());
                }
                Ok(())
            }
            Self::FlowSource { flow_rate } => {
                if *flow_rate < 0.0 {
                    return Err("Flow rate cannot be negative".to_string());
                }
                if *flow_rate > 1.0 {
                    return Err("Flow rate suspiciously high (> 1 m³/s)".to_string());
                }
                Ok(())
            }
            _ => Ok(()),
        }
    }
}

/// Hydraulic analysis helpers
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

        // Estimate friction factor (Haaland equation for smooth pipes)
        let friction_factor = 0.025;  // simplified

        let dp = friction_factor * (length / diameter) * (density * velocity * velocity / 2.0);
        Ok(dp)
    }

    /// Calculate flow through orifice
    /// Q = C_d × A × √(2 × ΔP / ρ)
    pub fn orifice_flow(
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

    /// Calculate accumulator charge time
    /// Time to pressurize from P_pre to P_set
    pub fn accumulator_charge_time(
        volume: f64,
        flow_rate: f64,
        precharge: f64,
        target_pressure: f64,
    ) -> Result<f64, String> {
        if volume <= 0.0 {
            return Err("Volume must be positive".to_string());
        }
        if flow_rate <= 0.0 {
            return Err("Flow rate must be positive".to_string());
        }
        if precharge < 0.0 || target_pressure < precharge {
            return Err("Target pressure must be >= precharge".to_string());
        }

        // Simplified: assumes isothermal compression
        // Time = Volume × ln(P_target / P_pre) / Q
        let pressure_ratio = target_pressure / precharge.max(1.0);
        let time = volume * pressure_ratio.ln() / flow_rate;
        Ok(time)
    }

    /// Calculate cylinder force output
    /// F = P × A (single rod), or F = P × (A - A_rod) for differential
    pub fn cylinder_force(
        pressure: f64,
        area: f64,
    ) -> f64 {
        pressure * area
    }

    /// Calculate motor torque output
    /// T = P × D / (2π) where D is displacement
    pub fn motor_torque(
        pressure: f64,
        displacement: f64,  // [cm³/rev]
    ) -> f64 {
        // Convert cm³/rev to m³/rad: divide by 1e6 and multiply by 2π
        let displacement_m3_per_rad = displacement / 1e6 * 2.0 * PI;
        pressure * displacement_m3_per_rad
    }

    /// Calculate system response time (first-order approximation)
    /// τ = Volume / Flow_Rate
    pub fn system_time_constant(
        volume: f64,
        flow_rate: f64,
    ) -> Result<f64, String> {
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
        let pipe = HydraulicComponent::Pipe {
            length: 5.0,
            diameter: 0.01,
            roughness: 1e-5,
        };
        assert_eq!(pipe.name(), "Pipe");
        assert!(pipe.get_resistance().is_some());
        assert!(pipe.validate().is_ok());
    }

    #[test]
    fn test_orifice_component() {
        let orifice = HydraulicComponent::Orifice { resistance: 1e7 };
        assert_eq!(orifice.name(), "Orifice");
        assert_eq!(orifice.get_resistance(), Some(1e7));
        assert!(orifice.validate().is_ok());
    }

    #[test]
    fn test_accumulator_component() {
        let acc = HydraulicComponent::Accumulator {
            volume: 0.01,
            precharge: 2e6,
        };
        assert_eq!(acc.name(), "Accumulator");
        assert_eq!(acc.get_capacitance(), Some(0.01));
        assert!(acc.validate().is_ok());
    }

    #[test]
    fn test_pump_component() {
        let pump = HydraulicComponent::Pump {
            displacement: 50.0,
            flow_rate: 0.01,
        };
        assert_eq!(pump.name(), "Pump");
        assert_eq!(pump.get_flow(), Some(0.01));
        assert!(pump.validate().is_ok());
    }

    #[test]
    fn test_cylinder_force() {
        // 2 MPa × 0.01 m² = 20,000 N
        let force = analysis::cylinder_force(2e6, 0.01);
        assert!((force - 20000.0).abs() < 1.0);
    }

    #[test]
    fn test_motor_torque() {
        // P = 2 MPa, D = 50 cm³/rev
        let torque = analysis::motor_torque(2e6, 50.0);
        assert!(torque > 0.0);
    }

    #[test]
    fn test_system_time_constant() {
        // τ = 0.01 m³ / 0.001 m³/s = 10 s
        let tau = analysis::system_time_constant(0.01, 0.001).unwrap();
        assert_eq!(tau, 10.0);
    }

    #[test]
    fn test_invalid_components() {
        let pipe = HydraulicComponent::Pipe {
            length: -1.0,
            diameter: 0.01,
            roughness: 0.0,
        };
        assert!(pipe.validate().is_err());

        let orifice = HydraulicComponent::Orifice { resistance: -100.0 };
        assert!(orifice.validate().is_err());
    }
}
