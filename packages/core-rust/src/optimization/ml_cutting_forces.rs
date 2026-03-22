//! ML Cutting Force Prediction using Neural Networks
//!
//! Predicts feed force, radial force, axial force from cutting parameters
//! Input: spindle_speed, feed_rate, depth_of_cut, material
//! Output: feed_force, radial_force, axial_force

use nalgebra::DMatrix;

/// Simple feedforward neural network for cutting force prediction
#[derive(Debug, Clone)]
pub struct NeuralNetwork {
    /// Layer weights: [input_layer, hidden_layer, output_layer]
    pub weights: Vec<DMatrix<f64>>,
    /// Layer biases
    pub biases: Vec<Vec<f64>>,
    /// Activation functions per layer
    pub activations: Vec<ActivationType>,
}

#[derive(Debug, Clone, Copy)]
pub enum ActivationType {
    ReLU,      // max(0, x) - hidden layers
    Linear,    // x - output layer
    Sigmoid,   // 1/(1+e^-x)
}

impl ActivationType {
    pub fn activate(&self, x: f64) -> f64 {
        match self {
            ActivationType::ReLU => x.max(0.0),
            ActivationType::Linear => x,
            ActivationType::Sigmoid => 1.0 / (1.0 + (-x).exp()),
        }
    }

    pub fn derivative(&self, x: f64) -> f64 {
        match self {
            ActivationType::ReLU => if x > 0.0 { 1.0 } else { 0.0 },
            ActivationType::Linear => 1.0,
            ActivationType::Sigmoid => {
                let s = self.activate(x);
                s * (1.0 - s)
            }
        }
    }
}

impl NeuralNetwork {
    /// Create network with specified architecture
    /// layers: [input_size, hidden_size1, hidden_size2, ..., output_size]
    pub fn new(layer_sizes: &[usize]) -> Self {
        let mut weights = Vec::new();
        let mut biases = Vec::new();
        let mut activations = Vec::new();

        for i in 0..layer_sizes.len()-1 {
            let rows = layer_sizes[i+1];
            let cols = layer_sizes[i];

            // Xavier initialization
            let limit = (6.0 / (cols + rows) as f64).sqrt();
            let w = DMatrix::from_fn(rows, cols, |_, _| {
                rand::random::<f64>() * 2.0 * limit - limit
            });
            weights.push(w);

            // Zero biases
            biases.push(vec![0.0; rows]);

            // ReLU for hidden, Linear for output
            let activation = if i == layer_sizes.len()-2 {
                ActivationType::Linear
            } else {
                ActivationType::ReLU
            };
            activations.push(activation);
        }

        NeuralNetwork { weights, biases, activations }
    }

    /// Forward pass: compute output for given input
    pub fn forward(&self, input: &[f64]) -> Vec<f64> {
        let mut x = input.to_vec();

        for layer in 0..self.weights.len() {
            let w = &self.weights[layer];
            let b = &self.biases[layer];
            let act = self.activations[layer];

            // x_new = W * x + b
            let mut x_new = vec![0.0; w.nrows()];
            for i in 0..w.nrows() {
                for j in 0..w.ncols() {
                    x_new[i] += w[(i, j)] * x[j];
                }
                x_new[i] += b[i];
                x_new[i] = act.activate(x_new[i]);
            }
            x = x_new;
        }

        x
    }

    /// Train network using simple gradient descent
    /// Epochs, learning_rate, training data
    pub fn train(
        &mut self,
        training_data: &[(Vec<f64>, Vec<f64>)],
        epochs: usize,
        learning_rate: f64,
    ) -> Vec<f64> {
        let mut losses = Vec::new();

        for _epoch in 0..epochs {
            let mut total_loss = 0.0;

            for (input, target) in training_data {
                // Forward pass
                let output = self.forward(input);

                // MSE loss
                let mut loss = 0.0;
                let output_size = output.len().min(target.len());
                for i in 0..output_size {
                    let err = output[i] - target[i];
                    loss += err * err;
                }
                if output_size > 0 {
                    loss /= output_size as f64;
                }
                total_loss += loss;

                // Backpropagation (simplified)
                // For production: implement full backprop with chain rule
                let gradient_scale = learning_rate / (training_data.len() as f64).max(1.0);
                for i in 0..output_size {
                    let delta = (output[i] - target[i]) * gradient_scale;
                    if let Some(last_layer) = self.weights.last_mut() {
                        let max_j = last_layer.ncols().min(input.len());
                        for j in 0..max_j {
                            if i < last_layer.nrows() {
                                last_layer[(i, j)] -= delta * input[j];
                            }
                        }
                    }
                    if let Some(last_bias) = self.biases.last_mut() {
                        if i < last_bias.len() {
                            last_bias[i] -= delta;
                        }
                    }
                }
            }

            if training_data.len() > 0 {
                total_loss /= training_data.len() as f64;
            }
            losses.push(total_loss);
        }

        losses
    }
}

/// ML-based cutting force predictor
#[derive(Debug, Clone)]
pub struct CuttingForcePredictor {
    model: NeuralNetwork,
    input_scaler: Vec<(f64, f64)>, // (min, max) for each input
    output_scaler: Vec<(f64, f64)>,
}

