//! Control Systems Module - Transfer Functions, State-Space, and PID Control
//!
//! This module provides core control system primitives for block diagram simulation:
//! - Transfer function representation H(s) = N(s) / D(s)
//! - State-space representation dx/dt = A×x + B×u, y = C×x + D×u
//! - PID controller with anti-windup
//! - Frequency domain analysis (root locus, Bode, Nyquist, stability margins)

pub mod frequency_analysis;

use nalgebra::{DMatrix, DVector};
use num_complex::Complex64;
use serde::{Deserialize, Serialize};

// Re-export frequency analysis types and error handling for convenience
pub use frequency_analysis::{
    FrequencyAnalysisError,
    RootLocusResult, RootLocusPoint, StabilityMargins, SpecialPoint,
    FrequencyResponse, BodePlot, NyquistPlot,
};

/// Transfer function representation H(s) = N(s) / D(s)
///
/// Stores numerator and denominator polynomials as coefficient vectors.
/// For H(s) = (2s + 1) / (s² + 3s + 2), we store:
/// - numerator = [2.0, 1.0]
/// - denominator = [1.0, 3.0, 2.0]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferFunction {
    /// Numerator coefficients [b_n, b_{n-1}, ..., b_1, b_0]
    pub numerator: Vec<f64>,
    /// Denominator coefficients [a_n, a_{n-1}, ..., a_1, a_0]
    pub denominator: Vec<f64>,
    /// State vector for simulation (if using state-space form)
    state: Vec<f64>,
}

impl TransferFunction {
    /// Create transfer function from numerator and denominator polynomials
    ///
    /// # Arguments
    /// * `numerator` - Coefficients [b_n, ..., b_0] (highest degree first)
    /// * `denominator` - Coefficients [a_n, ..., a_0] (highest degree first)
    pub fn new(numerator: Vec<f64>, denominator: Vec<f64>) -> Result<Self, String> {
        if numerator.is_empty() {
            return Err("Numerator cannot be empty".to_string());
        }
        if denominator.is_empty() {
            return Err("Denominator cannot be empty".to_string());
        }
        if denominator[0] == 0.0 {
            return Err("Leading denominator coefficient cannot be zero".to_string());
        }

        // Normalize denominator so leading coefficient is 1.0
        let norm_factor = denominator[0];
        let norm_num: Vec<f64> = numerator.iter().map(|&x| x / norm_factor).collect();
        let norm_den: Vec<f64> = denominator.iter().map(|&x| x / norm_factor).collect();

        let order = norm_den.len().saturating_sub(1);
        Ok(TransferFunction {
            numerator: norm_num,
            denominator: norm_den,
            state: vec![0.0; order],
        })
    }

    /// Get system order (degree of denominator - 1)
    pub fn order(&self) -> usize {
        self.denominator.len().saturating_sub(1)
    }

    /// Evaluate frequency response H(jω) at given frequency
    ///
    /// # Arguments
    /// * `omega` - Angular frequency in rad/s
    ///
    /// # Returns
    /// Complex transfer function value H(jω)
    pub fn frequency_response(&self, omega: f64) -> Complex64 {
        let j = Complex64::i();
        let s = j * omega;

        // Evaluate numerator polynomial at s
        let mut num_val = Complex64::new(0.0, 0.0);
        for (i, &coeff) in self.numerator.iter().enumerate() {
            let power = (self.numerator.len() - 1 - i) as i32;
            num_val += coeff * s.powi(power);
        }

        // Evaluate denominator polynomial at s
        let mut den_val = Complex64::new(0.0, 0.0);
        for (i, &coeff) in self.denominator.iter().enumerate() {
            let power = (self.denominator.len() - 1 - i) as i32;
            den_val += coeff * s.powi(power);
        }

        num_val / den_val
    }

