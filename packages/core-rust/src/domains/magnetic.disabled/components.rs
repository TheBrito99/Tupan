//! Magnetic Circuit Components
//!
//! Components for magnetic circuits: transformers, cores, air gaps, windings.
//!
//! Magnetic ↔ Electrical Analogy:
//! - MMF (magnetomotive force) [A-turns] ↔ Voltage [V]
//! - Flux (Φ) [Wb] ↔ Current [A]
//! - Reluctance (R_m) [A-turns/Wb] ↔ Resistance [Ω]
//! - Permeance (P = 1/R_m) [Wb/A-turns] ↔ Conductance [S]

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Magnetic component types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MagneticComponent {
    /// Magnetic core segment (reluctance path)
    /// μ_r * length / area
    CoreSegment {
        relative_permeability: f64,  // dimensionless
        length: f64,                 // [m]
        area: f64,                   // [m²]
    },

    /// Air gap (high reluctance)
    /// Reluctance = length / (μ_0 * area)
    AirGap {
        length: f64,                 // [m]
        area: f64,                   // [m²]
    },

    /// Winding (coil with N turns)
    /// Creates MMF: F = N × I
    Winding {
        turns: f64,                  // number of turns
        current: f64,                // [A] driving current
    },

    /// Transformer (coupled windings)
    /// Magnetic coupling between primary and secondary
    Transformer {
        primary_turns: f64,
        secondary_turns: f64,
        coupling_factor: f64,        // 0-1, magnetic coupling strength
    },

    /// Magnetic reluctance element (fixed reluctance)
    /// Direct reluctance specification
    Reluctance {
        reluctance: f64,             // [A-turns/Wb]
    },

    /// Permanent magnet
    /// Creates constant MMF
    PermanentMagnet {
        residual_flux: f64,          // [Wb]
        coercivity: f64,             // [A/m]
    },

    /// Saturating core (nonlinear)
    /// Permeability decreases with flux
    SaturatingCore {
        linear_permeability: f64,    // at low flux
        saturation_flux: f64,        // [Wb] where saturation occurs
        length: f64,                 // [m]
        area: f64,                   // [m²]
    },

    /// Magnetic ground (reference point)
    /// Zero MMF reference, like electrical ground
    MagneticGround,
}

impl MagneticComponent {
    /// Get component name
    pub fn name(&self) -> &'static str {
        match self {
            Self::CoreSegment { .. } => "Core Segment",
            Self::AirGap { .. } => "Air Gap",
            Self::Winding { .. } => "Winding",
            Self::Transformer { .. } => "Transformer",
            Self::Reluctance { .. } => "Reluctance",
            Self::PermanentMagnet { .. } => "Permanent Magnet",
            Self::SaturatingCore { .. } => "Saturating Core",
            Self::MagneticGround => "Magnetic Ground",
        }
    }

    /// Get reluctance [A-turns/Wb]
    /// For MNA: G = 1/R_m (permeance)
    pub fn get_reluctance(&self) -> Option<f64> {
        match self {
            Self::CoreSegment { relative_permeability, length, area } => {
                // R_m = length / (μ_0 × μ_r × A)
                let mu_0 = 4.0 * PI * 1e-7;  // [H/m]
                let reluctance = length / (mu_0 * relative_permeability * area);
                Some(reluctance)
            }
            Self::AirGap { length, area } => {
                // R_m = length / (μ_0 × A)
                let mu_0 = 4.0 * PI * 1e-7;
                let reluctance = length / (mu_0 * area);
                Some(reluctance)
            }
            Self::Reluctance { reluctance } => Some(*reluctance),
            Self::SaturatingCore { linear_permeability, length, area, .. } => {
                let mu_0 = 4.0 * PI * 1e-7;
                let reluctance = length / (mu_0 * linear_permeability * area);
                Some(reluctance)
            }
            _ => None,
        }
    }

    /// Get MMF source [A-turns]
    pub fn get_mmf(&self) -> Option<f64> {
        match self {
            Self::Winding { turns, current } => Some(turns * current),
            Self::PermanentMagnet { residual_flux, .. } => {
                // Estimate MMF from residual flux (simplified)
                Some(residual_flux * 1000.0)  // rough scaling
            }
            _ => None,
        }
    }

    /// Get transformer coupling information
    pub fn get_transformer_params(&self) -> Option<(f64, f64, f64)> {
        match self {
            Self::Transformer { primary_turns, secondary_turns, coupling_factor } => {
                Some((*primary_turns, *secondary_turns, *coupling_factor))
            }
            _ => None,
        }
    }

    /// Validate component parameters
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::CoreSegment { relative_permeability, length, area } => {
                if *relative_permeability <= 0.0 {
                    return Err("Relative permeability must be positive".to_string());
                }
                if *length <= 0.0 {
                    return Err("Core length must be positive".to_string());
                }
                if *area <= 0.0 {
                    return Err("Core area must be positive".to_string());
                }
                Ok(())
            }
            Self::AirGap { length, area } => {
                if *length < 0.0 {
                    return Err("Air gap length must be non-negative".to_string());
                }
                if *area <= 0.0 {
                    return Err("Air gap area must be positive".to_string());
                }
                Ok(())
            }
            Self::Winding { turns, current } => {
                if *turns <= 0.0 {
                    return Err("Number of turns must be positive".to_string());
                }
                // Current can be positive or negative
                Ok(())
            }
            Self::Transformer { primary_turns, secondary_turns, coupling_factor } => {
                if *primary_turns <= 0.0 || *secondary_turns <= 0.0 {
                    return Err("Turn counts must be positive".to_string());
                }
                if *coupling_factor < 0.0 || *coupling_factor > 1.0 {
                    return Err("Coupling factor must be between 0 and 1".to_string());
                }
                Ok(())
            }
            Self::Reluctance { reluctance } => {
                if *reluctance < 0.0 {
                    return Err("Reluctance must be non-negative".to_string());
                }
                Ok(())
            }
            Self::PermanentMagnet { residual_flux, coercivity } => {
                if *residual_flux < 0.0 {
                    return Err("Residual flux must be non-negative".to_string());
                }
                if *coercivity < 0.0 {
                    return Err("Coercivity must be non-negative".to_string());
                }
                Ok(())
            }
            Self::SaturatingCore { linear_permeability, saturation_flux, length, area } => {
                if *linear_permeability <= 0.0 {
                    return Err("Permeability must be positive".to_string());
                }
                if *saturation_flux <= 0.0 {
                    return Err("Saturation flux must be positive".to_string());
                }
                if *length <= 0.0 || *area <= 0.0 {
                    return Err("Core dimensions must be positive".to_string());
                }
                Ok(())
            }
            Self::MagneticGround => Ok(()),
        }
    }
}

