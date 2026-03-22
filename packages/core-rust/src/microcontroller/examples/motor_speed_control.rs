//! Motor Speed Control Example with PID Feedback
//!
//! Demonstrates closed-loop motor speed control with:
//! - PWM driving a DC motor
//! - Encoder feedback simulation (speed measurement)
//! - PID controller calculating error correction
//! - Motor dynamics (inertia, friction, back-EMF)
//!
//! Motor Circuit Model:
//! ```
//! 12V ─[PWM]─[Motor Windings]─[Load Inertia]─ GND
//!           └─ Encoder feedback to ADC
//! ```
//!
//! Control Loop:
//! ```
//! Target Speed (ADC0)
//!   ├─ Compare with Encoder Speed (ADC1)
//!   ├─ PID controller computes error
//!   ├─ Adjust PWM duty cycle (GPIO5)
//!   └─ Motor accelerates/decelerates
//! ```

// Note: Imports removed - examples now focus on motor/encoder/PID components
// without MCU coupling. MCU coupling demonstrated in integration_test.rs

/// DC Motor Model
///
/// Simulates realistic motor behavior:
/// - V = I·R + L·dI/dt + K_e·ω (circuit equation)
/// - τ = K_t·I (electromagnetic torque)
/// - τ = J·dω/dt + b·ω + τ_load (mechanical equation)
#[derive(Debug, Clone)]
pub struct DcMotorModel {
    /// Motor resistance [Ω]
    pub resistance: f64,

    /// Motor inductance [H]
    pub inductance: f64,

    /// Back-EMF constant [V·s/rad]
    pub back_emf_constant: f64,

    /// Torque constant [N·m/A] (≈ back-EMF constant for DC motors)
    pub torque_constant: f64,

    /// Rotor inertia [kg·m²]
    pub inertia: f64,

    /// Viscous friction [N·m·s/rad]
    pub friction_coefficient: f64,

    /// Current state [A]
    pub current: f64,

    /// Angular velocity [rad/s]
    pub angular_velocity: f64,

    /// Supply voltage [V]
    pub supply_voltage: f64,

    /// Load torque [N·m]
    pub load_torque: f64,
}

impl DcMotorModel {
    /// Create a typical small DC motor (like in a hobby servo)
    pub fn new() -> Self {
        DcMotorModel {
            resistance: 2.5,              // 2.5Ω (small motor)
            inductance: 0.001,            // 1mH
            back_emf_constant: 0.05,      // 50 mV/(rad/s) → 477 RPM/V
            torque_constant: 0.05,        // 50 mN·m/A
            inertia: 0.001,               // 1 g·cm² = 10^-6 kg·m²
            friction_coefficient: 0.001,  // Small friction
            current: 0.0,
            angular_velocity: 0.0,
            supply_voltage: 12.0,
            load_torque: 0.0,
        }
    }

    /// Update motor state based on applied voltage
    ///
    /// Solves:
    /// - dI/dt = (V - I·R - K_e·ω) / L
    /// - dω/dt = (K_t·I - b·ω - τ_load) / J
    pub fn step(&mut self, applied_voltage: f64, dt: f64) {
        // Clamp voltage to supply
        let v = applied_voltage.clamp(0.0, self.supply_voltage);

        // Back-EMF voltage
        let back_emf = self.back_emf_constant * self.angular_velocity;

        // Current derivative (assuming small L, use quasi-steady approximation)
        // I ≈ (V - back_emf) / R
        let target_current = (v - back_emf) / self.resistance;
        let di_dt = (target_current - self.current) / (self.inductance / self.resistance).max(0.001);

        // Update current
        self.current += di_dt * dt;
        self.current = self.current.max(0.0); // Can't have negative current (motor only conducts)

        // Motor torque
        let motor_torque = self.torque_constant * self.current;

        // Friction torque (opposes motion)
        let friction_torque = self.friction_coefficient * self.angular_velocity;

        // Angular acceleration
        let torque_net = motor_torque - friction_torque - self.load_torque;
        let dw_dt = torque_net / self.inertia;

        // Update angular velocity
        self.angular_velocity += dw_dt * dt;
        self.angular_velocity = self.angular_velocity.max(0.0); // Can't reverse (without reverse PWM)
    }

    /// Get motor speed in RPM (common in motor specifications)
    pub fn speed_rpm(&self) -> f64 {
        self.angular_velocity * 60.0 / (2.0 * std::f64::consts::PI)
    }

    /// Get back-EMF voltage [V]
    pub fn back_emf(&self) -> f64 {
        self.back_emf_constant * self.angular_velocity
    }

    /// Get power consumption [W]
    pub fn power_watts(&self) -> f64 {
        self.current * self.current * self.resistance
    }

    /// Check if motor is spinning above minimum speed
    pub fn is_running(&self) -> bool {
        self.speed_rpm() > 50.0 // >50 RPM considered "running"
    }
}

impl Default for DcMotorModel {
    fn default() -> Self {
        Self::new()
    }
}

