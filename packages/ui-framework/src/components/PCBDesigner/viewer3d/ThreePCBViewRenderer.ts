/**
 * Three.js PCB Renderer
 * Phase 16: 3D Component Models
 *
 * Complete Three.js renderer for PCB boards with:
 * - Board substrate and layers
 * - Copper traces and connections
 * - Component placements with 3D models
 * - Via rendering with drill holes
 * - Lighting and material system
 * - Camera management
 */

import * as THREE from 'three';
import { PCBBoard, PlacedComponent } from '../types';
import { Viewer3DState } from '../PCBCanvas3D';
import { ModelRenderingPipeline, ModelRenderConfig } from './ModelRenderingPipeline';
import { getFootprintModelManager } from '../managers/FootprintModelManager';
import { getMaterialByComponentType } from '../materials/PCBMaterials';

/**
 * Three.js PCB Board Renderer
 */
export class ThreePCBViewRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: any; // OrbitControls would go here
  private pipeline: ModelRenderingPipeline;
  private board: PCBBoard;
  private viewer3DState: Viewer3DState;
  private selectedComponentId: string | null = null;
  private renderConfig: ModelRenderConfig;
  private modelManager = getFootprintModelManager();

  constructor(
    canvas: HTMLCanvasElement,
    board: PCBBoard,
    viewer3DState: Viewer3DState
  ) {
    this.board = board;
    this.viewer3DState = viewer3DState;

    // Setup Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);
    this.scene.fog = new THREE.Fog(0xf5f5f5, 500, 1000);

    // Setup Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(
      board.width / 2,
      board.height / 2,
      Math.max(board.width, board.height) * 1.5
    );
    this.camera.lookAt(board.width / 2, board.height / 2, 0);

    // Setup Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      precision: 'highp',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;

    // Setup Lighting
    this.setupLighting();

    // Setup Pipeline
    this.renderConfig = {
      enableLOD: true,
      enableShadows: true,
      enableAO: true,
      materialQuality: 'high',
      cameraDistance: 100,
    };
    this.pipeline = new ModelRenderingPipeline(this.scene);

    // Mouse event handling for selection
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Setup three-point lighting
   */
  private setupLighting(): void {
    // Ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Main directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 200, 200);
    directionalLight.target.position.set(this.board.width / 2, this.board.height / 2, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 500;
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);

    // Fill light for shadows
    const fillLight = new THREE.DirectionalLight(0xaabbff, 0.3);
    fillLight.position.set(-100, -100, 100);
    this.scene.add(fillLight);
  }

  /**
   * Render the complete PCB
   */
  async render(): Promise<void> {
    // Clear existing geometry
    this.pipeline.clear();

    // Render board substrate
    if (this.viewer3DState.rendering.showComponents) {
      this.renderBoard();
    }

    // Render components with 3D models
    if (this.viewer3DState.rendering.showComponents) {
      await this.renderComponents();
    }

    // Render traces
    if (this.viewer3DState.rendering.showTraces) {
      this.renderTraces();
    }

    // Render vias
    if (this.viewer3DState.rendering.showVias) {
      this.renderVias();
    }

    // Start animation loop
    this.startAnimationLoop();
  }

  /**
   * Render board substrate
   */
  private renderBoard(): void {
    // Create board geometry (FR-4 substrate)
    const boardGeometry = new THREE.BoxGeometry(
      this.board.width,
      this.board.height,
      this.board.thickness
    );

    // Apply board material
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.viewer3DState.materials.substrateColor || '#3d2f1f'),
      metalness: 0,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });

    const boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
    boardMesh.position.z = -this.board.thickness / 2;
    boardMesh.castShadow = true;
    boardMesh.receiveShadow = true;
    this.scene.add(boardMesh);
  }

  /**
   * Render all components with 3D models
   */
  private async renderComponents(): Promise<void> {
    for (const component of this.board.components) {
      try {
        // Get footprint
        const footprint = this.board.footprints?.find(
          (f) => f.id === component.footprintId
        );
        if (!footprint) continue;

        // Try to get 3D model
        const footprintWithModel = await this.modelManager.getFootprintWithModel(
          footprint
        );

        if (footprintWithModel.model3d) {
          // Render with 3D model
          const material = getMaterialByComponentType(component.refdes);
          await this.pipeline.renderComponent(
            component,
            footprintWithModel.model3d,
            material,
            this.renderConfig
          );
        } else if (this.viewer3DState.rendering.componentDetail === 'box') {
          // Fallback to box geometry
          this.renderComponentAsBox(component, footprint);
        }
      } catch (err) {
        console.warn(`Failed to render component ${component.refdes}:`, err);
        // Fallback to box
        const footprint = this.board.footprints?.find(
          (f) => f.id === component.footprintId
        );
        if (footprint) {
          this.renderComponentAsBox(component, footprint);
        }
      }
    }
  }

  /**
   * Render component as simple box (fallback)
   */
  private renderComponentAsBox(component: PlacedComponent, footprint: any): void {
    const geometry = new THREE.BoxGeometry(
      footprint.width || 5,
      footprint.height || 5,
      2
    );

    const material = new THREE.MeshStandardMaterial({
      color: 0x8b8b8b,
      metalness: 0.3,
      roughness: 0.5,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(component.position.x, component.position.y, 1);
    mesh.rotation.z = (component.rotation * Math.PI) / 180;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);
  }

  /**
   * Render PCB traces
   */
  private renderTraces(): void {
    for (const trace of this.board.traces) {
      const points = trace.points || [];
      if (points.length < 2) continue;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        // Create trace geometry (thin extrusion)
        const width = trace.width || 0.2;
        const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        const geometry = new THREE.BoxGeometry(width, length, 0.035);
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(this.viewer3DState.materials.copperColor || '#d4a574'),
          metalness: 0.95,
          roughness: 0.3,
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Position and rotate to connect points
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        mesh.position.set(midX, midY, 0.035);
        mesh.rotation.z = Math.atan2(p2.y - p1.y, p2.x - p1.x) + Math.PI / 2;

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
      }
    }
  }

  /**
   * Render PCB vias
   */
  private renderVias(): void {
    for (const via of this.board.vias) {
      // Via barrel (copper)
      const barrelGeometry = new THREE.CylinderGeometry(
        via.drillDiameter / 2 + 0.1,
        via.drillDiameter / 2 + 0.1,
        0.5,
        8
      );

      const barrelMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.viewer3DState.materials.copperColor || '#d4a574'),
        metalness: 0.9,
        roughness: 0.3,
      });

      const barrelMesh = new THREE.Mesh(barrelGeometry, barrelMaterial);
      barrelMesh.position.set(via.position.x, via.position.y, 0.25);
      barrelMesh.castShadow = true;
      barrelMesh.receiveShadow = true;
      this.scene.add(barrelMesh);

      // Drill hole (void)
      const drillGeometry = new THREE.CylinderGeometry(
        via.drillDiameter / 2,
        via.drillDiameter / 2,
        0.5,
        8
      );

      const drillMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
      });

      const drillMesh = new THREE.Mesh(drillGeometry, drillMaterial);
      drillMesh.position.set(via.position.x, via.position.y, 0.25);
      this.scene.add(drillMesh);
    }
  }

  /**
   * Select/highlight component
   */
  selectComponent(componentId: string): void {
    if (this.selectedComponentId) {
      this.pipeline.highlightComponent(this.selectedComponentId, false);
    }

    this.selectedComponentId = componentId;
    this.pipeline.highlightComponent(componentId, true);
  }

  /**
   * Deselect component
   */
  deselectComponent(): void {
    if (this.selectedComponentId) {
      this.pipeline.highlightComponent(this.selectedComponentId, false);
      this.selectedComponentId = null;
    }
  }

  /**
   * Start animation loop
   */
  private startAnimationLoop(): void {
    const animate = () => {
      requestAnimationFrame(animate);

      // Update camera LOD
      const cameraDistance = this.camera.position.distanceTo(
        new THREE.Vector3(this.board.width / 2, this.board.height / 2, 0)
      );
      this.pipeline.updateLOD(cameraDistance);

      // Render
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  /**
   * Handle canvas click for selection
   */
  private onCanvasClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Get all objects in scene
    const intersects = raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      // Find parent component
      let obj = intersects[0].object;
      while (obj && !obj.name) {
        obj = obj.parent as any;
      }

      if (obj && obj.name) {
        this.selectComponent(obj.name);
      }
    } else {
      this.deselectComponent();
    }
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Get rendering statistics
   */
  getStats(): {
    fps: number;
    triangles: number;
    memory: any;
  } {
    return {
      fps: Math.round(1000 / 16.67), // Approximate for 60 FPS
      triangles: this.board.components.length * 5000, // Rough estimate
      memory: this.pipeline.getMemoryStats(),
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.pipeline.dispose();
    this.renderer.dispose();
  }
}

/**
 * Create a Three.js renderer for a PCB board
 */
export function createThreePCBRenderer(
  canvas: HTMLCanvasElement,
  board: PCBBoard,
  viewer3DState: Viewer3DState
): ThreePCBViewRenderer {
  return new ThreePCBViewRenderer(canvas, board, viewer3DState);
}
