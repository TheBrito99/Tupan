//! CPU Register File
//!
//! ARM Cortex-M register definitions and operations.
//! 16 general-purpose registers (R0-R15) + CPSR (Current Program Status Register)

use serde::{Deserialize, Serialize};
use std::fmt;

/// Register identifier (0-15 for general-purpose, special registers handled separately)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RegisterId {
    R0,
    R1,
    R2,
    R3,
    R4,
    R5,
    R6,
    R7,
    R8,
    R9,
    R10,
    R11,
    R12,
    R13,  // SP (Stack Pointer)
    R14,  // LR (Link Register)
    R15,  // PC (Program Counter)
}

impl RegisterId {
    /// Convert to numeric index (0-15)
    pub fn index(&self) -> usize {
        match self {
            RegisterId::R0 => 0,
            RegisterId::R1 => 1,
            RegisterId::R2 => 2,
            RegisterId::R3 => 3,
            RegisterId::R4 => 4,
            RegisterId::R5 => 5,
            RegisterId::R6 => 6,
            RegisterId::R7 => 7,
            RegisterId::R8 => 8,
            RegisterId::R9 => 9,
            RegisterId::R10 => 10,
            RegisterId::R11 => 11,
            RegisterId::R12 => 12,
            RegisterId::R13 => 13,  // SP
            RegisterId::R14 => 14,  // LR
            RegisterId::R15 => 15,  // PC
        }
    }

    /// Create from numeric index
    pub fn from_index(idx: usize) -> Option<Self> {
        match idx {
            0 => Some(RegisterId::R0),
            1 => Some(RegisterId::R1),
            2 => Some(RegisterId::R2),
            3 => Some(RegisterId::R3),
            4 => Some(RegisterId::R4),
            5 => Some(RegisterId::R5),
            6 => Some(RegisterId::R6),
            7 => Some(RegisterId::R7),
            8 => Some(RegisterId::R8),
            9 => Some(RegisterId::R9),
            10 => Some(RegisterId::R10),
            11 => Some(RegisterId::R11),
            12 => Some(RegisterId::R12),
            13 => Some(RegisterId::R13),
            14 => Some(RegisterId::R14),
            15 => Some(RegisterId::R15),
            _ => None,
        }
    }

    /// Get human-readable name
    pub fn name(&self) -> &str {
        match self {
            RegisterId::R0 => "R0",
            RegisterId::R1 => "R1",
            RegisterId::R2 => "R2",
            RegisterId::R3 => "R3",
            RegisterId::R4 => "R4",
            RegisterId::R5 => "R5",
            RegisterId::R6 => "R6",
            RegisterId::R7 => "R7",
            RegisterId::R8 => "R8",
            RegisterId::R9 => "R9",
            RegisterId::R10 => "R10",
            RegisterId::R11 => "R11",
            RegisterId::R12 => "R12",
            RegisterId::R13 => "SP",
            RegisterId::R14 => "LR",
            RegisterId::R15 => "PC",
        }
    }
}

impl fmt::Display for RegisterId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.name())
    }
}

/// CPSR (Current Program Status Register) flags
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CpsrFlags {
    pub negative: bool,   // N (bit 31)
    pub zero: bool,       // Z (bit 30)
    pub carry: bool,      // C (bit 29)
    pub overflow: bool,   // V (bit 28)
    pub thumb: bool,      // T (bit 5) - Thumb mode (always true for Thumb-2)
    pub irq_disabled: bool,     // I (bit 7)
    pub fiq_disabled: bool,     // F (bit 6)
}

impl CpsrFlags {
    /// Create new CPSR with default values (Thumb mode enabled)
    pub fn new() -> Self {
        CpsrFlags {
            negative: false,
            zero: false,
            carry: false,
            overflow: false,
            thumb: true,  // Always in Thumb mode
            irq_disabled: false,
            fiq_disabled: false,
        }
    }

    /// Update flags based on result of operation
    pub fn update_from_result(&mut self, result: u32) {
        self.negative = (result as i32) < 0;
        self.zero = result == 0;
    }

    /// To 32-bit value (for storage/display)
    pub fn to_u32(&self) -> u32 {
        let mut value = 0u32;
        if self.negative { value |= 0x8000_0000; }
        if self.zero { value |= 0x4000_0000; }
        if self.carry { value |= 0x2000_0000; }
        if self.overflow { value |= 0x1000_0000; }
        if self.thumb { value |= 0x0000_0020; }
        if self.fiq_disabled { value |= 0x0000_0040; }
        if self.irq_disabled { value |= 0x0000_0080; }
        value
    }

    /// From 32-bit value
    pub fn from_u32(value: u32) -> Self {
        CpsrFlags {
            negative: (value & 0x8000_0000) != 0,
            zero: (value & 0x4000_0000) != 0,
            carry: (value & 0x2000_0000) != 0,
            overflow: (value & 0x1000_0000) != 0,
            thumb: (value & 0x0000_0020) != 0,
            fiq_disabled: (value & 0x0000_0040) != 0,
            irq_disabled: (value & 0x0000_0080) != 0,
        }
    }
}

impl Default for CpsrFlags {
    fn default() -> Self {
        Self::new()
    }
}

/// CPU Register File (16 32-bit registers + CPSR)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuRegisters {
    regs: [u32; 16],  // R0-R15
    cpsr: CpsrFlags,  // Current Program Status Register
}

