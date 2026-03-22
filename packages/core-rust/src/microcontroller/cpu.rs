//! ARM CPU Emulator
//!
//! Complete fetch-decode-execute cycle for ARM Cortex-M
//! Implements Thumb-2 instruction execution with proper cycle counting

use crate::microcontroller::{
    Instruction, ArmThumb2, InstructionSet, CpuState, CpuRegisters, CpuMemory,
    ExecutionState, RegisterId,
};
use serde::{Deserialize, Serialize};

/// ARM CPU Emulator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArmCpuEmulator {
    state: CpuState,
    inst_set: String,  // Name of instruction set ("ARM Thumb-2", etc.)
}

impl ArmCpuEmulator {
    /// Create new ARM CPU emulator
    pub fn new() -> Self {
        ArmCpuEmulator {
            state: CpuState::new(),
            inst_set: "ARM Thumb-2".to_string(),
        }
    }

    /// Load firmware binary
    pub fn load_firmware(&mut self, firmware: &[u8]) -> Result<(), String> {
        self.state.load_firmware(firmware)
    }

    /// Execute one instruction (fetch-decode-execute)
    pub fn step(&mut self) -> Result<(), String> {
        // Check if halted or in fault state
        match self.state.exec_state {
            ExecutionState::Running | ExecutionState::SingleStep => {
                // Continue execution
            }
            ExecutionState::Halted | ExecutionState::Fault | ExecutionState::WFI => {
                return Err(format!("CPU in {:?} state", self.state.exec_state));
            }
            ExecutionState::Breakpoint => {
                return Err("At breakpoint".to_string());
            }
        }

        // Fetch instruction at PC
        let pc = self.state.registers.pc();
        self.state.last_pc = pc;

        // Read instruction word (could be 16-bit or 32-bit)
        let instr_word = self.state.memory.read_u32(pc)?;

        // Decode instruction
        let inst_set = ArmThumb2;
        let instruction = inst_set.decode(instr_word);

        self.state.current_instruction = Some(instruction.clone());

        // Execute instruction
        self.execute_instruction(&instruction)?;

        // Advance cycle counter
        let cycles = instruction.cycle_count();
        self.state.advance_cycles(cycles as u64);

        // Increment instruction counter
        self.state.increment_instruction_count();

        // Check for breakpoints after execution
        if self.state.at_breakpoint() {
            self.state.set_state(ExecutionState::Breakpoint);
            return Err("Hit breakpoint".to_string());
        }

        Ok(())
    }

    /// Execute the current instruction
    pub fn execute_instruction(&mut self, inst: &Instruction) -> Result<(), String> {
        match inst {
            // Data processing
            Instruction::MovRegister { dest, src } => {
                let value = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());
                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    value,
                );
            }

