/**
 * Impedance Calculator - Signal integrity for PCB traces
 *
 * Calculates trace impedance for:
 * - Microstrip (signal on outer layer)
 * - Stripline (signal between ground planes)
 * - Differential pairs (equal length, tight coupling)
 *
 * Supports IPC-2141 standards
 */

export enum TraceGeometry {
  MICROSTRIP = 'microstrip',
  STRIPLINE = 'stripline',
  DIFFERENTIAL_MICROSTRIP = 'differential_microstrip',
  DIFFERENTIAL_STRIPLINE = 'differential_stripline',
}

export interface PCBStackup {
  thickness: number;           // mm, total board thickness
  copperWeight: number;        // oz/ft² (0.5, 1, 2, etc.)
  dielectricConstant: number;  // εr (typically 4.0-4.7 for FR-4)
  dielectricLossAngle: number; // tan(δ) (typically 0.02 for FR-4)
  layers: Array<{
    name: string;
    thickness: number;         // mm
    type: 'copper' | 'dielectric';
    isSignalLayer?: boolean;
    isGroundPlane?: boolean;
    isPowerPlane?: boolean;
  }>;
}

export interface TraceProperties {
  width: number;                // mm
  thickness: number;            // mm (from copper weight)
  height: number;              // mm (distance to reference plane)
  spacing?: number;            // mm (for differential pairs)
  length: number;              // mm (trace path length)
  geometry: TraceGeometry;
  frequency: number;           // MHz (for loss calculation)
  temperature: number;         // °C
}

export interface ImpedanceResult {
  singleEndedZ0: number;       // Ω (single-ended impedance)
  differentialZ0?: number;     // Ω (differential impedance, pairs only)
  commonModeZ0?: number;       // Ω (common-mode impedance, pairs only)
  delayPerUnit: number;        // ps/mm (propagation delay)
  attenuation: number;         // dB/inch (frequency-dependent loss)
  skewPerLength: number;       // ps/mm (for matched pairs)
}

export class ImpedanceCalculator {
  private stackup: PCBStackup;

  constructor(stackup: PCBStackup) {
    this.stackup = stackup;
  }

  /**
   * Calculate trace impedance using IPC-2141 models
   */
  public calculateImpedance(props: TraceProperties): ImpedanceResult {
    let singleEndedZ0: number;
    let differentialZ0: number | undefined;
    let commonModeZ0: number | undefined;

    switch (props.geometry) {
      case TraceGeometry.MICROSTRIP:
        singleEndedZ0 = this.calculateMicrostripImpedance(props);
        break;

      case TraceGeometry.STRIPLINE:
        singleEndedZ0 = this.calculateStriplineImpedance(props);
        break;

      case TraceGeometry.DIFFERENTIAL_MICROSTRIP:
        singleEndedZ0 = this.calculateMicrostripImpedance(props);
        differentialZ0 = this.calculateDifferentialMicrostripImpedance(props);
        commonModeZ0 = this.calculateCommonModeImpedance(props);
        break;

      case TraceGeometry.DIFFERENTIAL_STRIPLINE:
        singleEndedZ0 = this.calculateStriplineImpedance(props);
        differentialZ0 = this.calculateDifferentialStriplineImpedance(props);
        commonModeZ0 = this.calculateCommonModeImpedance(props);
        break;

      default:
        singleEndedZ0 = 50; // Default to 50Ω
    }

    const delayPerUnit = this.calculatePropagationDelay(props);
    const attenuation = this.calculateAttenuation(props);
    const skewPerLength = this.calculateSkew(props);

    return {
      singleEndedZ0,
      differentialZ0,
      commonModeZ0,
      delayPerUnit,
      attenuation,
      skewPerLength,
    };
  }

  /**
   * Calculate microstrip impedance (outer layer trace)
   *
   * IPC-2141A equation for microstrip:
   * Z0 = (87 / √(εr + 1.41)) × ln(5.98h / (0.8w + t))
   * where h = height above reference, w = width, t = thickness
   */
  private calculateMicrostripImpedance(props: TraceProperties): number {
    const { width, thickness, height } = props;
    const εr = this.stackup.dielectricConstant;

    // Effective height (consider return path)
    const h = height;
    const w = width;
    const t = thickness;

    if (w <= 0 || h <= 0) return 50; // Safety default

    // Normalized impedance
    const Z0 =
      (87 / Math.sqrt(εr + 1.41)) *
      Math.log((5.98 * h) / (0.8 * w + t));

    return Math.max(10, Math.min(120, Z0)); // Clamp to reasonable range
  }

  /**
   * Calculate stripline impedance (inner layer trace between grounds)
   *
   * IPC-2141A equation for stripline:
   * Z0 = (60 / √εr) × ln((4h / (0.67(w + t))))
   * where h = distance to nearest ground plane
   */
  private calculateStriplineImpedance(props: TraceProperties): number {
    const { width, thickness, height } = props;
    const εr = this.stackup.dielectricConstant;

    const h = height;
    const w = width;
    const t = thickness;

    if (w <= 0 || h <= 0) return 50;

    const Z0 =
      (60 / Math.sqrt(εr)) *
      Math.log((4 * h) / (0.67 * (w + t)));

    return Math.max(10, Math.min(120, Z0));
  }

  /**
   * Calculate differential pair impedance (microstrip)
   *
   * For differential pairs, impedance depends on:
   * - Single-ended impedance
   * - Spacing between traces
   * - Coupling effect
   */
  private calculateDifferentialMicrostripImpedance(props: TraceProperties): number {
    const singleEndedZ0 = this.calculateMicrostripImpedance(props);
    const spacing = props.spacing || props.width;

    // Coupling factor based on spacing
    const couplingFactor = Math.exp(-2.0 * spacing / props.height);

    // Differential impedance ≈ 2 × Z0single × (1 - couplingFactor/2)
    const Z0diff = 2 * singleEndedZ0 * (1 - couplingFactor / 2);

    return Math.max(80, Math.min(140, Z0diff)); // Typical differential range
  }