/// Magnetic analysis helpers
pub mod analysis {
    use super::*;

    /// Calculate reluctance of a magnetic path
    /// R_m = length / (μ × A) [A-turns/Wb]
    pub fn reluctance(
        relative_permeability: f64,
        length: f64,
        area: f64,
    ) -> Result<f64, String> {
        if length < 0.0 {
            return Err("Length must be non-negative".to_string());
        }
        if area <= 0.0 {
            return Err("Area must be positive".to_string());
        }
        if relative_permeability <= 0.0 {
            return Err("Permeability must be positive".to_string());
        }

        let mu_0 = 4.0 * PI * 1e-7;  // [H/m]
        let r_m = length / (mu_0 * relative_permeability * area);
        Ok(r_m)
    }

    /// Calculate air gap reluctance
    /// Much higher than core reluctance
    pub fn air_gap_reluctance(length: f64, area: f64) -> Result<f64, String> {
        reluctance(1.0, length, area)  // μ_r = 1 for air
    }

    /// Calculate flux from MMF and reluctance
    /// Φ = F / R_m [Wb]
    pub fn flux_from_mmf(mmf: f64, reluctance: f64) -> f64 {
        if reluctance > 0.0 {
            mmf / reluctance
        } else {
            0.0
        }
    }

    /// Calculate flux density
    /// B = Φ / A [Tesla]
    pub fn flux_density(flux: f64, area: f64) -> Result<f64, String> {
        if area <= 0.0 {
            return Err("Area must be positive".to_string());
        }
        Ok(flux / area)
    }

    /// Calculate transformer voltage ratio
    /// V_secondary / V_primary = N_secondary / N_primary
    pub fn transformer_voltage_ratio(primary_turns: f64, secondary_turns: f64) -> f64 {
        if primary_turns > 0.0 {
            secondary_turns / primary_turns
        } else {
            0.0
        }
    }

    /// Calculate transformer current ratio (inverse of voltage ratio)
    /// I_secondary / I_primary = N_primary / N_secondary
    pub fn transformer_current_ratio(primary_turns: f64, secondary_turns: f64) -> f64 {
        if secondary_turns > 0.0 {
            primary_turns / secondary_turns
        } else {
            0.0
        }
    }

    /// Calculate transformer impedance transformation
    /// Z_secondary = (N_secondary / N_primary)² × Z_primary
    pub fn transformer_impedance_transform(
        primary_turns: f64,
        secondary_turns: f64,
        primary_impedance: f64,
    ) -> f64 {
        let ratio = transformer_voltage_ratio(primary_turns, secondary_turns);
        ratio * ratio * primary_impedance
    }