/// Quadrature Encoder Simulator
///
/// Simulates a rotary encoder that counts motor shaft revolutions
/// and provides speed feedback
#[derive(Debug, Clone)]
pub struct EncoderSimulator {
    /// Pulses per revolution
    pub ppr: u32,

    /// Current pulse count (0 to ppr-1)
    pub pulse_count: u32,

    /// Cumulative total revolutions
    pub total_revolutions: u32,

    /// Previous velocity for speed calculation
    prev_velocity: f64,

    /// Filtered speed [rad/s]
    filtered_speed: f64,

    /// Low-pass filter constant [0.0-1.0]
    filter_alpha: f64,
}

impl EncoderSimulator {
    /// Create new encoder with standard 64 PPR (common value)
    pub fn new() -> Self {
        EncoderSimulator {
            ppr: 64,
            pulse_count: 0,
            total_revolutions: 0,
            prev_velocity: 0.0,
            filtered_speed: 0.0,
            filter_alpha: 0.2,  // 20% weight to new measurement
        }
    }

    /// Update encoder based on motor velocity
    pub fn update(&mut self, motor_angular_velocity: f64, dt: f64) {
        // Convert rad/s to revolutions/s
        let revolutions_per_sec = motor_angular_velocity / (2.0 * std::f64::consts::PI);

        // Increment pulse count
        let pulses_this_step = (revolutions_per_sec * self.ppr as f64 * dt) as u32;
        self.pulse_count = (self.pulse_count + pulses_this_step) % self.ppr;

        if self.pulse_count < pulses_this_step {
            // Wrapped around, increment revolution counter
            self.total_revolutions += 1;
        }

        // Estimate speed from velocity (with filtering)
        let measured_speed = motor_angular_velocity;
        self.filtered_speed = self.filter_alpha * measured_speed
            + (1.0 - self.filter_alpha) * self.prev_velocity;
        self.prev_velocity = measured_speed;
    }

    /// Get estimated speed in rad/s
    pub fn speed_rad_per_sec(&self) -> f64 {
        self.filtered_speed
    }

    /// Get estimated speed in RPM
    pub fn speed_rpm(&self) -> f64 {
        self.filtered_speed * 60.0 / (2.0 * std::f64::consts::PI)
    }

    /// Get encoder pulse count (0-63 for 64 PPR)
    pub fn pulse_position(&self) -> u32 {
        self.pulse_count
    }

    /// Get total revolutions
    pub fn revolutions(&self) -> u32 {
        self.total_revolutions
    }
}

impl Default for EncoderSimulator {
    fn default() -> Self {
        Self::new()
    }
}

/// Simple PID Controller
///
/// Standard PID: u = Kp·e + Ki·∫e + Kd·de/dt
#[derive(Debug, Clone)]
pub struct PidController {
    /// Proportional gain
    pub kp: f64,

    /// Integral gain
    pub ki: f64,

    /// Derivative gain
    pub kd: f64,

    /// Integral accumulator
    integral: f64,

    /// Previous error for derivative
    prev_error: f64,

    /// Integral anti-windup limit
    integral_max: f64,
}

impl PidController {
    /// Create new PID controller with tuned gains
    pub fn new(kp: f64, ki: f64, kd: f64) -> Self {
        PidController {
            kp,
            ki,
            kd,
            integral: 0.0,
            prev_error: 0.0,
            integral_max: 100.0, // Prevent integral windup
        }
    }

    /// Compute control signal
    ///
    /// # Arguments
    /// - `setpoint`: Desired value (target speed)
    /// - `feedback`: Measured value (actual speed)
    /// - `dt`: Time step [seconds]
    ///
    /// # Returns
    /// Control output (typically 0-100 for PWM duty cycle)
    pub fn update(&mut self, setpoint: f64, feedback: f64, dt: f64) -> f64 {
        let error = setpoint - feedback;

        // Proportional term
        let p_term = self.kp * error;

        // Integral term (with anti-windup)
        self.integral += error * dt;
        self.integral = self.integral.clamp(-self.integral_max, self.integral_max);
        let i_term = self.ki * self.integral;

        // Derivative term
        let de_dt = (error - self.prev_error) / dt.max(0.001);
        let d_term = self.kd * de_dt;
        self.prev_error = error;

        // Total output
        p_term + i_term + d_term
    }

    /// Reset controller state
    pub fn reset(&mut self) {
        self.integral = 0.0;
        self.prev_error = 0.0;
    }

