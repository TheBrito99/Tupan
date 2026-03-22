//! Timer Peripherals
//!
//! SysTick (System Timer) and general-purpose timers with interrupt generation

use serde::{Deserialize, Serialize};

/// SysTick Timer Control and Status Register
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysTickRegister {
    pub enable: bool,          // Enable timer
    pub tickint: bool,         // Enable SysTick exception (interrupt)
    pub clksource: bool,       // Clock source (false: external, true: AHB)
    pub countflag: bool,       // Count flag (set when counter reaches 0)
    pub reload: u32,           // Reload value (24-bit)
    pub current: u32,          // Current value (24-bit)
}

impl Default for SysTickRegister {
    fn default() -> Self {
        SysTickRegister {
            enable: false,
            tickint: false,
            clksource: true,  // Default to AHB clock
            countflag: false,
            reload: 0,
            current: 0,
        }
    }
}

/// SysTick Timer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysTick {
    pub registers: SysTickRegister,
    pub ticks: u64,  // Total ticks counted
}

impl SysTick {
    /// Create new SysTick timer
    pub fn new() -> Self {
        SysTick {
            registers: SysTickRegister::default(),
            ticks: 0,
        }
    }

    /// Update timer by one clock cycle
    /// Returns true if interrupt should be generated
    pub fn tick(&mut self) -> bool {
        if !self.registers.enable {
            return false;
        }

        self.ticks += 1;

        // Decrement counter
        self.registers.current = self.registers.current.saturating_sub(1);
        
        // Check if we just reached 0
        if self.registers.current == 0 {
            self.registers.countflag = true;
            self.registers.current = self.registers.reload;
            
            // Generate interrupt if enabled
            if self.registers.tickint {
                return true;
            }
        }

        false
    }

    /// Set reload value (24-bit)
    pub fn set_reload(&mut self, value: u32) {
        self.registers.reload = value & 0xFFFFFF;
    }

    /// Set current value (24-bit)
    pub fn set_current(&mut self, value: u32) {
        self.registers.current = value & 0xFFFFFF;
    }

    /// Get elapsed cycles since last reset
    pub fn elapsed_cycles(&self) -> u64 {
        self.ticks
    }
}

impl Default for SysTick {
    fn default() -> Self {
        Self::new()
    }
}

/// General-Purpose Timer Mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimerMode {
    Up,        // Count up from 0 to ARR
    Down,      // Count down from ARR to 0
    CenterUp,  // Center-aligned, counting up then down
    CenterDown, // Center-aligned, counting down then up
}

/// General-Purpose Timer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpTimer {
    pub counter: u32,          // Current counter value
    pub autoreload: u32,       // Auto-reload value (max count)
    pub prescaler: u16,        // Prescaler divider
    pub mode: TimerMode,
    pub enabled: bool,
    pub update_interrupt_enable: bool,
    pub capture_compare_mode: [CcMode; 4],  // 4 capture/compare channels
    pub capture_compare_value: [u32; 4],
    pub prescaler_counter: u16, // Internal prescaler counter
    pub direction: bool,        // false: up, true: down
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CcMode {
    Disabled,
    Output { toggle: bool },
    InputCapture { filter: u8 },
}

impl GpTimer {
    /// Create new general-purpose timer
    pub fn new() -> Self {
        GpTimer {
            counter: 0,
            autoreload: 0xFFFFFFFF,
            prescaler: 0,
            mode: TimerMode::Up,
            enabled: false,
            update_interrupt_enable: false,
            capture_compare_mode: [CcMode::Disabled; 4],
            capture_compare_value: [0; 4],
            prescaler_counter: 0,
            direction: false,
        }
    }

