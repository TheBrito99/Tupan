/**
 * PCB Via Geometry Builder
 * Phase 15: 3D Visualization
 *
 * Generates 3D geometry for vias
 * - Creates cylinder approximation (8-sided prism)
 * - Shows drill hole
 * - Spans from one layer to another
 */

import { Via, PCBBoard } from '../types';
import { calculateLayerZOffset, PCBColors } from './boardGeometry';

const SIDES = 8; // Number of sides for cylinder approximation

/**
 * Create a cylinder (approximated as N-sided prism)
 */
function createCylinderVertices(
  centerX: number,
  centerY: number,
  radius: number,
  zStart: number,
  zEnd: number,
  sides: number = SIDES
): { x: number[]; y: number[]; z: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];

  // Create vertices around the cylinder
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    const vx = centerX + radius * Math.cos(angle);
    const vy = centerY + radius * Math.sin(angle);

    // Bottom vertex
    x.push(vx);
    y.push(vy);
    z.push(zStart);

    // Top vertex
    x.push(vx);
    y.push(vy);
    z.push(zEnd);
  }

  // Add center vertices for top and bottom caps
  x.push(centerX);
  y.push(centerY);
  z.push(zStart);

  x.push(centerX);
  y.push(centerY);
  z.push(zEnd);

  return { x, y, z };
}

/**
 * Create triangle indices for cylinder faces
 */
function createCylinderIndices(sides: number): { i: number[]; j: number[]; k: number[] } {
  const i: number[] = [];
  const j: number[] = [];
  const k: number[] = [];

  // Side faces
  for (let s = 0; s < sides; s++) {
    const v0 = s * 2;
    const v1 = ((s + 1) % sides) * 2;

    // Two triangles per side
    // Face 1: bottom-left, bottom-right, top-right
    i.push(v0);
    j.push(v1);
    k.push(v1 + 1);

    // Face 2: bottom-left, top-right, top-left
    i.push(v0);
    j.push(v1 + 1);
    k.push(v0 + 1);
  }

  // Bottom cap
  const centerBottom = sides * 2;
  for (let s = 0; s < sides; s++) {
    const v0 = s * 2;
    const v1 = ((s + 1) % sides) * 2;
    i.push(v0);
    j.push(v1);
    k.push(centerBottom);
  }

  // Top cap
  const centerTop = sides * 2 + 1;
  for (let s = 0; s < sides; s++) {
    const v0 = s * 2 + 1;
    const v1 = ((s + 1) % sides) * 2 + 1;
    i.push(v0);
    j.push(centerTop);
    k.push(v1);
  }

  return { i, j, k };
}

/**
 * Build via geometry
 * Creates outer cylinder and drill hole
 */
export function buildViaGeometry(
  via: Via,
  board: PCBBoard
): Plotly.Data {
  const zStart = calculateLayerZOffset(board, via.fromLayer);
  const zEnd = calculateLayerZOffset(board, via.toLayer);

  const outerRadius = via.diameterOuter / 2;
  const { x, y, z } = createCylinderVertices(
    via.position.x,
    via.position.y,
    outerRadius,
    Math.min(zStart, zEnd),
    Math.max(zStart, zEnd),
    SIDES
  );

  const { i, j, k } = createCylinderIndices(SIDES);

  return {
    type: 'mesh3d' as const,
    x,
    y,
    z,
    i,
    j,
    k,
    color: PCBColors.copperOuter,
    opacity: 0.85,
    name: `Via ${via.id}`,
    showlegend: false,
    hovertemplate: `<b>Via</b><br>Position: (${via.position.x.toFixed(2)}, ${via.position.y.toFixed(2)})mm<br>Diameter: ${via.diameterOuter.toFixed(3)}mm<br>Drill: ${via.diameterInner.toFixed(3)}mm<extra></extra>`,
  };
}

/**
 * Build drill hole geometry (inner void)
 */
