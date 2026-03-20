//! GPIO (General Purpose I/O) Peripheral
//!
//! Supports input/output modes, pull-up/pull-down, and interrupt generation

use serde::{Deserialize, Serialize};

/// GPIO Pin Mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PinMode {
    Input,        // High-impedance input
    Output,       // Push-pull output
    OpenDrain,    // Open-drain output (external pull-up required)
    Analog,       // Analog input (for ADC)
    Alternate,    // Alternate function (SPI, UART, etc.)
}

/// GPIO Pull Configuration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PullMode {
    None,      // No pull-up or pull-down
    PullUp,    // Pull-up resistor enabled
    PullDown,  // Pull-down resistor enabled
}

/// GPIO Speed (slew rate)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Speed {
    Low,       // < 2 MHz
    Medium,    // < 10 MHz
    High,      // < 50 MHz
    VeryHigh,  // < 100 MHz
}

/// GPIO Pin Configuration
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GpioPin {
    pub pin_number: u8,           // 0-15 (typically)
    pub mode: PinMode,            // Input, Output, Analog, etc.
    pub pull: PullMode,           // Pull configuration
    pub speed: Speed,             // Output speed
    pub output_state: bool,       // Current output level (for output pins)
    pub input_state: bool,        // Current input level (for input pins)
    pub interrupt_enabled: bool,  // Enable interrupt on change
    pub interrupt_edge: u8,       // 0: disabled, 1: rising, 2: falling, 3: both
}

impl GpioPin {
    /// Create a new GPIO pin with default configuration
    pub fn new(pin_number: u8) -> Self {
        GpioPin {
            pin_number,
            mode: PinMode::Input,
            pull: PullMode::None,
            speed: Speed::Low,
            output_state: false,
            input_state: false,
            interrupt_enabled: false,
            interrupt_edge: 0,
        }
    }

    /// Set pin to output mode
    pub fn set_output(&mut self) {
        self.mode = PinMode::Output;
    }

    /// Set pin to input mode
    pub fn set_input(&mut self) {
        self.mode = PinMode::Input;
    }

    /// Set output level (only works in output mode)
    pub fn set_level(&mut self, level: bool) {
        if self.mode == PinMode::Output || self.mode == PinMode::OpenDrain {
            self.output_state = level;
        }
    }

    /// Get output level
    pub fn get_level(&self) -> bool {
        if self.mode == PinMode::Input {
            self.input_state
        } else {
            self.output_state
        }
    }

    /// Set input level (simulating external input)
    pub fn set_input_level(&mut self, level: bool) {
        if self.mode == PinMode::Input || self.mode == PinMode::Analog {
            self.input_state = level;
        }
    }

    /// Check if interrupt should be triggered
    pub fn check_interrupt(&self, old_level: bool, new_level: bool) -> bool {
        if !self.interrupt_enabled {
            return false;
        }

        match self.interrupt_edge {
            1 => new_level && !old_level,      // Rising edge
            2 => !new_level && old_level,      // Falling edge
            3 => new_level != old_level,       // Both edges
            _ => false,
        }
    }
}

/// GPIO Port (16 pins per port, typically)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpioPort {
    pub port_name: String,        // "GPIOA", "GPIOB", etc.
    pub pins: [GpioPin; 16],      // Pins 0-15
}

impl GpioPort {
    /// Create a new GPIO port
    pub fn new(port_name: &str) -> Self {
        let mut pins = [GpioPin::new(0); 16];
        for i in 0..16 {
            pins[i] = GpioPin::new(i as u8);
        }

        GpioPort {
            port_name: port_name.to_string(),
            pins,
        }
    }

    /// Get pin by number
    pub fn get_pin(&self, pin: u8) -> Option<&GpioPin> {
        if pin < 16 {
            Some(&self.pins[pin as usize])
        } else {
            None
        }
    }

    /// Get mutable pin by number
    pub fn get_pin_mut(&mut self, pin: u8) -> Option<&mut GpioPin> {
        if pin < 16 {
            Some(&mut self.pins[pin as usize])
        } else {
            None
        }
    }

    /// Read all pins as 16-bit value
    pub fn read_pins(&self) -> u16 {
        let mut value: u16 = 0;
        for i in 0..16 {
            if self.pins[i].get_level() {
                value |= 1 << i;
            }
        }
        value
    }

    /// Write all pins from 16-bit value
    pub fn write_pins(&mut self, value: u16) {
        for i in 0..16 {
            if let Some(pin) = self.get_pin_mut(i as u8) {
                pin.set_level((value & (1 << i)) != 0);
            }
        }
    }

