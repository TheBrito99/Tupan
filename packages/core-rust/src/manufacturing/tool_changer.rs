/**
 * Tool Changer - Tool Change Sequence Optimization
 * Minimizes tool changes and machine time
 */

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

/// Tool station
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolStation {
    pub station_number: u16,
    pub tool_id: Option<String>,
    pub max_tool_length: f64,
    pub max_tool_diameter: f64,
}

impl ToolStation {
    pub fn new(station: u16, max_length: f64, max_diameter: f64) -> Self {
        ToolStation {
            station_number: station,
            tool_id: None,
            max_tool_length: max_length,
            max_tool_diameter: max_diameter,
        }
    }

    pub fn load_tool(&mut self, tool_id: String) {
        self.tool_id = Some(tool_id);
    }

    pub fn unload_tool(&mut self) {
        self.tool_id = None;
    }

    pub fn is_empty(&self) -> bool {
        self.tool_id.is_none()
    }
}

/// Tool magazine (ATC - Automatic Tool Changer)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMagazine {
    pub magazine_type: MagazineType,
    pub stations: HashMap<u16, ToolStation>,
    pub current_tool: Option<String>,
    pub change_time: f64, // seconds
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MagazineType {
    Linear,     // Line of tools
    Carousel,   // Rotating carousel
    Chain,      // Chain-type magazine
    Random,     // Random access (fast)
}

impl ToolMagazine {
    pub fn new(magazine_type: MagazineType, num_stations: u16) -> Self {
        let mut stations = HashMap::new();
        for i in 1..=num_stations {
            stations.insert(i, ToolStation::new(i, 100.0, 20.0));
        }

        ToolMagazine {
            magazine_type,
            stations,
            current_tool: None,
            change_time: 5.0, // Default 5 seconds
        }
    }

    /// Load tool into specific station
    pub fn load_at_station(&mut self, station: u16, tool_id: String) -> Result<(), String> {
        if let Some(slot) = self.stations.get_mut(&station) {
            slot.load_tool(tool_id);
            Ok(())
        } else {
            Err(format!("Station {} not found", station))
        }
    }

    /// Find tool station
    pub fn find_tool(&self, tool_id: &str) -> Option<u16> {
        self.stations
            .iter()
            .find(|(_, station)| {
                station.tool_id.as_ref().map_or(false, |id| id == tool_id)
            })
            .map(|(num, _)| *num)
    }

    /// Get change time between two tools
    pub fn change_time_between(&self, from_tool: &str, to_tool: &str) -> f64 {
        let from_station = self.find_tool(from_tool);
        let to_station = self.find_tool(to_tool);

        match (from_station, to_station) {
            (Some(from), Some(to)) => {
                let distance = Self::station_distance(from, to, self.magazine_type);
                distance * 0.5 + self.change_time // Distance factor + base time
            }
            _ => self.change_time,
        }
    }

    /// Calculate distance between stations
    fn station_distance(from: u16, to: u16, magazine_type: MagazineType) -> f64 {
        match magazine_type {
            MagazineType::Linear => ((from as i32 - to as i32).abs() as f64) * 0.5,
            MagazineType::Carousel => {
                let diff = ((from as i32 - to as i32).abs()) as f64;
                diff.min(24.0 - diff) * 0.3
            }
            MagazineType::Chain => ((from as i32 - to as i32).abs() as f64) * 0.4,
            MagazineType::Random => 0.1, // Fast access
        }
    }

    /// List loaded tools
    pub fn loaded_tools(&self) -> Vec<(u16, String)> {
        self.stations
            .iter()
            .filter_map(|(station, slot)| {
                slot.tool_id.as_ref().map(|id| (*station, id.clone()))
            })
            .collect()
    }

    /// Get available stations
    pub fn available_stations(&self) -> Vec<u16> {
        self.stations
            .iter()
            .filter(|(_, slot)| slot.is_empty())
            .map(|(num, _)| *num)
            .collect()
    }

    /// Station count
    pub fn capacity(&self) -> usize {
        self.stations.len()
    }
}

/// Tool change optimization
pub struct ToolChangeOptimizer;

impl ToolChangeOptimizer {
    /// Optimize tool sequence to minimize changes
    pub fn optimize_sequence(
        tool_sequence: Vec<String>,
        magazine: &ToolMagazine,
    ) -> (Vec<String>, f64) {
        let mut optimized = Vec::new();
        let mut total_change_time = 0.0;
        let mut current_tool: Option<String> = None;

        for tool in tool_sequence {
            if let Some(ref curr) = current_tool {
                if curr == &tool {
                    // Same tool, no change needed
                    continue;
                }
            }

            // Check if tool is in magazine
            if magazine.find_tool(&tool).is_some() {
                if let Some(curr) = current_tool.as_ref() {
                    let change_time = magazine.change_time_between(curr, &tool);
                    total_change_time += change_time;
                }
                optimized.push(tool.clone());
                current_tool = Some(tool);
            }
        }

        (optimized, total_change_time)
    }

