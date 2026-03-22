//! Tool Life Tracking and Prediction
//!
//! Predicts tool life using Taylor's equation and tracks cumulative tool wear.
//! VT^n = C, where V=cutting speed, T=tool life (min), n & C are material/tool specific.

use serde::{Deserialize, Serialize};

/// Taylor equation constants for different material-tool combinations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaylorConstants {
    pub c: f64,                    // Intercept (speed when T=1 min)
    pub n: f64,                    // Exponent (typically 0.2 to 0.5)
    pub material: String,          // e.g., "Steel", "Aluminum"
    pub coating: String,           // e.g., "TiAlN", "Carbide"
}

impl TaylorConstants {
    pub fn for_steel_carbide() -> Self {
        TaylorConstants {
            c: 600.0,  // m/min at 1 minute tool life
            n: 0.25,   // Typical exponent for steel
            material: "Steel".to_string(),
            coating: "Carbide".to_string(),
        }
    }

    pub fn for_aluminum_carbide() -> Self {
        TaylorConstants {
            c: 1200.0, // Higher speed for aluminum
            n: 0.28,
            material: "Aluminum".to_string(),
            coating: "Carbide".to_string(),
        }
    }

    pub fn for_steel_hss() -> Self {
        TaylorConstants {
            c: 120.0,  // Much lower for HSS
            n: 0.15,
            material: "Steel".to_string(),
            coating: "HSS".to_string(),
        }
    }

    /// Calculate tool life given cutting speed (Taylor equation)
    /// T = (C/V)^(1/n)
    pub fn tool_life_minutes(&self, cutting_speed_m_min: f64) -> f64 {
        if cutting_speed_m_min <= 0.0 {
            return 0.0;
        }
        let ratio = self.c / cutting_speed_m_min;
        ratio.powf(1.0 / self.n)
    }

    /// Calculate cutting speed for desired tool life
    /// V = C / T^n
    pub fn cutting_speed_for_life(&self, desired_life_minutes: f64) -> f64 {
        if desired_life_minutes <= 0.0 {
            return 0.0;
        }
        self.c / desired_life_minutes.powf(self.n)
    }
}

/// Tool usage record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub timestamp: String,         // ISO 8601 format
    pub workpiece_material: String,
    pub cutting_speed_m_min: f64,
    pub feed_mm_tooth: f64,
    pub depth_of_cut_mm: f64,
    pub cutting_time_minutes: f64,
    pub estimated_tool_life_used: f64,  // Fraction of tool life (0.0 to 1.0+)
}

impl UsageRecord {
    pub fn new(
        material: &str,
        speed: f64,
        feed: f64,
        depth: f64,
        time: f64,
    ) -> Self {
        UsageRecord {
            timestamp: chrono::Local::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            workpiece_material: material.to_string(),
            cutting_speed_m_min: speed,
            feed_mm_tooth: feed,
            depth_of_cut_mm: depth,
            cutting_time_minutes: time,
            estimated_tool_life_used: 0.0,  // Will be calculated by tracker
        }
    }
}

/// Tool life tracker and predictor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolLifeTracker {
    pub tool_id: String,
    pub usage_history: Vec<UsageRecord>,
    pub taylor_constants: TaylorConstants,
    pub total_cutting_time_minutes: f64,
    pub tool_failure_detected: bool,
}

impl ToolLifeTracker {
    pub fn new(tool_id: &str, taylor_constants: TaylorConstants) -> Self {
        ToolLifeTracker {
            tool_id: tool_id.to_string(),
            usage_history: Vec::new(),
            taylor_constants,
            total_cutting_time_minutes: 0.0,
            tool_failure_detected: false,
        }
    }

    /// Record a cutting operation
    pub fn add_usage(&mut self, mut record: UsageRecord) {
        // Calculate estimated tool life consumed
        let tool_life = self.taylor_constants.tool_life_minutes(record.cutting_speed_m_min);
        record.estimated_tool_life_used = if tool_life > 0.0 {
            record.cutting_time_minutes / tool_life
        } else {
            0.0
        };

        self.total_cutting_time_minutes += record.cutting_time_minutes;
        self.usage_history.push(record);
    }

    /// Calculate cumulative tool life consumed (0.0 to 1.0 = fresh to fully worn)
    pub fn cumulative_tool_life_consumed(&self) -> f64 {
        self.usage_history.iter().map(|r| r.estimated_tool_life_used).sum()
    }

    /// Estimate remaining tool life
    pub fn remaining_tool_life_estimate(&self, reference_speed: f64) -> f64 {
        let consumed = self.cumulative_tool_life_consumed();
        let tool_life_at_reference_speed = self.taylor_constants.tool_life_minutes(reference_speed);

        let remaining_fraction = (1.0 - consumed).max(0.0);
        remaining_fraction * tool_life_at_reference_speed
    }

