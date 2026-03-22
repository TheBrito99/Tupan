/**
 * Hole Wizard Tests
 * Phase 17.6: Testing
 *
 * Tests for hole template library and wizard logic
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HoleWizard, METRIC_HOLES, IMPERIAL_HOLES, TAPPED_HOLES } from '../HoleWizard';
import '@testing-library/jest-dom';

describe('HoleWizard Component', () => {
  const mockOnCreateHole = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnCreateHole.mockClear();
    mockOnClose.mockClear();
  });

  // =========================================================================
  // RENDERING TESTS
  // =========================================================================

  describe('Rendering', () => {
    test('should render hole wizard header', () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Hole Wizard')).toBeInTheDocument();
    });

    test('should render close button', () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByText('✕');
      expect(closeButton).toBeInTheDocument();
    });

    test('should render mode selection buttons on initial load', () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Standard Template')).toBeInTheDocument();
      expect(screen.getByText('Custom Hole')).toBeInTheDocument();
    });

    test('should close wizard when close button clicked', () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('✕'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TEMPLATE SELECTION TESTS
  // =========================================================================

  describe('Template Selection', () => {
    test('should display metric templates when selected', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Standard Template'));

      await waitFor(() => {
        expect(screen.getByText('M2')).toBeInTheDocument();
        expect(screen.getByText('M3')).toBeInTheDocument();
        expect(screen.getByText('M6')).toBeInTheDocument();
      });
    });

    test('should display imperial templates', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Standard Template'));

      await waitFor(() => {
        const imperialButton = screen.getByText('Imperial Through');
        fireEvent.click(imperialButton);
      });

      expect(screen.getByText('#4 (0.116")')).toBeInTheDocument();
    });

    test('should display tapped hole templates', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Standard Template'));

      await waitFor(() => {
        const tappedButton = screen.getByText('Tapped Holes');
        fireEvent.click(tappedButton);
      });

      expect(screen.getByText('M3 x 0.5')).toBeInTheDocument();
    });

    test('should show template details when selected', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Standard Template'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('M6'));
      });

      expect(screen.getByText('Hole Details')).toBeInTheDocument();
      expect(screen.getByText('Through')).toBeInTheDocument();
      expect(screen.getByText('M6')).toBeInTheDocument();
    });

    test('should enable create button only when template selected', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Standard Template'));

      await waitFor(() => {
        const buttons = screen.getAllByText('Create Hole');
        const createButton = buttons[0] as HTMLButtonElement;
        expect(createButton.disabled).toBe(true);
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('M6'));
      });

      await waitFor(() => {
        const buttons = screen.getAllByText('Create Hole');
        const createButton = buttons[0] as HTMLButtonElement;
        expect(createButton.disabled).toBe(false);
      });
    });
  });

  // =========================================================================
  // CUSTOM HOLE TESTS
  // =========================================================================

  describe('Custom Hole Creation', () => {
    test('should show custom hole form', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Custom Hole'));

      await waitFor(() => {
        expect(screen.getByText('Hole Name')).toBeInTheDocument();
        expect(screen.getByText('Hole Type')).toBeInTheDocument();
        expect(screen.getByText('Diameter (mm)')).toBeInTheDocument();
      });
    });

    test('should allow changing hole type', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Custom Hole'));

      await waitFor(() => {
        const select = screen.getByDisplayValue('Through Hole') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'Blind' } });
      });

      expect(screen.getByText('Depth (mm)')).toBeInTheDocument();
    });

    test('should show counterbore options for CounterBore type', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Custom Hole'));

      await waitFor(() => {
        const select = screen.getByDisplayValue('Through Hole') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'CounterBore' } });
      });

      expect(screen.getByText('Counterbore Diameter (mm)')).toBeInTheDocument();
      expect(screen.getByText('Counterbore Depth (mm)')).toBeInTheDocument();
    });

    test('should show countersink options for CounterSink type', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Custom Hole'));

      await waitFor(() => {
        const select = screen.getByDisplayValue('Through Hole') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'CounterSink' } });
      });

      expect(screen.getByText('Countersink Diameter (mm)')).toBeInTheDocument();
      expect(screen.getByText('Countersink Angle (°)')).toBeInTheDocument();
    });

    test('should create custom hole with parameters', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Custom Hole'));

      await waitFor(() => {
        const diameterInput = screen.getByDisplayValue('6') as HTMLInputElement;
        fireEvent.change(diameterInput, { target: { value: '10' } });
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Hole/i }));

      expect(mockOnCreateHole).toHaveBeenCalledWith(
        expect.stringContaining('Hole'),
        10,
        'Through',
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // NAVIGATION TESTS
  // =========================================================================

  describe('Navigation', () => {
    test('should go back from template selection to mode selection', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Standard Template'));

      await waitFor(() => {
        const backButtons = screen.getAllByText('Back');
        fireEvent.click(backButtons[0]);
      });

      expect(screen.getByText('Standard Template')).toBeInTheDocument();
    });

    test('should go back from custom form to mode selection', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByText('Custom Hole'));

      await waitFor(() => {
        const backButtons = screen.getAllByText('Back');
        fireEvent.click(backButtons[0]);
      });

      expect(screen.getByText('Standard Template')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // INTEGRATION TESTS
  // =========================================================================

  describe('Integration', () => {
    test('should complete full workflow for standard template', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      // Select standard template
      fireEvent.click(screen.getByText('Standard Template'));

      // Wait for template selection screen
      await waitFor(() => {
        expect(screen.getByText('M6')).toBeInTheDocument();
      });

      // Select M6 template
      fireEvent.click(screen.getByText('M6'));

      // Click create button
      await waitFor(() => {
        const buttons = screen.getAllByText('Create Hole');
        fireEvent.click(buttons[0]);
      });

      // Verify callback was called
      expect(mockOnCreateHole).toHaveBeenCalled();
    });

    test('should complete full workflow for custom hole', async () => {
      render(
        <HoleWizard
          onCreateHole={mockOnCreateHole}
          onClose={mockOnClose}
        />
      );

      // Select custom hole
      fireEvent.click(screen.getByText('Custom Hole'));

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByText('Hole Name')).toBeInTheDocument();
      });

      // Fill in form
      const nameInput = screen.getByPlaceholderText('e.g., Mounting Hole') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test Hole' } });

      // Create hole
      const createButton = screen.getByRole('button', { name: /Create Hole/i });
      fireEvent.click(createButton);

      // Verify callback
      expect(mockOnCreateHole).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// HOLE TEMPLATE LIBRARY TESTS
// ============================================================================

describe('Hole Template Library', () => {
  describe('Metric Holes', () => {
    test('should have metric hole templates', () => {
      expect(METRIC_HOLES.length).toBeGreaterThan(0);
    });

    test('should have M6 template', () => {
      const m6 = METRIC_HOLES.find((h) => h.name === 'M6');
      expect(m6).toBeDefined();
      expect(m6?.diameter).toBe(6.0);
      expect(m6?.type).toBe('Through');
    });

    test('all metric holes should have valid diameters', () => {
      METRIC_HOLES.forEach((hole) => {
        expect(hole.diameter).toBeGreaterThan(0);
      });
    });
  });

  describe('Imperial Holes', () => {
    test('should have imperial hole templates', () => {
      expect(IMPERIAL_HOLES.length).toBeGreaterThan(0);
    });

    test('should have 1/4" template', () => {
      const quarter = IMPERIAL_HOLES.find((h) => h.name === '1/4"');
      expect(quarter).toBeDefined();
      expect(quarter?.diameter).toBe(6.35);
    });

    test('all imperial holes should have valid diameters', () => {
      IMPERIAL_HOLES.forEach((hole) => {
        expect(hole.diameter).toBeGreaterThan(0);
      });
    });
  });

  describe('Tapped Holes', () => {
    test('should have tapped hole templates', () => {
      expect(TAPPED_HOLES.length).toBeGreaterThan(0);
    });

    test('should have M6 tapped template with thread info', () => {
      const m6Tapped = TAPPED_HOLES.find((h) => h.name === 'M6 x 1.0');
      expect(m6Tapped).toBeDefined();
      expect(m6Tapped?.thread).toBeDefined();
      expect(m6Tapped?.thread?.standard).toBe('M6');
    });

    test('all tapped holes should have thread specifications', () => {
      TAPPED_HOLES.forEach((hole) => {
        expect(hole.thread).toBeDefined();
        expect(hole.thread?.pitch).toBeGreaterThan(0);
      });
    });
  });
});
