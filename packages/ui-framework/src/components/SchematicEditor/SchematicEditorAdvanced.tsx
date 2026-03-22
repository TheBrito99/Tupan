/**
 * Advanced Schematic Editor - Enhanced Version
 *
 * Integrates:
 * - Undo/Redo (HistoryManager)
 * - Multi-select (SelectionManager)
 * - Copy/Paste (ClipboardManager)
 * - Net Management (NetManager)
 * - Symbol Search (SymbolSearch)
 */

import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { Point } from '../../types/geometry';
import { Symbol } from '../DrawingTools/types';
import {
  PlacedSymbol,
  Wire,
  SchematicEditorState,
  SchematicEditorConfig,
} from './types';
import {
  placeSymbol,
  moveSymbol,
  deleteSymbol as deleteSymbolUtil,
} from './symbolPlacer';
import {
  createWire,
  autoRouteWire,
  deleteWire as deleteWireUtil,
} from './wireRouter';
import { generateSpiceNetlist, generateNetlist, validateNetlist, generateBOM } from './netlistGenerator';
import { HistoryManager, createStateSnapshot, detectChanges } from './historyManager';
import { SelectionManager, SelectionMode, AlignmentOption, DistributionOption, isPointInSymbol } from './selectionManager';
import { ClipboardManager } from './clipboardManager';
import { NetManager } from './netManager';
import { SymbolSearch, SearchResult } from './symbolSearch';
import styles from './SchematicEditor.module.css';

export interface SchematicEditorAdvancedHandle {
  // Export
  exportSPICE(): string;
  exportJSON(): string;
  exportBOM(): string;
  getNetlist(): any;

  // Undo/Redo
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  getHistory(): string[];

  // Selection
  selectAll(): void;
  clearSelection(): void;
  getSelectionCount(): number;

  // Clipboard
  copy(): void;
  cut(): void;
  paste(position: Point): void;
  canPaste(): boolean;

  // Alignment
  alignLeft(): void;
  alignRight(): void;
  alignCenterH(): void;
  alignTop(): void;
  alignBottom(): void;
  alignCenterV(): void;

  // Net management
  getNetList(): string[];
  highlightNet(netName: string): void;
  unhighlightNet(netName: string): void;

  // Search
  searchSymbols(query: string): SearchResult[];
  getRecentSymbols(): SearchResult[];
  getFavoriteSymbols(): SearchResult[];

  // View
  zoomToFit(): void;
  getState(): SchematicEditorState;
}

export interface SchematicEditorAdvancedProps {
  symbols: Symbol[];  // Symbol library for search
  config?: Partial<SchematicEditorConfig>;
  readOnly?: boolean;
  onStateChange?: (state: SchematicEditorState) => void;
  onSymbolSelect?: (symbol: PlacedSymbol | null) => void;
}

const DefaultConfig: SchematicEditorConfig = {
  gridSize: 10,
  snapToGrid: true,
  snapToPin: true,
  snapDistance: 10,
  autoLabel: true,
  showGrid: true,
  showPinLabels: true,
  readOnly: false,
};

