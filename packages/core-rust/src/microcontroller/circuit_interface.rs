//! Microcontroller-Circuit Coupling Interface
//!
//! Provides a simplified interface for coupling microcontroller simulation with circuits
//! through mapped memory locations and registers.
//!
//! # Design
//!
//! Since the Phase 22 microcontroller emulator doesn't expose GPIO/ADC/PWM as separate
//! objects, this interface works with memory and registers:
//!
//! - **GPIO Outputs:** Memory addresses read by circuit interface
//! - **ADC Inputs:** Circuit voltages stored in mapped memory locations
//! - **PWM Outputs:** Register values control circuit behavior
//!
//! # Integration Model
//!
//! Circuit simulation can:
//! 1. Read GPIO states from MCU memory
//! 2. Write ADC values to MCU memory
//! 3. Monitor register changes for PWM control

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::microcontroller::ArmCpuEmulator;

/// Circuit node identifier (voltage point)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CircuitNodeId(pub u32);

/// Circuit element identifier (resistor, capacitor, etc.)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CircuitElementId(pub u32);

/// Mapping from MCU memory location to circuit node
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GpioMapping {
    /// Memory address where GPIO state is stored
    pub memory_address: u32,
    /// Circuit node that this GPIO drives
    pub circuit_node: CircuitNodeId,
    /// Bit position within the address (0-31)
    pub bit_position: u8,
}

/// Mapping from circuit node to MCU memory location for ADC
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct AdcMapping {
    /// ADC channel (0-15)
    pub channel: u8,
    /// Memory address where ADC value is stored
    pub memory_address: u32,
    /// Circuit node to read voltage from
    pub circuit_node: CircuitNodeId,
}

/// Simple coupling interface for microcontroller-circuit integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrocontrollerCircuitInterface {
    /// GPIO outputs mapped to circuit nodes
    gpio_mappings: Vec<GpioMapping>,

    /// ADC inputs mapped from circuit nodes
    adc_mappings: Vec<AdcMapping>,

    /// Circuit node voltages [V]
    circuit_voltages: HashMap<CircuitNodeId, f64>,

    /// ADC reference voltage (typically 3.3V)
    pub adc_reference: f64,

    /// Number of ADC bits
    pub adc_bits: u32,
}

impl MicrocontrollerCircuitInterface {
    /// Create a new coupling interface
    pub fn new() -> Self {
        MicrocontrollerCircuitInterface {
            gpio_mappings: Vec::new(),
            adc_mappings: Vec::new(),
            circuit_voltages: HashMap::new(),
            adc_reference: 3.3,
            adc_bits: 10,  // 10-bit ADC (0-1023)
        }
    }

    /// Map GPIO output to circuit node
    pub fn map_gpio_output(&mut self, memory_addr: u32, bit_pos: u8, node: CircuitNodeId) -> Result<(), String> {
        if bit_pos > 31 {
            return Err(format!("Invalid bit position: {}", bit_pos));
        }
        self.gpio_mappings.push(GpioMapping {
            memory_address: memory_addr,
            circuit_node: node,
            bit_position: bit_pos,
        });
        Ok(())
    }

    /// Map ADC input from circuit node
    pub fn map_adc_input(&mut self, channel: u8, memory_addr: u32, node: CircuitNodeId) -> Result<(), String> {
        if channel > 15 {
            return Err(format!("Invalid ADC channel: {}", channel));
        }
        self.adc_mappings.push(AdcMapping {
            channel,
            memory_address: memory_addr,
            circuit_node: node,
        });
        Ok(())
    }

    /// Set circuit node voltage
    pub fn set_circuit_voltage(&mut self, node: CircuitNodeId, voltage: f64) -> Result<(), String> {
        if voltage < 0.0 || voltage > 5.0 {
            return Err(format!("Invalid voltage: {} V", voltage));
        }
        self.circuit_voltages.insert(node, voltage);
        Ok(())
    }

    /// Get circuit node voltage
    pub fn get_circuit_voltage(&self, node: CircuitNodeId) -> Option<f64> {
        self.circuit_voltages.get(&node).copied()
    }

    /// Update ADC values in MCU memory from circuit voltages
    pub fn update_adc_from_circuit(&self, mcu: &mut ArmCpuEmulator) -> Result<(), String> {
        for adc_map in &self.adc_mappings {
            let voltage = self.circuit_voltages.get(&adc_map.circuit_node).copied().unwrap_or(0.0);

            // Convert to digital value (10-bit: 0-1023)
            let max_value = (1u32 << self.adc_bits) - 1;
            let digital_value = ((voltage / self.adc_reference) * max_value as f64) as u32;
            let digital_value = digital_value.min(max_value);

            // Write to MCU memory
            mcu.state_mut().memory.write_u32(adc_map.memory_address, digital_value)?;
        }
        Ok(())
    }

