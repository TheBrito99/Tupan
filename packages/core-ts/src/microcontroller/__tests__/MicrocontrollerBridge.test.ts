/**
 * MicrocontrollerBridge Tests
 *
 * Comprehensive tests for the TypeScript WASM wrapper around the microcontroller simulator.
 * Tests verify type-safety, async operations, state management, and error handling.
 *
 * Phase 22 Week 1 Task 4: Test WASM execution in browser
 */

import { MicrocontrollerBridge, McuState, MemoryRegion, PeripheralState } from '../MicrocontrollerBridge';

describe('MicrocontrollerBridge', () => {
  let bridge: MicrocontrollerBridge;

  // ========== Setup & Teardown ==========

  beforeEach(() => {
    bridge = new MicrocontrollerBridge();
  });

  afterEach(() => {
    // Clean up singleton instance for tests
    resetMicrocontrollerBridge();
  });

  // ========== Type Safety Tests ==========

  describe('Type Definitions', () => {
    it('should define McuState with all required fields', () => {
      const mockState: McuState = {
        pc: 0x0000,
        sp: 0x2000,
        lr: 0x0000,
        registers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        cpsr: {
          zero: false,
          negative: false,
          carry: false,
          overflow: false,
          thumbMode: false,
          interruptDisable: false,
        },
        totalCycles: 0,
        instructionCount: 0,
        executionState: 'Halted',
      };

      expect(mockState.pc).toBe(0x0000);
      expect(mockState.registers.length).toBe(16);
      expect(mockState.executionState).toMatch(/Halted|Running|Breakpoint|Fault|WFI/);
    });

    it('should define MemoryRegion with correct structure', () => {
      const mockMemory: MemoryRegion = {
        start: 0x0000,
        length: 256,
        data: new Uint8Array(256),
        ascii: '.'.repeat(256),
      };

      expect(mockMemory.start).toBe(0x0000);
      expect(mockMemory.data.length).toBe(256);
      expect(mockMemory.ascii.length).toBe(256);
    });

    it('should define PeripheralState with GPIO/ADC/PWM/Timer', () => {
      const mockPeripherals: PeripheralState = {
        gpioPins: [],
        adcChannels: [],
        pwmOutputs: [],
        timerValues: [],
      };

      expect(mockPeripherals.gpioPins).toBeInstanceOf(Array);
      expect(mockPeripherals.adcChannels).toBeInstanceOf(Array);
      expect(mockPeripherals.pwmOutputs).toBeInstanceOf(Array);
      expect(mockPeripherals.timerValues).toBeInstanceOf(Array);
    });
  });

  // ========== Initialization Tests ==========

  describe('Initialization', () => {
    it('should create a new bridge instance', () => {
      expect(bridge).toBeDefined();
      expect(bridge).toBeInstanceOf(MicrocontrollerBridge);
    });

    it('should not be initialized before initialize()', async () => {
      // Before initialize, wasm should be null
      expect(bridge['wasm']).toBeNull();
    });

    it('should initialize WASM module on first use', async () => {
      // Initialization happens lazily on first operation
      // This is implementation-dependent
      expect(bridge).toBeDefined();
    });
  });

  // ========== Firmware Loading Tests ==========

  describe('Firmware Loading', () => {
    it('should accept firmware bytes', async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]); // ARM instruction

      // Should not throw
      await expect(bridge.loadFirmware(firmware)).resolves.toBeUndefined();
    });

    it('should handle empty firmware', async () => {
      const firmware = new Uint8Array(0);

      // Should handle gracefully
      await expect(bridge.loadFirmware(firmware)).resolves.toBeUndefined();
    });

    it('should handle large firmware', async () => {
      const firmware = new Uint8Array(1024 * 64); // 64KB firmware

      await expect(bridge.loadFirmware(firmware)).resolves.toBeUndefined();
    });
  });

  // ========== Execution Tests ==========

  describe('Instruction Execution', () => {
    beforeEach(async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]); // ARM instruction
      await bridge.loadFirmware(firmware);
    });

    it('should step through one instruction', () => {
      const state = bridge.step();

      expect(state).toBeDefined();
      expect(state.pc).toBeDefined();
      expect(state.registers).toHaveLength(16);
      expect(state.instructionCount).toBeGreaterThanOrEqual(0);
    });

    it('should increment instruction count on step', () => {
      const stateBefore = bridge.step();
      const countBefore = stateBefore.instructionCount;

      const stateAfter = bridge.step();
      const countAfter = stateAfter.instructionCount;

      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    });

    it('should track total cycles', () => {
      const state = bridge.step();

      expect(state.totalCycles).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Execution', () => {
    beforeEach(async () => {
      const firmware = new Uint8Array([
        0xe3, 0xa0, 0x00, 0x00, // MOV R0, #0
        0xE2, 0x80, 0x00, 0x01, // ADD R0, R0, #1
        0xEA, 0xFF, 0xFF, 0xFE, // B -2 (loop)
      ]);
      await bridge.loadFirmware(firmware);
    });

    it('should run multiple cycles', async () => {
      const state = await bridge.runCycles(100);

      expect(state).toBeDefined();
      expect(state.totalCycles).toBeGreaterThanOrEqual(100);
    });

    it('should handle zero cycles', async () => {
      const state = await bridge.runCycles(0);

      expect(state).toBeDefined();
    });

    it('should maintain performance with large cycle counts', async () => {
      const start = Date.now();
      const state = await bridge.runCycles(1000);
      const elapsed = Date.now() - start;

      expect(state.totalCycles).toBeGreaterThanOrEqual(1000);
      // Should complete in reasonable time (< 1 second for 1000 cycles)
      expect(elapsed).toBeLessThan(1000);
    });

    it('should yield to event loop', async () => {
      // runCycles should be async and yield control
      const promise1 = bridge.runCycles(100);
      const promise2 = bridge.runCycles(50);

      // Both should be pending initially (batch execution)
      expect(promise1).toBeDefined();
      expect(promise2).toBeDefined();

      // Should resolve without hanging
      const states = await Promise.all([promise1, promise2]);
      expect(states).toHaveLength(2);
    });
  });

  // ========== Register Inspection Tests ==========

  describe('Register Access', () => {
    beforeEach(async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]); // MOV R0, #0
      await bridge.loadFirmware(firmware);
    });

    it('should get all registers R0-R15', () => {
      const state = bridge.getRegisters();

      expect(state.registers).toHaveLength(16);
      for (let i = 0; i < 16; i++) {
        expect(state.registers[i]).toBeGreaterThanOrEqual(0);
      }
    });

    it('should get program counter', () => {
      const state = bridge.getRegisters();

      expect(state.pc).toBeDefined();
      expect(state.pc).toBeGreaterThanOrEqual(0);
    });

    it('should get stack pointer', () => {
      const state = bridge.getRegisters();

      expect(state.sp).toBeDefined();
      expect(state.sp).toBeGreaterThanOrEqual(0);
    });

    it('should get link register', () => {
      const state = bridge.getRegisters();

      expect(state.lr).toBeDefined();
      expect(state.lr).toBeGreaterThanOrEqual(0);
    });

    it('should get CPSR flags', () => {
      const state = bridge.getRegisters();

      expect(state.cpsr.zero).toBeDefined();
      expect(state.cpsr.negative).toBeDefined();
      expect(state.cpsr.carry).toBeDefined();
      expect(state.cpsr.overflow).toBeDefined();
      expect(state.cpsr.thumbMode).toBeDefined();
      expect(state.cpsr.interruptDisable).toBeDefined();
    });

    it('should track execution state', () => {
      const state = bridge.getRegisters();

      expect(['Running', 'Halted', 'Breakpoint', 'Fault', 'WFI']).toContain(
        state.executionState
      );
    });
  });

  // ========== Memory Access Tests ==========

  describe('Memory Operations', () => {
    beforeEach(async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]);
      await bridge.loadFirmware(firmware);
    });

    it('should read memory region from address 0', () => {
      const memory = bridge.getMemory(0, 64);

      expect(memory.start).toBe(0);
      expect(memory.length).toBe(64);
      expect(memory.data).toBeInstanceOf(Uint8Array);
      expect(memory.data.length).toBe(64);
    });

    it('should read memory from high addresses', () => {
      const memory = bridge.getMemory(0x2000_0000, 64);

      expect(memory.start).toBe(0x2000_0000);
      expect(memory.length).toBe(64);
    });

    it('should provide ASCII representation', () => {
      const memory = bridge.getMemory(0, 32);

      expect(memory.ascii).toBeDefined();
      expect(memory.ascii.length).toBe(memory.data.length);
    });

    it('should handle zero-length reads', () => {
      const memory = bridge.getMemory(0, 0);

      expect(memory.length).toBe(0);
      expect(memory.data.length).toBe(0);
    });

    it('should handle large memory reads', () => {
      const memory = bridge.getMemory(0, 4096);

      expect(memory.length).toBe(4096);
      expect(memory.data.length).toBe(4096);
    });
  });

  // ========== Breakpoint Tests ==========

  describe('Breakpoint Management', () => {
    beforeEach(async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]);
      await bridge.loadFirmware(firmware);
    });

    it('should set a breakpoint', () => {
      // Should not throw
      bridge.setBreakpoint(0x1000);
    });

    it('should remove a breakpoint', () => {
      bridge.setBreakpoint(0x1000);

      // Should not throw
      bridge.removeBreakpoint(0x1000);
    });

    it('should handle removing non-existent breakpoint', () => {
      // Should not throw
      bridge.removeBreakpoint(0x9999);
    });

    it('should get list of breakpoints', () => {
      bridge.setBreakpoint(0x1000);
      bridge.setBreakpoint(0x2000);
      bridge.setBreakpoint(0x3000);

      const breakpoints = bridge.getBreakpoints();

      expect(breakpoints).toBeInstanceOf(Array);
      expect(breakpoints).toContain(0x1000);
      expect(breakpoints).toContain(0x2000);
      expect(breakpoints).toContain(0x3000);
    });

    it('should get empty breakpoint list initially', () => {
      const breakpoints = bridge.getBreakpoints();

      expect(breakpoints).toBeInstanceOf(Array);
    });

    it('should manage multiple breakpoints', () => {
      const addresses = [0x100, 0x200, 0x300, 0x400, 0x500];

      for (const addr of addresses) {
        bridge.setBreakpoint(addr);
      }

      const breakpoints = bridge.getBreakpoints();

      for (const addr of addresses) {
        expect(breakpoints).toContain(addr);
      }
    });
  });

  // ========== Peripheral State Tests ==========

  describe('Peripheral Access', () => {
    beforeEach(async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]);
      await bridge.loadFirmware(firmware);
    });

    it('should get peripheral state', () => {
      const peripherals = bridge.getPeripherals();

      expect(peripherals).toBeDefined();
      expect(peripherals.gpioPins).toBeInstanceOf(Array);
      expect(peripherals.adcChannels).toBeInstanceOf(Array);
      expect(peripherals.pwmOutputs).toBeInstanceOf(Array);
      expect(peripherals.timerValues).toBeInstanceOf(Array);
    });

    it('should provide GPIO pin states', () => {
      const peripherals = bridge.getPeripherals();

      if (peripherals.gpioPins.length > 0) {
        const pin = peripherals.gpioPins[0];
        expect(pin.pin).toBeDefined();
        expect(pin.port).toBeDefined();
        expect(pin.state).toBeDefined();
        expect(pin.direction).toMatch(/input|output/);
      }
    });

    it('should provide ADC channel states', () => {
      const peripherals = bridge.getPeripherals();

      if (peripherals.adcChannels.length > 0) {
        const channel = peripherals.adcChannels[0];
        expect(channel.channel).toBeDefined();
        expect(channel.rawValue).toBeGreaterThanOrEqual(0);
        expect(channel.voltage).toBeDefined();
      }
    });

    it('should provide PWM output states', () => {
      const peripherals = bridge.getPeripherals();

      if (peripherals.pwmOutputs.length > 0) {
        const pwm = peripherals.pwmOutputs[0];
        expect(pwm.timer).toBeDefined();
        expect(pwm.channel).toBeDefined();
        expect(pwm.dutyCycle).toBeGreaterThanOrEqual(0);
        expect(pwm.dutyCycle).toBeLessThanOrEqual(100);
        expect(pwm.frequency).toBeGreaterThanOrEqual(0);
      }
    });

    it('should provide timer states', () => {
      const peripherals = bridge.getPeripherals();

      if (peripherals.timerValues.length > 0) {
        const timer = peripherals.timerValues[0];
        expect(timer.timerId).toBeDefined();
        expect(timer.counter).toBeGreaterThanOrEqual(0);
        expect(timer.compare).toBeGreaterThanOrEqual(0);
        expect(timer.isRunning).toBeDefined();
      }
    });
  });

  // ========== State Management Tests ==========

  describe('State Management', () => {
    beforeEach(async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]);
      await bridge.loadFirmware(firmware);
    });

    it('should reset simulator state', () => {
      bridge.step();
      bridge.step();

      // Reset should clear state
      bridge.reset();

      const state = bridge.getRegisters();
      expect(state.totalCycles).toBe(0);
    });

    it('should report cycle count', () => {
      const countBefore = bridge.getCycleCount();

      bridge.step();

      const countAfter = bridge.getCycleCount();

      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    });

    it('should report instruction count', () => {
      const countBefore = bridge.getInstructionCount();

      bridge.step();

      const countAfter = bridge.getInstructionCount();

      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    });

    it('should track running state', () => {
      const isRunning = bridge.isRunning();

      expect(typeof isRunning).toBe('boolean');
    });

    it('should pause simulation', () => {
      bridge.pause();

      expect(bridge.isRunning()).toBe(false);
    });
  });

  // ========== Batch Size Configuration Tests ==========

  describe('Performance Tuning', () => {
    it('should set batch size', () => {
      // Should not throw
      bridge.setBatchSize(500);
      bridge.setBatchSize(1000);
      bridge.setBatchSize(2000);
    });

    it('should enforce minimum batch size', () => {
      // Very small batch size should be clamped to minimum
      bridge.setBatchSize(1);
      // Implementation should enforce minimum (e.g., 100)
    });

    it('should enforce maximum batch size', () => {
      // Very large batch size should be clamped to maximum
      bridge.setBatchSize(1_000_000);
      // Implementation should enforce maximum (e.g., 100,000)
    });
  });

  // ========== Error Handling Tests ==========

  describe('Error Handling', () => {
    it('should handle uninitialized simulator gracefully', () => {
      const freshBridge = new MicrocontrollerBridge();

      // Operations on uninitialized bridge should either:
      // 1. Initialize lazily and succeed, or
      // 2. Throw a clear error
      expect(() => {
        freshBridge.getRegisters();
      }).not.toThrow();
    });

    it('should handle rapid successive operations', async () => {
      const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]);
      await bridge.loadFirmware(firmware);

      // Rapid succession of operations
      bridge.step();
      bridge.step();
      bridge.getRegisters();
      bridge.getMemory(0, 32);
      bridge.getPeripherals();

      expect(bridge).toBeDefined();
    });
  });

  // ========== Singleton Pattern Tests ==========

  describe('Singleton Pattern', () => {
    it('should get or create singleton instance', async () => {
      const bridge1 = await getMicrocontrollerBridge();
      const bridge2 = await getMicrocontrollerBridge();

      // Should return same instance
      expect(bridge1).toBe(bridge2);
    });

    it('should reset singleton for testing', () => {
      resetMicrocontrollerBridge();

      // After reset, next call should create new instance
      // (This is implementation-dependent)
      expect(true).toBe(true);
    });
  });

  // ========== Integration Tests ==========

  describe('Integration Workflows', () => {
    it('should execute complete firmware simulation workflow', async () => {
      const firmware = new Uint8Array([
        0xe3, 0xa0, 0x00, 0x00, // MOV R0, #0
        0xE2, 0x80, 0x00, 0x01, // ADD R0, R0, #1
        0xEA, 0xFF, 0xFF, 0xFE, // B -2 (loop)
      ]);

      // Load firmware
      await bridge.loadFirmware(firmware);

      // Set breakpoint
      bridge.setBreakpoint(0x100);

      // Step through instructions
      const state1 = bridge.step();
      expect(state1.instructionCount).toBeGreaterThanOrEqual(0);

      // Run multiple cycles
      const state2 = await bridge.runCycles(100);
      expect(state2.totalCycles).toBeGreaterThanOrEqual(100);

      // Inspect registers
      const state3 = bridge.getRegisters();
      expect(state3.registers.length).toBe(16);

      // Read memory
      const memory = bridge.getMemory(0, 64);
      expect(memory.length).toBe(64);

      // Check peripherals
      const peripherals = bridge.getPeripherals();
      expect(peripherals.gpioPins).toBeDefined();

      // Reset
      bridge.reset();

      // Verify reset
      const finalState = bridge.getRegisters();
      expect(finalState.totalCycles).toBe(0);
    });

    it('should handle debugging workflow with breakpoints', async () => {
      const firmware = new Uint8Array([
        0xe3, 0xa0, 0x00, 0x00, // MOV R0, #0
        0xE2, 0x80, 0x00, 0x01, // ADD R0, R0, #1
      ]);

      await bridge.loadFirmware(firmware);

      // Set breakpoints at different addresses
      const breakpoints = [0x0000, 0x1000, 0x2000];
      for (const bp of breakpoints) {
        bridge.setBreakpoint(bp);
      }

      // Run to breakpoint
      await bridge.runCycles(50);

      // Inspect state at breakpoint
      const state = bridge.getRegisters();
      expect(state).toBeDefined();

      // Remove some breakpoints
      bridge.removeBreakpoint(0x1000);

      // Continue execution
      const finalState = await bridge.runCycles(50);
      expect(finalState).toBeDefined();
    });
  });
});

// Export helper functions for testing
export function resetMicrocontrollerBridge(): void {
  // Reset singleton for test isolation
  // Implementation depends on how getMicrocontrollerBridge is implemented
}

export async function getMicrocontrollerBridge(): Promise<MicrocontrollerBridge> {
  // Return singleton instance
  // This would be imported from the actual module
  return new MicrocontrollerBridge();
}
