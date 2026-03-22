import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WasmContext } from '../contexts/WasmContext';
import { MechanicalEditor } from '@tupan/ui-framework/components/MechanicalEditor';
import '../styles/EditorPage.css';

/**
 * Mechanical Simulator Page
 * Phase 2A: Spring-mass-damper systems and rigid body dynamics
 */
const MechanicalPage: React.FC = () => {
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
        setError(`Failed to initialize mechanical system: ${errorMsg}`);
      }
    }
  }, [wasmLoader]);

  if (!isReady) {
    return (
      <div className="editor-page loading">
        <div className="loading-spinner">
          <p>Loading Mechanical Simulator...</p>
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
        <h1>Mechanical Simulator</h1>
        <p>Design spring-mass-damper systems and analyze dynamics</p>
      </header>

      <main className="editor-main">
        <MechanicalEditor />
      </main>
    </div>
  );
};

export default MechanicalPage;
