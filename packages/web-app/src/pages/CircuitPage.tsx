/**
 * Electrical Circuit Simulator Page
 * Phase 1A: Integrates CircuitEditor with WASM backend
 */

import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WasmContext } from '../contexts/WasmContext';
import { CircuitEditor } from '@tupan/ui-framework/components/CircuitEditor';
import '../styles/EditorPage.css';

const CircuitPage: React.FC = () => {
  const wasmLoader = useContext(WasmContext);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wasmLoader) {
      try {
        setIsReady(true);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(`Failed to initialize electrical simulator: ${errorMsg}`);
      }
    }
  }, [wasmLoader]);

  if (!isReady) {
    return (
      <div className="editor-page loading">
        <div className="loading-spinner">
          <p>Loading Circuit Simulator...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-page error">
        <div className="error-box">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <Link to="/" className="back-button">← Back to Dashboard</Link>
        <h1>Electrical Circuit Simulator</h1>
        <p>Design and simulate circuits using Modified Nodal Analysis (MNA)</p>
      </header>

      <main className="editor-main">
        <CircuitEditor />
      </main>
    </div>
  );
};

export default CircuitPage;
