import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import styles from './LatexEditor.module.css';
import {
  compileLatexProject,
  createDefaultLatexProject,
  type LatexCompileResult,
  type LatexDiagnostic,
  type LatexFile,
  type LatexProject,
} from './latexPreview';

export type {
  LatexCompileResult,
  LatexDiagnostic,
  LatexFile,
  LatexProject,
} from './latexPreview';

export type LatexPdfEngine = 'pdflatex' | 'xelatex';

export interface LatexPdfCompileArtifact {
  engine: LatexPdfEngine;
  fileName: string;
  pdfBase64: string;
  log: string;
}

export interface LatexPdfCompilerOptions {
  engine: LatexPdfEngine;
}

export type LatexPdfCompiler = (
  project: LatexProject,
  options: LatexPdfCompilerOptions
) => Promise<LatexPdfCompileArtifact>;

export interface LatexEditorProps {
  initialProject?: LatexProject;
  onProjectChange?: (project: LatexProject) => void;
  readOnly?: boolean;
  autoCompile?: boolean;
  pdfCompiler?: LatexPdfCompiler;
  pdfEngines?: LatexPdfEngine[];
  initialPdfEngine?: LatexPdfEngine;
}

type ViewerMode = 'pdf' | 'preview';

const LATEX_SNIPPETS = [
  {
    id: 'section',
    label: 'Section',
    content: '\n\\section{New section}\nWrite your section here.\n',
  },
  {
    id: 'equation',
    label: 'Equation',
    content: '\n\\begin{equation}\nE = m c^2\n\\end{equation}\n',
  },
  {
    id: 'figure',
    label: 'Figure',
    content: '\n\\begin{figure}\n\\centering\n\\caption{Describe the figure}\n\\end{figure}\n',
  },
  {
    id: 'table',
    label: 'Table',
    content:
      '\n\\begin{tabular}{l l}\nParameter & Value \\\\\nAlpha & 1.0 \\\\\n\\end{tabular}\n',
  },
];

function createCompileTimestamp(): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

function getSeverityCount(diagnostics: LatexDiagnostic[], severity: LatexDiagnostic['severity']): number {
  return diagnostics.filter((entry) => entry.severity === severity).length;
}

function calculateCaretPosition(content: string, index: number): { line: number; column: number } {
  const beforeCaret = content.slice(0, index);
  const lines = beforeCaret.split(/\r?\n/);

  return {
    line: lines.length,
    column: (lines[lines.length - 1] || '').length + 1,
  };
}

function base64ToObjectUrl(base64: string): string {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown PDF compiler failure.';
}

