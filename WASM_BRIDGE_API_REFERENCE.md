# WASM Microcontroller Bridge - API Reference
## Phase 22 Week 1 Task 3 & 4

Quick reference for TypeScript developers using the MicrocontrollerBridge.

---

## Import & Initialization

```typescript
import { MicrocontrollerBridge, getMicrocontrollerBridge } from '@tupan/microcontroller';

// Method 1: Direct instantiation
const bridge = new MicrocontrollerBridge();
await bridge.initialize();

// Method 2: Singleton pattern (recommended)
const bridge = await getMicrocontrollerBridge();

// Reset singleton for testing
import { resetMicrocontrollerBridge } from '@tupan/microcontroller';
resetMicrocontrollerBridge();
```

---

## Type Definitions

### McuState
```typescript
interface McuState {
  // CPU Registers
  registers: number[];        // R0-R15 (16 values)
  pc: number;                 // Program Counter
  sp: number;                 // Stack Pointer
  lr: number;                 // Link Register

  // CPSR Flags
  cpsr: {
    zero: boolean;            // Z flag
    negative: boolean;        // N flag
    carry: boolean;           // C flag
    overflow: boolean;        // V flag
    thumbMode: boolean;       // Thumb mode (vs ARM)
    interruptDisable: boolean;// Interrupt disable flag
  };

  // Execution Stats
  totalCycles: number;        // Total CPU cycles executed
  instructionCount: number;   // Total instructions executed
  executionState: 'Running' | 'Halted' | 'Breakpoint' | 'Fault' | 'WFI';
  currentInstruction?: string; // Optional: disassembled instruction
}
```

### MemoryRegion
```typescript
interface MemoryRegion {
  start: number;              // Starting address
  length: number;             // Number of bytes
  data: Uint8Array;           // Raw bytes
  ascii: string;              // ASCII representation (printable chars)
}
```

### PeripheralState
```typescript
interface PeripheralState {
  gpioPins: GpioPinState[];
  adcChannels: AdcChannelState[];
  pwmOutputs: PwmState[];
  timerValues: TimerState[];
}

interface GpioPinState {
  pin: number;
  port: string;               // e.g., "PA", "PB", "PORTC"
  state: boolean;             // High (true) or Low (false)
  direction: 'input' | 'output';
}

interface AdcChannelState {
  channel: number;
  rawValue: number;           // 0-4095 (12-bit) or 0-1023 (10-bit)
  voltage: number;            // Voltage in volts
}

interface PwmState {
  timer: number;
  channel: number;
  dutyCycle: number;          // 0-100 (%)
  frequency: number;          // Hz
}

interface TimerState {
  timerId: number;
  counter: number;
  compare: number;
  isRunning: boolean;
}
```

---

## Core API

### Firmware Management

#### `loadFirmware(bytes: Uint8Array): Promise<void>`
Load ARM machine code into the simulator.

```typescript
// Load from Array Buffer
const response = await fetch('firmware.bin');
const buffer = await response.arrayBuffer();
const firmware = new Uint8Array(buffer);
await bridge.loadFirmware(firmware);

// Load from byte array
const firmware = new Uint8Array([
  0xe3, 0xa0, 0x00, 0x00,  // MOV R0, #0
  0xE2, 0x80, 0x00, 0x01,  // ADD R0, R0, #1
]);
await bridge.loadFirmware(firmware);
```

#### `reset(): void`
Reset simulator to initial state (clears cycles, resets registers).

```typescript
bridge.reset();
```

### Execution Control

#### `step(): McuState`
Execute one instruction synchronously.

```typescript
const state = bridge.step();
console.log(`PC: 0x${state.pc.toString(16)}`);
console.log(`R0: ${state.registers[0]}`);
console.log(`Cycles: ${state.totalCycles}`);
```

#### `async runCycles(count: number): Promise<McuState>`
Execute multiple cycles with batching for performance.

```typescript
// Execute 100 cycles (batched in 1000-cycle chunks)
const state = await bridge.runCycles(100);
console.log(`Executed ${state.totalCycles} cycles`);

// Execute many cycles
const state = await bridge.runCycles(10000);

// Check if hit breakpoint
if (state.executionState === 'Breakpoint') {
  console.log(`Hit breakpoint at 0x${state.pc.toString(16)}`);
}
```

