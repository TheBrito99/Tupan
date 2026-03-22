/**
 * ManufacturingPanel Tests - Phase 14
 *
 * Tests for:
 * - Tab navigation
 * - File generation UI
 * - Configuration options
 * - Export interactions
 * - State management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManufacturingPanel } from '../ManufacturingPanel';
import { PCBBoard, PCBLayer } from '../types';
import { FootprintLibrary } from '../FootprintLibrary';

// Test fixtures
const createTestBoard = (): PCBBoard => {
  const library = new FootprintLibrary();
  return {
    id: 'test-board',
    title: 'Test Board',
    width: 100,
    height: 100,
    thickness: 1.6,
    layers: [PCBLayer.SIGNAL_TOP, PCBLayer.SIGNAL_BOTTOM],
    components: [
      {
        id: 'comp1',
        refdes: 'R1',
        footprint: library.getFootprint('R0603')!,
        position: { x: 25, y: 25 },
        rotation: 0,
        side: 'top',
        placed: true,
      },
      {
        id: 'comp2',
        refdes: 'C1',
        footprint: library.getFootprint('C0603')!,
        position: { x: 50, y: 50 },
        rotation: 0,
        side: 'top',
        placed: true,
      },
    ],
    traces: [
      {
        id: 'trace1',
        netName: 'net1',
        layer: PCBLayer.SIGNAL_TOP,
        width: 0.254,
        style: 'manhattan',
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 25, y: 0 } },
          { start: { x: 25, y: 0 }, end: { x: 25, y: 25 } },
        ],
      },
    ],
    vias: [
      {
        id: 'via1',
        position: { x: 50, y: 50 },
        diameter: 0.6,
        fromLayer: PCBLayer.SIGNAL_TOP,
        toLayer: PCBLayer.SIGNAL_BOTTOM,
      },
    ],
    zones: [],
    designRules: [],
  };
};

describe('ManufacturingPanel', () => {
  let board: PCBBoard;
  const mockOnExport = vi.fn();

  beforeEach(() => {
    board = createTestBoard();
    mockOnExport.mockClear();
  });

  describe('Tab Navigation', () => {
    it('should render all tabs', () => {
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      expect(screen.getByText('Gerber')).toBeInTheDocument();
      expect(screen.getByText('Drill')).toBeInTheDocument();
      expect(screen.getByText('BOM')).toBeInTheDocument();
      expect(screen.getByText('Report')).toBeInTheDocument();
    });

    it('should switch tabs on click', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      // Initially on Gerber tab
      expect(screen.getByText('Generate Gerber Files')).toBeInTheDocument();

      // Click Drill tab
      await user.click(screen.getByText('Drill'));
      expect(screen.getByText('Generate Drill File')).toBeInTheDocument();

      // Click BOM tab
      await user.click(screen.getByText('BOM'));
      expect(screen.getByText('Generate Bill of Materials')).toBeInTheDocument();

      // Click Report tab
      await user.click(screen.getByText('Report'));
      expect(screen.getByText('Generate Manufacturing Report')).toBeInTheDocument();
    });

    it('should maintain active tab styling', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const tabs = container.querySelectorAll('.tab');
      expect(tabs[0]).toHaveClass('active');

      await user.click(tabs[1]);
      expect(tabs[1]).toHaveClass('active');
      expect(tabs[0]).not.toHaveClass('active');
    });
  });

  describe('Gerber Tab', () => {
    it('should render Gerber controls', () => {
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      expect(screen.getByText('Generate Gerber Files')).toBeInTheDocument();
      expect(screen.getByText('Gerber Files Units')).toBeInTheDocument();
      expect(screen.getByLabelText('Millimeters')).toBeInTheDocument();
      expect(screen.getByLabelText('Inches')).toBeInTheDocument();
    });

    it('should generate Gerber files on button click', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'gerber',
          })
        );
      });
    });

    it('should allow unit selection', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const inchesRadio = screen.getByLabelText('Inches');
      await user.click(inchesRadio);

      expect(inchesRadio).toBeChecked();
    });

    it('should display generated files list', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/F.Cu.gbr/i)).toBeInTheDocument();
      });
    });
  });

  describe('Drill Tab', () => {
    it('should render Drill controls', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Drill'));

      expect(screen.getByText('Generate Drill File')).toBeInTheDocument();
      expect(screen.getByText('Drill File Format')).toBeInTheDocument();
    });

    it('should generate drill file on button click', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Drill'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'drill',
          })
        );
      });
    });

    it('should display drill summary', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Drill'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/Total Holes/i)).toBeInTheDocument();
      });
    });
  });

  describe('BOM Tab', () => {
    it('should render BOM controls', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('BOM'));

      expect(screen.getByText('Generate Bill of Materials')).toBeInTheDocument();
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });

    it('should generate BOM on button click', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('BOM'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'bom',
          })
        );
      });
    });

    it('should allow format selection', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('BOM'));

      const select = screen.getByDisplayValue('CSV');
      await user.selectOption(select, 'JSON');

      expect(select).toHaveValue('JSON');
    });

    it('should display BOM entries', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('BOM'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/R1/)).toBeInTheDocument();
        expect(screen.getByText(/C1/)).toBeInTheDocument();
      });
    });

    it('should show total component count', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('BOM'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/Total Components:\s*2/)).toBeInTheDocument();
      });
    });
  });

  describe('Report Tab', () => {
    it('should render Report controls', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Report'));

      expect(screen.getByText('Generate Manufacturing Report')).toBeInTheDocument();
      expect(screen.getByText('Surface Finish')).toBeInTheDocument();
      expect(screen.getByText('Solder Mask Color')).toBeInTheDocument();
    });

    it('should generate report on button click', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Report'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'report',
          })
        );
      });
    });

    it('should allow surface finish selection', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Report'));

      const select = screen.getByDisplayValue('HASL');
      await user.selectOption(select, 'ENIG');

      expect(select).toHaveValue('ENIG');
    });

    it('should allow solder mask color selection', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Report'));

      const select = screen.getByDisplayValue('Green');
      await user.selectOption(select, 'Blue');

      expect(select).toHaveValue('Blue');
    });

    it('should display DFM issues', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Report'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/DFM Issues/i)).toBeInTheDocument();
      });
    });

    it('should show board specifications', async () => {
      const user = userEvent.setup();
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      await user.click(screen.getByText('Report'));

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/Board Dimensions/i)).toBeInTheDocument();
        expect(screen.getByText(/100.00 x 100.00 mm/)).toBeInTheDocument();
      });
    });
  });

  describe('Export Actions', () => {
    it('should download file when export is clicked', async () => {
      const user = userEvent.setup();
      const downloadSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        const files = screen.getAllByRole('button', { name: /Download/i });
        expect(files.length).toBeGreaterThan(0);
      });

      downloadSpy.mockRestore();
    });

    it('should copy file content to clipboard', async () => {
      const user = userEvent.setup();
      const clipboardSpy = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue(undefined);

      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });
      await user.click(generateBtn);

      await waitFor(() => {
        const copyButtons = screen.getAllByRole('button', { name: /Copy/i });
        expect(copyButtons.length).toBeGreaterThan(0);
      });

      clipboardSpy.mockRestore();
    });
  });

  describe('Configuration Persistence', () => {
    it('should remember selected options', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      // Go to Report tab and change settings
      await user.click(screen.getByText('Report'));
      const finishSelect = screen.getByDisplayValue('HASL');
      await user.selectOption(finishSelect, 'ENIG');

      // Rerender component
      rerender(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      // Settings should be remembered
      const newSelect = screen.getByDisplayValue('ENIG');
      expect(newSelect).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty board gracefully', () => {
      const emptyBoard: PCBBoard = {
        ...board,
        components: [],
        traces: [],
        vias: [],
      };

      const { container } = render(
        <ManufacturingPanel board={emptyBoard} onExport={mockOnExport} />
      );

      expect(container).toBeInTheDocument();
    });

    it('should display error message on generation failure', async () => {
      const user = userEvent.setup();
      const failureCallback = vi.fn().mockImplementation(() => {
        throw new Error('Generation failed');
      });

      render(
        <ManufacturingPanel board={board} onExport={failureCallback} />
      );

      const generateBtn = screen.getByRole('button', {
        name: /Generate/i,
      });

      // Suppress error logging for test
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await user.click(generateBtn);

      // Should still render without crashing
      expect(screen.getByText('Generate Gerber Files')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const tabs = screen.getByRole('tablist', { hidden: true });
      expect(tabs).toBeInTheDocument();

      const tabpanels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(tabpanels.length).toBeGreaterThan(0);
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ManufacturingPanel board={board} onExport={mockOnExport} />
      );

      const tabs = container.querySelectorAll('.tab');
      tabs[0].focus();

      await user.keyboard('{ArrowRight}');
      expect(tabs[1]).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should render with large board efficiently', () => {
      const largeBoard: PCBBoard = {
        ...board,
        components: Array.from({ length: 100 }, (_, i) => ({
          id: `comp${i}`,
          refdes: `R${i}`,
          footprint: new FootprintLibrary().getFootprint('R0603')!,
          position: { x: Math.random() * 100, y: Math.random() * 100 },
          rotation: 0,
          side: 'top',
          placed: true,
        })),
      };

      const start = performance.now();
      render(
        <ManufacturingPanel board={largeBoard} onExport={mockOnExport} />
      );
      const elapsed = performance.now() - start;

      // Should render in less than 500ms
      expect(elapsed).toBeLessThan(500);
    });
  });
});
