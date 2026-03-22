export type LatexFileLanguage = 'latex' | 'bibtex' | 'text';

export interface LatexFile {
  id: string;
  name: string;
  language: LatexFileLanguage;
  content: string;
  readOnly?: boolean;
}

export interface LatexProject {
  name: string;
  mainFileId: string;
  files: LatexFile[];
}

export interface LatexDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  fileId?: string;
  line?: number;
}

export interface LatexCompileStats {
  wordCount: number;
  characterCount: number;
  estimatedPages: number;
  sectionCount: number;
  equationCount: number;
}

export interface LatexCompileResult {
  html: string;
  diagnostics: LatexDiagnostic[];
  stats: LatexCompileStats;
  title: string;
  compiledSource: string;
}

const DEFAULT_MAIN_FILE = String.raw`\documentclass[11pt]{article}
\title{Tupan Engineering Note}
\author{Systems Team}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
Use this workspace for requirements, derivations, test procedures, and design notes.
\end{abstract}

\section{Problem statement}
Describe the system, its constraints, and the measurable outcomes. Inline math like $V = IR$ is rendered in the preview.

\subsection{Objectives}
\begin{itemize}
\item Record assumptions and boundary conditions
\item Explain the modeling approach
\item Summarize the verification evidence
\end{itemize}

\section{Core equation}
\begin{equation}
P = V I
\end{equation}

\input{sections/introduction}

\end{document}
`;

const DEFAULT_INCLUDED_FILE = String.raw`\subsection{Imported section}
This content is loaded through \texttt{\input{...}} so the editor can handle multi-file documents.
`;

const DEFAULT_BIB_FILE = String.raw`@book{tupan2026,
  title={Tupan Engineering Notes},
  author={Tupan Team},
  year={2026}
}
`;

const SUPPORTED_ENVIRONMENTS = new Set([
  'abstract',
  'align',
  'displaymath',
  'enumerate',
  'equation',
  'itemize',
  'quote',
  'verbatim',
]);

export function createDefaultLatexProject(): LatexProject {
  return {
    name: 'Untitled Document',
    mainFileId: 'main',
    files: [
      {
        id: 'main',
        name: 'main.tex',
        language: 'latex',
        content: DEFAULT_MAIN_FILE,
      },
      {
        id: 'intro',
        name: 'sections/introduction.tex',
        language: 'latex',
        content: DEFAULT_INCLUDED_FILE,
      },
      {
        id: 'refs',
        name: 'references.bib',
        language: 'bibtex',
        content: DEFAULT_BIB_FILE,
      },
    ],
  };
}

interface LatexMetadata {
  title: string;
  author: string;
  date: string;
}

type LatexBlock =
  | { type: 'title' }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'abstract'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'equation'; text: string }
  | { type: 'verbatim'; text: string }
  | { type: 'toc' };

interface ParseContext {
  metadata: LatexMetadata;
  diagnostics: LatexDiagnostic[];
  mainFileId: string;
}

export function compileLatexProject(project: LatexProject): LatexCompileResult {
  const diagnostics: LatexDiagnostic[] = [];
  const mainFile = project.files.find((file) => file.id === project.mainFileId) ?? project.files[0];

  if (!mainFile) {
    return {
      html: '<article><p>No files available.</p></article>',
      diagnostics: [{ severity: 'error', message: 'Project has no files.' }],
      stats: {
        wordCount: 0,
        characterCount: 0,
        estimatedPages: 0,
        sectionCount: 0,
        equationCount: 0,
      },
      title: project.name,
      compiledSource: '',
    };
  }

  const compiledSource = resolveIncludes(project, mainFile.id, diagnostics);
  const sanitizedSource = stripComments(compiledSource);
  const metadata = extractMetadata(sanitizedSource);
  const body = extractDocumentBody(sanitizedSource, diagnostics, mainFile.id);
  const blocks = parseLatexBlocks(body, {
    metadata,
    diagnostics,
    mainFileId: mainFile.id,
  });
  const headings = blocks
    .filter((block): block is Extract<LatexBlock, { type: 'heading' }> => block.type === 'heading')
    .map((block) => ({
      level: block.level,
      text: block.text,
      slug: slugify(block.text),
    }));

  const html = renderBlocks(blocks, metadata, headings);
  const stats = {
    wordCount: countWords(body),
    characterCount: body.length,
    estimatedPages: Math.max(1, Math.ceil(Math.max(countWords(body), 1) / 450)),
    sectionCount: headings.length,
    equationCount: blocks.filter((block) => block.type === 'equation').length,
  };

  validateDocumentStructure(sanitizedSource, diagnostics, mainFile.id);

  return {
    html,
    diagnostics,
    stats,
    title: metadata.title || project.name,
    compiledSource,
  };
}

