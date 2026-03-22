/**
 * PCB Board Geometry Builder
 * Phase 15: 3D Visualization
 *
 * Generates Plotly mesh3d geometry for:
 * - PCB substrate (FR-4 slab)
 * - Copper layers
 * - Solder mask
 */

import { PCBBoard, PCBLayer } from '../types';

/**
 * Material colors for different PCB components
 */
export const PCBColors = {
  substrate: '#3d2f1f',      // FR-4 brown
  copperOuter: '#d4a574',    // Copper gold
  copperInner: '#b8932a',    // Darker copper for inner layers
  soldermaskTop: '#2d5016',  // Green
  soldermaskBottom: '#2d5016',
  silkscreenTop: '#f5f5f5',  // Off-white
  silkscreenBottom: '#f5f5f5',
} as const;

/**
 * Layer Z-offset specifications (mm from bottom)
 */
const LAYER_THICKNESS = 0.035; // 1oz copper
const SOLDER_MASK_THICKNESS = 0.025;

/**
 * Calculate Z-offset for a given layer
 */
export function calculateLayerZOffset(board: PCBBoard, layer: PCBLayer): number {
  // Assuming standard 4-layer board: Signal-Top, Inner1, Inner2, Signal-Bottom
  // Calculate proportional Z-offset based on board thickness

  switch (layer) {
    case PCBLayer.SIGNAL_BOTTOM:
      return 0; // Bottom surface
    case PCBLayer.PASTE_BOTTOM:
      return SOLDER_MASK_THICKNESS;
    case PCBLayer.MASK_BOTTOM:
      return SOLDER_MASK_THICKNESS;
    case PCBLayer.SIGNAL_INNER2:
      return board.thickness * 0.66;
    case PCBLayer.SIGNAL_INNER1:
      return board.thickness * 0.33;
    case PCBLayer.MASK_TOP:
      return board.thickness - SOLDER_MASK_THICKNESS;
    case PCBLayer.PASTE_TOP:
      return board.thickness - SOLDER_MASK_THICKNESS;
    case PCBLayer.SIGNAL_TOP:
      return board.thickness; // Top surface
    case PCBLayer.SILK_BOTTOM:
      return SOLDER_MASK_THICKNESS + 0.01;
    case PCBLayer.SILK_TOP:
      return board.thickness + 0.01;
    case PCBLayer.GROUND:
      return board.thickness * 0.5;
    case PCBLayer.POWER:
      return board.thickness * 0.5;
    default:
      return board.thickness / 2;
  }
}

/**
 * Build board substrate mesh (rectangular slab)
 * Represents the FR-4 material
 */
export function buildBoardGeometry(board: PCBBoard): Plotly.Data {
  const { width, height, thickness } = board;

  // 8 vertices for a rectangular box
  const vertices = {
    x: [0, width, width, 0, 0, width, width, 0],
    y: [0, 0, height, height, 0, 0, height, height],
    z: [0, 0, 0, 0, thickness, thickness, thickness, thickness],
  };

  // Triangle indices (4 sides + top + bottom)
  // Bottom (z=0): 0,1,2 and 2,3,0
  // Top (z=thickness): 4,6,5 and 6,4,7
  // Front (y=0): 0,1,5 and 5,4,0
  // Back (y=height): 2,3,7 and 7,6,2
  // Left (x=0): 0,4,7 and 7,3,0
  // Right (x=width): 1,2,6 and 6,5,1

  const i = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
  const j = [1, 2, 1, 3, 4, 3, 2, 5, 3, 6, 6, 7];
  const k = [2, 3, 5, 7, 7, 0, 6, 4, 7, 2, 7, 4];

  return {
    type: 'mesh3d' as const,
    x: vertices.x,
    y: vertices.y,
    z: vertices.z,
    i,
    j,
    k,
    color: PCBColors.substrate,
    opacity: 0.95,
    name: 'PCB Board',
    showlegend: true,
    hovertemplate: 'PCB Substrate<br>Thickness: ' + thickness.toFixed(2) + 'mm<extra></extra>',
  };
}

/**
 * Build copper layer geometry
 * Each layer is a thin slab at its Z-offset
 */
export function buildCopperLayerGeometry(
  board: PCBBoard,
  layer: PCBLayer,
  zOffset: number,
  index: number
): Plotly.Data {
  const { width, height } = board;
  const thickness = LAYER_THICKNESS;

  // Create thin rectangular slab
  const vertices = {
    x: [0, width, width, 0, 0, width, width, 0],
    y: [0, 0, height, height, 0, 0, height, height],
    z: Array(4).fill(zOffset).concat(Array(4).fill(zOffset + thickness)),
  };

  const i = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
  const j = [1, 2, 1, 3, 4, 3, 2, 5, 3, 6, 6, 7];
  const k = [2, 3, 5, 7, 7, 0, 6, 4, 7, 2, 7, 4];

  const color = index === 0 ? PCBColors.copperOuter : PCBColors.copperInner;

  return {
    type: 'mesh3d' as const,
    x: vertices.x,
    y: vertices.y,
    z: vertices.z,
    i,
    j,
    k,
    color,
    opacity: 0.8,
    name: `${layer} Copper`,
    showlegend: true,
    hovertemplate: `${layer}<br>Copper Layer<extra></extra>`,
  };
}

/**
 * Build solder mask geometry
 * Semi-transparent green layer on top/bottom
 */
export function buildSoldermaskGeometry(
  board: PCBBoard,
  side: 'top' | 'bottom'
): Plotly.Data {
  const { width, height, thickness } = board;
  const zOffset = side === 'top'
    ? thickness - SOLDER_MASK_THICKNESS
    : SOLDER_MASK_THICKNESS;

  const vertices = {
    x: [0, width, width, 0, 0, width, width, 0],
    y: [0, 0, height, height, 0, 0, height, height],
    z: Array(4).fill(zOffset).concat(
      Array(4).fill(zOffset + SOLDER_MASK_THICKNESS)
    ),
  };

  const i = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
  const j = [1, 2, 1, 3, 4, 3, 2, 5, 3, 6, 6, 7];
  const k = [2, 3, 5, 7, 7, 0, 6, 4, 7, 2, 7, 4];

  return {
    type: 'mesh3d' as const,
    x: vertices.x,
    y: vertices.y,
    z: vertices.z,
    i,
    j,
    k,
    color: side === 'top'
      ? PCBColors.soldermaskTop
      : PCBColors.soldermaskBottom,
    opacity: 0.7,
    name: `Solder Mask (${side})`,
    showlegend: true,
    hovertemplate: `Solder Mask (${side})<extra></extra>`,
  };
}

/**
 * Build all board-related geometry
 */
export function buildAllBoardGeometry(
  board: PCBBoard
): Plotly.Data[] {
  const meshes: Plotly.Data[] = [];

  // Board substrate
  meshes.push(buildBoardGeometry(board));

  // Copper layers
  let copperIndex = 0;
  board.layers
    .filter(layer => layer.includes('signal') || layer === PCBLayer.GROUND || layer === PCBLayer.POWER)
    .forEach(layer => {
      const zOffset = calculateLayerZOffset(board, layer);
      meshes.push(buildCopperLayerGeometry(board, layer, zOffset, copperIndex++));
    });

  // Solder masks
  meshes.push(buildSoldermaskGeometry(board, 'top'));
  meshes.push(buildSoldermaskGeometry(board, 'bottom'));

  return meshes;
}
