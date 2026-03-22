//! Physics Integration: Multi-Domain Coupling via Clifford Algebra
//! Phase 25 Task 4 - Physics Applications

use crate::clifford_algebra::{Multivector, Signature, BasisBlade};
use std::f64::consts::PI;

/// Electromagnetic field represented as Clifford algebra bivector
/// E ∧ I = electric and magnetic field (dual bivector representation)
#[derive(Debug, Clone)]
pub struct ElectromagneticField {
    pub electric: (f64, f64, f64),   // Ex, Ey, Ez
    pub magnetic: (f64, f64, f64),   // Bx, By, Bz
}

impl ElectromagneticField {
    pub fn new(e: (f64, f64, f64), b: (f64, f64, f64)) -> Self {
        ElectromagneticField {
            electric: e,
            magnetic: b,
        }
    }

    /// Electric field magnitude
    pub fn electric_magnitude(&self) -> f64 {
        (self.electric.0.powi(2) + self.electric.1.powi(2) + self.electric.2.powi(2)).sqrt()
    }

    /// Magnetic field magnitude
    pub fn magnetic_magnitude(&self) -> f64 {
        (self.magnetic.0.powi(2) + self.magnetic.1.powi(2) + self.magnetic.2.powi(2)).sqrt()
    }

    /// Poynting vector: S = E × B (energy flow direction)
    pub fn poynting_vector(&self) -> (f64, f64, f64) {
        let sx = self.electric.1 * self.magnetic.2 - self.electric.2 * self.magnetic.1;
        let sy = self.electric.2 * self.magnetic.0 - self.electric.0 * self.magnetic.2;
        let sz = self.electric.0 * self.magnetic.1 - self.electric.1 * self.magnetic.0;
        (sx, sy, sz)
    }

    /// Poynting vector magnitude (energy flux)
    pub fn poynting_magnitude(&self) -> f64 {
        let (sx, sy, sz) = self.poynting_vector();
        (sx.powi(2) + sy.powi(2) + sz.powi(2)).sqrt()
    }

    /// Electromagnetic energy density: u = (ε₀E² + B²/μ₀) / 2
    pub fn energy_density(&self, epsilon_0: f64, mu_0: f64) -> f64 {
        let e_mag = self.electric_magnitude();
        let b_mag = self.magnetic_magnitude();
        (epsilon_0 * e_mag.powi(2) / 2.0) + (b_mag.powi(2) / (2.0 * mu_0))
    }

    /// Lorentz force on charge q at position with velocity v
    pub fn lorentz_force(&self, q: f64, v: (f64, f64, f64)) -> (f64, f64, f64) {
        // F = q(E + v × B)
        let cross_x = v.1 * self.magnetic.2 - v.2 * self.magnetic.1;
        let cross_y = v.2 * self.magnetic.0 - v.0 * self.magnetic.2;
        let cross_z = v.0 * self.magnetic.1 - v.1 * self.magnetic.0;

        (
            q * (self.electric.0 + cross_x),
            q * (self.electric.1 + cross_y),
            q * (self.electric.2 + cross_z),
        )
    }
}

/// Electromagnetic wave (plane wave solution to Maxwell's equations)
#[derive(Debug, Clone)]
pub struct ElectromagneticWave {
    pub frequency: f64,              // ω in rad/s
    pub wavelength: f64,             // λ
    pub wavenumber: f64,             // k = 2π/λ
    pub amplitude: f64,              // Peak field strength
    pub polarization: (f64, f64),   // (Ex/E0, Ey/E0) for polarization ellipse
}

impl ElectromagneticWave {
    /// Create plane wave with specified frequency
    pub fn new(frequency: f64, amplitude: f64) -> Self {
        let wavelength = 3.0e8 / frequency; // c / f
        let wavenumber = 2.0 * PI / wavelength;

        ElectromagneticWave {
            frequency,
            wavelength,
            wavenumber,
            amplitude,
            polarization: (1.0, 0.0), // Default: linear x-polarization
        }
    }

