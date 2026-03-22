//! Thermal-Mechanical Coupling Example
//!
//! Demonstrates how temperature affects mechanical properties and mechanical systems generate heat.
//!
//! # Physical Model
//!
//! Thermal and mechanical systems are coupled through material properties that vary with temperature:
//! - **Mechanical domain:** F (force), v (velocity), σ (stress), ε (strain)
//! - **Thermal domain:** T (temperature), Q̇ (heat flow)
//!
//! Key coupling mechanisms:
//! 1. **Thermal expansion:** L = L₀ × (1 + α × ΔT)
//! 2. **Viscosity changes:** μ(T) = μ₀ × exp(E_a / (R × T))
//! 3. **Stiffness variation:** k(T) = k₀ × (1 - β × ΔT)
//! 4. **Mechanical damping:** b = b₀(T) from viscous effects
//! 5. **Frictional heating:** Q̇_friction = b × v² → increases temperature
//!
//! # Energy Balance
//!
//! Mechanical work converts to heat through friction and damping:
//! - Frictional power: P_friction = F × v = b × v²
//! - This heat raises component temperature: dT/dt = P_friction / (m × c_p)
//! - Higher temperature increases viscosity/damping: b = b(T)
//! - Feedback: higher damping → more friction → higher temperature → more damping
//!
//! # Example: Viscous Damper
//!
//! A damper (shock absorber) dissipates mechanical energy as heat:
//! - Viscous damping force: F = b × v (depends on viscosity μ)
//! - Viscosity strongly temperature-dependent: μ ∝ exp(E_a / (k_B × T))
//! - As damper heats up, viscosity changes, altering system behavior
//! - In extreme cases, can reach thermal runaway
//!
//! # Thermomechanical Stress
//!
//! Free thermal expansion is prevented by mechanical constraints:
//! - Thermal strain: ε_th = α × ΔT
//! - If constrained: σ_thermal = E × α × ΔT (residual stress)
//! - This stress can cause yielding or fatigue failure at temperature extremes
//!
//! # Implementation Strategy
//!
//! Model a damped oscillator with temperature-dependent damping:
//! 1. Mechanical system: mass m, spring k, damping b(T)
//! 2. Thermal system: heat capacity C_th, ambient temperature T_amb
//! 3. Coupling: frictional heating Q̇ = b(T) × v²
//! 4. Temperature feedback: b increases with T
//! 5. Solve coupled differential equations

use crate::error::Result;
use std::f64::consts::E as EULER;

/// Thermal-mechanical coupled system
///
/// Models a mechanical system (mass-spring-damper) where damping coefficient
/// varies with temperature due to viscosity changes.
///
/// # Parameters
/// - **Mechanical:** mass M, spring stiffness k, reference damping b₀
/// - **Thermal:** heat capacity C_th, thermal resistance R_th, ambient T_amb
/// - **Coupling:** viscosity temperature coefficient E_a, base viscosity μ₀
///
/// # Applications
/// - Shock absorbers (suspension systems)
/// - Bearing damping and thermal control
/// - Hydraulic hose and fitting response
/// - Precision machinery temperature stability
/// - Thermal expansion joints and seals
#[derive(Debug, Clone)]
pub struct ThermalMechanicalSystem {
    /// Load mass [kg]
    pub mass: f64,

    /// Spring stiffness [N/m]
    pub stiffness: f64,

    /// Reference damping coefficient at reference temperature [N·s/m]
    /// Actual damping varies with temperature
    pub damping_ref: f64,

    /// Reference temperature for damping [K]
    /// Typically 293 K (20°C)
    pub temp_ref: f64,

    /// Heat capacity [J/K]
    pub heat_capacity: f64,

    /// Thermal resistance to environment [K/W]
    /// (Similar to thermal resistance in thermal circuit)
    pub thermal_resistance: f64,

    /// Ambient temperature [K]
    pub ambient_temp: f64,