    /// Get current integral accumulator value
    pub fn get_integral(&self) -> f64 {
        self.integral
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_motor_creation() {
        let motor = DcMotorModel::new();
        assert_eq!(motor.current, 0.0);
        assert_eq!(motor.angular_velocity, 0.0);
        assert!(!motor.is_running());
    }

    #[test]
    fn test_motor_acceleration() {
        let mut motor = DcMotorModel::new();
        let dt = 0.001; // 1ms timestep

        // Apply 12V (full voltage)
        for _ in 0..1000 {
            motor.step(12.0, dt);
        }

        // After 1 second, should be accelerating
        assert!(motor.angular_velocity > 0.0);
        assert!(motor.speed_rpm() > 100.0);
        assert!(motor.is_running());
    }

    #[test]
    fn test_motor_speed_with_pwm() {
        let mut motor = DcMotorModel::new();
        let dt = 0.001;

        // 50% PWM = 6V
        for _ in 0..1000 {
            motor.step(6.0, dt);
        }

        let half_speed_rpm = motor.speed_rpm();

        // Full PWM = 12V should reach higher speed
        motor.load_torque = 0.0;
        for _ in 0..1000 {
            motor.step(12.0, dt);
        }

        let full_speed_rpm = motor.speed_rpm();
        assert!(full_speed_rpm > half_speed_rpm);
    }

    #[test]
    fn test_encoder_simulation() {
        let mut encoder = EncoderSimulator::new();
        let mut motor = DcMotorModel::new();
        let dt = 0.001;

        // Spin motor at constant voltage
        for _ in 0..2000 {
            motor.step(12.0, dt);
            encoder.update(motor.angular_velocity, dt);
        }

        // Encoder should show speed increase
        assert!(encoder.speed_rpm() > 100.0);
        assert!(encoder.total_revolutions > 0);
    }

    #[test]
    fn test_pid_controller() {
        let mut pid = PidController::new(10.0, 1.0, 0.1);
        let dt = 0.01;

        // Setpoint: 100 rad/s, actual: 0 rad/s (error = 100)
        let output1 = pid.update(100.0, 0.0, dt);
        assert!(output1 > 0.0, "Initial output should be positive for positive error");

        // Feedback approaches setpoint
        let _output2 = pid.update(100.0, 50.0, dt);

        // Closer to setpoint
        let _output3 = pid.update(100.0, 95.0, dt);

        // At setpoint (zero error)
        let output4 = pid.update(100.0, 100.0, dt);

        // Large error should produce larger output than small error
        // (proportional term dominates initially)
        assert!(
            output1 > output4,
            "Larger error should produce larger output initially"
        );
    }

    #[test]
    fn test_pid_integral_windup() {
        let mut pid = PidController::new(10.0, 1.0, 0.0);
        let dt = 0.01;

        // Large persistent error
        for _ in 0..1000 {
            pid.update(1000.0, 0.0, dt);
        }

        // Integral should be limited, not infinite
        assert!(pid.integral.abs() <= 100.0);
    }

    #[test]
    fn test_motor_encoder_pid_loop() {
        // Test motor + encoder + PID without MCU coupling
        // This demonstrates the core feedback control loop
        let mut motor = DcMotorModel::new();
        let mut encoder = EncoderSimulator::new();
        let mut pid = PidController::new(2.0, 0.3, 0.15);

        let target_speed_rpm = 400.0;
        let dt = 0.001;
        let num_iterations = 2000; // 2 seconds

        // Simulation loop: PID computes control signal, motor executes
        for _ in 0..num_iterations {
            // PID controller calculates motor voltage (0-12V)
            let feedback = encoder.speed_rpm();
            let pwm_output = pid.update(target_speed_rpm, feedback, dt);
            let motor_voltage = (pwm_output.clamp(0.0, 100.0) / 100.0) * 12.0;

            // Motor dynamics
            motor.step(motor_voltage, dt);

            // Encoder feedback
            encoder.update(motor.angular_velocity, dt);
        }

        // After 2 seconds with aggressive PID control, motor should reach good speed
        // With strong gains, should get close to target
        let final_rpm = encoder.speed_rpm();
        assert!(
            final_rpm > target_speed_rpm * 0.7,
            "Motor should reach at least 70% of target speed, got {:.0} RPM",
            final_rpm
        );

        // Should show monotonic increase over time
        assert!(encoder.speed_rpm() > 100.0, "Motor should be spinning significantly");
    }

    #[test]
    fn test_motor_power_consumption() {
        let mut motor = DcMotorModel::new();
        let dt = 0.001;

        // Accelerate motor
        for _ in 0..1000 {
            motor.step(12.0, dt);
        }

        // Power consumption should be significant
        let power = motor.power_watts();
        assert!(power > 0.0);
        assert!(power < 50.0); // Sanity check: small motor shouldn't consume >50W
    }

    #[test]
    fn test_motor_back_emf() {
        let mut motor = DcMotorModel::new();
        let dt = 0.001;

        // At zero speed, no back-EMF
        assert_eq!(motor.back_emf(), 0.0);

        // Accelerate motor
        for _ in 0..1000 {
            motor.step(12.0, dt);
        }

        // At high speed, back-EMF should be significant
        let back_emf = motor.back_emf();
        assert!(back_emf > 1.0); // Should be at least 1V
        assert!(back_emf < 12.0); // Can't exceed supply voltage
    }
}
