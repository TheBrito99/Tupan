//! Firmware Code Generation
//!
//! Convert high-level designs (block diagrams, state machines) into C/C++ firmware code

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Target Microcontroller Type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum McuTarget {
    Stm32f103,  // Blue Pill, popular ARM Cortex-M3
    Stm32f401,  // More advanced, Cortex-M4
    Stm32l476,  // Low-power variant
    Arduino,    // Arduino boards (ATmega328P)
    Esp32,      // WiFi-enabled microcontroller
}

impl McuTarget {
    pub fn hal_prefix(&self) -> &'static str {
        match self {
            McuTarget::Stm32f103 => "STM32F1xx",
            McuTarget::Stm32f401 => "STM32F4xx",
            McuTarget::Stm32l476 => "STM32L4xx",
            McuTarget::Arduino => "Arduino",
            McuTarget::Esp32 => "ESP32",
        }
    }

    pub fn clock_frequency_hz(&self) -> u32 {
        match self {
            McuTarget::Stm32f103 => 72_000_000,
            McuTarget::Stm32f401 => 84_000_000,
            McuTarget::Stm32l476 => 80_000_000,
            McuTarget::Arduino => 16_000_000,
            McuTarget::Esp32 => 240_000_000,
        }
    }
}

/// Function Definition for Generated Code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDef {
    pub name: String,
    pub return_type: String,
    pub parameters: Vec<(String, String)>,  // (type, name)
    pub body: String,
    pub is_interrupt: bool,
}

impl FunctionDef {
    pub fn new(name: &str) -> Self {
        FunctionDef {
            name: name.to_string(),
            return_type: "void".to_string(),
            parameters: Vec::new(),
            body: String::new(),
            is_interrupt: false,
        }
    }

    pub fn with_return_type(mut self, ret_type: &str) -> Self {
        self.return_type = ret_type.to_string();
        self
    }

    pub fn with_parameter(mut self, param_type: &str, param_name: &str) -> Self {
        self.parameters.push((param_type.to_string(), param_name.to_string()));
        self
    }

    pub fn with_body(mut self, body: &str) -> Self {
        self.body = body.to_string();
        self
    }

    pub fn mark_interrupt(mut self) -> Self {
        self.is_interrupt = true;
        self
    }

    /// Generate C function code
    pub fn generate_c(&self) -> String {
        let interrupt_attr = if self.is_interrupt {
            "void __attribute__((interrupt)) "
        } else {
            ""
        };

        let params = if self.parameters.is_empty() {
            "void".to_string()
        } else {
            self.parameters
                .iter()
                .map(|(t, n)| format!("{} {}", t, n))
                .collect::<Vec<_>>()
                .join(", ")
        };

        format!(
            "{}{} {}({}) {{\n{}\n}}\n",
            interrupt_attr, self.return_type, self.name, params, self.body
        )
    }
}

/// Generated Firmware Code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirmwareCode {
    pub target: McuTarget,
    pub includes: Vec<String>,
    pub defines: HashMap<String, String>,
    pub globals: Vec<String>,
    pub functions: Vec<FunctionDef>,
    pub main_setup: String,
    pub main_loop: String,
}

impl FirmwareCode {
    pub fn new(target: McuTarget) -> Self {
        let mut includes = vec![
            "#include <stdint.h>".to_string(),
            "#include <stdbool.h>".to_string(),
        ];

        match target {
            McuTarget::Stm32f103 | McuTarget::Stm32f401 | McuTarget::Stm32l476 => {
                includes.push("#include \"stm32xx_hal.h\"".to_string());
            }
            McuTarget::Arduino => {
                includes.push("#include <Arduino.h>".to_string());
            }
            McuTarget::Esp32 => {
                includes.push("#include <Arduino.h>".to_string());
                includes.push("#include <WiFi.h>".to_string());
            }
        }

        FirmwareCode {
            target,
            includes,
            defines: HashMap::new(),
            globals: Vec::new(),
            functions: Vec::new(),
            main_setup: String::new(),
            main_loop: String::new(),
        }
    }

