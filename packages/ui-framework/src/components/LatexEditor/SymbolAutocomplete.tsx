import React, { useState, useEffect, useRef } from 'react';
import { getSymbolByName, searchSymbols, type MathSymbol } from './mathSymbols';
import styles from './SymbolAutocomplete.module.css';

export interface SymbolAutocompleteProps {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  onInsertSymbol: (symbol: MathSymbol) => void;
}

/**
 * Real-time math symbol autocomplete component
 * Triggered by backslash (\) followed by symbol name
 * Shows suggestions as user types
 */
export const SymbolAutocomplete: React.FC<SymbolAutocompleteProps> = ({ editorRef, onInsertSymbol }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MathSymbol[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  // Detect backslash and build query string
  useEffect(() => {
    if (!editorRef.current) return;

    const handleInput = () => {
      const textarea = editorRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const content = textarea.value;

      // Find the last backslash before cursor
      let backslashPos = -1;
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (content[i] === '\\') {
          backslashPos = i;
          break;
        } else if (content[i] === ' ' || content[i] === '\n' || content[i] === '}' || content[i] === '{') {
          break;
        }
      }

      if (backslashPos === -1) {
        setIsOpen(false);
        return;
      }

      // Extract text between backslash and cursor
      const currentQuery = content.substring(backslashPos + 1, cursorPos);

      // Only show autocomplete for valid LaTeX command pattern
      if (!/^[a-zA-Z0-9]*$/.test(currentQuery)) {
        setIsOpen(false);
        return;
      }

      setQuery(currentQuery);

      // Get suggestions
      const results =
        currentQuery.length === 0 ? [] : searchSymbols(currentQuery).slice(0, 12);

      setSuggestions(results);
      setSelectedIndex(0);
      setIsOpen(results.length > 0);

      // Position popup near cursor
      if (results.length > 0) {
        const coords = getCaretCoordinates(textarea, cursorPos);
        setPosition({
          top: coords.top + 24,
          left: coords.left,
        });
      }
    };

    const textarea = editorRef.current;
    textarea?.addEventListener('input', handleInput);
    textarea?.addEventListener('selectionchange', handleInput);

    return () => {
      textarea?.removeEventListener('input', handleInput);
      textarea?.removeEventListener('selectionchange', handleInput);
    };
  }, [editorRef]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (suggestions[selectedIndex]) {
          insertSymbol(suggestions[selectedIndex]);
        }
      } else if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, suggestions, selectedIndex]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editorRef]);

  const insertSymbol = (symbol: MathSymbol) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const content = textarea.value;

    // Find the backslash position
    let backslashPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (content[i] === '\\') {
        backslashPos = i;
        break;
      }
    }

    if (backslashPos === -1) return;

    // Replace \xxx with \symbol{}
    const before = content.substring(0, backslashPos);
    const after = content.substring(cursorPos);
    const replacement = `\\${symbol.name}`;

    const newContent = before + replacement + after;
    textarea.value = newContent;

    // Update cursor position
    const newCursorPos = backslashPos + replacement.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger change event
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);

    // Call parent callback
    onInsertSymbol(symbol);

    setIsOpen(false);
  };

  if (!isOpen || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className={styles.autocompletePopup}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <ul className={styles.suggestionList}>
        {suggestions.map((symbol, index) => (
          <li
            key={symbol.name}
            className={`${styles.suggestionItem} ${index === selectedIndex ? styles.suggestionSelected : ''}`}
            onClick={() => insertSymbol(symbol)}
          >
            <span className={styles.symbolDisplay}>{symbol.symbol}</span>
            <span className={styles.symbolInfo}>
              <span className={styles.symbolName}>\\{symbol.name}</span>
              <span className={styles.symbolDesc}>{symbol.description}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.autocompleteFooter}>
        <small>↑↓ Navigate • Enter/Tab Select • Esc Close</small>
      </div>
    </div>
  );
};

/**
 * Helper: Calculate caret coordinates for popup positioning
 */
function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  pos: number
): { top: number; left: number } {
  const div = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  ['direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize'].forEach((prop) => {
    div.style[prop as any] = style[prop as any];
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.textContent = textarea.value.substring(0, pos);

  const span = document.createElement('span');
  span.textContent = textarea.value.substring(pos) || '.';
  div.appendChild(span);

  document.body.appendChild(div);

  const { offsetLeft: left, offsetTop: top } = span;
  document.body.removeChild(div);

  return {
    top: textarea.offsetTop + top,
    left: textarea.offsetLeft + left,
  };
}
