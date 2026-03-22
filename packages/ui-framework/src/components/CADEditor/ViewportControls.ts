/**
 * ViewportControls.ts
 * Camera and viewport management for Three.js scenes
 * 
 * Handles:
 * - Orbit rotation around target
 * - Pan movement in view plane
 * - Smooth zoom with distance limits
 * - View presets (top, front, right, isometric)
 * - Animated transitions between views
 */

import type * as THREE from "three";

/**
 * Represents a camera view preset
 */
interface ViewPreset {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  transitionDuration: number;
}

/**
 * Manages camera controls and view transitions
 */
export class ViewportControls {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private initialPosition: THREE.Vector3;
  private initialTarget: THREE.Vector3;
  private minZoom: number;
  private maxZoom: number;
  private rotationSpeed: number;
  private panSpeed: number;
  private zoomSpeed: number;
  private isAnimating: boolean;
  private animationStartTime: number;
  private animationDuration: number;
  private animationStart: { position: THREE.Vector3; target: THREE.Vector3 };

  /**
   * Create a new viewport controls instance
   */
  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.initialPosition = camera.position.clone();
    this.initialTarget = new THREE.Vector3(0, 0, 0);
    this.minZoom = 0.1;
    this.maxZoom = 1000;
    this.rotationSpeed = 0.005;
    this.panSpeed = 0.001;
    this.zoomSpeed = 0.1;
    this.isAnimating = false;
    this.animationStartTime = 0;
    this.animationDuration = 0;
    this.animationStart = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  }

  /**
   * Rotate camera around target point
   */
  orbitRotate(deltaX: number, deltaY: number): void {
    if (this.isAnimating) return;

    const position = this.camera.position.clone().sub(this.target);
    
    let radius = position.length();
    let theta = Math.atan2(position.x, position.z);
    let phi = Math.acos(position.y / radius);

    theta -= deltaX * this.rotationSpeed;
    phi -= deltaY * this.rotationSpeed;

    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

    position.x = radius * Math.sin(phi) * Math.sin(theta);
    position.y = radius * Math.cos(phi);
    position.z = radius * Math.sin(phi) * Math.cos(theta);

    this.camera.position.copy(position.add(this.target));
    this.camera.lookAt(this.target);
  }

  /**
   * Pan camera in the view plane
   */
  pan(deltaX: number, deltaY: number): void {
    if (this.isAnimating) return;

    const cameraDirection = this.camera.position.clone().sub(this.target);
    const distance = cameraDirection.length();
    
    const right = new THREE.Vector3()
      .crossVectors(this.camera.up, cameraDirection)
      .normalize();
    const up = this.camera.up.clone().normalize();

    right.multiplyScalar(-deltaX * distance * this.panSpeed);
    up.multiplyScalar(deltaY * distance * this.panSpeed);

    this.target.add(right).add(up);
    this.camera.position.add(right).add(up);
  }

  /**
   * Zoom in/out (adjust distance from target)
   */
  zoom(delta: number): void {
    if (this.isAnimating) return;

    const direction = this.camera.position.clone().sub(this.target);
    const distance = direction.length();
    const newDistance = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, distance * (1 + delta * this.zoomSpeed))
    );

    direction.normalize().multiplyScalar(newDistance);
    this.camera.position.copy(this.target.clone().add(direction));
  }

  /**
   * Animate zoom to fit geometry in view
   */
  zoomToFit(boundingBox: { min: THREE.Vector3; max: THREE.Vector3 }): void {
    const center = new THREE.Vector3()
      .addVectors(boundingBox.min, boundingBox.max)
      .multiplyScalar(0.5);

    const size = boundingBox.max.clone().sub(boundingBox.min);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let distance = maxDim / 2 / Math.tan(fov / 2);
    distance *= 1.5;

    const direction = this.camera.position
      .clone()
      .sub(this.target)
      .normalize()
      .multiplyScalar(distance);

    this.animateTo(center.clone().add(direction), center);
  }

  /**
   * Set view to a preset
   */
  setViewPreset(preset: "top" | "front" | "right" | "isometric"): void {
    const distance = this.camera.position.clone().sub(this.target).length() || 100;
    
    const presets: Record<string, ViewPreset> = {
      top: {
        position: { x: 0, y: distance, z: 0 },
        target: { x: 0, y: 0, z: 0 },
        transitionDuration: 500,
      },
      front: {
        position: { x: 0, y: 0, z: distance },
        target: { x: 0, y: 0, z: 0 },
        transitionDuration: 500,
      },
      right: {
        position: { x: distance, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 },
        transitionDuration: 500,
      },
      isometric: {
        position: {
          x: distance * Math.cos(Math.PI / 4) * Math.sin(Math.PI / 6),
          y: distance * Math.cos(Math.PI / 6),
          z: distance * Math.sin(Math.PI / 4) * Math.sin(Math.PI / 6),
        },
        target: { x: 0, y: 0, z: 0 },
        transitionDuration: 500,
      },
    };

    const p = presets[preset];
    if (p) {
      const newPosition = new THREE.Vector3(p.position.x, p.position.y, p.position.z);
      const newTarget = new THREE.Vector3(p.target.x, p.target.y, p.target.z);
      this.animateTo(newPosition, newTarget, p.transitionDuration);
    }
  }

  /**
   * Reset camera to initial view
   */
  reset(): void {
    this.animateTo(this.initialPosition.clone(), this.initialTarget.clone(), 500);
  }

  /**
   * Animate camera to new position and target
   */
  private animateTo(
    position: THREE.Vector3,
    target: THREE.Vector3,
    duration: number = 500
  ): void {
    this.isAnimating = true;
    this.animationStartTime = Date.now();
    this.animationDuration = duration;
    this.animationStart = {
      position: this.camera.position.clone(),
      target: this.target.clone(),
    };

    const animate = () => {
      const elapsed = Date.now() - this.animationStartTime;
      const progress = Math.min(1, elapsed / this.animationDuration);

      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(
        this.animationStart.position,
        position,
        easeProgress
      );

      this.target.lerpVectors(
        this.animationStart.target,
        target,
        easeProgress
      );

      this.camera.lookAt(this.target);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
      }
    };

    animate();
  }

  /**
   * Get current camera position
   */
  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  /**
   * Get current target
   */
  getTarget(): THREE.Vector3 {
    return this.target.clone();
  }

  /**
   * Set rotation speed
   */
  setRotationSpeed(speed: number): void {
    this.rotationSpeed = speed;
  }

  /**
   * Set pan speed
   */
  setPanSpeed(speed: number): void {
    this.panSpeed = speed;
  }

  /**
   * Set zoom speed
   */
  setZoomSpeed(speed: number): void {
    this.zoomSpeed = speed;
  }

  /**
   * Set zoom limits
   */
  setZoomLimits(min: number, max: number): void {
    this.minZoom = min;
    this.maxZoom = max;
  }

  /**
   * Update camera up vector
   */
  setUp(x: number, y: number, z: number): void {
    this.camera.up.set(x, y, z);
  }
}
