/**
 * G-Code Post-Processors
 * Phase 19 Task 2: Multi-format CNC code generation
 *
 * Converts generic toolpath into machine-specific G-code formats:
 * - Fanuc/HAAS (NC)
 * - Heidenhain
 * - Siemens
 * - Custom dialects
 */

use serde::{Deserialize, Serialize};
use crate::manufacturing::toolpath::{Toolpath, ToolpathSegment, SegmentType, Point3D};
use std::collections::HashMap;

/// G-code dialect enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GCodeDialect {
    Fanuc,      // HAAS, Fanuc, most mills
    Heidenhain, // iTNC 530, TNC 620
    Siemens,    // Sinumerik
    Mazak,      // Mazak CNC mills and lathes
    Custom,     // User-defined
}

/// G-code format settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostProcessorConfig {
    pub dialect: GCodeDialect,
    pub program_number: u32,
    pub decimal_places: usize,    // 3 or 4 typically
    pub use_canned_cycles: bool,
    pub arc_plane: ArcPlane,
    pub feed_rate_mode: FeedRateMode,
    pub absolute_coordinates: bool,
    pub rapid_rate: f64,          // mm/min for comments
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ArcPlane {
    XY,  // G17
    ZX,  // G18
    YZ,  // G19
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FeedRateMode {
    PerMinute,    // G94 - most common
    PerRevolution, // G95
}

impl Default for PostProcessorConfig {
    fn default() -> Self {
        PostProcessorConfig {
            dialect: GCodeDialect::Fanuc,
            program_number: 1001,
            decimal_places: 3,
            use_canned_cycles: true,
            arc_plane: ArcPlane::XY,
            feed_rate_mode: FeedRateMode::PerMinute,
            absolute_coordinates: true,
            rapid_rate: 10000.0,
        }
    }
}

impl PostProcessorConfig {
    pub fn new(dialect: GCodeDialect) -> Self {
        let mut config = PostProcessorConfig::default();
        config.dialect = dialect;
        config
    }
}

/// G-code block (single line of code)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCodeBlock {
    pub sequence_number: Option<u32>,  // N10, N20, etc.
    pub commands: Vec<String>,         // G00, X10.5, Y20.0, F500, etc.
    pub comment: Option<String>,
}

impl GCodeBlock {
    pub fn new() -> Self {
        GCodeBlock {
            sequence_number: None,
            commands: Vec::new(),
            comment: None,
        }
    }

    pub fn with_sequence(mut self, n: u32) -> Self {
        self.sequence_number = Some(n);
        self
    }

    pub fn add_command(mut self, cmd: String) -> Self {
        self.commands.push(cmd);
        self
    }

    pub fn with_comment(mut self, comment: String) -> Self {
        self.comment = Some(comment);
        self
    }

    pub fn to_string(&self, dialect: GCodeDialect) -> String {
        let mut line = String::new();

        // Sequence number
        if let Some(seq) = self.sequence_number {
            line.push_str(&format!("N{} ", seq));
        }

        // Commands
        line.push_str(&self.commands.join(" "));

        // Comment
        if let Some(ref comment) = self.comment {
            match dialect {
                GCodeDialect::Fanuc | GCodeDialect::Siemens | GCodeDialect::Mazak => {
                    line.push_str(&format!(" ; {}", comment));
                }
                GCodeDialect::Heidenhain => {
                    line.push_str(&format!(" ; {}", comment));
                }
                GCodeDialect::Custom => {
                    line.push_str(&format!(" ; {}", comment));
                }
            }
        }

        line
    }
}

/// G-code program
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCodeProgram {
    pub program_number: u32,
    pub blocks: Vec<GCodeBlock>,
    pub dialect: GCodeDialect,
}

impl GCodeProgram {
    pub fn new(program_number: u32, dialect: GCodeDialect) -> Self {
        GCodeProgram {
            program_number,
            blocks: Vec::new(),
            dialect,
        }
    }

    pub fn add_block(&mut self, block: GCodeBlock) {
        self.blocks.push(block);
    }

