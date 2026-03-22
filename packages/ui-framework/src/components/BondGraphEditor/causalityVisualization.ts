/**
 * Canvas Causality Visualization
 *
 * Renders causality information directly on bonds:
 * - Color-coded bond strokes by causality status
 * - Causality stroke (perpendicular bar) indicators
 * - Highlighting for critical paths and conflicts
 * - Animation for step-by-step walkthrough
 * - Interactive selection and tooltips
 */

import type { EditorBond } from './types';
import type { CausalityStatus } from './causalityAnalysis';

/**
 * Causality visualization style for a single bond
 */
export interface BondVisualization {
  bondId: string;
  strokeColor: string;         // Color of bond line
  strokeWidth: number;         // 1-4 pixels
  strokeDash: number[];        // [] for solid, [5,5] for dashed
  causalityStroke: {
    position: 'from' | 'to' | 'both' | 'none';
    color: string;
    length: number;             // pixels
    thickness: number;          // pixels
  };
  highlight: {
    enabled: boolean;
    color: string;              // Glow/highlight color
    width: number;              // Extra stroke width
    opacity: number;            // 0-1
  };
  animation: {
    enabled: boolean;
    type: 'none' | 'pulse' | 'flow' | 'fade';
    speed: number;              // Duration in ms
    intensity: number;          // 0-1
  };
  tooltip: {
    text: string;
    position: 'near_from' | 'center' | 'near_to';
  };
}

/**
 * Color palette for causality visualization
 */
export const CAUSALITY_COLORS = {
  EffortOut: '#2196F3',        // Blue - effort driven
  FlowOut: '#4CAF50',          // Green - flow driven
  EffortIn: '#81C784',         // Light Green - effort input
  FlowIn: '#64B5F6',           // Light Blue - flow input
  Unassigned: '#CCCCCC',       // Gray - not yet assigned
  Conflict: '#f44336',         // Red - causality conflict
  Derivative: '#FF9800',       // Orange - requires derivative
  CriticalPath: '#FFD700',     // Gold - important path
  Neutral: '#757575',          // Dark Gray - default
};

/**
 * Causality Visualization Renderer
 */
export class CausalityVisualizationRenderer {
  private bondVisualizations: Map<string, BondVisualization> = new Map();
  private animationFrameId: number | null = null;
  private startTime: number = 0;

  /**
   * Generate visualization for a bond based on causality
   */
  public generateVisualization(
    bondId: string,
    status: CausalityStatus,
    options: {
      isCritical?: boolean;
      isConflict?: boolean;
      isAnimating?: boolean;
      animationType?: 'pulse' | 'flow' | 'fade';
    } = {}
  ): BondVisualization {
    const { isCritical = false, isConflict = false, isAnimating = false, animationType = 'pulse' } =
      options;

    // Determine stroke color based on status
    let strokeColor = CAUSALITY_COLORS[status] || CAUSALITY_COLORS.Neutral;
    if (isConflict) strokeColor = CAUSALITY_COLORS.Conflict;
    if (isCritical) strokeColor = CAUSALITY_COLORS.CriticalPath;

    // Causality stroke (perpendicular bar) position
    const causalityStrokePosition = this.getStrokePosition(status);

    const visualization: BondVisualization = {
      bondId,
      strokeColor,
      strokeWidth: isCritical ? 3 : 2,
      strokeDash: status === 'Unassigned' ? [5, 5] : [],
      causalityStroke: {
        position: causalityStrokePosition,
        color: strokeColor,
        length: 12,
        thickness: 2,
      },
      highlight: {
        enabled: isCritical || isConflict,
        color: isCritical ? CAUSALITY_COLORS.CriticalPath : CAUSALITY_COLORS.Conflict,
        width: 4,
        opacity: 0.3,
      },
      animation: {
        enabled: isAnimating,
        type: animationType,
        speed: 1000,
        intensity: 1.0,
      },
      tooltip: {
        text: this.getTooltipText(status, isCritical, isConflict),
        position: 'center',
      },
    };

    this.bondVisualizations.set(bondId, visualization);
    return visualization;
  }