    /// Check for interrupts on any pin and return interrupt mask
    pub fn check_interrupts(&self, old_values: u16, new_values: u16) -> u16 {
        let mut interrupt_mask: u16 = 0;

        for i in 0..16 {
            let old_bit = (old_values >> i) & 1 != 0;
            let new_bit = (new_values >> i) & 1 != 0;

            if self.pins[i].check_interrupt(old_bit, new_bit) {
                interrupt_mask |= 1 << i;
            }
        }

        interrupt_mask
    }
}

impl Default for GpioPort {
    fn default() -> Self {
        Self::new("GPIO")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpio_pin_creation() {
        let pin = GpioPin::new(5);
        assert_eq!(pin.pin_number, 5);
        assert_eq!(pin.mode, PinMode::Input);
        assert_eq!(pin.pull, PullMode::None);
    }

    #[test]
    fn test_gpio_pin_output() {
        let mut pin = GpioPin::new(0);
        pin.set_output();
        pin.set_level(true);

        assert_eq!(pin.mode, PinMode::Output);
        assert!(pin.get_level());
    }

    #[test]
    fn test_gpio_pin_input() {
        let mut pin = GpioPin::new(0);
        pin.set_input();
        pin.set_input_level(true);

        assert_eq!(pin.mode, PinMode::Input);
        assert!(pin.get_level());
    }

    #[test]
    fn test_gpio_port_creation() {
        let port = GpioPort::new("GPIOA");
        assert_eq!(port.port_name, "GPIOA");
        assert_eq!(port.pins.len(), 16);
    }

    #[test]
    fn test_gpio_port_read_write() {
        let mut port = GpioPort::new("GPIOB");

        // Set pins 0, 2, 4 to output and set levels
        for pin_num in [0, 2, 4].iter() {
            if let Some(pin) = port.get_pin_mut(*pin_num) {
                pin.set_output();
                pin.set_level(true);
            }
        }

        // Read all pins
        let value = port.read_pins();
        assert_eq!(value, 0b00010101); // Pins 0, 2, 4 are set
    }

    #[test]
    fn test_gpio_port_write() {
        let mut port = GpioPort::new("GPIOC");

        // Set all pins to output
        for pin in &mut port.pins {
            pin.set_output();
        }

        // Write value 0xABCD
        port.write_pins(0xABCD);

        let value = port.read_pins();
        assert_eq!(value, 0xABCD);
    }

    #[test]
    fn test_gpio_interrupt_rising_edge() {
        let mut pin = GpioPin::new(0);
        pin.set_input();
        pin.interrupt_enabled = true;
        pin.interrupt_edge = 1; // Rising edge

        // Simulate rising edge: 0 -> 1
        assert!(pin.check_interrupt(false, true));

        // No interrupt for 1 -> 1
        assert!(!pin.check_interrupt(true, true));

        // No interrupt for 1 -> 0
        assert!(!pin.check_interrupt(true, false));
    }

    #[test]
    fn test_gpio_interrupt_falling_edge() {
        let mut pin = GpioPin::new(0);
        pin.set_input();
        pin.interrupt_enabled = true;
        pin.interrupt_edge = 2; // Falling edge

        // Simulate falling edge: 1 -> 0
        assert!(pin.check_interrupt(true, false));

        // No interrupt for 0 -> 0
        assert!(!pin.check_interrupt(false, false));

        // No interrupt for 0 -> 1
        assert!(!pin.check_interrupt(false, true));
    }

    #[test]
    fn test_gpio_interrupt_both_edges() {
        let mut pin = GpioPin::new(0);
        pin.set_input();
        pin.interrupt_enabled = true;
        pin.interrupt_edge = 3; // Both edges

        // Rising edge
        assert!(pin.check_interrupt(false, true));

        // Falling edge
        assert!(pin.check_interrupt(true, false));

        // No change
        assert!(!pin.check_interrupt(true, true));
    }

    #[test]
    fn test_gpio_port_interrupts() {
        let mut port = GpioPort::new("GPIOD");

        // Enable interrupts on pins 0, 4, 8
        for pin_num in [0, 4, 8].iter() {
            if let Some(pin) = port.get_pin_mut(*pin_num) {
                pin.set_input();
                pin.interrupt_enabled = true;
                pin.interrupt_edge = 1; // Rising edge
            }
        }

        // Simulate rising edge on pins 0, 4, 8
        let old_value = 0x0000;
        let new_value = 0x0111; // Pins 0, 4, 8 high

        let interrupt_mask = port.check_interrupts(old_value, new_value);
        assert_eq!(interrupt_mask, 0x0111);
    }

    #[test]
    fn test_gpio_pull_configuration() {
        let mut pin = GpioPin::new(0);
        pin.set_input();
        pin.pull = PullMode::PullUp;

        assert_eq!(pin.pull, PullMode::PullUp);

        pin.pull = PullMode::PullDown;
        assert_eq!(pin.pull, PullMode::PullDown);
    }
}
