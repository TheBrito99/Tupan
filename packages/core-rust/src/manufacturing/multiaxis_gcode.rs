//! Multi-Axis G-Code Generation
//!
//! Generates 4-axis and 5-axis G-code for CNC machines with rotary axes.
//! Supports different machine types and G-code dialects.
//! Includes TCPC (Tool Center Point Control) modes.

use serde::{Deserialize, Serialize};
use crate::manufacturing::postprocessor::{GCodeBlock, GCodeDialect, PostProcessorConfig};
use crate::manufacturing::multi_axis::{Point6D, ToolOrientation};

/// TCPC (Tool Center Point Control) mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TCPCMode {
    /// No TCPC - tool moves with rotary axes shift TCP
    Off,

    /// G43.4 (Fanuc) or equivalent - maintains TCP during rotation
    On,

    /// Plane-specific TCPC (maintain TCP in specific plane)
    PlaneSpecific,

    /// Dynamic TCPC - adjusts based on tool orientation
    Dynamic,
}

/// Multi-axis G-code configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiAxisConfig {
    /// TCPC mode
    pub tcpc_mode: TCPCMode,

    /// Rapid rate for A/B/C axes (degrees/second)
    pub rapid_rotation_rate: f64,

    /// Feed rate for simultaneous multi-axis moves (mm/min)
    pub feed_rate_simultaneous: f64,

    /// Dwell time after indexing moves (milliseconds)
    pub dwell_after_index: f64,

    /// Decimal places for rotary axes (usually 3 or 4)
    pub rotation_decimals: usize,

    /// Include orientation comments in G-code
    pub orientation_comments: bool,

    /// Maximum tool tilt for safety check (degrees)
    pub max_tilt: f64,
}

impl Default for MultiAxisConfig {
    fn default() -> Self {
        MultiAxisConfig {
            tcpc_mode: TCPCMode::Off,
            rapid_rotation_rate: 180.0,  // degrees/sec
            feed_rate_simultaneous: 200.0, // mm/min
            dwell_after_index: 500.0,   // 500ms
            rotation_decimals: 3,
            orientation_comments: true,
            max_tilt: 90.0,
        }
    }
}

/// Multi-axis G-code generator
pub struct MultiAxisGCodeGenerator {
    config: MultiAxisConfig,
    postprocessor_config: PostProcessorConfig,
}

impl MultiAxisGCodeGenerator {
    /// Create a new multi-axis G-code generator
    pub fn new(config: MultiAxisConfig, postprocessor_config: PostProcessorConfig) -> Self {
        MultiAxisGCodeGenerator {
            config,
            postprocessor_config,
        }
    }

    /// Create with default configuration
    pub fn default_config(dialect: GCodeDialect) -> Self {
        MultiAxisGCodeGenerator {
            config: MultiAxisConfig::default(),
            postprocessor_config: PostProcessorConfig::new(dialect),
        }
    }

    /// Generate TCPC header for machine
    pub fn tcpc_header(&self) -> String {
        match self.config.tcpc_mode {
            TCPCMode::Off => String::new(),
            TCPCMode::On => match self.postprocessor_config.dialect {
                GCodeDialect::Fanuc => "G43.4 H1".to_string(),
                GCodeDialect::Heidenhain => "TCOMP".to_string(),
                GCodeDialect::Siemens => "TCOMP ON".to_string(),
                GCodeDialect::Mazak => "G43.4 H1".to_string(),  // Mazak uses same as Fanuc
                GCodeDialect::Custom => "TCPC ON".to_string(),
            },
            TCPCMode::PlaneSpecific => "G43.5".to_string(),
            TCPCMode::Dynamic => "TCPC DYNAMIC".to_string(),
        }
    }

