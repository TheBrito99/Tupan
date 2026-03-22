//! Mechanical System Components
//!
//! Fundamental components for mechanical systems:
//! - Dampers (dissipation): f [N·s/m]
//! - Masses (inertia): m [kg]
//! - Springs (stiffness): k [N/m]
//! - Force sources (excitation): F [N]
//! - Velocity sources (boundary conditions)
//!
//! All map to generic MNA solver:
//! - Damping → Conductance (f = G)
//! - Mass → Capacitance (m = C)
//! - Spring → Implicit stiffness (requires transformation)
//! - Force → Flow source (F = Y)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Mechanical system component types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MechanicalComponent {
    /// Linear damper: F = f × v
    /// f [N·s/m] - damping coefficient
    Damper {
        damping: f64,
    },

    /// Point mass: F = m × dv/dt
    /// m [kg] - inertial mass
    Mass {
        mass: f64,
    },

    /// Linear spring: F = k × (x2 - x1)
    /// k [N/m] - spring stiffness
    /// For velocity input: F = k × ∫(v) dt
    Spring {
        stiffness: f64,
    },

    /// Torsional damper: T = c × ω
    /// c [N·m·s/rad] - rotational damping
    TorsionalDamper {
        damping: f64,
    },

    /// Moment of inertia: T = J × dω/dt
    /// J [kg·m²] - rotational inertia
    RotationalMass {
        inertia: f64,
    },

    /// Torsional spring: T = kt × (θ2 - θ1)
    /// kt [N·m/rad] - torsional stiffness
    TorsionalSpring {
        stiffness: f64,
    },

    /// Applied force (source)
    /// F [N] - constant force
    ForceSource {
        force: f64,
    },

    /// Velocity constraint (boundary condition)
    /// v [m/s] - fixed velocity
    VelocitySource {
        velocity: f64,
    },

    /// Applied torque (source)
    /// T [N·m] - constant torque
    TorqueSource {
        torque: f64,
    },

    /// Viscous friction: F = μ × N × sign(v)
    /// Approximated as damper with equivalent coefficient
    /// μ [dimensionless] - friction coefficient
    /// N [N] - normal force
    Friction {
        friction_coefficient: f64,
        normal_force: f64,
    },

    /// Coulomb damping: F = μ_k × N (constant)
    /// μ_k - kinetic friction coefficient
    /// N - normal force
    CoulombDamping {
        kinetic_friction: f64,
        normal_force: f64,
    },

    /// Pulley system (mechanical advantage)
    /// Transforms force/velocity: F_out = n × F_in, v_out = v_in / n
    /// n - gear/pulley ratio
    MechanicalAdvantage {
        ratio: f64,
    },

    /// Linear bearing: low damping
    /// friction [N·s/m] - effective damping
    LinearBearing {
        friction: f64,
    },

    /// Nonlinear spring: F = k × x + α × x³
    /// k [N/m] - linear stiffness
    /// α [N/m³] - nonlinear coefficient
    NonlinearSpring {
        stiffness: f64,
        nonlinearity: f64,
    },
}

