//! ODE solver implementations (RK4, RK45)

use serde::{Deserialize, Serialize};
use crate::error::Result;
use super::{Solver, SolverConfig};

/// Available Runge-Kutta methods
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum RungeKuttaMethod {
    /// Classical RK4 with fixed step size
    RK4,
    /// RK45 with adaptive step size (Dormand-Prince)
    RK45,
}

/// ODE solver using Runge-Kutta methods
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdeSolver {
    config: SolverConfig,
    current_time: f64,
    method: RungeKuttaMethod,
    step_count: usize,
}

impl OdeSolver {
    /// Create a new ODE solver
    pub fn new(method: RungeKuttaMethod, config: SolverConfig) -> Self {
        OdeSolver {
            config,
            current_time: 0.0,
            method,
            step_count: 0,
        }
    }

    /// Create with default config
    pub fn default(method: RungeKuttaMethod) -> Self {
        Self::new(method, SolverConfig::default())
    }

    /// Classical RK4 step
    fn rk4_step<F>(&self, state: &mut [f64], dt: f64, derivative: F) -> Result<()>
    where
        F: Fn(&[f64]) -> Vec<f64>,
    {
        let n = state.len();

        // k1 = f(t, y)
        let k1 = derivative(state);

        // k2 = f(t + dt/2, y + dt/2 * k1)
        let mut y_temp = state.to_vec();
        for i in 0..n {
            y_temp[i] = state[i] + 0.5 * dt * k1[i];
        }
        let k2 = derivative(&y_temp);

        // k3 = f(t + dt/2, y + dt/2 * k2)
        for i in 0..n {
            y_temp[i] = state[i] + 0.5 * dt * k2[i];
        }
        let k3 = derivative(&y_temp);

        // k4 = f(t + dt, y + dt * k3)
        for i in 0..n {
            y_temp[i] = state[i] + dt * k3[i];
        }
        let k4 = derivative(&y_temp);

        // y_new = y + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
        for i in 0..n {
            state[i] = state[i] + (dt / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
        }

        Ok(())
    }

    /// RK45 step with adaptive step size
    fn rk45_step<F>(&self, state: &mut [f64], dt: f64, derivative: F) -> Result<f64>
    where
        F: Fn(&[f64]) -> Vec<f64>,
    {
        let n = state.len();

        // Butcher tableau for RK45 (Dormand-Prince 5(4))
        #[allow(clippy::inconsistent_digit_grouping)]
        let a: &[&[f64]] = &[
            &[],
            &[1.0 / 5.0],
            &[3.0 / 40.0, 9.0 / 40.0],
            &[44.0 / 45.0, -56.0 / 15.0, 32.0 / 9.0],
            &[19372.0 / 6561.0, -25360.0 / 2187.0, 64448.0 / 6561.0, -212.0 / 729.0],
            &[9017.0 / 3168.0, -355.0 / 33.0, 46732.0 / 5247.0, 49.0 / 176.0, -5103.0 / 18656.0],
        ];

        let b5 = [35.0 / 384.0, 0.0, 500.0 / 1113.0, 125.0 / 192.0, -2187.0 / 6784.0, 11.0 / 84.0];
        let b4 = [5179.0 / 57600.0, 0.0, 7571.0 / 16695.0, 393.0 / 640.0, -92097.0 / 339200.0, 187.0 / 2100.0, 1.0 / 40.0];

        let mut k = vec![vec![0.0; n]; 7];
        k[0] = derivative(state);

        for i in 1..6 {
            let mut y_temp = state.to_vec();
            for j in 0..n {
                for l in 0..i {
                    y_temp[j] += dt * a[i][l] * k[l][j];
                }
            }
            k[i] = derivative(&y_temp);
        }

        // 5th order result
        let mut state5 = state.to_vec();
        for i in 0..n {
            state5[i] = state[i] + dt * (b5[0] * k[0][i] + b5[2] * k[2][i] + b5[3] * k[3][i] + b5[4] * k[4][i] + b5[5] * k[5][i]);
        }

        // Last k for 6th stage
        k[6] = derivative(&state5);

        // 4th order result
        let mut state4 = state.to_vec();
        for i in 0..n {
            state4[i] = state[i] + dt * (b4[0] * k[0][i] + b4[2] * k[2][i] + b4[3] * k[3][i] + b4[4] * k[4][i] + b4[5] * k[5][i] + b4[6] * k[6][i]);
        }

        // Estimate error
        let mut error: f64 = 0.0;
        for i in 0..n {
            let abs_error = (state5[i] - state4[i]).abs();
            let scale = self.config.abs_tol + self.config.rel_tol * state5[i].abs();
            error = error.max(abs_error / scale);
        }

        // Adaptive step size
        let factor: f64 = if error == 0.0 {
            2.0
        } else {
            (1.0_f64 / error).powf(0.2) * 0.95
        };

        let dt_new = (dt * factor).min(self.config.max_dt).max(self.config.min_dt);

        if error < 1.0 {
            // Accept the step
            for i in 0..n {
                state[i] = state5[i];
            }
            Ok(dt_new)
        } else {
            // Reject the step
            Err(crate::error::TupanError::NumericalError("RK45 step rejected".to_string()))
        }
    }
}

impl Solver for OdeSolver {
    fn step(&mut self, state: &mut [f64]) -> Result<f64> {
        self.step_count += 1;

        // Simple fixed-step RK4 for now
        // In a real implementation, we'd need the derivative function passed in
        // For now, just advance time
        self.current_time += self.config.dt;
        Ok(self.config.dt)
    }

    fn time(&self) -> f64 {
        self.current_time
    }

    fn reset(&mut self) {
        self.current_time = 0.0;
        self.step_count = 0;
    }

    fn config(&self) -> &SolverConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ode_solver_creation() {
        let solver = OdeSolver::default(RungeKuttaMethod::RK4);
        assert_eq!(solver.time(), 0.0);
    }

    #[test]
    fn test_ode_solver_config() {
        let config = SolverConfig {
            dt: 0.01,
            ..Default::default()
        };
        let solver = OdeSolver::new(RungeKuttaMethod::RK4, config);
        assert_eq!(solver.config().dt, 0.01);
    }

    #[test]
    fn test_ode_solver_step() {
        let mut solver = OdeSolver::default(RungeKuttaMethod::RK4);
        let mut state = vec![1.0, 2.0, 3.0];

        let result = solver.step(&mut state);
        assert!(result.is_ok());
        assert!(solver.time() > 0.0);
    }

    #[test]
    fn test_ode_solver_reset() {
        let mut solver = OdeSolver::default(RungeKuttaMethod::RK4);
        let mut state = vec![1.0];
        let _ = solver.step(&mut state);

        solver.reset();
        assert_eq!(solver.time(), 0.0);
    }
}
