/**
 * PCB Designer - Main component for PCB layout design
 *
 * Features:
 * - Component placement with drag-and-drop
 * - Interactive trace routing
 * - Design rule checking (DRC)
 * - Layer management
 * - Real-time visualization
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PCBBoardManager, NetlistImport, UnroutedNet } from './PCBBoardManager';
import { DRCEngine, DRCConfig } from './DRCEngine';
import { TraceRouter } from './TraceRouter';
import { FootprintLibrary } from './FootprintLibrary';
import { PlacedComponent, Trace, Via, PCBLayer, DRCViolation } from './types';
import { PCBCanvas3D, Viewer3DState } from './PCBCanvas3D';
import { ThreePCBView } from './viewer3d/ThreePCBView';
import { PCB3DPanel } from './PCB3DPanel';
import { ModelLibraryDialog } from './components/ModelLibraryDialog';
import styles from './PCBDesigner.module.css';

interface PCBDesignerProps {
  width?: number;
  height?: number;
  onBoardChange?: (board: string) => void;
}

interface UIState {
  selectedComponent?: string;
  selectedTrace?: string;
  routingMode: boolean;
  routingStart?: { x: number; y: number };
  currentLayer: PCBLayer;
  showDRC: boolean;
  showRatsnest: boolean;
  zoom: number;
  panX: number;
  panY: number;
  show3D: boolean;
}

export const PCBDesigner: React.FC<PCBDesignerProps> = ({
  width = 100,
  height = 100,
  onBoardChange,
}) => {
  const [boardManager] = useState(() => new PCBBoardManager(width, height));
  const [drcEngine, setDrcEngine] = useState<DRCEngine | null>(null);
  const [traceRouter] = useState(() => new TraceRouter(width, height));
  const [footprintLibrary] = useState(() => new FootprintLibrary());

  const [uiState, setUiState] = useState<UIState>({
    selectedComponent: undefined,
    selectedTrace: undefined,
    routingMode: false,
    currentLayer: PCBLayer.SIGNAL_TOP,
    showDRC: true,
    showRatsnest: true,
    zoom: 1,
    panX: 0,
    panY: 0,
    show3D: false,
  });

  const [viewer3DState, setViewer3DState] = useState<Viewer3DState | null>(null);

  const [violations, setViolations] = useState<DRCViolation[]>([]);
  const [unreutedNets, setUnroutedNets] = useState<UnroutedNet[]>([]);
  const [components, setComponents] = useState<PlacedComponent[]>([]);
  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Initialize DRC engine
   */
  useEffect(() => {
    const board = boardManager.getBoard();
    setDrcEngine(new DRCEngine(board));
  }, [boardManager]);

  /**
   * Import netlist from schematic
   */
  const handleImportNetlist = useCallback((netlist: NetlistImport) => {
    boardManager.importNetlist(netlist);
    setUnroutedNets(boardManager.getUnroutedNets());
  }, [boardManager]);

  /**
   * Place component from library
   */
  const handlePlaceComponent = useCallback((footprintName: string, x: number, y: number) => {
    const footprint = footprintLibrary.getFootprint(footprintName);
    if (!footprint) {
      console.error(`Footprint ${footprintName} not found`);
      return;
    }

    // Auto-increment reference designator
    const board = boardManager.getBoard();
    const prefix = footprintName.charAt(0).toUpperCase();
    const existingCount = board.components.filter(c => c.refdes.startsWith(prefix)).length;
    const refdes = `${prefix}${existingCount + 1}`;

    const component = boardManager.placeComponent(refdes, footprint, x, y);
    setComponents([...boardManager.getComponents()]);
  }, [boardManager, footprintLibrary]);

  /**
   * Handle component selection
   */
  const handleSelectComponent = useCallback((componentId: string) => {
    setUiState(prev => ({
      ...prev,
      selectedComponent: prev.selectedComponent === componentId ? undefined : componentId,
    }));
  }, []);

  /**
   * Handle component movement
   */
  const handleMoveComponent = useCallback((componentId: string, x: number, y: number) => {
    boardManager.moveComponent(componentId, x, y);
    setComponents([...boardManager.getComponents()]);
  }, [boardManager]);

  /**
   * Handle component rotation
   */
  const handleRotateComponent = useCallback((componentId: string) => {
    const component = boardManager.getComponents().find(c => c.id === componentId);
    if (component) {
      boardManager.rotateComponent(componentId, (component.rotation + 90) % 360);
      setComponents([...boardManager.getComponents()]);
    }
  }, [boardManager]);

  /**
   * Start trace routing
   */
  const handleStartRouting = useCallback((x: number, y: number) => {
    setUiState(prev => ({
      ...prev,
      routingMode: true,
      routingStart: { x, y },
    }));
  }, []);

  /**
   * Complete trace routing
   */
  const handleCompleteRouting = useCallback((endX: number, endY: number) => {
    if (!uiState.routingStart) return;

    const path = traceRouter.routeTrace(
      uiState.routingStart.x,
      uiState.routingStart.y,
      endX,
      endY,
      uiState.currentLayer
    );

    if (path) {
      const simplified = traceRouter.simplifyPath(path);
      const trace = traceRouter.pathToTrace(simplified, uiState.currentLayer, 'net_1', 0.254);

      const board = boardManager.getBoard();
      board.traces.push(trace);

      // Add vias
      const vias = traceRouter.pathToVias(simplified);
      board.vias.push(...vias);

      setUiState(prev => ({
        ...prev,
        routingMode: false,
        routingStart: undefined,
      }));
    }
  }, [boardManager, traceRouter, uiState]);

  /**
   * Run DRC check
   */
  const handleRunDRC = useCallback(() => {
    if (!drcEngine) return;

    const drcConfig: DRCConfig = {
      checkTraceWidth: true,
      checkTraceSpacing: true,
      checkViaClearance: true,
      checkPadClearance: true,
      checkComponentClearance: true,
      checkElectrical: true,
    };

    const newViolations = drcEngine.runFullDRC(drcConfig);
    setViolations(newViolations);
  }, [drcEngine]);

  /**
   * Toggle 3D view
   */
  const handleToggle3D = useCallback(() => {
    setUiState(prev => ({ ...prev, show3D: !prev.show3D }));
    if (!viewer3DState) {
      const board = boardManager.getBoard();
      const eye = { x: board.width / 2, y: board.height / 2, z: Math.max(board.width, board.height) };
      const center = { x: board.width / 2, y: board.height / 2, z: 0 };
      const up = { x: 0, y: 1, z: 0 };

      setViewer3DState({
        camera: { eye, center, up },
        layers: {
          visible: new Set(board.layers),
          opacity: new Map(),
        },
        rendering: {
          showComponents: true,
          showTraces: true,
          showVias: true,
          showZones: false,
          componentDetail: 'box',
        },
        materials: {
          copperColor: '#d4a574',
          soldermaskColor: '#2d5016',
          silkscreenColor: '#f5f5f5',
          substrateColor: '#3d2f1f',
        },
      });
    }
  }, [boardManager, viewer3DState]);

  /**
   * Reset 3D camera to default view
   */
  const handleResetCamera = useCallback(() => {
    if (!viewer3DState) return;

    const board = boardManager.getBoard();
    const eye = { x: board.width / 2, y: board.height / 2, z: Math.max(board.width, board.height) };
    const center = { x: board.width / 2, y: board.height / 2, z: 0 };

    setViewer3DState(prev =>
      prev
        ? {
            ...prev,
            camera: { ...prev.camera, eye, center },
          }
        : null
    );
  }, [boardManager, viewer3DState]);

  /**
   * Toggle component detail mode (box vs. model)
   */
  const handleToggleComponentDetail = useCallback(() => {
    setViewer3DState(prev =>
      prev
        ? {
            ...prev,
            rendering: {
              ...prev.rendering,
              componentDetail: prev.rendering.componentDetail === 'box' ? 'model' : 'box',
            },
          }
        : null
    );
  }, []);

  /**
   * Open model library dialog
   */
  const handleOpenModelLibrary = useCallback(() => {
    setModelLibraryOpen(true);
  }, []);

  /**
   * Handle model assignment from library
   */
  const handleAssignModel = useCallback((modelId: string, footprintId?: string) => {
    // This will be integrated with FootprintModelManager
    // For now, trigger a refresh of the view
    console.log(`Assigning model ${modelId} to footprint ${footprintId}`);
  }, []);

  /**
   * Get placement statistics
   */
  const stats = boardManager.getPlacementStats();
  const board = boardManager.getBoard();

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            onClick={handleToggle3D}
            className={`${styles.button} ${uiState.show3D ? styles.active : ''}`}
            title={uiState.show3D ? 'Switch to 2D View' : 'Switch to 3D View'}
          >
            {uiState.show3D ? '📐 2D View' : '🎬 3D View'}
          </button>

          {uiState.show3D && viewer3DState && (
            <>
              <button
                onClick={handleToggleComponentDetail}
                className={`${styles.button} ${viewer3DState.rendering.componentDetail === 'model' ? styles.active : ''}`}
                title={viewer3DState.rendering.componentDetail === 'box' ? 'Switch to Model View' : 'Switch to Box View'}
              >
                {viewer3DState.rendering.componentDetail === 'box' ? '📦 Model View' : '🔷 Box View'}
              </button>

              <button
                onClick={handleOpenModelLibrary}
                className={styles.button}
                title="Manage 3D component models"
              >
                📚 Model Library
              </button>
            </>
          )}
        </div>

        <div className={styles.toolGroup}>
          <label>
            <input
              type="checkbox"
              checked={uiState.showDRC}
              onChange={e => setUiState(prev => ({ ...prev, showDRC: e.target.checked }))}
              disabled={uiState.show3D}
            />
            Show DRC
          </label>
          <button onClick={handleRunDRC} className={styles.button} disabled={uiState.show3D}>
            Run DRC Check
          </button>
        </div>

        <div className={styles.toolGroup}>
          <label>
            <input
              type="checkbox"
              checked={uiState.showRatsnest}
              onChange={e => setUiState(prev => ({ ...prev, showRatsnest: e.target.checked }))}
            />
            Show Ratsnest
          </label>
        </div>

        <div className={styles.toolGroup}>
          <label>
            Current Layer:
            <select
              value={uiState.currentLayer}
              onChange={e => setUiState(prev => ({ ...prev, currentLayer: e.target.value as PCBLayer }))}
            >
              <option value={PCBLayer.SIGNAL_TOP}>Signal Top</option>
              <option value={PCBLayer.SIGNAL_BOTTOM}>Signal Bottom</option>
              <option value={PCBLayer.GROUND}>Ground</option>
              <option value={PCBLayer.POWER}>Power</option>
            </select>
          </label>
        </div>

        <div className={styles.toolGroup}>
          <label>
            Zoom:
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={uiState.zoom}
              onChange={e => setUiState(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
            />
            {(uiState.zoom * 100).toFixed(0)}%
          </label>
        </div>
      </div>

      {/* Statistics Panel */}
      <div className={styles.statsPanel}>
        <div className={styles.statItem}>
          <span className={styles.label}>Components:</span>
          <span className={styles.value}>{stats.placedComponents}/{stats.totalComponents}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>Nets Routed:</span>
          <span className={styles.value}>{stats.routedNets}/{stats.unreroetedNets + stats.routedNets}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>Completeness:</span>
          <span className={styles.value}>{stats.completeness.toFixed(1)}%</span>
        </div>
        {violations.length > 0 && (
          <div className={styles.statItem}>
            <span className={styles.label}>DRC Violations:</span>
            <span className={styles.value + ' ' + styles.error}>{violations.length}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {uiState.show3D && viewer3DState ? (
        <>
          {/* 3D Canvas - Dual Renderer Support */}
          {viewer3DState.rendering.componentDetail === 'box' ? (
            <>
              {/* Plotly Canvas - Box Geometry Mode (Fast) */}
              <PCBCanvas3D
                ref={canvasRef as any}
                board={board}
                components={components}
                traces={board.traces}
                vias={board.vias}
                viewer3DState={viewer3DState}
                onViewer3DStateChange={setViewer3DState}
              />
            </>
          ) : (
            <>
              {/* Three.js Canvas - Model Rendering Mode (Realistic) */}
              <ThreePCBView
                board={board}
                viewer3DState={viewer3DState}
              />
            </>
          )}

          {/* 3D Control Panel (Right) */}
          <PCB3DPanel
            board={board}
            viewer3DState={viewer3DState}
            onChange={setViewer3DState}
            onResetCamera={handleResetCamera}
            onToggleComponentDetail={handleToggleComponentDetail}
            onOpenModelLibrary={handleOpenModelLibrary}
          />
        </>
      ) : (
        <>
          {/* 2D Canvas */}
          <div className={styles.canvasContainer}>
            <canvas
              ref={canvasRef}
              width={width * 10}
              height={height * 10}
              className={styles.canvas}
              style={{
                transform: `scale(${uiState.zoom}) translate(${uiState.panX}px, ${uiState.panY}px)`,
              }}
            />
          </div>

          {/* Component Library Panel (Right) */}
          <div className={styles.libraryPanel}>
            <h3>Footprint Library</h3>
            <div className={styles.footprintList}>
              {footprintLibrary.getAllFootprints().map(fp => (
                <div
                  key={fp.name}
                  className={styles.footprintItem}
                  onClick={() => handlePlaceComponent(fp.name, 50, 50)}
                  title={fp.description}
                >
                  <div className={styles.footprintName}>{fp.name}</div>
                  <div className={styles.footprintDesc}>{fp.description}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* DRC Violations Panel (Bottom) */}
      {uiState.showDRC && violations.length > 0 && (
        <div className={styles.drcPanel}>
          <h3>DRC Violations ({violations.length})</h3>
          <div className={styles.violationsList}>
            {violations.slice(0, 10).map(violation => (
              <div
                key={violation.id}
                className={`${styles.violation} ${styles[violation.severity]}`}
              >
                <div className={styles.violationType}>{violation.type}</div>
                <div className={styles.violationMessage}>{violation.message}</div>
              </div>
            ))}
            {violations.length > 10 && (
              <div className={styles.moreViolations}>+{violations.length - 10} more violations</div>
            )}
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <span>Mode: {uiState.routingMode ? 'Routing' : 'Select'}</span>
        <span>Layer: {uiState.currentLayer}</span>
        {uiState.selectedComponent && (
          <span>Selected: {boardManager.getComponents().find(c => c.id === uiState.selectedComponent)?.refdes}</span>
        )}
      </div>

      {/* Model Library Dialog */}
      <ModelLibraryDialog
        isOpen={modelLibraryOpen}
        onClose={() => setModelLibraryOpen(false)}
        onAssignModel={handleAssignModel}
        footprints={board.footprints}
      />
    </div>
  );
};

export default PCBDesigner;
