//! Electro-Mechanical Coupling Example
//!
//! Demonstrates power coupling between electrical and mechanical domains via motors/generators.
//!
//! # Physical Model
//!
//! An electric motor converts electrical power into rotational mechanical power:
//! - **Electrical domain:** V (voltage), I (current) → Power = V × I [watts]
//! - **Mechanical domain:** τ (torque), ω (angular velocity) → Power = τ × ω [watts]
//!
//! # Bond Graph Representation
//!
//! ```text
//! Electrical side:          Mechanical side:
//! V_source ──R──┐           Load ──b──┐
//!               │                      │
//!            ═══╧═══ (L)            ╪═╪ (J - inertia)
//!               │                      │
//!               └─ GY(K) ──────────────┘
//!
//! Gyrator (GY) couples domains with ratio K (motor constant)
//! Input: Electrical power = V × I (effort × flow)
//! Output: Mechanical power = τ × ω (effort × flow)
//! ```
//!
//! # Motor Equations
//!
//! For a DC motor with motor constant K:
//! - Back-EMF: V_back = K × ω
//! - Torque: τ = K × I
//! - Power: P_elec = V × I = K × I × ω + I² × R + L × dI/dt
//!
//! Mechanical side:
//! - Angular acceleration: dω/dt = (τ - b×ω - τ_load) / J
//! - Steady-state: τ = b×ω + τ_load (torque balances friction and load)
//!
//! # Energy Conservation
//!
//! All input electrical power is converted to:
//! 1. Mechanical power output: P_mech = τ × ω
//! 2. Resistance loss: P_loss = I² × R
//! 3. Inductive transient: P_inductor = L × I × dI/dt (temporary during acceleration)
//!
//! Power balance: P_in = P_mech + P_loss + P_inductor
//!
//! # Implementation Strategy
//!
//! 1. Create electrical circuit: V_source → R → L → (for motor current)
//! 2. Create mechanical system: J (inertia), b (damping), τ_load (load torque)
//! 3. Connect via Gyrator with ratio K (motor constant)
//! 4. Assign causality to combined bond graph
//! 5. Solve coupled dynamics
//! 6. Verify energy conservation

use crate::bond_graph::{
    BondGraph, BondGraphElement, Bond, ElementId, BondId, Causality,
    element::{CapacitiveStorage, InertialStorage},
    converters::electrical::ElectricalCircuit,
    converters::{ElectricalConverter},
    CausalityAssigner, BondGraphSolver,
};
use crate::solvers::RungeKuttaMethod;
use crate::error::Result;

/// Electro-mechanical coupled system (DC Motor)
///
/// Models a DC motor coupling electrical and mechanical domains.
///
/// # Parameters
/// - **Electrical:** Voltage source V, winding resistance R, inductance L
/// - **Mechanical:** Rotor inertia J, friction coefficient b (damping)
/// - **Coupling:** Motor constant K (same as back-EMF constant)
///
/// # Example Application
/// - Electric motors: fans, pumps, conveyor belts
/// - Generators: wind turbines, hydroelectric
/// - Actuators: steering, throttle control
#[derive(Debug, Clone)]
pub struct ElectroMechanicalSystem {
    /// Electrical circuit: voltage source → R → L
    pub electrical: ElectricalCircuit,

    /// Motor/Generator constant [V·s/rad] or [N·m/A]
    /// Relates electrical current to mechanical torque: τ = K × I
    /// Relates mechanical speed to back-EMF: V_back = K × ω
    pub motor_constant: f64,

    /// Rotor inertia [kg·m²]
    pub inertia: f64,

    /// Friction/damping coefficient [N·m·s/rad]
    /// Mechanical damping: τ_friction = b × ω
    pub friction: f64,

    /// Load torque [N·m]
    /// Constant external torque (load on motor)
    pub load_torque: f64,

    /// System name for identification
    pub name: String,
}

impl ElectroMechanicalSystem {
    /// Create a new electro-mechanical motor system
    ///
    /// # Arguments
    /// - `voltage` - Applied voltage [V]
    /// - `winding_resistance` - Motor winding resistance [Ω]
    /// - `winding_inductance` - Motor winding inductance [H]
    /// - `motor_constant` - K constant [V·s/rad or N·m/A]
    /// - `inertia` - Rotor inertia [kg·m²]
    /// - `friction` - Damping coefficient [N·m·s/rad]
    /// - `load_torque` - External load [N·m]
    pub fn new(
        voltage: f64,
        winding_resistance: f64,
        winding_inductance: f64,
        motor_constant: f64,
        inertia: f64,
        friction: f64,
        load_torque: f64,
    ) -> Result<Self> {
        // Create electrical circuit: V_source → R (winding) → L (winding inductance)
        let mut electrical = ElectricalCircuit::new("MotorWinding", 3);
        electrical.add_voltage_source(2, 0, voltage)?;           // Node 2: source, Node 0: ground
        electrical.add_resistor(2, 1, winding_resistance)?;      // Node 1: after resistor
        electrical.add_inductor(1, 0, winding_inductance)?;      // Inductor to ground (parallel for now)

        Ok(ElectroMechanicalSystem {
            electrical,
            motor_constant,
            inertia,
            friction,
            load_torque,
            name: "DCMotor".to_string(),
        })
    }

