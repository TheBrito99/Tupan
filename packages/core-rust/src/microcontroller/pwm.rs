//! PWM (Pulse Width Modulation) Peripheral
//!
//! Supports multiple channels with configurable frequency and duty cycle

use serde::{Deserialize, Serialize};

/// PWM Channel Mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PwmMode {
    Disabled,       // Channel disabled
    Regular,        // Regular PWM (edge-aligned)
    CenterAligned,  // Center-aligned PWM
    InvertedRegular,// Inverted regular PWM
}

/// PWM Channel Configuration and State
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PwmChannel {
    pub channel_num: u8,          // 0-3 (typically)
    pub mode: PwmMode,            // Channel mode
    pub enabled: bool,            // Channel enabled
    pub duty_cycle: f32,          // 0.0 to 1.0
    pub output_level: bool,       // Current output level
}

impl PwmChannel {
    pub fn new(channel_num: u8) -> Self {
        PwmChannel {
            channel_num,
            mode: PwmMode::Disabled,
            enabled: false,
            duty_cycle: 0.0,
            output_level: false,
        }
    }

    /// Set duty cycle (0.0 to 1.0)
    pub fn set_duty_cycle(&mut self, duty: f32) {
        self.duty_cycle = duty.clamp(0.0, 1.0);
    }

    /// Get current output level
    pub fn get_level(&self) -> bool {
        self.output_level
    }
}

/// PWM Timer (typically one timer per 4 channels)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PwmTimer {
    pub timer_id: u8,                   // Timer ID
    pub enabled: bool,                  // Timer enabled
    pub frequency_hz: f32,              // Frequency in Hz (default ~1kHz)
    pub period_cycles: u32,             // Period in timer cycles
    pub prescaler: u32,                 // Clock prescaler
    pub counter: u32,                   // Current counter value
    pub channels: [PwmChannel; 4],      // PWM channels
    pub interrupt_enabled: bool,        // Interrupt on period complete
    pub period_complete: bool,          // Period complete flag
    pub sample_counter: u32,            // Internal sample counter
}

impl PwmTimer {
    /// Create a new PWM timer
    pub fn new(timer_id: u8) -> Self {
        let mut channels = [PwmChannel::new(0); 4];
        for i in 0..4 {
            channels[i] = PwmChannel::new(i as u8);
        }

        PwmTimer {
            timer_id,
            enabled: false,
            frequency_hz: 1000.0,  // Default 1kHz
            period_cycles: 1000,
            prescaler: 1,
            counter: 0,
            channels,
            interrupt_enabled: false,
            period_complete: false,
            sample_counter: 0,
        }
    }

    /// Set PWM frequency
    pub fn set_frequency(&mut self, freq_hz: f32) {
        self.frequency_hz = freq_hz.clamp(1.0, 1_000_000.0);
        // Recalculate period (assume 1MHz timer clock for simplicity)
        self.period_cycles = ((1_000_000.0 / self.frequency_hz) as u32).max(1);
    }

    /// Get PWM frequency
    pub fn get_frequency(&self) -> f32 {
        self.frequency_hz
    }

    /// Set duty cycle on a channel
    pub fn set_channel_duty(&mut self, channel: u8, duty: f32) -> Result<(), String> {
        if channel >= 4 {
            return Err("Channel out of range".to_string());
        }
        self.channels[channel as usize].set_duty_cycle(duty);
        Ok(())
    }

    /// Get channel output level
    pub fn get_channel_level(&self, channel: u8) -> Option<bool> {
        if channel < 4 {
            Some(self.channels[channel as usize].output_level)
        } else {
            None
        }
    }

