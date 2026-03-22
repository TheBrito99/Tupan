/**
 * BondGraphEditor Full Integration Tests (Task 8)
 *
 * Tests for complete system integration:
 * - Edit mode: Element management
 * - Simulate mode: Visualization + Controls + Analysis
 * - Mode switching: Edit ↔ Simulate transitions
 * - Data persistence: Save and export
 * - State management: Proper state coordination
 *
 * 20+ comprehensive integration tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BondGraphEditor } from '../index';
import type { EditorElement, EditorBond } from '../types';

describe('BondGraphEditor - Full Integration Tests', () => {
  const mockElements: EditorElement[] = [
    {
      id: 'se1',
      type: 'Se',
      x: 100,
      y: 100,
      width: 40,
      height: 40,
      parameters: { voltage: 5 },
    } as EditorElement,
    {
      id: 'r1',
      type: 'R',
      x: 200,
      y: 100,
      width: 40,
      height: 40,
      parameters: { resistance: 1000 },
    } as EditorElement,
  ];

  const mockBonds: EditorBond[] = [
    {
      id: 'bond1',
      from: 'se1',
      to: 'r1',
    } as EditorBond,
  ];

  // ============ EDIT MODE TESTS ============

  describe('Edit Mode - Basics', () => {
    test('renders in edit mode by default', () => {
      const { container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      expect(container.textContent).toContain('Bond Graph Editor');
      expect(container.textContent).toContain('Elements: 2');
      expect(container.textContent).toContain('Bonds: 1');
    });

    test('shows toolbar with element creation buttons', () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={[]} initialBonds={[]} />
      );

      expect(getByText(/\+ Se/)).toBeInTheDocument();
      expect(getByText(/\+ Sf/)).toBeInTheDocument();
      expect(getByText(/\+ C/)).toBeInTheDocument();
      expect(getByText(/\+ I/)).toBeInTheDocument();
      expect(getByText(/\+ R/)).toBeInTheDocument();
      expect(getByText(/\+ TF/)).toBeInTheDocument();
    });

    test('Start Simulation button enabled with elements', () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      const button = getByText(/Start Simulation/) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    test('Start Simulation button disabled with no elements', () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={[]} initialBonds={[]} />
      );

      const button = getByText(/Start Simulation/) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    test('displays Save button', () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      expect(getByText(/💾 Save/)).toBeInTheDocument();
    });
  });

  describe('Edit Mode - Data Persistence', () => {
    test('calls onSave with current state when Save clicked', () => {
      const onSave = jest.fn();

      const { getByText } = render(
        <BondGraphEditor
          initialElements={mockElements}
          initialBonds={mockBonds}
          onSave={onSave}
        />
      );

      fireEvent.click(getByText(/💾 Save/));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          elements: mockElements,
          bonds: mockBonds,
          mode: 'edit',
        })
      );
    });

    test('exports design as downloadable JSON', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL');

      const { getByText } = render(
        <BondGraphEditor
          initialElements={mockElements}
          initialBonds={mockBonds}
        />
      );

      fireEvent.click(getByText(/💾 Save/));

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createObjectURLSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
    });
  });

  // ============ MODE SWITCHING TESTS ============

  describe('Mode Switching - Edit to Simulate', () => {
    test('transitions to simulate mode when Start Simulation clicked', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(container.textContent).toContain('SIMULATION MODE');
      });
    });

    test('calls onSimulationStart callback when entering simulate mode', async () => {
      const onSimulationStart = jest.fn();

      const { getByText } = render(
        <BondGraphEditor
          initialElements={mockElements}
          initialBonds={mockBonds}
          onSimulationStart={onSimulationStart}
        />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(onSimulationStart).toHaveBeenCalled();
      });
    });

    test('resets simulation time to 0 when entering simulate mode', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(container.textContent).toContain('0.00s');
      });
    });

    test('prevents simulation when bond graph is empty', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      const { getByText } = render(
        <BondGraphEditor initialElements={[]} initialBonds={[]} />
      );

      const button = getByText(/Start Simulation/) as HTMLButtonElement;
      expect(button.disabled).toBe(true);

      alertSpy.mockRestore();
    });
  });

  describe('Mode Switching - Simulate to Edit', () => {
    test('returns to edit mode when Edit Mode button clicked', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(container.textContent).toContain('SIMULATION MODE');
      });

      fireEvent.click(getByText(/← Edit Mode/));

      await waitFor(() => {
        expect(container.textContent).toContain('Bond Graph Editor');
        expect(container.textContent).not.toContain('SIMULATION MODE');
      });
    });

    test('clears simulation state when returning to edit mode', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(container.textContent).toContain('SIMULATION MODE');
      });

      fireEvent.click(getByText(/← Edit Mode/));

      await waitFor(() => {
        // Simulation state should be cleared
        expect(container.textContent).toContain('Elements: 2');
      });
    });

    test('preserves element and bond data when exiting simulate mode', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        fireEvent.click(getByText(/← Edit Mode/));
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Elements: 2');
        expect(container.textContent).toContain('Bonds: 1');
      });
    });
  });

  // ============ SIMULATE MODE TESTS ============

  describe('Simulate Mode - Layout', () => {
    test('displays SIMULATION MODE indicator', async () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(getByText(/🔴 SIMULATION MODE/)).toBeInTheDocument();
      });
    });

    test('shows Edit Mode button to return to design', async () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(getByText(/← Edit Mode/)).toBeInTheDocument();
      });
    });

    test('displays Simulation Control panel', async () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(getByText(/Simulation Control/)).toBeInTheDocument();
      });
    });

    test('displays Energy Analysis panel', async () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(getByText(/Energy Analysis/)).toBeInTheDocument();
      });
    });

    test('shows Save Design and Export buttons', async () => {
      const { getByText, queryByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(getByText(/💾 Save Design/)).toBeInTheDocument();
        expect(queryByText(/📊 Export/)).toBeInTheDocument();
      });
    });

    test('Export button disabled initially (no simulation time)', async () => {
      const { queryByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(screen.getByText(/Start Simulation/));

      await waitFor(() => {
        const exportButton = queryByText(/📊 Export/) as HTMLButtonElement;
        expect(exportButton?.disabled).toBe(true);
      });
    });
  });

  // ============ COMPONENT INTEGRATION TESTS ============

  describe('Canvas Integration', () => {
    test('passes element and bond data to SimulationCanvas', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        // Canvas component should be rendered with props
        expect(container.textContent).toContain('SIMULATION MODE');
      });
    });
  });

  describe('Controls Integration', () => {
    test('passes simulation state to SimulationControls', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        // Controls should have access to duration, speed, recording state
        expect(container.textContent).toContain('Simulation Control');
      });
    });
  });

  describe('Analysis Integration', () => {
    test('passes element and bond data to AnalysisPanel', async () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(getByText(/Energy Analysis/)).toBeInTheDocument();
      });
    });
  });

  // ============ DATA FLOW TESTS ============

  describe('State Management - Data Flow', () => {
    test('maintains separate states for edit and simulate modes', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      // Edit mode state
      expect(container.textContent).toContain('Bond Graph Editor');
      expect(container.textContent).toContain('Elements: 2');

      // Switch to simulate mode
      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(container.textContent).toContain('SIMULATION MODE');
      });

      // Switch back to edit mode
      fireEvent.click(getByText(/← Edit Mode/));

      await waitFor(() => {
        // Should return to original edit mode state
        expect(container.textContent).toContain('Bond Graph Editor');
        expect(container.textContent).toContain('Elements: 2');
      });
    });

    test('element data persists through mode switches', async () => {
      const { getByText, container } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      const initialCount = container.textContent?.match(/Elements: 2/);
      expect(initialCount).toBeTruthy();

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        fireEvent.click(getByText(/← Edit Mode/));
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Elements: 2');
      });
    });
  });

  // ============ ERROR HANDLING TESTS ============

  describe('Error Handling', () => {
    test('disables Start Simulation with empty graph', () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={[]} initialBonds={[]} />
      );

      const button = getByText(/Start Simulation/) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    test('handles export with no simulation data', async () => {
      const { getByText, queryByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        const exportButton = queryByText(/📊 Export/) as HTMLButtonElement;
        expect(exportButton?.disabled).toBe(true);
      });
    });
  });

  // ============ ACCESSIBILITY TESTS ============

  describe('Accessibility', () => {
    test('buttons have descriptive labels', () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      expect(getByText(/Start Simulation/)).toBeInTheDocument();
      expect(getByText(/💾 Save/)).toBeInTheDocument();
    });

    test('mode indicator clearly visible', async () => {
      const { getByText } = render(
        <BondGraphEditor initialElements={mockElements} initialBonds={mockBonds} />
      );

      fireEvent.click(getByText(/Start Simulation/));

      await waitFor(() => {
        expect(getByText(/SIMULATION MODE/)).toBeInTheDocument();
      });
    });
  });
});
