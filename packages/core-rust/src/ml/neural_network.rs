//! Phase 28 Task 1c: Simple Neural Network
//! Lightweight MLP with forward pass and gradient support

use std::f64::consts::PI;

/// Activation function types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ActivationFunction {
    ReLU,
    Tanh,
    Sigmoid,
    Linear,
}

impl ActivationFunction {
    pub fn activate(&self, x: f64) -> f64 {
        match self {
            ActivationFunction::ReLU => x.max(0.0),
            ActivationFunction::Tanh => x.tanh(),
            ActivationFunction::Sigmoid => 1.0 / (1.0 + (-x).exp()),
            ActivationFunction::Linear => x,
        }
    }

    pub fn derivative(&self, x: f64) -> f64 {
        match self {
            ActivationFunction::ReLU => if x > 0.0 { 1.0 } else { 0.0 },
            ActivationFunction::Tanh => 1.0 - x.tanh().powi(2),
            ActivationFunction::Sigmoid => {
                let sig = 1.0 / (1.0 + (-x).exp());
                sig * (1.0 - sig)
            }
            ActivationFunction::Linear => 1.0,
        }
    }
}

/// Single dense layer in neural network
#[derive(Debug, Clone)]
pub struct NetworkLayer {
    pub input_size: usize,
    pub output_size: usize,
    pub weights: Vec<Vec<f64>>,          // [output][input]
    pub biases: Vec<f64>,
    pub activation: ActivationFunction,
}

impl NetworkLayer {
    pub fn new(
        input_size: usize,
        output_size: usize,
        activation: ActivationFunction,
    ) -> Self {
        // Xavier/Glorot initialization
        let limit = (2.0 / (input_size + output_size) as f64).sqrt();

        let mut weights = vec![vec![0.0; input_size]; output_size];
        let mut biases = vec![0.0; output_size];

        use rand::Rng;
        let mut rng = rand::thread_rng();

        for w in &mut weights {
            for wi in w {
                *wi = rng.gen_range(-limit..limit);
            }
        }

        for b in &mut biases {
            *b = rng.gen_range(-limit..limit);
        }

        Self {
            input_size,
            output_size,
            weights,
            biases,
            activation,
        }
    }

    /// Forward pass through layer
    pub fn forward(&self, input: &[f64]) -> Vec<f64> {
        assert_eq!(input.len(), self.input_size);

        let mut output = vec![0.0; self.output_size];

        for (j, output_j) in output.iter_mut().enumerate() {
            // Compute weighted sum
            let mut sum = self.biases[j];
            for (i, &weight) in self.weights[j].iter().enumerate() {
                sum += weight * input[i];
            }

            // Apply activation
            *output_j = self.activation.activate(sum);
        }

        output
    }

    /// Forward pass with pre-activation values (for backprop)
    pub fn forward_with_preactivation(&self, input: &[f64]) -> (Vec<f64>, Vec<f64>) {
        assert_eq!(input.len(), self.input_size);

        let mut preactivations = vec![0.0; self.output_size];
        let mut output = vec![0.0; self.output_size];

        for (j, (pre, out)) in preactivations.iter_mut().zip(output.iter_mut()).enumerate() {
            let mut sum = self.biases[j];
            for (i, &weight) in self.weights[j].iter().enumerate() {
                sum += weight * input[i];
            }

            *pre = sum;
            *out = self.activation.activate(sum);
        }

        (output, preactivations)
    }

    /// Compute gradients for a batch
    pub fn compute_gradients(
        &self,
        input: &[f64],
        output_gradient: &[f64],
        preactivations: &[f64],
    ) -> (Vec<Vec<f64>>, Vec<f64>) {
        // Gradient w.r.t. weights: dL/dw_ij = dL/dout_j * dout_j/dz_j * dz_j/dw_ij
        //                                       = output_grad[j] * activation'(z_j) * input[i]
        let mut weight_gradients = vec![vec![0.0; self.input_size]; self.output_size];
        let mut bias_gradients = vec![0.0; self.output_size];

        for j in 0..self.output_size {
            let activation_deriv = self.activation.derivative(preactivations[j]);
            let delta = output_gradient[j] * activation_deriv;

            for i in 0..self.input_size {
                weight_gradients[j][i] = delta * input[i];
            }

            bias_gradients[j] = delta;
        }

        (weight_gradients, bias_gradients)
    }

