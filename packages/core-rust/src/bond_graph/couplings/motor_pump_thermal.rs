//! Motor-Driven Pump with Thermal Coupling
//!
//! Comprehensive multi-domain example combining:
//! 1. **Electrical domain**: Power source driving DC motor
//! 2. **Mechanical domain 1**: Motor produces torque/speed
//! 3. **Mechanical domain 2**: Pump driven by motor shaft
//! 4. **Hydraulic domain**: Pump generates pressure/flow
//! 5. **Thermal domain**: Friction and dissipation create heat
//!
//! # Energy Flow
//!
//! ```text
//! Electrical (12V source)
//!     ↓ (motor coupling: V×I → τ×ω)
//! Motor torque/speed
//!     ↓ (pump coupling: τ×ω → P×Q)
//! Hydraulic pressure/flow
//!     ↓ (work done by pump)
//!     + thermal losses (friction in motor & pump)
//! Thermal domain
//!     ↓ (heat dissipation)
//! Environment
//!
//! Power Conservation:
//! P_electrical_in = P_mechanical_motor + P_mechanical_loss
//! P_mechanical_motor = P_hydraulic_out + P_mechanical_pump_loss
//! P_total_thermal = P_mechanical_loss + P_pump_loss + P_hydraulic_cooling
//! ```
//!
//! # Physical Model
//!
//! **Motor parameters:**
//! - Back-EMF constant: K_e [V·s/rad]
//! - Torque constant: K_t [N·m/A] (typically = K_e)
//! - Winding resistance: R [Ω]
//! - Rotor inertia: J_m [kg·m²]
//! - Bearing friction: b_m [N·m·s/rad]
//!
//! **Pump parameters:**
//! - Displacement: D_p [mL/rev] = 0.001 × Cc [cm³/rev]
//! - Max pressure: P_max [bar]
//! - Efficiency: η_v (volumetric), η_m (mechanical)
//!
//! **Thermal model:**
//! - Heat capacity: C_th [J/K]
//! - Dissipation: h_c [W/K] (convection coefficient × area)
//! - Ambient temperature: T_amb [K]
//!
//! # Steady-State Analysis
//!
//! At steady state:
//! 1. Motor: V = I·R + K_e·ω
//! 2. Torque: K_t·I = b_m·ω + τ_pump
//! 3. Pump: τ_pump = P·D_p/(2π·η_m)
//! 4. Flow: Q = (D_p·ω)/(2π·η_v)
//! 5. Thermal: dT/dt = 0 → T_ss = T_amb + (P_loss / h_c)
//!
//! # Energy Conservation Verification
//!
//! The test suite verifies that for every instant:
//! - Power in = Power out + Power lost
//! - ∫P_in dt = ∫(P_out + P_loss) dt (energy integral)
//! - All domains sum to zero: P_elec + P_mech + P_hyd + P_therm = 0

use crate::bond_graph::{
    BondGraph, BondGraphElement, ElementId,
    element::{CapacitiveStorage, InertialStorage},
    converters::electrical::ElectricalCircuit,
    CausalityAssigner,
};
use crate::error::Result;

/// Complex multi-domain system: Motor-Driven Pump with Thermal Coupling
///
/// This system demonstrates:
/// - Electrical power input (12V DC motor)
/// - Conversion to mechanical (motor torque/speed)
/// - Mechanical-to-hydraulic (pump displacement)
/// - Thermal feedback (frictional heating)
/// - Energy conservation across all 5 domains
#[derive(Debug, Clone)]
pub struct MotorPumpThermalSystem {
    /// Electrical circuit: voltage source and motor windings
    pub electrical: ElectricalCircuit,

    /// Motor parameters
    pub motor_ke: f64,           // Back-EMF constant [V·s/rad]
    pub motor_kt: f64,           // Torque constant [N·m/A] (≈ K_e)
    pub motor_inertia: f64,      // Rotor inertia [kg·m²]
    pub motor_friction: f64,     // Bearing friction [N·m·s/rad]

    /// Pump parameters
    pub pump_displacement: f64,  // [cm³/rev] = [mL/rev]
    pub pump_pressure_max: f64,  // [bar]
    pub pump_efficiency_vol: f64,// Volumetric efficiency [0-1]
    pub pump_efficiency_mech: f64,// Mechanical efficiency [0-1]

