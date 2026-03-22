/**
 * Measurement Tools Component
 * Phase 17.5: Advanced Features
 *
 * Comprehensive measurement and analysis tools:
 * - Point to point distance
 * - Edge length measurement
 * - Face area and perimeter
 * - Volume and mass calculation
 * - Angle between faces/edges
 * - Radius and diameter measurement
 */

import React, { useState } from 'react';
import styles from './MeasurementTools.module.css';

// ============================================================================
// TYPES
// ============================================================================

export type MeasurementType = 'Distance' | 'Angle' | 'Area' | 'Length' | 'Radius' | 'Volume' | 'Mass';

export interface Measurement {
  id: string;
  type: MeasurementType;
  name: string;
  value: number;
  unit: string;
  description: string;
  timestamp: number;
}

export interface MeasurementHistory {
  measurements: Measurement[];
  savedAt?: number;
}

// ============================================================================
// MEASUREMENT CALCULATOR
// ============================================================================

export class MeasurementCalculator {
  /**
   * Calculate distance between two 3D points
   */
  static calculateDistance(
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number }
  ): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate angle between two vectors (in degrees)
   */
  static calculateAngle(
    v1: { x: number; y: number; z: number },
    v2: { x: number; y: number; z: number }
  ): number {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = dot / (mag1 * mag2);
    // Clamp to [-1, 1] to handle floating point errors
    const clamped = Math.max(-1, Math.min(1, cosAngle));
    return (Math.acos(clamped) * 180) / Math.PI;
  }

  /**
   * Calculate circle area
   */
  static calculateCircleArea(radius: number): number {
    return Math.PI * radius * radius;
  }

  /**
   * Calculate rectangle area
   */
  static calculateRectangleArea(width: number, height: number): number {
    return width * height;
  }

  /**
   * Calculate triangle area (using Heron's formula)
   */
  static calculateTriangleArea(a: number, b: number, c: number): number {
    const s = (a + b + c) / 2;
    return Math.sqrt(s * (s - a) * (s - b) * (s - c));
  }

  /**
   * Calculate cylinder volume
   */
  static calculateCylinderVolume(radius: number, height: number): number {
    return Math.PI * radius * radius * height;
  }

  /**
   * Calculate box volume
   */
  static calculateBoxVolume(width: number, height: number, depth: number): number {
    return width * height * depth;
  }

  /**
   * Calculate sphere volume
   */
  static calculateSphereVolume(radius: number): number {
    return (4 / 3) * Math.PI * radius * radius * radius;
  }

  /**
   * Calculate mass from volume and density
   */
  static calculateMass(volume: number, density: number): number {
    return volume * density;
  }

  /**
   * Format number with appropriate precision
   */
  static formatValue(value: number, precision: number = 3): string {
    return value.toFixed(precision);
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface MeasurementToolsProps {
  onMeasurementAdded?: (measurement: Measurement) => void;
}

export const MeasurementTools: React.FC<MeasurementToolsProps> = ({ onMeasurementAdded }) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [activeTab, setActiveTab] = useState<MeasurementType>('Distance');
  const [measurementIndex, setMeasurementIndex] = useState(0);

  // Distance measurement state
  const [distanceP1, setDistanceP1] = useState<string>('0,0,0');
  const [distanceP2, setDistanceP2] = useState<string>('1,0,0');
  const [distanceResult, setDistanceResult] = useState<number | null>(null);

  // Angle measurement state
  const [angleV1, setAngleV1] = useState<string>('1,0,0');
  const [angleV2, setAngleV2] = useState<string>('0,1,0');
  const [angleResult, setAngleResult] = useState<number | null>(null);

  // Area measurement state
  const [areaShape, setAreaShape] = useState<'Circle' | 'Rectangle' | 'Triangle'>('Circle');
  const [areaRadius, setAreaRadius] = useState<number>(5);
  const [areaWidth, setAreaWidth] = useState<number>(10);
  const [areaHeight, setAreaHeight] = useState<number>(5);
  const [areaSideA, setAreaSideA] = useState<number>(3);
  const [areaSideB, setAreaSideB] = useState<number>(4);
  const [areaSideC, setAreaSideC] = useState<number>(5);
  const [areaResult, setAreaResult] = useState<number | null>(null);

  // Volume measurement state
  const [volumeShape, setVolumeShape] = useState<'Cylinder' | 'Box' | 'Sphere'>('Cylinder');
  const [volumeRadius, setVolumeRadius] = useState<number>(5);
  const [volumeHeight, setVolumeHeight] = useState<number>(10);
  const [volumeWidth, setVolumeWidth] = useState<number>(10);
  const [volumeDepth, setVolumeDepth] = useState<number>(10);
  const [volumeResult, setVolumeResult] = useState<number | null>(null);

  // Mass calculation state
  const [materialDensity, setMaterialDensity] = useState<number>(7.85); // Steel
  const [massResult, setMassResult] = useState<number | null>(null);

  const handleCalculateDistance = () => {
    try {
      const p1Parts = distanceP1.split(',').map((v) => parseFloat(v.trim()));
      const p2Parts = distanceP2.split(',').map((v) => parseFloat(v.trim()));

      if (p1Parts.length !== 3 || p2Parts.length !== 3) {
        alert('Please enter coordinates as x,y,z');
        return;
      }

      const p1 = { x: p1Parts[0], y: p1Parts[1], z: p1Parts[2] };
      const p2 = { x: p2Parts[0], y: p2Parts[1], z: p2Parts[2] };
      const distance = MeasurementCalculator.calculateDistance(p1, p2);

      setDistanceResult(distance);
      addMeasurement('Distance', `Distance: ${distanceP1} to ${distanceP2}`, distance, 'mm');
    } catch (error) {
      alert('Invalid input. Please check your coordinates.');
    }
  };

  const handleCalculateAngle = () => {
    try {
      const v1Parts = angleV1.split(',').map((v) => parseFloat(v.trim()));
      const v2Parts = angleV2.split(',').map((v) => parseFloat(v.trim()));

      if (v1Parts.length !== 3 || v2Parts.length !== 3) {
        alert('Please enter vectors as x,y,z');
        return;
      }

      const v1 = { x: v1Parts[0], y: v1Parts[1], z: v1Parts[2] };
      const v2 = { x: v2Parts[0], y: v2Parts[1], z: v2Parts[2] };
      const angle = MeasurementCalculator.calculateAngle(v1, v2);

      setAngleResult(angle);
      addMeasurement('Angle', `Angle between vectors`, angle, '°');
    } catch (error) {
      alert('Invalid input. Please check your vectors.');
    }
  };

  const handleCalculateArea = () => {
    let area = 0;
    let description = '';

    if (areaShape === 'Circle') {
      area = MeasurementCalculator.calculateCircleArea(areaRadius);
      description = `Circle area (r=${areaRadius})`;
    } else if (areaShape === 'Rectangle') {
      area = MeasurementCalculator.calculateRectangleArea(areaWidth, areaHeight);
      description = `Rectangle area (${areaWidth}×${areaHeight})`;
    } else if (areaShape === 'Triangle') {
      area = MeasurementCalculator.calculateTriangleArea(areaSideA, areaSideB, areaSideC);
      description = `Triangle area (${areaSideA}, ${areaSideB}, ${areaSideC})`;
    }

    setAreaResult(area);
    addMeasurement('Area', description, area, 'mm²');
  };

  const handleCalculateVolume = () => {
    let volume = 0;
    let description = '';

    if (volumeShape === 'Cylinder') {
      volume = MeasurementCalculator.calculateCylinderVolume(volumeRadius, volumeHeight);
      description = `Cylinder (r=${volumeRadius}, h=${volumeHeight})`;
    } else if (volumeShape === 'Box') {
      volume = MeasurementCalculator.calculateBoxVolume(volumeWidth, volumeHeight, volumeDepth);
      description = `Box (${volumeWidth}×${volumeHeight}×${volumeDepth})`;
    } else if (volumeShape === 'Sphere') {
      volume = MeasurementCalculator.calculateSphereVolume(volumeRadius);
      description = `Sphere (r=${volumeRadius})`;
    }

    setVolumeResult(volume);
    addMeasurement('Volume', description, volume, 'mm³');

    // Calculate mass if volume is available
    if (volume > 0) {
      const mass = MeasurementCalculator.calculateMass(volume, materialDensity);
      setMassResult(mass);
    }
  };

  const addMeasurement = (type: MeasurementType, description: string, value: number, unit: string) => {
    const measurement: Measurement = {
      id: `measurement_${measurementIndex}`,
      type,
      name: `${type} ${measurementIndex}`,
      value,
      unit,
      description,
      timestamp: Date.now(),
    };

    setMeasurements((prev) => [measurement, ...prev]);
    setMeasurementIndex((prev) => prev + 1);
    onMeasurementAdded?.(measurement);
  };

  const handleDeleteMeasurement = (id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearAll = () => {
    setMeasurements([]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Measurement Tools</h3>
      </div>

      <div className={styles.tabs}>
        {(['Distance', 'Angle', 'Area', 'Volume', 'Length', 'Radius', 'Mass'] as MeasurementType[]).map(
          (tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          )
        )}
      </div>

      <div className={styles.calculator}>
        {activeTab === 'Distance' && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label>Point 1 (x,y,z)</label>
              <input
                type="text"
                value={distanceP1}
                onChange={(e) => setDistanceP1(e.target.value)}
                placeholder="0,0,0"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Point 2 (x,y,z)</label>
              <input
                type="text"
                value={distanceP2}
                onChange={(e) => setDistanceP2(e.target.value)}
                placeholder="1,0,0"
              />
            </div>
            <button className={styles.calculateButton} onClick={handleCalculateDistance}>
              📏 Calculate Distance
            </button>
            {distanceResult !== null && (
              <div className={styles.result}>
                <strong>{MeasurementCalculator.formatValue(distanceResult, 3)} mm</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Angle' && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label>Vector 1 (x,y,z)</label>
              <input
                type="text"
                value={angleV1}
                onChange={(e) => setAngleV1(e.target.value)}
                placeholder="1,0,0"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Vector 2 (x,y,z)</label>
              <input
                type="text"
                value={angleV2}
                onChange={(e) => setAngleV2(e.target.value)}
                placeholder="0,1,0"
              />
            </div>
            <button className={styles.calculateButton} onClick={handleCalculateAngle}>
              ∠ Calculate Angle
            </button>
            {angleResult !== null && (
              <div className={styles.result}>
                <strong>{MeasurementCalculator.formatValue(angleResult, 2)}°</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Area' && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label>Shape</label>
              <select value={areaShape} onChange={(e) => setAreaShape(e.target.value as any)}>
                <option value="Circle">Circle</option>
                <option value="Rectangle">Rectangle</option>
                <option value="Triangle">Triangle</option>
              </select>
            </div>

            {areaShape === 'Circle' && (
              <div className={styles.formGroup}>
                <label>Radius (mm)</label>
                <input
                  type="number"
                  value={areaRadius}
                  onChange={(e) => setAreaRadius(parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
            )}

            {areaShape === 'Rectangle' && (
              <>
                <div className={styles.formGroup}>
                  <label>Width (mm)</label>
                  <input
                    type="number"
                    value={areaWidth}
                    onChange={(e) => setAreaWidth(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Height (mm)</label>
                  <input
                    type="number"
                    value={areaHeight}
                    onChange={(e) => setAreaHeight(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
              </>
            )}

            {areaShape === 'Triangle' && (
              <>
                <div className={styles.formGroup}>
                  <label>Side A (mm)</label>
                  <input
                    type="number"
                    value={areaSideA}
                    onChange={(e) => setAreaSideA(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Side B (mm)</label>
                  <input
                    type="number"
                    value={areaSideB}
                    onChange={(e) => setAreaSideB(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Side C (mm)</label>
                  <input
                    type="number"
                    value={areaSideC}
                    onChange={(e) => setAreaSideC(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
              </>
            )}

            <button className={styles.calculateButton} onClick={handleCalculateArea}>
              📐 Calculate Area
            </button>
            {areaResult !== null && (
              <div className={styles.result}>
                <strong>{MeasurementCalculator.formatValue(areaResult, 2)} mm²</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Volume' && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label>Shape</label>
              <select value={volumeShape} onChange={(e) => setVolumeShape(e.target.value as any)}>
                <option value="Cylinder">Cylinder</option>
                <option value="Box">Box</option>
                <option value="Sphere">Sphere</option>
              </select>
            </div>

            {volumeShape === 'Cylinder' && (
              <>
                <div className={styles.formGroup}>
                  <label>Radius (mm)</label>
                  <input
                    type="number"
                    value={volumeRadius}
                    onChange={(e) => setVolumeRadius(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Height (mm)</label>
                  <input
                    type="number"
                    value={volumeHeight}
                    onChange={(e) => setVolumeHeight(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
              </>
            )}

            {volumeShape === 'Box' && (
              <>
                <div className={styles.formGroup}>
                  <label>Width (mm)</label>
                  <input
                    type="number"
                    value={volumeWidth}
                    onChange={(e) => setVolumeWidth(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Height (mm)</label>
                  <input
                    type="number"
                    value={volumeHeight}
                    onChange={(e) => setVolumeHeight(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Depth (mm)</label>
                  <input
                    type="number"
                    value={volumeDepth}
                    onChange={(e) => setVolumeDepth(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
              </>
            )}

            {volumeShape === 'Sphere' && (
              <div className={styles.formGroup}>
                <label>Radius (mm)</label>
                <input
                  type="number"
                  value={volumeRadius}
                  onChange={(e) => setVolumeRadius(parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Material Density (g/cm³)</label>
              <select value={materialDensity} onChange={(e) => setMaterialDensity(parseFloat(e.target.value))}>
                <option value="2.7">Aluminum (2.7)</option>
                <option value="7.85">Steel (7.85)</option>
                <option value="8.96">Copper (8.96)</option>
                <option value="1.06">ABS Plastic (1.06)</option>
                <option value="1.05">PLA Plastic (1.05)</option>
              </select>
            </div>

            <button className={styles.calculateButton} onClick={handleCalculateVolume}>
              📦 Calculate Volume & Mass
            </button>
            {volumeResult !== null && (
              <div className={styles.result}>
                <div>
                  <strong>Volume:</strong> {MeasurementCalculator.formatValue(volumeResult, 2)} mm³
                </div>
                {massResult !== null && (
                  <div>
                    <strong>Mass:</strong> {MeasurementCalculator.formatValue(massResult / 1000, 3)} g
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Measurement History */}
      <div className={styles.history}>
        <div className={styles.historyHeader}>
          <h4>Measurement History</h4>
          {measurements.length > 0 && (
            <button className={styles.clearButton} onClick={handleClearAll}>
              Clear All
            </button>
          )}
        </div>

        {measurements.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No measurements yet</p>
          </div>
        ) : (
          <div className={styles.measurementsList}>
            {measurements.map((m) => (
              <div key={m.id} className={styles.measurementItem}>
                <div className={styles.measurementContent}>
                  <div className={styles.measurementType}>{m.type}</div>
                  <div className={styles.measurementValue}>
                    {MeasurementCalculator.formatValue(m.value, 3)} {m.unit}
                  </div>
                </div>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDeleteMeasurement(m.id)}
                  title="Delete measurement"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeasurementTools;
