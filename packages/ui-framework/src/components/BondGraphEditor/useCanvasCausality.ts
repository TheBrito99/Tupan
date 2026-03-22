/**
 * Canvas Causality Hook
 *
 * React hook for integrating causality visualization into the Canvas component.
 * Manages rendering of causality strokes, animations, and highlights.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { EditorElement, EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';
import { CausalityVisualizationRenderer, CausalityCanvasRenderer } from './causalityVisualization';

interface UseCanvasCausalityOptions {
  canvas: HTMLCanvasElement | null;
  elements: EditorElement[];
  bonds: EditorBond[];
  causalities: Map<string, CausalityStatus>;
  criticalPaths?: string[][];
  conflictingBonds?: string[];
  enabled?: boolean;
  showTooltips?: boolean;
  animateAssignment?: boolean;
  highlightConflicts?: boolean;
  highlightCriticalPaths?: boolean;
}

export const useCanvasCausality = (options: UseCanvasCausalityOptions) => {
  const rendererRef = useRef<CausalityVisualizationRenderer | null>(null);
  const animationRef = useRef<number | null>(null);

  // Initialize renderer
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new CausalityVisualizationRenderer();
    }
  }, []);

  // Generate visualizations from causalities
  useEffect(() => {
    if (!rendererRef.current || !options.enabled) return;

    const renderer = rendererRef.current;

    // Generate visualization for each bond
    for (const bond of options.bonds) {
      const status = options.causalities.get(bond.id) || 'Unassigned';
      const isCritical = options.criticalPaths?.some((path) => path.includes(bond.id)) ?? false;
      const isConflict = options.conflictingBonds?.includes(bond.id) ?? false;

      renderer.generateVisualization(bond.id, status, {
        isCritical: isCritical && options.highlightCriticalPaths,
        isConflict: isConflict && options.highlightConflicts,
        isAnimating: options.animateAssignment,
      });
    }

    // Highlight conflicts if needed
    if (options.highlightConflicts && options.conflictingBonds) {
      renderer.highlightConflicts(options.conflictingBonds);
    }

    // Highlight critical paths if needed
    if (options.highlightCriticalPaths && options.criticalPaths) {
      const allCriticalBonds = options.criticalPaths.flat();
      renderer.highlightCriticalPath(allCriticalBonds);
    }
  }, [
    options.bonds,
    options.causalities,
    options.criticalPaths,
    options.conflictingBonds,
    options.enabled,
    options.highlightConflicts,
    options.highlightCriticalPaths,
    options.animateAssignment,
  ]);

  // Render to canvas
  const renderToCanvas = useCallback(() => {
    if (!options.canvas || !rendererRef.current || !options.enabled) return;

    const ctx = options.canvas.getContext('2d');
    if (!ctx) return;

    const renderer = rendererRef.current;
    const visualizations = renderer.getVisualizations();

    // Draw each bond with its visualization
    for (const bond of options.bonds) {
      const viz = visualizations.find((v) => v.bondId === bond.id);
      if (!viz) continue;

      const fromElement = options.elements.find((e) => e.id === bond.from);
      const toElement = options.elements.find((e) => e.id === bond.to);

      if (!fromElement || !toElement) continue;

      // Draw the bond with causality visualization
      CausalityCanvasRenderer.drawBondWithCausality(
        ctx,
        bond,
        { x: fromElement.x, y: fromElement.y },
        { x: toElement.x, y: toElement.y },
        viz
      );
    }
  }, [options.canvas, options.bonds, options.elements, options.enabled]);

  // Set up animation loop
  useEffect(() => {
    if (!options.enabled || !options.animateAssignment) return;

    const animate = () => {
      renderToCanvas();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [renderToCanvas, options.enabled, options.animateAssignment]);

  // Render on non-animated frame
  useEffect(() => {
    if (options.animateAssignment) return; // Animation loop handles rendering

    renderToCanvas();
  }, [renderToCanvas, options.animateAssignment]);

  // Start animation for step-by-step
  const startStepAnimation = useCallback((bondIds: string[], animationType: 'pulse' | 'flow' | 'fade' = 'pulse') => {
    if (!rendererRef.current) return;

    rendererRef.current.startAnimation(bondIds, animationType);

    // Schedule re-render
    const animate = () => {
      renderToCanvas();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [renderToCanvas]);

  // Stop animation
  const stopAnimation = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.stopAnimation();
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    renderToCanvas();
  }, [renderToCanvas]);

  // Clear highlights
  const clearHighlights = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.clearHighlights();
    }

    renderToCanvas();
  }, [renderToCanvas]);

  // Reset all
  const reset = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.reset();
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    renderToCanvas();
  }, [renderToCanvas]);

  return {
    startStepAnimation,
    stopAnimation,
    clearHighlights,
    reset,
    renderToCanvas,
  };
};