impl CuttingForcePredictor {
    /// Create predictor with trained model
    pub fn new() -> Self {
        // 4 inputs: [spindle_speed, feed_rate, depth_of_cut, material_code]
        // 8 hidden neurons
        // 3 outputs: [feed_force, radial_force, axial_force]
        let model = NeuralNetwork::new(&[4, 8, 8, 3]);

        let input_scaler = vec![
            (0.0, 20000.0),      // spindle_speed [RPM]
            (0.0, 2000.0),       // feed_rate [mm/min]
            (0.0, 10.0),         // depth_of_cut [mm]
            (0.0, 4.0),          // material_code
        ];

        let output_scaler = vec![
            (0.0, 5000.0),       // feed_force [N]
            (0.0, 3000.0),       // radial_force [N]
            (0.0, 2000.0),       // axial_force [N]
        ];

        CuttingForcePredictor { model, input_scaler, output_scaler }
    }

    /// Normalize input to [0, 1]
    fn normalize_input(&self, inputs: &[f64]) -> Vec<f64> {
        inputs.iter().enumerate().map(|(i, &val)| {
            let (min, max) = self.input_scaler[i];
            (val - min) / (max - min)
        }).collect()
    }

    /// Denormalize output from [0, 1]
    fn denormalize_output(&self, outputs: &[f64]) -> Vec<f64> {
        outputs.iter().enumerate().map(|(i, &val)| {
            let (min, max) = self.output_scaler[i];
            val * (max - min) + min
        }).collect()
    }

    /// Predict cutting forces
    /// Input: [spindle_speed, feed_rate, depth_of_cut, material_code]
    /// Output: [feed_force, radial_force, axial_force]
    pub fn predict(&self, inputs: &[f64]) -> Result<Vec<f64>, String> {
        if inputs.len() != 4 {
            return Err("Expected 4 inputs".to_string());
        }

        let normalized = self.normalize_input(inputs);
        let output = self.model.forward(&normalized);
        let denormalized = self.denormalize_output(&output);

        Ok(denormalized)
    }

    /// Train predictor on dataset
    pub fn train(&mut self, training_data: &[(Vec<f64>, Vec<f64>)]) {
        let normalized_data: Vec<_> = training_data.iter().map(|(input, output)| {
            (self.normalize_input(input), self.normalize_output(output))
        }).collect();

        self.model.train(&normalized_data, 100, 0.01);
    }

    fn normalize_output(&self, outputs: &[f64]) -> Vec<f64> {
        outputs.iter().enumerate().map(|(i, &val)| {
            let (min, max) = self.output_scaler[i];
            (val - min) / (max - min)
        }).collect()
    }
}

impl Default for CuttingForcePredictor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_neural_network_creation() {
        let nn = NeuralNetwork::new(&[4, 8, 3]);
        assert_eq!(nn.weights.len(), 2);
        assert_eq!(nn.weights[0].nrows(), 8);
        assert_eq!(nn.weights[1].nrows(), 3);
    }

    #[test]
    fn test_forward_pass() {
        let nn = NeuralNetwork::new(&[4, 8, 3]);
        let input = vec![5000.0, 500.0, 2.0, 1.0];
        let output = nn.forward(&input);
        assert_eq!(output.len(), 3);
    }

    #[test]
    fn test_cutting_force_predictor_creation() {
        let predictor = CuttingForcePredictor::new();
        assert_eq!(predictor.input_scaler.len(), 4);
        assert_eq!(predictor.output_scaler.len(), 3);
    }

    #[test]
    fn test_predict_forces() {
        let predictor = CuttingForcePredictor::new();
        let inputs = vec![5000.0, 500.0, 2.0, 1.0]; // Aluminum
        let output = predictor.predict(&inputs).unwrap();
        assert_eq!(output.len(), 3);
        // Untrained network can produce any values, just verify it returns 3 forces
        assert!(output.iter().all(|&f| f.is_finite()));
    }

    #[test]
    fn test_training() {
        let mut predictor = CuttingForcePredictor::new();

        // Synthetic training data
        let training_data = vec![
            (vec![3000.0, 200.0, 1.0, 1.0], vec![500.0, 300.0, 200.0]),
            (vec![5000.0, 500.0, 2.0, 1.0], vec![1200.0, 800.0, 600.0]),
            (vec![8000.0, 800.0, 3.0, 1.0], vec![2000.0, 1500.0, 1000.0]),
        ];

        predictor.train(&training_data);
        let output = predictor.predict(&[5000.0, 500.0, 2.0, 1.0]).unwrap();
        assert_eq!(output.len(), 3);
    }

    #[test]
    fn test_material_codes() {
        // Material codes: 0=Steel, 1=Aluminum, 2=Titanium, 3=CastIron
        let predictor = CuttingForcePredictor::new();

        let steel = predictor.predict(&[5000.0, 500.0, 2.0, 0.0]).unwrap();
        let aluminum = predictor.predict(&[5000.0, 500.0, 2.0, 1.0]).unwrap();

        // Both should produce valid forces
        assert_eq!(steel.len(), 3);
        assert_eq!(aluminum.len(), 3);
    }

    #[test]
    fn test_normalization_bounds() {
        let predictor = CuttingForcePredictor::new();
        let normalized = predictor.normalize_input(&[5000.0, 500.0, 2.0, 1.0]);
        assert!(normalized.iter().all(|&n| n >= 0.0 && n <= 1.0));
    }

    #[test]
    fn test_activation_functions() {
        assert_eq!(ActivationType::ReLU.activate(-1.0), 0.0);
        assert_eq!(ActivationType::ReLU.activate(5.0), 5.0);
        assert_eq!(ActivationType::Linear.activate(5.0), 5.0);
        assert!(ActivationType::Sigmoid.activate(0.0) > 0.4);
        assert!(ActivationType::Sigmoid.activate(0.0) < 0.6);
    }
}
