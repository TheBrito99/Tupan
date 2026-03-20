//! Coupled Microcontroller-Circuit Simulator
//!
//! Executes microcontroller and circuit simulation with bidirectional data coupling.
//!
//! # Synchronization Model
//!
//! Each simulation step:
//! 1. MCU executes one instruction
//! 2. Read GPIO states from MCU memory
//! 3. Update circuit voltages based on GPIO
//! 4. Convert circuit voltages to ADC values
//! 5. Write ADC values to MCU memory

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::microcontroller::{
    ArmCpuEmulator, MicrocontrollerCircuitInterface, CircuitNodeId,
};

/// Result of one simulation step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationStep {
    /// MCU cycle number (instruction counter)
    pub mcu_cycle: u64,

    /// Circuit node voltages [V]
    pub circuit_node_voltages: HashMap<CircuitNodeId, f64>,

    /// Total elapsed time [seconds]
    pub elapsed_time: f64,
}

/// Coupled microcontroller-circuit simulator
pub struct CoupledMicrocontrollerCircuitSim {
    /// ARM Cortex-M microcontroller emulator
    mcu: ArmCpuEmulator,

    /// Coupling interface
    interface: MicrocontrollerCircuitInterface,

    /// Total cycles executed
    cycle_count: u64,

    /// CPU clock speed [Hz]
    clock_speed: f64,
}

impl CoupledMicrocontrollerCircuitSim {
    /// Create a new coupled simulator
    pub fn new(mcu: ArmCpuEmulator, interface: MicrocontrollerCircuitInterface) -> Self {
        let clock_speed = 72_000_000.0;  // STM32F103 default clock

        CoupledMicrocontrollerCircuitSim {
            mcu,
            interface,
            cycle_count: 0,
            clock_speed,
        }
    }

    /// Execute one simulation step
    pub fn step(&mut self) -> Result<SimulationStep, String> {
        // Step 1: MCU executes one instruction
        self.mcu.step()?;
        self.cycle_count += 1;

        // Step 2-5: Update circuit coupling
        self.interface.step(&mut self.mcu)?;

        // Return step result
        Ok(SimulationStep {
            mcu_cycle: self.cycle_count,
            circuit_node_voltages: self.interface.get_all_voltages().clone(),
            elapsed_time: self.cycle_count as f64 / self.clock_speed,
        })
    }

    /// Run simulation for N microcontroller cycles
    pub fn run_cycles(&mut self, num_cycles: u64) -> Result<Vec<SimulationStep>, String> {
        let mut steps = Vec::new();
        for _ in 0..num_cycles {
            steps.push(self.step()?);
        }
        Ok(steps)
    }

    /// Run until circuit node reaches voltage threshold
    pub fn run_until_voltage_threshold(
        &mut self,
        node: CircuitNodeId,
        threshold: f64,
        timeout_cycles: u64,
    ) -> Result<u64, String> {
        for cycle in 0..timeout_cycles {
            self.step()?;
            if let Some(voltage) = self.interface.get_circuit_voltage(node) {
                if voltage >= threshold {
                    return Ok(cycle + 1);
                }
            }
        }

        Err(format!(
            "Timeout waiting for circuit node {:?} to reach {} V after {} cycles",
            node, threshold, timeout_cycles
        ))
    }

    /// Set circuit node voltage (for external stimuli or testing)
    pub fn set_circuit_voltage(&mut self, node: CircuitNodeId, voltage: f64) -> Result<(), String> {
        self.interface.set_circuit_voltage(node, voltage)
    }

    /// Get circuit node voltage
    pub fn get_circuit_voltage(&self, node: CircuitNodeId) -> Option<f64> {
        self.interface.get_circuit_voltage(node)
    }

    /// Get current cycle count
    pub fn cycle_count(&self) -> u64 {
        self.cycle_count
    }

    /// Get elapsed time [seconds]
    pub fn elapsed_time(&self) -> f64 {
        self.cycle_count as f64 / self.clock_speed
    }

    /// Get reference to MCU for inspection
    pub fn mcu(&self) -> &ArmCpuEmulator {
        &self.mcu
    }

    /// Get mutable reference to MCU (use carefully)
    pub fn mcu_mut(&mut self) -> &mut ArmCpuEmulator {
        &mut self.mcu
    }

    /// Get reference to interface
    pub fn interface(&self) -> &MicrocontrollerCircuitInterface {
        &self.interface
    }

    /// Reset simulation
    pub fn reset(&mut self) -> Result<(), String> {
        self.mcu.reset();
        self.interface.reset();
        self.cycle_count = 0;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simulator_creation() {
        let mcu = ArmCpuEmulator::new();
        let interface = MicrocontrollerCircuitInterface::new();
        let sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);
        assert_eq!(sim.cycle_count(), 0);
    }

    #[test]
    fn test_single_step() -> Result<(), String> {
        let mcu = ArmCpuEmulator::new();
        let interface = MicrocontrollerCircuitInterface::new();
        let mut sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);

        let step = sim.step()?;
        assert_eq!(step.mcu_cycle, 1);
        assert!(step.elapsed_time > 0.0);

        Ok(())
    }

    #[test]
    fn test_run_cycles() -> Result<(), String> {
        let mcu = ArmCpuEmulator::new();
        let interface = MicrocontrollerCircuitInterface::new();
        let mut sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);

        let steps = sim.run_cycles(100)?;
        assert_eq!(steps.len(), 100);
        assert_eq!(steps[99].mcu_cycle, 100);
        assert!(steps[99].elapsed_time > 0.0);

        Ok(())
    }

    #[test]
    fn test_circuit_voltage_control() -> Result<(), String> {
        let mcu = ArmCpuEmulator::new();
        let interface = MicrocontrollerCircuitInterface::new();
        let mut sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);

        let node = CircuitNodeId(1);
        sim.set_circuit_voltage(node, 2.5)?;
        assert_eq!(sim.get_circuit_voltage(node), Some(2.5));

        Ok(())
    }

    #[test]
    fn test_cycle_counting() -> Result<(), String> {
        let mcu = ArmCpuEmulator::new();
        let interface = MicrocontrollerCircuitInterface::new();
        let mut sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);

        sim.run_cycles(50)?;
        assert_eq!(sim.cycle_count(), 50);

        sim.step()?;
        assert_eq!(sim.cycle_count(), 51);

        Ok(())
    }

    #[test]
    fn test_reset() -> Result<(), String> {
        let mcu = ArmCpuEmulator::new();
        let interface = MicrocontrollerCircuitInterface::new();
        let mut sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);

        sim.run_cycles(100)?;
        assert_eq!(sim.cycle_count(), 100);

        sim.reset()?;
        assert_eq!(sim.cycle_count(), 0);

        Ok(())
    }

    #[test]
    fn test_voltage_threshold() -> Result<(), String> {
        let mcu = ArmCpuEmulator::new();
        let interface = MicrocontrollerCircuitInterface::new();
        let mut sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);

        let node = CircuitNodeId(1);
        sim.set_circuit_voltage(node, 0.0)?;

        // Gradually increase voltage
        for i in 1..11 {
            sim.set_circuit_voltage(node, i as f64 * 0.3)?;
            sim.step()?;
        }

        assert!(sim.get_circuit_voltage(node).unwrap_or(0.0) >= 2.7);

        Ok(())
    }
}
