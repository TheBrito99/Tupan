/**
 * React Hook for WASM Manufacturing Initialization
 * Phase 20 Task 3: Browser Integration
 *
 * Handles loading the WASM module and providing it to the manufacturing bridge
 */

import { useEffect, useRef, useState } from 'react';
import { WasmModuleLoader, type WasmManufacturingModule } from './wasm-loader';
import { ManufacturingBridge } from './index';

interface UseWasmManufacturingResult {
  bridge: ManufacturingBridge | null;
  wasmLoaded: boolean;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Hook to initialize WASM manufacturing bridge
 * Loads WASM module on first mount and provides manufacturing bridge instance
 */
export function useWasmManufacturing(): UseWasmManufacturingResult {
  const bridgeRef = useRef<ManufacturingBridge | null>(null);
  const [wasmLoaded, setWasmLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeWasm = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔄 Initializing WASM manufacturing module...');

        // Load WASM module
        const loader = WasmModuleLoader.getInstance();
        const wasmModule = await loader.loadWasm();

        if (wasmModule) {
          console.log('✅ WASM module loaded successfully');
          setWasmLoaded(true);

          // Initialize manufacturing bridge with WASM module
          if (!bridgeRef.current) {
            bridgeRef.current = new ManufacturingBridge(wasmModule);
            console.log('✅ Manufacturing bridge initialized with WASM');
          }
        } else {
          console.warn('⚠️ WASM module load failed, manufacturing bridge will use mocks');
          setWasmLoaded(false);

          // Initialize manufacturing bridge with fallback to mocks
          if (!bridgeRef.current) {
            bridgeRef.current = new ManufacturingBridge();
            console.log('✅ Manufacturing bridge initialized with mock implementations');
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error initializing WASM');
        console.error('❌ Failed to initialize WASM:', error);
        setError(error);
        setWasmLoaded(false);

        // Still initialize bridge with mocks as fallback
        if (!bridgeRef.current) {
          bridgeRef.current = new ManufacturingBridge();
          console.log('✅ Manufacturing bridge initialized with mock implementations (fallback)');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeWasm();
  }, []);

  return {
    bridge: bridgeRef.current,
    wasmLoaded,
    error,
    isLoading,
  };
}

export default useWasmManufacturing;