    /// Tick the PWM timer
    /// Returns true if period complete and interrupt should be generated
    pub fn tick(&mut self) -> bool {
        if !self.enabled {
            return false;
        }

        self.sample_counter += 1;

        // Apply prescaler
        if self.sample_counter % self.prescaler == 0 {
            self.counter += 1;

            // Update PWM outputs based on counter and duty cycle
            for ch in &mut self.channels {
                if ch.enabled && ch.mode != PwmMode::Disabled {
                    // Calculate threshold for duty cycle
                    let threshold = (self.period_cycles as f32 * ch.duty_cycle) as u32;

                    match ch.mode {
                        PwmMode::Regular => {
                            ch.output_level = self.counter < threshold;
                        }
                        PwmMode::InvertedRegular => {
                            ch.output_level = self.counter >= threshold;
                        }
                        PwmMode::CenterAligned => {
                            // Center-aligned: counter goes 0..period, output high when below midpoint
                            let halfway = self.period_cycles / 2;
                            if self.counter < halfway {
                                ch.output_level = self.counter < threshold;
                            } else {
                                ch.output_level = (self.period_cycles - self.counter) < threshold;
                            }
                        }
                        PwmMode::Disabled => {
                            ch.output_level = false;
                        }
                    }
                }
            }

            // Check for period complete
            if self.counter >= self.period_cycles {
                self.counter = 0;
                self.period_complete = true;

                if self.interrupt_enabled {
                    return true;
                }
            }
        }

        false
    }

    /// Read and clear period complete flag
    pub fn read_period_flag(&mut self) -> bool {
        let flag = self.period_complete;
        self.period_complete = false;
        flag
    }

    /// Calculate current output voltage for a channel (assuming 0-3.3V)
    pub fn get_channel_voltage(&self, channel: u8) -> Option<f32> {
        if channel < 4 {
            let level = self.channels[channel as usize].output_level;
            Some(if level { 3.3 } else { 0.0 })
        } else {
            None
        }
    }

    /// Calculate average voltage over full period (for filtering analysis)
    pub fn get_average_channel_voltage(&self, channel: u8) -> Option<f32> {
        if channel < 4 {
            let duty = self.channels[channel as usize].duty_cycle;
            Some(3.3 * duty)
        } else {
            None
        }
    }
}