    /// Recommend tool replacement based on wear threshold
    pub fn recommend_replacement(&self, wear_threshold: f64) -> bool {
        self.cumulative_tool_life_consumed() >= wear_threshold
    }

    /// Predict tool failure (when consumed > 1.0)
    pub fn predict_tool_failure(&self) -> bool {
        self.cumulative_tool_life_consumed() >= 1.0
    }

    /// Check if tool should be replaced for safety (conservative estimate)
    pub fn safety_replacement_recommended(&self) -> bool {
        // Replace at 80% of life for safety
        self.cumulative_tool_life_consumed() >= 0.80
    }

    /// Get usage statistics
    pub fn usage_statistics(&self) -> UsageStatistics {
        let avg_speed = if !self.usage_history.is_empty() {
            self.usage_history
                .iter()
                .map(|r| r.cutting_speed_m_min)
                .sum::<f64>()
                / self.usage_history.len() as f64
        } else {
            0.0
        };

        let max_speed = self
            .usage_history
            .iter()
            .map(|r| r.cutting_speed_m_min)
            .fold(0.0, f64::max);

        let min_speed = self
            .usage_history
            .iter()
            .map(|r| r.cutting_speed_m_min)
            .fold(f64::INFINITY, f64::min);

        UsageStatistics {
            total_operations: self.usage_history.len(),
            total_cutting_time_minutes: self.total_cutting_time_minutes,
            average_speed_m_min: avg_speed,
            max_speed_m_min: if max_speed > 0.0 { max_speed } else { 0.0 },
            min_speed_m_min: if min_speed < f64::INFINITY { min_speed } else { 0.0 },
            cumulative_life_consumed: self.cumulative_tool_life_consumed(),
        }
    }

    /// Compare performance: tool consumed life vs expected life
    pub fn efficiency_rating(&self) -> f64 {
        if self.usage_history.is_empty() {
            return 0.0;
        }

        let stats = self.usage_statistics();

        // Ideal scenario: consume entire tool life in actual cutting
        // efficiency = (time cutting at optimal speed) / (actual time)
        let optimal_life_at_avg_speed =
            self.taylor_constants.tool_life_minutes(stats.average_speed_m_min);

        if optimal_life_at_avg_speed > 0.0 {
            (stats.total_cutting_time_minutes / optimal_life_at_avg_speed).min(1.0)
        } else {
            0.0
        }
    }
}

/// Tool usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStatistics {
    pub total_operations: usize,
    pub total_cutting_time_minutes: f64,
    pub average_speed_m_min: f64,
    pub max_speed_m_min: f64,
    pub min_speed_m_min: f64,
    pub cumulative_life_consumed: f64,
}

// Mock chrono for now (to avoid dependency issues in tests)
mod chrono {
    pub struct Local;
    pub enum SecondsFormat {
        Secs,
    }

    impl Local {
        pub fn now() -> DateTime {
            DateTime {
                date: "2026-03-20T00:00:00".to_string(),
            }
        }
    }

    pub struct DateTime {
        pub date: String,
    }