function resolveIncludes(
  project: LatexProject,
  fileId: string,
  diagnostics: LatexDiagnostic[],
  stack: string[] = []
): string {
  const file = project.files.find((entry) => entry.id === fileId);
  if (!file) {
    diagnostics.push({
      severity: 'error',
      message: `Included file "${fileId}" was not found.`,
    });
    return '';
  }

  const currentPath = file.name;
  if (stack.includes(currentPath)) {
    diagnostics.push({
      severity: 'error',
      fileId: file.id,
      message: `Circular include detected: ${[...stack, currentPath].join(' -> ')}`,
    });
    return '';
  }

  return file.content.replace(/\\(input|include)\{([^}]+)\}/g, (_match, _command, includeTarget, offset) => {
    const normalizedTarget = normalizeIncludeTarget(includeTarget);
    const targetFile = findFileByName(project, normalizedTarget);

    if (!targetFile) {
      diagnostics.push({
        severity: 'warning',
        fileId: file.id,
        line: lineFromIndex(file.content, offset),
        message: `Could not resolve include "${includeTarget}".`,
      });
      return '';
    }

    return resolveIncludes(project, targetFile.id, diagnostics, [...stack, currentPath]);
  });
}

function normalizeIncludeTarget(name: string): string {
  const normalized = name.replace(/\\/g, '/').trim();
  return /\.[a-z0-9]+$/i.test(normalized) ? normalized : `${normalized}.tex`;
}

function findFileByName(project: LatexProject, targetName: string): LatexFile | undefined {
  return project.files.find((file) => {
    const normalized = file.name.replace(/\\/g, '/');
    return normalized === targetName || normalized.endsWith(`/${targetName}`);
  });
}

function stripComments(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      let commentIndex = -1;

      for (let index = 0; index < line.length; index += 1) {
        if (line[index] === '%' && line[index - 1] !== '\\') {
          commentIndex = index;
          break;
        }
      }

      return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    })
    .join('\n');
}

function extractMetadata(source: string): LatexMetadata {
  const title = readCommandArgument(source, 'title') || 'Untitled Document';
  const author = readCommandArgument(source, 'author') || 'Anonymous';
  const rawDate = readCommandArgument(source, 'date') || '';

  return {
    title,
    author,
    date: rawDate === '\\today' ? formatToday() : rawDate || formatToday(),
  };
}

function readCommandArgument(source: string, command: string): string | undefined {
  const commandIndex = source.indexOf(`\\${command}`);
  if (commandIndex === -1) {
    return undefined;
  }

  const braceIndex = source.indexOf('{', commandIndex);
  if (braceIndex === -1) {
    return undefined;
  }

  const parsed = readBracedValue(source, braceIndex);
  return parsed?.value.trim();
}

function extractDocumentBody(source: string, diagnostics: LatexDiagnostic[], fileId: string): string {
  const beginMatch = /\\begin\{document\}/.exec(source);
  const endMatch = /\\end\{document\}/.exec(source);

  if (!beginMatch || !endMatch) {
    diagnostics.push({
      severity: 'warning',
      fileId,
      message: 'Preview is using the full source because \\begin{document} or \\end{document} is missing.',
    });
    return source;
  }

  return source.slice(beginMatch.index + beginMatch[0].length, endMatch.index).trim();
}

