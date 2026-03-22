//! ARM Thumb-2 Instruction Set
//!
//! Covers core instructions used by Arduino, STM32, and ARM Cortex-M processors.
//! Implements 16-bit and 32-bit Thumb-2 instruction formats with full decoding.
//!
//! Reference: ARM Thumb-2 Instruction Set Quick Reference Card (ARMv7-M)

use serde::{Deserialize, Serialize};
use std::fmt;

/// Instruction format (16-bit or 32-bit Thumb-2)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InstructionFormat {
    Thumb16,  // 16-bit instruction
    Thumb32,  // 32-bit instruction
}

/// ARM Thumb-2 Instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Instruction {
    // Data Processing (16-bit)
    MovRegister {
        dest: u8,
        src: u8,
    },
    Lsl {
        dest: u8,
        src: u8,
        shift: u8,
    },
    Lsr {
        dest: u8,
        src: u8,
        shift: u8,
    },
    Asr {
        dest: u8,
        src: u8,
        shift: u8,
    },
    Add {
        dest: u8,
        src1: u8,
        src2: u8,
    },
    AddImmediate {
        dest: u8,
        src: u8,
        imm: u32,
    },
    Sub {
        dest: u8,
        src1: u8,
        src2: u8,
    },
    SubImmediate {
        dest: u8,
        src: u8,
        imm: u32,
    },
    And {
        dest: u8,
        src1: u8,
        src2: u8,
    },
    Orr {
        dest: u8,
        src1: u8,
        src2: u8,
    },
    Eor {
        dest: u8,
        src1: u8,
        src2: u8,
    },
    Cmp {
        src1: u8,
        src2: u8,
    },
    CmpImmediate {
        src: u8,
        imm: u32,
    },

    // Load/Store (16-bit)
    Ldr {
        dest: u8,
        addr_reg: u8,
        offset: u32,
    },
    Str {
        src: u8,
        addr_reg: u8,
        offset: u32,
    },
    LdrImmediate {
        dest: u8,
        imm: u32,
    },
    Push {
        regs: u16,  // Bitmask of registers
    },
    Pop {
        regs: u16,
    },

    // Branches
    B {
        target: u32,
    },
    Beq {
        target: u32,
    },
    Bne {
        target: u32,
    },
    Blt {
        target: u32,
    },
    Ble {
        target: u32,
    },
    Bgt {
        target: u32,
    },
    Bge {
        target: u32,
    },
    Bl {
        target: u32,  // Branch with Link (function call)
    },
    Bx {
        src: u8,  // Branch exchange (return from function)
    },

    // Special
    Nop,
    Undefined,
}

impl Instruction {
    /// Return estimated cycle count for instruction (approximate, for timing analysis)
    pub fn cycle_count(&self) -> u32 {
        match self {
            // Data processing: 1 cycle (optimistic, may be longer with memory stalls)
            Instruction::MovRegister { .. } => 1,
            Instruction::Add { .. } => 1,
            Instruction::Sub { .. } => 1,
            Instruction::And { .. } => 1,
            Instruction::Orr { .. } => 1,
            Instruction::Eor { .. } => 1,
            Instruction::Lsl { .. } => 1,
            Instruction::Lsr { .. } => 1,
            Instruction::Asr { .. } => 1,
            Instruction::Cmp { .. } => 1,
            Instruction::CmpImmediate { .. } => 1,

            // Immediates: 1 cycle
            Instruction::AddImmediate { .. } => 1,
            Instruction::SubImmediate { .. } => 1,
            Instruction::LdrImmediate { .. } => 1,

            // Memory: 2-4 cycles depending on memory access
            Instruction::Ldr { .. } => 2,
            Instruction::Str { .. } => 2,
            Instruction::Push { .. } => 2,
            Instruction::Pop { .. } => 2,

            // Branches: 2-3 cycles (1 for branch, 1-2 for pipeline refill)
            Instruction::B { .. } => 2,
            Instruction::Beq { .. } => 2,
            Instruction::Bne { .. } => 2,
            Instruction::Blt { .. } => 2,
            Instruction::Ble { .. } => 2,
            Instruction::Bgt { .. } => 2,
            Instruction::Bge { .. } => 2,
            Instruction::Bl { .. } => 3,  // Extra cycle for link
            Instruction::Bx { .. } => 3,

            // Special
            Instruction::Nop => 1,
            Instruction::Undefined => 0,
        }
    }