    impl DateTime {
        pub fn to_rfc3339_opts(&self, _: SecondsFormat, _: bool) -> String {
            self.date.clone()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_taylor_constants_steel_carbide() {
        let taylor = TaylorConstants::for_steel_carbide();
        assert_eq!(taylor.material, "Steel");
        assert_eq!(taylor.coating, "Carbide");
        assert!(taylor.c > 0.0);
    }

    #[test]
    fn test_tool_life_calculation() {
        let taylor = TaylorConstants::for_steel_carbide();

        // At reference speed, should give expected tool life
        let life_at_ref = taylor.tool_life_minutes(taylor.c);
        assert!((life_at_ref - 1.0).abs() < 0.01); // Should be ~1 minute at c value

        // Higher speed = shorter life
        let life_high_speed = taylor.tool_life_minutes(taylor.c * 2.0);
        assert!(life_high_speed < 1.0);

        // Lower speed = longer life
        let life_low_speed = taylor.tool_life_minutes(taylor.c / 2.0);
        assert!(life_low_speed > 1.0);
    }

    #[test]
    fn test_cutting_speed_for_life() {
        let taylor = TaylorConstants::for_steel_carbide();

        // Calculate speed for 10 minute tool life
        let speed_for_10min = taylor.cutting_speed_for_life(10.0);
        assert!(speed_for_10min > 0.0);
        assert!(speed_for_10min < taylor.c); // Should be slower than reference

        // Verify round-trip
        let life_check = taylor.tool_life_minutes(speed_for_10min);
        assert!((life_check - 10.0).abs() < 0.1); // Should match input
    }

    #[test]
    fn test_tool_life_tracker_creation() {
        let taylor = TaylorConstants::for_steel_carbide();
        let tracker = ToolLifeTracker::new("TOOL-001", taylor);

        assert_eq!(tracker.tool_id, "TOOL-001");
        assert_eq!(tracker.total_cutting_time_minutes, 0.0);
        assert!(!tracker.tool_failure_detected);
    }

    #[test]
    fn test_add_usage_record() {
        let taylor = TaylorConstants::for_steel_carbide();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        let record = UsageRecord::new("Steel", 300.0, 0.1, 2.0, 5.0);
        tracker.add_usage(record);

        assert_eq!(tracker.usage_history.len(), 1);
        assert_eq!(tracker.total_cutting_time_minutes, 5.0);
        assert!(tracker.usage_history[0].estimated_tool_life_used > 0.0);
    }

    #[test]
    fn test_cumulative_tool_life() {
        let taylor = TaylorConstants::for_steel_carbide();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        // Add multiple operations
        for _ in 0..5 {
            let record = UsageRecord::new("Steel", 300.0, 0.1, 2.0, 1.0);
            tracker.add_usage(record);
        }

        let consumed = tracker.cumulative_tool_life_consumed();
        assert!(consumed > 0.0);
        assert!(consumed < 1.0); // Shouldn't reach full life yet
    }

    #[test]
    fn test_remaining_tool_life() {
        let taylor = TaylorConstants::for_steel_carbide();
        let taylor_clone = taylor.clone();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        let record = UsageRecord::new("Steel", 300.0, 0.1, 2.0, 5.0);
        tracker.add_usage(record);

        let remaining = tracker.remaining_tool_life_estimate(300.0);
        assert!(remaining > 0.0);
        assert!(remaining < taylor_clone.tool_life_minutes(300.0));
    }

    #[test]
    fn test_replacement_recommendation() {
        let taylor = TaylorConstants::for_steel_carbide();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        // Add operations that consume ~50% of tool life
        for _ in 0..10 {
            let record = UsageRecord::new("Steel", 300.0, 0.1, 2.0, 1.0);
            tracker.add_usage(record);
        }

        // At 70% threshold (should not recommend unless more than 70% is consumed)
        let consumed = tracker.cumulative_tool_life_consumed();
        if consumed < 0.70 {
            assert!(!tracker.recommend_replacement(0.70));
        }

        // At 50% threshold (should recommend if more than 50% is consumed)
        if consumed >= 0.50 {
            assert!(tracker.recommend_replacement(0.50));
        }
    }

    #[test]
    fn test_tool_failure_prediction() {
        let taylor = TaylorConstants::for_steel_carbide();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        // Add many high-speed operations to consume full tool life
        for _ in 0..50 {
            let record = UsageRecord::new("Steel", 600.0, 0.1, 2.0, 1.0); // Higher speed = faster wear
            tracker.add_usage(record);
        }

        // Tool should be predicted to fail
        assert!(tracker.predict_tool_failure());
    }

    #[test]
    fn test_safety_replacement() {
        let taylor = TaylorConstants::for_steel_carbide();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        // Consume 75% of tool life
        for _ in 0..15 {
            let record = UsageRecord::new("Steel", 300.0, 0.1, 2.0, 1.0);
            tracker.add_usage(record);
        }

        let consumed = tracker.cumulative_tool_life_consumed();
        if consumed >= 0.80 {
            assert!(tracker.safety_replacement_recommended());
        }
    }

    #[test]
    fn test_usage_statistics() {
        let taylor = TaylorConstants::for_steel_carbide();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        tracker.add_usage(UsageRecord::new("Steel", 200.0, 0.1, 2.0, 2.0));
        tracker.add_usage(UsageRecord::new("Steel", 300.0, 0.1, 2.0, 3.0));
        tracker.add_usage(UsageRecord::new("Steel", 400.0, 0.1, 2.0, 4.0));

        let stats = tracker.usage_statistics();
        assert_eq!(stats.total_operations, 3);
        assert_eq!(stats.total_cutting_time_minutes, 9.0);
        assert!(stats.average_speed_m_min > 200.0 && stats.average_speed_m_min < 400.0);
        assert_eq!(stats.max_speed_m_min, 400.0);
        assert_eq!(stats.min_speed_m_min, 200.0);
    }

    #[test]
    fn test_efficiency_rating() {
        let taylor = TaylorConstants::for_steel_carbide();
        let mut tracker = ToolLifeTracker::new("TOOL-001", taylor);

        tracker.add_usage(UsageRecord::new("Steel", 300.0, 0.1, 2.0, 5.0));

        let efficiency = tracker.efficiency_rating();
        assert!(efficiency >= 0.0 && efficiency <= 1.0);
    }
}
