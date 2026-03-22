//! Board Configuration Templates
//!
//! Standardized definitions for popular microcontroller boards
//! (Arduino, STM32, ESP32) used by code generation and HAL support

use serde::{Deserialize, Serialize};

/// Target microcontroller type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum McuTarget {
    Arduino,     // ATmega328P (Uno, Nano)
    ArduinoMega, // ATmega2560 (Mega)
    Stm32f103,   // Blue Pill
    Stm32f401,   // Nucleo
    Stm32l476,   // Low-power STM32L4 series
    Esp32,       // ESP32-DevKit
}

impl McuTarget {
    pub fn name(&self) -> &str {
        match self {
            McuTarget::Arduino => "Arduino Uno",
            McuTarget::ArduinoMega => "Arduino Mega",
            McuTarget::Stm32f103 => "STM32F103 (Blue Pill)",
            McuTarget::Stm32f401 => "STM32F401 (Nucleo)",
            McuTarget::Stm32l476 => "STM32L476 (Low-Power)",
            McuTarget::Esp32 => "ESP32-DevKit",
        }
    }

    pub fn platformio_board(&self) -> &str {
        match self {
            McuTarget::Arduino => "uno",
            McuTarget::ArduinoMega => "megaatmega2560",
            McuTarget::Stm32f103 => "bluepill_f103c8",
            McuTarget::Stm32f401 => "nucleo_f401re",
            McuTarget::Stm32l476 => "disco_l476vg",
            McuTarget::Esp32 => "esp32doit-devkit-v1",
        }
    }

    pub fn platformio_platform(&self) -> &str {
        match self {
            McuTarget::Arduino | McuTarget::ArduinoMega => "atmelavr",
            McuTarget::Stm32f103 | McuTarget::Stm32f401 | McuTarget::Stm32l476 => "ststm32",
            McuTarget::Esp32 => "espressif32",
        }
    }

    /// Get HAL prefix for code generation
    pub fn hal_prefix(&self) -> &'static str {
        match self {
            McuTarget::Stm32f103 => "STM32F1xx",
            McuTarget::Stm32f401 => "STM32F4xx",
            McuTarget::Stm32l476 => "STM32L4xx",
            McuTarget::Arduino | McuTarget::ArduinoMega => "Arduino",
            McuTarget::Esp32 => "ESP32",
        }
    }

    /// Get clock frequency in Hz
    pub fn clock_frequency_hz(&self) -> u32 {
        match self {
            McuTarget::Stm32f103 => 72_000_000,
            McuTarget::Stm32f401 => 84_000_000,
            McuTarget::Stm32l476 => 80_000_000,
            McuTarget::Arduino => 16_000_000,
            McuTarget::ArduinoMega => 16_000_000,
            McuTarget::Esp32 => 240_000_000,
        }
    }
}

/// GPIO Port Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpioPortConfig {
    pub name: String,
    pub pins: u8,
    pub base_address: u32,
}

/// ADC Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdcConfig {
    pub channels: u8,
    pub resolution: u8,  // 8, 10, 12, 16
    pub reference_voltage: f64,
}

/// Timer Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerConfig {
    pub timer_id: u8,
    pub channels: u8,
    pub max_value: u32,
    pub has_pwm: bool,
}

/// Complete Board Template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardTemplate {
    pub mcu_target: McuTarget,
    pub name: &'static str,
    pub mcu_name: &'static str,
    pub flash_kb: usize,
    pub sram_kb: usize,
    pub eeprom_kb: usize,
    pub clock_mhz: u32,
    pub gpio_ports: Vec<GpioPortConfig>,
    pub adc_config: AdcConfig,
    pub timers: Vec<TimerConfig>,
    pub uart_count: u8,
    pub spi_count: u8,
    pub i2c_count: u8,
    pub pin_mappings: PinMappings,
}

