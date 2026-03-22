import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WasmContext } from '../contexts/WasmContext';
import { PCBDesigner } from '@tupan/ui-framework/components/PCBDesigner';
import '../styles/EditorPage.css';

/**
 * PCB Design Page
 * Phase 1B: PCB layout with schematic and 3D visualization
 */
const PCBPage: React.FC = () => {
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
        setError(`Failed to initialize PCB designer: ${errorMsg}`);
      }
    }
  }, [wasmLoader]);

  if (!isReady) {
    return (
      <div className="editor-page loading">
        <div className="loading-spinner">
          <p>Loading PCB Designer...</p>
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
        <h1>PCB Designer</h1>
        <p>Design PCB layouts with schematic capture, routing, and 3D visualization</p>
      </header>

      <main className="editor-main">
        <PCBDesigner />
      </main>
    </div>
  );
};

export default PCBPage;
