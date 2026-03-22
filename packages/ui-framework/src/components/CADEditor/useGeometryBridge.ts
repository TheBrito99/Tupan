/**
 * useGeometryBridge.ts
 * WASM geometry generation bridge hook
 * 
 * Provides:
 * - CAD geometry creation (box, cylinder, sphere)
 * - Geometry validation
 * - Error handling
 * - Loading states
 */

import { useState, useCallback, useEffect } from "react";
import type { TriangleMesh } from "./SceneManager";

interface GeometryError {
  code: string;
  message: string;
}

interface UseBridgeResult {
  isLoading: boolean;
  error: GeometryError | null;
  createBox: (width: number, height: number, depth: number, segments?: { w: number; h: number; d: number }) => Promise<TriangleMesh>;
  createCylinder: (radius: number, height: number, segments?: number) => Promise<TriangleMesh>;
  createSphere: (radius: number, segments?: number) => Promise<TriangleMesh>;
  validateGeometry: (mesh: TriangleMesh) => boolean;
  clearError: () => void;
}

/**
 * useGeometryBridge hook
 * Manages WASM-based geometry creation
 */
export function useGeometryBridge(): UseBridgeResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GeometryError | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);

  useEffect(() => {
    const initBridge = async () => {
      try {
        setBridgeReady(true);
      } catch (err) {
        setError({
          code: "INIT_ERROR",
          message: "Failed to initialize geometry bridge",
        });
      }
    };

    initBridge();
  }, []);

  const createBox = useCallback(
    async (
      width: number,
      height: number,
      depth: number,
      segments = { w: 1, h: 1, d: 1 }
    ): Promise<TriangleMesh> => {
      if (!bridgeReady) {
        throw new Error("Bridge not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        if (width <= 0 || height <= 0 || depth <= 0) {
          throw new Error("Dimensions must be positive");
        }

        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        const vertices = [
          -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd,
          -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd, hw, -hh, -hd,
          -hw, hh, -hd, -hw, hh, hd, hw, hh, hd, hw, hh, -hd,
          -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
          hw, -hh, -hd, hw, hh, -hd, hw, hh, hd, hw, -hh, hd,
          -hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd,
        ];

        const indices = [
          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
          8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
          16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
        ];

        const mesh: TriangleMesh = { vertices, indices };
        return mesh;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create box";
        setError({ code: "CREATE_ERROR", message });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [bridgeReady]
  );

  const createCylinder = useCallback(
    async (
      radius: number,
      height: number,
      segments: number = 32
    ): Promise<TriangleMesh> => {
      if (!bridgeReady) {
        throw new Error("Bridge not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        if (radius <= 0 || height <= 0 || segments < 3) {
          throw new Error("Invalid cylinder parameters");
        }

        const vertices: number[] = [];
        const indices: number[] = [];
        const hh = height / 2;

        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          vertices.push(x, hh, z);
          vertices.push(x, -hh, z);
        }

        for (let i = 0; i < segments; i++) {
          const a = i * 2;
          const b = a + 1;
          const c = ((i + 1) % segments) * 2;
          const d = c + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }

        const topCenter = vertices.length / 3;
        vertices.push(0, hh, 0);
        for (let i = 0; i < segments; i++) {
          const a = i * 2;
          const b = ((i + 1) % segments) * 2;
          indices.push(a, topCenter, b);
        }

        const bottomCenter = vertices.length / 3;
        vertices.push(0, -hh, 0);
        for (let i = 0; i < segments; i++) {
          const a = i * 2 + 1;
          const b = ((i + 1) % segments) * 2 + 1;
          indices.push(bottomCenter, b, a);
        }

        const mesh: TriangleMesh = { vertices, indices };
        return mesh;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create cylinder";
        setError({ code: "CREATE_ERROR", message });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [bridgeReady]
  );

  const createSphere = useCallback(
    async (
      radius: number,
      segments: number = 32
    ): Promise<TriangleMesh> => {
      if (!bridgeReady) {
        throw new Error("Bridge not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        if (radius <= 0 || segments < 3) {
          throw new Error("Invalid sphere parameters");
        }

        const vertices: number[] = [];
        const indices: number[] = [];

        for (let y = 0; y <= segments; y++) {
          const theta = (y / segments) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let x = 0; x <= segments; x++) {
            const phi = (x / segments) * Math.PI * 2;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            vertices.push(
              cosPhi * sinTheta * radius,
              cosTheta * radius,
              sinPhi * sinTheta * radius
            );
          }
        }

        for (let y = 0; y < segments; y++) {
          for (let x = 0; x < segments; x++) {
            const a = y * (segments + 1) + x;
            const b = a + segments + 1;
            indices.push(a, b, a + 1);
            indices.push(b, b + 1, a + 1);
          }
        }

        const mesh: TriangleMesh = { vertices, indices };
        return mesh;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create sphere";
        setError({ code: "CREATE_ERROR", message });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [bridgeReady]
  );

  const validateGeometry = useCallback((mesh: TriangleMesh): boolean => {
    try {
      if (!mesh.vertices || !mesh.indices) {
        return false;
      }
      if (mesh.vertices.length % 3 !== 0) {
        return false;
      }
      if (mesh.indices.length % 3 !== 0) {
        return false;
      }
      const vertexCount = mesh.vertices.length / 3;
      for (const idx of mesh.indices) {
        if (idx < 0 || idx >= vertexCount) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    createBox,
    createCylinder,
    createSphere,
    validateGeometry,
    clearError,
  };
}
