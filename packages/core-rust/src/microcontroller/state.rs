//! CPU Execution State
//!
//! Tracks current execution state, instruction pipeline, and system context

use serde::{Deserialize, Serialize};
use crate::microcontroller::{CpuRegisters, CpuMemory, Instruction};

/// CPU execution state (running, halted, fault, etc.)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExecutionState {
    Running,           // Normal execution
    Halted,            // Execution paused
    WFI,               // Wait For Interrupt
    Fault,             // Hard fault or other exception
    Breakpoint,        // Hit user breakpoint
    SingleStep,        // Single-stepping enabled
}

/// CPU State - complete microcontroller execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuState {
    /// CPU registers
    pub registers: CpuRegisters,

    /// Memory (Flash + SRAM)
    pub memory: CpuMemory,

    /// Current execution state
    pub exec_state: ExecutionState,

    /// Total cycles executed
    pub total_cycles: u64,

    /// Instructions executed
    pub instruction_count: u64,

    /// Current instruction (for debugging)
    pub current_instruction: Option<Instruction>,

    /// Last instruction address
    pub last_pc: u32,

    /// Breakpoints (set of addresses)
    pub breakpoints: Vec<u32>,

    /// Watch variables (register/address monitoring)
    pub watch_points: Vec<WatchPoint>,
}

/// Watch point for debugging (monitor register or memory location)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchPoint {
    pub address: u32,
    pub size: WatchSize,
    pub trigger_on: WatchTrigger,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WatchSize {
    Byte,
    Word,
    DoubleWord,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WatchTrigger {
    Read,
    Write,
    Both,
}

impl CpuState {
    /// Create new CPU state with STM32F103 memory configuration
    pub fn new() -> Self {
        CpuState {
            registers: CpuRegisters::new(),
            memory: CpuMemory::new_stm32f103(),
            exec_state: ExecutionState::Running,
            total_cycles: 0,
            instruction_count: 0,
            current_instruction: None,
            last_pc: 0,
            breakpoints: Vec::new(),
            watch_points: Vec::new(),
        }
    }

    /// Create with custom memory configuration
    pub fn with_memory(flash_kb: usize, sram_kb: usize) -> Self {
        CpuState {
            registers: CpuRegisters::new(),
            memory: CpuMemory::with_sizes(flash_kb, sram_kb),
            exec_state: ExecutionState::Running,
            total_cycles: 0,
            instruction_count: 0,
            current_instruction: None,
            last_pc: 0,
            breakpoints: Vec::new(),
            watch_points: Vec::new(),
        }
    }

    /// Load firmware binary into Flash
    pub fn load_firmware(&mut self, firmware: &[u8]) -> Result<(), String> {
        self.memory.load_flash(0, firmware)?;
        // Set initial PC to Flash start
        self.registers.set_pc(0x0000_0000);
        Ok(())
    }

    /// Add breakpoint at address
    pub fn add_breakpoint(&mut self, addr: u32) {
        if !self.breakpoints.contains(&addr) {
            self.breakpoints.push(addr);
        }
    }

    /// Remove breakpoint
    pub fn remove_breakpoint(&mut self, addr: u32) {
        self.breakpoints.retain(|&a| a != addr);
    }

    /// Check if at breakpoint
    pub fn at_breakpoint(&self) -> bool {
        let pc = self.registers.pc();
        self.breakpoints.contains(&pc)
    }

    /// Set execution state
    pub fn set_state(&mut self, state: ExecutionState) {
        self.exec_state = state;
    }

    /// Get execution state
    pub fn state(&self) -> ExecutionState {
        self.exec_state
    }

    /// Advance cycle counter
    pub fn advance_cycles(&mut self, count: u64) {
        self.total_cycles += count;
    }

    /// Increment instruction counter
    pub fn increment_instruction_count(&mut self) {
        self.instruction_count += 1;
    }

    /// Get performance metrics
    pub fn metrics(&self) -> CpuMetrics {
        let cpi = if self.instruction_count > 0 {
            self.total_cycles as f64 / self.instruction_count as f64
        } else {
            0.0
        };

        CpuMetrics {
            total_cycles: self.total_cycles,
            instruction_count: self.instruction_count,
            cpi,
            stack_usage: self.estimate_stack_usage(),
        }
    }

    /// Estimate stack usage (from stack pointer)
    fn estimate_stack_usage(&self) -> u32 {
        let sp = self.registers.sp();
        let stack_start = 0x2000_0000 + self.memory.sram_size() as u32;
        if sp < stack_start {
            stack_start - sp
        } else {
            0
        }
    }
}

impl Default for CpuState {
    fn default() -> Self {
        Self::new()
    }
}

/// CPU Performance Metrics
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub total_cycles: u64,
    pub instruction_count: u64,
    pub cpi: f64,  // Cycles Per Instruction
    pub stack_usage: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_state_creation() {
        let state = CpuState::new();
        assert_eq!(state.exec_state, ExecutionState::Running);
        assert_eq!(state.total_cycles, 0);
        assert_eq!(state.instruction_count, 0);
        assert_eq!(state.registers.pc(), 0);
    }

    #[test]
    fn test_firmware_load() {
        let mut state = CpuState::new();
        let firmware = vec![0x00, 0xBF, 0x00, 0xBF];  // NOP instructions
        state.load_firmware(&firmware).unwrap();

        assert_eq!(state.memory.read_u8(0).unwrap(), 0x00);
        assert_eq!(state.registers.pc(), 0x0000_0000);
    }

    #[test]
    fn test_breakpoints() {
        let mut state = CpuState::new();
        state.add_breakpoint(0x0000_0100);
        state.add_breakpoint(0x0000_0200);

        assert!(!state.at_breakpoint());

        state.registers.set_pc(0x0000_0100);
        assert!(state.at_breakpoint());

        state.remove_breakpoint(0x0000_0100);
        assert!(!state.at_breakpoint());
    }

    #[test]
    fn test_execution_state() {
        let mut state = CpuState::new();
        assert_eq!(state.state(), ExecutionState::Running);

        state.set_state(ExecutionState::Halted);
        assert_eq!(state.state(), ExecutionState::Halted);

        state.set_state(ExecutionState::WFI);
        assert_eq!(state.state(), ExecutionState::WFI);
    }

    #[test]
    fn test_metrics() {
        let mut state = CpuState::new();
        state.total_cycles = 1000;
        state.instruction_count = 500;

        let metrics = state.metrics();
        assert_eq!(metrics.total_cycles, 1000);
        assert_eq!(metrics.instruction_count, 500);
        assert!((metrics.cpi - 2.0).abs() < 0.01);
    }

    #[test]
    fn test_custom_memory() {
        let state = CpuState::with_memory(128, 32);  // 128KB Flash, 32KB SRAM
        assert_eq!(state.memory.flash_size(), 128 * 1024);
        assert_eq!(state.memory.sram_size(), 32 * 1024);
    }

    #[test]
    fn test_cycle_counting() {
        let mut state = CpuState::new();
        state.advance_cycles(10);
        state.increment_instruction_count();
        state.advance_cycles(10);
        state.increment_instruction_count();

        assert_eq!(state.total_cycles, 20);
        assert_eq!(state.instruction_count, 2);
    }
}
