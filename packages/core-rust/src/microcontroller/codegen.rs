//! Firmware Code Generation
//!
//! Convert high-level designs (block diagrams, state machines) into C/C++ firmware code

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::board_templates::McuTarget;

/// Format a float for C code without trailing zeros
fn format_float(value: f32) -> String {
    let formatted = format!("{:.4}", value);
    let trimmed = formatted.trim_end_matches('0').trim_end_matches('.');
    format!("{}f", trimmed)
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
        let mut defines = HashMap::new();

        match target {
            McuTarget::Stm32f103 | McuTarget::Stm32f401 | McuTarget::Stm32l476 => {
                includes.push("#include \"stm32xx_hal.h\"".to_string());
                defines.insert("HAL_TARGET".to_string(), target.hal_prefix().to_string());
            }
            McuTarget::Arduino | McuTarget::ArduinoMega => {
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
            defines,
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
            McuTarget::Arduino | McuTarget::ArduinoMega | McuTarget::Esp32 => {
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
            McuTarget::Arduino | McuTarget::ArduinoMega | McuTarget::Esp32 => {
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
            McuTarget::Arduino | McuTarget::ArduinoMega | McuTarget::Esp32 => {
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

    // ========== Block-Specific Code Generators ==========

    /// Generate PID controller block
    /// Parameters: kp, ki, kd, sample_time_ms
    pub fn gen_pid_block(
        &mut self,
        block_name: &str,
        kp: f32,
        ki: f32,
        kd: f32,
        sample_time_ms: u16,
    ) {
        // Add PID state variables
        self.firmware
            .add_global(&format!("float {}_error_integral = 0.0;", block_name));
        self.firmware
            .add_global(&format!("float {}_error_prev = 0.0;", block_name));
        self.firmware.add_define(
            &format!("{}_KP", block_name),
            &format_float(kp),
        );
        self.firmware.add_define(
            &format!("{}_KI", block_name),
            &format_float(ki),
        );
        self.firmware.add_define(
            &format!("{}_KD", block_name),
            &format_float(kd),
        );
        self.firmware.add_define(
            &format!("{}_DT", block_name),
            &format!("{} / 1000.0f", sample_time_ms),
        );

        // Add PID computation function
        let pid_func = FunctionDef::new(&format!("compute_{}", block_name))
            .with_return_type("float")
            .with_parameter("float", "setpoint")
            .with_parameter("float", "feedback")
            .with_body(&format!(
                "  float error = setpoint - feedback;
  {}_error_integral += error * {}_DT;
  float error_derivative = (error - {}_error_prev) / {}_DT;
  {}_error_prev = error;

  float output = {}_KP * error
               + {}_KI * {}_error_integral
               + {}_KD * error_derivative;

  // Anti-windup: clamp integral term
  if ({}_error_integral > 100.0f) {}_error_integral = 100.0f;
  if ({}_error_integral < -100.0f) {}_error_integral = -100.0f;

  return output;",
                block_name, block_name, block_name, block_name, block_name,
                block_name, block_name, block_name, block_name,
                block_name, block_name, block_name, block_name
            ));

        self.firmware.add_function(pid_func);
    }

    /// Generate low-pass filter block
    /// Parameters: cutoff_hz, sample_rate_hz
    pub fn gen_lowpass_filter_block(
        &mut self,
        block_name: &str,
        cutoff_hz: u16,
        sample_rate_hz: u16,
    ) {
        // Calculate alpha using: alpha = fc / (fs/2*pi + fc)
        let cutoff_rad = 2.0 * std::f32::consts::PI * cutoff_hz as f32;
        let sample_period = 1.0 / sample_rate_hz as f32;
        let alpha = cutoff_rad * sample_period / (1.0 + cutoff_rad * sample_period);

        self.firmware.add_global(&format!(
            "float {}_filtered_value = 0.0;",
            block_name
        ));
        self.firmware.add_define(
            &format!("{}_ALPHA", block_name),
            &format!("{:.4}f", alpha),
        );

        // Add filter function
        let filter_func = FunctionDef::new(&format!("filter_{}", block_name))
            .with_return_type("float")
            .with_parameter("float", "raw_value")
            .with_body(&format!(
                "  {}_filtered_value = {}_ALPHA * raw_value + (1.0f - {}_ALPHA) * {}_filtered_value;
  return {}_filtered_value;",
                block_name, block_name, block_name, block_name, block_name
            ));

        self.firmware.add_function(filter_func);
    }

    /// Generate math operation block (add, multiply, divide, etc.)
    pub fn gen_math_block(&mut self, block_name: &str, operation: &str) {
        let body = match operation {
            "add" => "  return input1 + input2;",
            "subtract" => "  return input1 - input2;",
            "multiply" => "  return input1 * input2;",
            "divide" => "  if (input2 == 0.0f) return 0.0f;\n  return input1 / input2;",
            "square" => "  return input1 * input1;",
            "sqrt" => "  if (input1 < 0.0f) return 0.0f;\n  return sqrtf(input1);",
            "abs" => "  return fabsf(input1);",
            "negate" => "  return -input1;",
            "max" => "  return (input1 > input2) ? input1 : input2;",
            "min" => "  return (input1 < input2) ? input1 : input2;",
            _ => "  return input1;",
        };

        let params = if operation == "add" || operation == "subtract"
            || operation == "multiply" || operation == "divide"
            || operation == "max" || operation == "min"
        {
            vec![("float", "input1"), ("float", "input2")]
        } else {
            vec![("float", "input1")]
        };

        let mut func = FunctionDef::new(&format!("math_{}", block_name))
            .with_return_type("float")
            .with_body(body);

        for (param_type, param_name) in params {
            func = func.with_parameter(param_type, param_name);
        }

        self.firmware.add_function(func);
    }

    /// Generate ADC input block
    /// Parameters: channel, sample_count, reference_voltage
    pub fn gen_adc_input_block(
        &mut self,
        block_name: &str,
        channel: u8,
        sample_count: u8,
        reference_voltage: f32,
    ) {
        self.firmware.add_global(&format!(
            "uint32_t {}_raw_value = 0;",
            block_name
        ));
        self.firmware.add_define(
            &format!("{}_CHANNEL", block_name),
            &channel.to_string(),
        );
        self.firmware.add_define(
            &format!("{}_SAMPLES", block_name),
            &sample_count.to_string(),
        );
        self.firmware.add_define(
            &format!("{}_VREF", block_name),
            &format!("{:.2}f", reference_voltage),
        );

        let adc_func = FunctionDef::new(&format!("read_{}", block_name))
            .with_return_type("float")
            .with_body(&format!(
                "  uint32_t sum = 0;
  for (int i = 0; i < {}_SAMPLES; i++) {{
    sum += analogRead({}_CHANNEL);
  }}
  uint16_t avg = sum / {}_SAMPLES;
  {}_raw_value = avg;

  // Convert to voltage
  float voltage = (avg / 1023.0f) * {}_VREF;
  return voltage;",
                block_name, block_name, block_name, block_name, block_name
            ));

        self.firmware.add_function(adc_func);
    }

    /// Generate PWM output block
    /// Parameters: pin, frequency_hz, min_duty, max_duty
    pub fn gen_pwm_output_block(
        &mut self,
        block_name: &str,
        pin: u8,
        frequency_hz: u16,
        min_duty: u8,
        max_duty: u8,
    ) {
        self.firmware.add_define(
            &format!("{}_PIN", block_name),
            &pin.to_string(),
        );
        self.firmware.add_define(
            &format!("{}_FREQ", block_name),
            &frequency_hz.to_string(),
        );
        self.firmware.add_define(
            &format!("{}_MIN_DUTY", block_name),
            &min_duty.to_string(),
        );
        self.firmware.add_define(
            &format!("{}_MAX_DUTY", block_name),
            &max_duty.to_string(),
        );

        // Add PWM output function
        let pwm_func = FunctionDef::new(&format!("set_{}_pwm", block_name))
            .with_parameter("float", "duty_percent")
            .with_body(&format!(
                "  // Clamp to min/max duty cycle
  uint8_t duty = (uint8_t)duty_percent;
  if (duty < {}_MIN_DUTY) duty = {}_MIN_DUTY;
  if (duty > {}_MAX_DUTY) duty = {}_MAX_DUTY;

  // Write to PWM pin
  analogWrite({}_PIN, duty);",
                block_name, block_name, block_name, block_name, block_name
            ));

        self.firmware.add_function(pwm_func);

        // Add setup code for PWM initialization
        self.firmware.main_setup.push_str(&format!(
            "  // Initialize {} (PWM on pin {} at {}Hz)\n",
            block_name, pin, frequency_hz
        ));
        self.firmware.main_setup.push_str(&format!(
            "  pinMode({}_PIN, OUTPUT);\n",
            block_name
        ));
    }

    /// Generate saturation/clamping block
    /// Parameters: min_value, max_value
    pub fn gen_saturation_block(
        &mut self,
        block_name: &str,
        min_value: f32,
        max_value: f32,
    ) {
        self.firmware.add_define(
            &format!("{}_MIN", block_name),
            &format!("{:.2}f", min_value),
        );
        self.firmware.add_define(
            &format!("{}_MAX", block_name),
            &format!("{:.2}f", max_value),
        );

        let sat_func = FunctionDef::new(&format!("saturate_{}", block_name))
            .with_return_type("float")
            .with_parameter("float", "value")
            .with_body(&format!(
                "  if (value < {}_MIN) return {}_MIN;
  if (value > {}_MAX) return {}_MAX;
  return value;",
                block_name, block_name, block_name, block_name
            ));

        self.firmware.add_function(sat_func);
    }

    /// Generate delay/sleep block
    /// Parameters: delay_ms
    pub fn gen_delay_block(&mut self, delay_ms: u16) {
        self.firmware.main_loop.push_str(&format!(
            "  delay({});\n",
            delay_ms
        ));
    }

    /// Generate const value block
    pub fn gen_const_value_block(&mut self, block_name: &str, value: f32) {
        self.firmware.add_define(
            &format!("{}_VALUE", block_name),
            &format!("{:.4}f", value),
        );
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

    // ========== Block-Specific Tests ==========

    #[test]
    fn test_pid_block_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_pid_block("motor_pid", 2.0, 0.5, 0.1, 10);

        let code = gen.generate_c();
        assert!(code.contains("motor_pid_error_integral"));
        assert!(code.contains("motor_pid_error_prev"));
        assert!(code.contains("#define motor_pid_KP"));
        assert!(code.contains("compute_motor_pid"));
        assert!(code.contains("Anti-windup"));
    }

    #[test]
    fn test_lowpass_filter_block_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_lowpass_filter_block("sensor_filter", 10, 1000);

        let code = gen.generate_c();
        assert!(code.contains("sensor_filter_filtered_value"));
        assert!(code.contains("#define sensor_filter_ALPHA"));
        assert!(code.contains("filter_sensor_filter"));
    }

    #[test]
    fn test_math_add_block() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_math_block("sum_block", "add");

        let code = gen.generate_c();
        assert!(code.contains("math_sum_block"));
        assert!(code.contains("input1 + input2"));
    }

    #[test]
    fn test_math_multiply_block() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_math_block("mult_block", "multiply");

        let code = gen.generate_c();
        assert!(code.contains("math_mult_block"));
        assert!(code.contains("input1 * input2"));
    }

    #[test]
    fn test_math_divide_block() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_math_block("div_block", "divide");

        let code = gen.generate_c();
        assert!(code.contains("math_div_block"));
        assert!(code.contains("if (input2 == 0.0f)"));
    }

    #[test]
    fn test_math_sqrt_block() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_math_block("sqrt_block", "sqrt");

        let code = gen.generate_c();
        assert!(code.contains("sqrtf(input1)"));
    }

    #[test]
    fn test_math_min_max_blocks() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_math_block("max_block", "max");
        gen.gen_math_block("min_block", "min");

        let code = gen.generate_c();
        assert!(code.contains("math_max_block"));
        assert!(code.contains("math_min_block"));
        assert!(code.contains("input1 > input2"));
        assert!(code.contains("input1 < input2"));
    }

    #[test]
    fn test_adc_input_block_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_adc_input_block("analog_in", 0, 10, 5.0);

        let code = gen.generate_c();
        assert!(code.contains("analog_in_raw_value"));
        assert!(code.contains("#define analog_in_CHANNEL 0"));
        assert!(code.contains("#define analog_in_SAMPLES 10"));
        assert!(code.contains("#define analog_in_VREF 5.00f"));
        assert!(code.contains("read_analog_in"));
    }

    #[test]
    fn test_pwm_output_block_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_pwm_output_block("motor_pwm", 5, 1000, 0, 255);

        let code = gen.generate_c();
        assert!(code.contains("#define motor_pwm_PIN 5"));
        assert!(code.contains("#define motor_pwm_FREQ 1000"));
        assert!(code.contains("#define motor_pwm_MIN_DUTY 0"));
        assert!(code.contains("#define motor_pwm_MAX_DUTY 255"));
        assert!(code.contains("set_motor_pwm_pwm"));
        assert!(code.contains("analogWrite"));
    }

    #[test]
    fn test_saturation_block_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_saturation_block("output_sat", -100.0, 100.0);

        let code = gen.generate_c();
        assert!(code.contains("#define output_sat_MIN -100.00f"));
        assert!(code.contains("#define output_sat_MAX 100.00f"));
        assert!(code.contains("saturate_output_sat"));
    }

    #[test]
    fn test_delay_block_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_delay_block(100);

        let code = gen.generate_c();
        assert!(code.contains("delay(100)"));
    }

    #[test]
    fn test_const_value_block_generation() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_const_value_block("pi_const", 3.14159);

        let code = gen.generate_c();
        assert!(code.contains("#define pi_const_VALUE 3.1416f"));
    }

    #[test]
    fn test_combined_pid_and_filter_blocks() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);

        // Build ADC -> Filter -> PID -> PWM pipeline
        gen.gen_adc_input_block("sensor", 0, 5, 5.0);
        gen.gen_lowpass_filter_block("filter", 20, 1000);
        gen.gen_pid_block("controller", 1.5, 0.3, 0.1, 10);
        gen.gen_saturation_block("limiter", 0.0, 255.0);
        gen.gen_pwm_output_block("motor", 3, 1000, 0, 255);

        let code = gen.generate_c();

        // Verify all blocks are present
        assert!(code.contains("read_sensor"));
        assert!(code.contains("filter_filter"));
        assert!(code.contains("compute_controller"));
        assert!(code.contains("saturate_limiter"));
        assert!(code.contains("set_motor_pwm"));

        // Verify global variables for each block
        assert!(code.contains("sensor_raw_value"));
        assert!(code.contains("filter_filtered_value"));
        assert!(code.contains("controller_error_integral"));
        assert!(code.contains("motor_PIN"));
    }

    #[test]
    fn test_math_operations_comprehensive() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);

        // Test all math operations
        let operations = vec![
            "add", "subtract", "multiply", "divide",
            "square", "sqrt", "abs", "negate", "max", "min"
        ];

        for op in operations {
            gen.gen_math_block(&format!("op_{}", op), op);
        }

        let code = gen.generate_c();

        // Verify at least some operations are present
        assert!(code.contains("math_op_add"));
        assert!(code.contains("math_op_multiply"));
        assert!(code.contains("math_op_divide"));
        assert!(code.contains("sqrtf"));
        assert!(code.contains("fabsf"));
    }

    #[test]
    fn test_multiple_pwm_blocks() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);

        // Motor control with multiple PWM channels
        gen.gen_pwm_output_block("motor_left", 5, 1000, 0, 255);
        gen.gen_pwm_output_block("motor_right", 6, 1000, 0, 255);

        let code = gen.generate_c();

        assert!(code.contains("set_motor_left_pwm"));
        assert!(code.contains("set_motor_right_pwm"));
        assert!(code.contains("#define motor_left_PIN 5"));
        assert!(code.contains("#define motor_right_PIN 6"));
    }

    #[test]
    fn test_adc_with_different_sample_counts() {
        let mut gen1 = CodeGenerator::new(McuTarget::Arduino);
        let mut gen2 = CodeGenerator::new(McuTarget::Arduino);

        gen1.gen_adc_input_block("fast_adc", 0, 1, 5.0);
        gen2.gen_adc_input_block("accurate_adc", 1, 100, 5.0);

        let code1 = gen1.generate_c();
        let code2 = gen2.generate_c();

        assert!(code1.contains("#define fast_adc_SAMPLES 1"));
        assert!(code2.contains("#define accurate_adc_SAMPLES 100"));
    }

    #[test]
    fn test_pid_parameter_precision() {
        let mut gen = CodeGenerator::new(McuTarget::Arduino);
        gen.gen_pid_block("controller", 2.5, 0.125, 0.05, 5);

        let code = gen.generate_c();

        // Verify parameters are correctly formatted
        assert!(code.contains("#define controller_KP 2.5f"));
        assert!(code.contains("#define controller_KI 0.125f"));
        assert!(code.contains("#define controller_KD 0.05f"));
    }

    #[test]
    fn test_stm32_target_with_blocks() {
        let mut gen = CodeGenerator::new(McuTarget::Stm32f103);
        gen.gen_adc_input_block("sensor", 0, 10, 3.3);
        gen.gen_pwm_output_block("motor", 1, 20000, 0, 255);

        let code = gen.generate_c();

        // Verify STM32-specific includes
        assert!(code.contains("STM32F1xx"));
        assert!(code.contains("stm32xx_hal"));

        // Verify blocks are still generated correctly
        assert!(code.contains("read_sensor"));
        assert!(code.contains("set_motor_pwm"));
    }

    #[test]
    fn test_esp32_target_with_blocks() {
        let mut gen = CodeGenerator::new(McuTarget::Esp32);
        gen.gen_adc_input_block("analog_in", 2, 5, 3.3);

        let code = gen.generate_c();

        // Verify ESP32-specific includes
        assert!(code.contains("WiFi.h"));
        assert!(code.contains("Arduino.h"));

        // Verify ADC block works
        assert!(code.contains("read_analog_in"));
    }
}
