import type {
  LatexPdfCompileArtifact,
  LatexPdfCompiler,
  LatexPdfCompilerOptions,
  LatexProject,
} from '@tupan/ui-framework';

interface LatexCompileApiSuccess {
  success: true;
  artifact: LatexPdfCompileArtifact;
}

interface LatexCompileApiFailure {
  success: false;
  error: string;
  log?: string;
}

type LatexCompileApiResponse = LatexCompileApiSuccess | LatexCompileApiFailure;

function createCompilerError(message: string, log?: string): Error & { log?: string } {
  const error = new Error(message) as Error & { log?: string };
  if (log) {
    error.log = log;
  }
  return error;
}

export const compileLatexProjectToPdf: LatexPdfCompiler = async (
  project: LatexProject,
  options: LatexPdfCompilerOptions
) => {
  const response = await fetch('/api/latex/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project,
      engine: options.engine,
    }),
  });

  let payload: LatexCompileApiResponse | null = null;

  try {
    payload = (await response.json()) as LatexCompileApiResponse;
  } catch {
    if (!response.ok) {
      throw createCompilerError(`Compiler request failed with status ${response.status}.`);
    }
  }

  if (!response.ok || !payload || !payload.success) {
    throw createCompilerError(
      payload && !payload.success ? payload.error : `Compiler request failed with status ${response.status}.`,
      payload && !payload.success ? payload.log : undefined
    );
  }

  return payload.artifact;
};
