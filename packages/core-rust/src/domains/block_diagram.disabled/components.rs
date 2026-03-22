//! Block Diagram Components - 15+ block types for control systems
//!
//! This module implements standard control system blocks:
//! - Basic: Gain, Sum, Product, Divide
//! - Dynamic: Integrator, Derivative, TransferFunction, StateSpace
//! - Control: PID
//! - Sources: Step, Ramp, Sine, Constant
//! - Nonlinear: Saturation, Deadzone, RateLimiter, Switch, Relay
//! - Advanced: Lookup1D, Scope

use crate::control_systems::{TransferFunction, StateSpaceSystem, PIDController};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// Block diagram component enum - 15+ block types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlockComponent {
    // ===== Basic Operations =====

    /// Gain block: y = gain * u
    Gain {
        gain: f64,
    },

    /// Sum/subtraction block: y = Σ(sign[i] * u[i])
    /// signs: +1 for addition, -1 for subtraction
    Sum {
        signs: Vec<i8>,  // +1 or -1 for each input
    },

    /// Product block: y = u1 * u2 * ... * un
    Product,

    /// Division block: y = u1 / u2
    Divide,

    // ===== Dynamic Blocks (with state) =====

    /// Integrator: dy/dt = u
    /// y = ∫u dt
    Integrator {
        initial_value: f64,
        state: f64,
    },

    /// Derivative (filtered): y = (Td / (tau*s + 1)) * du/dt
    /// Includes low-pass filter to reduce noise
    Derivative {
        filter_time: f64,
        prev_input: f64,
        filter_state: f64,
    },

    /// Transfer function block: H(s) in state-space form
    TransferFunctionBlock {
        tf: TransferFunction,
        system: Option<StateSpaceSystem>,
    },

    /// State-space block: dx/dt = A*x + B*u, y = C*x + D*u
    StateSpaceBlock {
        system: StateSpaceSystem,
    },

    /// PID controller: u = kp*e + ki*∫e + kd*de/dt
    PIDBlock {
        controller: PIDController,
    },

    /// Time delay/transport lag: y(t) = u(t - delay)
    Delay {
        delay_time: f64,
        buffer: VecDeque<(f64, f64)>,  // (time, value) pairs
    },

    // ===== Signal Sources =====

    /// Step input: y = amplitude * (t >= start_time ? 1 : 0)
    Step {
        amplitude: f64,
        start_time: f64,
    },

    /// Ramp input: y = slope * (t - start_time) for t >= start_time
    Ramp {
        slope: f64,
        start_time: f64,
    },

    /// Sinusoidal input: y = amplitude * sin(2π*frequency*t + phase)
    Sine {
        amplitude: f64,
        frequency: f64,  // Hz
        phase: f64,      // radians
    },

    /// Constant input: y = value
    Constant {
        value: f64,
    },

    // ===== Nonlinear Blocks =====

    /// Saturation: y = clamp(u, lower, upper)
    Saturation {
        lower: f64,
        upper: f64,
    },

    /// Deadzone: y = 0 if |u| < threshold, else u - sign(u)*threshold
    Deadzone {
        lower_threshold: f64,
        upper_threshold: f64,
    },

    /// Rate limiter: limits dy/dt
    RateLimiter {
        rising_rate: f64,   // max dy/dt when increasing
        falling_rate: f64,  // max dy/dt when decreasing
        prev_output: f64,
    },

    /// 2-to-1 Switch: if sel >= threshold then y = u1 else y = u2
    Switch {
        threshold: f64,
    },

    /// Relay: hysteretic switch
    /// On when u > on_threshold, off when u < off_threshold
    Relay {
        on_threshold: f64,
        off_threshold: f64,
        state: bool,  // true = on, false = off
        on_value: f64,
        off_value: f64,
    },

    // ===== Lookup/Advanced =====

    /// 1D lookup table: y = interp(x, table_x, table_y)
    Lookup1D {
        table_x: Vec<f64>,
        table_y: Vec<f64>,
    },

    /// Scope/data collector: stores signal history
    Scope {
        buffer: Vec<(f64, f64)>,  // (time, value) pairs
        max_size: usize,
    },
}

