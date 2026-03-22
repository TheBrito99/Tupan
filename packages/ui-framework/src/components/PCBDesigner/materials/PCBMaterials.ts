/**
 * PCB Materials Library
 * Phase 16: 3D Component Models
 *
 * Physically-Based Rendering (PBR) material definitions for PCB visualization.
 * Includes materials for copper, soldermask, silkscreen, and components.
 */

import { PCBMaterial } from '../types3d';

/**
 * Material properties interface for Three.js MeshStandardMaterial
 */
export interface ThreeJsMaterialProps {
  color: number;
  metalness: number;
  roughness: number;
  emissive?: number;
  emissiveIntensity?: number;
  side?: number;
}

/**
 * PCB and component material definitions using PBR
 */
export const PCB_MATERIALS: Record<string, PCBMaterial> = {
  // Copper materials
  copper: {
    type: 'copper',
    color: '#B87333', // Bright copper
    metalness: 1.0,
    roughness: 0.3, // Polished copper
    name: 'Copper (Polished)',
  },
  copperMatte: {
    type: 'copper',
    color: '#8B6914', // Matte copper
    metalness: 0.95,
    roughness: 0.6,
    name: 'Copper (Matte)',
  },
  copperOxidized: {
    type: 'copper',
    color: '#6B5B4F', // Oxidized copper
    metalness: 0.8,
    roughness: 0.7,
    name: 'Copper (Oxidized)',
  },

  // Solder mask materials
  soldermask: {
    type: 'soldermask',
    color: '#2d5016', // Green (standard)
    metalness: 0.0,
    roughness: 0.6,
    name: 'Solder Mask (Green)',
  },
  soldermaskRed: {
    type: 'soldermask',
    color: '#8B0000', // Red
    metalness: 0.0,
    roughness: 0.6,
    name: 'Solder Mask (Red)',
  },
  soldermaskBlue: {
    type: 'soldermask',
    color: '#00008B', // Blue
    metalness: 0.0,
    roughness: 0.6,
    name: 'Solder Mask (Blue)',
  },
  soldermaskBlack: {
    type: 'soldermask',
    color: '#1a1a1a', // Black
    metalness: 0.0,
    roughness: 0.7,
    name: 'Solder Mask (Black)',
  },
  soldermaskWhite: {
    type: 'soldermask',
    color: '#F5F5F5', // White
    metalness: 0.0,
    roughness: 0.6,
    name: 'Solder Mask (White)',
  },

  // Silkscreen materials
  silkscreen: {
    type: 'silkscreen',
    color: '#FFFFFF', // White
    metalness: 0.0,
    roughness: 0.7,
    name: 'Silk Screen (White)',
  },
  silkscreenYellow: {
    type: 'silkscreen',
    color: '#FFFF00', // Yellow
    metalness: 0.0,
    roughness: 0.7,
    name: 'Silk Screen (Yellow)',
  },

  // Substrate materials
  substrate: {
    type: 'substrate',
    color: '#3A3A2A', // FR-4 green
    metalness: 0.0,
    roughness: 0.8,
    name: 'FR-4 Substrate',
  },
  substrateCeramic: {
    type: 'substrate',
    color: '#E8D4C0', // Ceramic/cream
    metalness: 0.0,
    roughness: 0.7,
    name: 'Ceramic Substrate',
  },
  substrateFlexible: {
    type: 'substrate',
    color: '#8B6F47', // Flex substrate
    metalness: 0.0,
    roughness: 0.8,
    name: 'Flexible Substrate',
  },

  // Component materials
  resistor: {
    type: 'resistor',
    color: '#8B4513', // Brown
    metalness: 0.1,
    roughness: 0.5,
    name: 'Resistor',
  },
  resistorFilm: {
    type: 'resistor',
    color: '#D2B48C', // Tan
    metalness: 0.05,
    roughness: 0.6,
    name: 'Film Resistor',
  },
  capacitor: {
    type: 'capacitor',
    color: '#FFD700', // Gold
    metalness: 0.3,
    roughness: 0.4,
    name: 'Capacitor',
  },
  capacitorTantalum: {
    type: 'capacitor',
    color: '#2F4F4F', // Dark slate gray
    metalness: 0.2,
    roughness: 0.5,
    name: 'Tantalum Capacitor',
  },
  capacitorElectrolytic: {
    type: 'capacitor',
    color: '#4B0082', // Indigo
    metalness: 0.0,
    roughness: 0.6,
    name: 'Electrolytic Capacitor',
  },
  inductor: {
    type: 'inductor',
    color: '#A0522D', // Sienna
    metalness: 0.15,
    roughness: 0.55,
    name: 'Inductor',
  },
  ic: {
    type: 'ic',
    color: '#1a1a1a', // Black
    metalness: 0.0,
    roughness: 0.6,
    name: 'IC Package',
  },
  icCeramic: {
    type: 'ic',
    color: '#C4A57B', // Ceramic tan
    metalness: 0.0,
    roughness: 0.5,
    name: 'Ceramic IC',
  },
  diode: {
    type: 'diode',
    color: '#FF6347', // Tomato red
    metalness: 0.05,
    roughness: 0.5,
    name: 'Diode',
  },
  transistor: {
    type: 'transistor',
    color: '#333333', // Dark gray
    metalness: 0.0,
    roughness: 0.6,
    name: 'Transistor',
  },
  connector: {
    type: 'connector',
    color: '#CC0000', // Red
    metalness: 0.85,
    roughness: 0.25,
    name: 'Connector',
  },
  connectorGold: {
    type: 'connector',
    color: '#FFD700', // Gold plated
    metalness: 0.9,
    roughness: 0.2,
    name: 'Gold-Plated Connector',
  },

  // Custom materials
  custom: {
    type: 'custom',
    color: '#808080', // Gray
    metalness: 0.5,
    roughness: 0.5,
    name: 'Custom',
  },
};

