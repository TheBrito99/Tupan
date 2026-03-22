/**
 * Bond Graph Simulation Canvas
 *
 * Real-time visualization of bond graph simulations:
 * - Power flow with directional arrows
 * - Bond intensity based on power magnitude
 * - Real-time element values (voltage, temperature, force, etc.)
 * - Energy conservation display
 * - Performance metrics overlay
 *
 * Architecture:
 * - Receives SimulationSnapshot from SimulationEngine
 * - Receives PerformanceMetrics for overlay display
 * - Renders 60 FPS using requestAnimationFrame
 * - Pan/zoom support for large graphs
 */

import React, { forwardRef, useEffect, useCallback } from 'react';
import type { EditorElement, EditorBond } from './types';
import type { SimulationSnapshot, PerformanceMetrics } from '@tupan/core-ts/wasm-bridge';
import styles from './BondGraphEditor.module.css';

export interface SimulationCanvasProps {
  elements: EditorElement[];
  bonds: EditorBond[];
  simulationData?: SimulationSnapshot;
  performanceMetrics?: PerformanceMetrics;
  elementValues: Map<string, number>;  // Current element values (voltage, temperature, etc.)
  bondPowers: Map<string, number>;      // Power on each bond (effort × flow)
  isRunning: boolean;
  onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
}

interface CanvasState {
  panX: number;
  panY: number;
  zoom: number;
  isDragging: boolean;
  lastMouseX: number;
  lastMouseY: number;
}

export const SimulationCanvas = forwardRef<HTMLCanvasElement, SimulationCanvasProps>(
  ({
    elements,
    bonds,
    simulationData,
    performanceMetrics,
    elementValues,
    bondPowers,
    isRunning,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onWheel,
  }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [canvasState, setCanvasState] = React.useState<CanvasState>({
      panX: 0,
      panY: 0,
      zoom: 1,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
    });
    const animationFrameRef = React.useRef<number>();

    React.useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    // Main render loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const render = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Clear canvas
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        drawGrid(ctx, canvas.width, canvas.height, canvasState.panX, canvasState.panY, canvasState.zoom);

        // Save context for transformations
        ctx.save();
        ctx.translate(canvasState.panX, canvasState.panY);
        ctx.scale(canvasState.zoom, canvasState.zoom);

        // Draw bonds first (behind elements)
        bonds.forEach((bond) => {
          const fromElem = elements.find((e) => e.id === bond.from);
          const toElem = elements.find((e) => e.id === bond.to);

          if (fromElem && toElem) {
            const power = bondPowers.get(bond.id) ?? 0;
            drawBond(ctx, fromElem, toElem, bond, power, isRunning);
          }
        });

        // Draw elements with their current values
        elements.forEach((element) => {
          const value = elementValues.get(element.id);
          drawElement(ctx, element, value, isRunning);
        });

        ctx.restore();

        // Draw overlay (metrics, simulation info)
        if (performanceMetrics) {
          drawMetricsOverlay(ctx, performanceMetrics, isRunning, simulationData);
        }

        animationFrameRef.current = requestAnimationFrame(render);
      };

      animationFrameRef.current = requestAnimationFrame(render);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [elements, bonds, elementValues, bondPowers, canvasState, performanceMetrics, isRunning, simulationData]);

    // Mouse event handlers
    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setCanvasState((prev) => ({
          ...prev,
          isDragging: e.button === 1, // Middle mouse button
          lastMouseX: e.clientX,
          lastMouseY: e.clientY,
        }));

        onMouseDown?.(e);
      },
      [onMouseDown]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (canvasState.isDragging) {
          const deltaX = e.clientX - canvasState.lastMouseX;
          const deltaY = e.clientY - canvasState.lastMouseY;

          setCanvasState((prev) => ({
            ...prev,
            panX: prev.panX + deltaX,
            panY: prev.panY + deltaY,
            lastMouseX: e.clientX,
            lastMouseY: e.clientY,
          }));
        }

        onMouseMove?.(e);
      },
      [canvasState.isDragging, canvasState.lastMouseX, canvasState.lastMouseY, onMouseMove]
    );

    const handleMouseUp = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        setCanvasState((prev) => ({
          ...prev,
          isDragging: false,
        }));

        onMouseUp?.(e);
      },
      [onMouseUp]
    );

    const handleWheel = useCallback(
      (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        const zoomFactor = 1.1;
        const newZoom = e.deltaY > 0 ? canvasState.zoom / zoomFactor : canvasState.zoom * zoomFactor;

        setCanvasState((prev) => ({
          ...prev,
          zoom: Math.max(0.1, Math.min(5, newZoom)),
        }));

        onWheel?.(e);
      },
      [canvasState.zoom, onWheel]
    );

    return (
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: canvasState.isDragging ? 'grabbing' : 'grab' }}
      />
    );
  }
);

