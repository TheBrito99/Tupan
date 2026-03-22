/**
 * Tool Library and Management
 * Comprehensive tool definitions and properties
 */

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Tool type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ToolType {
    FlatEndMill,
    BallEndMill,
    BullnoseEndMill,
    TaperEndMill,
    Drill,
    CenterDrill,
    FacingMill,
    SlotDrill,
    ReamerEndMill,
    ThreadMill,
}

/// Generic tool structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub tool_type: ToolType,
    pub diameter: f64,           // mm
    pub length: f64,             // mm
    pub flute_length: f64,       // mm
    pub num_flutes: usize,
    pub material: String,        // HSS, Carbide, Ceramic
    pub coating: Option<String>, // TiN, TiAlN, etc.
    pub corner_radius: f64,      // mm (for ball/bullnose)
    pub taper_angle: Option<f64>, // degrees (for taper tools)
    pub max_rpm: f64,
    pub max_feedrate: f64,
    pub price: f64,              // cost in USD
}

impl Tool {
    /// Create a new flat end mill
    pub fn flat_endmill(
        id: String,
        name: String,
        diameter: f64,
        flute_length: f64,
        num_flutes: usize,
    ) -> Self {
        Tool {
            id,
            name,
            tool_type: ToolType::FlatEndMill,
            diameter,
            length: flute_length + 10.0,
            flute_length,
            num_flutes,
            material: "Carbide".to_string(),
            coating: Some("TiAlN".to_string()),
            corner_radius: 0.0,
            taper_angle: None,
            max_rpm: 10000.0,
            max_feedrate: 2000.0,
            price: 45.0,
        }
    }

    /// Create a new ball end mill
    pub fn ball_endmill(
        id: String,
        name: String,
        diameter: f64,
        flute_length: f64,
        num_flutes: usize,
    ) -> Self {
        let radius = diameter / 2.0;
        Tool {
            id,
            name,
            tool_type: ToolType::BallEndMill,
            diameter,
            length: flute_length + 10.0,
            flute_length,
            num_flutes,
            material: "Carbide".to_string(),
            coating: Some("TiAlN".to_string()),
            corner_radius: radius,
            taper_angle: None,
            max_rpm: 12000.0,
            max_feedrate: 1800.0,
            price: 55.0,
        }
    }

    /// Create a new drill
    pub fn drill(
        id: String,
        name: String,
        diameter: f64,
        flute_length: f64,
    ) -> Self {
        Tool {
            id,
            name,
            tool_type: ToolType::Drill,
            diameter,
            length: flute_length + 5.0,
            flute_length,
            num_flutes: 2,
            material: "Carbide".to_string(),
            coating: None,
            corner_radius: 0.0,
            taper_angle: None,
            max_rpm: 8000.0,
            max_feedrate: 1200.0,
            price: 20.0,
        }
    }

    /// Get tool cross-sectional area in mm²
    pub fn area(&self) -> f64 {
        let radius = self.diameter / 2.0;
        std::f64::consts::PI * radius * radius
    }

    /// Get chip load factor based on flute count
    pub fn chip_load_factor(&self) -> f64 {
        match self.num_flutes {
            1 => 0.5,
            2 => 0.8,
            3 => 0.9,
            4 => 1.0,
            _ => 1.1,
        }
    }

    /// Estimate tool life in minutes based on cutting speed
    pub fn tool_life_estimate(&self, cutting_speed: f64) -> f64 {
        // Taylor equation: VT^n = C
        // Simplified: life ~ (C / V)^(1/n)
        let c = match self.material.as_str() {
            "HSS" => 50.0,
            "Carbide" => 200.0,
            "Ceramic" => 400.0,
            _ => 100.0,
        };
        let n = 0.25;
        (c / cutting_speed).powf(1.0 / n)
    }
}

/// Flat end mill (cylindrical)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatEndMill {
    pub tool: Tool,
}

/// Ball end mill (hemispherical)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BallEndMill {
    pub tool: Tool,
}

impl FlatEndMill {
    pub fn new(diameter: f64, flute_length: f64, num_flutes: usize) -> Self {
        let tool = Tool::flat_endmill(
            uuid::Uuid::new_v4().to_string(),
            format!("Flat {} mm", diameter),
            diameter,
            flute_length,
            num_flutes,
        );
        FlatEndMill { tool }
    }
}

impl BallEndMill {
    pub fn new(diameter: f64, flute_length: f64, num_flutes: usize) -> Self {
        let tool = Tool::ball_endmill(
            uuid::Uuid::new_v4().to_string(),
            format!("Ball {} mm", diameter),
            diameter,
            flute_length,
            num_flutes,
        );
        BallEndMill { tool }
    }
}

/// Tool library management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolLibrary {
    tools: HashMap<String, Tool>,
}

impl ToolLibrary {
    /// Create empty library
    pub fn new() -> Self {
        ToolLibrary {
            tools: HashMap::new(),
        }
    }

