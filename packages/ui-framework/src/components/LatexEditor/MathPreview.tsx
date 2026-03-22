/**
 * Enhanced math preview component with KaTeX rendering
 * Renders inline and display math in real-time
 * Falls back to source display if KaTeX unavailable
 */

import React, { useEffect, useRef, useMemo } from 'react';
import styles from './MathPreview.module.css';

interface MathPreviewProps {
  source: string;
  displayMode?: boolean;
  inline?: boolean;
}

declare global {
  interface Window {
    katex?: {
      render(
        math: string,
        container: HTMLElement,
        options?: { displayMode?: boolean; throwOnError?: boolean }
      ): void;
      renderToString(math: string, options?: { displayMode?: boolean }): string;
    };
  }
}

/**
 * Detects if KaTeX is available and loaded
 */
function isKaTeXAvailable(): boolean {
  return typeof window !== 'undefined' && window.katex !== undefined;
}

/**
 * Async loads KaTeX from CDN if not already loaded
 */
async function loadKaTeX(): Promise<boolean> {
  if (isKaTeXAvailable()) {
    return true;
  }

  try {
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
    script.async = true;

    return new Promise((resolve) => {
      script.onload = () => {
        resolve(isKaTeXAvailable());
      };
      script.onerror = () => {
        resolve(false);
      };
      document.head.appendChild(script);
    });
  } catch {
    return false;
  }
}

/**
 * Renders LaTeX math using KaTeX
 */
function renderMath(source: string, displayMode: boolean): string {
  if (!isKaTeXAvailable()) {
    return source;
  }

  try {
    return window.katex!.renderToString(source, { displayMode });
  } catch (error) {
    console.warn('KaTeX render error:', error);
    return `<code>${escapeHtml(source)}</code>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const MathPreview: React.FC<MathPreviewProps> = ({
  source,
  displayMode = false,
  inline = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = React.useState(isKaTeXAvailable());

  // Load KaTeX on mount
  useEffect(() => {
    loadKaTeX().then(setIsReady);
  }, []);

  // Render math when source or mode changes
  useEffect(() => {
    if (!containerRef.current || !isReady) return;

    if (isKaTeXAvailable() && source.trim()) {
      try {
        window.katex!.render(source, containerRef.current, { displayMode });
      } catch (error) {
        containerRef.current.innerHTML = `<code>${escapeHtml(source)}</code>`;
      }
    } else {
      containerRef.current.innerHTML = `<code>${escapeHtml(source)}</code>`;
    }
  }, [source, isReady, displayMode]);

  return (
    <div
      ref={containerRef}
      className={`${styles.mathPreview} ${displayMode ? styles.displayMode : styles.inlineMode} ${
        inline ? styles.inline : ''
      }`}
    />
  );
};

/**
 * Batch math preview component
 * Renders multiple equations in a document
 */
interface MathBatchPreviewProps {
  html: string;
  onReady?: () => void;
}

export const MathBatchPreview: React.FC<MathBatchPreviewProps> = ({ html, onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = React.useState(isKaTeXAvailable());

  useEffect(() => {
    loadKaTeX().then(setIsReady);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !isReady) return;

    containerRef.current.innerHTML = html;

    // Render all math blocks
    if (isKaTeXAvailable()) {
      // Render inline math (single $)
      const inlineMathRegex = /\$([^$]+)\$/g;
      containerRef.current.innerHTML = containerRef.current.innerHTML.replace(inlineMathRegex, (_match, math) => {
        try {
          return window.katex!.renderToString(math, { displayMode: false });
        } catch {
          return `<code>${escapeHtml(math)}</code>`;
        }
      });

      // Render display math ($$)
      const displayMathRegex = /\$\$([^$]+)\$\$/g;
      containerRef.current.innerHTML = containerRef.current.innerHTML.replace(displayMathRegex, (_match, math) => {
        try {
          return window.katex!.renderToString(math, { displayMode: true });
        } catch {
          return `<code>${escapeHtml(math)}</code>`;
        }
      });
    }

    onReady?.();
  }, [html, isReady, onReady]);

  return <div ref={containerRef} className={styles.mathBatch} />;
};

/**
 * Utility to inject KaTeX rendering into HTML content
 */
export function injectMathRendering(html: string): Promise<string> {
  return loadKaTeX().then(() => {
    let result = html;

    if (isKaTeXAvailable()) {
      // Process display math ($$)
      result = result.replace(/\$\$([^$]+)\$\$/g, (_match, math) => {
        try {
          const rendered = window.katex!.renderToString(math, { displayMode: true });
          return `<div class="${styles.displayMath}">${rendered}</div>`;
        } catch {
          return `<div class="${styles.mathError}"><code>${escapeHtml(math)}</code></div>`;
        }
      });

      // Process inline math ($)
      result = result.replace(/(?<!\$)\$([^$]+)\$(?!\$)/g, (_match, math) => {
        try {
          return window.katex!.renderToString(math, { displayMode: false });
        } catch {
          return `<span class="${styles.mathError}"><code>${escapeHtml(math)}</code></span>`;
        }
      });
    }

    return result;
  });
}

/**
 * Hook for math preview functionality
 */
export function useMathPreview(source: string, displayMode: boolean = false): string {
  return useMemo(() => {
    if (!isKaTeXAvailable()) {
      return source;
    }

    try {
      return window.katex!.renderToString(source, { displayMode });
    } catch {
      return `<code>${escapeHtml(source)}</code>`;
    }
  }, [source, displayMode]);
}
