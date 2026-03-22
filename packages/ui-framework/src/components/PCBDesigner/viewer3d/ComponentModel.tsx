/**
 * 3D Component Model Renderer
 * Phase 16: 3D Component Models
 *
 * Renders individual component 3D models with LOD, materials, and transformations.
 * Integrates with React Three Fiber for Three.js rendering.
 */

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { PlacedComponent } from '../types';
import { Model3D, FootprintWithModel } from '../types3d';
import { getMaterialByComponentType, toThreeJsMaterialProps } from '../materials/PCBMaterials';
import { LODController } from './LODController';
import { getFootprintModelManager } from '../managers/FootprintModelManager';

interface ComponentModelProps {
  /** Component to render */
  component: PlacedComponent;

  /** Component model data */
  model?: Model3D;

  /** Model transformation (offset, rotation, scale) */
  transform?: {
    offset: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  };

  /** LOD controller for geometry simplification */
  lodController?: LODController;

  /** Current camera distance for LOD level selection */
  cameraDistance?: number;

  /** Enable highlight (selection) */
  isSelected?: boolean;

  /** Callback when component is clicked */
  onClick?: (componentId: string) => void;

  /** Custom material override */
  materialOverride?: any; // Three.js Material
}

/**
 * Individual component 3D model renderer
 *
 * This component is designed to work with React Three Fiber:
 *
 * ```tsx
 * <Canvas>
 *   <ComponentModel
 *     component={component}
 *     model={model3d}
 *     lodController={lodController}
 *     cameraDistance={distance}
 *   />
 * </Canvas>
 * ```
 */
export const ComponentModel: React.FC<ComponentModelProps> = ({
  component,
  model,
  transform,
  lodController,
  cameraDistance = 50,
  isSelected = false,
  onClick,
  materialOverride,
}) => {
  const meshRef = useRef<any>(null);
  const [lodLevel, setLodLevel] = useState(0);
  const [geometry, setGeometry] = useState<any>(null);
  const modelManager = useMemo(() => getFootprintModelManager(), []);

  // Determine LOD level based on camera distance
  useEffect(() => {
    if (lodController && cameraDistance) {
      const level = lodController.getLODLevel(cameraDistance);
      setLodLevel(level);
    }
  }, [cameraDistance, lodController]);

  // Load model geometry
  useEffect(() => {
    const loadGeometry = async () => {
      if (!model || !lodController) return;

      try {
        // Get LOD levels for this model
        const levels = lodController.createLODLevels(
          {
            vertices: new Float32Array(model.bounds as any),
            normals: new Float32Array(),
            indices: new Uint32Array(),
            bounds: {
              min: { x: 0, y: 0, z: 0 },
              max: { x: 10, y: 10, z: 10 },
            },
          },
          model.id
        );

        // Use current LOD level
        if (levels[lodLevel]) {
          setGeometry(levels[lodLevel]);
        }
      } catch (error) {
        console.error('Failed to load component model geometry:', error);
      }
    };

    loadGeometry();
  }, [model, lodLevel, lodController]);

  // Get component material
  const material = useMemo(() => {
    if (materialOverride) {
      return materialOverride;
    }

    const componentMaterial = getMaterialByComponentType(component.refdes);
    return toThreeJsMaterialProps(componentMaterial);
  }, [component.refdes, materialOverride]);

  // Handle click
  const handleClick = useCallback(
    (event: any) => {
      event.stopPropagation();
      onClick?.(component.id);
    },
    [component.id, onClick]
  );

  // Calculate position and rotation
  const position = useMemo(() => {
    const offset = transform?.offset ?? { x: 0, y: 0, z: 0 };
    return [
      component.position.x + offset.x,
      component.position.y + offset.y,
      offset.z,
    ] as [number, number, number];
  }, [component.position, transform]);

  const rotation = useMemo(() => {
    const rot = transform?.rotation ?? { x: 0, y: 0, z: 0 };
    return [
      (rot.x * Math.PI) / 180,
      (rot.y * Math.PI) / 180,
      (rot.z * Math.PI) / 180,
    ] as [number, number, number];
  }, [transform]);

  const scale = transform?.scale ?? 1.0;

  // Fallback: render as box if no model
  if (!geometry) {
    return (
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        scale={scale}
        onClick={handleClick}
      >
        <boxGeometry args={[2, 2, 1]} />
        <meshStandardMaterial
          color={material.color}
          metalness={material.metalness}
          roughness={material.roughness}
          emissive={material.emissive}
          wireframe={isSelected}
        />
      </mesh>
    );
  }

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={handleClick}
      userData={{ componentId: component.id, refdes: component.refdes }}
    >
      {/* Geometry will be loaded from model data */}
      <primitiveGeometry
        object={geometry}
        attach="geometry"
      />

      {/* Material with optional highlight */}
      <meshStandardMaterial
        color={isSelected ? 0xff6b6b : material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        emissive={isSelected ? 0xff6b6b : material.emissive}
        emissiveIntensity={isSelected ? 0.3 : material.emissiveIntensity ?? 0}
        wireframe={isSelected}
      />

      {/* Selection highlight edge */}
      {isSelected && (
        <lineSegments>
          <edgeGeometry object={geometry as any} />
          <lineBasicMaterial color={0xff6b6b} linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  );
};

/**
 * Batch render multiple component models
 */
export const ComponentModelBatch: React.FC<{
  components: PlacedComponent[];
  models: Map<string, Model3D>;
  lodController?: LODController;
  cameraDistance?: number;
  selectedComponentId?: string;
  onComponentClick?: (componentId: string) => void;
}> = ({
  components,
  models,
  lodController,
  cameraDistance,
  selectedComponentId,
  onComponentClick,
}) => {
  return (
    <>
      {components.map((component) => {
        const model = models.get(component.footprintId);

        return (
          <ComponentModel
            key={component.id}
            component={component}
            model={model}
            lodController={lodController}
            cameraDistance={cameraDistance}
            isSelected={selectedComponentId === component.id}
            onClick={onComponentClick}
          />
        );
      })}
    </>
  );
};

export default ComponentModel;
