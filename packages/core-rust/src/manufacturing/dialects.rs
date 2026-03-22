/**
 * G-Code Dialect Implementations
 * Machine-specific code generation for different CNC controllers
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::postprocessor::{GCodeBlock, GCodeDialect, PostProcessorConfig};

/// Fanuc dialect specifics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FanucDialect {
    pub program_number_format: ProgramNumberFormat,
    pub block_delete_mode: bool,
    pub tape_stop_enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProgramNumberFormat {
    Short,  // O1 to O9999
    Long,   // O00001 to O99999
}

impl FanucDialect {
    pub fn new() -> Self {
        FanucDialect {
            program_number_format: ProgramNumberFormat::Short,
            block_delete_mode: true,
            tape_stop_enabled: true,
        }
    }

    /// Generate program header
    pub fn program_header(&self, program_number: u32) -> String {
        match self.program_number_format {
            ProgramNumberFormat::Short => format!("O{}\n", program_number),
            ProgramNumberFormat::Long => format!("O{:05}\n", program_number),
        }
    }

    /// Generate program footer
    pub fn program_footer(&self, program_number: u32) -> String {
        format!(
            "M30\nO{}\n",
            match self.program_number_format {
                ProgramNumberFormat::Short => format!("{}", program_number),
                ProgramNumberFormat::Long => format!("{:05}", program_number),
            }
        )
    }

    /// Get optional stop code
    pub fn optional_stop(&self) -> String {
        if self.block_delete_mode {
            "/M01".to_string()
        } else {
            "M01".to_string()
        }
    }

    /// Get program stop code
    pub fn program_stop(&self) -> String {
        if self.tape_stop_enabled {
            "M00".to_string()
        } else {
            "M30".to_string()
        }
    }
}

/// Heidenhain dialect specifics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeidenhainDialect {
    pub metric_format: bool,
    pub arc_center_absolute: bool,
    pub tool_offset_mode: ToolOffsetMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ToolOffsetMode {
    ToolRadius,      // G41/G42
    ToolLength,      // DL compensation
    Combined,
}

impl HeidenhainDialect {
    pub fn new() -> Self {
        HeidenhainDialect {
            metric_format: true,
            arc_center_absolute: true,
            tool_offset_mode: ToolOffsetMode::Combined,
        }
    }

    /// Generate begin function
    pub fn begin_function(&self) -> String {
        "BEGIN PGM ... MM\n".to_string()
    }

    /// Generate tool call
    pub fn tool_call(&self, tool_number: u16) -> String {
        format!("TOOL CALL {} Z\n", tool_number)
    }

    /// Generate path contour start
    pub fn contour_start(&self) -> String {
        "CONTOUR START\n".to_string()
    }

    /// Generate path contour end
    pub fn contour_end(&self) -> String {
        "CONTOUR END\n".to_string()
    }

    /// Generate coordinate format
    pub fn coordinate_format(&self, axis: &str, value: f64, decimals: usize) -> String {
        format!("{} {:.prec$}", axis, value, prec = decimals)
    }

    /// Generate arc command (Heidenhain style)
    pub fn arc_command(
        &self,
        cw: bool,
        end_x: f64,
        end_y: f64,
        center_x: f64,
        center_y: f64,
        decimals: usize,
    ) -> String {
        let cmd = if cw { "CC" } else { "CCW" };
        format!(
            "{} X{:.prec$} Y{:.prec$} I{:.prec$} J{:.prec$}",
            cmd,
            end_x, end_y, center_x, center_y,
            prec = decimals
        )
    }
}

/// Siemens Sinumerik dialect specifics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiemensDialect {
    pub format: SiemensFormat,
    pub macro_enabled: bool,
    pub subprogram_call: bool,
}

/// Mazak CNC dialect specifics (mills and lathes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MazakDialect {
    pub machine_type: MazakMachineType,
    pub metric_format: bool,
    pub high_speed_option: bool,
    pub lathe_threading_mode: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MazakMachineType {
    Mill,         // Mazak mills
    Lathe,        // Mazak lathes (SQT, QTN, etc.)
    MillTurn,     // Combined mill-turn centers
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SiemensFormat {
    ISO,     // Standard ISO format
    SIPL,    // Siemens ISO Plus
    ShopMill, // ShopMill format
}

impl SiemensDialect {
    pub fn new(format: SiemensFormat) -> Self {
        SiemensDialect {
            format,
            macro_enabled: false,
            subprogram_call: false,
        }
    }

    /// Generate program start
    pub fn program_start(&self, program_number: u32) -> String {
        match self.format {
            SiemensFormat::ISO => format!(":{}:ISO\n", program_number),
            SiemensFormat::SIPL => format!(":{}:SIPL\n", program_number),
            SiemensFormat::ShopMill => format!("Program {}\n", program_number),
        }
    }

    /// Generate safety codes
    pub fn safety_codes(&self) -> String {
        match self.format {
            SiemensFormat::ISO => "N10 G17 G21 G90 G94 G80\n".to_string(),
            SiemensFormat::SIPL => "G17 G21 G90 G94 G80\n".to_string(),
            SiemensFormat::ShopMill => "DEF REAL X, Y, Z\n".to_string(),
        }
    }

    /// Generate subroutine call
    pub fn subroutine_call(&self, number: u32) -> String {
        match self.format {
            SiemensFormat::ISO => format!("M98 P{}\n", number),
            SiemensFormat::SIPL => format!("CALL PROG({})\n", number),
            SiemensFormat::ShopMill => format!("CALL PROG({})\n", number),
        }
    }
}

impl MazakDialect {
    pub fn new(machine_type: MazakMachineType) -> Self {
        MazakDialect {
            machine_type,
            metric_format: true,
            high_speed_option: false,
            lathe_threading_mode: machine_type == MazakMachineType::Lathe,
        }
    }

    /// Generate program header for Mazak
    pub fn program_header(&self, program_number: u32) -> String {
        format!("O{}\n", program_number)
    }

    /// Generate program footer
    pub fn program_footer(&self) -> String {
        "M30\n".to_string()
    }

    /// Generate tool call (Mazak format)
    pub fn tool_call(&self, tool_number: u16, offset: u16) -> String {
        match self.machine_type {
            MazakMachineType::Lathe => {
                // Lathe tool call with station number
                format!("T{}{}\n", tool_number, offset)
            }
            _ => {
                // Mill tool call
                format!("T{} M06\n", tool_number)
            }
        }
    }

    /// Generate safety codes for Mazak
    pub fn safety_codes(&self) -> String {
        match self.machine_type {
            MazakMachineType::Mill => "G17 G21 G90 G94 G80\n".to_string(),
            MazakMachineType::Lathe => {
                // Lathe-specific safety (turn off G-codes for lathes are different)
                "G00 G20/G21 G90 G95 G80 G92 E0\n".to_string()
            }
            MazakMachineType::MillTurn => {
                // Mill-Turn center (hybrid)
                "G17 G21 G90 G94 G80\n".to_string()
            }
        }
    }

    /// Threading cycle for Mazak lathe (G76)
    pub fn threading_cycle(
        &self,
        x_start: f64,
        z_start: f64,
        pitch: f64,
        depth: f64,
        passes: u32,
    ) -> String {
        if self.lathe_threading_mode {
            format!(
                "G76 X{:.3} Z{:.3} P{:.2} Q{:.3} F{:.3} (Threading cycle)\n",
                x_start, z_start, pitch, depth, pitch as f64 / passes as f64
            )
        } else {
            String::new()
        }
    }

    /// Generate rapid move with high-speed option
    pub fn rapid_move(&self, x: f64, y: f64, z: f64) -> String {
        if self.high_speed_option {
            format!("G00 X{:.4} Y{:.4} Z{:.4} F99999\n", x, y, z)
        } else {
            format!("G00 X{:.4} Y{:.4} Z{:.4}\n", x, y, z)
        }
    }

    /// Generate linear move
    pub fn linear_move(&self, x: f64, y: f64, z: f64, feedrate: f64) -> String {
        format!(
            "G01 X{:.4} Y{:.4} Z{:.4} F{:.1}\n",
            x, y, z, feedrate
        )
    }
}

/// Dialect capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialectCapabilities {
    pub supports_arcs: bool,
    pub supports_canned_cycles: bool,
    pub supports_tool_offsets: bool,
    pub supports_macros: bool,
    pub supports_subroutines: bool,
    pub max_decimal_places: usize,
    pub supports_incremental: bool,
}

impl DialectCapabilities {
    pub fn for_dialect(dialect: GCodeDialect) -> Self {
        match dialect {
            GCodeDialect::Fanuc => DialectCapabilities {
                supports_arcs: true,
                supports_canned_cycles: true,
                supports_tool_offsets: true,
                supports_macros: true,
                supports_subroutines: true,
                max_decimal_places: 4,
                supports_incremental: true,
            },
            GCodeDialect::Heidenhain => DialectCapabilities {
                supports_arcs: true,
                supports_canned_cycles: false,
                supports_tool_offsets: true,
                supports_macros: false,
                supports_subroutines: true,
                max_decimal_places: 3,
                supports_incremental: true,
            },
            GCodeDialect::Siemens => DialectCapabilities {
                supports_arcs: true,
                supports_canned_cycles: true,
                supports_tool_offsets: true,
                supports_macros: true,
                supports_subroutines: true,
                max_decimal_places: 4,
                supports_incremental: true,
            },
            GCodeDialect::Mazak => DialectCapabilities {
                supports_arcs: true,
                supports_canned_cycles: true,  // Mazak supports G76 threading, drilling cycles
                supports_tool_offsets: true,
                supports_macros: true,
                supports_subroutines: true,
                max_decimal_places: 4,
                supports_incremental: true,
            },
            GCodeDialect::Custom => DialectCapabilities {
                supports_arcs: true,
                supports_canned_cycles: true,
                supports_tool_offsets: true,
                supports_macros: false,
                supports_subroutines: false,
                max_decimal_places: 4,
                supports_incremental: true,
            },
        }
    }
}

/// Converter between dialects
pub struct DialectConverter;

impl DialectConverter {
    /// Convert Fanuc to Heidenhain
    pub fn fanuc_to_heidenhain(fanuc_block: &GCodeBlock) -> GCodeBlock {
        // Simplified conversion
        let mut heidenhain_block = GCodeBlock::new();

        for cmd in &fanuc_block.commands {
            // Convert common commands
            let converted = match cmd.as_str() {
                "G00" => "RAPID".to_string(),
                "G01" => "LIN".to_string(),
                "G02" => "CW".to_string(),
                "G03" => "CCW".to_string(),
                _ => cmd.clone(),
            };
            heidenhain_block = heidenhain_block.add_command(converted);
        }

        heidenhain_block
    }

    /// Convert Heidenhain to Fanuc
    pub fn heidenhain_to_fanuc(heidenhain_block: &GCodeBlock) -> GCodeBlock {
        let mut fanuc_block = GCodeBlock::new();

        for cmd in &heidenhain_block.commands {
            let converted = match cmd.as_str() {
                "RAPID" => "G00".to_string(),
                "LIN" => "G01".to_string(),
                "CW" => "G02".to_string(),
                "CCW" => "G03".to_string(),
                _ => cmd.clone(),
            };
            fanuc_block = fanuc_block.add_command(converted);
        }

        fanuc_block
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fanuc_dialect() {
        let fanuc = FanucDialect::new();
        let header = fanuc.program_header(1001);
        assert!(header.contains("O1001"));
    }

    #[test]
    fn test_heidenhain_dialect() {
        let heidenhain = HeidenhainDialect::new();
        let tool_call = heidenhain.tool_call(5);
        assert!(tool_call.contains("TOOL CALL 5"));
    }

    #[test]
    fn test_siemens_dialect() {
        let siemens = SiemensDialect::new(SiemensFormat::ISO);
        let start = siemens.program_start(100);
        assert!(start.contains("ISO"));
    }

    #[test]
    fn test_dialect_capabilities() {
        let fanuc_cap = DialectCapabilities::for_dialect(GCodeDialect::Fanuc);
        assert!(fanuc_cap.supports_macros);

        let heidenhain_cap = DialectCapabilities::for_dialect(GCodeDialect::Heidenhain);
        assert!(!heidenhain_cap.supports_macros);
    }

    #[test]
    fn test_converter() {
        let mut block = GCodeBlock::new().add_command("G00".to_string());
        let heidenhain = DialectConverter::fanuc_to_heidenhain(&block);
        assert!(heidenhain.commands[0].contains("RAPID"));

        let back_to_fanuc = DialectConverter::heidenhain_to_fanuc(&heidenhain);
        assert!(back_to_fanuc.commands[0].contains("G00"));
    }

    #[test]
    fn test_mazak_mill_dialect() {
        let mazak = MazakDialect::new(MazakMachineType::Mill);
        assert_eq!(mazak.machine_type, MazakMachineType::Mill);
        assert!(mazak.metric_format);

        let header = mazak.program_header(1005);
        assert!(header.contains("O1005"));

        let safety = mazak.safety_codes();
        assert!(safety.contains("G17"));
    }

    #[test]
    fn test_mazak_lathe_dialect() {
        let mazak = MazakDialect::new(MazakMachineType::Lathe);
        assert_eq!(mazak.machine_type, MazakMachineType::Lathe);
        assert!(mazak.lathe_threading_mode);

        let safety = mazak.safety_codes();
        assert!(safety.contains("G95")); // Lathe uses G95 (feed/rev)

        let threading = mazak.threading_cycle(0.0, 10.0, 1.5, 0.5, 5);
        assert!(threading.contains("G76"));
    }

    #[test]
    fn test_mazak_mill_turn_dialect() {
        let mazak = MazakDialect::new(MazakMachineType::MillTurn);
        assert_eq!(mazak.machine_type, MazakMachineType::MillTurn);

        let tool_call_mill = mazak.tool_call(1, 1);
        assert!(tool_call_mill.contains("T1"));
    }

    #[test]
    fn test_mazak_rapid_move() {
        let mazak = MazakDialect::new(MazakMachineType::Mill);
        let move_cmd = mazak.rapid_move(50.0, 25.0, 10.0);
        assert!(move_cmd.contains("G00"));
        assert!(move_cmd.contains("X50.0000"));
        assert!(move_cmd.contains("Y25.0000"));
        assert!(move_cmd.contains("Z10.0000"));
    }

    #[test]
    fn test_mazak_linear_move() {
        let mazak = MazakDialect::new(MazakMachineType::Mill);
        let move_cmd = mazak.linear_move(50.0, 25.0, 10.0, 300.0);
        assert!(move_cmd.contains("G01"));
        assert!(move_cmd.contains("F300.0"));
    }

    #[test]
    fn test_mazak_high_speed_option() {
        let mut mazak = MazakDialect::new(MazakMachineType::Mill);
        mazak.high_speed_option = true;

        let move_cmd = mazak.rapid_move(50.0, 25.0, 10.0);
        assert!(move_cmd.contains("F99999"));
    }

    #[test]
    fn test_mazak_lathe_tool_call() {
        let mazak = MazakDialect::new(MazakMachineType::Lathe);
        let tool_call = mazak.tool_call(3, 2);
        assert!(tool_call.contains("T32"));
    }

    #[test]
    fn test_mazak_dialect_capabilities() {
        let cap = DialectCapabilities::for_dialect(GCodeDialect::Mazak);
        assert!(cap.supports_canned_cycles);
        assert!(cap.supports_macros);
        assert!(cap.supports_subroutines);
        assert_eq!(cap.max_decimal_places, 4);
    }
}
