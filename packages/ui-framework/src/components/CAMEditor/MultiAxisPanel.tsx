/**
 * Multi-Axis CAM Configuration Panel
 * Task 8: React component for 4/5-axis machining setup
 */

import React, { useState, useEffect } from 'react';
import { MultiAxisBridge, getMachineTypes, InverseKinematicsRequest, Point6D } from '../../manufacturing/multi-axis-bridge';
import './MultiAxisPanel.module.css';

export interface MultiAxisConfig {
  machineType: '3-axis' | '4-axis' | '5-axis-ac' | '5-axis-bc';
  strategy: string;
  leadAngle: number;    // Degrees
  tiltAngle: number;    // Degrees
  indexAngles?: number[];
  tcpcMode: 'off' | 'on' | 'plane-specific';
}

interface MultiAxisPanelProps {
  onConfigChange?: (config: MultiAxisConfig) => void;
  onToolpathGenerated?: (result: any) => void;
}

export const MultiAxisPanel: React.FC<MultiAxisPanelProps> = ({
  onConfigChange,
  onToolpathGenerated,
}) => {
  const [config, setConfig] = useState<MultiAxisConfig>({
    machineType: '3-axis',
    strategy: 'Facing',
    leadAngle: 0,
    tiltAngle: 0,
    tcpcMode: 'off',
  });

  const [machineTypes, setMachineTypes] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ikResult, setIkResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const bridge = MultiAxisBridge.getInstance();

  // Load available options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        await bridge.initialize();
        const types = await bridge.getMachineTypes();
        const strats = await bridge.getStrategyTypes();
        setMachineTypes(types);
        setStrategies(strats);
      } catch (err) {
        setError(`Failed to load options: ${err}`);
      }
    };
    loadOptions();
  }, [bridge]);

  // Handle config changes
  const handleConfigChange = (newConfig: Partial<MultiAxisConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    onConfigChange?.(updated);
  };

  // Calculate inverse kinematics
  const handleInverseKinematics = async () => {
    setLoading(true);
    setError(null);
    try {
      const request: InverseKinematicsRequest = {
        tcp_x: 100,
        tcp_y: 50,
        tcp_z: 25,
        lead_angle: config.leadAngle,
        tilt_angle: config.tiltAngle,
        machine_type: config.machineType,
      };

      const result = await bridge.inverseKinematics(request);
      setIkResult(result);

      if (!result.success) {
        setError(`IK failed: ${result.error}`);
      }
    } catch (err) {
      setError(`IK calculation failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate toolpath
  const handleGenerateToolpath = async () => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (config.machineType === '4-axis') {
        result = await bridge.generate4AxisToolpath({ strategy: config.strategy });
      } else if (config.machineType.startsWith('5-axis')) {
        result = await bridge.generate5AxisToolpath({ strategy: config.strategy });
      } else {
        setError('3-axis not supported by this panel');
        return;
      }

      onToolpathGenerated?.(result);
    } catch (err) {
      setError(`Toolpath generation failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="multi-axis-panel">
      <h2>Multi-Axis Configuration</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Machine Type Selection */}
      <div className="config-section">
        <label>Machine Type</label>
        <select
          value={config.machineType}
          onChange={(e) =>
            handleConfigChange({
              machineType: e.target.value as any,
            })
          }
        >
          {machineTypes.map((type) => (
            <option key={type} value={type}>
              {type.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Strategy Selection */}
      <div className="config-section">
        <label>Cutting Strategy</label>
        <select
          value={config.strategy}
          onChange={(e) => handleConfigChange({ strategy: e.target.value })}
        >
          {strategies.map((strat) => (
            <option key={strat} value={strat}>
              {strat}
            </option>
          ))}
        </select>
      </div>

      {/* 4-Axis Specific: Index Angles */}
      {config.machineType === '4-axis' && (
        <div className="config-section">
          <label>Index Angles (degrees)</label>
          <div className="index-angles">
            <label>
              <input type="checkbox" defaultChecked /> 0°
            </label>
            <label>
              <input type="checkbox" defaultChecked /> 90°
            </label>
            <label>
              <input type="checkbox" defaultChecked /> 180°
            </label>
            <label>
              <input type="checkbox" defaultChecked /> 270°
            </label>
          </div>
        </div>
      )}

      {/* 5-Axis Specific: Lead & Tilt Angles */}
      {config.machineType.startsWith('5-axis') && (
        <>
          <div className="config-section">
            <label>
              Lead Angle (deg): <strong>{config.leadAngle}°</strong>
            </label>
            <input
              type="range"
              min="-45"
              max="45"
              value={config.leadAngle}
              onChange={(e) =>
                handleConfigChange({ leadAngle: parseFloat(e.target.value) })
              }
            />
          </div>

          <div className="config-section">
            <label>
              Tilt Angle (deg): <strong>{config.tiltAngle}°</strong>
            </label>
            <input
              type="range"
              min="-30"
              max="30"
              value={config.tiltAngle}
              onChange={(e) =>
                handleConfigChange({ tiltAngle: parseFloat(e.target.value) })
              }
            />
          </div>
        </>
      )}

      {/* TCPC Mode */}
      <div className="config-section">
        <label>Tool Center Point Control (TCPC)</label>
        <select
          value={config.tcpcMode}
          onChange={(e) =>
            handleConfigChange({ tcpcMode: e.target.value as any })
          }
        >
          <option value="off">Off (Standard)</option>
          <option value="on">On (Maintain TCP)</option>
          <option value="plane-specific">Plane Specific</option>
        </select>
      </div>

      {/* Inverse Kinematics Display */}
      {ikResult && (
        <div className="ik-result">
          <h3>Inverse Kinematics Result</h3>
          <div className="ik-values">
            <div>A Angle: {ikResult.a.toFixed(2)}°</div>
            <div>B Angle: {ikResult.b.toFixed(2)}°</div>
            <div>C Angle: {ikResult.c.toFixed(2)}°</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="button-group">
        <button
          onClick={handleInverseKinematics}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Calculating...' : 'Calculate IK'}
        </button>
        {config.machineType !== '3-axis' && (
          <button
            onClick={handleGenerateToolpath}
            disabled={loading}
            className="btn-success"
          >
            {loading ? 'Generating...' : 'Generate Toolpath'}
          </button>
        )}
      </div>
    </div>
  );
};

export default MultiAxisPanel;