impl BlockComponent {
    // Factory methods for common blocks

    /// Create gain block
    pub fn gain(gain: f64) -> Self {
        BlockComponent::Gain { gain }
    }

    /// Create sum block with specified signs
    pub fn sum(signs: Vec<i8>) -> Self {
        BlockComponent::Sum { signs }
    }

    /// Create integrator with initial condition
    pub fn integrator(initial_value: f64) -> Self {
        BlockComponent::Integrator {
            initial_value,
            state: initial_value,
        }
    }

    /// Create PID controller
    pub fn pid(kp: f64, ki: f64, kd: f64) -> Result<Self, String> {
        Ok(BlockComponent::PIDBlock {
            controller: PIDController::new(kp, ki, kd),
        })
    }

    /// Create step input
    pub fn step(amplitude: f64, start_time: f64) -> Self {
        BlockComponent::Step {
            amplitude,
            start_time,
        }
    }

    /// Create saturation block
    pub fn saturation(lower: f64, upper: f64) -> Result<Self, String> {
        if lower >= upper {
            return Err("Lower limit must be less than upper limit".to_string());
        }
        Ok(BlockComponent::Saturation { lower, upper })
    }

    /// Get block name for display
    pub fn name(&self) -> String {
        match self {
            BlockComponent::Gain { .. } => "Gain".to_string(),
            BlockComponent::Sum { .. } => "Sum".to_string(),
            BlockComponent::Product => "Product".to_string(),
            BlockComponent::Divide => "Divide".to_string(),
            BlockComponent::Integrator { .. } => "∫".to_string(),
            BlockComponent::Derivative { .. } => "d/dt".to_string(),
            BlockComponent::TransferFunctionBlock { .. } => "H(s)".to_string(),
            BlockComponent::StateSpaceBlock { .. } => "State-Space".to_string(),
            BlockComponent::PIDBlock { .. } => "PID".to_string(),
            BlockComponent::Delay { .. } => "Delay".to_string(),
            BlockComponent::Step { .. } => "Step".to_string(),
            BlockComponent::Ramp { .. } => "Ramp".to_string(),
            BlockComponent::Sine { .. } => "Sine".to_string(),
            BlockComponent::Constant { .. } => "Const".to_string(),
            BlockComponent::Saturation { .. } => "Sat".to_string(),
            BlockComponent::Deadzone { .. } => "Deadzone".to_string(),
            BlockComponent::RateLimiter { .. } => "Rate Limiter".to_string(),
            BlockComponent::Switch { .. } => "Switch".to_string(),
            BlockComponent::Relay { .. } => "Relay".to_string(),
            BlockComponent::Lookup1D { .. } => "Lookup1D".to_string(),
            BlockComponent::Scope { .. } => "Scope".to_string(),
        }
    }

    /// Get number of inputs (None = dynamic/determined by graph)
    pub fn input_count(&self) -> Option<usize> {
        match self {
            BlockComponent::Gain { .. } => Some(1),
            BlockComponent::Sum { signs } => Some(signs.len()),
            BlockComponent::Product => None,  // Variable
            BlockComponent::Divide => Some(2),
            BlockComponent::Integrator { .. } => Some(1),
            BlockComponent::Derivative { .. } => Some(1),
            BlockComponent::TransferFunctionBlock { .. } => Some(1),
            BlockComponent::StateSpaceBlock { .. } => Some(1),
            BlockComponent::PIDBlock { .. } => Some(1),
            BlockComponent::Delay { .. } => Some(1),
            BlockComponent::Step { .. } => Some(0),
            BlockComponent::Ramp { .. } => Some(0),
            BlockComponent::Sine { .. } => Some(0),
            BlockComponent::Constant { .. } => Some(0),
            BlockComponent::Saturation { .. } => Some(1),
            BlockComponent::Deadzone { .. } => Some(1),
            BlockComponent::RateLimiter { .. } => Some(1),
            BlockComponent::Switch { .. } => Some(3),  // u1, u2, selector
            BlockComponent::Relay { .. } => Some(1),
            BlockComponent::Lookup1D { .. } => Some(1),
            BlockComponent::Scope { .. } => Some(1),
        }
    }

