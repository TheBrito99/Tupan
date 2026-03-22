//! Magnetic Circuit Solver
//!
//! Uses MNA with the analogy:
//! - MMF (magnetomotive force) [A-turns] ↔ Voltage (V) [V]
//! - Flux (Φ) [Wb] ↔ Current (I) [A]
//! - Reluctance (R_m) [A-turns/Wb] ↔ Resistance (R) [Ω]
//!
//! Governing equation: G × F = Φ
//! where G = 1/R_m (permeance), F = MMF vector, Φ = flux source vector

use super::components::{MagneticComponent, analysis};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Magnetic circuit analyzer
/// Maps magnetic components to MNA equation: G × F = Φ
pub struct MagneticAnalyzer {
    /// Component reluctances [A-turns/Wb]
    reluctances: HashMap<(usize, usize), f64>,
    /// MMF sources [A-turns]
    mmf_sources: HashMap<usize, f64>,
    /// Flux sources [Wb]
    flux_sources: HashMap<usize, f64>,
    /// Node count
    node_count: usize,
}

impl MagneticAnalyzer {
    /// Create new magnetic analyzer
    pub fn new() -> Self {
        MagneticAnalyzer {
            reluctances: HashMap::new(),
            mmf_sources: HashMap::new(),
            flux_sources: HashMap::new(),
            node_count: 0,
        }
    }

    /// Build magnetic circuit from components and connections
    fn build_circuit(
        &mut self,
        components: &[(usize, usize, MagneticComponent)],
        mmf_sources: &[(usize, f64)],
    ) -> Result<(), String> {
        // Clear previous state
        self.reluctances.clear();
        self.mmf_sources.clear();
        self.flux_sources.clear();

        // Find maximum node index
        let mut max_node = 0;
        for (from, to, _comp) in components {
            if *from > max_node { max_node = *from; }
            if *to > max_node { max_node = *to; }
        }
        self.node_count = max_node + 1;

        // Process components
        for (from, to, comp) in components {
            comp.validate()?;

            // Extract reluctance [A-turns/Wb]
            if let Some(r_m) = comp.get_reluctance() {
                if r_m > 0.0 {
                    self.reluctances.insert((*from, *to), r_m);
                }
            }

            // Extract MMF source [A-turns]
            if let Some(mmf) = comp.get_mmf() {
                self.mmf_sources.insert(*from, mmf);
            }
        }

        // Add external MMF sources
        for (node, mmf) in mmf_sources {
            *self.mmf_sources.entry(*node).or_insert(0.0) += mmf;
        }

        Ok(())
    }

    /// Solve steady-state flux distribution
    /// G × F = Φ where G is permeance matrix, F is MMF vector
    pub fn solve_steady_state(
        &mut self,
        components: &[(usize, usize, MagneticComponent)],
        mmf_sources: &[(usize, f64)],
    ) -> Result<Vec<f64>, String> {
        self.build_circuit(components, mmf_sources)?;

        // Build permeance matrix: G = 1/R_m for each reluctance
        let mut g_matrix = DMatrix::<f64>::zeros(self.node_count, self.node_count);
        for ((from, to), r_m) in &self.reluctances {
            let g = 1.0 / r_m;  // permeance = 1/reluctance
            g_matrix[(*from, *from)] += g;
            g_matrix[(*to, *to)] += g;
            g_matrix[(*from, *to)] -= g;
            g_matrix[(*to, *from)] -= g;
        }

        // Build MMF source vector: F (A-turns)
        let mut f_vector = DVector::<f64>::zeros(self.node_count);
        for (node, mmf) in &self.mmf_sources {
            f_vector[*node] += mmf;
        }

        // Solve system: F = G^-1 × Φ or Φ = G × F
        // Rearrange for solving: Find flux distribution
        match g_matrix.try_inverse() {
            Some(g_inv) => {
                let flux = g_inv * f_vector;
                Ok(flux.as_slice().to_vec())
            }
            None => Err("Magnetic circuit matrix is singular".to_string()),
        }
    }

    /// Calculate flux density [Tesla]
    /// B = Φ / A where A is cross-sectional area
    pub fn calculate_flux_density(
        &self,
        flux: f64,
        area: f64,
    ) -> Result<f64, String> {
        if area <= 0.0 {
            return Err("Area must be positive".to_string());
        }
        Ok(flux / area)
    }

    /// Calculate core inductance [H]
    /// L = N² / R_m
    pub fn calculate_inductance(
        &self,
        turns: f64,
        reluctance: f64,
    ) -> Result<f64, String> {
        if reluctance <= 0.0 {
            return Err("Reluctance must be positive".to_string());
        }
        Ok((turns * turns) / reluctance)
    }

    /// Get node count
    pub fn node_count(&self) -> usize {
        self.node_count
    }
}

/// Magnetic validation helper
pub struct MagneticValidator;