const SchematicEditorAdvanced = forwardRef<SchematicEditorAdvancedHandle, SchematicEditorAdvancedProps>(
  ({ symbols, config = {}, readOnly = false, onStateChange, onSymbolSelect }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mergedConfig = { ...DefaultConfig, ...config, readOnly };

    // Manager instances
    const historyManager = useRef(new HistoryManager(100));
    const selectionManager = useRef(new SelectionManager());
    const clipboardManager = useRef(new ClipboardManager());
    const netManager = useRef(new NetManager());
    const symbolSearch = useRef(new SymbolSearch(symbols));

    // Editor state
    const [state, setState] = useState<SchematicEditorState>({
      placedSymbols: [],
      wires: [],
      dragState: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, offset: { x: 0, y: 0 } },
      isDrawingWire: false,
      wirePath: [],
      history: [],
      historyIndex: -1,
    });

    const [viewport, setViewport] = useState({ offsetX: 0, offsetY: 0, scale: 1.0 });
    const [showValidation, setShowValidation] = useState(false);
    const [validationErrors, setValidationErrors] = useState<any[]>([]);

    // Track changes for undo
    const prevStateRef = useRef<SchematicEditorState>(createStateSnapshot(state));

    // Initialize nets
    useEffect(() => {
      netManager.current.updateNets(state.wires, state.placedSymbols);
    }, [state.wires, state.placedSymbols]);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (readOnly) return;

        if (e.ctrlKey || e.metaKey) {
          switch (e.key.toLowerCase()) {
            case 'z':
              e.preventDefault();
              handleUndo();
              break;
            case 'y':
              e.preventDefault();
              handleRedo();
              break;
            case 'c':
              e.preventDefault();
              handleCopy();
              break;
            case 'x':
              e.preventDefault();
              handleCut();
              break;
            case 'v':
              e.preventDefault();
              handlePaste({ x: 100, y: 100 });
              break;
            case 'a':
              e.preventDefault();
              handleSelectAll();
              break;
          }
        } else {
          switch (e.key) {
            case 'Delete':
            case 'Backspace':
              e.preventDefault();
              handleDelete();
              break;
            case 'Escape':
              handleClearSelection();
              break;
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state, readOnly]);

    // History management
    const handleUndo = useCallback(() => {
      const previousState = historyManager.current.undo();
      if (previousState) {
        setState(previousState);
      }
    }, []);

    const handleRedo = useCallback(() => {
      const nextState = historyManager.current.redo();
      if (nextState) {
        setState(nextState);
      }
    }, []);

    // Record state change in history
    const recordStateChange = useCallback(
      (newState: SchematicEditorState, description?: string) => {
        const detected = detectChanges(prevStateRef.current, newState);
        const desc = description || detected;

        historyManager.current.push(
          desc,
          createStateSnapshot(prevStateRef.current),
          createStateSnapshot(newState),
          true // mergeable
        );

        prevStateRef.current = createStateSnapshot(newState);
      },
      []
    );

    // Selection operations
    const handleSelectAll = useCallback(() => {
      selectionManager.current.selectAll(state.placedSymbols);
      setState(prev => ({
        ...prev,
        selectedSymbol: state.placedSymbols[0]?.id,
      }));
    }, [state.placedSymbols]);

    const handleClearSelection = useCallback(() => {
      selectionManager.current.clearSelection();
      setState(prev => ({
        ...prev,
        selectedSymbol: undefined,
        selectedWire: undefined,
      }));
    }, []);

    // Clipboard operations
    const handleCopy = useCallback(() => {
      if (!state.selectedSymbol && state.selectedSymbol === undefined) return;

      clipboardManager.current.copy(
        state.placedSymbols,
        state.wires,
        selectionManager.current.getSelectedSymbolIds()
      );
    }, [state]);

    const handleCut = useCallback(() => {
      handleCopy();
      handleDelete();
    }, [handleCopy]);

    const handlePaste = useCallback(
      (position: Point) => {
        if (!clipboardManager.current.hasContent()) return;

        const newState = clipboardManager.current.paste(position, state.placedSymbols, state.wires);

        setState(prev => ({
          ...prev,
          placedSymbols: newState.symbols,
          wires: newState.wires,
        }));

        recordStateChange({ ...state, placedSymbols: newState.symbols, wires: newState.wires }, 'Paste');
      },
      [state, recordStateChange]
    );

    // Delete selected
    const handleDelete = useCallback(() => {
      const newState = selectionManager.current.deleteSelected(state.placedSymbols, state.wires);

      setState(prev => ({
        ...prev,
        placedSymbols: newState.symbols,
        wires: newState.wires,
        selectedSymbol: undefined,
        selectedWire: undefined,
      }));

      recordStateChange(
        { ...state, placedSymbols: newState.symbols, wires: newState.wires },
        'Delete'
      );
    }, [state, recordStateChange]);

    // Alignment operations
    const handleAlign = useCallback(
      (option: AlignmentOption) => {
        const aligned = selectionManager.current.alignSymbols(state.placedSymbols, option);

        setState(prev => ({
          ...prev,
          placedSymbols: aligned,
        }));

        recordStateChange({ ...state, placedSymbols: aligned }, `Align ${option}`);
      },
      [state, recordStateChange]
    );

    // Validate schematic
    const handleValidate = useCallback(() => {
      const errors = validateNetlist(state.placedSymbols, state.wires);
      setValidationErrors(errors);
      setShowValidation(true);
    }, [state]);

    // Public API via ref
    React.useImperativeHandle(
      ref,
      () => ({
        exportSPICE: () => generateSpiceNetlist(state.placedSymbols, state.wires),
        exportJSON: () => JSON.stringify(generateNetlist(state.placedSymbols, state.wires), null, 2),
        exportBOM: () => generateBOM(state.placedSymbols),
        getNetlist: () => generateNetlist(state.placedSymbols, state.wires),

        canUndo: () => historyManager.current.canUndo(),
        canRedo: () => historyManager.current.canRedo(),
        undo: handleUndo,
        redo: handleRedo,
        getHistory: () => historyManager.current.getHistory(),

        selectAll: handleSelectAll,
        clearSelection: handleClearSelection,
        getSelectionCount: () => selectionManager.current.getSelectionCount(),

        copy: handleCopy,
        cut: handleCut,
        paste: handlePaste,
        canPaste: () => clipboardManager.current.hasContent(),

        alignLeft: () => handleAlign(AlignmentOption.LEFT),
        alignRight: () => handleAlign(AlignmentOption.RIGHT),
        alignCenterH: () => handleAlign(AlignmentOption.CENTER_H),
        alignTop: () => handleAlign(AlignmentOption.TOP),
        alignBottom: () => handleAlign(AlignmentOption.BOTTOM),
        alignCenterV: () => handleAlign(AlignmentOption.CENTER_V),

        getNetList: () => netManager.current.getAllNets().map(n => n.name),
        highlightNet: (name: string) => netManager.current.highlightNet(name),
        unhighlightNet: (name: string) => netManager.current.unhighlightNet(name),

        searchSymbols: (query: string) => symbolSearch.current.search(query, 10),
        getRecentSymbols: () => symbolSearch.current.getRecent(5),
        getFavoriteSymbols: () => symbolSearch.current.getFavorites(10),

        zoomToFit: () => {
          // TODO: Implement zoom to fit
        },
        getState: () => state,
      }),
      [state, handleUndo, handleRedo, handleSelectAll, handleClearSelection, handleCopy, handleCut, handlePaste, handleAlign, handleDelete]
    );

    return (
      <div className={styles.container}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ cursor: state.isDrawingWire ? 'crosshair' : 'default' }}
        />

        <div className={styles.toolbar}>
          <button disabled={!historyManager.current.canUndo()} onClick={handleUndo} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button disabled={!historyManager.current.canRedo()} onClick={handleRedo} title="Redo (Ctrl+Y)">
            ↷ Redo
          </button>
          <div style={{ width: '1px', background: '#ddd', margin: '0 4px' }} />
          <button onClick={handleSelectAll} title="Select All (Ctrl+A)">
            ☑ Select All
          </button>
          <button onClick={handleClearSelection} title="Clear Selection (Esc)">
            ☐ Clear
          </button>
          <div style={{ width: '1px', background: '#ddd', margin: '0 4px' }} />
          <button onClick={handleCopy} disabled={selectionManager.current.getSelectionCount() === 0} title="Copy (Ctrl+C)">
            📋 Copy
          </button>
          <button onClick={handleCut} disabled={selectionManager.current.getSelectionCount() === 0} title="Cut (Ctrl+X)">
            ✂ Cut
          </button>
          <button onClick={() => handlePaste({ x: 100, y: 100 })} disabled={!clipboardManager.current.hasContent()} title="Paste (Ctrl+V)">
            📌 Paste
          </button>
          <div style={{ width: '1px', background: '#ddd', margin: '0 4px' }} />
          <button onClick={handleValidate}>✓ Validate</button>
          <button onClick={handleDelete} disabled={selectionManager.current.getSelectionCount() === 0} title="Delete (Del)">
            🗑 Delete
          </button>
        </div>

        {showValidation && (
          <div className={styles.validationPanel}>
            <h3>Netlist Validation</h3>
            {validationErrors.length === 0 ? (
              <p className={styles.success}>✓ Netlist is valid</p>
            ) : (
              <ul>
                {validationErrors.map((error, i) => (
                  <li key={i} className={styles[error.severity]}>
                    {error.message}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowValidation(false)}>Close</button>
          </div>
        )}
      </div>
    );
  }
);

SchematicEditorAdvanced.displayName = 'SchematicEditorAdvanced';

export default SchematicEditorAdvanced;