    pub fn to_string(&self) -> String {
        let mut output = String::new();

        // Header
        match self.dialect {
            GCodeDialect::Fanuc => {
                output.push_str(&format!("O{:04}\n", self.program_number));
                output.push_str("(Fanuc/HAAS G-Code)\n");
            }
            GCodeDialect::Heidenhain => {
                output.push_str(&format!("{}\n", self.program_number));
                output.push_str("(Heidenhain iTNC)\n");
            }
            GCodeDialect::Siemens => {
                output.push_str(&format!("(Siemens Sinumerik)\n"));
            }
            GCodeDialect::Mazak => {
                output.push_str(&format!("O{:04}\n", self.program_number));
                output.push_str("(Mazak CNC)\n");
            }
            GCodeDialect::Custom => {
                output.push_str(&format!("(Custom G-Code)\n"));
            }
        }

        output.push_str("(Auto-generated from Tupan CAM)\n");
        output.push_str("(Date: Now)\n\n");

        // Blocks
        for block in &self.blocks {
            output.push_str(&block.to_string(self.dialect));
            output.push('\n');
        }

        // Footer
        output.push_str("\nM30\n");
        if self.dialect == GCodeDialect::Fanuc {
            output.push_str(&format!("O{:04}\n", self.program_number));
        }

        output
    }

    pub fn block_count(&self) -> usize {
        self.blocks.len()
    }
}

/// G-code post-processor
pub struct PostProcessor {
    config: PostProcessorConfig,
}

impl PostProcessor {
    pub fn new(config: PostProcessorConfig) -> Self {
        PostProcessor { config }
    }

    /// Convert toolpath to G-code program
    pub fn generate(&self, toolpath: &Toolpath) -> Result<GCodeProgram, String> {
        let mut program = GCodeProgram::new(self.config.program_number, self.config.dialect);

        // Machine initialization
        self.add_initialization(&mut program)?;

        // Toolpath segments
        let mut sequence_number = 10u32;
        let mut last_position = Point3D::new(0.0, 0.0, 0.0);

        for segment in &toolpath.segments {
            let blocks = self.segment_to_gcode(segment, &last_position)?;
            for mut block in blocks {
                block.sequence_number = Some(sequence_number);
                program.add_block(block);
                sequence_number += 10;
            }
            last_position = segment.end;
        }

        Ok(program)
    }

    /// Convert segment to G-code blocks
    fn segment_to_gcode(
        &self,
        segment: &ToolpathSegment,
        last_pos: &Point3D,
    ) -> Result<Vec<GCodeBlock>, String> {
        let mut blocks = Vec::new();

        match segment.segment_type {
            SegmentType::Rapid => {
                let mut block = GCodeBlock::new()
                    .add_command("G00".to_string())
                    .add_command(self.format_coordinate("X", segment.end.x))
                    .add_command(self.format_coordinate("Y", segment.end.y))
                    .add_command(self.format_coordinate("Z", segment.end.z))
                    .with_comment("Rapid move".to_string());
                blocks.push(block);
            }
            SegmentType::Linear => {
                let mut block = GCodeBlock::new()
                    .add_command("G01".to_string())
                    .add_command(self.format_coordinate("X", segment.end.x))
                    .add_command(self.format_coordinate("Y", segment.end.y))
                    .add_command(self.format_coordinate("Z", segment.end.z))
                    .add_command(format!(
                        "F{:.1}",
                        segment.cutting_conditions.feedrate
                    ))
                    .with_comment("Linear cut".to_string());
                blocks.push(block);
            }
            SegmentType::ArcCW | SegmentType::ArcCCW => {
                if let (Some(center), Some(_radius)) = (segment.arc_center, segment.arc_radius) {
                    let g_code = if segment.segment_type == SegmentType::ArcCW {
                        "G02"
                    } else {
                        "G03"
                    };

                    let mut block = GCodeBlock::new()
                        .add_command(g_code.to_string())
                        .add_command(self.format_coordinate("X", segment.end.x))
                        .add_command(self.format_coordinate("Y", segment.end.y))
                        .add_command(self.format_coordinate("Z", segment.end.z))
                        .add_command(self.format_coordinate("I", center.x - last_pos.x))
                        .add_command(self.format_coordinate("J", center.y - last_pos.y))
                        .add_command(format!(
                            "F{:.1}",
                            segment.cutting_conditions.feedrate
                        ))
                        .with_comment("Arc move".to_string());
                    blocks.push(block);
                }
            }
            SegmentType::SpindleStart => {
                let speed = segment.cutting_conditions.spindle_speed.round() as u32;
                let mut block = GCodeBlock::new()
                    .add_command("M03".to_string())
                    .add_command(format!("S{}", speed))
                    .with_comment("Spindle on".to_string());
                blocks.push(block);
            }
            SegmentType::SpindleStop => {
                let block = GCodeBlock::new()
                    .add_command("M05".to_string())
                    .with_comment("Spindle off".to_string());
                blocks.push(block);
            }
            SegmentType::ToolChange => {
                let block = GCodeBlock::new()
                    .add_command("M06".to_string())
                    .with_comment("Tool change".to_string());
                blocks.push(block);
            }
            SegmentType::Dwell => {
                let block = GCodeBlock::new()
                    .add_command("G04".to_string())
                    .add_command(format!("P{:.2}", segment.duration))
                    .with_comment("Dwell".to_string());
                blocks.push(block);
            }
        }

        Ok(blocks)
    }