    /// Update weights and biases using gradients
    pub fn update_parameters(&mut self, weight_gradients: &[Vec<f64>], bias_gradients: &[f64], learning_rate: f64) {
        for j in 0..self.output_size {
            for i in 0..self.input_size {
                self.weights[j][i] -= learning_rate * weight_gradients[j][i];
            }
            self.biases[j] -= learning_rate * bias_gradients[j];
        }
    }
}

/// Multi-layer perceptron (MLP) neural network
pub struct NeuralNetwork {
    pub layers: Vec<NetworkLayer>,
}

impl NeuralNetwork {
    pub fn new() -> Self {
        Self { layers: Vec::new() }
    }

    /// Add a dense layer to network
    pub fn add_layer(&mut self, layer: NetworkLayer) {
        self.layers.push(layer);
    }

    /// Forward pass through entire network
    pub fn forward(&self, input: &[f64]) -> Vec<f64> {
        let mut data = input.to_vec();

        for layer in &self.layers {
            data = layer.forward(&data);
        }

        data
    }

    /// Forward pass with intermediate activations (for backprop)
    pub fn forward_with_activations(&self, input: &[f64]) -> Vec<Vec<f64>> {
        let mut activations = vec![input.to_vec()];
        let mut data = input.to_vec();

        for layer in &self.layers {
            data = layer.forward(&data);
            activations.push(data.clone());
        }

        activations
    }

    /// Backward pass and parameter updates
    pub fn backward(&mut self, input: &[f64], output_gradient: &[f64], learning_rate: f64) {
        // Get all activations from forward pass
        let activations = self.forward_with_activations(input);

        let mut delta = output_gradient.to_vec();

        // Backpropagate through layers (reverse order)
        for layer_idx in (0..self.layers.len()).rev() {
            let layer = &mut self.layers[layer_idx];
            let layer_input = &activations[layer_idx];

            // Compute preactivations
            let mut preactivations = vec![0.0; layer.output_size];
            for (j, pre) in preactivations.iter_mut().enumerate() {
                let mut sum = layer.biases[j];
                for (i, &weight) in layer.weights[j].iter().enumerate() {
                    sum += weight * layer_input[i];
                }
                *pre = sum;
            }

            // Compute gradients
            let (weight_grads, bias_grads) = layer.compute_gradients(layer_input, &delta, &preactivations);

            // Update parameters
            layer.update_parameters(&weight_grads, &bias_grads, learning_rate);

            // Compute delta for previous layer
            if layer_idx > 0 {
                let mut prev_delta = vec![0.0; layer.input_size];
                for i in 0..layer.input_size {
                    for j in 0..layer.output_size {
                        prev_delta[i] += delta[j] * layer.weights[j][i];
                    }
                }
                delta = prev_delta;
            }
        }
    }

    /// Get network output size
    pub fn output_size(&self) -> usize {
        self.layers.last().map(|l| l.output_size).unwrap_or(0)
    }

    /// Get network input size
    pub fn input_size(&self) -> usize {
        self.layers.first().map(|l| l.input_size).unwrap_or(0)
    }

    /// Get total parameters
    pub fn count_parameters(&self) -> usize {
        let mut count = 0;
        for layer in &self.layers {
            count += layer.weights.len() * layer.weights[0].len();
            count += layer.biases.len();
        }
        count
    }

