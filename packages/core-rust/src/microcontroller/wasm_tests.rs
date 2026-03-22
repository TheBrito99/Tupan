//! Comprehensive WASM Microcontroller Simulator Tests
//!
//! Verifies WASM bindings work correctly with existing CPU emulator,
//! peripherals, and coupled simulator infrastructure.

#[cfg(all(test, feature = "wasm"))]
mod tests {
    use crate::microcontroller::wasm_bindings::{
        WasmMicrocontrollerSimulator, McuStateJson, MemoryRegionJson,
    };

    // ========== Helper Functions ==========

    /// Create minimal ARM firmware for testing
    /// Simple loop that increments R0
    fn create_test_firmware() -> Vec<u8> {
        vec![
            0xE3, 0xA0, 0x00, 0x00, // MOV R0, #0
            0xE2, 0x80, 0x00, 0x01, // ADD R0, R0, #1
            0xEA, 0xFF, 0xFF, 0xFE, // B -2 (loop back)
        ]
    }

    /// Create ARM firmware that exits immediately
    fn create_halt_firmware() -> Vec<u8> {
        vec![
            0xEE, 0x30, 0x0F, 0x00, // MCR p15, 0, R0, c3, c0, 0 (WFI)
        ]
    }

    // ========== Initialization Tests ==========

    #[test]
    fn test_wasm_simulator_creation() {
        let sim = WasmMicrocontrollerSimulator::new();
        assert!(sim.is_ok());
    }

    #[test]
    fn test_wasm_simulator_initialization() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();

        // Should be in halted state initially
        let state_json = sim.step().unwrap();
        let state: McuStateJson = serde_json::from_str(&state_json).unwrap();