function parseLatexBlocks(source: string, context: ParseContext): LatexBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: LatexBlock[] = [];
  const paragraphBuffer: string[] = [];

  let listState: { ordered: boolean; items: string[]; currentItem: string[] } | null = null;
  let specialEnvironment:
    | { type: 'abstract' | 'quote' | 'equation' | 'verbatim'; lines: string[] }
    | null = null;

  const flushParagraph = () => {
    const text = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      blocks.push({ type: 'paragraph', text });
    }
    paragraphBuffer.length = 0;
  };

  const flushList = () => {
    if (!listState) {
      return;
    }

    const currentItem = listState.currentItem.join(' ').replace(/\s+/g, ' ').trim();
    if (currentItem) {
      listState.items.push(currentItem);
    }

    blocks.push({
      type: 'list',
      ordered: listState.ordered,
      items: listState.items,
    });
    listState = null;
  };

  const flushEnvironment = () => {
    if (!specialEnvironment) {
      return;
    }

    const text = specialEnvironment.lines.join('\n').trim();
    blocks.push({
      type: specialEnvironment.type,
      text,
    });
    specialEnvironment = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (specialEnvironment) {
      const endMatch = trimmed.match(/^\\end\{([^}]+)\}$/);
      if (endMatch) {
        flushEnvironment();
        continue;
      }

      specialEnvironment.lines.push(rawLine);
      continue;
    }

    if (listState) {
      const endMatch = trimmed.match(/^\\end\{(itemize|enumerate)\}$/);
      if (endMatch) {
        flushList();
        continue;
      }

      if (trimmed.startsWith('\\item')) {
        const currentItem = listState.currentItem.join(' ').replace(/\s+/g, ' ').trim();
        if (currentItem) {
          listState.items.push(currentItem);
        }

        listState.currentItem = [trimmed.slice('\\item'.length).trim()];
      } else {
        listState.currentItem.push(trimmed);
      }

      continue;
    }

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (trimmed === '\\maketitle') {
      flushParagraph();
      blocks.push({ type: 'title' });
      continue;
    }

    if (trimmed === '\\tableofcontents') {
      flushParagraph();
      blocks.push({ type: 'toc' });
      continue;
    }

    const headingMatch = trimmed.match(/^\\(section|subsection|subsubsection)\{(.+)\}$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1] === 'section' ? 1 : headingMatch[1] === 'subsection' ? 2 : 3;
      blocks.push({
        type: 'heading',
        level,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const environmentMatch = trimmed.match(/^\\begin\{([^}]+)\}$/);
    if (environmentMatch) {
      const environmentName = environmentMatch[1];
      flushParagraph();

      if (!SUPPORTED_ENVIRONMENTS.has(environmentName)) {
        context.diagnostics.push({
          severity: 'info',
          fileId: context.mainFileId,
          line: index + 1,
          message: `Environment "${environmentName}" is not rendered exactly in the preview yet.`,
        });
      }

      if (environmentName === 'itemize' || environmentName === 'enumerate') {
        listState = {
          ordered: environmentName === 'enumerate',
          items: [],
          currentItem: [],
        };
      } else if (
        environmentName === 'abstract' ||
        environmentName === 'quote' ||
        environmentName === 'equation' ||
        environmentName === 'align' ||
        environmentName === 'displaymath' ||
        environmentName === 'verbatim'
      ) {
        specialEnvironment = {
          type: environmentName === 'align' || environmentName === 'displaymath' ? 'equation' : environmentName,
          lines: [],
        };
      }

      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushEnvironment();

  if (!blocks.some((block) => block.type === 'title')) {
    blocks.unshift({ type: 'title' });
  }

  return blocks;
}

function renderBlocks(
  blocks: LatexBlock[],
  metadata: LatexMetadata,
  headings: Array<{ level: number; text: string; slug: string }>
): string {
  const content = blocks
    .map((block) => {
      switch (block.type) {
        case 'title':
          return [
            '<header data-latex-block="title">',
            `<h1>${renderInline(metadata.title)}</h1>`,
            '<div data-latex-meta>',
            `<span>${renderInline(metadata.author)}</span>`,
            `<span>${renderInline(metadata.date)}</span>`,
            '</div>',
            '</header>',
          ].join('');
        case 'heading': {
          const tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';
          return `<${tag} id="${slugify(block.text)}">${renderInline(block.text)}</${tag}>`;
        }
        case 'paragraph':
          return `<p>${renderInline(block.text)}</p>`;
        case 'list': {
          const tag = block.ordered ? 'ol' : 'ul';
          const items = block.items
            .filter(Boolean)
            .map((item) => `<li>${renderInline(item)}</li>`)
            .join('');
          return `<${tag}>${items}</${tag}>`;
        }
        case 'abstract':
          return `<section data-latex-block="abstract"><h2>Abstract</h2><p>${renderInline(block.text)}</p></section>`;
        case 'quote':
          return `<blockquote>${renderInline(block.text)}</blockquote>`;
        case 'equation':
          return `<pre data-latex-block="equation">${escapeHtml(block.text)}</pre>`;
        case 'verbatim':
          return `<pre>${escapeHtml(block.text)}</pre>`;
        case 'toc': {
          if (!headings.length) {
            return '<section data-latex-block="toc"><h2>Contents</h2><p>No sections available.</p></section>';
          }

          const entries = headings
            .map(
              (heading) =>
                `<li data-latex-toc-level="${heading.level}"><a href="#${heading.slug}">${renderInline(heading.text)}</a></li>`
            )
            .join('');

          return `<section data-latex-block="toc"><h2>Contents</h2><ol>${entries}</ol></section>`;
        }
        default:
          return '';
      }
    })
    .join('');

  return `<article>${content || '<p>Start writing to populate the preview.</p>'}</article>`;
}

function renderInline(source: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < source.length) {
    const character = source[cursor];

    if (character === '$') {
      const endIndex = findMathDelimiter(source, cursor + 1);
      if (endIndex > cursor) {
        output += `<span data-latex-inline="math">${escapeHtml(source.slice(cursor + 1, endIndex))}</span>`;
        cursor = endIndex + 1;
        continue;
      }
    }

    if (character === '~') {
      output += '&nbsp;';
      cursor += 1;
      continue;
    }

    if (character === '\\') {
      const next = source[cursor + 1];

      if (next === '\\') {
        output += '<br />';
        cursor += 2;
        continue;
      }

      if (next && '{}%$&_#'.includes(next)) {
        output += escapeHtml(next);
        cursor += 2;
        continue;
      }

      const command = readCommandName(source, cursor);
      if (!command) {
        output += escapeHtml(character);
        cursor += 1;
        continue;
      }

      const oneArgumentRenderers: Record<string, (value: string) => string> = {
        textbf: (value) => `<strong>${renderInline(value)}</strong>`,
        textit: (value) => `<em>${renderInline(value)}</em>`,
        emph: (value) => `<em>${renderInline(value)}</em>`,
        underline: (value) => `<span data-latex-inline="underline">${renderInline(value)}</span>`,
        texttt: (value) => `<code>${renderInline(value)}</code>`,
        url: (value) => `<a href="${escapeAttribute(value)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`,
        cite: (value) => `<span data-latex-inline="cite">[${escapeHtml(value)}]</span>`,
        ref: (value) => `<span data-latex-inline="ref">${escapeHtml(value)}</span>`,
        label: (value) => `<span data-latex-inline="label">${escapeHtml(value)}</span>`,
      };

      const twoArgumentRenderers: Record<string, (first: string, second: string) => string> = {
        href: (url, label) =>
          `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${renderInline(label)}</a>`,
      };

      if (oneArgumentRenderers[command.name]) {
        const firstArgument = findNextArgument(source, command.endIndex);
        if (firstArgument) {
          output += oneArgumentRenderers[command.name](firstArgument.value);
          cursor = firstArgument.endIndex;
          continue;
        }
      }

      if (twoArgumentRenderers[command.name]) {
        const firstArgument = findNextArgument(source, command.endIndex);
        const secondArgument = firstArgument ? findNextArgument(source, firstArgument.endIndex) : null;

        if (firstArgument && secondArgument) {
          output += twoArgumentRenderers[command.name](firstArgument.value, secondArgument.value);
          cursor = secondArgument.endIndex;
          continue;
        }
      }

      if (command.name === 'LaTeX') {
        output += '<span data-latex-inline="brand">LaTeX</span>';
        cursor = command.endIndex;
        continue;
      }

      if (command.name === 'today') {
        output += escapeHtml(formatToday());
        cursor = command.endIndex;
        continue;
      }

      output += escapeHtml(`\\${command.name}`);
      cursor = command.endIndex;
      continue;
    }

    output += escapeHtml(character);
    cursor += 1;
  }

  return output;
}

