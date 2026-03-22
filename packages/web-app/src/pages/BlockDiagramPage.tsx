import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WasmContext } from '../contexts/WasmContext';
import { BlockDiagramEditor } from '@tupan/ui-framework/components/BlockDiagramEditor';
import '../styles/EditorPage.css';

/**
 * Block Diagram Simulator Page
 * Phase 2A: Simulink-like control system design with 57+ blocks
 */
const BlockDiagramPage: React.FC = () => {
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
        setError(`Failed to initialize block diagram system: ${errorMsg}`);
      }
    }
  }, [wasmLoader]);

  if (!isReady) {
    return (
      <div className="editor-page loading">
        <div className="loading-spinner">
          <p>Loading Block Diagram Simulator...</p>
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
        <h1>Block Diagram Simulator</h1>
        <p>Create Simulink-like block diagrams with 57+ blocks for control systems</p>
      </header>

      <main className="editor-main">
        <BlockDiagramEditor />
      </main>
    </div>
  );
};

export default BlockDiagramPage;
