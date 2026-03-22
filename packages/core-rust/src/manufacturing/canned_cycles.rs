/**
 * Canned Cycles
 * Pre-defined CNC cycles for common operations
 */

use serde::{Deserialize, Serialize};

/// Canned cycle type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CannedCycleType {
    Drilling,       // G81 - Basic drill
    DrillWithDwell, // G82 - Drill with dwell at bottom
    PeckDrill,      // G83 - Peck drill (deep holes)
    Boring,         // G85 - Boring (reaming)
    BoringWithDwell, // G86 - Boring with spindle stop
    Tapping,        // G84 - Tapping
    Reaming,        // G85 variant - Reaming
}

/// Hole parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoleParameters {
    pub cycle_type: CannedCycleType,
    pub depth: f64,                  // Total hole depth (mm)
    pub feedrate: f64,               // Feed rate (mm/min)
    pub spindle_speed: f64,          // Spindle speed (RPM)
    pub peck_depth: Option<f64>,     // For peck drilling (mm)
    pub dwell_time: Option<f64>,     // For dwell cycles (seconds)
    pub retract_mode: RetractMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RetractMode {
    RapidToTop,      // G98 - Rapid to initial point
    RapidToClearance, // G99 - Rapid to clearance plane
}

impl HoleParameters {
    pub fn new(
        cycle_type: CannedCycleType,
        depth: f64,
        feedrate: f64,
        spindle_speed: f64,
    ) -> Self {
        HoleParameters {
            cycle_type,
            depth,
            feedrate,
            spindle_speed,
            peck_depth: None,
            dwell_time: None,
            retract_mode: RetractMode::RapidToTop,
        }
    }

    pub fn with_peck(mut self, peck: f64) -> Self {
        self.peck_depth = Some(peck);
        self
    }

    pub fn with_dwell(mut self, time: f64) -> Self {
        self.dwell_time = Some(time);
        self
    }

    pub fn with_retract(mut self, mode: RetractMode) -> Self {
        self.retract_mode = mode;
        self
    }

    /// Get G-code for this cycle
    pub fn gcode(&self) -> String {
        match self.cycle_type {
            CannedCycleType::Drilling => "G81".to_string(),
            CannedCycleType::DrillWithDwell => "G82".to_string(),
            CannedCycleType::PeckDrill => "G83".to_string(),
            CannedCycleType::Boring => "G85".to_string(),
            CannedCycleType::BoringWithDwell => "G86".to_string(),
            CannedCycleType::Tapping => "G84".to_string(),
            CannedCycleType::Reaming => "G85".to_string(),
        }
    }

    /// Get retract G-code
    pub fn retract_gcode(&self) -> String {
        match self.retract_mode {
            RetractMode::RapidToTop => "G98".to_string(),
            RetractMode::RapidToClearance => "G99".to_string(),
        }
    }

    /// Calculate cycle time
    pub fn cycle_time_minutes(&self) -> f64 {
        let depth_time = self.depth / self.feedrate;
        let dwell_time = self.dwell_time.unwrap_or(0.0) / 60.0;
        depth_time + dwell_time
    }

    /// Calculate number of pecks for peck drilling
    pub fn peck_count(&self) -> usize {
        if let Some(peck) = self.peck_depth {
            if peck > 0.0 {
                ((self.depth / peck).ceil() as usize).max(1)
            } else {
                1
            }
        } else {
            1
        }
    }

    /// Get clearance plane offset
    pub fn clearance_offset(&self) -> f64 {
        2.0 // Typically 2mm above workpiece
    }
}

/// Tapping parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TappingParameters {
    pub hole_diameter: f64,      // mm
    pub thread_pitch: f64,       // mm/rev
    pub thread_depth: f64,       // mm
    pub spindle_speed: f64,      // RPM
    pub feed_per_rev: f64,       // mm/rev = thread pitch
    pub direction: TapDirection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TapDirection {
    Clockwise,
    CounterClockwise,
}