    /// Generate a rapid move (G00) with multi-axis support
    pub fn rapid_move(&self, position: &Point6D, comment: Option<&str>) -> GCodeBlock {
        let mut block = GCodeBlock::new();
        block = block.add_command("G00".to_string());

        // Linear axes
        let decimal = self.postprocessor_config.decimal_places;
        block = block.add_command(format!("X{:.prec$}", position.x, prec = decimal));
        block = block.add_command(format!("Y{:.prec$}", position.y, prec = decimal));
        block = block.add_command(format!("Z{:.prec$}", position.z, prec = decimal));

        // Rotary axes
        let rot_decimal = self.config.rotation_decimals;
        if position.a.abs() > 1e-6 {
            block = block.add_command(format!("A{:.prec$}", position.a, prec = rot_decimal));
        }
        if position.b.abs() > 1e-6 {
            block = block.add_command(format!("B{:.prec$}", position.b, prec = rot_decimal));
        }
        if position.c.abs() > 1e-6 {
            block = block.add_command(format!("C{:.prec$}", position.c, prec = rot_decimal));
        }

        if let Some(cmnt) = comment {
            block.comment = Some(cmnt.to_string());
        }

        block
    }

    /// Generate a linear move (G01) with multi-axis support
    pub fn linear_move(
        &self,
        position: &Point6D,
        feedrate: f64,
        comment: Option<&str>,
    ) -> GCodeBlock {
        let mut block = GCodeBlock::new();
        block = block.add_command("G01".to_string());

        // Linear axes
        let decimal = self.postprocessor_config.decimal_places;
        block = block.add_command(format!("X{:.prec$}", position.x, prec = decimal));
        block = block.add_command(format!("Y{:.prec$}", position.y, prec = decimal));
        block = block.add_command(format!("Z{:.prec$}", position.z, prec = decimal));

        // Rotary axes (simultaneous 5-axis)
        let rot_decimal = self.config.rotation_decimals;
        if position.a.abs() > 1e-6 || position.b.abs() > 1e-6 || position.c.abs() > 1e-6 {
            if position.a.abs() > 1e-6 {
                block = block.add_command(format!("A{:.prec$}", position.a, prec = rot_decimal));
            }
            if position.b.abs() > 1e-6 {
                block = block.add_command(format!("B{:.prec$}", position.b, prec = rot_decimal));
            }
            if position.c.abs() > 1e-6 {
                block = block.add_command(format!("C{:.prec$}", position.c, prec = rot_decimal));
            }
        }

        block = block.add_command(format!("F{:.0}", feedrate));

        if let Some(cmnt) = comment {
            block.comment = Some(cmnt.to_string());
        }

        block
    }

    /// Generate an indexed 4-axis move (index then cut)
    pub fn indexed_move(
        &self,
        position: &Point6D,
        index_axis: char, // 'A', 'B', or 'C'
        comment: Option<&str>,
    ) -> Vec<GCodeBlock> {
        let mut blocks = Vec::new();

        // Rapid to safe height
        let mut safe_pos = *position;
        safe_pos.z += 10.0;

        blocks.push(self.rapid_move(&safe_pos, Some(&format!("Safe height for {}-axis index", index_axis))));

        // Index the rotary axis
        let mut index_pos = safe_pos;
        match index_axis {
            'A' => index_pos.a = position.a,
            'B' => index_pos.b = position.b,
            'C' => index_pos.c = position.c,
            _ => {}
        }

        blocks.push(self.rapid_move(&index_pos, Some(&format!("Index {}-axis", index_axis))));

        // Add dwell after index
        if self.config.dwell_after_index > 0.0 {
            let mut dwell_block = GCodeBlock::new();
            dwell_block = dwell_block.add_command(format!("G04 P{:.3}", self.config.dwell_after_index / 1000.0));
            blocks.push(dwell_block);
        }

        // Move to cutting position
        blocks.push(self.rapid_move(position, comment));

        blocks
    }

    /// Generate tool orientation comment (for reference)
    pub fn orientation_comment(&self, orientation: &ToolOrientation) -> String {
        if self.config.orientation_comments {
            format!(
                "( Tool orientation: Lead {:.2}° Tilt {:.2}° )",
                orientation.lead_angle,
                orientation.tilt_angle
            )
        } else {
            String::new()
        }
    }

