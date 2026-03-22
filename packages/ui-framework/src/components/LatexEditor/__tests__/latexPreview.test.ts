import { describe, expect, it } from 'vitest';
import { compileLatexProject, createDefaultLatexProject } from '../latexPreview';

describe('latexPreview', () => {
  it('compiles the default project with include expansion', () => {
    const project = createDefaultLatexProject();
    const result = compileLatexProject(project);

    expect(result.title).toBe('Tupan Engineering Note');
    expect(result.compiledSource).toContain('\\subsection{Imported section}');
    expect(result.html).toContain('Imported section');
    expect(result.stats.sectionCount).toBeGreaterThan(0);
  });

  it('reports malformed document structure', () => {
    const project = createDefaultLatexProject();
    const brokenProject = {
      ...project,
      files: project.files.map((file) =>
        file.id === project.mainFileId
          ? {
              ...file,
              content: [
                '\\documentclass{article}',
                '\\begin{document}',
                '\\section{Broken',
                '\\end{document}',
              ].join('\n'),
            }
          : file
      ),
    };

    const result = compileLatexProject(brokenProject);

    expect(result.diagnostics.some((entry) => entry.message.includes('Brace balance check failed'))).toBe(true);
  });
});