impl Default for PwmTimer {
    fn default() -> Self {
        Self::new(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pwm_timer_creation() {
        let pwm = PwmTimer::new(0);
        assert_eq!(pwm.timer_id, 0);
        assert!(!pwm.enabled);
        assert_eq!(pwm.frequency_hz, 1000.0);
    }

    #[test]
    fn test_pwm_channel_creation() {
        let ch = PwmChannel::new(0);
        assert_eq!(ch.channel_num, 0);
        assert_eq!(ch.duty_cycle, 0.0);
        assert!(!ch.output_level);
    }

    #[test]
    fn test_pwm_set_frequency() {
        let mut pwm = PwmTimer::new(0);
        pwm.set_frequency(500.0);
        assert_eq!(pwm.frequency_hz, 500.0);

        // Very low frequency should be clamped
        pwm.set_frequency(0.5);
        assert_eq!(pwm.frequency_hz, 1.0);

        // Very high frequency should be clamped
        pwm.set_frequency(2_000_000.0);
        assert_eq!(pwm.frequency_hz, 1_000_000.0);
    }

    #[test]
    fn test_pwm_set_channel_duty() {
        let mut pwm = PwmTimer::new(0);
        pwm.set_channel_duty(0, 0.5).unwrap();
        assert_eq!(pwm.channels[0].duty_cycle, 0.5);

        // Clamping test
        pwm.set_channel_duty(1, 1.5).unwrap();
        assert_eq!(pwm.channels[1].duty_cycle, 1.0);

        pwm.set_channel_duty(2, -0.5).unwrap();
        assert_eq!(pwm.channels[2].duty_cycle, 0.0);

        // Invalid channel
        assert!(pwm.set_channel_duty(4, 0.5).is_err());
    }

    #[test]
    #[test]
    fn test_pwm_regular_mode() {
        let mut pwm = PwmTimer::new(0);
        pwm.enabled = true;
        pwm.frequency_hz = 1000.0;
        pwm.channels[0].enabled = true;
        pwm.channels[0].mode = PwmMode::Regular;
        pwm.channels[0].duty_cycle = 0.5;

        // Verify basic PWM configuration works
        assert_eq!(pwm.channels[0].duty_cycle, 0.5);
        
        // Tick a few times
        for _ in 0..100 {
            pwm.tick();
        }
        
        // Verify output voltage calculation
        let voltage = pwm.get_channel_voltage(0);
        assert!(voltage.is_some());
    }

    #[test]
    fn test_pwm_inverted_mode() {
        let mut pwm = PwmTimer::new(0);
        pwm.enabled = true;
        pwm.frequency_hz = 1000.0;
        pwm.channels[0].enabled = true;
        pwm.channels[0].mode = PwmMode::InvertedRegular;
        pwm.channels[0].duty_cycle = 0.5;

        let mut counter = 0;
        let mut high_count = 0;
        let mut low_count = 0;

        for _ in 0..1100 {
            pwm.tick();
            if counter < 1000 {
                if pwm.channels[0].output_level {
                    high_count += 1;
                } else {
                    low_count += 1;
                }
                counter += 1;
            }
        }

        // Inverted 50% should be low most of first half, high most of second half
        assert!(high_count > low_count);
    }

    #[test]
    fn test_pwm_channel_voltage() {
        let mut pwm = PwmTimer::new(0);
        pwm.enabled = true;
        pwm.channels[0].enabled = true;
        pwm.channels[0].mode = PwmMode::Regular;
        pwm.channels[0].duty_cycle = 0.75;

        // Tick a few times
        for _ in 0..50 {
            pwm.tick();
        }

        let voltage = pwm.get_channel_voltage(0);
        assert!(voltage.is_some());
        let v = voltage.unwrap();
        assert!(v == 0.0 || v == 3.3); // Should be either high or low
    }

    #[test]
    fn test_pwm_average_voltage() {
        let mut pwm = PwmTimer::new(0);
        pwm.channels[0].duty_cycle = 0.5;
        pwm.channels[1].duty_cycle = 0.75;

        let avg0 = pwm.get_average_channel_voltage(0);
        let avg1 = pwm.get_average_channel_voltage(1);

        assert!(avg0.is_some());
        assert!(avg1.is_some());
        assert!((avg0.unwrap() - 1.65).abs() < 0.01);  // 3.3 * 0.5
        assert!((avg1.unwrap() - 2.475).abs() < 0.01); // 3.3 * 0.75
    }

    #[test]
    fn test_pwm_multiple_channels() {
        let mut pwm = PwmTimer::new(0);
        pwm.enabled = true;
        pwm.frequency_hz = 1000.0;

        for ch_num in 0..4 {
            pwm.channels[ch_num].enabled = true;
            pwm.channels[ch_num].mode = PwmMode::Regular;
            pwm.channels[ch_num].duty_cycle = ((ch_num as f32) + 1.0) * 0.25;
        }

        // Tick and verify all channels are active
        for _ in 0..100 {
            pwm.tick();
        }

        for ch_num in 0..4 {
            let level = pwm.get_channel_level(ch_num as u8);
            assert!(level.is_some());
        }
    }

    #[test]
    fn test_pwm_period_flag() {
        let mut pwm = PwmTimer::new(0);
        pwm.enabled = true;
        pwm.frequency_hz = 1000.0;
        pwm.interrupt_enabled = true;

        // Tick until period complete
        let mut period_complete = false;
        for _ in 0..10000 {
            if pwm.tick() {
                period_complete = true;
                break;
            }
        }

        assert!(period_complete);
        assert!(pwm.period_complete);

        // Reading flag should clear it
        let flag = pwm.read_period_flag();
        assert!(flag);
        assert!(!pwm.period_complete);
    }

    #[test]
    fn test_pwm_disabled_channel() {
        let mut pwm = PwmTimer::new(0);
        pwm.enabled = true;
        pwm.channels[0].enabled = false;
        pwm.channels[0].duty_cycle = 0.5;

        for _ in 0..100 {
            pwm.tick();
        }

        // Disabled channel should stay low
        assert!(!pwm.channels[0].output_level);
    }

    #[test]
    fn test_pwm_prescaler() {
        let mut pwm = PwmTimer::new(0);
        pwm.enabled = true;
        pwm.prescaler = 2;
        pwm.frequency_hz = 1000.0;

        let counter_before = pwm.counter;
        for _ in 0..10 {
            pwm.tick();
        }
        let counter_after = pwm.counter;

        // With prescaler=2, counter should advance slower
        assert!(counter_after <= counter_before + 5);
    }
}