#### `pause(): void`
Pause running simulation.

```typescript
bridge.pause();
console.log(bridge.isRunning()); // false
```

#### `isRunning(): boolean`
Check if simulation is currently running.

```typescript
if (bridge.isRunning()) {
  bridge.pause();
}
```

---

## CPU Inspection

#### `getRegisters(): McuState`
Get current CPU state (all registers, flags, counters).

```typescript
const state = bridge.getRegisters();

// Access registers
console.log(state.registers[0]);  // R0
console.log(state.registers[15]); // R15

// Access special registers
console.log(`PC: 0x${state.pc.toString(16)}`);
console.log(`SP: 0x${state.sp.toString(16)}`);
console.log(`LR: 0x${state.lr.toString(16)}`);

// Check flags
if (state.cpsr.zero) {
  console.log('Zero flag set');
}
```

#### `getCycleCount(): number`
Get total cycles executed since last reset.

```typescript
const cyclesBefore = bridge.getCycleCount();
bridge.step();
const cyclesAfter = bridge.getCycleCount();
console.log(`Step took ${cyclesAfter - cyclesBefore} cycles`);
```

#### `getInstructionCount(): number`
Get total instructions executed since last reset.

```typescript
const count = bridge.getInstructionCount();
console.log(`${count} instructions executed`);
```

---

## Memory Access

#### `getMemory(startAddress: number, length: number): MemoryRegion`
Read memory as hex dump with ASCII representation.

```typescript
// Read first 64 bytes
const memory = bridge.getMemory(0, 64);
console.log(`Start: 0x${memory.start.toString(16)}`);
console.log(`Data: ${Array.from(memory.data).map(b => b.toString(16)).join(' ')}`);
console.log(`ASCII: ${memory.ascii}`);

// Read from SRAM (typically 0x2000_0000 for ARM Cortex-M)
const sram = bridge.getMemory(0x2000_0000, 256);

// Display as formatted hex dump
console.log('Address  | Hex Data                             | ASCII');
console.log('---------|--------------------------------------|----------');
for (let i = 0; i < memory.data.length; i += 16) {
  const addr = (memory.start + i).toString(16).padStart(8, '0');
  const hex = Array.from(memory.data.slice(i, i + 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  const ascii = memory.ascii.slice(i, i + 16);
  console.log(`${addr} | ${hex.padEnd(35)} | ${ascii}`);
}
```

---

## Breakpoint Management

#### `setBreakpoint(address: number): void`
Set execution breakpoint at address.

```typescript
// Set single breakpoint
bridge.setBreakpoint(0x0000);
bridge.setBreakpoint(0x1000);
bridge.setBreakpoint(0x2000);
```

#### `removeBreakpoint(address: number): void`
Remove breakpoint at address (safe to call on non-existent breakpoint).

```typescript
bridge.removeBreakpoint(0x1000);
```

#### `getBreakpoints(): number[]`
Get list of all active breakpoints.

```typescript
const breakpoints = bridge.getBreakpoints();
console.log(`Breakpoints: ${breakpoints.map(b => '0x' + b.toString(16)).join(', ')}`);

if (breakpoints.includes(0x1000)) {
  console.log('Breakpoint at 0x1000 is set');
}
```

**Debugging Workflow:**
```typescript
// Set breakpoints
bridge.setBreakpoint(0x0100);
bridge.setBreakpoint(0x0200);

// Run to breakpoint
const state = await bridge.runCycles(1000);

if (state.executionState === 'Breakpoint') {
  console.log(`Stopped at 0x${state.pc.toString(16)}`);

  // Inspect state
  const regs = bridge.getRegisters();
  console.log(`R0: ${regs.registers[0]}`);

  // Continue past breakpoint
  const state2 = await bridge.runCycles(100);
}

// Clean up
bridge.removeBreakpoint(0x0100);
bridge.removeBreakpoint(0x0200);
```

---

## Peripheral Access

