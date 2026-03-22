//! Interrupt & Exception Handling
//!
//! NVIC (Nested Vectored Interrupt Controller) implementation for ARM Cortex-M
//! Supports interrupt priorities, masking, and context switching

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Interrupt vectors in ARM Cortex-M (exception numbers 0-15 are reserved)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExceptionType {
    Reset,               // 1
    NMI,                 // 2 - Non-Maskable Interrupt
    HardFault,           // 3
    MemManage,           // 4 (Cortex-M3+)
    BusFault,            // 5 (Cortex-M3+)
    UsageFault,          // 6 (Cortex-M3+)
    SVCall,              // 11 - Supervisor Call
    PendSV,              // 14 - Pendable Service Call
    SysTick,             // 15 - System Timer
    IRQ(u8),             // 16+ - External interrupts (0-239 supported)
}

impl ExceptionType {
    /// Get exception number (0-255)
    pub fn exception_number(&self) -> u8 {
        match self {
            ExceptionType::Reset => 1,
            ExceptionType::NMI => 2,
            ExceptionType::HardFault => 3,
            ExceptionType::MemManage => 4,
            ExceptionType::BusFault => 5,
            ExceptionType::UsageFault => 6,
            ExceptionType::SVCall => 11,
            ExceptionType::PendSV => 14,
            ExceptionType::SysTick => 15,
            ExceptionType::IRQ(n) => 16 + n,
        }
    }

    /// Is this a system exception (cannot be disabled or reprioritized)?
    pub fn is_system_exception(&self) -> bool {
        matches!(
            self,
            ExceptionType::Reset | ExceptionType::NMI | ExceptionType::HardFault
        )
    }
}

/// Interrupt handler callback
pub type InterruptHandler = Box<dyn Fn() + Send + Sync>;

/// NVIC Register Structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NvicRegisters {
    /// Interrupt Set-Enable Registers (ISER[0-7], supports 0-239 interrupts)
    pub interrupt_set_enable: [u32; 8],

    /// Interrupt Clear-Enable Registers (ICER[0-7])
    pub interrupt_clear_enable: [u32; 8],

    /// Interrupt Set-Pending Registers (ISPR[0-7])
    pub interrupt_set_pending: [u32; 8],

    /// Interrupt Clear-Pending Registers (ICPR[0-7])
    pub interrupt_clear_pending: [u32; 8],

    /// Interrupt Active Bit Registers (IABR[0-7])
    pub interrupt_active: [u32; 8],

    /// Interrupt Priority Registers (IPR[0-59], 240 interrupts × 4 bits)
    pub interrupt_priority: Vec<u32>,

    /// Interrupt Control and State Register (ICSR)
    pub icsr: IcsrRegister,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct IcsrRegister {
    pub vect_active: u8,      // Vector number of active exception
    pub vect_pending: u8,     // Vector number of pending exception
    pub isrpending: bool,     // Is there a pending exception?
    pub isrpreempt: bool,     // Can pending exception preempt running exception?
    pub pendstset: bool,      // Set PendSV pending
    pub pendstclr: bool,      // Clear PendSV pending
    pub pendsvset: bool,      // Set SysTick pending
    pub pendsvclr: bool,      // Clear SysTick pending
    pub nmipendset: bool,     // Set NMI pending
}

impl Default for NvicRegisters {
    fn default() -> Self {
        NvicRegisters {
            interrupt_set_enable: [0; 8],
            interrupt_clear_enable: [0; 8],
            interrupt_set_pending: [0; 8],
            interrupt_clear_pending: [0; 8],
            interrupt_active: [0; 8],
            interrupt_priority: vec![0; 60],
            icsr: IcsrRegister {
                vect_active: 0,
                vect_pending: 0,
                isrpending: false,
                isrpreempt: false,
                pendstset: false,
                pendstclr: false,
                pendsvset: false,
                pendsvclr: false,
                nmipendset: false,
            },
        }
    }
}

/// Interrupt State (per interrupt)
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct InterruptState {
    pub enabled: bool,
    pub pending: bool,
    pub active: bool,
    pub priority: u8,  // 0-255 (lower number = higher priority)
}