    /// Activation energy / Boltzmann constant [K]
    /// Controls how much damping changes with temperature
    /// Typical values: 500-2000 K for synthetic oils
    pub temp_sensitivity: f64,

    /// Thermal expansion coefficient [1/K]
    /// For length: ΔL/L₀ = α × ΔT
    pub expansion_coefficient: f64,

    /// Young's modulus [Pa]
    /// Used to calculate thermal stress
    pub youngs_modulus: f64,

    /// System name for identification
    pub name: String,
}

impl ThermalMechanicalSystem {
    /// Create a new thermal-mechanical coupling system
    ///
    /// # Arguments
    /// - `mass` - Load mass [kg]
    /// - `stiffness` - Spring stiffness [N/m]
    /// - `damping_ref` - Damping at reference temperature [N·s/m]
    /// - `temp_ref` - Reference temperature [K]
    /// - `heat_capacity` - Thermal mass [J/K]
    /// - `thermal_resistance` - To environment [K/W]
    /// - `ambient_temp` - Environment temperature [K]
    /// - `temp_sensitivity` - E_a/k_B for viscosity [K]
    pub fn new(
        mass: f64,
        stiffness: f64,
        damping_ref: f64,
        temp_ref: f64,
        heat_capacity: f64,
        thermal_resistance: f64,
        ambient_temp: f64,
        temp_sensitivity: f64,
    ) -> Result<Self> {
        Ok(ThermalMechanicalSystem {
            mass,
            stiffness,
            damping_ref,
            temp_ref,
            heat_capacity,
            thermal_resistance,
            ambient_temp,
            temp_sensitivity,
            expansion_coefficient: 1e-4,  // Steel: ~11e-6, Aluminum: ~23e-6
            youngs_modulus: 200e9,        // Steel: ~200 GPa
            name: "ThermalMechanical".to_string(),
        })
    }

    /// Calculate damping coefficient at given temperature
    ///
    /// Uses Arrhenius-like temperature dependence:
    /// b(T) = b_ref × exp(E_a / (k_B × T) - E_a / (k_B × T_ref))
    /// = b_ref × exp((E_a / k_B) × (1/T - 1/T_ref))
    pub fn damping_at_temperature(&self, temp: f64) -> f64 {
        let exponent = self.temp_sensitivity * (1.0 / temp - 1.0 / self.temp_ref);
        self.damping_ref * exponent.exp()
    }

    /// Calculate natural frequency at given temperature
    ///
    /// ω_n = √(k / m) [rad/s]
    /// Note: frequency doesn't change with temperature (if k and m don't)
    pub fn natural_frequency(&self) -> f64 {
        (self.stiffness / self.mass).sqrt()
    }

    /// Calculate damping ratio at given temperature
    ///
    /// ζ = b / (2 × √(k × m))
    pub fn damping_ratio(&self, temp: f64) -> f64 {
        let b = self.damping_at_temperature(temp);
        b / (2.0 * (self.stiffness * self.mass).sqrt())
    }

    /// Calculate damped frequency at given temperature
    ///
    /// ω_d = ω_n × √(1 - ζ²) [rad/s]
    /// Only valid for underdamped case (ζ < 1)
    pub fn damped_frequency(&self, temp: f64) -> f64 {
        let omega_n = self.natural_frequency();
        let zeta = self.damping_ratio(temp);

        if zeta >= 1.0 {
            0.0  // Overdamped or critically damped
        } else {
            omega_n * (1.0 - zeta * zeta).sqrt()
        }
    }

    /// Calculate power dissipation at given velocity and temperature
    ///
    /// P = b(T) × v²
    /// This power is converted to heat
    pub fn power_dissipation(&self, velocity: f64, temp: f64) -> f64 {
        let b = self.damping_at_temperature(temp);
        b * velocity * velocity
    }

