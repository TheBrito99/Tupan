/**
 * Modulated Transformer Configuration Component
 *
 * Allows users to configure time-varying transformer ratios
 */

import React, { useState, useEffect } from 'react';
import type { EditorElement } from './types';
import {
  MODULATED_TRANSFORMER_LIBRARY,
  type ModulationType,
  type ModulationParams,
  type ModulatedTransformer,
  describeModulationType,
  validateModulationParams,
  computeModulatedRatio,
} from './modulatedTransformers';
import styles from './BondGraphEditor.module.css';

interface ModulatedTransformerInfoProps {
  element: EditorElement;
  onAddModulation?: (modulated: ModulatedTransformer) => void;
  onRemoveModulation?: () => void;
  currentModulation?: ModulatedTransformer;
}

export const ModulatedTransformerInfo: React.FC<ModulatedTransformerInfoProps> = ({
  element,
  onAddModulation,
  onRemoveModulation,
  currentModulation,
}) => {
  const [selectedModulation, setSelectedModulation] = useState<ModulationType>('sine_wave');
  const [showLibrary, setShowLibrary] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);

  // Only available for TF elements
  const isTFElement = element.type === 'TF';

  if (!isTFElement) {
    return (
      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
        <p style={{ margin: 0 }}>ℹ️ Modulation is only available for Transformer (TF) elements</p>
      </div>
    );
  }

  const libraryExamples = Object.values(MODULATED_TRANSFORMER_LIBRARY);
  const selectedExample = libraryExamples.find((e) => e.modulation_type === selectedModulation);

  const handleApplyExample = (example: ModulatedTransformer) => {
    if (onAddModulation) {
      onAddModulation({
        ...example,
        id: `${example.id}_${element.id}`,
      });
    }
  };

  const handleRemove = () => {
    if (onRemoveModulation) {
      onRemoveModulation();
    }
  };

  const previewRatio = selectedExample ? computeModulatedRatio(previewTime, selectedExample.parameters) : 1.0;

  return (
    <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: '#333' }}>⏱️ Modulated Transformer Ratio</h4>
        {currentModulation && (
          <button
            onClick={handleRemove}
            style={{
              padding: '4px 8px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Current modulation status */}
      {currentModulation && (
        <div
          style={{
            padding: '8px',
            marginBottom: '12px',
            borderRadius: '4px',
            backgroundColor: '#e3f2fd',
            borderLeft: `4px solid #1565c0`,
          }}
        >
          <strong style={{ color: '#1565c0' }}>✓ Active Modulation</strong>
          <br />
          <span style={{ fontSize: '12px', color: '#0d47a1' }}>
            {currentModulation.description}
          </span>
          <div style={{ fontSize: '11px', color: '#1976d2', marginTop: '4px', fontStyle: 'italic' }}>
            {currentModulation.physical_interpretation}
          </div>
        </div>
      )}

      {/* Modulation type selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#555' }}>
          Modulation Type
        </label>
        <select
          value={selectedModulation}
          onChange={(e) => setSelectedModulation(e.target.value as ModulationType)}
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          <optgroup label="Time-Based Functions">
            <option value="constant">Constant (No modulation)</option>
            <option value="sine_wave">Sine Wave (Oscillation)</option>
            <option value="square_wave">Square Wave (PWM, Pulse)</option>
            <option value="sawtooth">Sawtooth (Ramp)</option>
            <option value="triangular">Triangular (Symmetric)</option>
            <option value="exponential">Exponential (Growth/Decay)</option>
            <option value="step_function">Step Function (Discrete)</option>
          </optgroup>
          <optgroup label="Signal/State-Based">
            <option value="control_signal">Control Signal (Feedback)</option>
            <option value="state_dependent">State Dependent (Adaptive)</option>
            <option value="lookup_table">Lookup Table (Real Data)</option>
          </optgroup>
          <optgroup label="Advanced">
            <option value="custom_function">Custom Function (Expression)</option>
          </optgroup>
        </select>
        <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0' }}>
          {describeModulationType(selectedModulation)}
        </p>
      </div>

      {/* Modulation-specific parameters */}
      {selectedExample && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            marginBottom: '12px',
          }}
        >
          <strong style={{ display: 'block', fontSize: '12px', marginBottom: '8px', color: '#333' }}>
            Parameters
          </strong>

          {/* Render based on modulation type */}
          {selectedExample.modulation_type === 'sine_wave' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Amplitude</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).amplitude}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Frequency (Hz)</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).frequency}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Offset</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).offset}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Phase (rad)</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).phase}
                </code>
              </div>
            </div>
          )}

          {selectedExample.modulation_type === 'square_wave' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Frequency (Hz)</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).frequency}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Duty Cycle</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {((selectedExample.parameters as any).duty_cycle * 100).toFixed(1)}%
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>High Value</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).value_high}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Low Value</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).value_low}
                </code>
              </div>
            </div>
          )}

          {selectedExample.modulation_type === 'exponential' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Initial Ratio</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).initial_ratio}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Final Ratio</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).final_ratio}
                </code>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Time Constant (s)</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).time_constant}
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview section */}
      {selectedExample && (
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '8px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              color: '#333',
            }}
          >
            {showPreview ? '▼' : '▶'} Time Domain Preview
          </button>

          {showPreview && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f0f8ff',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', color: '#333', marginBottom: '4px', fontWeight: '600' }}>
                  Time (seconds)
                </label>
                <input
                  type="range"
                  value={previewTime}
                  onChange={(e) => setPreviewTime(parseFloat(e.target.value))}
                  min="0"
                  max="10"
                  step="0.1"
                  style={{
                    width: '100%',
                    marginBottom: '4px',
                  }}
                />
                <input
                  type="number"
                  value={previewTime}
                  onChange={(e) => setPreviewTime(parseFloat(e.target.value))}
                  min="0"
                  max="10"
                  step="0.1"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div style={{ padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontFamily: 'monospace' }}>
                <div style={{ color: '#666', marginBottom: '4px' }}>
                  Time: <span style={{ color: '#1565c0', fontWeight: '600' }}>{previewTime.toFixed(2)}s</span>
                </div>
                <div style={{ color: '#2e7d32' }}>
                  Ratio: <span style={{ color: '#2e7d32', fontWeight: '600' }}>{previewRatio.toFixed(3)}</span>
                </div>
              </div>

              {/* Time-domain plot */}
              <div style={{ marginTop: '8px' }}>
                <canvas
                  width={280}
                  height={120}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    display: 'block',
                  }}
                  ref={(canvas) => {
                    if (canvas && selectedExample) {
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        // Clear
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Draw axes
                        ctx.strokeStyle = '#ccc';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(30, 100);
                        ctx.lineTo(280, 100);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(30, 10);
                        ctx.lineTo(30, 100);
                        ctx.stroke();

                        // Draw axis labels
                        ctx.fillStyle = '#999';
                        ctx.font = '10px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('0', 35, 110);
                        ctx.fillText('10s', 275, 110);
                        ctx.textAlign = 'right';
                        ctx.fillText('2.0', 25, 15);
                        ctx.fillText('0.0', 25, 105);

                        // Draw characteristic curve
                        ctx.strokeStyle = '#1565c0';
                        ctx.lineWidth = 2;
                        ctx.beginPath();

                        for (let t = 0; t <= 10; t += 0.1) {
                          const ratioVal = computeModulatedRatio(t, selectedExample.parameters);
                          const screenX = 30 + (t / 10) * 250;
                          const screenY = 100 - (ratioVal / 2) * 80;

                          if (t === 0) {
                            ctx.moveTo(screenX, screenY);
                          } else {
                            ctx.lineTo(screenX, screenY);
                          }
                        }
                        ctx.stroke();

                        // Draw current point
                        const currScreenX = 30 + (previewTime / 10) * 250;
                        const currScreenY = 100 - (previewRatio / 2) * 80;
                        ctx.fillStyle = '#d32f2f';
                        ctx.beginPath();
                        ctx.arc(currScreenX, currScreenY, 4, 0, Math.PI * 2);
                        ctx.fill();

                        // Draw vertical line at current time
                        ctx.strokeStyle = '#d32f2f';
                        ctx.setLineDash([4, 4]);
                        ctx.beginPath();
                        ctx.moveTo(currScreenX, 10);
                        ctx.lineTo(currScreenX, 100);
                        ctx.stroke();
                        ctx.setLineDash([]);
                      }
                    }
                  }}
                />
              </div>

              <p style={{ fontSize: '11px', color: '#666', margin: '8px 0 0 0' }}>
                ← Drag slider or type time to preview ratio at different times
              </p>
            </div>
          )}
        </div>
      )}

      {/* Library of predefined modulations */}
      <button
        onClick={() => setShowLibrary(!showLibrary)}
        style={{
          width: '100%',
          padding: '8px',
          marginBottom: '12px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          color: '#333',
        }}
      >
        {showLibrary ? '▼' : '▶'} Library Examples ({libraryExamples.length} available)
      </button>

      {showLibrary && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {libraryExamples.map((example) => (
            <div
              key={example.id}
              style={{
                padding: '8px',
                backgroundColor: '#f9f9f9',
                border: `1px solid ${example.id === currentModulation?.id ? '#1565c0' : '#ddd'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
                e.currentTarget.style.borderColor = '#999';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f9f9f9';
                e.currentTarget.style.borderColor = example.id === currentModulation?.id ? '#1565c0' : '#ddd';
              }}
              onClick={() => handleApplyExample(example)}
            >
              <strong style={{ fontSize: '12px', color: '#333', display: 'block' }}>
                {example.description}
              </strong>
              <span style={{ fontSize: '11px', color: '#666', display: 'block', marginTop: '2px' }}>
                {example.physical_interpretation}
              </span>
              <code style={{ fontSize: '10px', color: '#999', display: 'block', marginTop: '2px' }}>
                {example.modulation_type}
              </code>
            </div>
          ))}
        </div>
      )}

      {/* Physics explanation */}
      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '12px', lineHeight: '1.6' }}>
        <strong style={{ color: '#e65100' }}>⚙️ Why Modulated Transformers Matter:</strong>
        <ul style={{ margin: '6px 0 0 16px', color: '#333', paddingLeft: 0 }}>
          <li>Transmissions: Manual and automatic gear shifts change torque multiplication</li>
          <li>Power electronics: PWM switches power on and off (varies average voltage/current)</li>
          <li>Control systems: Feedback adjusts ratio to maintain setpoint (adaptive)</li>
          <li>Mechanisms: Cams and linkages create periodic load variation</li>
          <li>Realistic models: Real systems adapt to conditions, not fixed ratio</li>
        </ul>
      </div>
    </div>
  );
};

export default ModulatedTransformerInfo;