/// NVIC Controller
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nvic {
    registers: NvicRegisters,
    interrupt_states: HashMap<u8, InterruptState>,
    basepri: u8,  // Base Priority Mask Register (interrupts <= this priority masked)
}

impl Nvic {
    /// Create new NVIC
    pub fn new() -> Self {
        let mut nvic = Nvic {
            registers: NvicRegisters::default(),
            interrupt_states: HashMap::new(),
            basepri: 0,
        };

        // Initialize all 240 external interrupts
        for i in 0..240 {
            nvic.interrupt_states.insert(
                16 + i,
                InterruptState {
                    enabled: false,
                    pending: false,
                    active: false,
                    priority: 0,
                },
            );
        }

        nvic
    }

    /// Enable interrupt
    pub fn enable_interrupt(&mut self, irq_number: u8) -> Result<(), String> {
        if irq_number >= 240 {
            return Err(format!("Invalid IRQ number: {}", irq_number));
        }

        let register_idx = irq_number / 32;
        let bit_idx = irq_number % 32;

        self.registers.interrupt_set_enable[register_idx as usize] |= 1 << bit_idx;

        if let Some(state) = self.interrupt_states.get_mut(&(16 + irq_number)) {
            state.enabled = true;
        }

        Ok(())
    }

    /// Disable interrupt
    pub fn disable_interrupt(&mut self, irq_number: u8) -> Result<(), String> {
        if irq_number >= 240 {
            return Err(format!("Invalid IRQ number: {}", irq_number));
        }

        let register_idx = irq_number / 32;
        let bit_idx = irq_number % 32;

        self.registers.interrupt_clear_enable[register_idx as usize] |= 1 << bit_idx;

        if let Some(state) = self.interrupt_states.get_mut(&(16 + irq_number)) {
            state.enabled = false;
        }

        Ok(())
    }

    /// Set interrupt pending
    pub fn set_pending(&mut self, irq_number: u8) -> Result<(), String> {
        if irq_number >= 240 {
            return Err(format!("Invalid IRQ number: {}", irq_number));
        }

        let register_idx = irq_number / 32;
        let bit_idx = irq_number % 32;

        self.registers.interrupt_set_pending[register_idx as usize] |= 1 << bit_idx;

        if let Some(state) = self.interrupt_states.get_mut(&(16 + irq_number)) {
            state.pending = true;
        }

        self.registers.icsr.isrpending = true;

        Ok(())
    }

    /// Clear interrupt pending
    pub fn clear_pending(&mut self, irq_number: u8) -> Result<(), String> {
        if irq_number >= 240 {
            return Err(format!("Invalid IRQ number: {}", irq_number));
        }

        let register_idx = irq_number / 32;
        let bit_idx = irq_number % 32;

        self.registers.interrupt_clear_pending[register_idx as usize] |= 1 << bit_idx;

        if let Some(state) = self.interrupt_states.get_mut(&(16 + irq_number)) {
            state.pending = false;
        }

        Ok(())
    }

    /// Set interrupt priority (0-255, lower = higher priority)
    pub fn set_priority(&mut self, irq_number: u8, priority: u8) -> Result<(), String> {
        if irq_number >= 240 {
            return Err(format!("Invalid IRQ number: {}", irq_number));
        }

        let register_idx = irq_number / 4;
        let byte_idx = irq_number % 4;

        let register = &mut self.registers.interrupt_priority[register_idx as usize];
        *register = (*register & !(0xFF << (byte_idx * 8))) | ((priority as u32) << (byte_idx * 8));

        if let Some(state) = self.interrupt_states.get_mut(&(16 + irq_number)) {
            state.priority = priority;
        }

        Ok(())
    }

    /// Get interrupt priority
    pub fn get_priority(&self, irq_number: u8) -> Result<u8, String> {
        if irq_number >= 240 {
            return Err(format!("Invalid IRQ number: {}", irq_number));
        }

        Ok(self
            .interrupt_states
            .get(&(16 + irq_number))
            .map(|s| s.priority)
            .unwrap_or(0))
    }

    /// Set Base Priority Mask (mask interrupts with priority >= basepri)
    pub fn set_basepri(&mut self, basepri: u8) {
        self.basepri = basepri;
    }