    /// Generate rotary axis position comment
    pub fn rotary_comment(&self, position: &Point6D) -> String {
        format!(
            "( Rotary: A{:.prec$} B{:.prec$} C{:.prec$} )",
            position.a,
            position.b,
            position.c,
            prec = self.config.rotation_decimals
        )
    }

    /// Validate tool orientation against machine limits
    pub fn validate_orientation(&self, orientation: &ToolOrientation) -> Result<(), String> {
        let max_tilt = self.config.max_tilt;

        if orientation.lead_angle.abs() > max_tilt {
            return Err(format!(
                "Lead angle {:.2}° exceeds limit {:.2}°",
                orientation.lead_angle, max_tilt
            ));
        }

        if orientation.tilt_angle.abs() > max_tilt {
            return Err(format!(
                "Tilt angle {:.2}° exceeds limit {:.2}°",
                orientation.tilt_angle, max_tilt
            ));
        }

        Ok(())
    }

    /// Generate segment motion commands for 4-axis indexed
    pub fn generate_indexed_4axis(
        &self,
        from: &Point6D,
        to: &Point6D,
        index_angle_changes: &[(char, f64)], // Vector of (axis, angle) changes
        feedrate: f64,
    ) -> Vec<GCodeBlock> {
        let mut blocks = Vec::new();

        // For each index change
        for (axis, _angle) in index_angle_changes {
            let moves = self.indexed_move(to, *axis, Some("Indexed 4-axis move"));
            blocks.extend(moves);
        }

        // Move to final position
        blocks.push(self.linear_move(to, feedrate, Some("Cutting move")));

        blocks
    }

    /// Generate simultaneous 5-axis moves
    pub fn generate_simultaneous_5axis(
        &self,
        from: &Point6D,
        to: &Point6D,
        feedrate: f64,
    ) -> GCodeBlock {
        self.linear_move(to, feedrate, Some("Simultaneous 5-axis move"))
    }

    /// Validate position against machine limits
    pub fn validate_position(&self, position: &Point6D) -> Result<(), String> {
        // Check rotary axis limits (example: ±180° for A/B, ±360° for C)
        if position.a.abs() > 180.0 {
            return Err(format!("A-axis {:.2}° exceeds ±180°", position.a));
        }

        if position.b.abs() > 180.0 {
            return Err(format!("B-axis {:.2}° exceeds ±180°", position.b));
        }

        if position.c.abs() > 360.0 {
            return Err(format!("C-axis {:.2}° exceeds ±360°", position.c));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multiaxis_config_default() {
        let config = MultiAxisConfig::default();
        assert_eq!(config.tcpc_mode, TCPCMode::Off);
        assert_eq!(config.rotation_decimals, 3);
        assert!(config.orientation_comments);
    }

    #[test]
    fn test_multiaxis_generator_creation() {
        let config = MultiAxisConfig::default();
        let post_config = PostProcessorConfig::new(GCodeDialect::Fanuc);
        let gen = MultiAxisGCodeGenerator::new(config, post_config);

        assert_eq!(gen.config.tcpc_mode, TCPCMode::Off);
    }

    #[test]
    fn test_tcpc_header_off() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let header = gen.tcpc_header();
        assert!(header.is_empty());
    }

    #[test]
    fn test_tcpc_header_fanuc() {
        let mut config = MultiAxisConfig::default();
        config.tcpc_mode = TCPCMode::On;
        let post_config = PostProcessorConfig::new(GCodeDialect::Fanuc);
        let gen = MultiAxisGCodeGenerator::new(config, post_config);

        let header = gen.tcpc_header();
        assert_eq!(header, "G43.4 H1");
    }

    #[test]
    fn test_tcpc_header_heidenhain() {
        let mut config = MultiAxisConfig::default();
        config.tcpc_mode = TCPCMode::On;
        let post_config = PostProcessorConfig::new(GCodeDialect::Heidenhain);
        let gen = MultiAxisGCodeGenerator::new(config, post_config);

        let header = gen.tcpc_header();
        assert_eq!(header, "TCOMP");
    }

    #[test]
    fn test_rapid_move_3axis() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let pos = Point6D::linear(10.0, 20.0, 5.0);

        let block = gen.rapid_move(&pos, None);

        assert!(block.commands.contains(&"G00".to_string()));
        assert!(block.commands.iter().any(|cmd| cmd.starts_with("X")));
        assert!(block.commands.iter().any(|cmd| cmd.starts_with("Y")));
        assert!(block.commands.iter().any(|cmd| cmd.starts_with("Z")));
    }