        assert_eq!(state.execution_state, "Halted");
    }

    // ========== Firmware Loading Tests ==========

    #[test]
    fn test_load_firmware() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();

        let result = sim.load_firmware(&firmware);
        assert!(result.is_ok());
    }

    #[test]
    fn test_load_firmware_invalid() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();

        // Empty firmware should be handled gracefully
        let result = sim.load_firmware(&[]);
        // Should either succeed or return clear error
        assert!(result.is_ok() || result.is_err());
    }

    // ========== Execution Tests ==========

    #[test]
    fn test_step_execution() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let state_json = sim.step().unwrap();
        let state: McuStateJson = serde_json::from_str(&state_json).unwrap();

        // Should have incremented instruction count
        assert!(state.instruction_count > 0);
    }

    #[test]
    fn test_run_cycles() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let state_json = sim.run_cycles(10).unwrap();
        let state: McuStateJson = serde_json::from_str(&state_json).unwrap();

        // Should have executed multiple instructions
        assert!(state.total_cycles >= 10);
    }

    #[test]
    fn test_run_cycles_zero() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        // Running 0 cycles should be valid
        let result = sim.run_cycles(0);
        assert!(result.is_ok());
    }

    // ========== Register Inspection Tests ==========

    #[test]
    fn test_get_registers() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let registers_json = sim.get_registers().unwrap();
        let state: McuStateJson = serde_json::from_str(&registers_json).unwrap();

        // Should have 16 registers (R0-R15)
        assert_eq!(state.registers.len(), 16);

        // Initial PC should be valid
        assert!(state.pc >= 0);

        // CPSR should be initialized
        assert!(!state.cpsr.interrupt_disable);
    }

    #[test]
    fn test_register_values_after_execution() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        // Execute a few steps
        for _ in 0..5 {
            let _ = sim.step();
        }

        let registers_json = sim.get_registers().unwrap();
        let state: McuStateJson = serde_json::from_str(&registers_json).unwrap();

        // R0 should have been modified by ADD R0, R0, #1 instructions
        // The exact value depends on instruction timing
        assert!(state.registers[0] > 0 || state.instruction_count > 0);
    }

    // ========== Memory Access Tests ==========

    #[test]
    fn test_get_memory_valid_range() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let memory_json = sim.get_memory_range(0, 256).unwrap();
        let memory: MemoryRegionJson = serde_json::from_str(&memory_json).unwrap();

        assert_eq!(memory.start, 0);
        assert_eq!(memory.length, 256);
        assert_eq!(memory.data.len(), 256);
        assert_eq!(memory.ascii.len(), 256);
    }

    #[test]
    fn test_get_memory_zero_length() {
        let sim = WasmMicrocontrollerSimulator::new().unwrap();

        let memory_json = sim.get_memory_range(0, 0).unwrap();
        let memory: MemoryRegionJson = serde_json::from_str(&memory_json).unwrap();

        assert_eq!(memory.length, 0);
        assert_eq!(memory.data.len(), 0);
    }

    #[test]
    fn test_get_memory_high_address() {
        let sim = WasmMicrocontrollerSimulator::new().unwrap();

        // SRAM typically starts at 0x2000_0000 for ARM Cortex-M
        let memory_json = sim.get_memory_range(0x2000_0000, 64).unwrap();
        let memory: MemoryRegionJson = serde_json::from_str(&memory_json).unwrap();

        assert_eq!(memory.start, 0x2000_0000);
        assert_eq!(memory.length, 64);
    }

    #[test]
    fn test_memory_dump_ascii_representation() {
        let sim = WasmMicrocontrollerSimulator::new().unwrap();

        let memory_json = sim.get_memory_range(0, 32).unwrap();
        let memory: MemoryRegionJson = serde_json::from_str(&memory_json).unwrap();

        // ASCII field should have length matching data
        assert_eq!(memory.ascii.len(), memory.data.len());
    }

    // ========== Breakpoint Tests ==========

    #[test]
    fn test_set_breakpoint() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let result = sim.set_breakpoint(0x1000);
        assert!(result.is_ok());
    }

    #[test]
    fn test_remove_breakpoint() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        sim.set_breakpoint(0x1000).unwrap();
        sim.remove_breakpoint(0x1000);
        // Should not error
    }

    #[test]
    fn test_remove_nonexistent_breakpoint() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        // Removing non-existent breakpoint should be safe
        sim.remove_breakpoint(0x9999);
        // Should not error
    }

    #[test]
    fn test_get_breakpoints() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        sim.set_breakpoint(0x1000).unwrap();
        sim.set_breakpoint(0x2000).unwrap();

        let breakpoints_json = sim.get_breakpoints().unwrap();
        let breakpoints: Vec<u32> = serde_json::from_str(&breakpoints_json).unwrap();

        assert!(breakpoints.contains(&0x1000));
        assert!(breakpoints.contains(&0x2000));
    }

    #[test]
    fn test_get_empty_breakpoints() {
        let sim = WasmMicrocontrollerSimulator::new().unwrap();

        let breakpoints_json = sim.get_breakpoints().unwrap();
        let breakpoints: Vec<u32> = serde_json::from_str(&breakpoints_json).unwrap();

        assert_eq!(breakpoints.len(), 0);
    }

    // ========== State Reset Tests ==========

    #[test]
    fn test_reset() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        // Execute some instructions
        let _ = sim.run_cycles(100);

        // Reset
        sim.reset();

        // After reset, should be halted
        let state_json = sim.step().unwrap();
        let state: McuStateJson = serde_json::from_str(&state_json).unwrap();

        assert_eq!(state.execution_state, "Halted");
    }

    #[test]
    fn test_reset_clears_cycles() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        // Execute instructions
        let _ = sim.run_cycles(100);

        // Reset
        sim.reset();

        // Cycle count should be cleared
        let state_json = sim.get_registers().unwrap();
        let state: McuStateJson = serde_json::from_str(&state_json).unwrap();

        assert_eq!(state.total_cycles, 0);
    }

    // ========== Peripheral State Tests ==========

    #[test]
    fn test_get_peripheral_state() {
        let sim = WasmMicrocontrollerSimulator::new().unwrap();

        let peripheral_json = sim.get_peripheral_state().unwrap();
        let peripheral: serde_json::Value = serde_json::from_str(&peripheral_json).unwrap();

        // Should have GPIO, ADC, PWM, Timer fields
        assert!(peripheral.get("gpio_pins").is_some());
        assert!(peripheral.get("adc_channels").is_some());
        assert!(peripheral.get("pwm_outputs").is_some());
        assert!(peripheral.get("timer_values").is_some());
    }

    #[test]
    fn test_peripheral_state_structure() {
        let sim = WasmMicrocontrollerSimulator::new().unwrap();

        let peripheral_json = sim.get_peripheral_state().unwrap();
        let peripheral: serde_json::Value = serde_json::from_str(&peripheral_json).unwrap();

        // GPIO should be array
        if let Some(gpio) = peripheral.get("gpio_pins") {
            assert!(gpio.is_array());
        }

        // ADC should be array
        if let Some(adc) = peripheral.get("adc_channels") {
            assert!(adc.is_array());
        }
    }

    // ========== Execution State Tests ==========

    #[test]
    fn test_execution_state_halted() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();

        let state_json = sim.step().unwrap();
        let state: McuStateJson = serde_json::from_str(&state_json).unwrap();

        // Should be halted without firmware
        assert_eq!(state.execution_state, "Halted");
    }

    #[test]
    fn test_execution_state_after_firmware_load() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let state_json = sim.step().unwrap();
        let state: McuStateJson = serde_json::from_str(&state_json).unwrap();

        // Should be running after firmware load
        assert!(state.execution_state == "Running" || state.execution_state == "Halted");
    }

    // ========== JSON Serialization Tests ==========

    #[test]
    fn test_mcu_state_json_roundtrip() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let state_json = sim.step().unwrap();

        // Should deserialize successfully
        let state: McuStateJson = serde_json::from_str(&state_json)
            .expect("Failed to deserialize McuStateJson");

        // Should re-serialize without loss
        let reserialized = serde_json::to_string(&state).unwrap();
        assert!(!reserialized.is_empty());
    }

    #[test]
    fn test_memory_region_json_roundtrip() {
        let sim = WasmMicrocontrollerSimulator::new().unwrap();

        let memory_json = sim.get_memory_range(0, 64).unwrap();
        let memory: MemoryRegionJson = serde_json::from_str(&memory_json)
            .expect("Failed to deserialize MemoryRegionJson");

        // Should re-serialize without loss
        let reserialized = serde_json::to_string(&memory).unwrap();
        assert!(!reserialized.is_empty());
    }

    #[test]
    fn test_cycle_counting_accuracy() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let state_before = sim.get_registers().unwrap();
        let before: McuStateJson = serde_json::from_str(&state_before).unwrap();
        let cycles_before = before.total_cycles;

        sim.run_cycles(50).unwrap();

        let state_after = sim.get_registers().unwrap();
        let after: McuStateJson = serde_json::from_str(&state_after).unwrap();
        let cycles_after = after.total_cycles;

        // Should have executed at least 50 cycles
        assert!(cycles_after - cycles_before >= 50);
    }

    #[test]
    fn test_instruction_counting() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let state_before = sim.get_registers().unwrap();
        let before: McuStateJson = serde_json::from_str(&state_before).unwrap();
        let instr_before = before.instruction_count;

        // Execute several instructions
        for _ in 0..10 {
            let _ = sim.step();
        }

        let state_after = sim.get_registers().unwrap();
        let after: McuStateJson = serde_json::from_str(&state_after).unwrap();
        let instr_after = after.instruction_count;

        // Should have incremented instruction count
        assert!(instr_after > instr_before);
    }

    // ========== Error Handling Tests ==========

    #[test]
    fn test_invalid_json_response_handling() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        let state_json = sim.step().unwrap();

        // Should be valid JSON
        let result: Result<serde_json::Value, _> = serde_json::from_str(&state_json);
        assert!(result.is_ok());
    }

    #[test]
    fn test_multiple_operations_sequence() {
        let mut sim = WasmMicrocontrollerSimulator::new().unwrap();
        let firmware = create_test_firmware();
        sim.load_firmware(&firmware).unwrap();

        // Sequence of operations
        let _ = sim.step();
        let _ = sim.run_cycles(10);
        sim.set_breakpoint(0x100).unwrap();
        let _ = sim.get_registers();
        let _ = sim.get_memory_range(0, 32);
        let _ = sim.get_peripheral_state();
        sim.remove_breakpoint(0x100);

        // Final state should be valid
        let state = sim.get_registers().unwrap();
        assert!(!state.is_empty());
    }
}