    /// Calculate inductance from reluctance
    /// L = N² / R_m [H]
    pub fn inductance_from_reluctance(turns: f64, reluctance: f64) -> f64 {
        if reluctance > 0.0 {
            (turns * turns) / reluctance
        } else {
            0.0
        }
    }

    /// Magnetic energy stored in field
    /// E = (1/2) × Φ × F = (1/2) × L × I² [J]
    pub fn magnetic_energy(flux: f64, mmf: f64) -> f64 {
        0.5 * flux * mmf
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_core_segment() {
        let core = MagneticComponent::CoreSegment {
            relative_permeability: 1000.0,
            length: 0.1,
            area: 0.001,
        };
        assert_eq!(core.name(), "Core Segment");
        assert!(core.get_reluctance().is_some());
        assert!(core.validate().is_ok());
    }

    #[test]
    fn test_air_gap() {
        let gap = MagneticComponent::AirGap {
            length: 0.001,
            area: 0.001,
        };
        assert_eq!(gap.name(), "Air Gap");
        assert!(gap.get_reluctance().is_some());
        assert!(gap.validate().is_ok());
    }

    #[test]
    fn test_winding() {
        let winding = MagneticComponent::Winding {
            turns: 100.0,
            current: 1.0,
        };
        assert_eq!(winding.name(), "Winding");
        assert_eq!(winding.get_mmf(), Some(100.0));
        assert!(winding.validate().is_ok());
    }

    #[test]
    fn test_transformer() {
        let xfmr = MagneticComponent::Transformer {
            primary_turns: 100.0,
            secondary_turns: 50.0,
            coupling_factor: 0.99,
        };
        assert_eq!(xfmr.name(), "Transformer");
        assert!(xfmr.get_transformer_params().is_some());
        assert!(xfmr.validate().is_ok());
    }

    #[test]
    fn test_reluctance() {
        let r_reluctance = MagneticComponent::Reluctance {
            reluctance: 1e6,
        };
        assert_eq!(r_reluctance.name(), "Reluctance");
        assert_eq!(r_reluctance.get_reluctance(), Some(1e6));
        assert!(r_reluctance.validate().is_ok());
    }

    #[test]
    fn test_permanent_magnet() {
        let pm = MagneticComponent::PermanentMagnet {
            residual_flux: 0.1,
            coercivity: 300000.0,
        };
        assert_eq!(pm.name(), "Permanent Magnet");
        assert!(pm.get_mmf().is_some());
        assert!(pm.validate().is_ok());
    }

    #[test]
    fn test_reluctance_calculation() {
        let r_m = analysis::reluctance(1000.0, 0.1, 0.001)
            .expect("Reluctance calculation failed");
        assert!(r_m > 0.0);
    }

    #[test]
    fn test_air_gap_reluctance() {
        let r_m = analysis::air_gap_reluctance(0.001, 0.001)
            .expect("Air gap reluctance failed");
        assert!(r_m > 0.0);
    }

    #[test]
    fn test_flux_from_mmf() {
        let mmf = 100.0;  // A-turns
        let reluctance = 1e6;  // A-turns/Wb
        let flux = analysis::flux_from_mmf(mmf, reluctance);
        assert!((flux - 1e-4).abs() < 1e-8);
    }

    #[test]
    fn test_transformer_ratios() {
        let v_ratio = analysis::transformer_voltage_ratio(100.0, 50.0);
        assert!((v_ratio - 0.5).abs() < 1e-6);

        let i_ratio = analysis::transformer_current_ratio(100.0, 50.0);
        assert!((i_ratio - 2.0).abs() < 1e-6);
    }

    #[test]
    fn test_inductance_from_reluctance() {
        let turns = 100.0;
        let reluctance = 1e6;
        let l = analysis::inductance_from_reluctance(turns, reluctance);
        assert!(l > 0.0);
    }

    #[test]
    fn test_magnetic_energy() {
        let flux = 0.1;  // Wb
        let mmf = 100.0;  // A-turns
        let energy = analysis::magnetic_energy(flux, mmf);
        assert!((energy - 5.0).abs() < 0.1);
    }

    #[test]
    fn test_invalid_components() {
        let bad_core = MagneticComponent::CoreSegment {
            relative_permeability: -1000.0,
            length: 0.1,
            area: 0.001,
        };
        assert!(bad_core.validate().is_err());

        let bad_xfmr = MagneticComponent::Transformer {
            primary_turns: 100.0,
            secondary_turns: 50.0,
            coupling_factor: 1.5,  // > 1
        };
        assert!(bad_xfmr.validate().is_err());
    }
}