impl MechanicalComponent {
    /// Get component name
    pub fn name(&self) -> &'static str {
        match self {
            Self::Damper { .. } => "Damper",
            Self::Mass { .. } => "Mass",
            Self::Spring { .. } => "Spring",
            Self::TorsionalDamper { .. } => "Torsional Damper",
            Self::RotationalMass { .. } => "Rotational Mass",
            Self::TorsionalSpring { .. } => "Torsional Spring",
            Self::ForceSource { .. } => "Force Source",
            Self::VelocitySource { .. } => "Velocity Source",
            Self::TorqueSource { .. } => "Torque Source",
            Self::Friction { .. } => "Friction",
            Self::CoulombDamping { .. } => "Coulomb Damping",
            Self::MechanicalAdvantage { .. } => "Mechanical Advantage",
            Self::LinearBearing { .. } => "Linear Bearing",
            Self::NonlinearSpring { .. } => "Nonlinear Spring",
        }
    }

    /// Get damping coefficient (for MNA mapping)
    /// Returns: effective conductance (f in N·s/m)
    pub fn get_damping(&self) -> Option<f64> {
        match self {
            Self::Damper { damping } => Some(*damping),
            Self::LinearBearing { friction } => Some(*friction),
            Self::Friction { friction_coefficient, normal_force } => {
                // Viscous friction approximation: f_eq ≈ μ × N / v_ref
                // Using reference velocity of 1 m/s
                Some(friction_coefficient * normal_force)
            }
            Self::CoulombDamping { kinetic_friction, normal_force } => {
                // Convert coulomb to equivalent viscous: f_eq = F_coulomb / v
                Some(kinetic_friction * normal_force)
            }
            Self::TorsionalDamper { damping } => Some(*damping),
            _ => None,
        }
    }

    /// Get inertial mass (for MNA capacitance mapping)
    /// Returns: effective capacitance (m in kg or J in kg·m²)
    pub fn get_inertia(&self) -> Option<f64> {
        match self {
            Self::Mass { mass } => Some(*mass),
            Self::RotationalMass { inertia } => Some(*inertia),
            _ => None,
        }
    }

    /// Get spring stiffness
    pub fn get_stiffness(&self) -> Option<f64> {
        match self {
            Self::Spring { stiffness } => Some(*stiffness),
            Self::TorsionalSpring { stiffness } => Some(*stiffness),
            Self::NonlinearSpring { stiffness, .. } => Some(*stiffness),
            _ => None,
        }
    }

    /// Get force generation
    pub fn get_force(&self) -> Option<f64> {
        match self {
            Self::ForceSource { force } => Some(*force),
            Self::TorqueSource { torque } => Some(*torque),
            Self::CoulombDamping { kinetic_friction, normal_force } => {
                Some(kinetic_friction * normal_force)
            }
            _ => None,
        }
    }

    /// Get velocity constraint
    pub fn get_velocity(&self) -> Option<f64> {
        match self {
            Self::VelocitySource { velocity } => Some(*velocity),
            _ => None,
        }
    }

    /// Validate component parameters
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::Damper { damping } => {
                if *damping < 0.0 {
                    return Err("Damping coefficient must be non-negative".to_string());
                }
                if *damping > 1e6 {
                    return Err("Damping suspiciously high (> 1e6 N·s/m)".to_string());
                }
                Ok(())
            }
            Self::Mass { mass } => {
                if *mass <= 0.0 {
                    return Err("Mass must be positive".to_string());
                }
                if *mass > 1e6 {
                    return Err("Mass suspiciously high (> 1e6 kg)".to_string());
                }
                Ok(())
            }
            Self::Spring { stiffness } => {
                if *stiffness < 0.0 {
                    return Err("Spring stiffness must be non-negative".to_string());
                }
                if *stiffness > 1e8 {
                    return Err("Spring stiffness suspiciously high (> 1e8 N/m)".to_string());
                }
                Ok(())
            }
            Self::ForceSource { force: _ } => Ok(()),
            Self::VelocitySource { velocity: _ } => Ok(()),
            Self::TorsionalDamper { damping } => {
                if *damping < 0.0 {
                    return Err("Rotational damping must be non-negative".to_string());
                }
                Ok(())
            }
            Self::RotationalMass { inertia } => {
                if *inertia <= 0.0 {
                    return Err("Moment of inertia must be positive".to_string());
                }
                Ok(())
            }
            Self::LinearBearing { friction } => {
                if *friction < 0.0 {
                    return Err("Bearing friction must be non-negative".to_string());
                }
                Ok(())
            }
            Self::NonlinearSpring { stiffness, nonlinearity } => {
                if *stiffness < 0.0 {
                    return Err("Spring stiffness must be non-negative".to_string());
                }
                if *nonlinearity < 0.0 {
                    return Err("Nonlinearity coefficient must be non-negative".to_string());
                }
                Ok(())
            }
            Self::Friction { friction_coefficient, normal_force } => {
                if *friction_coefficient < 0.0 || *friction_coefficient > 2.0 {
                    return Err("Friction coefficient should be between 0 and 2".to_string());
                }
                if *normal_force < 0.0 {
                    return Err("Normal force must be non-negative".to_string());
                }
                Ok(())
            }
            Self::CoulombDamping { kinetic_friction, normal_force } => {
                if *kinetic_friction < 0.0 || *kinetic_friction > 2.0 {
                    return Err("Friction coefficient should be between 0 and 2".to_string());
                }
                if *normal_force < 0.0 {
                    return Err("Normal force must be non-negative".to_string());
                }
                Ok(())
            }
            Self::MechanicalAdvantage { ratio } => {
                if *ratio <= 0.0 {
                    return Err("Mechanical advantage ratio must be positive".to_string());
                }
                if *ratio > 1000.0 {
                    return Err("Mechanical advantage ratio suspiciously high".to_string());
                }
                Ok(())
            }
            Self::TorsionalSpring { stiffness } => {
                if *stiffness < 0.0 {
                    return Err("Torsional stiffness must be non-negative".to_string());
                }
                Ok(())
            }
            Self::TorqueSource { torque: _ } => Ok(()),
        }
    }
}

