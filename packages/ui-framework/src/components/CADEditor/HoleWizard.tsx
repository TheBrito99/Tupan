/**
 * Hole Wizard Component
 * Phase 17.5: Advanced Features
 *
 * Creates standard holes with predefined templates:
 * - Through holes (metric, imperial)
 * - Blind holes with depth
 * - Counterbore/Countersink
 * - Tapped holes with thread specifications
 * - Custom holes with parameters
 */

import React, { useState } from 'react';
import styles from './HoleWizard.module.css';

// ============================================================================
// TYPES
// ============================================================================

export type HoleType = 'Through' | 'Blind' | 'CounterBore' | 'CounterSink' | 'Tapped';

export interface HoleTemplate {
  name: string;
  type: HoleType;
  diameter: number;
  depth?: number;
  counterbore?: {
    diameter: number;
    depth: number;
  };
  countersink?: {
    angle: number;
    depth: number;
  };
  thread?: {
    pitch: number;
    standard: string; // e.g., "M6", "1/4-20"
  };
}

export interface StandardHoleLibrary {
  [category: string]: HoleTemplate[];
}

// ============================================================================
// STANDARD HOLE TEMPLATES
// ============================================================================

const METRIC_HOLES: HoleTemplate[] = [
  { name: 'M2', type: 'Through', diameter: 2.0 },
  { name: 'M2.5', type: 'Through', diameter: 2.5 },
  { name: 'M3', type: 'Through', diameter: 3.0 },
  { name: 'M4', type: 'Through', diameter: 4.0 },
  { name: 'M5', type: 'Through', diameter: 5.0 },
  { name: 'M6', type: 'Through', diameter: 6.0 },
  { name: 'M8', type: 'Through', diameter: 8.0 },
  { name: 'M10', type: 'Through', diameter: 10.0 },
  { name: 'M12', type: 'Through', diameter: 12.0 },
  { name: 'M16', type: 'Through', diameter: 16.0 },
];

const IMPERIAL_HOLES: HoleTemplate[] = [
  { name: '#4 (0.116")', type: 'Through', diameter: 2.946 },
  { name: '#6 (0.138")', type: 'Through', diameter: 3.505 },
  { name: '#8 (0.164")', type: 'Through', diameter: 4.166 },
  { name: '#10 (0.190")', type: 'Through', diameter: 4.826 },
  { name: '1/4"', type: 'Through', diameter: 6.350 },
  { name: '5/16"', type: 'Through', diameter: 7.938 },
  { name: '3/8"', type: 'Through', diameter: 9.525 },
  { name: '1/2"', type: 'Through', diameter: 12.700 },
];

const TAPPED_HOLES: HoleTemplate[] = [
  { name: 'M3 x 0.5', type: 'Tapped', diameter: 2.5, thread: { pitch: 0.5, standard: 'M3' } },
  { name: 'M4 x 0.7', type: 'Tapped', diameter: 3.3, thread: { pitch: 0.7, standard: 'M4' } },
  { name: 'M5 x 0.8', type: 'Tapped', diameter: 4.2, thread: { pitch: 0.8, standard: 'M5' } },
  { name: 'M6 x 1.0', type: 'Tapped', diameter: 5.0, thread: { pitch: 1.0, standard: 'M6' } },
  { name: 'M8 x 1.25', type: 'Tapped', diameter: 6.75, thread: { pitch: 1.25, standard: 'M8' } },
  { name: 'M10 x 1.5', type: 'Tapped', diameter: 8.5, thread: { pitch: 1.5, standard: 'M10' } },
];

const STANDARD_HOLES: StandardHoleLibrary = {
  'Metric Through': METRIC_HOLES,
  'Imperial Through': IMPERIAL_HOLES,
  'Tapped Holes': TAPPED_HOLES,
};

// ============================================================================
// COMPONENT
// ============================================================================

interface HoleWizardProps {
  onCreateHole: (name: string, diameter: number, type: HoleType, params?: any) => void;
  onClose: () => void;
  activePlaneZ?: number;
}

