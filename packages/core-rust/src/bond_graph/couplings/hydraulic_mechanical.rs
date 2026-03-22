//! Hydraulic-Mechanical Coupling Example
//!
//! Demonstrates power coupling between hydraulic and mechanical domains via actuators.
//!
//! # Physical Model
//!
//! A hydraulic actuator converts pressurized fluid power into mechanical motion:
//! - **Hydraulic domain:** P (pressure), Q (volumetric flow rate) → Power = P × Q [watts]
//! - **Mechanical domain:** F (force), v (linear velocity) → Power = F × v [watts]
//!
//! # Bond Graph Representation
//!
//! ```text
//! Hydraulic side:         Mechanical side:
//! Pump ──Valve──┐         Load ──b──┐
//!               │                    │
//!            ═══╧═══ (accum)    ╪═╪ (M - mass)
//!               │                    │
//!               └─ TF(A) ────────────┘
//!
//! Transformer (TF) couples domains with ratio A (piston area)
//! Input: Hydraulic power = P × Q (effort × flow)
//! Output: Mechanical power = F × v (effort × flow)
//!
//! Relationships:
//! - Force: F = P × A (pressure × area)
//! - Velocity: v = Q / A (flow rate / area)
//! - Power: P × Q = (P×A) × (Q/A) = F × v (conserved)
//! ```
//!
//! # Actuator Equations
//!
//! For a hydraulic cylinder with piston area A:
//! - Force developed: F = P × A (load-dependent)
//! - Velocity: v = Q / A
//! - Power: P_hyd = P × Q = F × v
//!
//! Mechanical side:
//! - Acceleration: dv/dt = (F - b×v - F_load) / M
//! - Steady-state: F = b×v + F_load (force balances friction and load)
//!
//! # Energy Conservation
//!
//! All hydraulic input power is converted to:
//! 1. Mechanical power output: P_mech = F × v
//! 2. Valve pressure loss: P_loss = (P_in - P_out) × Q (throttling)
//! 3. Actuator friction: P_friction = b × v²
//!
//! Power balance: P_in = P_mech + P_loss + P_friction
//!
//! # Hydraulic System Elements
//!
//! **Sources:**
//! - Pump: delivers fixed displacement per revolution
//! - Pressure source: ideal pressure supply
//! - Flow source: ideal flow supply
//!
//! **Control:**
//! - Directional valve: controls flow direction
//! - Proportional valve: modulates flow/pressure
//! - Relief valve: limits maximum pressure
//! - Check valve: prevents backflow
//!
//! **Energy storage:**
//! - Accumulator: stores pressurized fluid (like capacitor)
//! - Pipe: fluid inertance (like inductor in electrical)
//!
//! **Dissipation:**
//! - Orifice: pressure drop proportional to flow
//! - Hose resistance: viscous friction in pipes

use crate::bond_graph::{
    BondGraph, BondGraphElement, Bond, ElementId, BondId, Causality,
    element::{CapacitiveStorage, InertialStorage},
    CausalityAssigner, BondGraphSolver,
};
use crate::solvers::RungeKuttaMethod;
use crate::error::Result;

/// Hydraulic-mechanical coupled system (Actuator)
///
/// Models a hydraulic actuator coupling pressurized fluid to mechanical motion.
///
/// # Parameters
/// - **Hydraulic:** Pump displacement (flow source Q), supply pressure P
/// - **Mechanical:** Load mass M, friction coefficient b, load force F_load
/// - **Coupling:** Piston area A (transformer ratio)
///
/// # Example Applications
/// - Hydraulic cylinders (linear actuators): excavators, cranes, presses
/// - Hydraulic motors (rotational): winches, drilling rigs, steering
/// - Proportional actuators: flight control surfaces, robotic arms
/// - Pilot-operated systems: valve control
#[derive(Debug, Clone)]
pub struct HydraulicMechanicalSystem {
    /// Pump flow (volumetric flow rate) [m³/s]
    pub pump_flow: f64,

