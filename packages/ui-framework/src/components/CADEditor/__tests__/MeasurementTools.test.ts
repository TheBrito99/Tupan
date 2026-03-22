/**
 * Measurement Tools Tests
 * Phase 17.6: Testing
 *
 * Tests for all measurement calculations and utilities
 */

import { MeasurementCalculator } from '../MeasurementTools';

describe('MeasurementCalculator', () => {
  // =========================================================================
  // DISTANCE CALCULATIONS
  // =========================================================================

  describe('Distance Calculations', () => {
    test('should calculate distance between two 3D points', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 4, z: 0 };

      const distance = MeasurementCalculator.calculateDistance(p1, p2);
      expect(distance).toBeCloseTo(5, 5);
    });

    test('should calculate 3D distance correctly', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 1, y: 1, z: 1 };

      const distance = MeasurementCalculator.calculateDistance(p1, p2);
      expect(distance).toBeCloseTo(Math.sqrt(3), 5);
    });

    test('should handle identical points', () => {
      const p1 = { x: 5, y: 5, z: 5 };
      const p2 = { x: 5, y: 5, z: 5 };

      const distance = MeasurementCalculator.calculateDistance(p1, p2);
      expect(distance).toBe(0);
    });

    test('should handle negative coordinates', () => {
      const p1 = { x: -3, y: -4, z: 0 };
      const p2 = { x: 0, y: 0, z: 0 };

      const distance = MeasurementCalculator.calculateDistance(p1, p2);
      expect(distance).toBeCloseTo(5, 5);
    });
  });

  // =========================================================================
  // ANGLE CALCULATIONS
  // =========================================================================

  describe('Angle Calculations', () => {
    test('should calculate angle between perpendicular vectors', () => {
      const v1 = { x: 1, y: 0, z: 0 };
      const v2 = { x: 0, y: 1, z: 0 };

      const angle = MeasurementCalculator.calculateAngle(v1, v2);
      expect(angle).toBeCloseTo(90, 1);
    });

    test('should calculate angle between parallel vectors', () => {
      const v1 = { x: 1, y: 0, z: 0 };
      const v2 = { x: 2, y: 0, z: 0 };

      const angle = MeasurementCalculator.calculateAngle(v1, v2);
      expect(angle).toBeCloseTo(0, 1);
    });

    test('should calculate angle between opposite vectors', () => {
      const v1 = { x: 1, y: 0, z: 0 };
      const v2 = { x: -1, y: 0, z: 0 };

      const angle = MeasurementCalculator.calculateAngle(v1, v2);
      expect(angle).toBeCloseTo(180, 1);
    });

    test('should handle zero vector gracefully', () => {
      const v1 = { x: 0, y: 0, z: 0 };
      const v2 = { x: 1, y: 0, z: 0 };

      const angle = MeasurementCalculator.calculateAngle(v1, v2);
      expect(angle).toBe(0);
    });

    test('should calculate 45 degree angle', () => {
      const v1 = { x: 1, y: 0, z: 0 };
      const v2 = { x: 1, y: 1, z: 0 };

      const angle = MeasurementCalculator.calculateAngle(v1, v2);
      expect(angle).toBeCloseTo(45, 1);
    });
  });

  // =========================================================================
  // AREA CALCULATIONS
  // =========================================================================

  describe('Area Calculations', () => {
    test('should calculate circle area', () => {
      const area = MeasurementCalculator.calculateCircleArea(5);
      expect(area).toBeCloseTo(78.54, 1);
    });

    test('should calculate circle area with radius 1', () => {
      const area = MeasurementCalculator.calculateCircleArea(1);
      expect(area).toBeCloseTo(Math.PI, 5);
    });

    test('should calculate rectangle area', () => {
      const area = MeasurementCalculator.calculateRectangleArea(10, 5);
      expect(area).toBe(50);
    });

    test('should calculate square area', () => {
      const area = MeasurementCalculator.calculateRectangleArea(5, 5);
      expect(area).toBe(25);
    });

    test('should calculate triangle area using Herons formula', () => {
      // 3-4-5 right triangle: area = 6
      const area = MeasurementCalculator.calculateTriangleArea(3, 4, 5);
      expect(area).toBeCloseTo(6, 5);
    });

    test('should calculate equilateral triangle area', () => {
      // Equilateral with side 2: area = sqrt(3)
      const area = MeasurementCalculator.calculateTriangleArea(2, 2, 2);
      expect(area).toBeCloseTo(Math.sqrt(3), 5);
    });
  });

  // =========================================================================
  // VOLUME CALCULATIONS
  // =========================================================================

  describe('Volume Calculations', () => {
    test('should calculate cylinder volume', () => {
      // Cylinder r=1, h=10: V = π * 1 * 10 = 10π
      const volume = MeasurementCalculator.calculateCylinderVolume(1, 10);
      expect(volume).toBeCloseTo(10 * Math.PI, 5);
    });

    test('should calculate box volume', () => {
      const volume = MeasurementCalculator.calculateBoxVolume(10, 5, 2);
      expect(volume).toBe(100);
    });

    test('should calculate cube volume', () => {
      const volume = MeasurementCalculator.calculateBoxVolume(5, 5, 5);
      expect(volume).toBe(125);
    });

    test('should calculate sphere volume', () => {
      // Sphere r=1: V = 4/3 * π
      const volume = MeasurementCalculator.calculateSphereVolume(1);
      expect(volume).toBeCloseTo((4 / 3) * Math.PI, 5);
    });

    test('should calculate sphere volume for r=2', () => {
      // Sphere r=2: V = 4/3 * π * 8 = 32π/3
      const volume = MeasurementCalculator.calculateSphereVolume(2);
      expect(volume).toBeCloseTo((32 / 3) * Math.PI, 5);
    });
  });

  // =========================================================================
  // MASS CALCULATIONS
  // =========================================================================

  describe('Mass Calculations', () => {
    test('should calculate mass from volume and density', () => {
      // 100 mm³ of steel (7.85 g/cm³ = 0.00785 g/mm³)
      const mass = MeasurementCalculator.calculateMass(100, 7.85);
      expect(mass).toBeCloseTo(785, 0);
    });

    test('should calculate mass for aluminum', () => {
      // 1000 mm³ of aluminum (2.7 g/cm³)
      const mass = MeasurementCalculator.calculateMass(1000, 2.7);
      expect(mass).toBeCloseTo(2700, 0);
    });

    test('should handle zero volume', () => {
      const mass = MeasurementCalculator.calculateMass(0, 7.85);
      expect(mass).toBe(0);
    });
  });

  // =========================================================================
  // VALUE FORMATTING
  // =========================================================================

  describe('Value Formatting', () => {
    test('should format value with default precision', () => {
      const formatted = MeasurementCalculator.formatValue(3.14159);
      expect(formatted).toBe('3.142');
    });

    test('should format value with custom precision', () => {
      const formatted = MeasurementCalculator.formatValue(3.14159, 2);
      expect(formatted).toBe('3.14');
    });

    test('should format large number', () => {
      const formatted = MeasurementCalculator.formatValue(1234.56789, 1);
      expect(formatted).toBe('1234.6');
    });

    test('should format small number', () => {
      const formatted = MeasurementCalculator.formatValue(0.000123, 5);
      expect(formatted).toBe('0.00012');
    });

    test('should format negative number', () => {
      const formatted = MeasurementCalculator.formatValue(-3.14159, 2);
      expect(formatted).toBe('-3.14');
    });

    test('should format zero', () => {
      const formatted = MeasurementCalculator.formatValue(0, 2);
      expect(formatted).toBe('0.00');
    });
  });

  // =========================================================================
  // INTEGRATION TESTS
  // =========================================================================

  describe('Integration Tests', () => {
    test('should calculate mass of a steel cylinder', () => {
      const radius = 5;
      const height = 10;
      const density = 7.85; // Steel

      const volume = MeasurementCalculator.calculateCylinderVolume(radius, height);
      const mass = MeasurementCalculator.calculateMass(volume, density);

      expect(volume).toBeCloseTo(785.4, 0);
      expect(mass).toBeCloseTo(6157.9, 0);
    });

    test('should calculate distance and format result', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 4, z: 0 };

      const distance = MeasurementCalculator.calculateDistance(p1, p2);
      const formatted = MeasurementCalculator.formatValue(distance, 2);

      expect(formatted).toBe('5.00');
    });

    test('should calculate angle between faces and format', () => {
      const normal1 = { x: 0, y: 0, z: 1 };
      const normal2 = { x: 1, y: 0, z: 0 };

      const angle = MeasurementCalculator.calculateAngle(normal1, normal2);
      const formatted = MeasurementCalculator.formatValue(angle, 1);

      expect(formatted).toBeCloseTo('90.0', 0.1);
    });

    test('should calculate aluminum part mass', () => {
      // Box: 10x10x5 mm
      const volume = MeasurementCalculator.calculateBoxVolume(10, 10, 5);

      // Aluminum density: 2.7 g/cm³
      const mass = MeasurementCalculator.calculateMass(volume, 2.7);
      const formatted = MeasurementCalculator.formatValue(mass / 1000, 2); // Convert to grams

      expect(parseFloat(formatted)).toBeCloseTo(13.5, 1);
    });
  });
});