/**
 * Get material by type (component reference designator)
 */
export function getMaterialByComponentType(refdes: string): PCBMaterial {
  const prefix = refdes.charAt(0).toUpperCase();

  switch (prefix) {
    case 'R':
      return PCB_MATERIALS.resistor;
    case 'C':
      return PCB_MATERIALS.capacitor;
    case 'L':
      return PCB_MATERIALS.inductor;
    case 'D':
      return PCB_MATERIALS.diode;
    case 'Q':
    case 'M':
      return PCB_MATERIALS.transistor;
    case 'U':
    case 'IC':
      return PCB_MATERIALS.ic;
    case 'J':
    case 'P':
      return PCB_MATERIALS.connector;
    default:
      return PCB_MATERIALS.custom;
  }
}

/**
 * Convert hex color to Three.js color number
 */
export function hexToThreeColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Convert PCBMaterial to Three.js MeshStandardMaterial props
 */
export function toThreeJsMaterialProps(
  material: PCBMaterial
): ThreeJsMaterialProps {
  return {
    color: hexToThreeColor(material.color),
    metalness: material.metalness ?? 0,
    roughness: material.roughness ?? 0.5,
    emissive: material.emissive
      ? hexToThreeColor(material.emissive)
      : undefined,
    emissiveIntensity: material.emissiveIntensity ?? 0,
  };
}

/**
 * Get all available materials by category
 */
export function getMaterialsByCategory(
  category: PCBMaterial['type']
): PCBMaterial[] {
  return Object.values(PCB_MATERIALS).filter((m) => m.type === category);
}

/**
 * Get all copper materials
 */
export function getCopperMaterials(): PCBMaterial[] {
  return [
    PCB_MATERIALS.copper,
    PCB_MATERIALS.copperMatte,
    PCB_MATERIALS.copperOxidized,
  ];
}