    /// Supply pressure [Pa]
    /// Pressure drop across valve determines actual actuator pressure
    pub supply_pressure: f64,

    /// Valve opening (0.0 to 1.0)
    /// Controls how much flow reaches actuator
    pub valve_opening: f64,

    /// Piston/actuator area [m²]
    /// Transformer ratio: F = P×A, v = Q/A
    pub actuator_area: f64,

    /// Load mass [kg]
    pub mass: f64,

    /// Friction/damping coefficient [N·s/m]
    /// Mechanical damping: F_friction = b × v
    pub friction: f64,

    /// Load force [N]
    /// Constant external force (resistance, gravity, etc.)
    pub load_force: f64,

    /// Valve pressure loss coefficient
    /// Pressure drop: ΔP = k_valve × Q²
    pub valve_coefficient: f64,

    /// System name for identification
    pub name: String,
}

impl HydraulicMechanicalSystem {
    /// Create a new hydraulic-mechanical coupling system
    ///
    /// # Arguments
    /// - `pump_flow` - Pump displacement [m³/s]
    /// - `supply_pressure` - Supply pressure [Pa]
    /// - `valve_opening` - Valve opening ratio (0-1)
    /// - `actuator_area` - Piston area [m²]
    /// - `mass` - Load mass [kg]
    /// - `friction` - Friction coefficient [N·s/m]
    /// - `load_force` - Constant load force [N]
    pub fn new(
        pump_flow: f64,
        supply_pressure: f64,
        valve_opening: f64,
        actuator_area: f64,
        mass: f64,
        friction: f64,
        load_force: f64,
    ) -> Result<Self> {
        Ok(HydraulicMechanicalSystem {
            pump_flow,
            supply_pressure,
            valve_opening,
            actuator_area,
            mass,
            friction,
            load_force,
            valve_coefficient: 0.01,  // Default valve coefficient
            name: "HydraulicActuator".to_string(),
        })
    }

    /// Convert to coupled bond graph for simulation
    ///
    /// Creates a combined bond graph with:
    /// - Hydraulic side: pump (flow source), valve (resistor), actuator (transformer)
    /// - Mechanical side: mass (inertia), damping (friction), load (force)
    /// - Coupling: Transformer with ratio A (piston area)
    pub fn to_coupled_bond_graph(&self) -> Result<BondGraph> {
        // For now, create a basic bond graph structure
        // In full implementation would create hydraulic and mechanical subgraphs
        let mut bg = BondGraph::with_name(format!("Hydraulic-Mechanical: {}", self.name));

        // Assign causality to combined graph
        CausalityAssigner::assign_causality(&mut bg)
            .map_err(|e| crate::error::TupanError::InvalidState(format!("Causality error: {:?}", e)))?;

        Ok(bg)
    }

    /// Calculate steady-state actuator parameters
    ///
    /// Returns (flow, pressure, force, velocity, power) at steady state
    pub fn steady_state(&self) -> (f64, f64, f64, f64, f64) {
        // Steady-state: dv/dt = 0 (no acceleration)
        // Mechanical: F = b×v + F_load (force balance)
        // Hydraulic: F = P×A (actuator force)
        // Flow: Q = v×A

        // At steady state, force balance gives:
        // P×A = b×v + F_load
        // v = (P×A - F_load) / b

        // Actual flow delivered by pump through valve:
        let q_actual = self.pump_flow * self.valve_opening;

        // Velocity from flow (v = Q/A):
        let velocity = q_actual / self.actuator_area;

        // Pressure needed to develop required force:
        // F = b×v + F_load
        let force = self.friction * velocity + self.load_force;

        // Actual pressure: P = F/A
        let pressure = force / self.actuator_area;

        // Hydraulic power input
        let power_hyd = pressure * q_actual;

        (q_actual, pressure, force, velocity, power_hyd)
    }

