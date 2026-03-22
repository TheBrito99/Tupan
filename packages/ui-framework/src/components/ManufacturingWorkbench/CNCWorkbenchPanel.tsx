/**
 * CNC Workbench Panel - CNC Machining Configuration
 * Phase 19 Task 6: CAM UI & Integration
 */

import React, { useState, useCallback } from 'react';
import styles from './CNCWorkbenchPanel.module.css';

export interface CNCSettings {
  toolpathStrategy: 'adaptive' | 'conventional' | 'climb' | 'spiral';
  feedRate: number; // mm/min
  spindleSpeed: number; // RPM
  depthOfCut: number; // mm
  stepOver: number; // mm (percentage of tool diameter)
  coolantType: 'none' | 'flood' | 'mist' | 'through_spindle';
  gCodeDialect: 'fanuc' | 'haas' | 'siemens' | 'heidenhain' | 'nc';
  safetyMargin: number; // % (10-20 typical)
  estimatedTime: number; // minutes
  estimatedCost: number; // USD
}

export interface CNCJob {
  id: string;
  name: string;
  geometry?: any;
  settings: CNCSettings;
  workpieceMaterial: string;
  estimatedTime: number;
  estimatedCost: number;
}

interface Props {
  job?: any;
  onCreateJob: (job: any) => void;
  onUpdateJob?: (updates: any) => void;
}

const DEFAULT_SETTINGS: CNCSettings = {
  toolpathStrategy: 'adaptive',
  feedRate: 200,
  spindleSpeed: 2000,
  depthOfCut: 2.0,
  stepOver: 0.5,
  coolantType: 'flood',
  gCodeDialect: 'fanuc',
  safetyMargin: 15,
  estimatedTime: 0,
  estimatedCost: 0,
};

const MATERIALS = [
  { name: 'Aluminum', defaultSpeed: 200, defaultFeed: 0.15 },
  { name: 'Steel', defaultSpeed: 100, defaultFeed: 0.10 },
  { name: 'Stainless Steel', defaultSpeed: 80, defaultFeed: 0.08 },
  { name: 'Titanium', defaultSpeed: 50, defaultFeed: 0.05 },
  { name: 'Cast Iron', defaultSpeed: 120, defaultFeed: 0.12 },
  { name: 'Plastic', defaultSpeed: 300, defaultFeed: 0.20 },
];

const G_CODE_DIALECTS = [
  { value: 'fanuc', label: 'Fanuc (KUKA, most CNC mills)' },
  { value: 'haas', label: 'Haas (Haas machines)' },
  { value: 'siemens', label: 'Siemens (Sinumerik)' },
  { value: 'heidenhain', label: 'Heidenhain' },
  { value: 'nc', label: 'Generic NC' },
];

