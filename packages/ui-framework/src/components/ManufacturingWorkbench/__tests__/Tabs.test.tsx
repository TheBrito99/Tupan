/**
 * Tabs Component Tests
 * Phase 19 Task 6: CAM UI & Integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../Tabs';

describe('Tabs Component', () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tabs container', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    expect(screen.getByText(/Tab 1/i)).toBeInTheDocument();
  });

  it('displays only active tab content', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.getByText(/Content 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Content 2/i)).not.toBeInTheDocument();
  });

  it('switches tab when trigger clicked', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    const tab2Trigger = screen.getByText(/Tab 2/i);
    fireEvent.click(tab2Trigger);

    expect(mockOnValueChange).toHaveBeenCalledWith('tab2');
  });

  it('applies active class to selected trigger', () => {
    const { rerender } = render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    let tab1Trigger = screen.getByText(/Tab 1/i);
    expect(tab1Trigger).toHaveClass('active');

    // Rerender with tab2 active
    rerender(
      <Tabs value="tab2" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    let tab2Trigger = screen.getByText(/Tab 2/i);
    expect(tab2Trigger).toHaveClass('active');
  });

  it('handles multiple tabs', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          <TabsTrigger value="tab4">Tab 4</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
        <TabsContent value="tab4">Content 4</TabsContent>
      </Tabs>
    );

    expect(screen.getByText(/Tab 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Tab 4/i)).toBeInTheDocument();
  });

  it('maintains proper tab list structure', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);

    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('has proper tabpanel role on content', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const tabpanel = screen.getByRole('tabpanel');
    expect(tabpanel).toBeInTheDocument();
  });

  it('handles rapid tab switching', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );

    const tab1 = screen.getByText(/Tab 1/i);
    const tab2 = screen.getByText(/Tab 2/i);
    const tab3 = screen.getByText(/Tab 3/i);

    fireEvent.click(tab2);
    fireEvent.click(tab3);
    fireEvent.click(tab1);

    expect(mockOnValueChange).toHaveBeenCalledTimes(3);
  });

  it('works with custom content components', () => {
    const CustomContent = ({ children }: { children: React.ReactNode }) => (
      <div className="custom-wrapper">{children}</div>
    );

    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <CustomContent>Custom Content 1</CustomContent>
        </TabsContent>
        <TabsContent value="tab2">
          <CustomContent>Custom Content 2</CustomContent>
        </TabsContent>
      </Tabs>
    );

    expect(screen.getByText(/Custom Content 1/i)).toBeInTheDocument();
  });

  it('displays all triggers in list', () => {
    render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">First Tab</TabsTrigger>
          <TabsTrigger value="tab2">Second Tab</TabsTrigger>
          <TabsTrigger value="tab3">Third Tab</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );

    expect(screen.getByText(/First Tab/i)).toBeInTheDocument();
    expect(screen.getByText(/Second Tab/i)).toBeInTheDocument();
    expect(screen.getByText(/Third Tab/i)).toBeInTheDocument();
  });

  it('hides non-active tab content', () => {
    const { rerender } = render(
      <Tabs value="tab1" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.getByText(/Content 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Content 2/i)).not.toBeInTheDocument();

    // Change active tab
    rerender(
      <Tabs value="tab2" onValueChange={mockOnValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.queryByText(/Content 1/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Content 2/i)).toBeInTheDocument();
  });
});
