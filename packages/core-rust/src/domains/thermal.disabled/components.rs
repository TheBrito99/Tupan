//! Thermal Circuit Components
//!
//! Thermal components model heat transfer phenomena in circuits.
//! These follow direct analogies to electrical components.

use serde::{Deserialize, Serialize};

/// Thermal circuit component types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThermalComponent {
    /// Thermal Resistance: R_th = ΔL / (k * A) [K/W]
    /// Heat flow: q = ΔT / R_th (Fourier's Law)
    ThermalResistance {
        /// Thermal resistance [K/W]
        resistance: f64,
        /// Material name (for reference)
        material: Option<String>,
        /// Length of heat path [m]
        length: Option<f64>,
        /// Cross-sectional area [m²]
        area: Option<f64>,
    },

    /// Thermal Capacitance: C_th = m * c_p [J/K]
    /// Heat storage: Q = C_th * ΔT
    /// Transient response: C_th * dT/dt + q = 0
    ThermalCapacitance {
        /// Thermal capacitance [J/K]
        capacitance: f64,
        /// Mass [kg]
        mass: Option<f64>,
        /// Specific heat capacity [J/(kg·K)]
        specific_heat: Option<f64>,
    },

    /// Heat Source: constant heat generation [W]
    /// Analogous to voltage source: produces fixed heat flow
    HeatSource {
        /// Heat generation rate [W]
        power: f64,
        /// Name of heat source
        name: Option<String>,
    },

    /// Temperature Source: fixed temperature boundary [°C]
    /// Analogous to ground in electrical circuits
    TemperatureSource {
        /// Temperature [°C]
        temperature: f64,
        /// Name of temperature source
        name: Option<String>,
    },

    /// Convection Heat Transfer: q = h * A * (T_surface - T_ambient) [W]
    /// h = convection coefficient [W/(m²·K)]
    /// A = surface area [m²]
    Convection {
        /// Convection coefficient [W/(m²·K)]
        /// Typical values:
        ///   - Natural air: 5-25
        ///   - Forced air: 25-250
        ///   - Natural water: 50-1000
        ///   - Forced water: 500-10000
        coefficient: f64,
        /// Surface area [m²]
        area: f64,
        /// Reference/ambient temperature [°C]
        ambient_temperature: Option<f64>,
        /// Surface name
        name: Option<String>,
    },

    /// Radiation Heat Transfer: q = ε * σ * A * (T_s^4 - T_amb^4) [W]
    /// ε = emissivity (0-1)
    /// σ = Stefan-Boltzmann constant = 5.67e-8 W/(m²·K⁴)
    /// A = surface area [m²]
    Radiation {
        /// Emissivity (0-1)
        /// Typical values:
        ///   - Polished aluminum: 0.03-0.04
        ///   - Oxidized aluminum: 0.25
        ///   - Black paint: 0.95-0.98
        ///   - Human skin: 0.95-0.98
        emissivity: f64,
        /// Surface area [m²]
        area: f64,
        /// Reference/ambient temperature [K or °C + 273.15]
        ambient_temperature: Option<f64>,
        /// Surface name
        name: Option<String>,
    },

    /// Phase Change Material: absorbs/releases latent heat
    /// q = m * L_f during phase change [W·s or J]
    /// Below/above melting point: acts as thermal capacitance
    PhaseChangeMaterial {
        /// Mass [kg]
        mass: f64,
        /// Latent heat of fusion [J/kg]
        latent_heat: f64,
        /// Melting temperature [°C]
        melting_temperature: f64,
        /// Solid specific heat [J/(kg·K)]
        specific_heat_solid: f64,
        /// Liquid specific heat [J/(kg·K)]
        specific_heat_liquid: f64,
    },

    /// Thermal Interface Material (TIM): thin layer between surfaces
    /// R_th = thickness / (k * A) [K/W]
    /// Examples: thermal paste, graphite sheets, phase change materials
    ThermalInterfaceMaterial {
        /// Thermal conductivity [W/(m·K)]
        conductivity: f64,
        /// Thickness [m]
        thickness: f64,
        /// Area [m²]
        area: f64,
        /// Material description
        material: Option<String>,
    },

    /// Heat Spreader: reduces temperature gradient
    /// 2D spreading resistance: accounts for lateral heat flow
    HeatSpreader {
        /// Spreading efficiency (0-1)
        /// 1.0 = perfect spreading, 0.0 = no spreading
        efficiency: f64,
        /// Base area [m²]
        area: f64,
        /// Material name
        material: Option<String>,
    },

    /// Pump/Compressor: circulates heat transfer fluid
    /// Active component that produces heat flow
    Pump {
        /// Flow rate [m³/s or L/min]
        flow_rate: f64,
        /// Fluid temperature rise [K]
        delta_temperature: f64,
        /// Fluid specific heat [J/(kg·K)]
        fluid_specific_heat: f64,
        /// Pump name
        name: Option<String>,
    },

    /// Fan: active cooling device
    /// Heat removal: q = ṁ * c_p * ΔT
    /// ṁ = mass flow rate [kg/s]
    Fan {
        /// Mass flow rate [kg/s]
        mass_flow_rate: f64,
        /// Temperature drop [K]
        temperature_drop: f64,
        /// Air specific heat [J/(kg·K)]
        air_specific_heat: f64,
        /// Fan efficiency (0-1)
        efficiency: f64,
        /// Power consumption [W]
        power: f64,
    },

    /// Heat Pipe: two-phase device with very high thermal conductance
    /// Effective thermal conductivity: k_eff >> material conductivity
    HeatPipe {
        /// Effective thermal conductivity [W/(m·K)]
        /// Typical: 10,000-100,000 W/(m·K) (vs copper: 400)
        effective_conductivity: f64,
        /// Length [m]
        length: f64,
        /// Cross-sectional area [m²]
        area: f64,
        /// Working fluid (water, acetone, ammonia, etc)
        fluid: Option<String>,
    },
}