    /// Calculate minimum tools needed
    pub fn tools_needed(tool_sequence: &[String]) -> usize {
        let mut unique_tools = std::collections::HashSet::new();
        for tool in tool_sequence {
            unique_tools.insert(tool.clone());
        }
        unique_tools.len()
    }

    /// Group operations by tool
    pub fn group_by_tool(
        tool_sequence: Vec<(usize, String)>, // (operation_id, tool_id)
    ) -> HashMap<String, Vec<usize>> {
        let mut groups: HashMap<String, Vec<usize>> = HashMap::new();
        for (op_id, tool) in tool_sequence {
            groups.entry(tool).or_insert_with(Vec::new).push(op_id);
        }
        groups
    }

    /// Determine optimal tool change points
    pub fn find_change_points(tool_sequence: &[String]) -> Vec<usize> {
        let mut changes = Vec::new();
        for i in 1..tool_sequence.len() {
            if tool_sequence[i] != tool_sequence[i - 1] {
                changes.push(i);
            }
        }
        changes
    }

    /// Estimate total change time
    pub fn estimate_total_change_time(
        tool_sequence: &[String],
        magazine: &ToolMagazine,
    ) -> f64 {
        let mut total = 0.0;
        for i in 1..tool_sequence.len() {
            if tool_sequence[i] != tool_sequence[i - 1] {
                total += magazine.change_time_between(&tool_sequence[i - 1], &tool_sequence[i]);
            }
        }
        total
    }

    /// Get tool rack layout recommendation
    pub fn recommend_layout(
        tool_sequence: &[String],
        magazine: &ToolMagazine,
    ) -> Vec<(u16, String)> {
        // Tools used most frequently in sequence should be closest
        let mut tool_counts: HashMap<String, u16> = HashMap::new();
        for tool in tool_sequence {
            *tool_counts.entry(tool.clone()).or_insert(0) += 1;
        }

        // Sort by frequency
        let mut sorted: Vec<_> = tool_counts.iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(a.1));

        // Assign to best stations
        sorted
            .iter()
            .enumerate()
            .map(|(idx, (tool, _))| {
                let station = (idx as u16) + 1;
                (station.min(magazine.capacity() as u16), tool.to_string())
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_station_creation() {
        let station = ToolStation::new(1, 100.0, 20.0);
        assert_eq!(station.station_number, 1);
        assert!(station.is_empty());
    }

    #[test]
    fn test_tool_magazine_creation() {
        let magazine = ToolMagazine::new(MagazineType::Carousel, 12);
        assert_eq!(magazine.capacity(), 12);
    }

    #[test]
    fn test_load_tool() {
        let mut magazine = ToolMagazine::new(MagazineType::Linear, 8);
        assert!(magazine.load_at_station(1, "tool_1".to_string()).is_ok());
        assert_eq!(magazine.find_tool("tool_1"), Some(1));
    }

    #[test]
    fn test_change_time_between() {
        let mut magazine = ToolMagazine::new(MagazineType::Linear, 8);
        magazine.load_at_station(1, "tool_1".to_string()).unwrap();
        magazine.load_at_station(4, "tool_2".to_string()).unwrap();

        let time = magazine.change_time_between("tool_1", "tool_2");
        assert!(time > 0.0);
    }

    #[test]
    fn test_optimize_sequence() {
        let mut magazine = ToolMagazine::new(MagazineType::Carousel, 4);
        magazine.load_at_station(1, "endmill".to_string()).unwrap();
        magazine.load_at_station(2, "drill".to_string()).unwrap();

        let sequence = vec![
            "endmill".to_string(),
            "endmill".to_string(),
            "drill".to_string(),
            "drill".to_string(),
        ];

        let (optimized, _time) = ToolChangeOptimizer::optimize_sequence(sequence, &magazine);
        assert_eq!(optimized.len(), 2);
    }

    #[test]
    fn test_tools_needed() {
        let sequence = vec![
            "tool_1".to_string(),
            "tool_2".to_string(),
            "tool_1".to_string(),
        ];
        let count = ToolChangeOptimizer::tools_needed(&sequence);
        assert_eq!(count, 2);
    }

    #[test]
    fn test_find_change_points() {
        let sequence = vec![
            "tool_1".to_string(),
            "tool_1".to_string(),
            "tool_2".to_string(),
            "tool_2".to_string(),
            "tool_1".to_string(),
        ];

        let changes = ToolChangeOptimizer::find_change_points(&sequence);
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0], 2);
        assert_eq!(changes[1], 4);
    }

    #[test]
    fn test_loaded_tools() {
        let mut magazine = ToolMagazine::new(MagazineType::Linear, 4);
        magazine.load_at_station(1, "tool_1".to_string()).unwrap();
        magazine.load_at_station(3, "tool_2".to_string()).unwrap();

        let loaded = magazine.loaded_tools();
        assert_eq!(loaded.len(), 2);
    }
}