impl MagneticValidator {
    /// Validate magnetic circuit for analysis
    pub fn validate_system(
        components: &[(usize, usize, MagneticComponent)],
    ) -> Result<(), String> {
        // Check component validity
        for (_, _, comp) in components {
            comp.validate()?;
        }

        // Check for at least one component
        if components.is_empty() {
            return Err("Circuit must have at least one component".to_string());
        }

        // Check for at least one MMF source
        let has_mmf = components.iter().any(|(_, _, c)| c.get_mmf().is_some());
        if !has_mmf {
            return Err("Circuit must have at least one MMF source".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyzer_creation() {
        let analyzer = MagneticAnalyzer::new();
        assert_eq!(analyzer.node_count(), 0);
    }

    #[test]
    fn test_simple_reluctance_circuit() {
        let components = vec![
            (0, 1, MagneticComponent::Reluctance { reluctance: 1e6 }),
        ];
        let mmf_sources = vec![(0, 100.0)];  // 100 A-turns

        let mut analyzer = MagneticAnalyzer::new();
        let flux = analyzer.solve_steady_state(&components, &mmf_sources)
            .expect("Steady-state solve failed");

        // Φ = F / R_m = 100 / 1e6 = 1e-4 Wb
        assert_eq!(flux.len(), 2);
        assert!((flux[0] - 1e-4).abs() < 1e-8);
    }

    #[test]
    fn test_series_reluctances() {
        let components = vec![
            (0, 1, MagneticComponent::Reluctance { reluctance: 5e5 }),
            (1, 2, MagneticComponent::Reluctance { reluctance: 5e5 }),
        ];
        let mmf_sources = vec![(0, 100.0)];

        let mut analyzer = MagneticAnalyzer::new();
        let flux = analyzer.solve_steady_state(&components, &mmf_sources)
            .expect("Series solve failed");

        // Total reluctance = 1e6, Φ = 100 / 1e6 = 1e-4 Wb
        assert_eq!(flux.len(), 3);
    }

    #[test]
    fn test_core_and_air_gap() {
        let core = MagneticComponent::CoreSegment {
            relative_permeability: 1000.0,
            length: 0.1,
            area: 0.001,
        };
        let gap = MagneticComponent::AirGap {
            length: 0.001,
            area: 0.001,
        };

        let components = vec![
            (0, 1, core),
            (1, 2, gap),
        ];
        let mmf_sources = vec![(0, 100.0)];

        let mut analyzer = MagneticAnalyzer::new();
        let flux = analyzer.solve_steady_state(&components, &mmf_sources)
            .expect("Core+gap solve failed");

        assert_eq!(flux.len(), 3);
    }

    #[test]
    fn test_winding_mmf() {
        let winding = MagneticComponent::Winding {
            turns: 100.0,
            current: 1.0,
        };
        let reluctance = MagneticComponent::Reluctance { reluctance: 1e6 };

        let components = vec![
            (0, 1, winding),
            (1, 2, reluctance),
        ];
        let mmf_sources = vec![];

        let mut analyzer = MagneticAnalyzer::new();
        let flux = analyzer.solve_steady_state(&components, &mmf_sources)
            .expect("Winding test failed");

        // Winding creates 100 A-turns MMF
        assert_eq!(flux.len(), 3);
    }

    #[test]
    fn test_transformer_coupling() {
        let xfmr = MagneticComponent::Transformer {
            primary_turns: 100.0,
            secondary_turns: 50.0,
            coupling_factor: 0.95,
        };
        let reluctance = MagneticComponent::Reluctance { reluctance: 1e6 };

        let components = vec![
            (0, 1, xfmr),
            (1, 2, reluctance),
        ];
        let mmf_sources = vec![(0, 100.0)];

        let mut analyzer = MagneticAnalyzer::new();
        let _flux = analyzer.solve_steady_state(&components, &mmf_sources)
            .expect("Transformer test failed");
    }

    #[test]
    fn test_flux_density_calculation() {
        let analyzer = MagneticAnalyzer::new();
        let flux = 0.1;  // Wb
        let area = 0.001;  // m²
        let b = analyzer.calculate_flux_density(flux, area)
            .expect("Flux density calculation failed");

        assert!((b - 100.0).abs() < 0.1);  // 0.1 Wb / 0.001 m² = 100 T
    }

    #[test]
    fn test_inductance_calculation() {
        let analyzer = MagneticAnalyzer::new();
        let turns = 100.0;
        let reluctance = 1e6;  // A-turns/Wb
        let l = analyzer.calculate_inductance(turns, reluctance)
            .expect("Inductance calculation failed");

        // L = N² / R_m = 10000 / 1e6 = 0.01 H
        assert!((l - 0.01).abs() < 1e-6);
    }

    #[test]
    fn test_permanent_magnet() {
        let pm = MagneticComponent::PermanentMagnet {
            residual_flux: 0.1,
            coercivity: 300000.0,
        };
        let reluctance = MagneticComponent::Reluctance { reluctance: 1e6 };

        let components = vec![
            (0, 1, pm),
            (1, 2, reluctance),
        ];
        let mmf_sources = vec![];

        let mut analyzer = MagneticAnalyzer::new();
        let _flux = analyzer.solve_steady_state(&components, &mmf_sources)
            .expect("Permanent magnet test failed");
    }

    #[test]
    fn test_invalid_system() {
        let components = vec![];
        assert!(MagneticValidator::validate_system(&components).is_err());
    }

    #[test]
    fn test_no_mmf_source() {
        let reluctance = MagneticComponent::Reluctance { reluctance: 1e6 };
        let components = vec![(0, 1, reluctance)];
        assert!(MagneticValidator::validate_system(&components).is_err());
    }

    #[test]
    fn test_transformer_voltage_ratio() {
        let ratio = analysis::transformer_voltage_ratio(100.0, 50.0);
        assert!((ratio - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_transformer_impedance_transform() {
        let z_primary = 50.0;  // Ohms
        let z_secondary = analysis::transformer_impedance_transform(100.0, 50.0, z_primary);
        // Z_secondary = (50/100)² × 50 = 12.5 Ohms
        assert!((z_secondary - 12.5).abs() < 0.1);
    }
}
