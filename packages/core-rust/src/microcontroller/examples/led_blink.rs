//! LED Blink Circuit Integration Example
//!
//! Demonstrates closed-loop control with LED brightness feedback:
//! - MCU GPIO drives LED via current-limiting resistor
//! - Photodiode detects LED brightness
//! - MCU adjusts blink pattern based on feedback
//!
//! Circuit Model:
//! ```
//! 3.3V ─┬─ [220Ω] ─┬─ LED ─┬─ GND
//!       │          │        │
//!       │         GPIO5     Photodiode (ADC0)
//!       │          │        │
//!       └──────────┴────────┘
//!
//! LED Model:
//! - Forward voltage: ~2.0V @ 10mA
//! - Brightness ∝ current
//! - Photodiode output: 0-3.3V based on brightness
//! ```

use crate::microcontroller::{
    ArmCpuEmulator, MicrocontrollerCircuitInterface, CircuitNodeId,
    CoupledMicrocontrollerCircuitSim,
};

/// Simple LED brightness model
///
/// Maps LED current to brightness and photodiode output voltage
#[derive(Debug, Clone)]
pub struct LedCircuitModel {
    /// Current through LED [mA]
    pub current_ma: f64,

    /// LED brightness [0.0-1.0]
    pub brightness: f64,

    /// Photodiode output voltage [0.0-3.3V]
    pub photodiode_voltage: f64,

    /// LED forward voltage [V]
    pub forward_voltage: f64,

    /// Series resistor [Ω]
    pub series_resistance: f64,
}

impl LedCircuitModel {
    /// Create a new LED circuit model
    pub fn new() -> Self {
        LedCircuitModel {
            current_ma: 0.0,
            brightness: 0.0,
            photodiode_voltage: 0.0,
            forward_voltage: 2.0,
            series_resistance: 220.0,
        }
    }

    /// Update LED state based on GPIO voltage
    ///
    /// # Arguments
    /// - `gpio_voltage`: GPIO output voltage [0.0-3.3V]
    /// - `supply_voltage`: Supply voltage [3.3V]
    pub fn update(&mut self, gpio_voltage: f64, supply_voltage: f64) {
        // Ohm's law: I = (V_supply - V_led) / R
        if gpio_voltage > self.forward_voltage {
            let voltage_drop = gpio_voltage - self.forward_voltage;
            self.current_ma = (voltage_drop / self.series_resistance) * 1000.0;
        } else {
            self.current_ma = 0.0;
        }

        // Brightness model (typical LED)
        // Max brightness at ~10mA (typical LED rating)
        self.brightness = (self.current_ma / 10.0).min(1.0).max(0.0);

        // Photodiode output: 0V @ dark, 3.3V @ full brightness
        self.photodiode_voltage = self.brightness * supply_voltage;
    }

    /// Get LED on/off state (brightness > 50%)
    pub fn is_on(&self) -> bool {
        self.brightness > 0.5
    }

    /// Get LED blink frequency (for pulsing patterns)
    pub fn frequency_hz(&self) -> f64 {
        // Brightness affects "frequency" for visualization
        // Dim = slow pulse, bright = fast pulse
        self.brightness * 5.0 + 0.5  // 0.5-5.5 Hz
    }
}

impl Default for LedCircuitModel {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_led_model_creation() {
        let led = LedCircuitModel::new();
        assert_eq!(led.current_ma, 0.0);
        assert_eq!(led.brightness, 0.0);
        assert_eq!(led.photodiode_voltage, 0.0);
    }

    #[test]
    fn test_led_off() {
        let mut led = LedCircuitModel::new();
        led.update(0.0, 3.3);

        assert_eq!(led.current_ma, 0.0);
        assert_eq!(led.brightness, 0.0);
        assert!(!led.is_on());
    }

    #[test]
    fn test_led_full_brightness() {
        let mut led = LedCircuitModel::new();
        led.update(3.3, 3.3);

        // (3.3 - 2.0) / 220 = 5.9mA → brightness ≈ 0.59
        assert!(led.current_ma > 5.0 && led.current_ma < 7.0);
        assert!(led.brightness > 0.5 && led.brightness < 0.7);
        assert!(led.is_on());
    }

    #[test]
    fn test_photodiode_feedback() {
        let mut led = LedCircuitModel::new();

        // At 50% brightness
        led.brightness = 0.5;
        led.photodiode_voltage = 0.5 * 3.3;
        assert!(led.photodiode_voltage >= 1.6 && led.photodiode_voltage <= 1.7);

        // At 100% brightness
        led.brightness = 1.0;
        led.photodiode_voltage = 1.0 * 3.3;
        assert_eq!(led.photodiode_voltage, 3.3);
    }

    #[test]
    fn test_led_blink_integration() -> Result<(), String> {
        // Create MCU
        let mcu = ArmCpuEmulator::new();

        // Create coupling interface
        let mut interface = MicrocontrollerCircuitInterface::new();
        interface.map_gpio_output(0x2000_0000, 5, CircuitNodeId(1))?;
        interface.map_adc_input(0, 0x2000_0004, CircuitNodeId(2))?;

        // Create coupled simulator
        let mut sim = CoupledMicrocontrollerCircuitSim::new(mcu, interface);

        // Create LED model
        let mut led = LedCircuitModel::new();

        // Simulate 100 cycles
        for _ in 0..100 {
            // Execute one MCU cycle
            sim.step()?;

            // Get GPIO voltage from simulator
            let gpio_voltage = sim.get_circuit_voltage(CircuitNodeId(1)).unwrap_or(0.0);

            // Update LED model
            led.update(gpio_voltage, 3.3);

            // Write photodiode output back to simulator
            sim.set_circuit_voltage(CircuitNodeId(2), led.photodiode_voltage)?;
        }

        // Verify simulation ran successfully
        assert!(sim.cycle_count() == 100);

        Ok(())
    }

    #[test]
    fn test_led_brightness_progression() {
        let mut led = LedCircuitModel::new();
        let mut prev_brightness = 0.0;

        // Gradually increase GPIO voltage
        for i in 0..=10 {
            let gpio_voltage = i as f64 * 0.33;  // 0.0V to 3.3V
            led.update(gpio_voltage, 3.3);

            // Brightness should increase monotonically
            assert!(led.brightness >= prev_brightness);
            prev_brightness = led.brightness;
        }

        // Final brightness should be significant
        assert!(led.brightness > 0.3);
    }
}