    /// Compute output for given inputs
    /// Returns computed output value(s)
    pub fn compute(&mut self, inputs: &[f64], time: f64, dt: f64) -> Result<f64, String> {
        match self {
            BlockComponent::Gain { gain } => {
                if inputs.len() != 1 {
                    return Err("Gain requires 1 input".to_string());
                }
                Ok(inputs[0] * gain)
            }

            BlockComponent::Sum { signs } => {
                if inputs.len() != signs.len() {
                    return Err(format!(
                        "Sum expects {} inputs, got {}",
                        signs.len(),
                        inputs.len()
                    ));
                }
                let sum = inputs
                    .iter()
                    .zip(signs.iter())
                    .map(|(u, &s)| (s as f64) * u)
                    .sum::<f64>();
                Ok(sum)
            }

            BlockComponent::Product => {
                if inputs.is_empty() {
                    return Err("Product requires at least 1 input".to_string());
                }
                let product = inputs.iter().product::<f64>();
                Ok(product)
            }

            BlockComponent::Divide => {
                if inputs.len() != 2 {
                    return Err("Divide requires 2 inputs".to_string());
                }
                if inputs[1].abs() < 1e-10 {
                    return Err("Division by zero".to_string());
                }
                Ok(inputs[0] / inputs[1])
            }

            BlockComponent::Integrator { state } => {
                if inputs.len() != 1 {
                    return Err("Integrator requires 1 input".to_string());
                }
                // Euler integration: x_{k+1} = x_k + dt * u_k
                *state += dt * inputs[0];
                Ok(*state)
            }

            BlockComponent::Derivative {
                filter_time,
                prev_input,
                filter_state,
            } => {
                if inputs.len() != 1 {
                    return Err("Derivative requires 1 input".to_string());
                }
                // Filtered derivative: y = (Td/(tau*s+1)) * du/dt
                // First-order filter on derivative
                let raw_derivative = (inputs[0] - prev_input) / dt.max(1e-10);
                *filter_state += (raw_derivative - *filter_state) * (dt / (filter_time + dt));
                *prev_input = inputs[0];
                Ok(*filter_state)
            }

            BlockComponent::TransferFunctionBlock { system, .. } => {
                if inputs.len() != 1 {
                    return Err("TransferFunction requires 1 input".to_string());
                }
                if let Some(sys) = system {
                    let output = sys.output(&[inputs[0]])?;
                    Ok(output[0])
                } else {
                    Ok(0.0)  // Not initialized
                }
            }

            BlockComponent::StateSpaceBlock { system } => {
                if inputs.len() != 1 {
                    return Err("StateSpace requires 1 input".to_string());
                }
                let output = system.output(&[inputs[0]])?;
                Ok(output[0])
            }

            BlockComponent::PIDBlock { controller } => {
                if inputs.len() != 1 {
                    return Err("PID requires 1 input (error signal)".to_string());
                }
                let control = controller.compute(inputs[0], dt);
                Ok(control)
            }

            BlockComponent::Delay { delay_time, buffer } => {
                if inputs.len() != 1 {
                    return Err("Delay requires 1 input".to_string());
                }
                // Add current input to buffer
                buffer.push_back((time, inputs[0]));

                // Remove old entries outside delay window
                while let Some((t, _)) = buffer.front() {
                    if time - t > *delay_time {
                        buffer.pop_front();
                    } else {
                        break;
                    }
                }

                // Interpolate delayed value
                if let Some((_, v)) = buffer.front() {
                    Ok(*v)
                } else {
                    Ok(0.0)
                }
            }

            BlockComponent::Step {
                amplitude,
                start_time,
            } => {
                if time >= *start_time {
                    Ok(*amplitude)
                } else {
                    Ok(0.0)
                }
            }

            BlockComponent::Ramp {
                slope,
                start_time,
            } => {
                if time >= *start_time {
                    Ok(slope * (time - start_time))
                } else {
                    Ok(0.0)
                }
            }

            BlockComponent::Sine {
                amplitude,
                frequency,
                phase,
            } => {
                let omega = 2.0 * std::f64::consts::PI * frequency;
                Ok(amplitude * (omega * time + phase).sin())
            }

            BlockComponent::Constant { value } => Ok(*value),

            BlockComponent::Saturation { lower, upper } => {
                if inputs.len() != 1 {
                    return Err("Saturation requires 1 input".to_string());
                }
                Ok(inputs[0].max(*lower).min(*upper))
            }

            BlockComponent::Deadzone {
                lower_threshold,
                upper_threshold,
            } => {
                if inputs.len() != 1 {
                    return Err("Deadzone requires 1 input".to_string());
                }
                if inputs[0] > *lower_threshold && inputs[0] < *upper_threshold {
                    Ok(0.0)
                } else if inputs[0] >= *upper_threshold {
                    Ok(inputs[0] - upper_threshold)
                } else {
                    Ok(inputs[0] + lower_threshold)
                }
            }

            BlockComponent::RateLimiter {
                rising_rate,
                falling_rate,
                prev_output,
            } => {
                if inputs.len() != 1 {
                    return Err("RateLimiter requires 1 input".to_string());
                }
                let desired = inputs[0];
                let delta = desired - prev_output;

                let limited_delta = if delta > 0.0 {
                    delta.min(rising_rate * dt)
                } else {
                    delta.max(-falling_rate * dt)
                };

                let output = prev_output + limited_delta;
                *prev_output = output;
                Ok(output)
            }

            BlockComponent::Switch { threshold } => {
                if inputs.len() != 3 {
                    return Err("Switch requires 3 inputs: u1, u2, selector".to_string());
                }
                if inputs[2] >= *threshold {
                    Ok(inputs[0])
                } else {
                    Ok(inputs[1])
                }
            }

            BlockComponent::Relay {
                on_threshold,
                off_threshold,
                state,
                on_value,
                off_value,
            } => {
                if inputs.len() != 1 {
                    return Err("Relay requires 1 input".to_string());
                }
                // Hysteretic logic
                if !*state && inputs[0] > *on_threshold {
                    *state = true;
                } else if *state && inputs[0] < *off_threshold {
                    *state = false;
                }

                if *state {
                    Ok(*on_value)
                } else {
                    Ok(*off_value)
                }
            }

            BlockComponent::Lookup1D { table_x, table_y } => {
                if inputs.len() != 1 {
                    return Err("Lookup1D requires 1 input".to_string());
                }
                Self::linear_interpolate(inputs[0], table_x, table_y)
            }

            BlockComponent::Scope { buffer, max_size } => {
                if inputs.len() != 1 {
                    return Err("Scope requires 1 input".to_string());
                }
                buffer.push((time, inputs[0]));
                if buffer.len() > *max_size {
                    buffer.remove(0);
                }
                Ok(inputs[0])  // Pass through
            }
        }
    }