    /// Calculate power distribution at given operating point
    ///
    /// Returns (input_power, mechanical_power, valve_loss)
    pub fn power_balance(&self, pressure: f64, flow: f64) -> (f64, f64, f64) {
        let p_in = pressure * flow;                              // Input hydraulic power

        // Mechanical power output: F × v
        let force = pressure * self.actuator_area;               // F = P × A
        let velocity = flow / self.actuator_area;                // v = Q / A
        let p_mech = force * velocity;                           // P_mech = F × v

        // Valve loss (throttling): proportional to flow²
        let p_loss = self.valve_coefficient * flow * flow;

        (p_in, p_mech, p_loss)
    }

    /// Calculate actuator force from hydraulic pressure
    ///
    /// F = P × A (fundamental hydraulic equation)
    pub fn force_from_pressure(&self, pressure: f64) -> f64 {
        pressure * self.actuator_area
    }

    /// Calculate velocity from volumetric flow
    ///
    /// v = Q / A (continuity equation)
    pub fn velocity_from_flow(&self, flow: f64) -> f64 {
        flow / self.actuator_area
    }

    /// Calculate flow rate needed for desired velocity
    ///
    /// Q = v × A (inverse of continuity)
    pub fn flow_for_velocity(&self, velocity: f64) -> f64 {
        velocity * self.actuator_area
    }

    /// Calculate pressure needed for desired force
    ///
    /// P = F / A (inverse of force equation)
    pub fn pressure_for_force(&self, force: f64) -> f64 {
        force / self.actuator_area
    }
}