    /// Reset network weights (reinitialize)
    pub fn reset(&mut self) {
        for layer in &mut self.layers {
            let limit = (2.0 / (layer.input_size + layer.output_size) as f64).sqrt();

            use rand::Rng;
            let mut rng = rand::thread_rng();

            for w in &mut layer.weights {
                for wi in w {
                    *wi = rng.gen_range(-limit..limit);
                }
            }

            for b in &mut layer.biases {
                *b = rng.gen_range(-limit..limit);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_activation_relu() {
        assert_eq!(ActivationFunction::ReLU.activate(-1.0), 0.0);
        assert_eq!(ActivationFunction::ReLU.activate(2.0), 2.0);
    }

    #[test]
    fn test_activation_tanh() {
        let result = ActivationFunction::Tanh.activate(0.0);
        assert!((result - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_activation_sigmoid() {
        let result = ActivationFunction::Sigmoid.activate(0.0);
        assert!((result - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_activation_linear() {
        assert_eq!(ActivationFunction::Linear.activate(5.0), 5.0);
        assert_eq!(ActivationFunction::Linear.activate(-3.0), -3.0);
    }

    #[test]
    fn test_relu_derivative() {
        assert_eq!(ActivationFunction::ReLU.derivative(2.0), 1.0);
        assert_eq!(ActivationFunction::ReLU.derivative(-1.0), 0.0);
    }

    #[test]
    fn test_sigmoid_derivative() {
        let deriv = ActivationFunction::Sigmoid.derivative(0.0);
        assert!((deriv - 0.25).abs() < 0.01);
    }

    #[test]
    fn test_network_layer_creation() {
        let layer = NetworkLayer::new(10, 5, ActivationFunction::ReLU);
        assert_eq!(layer.input_size, 10);
        assert_eq!(layer.output_size, 5);
        assert_eq!(layer.weights.len(), 5);
        assert_eq!(layer.biases.len(), 5);
    }

    #[test]
    fn test_network_layer_forward() {
        let mut layer = NetworkLayer::new(3, 2, ActivationFunction::Linear);

        // Set weights to identity-like pattern
        layer.weights[0] = vec![1.0, 0.0, 0.0];
        layer.weights[1] = vec![0.0, 1.0, 0.0];
        layer.biases = vec![0.0, 0.0];

        let input = vec![2.0, 3.0, 4.0];
        let output = layer.forward(&input);

        assert!((output[0] - 2.0).abs() < 0.01);
        assert!((output[1] - 3.0).abs() < 0.01);
    }

    #[test]
    fn test_network_layer_forward_with_bias() {
        let mut layer = NetworkLayer::new(2, 1, ActivationFunction::Linear);

        layer.weights[0] = vec![1.0, 2.0];
        layer.biases[0] = 1.0;

        let input = vec![2.0, 3.0];
        let output = layer.forward(&input);

        // 1*2 + 2*3 + 1 = 2 + 6 + 1 = 9
        assert!((output[0] - 9.0).abs() < 0.01);
    }

    #[test]
    fn test_network_layer_forward_with_activation() {
        let mut layer = NetworkLayer::new(1, 1, ActivationFunction::ReLU);

        layer.weights[0] = vec![1.0];
        layer.biases[0] = -5.0;

        let input = vec![2.0];
        let output = layer.forward(&input);

        // 1*2 - 5 = -3, ReLU(-3) = 0
        assert!((output[0] - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_network_mlp_creation() {
        let mut net = NeuralNetwork::new();
        net.add_layer(NetworkLayer::new(10, 8, ActivationFunction::ReLU));
        net.add_layer(NetworkLayer::new(8, 4, ActivationFunction::ReLU));
        net.add_layer(NetworkLayer::new(4, 2, ActivationFunction::Linear));

        assert_eq!(net.input_size(), 10);
        assert_eq!(net.output_size(), 2);
        assert_eq!(net.layers.len(), 3);
    }

    #[test]
    fn test_network_mlp_forward() {
        let mut net = NeuralNetwork::new();
        net.add_layer(NetworkLayer::new(3, 2, ActivationFunction::Linear));

        // Set first layer to identity
        net.layers[0].weights[0] = vec![1.0, 0.0, 0.0];
        net.layers[0].weights[1] = vec![0.0, 1.0, 0.0];
        net.layers[0].biases = vec![0.0, 0.0];

        let input = vec![1.0, 2.0, 3.0];
        let output = net.forward(&input);

        assert_eq!(output.len(), 2);
        assert!((output[0] - 1.0).abs() < 0.01);
        assert!((output[1] - 2.0).abs() < 0.01);
    }

    #[test]
    fn test_network_forward_with_activations() {
        let mut net = NeuralNetwork::new();
        net.add_layer(NetworkLayer::new(2, 2, ActivationFunction::Linear));

        let input = vec![1.0, 2.0];
        let activations = net.forward_with_activations(&input);

        // Should have input + output from each layer
        assert_eq!(activations.len(), 2);
        assert_eq!(activations[0].len(), 2); // Input
        assert_eq!(activations[1].len(), 2); // Output
    }

    #[test]
    fn test_network_parameter_count() {
        let mut net = NeuralNetwork::new();
        net.add_layer(NetworkLayer::new(10, 5, ActivationFunction::ReLU));
        net.add_layer(NetworkLayer::new(5, 3, ActivationFunction::Linear));

        // Layer 1: 10*5 + 5 = 55
        // Layer 2: 5*3 + 3 = 18
        // Total: 73
        assert_eq!(net.count_parameters(), 73);
    }

    #[test]
    fn test_network_gradient_computation() {
        let layer = NetworkLayer::new(2, 1, ActivationFunction::Linear);

        let input = vec![1.0, 2.0];
        let output_gradient = vec![0.5];
        let preactivations = vec![2.5];

        let (weight_grads, bias_grads) = layer.compute_gradients(&input, &output_gradient, &preactivations);

        assert_eq!(weight_grads.len(), 1);
        assert_eq!(weight_grads[0].len(), 2);
        assert_eq!(bias_grads.len(), 1);
    }

    #[test]
    fn test_network_backward_pass() {
        let mut net = NeuralNetwork::new();
        net.add_layer(NetworkLayer::new(2, 1, ActivationFunction::Linear));

        let input = vec![1.0, 2.0];
        let output_gradient = vec![1.0];

        let output_before = net.forward(&input);

        // Backward pass with learning rate
        net.backward(&input, &output_gradient, 0.01);

        let output_after = net.forward(&input);

        // Output should have changed after update
        assert_ne!(output_before[0], output_after[0]);
    }

    #[test]
    fn test_network_reset() {
        let mut net = NeuralNetwork::new();
        net.add_layer(NetworkLayer::new(3, 2, ActivationFunction::ReLU));

        let original_weights = net.layers[0].weights.clone();

        net.reset();

        let reset_weights = net.layers[0].weights.clone();

        // Weights should be different (with very high probability)
        let changed = original_weights
            .iter()
            .zip(reset_weights.iter())
            .any(|(a, b)| a != b);

        assert!(changed);
    }

    #[test]
    fn test_network_hidden_layer_propagation() {
        let mut net = NeuralNetwork::new();
        net.add_layer(NetworkLayer::new(4, 3, ActivationFunction::ReLU));
        net.add_layer(NetworkLayer::new(3, 2, ActivationFunction::Linear));

        let input = vec![1.0, 2.0, 3.0, 4.0];
        let output = net.forward(&input);

        assert_eq!(output.len(), 2);
    }

    #[test]
    fn test_layer_preactivations() {
        let mut layer = NetworkLayer::new(2, 1, ActivationFunction::Linear);
        layer.weights[0] = vec![1.0, 2.0];
        layer.biases[0] = 3.0;

        let input = vec![1.0, 1.0];
        let (output, preactivations) = layer.forward_with_preactivation(&input);

        // preactivation = 1*1 + 2*1 + 3 = 6
        // output = 6 (linear activation)
        assert!((preactivations[0] - 6.0).abs() < 0.01);
        assert!((output[0] - 6.0).abs() < 0.01);
    }
}