    #[test]
    fn test_rapid_move_4axis() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let pos = Point6D::with_a_axis(10.0, 20.0, 5.0, 45.0);

        let block = gen.rapid_move(&pos, None);

        assert!(block.commands.contains(&"G00".to_string()));
        assert!(block.commands.iter().any(|cmd| cmd.starts_with("A")));
        assert!(block.commands.iter().any(|cmd| cmd.starts_with("X")));
    }

    #[test]
    fn test_linear_move_with_feedrate() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let pos = Point6D::linear(15.0, 25.0, 8.0);

        let block = gen.linear_move(&pos, 500.0, None);

        assert!(block.commands.contains(&"G01".to_string()));
        assert!(block.commands.contains(&"F500".to_string()));
    }

    #[test]
    fn test_simultaneous_5axis() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let from = Point6D::linear(10.0, 10.0, 10.0);
        let to = Point6D::with_ac_axes(20.0, 20.0, 5.0, 30.0, 45.0);

        let block = gen.generate_simultaneous_5axis(&from, &to, 200.0);

        assert!(block.commands.contains(&"G01".to_string()));
        assert!(block.commands.iter().any(|cmd| cmd.starts_with("A")));
        assert!(block.commands.iter().any(|cmd| cmd.starts_with("C")));
        assert!(block.commands.contains(&"F200".to_string()));
    }

    #[test]
    fn test_indexed_4axis_moves() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let from = Point6D::linear(10.0, 10.0, 10.0);
        let to = Point6D::with_a_axis(10.0, 10.0, 10.0, 90.0);

        let moves = gen.indexed_move(&to, 'A', None);

        assert!(moves.len() > 0);
        assert!(moves.iter().any(|b| b.commands.contains(&"G00".to_string())));
    }

    #[test]
    fn test_orientation_comment() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let orient = ToolOrientation::tilted(15.0, 30.0);

        let comment = gen.orientation_comment(&orient);

        assert!(comment.contains("15.00"));
        assert!(comment.contains("30.00"));
    }

    #[test]
    fn test_validate_orientation_valid() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let orient = ToolOrientation::tilted(30.0, 45.0);

        let result = gen.validate_orientation(&orient);

        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_orientation_invalid() {
        let mut config = MultiAxisConfig::default();
        config.max_tilt = 30.0;
        let post_config = PostProcessorConfig::new(GCodeDialect::Fanuc);
        let gen = MultiAxisGCodeGenerator::new(config, post_config);

        let orient = ToolOrientation::tilted(45.0, 0.0);

        let result = gen.validate_orientation(&orient);

        assert!(result.is_err());
    }

    #[test]
    fn test_validate_position_valid() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let pos = Point6D::full(50.0, 60.0, 10.0, 45.0, 90.0, 180.0);

        let result = gen.validate_position(&pos);

        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_position_a_axis_exceeded() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let pos = Point6D::full(50.0, 60.0, 10.0, 200.0, 0.0, 0.0);

        let result = gen.validate_position(&pos);

        assert!(result.is_err());
    }

    #[test]
    fn test_rotary_comment() {
        let gen = MultiAxisGCodeGenerator::default_config(GCodeDialect::Fanuc);
        let pos = Point6D::full(10.0, 20.0, 5.0, 30.0, 45.0, 60.0);

        let comment = gen.rotary_comment(&pos);

        assert!(comment.contains("30.000"));
        assert!(comment.contains("45.000"));
        assert!(comment.contains("60.000"));
    }
}