    /// Tick the timer by one clock cycle
    /// Returns true if update interrupt should be generated
    pub fn tick(&mut self) -> bool {
        if !self.enabled {
            return false;
        }

        // Apply prescaler
        self.prescaler_counter += 1;
        if self.prescaler_counter <= self.prescaler {
            return false;
        }
        self.prescaler_counter = 0;

        let mut should_interrupt = false;

        // Update counter based on mode
        match self.mode {
            TimerMode::Up => {
                self.counter = self.counter.wrapping_add(1);
                if self.counter >= self.autoreload {
                    should_interrupt = true;
                    self.counter = 0;
                }
            }
            TimerMode::Down => {
                self.counter = self.counter.saturating_sub(1);
                if self.counter == 0 {
                    self.counter = self.autoreload;
                    should_interrupt = true;
                }
            }
            TimerMode::CenterUp => {
                if !self.direction {
                    self.counter += 1;
                    if self.counter >= self.autoreload {
                        self.direction = true;
                    }
                } else {
                    self.counter -= 1;
                    if self.counter == 0 {
                        self.direction = false;
                        should_interrupt = true;
                    }
                }
            }
            TimerMode::CenterDown => {
                if self.direction {
                    self.counter += 1;
                    if self.counter >= self.autoreload {
                        self.direction = false;
                    }
                } else {
                    self.counter -= 1;
                    if self.counter == 0 {
                        self.direction = true;
                        should_interrupt = true;
                    }
                }
            }
        }

        // Check compare matches for channels 0-3
        for i in 0..4 {
            if self.counter == self.capture_compare_value[i] {
                // Output compare match
                if let CcMode::Output { toggle } = self.capture_compare_mode[i] {
                    if toggle {
                        // Toggle output (would be implemented in actual timer)
                    }
                }
            }
        }

        should_interrupt && self.update_interrupt_enable
    }

    /// Set prescaler divider
    pub fn set_prescaler(&mut self, div: u16) {
        self.prescaler = div.saturating_sub(1);
    }

    /// Set auto-reload value
    pub fn set_autoreload(&mut self, value: u32) {
        self.autoreload = value;
    }

    /// Set capture/compare value
    pub fn set_compare(&mut self, channel: usize, value: u32) -> Result<(), String> {
        if channel >= 4 {
            return Err("Invalid channel".to_string());
        }
        self.capture_compare_value[channel] = value;
        Ok(())
    }

    /// Enable/disable capture/compare output
    pub fn set_cc_mode(&mut self, channel: usize, mode: CcMode) -> Result<(), String> {
        if channel >= 4 {
            return Err("Invalid channel".to_string());
        }
        self.capture_compare_mode[channel] = mode;
        Ok(())
    }

    /// Get elapsed time in ticks
    pub fn elapsed_ticks(&self) -> u32 {
        self.counter
    }
}

impl Default for GpTimer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_systick_creation() {
        let systick = SysTick::new();
        assert!(!systick.registers.enable);
        assert_eq!(systick.ticks, 0);
    }

    #[test]
    fn test_systick_tick() {
        let mut systick = SysTick::new();
        systick.registers.enable = true;
        systick.registers.reload = 10;
        systick.registers.current = 10;

        // Tick down to 0
        for _ in 0..10 {
            systick.tick();
        }

        assert!(systick.registers.countflag);
        assert_eq!(systick.registers.current, 10);  // Reloaded
    }

    #[test]
    fn test_systick_interrupt() {
        let mut systick = SysTick::new();
        systick.registers.enable = true;
        systick.registers.reload = 5;
        systick.registers.current = 1;
        systick.registers.tickint = true;

        let mut interrupt_fired = false;
        for _ in 0..10 {
            if systick.tick() {
                interrupt_fired = true;
                break;
            }
        }

        assert!(interrupt_fired);
    }

    #[test]
    fn test_gp_timer_up_count() {
        let mut timer = GpTimer::new();
        timer.enabled = true;
        timer.autoreload = 100;
        timer.prescaler = 0;
        timer.mode = TimerMode::Up;

        for _ in 0..100 {
            timer.tick();
        }

        assert_eq!(timer.counter, 0);  // Wrapped around after reaching autoreload
    }

    #[test]
    fn test_gp_timer_prescaler() {
        let mut timer = GpTimer::new();
        timer.enabled = true;
        timer.autoreload = 1000;
        timer.prescaler = 9;  // Divide by 10
        timer.mode = TimerMode::Up;

        for _ in 0..100 {
            timer.tick();
        }

        assert_eq!(timer.counter, 10);  // 100 ticks / prescaler 10
    }

    #[test]
    fn test_gp_timer_compare() {
        let mut timer = GpTimer::new();
        timer.enabled = true;
        timer.autoreload = 1000;
        timer.mode = TimerMode::Up;
        timer.set_compare(0, 50).unwrap();
        timer.set_cc_mode(0, CcMode::Output { toggle: true }).unwrap();

        for _ in 0..50 {
            timer.tick();
        }

        assert_eq!(timer.counter, 50);
    }

    #[test]
    fn test_gp_timer_modes() {
        let mut timer = GpTimer::new();
        timer.enabled = true;
        timer.autoreload = 10;
        timer.mode = TimerMode::Down;

        timer.counter = 5;
        for _ in 0..5 {
            timer.tick();
        }

        assert_eq!(timer.counter, 10);  // Reloaded when counter reached 0
    }
}
