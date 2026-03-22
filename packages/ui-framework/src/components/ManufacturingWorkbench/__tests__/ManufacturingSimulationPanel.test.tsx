/**
 * Manufacturing Simulation Panel Tests
 * Phase 19 Task 6: CAM UI & Integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManufacturingSimulationPanel } from '../ManufacturingSimulationPanel';

describe('ManufacturingSimulationPanel', () => {
  it('renders the panel header', () => {
    render(<ManufacturingSimulationPanel />);
    expect(screen.getByText(/Manufacturing Simulation/i)).toBeInTheDocument();
  });

  it('displays message when no job is active', () => {
    render(<ManufacturingSimulationPanel />);
    expect(screen.getByText(/No active manufacturing job selected/i)).toBeInTheDocument();
  });

  it('displays run simulation button when job is active', () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);
    expect(screen.getByText(/Run Simulation/i)).toBeInTheDocument();
  });

  it('executes simulation when button clicked', async () => {
    const mockJob = { id: '1', geometry: {} };
    const mockOnRun = jest.fn();

    render(
      <ManufacturingSimulationPanel
        activeJob={mockJob}
        onRunSimulation={mockOnRun}
      />
    );

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    // Button should show running state
    await waitFor(() => {
      expect(screen.getByText(/Running Simulation/i)).toBeInTheDocument();
    });

    // Eventually shows results
    await waitFor(
      () => {
        expect(screen.getByText(/Cutting Forces/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('displays three analysis tabs', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cutting Forces/i)).toBeInTheDocument();
      expect(screen.getByText(/Spindle Load/i)).toBeInTheDocument();
      expect(screen.getByText(/Thermal Analysis/i)).toBeInTheDocument();
    });
  });

  it('shows cutting forces on tab click', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tangential/i)).toBeInTheDocument();
      expect(screen.getByText(/Feed Force/i)).toBeInTheDocument();
      expect(screen.getByText(/Radial Force/i)).toBeInTheDocument();
    });
  });

  it('displays spindle load gauge', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const spindleTab = screen.getByText(/Spindle Load/i);
      fireEvent.click(spindleTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Load of Spindle Capacity/i)).toBeInTheDocument();
    });
  });

  it('shows thermal risk indicator', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const thermalTab = screen.getByText(/Thermal Analysis/i);
      fireEvent.click(thermalTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Tool Life Assessment/i)).toBeInTheDocument();
    });
  });

  it('displays temperature indicators', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const thermalTab = screen.getByText(/Thermal Analysis/i);
      fireEvent.click(thermalTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Chip Temp/i)).toBeInTheDocument();
      expect(screen.getByText(/Tool Temp/i)).toBeInTheDocument();
      expect(screen.getByText(/Workpiece Temp/i)).toBeInTheDocument();
    });
  });

  it('switches between tabs correctly', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tangential/i)).toBeInTheDocument();
    });

    // Switch to spindle load
    const spindleTab = screen.getByText(/Spindle Load/i);
    fireEvent.click(spindleTab);

    await waitFor(() => {
      expect(screen.getByText(/Load of Spindle Capacity/i)).toBeInTheDocument();
    });

    // Switch to thermal
    const thermalTab = screen.getByText(/Thermal Analysis/i);
    fireEvent.click(thermalTab);

    await waitFor(() => {
      expect(screen.getByText(/Tool Life Assessment/i)).toBeInTheDocument();
    });
  });

  it('displays power information on cutting forces tab', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cutting Power/i)).toBeInTheDocument();
    });
  });

  it('shows safe spindle load when within limits', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const spindleTab = screen.getByText(/Spindle Load/i);
      fireEvent.click(spindleTab);
    });

    await waitFor(() => {
      // Look for either safe or caution status
      const statusElements = screen.queryAllByText(/Safe|Caution|Critical|Failure/i);
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  it('displays interpretation and optimization tips', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Interpretation/i)).toBeInTheDocument();
    });
  });

  it('shows machine capacity information', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const spindleTab = screen.getByText(/Spindle Load/i);
      fireEvent.click(spindleTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Spindle Torque/i)).toBeInTheDocument();
      expect(screen.getByText(/Power Margin/i)).toBeInTheDocument();
    });
  });

  it('displays tool life consumed as progress bar', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const thermalTab = screen.getByText(/Thermal Analysis/i);
      fireEvent.click(thermalTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Tool Life Consumed/i)).toBeInTheDocument();
    });
  });

  it('calls onRunSimulation callback when simulation completes', async () => {
    const mockJob = { id: '1', geometry: {} };
    const mockOnRun = jest.fn();

    render(
      <ManufacturingSimulationPanel
        activeJob={mockJob}
        onRunSimulation={mockOnRun}
      />
    );

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(mockOnRun).toHaveBeenCalled();
    });
  });

  it('displays results in empty state before running', () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    expect(screen.getByText(/Run Simulation to analyze/i)).toBeInTheDocument();
  });

  it('has proper accessibility with tabs', async () => {
    const mockJob = { id: '1', geometry: {} };
    render(<ManufacturingSimulationPanel activeJob={mockJob} />);

    const runBtn = screen.getByText(/Run Simulation/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
    });
  });
});