    /// Create library with standard tools
    pub fn with_standard_tools() -> Self {
        let mut lib = ToolLibrary::new();

        // Standard flat end mills
        lib.add_tool(Tool::flat_endmill(
            "flat_1mm".to_string(),
            "Flat 1mm".to_string(),
            1.0,
            3.0,
            2,
        ));
        lib.add_tool(Tool::flat_endmill(
            "flat_2mm".to_string(),
            "Flat 2mm".to_string(),
            2.0,
            6.0,
            2,
        ));
        lib.add_tool(Tool::flat_endmill(
            "flat_4mm".to_string(),
            "Flat 4mm".to_string(),
            4.0,
            12.0,
            4,
        ));

        // Standard ball end mills
        lib.add_tool(Tool::ball_endmill(
            "ball_2mm".to_string(),
            "Ball 2mm".to_string(),
            2.0,
            6.0,
            2,
        ));
        lib.add_tool(Tool::ball_endmill(
            "ball_4mm".to_string(),
            "Ball 4mm".to_string(),
            4.0,
            12.0,
            4,
        ));

        // Standard drills
        lib.add_tool(Tool::drill(
            "drill_2mm".to_string(),
            "Drill 2mm".to_string(),
            2.0,
            4.0,
        ));
        lib.add_tool(Tool::drill(
            "drill_3mm".to_string(),
            "Drill 3mm".to_string(),
            3.2,
            6.0,
        ));

        lib
    }

    /// Add tool to library
    pub fn add_tool(&mut self, tool: Tool) {
        self.tools.insert(tool.id.clone(), tool);
    }

    /// Get tool by ID
    pub fn get_tool(&self, id: &str) -> Option<&Tool> {
        self.tools.get(id)
    }

    /// Get mutable tool
    pub fn get_tool_mut(&mut self, id: &str) -> Option<&mut Tool> {
        self.tools.get_mut(id)
    }

    /// List all tools
    pub fn list_tools(&self) -> Vec<&Tool> {
        self.tools.values().collect()
    }

    /// Find tools by type
    pub fn find_by_type(&self, tool_type: ToolType) -> Vec<&Tool> {
        self.tools
            .values()
            .filter(|t| t.tool_type == tool_type)
            .collect()
    }

    /// Find tools by diameter
    pub fn find_by_diameter(&self, diameter: f64, tolerance: f64) -> Vec<&Tool> {
        self.tools
            .values()
            .filter(|t| (t.diameter - diameter).abs() < tolerance)
            .collect()
    }

    /// Remove tool from library
    pub fn remove_tool(&mut self, id: &str) -> Option<Tool> {
        self.tools.remove(id)
    }

    /// Tool count
    pub fn count(&self) -> usize {
        self.tools.len()
    }
}

impl Default for ToolLibrary {
    fn default() -> Self {
        Self::with_standard_tools()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flat_endmill_creation() {
        let tool = Tool::flat_endmill(
            "test_1".to_string(),
            "Test 1mm".to_string(),
            1.0,
            3.0,
            2,
        );
        assert_eq!(tool.diameter, 1.0);
        assert_eq!(tool.tool_type, ToolType::FlatEndMill);
        assert_eq!(tool.num_flutes, 2);
    }

    #[test]
    fn test_ball_endmill_creation() {
        let tool = Tool::ball_endmill(
            "test_ball".to_string(),
            "Test Ball".to_string(),
            2.0,
            6.0,
            2,
        );
        assert_eq!(tool.diameter, 2.0);
        assert_eq!(tool.tool_type, ToolType::BallEndMill);
        assert_eq!(tool.corner_radius, 1.0);
    }

    #[test]
    fn test_drill_creation() {
        let tool = Tool::drill(
            "test_drill".to_string(),
            "Test Drill".to_string(),
            3.0,
            6.0,
        );
        assert_eq!(tool.diameter, 3.0);
        assert_eq!(tool.tool_type, ToolType::Drill);
        assert_eq!(tool.num_flutes, 2);
    }

    #[test]
    fn test_tool_area() {
        let tool = Tool::flat_endmill(
            "test".to_string(),
            "Test".to_string(),
            2.0,
            6.0,
            2,
        );
        let area = tool.area();
        let expected = std::f64::consts::PI;
        assert!((area - expected).abs() < 0.01);
    }

    #[test]
    fn test_chip_load_factor() {
        let tool2 = Tool::flat_endmill("t2".to_string(), "T2".to_string(), 2.0, 6.0, 2);
        let tool4 = Tool::flat_endmill("t4".to_string(), "T4".to_string(), 2.0, 6.0, 4);

        assert!(tool2.chip_load_factor() < tool4.chip_load_factor());
    }

    #[test]
    fn test_tool_library() {
        let mut lib = ToolLibrary::new();
        let tool = Tool::flat_endmill(
            "test".to_string(),
            "Test".to_string(),
            1.0,
            3.0,
            2,
        );
        lib.add_tool(tool);
        assert_eq!(lib.count(), 1);
        assert!(lib.get_tool("test").is_some());
    }

    #[test]
    fn test_standard_tools() {
        let lib = ToolLibrary::with_standard_tools();
        assert!(lib.count() > 0);
        assert!(lib.find_by_type(ToolType::FlatEndMill).len() > 0);
        assert!(lib.find_by_type(ToolType::Drill).len() > 0);
    }

    #[test]
    fn test_find_by_diameter() {
        let lib = ToolLibrary::with_standard_tools();
        let tools = lib.find_by_diameter(2.0, 0.5);
        assert!(tools.len() > 0);
    }

    #[test]
    fn test_tool_life_estimate() {
        let tool = Tool::flat_endmill(
            "test".to_string(),
            "Test".to_string(),
            2.0,
            6.0,
            2,
        );
        let life = tool.tool_life_estimate(100.0);
        assert!(life > 0.0);
    }
}