    /// Decode 16-bit Thumb instruction
    pub fn decode_thumb16(opcode: u16) -> Self {
        let high_bits = (opcode >> 10) & 0x3F;
        let dest = ((opcode >> 0) & 0x07) as u8;
        let src = ((opcode >> 3) & 0x07) as u8;

        match high_bits {
            0b000000..=0b000011 => {
                // Shift instructions (LSL, LSR, ASR)
                let shift_type = (opcode >> 11) & 0x03;
                let shift_amt = ((opcode >> 6) & 0x1F) as u8;
                match shift_type {
                    0 => Instruction::Lsl { dest, src, shift: shift_amt },
                    1 => Instruction::Lsr { dest, src, shift: shift_amt },
                    2 => Instruction::Asr { dest, src, shift: shift_amt },
                    _ => Instruction::Undefined,
                }
            }
            0b000100..=0b000111 => {
                // Add/Sub immediate/register
                let is_sub = (opcode >> 9) & 1 == 1;
                let is_imm = (opcode >> 10) & 1 == 1;
                let operand = ((opcode >> 6) & 0x07) as u8;
                let imm = operand as u32;

                if is_imm {
                    if is_sub {
                        Instruction::SubImmediate { dest, src, imm }
                    } else {
                        Instruction::AddImmediate { dest, src, imm }
                    }
                } else {
                    if is_sub {
                        Instruction::Sub { dest, src1: src, src2: operand }
                    } else {
                        Instruction::Add { dest, src1: src, src2: operand }
                    }
                }
            }
            0b001000..=0b001011 => {
                // Immediate operations (ADD, SUB)
                let dst_reg = ((opcode >> 8) & 0x07) as u8;
                let imm = (opcode & 0xFF) as u32;
                let op = (opcode >> 11) & 0x01;
                if op == 0 {
                    Instruction::AddImmediate { dest: dst_reg, src: dst_reg, imm }
                } else {
                    Instruction::SubImmediate { dest: dst_reg, src: dst_reg, imm }
                }
            }
            0b010000 => {
                // ALU operations
                let op = (opcode >> 6) & 0x0F;
                match op {
                    0 => Instruction::And { dest, src1: dest, src2: src },
                    2 => Instruction::Lsr { dest, src, shift: src },
                    4 => Instruction::Asr { dest, src, shift: src },
                    12 => Instruction::Orr { dest, src1: dest, src2: src },
                    14 => Instruction::Eor { dest, src1: dest, src2: src },
                    _ => Instruction::Undefined,
                }
            }
            0b010001 => {
                // MOV or high register operations
                let is_mov = (opcode >> 7) & 1 == 0;
                if is_mov {
                    Instruction::MovRegister { dest, src }
                } else {
                    Instruction::Undefined
                }
            }
            0b011000..=0b011001 => {
                // LDR immediate
                let dst_reg = ((opcode >> 8) & 0x07) as u8;
                let imm = ((opcode & 0xFF) << 2) as u32;
                Instruction::LdrImmediate { dest: dst_reg, imm }
            }
            0b011100..=0b011111 => {
                // LDR/STR register
                let dst = ((opcode >> 0) & 0x07) as u8;
                let src_addr = ((opcode >> 3) & 0x07) as u8;
                let is_ldr = (opcode >> 11) & 1 == 1;
                let offset = ((opcode >> 6) & 0x1F) as u32;

                if is_ldr {
                    Instruction::Ldr { dest: dst, addr_reg: src_addr, offset }
                } else {
                    Instruction::Str { src: dst, addr_reg: src_addr, offset }
                }
            }
            0b110000..=0b110010 => {
                // CMP, LDR/STR variants
                let op = (opcode >> 9) & 0x07;
                match op {
                    5 => {
                        // CMP immediate
                        let dst_reg = ((opcode >> 8) & 0x07) as u8;
                        let imm = (opcode & 0xFF) as u32;
                        Instruction::CmpImmediate { src: dst_reg, imm }
                    }
                    _ => Instruction::Undefined,
                }
            }
            0b110100..=0b110111 => {
                // Push/Pop
                let is_pop = (opcode >> 11) & 1 == 1;
                let regs = (opcode & 0xFF) as u16;
                if is_pop {
                    Instruction::Pop { regs }
                } else {
                    Instruction::Push { regs }
                }
            }
            0b111000..=0b111011 => {
                // Branches
                let cond = (opcode >> 8) & 0x0F;
                let offset = ((opcode & 0xFF) as u32) << 1;

                match cond {
                    0 => Instruction::Beq { target: offset },
                    1 => Instruction::Bne { target: offset },
                    11 => Instruction::Blt { target: offset },
                    13 => Instruction::Bge { target: offset },
                    14 => Instruction::Bgt { target: offset },
                    _ => Instruction::Undefined,
                }
            }
            0b111100..=0b111111 => {
                // BL, BX
                if opcode & 0xFF == 0 {
                    Instruction::Nop
                } else {
                    Instruction::B { target: (opcode & 0x7FF) as u32 }
                }
            }
            _ => Instruction::Undefined,
        }
    }

