/**
 * SceneManager.ts
 * Three.js scene and utilities management
 * 
 * Provides:
 * - Scene initialization
 * - Camera and renderer setup
 * - Lighting configuration
 * - Helper objects (grid, axes)
 * - Material factory
 * - Geometry utilities
 */

import type * as THREE from "three";

/**
 * Triangle mesh data structure
 */
export interface TriangleMesh {
  vertices: number[];
  indices: number[];
  normals?: number[];
}

/**
 * Bounding box representation
 */
export interface BoundingBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * Create an empty Three.js scene
 */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  scene.fog = new THREE.Fog(0x1a1a1a, 1000, 2000);
  return scene;
}

/**
 * Create a perspective camera
 */
export function createCamera(width: number, height: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    75,
    width / height,
    0.1,
    10000
  );
  camera.position.set(100, 100, 100);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Create a WebGL renderer
 */
export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true, 
    alpha: false 
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowShadowMap;
  return renderer;
}

/**
 * Add grid helper to scene
 */
export function addGridHelper(scene: THREE.Scene, size: number = 100, divisions: number = 10): THREE.GridHelper {
  const grid = new THREE.GridHelper(size, divisions, 0x444444, 0x222222);
  scene.add(grid);
  return grid;
}

/**
 * Add axes helper to scene
 */
export function addAxesHelper(scene: THREE.Scene, size: number = 50): THREE.AxesHelper {
  const axes = new THREE.AxesHelper(size);
  scene.add(axes);
  return axes;
}

/**
 * Create and add lights to scene
 */
export function createLights(scene: THREE.Scene): { ambient: THREE.Light; directional: THREE.Light } {
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(100, 100, 100);
  directional.castShadow = true;
  directional.shadow.mapSize.width = 2048;
  directional.shadow.mapSize.height = 2048;
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 500;
  directional.shadow.camera.left = -200;
  directional.shadow.camera.right = 200;
  directional.shadow.camera.top = 200;
  directional.shadow.camera.bottom = -200;
  scene.add(directional);

  return { ambient, directional };
}

/**
 * Convert triangle mesh data to THREE.Mesh
 */
export function meshFromTriangleMesh(triangleData: TriangleMesh): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(triangleData.vertices), 3));
  
  if (triangleData.normals) {
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(triangleData.normals), 3));
  } else {
    geometry.computeVertexNormals();
  }

  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triangleData.indices), 1));

  const material = new THREE.MeshStandardMaterial({
    color: 0x0088cc,
    metalness: 0.3,
    roughness: 0.6,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Create material by type
 */
export function createMaterial(type: "wireframe" | "solid" | "shaded"): THREE.Material {
  switch (type) {
    case "wireframe":
      return new THREE.MeshStandardMaterial({
        wireframe: true,
        color: 0x00ff00,
        emissive: 0x00ff00,
      });
    
    case "solid":
      return new THREE.MeshStandardMaterial({
        color: 0x0088cc,
        metalness: 0,
        roughness: 1,
      });
    
    case "shaded":
      return new THREE.MeshStandardMaterial({
        color: 0x0088cc,
        metalness: 0.3,
        roughness: 0.6,
      });
    
    default:
      return new THREE.MeshStandardMaterial();
  }
}

/**
 * Get bounding box of geometry
 */
export function getGeometryBounds(geometry: THREE.BufferGeometry): BoundingBox {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  
  return {
    min: bbox.min.clone(),
    max: bbox.max.clone(),
  };
}

/**
 * Create wireframe selection box
 */
export function createSelectionBox(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const bbox = getGeometryBounds(geometry);
  const boxHelper = new THREE.Box3Helper(
    new THREE.Box3(bbox.min, bbox.max),
    0xffff00
  );
  
  return boxHelper as unknown as THREE.LineSegments;
}

/**
 * Calculate geometry statistics
 */
export function getGeometryStats(geometry: THREE.BufferGeometry): {
  vertexCount: number;
  faceCount: number;
  volume: number;
  surfaceArea: number;
} {
  const positionAttribute = geometry.getAttribute("position");
  const vertexCount = positionAttribute?.count || 0;
  
  const indexAttribute = geometry.getIndex();
  const faceCount = indexAttribute ? indexAttribute.count / 3 : vertexCount / 3;
  
  // Simple volume and surface area estimation
  const bbox = getGeometryBounds(geometry);
  const dimensions = bbox.max.clone().sub(bbox.min);
  const volume = dimensions.x * dimensions.y * dimensions.z;
  const surfaceArea = 2 * (dimensions.x * dimensions.y + dimensions.y * dimensions.z + dimensions.z * dimensions.x);

  return {
    vertexCount,
    faceCount: Math.floor(faceCount),
    volume,
    surfaceArea,
  };
}

/**
 * Update camera aspect ratio on resize
 */
export function updateCameraAspect(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number
): void {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/**
 * Update renderer size
 */
export function updateRendererSize(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number
): void {
  renderer.setSize(width, height);
}

/**
 * Calculate FPS
 */
export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = Date.now();
  private fps: number = 0;

  update(): number {
    this.frameCount++;
    const now = Date.now();
    
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;
    }

    return this.fps;
  }

  getFPS(): number {
    return this.fps;
  }
}