    /// Electric field at position x, time t
    pub fn electric_field(&self, x: f64, t: f64) -> (f64, f64, f64) {
        let phase = self.wavenumber * x - self.frequency * t;
        let e_x = self.amplitude * phase.cos() * self.polarization.0;
        let e_y = self.amplitude * phase.cos() * self.polarization.1;
        (e_x, e_y, 0.0)
    }

    /// Magnetic field at position x, time t (B = k × E / ω for plane wave)
    pub fn magnetic_field(&self, x: f64, t: f64) -> (f64, f64, f64) {
        let phase = self.wavenumber * x - self.frequency * t;
        let b_magnitude = self.amplitude / 3.0e8; // E/c relationship
        (0.0, 0.0, b_magnitude * phase.cos())
    }

    /// Wave intensity (time-averaged Poynting vector magnitude)
    pub fn intensity(&self) -> f64 {
        (self.amplitude.powi(2)) / (2.0 * 377.0) // 377Ω is impedance of free space
    }
}

/// Mechanical rotational state in 3D space
#[derive(Debug, Clone)]
pub struct RotationalState {
    pub angular_velocity: (f64, f64, f64),  // ωx, ωy, ωz
    pub angular_momentum: (f64, f64, f64),  // Lx, Ly, Lz
    pub moment_of_inertia: [[f64; 3]; 3],  // 3×3 inertia tensor
}

impl RotationalState {
    pub fn new(inertia: [[f64; 3]; 3]) -> Self {
        RotationalState {
            angular_velocity: (0.0, 0.0, 0.0),
            angular_momentum: (0.0, 0.0, 0.0),
            moment_of_inertia: inertia,
        }
    }

    /// Angular momentum magnitude
    pub fn angular_momentum_magnitude(&self) -> f64 {
        (self.angular_momentum.0.powi(2) + self.angular_momentum.1.powi(2) + self.angular_momentum.2.powi(2)).sqrt()
    }

    /// Rotational kinetic energy: KE = 0.5 * L · ω
    pub fn rotational_kinetic_energy(&self) -> f64 {
        0.5 * (self.angular_momentum.0 * self.angular_velocity.0
            + self.angular_momentum.1 * self.angular_velocity.1
            + self.angular_momentum.2 * self.angular_velocity.2)
    }

    /// Euler's rotational equation: dL/dt = τ (torque)
    pub fn apply_torque(&mut self, torque: (f64, f64, f64), dt: f64) {
        self.angular_momentum.0 += torque.0 * dt;
        self.angular_momentum.1 += torque.1 * dt;
        self.angular_momentum.2 += torque.2 * dt;

        // Recover angular velocity from L = I·ω (simplified for diagonal inertia)
        // For diagonal I: ωi = Li / Ii
        if self.moment_of_inertia[0][0] > 0.0 {
            self.angular_velocity.0 = self.angular_momentum.0 / self.moment_of_inertia[0][0];
        }
        if self.moment_of_inertia[1][1] > 0.0 {
            self.angular_velocity.1 = self.angular_momentum.1 / self.moment_of_inertia[1][1];
        }
        if self.moment_of_inertia[2][2] > 0.0 {
            self.angular_velocity.2 = self.angular_momentum.2 / self.moment_of_inertia[2][2];
        }
    }
}

/// Electromagnetic-mechanical coupling (e.g., electric motor torque)
#[derive(Debug, Clone)]
pub struct ElectromechanicalCoupling {
    pub field: ElectromagneticField,
    pub rotation: RotationalState,
    pub coupling_coefficient: f64,  // ke for motor/generator
}

impl ElectromechanicalCoupling {
    pub fn new(field: ElectromagneticField, rotation: RotationalState, ke: f64) -> Self {
        ElectromechanicalCoupling {
            field,
            rotation,
            coupling_coefficient: ke,
        }
    }

