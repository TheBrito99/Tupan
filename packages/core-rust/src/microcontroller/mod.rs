//! Microcontroller Simulation Module (Phase 22)
//!
//! Complete microcontroller emulation with ARM Cortex-M instruction set support,
//! peripheral models (GPIO, ADC, PWM, UART, I2C/SPI), and integration with
//! circuit simulators for closed-loop embedded systems testing.
//!
//! Task 1: CPU Emulator Core & Instruction Set (COMPLETE)
//! Task 2: Interrupt & Timer Subsystem (COMPLETE)
//! Task 3: Peripheral Models (IN PROGRESS)
//! Task 4: Firmware Code Generation (TODO)
//! Task 5: Circuit Integration (TODO)
//! Task 6: Debugging & Visualization (TODO)

pub mod cpu;
pub mod instruction;
pub mod registers;
pub mod memory;
pub mod state;
pub mod interrupt;
pub mod timer;
pub mod gpio;
pub mod adc;
pub mod pwm;
pub mod codegen;
pub mod circuit_interface;
pub mod coupled_simulator;

pub use cpu::ArmCpuEmulator;
pub use instruction::{Instruction, InstructionSet, ArmThumb2};
pub use registers::{CpuRegisters, RegisterId};
pub use memory::CpuMemory;
pub use state::{CpuState, ExecutionState};
pub use interrupt::{Nvic, ExceptionType, InterruptState};
pub use timer::{SysTick, GpTimer, TimerMode};
pub use gpio::{GpioPin, GpioPort, PinMode, PullMode};
pub use adc::{Adc, AdcChannel, AdcResolution, ConversionMode};
pub use pwm::{PwmTimer, PwmChannel, PwmMode};
pub use codegen::{FirmwareCode, CodeGenerator, McuTarget};
pub use circuit_interface::{
    MicrocontrollerCircuitInterface, CircuitNodeId, CircuitElementId,
    GpioMapping, AdcMapping,
};
pub use coupled_simulator::{CoupledMicrocontrollerCircuitSim, SimulationStep};

#[cfg(test)]
mod tests;
