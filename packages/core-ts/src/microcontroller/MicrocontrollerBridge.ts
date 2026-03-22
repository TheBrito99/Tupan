/**
 * Microcontroller WASM Bridge
 *
 * Type-safe TypeScript wrapper around WASM microcontroller simulator.
 * Handles JSON serialization, error management, and batching for optimal performance.
 */

/**
 * CPU execution state
 */
export interface McuState {
  pc: number;  // Program counter
  sp: number;  // Stack pointer
  lr: number;  // Link register
  registers: number[];  // R0-R15
  cpsr: {
    zero: boolean;
    negative: boolean;
    carry: boolean;
    overflow: boolean;
    thumbMode: boolean;
    interruptDisable: boolean;
  };
  totalCycles: number;
  instructionCount: number;
  executionState: 'Running' | 'Halted' | 'Breakpoint' | 'Fault' | 'WFI';
  currentInstruction?: string;
}

/**
 * Memory region for hex dump viewing
 */
export interface MemoryRegion {
  start: number;
  length: number;
  data: Uint8Array;
  ascii: string;
}

/**
 * Peripheral state snapshot
 */
export interface PeripheralState {
  gpioPins: GpioPinState[];
  adcChannels: AdcChannelState[];
  pwmOutputs: PwmState[];
  timerValues: TimerState[];
}

export interface GpioPinState {
  pin: number;
  port: string;
  state: boolean;
  direction: 'input' | 'output';
}

export interface AdcChannelState {
  channel: number;
  rawValue: number;
  voltage: number;
}

export interface PwmState {
  timer: number;
  channel: number;
  dutyCycle: number;
  frequency: number;
}

export interface TimerState {
  timerId: number;
  counter: number;
  compare: number;
  isRunning: boolean;
}

/**
 * WASM module interface (FFI boundary)
 */
interface WasmMicrocontroller {
  load_firmware(firmware: Uint8Array): void;
  step(): string;  // Returns JSON
  run_cycles(count: number): string;  // Returns JSON
  get_registers(): string;  // Returns JSON
  get_memory_range(start: number, length: number): string;  // Returns JSON
  set_breakpoint(address: number): void;
  remove_breakpoint(address: number): void;
  get_breakpoints(): string;  // Returns JSON array
  add_watchpoint(address: number, size: number, trigger: string): void;
  reset(): void;
  get_peripheral_state(): string;  // Returns JSON
  get_cycle_count(): number;
  get_instruction_count(): number;
}

/**
 * Microcontroller Bridge - Main interface for browser-based simulation
 */
export class MicrocontrollerBridge {
  private wasm: WasmMicrocontroller | null = null;
  private breakpoints: Set<number> = new Set();
  private isInitialized: boolean = false;
  private simulationRunning: boolean = false;
  private batchSize: number = 1000;  // Cycles per batch for performance

  /**
   * Initialize WASM module (must be called before use)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Import dynamically to support both sync and async loading
      const module = await this.loadWasmModule();
      this.wasm = new module.WasmMicrocontrollerSimulator();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize WASM module: ${error}`);
    }
  }

  /**
   * Load WASM module (can be overridden for testing)
   */
  private async loadWasmModule(): Promise<any> {
    // Dynamic import of WASM module
    // In actual implementation, this would import from compiled WASM
    throw new Error('WASM module not loaded. Must call initialize() first.');
  }

  /**
   * Load firmware binary from bytes
   */
  async loadFirmware(firmwareBytes: Uint8Array): Promise<void> {
    if (!this.wasm) {
      await this.initialize();
    }

    try {
      this.wasm!.load_firmware(firmwareBytes);
      this.simulationRunning = false;
    } catch (error) {
      throw new Error(`Failed to load firmware: ${error}`);
    }
  }

  /**
   * Execute one instruction
   */
  step(): McuState {
    if (!this.wasm) throw new Error('Not initialized');

    const json = this.wasm.step();
    return this.parseMcuState(json);
  }

  /**
   * Run multiple cycles with batching for performance
   * Returns when breakpoint hit or all cycles complete
   */
  async runCycles(cycles: number): Promise<McuState> {
    if (!this.wasm) throw new Error('Not initialized');

    this.simulationRunning = true;

    // Batch execution to minimize JSON serialization overhead
    const batches = Math.ceil(cycles / this.batchSize);
    let currentCycles = 0;

    for (let i = 0; i < batches && this.simulationRunning; i++) {
      const batchCycles = Math.min(this.batchSize, cycles - currentCycles);

      try {
        const json = this.wasm.run_cycles(batchCycles);
        currentCycles += batchCycles;

        const state = this.parseMcuState(json);

        // Check if we hit a breakpoint
        if (state.executionState === 'Breakpoint') {
          this.simulationRunning = false;
          return state;
        }

        // Yield to event loop every batch
        await this.delay(0);
      } catch (error) {
        this.simulationRunning = false;
        throw new Error(`Execution error: ${error}`);
      }
    }

    const state = this.getRegisters();
    this.simulationRunning = false;
    return state;
  }

  /**
   * Get current CPU state (registers, flags, PC)
   */
  getRegisters(): McuState {
    if (!this.wasm) throw new Error('Not initialized');

    const json = this.wasm.get_registers();
    return this.parseMcuState(json);
  }