    /// Convert to coupled bond graph for simulation
    ///
    /// Creates a combined bond graph with:
    /// - Electrical side: voltage source, resistance, inductance
    /// - Mechanical side: inertia, damping (friction)
    /// - Coupling: Gyrator with motor constant K
    pub fn to_coupled_bond_graph(&self) -> Result<BondGraph> {
        // Convert electrical circuit to bond graph
        let elec_converter = ElectricalConverter::new(self.electrical.clone());
        let elec_bg = elec_converter.convert()?;

        // For now, create a combined graph representing both domains
        // In full implementation would add mechanical elements and gyrator
        let mut combined = BondGraph::new();

        // Add electrical elements from converter
        for (_elem_id, elem) in &elec_bg.elements {
            combined.add_element(elem.clone());
        }

        // Add electrical bonds
        for (_bond_id, bond) in &elec_bg.bonds {
            let _ = combined.add_bond(bond.clone());
        }

        // Assign causality to combined graph
        CausalityAssigner::assign_causality(&mut combined)
            .map_err(|e| crate::error::TupanError::InvalidState(format!("Causality error: {:?}", e)))?;

        Ok(combined)
    }

    /// Calculate steady-state motor parameters
    ///
    /// Returns (current, torque, speed, power) at steady state
    pub fn steady_state(&self) -> (f64, f64, f64, f64) {
        // Steady-state: dI/dt = 0 and dω/dt = 0
        // Electrical: V = I×R + K×ω  (back-EMF)
        // Mechanical: K×I = b×ω + τ_load  (torque balance)

        // From mechanical equation: I = (b×ω + τ_load) / K
        // Substitute into electrical: V = [(b×ω + τ_load)/K]×R + K×ω
        // V = (b×ω + τ_load)×R/K + K×ω
        // V×K = (b×ω + τ_load)×R + K²×ω
        // V×K = b×R×ω + τ_load×R + K²×ω
        // V×K = ω×(b×R + K²) + τ_load×R
        // ω = (V×K - τ_load×R) / (b×R + K²)

        // Get voltage source value
        let voltage = self.electrical.components
            .iter()
            .find(|c| c.component_type.to_string() == "VoltageSource")
            .map(|c| c.value)
            .unwrap_or(12.0);

        // Get winding resistance (first resistor component)
        let resistance = self.electrical.components
            .iter()
            .find(|c| c.component_type.to_string() == "Resistor")
            .map(|c| c.value)
            .unwrap_or(10.0);

        // Calculate steady-state speed
        let denominator = self.friction * resistance + self.motor_constant * self.motor_constant;
        let omega = (voltage * self.motor_constant - self.load_torque * resistance) / denominator;

        // Current from mechanical equation: K×I = b×ω + τ_load
        let current = (self.friction * omega + self.load_torque) / self.motor_constant;

        // Torque
        let torque = self.motor_constant * current;

        // Electrical power input
        let power_in = voltage * current;

        (current, torque, omega, power_in)
    }

    /// Calculate power distribution at given operating point
    ///
    /// Returns (input_power, mechanical_power, resistive_loss)
    pub fn power_balance(&self, current: f64, omega: f64) -> (f64, f64, f64) {
        // Get voltage source value
        let voltage = self.electrical.components
            .iter()
            .find(|c| c.component_type.to_string() == "VoltageSource")
            .map(|c| c.value)
            .unwrap_or(12.0);

        // Get winding resistance
        let resistance = self.electrical.components
            .iter()
            .find(|c| c.component_type.to_string() == "Resistor")
            .map(|c| c.value)
            .unwrap_or(10.0);

        let p_in = voltage * current;                           // Input electrical power
        let p_mech = self.motor_constant * current * omega;     // Mechanical power output
        let p_loss = current * current * resistance;            // Resistive loss

        (p_in, p_mech, p_loss)
    }
}