/// Analysis helpers for mechanical systems
pub mod analysis {
    use std::f64::consts::PI;

    /// Calculate mass of object from density and volume
    /// m = ρ × V
    pub fn mass_from_density(density: f64, volume: f64) -> Result<f64, String> {
        if density <= 0.0 {
            return Err("Density must be positive".to_string());
        }
        if volume <= 0.0 {
            return Err("Volume must be positive".to_string());
        }
        Ok(density * volume)
    }

    /// Calculate moment of inertia for cylinder rotating about axis
    /// J = (1/2) × m × r²
    pub fn cylinder_inertia(mass: f64, radius: f64) -> Result<f64, String> {
        if mass <= 0.0 {
            return Err("Mass must be positive".to_string());
        }
        if radius <= 0.0 {
            return Err("Radius must be positive".to_string());
        }
        Ok(0.5 * mass * radius * radius)
    }

    /// Calculate moment of inertia for sphere
    /// J = (2/5) × m × r²
    pub fn sphere_inertia(mass: f64, radius: f64) -> Result<f64, String> {
        if mass <= 0.0 {
            return Err("Mass must be positive".to_string());
        }
        if radius <= 0.0 {
            return Err("Radius must be positive".to_string());
        }
        Ok(0.4 * mass * radius * radius)
    }

    /// Calculate natural frequency of mass-spring system
    /// ω_n = √(k / m) [rad/s]
    pub fn natural_frequency(stiffness: f64, mass: f64) -> Result<f64, String> {
        if stiffness < 0.0 {
            return Err("Stiffness must be non-negative".to_string());
        }
        if mass <= 0.0 {
            return Err("Mass must be positive".to_string());
        }
        Ok((stiffness / mass).sqrt())
    }

    /// Calculate damping ratio
    /// ζ = f / (2 × √(k × m))
    /// ζ < 1: underdamped
    /// ζ = 1: critically damped
    /// ζ > 1: overdamped
    pub fn damping_ratio(damping: f64, stiffness: f64, mass: f64) -> Result<f64, String> {
        if damping < 0.0 {
            return Err("Damping must be non-negative".to_string());
        }
        if stiffness < 0.0 {
            return Err("Stiffness must be non-negative".to_string());
        }
        if mass <= 0.0 {
            return Err("Mass must be positive".to_string());
        }
        let critical_damping = 2.0 * (stiffness * mass).sqrt();
        Ok(damping / critical_damping)
    }

    /// Calculate time constant for first-order system
    /// τ = m / f [s]
    pub fn time_constant(mass: f64, damping: f64) -> Result<f64, String> {
        if mass < 0.0 {
            return Err("Mass must be non-negative".to_string());
        }
        if damping < 0.0 {
            return Err("Damping must be non-negative".to_string());
        }
        if damping == 0.0 {
            return Err("Cannot calculate time constant with zero damping".to_string());
        }
        Ok(mass / damping)
    }

