/**
 * PCB Trace Geometry Builder
 * Phase 15: 3D Visualization
 *
 * Generates 3D geometry for PCB traces
 * - Extrudes trace segments to 3D rectangular prisms
 * - Positions at correct layer Z-offset
 */

import { Trace, PCBLayer } from '../types';
import { calculateLayerZOffset, PCBColors } from './boardGeometry';
import { PCBBoard } from '../types';

const COPPER_THICKNESS = 0.035; // 1oz copper = 35µm

/**
 * Create a rectangular prism for a single trace segment
 * Returns vertices and face indices for Plotly mesh3d
 */
function createSegmentMesh(
  start: { x: number; y: number },
  end: { x: number; y: number },
  width: number,
  zOffset: number
): {
  vertices: { x: number[]; y: number[]; z: number[] };
  indices: { i: number[]; j: number[]; k: number[] };
} {
  // Calculate perpendicular direction
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) {
    // Degenerate segment, return empty
    return { vertices: { x: [], y: [], z: [] }, indices: { i: [], j: [], k: [] } };
  }

  // Normalized perpendicular
  const perpX = (-dy / len) * (width / 2);
  const perpY = (dx / len) * (width / 2);

  // Create 4 vertices for top and bottom of trace
  const vertices = {
    x: [
      start.x - perpX, start.x + perpX, end.x + perpX, end.x - perpX,  // Bottom
      start.x - perpX, start.x + perpX, end.x + perpX, end.x - perpX,  // Top
    ],
    y: [
      start.y - perpY, start.y + perpY, end.y + perpY, end.y - perpY,  // Bottom
      start.y - perpY, start.y + perpY, end.y + perpY, end.y - perpY,  // Top
    ],
    z: [
      zOffset, zOffset, zOffset, zOffset,                              // Bottom
      zOffset + COPPER_THICKNESS,
      zOffset + COPPER_THICKNESS,
      zOffset + COPPER_THICKNESS,
      zOffset + COPPER_THICKNESS,                                      // Top
    ],
  };

  // Triangle indices for rectangular prism
  const indices = {
    i: [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3],
    j: [1, 2, 1, 3, 4, 3, 2, 5, 3, 6, 6, 7],
    k: [2, 3, 5, 7, 7, 0, 6, 4, 7, 2, 7, 4],
  };

  return { vertices, indices };
}

/**
 * Build trace geometry
 * Extrudes all segments and combines them into a single mesh
 */
export function buildTraceGeometry(
  trace: Trace,
  board: PCBBoard
): Plotly.Data {
  const zOffset = calculateLayerZOffset(board, trace.layer);
  const color = PCBColors.copperOuter;

  // Collect all segment meshes
  const allX: number[] = [];
  const allY: number[] = [];
  const allZ: number[] = [];
  const allI: number[] = [];
  const allJ: number[] = [];
  const allK: number[] = [];

  let vertexOffset = 0;

  trace.segments.forEach(segment => {
    const { vertices, indices } = createSegmentMesh(
      segment.start,
      segment.end,
      trace.width,
      zOffset
    );

    allX.push(...vertices.x);
    allY.push(...vertices.y);
    allZ.push(...vertices.z);

    // Offset indices by current vertex count
    indices.i.forEach(idx => allI.push(idx + vertexOffset));
    indices.j.forEach(idx => allJ.push(idx + vertexOffset));
    indices.k.forEach(idx => allK.push(idx + vertexOffset));

    vertexOffset += vertices.x.length;
  });

  return {
    type: 'mesh3d' as const,
    x: allX,
    y: allY,
    z: allZ,
    i: allI,
    j: allJ,
    k: allK,
    color,
    opacity: 0.8,
    name: `Trace: ${trace.netName}`,
    showlegend: false,
    hovertemplate: `<b>${trace.netName}</b><br>Layer: ${trace.layer}<br>Width: ${trace.width.toFixed(3)}mm<extra></extra>`,
  };
}

/**
 * Batch traces on the same layer into a single mesh for performance
 */
export function batchTraceGeometry(
  traces: Trace[],
  board: PCBBoard,
  layer: PCBLayer
): Plotly.Data | null {
  const layerTraces = traces.filter(t => t.layer === layer);
  if (layerTraces.length === 0) return null;

  const zOffset = calculateLayerZOffset(board, layer);
  const color = PCBColors.copperOuter;

  const allX: number[] = [];
  const allY: number[] = [];
  const allZ: number[] = [];
  const allI: number[] = [];
  const allJ: number[] = [];
  const allK: number[] = [];
  const names: string[] = [];

  let vertexOffset = 0;

  layerTraces.forEach(trace => {
    trace.segments.forEach(segment => {
      const { vertices, indices } = createSegmentMesh(
        segment.start,
        segment.end,
        trace.width,
        zOffset
      );

      allX.push(...vertices.x);
      allY.push(...vertices.y);
      allZ.push(...vertices.z);

      indices.i.forEach(idx => allI.push(idx + vertexOffset));
      indices.j.forEach(idx => allJ.push(idx + vertexOffset));
      indices.k.forEach(idx => allK.push(idx + vertexOffset));

      vertexOffset += vertices.x.length;
    });

    names.push(trace.netName);
  });

  return {
    type: 'mesh3d' as const,
    x: allX,
    y: allY,
    z: allZ,
    i: allI,
    j: allJ,
    k: allK,
    color,
    opacity: 0.8,
    name: `Traces (${layer})`,
    showlegend: true,
    hovertemplate: `Copper Trace<br>Layer: ${layer}<extra></extra>`,
  };
}

/**
 * Build all trace geometry for all layers
 */
export function buildAllTraceGeometry(
  traces: Trace[],
  board: PCBBoard
): Plotly.Data[] {
  const meshes: Plotly.Data[] = [];

  // Get unique layers
  const layers = new Set(traces.map(t => t.layer));

  layers.forEach(layer => {
    const mesh = batchTraceGeometry(traces, board, layer);
    if (mesh) meshes.push(mesh);
  });

  return meshes;
}