function findMathDelimiter(source: string, startIndex: number): number {
  for (let index = startIndex; index < source.length; index += 1) {
    if (source[index] === '$' && source[index - 1] !== '\\') {
      return index;
    }
  }

  return -1;
}

function readCommandName(source: string, startIndex: number): { name: string; endIndex: number } | null {
  if (source[startIndex] !== '\\') {
    return null;
  }

  let cursor = startIndex + 1;
  let name = '';

  while (cursor < source.length && /[A-Za-z]/.test(source[cursor])) {
    name += source[cursor];
    cursor += 1;
  }

  if (!name) {
    return null;
  }

  return { name, endIndex: cursor };
}

function findNextArgument(source: string, startIndex: number): { value: string; endIndex: number } | null {
  let cursor = startIndex;
  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }

  if (source[cursor] !== '{') {
    return null;
  }

  return readBracedValue(source, cursor);
}

function readBracedValue(source: string, braceIndex: number): { value: string; endIndex: number } | null {
  if (source[braceIndex] !== '{') {
    return null;
  }

  let depth = 0;
  let value = '';

  for (let index = braceIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{' && source[index - 1] !== '\\') {
      depth += 1;
      if (depth === 1) {
        continue;
      }
    }

    if (character === '}' && source[index - 1] !== '\\') {
      depth -= 1;
      if (depth === 0) {
        return {
          value,
          endIndex: index + 1,
        };
      }
    }

    if (depth >= 1) {
      value += character;
    }
  }

  return null;
}

