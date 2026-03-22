//! Extended node library for FBP - Scientific Computing & Signal Processing
//!
//! Provides 40+ specialized nodes for:
//! - Scientific computing (statistics, linear algebra, numerical methods)
//! - Signal processing (filters, FFT, correlation)
//! - Data transformation and advanced utilities

use crate::domains::flow_based::{DataType, FlowNode, FlowNodeId, FlowPort, NodeCategory};

/// Extended node factory for specialized operations
pub struct ExtendedNodes;

impl ExtendedNodes {
    // ===== STATISTICS NODES =====

    /// Mean (average) of array elements
    pub fn mean() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Mean", "mean", NodeCategory::Math)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates arithmetic mean of array elements")
    }

    /// Median of array elements
    pub fn median() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Median", "median", NodeCategory::Math)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates median of array elements")
    }

    /// Standard deviation
    pub fn std_dev() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Std Dev", "std_dev", NodeCategory::Math)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates standard deviation of array")
    }

    /// Variance
    pub fn variance() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Variance", "variance", NodeCategory::Math)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates variance of array elements")
    }

    /// Sum of array elements
    pub fn sum() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Sum", "sum", NodeCategory::Math)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates sum of array elements")
    }

    /// Product of array elements
    pub fn product() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Product", "product", NodeCategory::Math)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates product of array elements")
    }

    // ===== TRIGONOMETRIC & ADVANCED MATH NODES =====

    /// Sine function
    pub fn sin() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Sin", "sin", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates sine of angle (in radians)")
    }

    /// Cosine function
    pub fn cos() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Cos", "cos", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates cosine of angle (in radians)")
    }

    /// Tangent function
    pub fn tan() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Tan", "tan", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates tangent of angle (in radians)")
    }

    /// Logarithm (natural log)
    pub fn ln() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Ln", "ln", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates natural logarithm (ln)")
    }

    /// Logarithm base 10
    pub fn log10() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Log10", "log10", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates logarithm base 10")
    }

    /// Logarithm with arbitrary base
    pub fn logn() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "LogN", "logn", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_input(FlowPort::input("base", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates logarithm with arbitrary base")
    }

    /// Exponential (e^x)
    pub fn exp() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Exp", "exp", NodeCategory::Math)
            .add_input(FlowPort::input("value", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates exponential (e^x)")
    }

    // ===== SIGNAL PROCESSING NODES =====

    /// Low-pass filter
    pub fn lowpass_filter() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Lowpass Filter", "lowpass_filter", NodeCategory::Control)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("cutoff", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Applies low-pass filter to signal")
    }

    /// High-pass filter
    pub fn highpass_filter() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Highpass Filter", "highpass_filter", NodeCategory::Control)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("cutoff", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Applies high-pass filter to signal")
    }

    /// Band-pass filter
    pub fn bandpass_filter() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Bandpass Filter", "bandpass_filter", NodeCategory::Control)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("low_freq", DataType::Number).required())
            .add_input(FlowPort::input("high_freq", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Applies band-pass filter to signal")
    }

    /// Moving average (smoothing)
    pub fn moving_average() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Moving Average", "moving_average", NodeCategory::Array)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("window_size", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Applies moving average filter to smooth signal")
    }

    /// Correlation between two signals
    pub fn correlate() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Correlate", "correlate", NodeCategory::Array)
            .add_input(FlowPort::input("signal1", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("signal2", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("correlation", DataType::Number))
            .with_description("Calculates correlation coefficient between signals")
    }

    /// Convolution of two signals
    pub fn convolve() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Convolve", "convolve", NodeCategory::Array)
            .add_input(FlowPort::input("signal1", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("signal2", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Computes convolution of two signals")
    }

    /// Discrete Fourier Transform (FFT)
    pub fn fft() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "FFT", "fft", NodeCategory::Array)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("magnitude", DataType::Array(Box::new(DataType::Any))))
            .add_output(FlowPort::output("phase", DataType::Array(Box::new(DataType::Any))))
            .with_description("Computes Fast Fourier Transform (frequency domain analysis)")
    }

    /// Inverse FFT
    pub fn ifft() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "IFFT", "ifft", NodeCategory::Array)
            .add_input(FlowPort::input("magnitude", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("phase", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("signal", DataType::Array(Box::new(DataType::Any))))
            .with_description("Computes Inverse FFT (returns to time domain)")
    }

    // ===== NUMERICAL ANALYSIS NODES =====

    /// Numerical differentiation (derivative)
    pub fn derivative() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Derivative", "derivative", NodeCategory::Math)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("dx", DataType::Number).with_default("1".to_string()))
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Computes numerical derivative (finite difference)")
    }

    /// Numerical integration (cumulative sum)
    pub fn integrate() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Integrate", "integrate", NodeCategory::Math)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("dx", DataType::Number).with_default("1".to_string()))
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Computes numerical integration (area under curve)")
    }

    /// Linear interpolation
    pub fn lerp() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Lerp", "lerp", NodeCategory::Math)
            .add_input(FlowPort::input("x1", DataType::Number).required())
            .add_input(FlowPort::input("y1", DataType::Number).required())
            .add_input(FlowPort::input("x2", DataType::Number).required())
            .add_input(FlowPort::input("y2", DataType::Number).required())
            .add_input(FlowPort::input("x", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Linear interpolation between two points")
    }

    /// Polynomial evaluation
    pub fn polyeval() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "PolyEval", "polyeval", NodeCategory::Math)
            .add_input(FlowPort::input("coefficients", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("x", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Evaluates polynomial at given x value")
    }

    // ===== TRANSFORMATION NODES =====

    /// Normalize array (0-1 range)
    pub fn normalize() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Normalize", "normalize", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Normalizes array values to [0, 1] range")
    }

    /// Standardize array (zero mean, unit variance)
    pub fn standardize() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Standardize", "standardize", NodeCategory::Array)
            .add_input(FlowPort::input("array", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Standardizes array (zero mean, unit variance)")
    }

    /// Resample array to different size
    pub fn resample() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Resample", "resample", NodeCategory::Array)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("new_size", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Resamples signal to new size")
    }

    /// Downsample array by factor
    pub fn downsample() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Downsample", "downsample", NodeCategory::Array)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("factor", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Downsamples signal by given factor")
    }

    /// Upsample array by factor
    pub fn upsample() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Upsample", "upsample", NodeCategory::Array)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("factor", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Upsamples signal by given factor")
    }

    // ===== WINDOWING FUNCTIONS =====

    /// Hamming window
    pub fn hamming_window() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Hamming Window", "hamming_window", NodeCategory::Array)
            .add_input(FlowPort::input("size", DataType::Number).required())
            .add_output(FlowPort::output("window", DataType::Array(Box::new(DataType::Any))))
            .with_description("Generates Hamming window for FFT pre-processing")
    }

    /// Hann window
    pub fn hann_window() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Hann Window", "hann_window", NodeCategory::Array)
            .add_input(FlowPort::input("size", DataType::Number).required())
            .add_output(FlowPort::output("window", DataType::Array(Box::new(DataType::Any))))
            .with_description("Generates Hann window for FFT pre-processing")
    }

    /// Blackman window
    pub fn blackman_window() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Blackman Window", "blackman_window", NodeCategory::Array)
            .add_input(FlowPort::input("size", DataType::Number).required())
            .add_output(FlowPort::output("window", DataType::Array(Box::new(DataType::Any))))
            .with_description("Generates Blackman window for FFT pre-processing")
    }

    // ===== HISTOGRAM & DISTRIBUTION NODES =====

    /// Histogram (bin counts)
    pub fn histogram() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Histogram", "histogram", NodeCategory::Array)
            .add_input(FlowPort::input("data", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("num_bins", DataType::Number).required())
            .add_output(FlowPort::output("bins", DataType::Array(Box::new(DataType::Any))))
            .add_output(FlowPort::output("edges", DataType::Array(Box::new(DataType::Any))))
            .with_description("Computes histogram of data distribution")
    }

    /// Cumulative distribution function
    pub fn cdf() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "CDF", "cdf", NodeCategory::Array)
            .add_input(FlowPort::input("data", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("result", DataType::Array(Box::new(DataType::Any))))
            .with_description("Computes cumulative distribution function")
    }

    /// Quantile
    pub fn quantile() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Quantile", "quantile", NodeCategory::Math)
            .add_input(FlowPort::input("data", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("q", DataType::Number).required())
            .add_output(FlowPort::output("result", DataType::Number))
            .with_description("Calculates quantile of data (0 <= q <= 1)")
    }

    // ===== COMPOSITE/MACRO NODES =====

    /// Linear regression (simple)
    pub fn linear_regression() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Linear Regression", "linear_regression", NodeCategory::Array)
            .add_input(FlowPort::input("x", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("y", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("slope", DataType::Number))
            .add_output(FlowPort::output("intercept", DataType::Number))
            .add_output(FlowPort::output("r_squared", DataType::Number))
            .with_description("Fits linear regression (y = mx + b)")
    }

    /// Polynomial fitting
    pub fn polyfit() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Polyfit", "polyfit", NodeCategory::Array)
            .add_input(FlowPort::input("x", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("y", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("degree", DataType::Number).required())
            .add_output(FlowPort::output("coefficients", DataType::Array(Box::new(DataType::Any))))
            .add_output(FlowPort::output("r_squared", DataType::Number))
            .with_description("Fits polynomial of given degree")
    }

    /// Peak detection
    pub fn find_peaks() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Find Peaks", "find_peaks", NodeCategory::Array)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_input(FlowPort::input("threshold", DataType::Number).with_default("0".to_string()))
            .add_output(FlowPort::output("indices", DataType::Array(Box::new(DataType::Any))))
            .add_output(FlowPort::output("values", DataType::Array(Box::new(DataType::Any))))
            .with_description("Finds peaks in signal above threshold")
    }

    /// Zero crossing detection
    pub fn zero_crossings() -> FlowNode {
        FlowNode::new(FlowNodeId::new(), "Zero Crossings", "zero_crossings", NodeCategory::Array)
            .add_input(FlowPort::input("signal", DataType::Array(Box::new(DataType::Any))).required())
            .add_output(FlowPort::output("indices", DataType::Array(Box::new(DataType::Any))))
            .add_output(FlowPort::output("count", DataType::Number))
            .with_description("Detects zero crossings in signal")
    }

    /// Get all extended nodes
    pub fn all_extended_nodes() -> Vec<FlowNode> {
        vec![
            // Statistics (6 nodes)
            Self::mean(),
            Self::median(),
            Self::std_dev(),
            Self::variance(),
            Self::sum(),
            Self::product(),

            // Trigonometric & Advanced Math (7 nodes)
            Self::sin(),
            Self::cos(),
            Self::tan(),
            Self::ln(),
            Self::log10(),
            Self::logn(),
            Self::exp(),

            // Signal Processing (7 nodes)
            Self::lowpass_filter(),
            Self::highpass_filter(),
            Self::bandpass_filter(),
            Self::moving_average(),
            Self::correlate(),
            Self::convolve(),
            Self::fft(),

            // Inverse FFT
            Self::ifft(),

            // Numerical Analysis (4 nodes)
            Self::derivative(),
            Self::integrate(),
            Self::lerp(),
            Self::polyeval(),

            // Transformation (5 nodes)
            Self::normalize(),
            Self::standardize(),
            Self::resample(),
            Self::downsample(),
            Self::upsample(),

            // Windowing (3 nodes)
            Self::hamming_window(),
            Self::hann_window(),
            Self::blackman_window(),

            // Histogram & Distribution (3 nodes)
            Self::histogram(),
            Self::cdf(),
            Self::quantile(),

            // Composite/Macro (4 nodes)
            Self::linear_regression(),
            Self::polyfit(),
            Self::find_peaks(),
            Self::zero_crossings(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extended_nodes_creation() {
        let nodes = ExtendedNodes::all_extended_nodes();
        assert_eq!(nodes.len(), 39, "Expected 39 extended nodes, got {}", nodes.len());

        // Verify no duplicate IDs
        let mut ids = std::collections::HashSet::new();
        for node in &nodes {
            assert!(ids.insert(node.id), "Duplicate node ID found for {}", node.name);
        }
    }

    #[test]
    fn test_mean_node_creation() {
        let node = ExtendedNodes::mean();
        assert_eq!(node.name, "Mean");
        assert_eq!(node.node_type, "mean");
        assert_eq!(node.inputs.len(), 1);
        assert_eq!(node.outputs.len(), 1);
    }

    #[test]
    fn test_fft_node_creation() {
        let node = ExtendedNodes::fft();
        assert_eq!(node.name, "FFT");
        assert_eq!(node.node_type, "fft");
        assert_eq!(node.inputs.len(), 1);
        assert_eq!(node.outputs.len(), 2); // magnitude and phase
    }

    #[test]
    fn test_linear_regression_node_creation() {
        let node = ExtendedNodes::linear_regression();
        assert_eq!(node.name, "Linear Regression");
        assert_eq!(node.node_type, "linear_regression");
        assert_eq!(node.inputs.len(), 2); // x and y
        assert_eq!(node.outputs.len(), 3); // slope, intercept, r_squared
    }

    #[test]
    fn test_signal_processing_nodes_count() {
        let mut count = 0;
        let all_nodes = ExtendedNodes::all_extended_nodes();

        for node in &all_nodes {
            if node.node_type.contains("filter") ||
               node.node_type.contains("fft") ||
               node.node_type.contains("correlate") ||
               node.node_type.contains("convolve") {
                count += 1;
            }
        }

        assert!(count >= 7, "Expected at least 7 signal processing nodes, got {}", count);
    }

    #[test]
    fn test_statistics_nodes_count() {
        let mut count = 0;
        let all_nodes = ExtendedNodes::all_extended_nodes();

        for node in &all_nodes {
            if node.node_type == "mean" ||
               node.node_type == "median" ||
               node.node_type == "std_dev" ||
               node.node_type == "variance" ||
               node.node_type == "sum" ||
               node.node_type == "product" {
                count += 1;
            }
        }

        assert_eq!(count, 6, "Expected 6 statistics nodes, got {}", count);
    }

    #[test]
    fn test_all_nodes_have_descriptions() {
        let nodes = ExtendedNodes::all_extended_nodes();
        for node in nodes {
            assert!(!node.description.is_empty(), "Node {} has no description", node.name);
        }
    }

    #[test]
    fn test_all_nodes_have_unique_types() {
        let nodes = ExtendedNodes::all_extended_nodes();
        let mut types = std::collections::HashSet::new();
        for node in nodes {
            assert!(types.insert(node.node_type.clone()),
                   "Duplicate node type: {}", node.node_type);
        }
    }
}