            Instruction::Add { dest, src1, src2 } => {
                let val1 = self.state.registers.get(RegisterId::from_index(*src1 as usize).unwrap());
                let val2 = self.state.registers.get(RegisterId::from_index(*src2 as usize).unwrap());
                let result = val1.wrapping_add(val2);

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::AddImmediate { dest, src, imm } => {
                let val = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());
                let result = val.wrapping_add(*imm);

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::Sub { dest, src1, src2 } => {
                let val1 = self.state.registers.get(RegisterId::from_index(*src1 as usize).unwrap());
                let val2 = self.state.registers.get(RegisterId::from_index(*src2 as usize).unwrap());
                let result = val1.wrapping_sub(val2);

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::SubImmediate { dest, src, imm } => {
                let val = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());
                let result = val.wrapping_sub(*imm);

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::And { dest, src1, src2 } => {
                let val1 = self.state.registers.get(RegisterId::from_index(*src1 as usize).unwrap());
                let val2 = self.state.registers.get(RegisterId::from_index(*src2 as usize).unwrap());
                let result = val1 & val2;

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::Orr { dest, src1, src2 } => {
                let val1 = self.state.registers.get(RegisterId::from_index(*src1 as usize).unwrap());
                let val2 = self.state.registers.get(RegisterId::from_index(*src2 as usize).unwrap());
                let result = val1 | val2;

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::Eor { dest, src1, src2 } => {
                let val1 = self.state.registers.get(RegisterId::from_index(*src1 as usize).unwrap());
                let val2 = self.state.registers.get(RegisterId::from_index(*src2 as usize).unwrap());
                let result = val1 ^ val2;

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::Cmp { src1, src2 } => {
                let val1 = self.state.registers.get(RegisterId::from_index(*src1 as usize).unwrap());
                let val2 = self.state.registers.get(RegisterId::from_index(*src2 as usize).unwrap());
                let result = val1.wrapping_sub(val2);

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            Instruction::CmpImmediate { src, imm } => {
                let val = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());
                let result = val.wrapping_sub(*imm);

                self.state.registers.cpsr_mut().update_from_result(result);
            }

            // Shift operations (simplified)
            Instruction::Lsl { dest, src, shift } => {
                let val = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());
                let result = val << shift;
                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );
            }

            Instruction::Lsr { dest, src, shift } => {
                let val = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());
                let result = val >> shift;
                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    result,
                );
            }

            // Memory operations
            Instruction::Ldr { dest, addr_reg, offset } => {
                let addr = self.state.registers.get(RegisterId::from_index(*addr_reg as usize).unwrap());
                let value = self.state.memory.read_u32(addr + offset)?;

                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    value,
                );
            }

            Instruction::Str { src, addr_reg, offset } => {
                let addr = self.state.registers.get(RegisterId::from_index(*addr_reg as usize).unwrap());
                let value = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());

                self.state.memory.write_u32(addr + offset, value)?;
            }

            Instruction::LdrImmediate { dest, imm } => {
                self.state.registers.set(
                    RegisterId::from_index(*dest as usize).unwrap(),
                    *imm,
                );
            }

            // Branches
            Instruction::B { target } => {
                self.state.registers.set_pc(*target);
                return Ok(());
            }

            Instruction::Beq { target } => {
                if self.state.registers.cpsr().zero {
                    self.state.registers.set_pc(*target);
                    return Ok(());
                }
            }

            Instruction::Bne { target } => {
                if !self.state.registers.cpsr().zero {
                    self.state.registers.set_pc(*target);
                    return Ok(());
                }
            }

            Instruction::Bl { target } => {
                // Save return address in LR (PC + 2 for next instruction)
                let pc = self.state.registers.pc();
                self.state.registers.set_lr(pc + 2);
                self.state.registers.set_pc(*target);
                return Ok(());
            }

            Instruction::Bx { src } => {
                let addr = self.state.registers.get(RegisterId::from_index(*src as usize).unwrap());
                self.state.registers.set_pc(addr);
                return Ok(());
            }

            // Special
            Instruction::Nop => {
                // Do nothing
            }

            Instruction::Push { regs: _ } | Instruction::Pop { regs: _ } => {
                // Stack operations handled differently (requires memory access)
                // Simplified for now
            }

            _ => {
                return Err(format!("Unimplemented instruction: {:?}", inst));
            }
        }

        // Default: advance PC by 2 (16-bit instruction) or 4 (32-bit)
        // For now, assume 2 bytes per instruction
        self.state.registers.advance_pc(2);

        Ok(())
    }

    /// Execute multiple instructions
    pub fn run(&mut self, max_instructions: u32) -> Result<u32, String> {
        let mut count = 0;

        for _ in 0..max_instructions {
            match self.step() {
                Ok(_) => {
                    count += 1;
                }
                Err(e) => {
                    if e.contains("At breakpoint") || e.contains("CPU in") {
                        return Ok(count);
                    } else {
                        return Err(e);
                    }
                }
            }
        }

        Ok(count)
    }

    /// Get current CPU state
    pub fn state(&self) -> &CpuState {
        &self.state
    }

    /// Get mutable CPU state
    pub fn state_mut(&mut self) -> &mut CpuState {
        &mut self.state
    }

    /// Reset CPU to initial state
    pub fn reset(&mut self) {
        self.state.registers = CpuRegisters::new();
        self.state.total_cycles = 0;
        self.state.instruction_count = 0;
        self.state.set_state(ExecutionState::Running);
    }
}