impl CpuRegisters {
    /// Create new register file with all values zeroed, PC = 0
    pub fn new() -> Self {
        CpuRegisters {
            regs: [0; 16],
            cpsr: CpsrFlags::new(),
        }
    }

    /// Create with initial PC value
    pub fn with_pc(pc: u32) -> Self {
        let mut regs = Self::new();
        regs.set_pc(pc);
        regs
    }

    /// Get register value
    pub fn get(&self, reg_id: RegisterId) -> u32 {
        self.regs[reg_id.index()]
    }

    /// Set register value
    pub fn set(&mut self, reg_id: RegisterId, value: u32) {
        self.regs[reg_id.index()] = value;
    }

    /// Get all 16 registers as array
    pub fn all_registers(&self) -> &[u32; 16] {
        &self.regs
    }

    /// Get PC (Program Counter = R15)
    pub fn pc(&self) -> u32 {
        self.get(RegisterId::R15)
    }

    /// Set PC (Program Counter = R15)
    pub fn set_pc(&mut self, value: u32) {
        self.set(RegisterId::R15, value);
    }

    /// Get SP (Stack Pointer = R13)
    pub fn sp(&self) -> u32 {
        self.get(RegisterId::R13)
    }

    /// Set SP
    pub fn set_sp(&mut self, value: u32) {
        self.set(RegisterId::R13, value);
    }

    /// Get LR (Link Register = R14)
    pub fn lr(&self) -> u32 {
        self.get(RegisterId::R14)
    }

    /// Set LR
    pub fn set_lr(&mut self, value: u32) {
        self.set(RegisterId::R14, value);
    }

    /// Get CPSR flags
    pub fn cpsr(&self) -> &CpsrFlags {
        &self.cpsr
    }

    /// Get mutable CPSR flags
    pub fn cpsr_mut(&mut self) -> &mut CpsrFlags {
        &mut self.cpsr
    }

    /// Set CPSR flags
    pub fn set_cpsr(&mut self, flags: CpsrFlags) {
        self.cpsr = flags;
    }

    /// Push register onto stack (decrement SP, write to stack)
    pub fn push(&mut self, value: u32) {
        let sp = self.sp();
        self.set_sp(sp - 4);
    }

    /// Pop value from stack (read from stack, increment SP)
    pub fn pop(&mut self) -> u32 {
        let sp = self.sp();
        self.set_sp(sp + 4);
        0  // Actual value retrieved from memory
    }

    /// Increment PC (typically by 2 for Thumb-2 instructions)
    pub fn advance_pc(&mut self, bytes: u32) {
        let pc = self.pc();
        self.set_pc(pc + bytes);
    }
}

impl Default for CpuRegisters {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_indexing() {
        assert_eq!(RegisterId::R0.index(), 0);
        assert_eq!(RegisterId::R15.index(), 15);
        assert_eq!(RegisterId::R13.index(), 13);  // SP
        assert_eq!(RegisterId::R15.index(), 15);  // PC
    }

    #[test]
    fn test_register_from_index() {
        assert_eq!(RegisterId::from_index(0), Some(RegisterId::R0));
        assert_eq!(RegisterId::from_index(15), Some(RegisterId::R15));
        assert_eq!(RegisterId::from_index(16), None);
    }

    #[test]
    fn test_register_names() {
        assert_eq!(RegisterId::R0.name(), "R0");
        assert_eq!(RegisterId::R13.name(), "SP");
        assert_eq!(RegisterId::R14.name(), "LR");
        assert_eq!(RegisterId::R15.name(), "PC");
    }

    #[test]
    fn test_cpu_registers_create() {
        let regs = CpuRegisters::new();
        for i in 0..16 {
            assert_eq!(regs.get(RegisterId::from_index(i).unwrap()), 0);
        }
    }

    #[test]
    fn test_cpu_registers_get_set() {
        let mut regs = CpuRegisters::new();
        regs.set(RegisterId::R5, 42);
        assert_eq!(regs.get(RegisterId::R5), 42);
    }

    #[test]
    fn test_pc_operations() {
        let mut regs = CpuRegisters::new();
        regs.set_pc(0x8000_0000);
        assert_eq!(regs.pc(), 0x8000_0000);

        regs.advance_pc(2);
        assert_eq!(regs.pc(), 0x8000_0002);
    }

    #[test]
    fn test_cpsr_flags() {
        let mut flags = CpsrFlags::new();
        assert_eq!(flags.thumb, true);
        assert_eq!(flags.zero, false);

        flags.update_from_result(0);
        assert_eq!(flags.zero, true);

        flags.update_from_result(5);
        assert_eq!(flags.zero, false);
    }

    #[test]
    fn test_cpsr_serialization() {
        let flags = CpsrFlags {
            negative: true,
            zero: false,
            carry: true,
            overflow: false,
            thumb: true,
            irq_disabled: false,
            fiq_disabled: false,
        };

        let value = flags.to_u32();
        let flags2 = CpsrFlags::from_u32(value);

        assert_eq!(flags.negative, flags2.negative);
        assert_eq!(flags.zero, flags2.zero);
        assert_eq!(flags.carry, flags2.carry);
    }

    #[test]
    fn test_sp_lr_operations() {
        let mut regs = CpuRegisters::new();
        regs.set_sp(0x2000_0000);
        regs.set_lr(0x0800_0001);

        assert_eq!(regs.sp(), 0x2000_0000);
        assert_eq!(regs.lr(), 0x0800_0001);
    }
}