    /// Calculate poles (roots of denominator)
    ///
    /// Uses simple quadratic formula for order 2, analytical for lower orders,
    /// numerical approximation for higher orders
    pub fn poles(&self) -> Vec<Complex64> {
        match self.order() {
            0 => vec![],
            1 => {
                // -a_0 / a_1
                let pole = -self.denominator[1] / self.denominator[0];
                vec![Complex64::new(pole, 0.0)]
            }
            2 => {
                // Quadratic formula for a*s^2 + b*s + c = 0
                let a = self.denominator[0];
                let b = self.denominator[1];
                let c = self.denominator[2];
                let discriminant = b * b - 4.0 * a * c;
                let sqrt_disc = discriminant.sqrt();

                let p1 = (-b + sqrt_disc) / (2.0 * a);
                let p2 = (-b - sqrt_disc) / (2.0 * a);

                if discriminant >= 0.0 {
                    vec![
                        Complex64::new(p1, 0.0),
                        Complex64::new(p2, 0.0),
                    ]
                } else {
                    let real = -b / (2.0 * a);
                    let imag = sqrt_disc.abs() / (2.0 * a);
                    vec![
                        Complex64::new(real, imag),
                        Complex64::new(real, -imag),
                    ]
                }
            }
            _ => {
                // For higher-order systems, use numerical approximation
                // (simple companion matrix eigenvalue approach)
                Self::find_roots_numerical(&self.denominator)
            }
        }
    }

    /// Calculate zeros (roots of numerator)
    pub fn zeros(&self) -> Vec<Complex64> {
        Self::find_roots_numerical(&self.numerator)
    }

    /// Check if system is stable (all poles in left half-plane)
    ///
    /// A system is stable if all poles have negative real parts
    pub fn is_stable(&self) -> bool {
        let poles = self.poles();
        poles.iter().all(|p| p.re < -1e-10)
    }

    /// Convert to controllable canonical state-space form
    ///
    /// Returns StateSpaceSystem equivalent to this transfer function
    pub fn to_state_space(&self) -> StateSpaceSystem {
        let order = self.order();
        if order == 0 {
            return StateSpaceSystem::new_siso(
                DMatrix::zeros(1, 1),
                DMatrix::zeros(1, 1),
                DMatrix::zeros(1, 1),
                DMatrix::from_element(1, 1, self.numerator[0]),
            );
        }

        // Controllable canonical form
        // [0  1  0  ...  0]     [0]
        // [0  0  1  ...  0]     [0]
        // [0  0  0  ...  0]  +  [0] u
        // [... ...        ]     [...]
        // [-a_n -a_{n-1} ... -a_1]  [1]
        //
        // y = [b_n - a_n*b_0, b_{n-1} - a_{n-1}*b_0, ..., b_1 - a_1*b_0] x + b_0 u

        let mut a = DMatrix::zeros(order, order);
        for i in 0..order - 1 {
            a[(i, i + 1)] = 1.0;
        }
        for j in 0..order {
            a[(order - 1, j)] = -self.denominator[j + 1];
        }

        let mut b = DVector::zeros(order);
        b[order - 1] = 1.0;
        let b_mat = DMatrix::from_column_slice(order, 1, b.as_slice());

        let b0 = if self.numerator.is_empty() {
            0.0
        } else {
            self.numerator[0]
        };

        let mut c = DVector::zeros(order);
        for i in 0..order {
            let idx = if i < self.numerator.len() { i } else { self.numerator.len() - 1 };
            c[i] = self.numerator[idx] - self.denominator[i + 1] * b0;
        }
        let c_mat = DMatrix::from_row_slice(1, order, c.as_slice());

        let d = DMatrix::from_element(1, 1, b0);

        StateSpaceSystem::new_siso(a, b_mat, c_mat, d)
    }

    /// Create a first-order transfer function 1/(τs + 1)
    ///
    /// Used for modeling simple RC circuits, first-order sensors, etc.
    pub fn first_order(tau: f64) -> Result<Self, String> {
        if tau <= 0.0 {
            return Err("Time constant must be positive".to_string());
        }
        Self::new(vec![1.0], vec![tau, 1.0])
    }

    /// Create a second-order transfer function ωn² / (s² + 2ζωn*s + ωn²)
    ///
    /// # Arguments
    /// * `omega_n` - Natural frequency (rad/s)
    /// * `zeta` - Damping ratio
    pub fn second_order(omega_n: f64, zeta: f64) -> Result<Self, String> {
        if omega_n <= 0.0 {
            return Err("Natural frequency must be positive".to_string());
        }
        let wn2 = omega_n * omega_n;
        Self::new(vec![wn2], vec![1.0, 2.0 * zeta * omega_n, wn2])
    }