#### `getPeripherals(): PeripheralState`
Get GPIO, ADC, PWM, and Timer state.

```typescript
const peripherals = bridge.getPeripherals();

// Check GPIO pins
for (const pin of peripherals.gpioPins) {
  console.log(`GPIO ${pin.port}${pin.pin}: ${pin.state ? 'HIGH' : 'LOW'} (${pin.direction})`);
}

// Check ADC readings
for (const adc of peripherals.adcChannels) {
  console.log(`ADC${adc.channel}: ${adc.rawValue} (${adc.voltage.toFixed(2)}V)`);
}

// Check PWM outputs
for (const pwm of peripherals.pwmOutputs) {
  console.log(`PWM T${pwm.timer}C${pwm.channel}: ${pwm.dutyCycle.toFixed(1)}% @ ${pwm.frequency}Hz`);
}

// Check timers
for (const timer of peripherals.timerValues) {
  const running = timer.isRunning ? 'running' : 'stopped';
  console.log(`Timer${timer.timerId}: ${timer.counter}/${timer.compare} (${running})`);
}
```

---

## Performance Configuration

#### `setBatchSize(size: number): void`
Configure number of cycles per batch for optimal performance.

```typescript
// Default: 1000 cycles/batch (good for 60 FPS)
bridge.setBatchSize(1000);

// Faster UI response (smaller batches)
bridge.setBatchSize(100);

// Higher throughput (larger batches)
bridge.setBatchSize(5000);

// Valid range: 100-100,000
// Implementation clamps to min 100, max 100,000
```

---

## Complete Workflow Example

```typescript
import { getMicrocontrollerBridge } from '@tupan/microcontroller';

async function simulateMotorControl() {
  const bridge = await getMicrocontrollerBridge();

  // 1. Load firmware
  const firmware = new Uint8Array([
    0xe3, 0xa0, 0x00, 0x00,  // MOV R0, #0
    0xE2, 0x80, 0x00, 0x01,  // ADD R0, R0, #1
    0xEA, 0xFF, 0xFF, 0xFE,  // B -2 (infinite loop)
  ]);
  await bridge.loadFirmware(firmware);
  console.log('✓ Firmware loaded');

  // 2. Set breakpoint
  bridge.setBreakpoint(0x100);
  console.log(`✓ Breakpoint set. Total: ${bridge.getBreakpoints().length}`);

  // 3. Run to breakpoint
  const state = await bridge.runCycles(1000);
  console.log(`✓ Ran ${state.totalCycles} cycles (state: ${state.executionState})`);

  // 4. Inspect CPU state
  const regs = bridge.getRegisters();
  console.log(`✓ R0=${regs.registers[0]}, PC=0x${regs.pc.toString(16)}`);

  // 5. Check memory
  const memory = bridge.getMemory(0, 32);
  console.log(`✓ Memory[0:8]: ${Array.from(memory.data.slice(0, 8)).map(b => b.toString(16)).join(' ')}`);

  // 6. Monitor peripherals
  const periphs = bridge.getPeripherals();
  console.log(`✓ GPIO pins: ${periphs.gpioPins.length}, ADC: ${periphs.adcChannels.length}`);

  // 7. Continue execution
  await bridge.runCycles(100);
  console.log(`✓ Total cycles: ${bridge.getCycleCount()}`);

  // 8. Clean up
  bridge.removeBreakpoint(0x100);
  bridge.reset();
  console.log('✓ Simulation reset');
}

// Run the workflow
simulateMotorControl().catch(console.error);
```

---

## Error Handling

```typescript
try {
  const firmware = new Uint8Array([0xe3, 0xa0, 0x00, 0x00]);
  await bridge.loadFirmware(firmware);

  const state = await bridge.runCycles(100);

  if (state.executionState === 'Fault') {
    console.error('CPU fault detected');
  }
} catch (error) {
  console.error('Simulation error:', error);
}
```

---

## Common Patterns

### Pattern 1: Single-Step Debugger
```typescript
let paused = false;

function step() {
  const state = bridge.step();
  console.log(`0x${state.pc.toString(16)}: R0=${state.registers[0]}`);
}

function run(cycles: number) {
  bridge.runCycles(cycles).then(state => {
    console.log(`Stopped: ${state.executionState}`);
  });
}

function pause() {
  paused = true;
  bridge.pause();
}
```

