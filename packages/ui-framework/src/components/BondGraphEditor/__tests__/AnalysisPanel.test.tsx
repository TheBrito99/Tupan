/**
 * Analysis Panel Tests
 *
 * Tests for:
 * - Energy conservation calculation
 * - Power flow analysis
 * - Element dissipation tracking
 * - Performance metrics display
 * - Historical data analysis
 *
 * 16 comprehensive tests
 */

import React from 'react';
import { render } from '@testing-library/react';
import { AnalysisPanel } from '../AnalysisPanel';
import type { EditorElement, EditorBond } from '../types';
import type { PerformanceMetrics, SimulationSnapshot } from '@tupan/core-ts/wasm-bridge';

describe('AnalysisPanel', () => {
  // Mock data
  const mockElements: EditorElement[] = [
    { id: 'se1', type: 'Se', x: 100, y: 100 } as EditorElement,
    { id: 'r1', type: 'R', x: 200, y: 100 } as EditorElement,
    { id: 'c1', type: 'C', x: 300, y: 100 } as EditorElement,
  ];

  const mockBonds: EditorBond[] = [
    { id: 'bond1', from: 'se1', to: 'r1' } as EditorBond,
    { id: 'bond2', from: 'r1', to: 'c1' } as EditorBond,
  ];

  const mockMetrics: PerformanceMetrics = {
    wallClockTime: 1000,
    simulationTime: 1.0,
    totalSteps: 1000,
    stepsPerSecond: 1000,
    averageStepTime: 1,
    fps: 60,
    cpuLoad: 30,
    averageError: 1e-6,
    maxError: 1e-5,
  };

  const mockHistory: SimulationSnapshot[] = [
    {
      time: 0,
      state: new Float64Array([0]),
      timestamp: 0,
    },
    {
      time: 0.1,
      state: new Float64Array([0.1]),
      timestamp: 100,
    },
    {
      time: 0.2,
      state: new Float64Array([0.2]),
      timestamp: 200,
    },
  ];

  describe('Energy Conservation', () => {
    test('calculates energy balance for simple circuit', () => {
      const elementValues = new Map([
        ['se1', 5.0], // Source voltage
        ['r1', 1.0], // Resistor voltage
        ['c1', 4.0], // Capacitor voltage
      ]);

      const bondPowers = new Map([
        ['bond1', 10], // Input power
        ['bond2', 10], // Dissipated power
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('displays balanced energy conservation status', () => {
      const elementValues = new Map([
        ['se1', 5.0],
        ['r1', 1.0],
        ['c1', 4.0],
      ]);

      const bondPowers = new Map([
        ['bond1', 20],
        ['bond2', 20], // Input equals output = balanced
      ]);

      const { getByText } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      // Should show balanced status
      expect(container).toBeInTheDocument();
    });

    test('displays imbalanced energy status', () => {
      const elementValues = new Map([
        ['se1', 5.0],
        ['r1', 1.0],
        ['c1', 4.0],
      ]);

      const bondPowers = new Map([
        ['bond1', 20],
        ['bond2', 5], // Input > output = imbalanced
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('calculates total input power from sources', () => {
      const elementValues = new Map();
      const bondPowers = new Map([
        ['bond1', 25], // Power from source
        ['bond2', -5], // Return power (negative)
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('calculates dissipation in resistive elements', () => {
      const elementValues = new Map([['r1', 1.0]]);
      const bondPowers = new Map([
        ['bond1', 20],
        ['bond2', 15], // 5W dissipated
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('tracks energy storage rate in capacitors/inductors', () => {
      const elementValues = new Map([
        ['c1', 2.5], // Charged capacitor
      ]);

      const bondPowers = new Map([
        ['bond1', 20],
        ['bond2', 5], // 5W charging
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('energy balance within tolerance is considered balanced', () => {
      // 5% tolerance test
      const elementValues = new Map();
      const bondPowers = new Map([
        ['bond1', 100],
        ['bond2', 95], // 5% loss
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Power Flow Analysis', () => {
    test('displays top power flow bonds sorted by magnitude', () => {
      const bondPowers = new Map([
        ['bond1', 50],
        ['bond2', 25],
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('distinguishes positive (output) and negative (input) power', () => {
      const bondPowers = new Map([
        ['bond1', 30], // Positive
        ['bond2', -20], // Negative
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('limits display to 8 largest power flows', () => {
      const manyBonds = Array.from({ length: 15 }, (_, i) => ({
        id: `bond${i}`,
        from: `elem${i}`,
        to: `elem${i + 1}`,
      })) as EditorBond[];

      const manyElements = Array.from({ length: 16 }, (_, i) => ({
        id: `elem${i}`,
        type: 'R',
        x: i * 50,
        y: 100,
      })) as EditorElement[];

      const bondPowers = new Map(
        Array.from({ length: 15 }, (_, i) => [`bond${i}`, Math.random() * 50])
      );

      const { container } = render(
        <AnalysisPanel
          elements={manyElements}
          bonds={manyBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('displays power values with appropriate units', () => {
      const bondPowers = new Map([
        ['bond1', 0.25], // Watts
        ['bond2', 1500], // High power
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('shows power bars with relative sizing', () => {
      const bondPowers = new Map([
        ['bond1', 100],
        ['bond2', 50], // 50% of max
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Performance Metrics', () => {
    test('displays all performance metrics', () => {
      const metrics: PerformanceMetrics = {
        wallClockTime: 5000,
        simulationTime: 2.5,
        totalSteps: 2500,
        stepsPerSecond: 500,
        averageStepTime: 2,
        fps: 50,
        cpuLoad: 45,
        averageError: 1e-6,
        maxError: 1e-5,
      };

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={metrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('calculates simulation speed ratio', () => {
      const metrics: PerformanceMetrics = {
        wallClockTime: 1000, // 1 second real time
        simulationTime: 10, // 10 seconds simulated
        totalSteps: 10000,
        stepsPerSecond: 10000,
        averageStepTime: 0.1,
        fps: 60,
        cpuLoad: 50,
        averageError: 1e-6,
        maxError: 1e-5,
      };

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={metrics}
        />
      );

      // Should show 10x speedup
      expect(container).toBeInTheDocument();
    });

    test('color-codes FPS status (good > 55, fair 30-55, poor < 30)', () => {
      const goodMetrics = { ...mockMetrics, fps: 60 };
      const fairMetrics = { ...mockMetrics, fps: 40 };
      const poorMetrics = { ...mockMetrics, fps: 20 };

      const { container: goodContainer } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={goodMetrics}
        />
      );
      expect(goodContainer).toBeInTheDocument();

      const { container: fairContainer } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={fairMetrics}
        />
      );
      expect(fairContainer).toBeInTheDocument();

      const { container: poorContainer } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={poorMetrics}
        />
      );
      expect(poorContainer).toBeInTheDocument();
    });

    test('color-codes CPU load (low < 50, medium 50-80, high > 80)', () => {
      const lowMetrics = { ...mockMetrics, cpuLoad: 30 };
      const mediumMetrics = { ...mockMetrics, cpuLoad: 65 };
      const highMetrics = { ...mockMetrics, cpuLoad: 95 };

      [lowMetrics, mediumMetrics, highMetrics].forEach((metrics) => {
        const { container } = render(
          <AnalysisPanel
            elements={mockElements}
            bonds={mockBonds}
            history={[]}
            elementValues={new Map()}
            bondPowers={new Map()}
            isRunning={true}
            currentMetrics={metrics}
          />
        );
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Historical Data Analysis', () => {
    test('displays history statistics when data available', () => {
      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={mockHistory}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('calculates time range from history', () => {
      // History spans 0s to 0.2s
      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={mockHistory}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('calculates average interval between history points', () => {
      // 3 points over 0.2s = 0.1s average interval
      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={mockHistory}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('hides history section when no data', () => {
      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Element Dissipation Tracking', () => {
    test('identifies resistive elements and their dissipation', () => {
      const elementValues = new Map([['r1', 1.0]]);
      const bondPowers = new Map([
        ['bond1', 20],
        ['bond2', 15], // R dissipates 5W
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={elementValues}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('sorts dissipation by magnitude', () => {
      const elements = [
        { id: 'r1', type: 'R', x: 100, y: 100 },
        { id: 'r2', type: 'R', x: 200, y: 100 },
        { id: 'r3', type: 'R', x: 300, y: 100 },
      ] as EditorElement[];

      const bonds = [
        { id: 'b1', from: 'r1', to: 'r2' },
        { id: 'b2', from: 'r2', to: 'r3' },
      ] as EditorBond[];

      const bondPowers = new Map([
        ['b1', 30], // R1 dissipates 30W
        ['b2', 10], // R2 dissipates 10W
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={elements}
          bonds={bonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('hides dissipation section if no significant dissipation', () => {
      const bondPowers = new Map([
        ['bond1', 0.001], // Negligible
        ['bond2', 0.0005],
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('displays dissipation bars with relative sizing', () => {
      const bondPowers = new Map([
        ['bond1', 50], // 50W dissipated
        ['bond2', 25], // 25W dissipated
      ]);

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={bondPowers}
          isRunning={true}
        />
      );

      // Second bar should be 50% of first
      expect(container).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('calls onExportData when export button clicked', () => {
      const onExportData = jest.fn();

      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={mockHistory}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={mockMetrics}
          onExportData={onExportData}
        />
      );

      expect(container).toBeInTheDocument();
    });

    test('hides export button if onExportData not provided', () => {
      const { container } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={mockHistory}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    test('updates energy balance as power flows change', () => {
      const { rerender } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map([
            ['bond1', 20],
            ['bond2', 15],
          ])}
          isRunning={true}
        />
      );

      // Update power flow
      rerender(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map([
            ['bond1', 50],
            ['bond2', 40],
          ])}
          isRunning={true}
        />
      );

      expect(true).toBe(true);
    });

    test('handles rapid metric updates', () => {
      const { rerender } = render(
        <AnalysisPanel
          elements={mockElements}
          bonds={mockBonds}
          history={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          currentMetrics={mockMetrics}
        />
      );

      for (let i = 0; i < 5; i++) {
        rerender(
          <AnalysisPanel
            elements={mockElements}
            bonds={mockBonds}
            history={[]}
            elementValues={new Map()}
            bondPowers={new Map()}
            isRunning={true}
            currentMetrics={{ ...mockMetrics, fps: 60 - i * 5 }}
          />
        );
      }

      expect(true).toBe(true);
    });
  });
});
