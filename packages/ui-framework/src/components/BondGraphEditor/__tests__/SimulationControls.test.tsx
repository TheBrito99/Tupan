/**
 * Simulation Controls Tests
 *
 * Tests for:
 * - Playback control buttons (play/pause/stop/reset)
 * - Speed multiplier slider
 * - Duration input and validation
 * - Recording toggle
 * - Export functionality
 * - Real-time performance display
 * - Time formatting
 *
 * 18 comprehensive tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimulationControls } from '../SimulationControls';
import type { PerformanceMetrics } from '@tupan/core-ts/wasm-bridge';

describe('SimulationControls', () => {
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

  const mockCallbacks = {
    onStart: jest.fn(),
    onPause: jest.fn(),
    onResume: jest.fn(),
    onStop: jest.fn(),
    onReset: jest.fn(),
    onSpeedChange: jest.fn(),
    onDurationChange: jest.fn(),
    onRecordToggle: jest.fn(),
    onExport: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Playback Controls', () => {
    test('shows Start button when simulation not running', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(getByText(/Start/)).toBeInTheDocument();
    });

    test('calls onStart when Start button clicked', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      fireEvent.click(getByText(/Start/));
      expect(mockCallbacks.onStart).toHaveBeenCalled();
    });

    test('shows Pause button when simulation is running', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(getByText(/Pause/)).toBeInTheDocument();
    });

    test('calls onPause when Pause button clicked', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      fireEvent.click(getByText(/Pause/));
      expect(mockCallbacks.onPause).toHaveBeenCalled();
    });

    test('shows Resume button when simulation is paused', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={true}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(getByText(/Resume/)).toBeInTheDocument();
    });

    test('calls onResume when Resume button clicked', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={true}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      fireEvent.click(getByText(/Resume/));
      expect(mockCallbacks.onResume).toHaveBeenCalled();
    });

    test('Stop button disabled when not running', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const stopButton = getByText(/Stop/) as HTMLButtonElement;
      expect(stopButton.disabled).toBe(true);
    });

    test('calls onStop when Stop button clicked', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      fireEvent.click(getByText(/Stop/));
      expect(mockCallbacks.onStop).toHaveBeenCalled();
    });

    test('calls onReset when Reset button clicked', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      fireEvent.click(getByText(/Reset/));
      expect(mockCallbacks.onReset).toHaveBeenCalled();
    });

    test('Reset button disabled at initial state', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const resetButton = getByText(/Reset/) as HTMLButtonElement;
      expect(resetButton.disabled).toBe(true);
    });
  });

  describe('Speed Control', () => {
    test('renders speed slider with current value', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={2.5}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider).toBeInTheDocument();
      expect(parseFloat(slider.value)).toBe(2.5);
    });

    test('calls onSpeedChange when slider adjusted', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '5' } });

      expect(mockCallbacks.onSpeedChange).toHaveBeenCalledWith(5);
    });

    test('slider range is 0.1x to 10x', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider.min).toBe('0.1');
      expect(slider.max).toBe('10');
    });

    test('displays current speed multiplier', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={3.5}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(getByText(/3.5x speed/)).toBeInTheDocument();
    });
  });

  describe('Time Display and Formatting', () => {
    test('displays simulation time', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={5.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('5.50s');
    });

    test('formats time with minutes when > 60 seconds', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={125.5}
          duration={200}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('2m 5.50s');
    });

    test('formats time with hours when > 3600 seconds', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={3665.5}
          duration={7200}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('1h 1m 5.50s');
    });

    test('displays duration', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={5}
          duration={15.5}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('15.50s');
    });

    test('calculates and displays progress percentage', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(container.textContent).toContain('50.0%');
    });

    test('progress bar fills proportionally', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={7.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const progressFill = container.querySelector('[class*="progressFill"]') as HTMLElement;
      expect(progressFill).toBeInTheDocument();
      expect(progressFill.style.width).toBe('75%');
    });
  });

  describe('Duration Input', () => {
    test('renders duration input field', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const durationInput = container.querySelector('input[type="number"]') as HTMLInputElement;
      expect(durationInput).toBeInTheDocument();
      expect(durationInput.value).toBe('10');
    });

    test('duration input disabled during simulation', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const durationInput = container.querySelector('input[type="number"]') as HTMLInputElement;
      expect(durationInput.disabled).toBe(true);
    });

    test('calls onDurationChange when duration value entered', () => {
      const { container, getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const durationInput = container.querySelector('input[type="number"]') as HTMLInputElement;
      fireEvent.change(durationInput, { target: { value: '20' } });

      fireEvent.click(getByText(/Apply/));
      expect(mockCallbacks.onDurationChange).toHaveBeenCalledWith(20);
    });

    test('duration minimum is 0.001 seconds', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const durationInput = container.querySelector('input[type="number"]') as HTMLInputElement;
      expect(durationInput.min).toBe('0.001');
    });

    test('duration maximum is 10000 seconds', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const durationInput = container.querySelector('input[type="number"]') as HTMLInputElement;
      expect(durationInput.max).toBe('10000');
    });
  });

  describe('Recording Toggle', () => {
    test('renders recording checkbox', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
    });

    test('shows record checkbox checked when recordHistory true', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    test('calls onRecordToggle when checkbox toggled', () => {
      const { container } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.change(checkbox);

      expect(mockCallbacks.onRecordToggle).toHaveBeenCalled();
    });

    test('recording checkbox disabled during simulation', () => {
      const { container } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.disabled).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    test('Export button disabled when no simulation time', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const exportButton = getByText(/Export/) as HTMLButtonElement;
      expect(exportButton.disabled).toBe(true);
    });

    test('Export button enabled when simulation has time', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const exportButton = getByText(/Export/) as HTMLButtonElement;
      expect(exportButton.disabled).toBe(false);
    });

    test('calls onExport when Export button clicked', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      fireEvent.click(getByText(/Export/));
      expect(mockCallbacks.onExport).toHaveBeenCalled();
    });
  });

  describe('Status Indicators', () => {
    test('displays Running status when simulation active', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(getByText(/Running/)).toBeInTheDocument();
    });

    test('displays Paused status when simulation paused', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={true}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(getByText(/Paused/)).toBeInTheDocument();
    });

    test('displays Stopped status when simulation not running', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(getByText(/Stopped/)).toBeInTheDocument();
    });
  });

  describe('Performance Display', () => {
    test('displays FPS when metrics provided', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          performanceMetrics={mockMetrics}
          {...mockCallbacks}
        />
      );

      expect(getByText(/60.0/)).toBeInTheDocument();
    });

    test('displays CPU load when metrics provided', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          performanceMetrics={mockMetrics}
          {...mockCallbacks}
        />
      );

      expect(getByText(/30.0%/)).toBeInTheDocument();
    });

    test('displays steps per second', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          performanceMetrics={mockMetrics}
          {...mockCallbacks}
        />
      );

      expect(getByText(/1000/)).toBeInTheDocument();
    });

    test('calculates simulation speedup', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={true}
          isPaused={false}
          currentTime={0.5}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          performanceMetrics={mockMetrics}
          {...mockCallbacks}
        />
      );

      expect(getByText(/1.0x/)).toBeInTheDocument();
    });
  });

  describe('Advanced Options', () => {
    test('Advanced section hidden by default', () => {
      const { queryByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      expect(queryByText(/Solver Step Size/)).not.toBeInTheDocument();
    });

    test('Advanced section toggles on button click', () => {
      const { getByText, queryByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      const advancedButton = getByText(/Advanced/);
      fireEvent.click(advancedButton);

      expect(queryByText(/Solver Step Size/)).toBeInTheDocument();
    });

    test('Advanced section shows solver options', () => {
      const { getByText } = render(
        <SimulationControls
          isRunning={false}
          isPaused={false}
          currentTime={0}
          duration={10}
          speedMultiplier={1}
          recordHistory={true}
          {...mockCallbacks}
        />
      );

      fireEvent.click(getByText(/Advanced/));
      expect(getByText(/Solver Step Size/)).toBeInTheDocument();
      expect(getByText(/Performance Target/)).toBeInTheDocument();
      expect(getByText(/History Memory/)).toBeInTheDocument();
    });
  });
});
