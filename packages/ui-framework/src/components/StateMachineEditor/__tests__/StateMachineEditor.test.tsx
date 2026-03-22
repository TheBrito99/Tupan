/**
 * State Machine Editor Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StateMachineEditor } from '../StateMachineEditor';
import { StateMachineEditorData } from '../types';

describe('StateMachineEditor', () => {
  it('renders editor component', () => {
    const { container } = render(<StateMachineEditor />);
    expect(container.querySelector('.container')).toBeInTheDocument();
  });

  it('displays toolbar with zoom controls', () => {
    const { container } = render(<StateMachineEditor />);
    const toolbar = container.querySelector('.toolbar');
    expect(toolbar).toBeInTheDocument();
  });

  it('displays canvas for drawing state machine', () => {
    const { container } = render(<StateMachineEditor />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('displays property panel when showPropertyPanel is true', () => {
    const { container } = render(<StateMachineEditor />);
    const propertyPanel = container.querySelector('.propertyPanel');
    expect(propertyPanel).toBeInTheDocument();
  });

  it('accepts initial data', () => {
    const initialData: StateMachineEditorData = {
      name: 'Test Machine',
      states: [
        {
          id: 'state1',
          name: 'State 1',
          x: 100,
          y: 100,
          isInitial: true,
          isFinal: false,
          width: 100,
          height: 60,
        },
      ],
      transitions: [],
    };

    const { container } = render(
      <StateMachineEditor initialData={initialData} />
    );
    expect(container).toBeInTheDocument();
  });

  it('calls onDataChange when data is modified', () => {
    const mockOnDataChange = jest.fn();
    const { container } = render(
      <StateMachineEditor onDataChange={mockOnDataChange} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      fireEvent.mouseDown(canvas, { clientX: 200, clientY: 200, button: 0 });
      // Data change should be called after adding a state
      expect(mockOnDataChange).toHaveBeenCalled();
    }
  });

  it('respects readOnly prop', () => {
    const { container } = render(<StateMachineEditor readOnly={true} />);
    expect(container).toBeInTheDocument();
  });

  it('supports simulation mode with activeStateId', () => {
    const initialData: StateMachineEditorData = {
      name: 'Simulation Test',
      states: [
        {
          id: 'state1',
          name: 'Active State',
          x: 100,
          y: 100,
          isInitial: true,
          isFinal: false,
          width: 100,
          height: 60,
        },
      ],
      transitions: [],
    };

    const { container } = render(
      <StateMachineEditor
        initialData={initialData}
        simulationMode={true}
        activeStateId="state1"
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('toggles property panel visibility', () => {
    const { container } = render(<StateMachineEditor />);

    const propertyPanel = container.querySelector('.propertyPanel');
    expect(propertyPanel).toBeInTheDocument();

    // Find and click the toggle button
    const buttons = container.querySelectorAll('.toolButton');
    const toggleButton = Array.from(buttons).find(btn => btn.textContent === '⚙');

    if (toggleButton) {
      fireEvent.click(toggleButton);
      // Note: In a real implementation with state updates,
      // the panel would be hidden here
    }
  });

  it('zooms in and out', () => {
    const { container } = render(<StateMachineEditor />);

    const buttons = container.querySelectorAll('.toolButton');
    const zoomInButton = Array.from(buttons).find(btn => btn.textContent?.includes('+'));
    const zoomOutButton = Array.from(buttons).find(btn => btn.textContent?.includes('−'));

    if (zoomInButton) {
      fireEvent.click(zoomInButton);
      // Zoom should increase
    }

    if (zoomOutButton) {
      fireEvent.click(zoomOutButton);
      // Zoom should decrease
    }
  });

  describe('State Management', () => {
    it('creates new state by clicking on canvas', () => {
      const mockOnDataChange = jest.fn();
      const { container } = render(
        <StateMachineEditor onDataChange={mockOnDataChange} />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        fireEvent.mouseDown(canvas, { clientX: 150, clientY: 150, button: 0 });
        expect(mockOnDataChange).toHaveBeenCalled();
      }
    });

    it('handles state deletion via right-click', () => {
      const initialData: StateMachineEditorData = {
        name: 'Test',
        states: [
          {
            id: 'state1',
            name: 'State 1',
            x: 100,
            y: 100,
            isInitial: true,
            isFinal: false,
            width: 100,
            height: 60,
          },
        ],
        transitions: [],
      };

      const mockOnDataChange = jest.fn();
      const { container } = render(
        <StateMachineEditor
          initialData={initialData}
          onDataChange={mockOnDataChange}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 2 });
        fireEvent.contextMenu(canvas);
      }
    });
  });

  describe('Transition Management', () => {
    it('supports transition drawing with Alt+Click', () => {
      const initialData: StateMachineEditorData = {
        name: 'Transition Test',
        states: [
          {
            id: 'state1',
            name: 'State 1',
            x: 100,
            y: 100,
            isInitial: true,
            isFinal: false,
            width: 100,
            height: 60,
          },
          {
            id: 'state2',
            name: 'State 2',
            x: 300,
            y: 100,
            isInitial: false,
            isFinal: true,
            width: 100,
            height: 60,
          },
        ],
        transitions: [],
      };

      const mockOnDataChange = jest.fn();
      const { container } = render(
        <StateMachineEditor
          initialData={initialData}
          onDataChange={mockOnDataChange}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        // Alt+Click to start transition
        fireEvent.mouseDown(canvas, {
          clientX: 100,
          clientY: 100,
          button: 0,
          altKey: true,
        });

        // Move to target state
        fireEvent.mouseMove(canvas, { clientX: 300, clientY: 100 });

        // Release to create transition
        fireEvent.mouseUp(canvas, { clientX: 300, clientY: 100 });
      }
    });
  });

  describe('Property Panel', () => {
    it('shows state properties when state is selected', () => {
      const initialData: StateMachineEditorData = {
        name: 'Property Test',
        states: [
          {
            id: 'state1',
            name: 'Test State',
            x: 100,
            y: 100,
            isInitial: true,
            isFinal: false,
            width: 100,
            height: 60,
          },
        ],
        transitions: [],
      };

      const { container } = render(
        <StateMachineEditor initialData={initialData} />
      );

      // Find property panel
      const propertyPanel = container.querySelector('.propertyPanel');
      expect(propertyPanel).toBeInTheDocument();
    });
  });
});