export function buildViaDrillGeometry(
  via: Via,
  board: PCBBoard
): Plotly.Data {
  const zStart = calculateLayerZOffset(board, via.fromLayer);
  const zEnd = calculateLayerZOffset(board, via.toLayer);

  const innerRadius = via.diameterInner / 2;
  const { x, y, z } = createCylinderVertices(
    via.position.x,
    via.position.y,
    innerRadius,
    Math.min(zStart, zEnd),
    Math.max(zStart, zEnd),
    SIDES
  );

  const { i, j, k } = createCylinderIndices(SIDES);

  return {
    type: 'mesh3d' as const,
    x,
    y,
    z,
    i,
    j,
    k,
    color: '#1a1a1a', // Black for drill hole
    opacity: 0.3,
    name: `Via Drill ${via.id}`,
    showlegend: false,
    hovertemplate: 'Via Drill Hole<extra></extra>',
  };
}

/**
 * Batch vias by layer for performance optimization
 * Combines all vias spanning a layer into single meshes
 */
function batchViasByLayer(
  vias: Via[],
  board: PCBBoard,
  isSolderPaste: boolean = false
): Plotly.Data[] {
  const meshes: Plotly.Data[] = [];
  const layerMap = new Map<string, Via[]>();

  // Group vias by the layers they span
  vias.forEach(via => {
    const key = `${via.fromLayer}-${via.toLayer}`;
    if (!layerMap.has(key)) {
      layerMap.set(key, []);
    }
    layerMap.get(key)!.push(via);
  });

  // Create batched meshes for outer vias and drill holes
  layerMap.forEach((layerVias, layerKey) => {
    const zStart = calculateLayerZOffset(board, layerVias[0].fromLayer);
    const zEnd = calculateLayerZOffset(board, layerVias[0].toLayer);

    // Batch outer vias
    const allX: number[] = [];
    const allY: number[] = [];
    const allZ: number[] = [];
    const allI: number[] = [];
    const allJ: number[] = [];
    const allK: number[] = [];

    let vertexOffset = 0;

    layerVias.forEach(via => {
      const outerRadius = via.diameterOuter / 2;
      const { x, y, z } = createCylinderVertices(
        via.position.x,
        via.position.y,
        outerRadius,
        Math.min(zStart, zEnd),
        Math.max(zStart, zEnd),
        SIDES
      );

      const { i, j, k } = createCylinderIndices(SIDES);

      allX.push(...x);
      allY.push(...y);
      allZ.push(...z);

      i.forEach(idx => allI.push(idx + vertexOffset));
      j.forEach(idx => allJ.push(idx + vertexOffset));
      k.forEach(idx => allK.push(idx + vertexOffset));

      vertexOffset += x.length;
    });

    meshes.push({
      type: 'mesh3d' as const,
      x: allX,
      y: allY,
      z: allZ,
      i: allI,
      j: allJ,
      k: allK,
      color: PCBColors.copperOuter,
      opacity: 0.85,
      name: `Vias (${layerKey})`,
      showlegend: true,
      hovertemplate: `<b>Via</b><br>Diameter: 0.3-1.0mm<extra></extra>`,
    });

    // Batch drill holes
    const drillX: number[] = [];
    const drillY: number[] = [];
    const drillZ: number[] = [];
    const drillI: number[] = [];
    const drillJ: number[] = [];
    const drillK: number[] = [];

    vertexOffset = 0;

    layerVias.forEach(via => {
      const innerRadius = via.diameterInner / 2;
      const { x, y, z } = createCylinderVertices(
        via.position.x,
        via.position.y,
        innerRadius,
        Math.min(zStart, zEnd),
        Math.max(zStart, zEnd),
        SIDES
      );

      const { i, j, k } = createCylinderIndices(SIDES);

      drillX.push(...x);
      drillY.push(...y);
      drillZ.push(...z);

      i.forEach(idx => drillI.push(idx + vertexOffset));
      j.forEach(idx => drillJ.push(idx + vertexOffset));
      k.forEach(idx => drillK.push(idx + vertexOffset));

      vertexOffset += x.length;
    });

    meshes.push({
      type: 'mesh3d' as const,
      x: drillX,
      y: drillY,
      z: drillZ,
      i: drillI,
      j: drillJ,
      k: drillK,
      color: '#1a1a1a',
      opacity: 0.3,
      name: `Via Drills (${layerKey})`,
      showlegend: false,
      hovertemplate: 'Via Drill Hole<extra></extra>',
    });
  });

  return meshes;
}

/**
 * Build all via geometry
 * Uses batching to minimize mesh count
 */
export function buildAllViaGeometry(vias: Via[], board: PCBBoard): Plotly.Data[] {
  if (vias.length === 0) return [];
  return batchViasByLayer(vias, board);
}