    /// Calculate temperature rise rate from mechanical dissipation
    ///
    /// dT/dt = (P - (T - T_amb) / R_th) / C_th
    /// = (b × v² - (T - T_amb) / R_th) / C_th
    pub fn temperature_rise_rate(&self, velocity: f64, current_temp: f64) -> f64 {
        let power_in = self.power_dissipation(velocity, current_temp);
        let power_out = (current_temp - self.ambient_temp) / self.thermal_resistance;
        (power_in - power_out) / self.heat_capacity
    }

    /// Calculate thermal stress from temperature change
    ///
    /// σ_thermal = E × α × ΔT
    /// Stress only develops if expansion is constrained
    pub fn thermal_stress(&self, temp: f64) -> f64 {
        let delta_t = temp - self.ambient_temp;
        self.youngs_modulus * self.expansion_coefficient * delta_t
    }

    /// Calculate thermal strain
    ///
    /// ε_thermal = α × ΔT
    pub fn thermal_strain(&self, temp: f64) -> f64 {
        let delta_t = temp - self.ambient_temp;
        self.expansion_coefficient * delta_t
    }

    /// Estimate time to reach steady-state temperature
    ///
    /// τ_thermal = C_th × R_th (thermal time constant)
    pub fn thermal_time_constant(&self) -> f64 {
        self.heat_capacity * self.thermal_resistance
    }

    /// Calculate steady-state temperature with constant velocity
    ///
    /// At steady state: dT/dt = 0
    /// 0 = (b × v² - (T_ss - T_amb) / R_th) / C_th
    /// T_ss = T_amb + b × v² × R_th
    pub fn steady_state_temperature(&self, velocity: f64) -> f64 {
        // This requires iterative solution since b depends on T
        // Use simple iteration: start at ambient, compute new T
        let mut temp = self.ambient_temp;

        // Iterate to find equilibrium
        for _ in 0..100 {
            let power = self.power_dissipation(velocity, temp);
            let temp_new = self.ambient_temp + power * self.thermal_resistance;

            // Check convergence
            if (temp_new - temp).abs() < 0.01 {
                return temp_new;
            }
            temp = temp_new;
        }

        temp
    }

    /// Check if system can oscillate (underdamped) at given temperature
    ///
    /// System oscillates if damping ratio ζ < 1
    pub fn can_oscillate(&self, temp: f64) -> bool {
        self.damping_ratio(temp) < 1.0
    }
}

