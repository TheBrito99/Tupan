/**
 * Bond Interaction Utilities
 *
 * Handles bond creation, deletion, and validation logic
 */

import type { EditorElement, EditorBond } from './types';

/**
 * Check if a bond can be created between two elements
 * Some element combinations are not physically meaningful
 */
export function canCreateBond(fromElement: EditorElement, toElement: EditorElement): boolean {
  // Prevent self-bonds
  if (fromElement.id === toElement.id) {
    return false;
  }

  // Junctions can connect to anything except other junctions directly
  // (in real bond graphs, junctions connect through elements)
  if (isJunction(fromElement.type) && isJunction(toElement.type)) {
    return false;
  }

  return true;
}

/**
 * Check if element type is a junction
 */
export function isJunction(type: string): boolean {
  return type === 'Junction0' || type === 'Junction1';
}

/**
 * Check if element type is a source
 */
export function isSource(type: string): boolean {
  return type === 'Se' || type === 'Sf';
}

/**
 * Check if element type is a transformer/gyrator
 */
export function isTransformer(type: string): boolean {
  return type === 'TF' || type === 'GY';
}

/**
 * Check if element type is storage (C or I)
 */
export function isStorage(type: string): boolean {
  return type === 'C' || type === 'I';
}

/**
 * Check if a bond already exists
 */
export function bondExists(
  bonds: EditorBond[],
  fromId: string,
  toId: string
): boolean {
  return bonds.some((b) => b.from === fromId && b.to === toId);
}

/**
 * Create a new bond between two elements
 */
export function createBond(
  fromElement: EditorElement,
  toElement: EditorElement,
  bondId: string
): EditorBond {
  return {
    id: bondId,
    from: fromElement.id,
    to: toElement.id,
    causality: 'Unassigned',
    effort: 0,
    flow: 0,
  };
}

/**
 * Find all bonds connected to an element
 */
export function findConnectedBonds(bonds: EditorBond[], elementId: string): EditorBond[] {
  return bonds.filter((b) => b.from === elementId || b.to === elementId);
}

/**
 * Delete a bond and any bonds that depend on it
 */
export function deleteBond(bonds: EditorBond[], bondId: string): EditorBond[] {
  return bonds.filter((b) => b.id !== bondId);
}

/**
 * Delete all bonds connected to an element
 */
export function deleteElementBonds(bonds: EditorBond[], elementId: string): EditorBond[] {
  return bonds.filter((b) => b.from !== elementId && b.to !== elementId);
}

/**
 * Validate bond graph structure
 * Returns list of warnings/errors
 */
export function validateBondGraph(elements: EditorElement[], bonds: EditorBond[]): string[] {
  const issues: string[] = [];

  // Check for disconnected elements
  const connectedElements = new Set<string>();
  bonds.forEach((b) => {
    connectedElements.add(b.from);
    connectedElements.add(b.to);
  });

  elements.forEach((el) => {
    if (!connectedElements.has(el.id) && !isSource(el.type)) {
      issues.push(`Element '${el.id}' is not connected to any bonds`);
    }
  });

  // Check for sources without outgoing bonds
  elements.forEach((el) => {
    if (isSource(el.type)) {
      const hasOutgoing = bonds.some((b) => b.from === el.id);
      if (!hasOutgoing) {
        issues.push(`Source '${el.id}' has no outgoing bonds`);
      }
    }
  });

  // Check for too many connections (typically a sign of an error)
  elements.forEach((el) => {
    const connectedCount = bonds.filter(
      (b) => b.from === el.id || b.to === el.id
    ).length;
    if (connectedCount > 10) {
      issues.push(
        `Element '${el.id}' has ${connectedCount} connections (unusually high)`
      );
    }
  });

  return issues;
}

/**
 * Get causality summary for bond graph
 */
export function getCausalitySummary(bonds: EditorBond[]): {
  assigned: number;
  unassigned: number;
  total: number;
} {
  const total = bonds.length;
  const assigned = bonds.filter((b) => b.causality !== 'Unassigned').length;
  const unassigned = total - assigned;

  return { assigned, unassigned, total };
}

/**
 * Export bond graph as JSON
 */
export function exportBondGraph(
  name: string,
  elements: EditorElement[],
  bonds: EditorBond[]
): string {
  const data = {
    name,
    timestamp: new Date().toISOString(),
    elements: elements.map((el) => ({
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      parameters: el.parameters,
    })),
    bonds: bonds.map((b) => ({
      id: b.id,
      from: b.from,
      to: b.to,
      causality: b.causality,
    })),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Import bond graph from JSON
 */
export function importBondGraph(
  jsonString: string
): { elements: EditorElement[]; bonds: EditorBond[] } | null {
  try {
    const data = JSON.parse(jsonString);

    if (!Array.isArray(data.elements) || !Array.isArray(data.bonds)) {
      throw new Error('Invalid bond graph format');
    }

    const elements: EditorElement[] = data.elements.map((el: any) => ({
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      parameters: el.parameters || {},
      width: 60,
      height: 60,
      selected: false,
    }));

    const bonds: EditorBond[] = data.bonds.map((b: any) => ({
      id: b.id,
      from: b.from,
      to: b.to,
      causality: b.causality || 'Unassigned',
      effort: b.effort || 0,
      flow: b.flow || 0,
    }));

    return { elements, bonds };
  } catch (error) {
    console.error('Failed to import bond graph:', error);
    return null;
  }
}