    /// Linear interpolation helper
    fn linear_interpolate(x: f64, table_x: &[f64], table_y: &[f64]) -> Result<f64, String> {
        if table_x.is_empty() || table_y.is_empty() || table_x.len() != table_y.len() {
            return Err("Invalid lookup table".to_string());
        }

        // Find bracketing indices
        if x <= table_x[0] {
            return Ok(table_y[0]);
        }
        if x >= table_x[table_x.len() - 1] {
            return Ok(table_y[table_y.len() - 1]);
        }

        for i in 0..table_x.len() - 1 {
            if table_x[i] <= x && x <= table_x[i + 1] {
                let x0 = table_x[i];
                let x1 = table_x[i + 1];
                let y0 = table_y[i];
                let y1 = table_y[i + 1];

                let t = (x - x0) / (x1 - x0);
                return Ok(y0 * (1.0 - t) + y1 * t);
            }
        }

        Err("Interpolation failed".to_string())
    }

    /// Reset internal state (for new simulation)
    pub fn reset(&mut self) {
        match self {
            BlockComponent::Integrator {
                initial_value,
                state,
            } => {
                *state = *initial_value;
            }
            BlockComponent::Derivative {
                prev_input,
                filter_state,
                ..
            } => {
                *prev_input = 0.0;
                *filter_state = 0.0;
            }
            BlockComponent::Delay { buffer, .. } => {
                buffer.clear();
            }
            BlockComponent::RateLimiter { prev_output, .. } => {
                *prev_output = 0.0;
            }
            BlockComponent::Relay { state, .. } => {
                *state = false;
            }
            BlockComponent::Scope { buffer, .. } => {
                buffer.clear();
            }
            BlockComponent::PIDBlock { controller } => {
                controller.reset();
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gain_block() {
        let mut block = BlockComponent::gain(2.0);
        let output = block.compute(&[3.0], 0.0, 0.01).unwrap();
        assert!((output - 6.0).abs() < 1e-10);
    }

    #[test]
    fn test_sum_block_addition() {
        let mut block = BlockComponent::sum(vec![1, 1]);
        let output = block.compute(&[2.0, 3.0], 0.0, 0.01).unwrap();
        assert!((output - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_sum_block_subtraction() {
        let mut block = BlockComponent::sum(vec![1, -1]);
        let output = block.compute(&[5.0, 2.0], 0.0, 0.01).unwrap();
        assert!((output - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_product_block() {
        let mut block = BlockComponent::Product;
        let output = block.compute(&[2.0, 3.0, 4.0], 0.0, 0.01).unwrap();
        assert!((output - 24.0).abs() < 1e-10);
    }

    #[test]
    fn test_divide_block() {
        let mut block = BlockComponent::Divide;
        let output = block.compute(&[10.0, 2.0], 0.0, 0.01).unwrap();
        assert!((output - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_integrator_block() {
        let mut block = BlockComponent::integrator(0.0);
        let _ = block.compute(&[1.0], 0.0, 0.01).unwrap();  // First step
        let output = block.compute(&[1.0], 0.01, 0.01).unwrap();  // Second step
        assert!((output - 0.02).abs() < 1e-6);
    }

    #[test]
    fn test_step_block() {
        let mut block = BlockComponent::step(5.0, 0.5);
        let output_before = block.compute(&[], 0.0, 0.01).unwrap();
        let output_after = block.compute(&[], 1.0, 0.01).unwrap();
        assert!((output_before - 0.0).abs() < 1e-10);
        assert!((output_after - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_ramp_block() {
        let mut block = BlockComponent::Ramp {
            slope: 2.0,
            start_time: 0.0,
        };
        let output = block.compute(&[], 1.0, 0.01).unwrap();
        assert!((output - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_sine_block() {
        let mut block = BlockComponent::Sine {
            amplitude: 1.0,
            frequency: 1.0,  // 1 Hz
            phase: 0.0,
        };
        // At t=0, sin(0) = 0
        let output_0 = block.compute(&[], 0.0, 0.01).unwrap();
        assert!(output_0.abs() < 1e-10);

        // At t=0.25s, sin(π/2) = 1
        let output_quarter = block.compute(&[], 0.25, 0.01).unwrap();
        assert!((output_quarter - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_constant_block() {
        let mut block = BlockComponent::Constant { value: 7.5 };
        let output = block.compute(&[], 0.0, 0.01).unwrap();
        assert!((output - 7.5).abs() < 1e-10);
    }

    #[test]
    fn test_saturation_block() {
        let mut block = BlockComponent::saturation(-5.0, 5.0).unwrap();
        assert_eq!(block.compute(&[3.0], 0.0, 0.01).unwrap(), 3.0);
        assert_eq!(block.compute(&[10.0], 0.0, 0.01).unwrap(), 5.0);
        assert_eq!(block.compute(&[-10.0], 0.0, 0.01).unwrap(), -5.0);
    }

    #[test]
    fn test_deadzone_block() {
        let mut block = BlockComponent::Deadzone {
            lower_threshold: -1.0,
            upper_threshold: 1.0,
        };
        assert_eq!(block.compute(&[0.5], 0.0, 0.01).unwrap(), 0.0);
        assert!((block.compute(&[2.0], 0.0, 0.01).unwrap() - 1.0).abs() < 1e-10);
        assert!((block.compute(&[-2.0], 0.0, 0.01).unwrap() + 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_rate_limiter_block() {
        let mut block = BlockComponent::RateLimiter {
            rising_rate: 1.0,  // 1.0/s
            falling_rate: 1.0,
            prev_output: 0.0,
        };
        let _ = block.compute(&[10.0], 0.0, 0.01).unwrap();  // Limited to 0.01
        let output = block.compute(&[10.0], 0.01, 0.01).unwrap();
        assert!((output - 0.02).abs() < 1e-6);
    }

    #[test]
    fn test_switch_block() {
        let mut block = BlockComponent::Switch { threshold: 0.5 };
        let output_high = block.compute(&[1.0, 2.0, 0.7], 0.0, 0.01).unwrap();
        let output_low = block.compute(&[1.0, 2.0, 0.3], 0.0, 0.01).unwrap();
        assert!((output_high - 1.0).abs() < 1e-10);
        assert!((output_low - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_relay_block() {
        let mut block = BlockComponent::Relay {
            on_threshold: 0.5,
            off_threshold: -0.5,
            state: false,
            on_value: 1.0,
            off_value: 0.0,
        };
        // Low input: relay off
        let output_off = block.compute(&[-1.0], 0.0, 0.01).unwrap();
        assert!((output_off - 0.0).abs() < 1e-10);

        // High input: relay turns on
        let output_on = block.compute(&[1.0], 0.0, 0.01).unwrap();
        assert!((output_on - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_lookup1d_block() {
        let mut block = BlockComponent::Lookup1D {
            table_x: vec![0.0, 1.0, 2.0],
            table_y: vec![0.0, 1.0, 4.0],  // y = x²
        };
        // At x=0.5, should interpolate: y = 0.5
        let output = block.compute(&[0.5], 0.0, 0.01).unwrap();
        assert!((output - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_block_names() {
        assert_eq!(BlockComponent::gain(1.0).name(), "Gain");
        assert_eq!(BlockComponent::Product.name(), "Product");
        assert_eq!(BlockComponent::Constant { value: 1.0 }.name(), "Const");
    }

    #[test]
    fn test_block_input_counts() {
        assert_eq!(BlockComponent::gain(1.0).input_count(), Some(1));
        assert_eq!(BlockComponent::Divide.input_count(), Some(2));
        assert_eq!(BlockComponent::Constant { value: 1.0 }.input_count(), Some(0));
        assert_eq!(BlockComponent::Product.input_count(), None);  // Variable
    }

    #[test]
    fn test_block_reset() {
        let mut block = BlockComponent::integrator(0.0);
        let _ = block.compute(&[1.0], 0.0, 0.01).unwrap();
        block.reset();
        if let BlockComponent::Integrator { state, .. } = block {
            assert_eq!(state, 0.0);
        } else {
            panic!("Wrong block type");
        }
    }
}