    /// Read GPIO values from MCU memory and update circuit nodes
    pub fn update_circuit_from_gpio(&mut self, mcu: &ArmCpuEmulator) -> Result<(), String> {
        for gpio_map in &self.gpio_mappings {
            // Read GPIO value from memory
            let value = mcu.state().memory.read_u32(gpio_map.memory_address)?;

            // Extract bit at specified position
            let bit_set = ((value >> gpio_map.bit_position) & 1) != 0;

            // Update circuit voltage: HIGH = 3.3V, LOW = 0V
            let voltage = if bit_set { 3.3 } else { 0.0 };
            self.circuit_voltages.insert(gpio_map.circuit_node, voltage);
        }
        Ok(())
    }

    /// Execute one integration step:
    /// 1. Read GPIO values from MCU
    /// 2. Update circuit from GPIO
    /// 3. Update ADC from circuit
    /// 4. Write ADC values to MCU
    pub fn step(&mut self, mcu: &mut ArmCpuEmulator) -> Result<(), String> {
        self.update_circuit_from_gpio(mcu)?;
        self.update_adc_from_circuit(mcu)?;
        Ok(())
    }

    /// Get all circuit voltages
    pub fn get_all_voltages(&self) -> &HashMap<CircuitNodeId, f64> {
        &self.circuit_voltages
    }

    /// Reset all mappings
    pub fn reset(&mut self) {
        self.gpio_mappings.clear();
        self.adc_mappings.clear();
        self.circuit_voltages.clear();
    }

    /// Get number of GPIO mappings
    pub fn num_gpio_mappings(&self) -> usize {
        self.gpio_mappings.len()
    }

    /// Get number of ADC mappings
    pub fn num_adc_mappings(&self) -> usize {
        self.adc_mappings.len()
    }
}

impl Default for MicrocontrollerCircuitInterface {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interface_creation() {
        let interface = MicrocontrollerCircuitInterface::new();
        assert_eq!(interface.num_gpio_mappings(), 0);
        assert_eq!(interface.num_adc_mappings(), 0);
    }

    #[test]
    fn test_gpio_mapping() {
        let mut interface = MicrocontrollerCircuitInterface::new();
        let result = interface.map_gpio_output(0x1000, 5, CircuitNodeId(1));
        assert!(result.is_ok());
        assert_eq!(interface.num_gpio_mappings(), 1);
    }

    #[test]
    fn test_adc_mapping() {
        let mut interface = MicrocontrollerCircuitInterface::new();
        let result = interface.map_adc_input(0, 0x2000_0000, CircuitNodeId(2));
        assert!(result.is_ok());
        assert_eq!(interface.num_adc_mappings(), 1);
    }

    #[test]
    fn test_invalid_adc_channel() {
        let mut interface = MicrocontrollerCircuitInterface::new();
        let result = interface.map_adc_input(20, 0x2000_0000, CircuitNodeId(2));
        assert!(result.is_err());
    }

    #[test]
    fn test_circuit_voltage() {
        let mut interface = MicrocontrollerCircuitInterface::new();
        interface.set_circuit_voltage(CircuitNodeId(1), 2.5).unwrap();
        assert_eq!(interface.get_circuit_voltage(CircuitNodeId(1)), Some(2.5));
    }

    #[test]
    fn test_invalid_voltage() {
        let mut interface = MicrocontrollerCircuitInterface::new();
        let result = interface.set_circuit_voltage(CircuitNodeId(1), 10.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_adc_conversion() -> Result<(), String> {
        let mut interface = MicrocontrollerCircuitInterface::new();
        let adc_addr = 0x2000_0000;  // SRAM address for STM32F103
        interface.map_adc_input(0, adc_addr, CircuitNodeId(1))?;

        // 0V should convert to 0
        interface.set_circuit_voltage(CircuitNodeId(1), 0.0)?;
        let mut mcu = ArmCpuEmulator::new();
        interface.update_adc_from_circuit(&mut mcu)?;
        let val = mcu.state().memory.read_u32(adc_addr)?;
        assert_eq!(val, 0);

        // 3.3V should convert to 1023 (10-bit max)
        interface.set_circuit_voltage(CircuitNodeId(1), 3.3)?;
        interface.update_adc_from_circuit(&mut mcu)?;
        let val = mcu.state().memory.read_u32(adc_addr)?;
        assert_eq!(val, 1023);

        // 1.65V should convert to ~512
        interface.set_circuit_voltage(CircuitNodeId(1), 1.65)?;
        interface.update_adc_from_circuit(&mut mcu)?;
        let val = mcu.state().memory.read_u32(adc_addr)?;
        assert!(val >= 500 && val <= 530);

        Ok(())
    }

    #[test]
    fn test_reset() {
        let mut interface = MicrocontrollerCircuitInterface::new();
        interface.map_gpio_output(0x2000_0000, 5, CircuitNodeId(1)).unwrap();
        interface.map_adc_input(0, 0x2000_0004, CircuitNodeId(2)).unwrap();
        interface.set_circuit_voltage(CircuitNodeId(1), 2.0).unwrap();

        interface.reset();

        assert_eq!(interface.num_gpio_mappings(), 0);
        assert_eq!(interface.num_adc_mappings(), 0);
        assert_eq!(interface.get_circuit_voltage(CircuitNodeId(1)), None);
    }
}