    /// Format coordinate with precision
    fn format_coordinate(&self, axis: &str, value: f64) -> String {
        format!("{}{:.prec$}", axis, value, prec = self.config.decimal_places)
    }

    /// Add machine initialization code
    fn add_initialization(&self, program: &mut GCodeProgram) -> Result<(), String> {
        // Common initialization for all dialects
        program.add_block(
            GCodeBlock::new()
                .add_command("G20".to_string()) // or G21 for metric
                .with_comment("Inch mode".to_string()),
        );

        program.add_block(
            GCodeBlock::new()
                .add_command("G17".to_string()) // XY plane
                .with_comment("Select XY plane".to_string()),
        );

        program.add_block(
            GCodeBlock::new()
                .add_command("G90".to_string()) // Absolute coordinates
                .with_comment("Absolute coordinates".to_string()),
        );

        program.add_block(
            GCodeBlock::new()
                .add_command("G94".to_string()) // Feedrate per minute
                .with_comment("Feed per minute".to_string()),
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gcode_block_creation() {
        let block = GCodeBlock::new()
            .add_command("G00".to_string())
            .add_command("X10.5".to_string())
            .with_comment("Move".to_string());

        assert_eq!(block.commands.len(), 2);
        assert!(block.comment.is_some());
    }

    #[test]
    fn test_gcode_block_formatting() {
        let block = GCodeBlock::new()
            .with_sequence(10)
            .add_command("G00".to_string())
            .add_command("X10.5".to_string());

        let formatted = block.to_string(GCodeDialect::Fanuc);
        assert!(formatted.contains("N10"));
        assert!(formatted.contains("G00"));
        assert!(formatted.contains("X10.5"));
    }

    #[test]
    fn test_gcode_program_creation() {
        let program = GCodeProgram::new(1001, GCodeDialect::Fanuc);
        assert_eq!(program.program_number, 1001);
        assert_eq!(program.dialect, GCodeDialect::Fanuc);
    }

    #[test]
    fn test_postprocessor_creation() {
        let config = PostProcessorConfig::new(GCodeDialect::Fanuc);
        let pp = PostProcessor::new(config);
        assert_eq!(pp.config.dialect, GCodeDialect::Fanuc);
    }

    #[test]
    fn test_coordinate_formatting() {
        let config = PostProcessorConfig::new(GCodeDialect::Fanuc);
        let pp = PostProcessor::new(config);

        let formatted = pp.format_coordinate("X", 10.5555);
        assert_eq!(formatted, "X10.556");
    }

    #[test]
    fn test_gcode_program_output() {
        let mut program = GCodeProgram::new(1001, GCodeDialect::Fanuc);
        program.add_block(
            GCodeBlock::new()
                .with_sequence(10)
                .add_command("G00".to_string()),
        );

        let output = program.to_string();
        assert!(output.contains("O1001"));
        assert!(output.contains("N10"));
        assert!(output.contains("M30"));
    }
}