  /**
   * Get causality stroke position for a bond
   *
   * EffortOut: perpendicular bar at "from" end (element drives effort)
   * FlowOut: perpendicular bar at "to" end (element drives flow)
   * EffortIn: bar at "to" end (element receives effort)
   * FlowIn: bar at "from" end (element receives flow)
   * Unassigned: no bar
   */
  private getStrokePosition(status: CausalityStatus): 'from' | 'to' | 'both' | 'none' {
    const positions: Record<CausalityStatus, 'from' | 'to' | 'both' | 'none'> = {
      EffortOut: 'from',
      FlowOut: 'to',
      EffortIn: 'to',
      FlowIn: 'from',
      Unassigned: 'none',
      Conflict: 'both',
      Derivative: 'both',
    };
    return positions[status] || 'none';
  }

  /**
   * Get tooltip text for a bond
   */
  private getTooltipText(
    status: CausalityStatus,
    isCritical: boolean,
    isConflict: boolean
  ): string {
    let text = `Causality: ${status}`;

    if (isCritical) {
      text += ' (critical path)';
    }

    if (isConflict) {
      text += ' ⚠️ Conflict';
    }

    return text;
  }

  /**
   * Get all visualizations
   */
  public getVisualizations(): BondVisualization[] {
    return Array.from(this.bondVisualizations.values());
  }

  /**
   * Update visualization for multiple bonds
   */
  public updateVisualizations(updates: Array<{ bondId: string; status: CausalityStatus }>) {
    for (const { bondId, status } of updates) {
      this.generateVisualization(bondId, status);
    }
  }

  /**
   * Highlight bonds on a critical path
   */
  public highlightCriticalPath(bondIds: string[]) {
    for (const bondId of bondIds) {
      const existing = this.bondVisualizations.get(bondId);
      if (existing) {
        existing.highlight.enabled = true;
        existing.highlight.color = CAUSALITY_COLORS.CriticalPath;
      }
    }
  }

  /**
   * Highlight conflicting bonds
   */
  public highlightConflicts(bondIds: string[]) {
    for (const bondId of bondIds) {
      const existing = this.bondVisualizations.get(bondId);
      if (existing) {
        existing.highlight.enabled = true;
        existing.highlight.color = CAUSALITY_COLORS.Conflict;
      }
    }
  }

  /**
   * Clear all highlights
   */
  public clearHighlights() {
    for (const viz of this.bondVisualizations.values()) {
      viz.highlight.enabled = false;
    }
  }

  /**
   * Start animation for step-by-step visualization
   */
  public startAnimation(bondIds: string[], animationType: 'pulse' | 'flow' | 'fade' = 'pulse') {
    this.startTime = Date.now();

    for (const bondId of bondIds) {
      const existing = this.bondVisualizations.get(bondId);
      if (existing) {
        existing.animation.enabled = true;
        existing.animation.type = animationType;
      }
    }

    this.animateFrame();
  }

  /**
   * Stop all animations
   */
  public stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    for (const viz of this.bondVisualizations.values()) {
      viz.animation.enabled = false;
    }
  }

  /**
   * Animation frame update
   */
  private animateFrame() {
    const elapsed = Date.now() - this.startTime;

    // Update animation parameters based on type
    for (const viz of this.bondVisualizations.values()) {
      if (!viz.animation.enabled) continue;

      const progress = (elapsed % viz.animation.speed) / viz.animation.speed;

      switch (viz.animation.type) {
        case 'pulse':
          // Opacity pulses from 0.5 to 1.0
          viz.highlight.opacity = 0.5 + 0.5 * Math.abs(Math.sin(progress * Math.PI));
          break;

        case 'flow':
          // Dash offset creates flowing effect
          viz.strokeDash = [progress * 10, (1 - progress) * 10];
          break;

        case 'fade':
          // Opacity transitions
          viz.highlight.opacity = progress < 0.5 ? progress : 1 - progress;
          break;
      }
    }

    // Continue animation if any bonds still animating
    const anyAnimating = Array.from(this.bondVisualizations.values()).some((v) => v.animation.enabled);

    if (anyAnimating) {
      this.animationFrameId = requestAnimationFrame(() => this.animateFrame());
    }
  }

  /**
   * Reset all visualizations
   */
  public reset() {
    this.stopAnimation();
    this.bondVisualizations.clear();
  }
}

/**
 * Canvas drawing functions for causality visualization
 */