impl Default for ArmCpuEmulator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_creation() {
        let cpu = ArmCpuEmulator::new();
        assert_eq!(cpu.state().exec_state, ExecutionState::Running);
        assert_eq!(cpu.state().registers.pc(), 0);
    }

    #[test]
    fn test_mov_instruction() {
        let mut cpu = ArmCpuEmulator::new();

        // Set R1 to 42
        cpu.state_mut().registers.set(RegisterId::R1, 42);

        // MOV R0, R1
        cpu.state_mut().current_instruction = Some(Instruction::MovRegister { dest: 0, src: 1 });
        cpu.execute_instruction(&Instruction::MovRegister { dest: 0, src: 1 }).unwrap();

        assert_eq!(cpu.state().registers.get(RegisterId::R0), 42);
    }

    #[test]
    fn test_add_instruction() {
        let mut cpu = ArmCpuEmulator::new();

        // Set up: R1 = 10, R2 = 20
        cpu.state_mut().registers.set(RegisterId::R1, 10);
        cpu.state_mut().registers.set(RegisterId::R2, 20);

        // ADD R0, R1, R2
        cpu.execute_instruction(&Instruction::Add { dest: 0, src1: 1, src2: 2 }).unwrap();

        assert_eq!(cpu.state().registers.get(RegisterId::R0), 30);
    }

    #[test]
    fn test_firmware_execution() {
        let mut cpu = ArmCpuEmulator::new();

        // Load simple firmware (NOP instructions)
        let firmware = vec![0x00, 0xBF, 0x00, 0xBF];  // NOP, NOP
        cpu.load_firmware(&firmware).unwrap();

        // Execute 1 instruction
        let result = cpu.run(1);
        assert!(result.is_ok());
        assert!(result.unwrap() > 0);
    }

    #[test]
    fn test_reset() {
        let mut cpu = ArmCpuEmulator::new();

        // Execute some instructions
        cpu.state_mut().advance_cycles(100);
        cpu.state_mut().increment_instruction_count();
        cpu.state_mut().registers.set(RegisterId::R0, 42);

        // Reset
        cpu.reset();

        assert_eq!(cpu.state().total_cycles, 0);
        assert_eq!(cpu.state().instruction_count, 0);
        assert_eq!(cpu.state().registers.get(RegisterId::R0), 0);
        assert_eq!(cpu.state().registers.pc(), 0);
    }

    #[test]
    fn test_branching() {
        let mut cpu = ArmCpuEmulator::new();

        // Branch to address 0x100
        cpu.execute_instruction(&Instruction::B { target: 0x100 }).unwrap();

        assert_eq!(cpu.state().registers.pc(), 0x100);
    }

    #[test]
    fn test_conditional_branch_taken() {
        let mut cpu = ArmCpuEmulator::new();

        // Set zero flag
        cpu.state_mut().registers.cpsr_mut().zero = true;

        // BEQ should branch
        cpu.execute_instruction(&Instruction::Beq { target: 0x200 }).unwrap();

        assert_eq!(cpu.state().registers.pc(), 0x200);
    }

    #[test]
    fn test_conditional_branch_not_taken() {
        let mut cpu = ArmCpuEmulator::new();

        // Clear zero flag
        cpu.state_mut().registers.cpsr_mut().zero = false;

        // BEQ should not branch
        cpu.execute_instruction(&Instruction::Beq { target: 0x200 }).ok();

        // PC should have advanced normally (by 2) and not be at 0x200
        assert_ne!(cpu.state().registers.pc(), 0x200);
    }
}
