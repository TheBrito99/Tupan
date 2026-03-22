import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { WasmModuleLoader } from '@tupan/core-ts';

/**
 * Global WASM context for all pages
 * Ensures WASM module loads once and is shared across the app
 */
export const WasmContext = createContext<WasmModuleLoader | null>(null);

interface WasmProviderProps {
  children: ReactNode;
}

/**
 * Provider component that initializes WASM module globally
 * Wraps the entire app to ensure WASM is available to all pages
 */
export function WasmProvider({ children }: WasmProviderProps) {
  const [loader, setLoader] = useState<WasmModuleLoader | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeWasm = async () => {
      try {
        setIsLoading(true);
        const instance = WasmModuleLoader.getInstance();
        await instance.loadWasm();
        setLoader(instance);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to load WASM module: ${errorMessage}`);
        console.error('WASM initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeWasm();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="wasm-loading-container">
        <div className="wasm-loading-spinner">
          <div className="spinner"></div>
          <p>Loading computation engine...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="wasm-error-container">
        <div className="error-box">
          <h2>⚠️ Initialization Error</h2>
          <p>{error}</p>
          <p>The application may not function properly. Please refresh the page.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      </div>
    );
  }

  return (
    <WasmContext.Provider value={loader}>
      {children}
    </WasmContext.Provider>
  );
}

/**
 * Hook to access WASM context
 * Use this in pages and components to get the WASM module loader
 */
export function useWasm() {
  const context = React.useContext(WasmContext);
  if (!context) {
    throw new Error('useWasm must be used within a WasmProvider');
  }
  return context;
}
