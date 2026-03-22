import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type LatexPdfEngine = 'pdflatex' | 'xelatex';

interface CompileProjectFile {
  id: string;
  name: string;
  language: 'latex' | 'bibtex' | 'text';
  content: string;
}

interface CompileProject {
  name: string;
  mainFileId: string;
  files: CompileProjectFile[];
}

interface CompileRequestPayload {
  project: CompileProject;
  engine?: LatexPdfEngine;
}

class LatexCompilerError extends Error {
  log: string;

  constructor(message: string, log = '') {
    super(message);
    this.name = 'LatexCompilerError';
    this.log = log;
  }
}

function normalizeRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/').trim();

  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new LatexCompilerError(`Invalid file path "${input}".`);
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new LatexCompilerError(`Unsafe file path "${input}".`);
  }

  return segments.join('/');
}

function getMainFile(project: CompileProject): CompileProjectFile {
  const explicitMain = project.files.find((file) => file.id === project.mainFileId);
  if (explicitMain) {
    return explicitMain;
  }

  const texFile = project.files.find((file) => file.name.toLowerCase().endsWith('.tex'));
  if (texFile) {
    return texFile;
  }

  throw new LatexCompilerError('Project does not contain a TeX entry file.');
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

function formatCommandLog(
  command: string,
  args: string[],
  result: { code: number; stdout: string; stderr: string }
): string {
  const sections = [`$ ${command} ${args.join(' ')}`, `exit code: ${result.code}`];

  if (result.stdout.trim()) {
    sections.push(result.stdout.trim());
  }

  if (result.stderr.trim()) {
    sections.push(result.stderr.trim());
  }

  return sections.join('\n');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function compileProjectToPdf(project: CompileProject, engine: LatexPdfEngine) {
  if (!Array.isArray(project.files) || project.files.length === 0) {
    throw new LatexCompilerError('Project does not contain any files.');
  }

  const mainFile = getMainFile(project);
  const tempRoot = path.join(os.tmpdir(), `tupan-latex-${randomUUID()}`);
  const sourceRoot = path.join(tempRoot, 'src');
  const outputRoot = path.join(tempRoot, 'out');
  const logs: string[] = [];

  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.mkdir(outputRoot, { recursive: true });

  try {
    for (const file of project.files) {
      const relativeName = normalizeRelativePath(file.name);
      const absolutePath = path.join(sourceRoot, relativeName);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, file.content, 'utf8');
    }

    const mainRelativePath = normalizeRelativePath(mainFile.name);
    const mainStem = path.parse(mainRelativePath).name;
    const latexArgs = [
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-file-line-error',
      '-output-directory',
      outputRoot,
      mainRelativePath,
    ];

    const firstPass = await runCommand(engine, latexArgs, sourceRoot);
    logs.push(formatCommandLog(engine, latexArgs, firstPass));

    if (firstPass.code !== 0) {
      throw new LatexCompilerError(`The ${engine} run failed on the first pass.`, logs.join('\n\n'));
    }

    const auxPath = path.join(outputRoot, `${mainStem}.aux`);
    if (await fileExists(auxPath)) {
      const auxContent = await fs.readFile(auxPath, 'utf8');
      if (/\\citation|\\bibdata/.test(auxContent)) {
        const bibtexResult = await runCommand('bibtex', [mainStem], outputRoot);
        logs.push(formatCommandLog('bibtex', [mainStem], bibtexResult));

        if (bibtexResult.code !== 0) {
          throw new LatexCompilerError('BibTeX failed while building the document.', logs.join('\n\n'));
        }
      }
    }

    for (let pass = 0; pass < 2; pass += 1) {
      const subsequentPass = await runCommand(engine, latexArgs, sourceRoot);
      logs.push(formatCommandLog(engine, latexArgs, subsequentPass));

      if (subsequentPass.code !== 0) {
        throw new LatexCompilerError(
          `The ${engine} run failed on pass ${pass + 2}.`,
          logs.join('\n\n')
        );
      }
    }

    const pdfPath = path.join(outputRoot, `${mainStem}.pdf`);
    if (!(await fileExists(pdfPath))) {
      throw new LatexCompilerError('Compilation finished without producing a PDF.', logs.join('\n\n'));
    }

    const logPath = path.join(outputRoot, `${mainStem}.log`);
    if (await fileExists(logPath)) {
      const engineLog = await fs.readFile(logPath, 'utf8');
      logs.push(engineLog.trim());
    }

    const pdfBuffer = await fs.readFile(pdfPath);

    return {
      engine,
      fileName: `${mainStem}.pdf`,
      pdfBase64: pdfBuffer.toString('base64'),
      log: logs.filter(Boolean).join('\n\n'),
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function installCompilerMiddleware(middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }) {
  middlewares.use(async (request, response, next) => {
    const method = request.method ?? 'GET';
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    if (method !== 'POST' || requestUrl.pathname !== '/api/latex/compile') {
      next();
      return;
    }

    try {
      const payload = await readJsonBody<CompileRequestPayload>(request);
      const engine = payload.engine === 'xelatex' ? 'xelatex' : 'pdflatex';
      const artifact = await compileProjectToPdf(payload.project, engine);

      sendJson(response, 200, {
        success: true,
        artifact,
      });
    } catch (error) {
      if (error instanceof LatexCompilerError) {
        sendJson(response, 500, {
          success: false,
          error: error.message,
          log: error.log,
        });
        return;
      }

      sendJson(response, 500, {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected compiler failure.',
      });
    }
  });
}

export function latexCompilerPlugin(): Plugin {
  return {
    name: 'tupan-latex-compiler',
    configureServer(server) {
      installCompilerMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      installCompilerMiddleware(server.middlewares);
    },
  };
}