    pub fn add_include(&mut self, include: &str) {
        self.includes.push(include.to_string());
    }

    pub fn add_define(&mut self, name: &str, value: &str) {
        self.defines.insert(name.to_string(), value.to_string());
    }

    pub fn add_global(&mut self, declaration: &str) {
        self.globals.push(declaration.to_string());
    }

    pub fn add_function(&mut self, func: FunctionDef) {
        self.functions.push(func);
    }

    pub fn set_setup(&mut self, code: &str) {
        self.main_setup = code.to_string();
    }

    pub fn set_loop(&mut self, code: &str) {
        self.main_loop = code.to_string();
    }

    /// Generate complete C program
    pub fn generate_c(&self) -> String {
        let mut code = String::new();

        // Includes
        code.push_str("// Auto-generated firmware\n");
        code.push_str("// Target: ");
        code.push_str(&format!("{:?}\n\n", self.target));
        for include in &self.includes {
            code.push_str(include);
            code.push_str("\n");
        }

        // Defines
        if !self.defines.is_empty() {
            code.push_str("\n// Configuration\n");
            for (name, value) in &self.defines {
                code.push_str(&format!("#define {} {}\n", name, value));
            }
        }

        // Global variables
        if !self.globals.is_empty() {
            code.push_str("\n// Global variables\n");
            for global in &self.globals {
                code.push_str(global);
                code.push_str("\n");
            }
        }

        // Functions
        if !self.functions.is_empty() {
            code.push_str("\n// Functions\n");
            for func in &self.functions {
                code.push_str(&func.generate_c());
                code.push_str("\n");
            }
        }

        // Main function
        code.push_str("\nvoid setup() {\n");
        code.push_str(&self.main_setup);
        code.push_str("\n}\n\n");

        code.push_str("void loop() {\n");
        code.push_str(&self.main_loop);
        code.push_str("\n}\n");

        code
    }
}

/// Code Generator from Block Diagram or State Machine
pub struct CodeGenerator {
    firmware: FirmwareCode,
}

impl CodeGenerator {
    pub fn new(target: McuTarget) -> Self {
        CodeGenerator {
            firmware: FirmwareCode::new(target),
        }
    }

    /// Generate code for GPIO control
    pub fn gen_gpio_init(&mut self, port: &str, pin: u8, mode: &str) {
        match self.firmware.target {
            McuTarget::Arduino | McuTarget::Esp32 => {
                self.firmware.main_setup.push_str(&format!(
                    "  pinMode({}, {});\n",
                    pin, mode
                ));
            }
            _ => {
                self.firmware.main_setup.push_str(&format!(
                    "  // Initialize GPIO {} pin {}\n",
                    port, pin
                ));
            }
        }
    }

    /// Generate code for PWM output
    pub fn gen_pwm_init(&mut self, pin: u8, frequency_hz: u16, duty_percent: u8) {
        match self.firmware.target {
            McuTarget::Arduino | McuTarget::Esp32 => {
                self.firmware.main_setup.push_str(&format!(
                    "  // PWM at {} Hz, {}% duty\n",
                    frequency_hz, duty_percent
                ));
                self.firmware.main_setup.push_str(&format!(
                    "  pinMode({}, OUTPUT);\n",
                    pin
                ));
            }
            _ => {
                self.firmware.main_setup.push_str(&format!(
                    "  // Initialize PWM on pin {} at {} Hz\n",
                    pin, frequency_hz
                ));
            }
        }
    }

    /// Generate code for ADC reading
    pub fn gen_adc_read(&mut self, channel: u8) -> String {
        match self.firmware.target {
            McuTarget::Arduino | McuTarget::Esp32 => {
                format!("analogRead(A{})", channel)
            }
            _ => {
                format!("ADC_Read_Channel({})", channel)
            }
        }
    }

