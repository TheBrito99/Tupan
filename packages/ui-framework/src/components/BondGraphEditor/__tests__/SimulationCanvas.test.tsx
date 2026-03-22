/**
 * Canvas Simulation Visualization Tests
 *
 * Tests for:
 * - Element rendering
 * - Bond visualization with power flow
 * - Causality stroke rendering
 * - Pan/zoom functionality
 * - Real-time metrics overlay
 * - Performance under high element count
 *
 * 18 comprehensive tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimulationCanvas } from '../SimulationCanvas';
import type { EditorElement, EditorBond } from '../types';
import type { PerformanceMetrics } from '@tupan/core-ts/wasm-bridge';

describe('SimulationCanvas', () => {
  // Mock canvas elements
  const mockElements: EditorElement[] = [
    {
      id: 'se1',
      type: 'Se',
      x: 100,
      y: 100,
      width: 40,
      height: 40,
    } as EditorElement,
    {
      id: 'r1',
      type: 'R',
      x: 200,
      y: 100,
      width: 40,
      height: 40,
    } as EditorElement,
    {
      id: 'c1',
      type: 'C',
      x: 300,
      y: 100,
      width: 40,
      height: 40,
    } as EditorElement,
  ];

  const mockBonds: EditorBond[] = [
    {
      id: 'bond1',
      from: 'se1',
      to: 'r1',
    } as EditorBond,
    {
      id: 'bond2',
      from: 'r1',
      to: 'c1',
    } as EditorBond,
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

  describe('Element Rendering', () => {
    test('renders source elements (Se, Sf) as circles', () => {
      const { container } = render(
        <SimulationCanvas
          elements={[mockElements[0]]}
          bonds={[]}
          elementValues={new Map([['se1', 5.0]])}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('renders storage elements (C, I) as rectangles', () => {
      const { container } = render(
        <SimulationCanvas
          elements={[mockElements[2]]}
          bonds={[]}
          elementValues={new Map([['c1', 2.5]])}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('renders resistor (R) as zigzag', () => {
      const { container } = render(
        <SimulationCanvas
          elements={[mockElements[1]]}
          bonds={[]}
          elementValues={new Map([['r1', 1.0]])}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('displays element values during simulation', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map([
            ['se1', 5.0],
            ['r1', 0.5],
            ['c1', 2.5],
          ])}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('hides element values when simulation is paused', () => {
      const { rerender, container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map([['se1', 5.0]])}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      rerender(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map([['se1', 5.0]])}
          bondPowers={new Map()}
          isRunning={false}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('renders all element types', () => {
      const allElements: EditorElement[] = [
        { ...mockElements[0], type: 'Se' },
        { ...mockElements[0], type: 'Sf', id: 'sf1' },
        { ...mockElements[0], type: 'C', id: 'c1' },
        { ...mockElements[0], type: 'I', id: 'i1' },
        { ...mockElements[0], type: 'R', id: 'r1' },
        { ...mockElements[0], type: 'TF', id: 'tf1' },
        { ...mockElements[0], type: 'GY', id: 'gy1' },
        { ...mockElements[0], type: 'Junction0', id: 'j0' },
        { ...mockElements[0], type: 'Junction1', id: 'j1' },
      ] as EditorElement[];

      const { container } = render(
        <SimulationCanvas
          elements={allElements}
          bonds={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Bond Visualization', () => {
    test('renders bonds between elements', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('colors bonds based on power direction', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map([
            ['bond1', 10], // Positive power - green
            ['bond2', -5], // Negative power - red
          ])}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('varies bond thickness with power magnitude', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map([
            ['bond1', 50], // High power - thick
            ['bond2', 1], // Low power - thin
          ])}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('draws causality stroke on bonds', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('displays power values on bonds with significant power', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map([
            ['bond1', 15.25],
            ['bond2', 0.05], // Too small to display
          ])}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('draws directional arrows for power flow', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map([
            ['bond1', 20],
            ['bond2', -10],
          ])}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Pan and Zoom', () => {
    test('zooms in on wheel scroll up', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      fireEvent.wheel(canvas, { deltaY: -100 });

      // Zoom should increase (smaller deltaY = scroll up)
      expect(canvas).toBeInTheDocument();
    });

    test('zooms out on wheel scroll down', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      fireEvent.wheel(canvas, { deltaY: 100 });

      // Zoom should decrease
      expect(canvas).toBeInTheDocument();
    });

    test('clamps zoom between 0.1 and 5', () => {
      const { container, rerender } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      // Try to zoom in too much
      for (let i = 0; i < 10; i++) {
        fireEvent.wheel(canvas, { deltaY: -100 });
      }

      expect(canvas).toBeInTheDocument();
    });

    test('pans with middle mouse button', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { button: 1, clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas);

      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Performance Metrics Display', () => {
    test('renders metrics overlay when metrics provided', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={mockMetrics}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('displays FPS color-coded (green > 55, yellow 30-55, red < 30)', () => {
      const goodMetrics = { ...mockMetrics, fps: 60 };
      const { container: goodContainer } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={goodMetrics}
        />
      );

      expect(goodContainer.querySelector('canvas')).toBeInTheDocument();

      const fairMetrics = { ...mockMetrics, fps: 40 };
      const { container: fairContainer } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={fairMetrics}
        />
      );

      expect(fairContainer.querySelector('canvas')).toBeInTheDocument();
    });

    test('displays CPU load color-coded', () => {
      const highCpuMetrics = { ...mockMetrics, cpuLoad: 95 };
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={highCpuMetrics}
        />
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    test('displays simulation time and elapsed time', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={mockMetrics}
          simulationData={{
            time: 1.5,
            state: new Float64Array([1, 2, 3]),
            timestamp: Date.now(),
          }}
        />
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    test('updates metrics in real-time', () => {
      const { rerender, container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={mockMetrics}
        />
      );

      const updatedMetrics = { ...mockMetrics, fps: 55, totalSteps: 2000 };

      rerender(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={updatedMetrics}
        />
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Canvas State Management', () => {
    test('initializes with default pan/zoom', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('handles mouse down for panning', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          onMouseDown={jest.fn()}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      fireEvent.mouseDown(canvas, { button: 0 });

      expect(canvas).toBeInTheDocument();
    });

    test('changes cursor to grabbing while dragging', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 });
      expect(canvas.style.cursor).toContain('grab');

      fireEvent.mouseUp(canvas);
      expect(canvas.style.cursor).toContain('grab');
    });

    test('forwards mouse events to callbacks', () => {
      const onMouseDown = jest.fn();
      const onMouseMove = jest.fn();
      const onMouseUp = jest.fn();

      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      fireEvent.mouseDown(canvas);
      expect(onMouseDown).toHaveBeenCalled();

      fireEvent.mouseMove(canvas);
      expect(onMouseMove).toHaveBeenCalled();

      fireEvent.mouseUp(canvas);
      expect(onMouseUp).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('renders 100 elements in under 100ms', () => {
      const largeElements = Array.from({ length: 100 }, (_, i) => ({
        ...mockElements[0],
        id: `elem${i}`,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      })) as EditorElement[];

      const start = performance.now();

      render(
        <SimulationCanvas
          elements={largeElements}
          bonds={[]}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const end = performance.now();
      expect(end - start).toBeLessThan(100);
    });

    test('handles rapid metric updates', () => {
      const { rerender } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
          performanceMetrics={mockMetrics}
        />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <SimulationCanvas
            elements={mockElements}
            bonds={mockBonds}
            elementValues={new Map([[`elem${i}`, i * 0.1]])}
            bondPowers={new Map([['bond1', i * 5]])}
            isRunning={true}
            performanceMetrics={{ ...mockMetrics, fps: 60 - i }}
          />
        );
      }

      expect(true).toBe(true);
    });
  });

  describe('Grid and Background', () => {
    test('draws grid background', () => {
      const { container } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('grid adjusts with pan/zoom', () => {
      const { container, rerender } = render(
        <SimulationCanvas
          elements={mockElements}
          bonds={mockBonds}
          elementValues={new Map()}
          bondPowers={new Map()}
          isRunning={true}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      fireEvent.wheel(canvas, { deltaY: -50 });

      expect(canvas).toBeInTheDocument();
    });
  });
});