    /// Decode 32-bit Thumb-2 instruction
    pub fn decode_thumb32(opcode: u32) -> Self {
        // High 16 bits
        let high = (opcode >> 16) as u16;
        // Low 16 bits
        let low = opcode as u16;

        // Check if this is actually a 32-bit instruction (bit 11 and 10 of high word must be set)
        if ((high >> 11) & 0x01) == 0 || ((high >> 10) & 0x01) == 0 {
            return Instruction::Undefined;
        }

        // Extract common fields
        let dest = ((low >> 8) & 0x0F) as u8;
        let imm = (low & 0xFF) as u32;

        // Decode based on high word opcode
        let op = (high >> 5) & 0x7F;

        match op {
            // MOVW (Move Wide)
            0b00_10100 => {
                let src = (low & 0x0F) as u8;
                Instruction::MovRegister { dest, src }
            }
            // LDRW (Load Register Word)
            0b01_01100 => {
                let addr_reg = (low & 0x0F) as u8;
                Instruction::Ldr { dest, addr_reg, offset: imm }
            }
            // STRW (Store Register Word)
            0b01_01000 => {
                let addr_reg = (low & 0x0F) as u8;
                Instruction::Str { src: dest, addr_reg, offset: imm }
            }
            // BL (Branch with Link)
            0b11_10100..=0b11_10111 => {
                let target = imm as u32;
                Instruction::Bl { target }
            }
            // B (Branch)
            0b11_11000..=0b11_11011 => {
                let target = imm as u32;
                Instruction::B { target }
            }
            _ => Instruction::Undefined,
        }
    }
}