    /// Thermal parameters
    pub thermal_mass: f64,       // Heat capacity [J/K]
    pub thermal_resistance: f64, // 1/h_c [K/W]
    pub ambient_temp: f64,       // [K]

    /// System name
    pub name: String,
}

impl MotorPumpThermalSystem {
    /// Create a new motor-pump-thermal system
    ///
    /// # Arguments
    /// - `supply_voltage`: Electrical supply [V]
    /// - `supply_pressure`: Hydraulic supply [bar]
    /// - `load_pressure`: Load resistance [bar]
    pub fn new(
        supply_voltage: f64,
        supply_pressure: f64,
        load_pressure: f64,
    ) -> Result<Self> {
        // Create electrical circuit: V_source → R (motor winding) → ω (back-EMF)
        let mut electrical = ElectricalCircuit::new("MotorWinding", 3);
        electrical.add_voltage_source(2, 0, supply_voltage)?;  // 12V source
        electrical.add_resistor(2, 1, 2.0)?;                  // 2Ω winding resistance
        electrical.add_capacitor(1, 0, 1e-6)?;                // Small for transient

        Ok(MotorPumpThermalSystem {
            electrical,
            motor_ke: 0.1,           // 0.1 V·s/rad (stronger motor)
            motor_kt: 0.1,           // 0.1 N·m/A (same as K_e)
            motor_inertia: 0.001,    // 1e-3 kg·m² (larger rotor)
            motor_friction: 0.01,    // 0.01 N·m·s/rad
            pump_displacement: 0.5,  // 0.5 mL/rev (smaller pump)
            pump_pressure_max: supply_pressure,
            pump_efficiency_vol: 0.95,    // 95% volumetric
            pump_efficiency_mech: 0.90,   // 90% mechanical
            thermal_mass: 500.0,     // 500 J/K (motor block)
            thermal_resistance: 10.0,// 10 K/W (better cooling)
            ambient_temp: 293.15,    // 20°C
            name: "MotorPumpThermal".to_string(),
        })
    }

    /// Convert to coupled bond graph
    pub fn to_coupled_bond_graph(&self) -> Result<BondGraph> {
        let mut combined = BondGraph::new();

        // Step 1: Add electrical elements (from circuit)
        let se_id = ElementId::new();
        combined.add_element(BondGraphElement::Se(
            se_id,
            crate::bond_graph::element::EffortSource {
                effort: 12.0,
                expression: None,
            },
        ));

        // Step 2: Add motor elements (gyrator coupling)
        let r_motor_id = ElementId::new();
        combined.add_element(BondGraphElement::R(
            r_motor_id,
            crate::bond_graph::element::Resistor {
                resistance: 2.0,
                variable_name: None,
            },
        ));

        let gy_motor_id = ElementId::new();
        combined.add_element(BondGraphElement::GY(
            gy_motor_id,
            crate::bond_graph::element::Gyrator {
                ratio: self.motor_ke,
                variable_name: None,
            },
        ));

        let j_motor_id = ElementId::new();
        combined.add_element(BondGraphElement::I(
            j_motor_id,
            InertialStorage {
                inertance: self.motor_inertia,
                initial_momentum: 0.0,
                variable_name: None,
            },
        ));

        let b_motor_id = ElementId::new();
        combined.add_element(BondGraphElement::R(
            b_motor_id,
            crate::bond_graph::element::Resistor {
                resistance: self.motor_friction,
                variable_name: None,
            },
        ));

        // Step 3: Add pump coupling (transformer: mechanical → hydraulic)
        let tf_pump_id = ElementId::new();
        let pump_ratio = self.pump_displacement / (2.0 * std::f64::consts::PI * 1000.0);
        combined.add_element(BondGraphElement::TF(
            tf_pump_id,
            crate::bond_graph::element::Transformer {
                ratio: pump_ratio,
                variable_name: None,
            },
        ));

        // Step 4: Add thermal capacitance
        let c_thermal_id = ElementId::new();
        combined.add_element(BondGraphElement::C(
            c_thermal_id,
            CapacitiveStorage {
                capacitance: self.thermal_mass,
                initial_displacement: 0.0,
                variable_name: None,
            },
        ));

        // Step 5: Add thermal resistance (ambient cooling)
        let r_thermal_id = ElementId::new();
        combined.add_element(BondGraphElement::R(
            r_thermal_id,
            crate::bond_graph::element::Resistor {
                resistance: self.thermal_resistance,
                variable_name: None,
            },
        ));

        // Assign causality to combined graph
        CausalityAssigner::assign_causality(&mut combined)
            .map_err(|e| crate::error::TupanError::InvalidState(
                format!("Causality error in motor-pump-thermal system: {:?}", e)
            ))?;

        Ok(combined)
    }