impl ThermalComponent {
    /// Get component name for display
    pub fn name(&self) -> String {
        match self {
            Self::ThermalResistance { material, .. } => {
                format!("R_th ({})", material.as_deref().unwrap_or("material"))
            }
            Self::ThermalCapacitance { .. } => "C_th".to_string(),
            Self::HeatSource { name, .. } => {
                format!("Q̇ ({})", name.as_deref().unwrap_or("source"))
            }
            Self::TemperatureSource { name, .. } => {
                format!("T ({})", name.as_deref().unwrap_or("ref"))
            }
            Self::Convection { name, .. } => {
                format!("h ({})", name.as_deref().unwrap_or("conv"))
            }
            Self::Radiation { name, .. } => {
                format!("ε ({})", name.as_deref().unwrap_or("rad"))
            }
            Self::PhaseChangeMaterial { .. } => "PCM".to_string(),
            Self::ThermalInterfaceMaterial { material, .. } => {
                format!("TIM ({})", material.as_deref().unwrap_or("paste"))
            }
            Self::HeatSpreader { material, .. } => {
                format!("Spreader ({})", material.as_deref().unwrap_or("metal"))
            }
            Self::Pump { name, .. } => {
                format!("Pump ({})", name.as_deref().unwrap_or("device"))
            }
            Self::Fan { efficiency, .. } => {
                format!("Fan (efficiency: {:.1}%)", efficiency * 100.0)
            }
            Self::HeatPipe { fluid, .. } => {
                format!("HeatPipe ({})", fluid.as_deref().unwrap_or("water"))
            }
        }
    }

    /// Get thermal resistance in K/W
    /// Returns None if component doesn't have a simple resistance value
    pub fn get_resistance(&self) -> Option<f64> {
        match self {
            Self::ThermalResistance { resistance, .. } => Some(*resistance),
            Self::ThermalInterfaceMaterial { conductivity, thickness, area } => {
                Some(thickness / (conductivity * area))
            }
            Self::HeatPipe { effective_conductivity, length, area } => {
                Some(length / (effective_conductivity * area))
            }
            _ => None,
        }
    }

    /// Get thermal capacitance in J/K
    /// Returns None if component doesn't have a simple capacitance value
    pub fn get_capacitance(&self) -> Option<f64> {
        match self {
            Self::ThermalCapacitance { capacitance, .. } => Some(*capacitance),
            Self::PhaseChangeMaterial { mass, specific_heat_solid, .. } => {
                Some(mass * specific_heat_solid)
            }
            _ => None,
        }
    }

    /// Get heat generation in W
    /// Returns None if component doesn't generate heat
    pub fn get_heat_generation(&self) -> Option<f64> {
        match self {
            Self::HeatSource { power, .. } => Some(*power),
            Self::Fan { power, .. } => Some(*power),
            Self::Pump { flow_rate, delta_temperature, fluid_specific_heat, .. } => {
                // Assume water density ~1000 kg/m³
                let mass_flow = flow_rate * 1000.0;
                Some(mass_flow * fluid_specific_heat * delta_temperature)
            }
            _ => None,
        }
    }

