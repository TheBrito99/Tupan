/**
 * PCB 3D Canvas Component
 * Phase 15: 3D Visualization
 *
 * Main 3D viewer for PCB design
 * - Renders board, components, traces, and vias
 * - Interactive camera controls (orbit, pan, zoom)
 * - Layer visibility management
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { PCBBoard, PlacedComponent, Trace, Via, PCBLayer } from './types';
import { buildAllBoardGeometry } from './geometry/boardGeometry';
import { buildAllComponentGeometry } from './geometry/componentGeometry';
import { buildAllTraceGeometry } from './geometry/traceGeometry';
import { buildAllViaGeometry } from './geometry/viaGeometry';
import styles from './PCBCanvas3D.module.css';

export interface Viewer3DState {
  camera: {
    eye: { x: number; y: number; z: number };
    center: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
  };
  layers: {
    visible: Set<PCBLayer>;
    opacity: Map<PCBLayer, number>;
  };
  rendering: {
    showComponents: boolean;
    showTraces: boolean;
    showVias: boolean;
    showZones: boolean;
    componentDetail: 'box' | 'model';
  };
  materials: {
    copperColor: string;
    soldermaskColor: string;
    silkscreenColor: string;
    substrateColor: string;
  };
}

export interface PCBCanvas3DProps {
  board: PCBBoard;
  components: PlacedComponent[];
  traces: Trace[];
  vias: Via[];
  viewer3DState: Viewer3DState;
  onViewer3DStateChange?: (state: Viewer3DState) => void;
}

/**
 * Default 3D viewer state
 */