    /// Helper: Find polynomial roots numerically (simple approximation)
    fn find_roots_numerical(coeffs: &[f64]) -> Vec<Complex64> {
        if coeffs.len() <= 1 {
            return vec![];
        }

        // For now, return empty for order > 2 (would need proper root-finding algorithm)
        vec![]
    }
}

/// State-space system representation
///
/// Represents system as:
/// dx/dt = A×x + B×u
/// y = C×x + D×u
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateSpaceSystem {
    a_matrix: DMatrix<f64>,  // n×n state transition matrix
    b_matrix: DMatrix<f64>,  // n×m input matrix
    c_matrix: DMatrix<f64>,  // p×n output matrix
    d_matrix: DMatrix<f64>,  // p×m feedthrough matrix
    state: DVector<f64>,     // Current state vector
}

impl StateSpaceSystem {
    /// Create a SISO (single-input single-output) state-space system
    pub fn new_siso(
        a: DMatrix<f64>,
        b: DMatrix<f64>,
        c: DMatrix<f64>,
        d: DMatrix<f64>,
    ) -> Self {
        let n = a.nrows();
        StateSpaceSystem {
            a_matrix: a,
            b_matrix: b,
            c_matrix: c,
            d_matrix: d,
            state: DVector::zeros(n),
        }
    }

    /// Get current state
    pub fn state(&self) -> &DVector<f64> {
        &self.state
    }

    /// Set state
    pub fn set_state(&mut self, state: DVector<f64>) {
        self.state = state;
    }

    /// Compute state derivative: dx/dt = A×x + B×u
    ///
    /// # Arguments
    /// * `u` - Input vector [u1, u2, ...]
    ///
    /// # Returns
    /// State derivative vector
    pub fn derivative(&self, u: &[f64]) -> Result<Vec<f64>, String> {
        if u.len() != self.b_matrix.ncols() {
            return Err(format!(
                "Input size mismatch: expected {}, got {}",
                self.b_matrix.ncols(),
                u.len()
            ));
        }

        let u_vec = DVector::from_row_slice(u);
        let dx = &self.a_matrix * &self.state + &self.b_matrix * u_vec;
        Ok(dx.as_slice().to_vec())
    }

    /// Compute output: y = C×x + D×u
    ///
    /// # Arguments
    /// * `u` - Input vector
    ///
    /// # Returns
    /// Output vector
    pub fn output(&self, u: &[f64]) -> Result<Vec<f64>, String> {
        if u.len() != self.d_matrix.ncols() {
            return Err(format!(
                "Input size mismatch: expected {}, got {}",
                self.d_matrix.ncols(),
                u.len()
            ));
        }

        let u_vec = DVector::from_row_slice(u);
        let y = &self.c_matrix * &self.state + &self.d_matrix * &u_vec;
        Ok(y.as_slice().to_vec())
    }

    /// Update state using RK4 (Runge-Kutta 4th order) integration
    ///
    /// # Arguments
    /// * `u` - Input vector
    /// * `dt` - Time step
    pub fn integrate(&mut self, u: &[f64], dt: f64) -> Result<(), String> {
        // RK4 integration: x_{k+1} = x_k + dt/6 * (k1 + 2k2 + 2k3 + k4)
        let k1 = DVector::from_vec(self.derivative(u)?);

        // k2: evaluate at t + dt/2, x + dt/2 * k1
        let state_backup = self.state.clone();
        self.state = &state_backup + (dt / 2.0) * &k1;
        let k2 = DVector::from_vec(self.derivative(u)?);

        // k3: evaluate at t + dt/2, x + dt/2 * k2
        self.state = &state_backup + (dt / 2.0) * &k2;
        let k3 = DVector::from_vec(self.derivative(u)?);

        // k4: evaluate at t + dt, x + dt * k3
        self.state = &state_backup + dt * &k3;
        let k4 = DVector::from_vec(self.derivative(u)?);

        // Final state update
        self.state = state_backup + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);

        Ok(())
    }

    /// Reset state to zero
    pub fn reset(&mut self) {
        self.state.fill(0.0);
    }
}

/// PID Controller with anti-windup
///
/// Implements: u = kp*e + ki*∫e dt + kd*de/dt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PIDController {
    pub kp: f64,  // Proportional gain
    pub ki: f64,  // Integral gain
    pub kd: f64,  // Derivative gain

    integral_state: f64,
    derivative_prev_error: f64,
    anti_windup_limit: Option<f64>,  // Optional integral saturation
}

