//! Magnetic Systems Simulator
//!
//! Magnetic systems use flux and magnetomotive force (MMF) dynamics.
//!
//! Magnetic ↔ Electrical Analogy:
//! ├─ Magnetomotive Force (MMF) [A-turns] ↔ Voltage (V) [V]
//! ├─ Magnetic Flux (Φ) [Wb] ↔ Current (I) [A]
//! ├─ Reluctance (R_m) [A-turns/Wb] ↔ Resistance (R) [Ω]
//! └─ Magnetic Capacitance [Wb·s/A-turns] ↔ Capacitance (C) [F]
//!
//! This enables reusing MNA solver for magnetic analysis!
//! Same equation: G × X = Y
//! - G = 1/R_m (reluctance conductance, permeance)
//! - X = MMF vector (magnetomotive force)
//! - Y = flux source vector (magnetic flux)

pub mod components;
pub mod solver;

pub use components::MagneticComponent;
pub use solver::MagneticAnalyzer;

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Material properties for magnetic cores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MagneticMaterial {
    /// Relative permeability [dimensionless]
    pub relative_permeability: f64,
    /// Saturation flux density [Tesla]
    pub saturation_flux: f64,
    /// Coercivity [A/m]
    pub coercivity: f64,
    /// Electrical resistivity [Ω·m] for eddy current loss
    pub resistivity: f64,
}

/// Standard material presets
impl MagneticMaterial {
    /// Soft iron (high permeability, low loss)
    pub fn soft_iron() -> Self {
        MagneticMaterial {
            relative_permeability: 4000.0,
            saturation_flux: 2.0,     // Tesla
            coercivity: 80.0,         // A/m
            resistivity: 1e-7,        // Ω·m
        }
    }

    /// Silicon steel (transformer core)
    pub fn silicon_steel() -> Self {
        MagneticMaterial {
            relative_permeability: 5000.0,
            saturation_flux: 2.0,
            coercivity: 40.0,
            resistivity: 5e-7,
        }
    }

    /// Ferrite (high frequency, high coercivity)
    pub fn ferrite() -> Self {
        MagneticMaterial {
            relative_permeability: 2000.0,
            saturation_flux: 0.5,
            coercivity: 300000.0,     // Much higher
            resistivity: 10.0,        // Much higher resistivity
        }
    }

    /// Nickel-Iron (Permalloy, ultra-high permeability)
    pub fn permalloy() -> Self {
        MagneticMaterial {
            relative_permeability: 100000.0,
            saturation_flux: 1.6,
            coercivity: 0.8,          // Very low
            resistivity: 1e-6,
        }
    }
}

/// Magnetic system analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MagneticAnalysisResult {
    /// Node MMFs (magnetomotive forces) [A-turns]
    pub node_mmfs: Vec<f64>,
    /// Magnetic flux values [Wb]
    pub flux_values: Vec<f64>,
    /// Simulation time [s]
    pub simulation_time: f64,
}

/// Transient magnetic analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MagneticTransientResult {
    /// Time vector [s]
    pub time_vector: Vec<f64>,
    /// MMF at each node over time [A-turns]
    pub node_mmfs: Vec<Vec<f64>>,
    /// Flux over time [Wb]
    pub flux_values: Vec<Vec<f64>>,
    /// Number of simulation steps
    pub step_count: usize,
}

/// Magnetic system validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MagneticValidation {
    /// System is valid for analysis
    pub is_valid: bool,
    /// Validation issues (if any)
    pub issues: Vec<String>,
    /// Number of magnetizing sources
    pub magnetizing_sources: usize,
    /// Number of floating nodes (ground)
    pub floating_nodes: usize,
}

/// Magnetic system statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MagneticStats {
    /// Total nodes in magnetic circuit
    pub total_nodes: usize,
    /// Number of magnetic paths
    pub magnetic_paths: usize,
    /// Number of windings (coils)
    pub total_windings: usize,
    /// Number of air gaps
    pub air_gaps: usize,
    /// Maximum flux density [Tesla]
    pub max_flux_density: f64,
}

/// Magnetic domain module
pub struct MagneticDomain {
    name: String,
    reference_material: MagneticMaterial,
}

impl MagneticDomain {
    /// Create new magnetic domain
    pub fn new(name: &str, material: MagneticMaterial) -> Self {
        MagneticDomain {
            name: name.to_string(),
            reference_material: material,
        }
    }

    /// Get reference material properties
    pub fn get_material(&self) -> &MagneticMaterial {
        &self.reference_material
    }

    /// Create new analyzer
    pub fn new_analyzer(&self) -> MagneticAnalyzer {
        MagneticAnalyzer::new()
    }

    /// Get system statistics
    pub fn get_statistics(&self) -> MagneticStats {
        MagneticStats {
            total_nodes: 0,
            magnetic_paths: 0,
            total_windings: 0,
            air_gaps: 0,
            max_flux_density: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_material_properties() {
        let soft_iron = MagneticMaterial::soft_iron();
        assert!(soft_iron.relative_permeability > 0.0);
        assert!(soft_iron.saturation_flux > 0.0);

        let ferrite = MagneticMaterial::ferrite();
        assert!(ferrite.coercivity > soft_iron.coercivity);

        let permalloy = MagneticMaterial::permalloy();
        assert!(permalloy.relative_permeability > soft_iron.relative_permeability);
    }

    #[test]
    fn test_magnetic_domain_creation() {
        let material = MagneticMaterial::silicon_steel();
        let domain = MagneticDomain::new("Transformer", material);
        assert_eq!(domain.name, "Transformer");
    }
}