  /**
   * Read memory region and return hex dump
   */
  getMemory(startAddress: number, length: number): MemoryRegion {
    if (!this.wasm) throw new Error('Not initialized');

    const json = this.wasm.get_memory_range(startAddress, length);

    try {
      const region = JSON.parse(json);
      return {
        start: region.start,
        length: region.length,
        data: new Uint8Array(region.data),
        ascii: region.ascii,
      };
    } catch (error) {
      throw new Error(`Failed to parse memory region: ${error}`);
    }
  }

  /**
   * Set breakpoint at address
   */
  setBreakpoint(address: number): void {
    if (!this.wasm) throw new Error('Not initialized');

    this.wasm.set_breakpoint(address);
    this.breakpoints.add(address);
  }

  /**
   * Remove breakpoint at address
   */
  removeBreakpoint(address: number): void {
    if (!this.wasm) throw new Error('Not initialized');

    this.wasm.remove_breakpoint(address);
    this.breakpoints.delete(address);
  }

  /**
   * Get all active breakpoints
   */
  getBreakpoints(): number[] {
    if (!this.wasm) throw new Error('Not initialized');

    const json = this.wasm.get_breakpoints();
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  /**
   * Get peripheral state (GPIO, ADC, PWM, timers)
   */
  getPeripherals(): PeripheralState {
    if (!this.wasm) throw new Error('Not initialized');

    const json = this.wasm.get_peripheral_state();

    try {
      const peripheral = JSON.parse(json);
      return {
        gpioPins: (peripheral.gpio_pins || []).map((p: any) => ({
          pin: p.pin,
          port: p.port,
          state: p.state,
          direction: p.direction,
        })),
        adcChannels: (peripheral.adc_channels || []).map((a: any) => ({
          channel: a.channel,
          rawValue: a.raw_value,
          voltage: a.voltage,
        })),
        pwmOutputs: (peripheral.pwm_outputs || []).map((p: any) => ({
          timer: p.timer,
          channel: p.channel,
          dutyCycle: p.duty_cycle,
          frequency: p.frequency,
        })),
        timerValues: (peripheral.timer_values || []).map((t: any) => ({
          timerId: t.timer_id,
          counter: t.counter,
          compare: t.compare,
          isRunning: t.is_running,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to parse peripheral state: ${error}`);
    }
  }

  /**
   * Reset microcontroller to initial state
   */
  reset(): void {
    if (!this.wasm) throw new Error('Not initialized');

    this.wasm.reset();
    this.breakpoints.clear();
    this.simulationRunning = false;
  }

  /**
   * Get total cycle count
   */
  getCycleCount(): number {
    if (!this.wasm) throw new Error('Not initialized');

    return this.wasm.get_cycle_count();
  }

  /**
   * Get total instruction count
   */
  getInstructionCount(): number {
    if (!this.wasm) throw new Error('Not initialized');

    return this.wasm.get_instruction_count();
  }

  /**
   * Check if simulation is running
   */
  isRunning(): boolean {
    return this.simulationRunning;
  }

  /**
   * Pause running simulation
   */
  pause(): void {
    this.simulationRunning = false;
  }

  /**
   * Set batch size for cycle execution (affects performance vs UI responsiveness)
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(100, Math.min(100000, size));
  }

  // ========== Helper Methods ==========

  /**
   * Parse JSON MCU state response
   */
  private parseMcuState(json: string): McuState {
    try {
      const data = JSON.parse(json);
      return {
        pc: data.pc,
        sp: data.sp,
        lr: data.lr,
        registers: data.registers,
        cpsr: {
          zero: data.cpsr.zero,
          negative: data.cpsr.negative,
          carry: data.cpsr.carry,
          overflow: data.cpsr.overflow,
          thumbMode: data.cpsr.thumb_mode,
          interruptDisable: data.cpsr.interrupt_disable,
        },
        totalCycles: data.total_cycles,
        instructionCount: data.instruction_count,
        executionState: this.parseExecutionState(data.execution_state),
        currentInstruction: data.current_instruction,
      };
    } catch (error) {
      throw new Error(`Failed to parse MCU state: ${error}`);
    }
  }

  /**
   * Parse execution state string
   */
  private parseExecutionState(state: string): McuState['executionState'] {
    if (state.includes('Running')) return 'Running';
    if (state.includes('Halted')) return 'Halted';
    if (state.includes('Breakpoint')) return 'Breakpoint';
    if (state.includes('Fault')) return 'Fault';
    if (state.includes('WFI')) return 'WFI';
    return 'Halted';  // Default
  }

  /**
   * Delay for event loop yielding
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for global access
 */
let bridgeInstance: MicrocontrollerBridge | null = null;

/**
 * Get or create singleton bridge instance
 */
export async function getMicrocontrollerBridge(): Promise<MicrocontrollerBridge> {
  if (!bridgeInstance) {
    bridgeInstance = new MicrocontrollerBridge();
    await bridgeInstance.initialize();
  }
  return bridgeInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetMicrocontrollerBridge(): void {
  bridgeInstance = null;
}
