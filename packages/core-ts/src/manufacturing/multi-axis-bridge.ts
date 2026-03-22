/**
 * Multi-Axis CAM WASM Bridge
 * Task 7: Type-safe TypeScript wrapper for Rust multi-axis WASM bindings
 *
 * Provides clean API for JavaScript/React to interact with multi-axis manufacturing
 */

import { WasmModuleLoader } from '../wasm-bridge';

export interface Point6D {
  x: number;
  y: number;
  z: number;
  a: number;  // Rotation around X (deg)
  b: number;  // Rotation around Y (deg)
  c: number;  // Rotation around Z (deg)
}

export interface ToolOrientation {
  lead_angle: number;  // Tilt from vertical (deg)
  tilt_angle: number;  // Side tilt (deg)
}

export interface InverseKinematicsRequest {
  tcp_x: number;
  tcp_y: number;
  tcp_z: number;
  lead_angle: number;
  tilt_angle: number;
  machine_type: '3-axis' | '4-axis' | '5-axis-ac' | '5-axis-bc';
}

export interface InverseKinematicsResult {
  success: boolean;
  a: number;
  b: number;
  c: number;
  error?: string;
}

export interface CollisionCheckResult {
  has_collision: boolean;
  collision_type: 'none' | 'tool_workpiece' | 'tool_fixture' | 'spindle_workpiece';
  clearance_mm: number;
}

export interface ToolpathPoint {
  x: number;
  y: number;
  z: number;
  a?: number;
  b?: number;
  c?: number;
}

export interface ToolpathResult {
  success: boolean;
  toolpath_points: number;
  total_time_minutes: number;
  index_angles?: number[];
  simultaneous_5axis?: boolean;
  tool_orientation_changes?: number;
}

export interface FeatureRecognitionResult {
  success: boolean;
  features_recognized: Array<{
    type: 'Pocket' | 'Hole' | 'Boss' | 'Slot' | 'Surface' | 'Thread' | 'EdgeModification';
    id: string;
    depth?: number;
    diameter?: number;
    height?: number;
    width?: number;
    length?: number;
  }>;
  total_features: number;
}

export interface CAMOperation {
  feature_id: string;
  type: 'Milling' | 'Drilling' | 'Tapping' | 'Profiling' | 'Roughing' | 'Finishing';
  tool_diameter: number;
  cutting_speed?: number;
  feed_rate?: number;
}

export interface AutoGenerateOperationsResult {
  success: boolean;
  operations_generated: CAMOperation[];
  total_time_minutes: number;
  total_operations: number;
}

/**
 * Multi-Axis CAM WASM Bridge
 * Provides type-safe interface to Rust WASM bindings
 */
export class MultiAxisBridge {
  private static instance: MultiAxisBridge;
  private wasmModule: any = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MultiAxisBridge {
    if (!MultiAxisBridge.instance) {
      MultiAxisBridge.instance = new MultiAxisBridge();
    }
    return MultiAxisBridge.instance;
  }