/// Pin Mappings for Common Peripherals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinMappings {
    pub digital_pins: Vec<DigitalPin>,
    pub adc_pins: Vec<AdcPin>,
    pub pwm_pins: Vec<PwmPin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigitalPin {
    pub pin: u8,
    pub port: char,
    pub pin_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdcPin {
    pub channel: u8,
    pub arduino_pin: Option<u8>,
    pub port_pin: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PwmPin {
    pub pin: u8,
    pub port: char,
    pub timer: u8,
    pub channel: u8,
    pub frequency_hz: u32,
}

impl BoardTemplate {
    /// Arduino Uno (ATmega328P)
    pub fn arduino_uno() -> Self {
        BoardTemplate {
            mcu_target: McuTarget::Arduino,
            name: "Arduino Uno",
            mcu_name: "ATmega328P",
            flash_kb: 32,
            sram_kb: 2,
            eeprom_kb: 1,
            clock_mhz: 16,
            gpio_ports: vec![
                GpioPortConfig {
                    name: "PORTB".to_string(),
                    pins: 8,
                    base_address: 0x23,
                },
                GpioPortConfig {
                    name: "PORTC".to_string(),
                    pins: 7,
                    base_address: 0x26,
                },
                GpioPortConfig {
                    name: "PORTD".to_string(),
                    pins: 8,
                    base_address: 0x29,
                },
            ],
            adc_config: AdcConfig {
                channels: 6,
                resolution: 10,
                reference_voltage: 5.0,
            },
            timers: vec![
                TimerConfig {
                    timer_id: 0,
                    channels: 1,
                    max_value: 256,
                    has_pwm: false,
                },
                TimerConfig {
                    timer_id: 1,
                    channels: 2,
                    max_value: 65535,
                    has_pwm: true,
                },
                TimerConfig {
                    timer_id: 2,
                    channels: 1,
                    max_value: 256,
                    has_pwm: true,
                },
            ],
            uart_count: 1,
            spi_count: 1,
            i2c_count: 1,
            pin_mappings: PinMappings {
                digital_pins: vec![
                    DigitalPin {
                        pin: 0,
                        port: 'D',
                        pin_name: "PD0 (RXD)".to_string(),
                    },
                    DigitalPin {
                        pin: 1,
                        port: 'D',
                        pin_name: "PD1 (TXD)".to_string(),
                    },
                    DigitalPin {
                        pin: 2,
                        port: 'D',
                        pin_name: "PD2 (INT0)".to_string(),
                    },
                    DigitalPin {
                        pin: 3,
                        port: 'D',
                        pin_name: "PD3 (INT1/PWM)".to_string(),
                    },
                ],
                adc_pins: vec![
                    AdcPin {
                        channel: 0,
                        arduino_pin: Some(14),
                        port_pin: "PC0".to_string(),
                    },
                    AdcPin {
                        channel: 1,
                        arduino_pin: Some(15),
                        port_pin: "PC1".to_string(),
                    },
                ],
                pwm_pins: vec![
                    PwmPin {
                        pin: 3,
                        port: 'D',
                        timer: 2,
                        channel: 1,
                        frequency_hz: 490,
                    },
                    PwmPin {
                        pin: 5,
                        port: 'D',
                        timer: 0,
                        channel: 1,
                        frequency_hz: 490,
                    },
                    PwmPin {
                        pin: 6,
                        port: 'D',
                        timer: 0,
                        channel: 2,
                        frequency_hz: 490,
                    },
                ],
            },
        }
    }

    /// Arduino Mega (ATmega2560)
    pub fn arduino_mega() -> Self {
        BoardTemplate {
            mcu_target: McuTarget::ArduinoMega,
            name: "Arduino Mega",
            mcu_name: "ATmega2560",
            flash_kb: 256,
            sram_kb: 8,
            eeprom_kb: 4,
            clock_mhz: 16,
            gpio_ports: vec![
                GpioPortConfig {
                    name: "PORTA".to_string(),
                    pins: 8,
                    base_address: 0x20,
                },
                GpioPortConfig {
                    name: "PORTB".to_string(),
                    pins: 8,
                    base_address: 0x23,
                },
                GpioPortConfig {
                    name: "PORTC".to_string(),
                    pins: 8,
                    base_address: 0x26,
                },
            ],
            adc_config: AdcConfig {
                channels: 16,
                resolution: 10,
                reference_voltage: 5.0,
            },
            timers: vec![
                TimerConfig {
                    timer_id: 0,
                    channels: 1,
                    max_value: 256,
                    has_pwm: false,
                },
                TimerConfig {
                    timer_id: 1,
                    channels: 2,
                    max_value: 65535,
                    has_pwm: true,
                },
                TimerConfig {
                    timer_id: 2,
                    channels: 1,
                    max_value: 256,
                    has_pwm: true,
                },
            ],
            uart_count: 4,
            spi_count: 1,
            i2c_count: 1,
            pin_mappings: PinMappings {
                digital_pins: vec![],
                adc_pins: vec![],
                pwm_pins: vec![],
            },
        }
    }

    /// STM32F103 Blue Pill
    pub fn stm32f103_bluepill() -> Self {
        BoardTemplate {
            mcu_target: McuTarget::Stm32f103,
            name: "STM32F103 (Blue Pill)",
            mcu_name: "STM32F103C8T6",
            flash_kb: 64,
            sram_kb: 20,
            eeprom_kb: 0,
            clock_mhz: 72,
            gpio_ports: vec![
                GpioPortConfig {
                    name: "GPIOA".to_string(),
                    pins: 16,
                    base_address: 0x40010800,
                },
                GpioPortConfig {
                    name: "GPIOB".to_string(),
                    pins: 16,
                    base_address: 0x40010C00,
                },
                GpioPortConfig {
                    name: "GPIOC".to_string(),
                    pins: 16,
                    base_address: 0x40011000,
                },
            ],
            adc_config: AdcConfig {
                channels: 16,
                resolution: 12,
                reference_voltage: 3.3,
            },
            timers: vec![
                TimerConfig {
                    timer_id: 1,
                    channels: 4,
                    max_value: 65535,
                    has_pwm: true,
                },
                TimerConfig {
                    timer_id: 2,
                    channels: 4,
                    max_value: 65535,
                    has_pwm: true,
                },
            ],
            uart_count: 3,
            spi_count: 2,
            i2c_count: 2,
            pin_mappings: PinMappings {
                digital_pins: vec![],
                adc_pins: vec![],
                pwm_pins: vec![],
            },
        }
    }

    /// ESP32-DevKit
    pub fn esp32_devkit() -> Self {
        BoardTemplate {
            mcu_target: McuTarget::Esp32,
            name: "ESP32-DevKit",
            mcu_name: "ESP32-WROOM-32",
            flash_kb: 4096,
            sram_kb: 520,
            eeprom_kb: 0,
            clock_mhz: 240,
            gpio_ports: vec![
                GpioPortConfig {
                    name: "GPIO".to_string(),
                    pins: 40,
                    base_address: 0x3FF44000,
                },
            ],
            adc_config: AdcConfig {
                channels: 18,
                resolution: 12,
                reference_voltage: 3.3,
            },
            timers: vec![
                TimerConfig {
                    timer_id: 0,
                    channels: 4,
                    max_value: u32::MAX,
                    has_pwm: true,
                },
            ],
            uart_count: 3,
            spi_count: 4,
            i2c_count: 2,
            pin_mappings: PinMappings {
                digital_pins: vec![],
                adc_pins: vec![],
                pwm_pins: vec![],
            },
        }
    }

    /// Get board template by MCU target
    pub fn from_target(target: McuTarget) -> Self {
        match target {
            McuTarget::Arduino => Self::arduino_uno(),
            McuTarget::ArduinoMega => Self::arduino_mega(),
            McuTarget::Stm32f103 => Self::stm32f103_bluepill(),
            McuTarget::Stm32f401 => Self::stm32f103_bluepill(), // Fallback to similar
            McuTarget::Stm32l476 => Self::stm32f103_bluepill(), // Fallback to similar
            McuTarget::Esp32 => Self::esp32_devkit(),
        }
    }

    /// Get ADC reference voltage in millivolts
    pub fn adc_reference_mv(&self) -> u32 {
        (self.adc_config.reference_voltage * 1000.0) as u32
    }

    /// Get ADC maximum value based on resolution
    pub fn adc_max_value(&self) -> u32 {
        (1 << self.adc_config.resolution) - 1
    }

    /// Get all available board templates
    pub fn all_templates() -> Vec<Self> {
        vec![
            Self::arduino_uno(),
            Self::arduino_mega(),
            Self::stm32f103_bluepill(),
            Self::esp32_devkit(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arduino_uno_specs() {
        let board = BoardTemplate::arduino_uno();
        assert_eq!(board.flash_kb, 32);
        assert_eq!(board.sram_kb, 2);
        assert_eq!(board.clock_mhz, 16);
        assert_eq!(board.adc_config.channels, 6);
        assert_eq!(board.adc_config.resolution, 10);
        assert_eq!(board.adc_max_value(), 1023);
    }

    #[test]
    fn test_stm32f103_specs() {
        let board = BoardTemplate::stm32f103_bluepill();
        assert_eq!(board.flash_kb, 64);
        assert_eq!(board.sram_kb, 20);
        assert_eq!(board.clock_mhz, 72);
        assert_eq!(board.adc_config.channels, 16);
        assert_eq!(board.adc_config.resolution, 12);
        assert_eq!(board.adc_reference_mv(), 3300);
    }

    #[test]
    fn test_esp32_specs() {
        let board = BoardTemplate::esp32_devkit();
        assert_eq!(board.flash_kb, 4096);
        assert_eq!(board.sram_kb, 520);
        assert_eq!(board.clock_mhz, 240);
        assert_eq!(board.uart_count, 3);
    }

    #[test]
    fn test_platformio_config() {
        let arduino = BoardTemplate::arduino_uno();
        assert_eq!(arduino.mcu_target.platformio_board(), "uno");
        assert_eq!(arduino.mcu_target.platformio_platform(), "atmelavr");

        let stm32 = BoardTemplate::stm32f103_bluepill();
        assert_eq!(stm32.mcu_target.platformio_board(), "bluepill_f103c8");
        assert_eq!(stm32.mcu_target.platformio_platform(), "ststm32");

        let esp32 = BoardTemplate::esp32_devkit();
        assert_eq!(esp32.mcu_target.platformio_board(), "esp32doit-devkit-v1");
        assert_eq!(esp32.mcu_target.platformio_platform(), "espressif32");
    }

    #[test]
    fn test_from_target() {
        let arduino = BoardTemplate::from_target(McuTarget::Arduino);
        assert_eq!(arduino.flash_kb, 32);

        let esp32 = BoardTemplate::from_target(McuTarget::Esp32);
        assert_eq!(esp32.flash_kb, 4096);
    }

    #[test]
    fn test_all_templates() {
        let templates = BoardTemplate::all_templates();
        assert_eq!(templates.len(), 4);
    }
}