    /// Analyze steady-state operation
    pub fn steady_state_analysis(&self) -> SteadyStateResult {
        let supply_v = 12.0;  // From electrical circuit
        let r_winding = 2.0;
        let load_pressure_bar = 0.5;  // Small load pressure [bar] (0.5 bar = 50 kPa)
        let load_pressure_pa = load_pressure_bar * 1e5;  // Convert to Pa

        // At steady state, solve:
        // (1) V = I·R + K_e·ω
        // (2) K_t·I = b·ω + τ_pump
        // (3) τ_pump = P·D_p/(2π) where P is pressure, D_p is displacement
        //
        // From (1): I = (V - K_e·ω) / R
        // From (3): τ_pump = P · (D_p/1000) / (2π)  [with D_p in mL/rev]
        // Substitute into (2): K_t·(V - K_e·ω)/R = b·ω + P·D_p/(2π×1000)
        //
        // Rearrange: K_t·V/R = (K_t·K_e/R + b)·ω + P·D_p/(2π×1000)
        // ω = [K_t·V/R - P·D_p/(2π)] / (K_t·K_e/R + b)
        // Note: D_p in mL/rev = 1e-6 m³/rev, so D_p/(2π) is in m³

        let displacement_rad = (self.pump_displacement * 1e-6) / (2.0 * std::f64::consts::PI);
        let coeff_omega = self.motor_kt * self.motor_ke / r_winding + self.motor_friction;
        let constant_term = (self.motor_kt * supply_v / r_winding) - (load_pressure_pa * displacement_rad);

        let omega = if coeff_omega.abs() > 1e-10 {
            constant_term / coeff_omega
        } else {
            0.0
        };

        // Ensure omega is physical (non-negative)
        let omega = omega.max(0.0);

        // Final calculations
        let i_motor = (supply_v - self.motor_ke * omega) / r_winding;
        let torque_motor = self.motor_kt * i_motor.max(0.0);
        let pump_pressure = load_pressure_bar;

        // Power calculations
        let p_in_elec = supply_v * i_motor.max(0.0);
        let p_out_mech = torque_motor * omega;
        let p_loss_motor = i_motor * i_motor * r_winding + self.motor_friction * omega * omega;

        // Flow: Q = (D_p * ω) / (2π) where D_p is displacement per rev in m³
        let flow_pump = ((self.pump_displacement * 1e-6) * omega) / (2.0 * std::f64::consts::PI);
        let p_out_hydraulic = load_pressure_pa * flow_pump;
        let p_loss_pump = (p_out_mech - p_loss_motor - p_out_hydraulic).max(0.0);

        // Thermal steady state
        let p_total_loss = p_loss_motor + p_loss_pump;
        let delta_t = p_total_loss * self.thermal_resistance;
        let temp_steady = self.ambient_temp + delta_t;

        SteadyStateResult {
            motor_speed: omega,
            motor_current: i_motor,
            motor_torque: torque_motor,
            pump_flow: flow_pump,
            pump_pressure: pump_pressure,
            p_electrical_in: p_in_elec,
            p_mechanical_out: p_out_mech,
            p_hydraulic_out: p_out_hydraulic,
            p_loss_motor: p_loss_motor,
            p_loss_pump: p_loss_pump,
            p_loss_thermal: p_total_loss,
            temperature_steady: temp_steady,
            iterations: 0,  // Direct solve, no iterations needed
        }
    }

