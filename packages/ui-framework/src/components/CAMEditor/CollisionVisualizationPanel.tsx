/**
 * Collision Visualization Panel
 * Task 8: Real-time 6DOF collision detection visualization
 */

import React, { useState, useEffect } from 'react';
import { MultiAxisBridge, Point6D, createPoint6D } from '../../manufacturing/multi-axis-bridge';

interface CollisionState {
  hasCollision: boolean;
  type: string;
  clearanceZ: number;
  x: number;
  y: number;
  z: number;
  a: number;
  b: number;
  c: number;
}

interface CollisionVisualizationPanelProps {
  isSimulating?: boolean;
  onCollisionDetected?: (collision: CollisionState) => void;
}

export const CollisionVisualizationPanel: React.FC<
  CollisionVisualizationPanelProps
> = ({ isSimulating, onCollisionDetected }) => {
  const [position, setPosition] = useState<Point6D>(
    createPoint6D(0, 0, 50, 0, 0, 0)
  );
  const [collisionState, setCollisionState] = useState<CollisionState | null>(
    null
  );
  const [isChecking, setIsChecking] = useState(false);
  const [workpieceHeight, setWorkpieceHeight] = useState(5);
  const [collisionHistory, setCollisionHistory] = useState<CollisionState[]>([]);

  const bridge = MultiAxisBridge.getInstance();

  // Check collision in real-time during simulation
  useEffect(() => {
    if (!isSimulating) return;

    const checkCollision = async () => {
      setIsChecking(true);
      try {
        await bridge.initialize();
        const result = await bridge.checkCollision6DOF(position);

        const state: CollisionState = {
          hasCollision: result.has_collision,
          type: result.collision_type,
          clearanceZ: result.clearance_mm,
          x: position.x,
          y: position.y,
          z: position.z,
          a: position.a,
          b: position.b,
          c: position.c,
        };

        setCollisionState(state);

        if (state.hasCollision) {
          setCollisionHistory((prev) => [state, ...prev.slice(0, 9)]);
          onCollisionDetected?.(state);
        }
      } catch (err) {
        console.error('Collision check failed:', err);
      } finally {
        setIsChecking(false);
      }
    };

    const timer = setTimeout(checkCollision, 100);
    return () => clearTimeout(timer);
  }, [isSimulating, position, bridge, onCollisionDetected]);

  // Handle position slider changes
  const handlePositionChange = (axis: keyof Point6D, value: number) => {
    setPosition((prev) => ({
      ...prev,
      [axis]: value,
    }));
  };

  // Get status color
  const getStatusColor = (hasCollision: boolean) => {
    return hasCollision ? '#FF6B6B' : '#51CF66';
  };

  // Get collision type label
  const getCollisionLabel = (type: string) => {
    switch (type) {
      case 'tool_workpiece':
        return '⚠ Tool-Workpiece Collision';
      case 'tool_fixture':
        return '⚠ Tool-Fixture Collision';
      case 'spindle_workpiece':
        return '⚠ Spindle-Workpiece Collision';
      case 'none':
        return '✓ No Collision';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="collision-visualization-panel">
      <h2>6DOF Collision Detection</h2>

      {/* Current Position Status */}
      <div className="status-section">
        <div className="status-header">
          <div className="status-indicator">
            <div
              className="status-dot"
              style={{
                backgroundColor: getStatusColor(
                  collisionState?.hasCollision ?? false
                ),
              }}
            />
          </div>
          <div className="status-text">
            {collisionState
              ? getCollisionLabel(collisionState.type)
              : 'No collision data'}
          </div>
        </div>

        {collisionState && (
          <div className="clearance-display">
            <div className="clearance-value">
              Clearance: {collisionState.clearanceZ.toFixed(2)} mm
            </div>
            <div className="clearance-bar">
              <div
                className={`clearance-fill ${
                  collisionState.hasCollision ? 'danger' : 'safe'
                }`}
                style={{
                  width: `${Math.min(
                    Math.max(
                      ((collisionState.clearanceZ + 50) / 100) * 100,
                      0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Position Controls */}
      <div className="position-section">
        <h3>Tool Position & Orientation</h3>

        <div className="position-controls">
          {/* Linear Axes */}
          <div className="axis-group">
            <h4>Linear Axes (mm)</h4>

            <div className="axis-control">
              <label>X: {position.x.toFixed(1)}mm</label>
              <input
                type="range"
                min="-100"
                max="100"
                value={position.x}
                onChange={(e) =>
                  handlePositionChange('x', parseFloat(e.target.value))
                }
                disabled={isSimulating}
              />
            </div>

            <div className="axis-control">
              <label>Y: {position.y.toFixed(1)}mm</label>
              <input
                type="range"
                min="-100"
                max="100"
                value={position.y}
                onChange={(e) =>
                  handlePositionChange('y', parseFloat(e.target.value))
                }
                disabled={isSimulating}
              />
            </div>

            <div className="axis-control">
              <label>Z: {position.z.toFixed(1)}mm (Safe when &gt; {workpieceHeight}mm)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={position.z}
                onChange={(e) =>
                  handlePositionChange('z', parseFloat(e.target.value))
                }
                disabled={isSimulating}
              />
            </div>
          </div>

          {/* Rotary Axes */}
          <div className="axis-group">
            <h4>Rotary Axes (degrees)</h4>

            <div className="axis-control">
              <label>A (X-axis rotation): {position.a.toFixed(1)}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                value={position.a}
                onChange={(e) =>
                  handlePositionChange('a', parseFloat(e.target.value))
                }
                disabled={isSimulating}
              />
            </div>

            <div className="axis-control">
              <label>B (Y-axis rotation): {position.b.toFixed(1)}°</label>
              <input
                type="range"
                min="-90"
                max="90"
                value={position.b}
                onChange={(e) =>
                  handlePositionChange('b', parseFloat(e.target.value))
                }
                disabled={isSimulating}
              />
            </div>

            <div className="axis-control">
              <label>C (Z-axis rotation): {position.c.toFixed(1)}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                value={position.c}
                onChange={(e) =>
                  handlePositionChange('c', parseFloat(e.target.value))
                }
                disabled={isSimulating}
              />
            </div>
          </div>

          {/* Workpiece Height */}
          <div className="axis-group">
            <label>Workpiece Top Surface: {workpieceHeight}mm</label>
            <input
              type="range"
              min="0"
              max="50"
              value={workpieceHeight}
              onChange={(e) => setWorkpieceHeight(parseFloat(e.target.value))}
              disabled={isSimulating}
            />
          </div>
        </div>
      </div>

      {/* Collision History */}
      {collisionHistory.length > 0 && (
        <div className="history-section">
          <h3>Recent Collisions</h3>
          <div className="collision-history">
            {collisionHistory.map((collision, idx) => (
              <div key={idx} className="history-item">
                <div className="history-time">#{idx + 1}</div>
                <div className="history-type">
                  {getCollisionLabel(collision.type)}
                </div>
                <div className="history-details">
                  X: {collision.x.toFixed(0)}, Y: {collision.y.toFixed(0)}, Z:{' '}
                  {collision.z.toFixed(0)} | A: {collision.a.toFixed(0)}°, B:{' '}
                  {collision.b.toFixed(0)}°
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setCollisionHistory([])}
            className="btn-secondary"
          >
            Clear History
          </button>
        </div>
      )}

      {/* Simulation Status */}
      {isSimulating && (
        <div className="simulation-notice">
          <strong>⏱ Simulation Active</strong> - Monitoring collisions in
          real-time
        </div>
      )}
    </div>
  );
};

export default CollisionVisualizationPanel;
