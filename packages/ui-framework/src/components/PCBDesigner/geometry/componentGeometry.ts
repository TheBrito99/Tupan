/**
 * PCB Component Geometry Builder
 * Phase 15: 3D Visualization
 *
 * Generates Plotly mesh3d geometry for placed components
 * - Simplified box geometry (MVP)
 * - Position, rotation, and side transformation
 * - Color coding by component type
 */

import { PlacedComponent, Footprint } from '../types';

/**
 * Component type color coding
 */
export const ComponentColors: Record<string, string> = {
  resistor: '#d4a574',         // Tan
  capacitor: '#4682b4',        // Blue
  inductor: '#9370db',         // Purple
  diode: '#dc143c',            // Red
  transistor: '#ff6347',       // Orange-red
  ic: '#1a1a1a',               // Black
  connector: '#228b22',        // Forest green
  switch: '#ffa500',           // Orange
  other: '#888888',            // Gray
} as const;

/**
 * Estimated component heights (mm) based on package type
 */
const COMPONENT_HEIGHTS: Record<string, number> = {
  'R0603': 0.5,
  'C0603': 0.5,
  'L0603': 0.5,
  'SOT23': 1.0,
  'SOT223': 1.5,
  'SOD123': 0.9,
  'SOIC8': 1.5,
  'SOIC16': 2.0,
  'QFP32': 2.5,
  'QFP64': 3.0,
  'BGA144': 2.0,
  'DIP8': 2.5,
  'DIP16': 2.5,
  'DIP40': 5.0,
} as const;

/**
 * Get component height from footprint name
 */
function getComponentHeight(footprintName: string): number {
  // Try exact match first
  if (COMPONENT_HEIGHTS[footprintName]) {
    return COMPONENT_HEIGHTS[footprintName];
  }

  // Try to infer from package type
  if (footprintName.includes('0603')) return 0.5;
  if (footprintName.includes('0805')) return 0.6;
  if (footprintName.includes('1206')) return 0.8;
  if (footprintName.includes('SOT')) return 1.0;
  if (footprintName.includes('SOIC')) return 1.5;
  if (footprintName.includes('QFP')) return 2.5;
  if (footprintName.includes('BGA')) return 2.0;
  if (footprintName.includes('DIP')) return 2.5;

  return 1.0; // Default height
}

/**
 * Get component color from reference designator
 */
function getComponentColor(refdes: string): string {
  const prefix = refdes.charAt(0).toUpperCase();

  switch (prefix) {
    case 'R': return ComponentColors.resistor;
    case 'C': return ComponentColors.capacitor;
    case 'L': return ComponentColors.inductor;
    case 'D': return ComponentColors.diode;
    case 'Q': return ComponentColors.transistor;
    case 'U': return ComponentColors.ic;
    case 'J': return ComponentColors.connector;
    case 'S': return ComponentColors.switch;
    default: return ComponentColors.other;
  }
}

/**
 * Rotate a 2D point around origin
 */
