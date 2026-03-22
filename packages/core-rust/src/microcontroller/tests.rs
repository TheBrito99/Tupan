//! Integration tests for microcontroller module
//!
//! Tests complete microcontroller workflows and instruction sequences

#[cfg(test)]
mod integration_tests {
    use crate::microcontroller::{ArmCpuEmulator, Instruction, RegisterId, ExecutionState};

    #[test]
    fn test_simple_counter_loop() {
        // Simulate: R0 = 0; loop: R0++; if R0 < 10 goto loop;
        let mut cpu = ArmCpuEmulator::new();

        // Initialize R0 to 0
        cpu.state_mut().registers.set(RegisterId::R0, 0);

        // Simulate 10 iterations of incrementing R0
        for _ in 0..10 {
            let current = cpu.state().registers.get(RegisterId::R0);
            cpu.state_mut().registers.set(RegisterId::R0, current + 1);
        }

        assert_eq!(cpu.state().registers.get(RegisterId::R0), 10);
    }

    #[test]
    fn test_arithmetic_sequence() {
        let mut cpu = ArmCpuEmulator::new();

        // R1 = 5
        cpu.state_mut().registers.set(RegisterId::R1, 5);

        // R2 = 3
        cpu.state_mut().registers.set(RegisterId::R2, 3);

        // ADD R0, R1, R2 => R0 = 8
        cpu.execute_instruction(&Instruction::Add { dest: 0, src1: 1, src2: 2 }).unwrap();
        assert_eq!(cpu.state().registers.get(RegisterId::R0), 8);

        // SUB R3, R0, R2 => R3 = 8 - 3 = 5
        cpu.execute_instruction(&Instruction::Sub { dest: 3, src1: 0, src2: 2 }).unwrap();
        assert_eq!(cpu.state().registers.get(RegisterId::R3), 5);
    }

    #[test]
    fn test_bitwise_operations() {
        let mut cpu = ArmCpuEmulator::new();

        // R1 = 0xF0
        cpu.state_mut().registers.set(RegisterId::R1, 0xF0);

        // R2 = 0x0F
        cpu.state_mut().registers.set(RegisterId::R2, 0x0F);

        // AND R0, R1, R2 => R0 = 0x00
        cpu.execute_instruction(&Instruction::And { dest: 0, src1: 1, src2: 2 }).unwrap();
        assert_eq!(cpu.state().registers.get(RegisterId::R0), 0x00);

        // ORR R3, R1, R2 => R3 = 0xFF
        cpu.execute_instruction(&Instruction::Orr { dest: 3, src1: 1, src2: 2 }).unwrap();
        assert_eq!(cpu.state().registers.get(RegisterId::R3), 0xFF);

        // EOR R4, R1, R2 => R4 = 0xFF
        cpu.execute_instruction(&Instruction::Eor { dest: 4, src1: 1, src2: 2 }).unwrap();
        assert_eq!(cpu.state().registers.get(RegisterId::R4), 0xFF);
    }

    #[test]
    fn test_memory_operations() {
        let mut cpu = ArmCpuEmulator::new();

        // Initialize SRAM address in R1
        cpu.state_mut().registers.set(RegisterId::R1, 0x2000_0000);

        // Set data to store
        cpu.state_mut().registers.set(RegisterId::R0, 0xDEAD_BEEF);

        // STR R0, [R1, #0]
        cpu.execute_instruction(&Instruction::Str { src: 0, addr_reg: 1, offset: 0 }).unwrap();

        // Verify data in memory
        let value = cpu.state().memory.read_u32(0x2000_0000).unwrap();
        assert_eq!(value, 0xDEAD_BEEF);

        // Clear R0
        cpu.state_mut().registers.set(RegisterId::R0, 0);

        // LDR R0, [R1, #0]
        cpu.execute_instruction(&Instruction::Ldr { dest: 0, addr_reg: 1, offset: 0 }).unwrap();

        // Verify data read
        assert_eq!(cpu.state().registers.get(RegisterId::R0), 0xDEAD_BEEF);
    }

    #[test]
    fn test_branch_instructions() {
        let mut cpu = ArmCpuEmulator::new();

        // Unconditional branch
        cpu.execute_instruction(&Instruction::B { target: 0x1000 }).unwrap();
        assert_eq!(cpu.state().registers.pc(), 0x1000);

        // Branch with link (function call)
        let old_pc = cpu.state().registers.pc();
        cpu.execute_instruction(&Instruction::Bl { target: 0x2000 }).unwrap();
        assert_eq!(cpu.state().registers.lr(), old_pc + 2);  // +2 for instruction size
        assert_eq!(cpu.state().registers.pc(), 0x2000);

        // Return from function (BX LR)
        cpu.execute_instruction(&Instruction::Bx { src: 14 }).unwrap();  // 14 = LR
        assert_eq!(cpu.state().registers.pc(), old_pc + 2);
    }