    /// Generate interrupt handler code
    pub fn gen_interrupt_handler(&mut self, interrupt_name: &str, body: &str) {
        let mut func = FunctionDef::new(interrupt_name);
        func = func
            .with_return_type("void")
            .with_body(body)
            .mark_interrupt();
        self.firmware.add_function(func);
    }

    /// Generate control loop code
    pub fn gen_control_loop(&mut self, loop_code: &str) {
        self.firmware.set_loop(loop_code);
    }

    /// Get generated firmware
    pub fn get_firmware(&self) -> &FirmwareCode {
        &self.firmware
    }

    /// Generate final C code
    pub fn generate_c(&self) -> String {
        self.firmware.generate_c()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_def() {
        let func = FunctionDef::new("setup")
            .with_body("  // Initialize hardware")
            .with_return_type("void");

        let code = func.generate_c();
        assert!(code.contains("setup"));
        assert!(code.contains("// Initialize hardware"));
    }

    #[test]
    fn test_firmware_code_generation() {
        let fw = FirmwareCode::new(McuTarget::Arduino);
        let code = fw.generate_c();

        assert!(code.contains("#include <Arduino.h>"));
        assert!(code.contains("setup"));
        assert!(code.contains("void loop()"));
    }

    #[test]
    fn test_code_generator() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_gpio_init("GPIOA", 5, "OUTPUT");
        gen.gen_control_loop("  digitalWrite(5, HIGH);\n  delay(1000);");

        let code = gen.generate_c();
        assert!(code.contains("digitalWrite"));
        assert!(code.contains("delay"));
    }

    #[test]
    fn test_pwm_code_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_pwm_init(3, 1000, 50);

        let code = gen.generate_c();
        assert!(code.contains("PWM"));
        assert!(code.contains("1000"));
    }

    #[test]
    fn test_adc_code_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        let read_code = gen.gen_adc_read(0);

        assert_eq!(read_code, "analogRead(A0)");
    }

    #[test]
    fn test_interrupt_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_interrupt_handler("Timer1_ISR", "  // ISR body");

        let code = gen.generate_c();
        assert!(code.contains("Timer1_ISR"));
        assert!(code.contains("interrupt"));
    }

    #[test]
    fn test_mcu_target_properties() {
        assert_eq!(McuTarget::Arduino.clock_frequency_hz(), 16_000_000);
        assert_eq!(McuTarget::Esp32.clock_frequency_hz(), 240_000_000);
        assert_eq!(McuTarget::Stm32f103.hal_prefix(), "STM32F1xx");
    }

    #[test]
    fn test_multiple_includes() {
        let mut fw = FirmwareCode::new(McuTarget::Arduino);
        fw.add_include("#include <SPI.h>");
        fw.add_include("#include <Wire.h>");

        let code = fw.generate_c();
        assert!(code.contains("SPI.h"));
        assert!(code.contains("Wire.h"));
    }

    #[test]
    fn test_defines_generation() {
        let mut fw = FirmwareCode::new(McuTarget::Arduino);
        fw.add_define("LED_PIN", "13");
        fw.add_define("BAUD_RATE", "9600");

        let code = fw.generate_c();
        assert!(code.contains("#define LED_PIN 13"));
        assert!(code.contains("#define BAUD_RATE 9600"));
    }

    #[test]
    fn test_global_variables() {
        let mut fw = FirmwareCode::new(McuTarget::Arduino);
        fw.add_global("volatile uint32_t timer_ticks = 0;");
        fw.add_global("uint8_t led_state = 0;");

        let code = fw.generate_c();
        assert!(code.contains("timer_ticks"));
        assert!(code.contains("led_state"));
    }

    #[test]
    fn test_function_with_parameters() {
        let func = FunctionDef::new("blink")
            .with_return_type("void")
            .with_parameter("uint8_t", "pin")
            .with_parameter("uint16_t", "duration_ms")
            .with_body("  digitalWrite(pin, HIGH);\n  delay(duration_ms);");

        let code = func.generate_c();
        assert!(code.contains("uint8_t pin"));
        assert!(code.contains("uint16_t duration_ms"));
    }
}
