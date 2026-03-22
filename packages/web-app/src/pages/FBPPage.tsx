import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WasmContext } from '../contexts/WasmContext';
import { FBPEditor } from '@tupan/ui-framework/components/FBPEditor';
import '../styles/EditorPage.css';

/**
 * Flow-Based Programming (FBP) Page
 * Phase 3B: Node-RED style data flows with computer vision capabilities
 */
const FBPPage: React.FC = () => {
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
        setError(`Failed to initialize FBP editor: ${errorMsg}`);
      }
    }
  }, [wasmLoader]);

  if (!isReady) {
    return (
      <div className="editor-page loading">
        <div className="loading-spinner">
          <p>Loading Flow-Based Programming...</p>
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
        <h1>Flow-Based Programming</h1>
        <p>Design Node-RED style data flows with computer vision capabilities</p>
      </header>

      <main className="editor-main">
        <FBPEditor />
      </main>
    </div>
  );
};

export default FBPPage;
