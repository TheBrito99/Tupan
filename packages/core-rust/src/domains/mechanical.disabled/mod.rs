//! Mechanical Systems Simulator
//!
//! Mechanical systems use force/velocity dynamics to model motion, damping, and inertia.
//!
//! Mechanical ↔ Electrical Analogy:
//! ├─ Force (F) [N] ↔ Voltage (V) [V]
//! ├─ Velocity (v) [m/s] ↔ Current (I) [A]
//! ├─ Damping (f) [N·s/m] ↔ Resistance (R) [Ω]
//! └─ Mass (m) [kg] ↔ Capacitance (C) [F]
//!
//! This enables reusing MNA solver for mechanical analysis!
//! Same equation: G × X = Y
//! - G = damping matrix (f in N·s/m)
//! - X = velocity vector (v in m/s)
//! - Y = force source vector (F in N)

pub mod components;
pub mod solver;

pub use components::MechanicalComponent;
pub use solver::MechanicalAnalyzer;

use serde::{Deserialize, Serialize};

/// Physical properties for mechanical materials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialProperties {
    /// Density [kg/m³]
    pub density: f64,
    /// Young's modulus [Pa]
    pub youngs_modulus: f64,
    /// Shear modulus [Pa]
    pub shear_modulus: f64,
    /// Poisson's ratio [dimensionless]
    pub poissons_ratio: f64,
}

/// Standard material presets
impl MaterialProperties {
    /// Steel (common structural material)
    pub fn steel() -> Self {
        MaterialProperties {
            density: 7850.0,          // kg/m³
            youngs_modulus: 200e9,    // Pa
            shear_modulus: 80e9,      // Pa
            poissons_ratio: 0.3,
        }
    }

    /// Aluminum (lightweight alternative)
    pub fn aluminum() -> Self {
        MaterialProperties {
            density: 2700.0,
            youngs_modulus: 70e9,
            shear_modulus: 26e9,
            poissons_ratio: 0.33,
        }
    }

    /// Titanium (high-strength-to-weight)
    pub fn titanium() -> Self {
        MaterialProperties {
            density: 4500.0,
            youngs_modulus: 103e9,
            shear_modulus: 44e9,
            poissons_ratio: 0.32,
        }
    }

    /// Copper (electrical and thermal conductor)
    pub fn copper() -> Self {
        MaterialProperties {
            density: 8960.0,
            youngs_modulus: 110e9,
            shear_modulus: 42e9,
            poissons_ratio: 0.34,
        }
    }

    /// Plastic/Polymer
    pub fn polymer() -> Self {
        MaterialProperties {
            density: 1200.0,
            youngs_modulus: 3e9,
            shear_modulus: 1.2e9,
            poissons_ratio: 0.35,
        }
    }
}

/// Mechanical system analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalAnalysisResult {
    /// Node velocities [m/s]
    pub node_velocities: Vec<f64>,
    /// Forces between nodes [N]
    pub forces: Vec<f64>,
    /// Simulation time [s]
    pub simulation_time: f64,
}

/// Transient mechanical analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalTransientResult {
    /// Time vector [s]
    pub time_vector: Vec<f64>,
    /// Velocity at each node over time [m/s]
    pub node_velocities: Vec<Vec<f64>>,
    /// Displacement at each node [m]
    pub displacements: Vec<Vec<f64>>,
    /// Number of simulation steps
    pub step_count: usize,
}

/// Mechanical system validation helper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalValidation {
    /// System is valid for analysis
    pub is_valid: bool,
    /// Validation issues (if any)
    pub issues: Vec<String>,
    /// Number of nodes with boundary conditions
    pub nodes_with_constraints: usize,
    /// Number of floating nodes (unconstrained)
    pub floating_nodes: usize,
    /// Total force sources
    pub total_force_sources: usize,
}

/// Mechanical system statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalStats {
    /// Total nodes in system
    pub total_nodes: usize,
    /// Nodes with boundary conditions
    pub nodes_with_constraints: usize,
    /// Floating nodes
    pub floating_nodes: usize,
    /// Number of dampers
    pub total_dampers: usize,
    /// Number of masses
    pub total_masses: usize,
    /// Number of force sources
    pub total_force_sources: usize,
    /// Number of spring elements
    pub total_springs: usize,
    /// Number of nonlinear elements
    pub nonlinear_elements: usize,
}

/// Mechanical domain module
pub struct MechanicalDomain {
    name: String,
    ambient_velocity: f64,  // [m/s] - reference velocity (usually 0)
    solver: Option<MechanicalAnalyzer>,
}

impl MechanicalDomain {
    /// Create new mechanical domain
    pub fn new(name: &str) -> Self {
        MechanicalDomain {
            name: name.to_string(),
            ambient_velocity: 0.0,
            solver: None,
        }
    }

    /// Set ambient/reference velocity
    pub fn set_ambient_velocity(&mut self, vel: f64) {
        self.ambient_velocity = vel;
    }

    /// Perform steady-state analysis
    pub fn analyze_dc(&self) -> Result<MechanicalAnalysisResult, String> {
        let solver = self.solver.as_ref()
            .ok_or("Solver not initialized")?;

        let node_velocities = solver.solve_steady_state()?;

        Ok(MechanicalAnalysisResult {
            node_velocities,
            forces: Vec::new(),
            simulation_time: 0.0,
        })
    }

    /// Perform transient (time-domain) analysis
    pub fn analyze_transient(
        &self,
        duration: f64,
        time_step: f64,
    ) -> Result<MechanicalTransientResult, String> {
        let solver = self.solver.as_ref()
            .ok_or("Solver not initialized")?;

        let (time_vector, velocities, displacements) = solver.solve_transient(duration, time_step)?;

        Ok(MechanicalTransientResult {
            time_vector,
            node_velocities: velocities,
            displacements,
            step_count: (duration / time_step) as usize,
        })
    }

    /// Get system statistics
    pub fn get_statistics(&self) -> MechanicalStats {
        MechanicalStats {
            total_nodes: 0,
            nodes_with_constraints: 0,
            floating_nodes: 0,
            total_dampers: 0,
            total_masses: 0,
            total_force_sources: 0,
            total_springs: 0,
            nonlinear_elements: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_material_properties() {
        let steel = MaterialProperties::steel();
        assert_eq!(steel.density, 7850.0);
        assert!(steel.youngs_modulus > 0.0);

        let aluminum = MaterialProperties::aluminum();
        assert!(aluminum.density < steel.density);

        let titanium = MaterialProperties::titanium();
        assert!(titanium.density > aluminum.density);
    }

    #[test]
    fn test_mechanical_domain_creation() {
        let domain = MechanicalDomain::new("Test System");
        assert_eq!(domain.name, "Test System");
        assert_eq!(domain.ambient_velocity, 0.0);
    }

    #[test]
    fn test_ambient_velocity_setting() {
        let mut domain = MechanicalDomain::new("Test");
        domain.set_ambient_velocity(5.0);
        assert_eq!(domain.ambient_velocity, 5.0);
    }
}
