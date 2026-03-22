import React, { useCallback } from 'react';
import type { LatexPdfCompiler } from '@tupan/ui-framework';
import { LatexEditor } from '@tupan/ui-framework';
import { compileLatexProjectToPdf } from '../services/latexCompiler';
import '../styles/LatexPage.css';

const LatexPage: React.FC = () => {
  const handlePdfCompile = useCallback<LatexPdfCompiler>((project, options) => {
    return compileLatexProjectToPdf(project, options);
  }, []);

  return (
    <div className="latex-page">
      <header className="latex-page__header">
        <div>
          <h1>LaTeX Editor and PDF Compiler</h1>
          <p>
            Overleaf-style writing workspace with a real MiKTeX-backed PDF output pane for local development.
          </p>
        </div>
        <div className="latex-page__phase-note">
          <span>Roadmap context</span>
          <strong>Phases 21-22</strong>
        </div>
      </header>

      <div className="latex-page__body">
        <LatexEditor
          pdfCompiler={handlePdfCompile}
          pdfEngines={['pdflatex', 'xelatex']}
          initialPdfEngine="pdflatex"
        />
      </div>
    </div>
  );
};

export default LatexPage;