/**
 * Get all solder mask materials
 */
export function getSoldermaskMaterials(): PCBMaterial[] {
  return [
    PCB_MATERIALS.soldermask,
    PCB_MATERIALS.soldermaskRed,
    PCB_MATERIALS.soldermaskBlue,
    PCB_MATERIALS.soldermaskBlack,
    PCB_MATERIALS.soldermaskWhite,
  ];
}

/**
 * Get all substrate materials
 */
export function getSubstrateMaterials(): PCBMaterial[] {
  return [
    PCB_MATERIALS.substrate,
    PCB_MATERIALS.substrateCeramic,
    PCB_MATERIALS.substrateFlexible,
  ];
}

/**
 * Get all component materials
 */
export function getComponentMaterials(): PCBMaterial[] {
  return [
    PCB_MATERIALS.resistor,
    PCB_MATERIALS.resistorFilm,
    PCB_MATERIALS.capacitor,
    PCB_MATERIALS.capacitorTantalum,
    PCB_MATERIALS.capacitorElectrolytic,
    PCB_MATERIALS.inductor,
    PCB_MATERIALS.ic,
    PCB_MATERIALS.icCeramic,
    PCB_MATERIALS.diode,
    PCB_MATERIALS.transistor,
    PCB_MATERIALS.connector,
    PCB_MATERIALS.connectorGold,
  ];
}

/**
 * Material preset configurations for common PCB types
 */
export const MATERIAL_PRESETS = {
  standard: {
    name: 'Standard Green',
    copper: PCB_MATERIALS.copper,
    soldermask: PCB_MATERIALS.soldermask,
    silkscreen: PCB_MATERIALS.silkscreen,
    substrate: PCB_MATERIALS.substrate,
  },
  red: {
    name: 'Red Mask',
    copper: PCB_MATERIALS.copperMatte,
    soldermask: PCB_MATERIALS.soldermaskRed,
    silkscreen: PCB_MATERIALS.silkscreenYellow,
    substrate: PCB_MATERIALS.substrate,
  },
  blue: {
    name: 'Blue Mask',
    copper: PCB_MATERIALS.copper,
    soldermask: PCB_MATERIALS.soldermaskBlue,
    silkscreen: PCB_MATERIALS.silkscreen,
    substrate: PCB_MATERIALS.substrate,
  },
  black: {
    name: 'Black Mask',
    copper: PCB_MATERIALS.copperOxidized,
    soldermask: PCB_MATERIALS.soldermaskBlack,
    silkscreen: PCB_MATERIALS.silkscreenYellow,
    substrate: PCB_MATERIALS.substrate,
  },
  ceramic: {
    name: 'Ceramic Substrate',
    copper: PCB_MATERIALS.copperMatte,
    soldermask: PCB_MATERIALS.soldermask,
    silkscreen: PCB_MATERIALS.silkscreen,
    substrate: PCB_MATERIALS.substrateCeramic,
  },
  flexible: {
    name: 'Flexible PCB',
    copper: PCB_MATERIALS.copper,
    soldermask: PCB_MATERIALS.soldermaskBlue,
    silkscreen: PCB_MATERIALS.silkscreen,
    substrate: PCB_MATERIALS.substrateFlexible,
  },
};

/**
 * Get material preset by name
 */
export function getMaterialPreset(
  name: keyof typeof MATERIAL_PRESETS
): (typeof MATERIAL_PRESETS)[keyof typeof MATERIAL_PRESETS] {
  return MATERIAL_PRESETS[name];
}

/**
 * Get all available material presets
 */
export function getAllMaterialPresets(): Array<{
  name: string;
  key: keyof typeof MATERIAL_PRESETS;
}> {
  return Object.entries(MATERIAL_PRESETS).map(([key, preset]) => ({
    name: preset.name,
    key: key as keyof typeof MATERIAL_PRESETS,
  }));
}