export const HoleWizard: React.FC<HoleWizardProps> = ({ onCreateHole, onClose, activePlaneZ = 0 }) => {
  const [step, setStep] = useState<'mode' | 'template' | 'custom'>('mode');
  const [selectedCategory, setSelectedCategory] = useState<string>('Metric Through');
  const [selectedTemplate, setSelectedTemplate] = useState<HoleTemplate | null>(null);

  // Custom hole parameters
  const [customHoleName, setCustomHoleName] = useState('Hole');
  const [customType, setCustomType] = useState<HoleType>('Through');
  const [customDiameter, setCustomDiameter] = useState(6.0);
  const [customDepth, setCustomDepth] = useState(10.0);

  // Counterbore/Countersink parameters
  const [cbDiameter, setCbDiameter] = useState(10.0);
  const [cbDepth, setCbDepth] = useState(2.0);
  const [csDiameter, setCsDiameter] = useState(10.0);
  const [csAngle, setCsAngle] = useState(82.0);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedTemplate(null);
    setStep('template');
  };

  const handleSelectTemplate = (template: HoleTemplate) => {
    setSelectedTemplate(template);
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;

    const params = {
      depth: selectedTemplate.depth,
      counterbore: selectedTemplate.counterbore,
      countersink: selectedTemplate.countersink,
      thread: selectedTemplate.thread,
    };

    onCreateHole(selectedTemplate.name, selectedTemplate.diameter, selectedTemplate.type, params);
  };

  const handleCreateCustom = () => {
    const params = {
      depth: customDepth,
      counterbore: customType === 'CounterBore' ? { diameter: cbDiameter, depth: cbDepth } : undefined,
      countersink: customType === 'CounterSink' ? { diameter: csDiameter, angle: csAngle } : undefined,
    };

    onCreateHole(customHoleName, customDiameter, customType, params);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Hole Wizard</h2>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>
      </div>

      {step === 'mode' && (
        <div className={styles.modeSelection}>
          <p className={styles.instructions}>Choose how to create a hole:</p>

          <button
            className={styles.modeButton}
            onClick={() => handleSelectCategory('Metric Through')}
          >
            <div className={styles.modeIcon}>📏</div>
            <div className={styles.modeTitle}>Standard Template</div>
            <div className={styles.modeDescription}>Use predefined hole sizes</div>
          </button>

          <button className={styles.modeButton} onClick={() => setStep('custom')}>
            <div className={styles.modeIcon}>⚙️</div>
            <div className={styles.modeTitle}>Custom Hole</div>
            <div className={styles.modeDescription}>Define custom parameters</div>
          </button>
        </div>
      )}

      {step === 'template' && (
        <div className={styles.templateSelection}>
          <div className={styles.categoryList}>
            {Object.keys(STANDARD_HOLES).map((category) => (
              <button
                key={category}
                className={`${styles.categoryButton} ${
                  selectedCategory === category ? styles.active : ''
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className={styles.templateGrid}>
            {STANDARD_HOLES[selectedCategory]?.map((template) => (
              <button
                key={template.name}
                className={`${styles.templateButton} ${
                  selectedTemplate?.name === template.name ? styles.selected : ''
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                <div className={styles.templateName}>{template.name}</div>
                <div className={styles.templateDiameter}>⌀{template.diameter.toFixed(2)}mm</div>
                {template.thread && (
                  <div className={styles.templateThread}>Tapped</div>
                )}
              </button>
            ))}
          </div>

          <div className={styles.preview}>
            {selectedTemplate && (
              <div className={styles.previewBox}>
                <h4>Hole Details</h4>
                <div className={styles.detailItem}>
                  <span>Type:</span>
                  <strong>{selectedTemplate.type}</strong>
                </div>
                <div className={styles.detailItem}>
                  <span>Diameter:</span>
                  <strong>{selectedTemplate.diameter}mm</strong>
                </div>
                {selectedTemplate.depth !== undefined && (
                  <div className={styles.detailItem}>
                    <span>Depth:</span>
                    <strong>{selectedTemplate.depth}mm</strong>
                  </div>
                )}
                {selectedTemplate.thread && (
                  <div className={styles.detailItem}>
                    <span>Thread:</span>
                    <strong>{selectedTemplate.thread.standard}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={() => setStep('mode')}>
              Back
            </button>
            <button
              className={styles.primaryButton}
              onClick={handleApplyTemplate}
              disabled={!selectedTemplate}
            >
              Create Hole
            </button>
          </div>
        </div>
      )}

      {step === 'custom' && (
        <div className={styles.customForm}>
          <div className={styles.formGroup}>
            <label>Hole Name</label>
            <input
              type="text"
              value={customHoleName}
              onChange={(e) => setCustomHoleName(e.target.value)}
              placeholder="e.g., Mounting Hole"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Hole Type</label>
            <select value={customType} onChange={(e) => setCustomType(e.target.value as HoleType)}>
              <option value="Through">Through Hole</option>
              <option value="Blind">Blind Hole</option>
              <option value="CounterBore">Counterbore</option>
              <option value="CounterSink">Countersink</option>
              <option value="Tapped">Tapped Hole</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Diameter (mm)</label>
            <input
              type="number"
              value={customDiameter}
              onChange={(e) => setCustomDiameter(parseFloat(e.target.value))}
              step="0.1"
              min="0.5"
              max="100"
            />
          </div>

          {(customType === 'Blind' || customType === 'Tapped') && (
            <div className={styles.formGroup}>
              <label>Depth (mm)</label>
              <input
                type="number"
                value={customDepth}
                onChange={(e) => setCustomDepth(parseFloat(e.target.value))}
                step="0.1"
                min="0.1"
                max="500"
              />
            </div>
          )}

          {customType === 'CounterBore' && (
            <>
              <div className={styles.formGroup}>
                <label>Counterbore Diameter (mm)</label>
                <input
                  type="number"
                  value={cbDiameter}
                  onChange={(e) => setCbDiameter(parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Counterbore Depth (mm)</label>
                <input
                  type="number"
                  value={cbDepth}
                  onChange={(e) => setCbDepth(parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
            </>
          )}

          {customType === 'CounterSink' && (
            <>
              <div className={styles.formGroup}>
                <label>Countersink Diameter (mm)</label>
                <input
                  type="number"
                  value={csDiameter}
                  onChange={(e) => setCsDiameter(parseFloat(e.target.value))}
                  step="0.1"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Countersink Angle (°)</label>
                <input
                  type="number"
                  value={csAngle}
                  onChange={(e) => setCsAngle(parseFloat(e.target.value))}
                  step="0.5"
                  min="0"
                  max="180"
                />
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={() => setStep('mode')}>
              Back
            </button>
            <button className={styles.primaryButton} onClick={handleCreateCustom}>
              Create Hole
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HoleWizard;
