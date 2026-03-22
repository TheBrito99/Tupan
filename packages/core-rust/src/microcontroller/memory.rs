//! CPU Memory System
//!
//! Models typical ARM Cortex-M memory layout:
//! - 0x0000_0000 - Flash (code, read-only)
//! - 0x2000_0000 - SRAM (data, stack, heap)
//! - Additional peripheral memory regions

use serde::{Deserialize, Serialize};

/// Memory regions for typical ARM Cortex-M
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryRegion {
    Flash,      // 0x0000_0000 - Code/constants
    Sram,       // 0x2000_0000 - Working memory (stack, heap, variables)
    Peripheral, // 0x4000_0000 - Peripheral registers
    Device,     // 0xE000_0000 - System device (NVIC, etc.)
    Invalid,    // Unmapped address
}

impl MemoryRegion {
    /// Determine region from address
    pub fn from_address(addr: u32) -> Self {
        match addr {
            0x0000_0000..=0x1FFF_FFFF => MemoryRegion::Flash,
            0x2000_0000..=0x3FFF_FFFF => MemoryRegion::Sram,
            0x4000_0000..=0xDFFF_FFFF => MemoryRegion::Peripheral,
            0xE000_0000..=0xFFFF_FFFF => MemoryRegion::Device,
        }
    }
}

/// CPU Memory (Flash + SRAM)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMemory {
    flash: Vec<u8>,         // Flash memory (256KB typical)
    sram: Vec<u8>,          // SRAM (32KB typical)
    flash_size: usize,
    sram_size: usize,
}

impl CpuMemory {
    /// Create memory with typical sizes
    pub fn new_stm32f103() -> Self {
        // STM32F103: 256KB Flash, 64KB SRAM
        CpuMemory {
            flash: vec![0; 256 * 1024],
            sram: vec![0; 64 * 1024],
            flash_size: 256 * 1024,
            sram_size: 64 * 1024,
        }
    }

    /// Create memory with custom sizes
    pub fn with_sizes(flash_kb: usize, sram_kb: usize) -> Self {
        CpuMemory {
            flash: vec![0; flash_kb * 1024],
            sram: vec![0; sram_kb * 1024],
            flash_size: flash_kb * 1024,
            sram_size: sram_kb * 1024,
        }
    }

    /// Load binary into Flash (typically from ELF or HEX file)
    pub fn load_flash(&mut self, offset: usize, data: &[u8]) -> Result<(), String> {
        if offset + data.len() > self.flash_size {
            return Err("Flash overflow".to_string());
        }
        self.flash[offset..offset + data.len()].copy_from_slice(data);
        Ok(())
    }

    /// Read 8-bit value from memory
    pub fn read_u8(&self, addr: u32) -> Result<u8, String> {
        match MemoryRegion::from_address(addr) {
            MemoryRegion::Flash => {
                let addr = addr as usize;
                if addr >= self.flash_size {
                    Err(format!("Flash address out of bounds: 0x{:08x}", addr))
                } else {
                    Ok(self.flash[addr])
                }
            }
            MemoryRegion::Sram => {
                let addr = (addr - 0x2000_0000) as usize;
                if addr >= self.sram_size {
                    Err(format!("SRAM address out of bounds: 0x{:08x}", addr))
                } else {
                    Ok(self.sram[addr])
                }
            }
            MemoryRegion::Peripheral => {
                // Peripheral reads would go to GPIO, ADC, etc.
                // For now, return 0
                Ok(0)
            }
            MemoryRegion::Device => {
                // Device memory (NVIC, etc.) would be handled here
                Ok(0)
            }
            MemoryRegion::Invalid => {
                Err(format!("Invalid memory address: 0x{:08x}", addr))
            }
        }
    }

    /// Read 16-bit value from memory
    pub fn read_u16(&self, addr: u32) -> Result<u16, String> {
        let low = self.read_u8(addr)? as u16;
        let high = self.read_u8(addr + 1)? as u16;
        Ok((high << 8) | low)  // Little-endian
    }

    /// Read 32-bit value from memory
    pub fn read_u32(&self, addr: u32) -> Result<u32, String> {
        let low = self.read_u16(addr)? as u32;
        let high = self.read_u16(addr + 2)? as u32;
        Ok((high << 16) | low)  // Little-endian
    }