  /**
   * Initialize WASM module
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const loader = WasmModuleLoader.getInstance();
      const wasm = await loader.loadWasm();

      if (wasm && wasm.WasmMultiAxisSimulator) {
        this.wasmModule = new wasm.WasmMultiAxisSimulator();
        this.isInitialized = true;
        console.log('MultiAxisBridge initialized successfully');
      } else {
        throw new Error('WasmMultiAxisSimulator not found in WASM module');
      }
    } catch (error) {
      console.error('Failed to initialize MultiAxisBridge:', error);
      throw error;
    }
  }

  /**
   * Calculate inverse kinematics for multi-axis machining
   */
  async inverseKinematics(request: InverseKinematicsRequest): Promise<InverseKinematicsResult> {
    if (!this.isInitialized) await this.initialize();

    try {
      const requestJson = JSON.stringify(request);
      const resultJson = this.wasmModule.inverse_kinematics(requestJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error('Inverse kinematics failed:', error);
      return {
        success: false,
        a: 0,
        b: 0,
        c: 0,
        error: String(error),
      };
    }
  }

  /**
   * Generate 4-axis indexed toolpath
   */
  async generate4AxisToolpath(request: any): Promise<ToolpathResult> {
    if (!this.isInitialized) await this.initialize();

    try {
      const requestJson = JSON.stringify(request);
      const resultJson = this.wasmModule.generate_4axis_toolpath(requestJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error('4-axis toolpath generation failed:', error);
      return {
        success: false,
        toolpath_points: 0,
        total_time_minutes: 0,
      };
    }
  }

  /**
   * Generate 5-axis contouring toolpath
   */
  async generate5AxisToolpath(request: any): Promise<ToolpathResult> {
    if (!this.isInitialized) await this.initialize();

    try {
      const requestJson = JSON.stringify(request);
      const resultJson = this.wasmModule.generate_5axis_toolpath(requestJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error('5-axis toolpath generation failed:', error);
      return {
        success: false,
        toolpath_points: 0,
        total_time_minutes: 0,
      };
    }
  }

  /**
   * Check 6DOF collision detection
   */
  async checkCollision6DOF(position: Point6D): Promise<CollisionCheckResult> {
    if (!this.isInitialized) await this.initialize();

    try {
      const positionJson = JSON.stringify(position);
      const resultJson = this.wasmModule.check_collision_6dof(positionJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error('Collision check failed:', error);
      return {
        has_collision: false,
        collision_type: 'none',
        clearance_mm: 0,
      };
    }
  }

  /**
   * Recognize features from BREP CAD model
   */
  async recognizeFeatures(brepJson: string): Promise<FeatureRecognitionResult> {
    if (!this.isInitialized) await this.initialize();

    try {
      const resultJson = this.wasmModule.recognize_features(brepJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error('Feature recognition failed:', error);
      return {
        success: false,
        features_recognized: [],
        total_features: 0,
      };
    }
  }

  /**
   * Auto-generate CAM operations from recognized features
   */
  async autoGenerateOperations(
    featuresJson: string
  ): Promise<AutoGenerateOperationsResult> {
    if (!this.isInitialized) await this.initialize();

    try {
      const resultJson = this.wasmModule.auto_generate_operations(featuresJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error('Auto-generate operations failed:', error);
      return {
        success: false,
        operations_generated: [],
        total_time_minutes: 0,
        total_operations: 0,
      };
    }
  }

  /**
   * Get available machine types
   */
  async getMachineTypes(): Promise<string[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      const typesJson = this.wasmModule.get_machine_types();
      return JSON.parse(typesJson);
    } catch (error) {
      console.error('Failed to get machine types:', error);
      return ['3-axis', '4-axis', '5-axis-ac', '5-axis-bc'];
    }
  }

  /**
   * Get available cutting strategies
   */
  async getStrategyTypes(): Promise<string[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      const strategiesJson = this.wasmModule.get_strategy_types();
      return JSON.parse(strategiesJson);
    } catch (error) {
      console.error('Failed to get strategy types:', error);
      return [
        'Facing',
        'Adaptive',
        'Pencil',
        'Profiling',
        'Pocketing',
        'Drilling',
        'Indexed4Axis',
        'SwarmMilling',
        '5AxisContouring',
      ];
    }
  }

  /**
   * Get version information
   */
  async getVersion(): Promise<string> {
    if (!this.isInitialized) await this.initialize();

    try {
      return this.wasmModule.version();
    } catch (error) {
      return 'Unknown';
    }
  }
}

// Utility functions for static queries

/**
 * Get all available machine types (static)
 */
export async function getMachineTypes(): Promise<string[]> {
  const bridge = MultiAxisBridge.getInstance();
  return bridge.getMachineTypes();
}

/**
 * Get all available hole types (static)
 */
export async function getHoleTypes(): Promise<string[]> {
  try {
    const loader = WasmModuleLoader.getInstance();
    const wasm = await loader.loadWasm();
    const typesJson = wasm.get_hole_types();
    return JSON.parse(typesJson);
  } catch (error) {
    return ['Through', 'Blind', 'Counterbore', 'Countersink', 'Spotface'];
  }
}

/**
 * Get all available tool vendors (static)
 */
export async function getToolVendors(): Promise<string[]> {
  try {
    const loader = WasmModuleLoader.getInstance();
    const wasm = await loader.loadWasm();
    const vendorsJson = wasm.get_vendor_list();
    return JSON.parse(vendorsJson);
  } catch (error) {
    return [
      'Sandvik',
      'Kennametal',
      'Seco',
      'Iscar',
      'Mitsubishi',
      'OSG',
      'YG1',
      'Harvey',
      'Helical',
    ];
  }
}

/**
 * Create a simple Point6D
 */
export function createPoint6D(
  x: number,
  y: number,
  z: number,
  a: number = 0,
  b: number = 0,
  c: number = 0
): Point6D {
  return { x, y, z, a, b, c };
}

/**
 * Create a linear (3-axis) Point6D
 */
export function createLinearPoint(x: number, y: number, z: number): Point6D {
  return { x, y, z, a: 0, b: 0, c: 0 };
}

/**
 * Calculate distance between two points
 */
export function point6DDistance(p1: Point6D, p2: Point6D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if point is in safe zone (above workpiece)
 */
export function isInSafeZone(point: Point6D, workpieceTop: number): boolean {
  return point.z > workpieceTop;
}