impl TappingParameters {
    pub fn new(
        hole_diameter: f64,
        thread_pitch: f64,
        spindle_speed: f64,
    ) -> Self {
        TappingParameters {
            hole_diameter,
            thread_pitch,
            thread_depth: hole_diameter * 0.8, // Typical depth
            spindle_speed,
            feed_per_rev: thread_pitch,
            direction: TapDirection::Clockwise,
        }
    }

    /// Calculate feedrate for tapping
    pub fn feedrate(&self) -> f64 {
        self.spindle_speed * self.feed_per_rev
    }

    /// Calculate tap time
    pub fn cycle_time_minutes(&self) -> f64 {
        let feedrate = self.feedrate();
        self.thread_depth / feedrate
    }

    /// Check if spindle RPM is suitable for tap
    pub fn is_valid_rpm(&self) -> bool {
        // Typical: 50-300 RPM for metric taps in steel
        self.spindle_speed >= 50.0 && self.spindle_speed <= 1000.0
    }

    /// Get recommended RPM for material
    pub fn recommended_rpm(material: &str, thread_pitch: f64) -> f64 {
        // Simplified recommendation
        let base_speed = match material {
            "Steel" => 60.0,
            "Aluminum" => 150.0,
            "Cast Iron" => 40.0,
            "Stainless" => 40.0,
            _ => 80.0,
        };

        // Adjust for pitch (finer pitch = slower)
        base_speed / (thread_pitch * 2.0)
    }
}

/// Thread spec database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadSpec {
    pub designation: String,  // M8x1.25
    pub major_diameter: f64,
    pub pitch: f64,
    pub hole_diameter: f64,
}

impl ThreadSpec {
    pub fn metric_coarse(size: f64) -> Self {
        let (pitch, hole) = match size {
            3.0 => (0.5, 2.5),
            4.0 => (0.7, 3.3),
            5.0 => (0.8, 4.2),
            6.0 => (1.0, 5.0),
            8.0 => (1.25, 6.8),
            10.0 => (1.5, 8.5),
            12.0 => (1.75, 10.2),
            16.0 => (2.0, 14.0),
            20.0 => (2.5, 17.5),
            _ => (1.0, size - 1.0),
        };

        ThreadSpec {
            designation: format!("M{}", size),
            major_diameter: size,
            pitch,
            hole_diameter: hole,
        }
    }

    pub fn metric_fine(size: f64, pitch: f64) -> Self {
        let hole = size - (pitch * 0.85);
        ThreadSpec {
            designation: format!("M{}x{}", size, pitch),
            major_diameter: size,
            pitch,
            hole_diameter: hole,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_drilling_cycle_creation() {
        let hole = HoleParameters::new(CannedCycleType::Drilling, 10.0, 100.0, 1000.0);
        assert_eq!(hole.depth, 10.0);
        assert_eq!(hole.gcode(), "G81");
    }

    #[test]
    fn test_peck_drilling() {
        let hole = HoleParameters::new(CannedCycleType::PeckDrill, 25.0, 150.0, 800.0)
            .with_peck(5.0);

        assert_eq!(hole.peck_count(), 5);
        assert_eq!(hole.gcode(), "G83");
    }

    #[test]
    fn test_cycle_time() {
        let hole = HoleParameters::new(CannedCycleType::Drilling, 10.0, 100.0, 1000.0);
        let time = hole.cycle_time_minutes();
        assert!(time > 0.0);
    }

    #[test]
    fn test_tapping_parameters() {
        let tap = TappingParameters::new(8.0, 1.25, 200.0);
        assert_eq!(tap.hole_diameter, 8.0);
        assert_eq!(tap.feedrate(), 250.0); // 200 * 1.25
        assert!(tap.is_valid_rpm());
    }

    #[test]
    fn test_thread_specs() {
        let spec = ThreadSpec::metric_coarse(8.0);
        assert_eq!(spec.major_diameter, 8.0);
        assert_eq!(spec.pitch, 1.25);
        assert!(spec.hole_diameter < spec.major_diameter);
    }

    #[test]
    fn test_recommended_rpm() {
        let rpm_steel = TappingParameters::recommended_rpm("Steel", 1.25);
        let rpm_aluminum = TappingParameters::recommended_rpm("Aluminum", 1.25);
        assert!(rpm_aluminum > rpm_steel);
    }
}