    /// Calculate resonant frequency of damped system
    /// ω_d = ω_n × √(1 - ζ²) [rad/s]
    pub fn resonant_frequency(omega_n: f64, damping_ratio: f64) -> Result<f64, String> {
        if omega_n < 0.0 {
            return Err("Natural frequency must be non-negative".to_string());
        }
        if damping_ratio < 0.0 || damping_ratio > 10.0 {
            return Err("Damping ratio out of reasonable range".to_string());
        }
        if damping_ratio >= 1.0 {
            return Err("System is overdamped (no oscillation)".to_string());
        }
        Ok(omega_n * (1.0 - damping_ratio * damping_ratio).sqrt())
    }

    /// Convert frequency from Hz to rad/s
    pub fn hz_to_rad_s(frequency_hz: f64) -> f64 {
        frequency_hz * 2.0 * PI
    }

    /// Convert angular frequency from rad/s to Hz
    pub fn rad_s_to_hz(omega: f64) -> f64 {
        omega / (2.0 * PI)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_damper_component() {
        let damper = MechanicalComponent::Damper { damping: 100.0 };
        assert_eq!(damper.name(), "Damper");
        assert_eq!(damper.get_damping(), Some(100.0));
        assert!(damper.validate().is_ok());
    }

    #[test]
    fn test_mass_component() {
        let mass = MechanicalComponent::Mass { mass: 5.0 };
        assert_eq!(mass.name(), "Mass");
        assert_eq!(mass.get_inertia(), Some(5.0));
        assert!(mass.validate().is_ok());
    }

    #[test]
    fn test_spring_component() {
        let spring = MechanicalComponent::Spring { stiffness: 1000.0 };
        assert_eq!(spring.name(), "Spring");
        assert_eq!(spring.get_stiffness(), Some(1000.0));
        assert!(spring.validate().is_ok());
    }

    #[test]
    fn test_force_source() {
        let source = MechanicalComponent::ForceSource { force: 50.0 };
        assert_eq!(source.name(), "Force Source");
        assert_eq!(source.get_force(), Some(50.0));
        assert!(source.validate().is_ok());
    }

    #[test]
    fn test_natural_frequency() {
        // ω_n = √(1000 / 5) = √200 ≈ 14.14 rad/s
        let omega_n = analysis::natural_frequency(1000.0, 5.0).unwrap();
        assert!((omega_n - 14.142).abs() < 0.01);
    }

    #[test]
    fn test_damping_ratio_underdamped() {
        // ζ = 10 / (2 × √(1000 × 5)) = 10 / 141.42 ≈ 0.0707 (underdamped)
        let zeta = analysis::damping_ratio(10.0, 1000.0, 5.0).unwrap();
        assert!(zeta < 1.0);
        assert!((zeta - 0.0707).abs() < 0.001);
    }

    #[test]
    fn test_time_constant() {
        // τ = m / f = 5 / 100 = 0.05 s
        let tau = analysis::time_constant(5.0, 100.0).unwrap();
        assert_eq!(tau, 0.05);
    }

    #[test]
    fn test_frequency_conversion() {
        // 10 Hz = 20π rad/s ≈ 62.83 rad/s
        let omega = analysis::hz_to_rad_s(10.0);
        assert!((omega - 62.83).abs() < 0.01);

        // Convert back
        let freq = analysis::rad_s_to_hz(omega);
        assert!((freq - 10.0).abs() < 0.01);
    }

    #[test]
    fn test_invalid_damping() {
        let damper = MechanicalComponent::Damper { damping: -10.0 };
        assert!(damper.validate().is_err());
    }

    #[test]
    fn test_invalid_mass() {
        let mass = MechanicalComponent::Mass { mass: 0.0 };
        assert!(mass.validate().is_err());
    }
}