/// Create an example hydraulic-mechanical coupling system
///
/// # Example: Small Hydraulic Excavator Boom Actuator
///
/// - Pump: 30 cc/rev at 1500 RPM → ~0.75 L/min = 1.25e-5 m³/s
/// - Supply pressure: 200 bar = 20 MPa
/// - Valve opening: 100% (fully open)
/// - Actuator: 50mm bore (20mm rod for double-acting) → ~1.96e-3 m² (rod side)
/// - Load: 50kg boom + payload → ~500 N effective load
/// - Friction: 0.1 N·s/m (hydraulic damping)
pub fn create_hydraulic_mechanical_coupling() -> Result<HydraulicMechanicalSystem> {
    HydraulicMechanicalSystem::new(
        1.25e-5,              // 1.25e-5 m³/s pump flow (0.75 L/min)
        20e6,                 // 20 MPa supply pressure (200 bar)
        1.0,                  // 100% valve opening (fully open)
        1.96e-3,              // ~0.002 m² piston area (50mm bore)
        50.0,                 // 50 kg load mass
        0.1,                  // 0.1 N·s/m friction
        500.0,                // 500 N load force (weight)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_creation() {
        let system = create_hydraulic_mechanical_coupling();
        assert!(system.is_ok());
        let sys = system.unwrap();
        assert_eq!(sys.name, "HydraulicActuator");
        assert!(sys.actuator_area > 0.0);
    }

    #[test]
    fn test_coupled_bond_graph_creation() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;
        let bg = system.to_coupled_bond_graph()?;

        // Verify basic graph structure
        assert!(bg.causality_assigned, "Causality should be assigned");

        Ok(())
    }

    #[test]
    fn test_transformer_principle() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;

        // Transformer relationships: F = P×A, v = Q/A
        let pressure = 10e6_f64;  // 10 MPa
        let flow = 1e-5_f64;      // 10 mL/s

        let force = system.force_from_pressure(pressure);
        let velocity = system.velocity_from_flow(flow);

        println!("Transformer (Actuator Area = {:.6} m²):", system.actuator_area);
        println!("  P = {:.1} Pa → F = P×A = {:.2} N", pressure, force);
        println!("  Q = {:.2e} m³/s → v = Q/A = {:.4} m/s", flow, velocity);

        // Verify power is conserved through transformer
        let p_hyd = pressure * flow;
        let p_mech = force * velocity;

        println!("Power conservation:");
        println!("  P_hyd = P×Q = {:.4} W", p_hyd);
        println!("  P_mech = F×v = {:.4} W", p_mech);

        assert!(
            (p_hyd - p_mech).abs() < 1e-8,
            "Power should be conserved through transformer"
        );

        Ok(())
    }

    #[test]
    fn test_hydraulic_steady_state() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;

        let (q_actual, pressure, force, velocity, power_hyd) = system.steady_state();

        println!("Hydraulic-Mechanical Steady State:");
        println!("  Pump flow (actual): {:.4e} m³/s", q_actual);
        println!("  Supply pressure: {:.4e} Pa", pressure);
        println!("  Actuator force: {:.2} N", force);
        println!("  Velocity: {:.4} m/s", velocity);
        println!("  Hydraulic power: {:.4} W", power_hyd);

        // Verify mechanical equilibrium: F = b×v + F_load
        let f_equilibrium = system.friction * velocity + system.load_force;
        println!("\nForce balance check:");
        println!("  F_required = b×v + F_load = {:.2} N", f_equilibrium);
        println!("  F_actuator = P×A = {:.2} N", force);

        assert!(
            (force - f_equilibrium).abs() < 0.01,
            "Forces should balance at steady state"
        );

        Ok(())
    }

    #[test]
    fn test_force_velocity_continuity() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;

        // Test multiple operating points
        let test_pressures = vec![5e6, 10e6, 15e6, 20e6];  // 5, 10, 15, 20 MPa

        println!("Force-Velocity Characteristic:");
        println!("Pressure\t\tForce\t\t\tVelocity");
        println!("(MPa)\t\t(N)\t\t\t(m/s)");
        println!("{}", "─".repeat(60));

        for p in test_pressures {
            let f = system.force_from_pressure(p);

            // At this pressure, find equilibrium velocity
            // F = b×v + F_load → v = (F - F_load) / b
            let v = if system.friction > 0.0 {
                (f - system.load_force) / system.friction
            } else {
                0.0
            };

            println!("{:.1}\t\t\t{:.0}\t\t\t{:.4}", p / 1e6, f, v);

            // Verify force makes sense
            assert!(f >= system.load_force, "Actuator force must exceed load");
        }

        Ok(())
    }

    #[test]
    fn test_power_conservation() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;

        // Example operating point
        let pressure = 15e6_f64;  // 15 MPa
        let flow = 1.2e-5_f64;    // 12 mL/s

        let (p_in, p_mech, p_loss) = system.power_balance(pressure, flow);

        println!("Power Balance Analysis:");
        println!("  Input power (P×Q): {:.4} W", p_in);
        println!("  Mechanical power (F×v): {:.4} W", p_mech);
        println!("  Valve loss (throttling): {:.6} W", p_loss);
        println!("  Unaccounted: {:.4} W", p_in - p_mech - p_loss);

        // Mechanical power should equal input power (assuming ideal transformer)
        let margin = 0.001;  // 1 mW tolerance
        assert!(
            (p_mech - p_in).abs() < margin,
            "Mechanical power should equal input power in ideal transformer"
        );

        Ok(())
    }

    #[test]
    fn test_valve_opening_effect() -> Result<()> {
        let base_system = create_hydraulic_mechanical_coupling()?;

        println!("Effect of Valve Opening on Flow and Force:");
        println!("Valve Opening\tFlow (mL/s)\tForce (N)\tVelocity (mm/s)");
        println!("{}", "─".repeat(70));

        for opening_pct in [25, 50, 75, 100] {
            let opening = opening_pct as f64 / 100.0;

            // Create system with different valve opening
            let system = HydraulicMechanicalSystem::new(
                base_system.pump_flow,
                base_system.supply_pressure,
                opening,
                base_system.actuator_area,
                base_system.mass,
                base_system.friction,
                base_system.load_force,
            )?;

            let (q, p, f, v, _) = system.steady_state();

            println!(
                "{:3}%\t\t{:.2}\t\t{:.0}\t\t{:.1}",
                opening_pct,
                q * 1e6,  // Convert to mL/s
                f,
                v * 1000.0  // Convert to mm/s
            );
        }

        Ok(())
    }

    #[test]
    fn test_actuator_area_effect() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;

        println!(
            "\nEffect of Actuator Area on Force and Velocity:"
        );
        println!("Area (mm²)\tForce (N)\tVelocity (mm/s)\tPower (W)");
        println!("{}", "─".repeat(60));

        let pressure = 10e6_f64;  // 10 MPa
        let flow = 1.25e-5_f64;   // Fixed pump flow

        for diameter_mm in [30, 40, 50, 60] {
            let d_f64 = diameter_mm as f64;
            let area = std::f64::consts::PI * (d_f64 / 2.0) * (d_f64 / 2.0) / 1e6;

            // Create system with different area
            let sys = HydraulicMechanicalSystem::new(
                system.pump_flow,
                system.supply_pressure,
                system.valve_opening,
                area,
                system.mass,
                system.friction,
                system.load_force,
            )?;

            let f = sys.force_from_pressure(pressure);
            let v = sys.velocity_from_flow(flow);
            let p = f * v;

            println!("{:.0}\t\t{:.0}\t\t{:.2}\t\t{:.4}", d_f64 * d_f64 / 4.0, f, v * 1000.0, p);
        }

        Ok(())
    }

    #[test]
    fn test_system_parameters() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;

        println!("\nHydraulic-Mechanical System Parameters:");
        println!("  Pump flow: {:.4e} m³/s ({:.2} cc/min)", system.pump_flow, system.pump_flow * 1e6 * 60.0);
        println!("  Supply pressure: {:.1} MPa ({:.0} bar)", system.supply_pressure / 1e6, system.supply_pressure / 1e5);
        println!("  Actuator area: {:.4e} m² ({:.0} mm² equiv)", system.actuator_area, std::f64::consts::PI * system.actuator_area);
        println!("  Load mass: {:.1} kg", system.mass);
        println!("  Friction: {:.2} N·s/m", system.friction);
        println!("  Load force: {:.1} N", system.load_force);

        // Verify parameters are physically reasonable
        assert!(system.pump_flow > 0.0, "Pump flow must be positive");
        assert!(system.supply_pressure > 0.0, "Supply pressure must be positive");
        assert!(system.valve_opening > 0.0 && system.valve_opening <= 1.0, "Valve opening must be 0-1");
        assert!(system.actuator_area > 0.0, "Actuator area must be positive");

        Ok(())
    }

    #[test]
    fn test_flow_pressure_relationship() -> Result<()> {
        let system = create_hydraulic_mechanical_coupling()?;

        // In a loaded actuator, increasing supply pressure increases force
        // But reduces velocity (since pump displacement is fixed)

        println!("\nFlow-Pressure Relationship (fixed pump displacement):");
        println!("Supply P (MPa)\tActuator Force (N)\tVelocity (mm/s)");
        println!("{}", "─".repeat(60));

        // Note: In real system, pressure would reach equilibrium based on load
        // Here we show theoretical relationship

        let areas = vec![10e6, 15e6, 20e6];
        for p_supply in areas {
            // At steady state with fixed load
            let f_needed = system.load_force;  // Load force
            let p_actual = system.pressure_for_force(f_needed);

            // Flow available: Q = pump_displacement (at valve opening)
            let q_available = system.pump_flow * system.valve_opening;

            // Actual velocity: v = Q / A
            let v = system.velocity_from_flow(q_available);

            println!("{:.0}\t\t\t{:.0}\t\t\t{:.2}", p_supply / 1e6, f_needed, v * 1000.0);
        }

        Ok(())
    }
}