    #[test]
    fn test_condition_flags() {
        let mut cpu = ArmCpuEmulator::new();

        // Add 5 + 5 = 10
        cpu.state_mut().registers.set(RegisterId::R1, 5);
        cpu.state_mut().registers.set(RegisterId::R2, 5);

        cpu.execute_instruction(&Instruction::Add { dest: 0, src1: 1, src2: 2 }).unwrap();

        // Zero flag should be false (10 != 0)
        assert!(!cpu.state().registers.cpsr().zero);

        // Add 10 + (-10) = 0
        cpu.state_mut().registers.set(RegisterId::R1, 10);
        cpu.state_mut().registers.set(RegisterId::R2, (0u32).wrapping_sub(10));

        cpu.execute_instruction(&Instruction::Add { dest: 0, src1: 1, src2: 2 }).unwrap();

        // Zero flag should be true (0 == 0)
        assert!(cpu.state().registers.cpsr().zero);
    }

    #[test]
    fn test_stack_operations() {
        let mut cpu = ArmCpuEmulator::new();

        // Initialize stack pointer
        let stack_top = 0x2000_FFFF;
        cpu.state_mut().registers.set_sp(stack_top);

        // Push some data
        cpu.state_mut().registers.set(RegisterId::R0, 0x1234_5678);

        // Simulate push (manually for now since PUSH opcode is complex)
        let sp = cpu.state().registers.sp();
        cpu.state_mut().memory.write_u32(sp - 4, 0x1234_5678).unwrap();
        cpu.state_mut().registers.set_sp(sp - 4);

        // SP should have decremented
        assert_eq!(cpu.state().registers.sp(), stack_top - 4);

        // Verify data on stack
        let value = cpu.state().memory.read_u32(stack_top - 4).unwrap();
        assert_eq!(value, 0x1234_5678);
    }

    #[test]
    fn test_performance_metrics() {
        let mut cpu = ArmCpuEmulator::new();

        // Execute 100 instructions
        for _ in 0..100 {
            cpu.state_mut().advance_cycles(1);
            cpu.state_mut().increment_instruction_count();
        }

        let metrics = cpu.state().metrics();
        assert_eq!(metrics.instruction_count, 100);
        assert_eq!(metrics.total_cycles, 100);
        assert!((metrics.cpi - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_breakpoint_hit() {
        let mut cpu = ArmCpuEmulator::new();

        // Add breakpoint at 0x100
        cpu.state_mut().add_breakpoint(0x100);

        // Check not at breakpoint initially
        assert!(!cpu.state().at_breakpoint());

        // Move to breakpoint address
        cpu.state_mut().registers.set_pc(0x100);

        // Check at breakpoint
        assert!(cpu.state().at_breakpoint());
    }

    #[test]
    fn test_firmware_load_and_execute() {
        let mut cpu = ArmCpuEmulator::new();

        // Simple firmware: 4 NOP instructions
        let firmware = vec![
            0x00, 0xBF,  // NOP
            0x00, 0xBF,  // NOP
            0x00, 0xBF,  // NOP
            0x00, 0xBF,  // NOP
        ];

        cpu.load_firmware(&firmware).unwrap();

        // PC should be at 0
        assert_eq!(cpu.state().registers.pc(), 0);

        // Memory should contain firmware
        let byte0 = cpu.state().memory.read_u8(0).unwrap();
        assert_eq!(byte0, 0x00);
    }

    #[test]
    fn test_state_tracking() {
        let mut cpu = ArmCpuEmulator::new();

        assert_eq!(cpu.state().exec_state, ExecutionState::Running);

        // Halt CPU
        cpu.state_mut().set_state(ExecutionState::Halted);
        assert_eq!(cpu.state().exec_state, ExecutionState::Halted);

        // Attempt step should fail
        let result = cpu.step();
        assert!(result.is_err());
    }

    #[test]
    fn test_register_transfer() {
        let mut cpu = ArmCpuEmulator::new();

        // Initialize all registers with unique values
        for i in 0..16 {
            cpu.state_mut().registers.set(
                RegisterId::from_index(i).unwrap(),
                (i as u32) * 0x1000,
            );
        }

        // Copy R0 -> R1
        cpu.execute_instruction(&Instruction::MovRegister { dest: 1, src: 0 }).unwrap();
        assert_eq!(cpu.state().registers.get(RegisterId::R0), cpu.state().registers.get(RegisterId::R1));

        // Copy R15 -> R2
        let r15_before = cpu.state().registers.get(RegisterId::R15);
        cpu.execute_instruction(&Instruction::MovRegister { dest: 2, src: 15 }).unwrap();
        let r2_value = cpu.state().registers.get(RegisterId::R2);
        // R2 should contain the value of R15 BEFORE the instruction (PC was advanced after execution)
        assert_eq!(r15_before, r2_value);
    }

    #[test]
    fn test_multiple_memory_accesses() {
        let mut cpu = ArmCpuEmulator::new();

        // Write sequence of values to SRAM
        let base_addr = 0x2000_0000;
        for i in 0..10 {
            let addr = base_addr + (i * 4) as u32;
            cpu.state_mut().memory.write_u32(addr, (i as u32) * 100).unwrap();
        }

        // Verify sequence
        for i in 0..10 {
            let addr = base_addr + (i * 4) as u32;
            let value = cpu.state().memory.read_u32(addr).unwrap();
            assert_eq!(value, (i as u32) * 100);
        }
    }
}