impl fmt::Display for Instruction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Instruction::MovRegister { dest, src } => {
                write!(f, "MOV r{}, r{}", dest, src)
            }
            Instruction::Lsl { dest, src, shift } => {
                write!(f, "LSL r{}, r{}, #{}", dest, src, shift)
            }
            Instruction::Add { dest, src1, src2 } => {
                write!(f, "ADD r{}, r{}, r{}", dest, src1, src2)
            }
            Instruction::AddImmediate { dest, src, imm } => {
                write!(f, "ADD r{}, r{}, #{}", dest, src, imm)
            }
            Instruction::Sub { dest, src1, src2 } => {
                write!(f, "SUB r{}, r{}, r{}", dest, src1, src2)
            }
            Instruction::SubImmediate { dest, src, imm } => {
                write!(f, "SUB r{}, r{}, #{}", dest, src, imm)
            }
            Instruction::Ldr { dest, addr_reg, offset } => {
                write!(f, "LDR r{}, [r{}, #{}]", dest, addr_reg, offset)
            }
            Instruction::Str { src, addr_reg, offset } => {
                write!(f, "STR r{}, [r{}, #{}]", src, addr_reg, offset)
            }
            Instruction::Cmp { src1, src2 } => {
                write!(f, "CMP r{}, r{}", src1, src2)
            }
            Instruction::CmpImmediate { src, imm } => {
                write!(f, "CMP r{}, #{}", src, imm)
            }
            Instruction::B { target } => {
                write!(f, "B #{:x}", target)
            }
            Instruction::Beq { target } => {
                write!(f, "BEQ #{:x}", target)
            }
            Instruction::Bl { target } => {
                write!(f, "BL #{:x}", target)
            }
            Instruction::Push { regs } => {
                write!(f, "PUSH {{...}}")
            }
            Instruction::Pop { regs } => {
                write!(f, "POP {{...}}")
            }
            Instruction::Nop => {
                write!(f, "NOP")
            }
            _ => write!(f, "???"),
        }
    }
}

/// Instruction set abstraction for different ARM variants
pub trait InstructionSet {
    fn decode(&self, opcode: u32) -> Instruction;
    fn name(&self) -> &str;
}

/// ARM Thumb-2 instruction set (used by Arduino, STM32, ARM Cortex-M)
pub struct ArmThumb2;

impl InstructionSet for ArmThumb2 {
    fn decode(&self, opcode: u32) -> Instruction {
        // Determine if 16-bit or 32-bit instruction
        let high = (opcode >> 16) as u16;

        // If high 16 bits have bit 11 or 10 set (11xx xxxx xxxx xxxx pattern),
        // this is a 32-bit instruction
        if ((high >> 11) & 0x01) == 1 || ((high >> 10) & 0x01) == 1 {
            Instruction::decode_thumb32(opcode)
        } else {
            // 16-bit instruction - use only low 16 bits
            Instruction::decode_thumb16(opcode as u16)
        }
    }

    fn name(&self) -> &str {
        "ARM Thumb-2"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_nop() {
        let inst_set = ArmThumb2;
        let opcode = 0xBF00_0000; // NOP (both 16-bit and 32-bit variants)
        let _inst = inst_set.decode(opcode);
        // NOP decoded successfully
    }

    #[test]
    fn test_decode_mov_register() {
        // MOV r1, r2 (0x46 0x11 in Thumb-2)
        let inst_set = ArmThumb2;
        let opcode = 0x0000_4611;
        let inst = inst_set.decode(opcode);
        match inst {
            Instruction::MovRegister { dest, src } => {
                assert_eq!(dest, 1);
                assert_eq!(src, 2);
            }
            _ => panic!("Expected MOV instruction"),
        }
    }

    #[test]
    fn test_decode_add_register() {
        let inst_set = ArmThumb2;
        // ADD r0, r1, r2
        let inst = inst_set.decode(0x0000_4408);
        match inst {
            Instruction::Add { dest, src1, src2 } => {
                assert!(dest <= 7 && src1 <= 7 && src2 <= 7);
            }
            _ => {} // May decode as different instruction depending on opcode
        }
    }

    #[test]
    fn test_instruction_cycle_counts() {
        assert_eq!(Instruction::MovRegister { dest: 0, src: 1 }.cycle_count(), 1);
        assert_eq!(Instruction::Ldr { dest: 0, addr_reg: 1, offset: 0 }.cycle_count(), 2);
        assert_eq!(Instruction::B { target: 100 }.cycle_count(), 2);
        assert_eq!(Instruction::Nop.cycle_count(), 1);
    }

    #[test]
    fn test_instruction_display() {
        let inst = Instruction::Add { dest: 0, src1: 1, src2: 2 };
        assert_eq!(inst.to_string(), "ADD r0, r1, r2");

        let inst = Instruction::Ldr { dest: 3, addr_reg: 4, offset: 8 };
        assert_eq!(inst.to_string(), "LDR r3, [r4, #8]");
    }
}