export const CNCWorkbenchPanel: React.FC<Props> = ({ job, onCreateJob, onUpdateJob }) => {
  const [settings, setSettings] = useState<CNCSettings>(DEFAULT_SETTINGS);
  const [material, setMaterial] = useState('Aluminum');
  const [toolDiameter, setToolDiameter] = useState(3.0); // mm
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSettingChange = useCallback(
    (key: keyof CNCSettings, value: any) => {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      if (onUpdateJob) {
        onUpdateJob({ settings: newSettings });
      }
    },
    [settings, onUpdateJob]
  );

  const handleMaterialChange = useCallback(
    (materialName: string) => {
      setMaterial(materialName);
      const mat = MATERIALS.find((m) => m.name === materialName);
      if (mat) {
        handleSettingChange('spindleSpeed', mat.defaultSpeed * 1000 / (Math.PI * toolDiameter));
        handleSettingChange('feedRate', mat.defaultFeed * settings.spindleSpeed / 1000);
      }
    },
    [handleSettingChange, toolDiameter, settings.spindleSpeed]
  );

  const handleGenerateToolpath = useCallback(() => {
    if (!job?.geometry) {
      alert('Please load a 3D model first');
      return;
    }

    // Simulate toolpath generation
    const estimatedTime = Math.random() * 120 + 20; // 20-140 minutes
    const estimatedCost = estimatedTime * 2.5; // $2.50 per minute machine time

    onCreateJob({
      id: Date.now().toString(),
      name: `CNC Job - ${new Date().toLocaleDateString()}`,
      type: 'cnc-mill',
      geometry: job.geometry,
      parameters: settings,
      estimatedTime,
      estimatedCost,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
  }, [job, settings, onCreateJob]);

  return (
    <div className={styles.panel}>
      <h2>CNC Machining Workbench</h2>

      <div className={styles.content}>
        {/* Material & Basic Settings */}
        <section className={styles.section}>
          <h3>Workpiece Material</h3>

          <div className={styles.group}>
            <label>Material</label>
            <select value={material} onChange={(e) => handleMaterialChange(e.target.value)}>
              {MATERIALS.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Toolpath Strategy */}
        <section className={styles.section}>
          <h3>Toolpath Strategy</h3>

          <div className={styles.group}>
            <label>Strategy</label>
            <select
              value={settings.toolpathStrategy}
              onChange={(e) => handleSettingChange('toolpathStrategy', e.target.value)}
            >
              <option value="adaptive">Adaptive (variable depth)</option>
              <option value="conventional">Conventional (climb safe)</option>
              <option value="climb">Climb (faster, requires rigidity)</option>
              <option value="spiral">Spiral (smooth finish)</option>
            </select>
            <small>Adaptive: Best for hard materials. Climb: Best for finish pass.</small>
          </div>
        </section>

        {/* Cutting Parameters */}
        <section className={styles.section}>
          <h3>Cutting Parameters</h3>

          <div className={styles.group}>
            <label>
              Tool Diameter: <span className={styles.value}>{toolDiameter.toFixed(2)} mm</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="12.7"
              step="0.1"
              value={toolDiameter}
              onChange={(e) => setToolDiameter(parseFloat(e.target.value))}
            />
            <small>Endmill diameter</small>
          </div>

          <div className={styles.group}>
            <label>
              Spindle Speed: <span className={styles.value}>{settings.spindleSpeed.toFixed(0)} RPM</span>
            </label>
            <input
              type="range"
              min="100"
              max="10000"
              step="100"
              value={settings.spindleSpeed}
              onChange={(e) => handleSettingChange('spindleSpeed', parseFloat(e.target.value))}
            />
            <small>Rotations per minute</small>
          </div>

          <div className={styles.group}>
            <label>
              Feed Rate: <span className={styles.value}>{settings.feedRate.toFixed(0)} mm/min</span>
            </label>
            <input
              type="range"
              min="50"
              max="2000"
              step="50"
              value={settings.feedRate}
              onChange={(e) => handleSettingChange('feedRate', parseFloat(e.target.value))}
            />
            <small>Tool advance per minute</small>
          </div>

          <div className={styles.group}>
            <label>
              Depth of Cut: <span className={styles.value}>{settings.depthOfCut.toFixed(2)} mm</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={settings.depthOfCut}
              onChange={(e) => handleSettingChange('depthOfCut', parseFloat(e.target.value))}
            />
            <small>Maximum depth per pass</small>
          </div>

          <div className={styles.group}>
            <label>
              Step Over: <span className={styles.value}>{(settings.stepOver * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.stepOver}
              onChange={(e) => handleSettingChange('stepOver', parseFloat(e.target.value))}
            />
            <small>% of tool diameter per pass (lower = smoother)</small>
          </div>
        </section>

        {/* Coolant & G-Code */}
        <section className={styles.section}>
          <h3>Coolant & Output</h3>

          <div className={styles.group}>
            <label>Coolant Type</label>
            <select
              value={settings.coolantType}
              onChange={(e) => handleSettingChange('coolantType', e.target.value as any)}
            >
              <option value="none">None (dry)</option>
              <option value="flood">Flood (highest cooling)</option>
              <option value="mist">Mist (chip removal)</option>
              <option value="through_spindle">Through-Spindle (best for hardened steel)</option>
            </select>
          </div>

          <div className={styles.group}>
            <label>G-Code Dialect</label>
            <select
              value={settings.gCodeDialect}
              onChange={(e) => handleSettingChange('gCodeDialect', e.target.value as any)}
            >
              {G_CODE_DIALECTS.map((dialect) => (
                <option key={dialect.value} value={dialect.value}>
                  {dialect.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.group}>
            <label>
              Safety Margin: <span className={styles.value}>{settings.safetyMargin}%</span>
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={settings.safetyMargin}
              onChange={(e) => handleSettingChange('safetyMargin', parseFloat(e.target.value))}
            />
            <small>Load limit safety factor (10-20% typical)</small>
          </div>
        </section>

        {/* Advanced Options */}
        <section className={styles.section}>
          <button
            className={styles.advancedToggle}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>

          {showAdvanced && (
            <div className={styles.advancedOptions}>
              <p>Advanced machining options available here:</p>
              <ul>
                <li>Ramping entry (reduce shock loading)</li>
                <li>Helical ramping for deep pockets</li>
                <li>Conservative tool life limits</li>
                <li>Collision detection with vise/clamps</li>
                <li>Automatic retracts for chip clearing</li>
              </ul>
              <small>These features require advanced CAM engine.</small>
            </div>
          )}
        </section>

        {/* Actions */}
        <section className={styles.section}>
          <h3>Actions</h3>
          <button className={styles.generateBtn} onClick={handleGenerateToolpath}>
            Generate Toolpath & Create Job
          </button>
          <small>
            Estimated Time: {(Math.random() * 120 + 20).toFixed(0)} min | Cost: ${(Math.random() * 300 + 50).toFixed(2)}
          </small>
        </section>
      </div>
    </div>
  );
};

export default CNCWorkbenchPanel;