function validateDocumentStructure(source: string, diagnostics: LatexDiagnostic[], fileId: string): void {
  const braces = countUnescapedCharacters(source, '{') - countUnescapedCharacters(source, '}');
  if (braces !== 0) {
    diagnostics.push({
      severity: 'error',
      fileId,
      message: 'Brace balance check failed. The preview may differ from the intended document.',
    });
  }

  const begins = [...source.matchAll(/\\begin\{([^}]+)\}/g)];
  const ends = [...source.matchAll(/\\end\{([^}]+)\}/g)];

  if (begins.length !== ends.length) {
    diagnostics.push({
      severity: 'warning',
      fileId,
      message: 'Environment count is unbalanced. Check matching \\begin{...} and \\end{...} pairs.',
    });
  }

  if (!/\\documentclass/.test(source)) {
    diagnostics.push({
      severity: 'info',
      fileId,
      message: 'No \\documentclass found. This is acceptable for fragments, but full builds usually define one.',
    });
  }
}

function countUnescapedCharacters(source: string, target: string): number {
  let total = 0;

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === target && source[index - 1] !== '\\') {
      total += 1;
    }
  }

  return total;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';
}

function countWords(source: string): number {
  return source
    .replace(/\\[A-Za-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function lineFromIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function formatToday(): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  const safeValue = /^(https?:|mailto:|#)/i.test(value) ? value : '#';
  return escapeHtml(safeValue);
}