function createDefaultViewer3DState(): Viewer3DState {
  return {
    camera: {
      eye: { x: 50, y: 50, z: 100 },
      center: { x: 50, y: 50, z: 0 },
      up: { x: 0, y: 1, z: 0 },
    },
    layers: {
      visible: new Set([
        PCBLayer.SIGNAL_TOP,
        PCBLayer.SIGNAL_BOTTOM,
        PCBLayer.SILK_TOP,
        PCBLayer.SILK_BOTTOM,
        PCBLayer.MASK_TOP,
        PCBLayer.MASK_BOTTOM,
      ]),
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
  };
}

/**
 * PCB 3D Canvas Component
 * Renders interactive 3D PCB visualization using Plotly.js
 */
export const PCBCanvas3D = React.forwardRef<HTMLDivElement, PCBCanvas3DProps>(
  (
    {
      board,
      components,
      traces,
      vias,
      viewer3DState,
      onViewer3DStateChange,
    },
    ref
  ) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [fps, setFps] = useState(0);
    const [triangleCount, setTriangleCount] = useState(0);
    const [memoryUsage, setMemoryUsage] = useState(0);
    const frameCountRef = React.useRef(0);
    const frameTimeRef = React.useRef(Date.now());

    // Merge provided state with defaults
    const state = useMemo(
      () => ({ ...createDefaultViewer3DState(), ...viewer3DState }),
      [viewer3DState]
    );

    // Build all geometry meshes with layer culling optimization
    const plotData = useMemo(() => {
      const meshes: Plotly.Data[] = [];

      // Board (always show)
      meshes.push(...buildAllBoardGeometry(board));

      // Components (if enabled)
      if (state.rendering.showComponents) {
        meshes.push(...buildAllComponentGeometry(components));
      }

      // Traces (if enabled) - with layer culling
      if (state.rendering.showTraces && traces.length > 0) {
        const visibleTraces = traces.filter(trace =>
          state.layers.visible.has(trace.layer)
        );
        if (visibleTraces.length > 0) {
          const traceMeshes = buildAllTraceGeometry(visibleTraces, board);
          meshes.push(...traceMeshes);
        }
      }

      // Vias (if enabled) - with layer culling
      if (state.rendering.showVias && vias.length > 0) {
        const visibleVias = vias.filter(via =>
          state.layers.visible.has(via.fromLayer) || state.layers.visible.has(via.toLayer)
        );
        if (visibleVias.length > 0) {
          meshes.push(...buildAllViaGeometry(visibleVias, board));
        }
      }

      // Calculate performance metrics
      let totalTriangles = 0;
      let totalMemory = 0;

      meshes.forEach(mesh => {
        if (mesh.i && Array.isArray(mesh.i)) {
          totalTriangles += mesh.i.length; // Each i,j,k tuple is one triangle
          // Estimate memory: ~24 bytes per triangle (3 floats × 8 bytes)
          totalMemory += mesh.i.length * 24;
        }
        if (mesh.x && Array.isArray(mesh.x)) {
          // Add vertex memory: ~24 bytes per vertex (x,y,z floats)
          totalMemory += mesh.x.length * 24;
        }
      });

      // Update metrics
      setTriangleCount(totalTriangles);
      setMemoryUsage(totalMemory);

      return meshes;
    }, [board, components, traces, vias, state]);

    // 3D scene layout configuration
    const layout: Partial<Plotly.Layout> = useMemo(() => {
      const xMax = board.width;
      const yMax = board.height;
      const zMax = board.thickness + 20; // Add some space above

      return {
        title: {
          text: `3D PCB View: ${board.name || 'Untitled'}`,
          font: { size: 14, color: '#fff' },
        },
        scene: {
          camera: state.camera,
          xaxis: {
            title: 'X (mm)',
            range: [-5, xMax + 5],
          },
          yaxis: {
            title: 'Y (mm)',
            range: [-5, yMax + 5],
          },
          zaxis: {
            title: 'Z (mm)',
            range: [-5, zMax + 5],
          },
          aspectmode: 'data',
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          gridcolor: '#333',
        },
        margin: { l: 0, r: 0, t: 40, b: 0 },
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        hovermode: 'closest',
        showlegend: true,
        legend: {
          x: 0.02,
          y: 0.98,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          bordercolor: '#444',
          borderwidth: 1,
          font: { color: '#fff', size: 10 },
        },
      };
    }, [board, state.camera]);

    // Plot configuration
    const plotConfig = useMemo(
      () => ({
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: [
          'autoScale2d',
          'select2d',
          'lasso2d',
          'resetScale2d',
        ],
        toImageButtonOptions: {
          format: 'png',
          filename: `${board.name || 'pcb'}-3d`,
          height: 1080,
          width: 1440,
          scale: 2,
        },
      }),
      [board.name]
    );

    // Handle camera updates from user interaction
    const handlePlotUpdate = useCallback(
      (figure: any) => {
        // Update FPS counter
        frameCountRef.current++;
        const now = Date.now();
        const elapsed = now - frameTimeRef.current;

        if (elapsed >= 1000) {
          setFps(Math.round((frameCountRef.current * 1000) / elapsed));
          frameCountRef.current = 0;
          frameTimeRef.current = now;
        }

        // Update camera from user interaction
        if (figure.layout.scene?.camera && onViewer3DStateChange) {
          onViewer3DStateChange({
            ...state,
            camera: figure.layout.scene.camera,
          });
        }
      },
      [state, onViewer3DStateChange]
    );

    // Initialize on first render
    useEffect(() => {
      setIsInitialized(true);
    }, []);

    if (!isInitialized) {
      return (
        <div ref={ref} className={styles.canvas3DContainer}>
          <div className={styles.loadingMessage}>Loading 3D viewer...</div>
        </div>
      );
    }

    return (
      <div ref={ref} className={styles.canvas3DContainer}>
        <Plot
          data={plotData}
          layout={layout}
          config={plotConfig}
          style={{ width: '100%', height: '100%' }}
          onUpdate={handlePlotUpdate}
        />

        {/* Performance Metrics */}
        <div className={styles.fpsCounter}>
          <span style={{ color: fps >= 55 ? '#31c48d' : fps >= 30 ? '#f59e0b' : '#ef4444' }}>
            {fps} FPS
          </span>
          <span className={styles.geometryInfo}>
            Triangles: {triangleCount.toLocaleString()}
          </span>
          <span className={styles.geometryInfo}>
            Meshes: {plotData.length} | Components: {components.length}
          </span>
          <span className={styles.geometryInfo}>
            Memory: {(memoryUsage / 1024 / 1024).toFixed(2)} MB
          </span>
          <span className={styles.geometryInfo} style={{ fontSize: '9px', opacity: 0.7 }}>
            Traces: {traces.length} | Vias: {vias.length}
          </span>
        </div>

        {/* Camera Info */}
        <div className={styles.cameraInfo}>
          <div>
            Camera Position:
            <br />
            X: {state.camera.eye.x.toFixed(1)} Y: {state.camera.eye.y.toFixed(1)} Z:{' '}
            {state.camera.eye.z.toFixed(1)}
          </div>
        </div>
      </div>
    );
  }
);

PCBCanvas3D.displayName = 'PCBCanvas3D';