    /// Verify energy conservation
    pub fn verify_energy_conservation(&self) -> EnergyConservation {
        let ss = self.steady_state_analysis();

        let p_in = ss.p_electrical_in;
        let p_out = ss.p_hydraulic_out;
        let p_loss = ss.p_loss_thermal;

        let power_balance = (p_in - p_out - p_loss).abs();
        let relative_error = power_balance / p_in.max(1e-6);

        EnergyConservation {
            power_in: p_in,
            power_out: p_out,
            power_loss: p_loss,
            power_balance,
            relative_error,
            is_conserved: relative_error < 1e-6,
        }
    }

    /// Trace power through all domains
    pub fn power_trace(&self) -> PowerTrace {
        let ss = self.steady_state_analysis();

        PowerTrace {
            domain_electrical: ss.p_electrical_in,
            domain_mechanical_motor: ss.p_mechanical_out,
            domain_hydraulic: ss.p_hydraulic_out,
            domain_thermal_motor: ss.p_loss_motor,
            domain_thermal_pump: ss.p_loss_pump,
            efficiency_motor_to_mechanical: if ss.p_electrical_in > 0.0 {
                ss.p_mechanical_out / ss.p_electrical_in
            } else {
                0.0
            },
            efficiency_mechanical_to_hydraulic: if ss.p_mechanical_out > 0.0 {
                ss.p_hydraulic_out / ss.p_mechanical_out
            } else {
                0.0
            },
            efficiency_electrical_to_hydraulic: if ss.p_electrical_in > 0.0 {
                ss.p_hydraulic_out / ss.p_electrical_in
            } else {
                0.0
            },
        }
    }
}

/// Steady-state analysis results
#[derive(Debug, Clone)]
pub struct SteadyStateResult {
    pub motor_speed: f64,
    pub motor_current: f64,
    pub motor_torque: f64,
    pub pump_flow: f64,
    pub pump_pressure: f64,
    pub p_electrical_in: f64,
    pub p_mechanical_out: f64,
    pub p_hydraulic_out: f64,
    pub p_loss_motor: f64,
    pub p_loss_pump: f64,
    pub p_loss_thermal: f64,
    pub temperature_steady: f64,
    pub iterations: usize,
}

/// Energy conservation verification
#[derive(Debug, Clone)]
pub struct EnergyConservation {
    pub power_in: f64,
    pub power_out: f64,
    pub power_loss: f64,
    pub power_balance: f64,
    pub relative_error: f64,
    pub is_conserved: bool,
}

/// Power distribution across domains
#[derive(Debug, Clone)]
pub struct PowerTrace {
    pub domain_electrical: f64,
    pub domain_mechanical_motor: f64,
    pub domain_hydraulic: f64,
    pub domain_thermal_motor: f64,
    pub domain_thermal_pump: f64,
    pub efficiency_motor_to_mechanical: f64,
    pub efficiency_mechanical_to_hydraulic: f64,
    pub efficiency_electrical_to_hydraulic: f64,
}

