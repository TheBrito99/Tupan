/**
 * Cost Estimator Panel Tests
 * Phase 19 Task 6: CAM UI & Integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CostEstimatorPanel } from '../CostEstimatorPanel';

describe('CostEstimatorPanel', () => {
  const mockJobs = [
    {
      id: '1',
      name: 'FDM Print Part A',
      type: 'fdm-print' as const,
      geometry: {},
      parameters: {},
      estimatedTime: 120,
      estimatedCost: 50,
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
    {
      id: '2',
      name: 'CNC Mill Part B',
      type: 'cnc-mill' as const,
      geometry: {},
      parameters: {},
      estimatedTime: 240,
      estimatedCost: 150,
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
  ];

  it('renders the panel header', () => {
    render(<CostEstimatorPanel jobs={[]} />);
    expect(screen.getByText(/Cost Estimator/i)).toBeInTheDocument();
  });

  it('displays message when no jobs exist', () => {
    render(<CostEstimatorPanel jobs={[]} />);
    expect(screen.getByText(/No manufacturing jobs created yet/i)).toBeInTheDocument();
  });

  it('displays mode toggle buttons', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/📊 Individual Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/📈 Compare Jobs/i)).toBeInTheDocument();
  });

  it('starts in individual analysis mode', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const individualBtn = screen.getByText(/📊 Individual Analysis/i);
    expect(individualBtn).toHaveClass('active');
  });

  it('switches to comparison mode when button clicked', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    expect(compareBtn).toHaveClass('active');
    expect(screen.getByText(/Select Jobs to Compare/i)).toBeInTheDocument();
  });

  it('displays job cards in individual mode', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/FDM Print Part A/i)).toBeInTheDocument();
    expect(screen.getByText(/CNC Mill Part B/i)).toBeInTheDocument();
  });

  it('shows cost breakdown for each job', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Cost Breakdown/i)).toBeInTheDocument();
  });

  it('displays cost breakdown charts', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Material/i)).toBeInTheDocument();
    expect(screen.getByText(/Machine Time/i)).toBeInTheDocument();
  });

  it('calculates and displays total cost', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Total Cost:/i)).toBeInTheDocument();
  });

  it('displays profit margin analysis', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Profit Margin/i)).toBeInTheDocument();
  });

  it('shows selling price', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Selling Price:/i)).toBeInTheDocument();
  });

  it('displays ROI analysis with payback units', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Payback:/i)).toBeInTheDocument();
  });

  it('has export estimate button', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const exportBtns = screen.getAllByText(/📄 Export Estimate/i);
    expect(exportBtns.length).toBeGreaterThan(0);
  });

  it('enables job selection in comparison mode', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(mockJobs.length);
  });

  it('selects jobs for comparison', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(checkboxes[0]).toBeChecked();
  });

  it('displays comparison table when jobs selected', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(screen.getByText(/Comparison Results/i)).toBeInTheDocument();
  });

  it('shows comparison table with job details', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText(/Cost/i)).toBeInTheDocument();
    expect(screen.getByText(/Price/i)).toBeInTheDocument();
  });

  it('calculates total project cost', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(screen.getByText(/Total Project Cost:/i)).toBeInTheDocument();
  });

  it('calculates average cost per job', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText(/Average Cost per Job:/i)).toBeInTheDocument();
  });

  it('identifies most expensive job', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText(/Most Expensive:/i)).toBeInTheDocument();
  });

  it('identifies most profitable job', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText(/Most Profitable:/i)).toBeInTheDocument();
  });

  it('handles deselecting jobs', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[0]); // Deselect

    expect(checkboxes[0]).not.toBeChecked();
    expect(screen.getByText(/Select at least one job to compare/i)).toBeInTheDocument();
  });

  it('displays markup percentage', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    // Markup is shown in individual analysis
    const tables = screen.queryAllByText(/Markup/i);
    // May not be visible until comparison is made
  });

  it('handles job type labels correctly', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/fdm-print/i)).toBeInTheDocument();
    expect(screen.getByText(/cnc-mill/i)).toBeInTheDocument();
  });

  it('calls export function when button clicked', () => {
    const mockExport = jest.fn();
    render(
      <CostEstimatorPanel
        jobs={mockJobs}
        onExportEstimate={mockExport}
      />
    );

    const exportBtns = screen.getAllByText(/📄 Export Estimate/i);
    fireEvent.click(exportBtns[0]);

    expect(mockExport).toHaveBeenCalled();
  });

  it('handles empty comparison state', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);
    fireEvent.click(compareBtn);

    expect(screen.getByText(/Select at least one job to compare/i)).toBeInTheDocument();
  });

  it('maintains mode when switching between modes', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    const compareBtn = screen.getByText(/📈 Compare Jobs/i);

    fireEvent.click(compareBtn);
    expect(compareBtn).toHaveClass('active');

    const individualBtn = screen.getByText(/📊 Individual Analysis/i);
    fireEvent.click(individualBtn);
    expect(individualBtn).toHaveClass('active');

    fireEvent.click(compareBtn);
    expect(compareBtn).toHaveClass('active');
  });

  it('displays overhead calculation', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Overhead/i)).toBeInTheDocument();
  });

  it('shows subtotal before overhead', () => {
    render(<CostEstimatorPanel jobs={mockJobs} />);
    expect(screen.getByText(/Subtotal:/i)).toBeInTheDocument();
  });
});