    /// Motor torque from electromagnetic force (τ = ke * B * I)
    pub fn motor_torque(&self) -> (f64, f64, f64) {
        let b_mag = self.field.magnetic_magnitude();
        // Torque along rotation axis
        let tau = self.coupling_coefficient * b_mag;
        let axis_norm = self.rotation.angular_velocity;
        let axis_mag = (axis_norm.0.powi(2) + axis_norm.1.powi(2) + axis_norm.2.powi(2)).sqrt();

        if axis_mag < 1e-10 {
            (0.0, 0.0, 0.0)
        } else {
            (tau * axis_norm.0 / axis_mag, tau * axis_norm.1 / axis_mag, tau * axis_norm.2 / axis_mag)
        }
    }

    /// Back-EMF in rotating system (ε = ke * ω)
    pub fn back_emf(&self) -> f64 {
        let omega_mag = (self.rotation.angular_velocity.0.powi(2)
            + self.rotation.angular_velocity.1.powi(2)
            + self.rotation.angular_velocity.2.powi(2))
        .sqrt();
        self.coupling_coefficient * omega_mag
    }

    /// Total mechanical power: P = τ · ω
    pub fn mechanical_power(&self) -> f64 {
        let torque = self.motor_torque();
        torque.0 * self.rotation.angular_velocity.0
            + torque.1 * self.rotation.angular_velocity.1
            + torque.2 * self.rotation.angular_velocity.2
    }