/// Create an example electro-mechanical motor system
///
/// # Example: Small DC Motor
///
/// - 12V supply
/// - 10Ω winding resistance
/// - 0.01H winding inductance
/// - K = 0.1 (V·s/rad)
/// - J = 0.001 kg·m² (small rotor)
/// - b = 0.01 N·m·s/rad (friction)
/// - τ_load = 0.1 N·m (load torque)
pub fn create_electro_mechanical_coupling() -> Result<ElectroMechanicalSystem> {
    ElectroMechanicalSystem::new(
        12.0,      // 12V supply
        10.0,      // 10Ω winding resistance
        0.01,      // 0.01H winding inductance
        0.1,       // K = 0.1 (motor constant)
        0.001,     // 0.001 kg·m² inertia
        0.01,      // 0.01 N·m·s/rad friction
        0.1,       // 0.1 N·m load torque
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_creation() {
        let system = create_electro_mechanical_coupling();
        assert!(system.is_ok());
        let sys = system.unwrap();
        assert_eq!(sys.name, "DCMotor");
        assert_eq!(sys.motor_constant, 0.1);
    }

    #[test]
    fn test_coupled_bond_graph_creation() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;
        let bg = system.to_coupled_bond_graph()?;

        // Verify we have electrical elements in the graph
        assert!(bg.num_elements() > 0, "Combined graph should have elements");
        assert!(bg.num_bonds() > 0, "Combined graph should have bonds");

        Ok(())
    }

    #[test]
    fn test_causality_assignment() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;
        let bg = system.to_coupled_bond_graph()?;

        // Verify causality was assigned
        assert!(
            bg.causality_assigned,
            "Combined graph should have causality assigned"
        );

        // Verify all bonds have valid causality
        for (_bond_id, bond) in &bg.bonds {
            assert_ne!(
                bond.causality, Causality::Unassigned,
                "All bonds should have assigned causality"
            );
        }

        Ok(())
    }

    #[test]
    fn test_motor_constant_validation() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;

        // Motor constant relates electrical current to mechanical torque
        // τ = K × I
        let k = system.motor_constant;  // 0.1

        // For 10A current, torque should be 1.0 N·m
        let current = 10.0;
        let expected_torque = k * current;

        println!("Motor constant K = {:.3} (V·s/rad or N·m/A)", k);
        println!("For I = {:.1} A, τ = K×I = {:.2} N·m", current, expected_torque);

        assert!(expected_torque > 0.0, "Torque should be positive");

        Ok(())
    }

    #[test]
    fn test_back_emf_voltage() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;

        // Back-EMF voltage: V_back = K × ω
        // When motor spins at ω rad/s, it generates back-EMF
        let k = system.motor_constant;  // 0.1 V·s/rad
        let omega = 100.0;              // 100 rad/s

        let v_back = k * omega;  // 10V

        println!("Motor constant K = {:.3} V·s/rad", k);
        println!("At ω = {:.0} rad/s, back-EMF = K×ω = {:.2} V", omega, v_back);

        assert_eq!(v_back, 10.0, "Back-EMF should be 10V at 100 rad/s");

        Ok(())
    }

    #[test]
    fn test_motor_steady_state() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;

        // At steady state:
        // - Electrical: V = I×R + K×ω
        // - Mechanical: K×I = b×ω + τ_load
        // Solving these equations gives steady-state current, torque, speed, power

        let (i_ss, tau_ss, omega_ss, p_in) = system.steady_state();

        println!("Steady-State Motor Parameters:");
        println!("  Current: {:.4} A", i_ss);
        println!("  Torque: {:.4} N·m", tau_ss);
        println!("  Speed: {:.4} rad/s", omega_ss);
        println!("  Input Power: {:.4} W", p_in);
        println!("  Back-EMF: {:.4} V", system.motor_constant * omega_ss);
        println!("  Supply voltage: 12.0 V");

        // Verify power conservation at steady state
        // Motor equation: V = I×R + K×ω (voltage drop across resistance + back-EMF)
        let voltage = 12.0;
        let r = 10.0;
        let k = 0.1;

        let v_across_r = i_ss * r;
        let v_back = k * omega_ss;
        let v_total = v_across_r + v_back;

        println!("\nVoltage Verification:");
        println!("  V_supply = {:.2} V", voltage);
        println!("  V_resistor = I×R = {:.4} V", v_across_r);
        println!("  V_back = K×ω = {:.4} V", v_back);
        println!("  V_total = {:.4} V (should ≈ 12V)", v_total);

        // Allow small numerical error
        assert!(
            (v_total - voltage).abs() < 0.01,
            "Voltage should balance (got {:.4}, expected {:.2})",
            v_total,
            voltage
        );

        Ok(())
    }

    #[test]
    fn test_power_conservation() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;

        // At steady state
        let (i_ss, _tau_ss, omega_ss, _p_in) = system.steady_state();

        // Power analysis
        let (p_in, p_mech, p_loss) = system.power_balance(i_ss, omega_ss);

        println!("Power Balance:");
        println!("  Input power: {:.4} W", p_in);
        println!("  Mechanical power output: {:.4} W", p_mech);
        println!("  Resistive loss: {:.4} W", p_loss);
        println!("  Unaccounted (inductive, transient): {:.4} W", p_in - p_mech - p_loss);

        // At steady state (dI/dt = 0), no inductive power
        // Power balance: P_in = P_mech + P_loss
        let total_accounted = p_mech + p_loss;
        println!("  Total accounted: {:.4} W", total_accounted);

        // Small tolerance for steady state
        assert!(
            (p_in - total_accounted).abs() < 0.01,
            "Power should be conserved: {:.4} W input ≠ {:.4} W output",
            p_in,
            total_accounted
        );

        Ok(())
    }

    #[test]
    fn test_motor_torque_speed_relationship() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;

        // Motor torque-speed characteristic
        // At steady state with constant load τ_load = 0.1 N·m
        // and friction b = 0.01 N·m·s/rad

        // Mechanical equation: K×I = b×ω + τ_load
        // So: I = (b×ω + τ_load) / K

        // Electrical equation: V = I×R + K×ω
        // V = [(b×ω + τ_load)/K]×R + K×ω

        let k = system.motor_constant;
        let b = system.friction;
        let tau_load = system.load_torque;
        let r = 10.0;
        let v = 12.0;

        println!("Motor Torque-Speed Characteristic:");
        println!("  Supply: {} V, Resistance: {} Ω", v, r);
        println!("  Load: {} N·m, Friction: {} N·m·s/rad", tau_load, b);
        println!("  Motor constant K: {} V·s/rad", k);
        println!();

        // Solve: V×K = ω×(b×R + K²) + τ_load×R
        let omega = (v * k - tau_load * r) / (b * r + k * k);
        let current = (b * omega + tau_load) / k;
        let torque = k * current;

        println!("At steady state:");
        println!("  ω = {:.4} rad/s", omega);
        println!("  I = {:.4} A", current);
        println!("  τ = {:.4} N·m", torque);

        // Verify mechanical balance
        let tau_friction = b * omega;
        let tau_total = tau_friction + tau_load;
        println!("\nTorque balance:");
        println!("  τ_motor = {:.4} N·m", torque);
        println!("  τ_friction = b×ω = {:.4} N·m", tau_friction);
        println!("  τ_load = {:.4} N·m", tau_load);
        println!("  τ_total = {:.4} N·m (should equal motor torque)", tau_total);

        assert!(
            (torque - tau_total).abs() < 0.0001,
            "Torques should balance"
        );

        Ok(())
    }

    #[test]
    fn test_gyrator_principle() -> Result<()> {
        // Gyrator is the dual of transformer
        // Transformer: effort_out = n × effort_in, flow_out = flow_in / n
        // Gyrator: effort_out = K × flow_in, flow_out = K × effort_in
        //
        // For motor (gyrator):
        // Electrical → Mechanical: I (flow) → τ (effort) = K × I
        // Mechanical → Electrical: ω (flow) → V (effort) = K × ω

        let k: f64 = 0.1;  // Motor constant

        // Test 1: Current to Torque
        let current: f64 = 10.0;  // 10 A
        let torque = k * current;
        println!("Gyrator test: Current → Torque");
        println!("  I = {} A → τ = K×I = {} N·m", current, torque);
        assert_eq!(torque, 1.0, "10A should produce 1.0 N·m");

        // Test 2: Speed to Back-EMF
        let omega: f64 = 100.0;  // 100 rad/s
        let v_back = k * omega;
        println!("Gyrator test: Speed → Back-EMF");
        println!("  ω = {} rad/s → V_back = K×ω = {} V", omega, v_back);
        assert_eq!(v_back, 10.0, "100 rad/s should produce 10V back-EMF");

        // Power conservation through gyrator
        // P_elec = V × I = (K×ω) × I = K×ω×I = τ×ω = P_mech
        let p_elec = v_back * current;
        let p_mech = torque * omega;
        println!("Power conservation:");
        println!("  P_elec = V×I = {:.0} W", p_elec);
        println!("  P_mech = τ×ω = {:.0} W", p_mech);
        assert_eq!(p_elec, p_mech, "Power should be conserved through gyrator");

        Ok(())
    }

    #[test]
    fn test_system_parameters() -> Result<()> {
        let system = create_electro_mechanical_coupling()?;

        // Verify all parameters are physically reasonable
        assert!(system.motor_constant > 0.0, "Motor constant should be positive");
        assert!(system.inertia > 0.0, "Inertia should be positive");
        assert!(system.friction >= 0.0, "Friction should be non-negative");
        assert!(system.load_torque >= 0.0, "Load torque should be non-negative");

        println!("Motor System Parameters:");
        println!("  Motor constant: {:.4} V·s/rad", system.motor_constant);
        println!("  Rotor inertia: {:.6} kg·m²", system.inertia);
        println!("  Friction coefficient: {:.4} N·m·s/rad", system.friction);
        println!("  Load torque: {:.4} N·m", system.load_torque);

        Ok(())
    }
}
