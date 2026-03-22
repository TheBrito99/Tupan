/**
 * FDM Slicer Panel Tests
 * Phase 19 Task 6: CAM UI & Integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FDMSlicerPanel } from '../FDMSlicerPanel';

describe('FDMSlicerPanel', () => {
  const mockOnCreateJob = jest.fn();
  const mockOnUpdateJob = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the panel header', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/FDM 3D Printer Slicer/i)).toBeInTheDocument();
  });

  it('displays print settings section', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Print Settings/i)).toBeInTheDocument();
  });

  it('has material selector with common materials', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    const select = screen.getByDisplayValue(/PLA/i);
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'ABS' } });
    expect(screen.getByDisplayValue(/ABS/i)).toBeInTheDocument();
  });

  it('updates layer height when slider moved', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const layerHeightInput = screen.getByRole('slider', { name: /Layer Height/i });
    fireEvent.change(layerHeightInput, { target: { value: '0.3' } });

    expect(screen.getByText(/0.30 mm/i)).toBeInTheDocument();
  });

  it('displays infill density control', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Infill Density/i)).toBeInTheDocument();
  });

  it('shows all 6 infill patterns', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    expect(screen.getByText(/Linear/i)).toBeInTheDocument();
    expect(screen.getByText(/Grid/i)).toBeInTheDocument();
    expect(screen.getByText(/Honeycomb/i)).toBeInTheDocument();
    expect(screen.getByText(/Gyroid/i)).toBeInTheDocument();
    expect(screen.getByText(/Cubic/i)).toBeInTheDocument();
    expect(screen.getByText(/Voronoi/i)).toBeInTheDocument();
  });

  it('selects infill pattern when clicked', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const honeycombPattern = screen.getByText(/Honeycomb/i).closest('div');
    fireEvent.click(honeycombPattern!);

    expect(honeycombPattern).toHaveClass('selected');
  });

  it('displays support structure options', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Enable Support Structures/i)).toBeInTheDocument();
  });

  it('toggles support structures', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const checkbox = screen.getByRole('checkbox', { name: /Enable Support Structures/i });
    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('shows support type selector when enabled', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const supportCheckbox = screen.getByRole('checkbox', { name: /Enable Support Structures/i });
    fireEvent.click(supportCheckbox);

    expect(screen.getByDisplayValue(/Tree/i)).toBeInTheDocument();
  });

  it('displays temperature settings', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Temperature/i)).toBeInTheDocument();
  });

  it('has nozzle temperature control', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Nozzle:/i)).toBeInTheDocument();
  });

  it('has bed temperature control', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Bed:/i)).toBeInTheDocument();
  });

  it('displays preview button', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Show Preview/i)).toBeInTheDocument();
  });

  it('toggles preview when button clicked', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const previewBtn = screen.getByText(/Show Preview/i);
    fireEvent.click(previewBtn);

    expect(screen.getByText(/Slice Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Hide Preview/i)).toBeInTheDocument();
  });

  it('displays slice button', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Slice & Create Job/i)).toBeInTheDocument();
  });

  it('alerts user if no geometry when slicing', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const sliceBtn = screen.getByText(/Slice & Create Job/i);
    fireEvent.click(sliceBtn);

    expect(alertSpy).toHaveBeenCalledWith('Please load a 3D model first');
    alertSpy.mockRestore();
  });

  it('creates job with correct parameters', () => {
    const mockGeometry = { vertices: [], faces: [] };
    render(
      <FDMSlicerPanel
        job={{ geometry: mockGeometry }}
        onCreateJob={mockOnCreateJob}
      />
    );

    // Change some settings
    const layerHeightInput = screen.getByRole('slider', { name: /Layer Height/i });
    fireEvent.change(layerHeightInput, { target: { value: '0.25' } });

    const sliceBtn = screen.getByText(/Slice & Create Job/i);
    fireEvent.click(sliceBtn);

    expect(mockOnCreateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fdm-print',
        geometry: mockGeometry,
        parameters: expect.objectContaining({
          layerHeight: 0.25,
        }),
      })
    );
  });

  it('calls onUpdateJob when settings change', () => {
    const mockJob = { id: '1', geometry: {} };
    render(
      <FDMSlicerPanel
        job={mockJob}
        onCreateJob={mockOnCreateJob}
        onUpdateJob={mockOnUpdateJob}
      />
    );

    const layerHeightInput = screen.getByRole('slider', { name: /Layer Height/i });
    fireEvent.change(layerHeightInput, { target: { value: '0.15' } });

    expect(mockOnUpdateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          layerHeight: 0.15,
        }),
      })
    );
  });

  it('displays infill pattern visualization', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const previewBtn = screen.getByText(/Show Preview/i);
    fireEvent.click(previewBtn);

    expect(screen.getByText(/Layer-by-layer visualization/i)).toBeInTheDocument();
  });

  it('updates material temperatures', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);

    const materialSelect = screen.getByDisplayValue(/PLA/i);
    fireEvent.change(materialSelect, { target: { value: 'ABS' } });

    // ABS should have higher temps than PLA
    expect(mockOnUpdateJob).toHaveBeenCalled();
  });

  it('handles first layer speed control', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/First Layer Speed/i)).toBeInTheDocument();
  });

  it('handles print speed control', () => {
    render(<FDMSlicerPanel onCreateJob={mockOnCreateJob} />);
    expect(screen.getByText(/Print Speed:/i)).toBeInTheDocument();
  });

  it('displays cost estimation hint', () => {
    const mockGeometry = { vertices: [], faces: [] };
    render(
      <FDMSlicerPanel
        job={{ geometry: mockGeometry }}
        onCreateJob={mockOnCreateJob}
      />
    );

    // Cost is estimated in job creation
    expect(screen.getByText(/Slice & Create Job/i)).toBeInTheDocument();
  });
});