  /**
   * Calculate differential pair impedance (stripline)
   */
  private calculateDifferentialStriplineImpedance(props: TraceProperties): number {
    const singleEndedZ0 = this.calculateStriplineImpedance(props);
    const spacing = props.spacing || props.width;

    const couplingFactor = Math.exp(-2.0 * spacing / props.height);
    const Z0diff = 2 * singleEndedZ0 * (1 - couplingFactor / 2);

    return Math.max(80, Math.min(140, Z0diff));
  }

  /**
   * Calculate common-mode impedance for differential pairs
   */
  private calculateCommonModeImpedance(props: TraceProperties): number {
    const singleEndedZ0 =
      props.geometry === TraceGeometry.DIFFERENTIAL_MICROSTRIP
        ? this.calculateMicrostripImpedance(props)
        : this.calculateStriplineImpedance(props);

    // Common-mode impedance typically 2x single-ended
    return singleEndedZ0 * 2;
  }

  /**
   * Calculate propagation delay
   *
   * Velocity of propagation = c / √εr
   * Delay = length × √εr / c
   * where c ≈ 300 mm/ns
   */
  private calculatePropagationDelay(props: TraceProperties): number {
    const εr = this.stackup.dielectricConstant;
    const velocityOfPropagation = 300 / Math.sqrt(εr); // mm/ns

    // Return in ps/mm
    return 1000 / velocityOfPropagation;
  }

  /**
   * Calculate trace attenuation (frequency-dependent loss)
   *
   * Attenuation depends on:
   * - Copper roughness
   * - Dielectric loss (tan δ)
   * - Frequency
   * - Trace dimensions
   */
  private calculateAttenuation(props: TraceProperties): number {
    const { width, frequency, temperature } = props;
    const εr = this.stackup.dielectricConstant;
    const tanDelta = this.stackup.dielectricLossAngle;

    // Copper loss (conductor loss)
    // Simplified: increases with √frequency
    const copperLoss =
      0.000065 * (width ** -0.5) * Math.sqrt(frequency);

    // Dielectric loss
    const dielectricLoss =
      0.00092 * εr * (εr - 1) * tanDelta * frequency / Math.sqrt(εr);

    // Temperature coefficient (copper resistance increases ~0.4%/°C)
    const tempCoeff = 1 + 0.004 * (temperature - 25);

    // Total attenuation in dB/inch (convert mm to inch: 1 inch = 25.4 mm)
    return (copperLoss + dielectricLoss) * tempCoeff * 25.4;
  }

  /**
   * Calculate skew between differential pair traces
   *
   * Skew = |length_P - length_N| × propagation_delay
   */
  private calculateSkew(props: TraceProperties): number {
    // Skew per 1mm length difference
    const delayPerUnit = this.calculatePropagationDelay(props);
    return delayPerUnit; // ps per mm of length mismatch
  }

  /**
   * Check impedance target compliance
   */
  public checkCompliance(
    result: ImpedanceResult,
    targetZ0: number = 50,
    tolerance: number = 10 // Ω (±10Ω for ±20% tolerance)
  ): { compliant: boolean; margin: number; message: string } {
    const difference = Math.abs(result.singleEndedZ0 - targetZ0);
    const compliant = difference <= tolerance;
    const margin = tolerance - difference;

    return {
      compliant,
      margin,
      message: compliant
        ? `✓ Z0 = ${result.singleEndedZ0.toFixed(1)}Ω (±${tolerance}Ω target)`
        : `✗ Z0 = ${result.singleEndedZ0.toFixed(1)}Ω (off by ${difference.toFixed(1)}Ω)`,
    };
  }

  /**
   * Get recommended trace width for target impedance
   */
  public getTraceWidthForImpedance(
    targetZ0: number,
    geometry: TraceGeometry,
    height: number
  ): number {
    // Iterative search for width that gives target impedance
    let width = 0.254; // Start with 10mil
    let step = 0.254;

    for (let iterations = 0; iterations < 20; iterations++) {
      const testProps: TraceProperties = {
        width,
        thickness: 0.035, // 1oz copper
        height,
        geometry,
        length: 10,
        frequency: 100,
        temperature: 25,
      };

      const Z0 =
        geometry === TraceGeometry.MICROSTRIP ||
        geometry === TraceGeometry.DIFFERENTIAL_MICROSTRIP
          ? this.calculateMicrostripImpedance(testProps)
          : this.calculateStriplineImpedance(testProps);

      if (Math.abs(Z0 - targetZ0) < 0.5) {
        return width;
      }

      if (Z0 > targetZ0) {
        width += step;
      } else {
        width -= step / 2;
        step /= 2;
      }

      width = Math.max(0.1, Math.min(2.0, width)); // Clamp reasonable range
    }

    return width;
  }

  /**
   * Calculate skin effect frequency
   *
   * Frequency where skin effect becomes significant
   */
  public getSkinEffectFrequency(): number {
    // Copper skin effect frequency ≈ 1 GHz
    // Practical concern starts around 100 MHz
    return 100; // MHz
  }

  /**
   * Get stackup information
   */
  public getStackup(): PCBStackup {
    return { ...this.stackup };
  }

  /**
   * Update stackup (for design changes)
   */
  public updateStackup(stackup: Partial<PCBStackup>): void {
    this.stackup = { ...this.stackup, ...stackup };
  }
}