function rotatePoint(x: number, y: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

/**
 * Build component box geometry
 * Creates a simple rectangular box representing a component
 */
export function buildComponentGeometry(
  component: PlacedComponent,
  footprint?: Footprint
): Plotly.Data {
  const { position, rotation, side, refdes } = component;

  // Get component dimensions
  const width = footprint?.bounds.width ?? 3; // Default 3mm
  const length = footprint?.bounds.height ?? 3; // Default 3mm
  const height = getComponentHeight(footprint?.name ?? 'UNKNOWN');

  // Component center offset (half width/length)
  const halfWidth = width / 2;
  const halfLength = length / 2;

  // Calculate Z position based on side
  const zBase = side === 'top' ? 0 : -height;
  const zTop = side === 'top' ? height : 0;

  // Create box vertices (before rotation)
  let vertices = [
    { x: -halfWidth, y: -halfLength },
    { x: halfWidth, y: -halfLength },
    { x: halfWidth, y: halfLength },
    { x: -halfWidth, y: halfLength },
  ];

  // Apply rotation
  vertices = vertices.map(v => rotatePoint(v.x, v.y, rotation));

  // Translate to component position
  vertices = vertices.map(v => ({
    x: v.x + position.x,
    y: v.y + position.y,
  }));

  // Create 3D vertices (8 vertices for box)
  const plotlyX = [
    ...vertices.map(v => v.x),
    ...vertices.map(v => v.x),
  ];
  const plotlyY = [
    ...vertices.map(v => v.y),
    ...vertices.map(v => v.y),
  ];
  const plotlyZ = [
    zBase, zBase, zBase, zBase,  // Bottom
    zTop, zTop, zTop, zTop,       // Top
  ];

  // Triangle indices for box
  const i = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
  const j = [1, 2, 1, 3, 4, 3, 2, 5, 3, 6, 6, 7];
  const k = [2, 3, 5, 7, 7, 0, 6, 4, 7, 2, 7, 4];

  const color = getComponentColor(refdes);

  return {
    type: 'mesh3d' as const,
    x: plotlyX,
    y: plotlyY,
    z: plotlyZ,
    i,
    j,
    k,
    color,
    opacity: 0.85,
    name: refdes,
    showlegend: false,
    hovertemplate: `<b>${refdes}</b><br>Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)})mm<br>Side: ${side}<extra></extra>`,
  };
}

/**
 * Batch components by side (top/bottom) for performance
 * Combines all components on same side into fewer meshes grouped by color
 */
function batchComponentsBySide(
  components: PlacedComponent[],
  footprints?: Map<string, Footprint>
): Plotly.Data[] {
  const meshes: Plotly.Data[] = [];

  // Group components by side and color for efficient batching
  const sideColorMap = new Map<string, PlacedComponent[]>();

  components.forEach(component => {
    const color = getComponentColor(component.refdes);
    const key = `${component.side}-${color}`;

    if (!sideColorMap.has(key)) {
      sideColorMap.set(key, []);
    }
    sideColorMap.get(key)!.push(component);
  });

  // Create batched mesh for each side-color group
  sideColorMap.forEach((groupComponents, key) => {
    const [side, color] = key.split('-');

    const allX: number[] = [];
    const allY: number[] = [];
    const allZ: number[] = [];
    const allI: number[] = [];
    const allJ: number[] = [];
    const allK: number[] = [];
    const refdesLabels: string[] = [];

    let vertexOffset = 0;

    groupComponents.forEach(component => {
      const footprint = footprints?.get(component.footprintId);
      const width = footprint?.bounds.width ?? 3;
      const length = footprint?.bounds.height ?? 3;
      const height = getComponentHeight(footprint?.name ?? 'UNKNOWN');

      const { position, rotation, refdes } = component;
      const halfWidth = width / 2;
      const halfLength = length / 2;

      const zBase = side === 'top' ? 0 : -height;
      const zTop = side === 'top' ? height : 0;

      // Create box vertices (before rotation)
      let vertices = [
        { x: -halfWidth, y: -halfLength },
        { x: halfWidth, y: -halfLength },
        { x: halfWidth, y: halfLength },
        { x: -halfWidth, y: halfLength },
      ];

      // Apply rotation
      vertices = vertices.map(v => rotatePoint(v.x, v.y, rotation));

      // Translate to component position
      vertices = vertices.map(v => ({
        x: v.x + position.x,
        y: v.y + position.y,
      }));

      // Add vertices
      const componentX = [...vertices.map(v => v.x), ...vertices.map(v => v.x)];
      const componentY = [...vertices.map(v => v.y), ...vertices.map(v => v.y)];
      const componentZ = [zBase, zBase, zBase, zBase, zTop, zTop, zTop, zTop];

      allX.push(...componentX);
      allY.push(...componentY);
      allZ.push(...componentZ);

      // Box indices
      const i = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
      const j = [1, 2, 1, 3, 4, 3, 2, 5, 3, 6, 6, 7];
      const k = [2, 3, 5, 7, 7, 0, 6, 4, 7, 2, 7, 4];

      i.forEach(idx => allI.push(idx + vertexOffset));
      j.forEach(idx => allJ.push(idx + vertexOffset));
      k.forEach(idx => allK.push(idx + vertexOffset));

      vertexOffset += 8;
      refdesLabels.push(refdes);
    });

    meshes.push({
      type: 'mesh3d' as const,
      x: allX,
      y: allY,
      z: allZ,
      i: allI,
      j: allJ,
      k: allK,
      color,
      opacity: 0.85,
      name: `Components (${side}, ${groupComponents.length})`,
      showlegend: true,
      hovertemplate: `<b>Component</b><br>Count: ${groupComponents.length}<extra></extra>`,
    });
  });

  return meshes;
}

/**
 * Build all component geometries
 * Uses batching to minimize mesh count
 */
export function buildAllComponentGeometry(
  components: PlacedComponent[],
  footprints?: Map<string, Footprint>
): Plotly.Data[] {
  if (components.length === 0) return [];

  // Use batching for better performance with many components
  if (components.length > 20) {
    return batchComponentsBySide(components, footprints);
  }

  // For small counts, individual meshes for better interactivity
  return components.map(component => {
    const footprint = footprints?.get(component.footprintId);
    return buildComponentGeometry(component, footprint);
  });
}