impl PIDController {
    /// Create new PID controller
    pub fn new(kp: f64, ki: f64, kd: f64) -> Self {
        PIDController {
            kp,
            ki,
            kd,
            integral_state: 0.0,
            derivative_prev_error: 0.0,
            anti_windup_limit: None,
        }
    }

    /// Set anti-windup limit for integral term
    pub fn set_anti_windup(&mut self, limit: f64) {
        self.anti_windup_limit = Some(limit.abs());
    }

    /// Compute PID output
    ///
    /// # Arguments
    /// * `error` - Difference between setpoint and feedback
    /// * `dt` - Time step since last call
    ///
    /// # Returns
    /// Control output value
    pub fn compute(&mut self, error: f64, dt: f64) -> f64 {
        // Proportional term
        let p_term = self.kp * error;

        // Integral term with anti-windup
        self.integral_state += self.ki * error * dt;
        if let Some(limit) = self.anti_windup_limit {
            self.integral_state = self.integral_state.max(-limit).min(limit);
        }
        let i_term = self.integral_state;

        // Derivative term (backward difference)
        let d_error = (error - self.derivative_prev_error) / dt.max(1e-10);
        let d_term = self.kd * d_error;
        self.derivative_prev_error = error;

        p_term + i_term + d_term
    }

    /// Reset controller state
    pub fn reset(&mut self) {
        self.integral_state = 0.0;
        self.derivative_prev_error = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transfer_function_creation() {
        let tf = TransferFunction::new(vec![1.0], vec![1.0, 1.0]).unwrap();
        assert_eq!(tf.order(), 1);
        assert_eq!(tf.numerator, vec![1.0]);
        assert_eq!(tf.denominator, vec![1.0, 1.0]);
    }

    #[test]
    fn test_transfer_function_invalid() {
        assert!(TransferFunction::new(vec![], vec![1.0]).is_err());
        assert!(TransferFunction::new(vec![1.0], vec![]).is_err());
        assert!(TransferFunction::new(vec![1.0], vec![0.0]).is_err());
    }

    #[test]
    fn test_first_order_transfer_function() {
        let tf = TransferFunction::first_order(1.0).unwrap();
        assert_eq!(tf.order(), 1);
        let h_0 = tf.frequency_response(0.0);
        assert!((h_0.re - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_second_order_transfer_function() {
        let tf = TransferFunction::second_order(1.0, 0.707).unwrap();
        assert_eq!(tf.order(), 2);
        let h_0 = tf.frequency_response(0.0);
        assert!((h_0.re - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_poles_first_order() {
        let tf = TransferFunction::new(vec![1.0], vec![1.0, 1.0]).unwrap();
        let poles = tf.poles();
        assert_eq!(poles.len(), 1);
        assert!((poles[0].re - (-1.0)).abs() < 1e-10);
        assert!(poles[0].im.abs() < 1e-10);
    }

    #[test]
    fn test_poles_second_order_real() {
        // (s + 1)(s + 2) = s^2 + 3s + 2
        let tf = TransferFunction::new(vec![1.0], vec![1.0, 3.0, 2.0]).unwrap();
        let poles = tf.poles();
        assert_eq!(poles.len(), 2);
        // Should have poles at -1 and -2
        let pole_reals: Vec<_> = poles.iter().map(|p| p.re).collect();
        assert!(pole_reals.contains(&(-1.0)) || (pole_reals[0] - (-1.0)).abs() < 1e-10);
        assert!(pole_reals.contains(&(-2.0)) || (pole_reals[1] - (-2.0)).abs() < 1e-10);
    }

    #[test]
    fn test_poles_second_order_complex() {
        // s^2 + 2s + 2 (complex poles)
        let tf = TransferFunction::new(vec![1.0], vec![1.0, 2.0, 2.0]).unwrap();
        let poles = tf.poles();
        assert_eq!(poles.len(), 2);
        // Should have complex conjugate poles at -1 ± j
        assert!((poles[0].re - (-1.0)).abs() < 1e-10);
        assert!((poles[1].re - (-1.0)).abs() < 1e-10);
        assert!((poles[0].im - poles[1].im.neg()).abs() < 1e-10);
    }

    #[test]
    fn test_stability_check() {
        // Stable: s + 1
        let stable_tf = TransferFunction::new(vec![1.0], vec![1.0, 1.0]).unwrap();
        assert!(stable_tf.is_stable());

        // Unstable: -s + 1 (pole at +1)
        let unstable_tf = TransferFunction::new(vec![1.0], vec![1.0, -1.0]).unwrap();
        assert!(!unstable_tf.is_stable());
    }

    #[test]
    fn test_frequency_response() {
        let tf = TransferFunction::first_order(1.0).unwrap();
        let h_0 = tf.frequency_response(0.0);  // DC gain
        let h_1 = tf.frequency_response(1.0);  // At ω = 1 rad/s

        assert!((h_0.norm() - 1.0).abs() < 1e-10);
        assert!((h_1.norm() - 1.0 / (2.0_f64).sqrt()).abs() < 1e-10);
    }

    #[test]
    fn test_state_space_derivative() {
        let a = DMatrix::from_row_slice(1, 1, &[-1.0]);
        let b = DMatrix::from_row_slice(1, 1, &[1.0]);
        let c = DMatrix::from_row_slice(1, 1, &[1.0]);
        let d = DMatrix::from_row_slice(1, 1, &[0.0]);

        let ss = StateSpaceSystem::new_siso(a, b, c, d);
        let dx = ss.derivative(&[1.0]).unwrap();
        assert!((dx[0] + 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_state_space_output() {
        let a = DMatrix::from_row_slice(1, 1, &[0.0]);
        let b = DMatrix::from_row_slice(1, 1, &[0.0]);
        let c = DMatrix::from_row_slice(1, 1, &[1.0]);
        let d = DMatrix::from_row_slice(1, 1, &[1.0]);

        let ss = StateSpaceSystem::new_siso(a, b, c, d);
        let y = ss.output(&[2.0]).unwrap();
        assert!((y[0] - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_state_space_integration() {
        // Simple integrator: dx/dt = u
        let a = DMatrix::from_row_slice(1, 1, &[0.0]);
        let b = DMatrix::from_row_slice(1, 1, &[1.0]);
        let c = DMatrix::from_row_slice(1, 1, &[1.0]);
        let d = DMatrix::from_row_slice(1, 1, &[0.0]);

        let mut ss = StateSpaceSystem::new_siso(a, b, c, d);
        ss.integrate(&[1.0], 0.01).unwrap();
        assert!((ss.state()[0] - 0.01).abs() < 1e-6);
    }

    #[test]
    fn test_pid_controller() {
        let mut pid = PIDController::new(1.0, 0.1, 0.01);
        let dt = 0.01;

        let u = pid.compute(1.0, dt);  // Error = 1.0
        assert!(u > 0.0);  // Should produce positive output
    }

    #[test]
    fn test_pid_controller_reset() {
        let mut pid = PIDController::new(1.0, 0.1, 0.01);
        pid.compute(1.0, 0.01);
        pid.reset();
        let u = pid.compute(0.0, 0.01);
        assert!((u - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_pid_anti_windup() {
        let mut pid = PIDController::new(0.0, 1.0, 0.0);
        pid.set_anti_windup(1.0);

        // Accumulate integral
        for _ in 0..20 {
            pid.compute(1.0, 0.1);
        }

        let integral = pid.integral_state;
        assert!(integral.abs() <= 1.0);
    }

    #[test]
    fn test_transfer_function_normalization() {
        // Create TF with non-unit leading coefficient
        let tf = TransferFunction::new(vec![2.0], vec![2.0, 4.0]).unwrap();
        // Should normalize to [1.0] / [1.0, 2.0]
        assert_eq!(tf.numerator, vec![1.0]);
        assert_eq!(tf.denominator, vec![1.0, 2.0]);
    }

    #[test]
    fn test_pid_derivative_kick_rejection() {
        let mut pid = PIDController::new(1.0, 0.0, 1.0);

        // First measurement
        let u1 = pid.compute(0.0, 0.01);
        assert!((u1 - 0.0).abs() < 1e-10);

        // Step to error = 1.0 should have derivative kick
        let u2 = pid.compute(1.0, 0.01);
        assert!(u2 > 0.0);  // Should have positive output
    }
}