### Pattern 2: Real-time Monitor
```typescript
setInterval(() => {
  const state = bridge.getRegisters();
  const periphs = bridge.getPeripherals();

  updateUI({
    pc: `0x${state.pc.toString(16)}`,
    r0: state.registers[0],
    cycles: state.totalCycles,
    gpio: periphs.gpioPins.map(p => ({ port: p.port, pin: p.pin, state: p.state })),
    adc: periphs.adcChannels.map(a => ({ ch: a.channel, voltage: a.voltage })),
  });
}, 100); // Update every 100ms
```

### Pattern 3: Conditional Breakpoint
```typescript
async function runUntilCondition(condition: (state: McuState) => boolean) {
  while (true) {
    const state = bridge.getRegisters();
    if (condition(state)) {
      console.log(`Condition met at 0x${state.pc.toString(16)}`);
      break;
    }
    await bridge.runCycles(100);
  }
}

// Run until R0 equals 5
await runUntilCondition(state => state.registers[0] === 5);
```

### Pattern 4: Memory Watch
```typescript
function watchMemory(address: number, length: number = 4) {
  const initial = bridge.getMemory(address, length);
  const initialValue = Array.from(initial.data).join(',');

  return setInterval(() => {
    const current = bridge.getMemory(address, length);
    const currentValue = Array.from(current.data).join(',');

    if (initialValue !== currentValue) {
      console.log(`Memory changed at 0x${address.toString(16)}: ${currentValue}`);
    }
  }, 100);
}

// Watch first 4 bytes
const watchId = watchMemory(0, 4);

// Stop watching
setTimeout(() => clearInterval(watchId), 5000);
```

---

## Performance Tips

1. **Use batch execution:** `runCycles()` is faster than repeated `step()` calls
2. **Minimize memory reads:** Cache results instead of calling `getMemory()` repeatedly
3. **Batch peripheral checks:** Call `getPeripherals()` less frequently
4. **Tune batch size:** Larger batches (5000-10000) for throughput, smaller (100-500) for responsiveness
5. **Use getRegisters() efficiently:** Single call gets all CPU state

---

## Board Configuration

Access board-specific information:

```typescript
import { BoardTemplate, McuTarget } from '@tupan/microcontroller';

const board = BoardTemplate.from_target(McuTarget.Arduino);

console.log(`Name: ${board.name}`);           // "Arduino Uno"
console.log(`Flash: ${board.flash_kb}KB`);   // 32KB
console.log(`SRAM: ${board.sram_kb}KB`);     // 2KB
console.log(`Clock: ${board.clock_mhz}MHz`); // 16MHz
console.log(`ADC: ${board.adc_config.channels} channels`); // 6 channels
console.log(`Platform: ${board.mcu_target.platformio_platform()}`); // "atmelavr"
```

---

## Summary

| Method | Sync/Async | Purpose |
|--------|-----------|---------|
| `loadFirmware()` | Async | Load firmware binary |
| `step()` | Sync | Execute 1 instruction |
| `runCycles()` | Async | Execute N cycles |
| `reset()` | Sync | Reset to initial state |
| `pause()` | Sync | Pause simulation |
| `isRunning()` | Sync | Check running state |
| `getRegisters()` | Sync | Read R0-R15, flags, counters |
| `getCycleCount()` | Sync | Read total cycles |
| `getInstructionCount()` | Sync | Read total instructions |
| `getMemory()` | Sync | Read memory region |
| `setBreakpoint()` | Sync | Set breakpoint |
| `removeBreakpoint()` | Sync | Remove breakpoint |
| `getBreakpoints()` | Sync | List breakpoints |
| `getPeripherals()` | Sync | Read GPIO/ADC/PWM/Timer |
| `setBatchSize()` | Sync | Configure batch size |

---

**Reference Version:** Phase 22 Week 1 Task 4
**Last Updated:** 2026-03-21
**Status:** ✅ Production-ready
