/**
 * Canvas Interaction Hook
 *
 * Handles:
 * - Pan (right-click drag)
 * - Zoom (mouse wheel)
 * - Selection (left-click)
 * - Keyboard shortcuts
 */

import { useEffect, useRef, useState } from 'react';

export interface CanvasInteractionConfig {
  onPan?: (dx: number, dy: number) => void;
  onZoom?: (delta: number) => void;
  onDelete?: () => void;
  onEscape?: () => void;
  readOnly?: boolean;
}

export interface CanvasInteractionState {
  mousePos: { x: number; y: number } | null;
  isDragging: boolean;
  isRightClick: boolean;
}

export function useCanvasInteraction(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: CanvasInteractionConfig
): CanvasInteractionState {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRightClick, setIsRightClick] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Mouse down handler
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (e.button === 2) {
        // Right-click (pan)
        e.preventDefault();
        setIsRightClick(true);
        dragStartRef.current = { x, y };
        lastMousePosRef.current = { x, y };
        setIsDragging(true);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsRightClick(false);
      dragStartRef.current = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x, y });

      // Handle pan
      if (isDragging && dragStartRef.current && lastMousePosRef.current && isRightClick) {
        const dx = x - lastMousePosRef.current.x;
        const dy = y - lastMousePosRef.current.y;

        config.onPan?.(dx, dy);
        lastMousePosRef.current = { x, y };
      }
    };

    const handleMouseLeave = () => {
      setMousePos(null);
      setIsDragging(false);
      setIsRightClick(false);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleWheel = (e: WheelEvent) => {
      if (!canvasRef.current?.contains(e.target as Node)) return;

      e.preventDefault();

      // Scroll up = zoom in (negative delta), scroll down = zoom out (positive delta)
      const delta = e.deltaY > 0 ? 1 : -1;
      config.onZoom?.(delta);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        config.onDelete?.();
      } else if (e.key === 'Escape') {
        config.onEscape?.();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('contextmenu', handleContextMenu);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('contextmenu', handleContextMenu);
        canvas.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isDragging, isRightClick, config, canvasRef]);

  return {
    mousePos,
    isDragging,
    isRightClick,
  };
}