    /// Get next pending interrupt that should run
    pub fn next_pending_interrupt(&self) -> Option<u8> {
        // Find highest priority pending and enabled interrupt
        let mut highest_priority = 256u16;
        let mut highest_irq = None;

        for (irq, state) in &self.interrupt_states {
            if state.enabled && state.pending && (state.priority as u16) < highest_priority {
                // Check if not masked by basepri
                // basepri=0 means no masking; basepri>0 masks interrupts with priority >= basepri
                if self.basepri == 0 || state.priority < self.basepri {
                    highest_priority = state.priority as u16;
                    highest_irq = Some(*irq as u8);
                }
            }
        }

        highest_irq
    }

    /// Is an interrupt currently running (active)?
    pub fn is_interrupt_active(&self, irq_number: u8) -> bool {
        self.interrupt_states
            .get(&irq_number)
            .map(|s| s.active)
            .unwrap_or(false)
    }

    /// Mark interrupt as active (running)
    pub fn set_interrupt_active(&mut self, irq_number: u8, active: bool) -> Result<(), String> {
        if irq_number < 16 {
            return Err("Cannot set activity status for system exceptions".to_string());
        }

        let register_idx = (irq_number - 16) / 32;
        let bit_idx = (irq_number - 16) % 32;

        if active {
            self.registers.interrupt_active[register_idx as usize] |= 1 << bit_idx;
        } else {
            self.registers.interrupt_active[register_idx as usize] &= !(1 << bit_idx);
        }

        if let Some(state) = self.interrupt_states.get_mut(&irq_number) {
            state.active = active;
        }

        Ok(())
    }
}

impl Default for Nvic {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nvic_creation() {
        let nvic = Nvic::new();
        assert_eq!(nvic.interrupt_states.len(), 240);
    }

    #[test]
    fn test_interrupt_enable_disable() {
        let mut nvic = Nvic::new();

        // Enable IRQ 0
        nvic.enable_interrupt(0).unwrap();
        assert!(nvic.interrupt_states.get(&16).unwrap().enabled);

        // Disable IRQ 0
        nvic.disable_interrupt(0).unwrap();
        assert!(!nvic.interrupt_states.get(&16).unwrap().enabled);
    }

    #[test]
    fn test_interrupt_priority() {
        let mut nvic = Nvic::new();

        nvic.set_priority(0, 128).unwrap();
        assert_eq!(nvic.get_priority(0).unwrap(), 128);

        nvic.set_priority(1, 64).unwrap();
        assert_eq!(nvic.get_priority(1).unwrap(), 64);
    }

    #[test]
    fn test_pending_interrupt() {
        let mut nvic = Nvic::new();

        nvic.enable_interrupt(0).unwrap();
        nvic.set_priority(0, 128).unwrap();
        nvic.set_pending(0).unwrap();

        assert_eq!(nvic.next_pending_interrupt(), Some(16));
    }

    #[test]
    fn test_basepri_masking() {
        let mut nvic = Nvic::new();

        nvic.enable_interrupt(0).unwrap();
        nvic.set_priority(0, 200).unwrap();
        nvic.set_pending(0).unwrap();

        // Set basepri to mask interrupts with priority >= 100
        nvic.set_basepri(100);

        // IRQ with priority 200 should be masked
        assert_eq!(nvic.next_pending_interrupt(), None);
    }

    #[test]
    fn test_exception_numbers() {
        assert_eq!(ExceptionType::Reset.exception_number(), 1);
        assert_eq!(ExceptionType::NMI.exception_number(), 2);
        assert_eq!(ExceptionType::SysTick.exception_number(), 15);
        assert_eq!(ExceptionType::IRQ(0).exception_number(), 16);
        assert_eq!(ExceptionType::IRQ(239).exception_number(), 255);
    }

    #[test]
    fn test_system_exceptions() {
        assert!(ExceptionType::Reset.is_system_exception());
        assert!(ExceptionType::NMI.is_system_exception());
        assert!(!ExceptionType::SysTick.is_system_exception());
        assert!(!ExceptionType::IRQ(0).is_system_exception());
    }
}