export class CausalityCanvasRenderer {
  /**
   * Draw a bond with causality visualization
   */
  public static drawBond(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    visualization: BondVisualization
  ) {
    // Draw highlight glow if enabled
    if (visualization.highlight.enabled) {
      this.drawGlow(ctx, fromX, fromY, toX, toY, visualization.highlight);
    }

    // Draw main bond line
    ctx.strokeStyle = visualization.strokeColor;
    ctx.lineWidth = visualization.strokeWidth;

    if (visualization.strokeDash.length > 0) {
      ctx.setLineDash(visualization.strokeDash);
    }

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Draw causality strokes
    this.drawCausalityStrokes(ctx, fromX, fromY, toX, toY, visualization.causalityStroke);

    // Draw tooltip if needed
    if (visualization.tooltip.text) {
      this.drawTooltip(ctx, fromX, fromY, toX, toY, visualization.tooltip);
    }
  }

  /**
   * Draw glow effect around bond
   */
  private static drawGlow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    highlight: BondVisualization['highlight']
  ) {
    ctx.strokeStyle = highlight.color;
    ctx.globalAlpha = highlight.opacity;
    ctx.lineWidth = highlight.width;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  }

  /**
   * Draw perpendicular causality stroke(s)
   */
  private static drawCausalityStrokes(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    stroke: BondVisualization['causalityStroke']
  ) {
    if (stroke.position === 'none') return;

    // Direction of bond
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return;

    // Unit direction vector
    const ux = dx / length;
    const uy = dy / length;

    // Perpendicular vector
    const px = -uy;
    const py = ux;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.thickness;

    // Draw stroke(s)
    const positions =
      stroke.position === 'from'
        ? [{ x: fromX, y: fromY }]
        : stroke.position === 'to'
          ? [{ x: toX, y: toY }]
          : [
              { x: fromX, y: fromY },
              { x: toX, y: toY },
            ];

    for (const pos of positions) {
      // Perpendicular line at position
      const sx = stroke.length / 2;
      ctx.beginPath();
      ctx.moveTo(pos.x - px * sx, pos.y - py * sx);
      ctx.lineTo(pos.x + px * sx, pos.y + py * sx);
      ctx.stroke();
    }
  }

  /**
   * Draw tooltip text
   */
  private static drawTooltip(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    tooltip: BondVisualization['tooltip']
  ) {
    // Position for tooltip
    let tipX = fromX;
    let tipY = fromY;

    if (tooltip.position === 'center') {
      tipX = (fromX + toX) / 2;
      tipY = (fromY + toY) / 2;
    } else if (tooltip.position === 'near_to') {
      tipX = toX * 0.7 + fromX * 0.3;
      tipY = toY * 0.7 + fromY * 0.3;
    }

    // Draw tooltip background
    ctx.font = '10px monospace';
    const metrics = ctx.measureText(tooltip.text);
    const textWidth = metrics.width;
    const textHeight = 12;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(tipX - textWidth / 2 - 4, tipY - 8 - 4, textWidth + 8, textHeight + 8);

    // Draw tooltip text
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(tooltip.text, tipX, tipY);

    ctx.textAlign = 'left';
  }

  /**
   * Draw bond with all causality information
   */
  public static drawBondWithCausality(
    ctx: CanvasRenderingContext2D,
    bond: EditorBond,
    fromElement: { x: number; y: number; radius?: number },
    toElement: { x: number; y: number; radius?: number },
    visualization: BondVisualization
  ) {
    // Calculate bond endpoints (from element boundary to to element boundary)
    const radius = 25; // Default element radius
    const fromRadius = fromElement.radius || radius;
    const toRadius = toElement.radius || radius;

    // Direction vector
    const dx = toElement.x - fromElement.x;
    const dy = toElement.y - fromElement.y;
    const bondLength = Math.sqrt(dx * dx + dy * dy);

    if (bondLength === 0) return;

    const ux = dx / bondLength;
    const uy = dy / bondLength;

    const fromX = fromElement.x + ux * fromRadius;
    const fromY = fromElement.y + uy * fromRadius;
    const toX = toElement.x - ux * toRadius;
    const toY = toElement.y - uy * toRadius;

    this.drawBond(ctx, fromX, fromY, toX, toY, visualization);
  }
}
