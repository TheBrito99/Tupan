/**
 * FDM Slicer Panel - 3D Printing Configuration & Visualization
 * Phase 19 Task 6: CAM UI & Integration
 */

import React, { useState, useCallback } from 'react';
import styles from './FDMSlicerPanel.module.css';

export interface FDMSettings {
  layerHeight: number; // mm
  infillDensity: number; // 0-1
  infillPattern: 'linear' | 'grid' | 'honeycomb' | 'gyroid' | 'cubic' | 'voronoi';
  supportEnabled: boolean;
  supportType: 'linear' | 'grid' | 'tree';
  wallThickness: number; // mm
  firstLayerSpeed: number; // %
  printSpeed: number; // %
  nozzleTemp: number; // °C
  bedTemp: number; // °C
}

export interface FDMJob {
  id: string;
  name: string;
  geometry?: any;
  settings: FDMSettings;
  estimatedTime: number; // minutes
  estimatedFilament: number; // grams
  estimatedCost: number; // USD
}

interface Props {
  job?: any;
  onCreateJob: (job: any) => void;
  onUpdateJob?: (updates: any) => void;
}

const DEFAULT_SETTINGS: FDMSettings = {
  layerHeight: 0.2,
  infillDensity: 0.2,
  infillPattern: 'grid',
  supportEnabled: true,
  supportType: 'tree',
  wallThickness: 1.2,
  firstLayerSpeed: 30,
  printSpeed: 100,
  nozzleTemp: 210,
  bedTemp: 60,
};

const INFILL_PATTERNS = [
  { value: 'linear', label: 'Linear', strength: 0.3 },
  { value: 'grid', label: 'Grid', strength: 0.7 },
  { value: 'honeycomb', label: 'Honeycomb', strength: 0.9 },
  { value: 'gyroid', label: 'Gyroid', strength: 0.95 },
  { value: 'cubic', label: 'Cubic', strength: 0.85 },
  { value: 'voronoi', label: 'Voronoi', strength: 0.8 },
];

const MATERIALS = [
  { name: 'PLA', nozzleTemp: 200, bedTemp: 50 },
  { name: 'ABS', nozzleTemp: 240, bedTemp: 100 },
  { name: 'PETG', nozzleTemp: 230, bedTemp: 80 },
  { name: 'TPU', nozzleTemp: 220, bedTemp: 60 },
];