    /// Write 8-bit value to memory
    pub fn write_u8(&mut self, addr: u32, value: u8) -> Result<(), String> {
        match MemoryRegion::from_address(addr) {
            MemoryRegion::Flash => {
                Err("Cannot write to Flash".to_string())
            }
            MemoryRegion::Sram => {
                let addr = (addr - 0x2000_0000) as usize;
                if addr >= self.sram_size {
                    Err(format!("SRAM address out of bounds: 0x{:08x}", addr))
                } else {
                    self.sram[addr] = value;
                    Ok(())
                }
            }
            MemoryRegion::Peripheral => {
                // Peripheral writes would trigger GPIO, ADC, etc.
                Ok(())
            }
            MemoryRegion::Device => {
                // Device memory writes (NVIC, etc.)
                Ok(())
            }
            MemoryRegion::Invalid => {
                Err(format!("Invalid memory address: 0x{:08x}", addr))
            }
        }
    }

    /// Write 16-bit value to memory
    pub fn write_u16(&mut self, addr: u32, value: u16) -> Result<(), String> {
        self.write_u8(addr, (value & 0xFF) as u8)?;
        self.write_u8(addr + 1, ((value >> 8) & 0xFF) as u8)?;
        Ok(())
    }

    /// Write 32-bit value to memory
    pub fn write_u32(&mut self, addr: u32, value: u32) -> Result<(), String> {
        self.write_u16(addr, (value & 0xFFFF) as u16)?;
        self.write_u16(addr + 2, ((value >> 16) & 0xFFFF) as u16)?;
        Ok(())
    }

    /// Get flash memory
    pub fn flash(&self) -> &[u8] {
        &self.flash
    }

    /// Get SRAM
    pub fn sram(&self) -> &[u8] {
        &self.sram
    }

    /// Get flash size in bytes
    pub fn flash_size(&self) -> usize {
        self.flash_size
    }

    /// Get SRAM size in bytes
    pub fn sram_size(&self) -> usize {
        self.sram_size
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_region_detection() {
        assert_eq!(MemoryRegion::from_address(0x0000_0000), MemoryRegion::Flash);
        assert_eq!(MemoryRegion::from_address(0x0800_0000), MemoryRegion::Flash);
        assert_eq!(MemoryRegion::from_address(0x2000_0000), MemoryRegion::Sram);
        assert_eq!(MemoryRegion::from_address(0x2000_8000), MemoryRegion::Sram);
        assert_eq!(MemoryRegion::from_address(0x4000_0000), MemoryRegion::Peripheral);
        assert_eq!(MemoryRegion::from_address(0xE000_0000), MemoryRegion::Device);
    }

    #[test]
    fn test_memory_creation() {
        let mem = CpuMemory::new_stm32f103();
        assert_eq!(mem.flash_size(), 256 * 1024);
        assert_eq!(mem.sram_size(), 64 * 1024);
    }

    #[test]
    fn test_flash_load() {
        let mut mem = CpuMemory::new_stm32f103();
        let code = vec![0x00, 0xBF, 0x55, 0xAA];  // NOP, NOP, pattern
        mem.load_flash(0, &code).unwrap();

        assert_eq!(mem.read_u8(0).unwrap(), 0x00);
        assert_eq!(mem.read_u8(1).unwrap(), 0xBF);
        assert_eq!(mem.read_u8(2).unwrap(), 0x55);
        assert_eq!(mem.read_u8(3).unwrap(), 0xAA);
    }

    #[test]
    fn test_sram_write() {
        let mut mem = CpuMemory::new_stm32f103();
        mem.write_u8(0x2000_0000, 0x42).unwrap();
        assert_eq!(mem.read_u8(0x2000_0000).unwrap(), 0x42);
    }

    #[test]
    fn test_read_u16() {
        let mut mem = CpuMemory::new_stm32f103();
        mem.write_u8(0x2000_0000, 0x34).unwrap();
        mem.write_u8(0x2000_0001, 0x12).unwrap();
        // Little-endian: 0x1234
        assert_eq!(mem.read_u16(0x2000_0000).unwrap(), 0x1234);
    }

    #[test]
    fn test_read_u32() {
        let mut mem = CpuMemory::new_stm32f103();
        mem.write_u32(0x2000_0000, 0xDEAD_BEEF).unwrap();
        assert_eq!(mem.read_u32(0x2000_0000).unwrap(), 0xDEAD_BEEF);
    }

    #[test]
    fn test_flash_write_fails() {
        let mut mem = CpuMemory::new_stm32f103();
        let result = mem.write_u8(0x0000_0000, 0xFF);
        assert!(result.is_err());
    }

    #[test]
    fn test_bounds_checking() {
        let mut mem = CpuMemory::with_sizes(8, 8);  // 8KB each
        let result = mem.write_u8(0x2000_2000, 0xFF);  // Beyond 8KB SRAM
        assert!(result.is_err());
    }
}