/// Create an example thermal-mechanical coupling system
///
/// # Example: Hydraulic Damper (Shock Absorber)
///
/// - Mass: 100 kg (vehicle corner)
/// - Spring: 20 kN/m suspension stiffness
/// - Reference damping: 500 N·s/m at 293 K
/// - Temp sensitivity: 1500 K (oil viscosity coefficient)
/// - Heat capacity: 1000 J/K (oil + metal housing)
/// - Thermal resistance: 0.01 K/W (to air)
pub fn create_thermal_mechanical_coupling() -> Result<ThermalMechanicalSystem> {
    ThermalMechanicalSystem::new(
        100.0,           // 100 kg load
        20000.0,         // 20 kN/m spring stiffness
        500.0,           // 500 N·s/m damping at 20°C
        293.15,          // 20°C reference
        1000.0,          // 1000 J/K heat capacity
        0.01,            // 0.01 K/W thermal resistance
        293.15,          // 20°C ambient
        1500.0,          // 1500 K temperature sensitivity
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_creation() {
        let system = create_thermal_mechanical_coupling();
        assert!(system.is_ok());
        let sys = system.unwrap();
        assert_eq!(sys.name, "ThermalMechanical");
        assert!(sys.mass > 0.0);
    }

    #[test]
    fn test_damping_temperature_dependence() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Damping vs Temperature:");
        println!("Temperature [°C]\tDamping [N·s/m]\tRatio to 20°C");
        println!("{}", "─".repeat(60));

        let b_ref = system.damping_ref;

        for temp_c in [0, 20, 40, 60, 80] {
            let temp_k = (temp_c as f64) + 273.15;
            let b = system.damping_at_temperature(temp_k);
            let ratio = b / b_ref;

            println!("{:3}\t\t\t{:.0}\t\t\t{:.2}x", temp_c, b, ratio);
        }

        Ok(())
    }

    #[test]
    fn test_natural_frequency() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        let omega_n = system.natural_frequency();
        let f_n = omega_n / (2.0 * std::f64::consts::PI);

        println!("Natural frequency (temperature-independent):");
        println!("  ω_n = √(k/m) = {:.2} rad/s", omega_n);
        println!("  f_n = ω_n/(2π) = {:.2} Hz", f_n);

        assert!(f_n > 0.0, "Frequency must be positive");

        Ok(())
    }

    #[test]
    fn test_damping_ratio_temperature_dependence() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Damping Ratio vs Temperature:");
        println!("Temperature [°C]\tζ\t\tType");
        println!("{}", "─".repeat(60));

        for temp_c in [0, 20, 40, 60, 80] {
            let temp_k = (temp_c as f64) + 273.15;
            let zeta = system.damping_ratio(temp_k);
            let dtype = if zeta < 1.0 {
                "Underdamped"
            } else if (zeta - 1.0).abs() < 0.01 {
                "Critically damped"
            } else {
                "Overdamped"
            };

            println!("{:3}\t\t\t{:.3}\t\t{}", temp_c, zeta, dtype);
        }

        Ok(())
    }

    #[test]
    fn test_power_dissipation() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        // Test power at different temperatures
        let velocities = vec![0.1, 0.5, 1.0];
        let temps_c = vec![0, 20, 40, 60];

        println!("Power Dissipation [W]:");
        println!("Velocity [m/s]");
        print!("Temperature [°C]\t");
        for v in &velocities {
            print!("{:.1}\t\t", v);
        }
        println!();
        println!("{}", "─".repeat(70));

        for temp_c in &temps_c {
            let temp_k = (*temp_c as f64) + 273.15;
            print!("{:3}\t\t\t", temp_c);

            for v in &velocities {
                let p = system.power_dissipation(*v, temp_k);
                print!("{:.2}\t\t", p);
            }
            println!();
        }

        Ok(())
    }

    #[test]
    fn test_thermal_feedback_loop() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Thermal Feedback Analysis (constant velocity = 1 m/s):");
        println!("Temperature [°C]\tPower In [W]\tPower Out [W]\tdT/dt [K/s]");
        println!("{}", "─".repeat(70));

        let velocity = 1.0;  // m/s
        let mut temp = 293.15;  // Start at ambient

        for step in 0..15 {
            let power_in = system.power_dissipation(velocity, temp);
            let power_out = (temp - system.ambient_temp) / system.thermal_resistance;
            let dtemp_dt = system.temperature_rise_rate(velocity, temp);

            println!(
                "{:6.1}\t\t\t{:6.2}\t\t{:6.2}\t\t{:.6}",
                temp - 273.15,
                power_in,
                power_out,
                dtemp_dt
            );

            // Simulate small time step
            temp += dtemp_dt * 10.0;  // 10 second step

            if dtemp_dt.abs() < 0.001 {
                println!("Converged to steady state");
                break;
            }
        }

        Ok(())
    }

    #[test]
    fn test_steady_state_temperature() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Steady-State Temperature vs Velocity:");
        println!("Velocity [m/s]\tT_ss [°C]\tΔT [K]\t\tDamping [N·s/m]");
        println!("{}", "─".repeat(70));

        for v in [0.1, 0.5, 1.0, 1.5, 2.0] {
            let t_ss = system.steady_state_temperature(v);
            let delta_t = t_ss - system.ambient_temp;
            let b_ss = system.damping_at_temperature(t_ss);

            println!(
                "{:.1}\t\t{:.1}\t\t{:.2}\t\t{:.0}",
                v,
                t_ss - 273.15,
                delta_t,
                b_ss
            );
        }

        Ok(())
    }

    #[test]
    fn test_thermal_stress() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Thermal Stress from Temperature Change:");
        println!("ΔT [K]\tThermal Stress [MPa]\tThermal Strain");
        println!("{}", "─".repeat(60));

        for delta_t in [0, 10, 20, 40, 60, 100] {
            let temp = system.ambient_temp + (delta_t as f64);
            let stress = system.thermal_stress(temp);
            let strain = system.thermal_strain(temp);

            println!(
                "{:3}\t{:6.1}\t\t\t{:.2e}",
                delta_t,
                stress / 1e6,
                strain
            );
        }

        Ok(())
    }

    #[test]
    fn test_damped_frequency() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Damped Frequency vs Temperature:");
        println!("Temperature [°C]\tζ\t\tω_d [rad/s]\tf_d [Hz]");
        println!("{}", "─".repeat(70));

        for temp_c in [0, 20, 40, 60, 80] {
            let temp_k = (temp_c as f64) + 273.15;
            let zeta = system.damping_ratio(temp_k);

            if zeta < 1.0 {
                let omega_d = system.damped_frequency(temp_k);
                let f_d = omega_d / (2.0 * std::f64::consts::PI);
                println!(
                    "{:3}\t\t{:.3}\t\t{:.2}\t\t{:.2}",
                    temp_c, zeta, omega_d, f_d
                );
            } else {
                println!("{:3}\t\t{:.3}\t\tOverdamped", temp_c, zeta);
            }
        }

        Ok(())
    }

    #[test]
    fn test_system_parameters() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Thermal-Mechanical System Parameters:");
        println!("  Mass: {:.1} kg", system.mass);
        println!("  Stiffness: {:.0} N/m", system.stiffness);
        println!("  Damping (@ 20°C): {:.0} N·s/m", system.damping_ref);
        println!("  Heat capacity: {:.0} J/K", system.heat_capacity);
        println!("  Thermal resistance: {:.3} K/W", system.thermal_resistance);
        println!("  Thermal time constant: {:.1} s", system.thermal_time_constant());
        println!(
            "  Temperature sensitivity: {:.0} K",
            system.temp_sensitivity
        );

        Ok(())
    }

    #[test]
    fn test_oscillation_capability() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Oscillation Capability vs Temperature:");
        println!("Temperature [°C]\tζ\t\tCan Oscillate?");
        println!("{}", "─".repeat(60));

        for temp_c in [0, 20, 40, 60, 80] {
            let temp_k = (temp_c as f64) + 273.15;
            let zeta = system.damping_ratio(temp_k);
            let can_osc = system.can_oscillate(temp_k);

            println!(
                "{:3}\t\t\t{:.3}\t\t{}",
                temp_c,
                zeta,
                if can_osc { "Yes" } else { "No" }
            );
        }

        Ok(())
    }

    #[test]
    fn test_thermal_runaway_risk() -> Result<()> {
        let system = create_thermal_mechanical_coupling()?;

        println!("Thermal Runaway Risk Analysis:");
        println!("Constant velocity: 1.5 m/s");
        println!();

        // Check if system reaches thermal runaway
        let mut temp = system.ambient_temp;
        let velocity = 1.5;

        for step in 0..50 {
            let dtemp_dt = system.temperature_rise_rate(velocity, temp);
            let b = system.damping_at_temperature(temp);

            if step % 5 == 0 {
                println!(
                    "Step {}: T = {:.1}°C, dT/dt = {:.4} K/s, b = {:.0} N·s/m",
                    step,
                    temp - 273.15,
                    dtemp_dt,
                    b
                );
            }

            // Update temperature
            let temp_new = temp + dtemp_dt * 20.0;  // 20-second time step

            // Check for thermal runaway (temperature increasing unboundedly)
            if temp_new > system.ambient_temp + 200.0 {
                println!("WARNING: Thermal runaway detected!");
                break;
            }

            temp = temp_new;

            // Check convergence
            if dtemp_dt.abs() < 1e-4 {
                println!(
                    "Converged: T = {:.1}°C, dT/dt = {:.6} K/s",
                    temp - 273.15,
                    dtemp_dt
                );
                break;
            }
        }

        Ok(())
    }
}