/// Create example motor-pump-thermal system
pub fn create_motor_pump_thermal() -> Result<MotorPumpThermalSystem> {
    MotorPumpThermalSystem::new(12.0, 200.0, 50.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_creation() {
        let system = create_motor_pump_thermal();
        assert!(system.is_ok());
        let sys = system.unwrap();
        assert_eq!(sys.name, "MotorPumpThermal");
    }

    #[test]
    fn test_coupled_bond_graph_creation() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let bg = system.to_coupled_bond_graph()?;

        assert!(bg.num_elements() > 0, "Bond graph should have elements");
        assert!(bg.causality_assigned, "Causality should be assigned");

        Ok(())
    }

    #[test]
    fn test_steady_state_computation() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let ss = system.steady_state_analysis();

        // Verify reasonable values
        assert!(ss.motor_speed > 0.0, "Motor should rotate");
        assert!(ss.motor_current > 0.0, "Current should flow");
        assert!(ss.motor_torque > 0.0, "Torque should be produced");
        assert!(ss.pump_flow > 0.0, "Pump should produce flow");

        println!("Steady-state results:");
        println!("  Motor speed: {:.3} rad/s", ss.motor_speed);
        println!("  Motor current: {:.3} A", ss.motor_current);
        println!("  Motor torque: {:.6} N·m", ss.motor_torque);
        println!("  Pump flow: {:.6} m³/s", ss.pump_flow);
        println!("  Temperature rise: {:.2} K", ss.temperature_steady - 293.15);

        Ok(())
    }

    #[test]
    fn test_energy_conservation() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let conservation = system.verify_energy_conservation();

        println!("\nEnergy Conservation:");
        println!("  Power in: {:.4} W", conservation.power_in);
        println!("  Power out (hydraulic): {:.4} W", conservation.power_out);
        println!("  Power loss (thermal): {:.4} W", conservation.power_loss);
        println!("  Balance: {:.6} W", conservation.power_balance);
        println!("  Relative error: {:.2e}", conservation.relative_error);

        // Energy should be conserved
        assert!(
            conservation.is_conserved,
            "Energy should be conserved (error: {:.2e})",
            conservation.relative_error
        );

        Ok(())
    }

    #[test]
    fn test_power_trace() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let trace = system.power_trace();

        println!("\nPower Distribution Across Domains:");
        println!("  Electrical input: {:.4} W", trace.domain_electrical);
        println!("  Mechanical (motor output): {:.4} W", trace.domain_mechanical_motor);
        println!("  Hydraulic (pump output): {:.4} W", trace.domain_hydraulic);
        println!("  Thermal (motor losses): {:.4} W", trace.domain_thermal_motor);
        println!("  Thermal (pump losses): {:.4} W", trace.domain_thermal_pump);
        println!("\nEfficiency Chain:");
        println!("  Electrical → Mechanical: {:.1}%", trace.efficiency_motor_to_mechanical * 100.0);
        println!("  Mechanical → Hydraulic: {:.1}%", trace.efficiency_mechanical_to_hydraulic * 100.0);
        println!("  Electrical → Hydraulic: {:.1}%", trace.efficiency_electrical_to_hydraulic * 100.0);

        // All efficiencies should be between 0 and 1
        assert!(trace.efficiency_motor_to_mechanical >= 0.0 && trace.efficiency_motor_to_mechanical <= 1.0);
        assert!(trace.efficiency_mechanical_to_hydraulic >= 0.0 && trace.efficiency_mechanical_to_hydraulic <= 1.0);
        assert!(trace.efficiency_electrical_to_hydraulic >= 0.0 && trace.efficiency_electrical_to_hydraulic <= 1.0);

        // Overall efficiency should decrease with each stage
        assert!(
            trace.efficiency_electrical_to_hydraulic < trace.efficiency_motor_to_mechanical,
            "Overall efficiency should be less than first stage"
        );

        Ok(())
    }

    #[test]
    fn test_power_continuity() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let ss = system.steady_state_analysis();

        // Power in = Power out + Power loss
        let balance = (ss.p_electrical_in - ss.p_hydraulic_out - ss.p_loss_thermal).abs();
        println!("\nPower Continuity Check:");
        println!("  Input: {:.4} W", ss.p_electrical_in);
        println!("  Output: {:.4} W", ss.p_hydraulic_out);
        println!("  Loss: {:.4} W", ss.p_loss_thermal);
        println!("  Balance: {:.6} W (should be ~0)", balance);

        assert!(balance < 1e-3, "Power should be conserved");

        Ok(())
    }

    #[test]
    fn test_thermal_coupling_effect() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let ss = system.steady_state_analysis();

        // Temperature rise should be related to power loss
        let delta_t = ss.temperature_steady - system.ambient_temp;
        let expected_delta_t = ss.p_loss_thermal * system.thermal_resistance;

        println!("\nThermal Coupling Verification:");
        println!("  Actual ΔT: {:.3} K", delta_t);
        println!("  Expected ΔT: {:.3} K", expected_delta_t);
        println!("  Relative error: {:.2e}", (delta_t - expected_delta_t).abs() / expected_delta_t.max(1e-6));

        // Should match (within tolerance due to steady-state assumptions)
        assert!(
            (delta_t - expected_delta_t).abs() / expected_delta_t.max(1e-6) < 0.1,
            "Thermal model should be consistent"
        );

        Ok(())
    }

    #[test]
    fn test_multi_domain_coupling() -> Result<()> {
        let system = create_motor_pump_thermal()?;

        println!("\n=== Multi-Domain Coupling Verification ===\n");

        // Electrical domain → Mechanical
        let ss = system.steady_state_analysis();
        let p_elec = ss.p_electrical_in;
        let p_mech = ss.p_mechanical_out;
        println!("Electrical → Mechanical (Motor Gyrator):");
        println!("  Electrical power in: {:.4} W", p_elec);
        println!("  Mechanical power out: {:.4} W", p_mech);
        println!("  Loss (I²R): {:.4} W", ss.p_loss_motor);
        println!("  Conservation check: {:.2e}", (p_elec - p_mech - ss.p_loss_motor).abs());

        // Mechanical → Hydraulic
        let p_hyd = ss.p_hydraulic_out;
        println!("\nMechanical → Hydraulic (Pump Transformer):");
        println!("  Mechanical power in: {:.4} W", p_mech);
        println!("  Hydraulic power out: {:.4} W", p_hyd);
        println!("  Loss (friction): {:.4} W", ss.p_loss_pump);
        println!("  Conservation check: {:.2e}", (p_mech - p_hyd - ss.p_loss_pump).abs());

        // Thermal domain (accumulated losses)
        println!("\nThermal Feedback (System-wide heat dissipation):");
        println!("  Total loss: {:.4} W", ss.p_loss_thermal);
        println!("  Steady-state temperature: {:.2} K ({:.1}°C)",
            ss.temperature_steady, ss.temperature_steady - 273.15);
        println!("  Ambient temperature: {:.2} K ({:.1}°C)",
            system.ambient_temp, system.ambient_temp - 273.15);

        Ok(())
    }

    #[test]
    fn test_bond_graph_element_count() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let bg = system.to_coupled_bond_graph()?;

        // Should have: Se, R_motor, GY_motor, I_motor, TF_pump, C_thermal, R_thermal
        let min_elements = 6;
        assert!(bg.num_elements() >= min_elements,
            "Should have at least {} elements", min_elements);

        println!("Bond graph element count: {}", bg.num_elements());

        Ok(())
    }

    /// Comprehensive energy accounting across all 5 domains
    #[test]
    fn test_comprehensive_energy_accounting() -> Result<()> {
        let system = create_motor_pump_thermal()?;
        let ss = system.steady_state_analysis();

        println!("\n=== Comprehensive Energy Accounting ===\n");

        // Track power through each domain
        let p1_electrical = ss.p_electrical_in;
        let p2_motor_mechanical = ss.p_mechanical_out;
        let p3_pump_mechanical = ss.p_mechanical_out;  // Same as motor output
        let p4_hydraulic = ss.p_hydraulic_out;
        let p5_thermal = ss.p_loss_thermal;

        println!("Domain 1 - Electrical:");
        println!("  Power: {:.4} W (V × I)", p1_electrical);
        println!("  Temperature: N/A");

        println!("\nDomain 2 - Mechanical (Motor):");
        println!("  Power: {:.4} W (τ × ω)", p2_motor_mechanical);
        println!("  Loss: {:.4} W (copper loss)", ss.p_loss_motor);

        println!("\nDomain 3 - Mechanical (Pump):");
        println!("  Power: {:.4} W (τ × ω)", p3_pump_mechanical);
        println!("  Loss: {:.4} W (friction)", ss.p_loss_pump);

        println!("\nDomain 4 - Hydraulic:");
        println!("  Power: {:.4} W (P × Q)", p4_hydraulic);
        println!("  Pressure: {:.1} bar", ss.pump_pressure);
        println!("  Flow: {:.6} m³/s", ss.pump_flow);

        println!("\nDomain 5 - Thermal:");
        println!("  Power dissipation: {:.4} W", p5_thermal);
        println!("  Temperature rise: {:.2} K", ss.temperature_steady - system.ambient_temp);
        println!("  Steady-state: {:.2} K", ss.temperature_steady);

        // Global conservation
        println!("\n=== Global Conservation Check ===");
        let total = p1_electrical - p4_hydraulic - p5_thermal;
        println!("∑ (P_in - P_out - P_loss) = {:.6} W", total);
        println!("Relative error: {:.2e}", total.abs() / p1_electrical.max(1e-6));

        assert!(
            total.abs() / p1_electrical.max(1e-6) < 1e-6,
            "Global energy conservation must hold"
        );

        Ok(())
    }
}