SimulationCanvas.displayName = 'SimulationCanvas';

// Helper functions

/**
 * Draw grid background with perspective
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  panX: number,
  panY: number,
  zoom: number
) {
  const gridSize = 20;
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;

  const startX = Math.floor(-panX / zoom / gridSize) * gridSize;
  const startY = Math.floor(-panY / zoom / gridSize) * gridSize;
  const endX = startX + width / zoom + gridSize;
  const endY = startY + height / zoom + gridSize;

  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

/**
 * Draw a bond with power flow visualization
 *
 * Power visualization:
 * - Thickness: Proportional to |power|
 * - Color: Green for positive power (energy leaving), Red for negative (energy entering)
 * - Direction: Arrowheads indicate flow direction
 */
function drawBond(
  ctx: CanvasRenderingContext2D,
  fromElem: EditorElement,
  toElem: EditorElement,
  bond: EditorBond,
  power: number,
  isRunning: boolean
) {
  const startX = fromElem.x;
  const startY = fromElem.y;
  const endX = toElem.x;
  const endY = toElem.y;

  // Normalize power for visualization (0-1 scale)
  const maxPower = 100; // W (adjust based on typical values)
  const powerMagnitude = Math.min(Math.abs(power) / maxPower, 1);
  const baseLineWidth = 2;
  const lineWidth = baseLineWidth + powerMagnitude * 3;

  // Color based on power direction
  if (power > 0.1) {
    ctx.strokeStyle = `rgba(76, 175, 80, ${0.4 + powerMagnitude * 0.6})`;
  } else if (power < -0.1) {
    ctx.strokeStyle = `rgba(244, 67, 54, ${0.4 + powerMagnitude * 0.6})`;
  } else {
    ctx.strokeStyle = '#999';
  }

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw bond line
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Draw causality stroke (perpendicular bar)
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const perpX = (-dy / length) * 8;
  const perpY = (dx / length) * 8;

  ctx.strokeStyle = isRunning ? '#666' : '#999';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(midX - perpX, midY - perpY);
  ctx.lineTo(midX + perpX, midY + perpY);
  ctx.stroke();

  // Draw arrowhead for power flow direction
  if (Math.abs(power) > 0.1) {
    const arrowSize = 10;
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowX = endX - arrowSize * 1.5 * Math.cos(angle);
    const arrowY = endY - arrowSize * 1.5 * Math.sin(angle);

    ctx.fillStyle = power > 0 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)';
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
      arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
      arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  // Label power on bond
  if (Math.abs(power) > 1 && isRunning) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const powerLabel = Math.abs(power) > 10
      ? `${power.toFixed(1)}W`
      : `${power.toFixed(2)}W`;
    ctx.fillText(powerLabel, midX + perpX * 1.5, midY + perpY * 1.5);
  }
}

/**
 * Draw bond graph element with current value
 *
 * Elements:
 * - Se/Sf: Circle (source)
 * - C/I: Rectangle (storage)
 * - R: Zigzag (dissipation)
 * - TF/GY: Rectangle (transformer/gyrator)
 * - Junction0/1: Small circle (junction)
 */