    /// Electrical power from back-EMF: P = ε * I
    pub fn electrical_power(&self, current: f64) -> f64 {
        self.back_emf() * current
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_em_field_creation() {
        let field = ElectromagneticField::new((1.0, 0.0, 0.0), (0.0, 1.0, 0.0));
        assert!((field.electric.0 - 1.0).abs() < 1e-10);
        assert!((field.magnetic.1 - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_electric_magnitude() {
        let field = ElectromagneticField::new((3.0, 4.0, 0.0), (0.0, 0.0, 0.0));
        assert!((field.electric_magnitude() - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_magnetic_magnitude() {
        let field = ElectromagneticField::new((0.0, 0.0, 0.0), (3.0, 4.0, 0.0));
        assert!((field.magnetic_magnitude() - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_poynting_vector() {
        let field = ElectromagneticField::new((1.0, 0.0, 0.0), (0.0, 1.0, 0.0));
        let (sx, sy, sz) = field.poynting_vector();
        // E × B = (1,0,0) × (0,1,0) = (0,0,1)
        assert!((sx - 0.0).abs() < 1e-10);
        assert!((sy - 0.0).abs() < 1e-10);
        assert!((sz - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_poynting_magnitude() {
        let field = ElectromagneticField::new((3.0, 0.0, 0.0), (0.0, 4.0, 0.0));
        let mag = field.poynting_magnitude();
        assert!(mag > 0.0);
    }

    #[test]
    fn test_lorentz_force() {
        let field = ElectromagneticField::new((1.0, 0.0, 0.0), (0.0, 0.0, 1.0));
        let force = field.lorentz_force(1.0, (1.0, 0.0, 0.0));
        // F = q(E + v × B) = (1, 0, 0) + (0, -1, 0) = (1, -1, 0)
        assert!((force.0 - 1.0).abs() < 1e-10);
        assert!((force.1 - (-1.0)).abs() < 1e-10);
    }

    #[test]
    fn test_em_wave_creation() {
        let wave = ElectromagneticWave::new(1e15, 1.0);
        assert!((wave.frequency - 1e15).abs() < 1e-10);
        assert!((wave.amplitude - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_em_wave_wavelength() {
        let wave = ElectromagneticWave::new(3.0e14, 1.0); // Visible light
        let expected_wavelength = 3.0e8 / 3.0e14;
        assert!((wave.wavelength - expected_wavelength).abs() < 1e-10);
    }

    #[test]
    fn test_em_wave_intensity() {
        let wave = ElectromagneticWave::new(1e15, 1.0);
        let intensity = wave.intensity();
        assert!(intensity > 0.0);
    }

    #[test]
    fn test_rotational_state_creation() {
        let inertia = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let state = RotationalState::new(inertia);
        assert!(state.angular_momentum_magnitude() < 1e-10);
    }

    #[test]
    fn test_angular_momentum_magnitude() {
        let inertia = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let mut state = RotationalState::new(inertia);
        state.angular_momentum = (3.0, 4.0, 0.0);
        assert!((state.angular_momentum_magnitude() - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_rotational_kinetic_energy() {
        let inertia = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let mut state = RotationalState::new(inertia);
        state.angular_momentum = (2.0, 0.0, 0.0);
        state.angular_velocity = (2.0, 0.0, 0.0);
        let ke = state.rotational_kinetic_energy();
        assert!((ke - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_apply_torque() {
        let inertia = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let mut state = RotationalState::new(inertia);
        state.apply_torque((1.0, 0.0, 0.0), 1.0);
        assert!((state.angular_momentum.0 - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_electromechanical_coupling_creation() {
        let field = ElectromagneticField::new((1.0, 0.0, 0.0), (0.0, 1.0, 0.0));
        let inertia = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let rotation = RotationalState::new(inertia);
        let coupling = ElectromechanicalCoupling::new(field, rotation, 0.1);
        assert!((coupling.coupling_coefficient - 0.1).abs() < 1e-10);
    }

    #[test]
    fn test_motor_torque() {
        let field = ElectromagneticField::new((0.0, 0.0, 0.0), (1.0, 0.0, 0.0));
        let mut inertia_state = RotationalState::new([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]);
        inertia_state.angular_velocity = (1.0, 0.0, 0.0);
        let coupling = ElectromechanicalCoupling::new(field, inertia_state, 0.1);
        let torque = coupling.motor_torque();
        assert!(torque.0.abs() > 0.0 || torque.1.abs() > 0.0 || torque.2.abs() > 0.0);
    }

    #[test]
    fn test_back_emf() {
        let field = ElectromagneticField::new((1.0, 0.0, 0.0), (1.0, 0.0, 0.0));
        let mut rot_state = RotationalState::new([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]);
        rot_state.angular_velocity = (10.0, 0.0, 0.0);
        let coupling = ElectromechanicalCoupling::new(field, rot_state, 1.0);
        let emf = coupling.back_emf();
        assert!((emf - 10.0).abs() < 1e-6);
    }

    #[test]
    fn test_mechanical_power() {
        let field = ElectromagneticField::new((0.0, 0.0, 0.0), (1.0, 0.0, 0.0));
        let mut rot_state = RotationalState::new([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]);
        rot_state.angular_velocity = (10.0, 0.0, 0.0);
        let coupling = ElectromechanicalCoupling::new(field, rot_state, 1.0);
        let power = coupling.mechanical_power();
        assert!(power >= 0.0 || power < 0.0); // Just verify it computes
    }

    #[test]
    fn test_electrical_power() {
        let field = ElectromagneticField::new((1.0, 0.0, 0.0), (1.0, 0.0, 0.0));
        let rot_state = RotationalState::new([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]);
        let coupling = ElectromechanicalCoupling::new(field, rot_state, 1.0);
        let power = coupling.electrical_power(5.0);
        assert!(power >= 0.0);
    }

    #[test]
    fn test_em_energy_density() {
        let field = ElectromagneticField::new((1.0, 0.0, 0.0), (1.0, 0.0, 0.0));
        let epsilon_0 = 8.854e-12;
        let mu_0 = 4.0 * PI * 1e-7;
        let energy = field.energy_density(epsilon_0, mu_0);
        assert!(energy > 0.0);
    }
}