export const LatexEditor: React.FC<LatexEditorProps> = ({
  initialProject,
  onProjectChange,
  readOnly = false,
  autoCompile = true,
  pdfCompiler,
  pdfEngines = ['pdflatex', 'xelatex'],
  initialPdfEngine = 'pdflatex',
}) => {
  const defaultProject = useMemo(() => initialProject ?? createDefaultLatexProject(), [initialProject]);
  const [project, setProject] = useState<LatexProject>(defaultProject);
  const [activeFileId, setActiveFileId] = useState<string>(defaultProject.mainFileId);
  const [compileResult, setCompileResult] = useState<LatexCompileResult>(() =>
    compileLatexProject(defaultProject)
  );
  const [previewZoom, setPreviewZoom] = useState(100);
  const [autoCompileEnabled, setAutoCompileEnabled] = useState(autoCompile);
  const [lastCompiledAt, setLastCompiledAt] = useState(createCompileTimestamp());
  const [caretPosition, setCaretPosition] = useState({ line: 1, column: 1 });
  const [isCompiling, startTransition] = useTransition();
  const [viewerMode, setViewerMode] = useState<ViewerMode>(pdfCompiler ? 'pdf' : 'preview');
  const [selectedPdfEngine, setSelectedPdfEngine] = useState<LatexPdfEngine>(
    pdfEngines.includes(initialPdfEngine) ? initialPdfEngine : pdfEngines[0] ?? 'pdflatex'
  );
  const [isBuildingPdf, setIsBuildingPdf] = useState(false);
  const [pdfDocumentUrl, setPdfDocumentUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfCompileLog, setPdfCompileLog] = useState<string>('');
  const [pdfCompileError, setPdfCompileError] = useState<string | null>(null);
  const [lastPdfBuildAt, setLastPdfBuildAt] = useState<string | null>(null);

  const lineNumberRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = project.files.find((file) => file.id === activeFileId) ?? project.files[0];
  const mainFile = project.files.find((file) => file.id === project.mainFileId) ?? project.files[0];
  const lineCount = Math.max(1, activeFile?.content.split(/\r?\n/).length ?? 1);
  const canEditActiveFile = Boolean(activeFile && !readOnly && !activeFile.readOnly);
  const canInsertSnippet = canEditActiveFile && activeFile?.language === 'latex';
  const canBuildPdf = Boolean(pdfCompiler && !readOnly);

  useEffect(() => {
    if (!pdfCompiler) {
      setViewerMode('preview');
    }
  }, [pdfCompiler]);

  useEffect(() => {
    return () => {
      if (pdfDocumentUrl) {
        URL.revokeObjectURL(pdfDocumentUrl);
      }
    };
  }, [pdfDocumentUrl]);

  const applyProjectUpdate = (nextProject: LatexProject) => {
    setProject(nextProject);
    onProjectChange?.(nextProject);
  };

  const runPreviewCompile = (nextProject: LatexProject) => {
    startTransition(() => {
      setCompileResult(compileLatexProject(nextProject));
      setLastCompiledAt(createCompileTimestamp());
    });
  };

  useEffect(() => {
    if (!activeFile) {
      return;
    }

    setCaretPosition(calculateCaretPosition(activeFile.content, 0));
  }, [activeFileId, activeFile?.content]);

  useEffect(() => {
    if (!autoCompileEnabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      runPreviewCompile(project);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [project, autoCompileEnabled]);

  const updateActiveFile = (content: string) => {
    if (!activeFile) {
      return;
    }

    const nextProject: LatexProject = {
      ...project,
      files: project.files.map((file) =>
        file.id === activeFile.id ? { ...file, content } : file
      ),
    };

    applyProjectUpdate(nextProject);
  };

  const handleDownloadMainFile = () => {
    if (!mainFile) {
      return;
    }

    const blob = new Blob([mainFile.content], { type: 'application/x-tex' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = mainFile.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSourceChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!canEditActiveFile) {
      return;
    }

    const nextValue = event.target.value;
    updateActiveFile(nextValue);
    setCaretPosition(calculateCaretPosition(nextValue, event.target.selectionStart));
  };

  const handleSelectionUpdate = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    setCaretPosition(calculateCaretPosition(target.value, target.selectionStart));
  };

  const handleEditorScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const handleInsertSnippet = (snippetContent: string) => {
    if (!canInsertSnippet || !activeFile || !textAreaRef.current) {
      return;
    }

    const editor = textAreaRef.current;
    const selectionStart = editor.selectionStart;
    const selectionEnd = editor.selectionEnd;
    const currentContent = activeFile.content;
    const nextContent =
      currentContent.slice(0, selectionStart) +
      snippetContent +
      currentContent.slice(selectionEnd);

    updateActiveFile(nextContent);

    window.requestAnimationFrame(() => {
      const nextCursor = selectionStart + snippetContent.length;
      editor.focus();
      editor.setSelectionRange(nextCursor, nextCursor);
      setCaretPosition(calculateCaretPosition(nextContent, nextCursor));
    });
  };

  const handleBuildPdf = async () => {
    if (!pdfCompiler) {
      return;
    }

    setIsBuildingPdf(true);
    setPdfCompileError(null);

    try {
      const artifact = await pdfCompiler(project, { engine: selectedPdfEngine });
      const nextUrl = base64ToObjectUrl(artifact.pdfBase64);

      setPdfDocumentUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return nextUrl;
      });
      setPdfFileName(artifact.fileName);
      setPdfCompileLog(artifact.log);
      setLastPdfBuildAt(createCompileTimestamp());
      setViewerMode('pdf');
    } catch (error) {
      setPdfCompileError(readErrorMessage(error));
      setPdfCompileLog((error as { log?: string } | undefined)?.log ?? '');
    } finally {
      setIsBuildingPdf(false);
    }
  };

  const previewStatusTone =
    getSeverityCount(compileResult.diagnostics, 'error') > 0
      ? styles.statusError
      : getSeverityCount(compileResult.diagnostics, 'warning') > 0
        ? styles.statusWarning
        : styles.statusReady;

  const pdfStatusTone =
    pdfCompileError
      ? styles.statusError
      : pdfDocumentUrl
        ? styles.statusReady
        : styles.statusWarning;

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>
          <label className={styles.sectionLabel} htmlFor="latex-project-name">
            Project
          </label>
          <input
            id="latex-project-name"
            className={styles.projectNameInput}
            value={project.name}
            onChange={(event) =>
              applyProjectUpdate({
                ...project,
                name: event.target.value,
              })
            }
            disabled={readOnly}
          />
          <p className={styles.projectMeta}>
            Phase 21-22 feature with a real TeX compiler path when the app provides one.
          </p>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionLabel}>Files</span>
            <span className={styles.sectionBadge}>{project.files.length}</span>
          </div>
          <div className={styles.fileList}>
            {project.files.map((file) => (
              <button
                key={file.id}
                type="button"
                className={`${styles.fileItem} ${file.id === activeFile?.id ? styles.fileItemActive : ''}`}
                onClick={() => setActiveFileId(file.id)}
              >
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileLanguage}>{file.language}</span>
                {file.id === project.mainFileId && <span className={styles.mainFileFlag}>main</span>}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionLabel}>Insert blocks</span>
            <span className={styles.sectionHint}>{canInsertSnippet ? 'active' : 'latex only'}</span>
          </div>
          <div className={styles.snippetGrid}>
            {LATEX_SNIPPETS.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                className={styles.snippetButton}
                disabled={!canInsertSnippet}
                onClick={() => handleInsertSnippet(snippet.content)}
              >
                {snippet.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionLabel}>Project stats</span>
          </div>
          <dl className={styles.metricList}>
            <div>
              <dt>Words</dt>
              <dd>{compileResult.stats.wordCount}</dd>
            </div>
            <div>
              <dt>Pages</dt>
              <dd>{compileResult.stats.estimatedPages}</dd>
            </div>
            <div>
              <dt>Sections</dt>
              <dd>{compileResult.stats.sectionCount}</dd>
            </div>
            <div>
              <dt>Equations</dt>
              <dd>{compileResult.stats.equationCount}</dd>
            </div>
          </dl>
        </div>
      </aside>

      <section className={styles.editorColumn}>
        <div className={styles.columnHeader}>
          <div>
            <h2>{activeFile?.name ?? 'No file selected'}</h2>
            <p>
              {activeFile?.language === 'latex'
                ? 'Edit source with instant structure preview while the PDF compiler remains on demand.'
                : 'Support file editing is available; both draft preview and PDF builds use the main TeX entry file.'}
            </p>
          </div>
          <div className={`${styles.compileStatus} ${previewStatusTone}`}>
            <span>{isCompiling ? 'Compiling draft' : 'Draft ready'}</span>
            <small>{lastCompiledAt}</small>
          </div>
        </div>

        <div className={styles.editorShell}>
          <div className={styles.lineNumbers} ref={lineNumberRef} aria-hidden="true">
            {Array.from({ length: lineCount }, (_, index) => (
              <span key={index + 1}>{index + 1}</span>
            ))}
          </div>

          <textarea
            ref={textAreaRef}
            className={styles.editor}
            value={activeFile?.content ?? ''}
            onChange={handleSourceChange}
            onClick={handleSelectionUpdate}
            onKeyUp={handleSelectionUpdate}
            onSelect={handleSelectionUpdate}
            onScroll={handleEditorScroll}
            spellCheck={false}
            readOnly={!canEditActiveFile}
            aria-label="LaTeX source editor"
          />
        </div>

        <div className={styles.statusBar}>
          <div className={styles.statusGroup}>
            <span>
              Ln {caretPosition.line}, Col {caretPosition.column}
            </span>
            <span>{activeFile?.language.toUpperCase() ?? 'TEXT'}</span>
          </div>
          <div className={styles.statusGroup}>
            <span>{compileResult.stats.characterCount} chars</span>
            <span>{compileResult.title}</span>
          </div>
        </div>
      </section>

      <section className={styles.previewColumn}>
        <div className={styles.columnHeader}>
          <div>
            <div className={styles.viewerTabs}>
              {pdfCompiler ? (
                <button
                  type="button"
                  className={`${styles.viewerTab} ${viewerMode === 'pdf' ? styles.viewerTabActive : ''}`}
                  onClick={() => setViewerMode('pdf')}
                >
                  PDF
                </button>
              ) : null}
              <button
                type="button"
                className={`${styles.viewerTab} ${viewerMode === 'preview' ? styles.viewerTabActive : ''}`}
                onClick={() => setViewerMode('preview')}
              >
                Draft
              </button>
            </div>
            <h2>{viewerMode === 'pdf' ? 'PDF Viewer' : 'Draft Viewer'}</h2>
            <p>
              {viewerMode === 'pdf'
                ? 'Compiled through the local TeX engine so the viewer behaves like a real Overleaf output pane.'
                : `Rendered from ${mainFile?.name ?? 'main.tex'} with include expansion and structural diagnostics.`}
            </p>
          </div>

          <div className={styles.previewActions}>
            {viewerMode === 'preview' ? (
              <>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={autoCompileEnabled}
                    onChange={(event) => setAutoCompileEnabled(event.target.checked)}
                  />
                  Auto draft
                </label>
                <select
                  className={styles.zoomSelect}
                  value={previewZoom}
                  onChange={(event) => setPreviewZoom(Number(event.target.value))}
                >
                  <option value={80}>80%</option>
                  <option value={90}>90%</option>
                  <option value={100}>100%</option>
                  <option value={110}>110%</option>
                  <option value={125}>125%</option>
                </select>
                <button type="button" className={styles.secondaryButton} onClick={() => runPreviewCompile(project)}>
                  Refresh Draft
                </button>
              </>
            ) : (
              <>
                <select
                  className={styles.zoomSelect}
                  value={selectedPdfEngine}
                  onChange={(event) => setSelectedPdfEngine(event.target.value as LatexPdfEngine)}
                  disabled={!canBuildPdf || isBuildingPdf}
                >
                  {pdfEngines.map((engine) => (
                    <option key={engine} value={engine}>
                      {engine}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleBuildPdf}
                  disabled={!canBuildPdf || isBuildingPdf}
                >
                  {isBuildingPdf ? 'Building PDF' : 'Build PDF'}
                </button>
              </>
            )}

            <button type="button" className={styles.secondaryButton} onClick={handleDownloadMainFile}>
              Download .tex
            </button>
          </div>
        </div>

        <div className={styles.previewViewport}>
          {viewerMode === 'pdf' && pdfCompiler ? (
            <div className={styles.pdfViewport}>
              <div className={`${styles.compileStatus} ${pdfStatusTone}`}>
                <span>{isBuildingPdf ? 'Building PDF' : pdfDocumentUrl ? 'PDF ready' : 'PDF idle'}</span>
                <small>{lastPdfBuildAt ?? 'not built yet'}</small>
              </div>

              {pdfDocumentUrl ? (
                <iframe
                  className={styles.pdfFrame}
                  src={pdfDocumentUrl}
                  title={pdfFileName ?? 'Compiled PDF'}
                />
              ) : (
                <div className={styles.pdfPlaceholder}>
                  <h3>Build the document</h3>
                  <p>
                    Use the local MiKTeX engine to produce the final PDF. Draft preview remains available in the
                    adjacent tab.
                  </p>
                  {pdfCompileError ? <strong>{pdfCompileError}</strong> : null}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.previewCanvas}>
              <div
                className={styles.previewPaper}
                style={{ transform: `scale(${previewZoom / 100})` }}
              >
                <div
                  className={styles.previewDocument}
                  dangerouslySetInnerHTML={{ __html: compileResult.html }}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.diagnosticsPanel}>
          {pdfCompiler ? (
            <div className={styles.logSection}>
              <div className={styles.sectionHeaderRow}>
                <span className={styles.sectionLabel}>Compiler log</span>
                <div className={styles.diagnosticCounts}>
                  <span>{selectedPdfEngine}</span>
                  <span>{pdfFileName ?? 'no pdf yet'}</span>
                </div>
              </div>
              <pre className={styles.compilerLog}>
                {pdfCompileLog || 'No PDF build has been executed yet.'}
              </pre>
            </div>
          ) : null}

          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionLabel}>Draft diagnostics</span>
            <div className={styles.diagnosticCounts}>
              <span>{getSeverityCount(compileResult.diagnostics, 'error')} errors</span>
              <span>{getSeverityCount(compileResult.diagnostics, 'warning')} warnings</span>
              <span>{getSeverityCount(compileResult.diagnostics, 'info')} info</span>
            </div>
          </div>

          {compileResult.diagnostics.length === 0 ? (
            <div className={styles.emptyState}>No diagnostics. The draft preview structure is consistent.</div>
          ) : (
            <ul className={styles.diagnosticList}>
              {compileResult.diagnostics.map((diagnostic, index) => (
                <li
                  key={`${diagnostic.severity}-${diagnostic.message}-${index}`}
                  className={`${styles.diagnosticItem} ${styles[`diagnostic${capitalize(diagnostic.severity)}`]}`}
                >
                  <div className={styles.diagnosticMeta}>
                    <strong>{diagnostic.severity}</strong>
                    {diagnostic.line ? <span>line {diagnostic.line}</span> : null}
                    {diagnostic.fileId ? <span>{diagnostic.fileId}</span> : null}
                  </div>
                  <p>{diagnostic.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