function drawElement(
  ctx: CanvasRenderingContext2D,
  element: EditorElement,
  value: number | undefined,
  isRunning: boolean
) {
  const x = element.x;
  const y = element.y;
  const size = 40;

  ctx.save();

  // Determine colors
  const baseColor = getElementColor(element.type);
  const fillColor = isRunning ? baseColor : '#f5f5f5';
  const strokeColor = isRunning ? '#333' : '#999';

  switch (element.type) {
    case 'Se':
    case 'Sf':
      // Circle for sources
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      break;

    case 'C':
    case 'I':
      // Rectangle for storage
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      break;

    case 'R':
      // Zigzag for resistor
      drawZigzag(ctx, x - size / 2, y, size, fillColor, strokeColor);
      break;

    case 'TF':
    case 'GY':
      // Rectangle for transformer/gyrator
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.fillRect(x - size / 2.5, y - size / 3, size / 1.25, size / 1.5);
      ctx.strokeRect(x - size / 2.5, y - size / 3, size / 1.25, size / 1.5);
      break;

    case 'Junction0':
    case 'Junction1':
      // Small circle for junctions
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      break;
  }

  // Draw element label
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = element.type === 'Junction0' ? '0' : element.type === 'Junction1' ? '1' : element.type;
  ctx.fillText(label, x, y - size / 2 - 12);

  // Draw value below element
  if (value !== undefined && isRunning) {
    ctx.fillStyle = '#0066cc';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const valueLabel = Math.abs(value) > 100
      ? `${(value / 1000).toFixed(2)}k`
      : Math.abs(value) > 0.001
        ? `${value.toFixed(3)}`
        : `${value.toExponential(1)}`;
    ctx.fillText(valueLabel, x, y + size / 2 + 5);
  }

  ctx.restore();
}

/**
 * Draw zigzag pattern for resistor
 */
function drawZigzag(
  ctx: CanvasRenderingContext2D,
  startX: number,
  centerY: number,
  width: number,
  fillColor: string,
  strokeColor: string
) {
  const zigzagHeight = 15;
  const zigCount = 3;
  const zigWidth = width / (zigCount * 2);

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, centerY);

  for (let i = 0; i < zigCount * 2; i++) {
    const x = startX + (i + 1) * zigWidth;
    const y = centerY + (i % 2 === 0 ? -zigzagHeight : zigzagHeight);
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

/**
 * Get element color based on type
 */
function getElementColor(elementType: string): string {
  switch (elementType) {
    case 'Se':
      return '#e3f2fd'; // Light blue
    case 'Sf':
      return '#f3e5f5'; // Light purple
    case 'C':
      return '#fff3e0'; // Light orange
    case 'I':
      return '#e8f5e9'; // Light green
    case 'R':
      return '#fce4ec'; // Light pink
    case 'TF':
      return '#f1f8e9'; // Light lime
    case 'GY':
      return '#ede7f6'; // Light indigo
    case 'Junction0':
    case 'Junction1':
      return '#e0e0e0'; // Light gray
    default:
      return '#ffffff';
  }
}

/**
 * Draw performance metrics overlay
 */
function drawMetricsOverlay(
  ctx: CanvasRenderingContext2D,
  metrics: PerformanceMetrics,
  isRunning: boolean,
  simulationData?: SimulationSnapshot
) {
  const padding = 15;
  const lineHeight = 18;
  const x = padding;
  let y = padding;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(5, 5, 300, 200);

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(5, 5, 300, 200);

  ctx.fillStyle = '#333';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Title
  ctx.fillText('Simulation Metrics', x, y);
  y += lineHeight + 5;

  // Status
  ctx.font = '11px Arial';
  ctx.fillStyle = isRunning ? '#4CAF50' : '#999';
  ctx.fillText(`Status: ${isRunning ? 'Running' : 'Paused'}`, x, y);
  y += lineHeight;

  // Time
  if (simulationData) {
    ctx.fillStyle = '#333';
    ctx.fillText(`Time: ${simulationData.time.toFixed(3)}s`, x, y);
    y += lineHeight;
  }

  // FPS
  ctx.fillStyle = metrics.fps > 55 ? '#4CAF50' : metrics.fps > 30 ? '#ff9800' : '#f44336';
  ctx.fillText(`FPS: ${metrics.fps.toFixed(1)}`, x, y);
  y += lineHeight;

  // Steps/sec
  ctx.fillStyle = '#333';
  ctx.fillText(`Steps/s: ${metrics.stepsPerSecond.toFixed(0)}`, x, y);
  y += lineHeight;

  // CPU Load
  ctx.fillStyle = metrics.cpuLoad > 80 ? '#f44336' : metrics.cpuLoad > 60 ? '#ff9800' : '#4CAF50';
  ctx.fillText(`CPU: ${metrics.cpuLoad.toFixed(1)}%`, x, y);
  y += lineHeight;

  // Error
  ctx.fillStyle = '#333';
  ctx.fillText(`Error: ${metrics.maxError.toExponential(2)}`, x, y);
  y += lineHeight;

  // Step time
  ctx.fillText(`Step: ${metrics.averageStepTime.toFixed(3)}ms`, x, y);
}