export const FDMSlicerPanel: React.FC<Props> = ({ job, onCreateJob, onUpdateJob }) => {
  const [settings, setSettings] = useState<FDMSettings>(DEFAULT_SETTINGS);
  const [material, setMaterial] = useState('PLA');
  const [showPreview, setShowPreview] = useState(false);

  const handleSettingChange = useCallback(
    (key: keyof FDMSettings, value: any) => {
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
        handleSettingChange('nozzleTemp', mat.nozzleTemp);
        handleSettingChange('bedTemp', mat.bedTemp);
      }
    },
    [handleSettingChange]
  );

  const handleSlice = useCallback(() => {
    if (!job?.geometry) {
      alert('Please load a 3D model first');
      return;
    }

    // Simulate slicing
    const estimatedTime = Math.random() * 200 + 50; // 50-250 minutes
    const estimatedFilament = Math.random() * 100 + 20; // 20-120 grams
    const estimatedCost = estimatedFilament * 0.015; // $0.015 per gram

    onCreateJob({
      id: Date.now().toString(),
      name: `FDM Print - ${new Date().toLocaleDateString()}`,
      type: 'fdm-print',
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
      <h2>FDM 3D Printer Slicer</h2>

      <div className={styles.content}>
        {/* Settings Panel */}
        <section className={styles.section}>
          <h3>Print Settings</h3>

          {/* Material Selection */}
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

          {/* Layer Height */}
          <div className={styles.group}>
            <label>
              Layer Height: <span className={styles.value}>{settings.layerHeight.toFixed(2)} mm</span>
            </label>
            <input
              type="range"
              min="0.08"
              max="0.4"
              step="0.02"
              value={settings.layerHeight}
              onChange={(e) => handleSettingChange('layerHeight', parseFloat(e.target.value))}
            />
            <small>Thinner = higher quality but slower</small>
          </div>

          {/* Infill Density */}
          <div className={styles.group}>
            <label>
              Infill Density: <span className={styles.value}>{Math.round(settings.infillDensity * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.infillDensity}
              onChange={(e) => handleSettingChange('infillDensity', parseFloat(e.target.value))}
            />
            <small>0% = hollow, 100% = solid</small>
          </div>

          {/* Infill Pattern */}
          <div className={styles.group}>
            <label>Infill Pattern</label>
            <div className={styles.patternGrid}>
              {INFILL_PATTERNS.map((pattern) => (
                <div
                  key={pattern.value}
                  className={`${styles.patternOption} ${
                    settings.infillPattern === pattern.value ? styles.selected : ''
                  }`}
                  onClick={() => handleSettingChange('infillPattern', pattern.value)}
                >
                  <div className={styles.patternName}>{pattern.label}</div>
                  <div className={styles.strength}>
                    Strength: {Math.round(pattern.strength * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Support */}
          <div className={styles.group}>
            <label>
              <input
                type="checkbox"
                checked={settings.supportEnabled}
                onChange={(e) => handleSettingChange('supportEnabled', e.target.checked)}
              />
              Enable Support Structures
            </label>
            {settings.supportEnabled && (
              <div className={styles.subgroup}>
                <label>Support Type</label>
                <select
                  value={settings.supportType}
                  onChange={(e) => handleSettingChange('supportType', e.target.value as any)}
                >
                  <option value="linear">Linear (fastest)</option>
                  <option value="grid">Grid (balanced)</option>
                  <option value="tree">Tree (best quality)</option>
                </select>
              </div>
            )}
          </div>

          {/* Speed Settings */}
          <div className={styles.group}>
            <label>
              First Layer Speed: <span className={styles.value}>{settings.firstLayerSpeed}%</span>
            </label>
            <input
              type="range"
              min="20"
              max="100"
              step="10"
              value={settings.firstLayerSpeed}
              onChange={(e) => handleSettingChange('firstLayerSpeed', parseFloat(e.target.value))}
            />
          </div>

          <div className={styles.group}>
            <label>
              Print Speed: <span className={styles.value}>{settings.printSpeed}%</span>
            </label>
            <input
              type="range"
              min="20"
              max="200"
              step="10"
              value={settings.printSpeed}
              onChange={(e) => handleSettingChange('printSpeed', parseFloat(e.target.value))}
            />
          </div>
        </section>

        {/* Temperature Settings */}
        <section className={styles.section}>
          <h3>Temperature</h3>
          <div className={styles.group}>
            <label>
              Nozzle: <span className={styles.value}>{settings.nozzleTemp}°C</span>
            </label>
            <input
              type="range"
              min="170"
              max="260"
              step="5"
              value={settings.nozzleTemp}
              onChange={(e) => handleSettingChange('nozzleTemp', parseFloat(e.target.value))}
            />
          </div>
          <div className={styles.group}>
            <label>
              Bed: <span className={styles.value}>{settings.bedTemp}°C</span>
            </label>
            <input
              type="range"
              min="20"
              max="120"
              step="5"
              value={settings.bedTemp}
              onChange={(e) => handleSettingChange('bedTemp', parseFloat(e.target.value))}
            />
          </div>
        </section>

        {/* Preview & Actions */}
        <section className={styles.section}>
          <h3>Actions</h3>
          <button className={styles.previewBtn} onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button className={styles.sliceBtn} onClick={handleSlice}>
            Slice & Create Job
          </button>
        </section>

        {/* Preview */}
        {showPreview && (
          <section className={styles.section}>
            <h3>Slice Preview</h3>
            <div className={styles.preview}>
              <div className={styles.previewContent}>
                <p>Layer-by-layer visualization</p>
                <div className={styles.infillVisualization}>
                  {/* Simple infill pattern visualization */}
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    <rect width="200" height="200" fill="#f5f5f5" stroke="#999" strokeWidth="2" />
                    {settings.infillPattern === 'linear' && (
                      <>
                        {[...Array(Math.ceil(200 / 10))].map((_, i) => (
                          <line
                            key={i}
                            x1={i * 10}
                            y1="0"
                            x2={i * 10}
                            y2="200"
                            stroke="#2196F3"
                            strokeWidth="1"
                          />
                        ))}
                      </>
                    )}
                    {settings.infillPattern === 'grid' && (
                      <>
                        {[...Array(Math.ceil(200 / 10))].map((_, i) => (
                          <g key={i}>
                            <line x1={i * 10} y1="0" x2={i * 10} y2="200" stroke="#2196F3" strokeWidth="1" />
                            <line x1="0" y1={i * 10} x2="200" y2={i * 10} stroke="#2196F3" strokeWidth="1" />
                          </g>
                        ))}
                      </>
                    )}
                    {settings.infillPattern === 'honeycomb' && (
                      <text x="100" y="100" textAnchor="middle" fill="#666">
                        Honeycomb Pattern
                      </text>
                    )}
                  </svg>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default FDMSlicerPanel;