    /// Get reference temperature in °C
    pub fn get_reference_temperature(&self) -> Option<f64> {
        match self {
            Self::TemperatureSource { temperature, .. } => Some(*temperature),
            Self::Convection { ambient_temperature, .. } => *ambient_temperature,
            Self::Radiation { ambient_temperature, .. } => *ambient_temperature,
            _ => None,
        }
    }

    /// Check if component is a temperature boundary condition
    pub fn is_temperature_source(&self) -> bool {
        matches!(self, Self::TemperatureSource { .. })
    }

    /// Check if component is a heat source
    pub fn is_heat_source(&self) -> bool {
        matches!(self, Self::HeatSource { .. } | Self::Fan { .. } | Self::Pump { .. })
    }

    /// Check if component is a resistive element
    pub fn is_resistive(&self) -> bool {
        matches!(
            self,
            Self::ThermalResistance { .. }
                | Self::Convection { .. }
                | Self::Radiation { .. }
                | Self::ThermalInterfaceMaterial { .. }
                | Self::HeatPipe { .. }
        )
    }

    /// Check if component has capacitive (storage) properties
    pub fn is_capacitive(&self) -> bool {
        matches!(
            self,
            Self::ThermalCapacitance { .. } | Self::PhaseChangeMaterial { .. }
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thermal_resistance_creation() {
        let resistor = ThermalComponent::ThermalResistance {
            resistance: 0.5,
            material: Some("Aluminum".to_string()),
            length: Some(0.01),
            area: Some(0.001),
        };

        assert_eq!(resistor.get_resistance(), Some(0.5));
        assert!(resistor.is_resistive());
        assert!(!resistor.is_capacitive());
    }

    #[test]
    fn test_thermal_capacitance_creation() {
        let capacitor = ThermalComponent::ThermalCapacitance {
            capacitance: 5000.0,
            mass: Some(1.0),
            specific_heat: Some(5000.0),
        };

        assert_eq!(capacitor.get_capacitance(), Some(5000.0));
        assert!(capacitor.is_capacitive());
        assert!(!capacitor.is_resistive());
    }

    #[test]
    fn test_heat_source_creation() {
        let source = ThermalComponent::HeatSource {
            power: 100.0,
            name: Some("CPU".to_string()),
        };

        assert_eq!(source.get_heat_generation(), Some(100.0));
        assert!(source.is_heat_source());
    }

    #[test]
    fn test_temperature_source_creation() {
        let source = ThermalComponent::TemperatureSource {
            temperature: 25.0,
            name: Some("Ambient".to_string()),
        };

        assert!(source.is_temperature_source());
        assert_eq!(source.get_reference_temperature(), Some(25.0));
    }

    #[test]
    fn test_convection_component() {
        let convection = ThermalComponent::Convection {
            coefficient: 25.0,  // Natural air convection
            area: 0.01,
            ambient_temperature: Some(25.0),
            name: Some("Natural Conv".to_string()),
        };

        assert!(convection.is_resistive());
        assert_eq!(convection.get_reference_temperature(), Some(25.0));
    }

    #[test]
    fn test_radiation_component() {
        let radiation = ThermalComponent::Radiation {
            emissivity: 0.9,
            area: 0.01,
            ambient_temperature: Some(298.0),  // 25°C in K
            name: Some("Black paint".to_string()),
        };

        assert!(radiation.is_resistive());
        assert_eq!(radiation.get_reference_temperature(), Some(298.0));
    }

    #[test]
    fn test_heat_pipe_properties() {
        let pipe = ThermalComponent::HeatPipe {
            effective_conductivity: 50000.0,
            length: 0.5,
            area: 0.00001,
            fluid: Some("Water".to_string()),
        };

        let r_th = pipe.get_resistance();
        assert!(r_th.is_some());
        let r = r_th.unwrap();
        assert!(r < 0.001);  // Very low resistance due to high effective conductivity
    }

    #[test]
    fn test_thermal_interface_material() {
        let tim = ThermalComponent::ThermalInterfaceMaterial {
            conductivity: 3.0,  // Typical thermal paste
            thickness: 0.0001,
            area: 0.001,
            material: Some("Thermal Paste".to_string()),
        };

        let r_th = tim.get_resistance();
        assert!(r_th.is_some());
        assert!((r_th.unwrap() - 0.0333).abs() < 0.001);
    }
}
