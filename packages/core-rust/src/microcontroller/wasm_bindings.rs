//! WASM Bindings for Microcontroller Simulator
//!
//! Exposes ARM CPU emulator, peripherals, and debugging features to browser
//! via JSON serialization for type safety and compatibility

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

use crate::microcontroller::{
    ArmCpuEmulator, CpuState, CoupledMicrocontrollerCircuitSim,
    ExecutionState,
};
use crate::microcontroller::registers::CpsrFlags;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;

/// Microcontroller execution state for JSON serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McuStateJson {
    pub pc: u32,
    pub sp: u32,
    pub lr: u32,
    pub registers: Vec<u32>,  // R0-R15
    pub cpsr: CpsrJson,
    pub total_cycles: u64,
    pub instruction_count: u64,
    pub execution_state: String,
    pub current_instruction: Option<String>,
}

/// CPSR flags for JSON serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpsrJson {
    pub zero: bool,
    pub negative: bool,
    pub carry: bool,
    pub overflow: bool,
    pub thumb_mode: bool,
    pub interrupt_disable: bool,
}

/// Memory region for hex dump viewing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRegionJson {
    pub start: u32,
    pub length: usize,
    pub data: Vec<u8>,
    pub ascii: String,
}

/// Peripheral state for visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeripheralStateJson {
    pub gpio_pins: Vec<GpioPinState>,
    pub adc_channels: Vec<AdcChannelState>,
    pub pwm_outputs: Vec<PwmState>,
    pub timer_values: Vec<TimerState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpioPinState {
    pub pin: u8,
    pub port: char,
    pub state: bool,
    pub direction: String,  // "input" or "output"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdcChannelState {
    pub channel: u8,
    pub raw_value: u16,
    pub voltage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PwmState {
    pub timer: u8,
    pub channel: u8,
    pub duty_cycle: f64,
    pub frequency: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerState {
    pub timer_id: u8,
    pub counter: u32,
    pub compare: u32,
    pub is_running: bool,
}

/// WASM-exposed microcontroller simulator
#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmMicrocontrollerSimulator {
    cpu: ArmCpuEmulator,
    coupled: Option<CoupledMicrocontrollerCircuitSim>,
    breakpoints: HashSet<u32>,
    watchpoints: Vec<WatchpointConfig>,
}

#[derive(Debug, Clone)]
struct WatchpointConfig {
    address: u32,
    size: usize,
    trigger_type: String,  // "read", "write", "execute"
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmMicrocontrollerSimulator {
    /// Create new microcontroller simulator
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmMicrocontrollerSimulator {
        WasmMicrocontrollerSimulator {
            cpu: ArmCpuEmulator::new(),
            coupled: None,
            breakpoints: HashSet::new(),
            watchpoints: Vec::new(),
        }
    }

    /// Load firmware binary (bytes as JS Uint8Array)
    pub fn load_firmware(&mut self, firmware_bytes: &[u8]) -> Result<(), JsValue> {
        self.cpu
            .load_firmware(firmware_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to load firmware: {}", e)))
    }

    /// Execute one instruction (fetch-decode-execute cycle)
    pub fn step(&mut self) -> Result<String, JsValue> {
        self.cpu
            .step()
            .map_err(|e| JsValue::from_str(&format!("Step failed: {}", e)))?;

        // Serialize CPU state to JSON
        let state = self.cpu.get_state();
        let mcu_state = self.cpu_state_to_json(state);

        Ok(serde_json::to_string(&mcu_state)
            .map_err(|e| JsValue::from_str(&format!("JSON serialization failed: {}", e)))?)
    }

    /// Run multiple instruction cycles
    pub fn run_cycles(&mut self, count: u32) -> Result<String, JsValue> {
        for _ in 0..count {
            match self.cpu.step() {
                Ok(_) => {
                    // Check if we hit a breakpoint
                    let state = self.cpu.get_state();
                    if self.breakpoints.contains(&state.registers.pc()) {
                        let mcu_state = self.cpu_state_to_json(state);
                        return Ok(serde_json::to_string(&mcu_state)
                            .map_err(|e| JsValue::from_str(&e.to_string()))?);
                    }
                }
                Err(e) => {
                    if e.contains("Hit breakpoint") {
                        let state = self.cpu.get_state();
                        let mcu_state = self.cpu_state_to_json(state);
                        return Ok(serde_json::to_string(&mcu_state)
                            .map_err(|e| JsValue::from_str(&e.to_string()))?);
                    }
                    return Err(JsValue::from_str(&format!("Execution error: {}", e)));
                }
            }
        }

        let state = self.cpu.get_state();
        let mcu_state = self.cpu_state_to_json(state);

        Ok(serde_json::to_string(&mcu_state)
            .map_err(|e| JsValue::from_str(&e.to_string()))?)
    }

    /// Get CPU register state as JSON
    pub fn get_registers(&self) -> String {
        let state = self.cpu.get_state();
        let mcu_state = self.cpu_state_to_json(state);

        serde_json::to_string(&mcu_state).unwrap_or_else(|_| "{}".to_string())
    }

    /// Read memory region and return as hex dump
    pub fn get_memory_range(&self, start: u32, length: u32) -> Result<String, JsValue> {
        let state = self.cpu.get_state();
        let length = length as usize;
        let mut data = vec![0u8; length];

        for i in 0..length {
            match state.memory.read_u8(start + i as u32) {
                Ok(byte) => data[i] = byte,
                Err(_) => data[i] = 0xFF,  // Mark invalid addresses
            }
        }

        // Generate ASCII representation
        let ascii: String = data
            .iter()
            .map(|&b| {
                if b >= 32 && b <= 126 {
                    b as char
                } else {
                    '.'
                }
            })
            .collect();

        let region = MemoryRegionJson {
            start,
            length,
            data,
            ascii,
        };

        Ok(serde_json::to_string(&region)
            .map_err(|e| JsValue::from_str(&e.to_string()))?)
    }

    /// Set breakpoint at address
    pub fn set_breakpoint(&mut self, address: u32) -> Result<(), JsValue> {
        self.breakpoints.insert(address);
        Ok(())
    }

    /// Remove breakpoint at address
    pub fn remove_breakpoint(&mut self, address: u32) {
        self.breakpoints.remove(&address);
    }

    /// Get all active breakpoints
    pub fn get_breakpoints(&self) -> String {
        let breakpoints: Vec<u32> = self.breakpoints.iter().cloned().collect();
        serde_json::to_string(&breakpoints).unwrap_or_else(|_| "[]".to_string())
    }

    /// Add watchpoint (for future implementation)
    pub fn add_watchpoint(
        &mut self,
        address: u32,
        size: u32,
        trigger: &str,
    ) -> Result<(), JsValue> {
        self.watchpoints.push(WatchpointConfig {
            address,
            size: size as usize,
            trigger_type: trigger.to_string(),
        });
        Ok(())
    }

    /// Reset CPU to initial state
    pub fn reset(&mut self) {
        self.cpu = ArmCpuEmulator::new();
        self.breakpoints.clear();
    }

    /// Get peripheral state (GPIO, ADC, PWM, timers)
    pub fn get_peripheral_state(&self) -> String {
        let peripheral_state = PeripheralStateJson {
            gpio_pins: vec![
                // GPIO PA0-PA7
                GpioPinState {
                    pin: 0,
                    port: 'A',
                    state: false,
                    direction: "input".to_string(),
                },
            ],
            adc_channels: vec![
                AdcChannelState {
                    channel: 0,
                    raw_value: 0,
                    voltage: 0.0,
                },
            ],
            pwm_outputs: vec![
                PwmState {
                    timer: 1,
                    channel: 0,
                    duty_cycle: 0.0,
                    frequency: 1000,
                },
            ],
            timer_values: vec![
                TimerState {
                    timer_id: 1,
                    counter: 0,
                    compare: 0,
                    is_running: false,
                },
            ],
        };

        serde_json::to_string(&peripheral_state).unwrap_or_else(|_| "{}".to_string())
    }

    /// Get total cycle count
    pub fn get_cycle_count(&self) -> u64 {
        let state = self.cpu.get_state();
        state.total_cycles
    }

    /// Get instruction count
    pub fn get_instruction_count(&self) -> u64 {
        let state = self.cpu.get_state();
        state.instruction_count
    }
}

// Helper function to convert CpuState to JSON-serializable format
#[cfg(feature = "wasm")]
impl WasmMicrocontrollerSimulator {
    fn cpu_state_to_json(&self, state: &CpuState) -> McuStateJson {
        let registers: Vec<u32> = (0..16)
            .map(|i| state.registers.get_by_index(i as u8).unwrap_or(0))
            .collect();

        let cpsr = state.registers.get_cpsr();

        McuStateJson {
            pc: state.registers.pc(),
            sp: state.registers.sp(),
            lr: state.registers.lr(),
            registers,
            cpsr: CpsrJson {
                zero: cpsr.zero_flag(),
                negative: cpsr.negative_flag(),
                carry: cpsr.carry_flag(),
                overflow: cpsr.overflow_flag(),
                thumb_mode: cpsr.thumb_mode(),
                interrupt_disable: cpsr.irq_disabled(),
            },
            total_cycles: state.total_cycles,
            instruction_count: state.instruction_count,
            execution_state: format!("{:?}", state.exec_state),
            current_instruction: state
                .current_instruction
                .as_ref()
                .map(|inst| format!("{:?}", inst)),
        }
    }
}

#[cfg(all(test, feature = "wasm"))]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_simulator_creation() {
        let _sim = WasmMicrocontrollerSimulator::new();
        // Test passes if no panic
    }

    #[test]
    fn test_breakpoint_management() {
        let mut sim = WasmMicrocontrollerSimulator::new();

        sim.set_breakpoint(0x00000100).unwrap();
        sim.set_breakpoint(0x00000200).unwrap();

        let breakpoints = sim.get_breakpoints();
        assert!(breakpoints.contains("256")); // 0x100 = 256
        assert!(breakpoints.contains("512")); // 0x200 = 512

        sim.remove_breakpoint(0x00000100);
        let breakpoints = sim.get_breakpoints();
        assert!(!breakpoints.contains("256"));
    }

    #[test]
    fn test_memory_dump() {
        let mut sim = WasmMicrocontrollerSimulator::new();
        let firmware = vec![0x00, 0x01, 0x02, 0x03, 0x04, 0x05];
        sim.load_firmware(&firmware).unwrap();

        let result = sim.get_memory_range(0, 6).unwrap();
        let region: MemoryRegionJson = serde_json::from_str(&result).unwrap();

        assert_eq!(region.start, 0);
        assert_eq!(region.length, 6);
        assert_eq!(region.data[0], 0x00);
        assert_eq!(region.data[5], 0x05);
    }

    #[test]
    fn test_cycle_counting() {
        let sim = WasmMicrocontrollerSimulator::new();
        let cycles = sim.get_cycle_count();
        assert_eq!(cycles, 0);
    }
}
